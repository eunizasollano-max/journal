/*
  DB module — dual-backend storage.
  Logged-in users: reads/writes sync to Supabase (text) + IndexedDB (media).
  Guest users: IndexedDB only.
  Media (photos/videos) always stays in IndexedDB — too large for the DB.
*/

/* ── IndexedDB ── */
const IDB_NAME    = 'journalDB';
const IDB_VERSION = 1;
let idb = null;

function openIDB() {
  return new Promise((resolve, reject) => {
    if (idb) { resolve(idb); return; }
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('entries')) db.createObjectStore('entries', { keyPath: 'date' });
      if (!db.objectStoreNames.contains('goals'))   db.createObjectStore('goals',   { keyPath: 'monthKey' });
      if (!db.objectStoreNames.contains('recap'))   db.createObjectStore('recap',   { keyPath: 'monthKey' });
    };
    req.onsuccess  = (e) => { idb = e.target.result; resolve(idb); };
    req.onerror    = () => reject(req.error);
  });
}

function idbTx(storeName, mode = 'readonly') {
  return idb.transaction(storeName, mode).objectStore(storeName);
}

function idbReq(req) {
  return new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
}

/* ── Supabase helpers ── */
function useSupabase() {
  return window.SupabaseClient &&
         typeof Auth !== 'undefined' &&
         Auth.isLoggedIn?.() &&
         !window._guestMode;
}

function getUserId() {
  return Auth.getCurrentUser?.()?.id;
}

function entryForCloud(entry) {
  const e = { ...entry };
  e.mediaCount = (e.media || []).length;
  delete e.media;
  return e;
}

/* ── Public API ── */
async function openDB() {
  await openIDB();
}

/* Months the cloud has confirmed empty this session — skip re-asking */
const _cloudMiss = new Set();

/* Pull all cloud entries into IndexedDB (media stays local-only).
   Runs in the background so reads never wait on the network. */
let _entriesRefreshed = false;
async function cloudRefreshEntries() {
  if (!useSupabase()) return;
  try {
    const { data } = await SupabaseClient
      .from('entries')
      .select('data')
      .eq('user_id', getUserId());
    for (const row of data || []) {
      const entry = await JournalCrypto.decrypt(row.data);
      if (!entry?.date) continue;
      const local = await idbReq(idbTx('entries').get(entry.date));
      if (local?.updatedAt && entry.updatedAt && local.updatedAt > entry.updatedAt) continue;
      if (local?.media) entry.media = local.media;
      await idbReq(idbTx('entries', 'readwrite').put(entry));
    }
    _entriesRefreshed = true;
  } catch (e) {
    console.warn('Background entries refresh failed', e);
  }
}

async function getEntry(date) {
  await openIDB();
  let local = await idbReq(idbTx('entries').get(date));
  if (!local && useSupabase() && !_cloudMiss.has('entry:' + date)) {
    try {
      const { data } = await SupabaseClient
        .from('entries')
        .select('data')
        .eq('user_id', getUserId())
        .eq('date', date)
        .maybeSingle();

      if (data) {
        local = await JournalCrypto.decrypt(data.data);
        if (local?.date) await idbReq(idbTx('entries', 'readwrite').put(local));
      } else {
        _cloudMiss.add('entry:' + date);
      }
    } catch (e) {
      console.warn('Supabase getEntry failed, using IndexedDB', e);
    }
  }
  return resolveMediaUrls(local);
}

async function uploadMediaToDrive(entry) {
  if (!JournalDrive.isGoogleUser() || !entry.media?.length) return entry;
  const uploaded = [];
  for (const item of entry.media) {
    if (item.driveId) { uploaded.push(item); continue; }
    try {
      const res  = await fetch(item.url);
      const blob = await res.blob();
      const driveId = await JournalDrive.uploadFile(blob, `journal-${entry.date}-${Date.now()}`, item.type || blob.type);
      uploaded.push({ ...item, driveId, url: null });
    } catch (e) {
      console.warn('Drive upload failed, keeping local:', e);
      uploaded.push(item);
    }
  }
  return { ...entry, media: uploaded };
}

async function resolveMediaUrls(entry) {
  if (!entry?.media?.length) return entry;
  const resolved = await Promise.all(entry.media.map(async (item) => {
    if (item.driveId && !item.url) {
      const url = await JournalDrive.getFileUrl(item.driveId).catch(() => null);
      return { ...item, url };
    }
    return item;
  }));
  return { ...entry, media: resolved };
}

async function saveEntry(entry) {
  await openIDB();
  entry.updatedAt = new Date().toISOString();

  entry = await uploadMediaToDrive(entry);
  await idbReq(idbTx('entries', 'readwrite').put(entry));

  if (useSupabase()) {
    try {
      await SupabaseClient.from('entries').upsert({
        user_id:     getUserId(),
        date:        entry.date,
        data:        await JournalCrypto.encrypt(entryForCloud(entry)),
        updated_at:  entry.updatedAt,
      }, { onConflict: 'user_id,date' });
    } catch (e) {
      console.warn('Supabase saveEntry failed', e);
    }
  }
}

