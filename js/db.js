/*
  DB module — dual-backend storage.
  Logged-in users: reads/writes sync to Supabase (text) + IndexedDB (media).
  Guest users: IndexedDB only.
  Media (photos/videos) always stays in IndexedDB — too large for the DB.

  Cross-device photos (Google users only): when a photo is uploaded to the
  user's own Google Drive, a lightweight pointer {driveId, type, name} —
  never the image bytes — rides along in the cloud copy of the entry.
  Other devices pick that pointer up through the normal text sync, then
  the Sync button (syncMediaFromCloud) downloads the actual files from
  Drive into that device's IndexedDB. Email/password users have no Drive
  access token, so their photos stay device-local only.
*/

/* ── IndexedDB ── */
const IDB_NAME    = 'journalDB';
const IDB_VERSION = 2;
let idb = null;

function openIDB() {
  return new Promise((resolve, reject) => {
    if (idb) { resolve(idb); return; }
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('entries'))     db.createObjectStore('entries',     { keyPath: 'date' });
      if (!db.objectStoreNames.contains('goals'))       db.createObjectStore('goals',       { keyPath: 'monthKey' });
      if (!db.objectStoreNames.contains('recap'))       db.createObjectStore('recap',       { keyPath: 'monthKey' });
      if (!db.objectStoreNames.contains('routines'))    db.createObjectStore('routines',    { keyPath: 'id' });
      if (!db.objectStoreNames.contains('routineLog'))  db.createObjectStore('routineLog',  { keyPath: 'date' });
    };
    req.onsuccess  = (e) => {
      idb = e.target.result;
      // Let a future version upgrade proceed instead of blocking on this tab
      idb.onversionchange = () => { idb.close(); idb = null; };
      resolve(idb);
    };
    req.onerror    = () => reject(req.error);
    req.onblocked  = () => {
      console.warn('IndexedDB upgrade blocked — another journal tab is open');
      if (window.App?.showToast) App.showToast('Please close your other journal tabs, then reload 🌸', 6000);
    };
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
  // Keep pointers only for files that made it to Drive — never the
  // dataUrl bytes (too large for the 1MB row limit, and the whole point
  // of keeping media out of the database).
  e.media = (entry.media || [])
    .filter(m => m.driveId)
    .map(m => ({ driveId: m.driveId, type: m.type, name: m.name }));
  return e;
}

/* ── Public API ── */
async function openDB() {
  await openIDB();
}

/* Months the cloud has confirmed empty this session — skip re-asking */
const _cloudMiss = new Set();

/* Merge cloud media pointers onto local media: keep every local item
   (it may already have a downloaded dataUrl) and add any Drive pointer
   the cloud knows about that this device hasn't seen yet. */
function mergeMedia(localMedia, cloudMedia) {
  const local = localMedia || [];
  const seen  = new Set(local.filter(m => m.driveId).map(m => m.driveId));
  const extra = (cloudMedia || []).filter(m => m.driveId && !seen.has(m.driveId));
  return local.concat(extra);
}

/* Pull all cloud entries into IndexedDB (media stays local-only, but
   Drive pointers are merged in so the Sync button can find them).
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
      entry.media = mergeMedia(local?.media, entry.media);
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
  if (!entry.media?.length) return { entry, driveError: null, skipReason: null };
  if (!JournalDrive.isGoogleUser()) {
    return { entry, driveError: null, skipReason: 'not-google' };
  }
  const uploaded = [];
  let driveError = null;
  for (const item of entry.media) {
    if (item.driveId) { uploaded.push(item); continue; }
    try {
      const res  = await fetch(item.dataUrl);
      const blob = await res.blob();
      const driveId = await JournalDrive.uploadFile(blob, item.name || `journal-${entry.date}-${Date.now()}`, item.type || blob.type);
      // dataUrl is kept, not cleared — this device already has the photo
      // and shouldn't need to re-download it from Drive to show it.
      uploaded.push({ ...item, driveId });
    } catch (e) {
      console.warn('Drive upload failed, keeping local-only:', e);
      driveError = e?.message || String(e);
      uploaded.push(item);
    }
  }
  return { entry: { ...entry, media: uploaded }, driveError, skipReason: null };
}

/* Fills in dataUrl for any media this device only knows about as a Drive
   pointer (arrived via cloud sync from another device). Downloaded files
   are written back to IndexedDB so this only happens once per photo. */
