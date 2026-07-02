/*
  Encryption module — AES-GCM 256-bit, key derived via PBKDF2.
  All journal data is encrypted client-side before reaching Supabase.
  The owner of the Supabase project cannot read entries — only the user's
  passphrase can derive the key.

  Key lifecycle:
  - Email users: password captured at login/signup → key derived automatically
  - Google users: separate passphrase prompt shown by app.js
  - Within a browser session: raw key cached in sessionStorage (never sent to server)
  - On new session: passphrase re-entered to re-derive key
*/

let _cryptoKey = null;
const SESSION_KEY = 'jrnl_ek';

/* ── Helpers ── */
function b64Enc(buf) { return btoa(String.fromCharCode(...new Uint8Array(buf))); }
function b64Dec(str) { return Uint8Array.from(atob(str), c => c.charCodeAt(0)); }

async function deriveKey(passphrase, salt) {
  const enc = new TextEncoder();
  const mat = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
    mat,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

async function aeEncrypt(text, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text));
  return { iv: b64Enc(iv), ct: b64Enc(ct) };
}

async function aeDecrypt({ iv, ct }, key) {
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64Dec(iv) }, key, b64Dec(ct));
  return new TextDecoder().decode(plain);
}

/* ── Session cache ── */
async function cacheKey(key) {
  const raw = await crypto.subtle.exportKey('raw', key);
  sessionStorage.setItem(SESSION_KEY, b64Enc(raw));
}

async function restoreKeyFromSession() {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return false;
  try {
    _cryptoKey = await crypto.subtle.importKey(
      'raw', b64Dec(raw), { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
    );
    return true;
  } catch { return false; }
}

/* ── Supabase key record ── */
async function hasUserKey(userId) {
  const { data } = await SupabaseClient.from('user_keys').select('user_id').eq('user_id', userId).maybeSingle();
  return !!data;
}

async function initCrypto(passphrase, userId) {
  const { data, error: selectErr } = await SupabaseClient
    .from('user_keys').select('*').eq('user_id', userId).maybeSingle();

  if (selectErr) throw new Error('Could not reach the server — check your connection and try again.');

  let key;
  if (data) {
    key = await deriveKey(passphrase, data.salt);
    try {
      const check = await aeDecrypt({ iv: data.verify_iv, ct: data.verify_ct }, key);
      if (check !== 'ok') throw new Error('wrong_passphrase');
    } catch {
      throw new Error('wrong_passphrase');
    }
  } else {
    const saltBytes = crypto.getRandomValues(new Uint8Array(16));
    const salt = b64Enc(saltBytes);
    key = await deriveKey(passphrase, salt);
    const { iv, ct } = await aeEncrypt('ok', key);
    const { error: insertErr } = await SupabaseClient
      .from('user_keys').insert({ user_id: userId, salt, verify_iv: iv, verify_ct: ct });
    if (insertErr) throw new Error('Could not save your encryption key — check your connection and try again.');
  }

  _cryptoKey = key;
  await cacheKey(key);
}

/* ── Public encrypt/decrypt ── */
async function encrypt(data) {
  if (!_cryptoKey) return data;
  const { iv, ct } = await aeEncrypt(JSON.stringify(data), _cryptoKey);
  return { _enc: true, iv, ct };
}

async function decrypt(data) {
  if (!data?._enc || !_cryptoKey) return data;
  try {
    return JSON.parse(await aeDecrypt({ iv: data.iv, ct: data.ct }, _cryptoKey));
  } catch {
    console.warn('JournalCrypto: decrypt failed, returning raw');
    return data;
  }
}

function getCryptoKey()  { return _cryptoKey; }
function clearCryptoKey() { _cryptoKey = null; sessionStorage.removeItem(SESSION_KEY); }

window.JournalCrypto = { initCrypto, restoreKeyFromSession, hasUserKey, getCryptoKey, clearCryptoKey, encrypt, decrypt };
