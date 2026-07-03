/*
  Google Drive module — stores journal media (photos/videos) in the
  user's own Google Drive under a folder called "Another Day Journal".
  Only works for Google-authenticated users (provider_token required).
  Email/password users continue to use IndexedDB only.
*/

const FOLDER_NAME = 'Another Day Journal';
let _folderId = null;
let _lastExpiredToastAt = 0;

function notifyExpired() {
  // Google's access token is only valid ~1hr and Supabase doesn't refresh
  // it, so this fires often during a long session — debounce so a bulk
  // sync (many files) doesn't spam the same toast per file.
  const now = Date.now();
  if (now - _lastExpiredToastAt < 10000) return;
  _lastExpiredToastAt = now;
  window.App?.showToast?.('Google session expired — please sign in again to sync photos.');
}

async function getDriveTokenAsync() {
  const { data } = await SupabaseClient.auth.getSession();
  const token = data?.session?.provider_token || null;
  if (!token && isGoogleUser()) notifyExpired();
  return token;
}

function isGoogleUser() {
  const user = Auth.getCurrentUser();
  return user?.app_metadata?.provider === 'google';
}

async function driveRequest(path, options = {}) {
  const token = await getDriveTokenAsync();
  if (!token) throw new Error('No Drive token');
  const res = await fetch(`https://www.googleapis.com/drive/v3/${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Drive error ${res.status}`);
  }
  return res.json();
}

async function getOrCreateFolder() {
  if (_folderId) return _folderId;

  // Search for existing folder
  const search = await driveRequest(
    `files?q=name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id)`
  );

  if (search.files?.length > 0) {
    _folderId = search.files[0].id;
    return _folderId;
  }

  // Create folder
  const folder = await driveRequest('files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });

  _folderId = folder.id;
  return _folderId;
}

async function uploadFile(blob, filename, mimeType) {
  const token = await getDriveTokenAsync();
  if (!token) throw new Error('No Drive token');

  const folderId = await getOrCreateFolder();

  const metadata = JSON.stringify({ name: filename, parents: [folderId] });
  const form = new FormData();
  form.append('metadata', new Blob([metadata], { type: 'application/json' }));
  form.append('file', blob);

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: form,
  });

  if (!res.ok) throw new Error(`Drive upload failed: ${res.status}`);
  const data = await res.json();
  return data.id; // Drive file ID
}

async function downloadAsDataUrl(fileId) {
  const token = await getDriveTokenAsync();
  if (!token) { const err = new Error('No Drive token'); err.authExpired = true; throw err; }

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (res.status === 401) { notifyExpired(); const err = new Error('Drive token expired'); err.authExpired = true; throw err; }
  if (!res.ok) throw new Error(`Drive download failed: ${res.status}`);

  const blob = await res.blob();
  // A data: URL (not a blob: URL) so it can be written to IndexedDB and
  // survive a reload — matches how locally-added photos are stored.
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function deleteFile(fileId) {
  try {
    const token = await getDriveTokenAsync();
    if (!token) return;
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
  } catch (e) {
    console.warn('Drive delete failed:', e);
  }
}

window.JournalDrive = { isGoogleUser, uploadFile, downloadAsDataUrl, deleteFile };
