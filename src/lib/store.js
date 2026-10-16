import { useSyncExternalStore } from 'react';

/* Browser storage with in-memory fallback (same behaviour as the original script.js),
   plus a tiny subscription system so React components re-render when data changes
   (also across browser tabs - e.g. a doctor tab sees a patient's new upload). */
const mem = {};
const cache = {};
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

function read(k) {
  if (k in cache) return cache[k];
  let v;
  try {
    const raw = localStorage.getItem(k);
    if (raw !== null) v = JSON.parse(raw);
  } catch (e) { /* ignore */ }
  if (v === undefined && k in mem) v = mem[k];
  cache[k] = v;
  return v;
}

export const store = {
  get(k, d) { const v = read(k); return v === undefined ? d : v; },
  /* returns false when the browser refused to persist (e.g. storage full) */
  set(k, v) {
    mem[k] = v; cache[k] = v;
    let ok = true;
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { ok = false; }
    emit();
    return ok;
  },
  del(k) {
    delete mem[k]; delete cache[k];
    try { localStorage.removeItem(k); } catch (e) { /* ignore */ }
    emit();
  },
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === null) Object.keys(cache).forEach((k) => delete cache[k]);
    else delete cache[e.key];
    emit();
  });
}

/* NOTE: pass a stable default (module-level constant) for object/array defaults */
export function useStore(key, def) {
  return useSyncExternalStore(store.subscribe, () => store.get(key, def));
}

export const EMPTY = [];