async function resolveMediaUrls(entry) {
  if (!entry?.media?.some(m => m.driveId && !m.dataUrl)) return entry;
  let changed = false;
  const resolved = await Promise.all(entry.media.map(async (item) => {
    if (item.driveId && !item.dataUrl) {
      try {
        const dataUrl = await JournalDrive.downloadAsDataUrl(item.driveId);
        changed = true;
        return { ...item, dataUrl };
      } catch (e) {
        console.warn('Drive fetch failed for', item.driveId, e);
      }
    }
    return item;
  }));
  const updated = { ...entry, media: resolved };
  if (changed) idbReq(idbTx('entries', 'readwrite').put(updated)).catch(() => {});
  return updated;
}

async function saveEntry(entry) {
  await openIDB();
  entry.updatedAt = new Date().toISOString();

  const upload = await uploadMediaToDrive(entry);
  entry = upload.entry;
  await idbReq(idbTx('entries', 'readwrite').put(entry));

  let cloudError = null;
  if (useSupabase()) {
    try {
      const { error } = await SupabaseClient.from('entries').upsert({
        user_id:     getUserId(),
        date:        entry.date,
        data:        await JournalCrypto.encrypt(entryForCloud(entry)),
        updated_at:  entry.updatedAt,
      }, { onConflict: 'user_id,date' });
      if (error) throw error;
    } catch (e) {
      console.warn('Supabase saveEntry failed', e);
      cloudError = e?.message || String(e);
    }
  } else {
    cloudError = 'not-logged-in';
  }

  return { driveError: upload.driveError, skipReason: upload.skipReason, cloudError };
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
      const { error } = await SupabaseClient.from('goals').upsert({
        user_id:    getUserId(),
        month_key:  key,
        data:       await JournalCrypto.encrypt(record),
        updated_at: record.updatedAt,
      }, { onConflict: 'user_id,month_key' });
      if (error) throw error;
    } catch (e) {
      console.warn('Supabase saveGoals failed', e);
      return { cloudError: e?.message || String(e) };
    }
  }
  return { cloudError: null };
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
      const { error } = await SupabaseClient.from('recap').upsert({
        user_id:    getUserId(),
        month_key:  key,
        data:       await JournalCrypto.encrypt(record),
        updated_at: record.updatedAt,
      }, { onConflict: 'user_id,month_key' });
      if (error) throw error;
    } catch (e) {
      console.warn('Supabase saveRecap failed', e);
      return { cloudError: e?.message || String(e) };
    }
  }
  return { cloudError: null };
}

/* Daily Routines — local-only for now (IndexedDB only, no Supabase sync)
   while the feature is still being tried out. */
async function getRoutines() {
  await openIDB();
  return idbReq(idbTx('routines').getAll());
}

async function saveRoutine(routine) {
  await openIDB();
  await idbReq(idbTx('routines', 'readwrite').put(routine));
}

async function deleteRoutine(id) {
  await openIDB();
  await idbReq(idbTx('routines', 'readwrite').delete(id));
}

async function getRoutineLog(date) {
  await openIDB();
  const log = await idbReq(idbTx('routineLog').get(date));
  return log?.completed || {};
}

async function setRoutineDone(date, routineId, done) {
  await openIDB();
  const existing  = await idbReq(idbTx('routineLog').get(date)) || { date, completed: {} };
  const completed = { ...existing.completed, [routineId]: done };
  await idbReq(idbTx('routineLog', 'readwrite').put({ date, completed }));
}

