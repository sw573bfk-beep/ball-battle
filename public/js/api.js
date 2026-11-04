// API client + logged-in user state.
const TOKEN_KEY = 'qc-token';
const listeners = new Set();

export const state = { user: null, ready: false };

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
function setToken(t) {
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch {}
}

export function onUser(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function setUser(u) {
  state.user = u;
  listeners.forEach((fn) => fn(u));
}

export async function api(path, { method = 'GET', body } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  let res;
  try {
    res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new Error("Can't reach the server. Check your internet connection.");
  }
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    if (res.status === 401 && token && path !== '/api/login') { setToken(null); setUser(null); }
    throw new Error(data?.error || `Something went wrong (${res.status})`);
  }
  if (data?.user !== undefined && path !== '/api/logout') setUser(data.user);
  return data;
}

export async function loadMe() {
  if (!getToken()) { state.ready = true; setUser(null); return null; }
  try {
    const { user } = await api('/api/me');
    if (!user) setToken(null);
    return user;
  } catch {
    return null;
  } finally {
    state.ready = true;
  }
}

export async function signup(username, password) {
  const r = await api('/api/signup', { method: 'POST', body: { username, password } });
  setToken(r.token);
  setUser(r.user);
}
export async function login(username, password) {
  const r = await api('/api/login', { method: 'POST', body: { username, password } });
  setToken(r.token);
  setUser(r.user);
}
export async function logout() {
  try { await api('/api/logout', { method: 'POST' }); } catch {}
  setToken(null);
  setUser(null);
}

export function wsUrl(params) {
  const u = new URL('/ws', location.href);
  u.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const token = getToken();
  for (const [k, v] of Object.entries({ ...params, ...(token ? { token } : {}) })) if (v != null) u.searchParams.set(k, v);
  return u.toString();
}
