// On-device credential encryption (CLAUDE.md §3).
//
// A NON-EXPORTABLE AES-GCM key lives in IndexedDB; the encrypted credential
// blob lives in localStorage. The key can never leave the device (extractable
// = false), and clearing browser data wipes both — a hard kill switch. We store
// credentials only so the session survives a reload; they are re-sent to the
// backend per request and never persisted server-side.

import type { Credentials } from "@/types";

const DB_NAME = "skipp";
const STORE = "keys";
const KEY_ID = "cred-key";
const BLOB_KEY = "skipp.cred";

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
    false, // non-extractable — cannot be read back out
    ["encrypt", "decrypt"],
  );
  await idbPut(KEY_ID, key);
  return key;
}

const b64 = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s: string) =>
  Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** Encrypt + persist credentials for reload-survival. Best-effort. */
export async function saveCredentials(creds: Credentials): Promise<void> {
  try {
    const key = await getOrCreateKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = new TextEncoder().encode(JSON.stringify(creds));
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
    localStorage.setItem(
      BLOB_KEY,
      `${b64(iv.buffer)}.${b64(ct)}`,
    );
  } catch {
    // Crypto/IDB unavailable — degrade to in-memory-only (re-login on reload).
  }
}

/** Decrypt the stored credentials, or null if none / tampered. */
export async function loadCredentials(): Promise<Credentials | null> {
  try {
    const blob = localStorage.getItem(BLOB_KEY);
    if (!blob) return null;
    const [ivB64, ctB64] = blob.split(".");
    const key = await getOrCreateKey();
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: unb64(ivB64) },
      key,
      unb64(ctB64),
    );
    return JSON.parse(new TextDecoder().decode(pt)) as Credentials;
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
