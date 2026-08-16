/* Eatsy — app shell: state, cart store, router, nav, drawer */
'use strict';

const App = {
  cart: { restaurantId: null, restaurantName: null, lines: [] },   /* {itemId, qty} */
  cache: {},                                                        /* menu item cache by id */
  restCache: null,

  /* ---------------- cart store ---------------- */
  loadCart() {
    try { this.cart = JSON.parse(localStorage.getItem('eatsy_cart') || 'null') || this.cart; } catch { /* noop */ }
  },
  saveCart() {
    try { localStorage.setItem('eatsy_cart', JSON.stringify(this.cart)); } catch { /* noop */ }
    this.renderCart();
    this.hydrateCart();
  },
  cartCount() { return this.cart.lines.reduce((s, l) => s + l.qty, 0); },
  async addItem(restaurantId, restaurantName, item, qty = 1) {
    if (this.cart.restaurantId && this.cart.restaurantId !== restaurantId) {
      const replace = confirm(`Your cart has items from ${this.cart.restaurantName}. Start a new cart from ${restaurantName}?`);
      if (!replace) return;
      this.cart = { restaurantId, restaurantName, lines: [] };
    }
    this.cart.restaurantId = restaurantId;
    this.cart.restaurantName = restaurantName;
    const line = this.cart.lines.find(l => l.itemId === item.id);
    if (line) line.qty = Math.min(20, line.qty + qty);
    else this.cart.lines.push({ itemId: item.id, qty });
    this.saveCart();
    toast(`Added ${item.name} to cart`, 'success');
  },
  setQty(itemId, qty) {
    const line = this.cart.lines.find(l => l.itemId === itemId);
    if (!line) return;
    if (qty <= 0) this.cart.lines = this.cart.lines.filter(l => l.itemId !== itemId);
    else line.qty = Math.min(20, qty);
    if (!this.cart.lines.length) this.cart = { restaurantId: null, restaurantName: null, lines: [] };
    this.saveCart();
  },
  async itemInfo(itemId) {
    if (this.cache[itemId]) return this.cache[itemId];
    const rid = this.cart.restaurantId;
    if (rid) {
      try {
        const d = await API.get('/api/restaurants/' + rid);
        d.menu.forEach(it => { this.cache[it.id] = { ...it, restaurantId: rid, restaurantName: d.name }; });
      } catch { /* noop */ }
    }
    return this.cache[itemId] || null;
  },
  async hydrateCart() {
    const missing = this.cart.lines.some(l => !this.cache[l.itemId]);
    if (!missing) return;
    await Promise.all(this.cart.lines.map(l => this.itemInfo(l.itemId)));
    this.renderCart();
  },
  totals() {
    const items = this.cart.lines.map(l => this.cache[l.itemId]).filter(Boolean);
    const subtotal = items.reduce((s, it) => s + (it.price || 0) * (this.cart.lines.find(l => l.itemId === it.id)?.qty || 0), 0);
    let deliveryFee = 0;
    if (this.restCache) {
      const r = this.restCache.find(r => r.id === this.cart.restaurantId);
      if (r) deliveryFee = r.deliveryFee || 0;
    }
    const tax = Math.round(subtotal * 0.05);
    return { items, subtotal, deliveryFee, tax, total: subtotal + deliveryFee + tax };
  },

  /* ---------------- cart drawer UI ---------------- */
  renderCart() {
    const count = this.cartCount();
    const badge = document.getElementById('cartBadge');
    badge.hidden = count === 0;
    badge.textContent = count;

    const body = document.getElementById('cartBody');
    const foot = document.getElementById('cartFoot');
    if (!this.cart.lines.length) {
      body.innerHTML = `
        <div class="cart-empty">
          <div class="big">🛒</div>
          <h3>Your cart is hungry</h3>
          <p>Add some deliciousness from a restaurant to get started.</p>
        </div>`;
      foot.hidden = true;
      return;
    }
    const t = this.totals();
    body.innerHTML = `
      <p style="font-size:.82rem;color:var(--faint);font-weight:700;margin-bottom:6px">From ${esc(this.cart.restaurantName)}</p>
      ${this.cart.lines.map(line => {
        const it = this.cache[line.itemId];
        return `
        <div class="cart-line">
          <span class="ci">${it ? it.icon : '🍽️'}</span>
          <div class="cn"><b>${it ? esc(it.name) : 'Loading…'}</b><span>${it ? vegMark(it.veg) + ' ' + INR(it.price) : ''}</span></div>
          <div class="qty-ctrl small" data-item="${line.itemId}">
            <button data-q="-1" aria-label="Decrease quantity">−</button>
            <span class="q">${line.qty}</span>
            <button data-q="1" aria-label="Increase quantity">+</button>
          </div>
          <span class="cp">${it ? INR(it.price * line.qty) : ''}</span>
        </div>`;
      }).join('')}
      <p class="cart-note">A single restaurant per cart — keep it focused.</p>`;
    foot.hidden = false;
    document.getElementById('cartSubtotal').textContent = INR(t.subtotal);
    document.getElementById('cartDelivery').textContent = t.deliveryFee ? INR(t.deliveryFee) : 'Free';
    document.getElementById('cartTax').textContent = INR(t.tax);
    document.getElementById('cartTotal').textContent = INR(t.total);
  },

  /* ---------------- drawer open/close ---------------- */
  openCart() {
    const d = document.getElementById('cartDrawer');
    d.classList.add('open');
    d.setAttribute('aria-hidden', 'false');
    const s = document.getElementById('cartScrim');
    s.hidden = false;
    requestAnimationFrame(() => s.classList.add('show'));
    document.body.style.overflow = 'hidden';
  },
  closeCart() {
    const d = document.getElementById('cartDrawer');
    d.classList.remove('open');
    d.setAttribute('aria-hidden', 'true');
    const s = document.getElementById('cartScrim');
    s.classList.remove('show');
    setTimeout(() => { s.hidden = true; }, 350);
    document.body.style.overflow = '';
  }
};