async function syncFromCloud() {
  if (!useSupabase()) return { entries: 0, goals: 0, recap: 0, debug: 'useSupabase() was false' };
  await openIDB();
  _cloudMiss.clear();
  const uid = getUserId();
  let counts = { entries: 0, goals: 0, recap: 0 };
  const errors = [];

  if (!uid) errors.push('no user id available (not signed in?)');

  try {
    const { data: eRows, error } = await SupabaseClient.from('entries').select('*').eq('user_id', uid);
    if (error) throw error;
    if (eRows?.length) {
      for (const row of eRows) {
        const entry = await JournalCrypto.decrypt(row.data);
        const local = await idbReq(idbTx('entries').get(row.date));
        entry.media = mergeMedia(local?.media, entry.media);
        // Fresh transaction per row — IndexedDB transactions auto-commit
        // while decrypt() is awaited, so a shared one would already be
        // closed ("The transaction has finished") by the second put.
        await idbReq(idbTx('entries', 'readwrite').put({ ...entry, date: row.date }));
      }
      counts.entries = eRows.length;
    }
  } catch (e) { console.warn('Sync entries failed', e); errors.push(`entries: ${e?.message || e}`); }

  try {
    const { data: gRows, error } = await SupabaseClient.from('goals').select('*').eq('user_id', uid);
    if (error) throw error;
    if (gRows?.length) {
      for (const row of gRows) {
        const record = await JournalCrypto.decrypt(row.data);
        await idbReq(idbTx('goals', 'readwrite').put({ ...record, monthKey: row.month_key }));
      }
      counts.goals = gRows.length;
    }
  } catch (e) { console.warn('Sync goals failed', e); errors.push(`goals: ${e?.message || e}`); }

  try {
    const { data: rRows, error } = await SupabaseClient.from('recap').select('*').eq('user_id', uid);
    if (error) throw error;
    if (rRows?.length) {
      for (const row of rRows) {
        const record = await JournalCrypto.decrypt(row.data);
        await idbReq(idbTx('recap', 'readwrite').put({ ...record, monthKey: row.month_key }));
      }
      counts.recap = rRows.length;
    }
  } catch (e) { console.warn('Sync recap failed', e); errors.push(`recap: ${e?.message || e}`); }

  counts.photos   = await syncMediaFromCloud();
  counts.uploaded = await uploadPendingMedia();
  counts.debug = `uid=${uid || 'MISSING'}${errors.length ? '; errors: ' + errors.join(' | ') : ''}`;

  return counts;
}

/* Retries Drive uploads for photos that missed their backup — e.g. the
   Google token had expired when the entry was saved. Media with a dataUrl
   but no driveId is pending; runs during Sync so a fresh sign-in
   self-heals the backlog. Stops at the first token failure instead of
   erroring once per photo. */
async function uploadPendingMedia() {
  if (!useSupabase() || !JournalDrive.isGoogleUser()) return 0;
  let uploaded = 0;
  try {
    const all = await idbReq(idbTx('entries').getAll());
    for (const entry of all) {
      if (!(entry.media || []).some(m => m.dataUrl && !m.driveId)) continue;
      const before = (entry.media || []).filter(m => m.driveId).length;
      const res    = await uploadMediaToDrive(entry);
      const after  = (res.entry.media || []).filter(m => m.driveId).length;
      if (after > before) {
        uploaded += after - before;
        // saveEntry pushes the new Drive pointers into the cloud copy;
        // items that now have a driveId are skipped, not re-uploaded.
        await saveEntry(res.entry);
      }
      if (res.driveError) break;
    }
  } catch (e) {
    console.warn('Pending media upload failed', e);
  }
  return uploaded;
}

/* Downloads every Drive-hosted photo/video this device doesn't have yet.
   Google users only — email/password accounts have no Drive access and
   their media stays device-local, by design. Called by the Sync button
   after entries/goals/recap text sync above has run. */
async function syncMediaFromCloud() {
  if (!useSupabase() || !JournalDrive.isGoogleUser()) return 0;

  let downloaded = 0;
  let authExpired = false;

  try {
    const { data: rows } = await SupabaseClient
      .from('entries').select('date,data').eq('user_id', getUserId());

    for (const row of rows || []) {
      if (authExpired) break;
      let cloudEntry;
      try { cloudEntry = await JournalCrypto.decrypt(row.data); } catch { continue; }

      const cloudMedia = (cloudEntry?.media || []).filter(m => m.driveId);
      if (!cloudMedia.length) continue;

      const local = await idbReq(idbTx('entries').get(row.date));
      const haveIds = new Set((local?.media || []).filter(m => m.driveId).map(m => m.driveId));
      const missing = cloudMedia.filter(m => !haveIds.has(m.driveId));
      if (!missing.length) continue;

      const newlyFetched = [];
      for (const m of missing) {
        try {
          const dataUrl = await JournalDrive.downloadAsDataUrl(m.driveId);
          newlyFetched.push({ ...m, dataUrl });
          downloaded++;
        } catch (e) {
          if (e?.authExpired) { authExpired = true; break; }
          console.warn('Drive download failed for', m.driveId, e);
        }
      }

      if (newlyFetched.length) {
        const base = local || cloudEntry;
        const merged = { ...base, date: row.date, media: (local?.media || []).concat(newlyFetched) };
        await idbReq(idbTx('entries', 'readwrite').put(merged));
      }
    }
  } catch (e) {
    console.warn('Sync media failed', e);
  }

  return downloaded;
}

window.JournalDB = { openDB, getEntry, saveEntry, getAllEntries, getEntriesForMonth, getGoals, saveGoals, getRecap, saveRecap, syncFromCloud, getRoutines, saveRoutine, deleteRoutine, getRoutineLog, setRoutineDone };
