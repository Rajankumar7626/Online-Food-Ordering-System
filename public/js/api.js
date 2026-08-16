/* Eatsy — API client + auth session state */
'use strict';

const API = {
  async req(method, url, body) {
    let res;
    try {
      res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        credentials: 'same-origin'
      });
    } catch {
      throw new Error('Network error — is the server running?');
    }
    let j = null;
    try { j = await res.json(); } catch { /* non-JSON */ }
    if (!res.ok || (j && j.ok === false)) throw new Error((j && j.error) || 'Something went wrong.');
    return j ? j.data : null;
  },
  get: (u) => API.req('GET', u),
  post: (u, b) => API.req('POST', u, b),
  patch: (u, b) => API.req('PATCH', u, b),
  put: (u, b) => API.req('PUT', u, b),
  del: (u) => API.req('DELETE', u)
};

const Session = {
  user: null,
  async init() {
    try {
      const d = await API.get('/api/auth/me');
      this.user = d.user;
    } catch { this.user = null; }
    return this.user;
  },
  set(u) { this.user = u; },
  isAdmin() { return !!this.user && this.user.role === 'admin'; }
};