/* ---------------- router ---------------- */
const Router = {
  parse() {
    const h = location.hash.replace(/^#/, '') || '/';
    const [path, query] = h.split('?');
    const segs = path.split('/').filter(Boolean);
    const params = {};
    (query || '').split('&').filter(Boolean).forEach(kv => {
      const [k, v] = kv.split('=');
      params[decodeURIComponent(k)] = decodeURIComponent(v || '');
    });
    return { path: '/' + segs.join('/'), segs, params };
  },
  routes: [
    { match: (s) => s.path === '/' || s.path === '', view: 'home' },
    { match: (s) => s.segs[0] === 'restaurant', view: 'restaurant' },
    { match: (s) => s.segs[0] === 'cart', view: 'cart' },
    { match: (s) => s.segs[0] === 'checkout', view: 'checkout' },
    { match: (s) => s.segs[0] === 'orders' && !s.segs[1], view: 'orders' },
    { match: (s) => s.segs[0] === 'order', view: 'order' },
    { match: (s) => s.segs[0] === 'login', view: 'login' },
    { match: (s) => s.segs[0] === 'register', view: 'register' },
    { match: (s) => s.segs[0] === 'admin', view: 'admin' }
  ],
  async go() {
    const s = this.parse();
    const route = this.routes.find(r => r.match(s)) || { view: 'notfound' };
    const main = document.getElementById('view');
    App.closeCart();
    main.scrollTo?.(0, 0);
    window.scrollTo(0, 0);
    const renderer = Views[route.view] || Views.notfound;
    try {
      main.innerHTML = `<div class="loading"><div class="ring"></div><div>Loading…</div></div>`;
      await renderer(main, s);
    } catch (e) {
      main.innerHTML = `<div class="error-state"><div class="e-ico">🍽️</div>
        <h2>Something went wrong</h2><p>${esc(e.message)}</p></div>`;
      console.error(e);
    }
    observeReveals(main);
    this.markNav();
  },
  markNav() {
    const s = this.parse();
    document.querySelectorAll('[data-nav]').forEach(a => {
      const href = a.getAttribute('href');
      a.classList.toggle('active', href === '#' + s.path);
    });
    document.getElementById('adminNav').hidden = !Session.isAdmin();
  }
};

/* ---------------- nav user area ---------------- */
function renderUserArea() {
  const el = document.getElementById('userArea');
  if (!Session.user) {
    el.innerHTML = `
      <a class="btn btn-ghost btn-sm" href="#/login">Sign in</a>
      <a class="btn btn-brand btn-sm" href="#/register">Get started</a>`;
    return;
  }
  const initials = Session.user.name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  el.innerHTML = `
    <div style="position:relative">
      <button class="user-chip" id="userChip" aria-haspopup="true" aria-expanded="false">
        <span class="avatar">${esc(initials)}</span>
        <span class="uname">${esc(Session.user.name.split(' ')[0])}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" style="color:var(--faint)"><path d="m6 9 6 6 6-6"/></svg>
      </button>
      <div class="dropdown" id="userDrop">
        <a href="#/orders">📦 My orders</a>
        ${Session.isAdmin() ? '<a href="#/admin">🛠️ Admin dashboard</a>' : ''}
        <hr>
        <button id="logoutBtn">🚪 Sign out</button>
      </div>
    </div>`;
  const chip = el.querySelector('#userChip');
  const drop = el.querySelector('#userDrop');
  chip.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = drop.classList.toggle('open');
    chip.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', (e) => {
    if (!el.contains(e.target)) { drop.classList.remove('open'); chip.setAttribute('aria-expanded', 'false'); }
  });
  el.querySelector('#logoutBtn').addEventListener('click', async () => {
    await API.post('/api/auth/logout');
    Session.set(null);
    renderUserArea();
    Router.markNav();
    toast('Signed out. See you soon!', 'info');
  });
}

/* ---------------- boot ---------------- */
document.addEventListener('DOMContentLoaded', async () => {
  App.loadCart();
  App.hydrateCart();

  /* nav wiring */
  document.getElementById('cartBtn').addEventListener('click', () => App.openCart());
  document.getElementById('cartClose').addEventListener('click', () => App.closeCart());
  document.getElementById('cartScrim').addEventListener('click', () => App.closeCart());
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') App.closeCart();
  });

  /* cart drawer interactions (delegated) */
  document.getElementById('cartBody').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-q]');
    if (!btn) return;
    const line = btn.closest('[data-item]');
    const itemId = Number(line.dataset.item);
    const cur = App.cart.lines.find(l => l.itemId === itemId);
    if (!cur) return;
    App.setQty(itemId, cur.qty + Number(btn.dataset.q));
    if (!App.cart.lines.length) App.closeCart();
  });

  await Session.init();
  renderUserArea();
  Router.markNav();

  window.addEventListener('hashchange', () => Router.go());
  await Router.go();
});
