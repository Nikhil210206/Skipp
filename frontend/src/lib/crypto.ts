// On-device credential encryption (CLAUDE.md §3).
//
// A NON-EXPORTABLE AES-GCM key lives in IndexedDB; the encrypted credential
// blob lives in localStorage. The key can never leave the device (extractable
// = false), and clearing browser data wipes both, a hard kill switch. We store
// credentials only so the session survives a reload; they are re-sent to the
// backend per request and never persisted server-side.

import type { Credentials, Snapshot } from "@/types";

const DB_NAME = "skipp";
const STORE = "keys";
const KEY_ID = "cred-key";
const BLOB_KEY = "skipp.cred";
const SNAP_KEY = "skipp.snap";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet<T>(key: string): Promise<T | undefined> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const r = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
        r.onsuccess = () => resolve(r.result as T | undefined);
        r.onerror = () => reject(r.error);
      }),
  );
}

function idbPut(key: string, value: unknown): Promise<void> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const r = db
          .transaction(STORE, "readwrite")
          .objectStore(STORE)
          .put(value, key);
        r.onsuccess = () => resolve();
        r.onerror = () => reject(r.error);
      }),
  );
}

async function getOrCreateKey(): Promise<CryptoKey> {
  const existing = await idbGet<CryptoKey>(KEY_ID);
  if (existing) return existing;
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false, // non-extractable, cannot be read back out
    ["encrypt", "decrypt"],
  );
  await idbPut(KEY_ID, key);
  return key;
}

/**
 * Base64 in chunks. `String.fromCharCode(...bytes)` passes one argument per
 * byte, and the snapshot is tens of kilobytes and grows with the student's
 * courses and published marks, so a single spread eventually exceeds the
 * engine's argument limit (lower on Safari than on Chrome) and throws.
 */
function b64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  const CHUNK = 0x8000;
  let out = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    out += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(out);
}
const unb64 = (s: string) =>
  Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** Encrypt any JSON-serializable value to an "iv.ciphertext" base64 string. */
async function encryptJSON(value: unknown): Promise<string> {
  const key = await getOrCreateKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(value));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  return `${b64(iv.buffer)}.${b64(ct)}`;
}

/** Decrypt an "iv.ciphertext" blob back to a value, or null if invalid. */
async function decryptJSON<T>(blob: string): Promise<T | null> {
  try {
    const [ivB64, ctB64] = blob.split(".");
    const key = await getOrCreateKey();
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: unb64(ivB64) },
      key,
      unb64(ctB64),
    );
    return JSON.parse(new TextDecoder().decode(pt)) as T;
  } catch {
    return null;
  }
}

/** Encrypt + persist credentials for reload-survival. Best-effort. */
export async function saveCredentials(creds: Credentials): Promise<void> {
  try {
    localStorage.setItem(BLOB_KEY, await encryptJSON(creds));
  } catch {
    // Crypto/IDB unavailable, so degrade to in-memory only (re-login on reload).
  }
}

/** Decrypt the stored credentials, or null if none / tampered. */
export async function loadCredentials(): Promise<Credentials | null> {
  try {
    const blob = localStorage.getItem(BLOB_KEY);
    if (!blob) return null;
    return await decryptJSON<Credentials>(blob);
  } catch {
    return null;
  }
}

export function clearCredentials(): void {
  try {
    localStorage.removeItem(BLOB_KEY);
  } catch {
    /* ignore */
  }
}

// ---- Cached snapshot (encrypted, for instant reloads without a login) ----

/** Persist the last snapshot, encrypted. Best-effort. */
export async function saveSnapshot(snap: Snapshot): Promise<void> {
  try {
    localStorage.setItem(SNAP_KEY, await encryptJSON(snap));
  } catch {
    /* storage full or crypto unavailable, non-fatal */
  }
}

/** Load the cached snapshot, or null if none / tampered. */
export async function loadSnapshot(): Promise<Snapshot | null> {
  const blob = localStorage.getItem(SNAP_KEY);
  if (!blob) return null;
  return decryptJSON<Snapshot>(blob);
}

export function clearSnapshot(): void {
  try {
    localStorage.removeItem(SNAP_KEY);
  } catch {
    /* ignore */
  }
}
