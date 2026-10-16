import { store } from './store.js';

/* =====================================================================
   MediBridge backend (Express + MongoDB) - one place for every API call.
   Set VITE_API_URL in .env (default http://localhost:5000/api).
   The login token is kept in localStorage under "mb_token".
   ===================================================================== */
export const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');
const TOKEN_KEY = 'mb_token';

export const getToken = () => store.get(TOKEN_KEY, null);

export class ApiError extends Error {
  /* status 0 = server not reachable; errors = { field: message } for 400 validation errors */
  constructor(status, message, errors) { super(message); this.status = status; this.errors = errors || null; }
}

export function saveAuth({ token, user }) {
  store.set(TOKEN_KEY, token);
  store.set('mb_session', { id: user.id, role: user.role, name: user.name, email: user.email, phone: user.phone, spec: user.spec || '' });
}
export function clearAuth() { store.del(TOKEN_KEY); store.del('mb_session'); }

async function send(method, path, { body, form, signal } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = 'Bearer ' + token;
  let payload;
  if (form) payload = form;                                   // multipart (browser sets the boundary)
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }

  let res;
  try { res = await fetch(API_BASE + path, { method, headers, body: payload, signal }); }
  catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new ApiError(0, 'Cannot reach the MediBridge server. Please check that the backend is running (' + API_BASE + ').');
  }
  if (!res.ok) {
    let data = null;
    try { data = await res.json(); } catch (e) { /* not json */ }
    if (res.status === 401 && token && !path.startsWith('/auth/login')) clearAuth();   // expired / invalid token -> logged out
    throw new ApiError(res.status, (data && data.message) || 'Request failed (' + res.status + ').', data && data.errors);
  }
  return res;
}

const json = async (p) => (await p).json();
export const api = {
  get: (path, o) => json(send('GET', path, o)),
  post: (path, o) => json(send('POST', path, o)),
  patch: (path, o) => json(send('PATCH', path, o)),
  del: (path, o) => json(send('DELETE', path, o)),
  /* files (documents) need the token, so they are fetched as a blob */
  blob: async (path) => (await send('GET', path)).blob(),
};

/* the backend returns { patient: {...}, pickupAddress, createdAt, caseId ... }; pages use this flatter shape */
export function normCase(c) {
  if (!c) return null;
  return { ...c, id: c.caseId, name: c.patient.name, age: c.patient.age, sex: c.patient.sex, phone: c.patient.phone, address: c.pickupAddress, created: c.createdAt };
}
