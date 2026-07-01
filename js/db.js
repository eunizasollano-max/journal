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

async function getEntry(date) {
  await openIDB();
  if (useSupabase()) {
    try {
      const { data } = await SupabaseClient
        .from('entries')
        .select('data')
        .eq('user_id', getUserId())
        .eq('date', date)
        .maybeSingle();

      if (data) {
        const cloudEntry = await JournalCrypto.decrypt(data.data);
        const localEntry = await idbReq(idbTx('entries').get(date));
        if (localEntry?.media) cloudEntry.media = localEntry.media;
        return cloudEntry;
      }
    } catch (e) {
      console.warn('Supabase getEntry failed, using IndexedDB', e);
    }
  }
  return idbReq(idbTx('entries').get(date));
}

async function saveEntry(entry) {
  await openIDB();
  entry.updatedAt = new Date().toISOString();

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
  if (useSupabase()) {
    try {
      const { data } = await SupabaseClient
        .from('entries')
        .select('data')
        .eq('user_id', getUserId());

      if (data && data.length > 0) {
        const cloudEntries = await Promise.all(data.map(row => JournalCrypto.decrypt(row.data)));
        const localEntries = await idbReq(idbTx('entries').getAll());
        const localMap = {};
        localEntries.forEach(e => { localMap[e.date] = e; });
        return cloudEntries.map(ce => ({ ...ce, media: localMap[ce.date]?.media || [] }));
      }
    } catch (e) {
      console.warn('Supabase getAllEntries failed, using IndexedDB', e);
    }
  }
  return idbReq(idbTx('entries').getAll());
}

async function getEntriesForMonth(year, month) {
  const all = await getAllEntries();
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  return all.filter(e => e.date?.startsWith(prefix));
}

async function getGoals(year, month) {
  await openIDB();
  const key = `${year}-${String(month).padStart(2, '0')}`;
  if (useSupabase()) {
    try {
      const { data } = await SupabaseClient
        .from('goals')
        .select('data')
        .eq('user_id', getUserId())
        .eq('month_key', key)
        .maybeSingle();
      if (data) return JournalCrypto.decrypt(data.data);
    } catch (e) {
      console.warn('Supabase getGoals failed', e);
    }
  }
  return idbReq(idbTx('goals').get(key));
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
  if (useSupabase()) {
    try {
      const { data } = await SupabaseClient
        .from('recap')
        .select('data')
        .eq('user_id', getUserId())
        .eq('month_key', key)
        .maybeSingle();
      if (data) return JournalCrypto.decrypt(data.data);
    } catch (e) {
      console.warn('Supabase getRecap failed', e);
    }
  }
  return idbReq(idbTx('recap').get(key));
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

window.JournalDB = { openDB, getEntry, saveEntry, getAllEntries, getEntriesForMonth, getGoals, saveGoals, getRecap, saveRecap };