async function getAllEntries() {
  await openIDB();
  let local = await idbReq(idbTx('entries').getAll());
  if (local.length === 0 && useSupabase() && !_entriesRefreshed) {
    // First use on this device: wait for the cloud copy once
    await cloudRefreshEntries();
    local = await idbReq(idbTx('entries').getAll());
  } else if (!_entriesRefreshed) {
    // Otherwise answer instantly from local and refresh quietly
    cloudRefreshEntries();
  }
  return local;
}

async function getEntriesForMonth(year, month) {
  const all = await getAllEntries();
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  return all.filter(e => e.date?.startsWith(prefix));
}

async function getGoals(year, month) {
  await openIDB();
  const key = `${year}-${String(month).padStart(2, '0')}`;
  let local = await idbReq(idbTx('goals').get(key));
  if (!local && useSupabase() && !_cloudMiss.has('goals:' + key)) {
    try {
      const { data } = await SupabaseClient
        .from('goals')
        .select('data')
        .eq('user_id', getUserId())
        .eq('month_key', key)
        .maybeSingle();
      if (data) {
        local = await JournalCrypto.decrypt(data.data);
        if (local) await idbReq(idbTx('goals', 'readwrite').put({ ...local, monthKey: key }));
      } else {
        _cloudMiss.add('goals:' + key);
      }
    } catch (e) {
      console.warn('Supabase getGoals failed', e);
    }
  }
  return local;
}

async function saveGoals(year, month, goalsData, categoryNames) {
  await openIDB();
  const key    = `${year}-${String(month).padStart(2, '0')}`;
  const record = { monthKey: key, data: goalsData, categoryNames: categoryNames || {}, updatedAt: new Date().toISOString() };
  await idbReq(idbTx('goals', 'readwrite').put(record));
  if (useSupabase()) {
    try {
      await SupabaseClient.from('goals').upsert({
        user_id:    getUserId(),
        month_key:  key,
        data:       await JournalCrypto.encrypt(record),
        updated_at: record.updatedAt,
      }, { onConflict: 'user_id,month_key' });
    } catch (e) {
      console.warn('Supabase saveGoals failed', e);
    }
  }
}

async function getRecap(year, month) {
  await openIDB();
  const key = `${year}-${String(month).padStart(2, '0')}`;
  let local = await idbReq(idbTx('recap').get(key));
  if (!local && useSupabase() && !_cloudMiss.has('recap:' + key)) {
    try {
      const { data } = await SupabaseClient
        .from('recap')
        .select('data')
        .eq('user_id', getUserId())
        .eq('month_key', key)
        .maybeSingle();
      if (data) {
        local = await JournalCrypto.decrypt(data.data);
        if (local) await idbReq(idbTx('recap', 'readwrite').put({ ...local, monthKey: key }));
      } else {
        _cloudMiss.add('recap:' + key);
      }
    } catch (e) {
      console.warn('Supabase getRecap failed', e);
    }
  }
  return local;
}

async function saveRecap(year, month, reflection) {
  await openIDB();
  const key    = `${year}-${String(month).padStart(2, '0')}`;
  const record = { monthKey: key, reflection, updatedAt: new Date().toISOString() };
  await idbReq(idbTx('recap', 'readwrite').put(record));
  if (useSupabase()) {
    try {
      await SupabaseClient.from('recap').upsert({
        user_id:    getUserId(),
        month_key:  key,
        data:       await JournalCrypto.encrypt(record),
        updated_at: record.updatedAt,
      }, { onConflict: 'user_id,month_key' });
    } catch (e) {
      console.warn('Supabase saveRecap failed', e);
    }
  }
}

async function syncFromCloud() {
  if (!useSupabase()) return { entries: 0, goals: 0, recap: 0 };
  await openIDB();
  _cloudMiss.clear();
  const uid = getUserId();
  let counts = { entries: 0, goals: 0, recap: 0 };

  try {
    const { data: eRows } = await SupabaseClient.from('entries').select('*').eq('user_id', uid);
    if (eRows?.length) {
      const store = idbTx('entries', 'readwrite');
      for (const row of eRows) {
        const entry = await JournalCrypto.decrypt(row.data);
        const local = await idbReq(idbTx('entries').get(row.date));
        if (local?.media) entry.media = local.media;
        await idbReq(store.put({ ...entry, date: row.date }));
      }
      counts.entries = eRows.length;
    }
  } catch (e) { console.warn('Sync entries failed', e); }

  try {
    const { data: gRows } = await SupabaseClient.from('goals').select('*').eq('user_id', uid);
    if (gRows?.length) {
      const store = idbTx('goals', 'readwrite');
      for (const row of gRows) {
        const record = await JournalCrypto.decrypt(row.data);
        await idbReq(store.put({ ...record, monthKey: row.month_key }));
      }
      counts.goals = gRows.length;
    }
  } catch (e) { console.warn('Sync goals failed', e); }

  try {
    const { data: rRows } = await SupabaseClient.from('recap').select('*').eq('user_id', uid);
    if (rRows?.length) {
      const store = idbTx('recap', 'readwrite');
      for (const row of rRows) {
        const record = await JournalCrypto.decrypt(row.data);
        await idbReq(store.put({ ...record, monthKey: row.month_key }));
      }
      counts.recap = rRows.length;
    }
  } catch (e) { console.warn('Sync recap failed', e); }

  return counts;
}

window.JournalDB = { openDB, getEntry, saveEntry, getAllEntries, getEntriesForMonth, getGoals, saveGoals, getRecap, saveRecap, syncFromCloud };
