/* Eatsy — public views: home, restaurant, cart, checkout, orders, tracking, auth */
'use strict';

const Views = (() => {
  const $ = (s, c) => (c || document).querySelector(s);

  const starIcon = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2l-6.1 3.4 1.4-6.8L2.2 9.1l6.9-.8z"/></svg>`;

  /* ================= HOME ================= */
  async function home(main, s) {
    const [rests] = await Promise.all([API.get('/api/restaurants')]);
    App.restCache = rests;

    const cuisines = [...new Set(rests.map(r => r.cuisine))];
    main.innerHTML = `
      <section class="hero">
        <img class="hero-img" src="/img/hero.jpg" alt="" aria-hidden="true">
        <div class="hero-inner">
          <span class="hero-tag"><span class="dot"></span> Now delivering across the city</span>
          <h1>Good food, delivered <em>while it's hot.</em></h1>
          <p class="lead">Skip the queues. Order from hand-picked kitchens, track your rider in real time, and eat better tonight.</p>
          <div class="search-box">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
            <input id="searchInput" type="search" placeholder="Search restaurants or dishes…" aria-label="Search restaurants">
            <button class="btn btn-brand" id="searchGo">Search</button>
          </div>
          <div class="hero-chips" id="cuisineChips" role="group" aria-label="Filter by cuisine"></div>
        </div>
      </section>

      <section class="sec" id="browse">
        <div class="wrap">
          <div class="sec-head reveal">
            <div>
              <h2 class="sec-title">Browse <em>tonight's</em> options</h2>
              <p class="sec-sub">${rests.length} hand-picked kitchens, rated by people who actually ate there.</p>
            </div>
            <span class="sec-note" id="resultNote">Showing all</span>
          </div>
          <div class="rest-grid" id="restGrid"></div>
        </div>
      </section>`;

    /* cuisine chips */
    const chipWrap = $('#cuisineChips');
    const allChip = document.createElement('button');
    allChip.className = 'chip active';
    allChip.textContent = 'All cuisines';
    allChip.dataset.c = 'all';
    chipWrap.appendChild(allChip);
    cuisines.forEach(c => {
      const b = document.createElement('button');
      b.className = 'chip';
      b.textContent = c;
      b.dataset.c = c;
      chipWrap.appendChild(b);
    });

    let activeCuisine = 'all', query = '';

    function renderGrid() {
      const grid = $('#restGrid');
      const q = query.trim().toLowerCase();
      const list = rests.filter(r => {
        const okCuisine = activeCuisine === 'all' || r.cuisine === activeCuisine;
        const okQuery = !q || r.name.toLowerCase().includes(q) || r.cuisine.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q);
        return okCuisine && okQuery;
      });
      $('#resultNote').textContent = list.length === rests.length ? 'Showing all' : `${list.length} result${list.length === 1 ? '' : 's'}`;
      grid.innerHTML = list.length ? list.map((r, i) => `
        <article class="rest-card reveal" tabindex="0" role="link" data-id="${r.id}" style="transition-delay:${(i % 3) * 70}ms" aria-label="${esc(r.name)} — ${esc(r.cuisine)}">
          <div class="rest-cover">
            <img src="${esc(r.image)}" alt="${esc(r.name)}" loading="lazy">
            <span class="badge ${r.isOpen ? '' : 'closed'}">${r.isOpen ? '● Open' : 'Closed'}</span>
          </div>
          <div class="rest-body">
            <div class="rest-name-row">
              <h3 class="rest-name">${esc(r.name)}</h3>
              <span class="rating-pill">${starIcon} ${r.rating.toFixed(1)}</span>
            </div>
            <span class="rest-cuisine">${esc(r.cuisine)}</span>
            <div class="rest-meta">
              <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>${r.deliveryTime} min</span>
              <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 11h14M5 11l2-6h10l2 6M5 11v8h14v-8"/></svg>${r.deliveryFee ? INR(r.deliveryFee) : 'Free'}</span>
              <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>${INR(r.minOrder)} min</span>
              <span>${r.ratingCount.toLocaleString('en-IN')} ratings</span>
            </div>
          </div>
        </article>`).join('')
        : `<div class="empty-state" style="grid-column:1/-1"><div class="e-ico">🔍</div>
           <h3>Nothing found</h3><p>Try a different cuisine or search term.</p></div>`;
      grid.querySelectorAll('.rest-card').forEach(card => {
        card.addEventListener('click', () => location.hash = '#/restaurant/' + card.dataset.id);
        card.addEventListener('keydown', (e) => { if (e.key === 'Enter') location.hash = '#/restaurant/' + card.dataset.id; });
      });
      observeReveals(grid);
    }

    chipWrap.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      activeCuisine = chip.dataset.c;
      chipWrap.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c === chip));
      renderGrid();
    });
    const doSearch = () => { query = $('#searchInput').value; renderGrid(); };
    $('#searchGo').addEventListener('click', doSearch);
    $('#searchInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });
    renderGrid();
  }

  /* ================= RESTAURANT ================= */
  async function restaurant(main, s) {
    const id = s.segs[1];
    const [r] = await Promise.all([API.get('/api/restaurants/' + id)]);
    if (!r) throw new Error('Restaurant not found.');

    main.innerHTML = `
      <section class="rest-hero">
        <img src="${esc(r.image)}" alt="${esc(r.name)}" aria-hidden="true">
        <div class="rest-hero-inner">
          <span class="badge ${r.isOpen ? '' : 'closed'}" style="background:rgba(23,19,15,.7);color:#fff;padding:6px 12px;border-radius:999px;font-size:.75rem;font-weight:800">${r.isOpen ? '● OPEN NOW' : '● CLOSED'}</span>
          <h1>${esc(r.name)}</h1>
          <div class="sub">
            <span>⭐ ${r.rating.toFixed(1)} (${r.ratingCount.toLocaleString('en-IN')})</span>
            <span>·</span><span>${esc(r.cuisine)}</span>
            <span>·</span><span>🛵 ${r.deliveryTime} min</span>
            <span>·</span><span>${r.deliveryFee ? INR(r.deliveryFee) + ' delivery' : 'Free delivery'}</span>
          </div>
        </div>
      </section>
      <div class="wrap">
        <div class="rest-layout">
          <div id="menuCol" aria-live="polite"></div>
          <aside class="sticky-info">
            <div class="info-card reveal">
              <h4>About</h4>
              <p style="color:var(--mut);font-size:.93rem;margin-bottom:14px">${esc(r.description)}</p>
              <div class="info-row"><span>Delivery time</span><b>${r.deliveryTime} min</b></div>
              <div class="info-row"><span>Delivery fee</span><b>${r.deliveryFee ? INR(r.deliveryFee) : 'Free'}</b></div>
              <div class="info-row"><span>Min. order</span><b>${INR(r.minOrder)}</b></div>
              <div class="info-row"><span>GST</span><b>5%</b></div>
              <div class="info-row"><span>Payments</span><b>Card · UPI · COD</b></div>
              <button class="btn btn-brand btn-block" id="orderNow">Order from here →</button>
            </div>
          </aside>
        </div>
      </div>`;

    $('#orderNow').addEventListener('click', () => {
      App.openCart();
      if (!App.cartCount()) toast('Add something delicious first!', 'info');
    });

    const menuCol = $('#menuCol');
    function renderMenu() {
      menuCol.innerHTML = r.categories.map(cat => `
        <div class="menu-cat reveal" id="cat-${esc(cat.toLowerCase().replace(/\s+/g, '-'))}">
          <h3>${esc(cat)}</h3>
          ${r.menu.filter(m => m.category === cat).map(itemRow).join('')}
        </div>`).join('');
      menuCol.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', onAdd));
      menuCol.querySelectorAll('[data-step]').forEach(b => b.addEventListener('click', onStep));
      observeReveals(menuCol);
    }
    function itemRow(m) {
      const inCart = App.cart.lines.find(l => l.itemId === m.id);
      const ctrl = !m.available
        ? `<span class="item-unavail">Sold out</span>`
        : inCart
          ? `<div class="qty-ctrl" data-item="${m.id}">
               <button data-step="-1" aria-label="Decrease">−</button>
               <span class="q">${inCart.qty}</span>
               <button data-step="1" aria-label="Increase">+</button>
             </div>`
          : `<button class="add-btn" data-add="${m.id}">ADD +</button>`;
      return `
      <div class="item-row" data-item="${m.id}">
        <div class="item-info">
          <div class="item-name">${vegMark(m.veg)} ${esc(m.name)}</div>
          <p class="item-desc">${esc(m.description)}</p>
          <div class="item-price">${INR(m.price)}</div>
        </div>
        <span class="item-icon" aria-hidden="true">${m.icon}</span>
        ${ctrl}
      </div>`;
    }
    function onAdd(e) {
      const item = r.menu.find(m => m.id === Number(e.currentTarget.dataset.add));
      if (!item) return;
      App.addItem(r.id, r.name, item, 1).then(() => renderMenu());
    }
    function onStep(e) {
      const itemId = Number(e.currentTarget.closest('[data-item]').dataset.item);
      const line = App.cart.lines.find(l => l.itemId === itemId);
      if (!line) return;
      App.setQty(itemId, line.qty + Number(e.currentTarget.dataset.step));
      renderMenu();
    }
    renderMenu();
  }

  /* ================= CART PAGE ================= */
  function cart(main) {
    if (!App.cart.lines.length) {
      main.innerHTML = `<div class="empty-state" style="min-height:60vh;display:grid;place-items:center;align-content:center">
        <div class="e-ico">🛒</div><h3>Your cart is empty</h3>
        <p style="margin-bottom:18px">Hungry? Let's fix that.</p>
        <a class="btn btn-brand" href="#/">Browse restaurants</a></div>`;
      return;
    }
    main.innerHTML = `
      <section class="sec"><div class="wrap">
        <div class="sec-head"><div>
          <h2 class="sec-title">Your <em>cart</em></h2>
          <p class="sec-sub">From ${esc(App.cart.restaurantName)} — ${App.cartCount()} item${App.cartCount() === 1 ? '' : 's'}.</p>
        </div><a class="btn btn-ghost" href="#/restaurant/${App.cart.restaurantId}">+ Add more items</a></div>
        <div id="cartPage"></div>
      </div></section>`;
    renderPageCart();
    function renderPageCart() {
      const t = App.totals();
      $('#cartPage').innerHTML = `
        <div class="checkout-grid">
          <div class="form-card">
            ${t.items.map(it => {
              const line = App.cart.lines.find(l => l.itemId === it.id);
              return `<div class="cart-line">
                <span class="ci">${it.icon}</span>
                <div class="cn"><b>${esc(it.name)}</b><span>${vegMark(it.veg)} ${INR(it.price)}</span></div>
                <div class="qty-ctrl small" data-item="${it.id}">
                  <button data-q="-1">−</button><span class="q">${line.qty}</span><button data-q="1">+</button>
                </div>
                <span class="cp">${INR(it.price * line.qty)}</span>
              </div>`;
            }).join('')}
          </div>
          <aside>
            <div class="order-summary-card form-card" style="position:sticky;top:88px">
              <h3>Bill details</h3>
              <div class="sum-line"><span class="mut">Item total</span><b>${INR(t.subtotal)}</b></div>
              <div class="sum-line"><span class="mut">Delivery fee</span><b>${t.deliveryFee ? INR(t.deliveryFee) : 'Free'}</b></div>
              <div class="sum-line"><span class="mut">GST (5%)</span><b>${INR(t.tax)}</b></div>
              <div class="sum-total"><span>To pay</span><span>${INR(t.total)}</span></div>
              <a class="btn btn-brand btn-block" style="margin-top:18px" href="#/checkout">Proceed to checkout →</a>
            </div>
          </aside>
        </div>`;
      $('#cartPage').querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => {
        const itemId = Number(b.closest('[data-item]').dataset.item);
        const line = App.cart.lines.find(l => l.itemId === itemId);
        App.setQty(itemId, line.qty + Number(b.dataset.q));
        if (!App.cart.lines.length) cart(main);
        else renderPageCart();
      }));
    }
  }

  /* ================= CHECKOUT ================= */
  async function checkout(main) {
    if (!Session.user) {
      location.hash = '#/login?next=checkout';
      toast('Sign in to place your order.', 'info');
      return;
    }
    if (!App.cart.lines.length) {
      location.hash = '#/';
      toast('Your cart is empty.', 'info');
      return;
    }
    await App.itemInfo(App.cart.lines[0].itemId);
    const t = App.totals();
    const u = Session.user;
    main.innerHTML = `
      <section class="sec"><div class="wrap">
        <div class="sec-head"><div>
          <h2 class="sec-title">Checkout</h2>
          <p class="sec-sub">Almost there — ${App.cartCount()} item${App.cartCount() === 1 ? '' : 's'} from ${esc(App.cart.restaurantName)}.</p>
        </div><a class="btn btn-ghost" href="#/cart">← Back to cart</a></div>
        <div class="checkout-grid">
          <div>
            <div class="form-card reveal">
              <h3><span class="step-num">1</span> Delivery details</h3>
              <div class="field"><label for="addr">Full address <span class="req">*</span></label>
                <textarea id="addr" required placeholder="House / flat, street, landmark, city">${esc(u.address || '')}</textarea></div>
              <div class="field-row">
                <div class="field"><label for="phone">Phone <span class="req">*</span></label>
                  <input id="phone" type="tel" required value="${esc(u.phone || '')}" placeholder="+91 …"></div>
                <div class="field"><label for="note">Note for the kitchen</label>
                  <input id="note" placeholder="e.g. extra spicy, no onions"></div>
              </div>
            </div>
            <div class="form-card reveal">
              <h3><span class="step-num">2</span> Payment</h3>
              <div class="pay-options" id="payOpts" role="radiogroup" aria-label="Payment method">
                <div class="pay-opt active" data-m="card" role="radio" aria-checked="true" tabindex="0">
                  <div class="pi">💳</div><b>Card</b><span>Visa · Mastercard</span>
                </div>
                <div class="pay-opt" data-m="upi" role="radio" aria-checked="false" tabindex="0">
                  <div class="pi">📱</div><b>UPI</b><span>GPay · PhonePe</span>
                </div>
                <div class="pay-opt" data-m="cod" role="radio" aria-checked="false" tabindex="0">
                  <div class="pi">💵</div><b>Cash</b><span>Pay on delivery</span>
                </div>
              </div>
              <div id="payForms"></div>
              <p style="font-size:.78rem;color:var(--faint);font-weight:600;margin-top:10px">Demo gateway — try card <code style="font-weight:800">4242 4242 4242 4242</code>, any future expiry, any CVV.</p>
            </div>
          </div>
          <aside>
            <div class="form-card order-summary-card" style="position:sticky;top:88px">
              <h3>Order summary</h3>
              ${t.items.map(it => {
                const line = App.cart.lines.find(l => l.itemId === it.id);
                return `<div class="sum-line"><span class="mut">${line.qty}× ${esc(it.name)}</span><b>${INR(it.price * line.qty)}</b></div>`;
              }).join('')}
              <div class="sum-line" style="margin-top:8px"><span class="mut">Delivery</span><b>${t.deliveryFee ? INR(t.deliveryFee) : 'Free'}</b></div>
              <div class="sum-line"><span class="mut">GST (5%)</span><b>${INR(t.tax)}</b></div>
              <div class="sum-total"><span>Total</span><span>${INR(t.total)}</span></div>
              <button class="btn btn-brand btn-block" style="margin-top:18px" id="placeOrder">Place order · ${INR(t.total)}</button>
              <p style="font-size:.76rem;color:var(--faint);margin-top:10px;text-align:center">By ordering you agree to be very hungry.</p>
            </div>
          </aside>
        </div>
      </div></section>
      <div class="pay-overlay" id="payOverlay" role="status">
        <div class="pay-card" id="payCard"></div>
      </div>`;

    /* payment method switching */
    const payForms = $('#payForms');
    const CARD_FORM = `
      <div class="field"><label for="cname">Name on card</label><input id="cname" placeholder="As printed on card"></div>
      <div class="field"><label for="cnum">Card number <span class="req">*</span></label>
        <input id="cnum" inputmode="numeric" placeholder="4242 4242 4242 4242" maxlength="23"></div>
      <div class="field-row">
        <div class="field"><label for="cexp">Expiry (MM/YY) <span class="req">*</span></label><input id="cexp" placeholder="12/30" maxlength="5"></div>
        <div class="field"><label for="ccvv">CVV <span class="req">*</span></label><input id="ccvv" type="password" inputmode="numeric" placeholder="•••" maxlength="4"></div>
      </div>`;
    const UPI_FORM = `
      <div class="field"><label for="upiId">UPI ID <span class="req">*</span></label>
        <input id="upiId" placeholder="yourname@upi"></div>`;
    let method = 'card';
    payForms.innerHTML = CARD_FORM;
    $('#payOpts').querySelectorAll('.pay-opt').forEach(opt => opt.addEventListener('click', () => {
      method = opt.dataset.m;
      $('#payOpts').querySelectorAll('.pay-opt').forEach(o => {
        const on = o === opt;
        o.classList.toggle('active', on);
        o.setAttribute('aria-checked', String(on));
      });
      payForms.innerHTML = method === 'card' ? CARD_FORM : method === 'upi' ? UPI_FORM : '';
    }));

    /* card input niceties */
    $('#cnum')?.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ');
    });
    $('#cexp')?.addEventListener('input', (e) => {
      let v = e.target.value.replace(/\D/g, '').slice(0, 4);
      if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2);
      e.target.value = v;
    });

    /* place order */
    $('#placeOrder').addEventListener('click', async () => {
      const addr = $('#addr').value.trim();
      const phone = $('#phone').value.trim();
      if (!addr || !phone) return toast('Please fill your address and phone number.', 'error');
      const overlay = $('#payOverlay');
      const card = $('#payCard');
      card.innerHTML = `<div class="spinner"></div><h3>Processing payment…</h3><p>Contacting the (simulated) gateway.</p>`;
      overlay.classList.add('show');
      await new Promise(res => setTimeout(res, 1600));   /* theatrical gateway latency */
      const payment = { method };
      if (method === 'card') payment.number = $('#cnum').value, payment.expiry = $('#cexp').value, payment.cvv = $('#ccvv').value;
      if (method === 'upi') payment.upiId = $('#upiId').value;
      try {
        const items = App.cart.lines.map(l => ({ itemId: l.itemId, qty: l.qty }));
        const data = await API.post('/api/orders', {
          restaurantId: App.cart.restaurantId, items, address: addr, phone, note: $('#note').value, payment
        });
        card.innerHTML = `
          <div class="check-ring"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 9.5 18 20 6.5"/></svg></div>
          <h3>Order confirmed!</h3>
          <p>${esc(data.order.restaurantName)} is on it.<br>Payment ${esc(data.payment.ref)} · ${esc(method.toUpperCase())}</p>
          <a class="btn btn-brand" style="margin-top:18px" href="#/order/${data.order.id}">Track order →</a>`;
        App.cart = { restaurantId: null, restaurantName: null, lines: [] };
        App.saveCart();
      } catch (e) {
        card.innerHTML = `<div class="check-ring" style="background:var(--danger)">✕</div>
          <h3>Payment failed</h3><p>${esc(e.message)}</p>
          <button class="btn btn-dark" style="margin-top:18px" onclick="document.getElementById('payOverlay').classList.remove('show')">Try again</button>`;
      }
    });
  }

  /* ================= MY ORDERS ================= */
  async function orders(main) {
    if (!Session.user) { location.hash = '#/login?next=orders'; toast('Sign in to see your orders.', 'info'); return; }
    const list = await API.get('/api/orders/mine');
    main.innerHTML = `
      <section class="sec"><div class="wrap">
        <div class="sec-head"><div>
          <h2 class="sec-title">Your <em>orders</em></h2>
          <p class="sec-sub">Every meal, tracked to your doorstep.</p>
        </div></div>
        ${list.length ? list.map(orderCard).join('') : `
        <div class="empty-state"><div class="e-ico">📦</div>
          <h3>No orders yet</h3><p>Your future favourite meal is waiting.</p>
          <a class="btn btn-brand" style="margin-top:16px" href="#/">Order something</a></div>`}
      </div></section>`;
    main.querySelectorAll('.order-card').forEach(c => c.addEventListener('click', () => location.hash = '#/order/' + c.dataset.id));
  }

  function orderCard(o) {
    return `
      <article class="order-card reveal" data-id="${o.id}" role="link" tabindex="0" aria-label="Order ${esc(o.orderNo)}, ${esc(o.statusLabel)}">
        <img class="order-thumb" src="${esc(o.restaurantImage)}" alt="" loading="lazy">
        <div class="order-info">
          <h3>${esc(o.restaurantName)}</h3>
          <div class="meta">
            <span>#${esc(o.orderNo)}</span>
            <span>${o.items.length} item${o.items.length === 1 ? '' : 's'}</span>
            <span>${esc(new Date(o.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))}</span>
            <span>${o.paymentMethod.toUpperCase()}</span>
          </div>
        </div>
        <div class="order-right">
          <div class="amt">${INR(o.total)}</div>
          <span class="status-pill status-${esc(o.status)}"><span class="sd"></span>${esc(o.statusLabel)}</span>
        </div>
      </article>`;
  }

  /* ================= ORDER TRACKING ================= */
  const TL = [
    { key: 'placed', icon: '📝' },
    { key: 'confirmed', icon: '✅' },
    { key: 'preparing', icon: '👨‍🍳' },
    { key: 'out_for_delivery', icon: '🛵' },
    { key: 'delivered', icon: '🏠' }
  ];
  async function order(main, s) {
    if (!Session.user) { location.hash = '#/login?next=order'; return; }
    const id = s.segs[1];
    let { order: o } = await API.get('/api/orders/' + id);
    const cancelled = o.status === 'cancelled';
    const idx = TL.findIndex(t => t.key === o.status);
    const cancelledIdx = cancelled ? TL.length - 1 : idx;

    main.innerHTML = `
      <section class="sec"><div class="wrap" style="max-width:1040px">
        <div class="sec-head"><div>
          <h2 class="sec-title">Tracking <em>#${esc(o.orderNo)}</em></h2>
          <p class="sec-sub">${esc(o.restaurantName)} · placed ${esc(new Date(o.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))}</p>
        </div><span class="status-pill status-${esc(o.status)}"><span class="sd"></span>${esc(o.statusLabel)}</span></div>

        ${cancelled ? '' : `
        <div class="eta-banner reveal">
          <span class="ei">🛵</span>
          <div><b id="etaLabel">${o.status === 'delivered' ? 'Delivered' : 'Arriving in ~' + o.etaMinutes + ' min'}</b>
          <span>${o.status === 'delivered' ? 'Enjoy your meal! 🎉' : 'Your rider is working their magic.'}</span></div>
        </div>`}

        <div class="track-grid">
          <div>
            <div class="detail-card reveal">
              <h3>Journey</h3>
              <div class="timeline" id="timeline">
                ${cancelled
                  ? `<div class="tl-node cancelled"><span class="tl-dot">✕</span><h4>Cancelled</h4>
                     <span class="when">${whenStr(o.history.find(h => h.status === 'cancelled')?.at)}</span></div>`
                  : TL.map((t, i) => {
                      const done = i < idx;
                      const current = i === idx;
                      const h = o.history.find(x => x.status === t.key);
                      return `<div class="tl-node ${done ? 'done' : ''} ${current ? 'current' : ''}">
                        <span class="tl-dot">${done ? '✓' : t.icon}</span>
                        <h4>${t.key.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')}</h4>
                        <span class="when">${h ? whenStr(h.at) : 'Pending…'}</span>
                      </div>`;
                    }).join('')}
              </div>
            </div>
            ${!cancelled && o.status === 'placed' ? `<button class="btn btn-danger-ghost" id="cancelOrder">Cancel this order</button>` : ''}
          </div>
          <aside>
            <div class="detail-card reveal">
              <h3>Items</h3>
              ${o.items.map(l => `<div class="detail-row"><span>${l.qty}× ${esc(l.name)}</span><b>${INR(l.price * l.qty)}</b></div>`).join('')}
              <div class="detail-row"><span>Delivery</span><b>${o.deliveryFee ? INR(o.deliveryFee) : 'Free'}</b></div>
              <div class="detail-row"><span>GST</span><b>${INR(o.tax)}</b></div>
              <div class="detail-row" style="font-size:1.05rem"><span>Total</span><b>${INR(o.total)}</b></div>
            </div>
            <div class="detail-card reveal">
              <h3>Delivery</h3>
              <div class="detail-row"><span>Address</span><b style="text-align:right;max-width:220px">${esc(o.address)}</b></div>
              <div class="detail-row"><span>Phone</span><b>${esc(o.phone)}</b></div>
              <div class="detail-row"><span>Payment</span><b>${o.paymentMethod.toUpperCase()}</b></div>
              <span class="ref-badge"><span class="ok-dot"></span> ${esc(o.paymentRef)}</span>
            </div>
          </aside>
        </div>
      </div></section>`;

    function whenStr(iso) {
      if (!iso) return '';
      return new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
    }

    const cancelBtn = $('#cancelOrder');
    cancelBtn?.addEventListener('click', async () => {
      const m = openModal({
        title: 'Cancel this order?',
        sub: 'You can only cancel while the order is still "placed".',
        actions: `<button class="btn btn-danger-ghost" data-m="ok">Yes, cancel</button>`
      });
      m.onOk(async () => {
        try {
          await API.post(`/api/orders/${id}/cancel`);
          toast('Order cancelled.', 'info');
          location.hash = '#/orders';
        } catch (e) { toast(e.message, 'error'); }
      });
    });

    /* live polling — status moves as the kitchen works */
    let last = o.status;
    if (order.pollTimer) clearInterval(order.pollTimer);
    order.pollTimer = setInterval(async () => {
      try {
        const d = await API.get('/api/orders/' + id);
        if (d.order.status !== last) {
          last = d.order.status;
          if (d.order.status === 'cancelled') { location.reload(); return; }
          toast(`${d.order.statusLabel} — ${d.order.restaurantName}`, 'success');
          Router.go();
        }
      } catch { /* server hiccup, try again */ }
    }, 6000);
  }

  /* ================= AUTH ================= */
  function login(main) {
    if (Session.user) { location.hash = '#/'; return; }
    main.innerHTML = `
      <div class="auth-wrap">
        <div class="auth-card reveal">
          <h1>Welcome back</h1>
          <p class="sub">Sign in to track orders and skip the queue.</p>
          <div class="field"><label for="lEmail">Email</label><input id="lEmail" type="email" placeholder="you@example.com"></div>
          <div class="field"><label for="lPass">Password</label><input id="lPass" type="password" placeholder="••••••••"></div>
          <button class="btn btn-brand btn-block" id="loginBtn">Sign in →</button>
          <div class="demo-box">
            <b>Demo accounts</b>
            <div class="row"><span>Customer</span><code>demo@eatsy.in / demo123</code><button class="btn btn-sm btn-soft" data-fill="demo">Use</button></div>
            <div class="row"><span>Admin</span><code>admin@eatsy.in / admin123</code><button class="btn btn-sm btn-soft" data-fill="admin">Use</button></div>
          </div>
          <p class="auth-switch">New here? <a href="#/register">Create an account</a></p>
        </div>
      </div>`;
    main.querySelectorAll('[data-fill]').forEach(b => b.addEventListener('click', () => {
      const [e, p] = b.dataset.fill === 'demo' ? ['demo@eatsy.in', 'demo123'] : ['admin@eatsy.in', 'admin123'];
      $('#lEmail').value = e; $('#lPass').value = p;
    }));
    const go = async () => {
      try {
        const d = await API.post('/api/auth/login', { email: $('#lEmail').value, password: $('#lPass').value });
        Session.set(d.user);
        renderUserArea();
        Router.markNav();
        toast(`Welcome back, ${d.user.name.split(' ')[0]}!`, 'success');
        location.hash = '#' + (Router.parse().params.next || '/');
        Router.go();
      } catch (e) { toast(e.message, 'error'); }
    };
    $('#loginBtn').addEventListener('click', go);
    $('#lPass').addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  }

  function register(main) {
    if (Session.user) { location.hash = '#/'; return; }
    main.innerHTML = `
      <div class="auth-wrap">
        <div class="auth-card reveal">
          <h1>Join Eatsy</h1>
          <p class="sub">Create an account — it takes 20 seconds, dinner takes 25 minutes.</p>
          <div class="field"><label for="rName">Full name</label><input id="rName" placeholder="Aisha Khan"></div>
          <div class="field"><label for="rEmail">Email</label><input id="rEmail" type="email" placeholder="you@example.com"></div>
          <div class="field"><label for="rPhone">Phone</label><input id="rPhone" type="tel" placeholder="+91 …"></div>
          <div class="field"><label for="rPass">Password <span style="color:var(--faint);font-weight:600">(min 6 chars)</span></label><input id="rPass" type="password" placeholder="••••••••"></div>
          <button class="btn btn-brand btn-block" id="regBtn">Create account →</button>
          <p class="auth-switch">Already a member? <a href="#/login">Sign in</a></p>
        </div>
      </div>`;
    $('#regBtn').addEventListener('click', async () => {
      try {
        const d = await API.post('/api/auth/register', {
          name: $('#rName').value, email: $('#rEmail').value, phone: $('#rPhone').value, password: $('#rPass').value
        });
        Session.set(d.user);
        renderUserArea();
        Router.markNav();
        toast(`Welcome to Eatsy, ${d.user.name.split(' ')[0]}! 🎉`, 'success');
        location.hash = '#/';
        Router.go();
      } catch (e) { toast(e.message, 'error'); }
    });
  }

  function notfound(main) {
    main.innerHTML = `<div class="error-state" style="min-height:60vh;display:grid;place-items:center;align-content:center">
      <div class="e-ico">🧭</div><h2>Page not found</h2><p>The kitchen couldn't find that page.</p>
      <a class="btn btn-brand" style="margin-top:14px" href="#/">Go home</a></div>`;
  }

  /* stop tracking pollers when navigating away */
  window.addEventListener('hashchange', () => {
    if (order.pollTimer) { clearInterval(order.pollTimer); order.pollTimer = null; }
  });

  return { home, restaurant, cart, checkout, orders, order, login, register, notfound,
           admin: (main) => Admin.run(main) };
})();
