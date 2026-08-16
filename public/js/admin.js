/* Eatsy — admin dashboard: overview, orders, restaurants, menu management */
'use strict';

const $A = (s, c) => (c || document).querySelector(s);
const $$A = (s, c) => Array.from((c || document).querySelectorAll(s));

const Admin = {
  current: 'overview',
  restFilter: 'all',

  async run(main) {
    if (!Session.isAdmin()) {
      main.innerHTML = `<div class="error-state" style="min-height:60vh;display:grid;place-items:center;align-content:center">
        <div class="e-ico">🔐</div><h2>Admin only</h2><p>This dashboard is for restaurant management staff.</p>
        <a class="btn btn-brand" style="margin-top:14px" href="#/login?next=admin">Sign in as admin</a></div>`;
      return;
    }
    this.main = main;
    this.shell();
    await this.open('overview');
  },

  shell() {
    this.main.innerHTML = `
      <div class="admin-shell">
        <aside class="admin-side">
          <div class="a-brand">eatsy<em> admin</em></div>
          <button data-tab="overview" class="active">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 13h6V4H4zm10 7h6v-9h-6zM4 20h6v-3H4zm10-13h6V4h-6z"/></svg>
            Overview</button>
          <button data-tab="orders">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            Orders</button>
          <button data-tab="restaurants">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 11h18M5 11V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4M5 11v8h14v-8"/><circle cx="12" cy="15" r="2"/></svg>
            Restaurants</button>
          <button data-tab="menu">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/></svg>
            Menu items</button>
          <div class="side-foot">Eatsy Admin v1.0<br>SQLite · Express · vanilla JS</div>
        </aside>
        <div class="admin-main" id="adminMain"></div>
      </div>`;
    this.main.querySelectorAll('[data-tab]').forEach(b =>
      b.addEventListener('click', () => this.open(b.dataset.tab)));
  },

  async open(tab) {
    this.current = tab;
    this.main.querySelectorAll('[data-tab]').forEach(b =>
      b.classList.toggle('active', b.dataset.tab === tab));
    const box = document.getElementById('adminMain');
    box.innerHTML = `<div class="loading"><div class="ring"></div><div>Loading…</div></div>`;
    try {
      if (tab === 'overview') await this.overview(box);
      if (tab === 'orders') await this.orders(box);
      if (tab === 'restaurants') await this.restaurants(box);
      if (tab === 'menu') await this.menu(box);
      observeReveals(box);
    } catch (e) {
      box.innerHTML = `<div class="error-state"><h2>Failed to load</h2><p>${esc(e.message)}</p></div>`;
    }
  },

  /* ---------------- overview ---------------- */
  async overview(box) {
    const s = await API.get('/api/admin/stats');
    const max = Math.max(...s.revenue7d.map(r => r.revenue), 1);
    box.innerHTML = `
      <h1>Good day, ${esc(Session.user.name.split(' ')[0])} 👋</h1>
      <p class="crumb">Here's how the kitchen performed today.</p>
      <div class="stat-grid">
        ${[
          ['₹', INR(s.todayRevenue), 'Today’s revenue', 'var(--brand-soft)', 'var(--brand)'],
          ['🧾', s.todayOrders, 'Orders today', '#E6F7EE', 'var(--ok)'],
          ['🛵', s.openOrders, 'Orders in motion', '#E8F1FF', '#3B82F6'],
          ['👥', s.totalUsers, 'Registered customers', '#F3EDFF', '#8B5CF6']
        ].map(([i, v, l, bg, c]) => `
          <div class="stat-card reveal">
            <div class="s-icon" style="background:${bg};color:${c}">${i}</div>
            <div class="s-val">${v}</div>
            <div class="s-lab">${l}</div>
          </div>`).join('')}
      </div>
      <div class="admin-panel reveal">
        <h3>Revenue — last 7 days</h3>
        <div class="chart-wrap">
          ${s.revenue7d.map(d => `
            <div class="chart-col" title="${esc(d.date)}">
              <div class="chart-bar" style="height:${Math.max(3, Math.round(d.revenue / max * 100))}%">
                <span class="tip">${INR(d.revenue)}</span>
              </div>
              <span>${d.date.slice(5)}</span>
            </div>`).join('')}
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px" class="panels2">
        <div class="admin-panel reveal">
          <h3>Top sellers</h3>
          <ol class="top-items">
            ${s.topItems.map((t, i) => `
              <li><span class="rank">${i + 1}</span><span class="t-name">${esc(t.name)}</span>
              <span class="t-qty">${t.qty} sold</span><span class="t-rev">${INR(t.revenue)}</span></li>`).join('')}
          </ol>
        </div>
        <div class="admin-panel reveal">
          <h3>At a glance</h3>
          <div class="info-row"><span>All-time orders</span><b>${s.totalOrders}</b></div>
          <div class="info-row"><span>All-time revenue</span><b>${INR(s.totalRevenue)}</b></div>
          <div class="info-row"><span>Average order value</span><b>${INR(s.avgOrderValue)}</b></div>
          <div class="info-row"><span>Open orders right now</span><b>${s.openOrders}</b></div>
          <p style="font-size:.82rem;color:var(--faint);margin-top:14px">Orders in this demo auto-advance through statuses every ~20s — watch them move live in the Orders tab.</p>
        </div>
      </div>`;
  },

  /* ---------------- orders ---------------- */
  async orders(box) {
    const list = await API.get('/api/admin/orders?status=all');
    const counts = {};
    list.forEach(o => counts[o.status] = (counts[o.status] || 0) + 1);
    box.innerHTML = `
      <h1>Orders</h1>
      <p class="crumb">${list.length} orders · live status control</p>
      <div class="stat-grid" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr))">
        ${['placed', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'].map(st => `
          <div class="stat-card" style="padding:16px">
            <div class="s-val" style="font-size:1.5rem">${counts[st] || 0}</div>
            <div class="s-lab">${st.replace(/_/g, ' ')}</div>
          </div>`).join('')}
      </div>
      <div class="admin-panel">
        <div class="table-wrap">
          <table class="tbl">
            <thead><tr>
              <th>Order</th><th>Customer</th><th>Restaurant</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th>
            </tr></thead>
            <tbody>
              ${list.map(o => `
                <tr>
                  <td><span class="row-main">${esc(o.orderNo)}</span>
                    <div class="row-sub">${esc(new Date(o.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))}</div></td>
                  <td>${esc(o.userName)}<div class="row-sub">${esc(o.phone)}</div></td>
                  <td>${esc(o.restaurantName)}</td>
                  <td>${o.items.map(l => `${l.qty}× ${esc(l.name)}`).join('<br>')}</td>
                  <td><b>${INR(o.total)}</b></td>
                  <td><span class="tag open" style="background:var(--bg-soft);color:var(--mut)">${o.paymentMethod.toUpperCase()}</span><div class="row-sub">${esc(o.paymentRef)}</div></td>
                  <td>
                    <select class="status-select" data-oid="${o.id}" ${['delivered', 'cancelled'].includes(o.status) ? 'disabled' : ''} aria-label="Change status">
                      ${['placed', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'].map(st =>
                        `<option value="${st}" ${st === o.status ? 'selected' : ''}>${st.replace(/_/g, ' ')}</option>`).join('')}
                    </select>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
    box.querySelectorAll('.status-select').forEach(sel => sel.addEventListener('change', async () => {
      try {
        await API.patch(`/api/admin/orders/${sel.dataset.oid}/status`, { status: sel.value });
        toast('Order status updated.', 'success');
      } catch (e) { toast(e.message, 'error'); sel.value = ''; this.open('orders'); }
    }));
  },

  /* ---------------- restaurants ---------------- */
  async restaurants(box) {
    const list = await API.get('/api/restaurants');
    box.innerHTML = `
      <h1>Restaurants</h1>
      <p class="crumb">${list.length} partners on the platform</p>
      <div class="admin-panel">
        <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
          <button class="btn btn-brand" id="addRest">+ Add restaurant</button>
        </div>
        <div id="restList">
          ${list.map(r => `
            <div class="admin-rest-card reveal" data-id="${r.id}">
              <img src="${esc(r.image)}" alt="">
              <div>
                <div class="ar-name">${esc(r.name)}</div>
                <div class="ar-sub">${esc(r.cuisine)} · ⭐ ${r.rating.toFixed(1)} · ${r.deliveryTime} min · ${INR(r.deliveryFee)} delivery</div>
                <div style="margin-top:6px"><span class="tag ${r.isOpen ? 'open' : 'closed'}">${r.isOpen ? '● Open' : '● Closed'}</span></div>
              </div>
              <div class="ar-actions">
                <button class="mini-icon-btn" data-edit="${r.id}" aria-label="Edit ${esc(r.name)}" title="Edit">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                </button>
                <button class="mini-icon-btn danger" data-del="${r.id}" aria-label="Delete ${esc(r.name)}" title="Delete">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                </button>
              </div>
            </div>`).join('')}
        </div>
      </div>`;

    const IMAGES = ['/img/rest-spice.jpg', '/img/rest-dosa.jpg', '/img/rest-wok.jpg', '/img/rest-burger.jpg', '/img/rest-pizza.jpg', '/img/rest-dessert.jpg'];
    function form(r) {
      return `
        <div class="field"><label>Name</label><input id="rName" value="${esc(r?.name || '')}" placeholder="e.g. Spice Route"></div>
        <div class="field-row">
          <div class="field"><label>Cuisine</label><input id="rCuisine" value="${esc(r?.cuisine || '')}" placeholder="e.g. North Indian"></div>
          <div class="field"><label>Rating</label><input id="rRating" type="number" step="0.1" min="0" max="5" value="${r?.rating ?? 4.5}"></div>
        </div>
        <div class="field"><label>Description</label><textarea id="rDesc">${esc(r?.description || '')}</textarea></div>
        <div class="field-row">
          <div class="field"><label>Delivery time (min)</label><input id="rTime" type="number" value="${r?.deliveryTime ?? 30}"></div>
          <div class="field"><label>Delivery fee (₹)</label><input id="rFee" type="number" value="${r?.deliveryFee ?? 0}"></div>
          <div class="field"><label>Min order (₹)</label><input id="rMin" type="number" value="${r?.minOrder ?? 0}"></div>
        </div>
        <div class="field"><label>Cover image</label>
          <div style="display:flex;gap:8px;flex-wrap:wrap">${IMAGES.map((img, i) => `
            <button type="button" class="img-pick ${r?.image === img || (!r && i === 0) ? 'picked' : ''}" data-img="${img}" aria-label="Pick image ${i + 1}"
              style="width:64px;height:48px;border-radius:10px;overflow:hidden;border:2px solid ${r?.image === img || (!r && i === 0) ? 'var(--brand)' : 'var(--line)'};padding:0;cursor:pointer">
              <img src="${img}" style="width:100%;height:100%;object-fit:cover"></button>`).join('')}
          </div>
          <input type="hidden" id="rImage" value="${esc(r?.image || IMAGES[0])}">
        </div>
        <label style="display:flex;align-items:center;gap:10px;font-weight:700;font-size:.9rem">
          <span class="toggle"><input type="checkbox" id="rOpen" ${r?.isOpen !== false ? 'checked' : ''}><span class="tr"></span></span>
          Accepting orders now
        </label>`;
    }
    const save = async (id, get) => {
      const payload = {
        name: get('#rName'), cuisine: get('#rCuisine'), description: get('#rDesc'),
        deliveryTime: get('#rTime'), deliveryFee: get('#rFee'), minOrder: get('#rMin'),
        rating: get('#rRating'), image: get('#rImage'), isOpen: get('#rOpen').checked
      };
      if (id) await API.put('/api/admin/restaurants/' + id, payload);
      else await API.post('/api/admin/restaurants', payload);
      toast('Restaurant saved.', 'success');
      this.open('restaurants');
    };
    $A('#addRest').addEventListener('click', () => {
      const m = openModal({ title: 'Add restaurant', body: form(null) });
      m.root.querySelectorAll('.img-pick').forEach(p => p.addEventListener('click', () => {
        m.root.querySelectorAll('.img-pick').forEach(x => { x.style.borderColor = 'var(--line)'; x.classList.remove('picked'); });
        p.style.borderColor = 'var(--brand)'; p.classList.add('picked');
        m.root.querySelector('#rImage').value = p.dataset.img;
      }));
      m.onOk(async () => { try { await save(null, (sel) => m.root.querySelector(sel)); } catch (e) { toast(e.message, 'error'); } });
    });
    box.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', async () => {
      const r = list.find(x => x.id === Number(b.dataset.edit));
      const m = openModal({ title: 'Edit restaurant', body: form(r) });
      m.root.querySelectorAll('.img-pick').forEach(p => p.addEventListener('click', () => {
        m.root.querySelectorAll('.img-pick').forEach(x => { x.style.borderColor = 'var(--line)'; x.classList.remove('picked'); });
        p.style.borderColor = 'var(--brand)'; p.classList.add('picked');
        m.root.querySelector('#rImage').value = p.dataset.img;
      }));
      m.onOk(async () => { try { await save(r.id, (sel) => m.root.querySelector(sel)); } catch (e) { toast(e.message, 'error'); } });
    }));
    box.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
      const r = list.find(x => x.id === Number(b.dataset.del));
      const m = openModal({
        title: 'Delete restaurant?',
        sub: `${r.name} and its menu items will be removed. Past orders keep their snapshots.`,
        actions: `<button class="btn btn-danger-ghost" data-m="ok">Delete</button>`
      });
      m.onOk(async () => {
        try { await API.del('/api/admin/restaurants/' + r.id); toast('Restaurant deleted.', 'info'); this.open('restaurants'); }
        catch (e) { toast(e.message, 'error'); }
      });
    }));
  },

  /* ---------------- menu management ---------------- */
  async menu(box) {
    const rests = await API.get('/api/restaurants');
    App.restCache = rests;
    const selId = Number(this.restFilter) || rests[0]?.id;
    const r = await API.get('/api/restaurants/' + selId);

    box.innerHTML = `
      <h1>Menu items</h1>
      <p class="crumb">Manage dishes for each restaurant</p>
      <div class="admin-panel">
        <div style="display:flex;gap:10px;align-items:center;margin-bottom:18px;flex-wrap:wrap">
          <select id="restSel" class="status-select" style="padding:10px 14px;min-width:200px">
            ${rests.map(x => `<option value="${x.id}" ${x.id === selId ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}
          </select>
          <span class="tag open">${r.menu.length} items</span>
          <button class="btn btn-brand" style="margin-left:auto" id="addItem">+ Add item</button>
        </div>
        <div class="table-wrap">
          <table class="tbl">
            <thead><tr><th>Item</th><th>Category</th><th>Price</th><th>Veg</th><th>Available</th><th></th></tr></thead>
            <tbody>
              ${r.menu.map(m => `
                <tr data-iid="${m.id}">
                  <td><span style="font-size:1.2rem;margin-right:8px">${m.icon}</span><span class="row-main">${esc(m.name)}</span>
                    <div class="row-sub">${esc(m.description)}</div></td>
                  <td><span class="tag" style="background:var(--bg-soft);color:var(--mut)">${esc(m.category)}</span></td>
                  <td><b>${INR(m.price)}</b></td>
                  <td>${vegMark(m.veg)}</td>
                  <td><label class="toggle"><input type="checkbox" data-avail="${m.id}" ${m.available ? 'checked' : ''}><span class="tr"></span></label></td>
                  <td style="white-space:nowrap">
                    <button class="mini-icon-btn" data-eitem="${m.id}" aria-label="Edit ${esc(m.name)}">
                      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                    </button>
                    <button class="mini-icon-btn danger" data-ditem="${m.id}" aria-label="Delete ${esc(m.name)}">
                      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                    </button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;

    $A('#restSel').addEventListener('change', (e) => { this.restFilter = e.target.value; this.open('menu'); });

    box.querySelectorAll('[data-avail]').forEach(t => t.addEventListener('change', async () => {
      const id = t.dataset.avail;
      const item = r.menu.find(m => m.id === Number(id));
      try {
        await API.put('/api/admin/items/' + id, { ...item, available: t.checked });
        toast(`${item.name} ${t.checked ? 'available' : 'hidden'}`, 'success');
      } catch (e) { toast(e.message, 'error'); t.checked = !t.checked; }
    }));

    const form = (m) => `
      <div class="field-row">
        <div class="field"><label>Name</label><input id="iName" value="${esc(m?.name || '')}" placeholder="e.g. Butter Chicken"></div>
        <div class="field"><label>Price (₹)</label><input id="iPrice" type="number" value="${m?.price ?? ''}" placeholder="299"></div>
      </div>
      <div class="field"><label>Description</label><input id="iDesc" value="${esc(m?.description || '')}" placeholder="Short, appetizing…"></div>
      <div class="field-row">
        <div class="field"><label>Category</label><input id="iCat" value="${esc(m?.category || 'Mains')}" placeholder="Mains"></div>
        <div class="field"><label>Emoji icon</label><input id="iIcon" value="${esc(m?.icon || '🍽️')}" maxlength="4"></div>
      </div>
      <label style="display:flex;align-items:center;gap:10px;font-weight:700;font-size:.9rem;margin-bottom:10px">
        <span class="toggle"><input type="checkbox" id="iVeg" ${m?.veg ? 'checked' : ''}><span class="tr"></span></span>
        Vegetarian
      </label>
      <label style="display:flex;align-items:center;gap:10px;font-weight:700;font-size:.9rem">
        <span class="toggle"><input type="checkbox" id="iAvail" ${m?.available !== false ? 'checked' : ''}><span class="tr"></span></span>
        Available to order
      </label>`;

    const saveItem = async (id, get) => {
      const payload = {
        name: get('#iName'), price: get('#iPrice'), description: get('#iDesc'),
        category: get('#iCat'), icon: get('#iIcon'), veg: get('#iVeg').checked, available: get('#iAvail').checked
      };
      if (id) await API.put('/api/admin/items/' + id, payload);
      else await API.post(`/api/admin/restaurants/${selId}/items`, payload);
      toast('Item saved.', 'success');
      this.open('menu');
    };
    $A('#addItem').addEventListener('click', () => {
      const m = openModal({ title: 'Add menu item', body: form(null) });
      m.onOk(async () => { try { await saveItem(null, (s) => m.root.querySelector(s)); } catch (e) { toast(e.message, 'error'); } });
    });
    box.querySelectorAll('[data-eitem]').forEach(b => b.addEventListener('click', () => {
      const item = r.menu.find(m => m.id === Number(b.dataset.eitem));
      const m = openModal({ title: 'Edit item', body: form(item) });
      m.onOk(async () => { try { await saveItem(item.id, (s) => m.root.querySelector(s)); } catch (e) { toast(e.message, 'error'); } });
    }));
    box.querySelectorAll('[data-ditem]').forEach(b => b.addEventListener('click', () => {
      const item = r.menu.find(m => m.id === Number(b.dataset.ditem));
      const m = openModal({ title: 'Delete item?', sub: `${item.name} will be removed from the menu.`, actions: `<button class="btn btn-danger-ghost" data-m="ok">Delete</button>` });
      m.onOk(async () => {
        try { await API.del('/api/admin/items/' + item.id); toast('Item deleted.', 'info'); this.open('menu'); }
        catch (e) { toast(e.message, 'error'); }
      });
    }));
  }
};
