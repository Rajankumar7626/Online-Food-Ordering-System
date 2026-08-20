/* ============================================================
   Eatsy — full-stack online food ordering system
   Express + SQLite. Auth, restaurants, menus, orders,
   mock payment gateway, admin dashboard API, live status ticks.
============================================================ */
'use strict';

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const { db, seed } = require('./db');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3000;
const SESSION_DAYS = 7;
const CSRF_COOKIE = 'csrf';
const COOKIE_SECURE = isProduction;
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || (isProduction ? '' : 'admin@eatsy.in')).trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const DEMO_EMAIL = String(process.env.DEMO_EMAIL || '').trim().toLowerCase();
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || '';

if (isProduction && (!ADMIN_EMAIL || !ADMIN_PASSWORD)) {
  throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be configured in production.');
}

if (isProduction) app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));

app.use(express.json({ limit: '200kb' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isProduction ? 20 : 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { ok: false, error: 'Too many authentication attempts. Please try again later.' }
});
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isProduction ? 300 : 1000,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { ok: false, error: 'Too many admin requests. Please try again later.' }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/admin', adminLimiter);

function cookieValue(req, name) {
  const prefix = `${name}=`;
  return (req.headers.cookie || '').split(';').map(s => s.trim())
    .find(s => s.startsWith(prefix))?.slice(prefix.length) || '';
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function csrfProtection(req, res, next) {
  let token = cookieValue(req, CSRF_COOKIE);
  if (!token) {
    token = crypto.randomBytes(24).toString('hex');
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false, secure: COOKIE_SECURE, sameSite: 'lax',
      maxAge: SESSION_DAYS * 864e5, path: '/'
    });
  }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !safeEqual(token, req.get('x-csrf-token'))) {
    return res.status(403).json({ ok: false, error: 'Invalid CSRF token.' });
  }
  next();
}
app.use('/api', csrfProtection);

/* ============================================================
   Auth helpers — scrypt hashing, sessions, middleware
============================================================ */
function sessionCookieOptions() {
  return { httpOnly: true, secure: COOKIE_SECURE, sameSite: 'lax', maxAge: SESSION_DAYS * 864e5, path: '/' };
}

function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pw, salt, 32).toString('hex');
  return `${salt}:${hash}`;
}
function verifyPassword(pw, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(pw, salt, 32);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

function createSession(userId) {
  const token = crypto.randomBytes(24).toString('hex');
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expires);
  return token;
}

function currentUser(req) {
  const token = req.cookiesSid || cookieValue(req, 'sid');
  if (!token) return null;
  const row = db.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token = ? AND s.expires_at > ?`).get(token, new Date().toISOString());
  return row || null;
}

function requireAuth(req, res, next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ ok: false, error: 'Please sign in to continue.' });
  req.user = user;
  next();
}
function requireAdmin(req, res, next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ ok: false, error: 'Please sign in to continue.' });
  if (user.role !== 'admin') return res.status(403).json({ ok: false, error: 'Admin access required.' });
  req.user = user;
  next();
}

const publicUser = u => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role });

/* ============================================================
   Helpers
============================================================ */
const STATUS_FLOW = ['placed', 'confirmed', 'preparing', 'out_for_delivery', 'delivered'];
const STATUS_LABELS = {
  placed: 'Order placed', confirmed: 'Confirmed', preparing: 'Being prepared',
  out_for_delivery: 'On the way', delivered: 'Delivered', cancelled: 'Cancelled'
};

const nowIso = () => new Date().toISOString();

function orderNo() {
  return 'E' + Date.now().toString(36).toUpperCase() + crypto.randomBytes(2).toString('hex').toUpperCase();
}

function appendHistory(order, status) {
  const h = JSON.parse(order.history || '[]');
  h.push({ status, at: nowIso() });
  return JSON.stringify(h);
}

function parseOrder(row) {
  if (!row) return null;
  return {
    id: row.id,
    orderNo: row.order_no,
    restaurantId: row.restaurant_id,
    restaurantName: row.restaurant_name || '',
    restaurantImage: row.restaurant_image || '',
    items: JSON.parse(row.items),
    subtotal: row.subtotal,
    deliveryFee: row.delivery_fee,
    tax: row.tax,
    total: row.total,
    address: row.address,
    phone: row.phone,
    note: row.note,
    paymentMethod: row.payment_method,
    paymentRef: row.payment_ref,
    status: row.status,
    statusLabel: STATUS_LABELS[row.status] || row.status,
    history: JSON.parse(row.history || '[]'),
    createdAt: (row.created_at || '').replace(' ', 'T').replace(/Z$/, '') + 'Z',
    etaMinutes: row.eta_minutes || 30
  };
}

/* Luhn check for the mock card gateway */
function luhnValid(num) {
  let sum = 0, alt = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let d = num.charCodeAt(i) - 48;
    if (alt) { d *= 2; if (d > 9) d -= 9; }
    sum += d; alt = !alt;
  }
  return sum % 10 === 0;
}

/* Mock payment gateway — validates & returns a reference */
function processPayment(method, data) {
  if (method === 'card') {
    const num = String(data.number || '').replace(/\s/g, '');
    if (!/^\d{13,19}$/.test(num) || !luhnValid(num)) throw Object.assign(new Error('Card number looks invalid.'), { status: 422 });
    const m = /^(0[1-9]|1[0-2])\s*\/\s*(\d{2})$/.exec(String(data.expiry || '').trim());
    if (!m) throw Object.assign(new Error('Enter expiry as MM/YY.'), { status: 422 });
    const expYear = 2000 + parseInt(m[2], 10);
    if (new Date(expYear, parseInt(m[1], 10), 1) <= new Date()) throw Object.assign(new Error('This card has expired.'), { status: 422 });
    if (!/^\d{3,4}$/.test(String(data.cvv || ''))) throw Object.assign(new Error('CVV must be 3–4 digits.'), { status: 422 });
    return 'PAY-' + crypto.randomBytes(5).toString('hex').toUpperCase();
  }
  if (method === 'upi') {
    if (!/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(String(data.upiId || ''))) throw Object.assign(new Error('Enter a valid UPI ID (e.g. name@upi).'), { status: 422 });
    return 'UPI-' + crypto.randomBytes(5).toString('hex').toUpperCase();
  }
  if (method === 'cod') return 'COD-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  throw Object.assign(new Error('Unknown payment method.'), { status: 422 });
}

/* ============================================================
   Auth routes
============================================================ */
app.post('/api/auth/register', (req, res) => {
  const { name, email, phone, password } = req.body || {};
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedName = String(name || '').trim();
  if (!normalizedName || !normalizedEmail || !password) return res.status(422).json({ ok: false, error: 'Name, email and password are required.' });
  if (String(password).length < 6) return res.status(422).json({ ok: false, error: 'Password must be at least 6 characters.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return res.status(422).json({ ok: false, error: 'Enter a valid email address.' });
  if (db.prepare('SELECT id FROM users WHERE lower(email) = ?').get(normalizedEmail))
    return res.status(409).json({ ok: false, error: 'An account with this email already exists.' });
  const info = db.prepare('INSERT INTO users (name, email, phone, password_hash) VALUES (?, ?, ?, ?)')
    .run(normalizedName, normalizedEmail, String(phone || '').trim(), hashPassword(password));
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.cookie('sid', createSession(user.id), sessionCookieOptions());
  res.status(201).json({ ok: true, data: { user: publicUser(user) } });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email || '').trim().toLowerCase());
  if (!user || !verifyPassword(String(password || ''), user.password_hash))
    return res.status(401).json({ ok: false, error: 'Incorrect email or password.' });
  res.cookie('sid', createSession(user.id), sessionCookieOptions());
  res.json({ ok: true, data: { user: publicUser(user) } });
});

app.post('/api/auth/logout', (req, res) => {
  const token = cookieValue(req, 'sid');
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  res.clearCookie('sid', { path: '/', secure: COOKIE_SECURE, sameSite: 'lax' });
  res.json({ ok: true, data: null });
});

app.get('/api/auth/me', (req, res) => {
  const user = currentUser(req);
  res.json({ ok: true, data: { user: user ? publicUser(user) : null } });
});

/* ============================================================
   Restaurants & menu
============================================================ */
app.get('/api/restaurants', (req, res) => {
  const rows = db.prepare(`SELECT id, name, cuisine, description, image, delivery_time, delivery_fee,
    min_order, rating, rating_count, is_open FROM restaurants ORDER BY rating DESC`).all();
  res.json({ ok: true, data: rows.map(r => ({
    id: r.id, name: r.name, cuisine: r.cuisine, description: r.description, image: r.image,
    deliveryTime: r.delivery_time, deliveryFee: r.delivery_fee, minOrder: r.min_order,
    rating: r.rating, ratingCount: r.rating_count, isOpen: !!r.is_open
  })) });
});

app.get('/api/restaurants/:id', (req, res) => {
  const r = db.prepare('SELECT * FROM restaurants WHERE id = ?').get(req.params.id);
  if (!r) return res.status(404).json({ ok: false, error: 'Restaurant not found.' });
  const items = db.prepare('SELECT * FROM menu_items WHERE restaurant_id = ? ORDER BY sort, id').all(r.id);
  const categories = [];
  const menu = items.map(i => {
    if (!categories.includes(i.category)) categories.push(i.category);
    return {
      id: i.id, name: i.name, description: i.description, price: i.price,
      category: i.category, veg: !!i.veg, icon: i.icon, available: !!i.available
    };
  });
  res.json({ ok: true, data: {
    id: r.id, name: r.name, cuisine: r.cuisine, description: r.description, image: r.image,
    deliveryTime: r.delivery_time, deliveryFee: r.delivery_fee, minOrder: r.min_order,
    rating: r.rating, ratingCount: r.rating_count, isOpen: !!r.is_open, categories, menu
  } });
});

/* ============================================================
   Orders
============================================================ */
app.post('/api/orders', requireAuth, (req, res) => {
  try {
    const { restaurantId, items, address, phone, note, payment } = req.body || {};
    if (!restaurantId || !Array.isArray(items) || !items.length) return res.status(422).json({ ok: false, error: 'Your cart is empty.' });
    if (!address || !String(address).trim()) return res.status(422).json({ ok: false, error: 'Delivery address is required.' });
    if (!phone || !/^[+\d][\d\s-]{7,14}$/.test(String(phone))) return res.status(422).json({ ok: false, error: 'Enter a valid phone number.' });

    const rest = db.prepare('SELECT * FROM restaurants WHERE id = ?').get(restaurantId);
    if (!rest) return res.status(404).json({ ok: false, error: 'Restaurant not found.' });
    if (!rest.is_open) return res.status(422).json({ ok: false, error: 'This restaurant is currently closed.' });

    /* server-side price truth: never trust client prices */
    const lines = [];
    for (const it of items) {
      const qty = Math.max(1, Math.min(50, parseInt(it.qty, 10) || 1));
      const mi = db.prepare('SELECT * FROM menu_items WHERE id = ? AND restaurant_id = ?').get(it.itemId, restaurantId);
      if (!mi) return res.status(422).json({ ok: false, error: 'A cart item is no longer available.' });
      if (!mi.available) return res.status(422).json({ ok: false, error: `"${mi.name}" is temporarily unavailable.` });
      const existing = lines.find(l => l.itemId === mi.id);
      if (existing) existing.qty += qty; else lines.push({ itemId: mi.id, name: mi.name, price: mi.price, icon: mi.icon, veg: !!mi.veg, qty });
    }
    const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
    if (subtotal < rest.min_order) return res.status(422).json({ ok: false, error: `Minimum order value is ₹${rest.min_order}.` });
    const tax = Math.round(subtotal * 0.05);           /* GST 5% */
    const total = subtotal + rest.delivery_fee + tax;

    const method = ['card', 'upi', 'cod'].includes(payment?.method) ? payment.method : 'cod';
    const ref = processPayment(method, payment || {});

    const info = db.prepare(`INSERT INTO orders
      (order_no, user_id, restaurant_id, items, subtotal, delivery_fee, tax, total,
       address, phone, note, payment_method, payment_ref, status, history)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'placed', ?)`)
      .run(orderNo(), req.user.id, rest.id, JSON.stringify(lines), subtotal, rest.delivery_fee, tax, total,
           String(address).trim(), String(phone).trim(), String(note || '').trim(), method, ref,
           JSON.stringify([{ status: 'placed', at: nowIso() }]));

    const order = parseOrder(db.prepare(`SELECT o.*, r.name AS restaurant_name, r.image AS restaurant_image, r.delivery_time AS eta_minutes
      FROM orders o JOIN restaurants r ON r.id = o.restaurant_id WHERE o.id = ?`).get(info.lastInsertRowid));
    res.status(201).json({ ok: true, data: { order, payment: { method, ref, status: 'success' } } });
  } catch (e) {
    res.status(e.status || 400).json({ ok: false, error: e.message });
  }
});

app.get('/api/orders/mine', requireAuth, (req, res) => {
  const rows = db.prepare(`SELECT o.*, r.name AS restaurant_name, r.image AS restaurant_image, r.delivery_time AS eta_minutes
    FROM orders o JOIN restaurants r ON r.id = o.restaurant_id
    WHERE o.user_id = ? ORDER BY o.id DESC LIMIT 50`).all(req.user.id);
  res.json({ ok: true, data: rows.map(parseOrder) });
});

app.get('/api/orders/:id', requireAuth, (req, res) => {
  const row = db.prepare(`SELECT o.*, r.name AS restaurant_name, r.image AS restaurant_image, r.delivery_time AS eta_minutes
    FROM orders o JOIN restaurants r ON r.id = o.restaurant_id WHERE o.id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ ok: false, error: 'Order not found.' });
  if (row.user_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ ok: false, error: 'Not your order.' });
  res.json({ ok: true, data: { order: parseOrder(row) } });
});

app.post('/api/orders/:id/cancel', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ ok: false, error: 'Order not found.' });
  if (row.user_id !== req.user.id) return res.status(403).json({ ok: false, error: 'Not your order.' });
  if (row.status !== 'placed') return res.status(422).json({ ok: false, error: 'Only orders that are still "placed" can be cancelled.' });
  const history = appendHistory(row, 'cancelled');
  db.prepare("UPDATE orders SET status='cancelled', history=?, updated_at=datetime('now') WHERE id=?").run(history, row.id);
  res.json({ ok: true, data: { status: 'cancelled' } });
});

/* ============================================================
   Admin API
============================================================ */
app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const ist = "+330 minutes"; /* IST */
  const today = db.prepare(`SELECT COUNT(*) c, COALESCE(SUM(total),0) rev FROM orders
    WHERE date(created_at, ?) = date('now', ?) AND status != 'cancelled'`).get(ist, ist);
  const totals = db.prepare(`SELECT COUNT(*) c, COALESCE(SUM(total),0) rev FROM orders WHERE status != 'cancelled'`).get();
  const open = db.prepare(`SELECT COUNT(*) c FROM orders WHERE status IN ('placed','confirmed','preparing','out_for_delivery')`).get().c;
  const users = db.prepare(`SELECT COUNT(*) c FROM users WHERE role = 'user'`).get().c;
  const avg = totals.c ? Math.round(totals.rev / totals.c) : 0;

  const rev7 = db.prepare(`SELECT date(created_at, ?) d, COUNT(*) c, COALESCE(SUM(total),0) rev
    FROM orders WHERE status != 'cancelled' AND date(created_at, ?) >= date('now', ?, '-6 days')
    GROUP BY d ORDER BY d`).all(ist, ist, ist);
  /* fill missing days */
  const map = new Map(rev7.map(r => [r.d, r]));
  const out7 = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 864e5);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    const row = map.get(key);
    out7.push({ date: key, revenue: row ? row.rev : 0, orders: row ? row.c : 0 });
  }

  const topItems = {};
  db.prepare(`SELECT items FROM orders WHERE status != 'cancelled'`).all().forEach(r => {
    JSON.parse(r.items).forEach(l => {
      topItems[l.name] = topItems[l.name] || { name: l.name, qty: 0, revenue: 0 };
      topItems[l.name].qty += l.qty;
      topItems[l.name].revenue += l.price * l.qty;
    });
  });
  const top = Object.values(topItems).sort((a, b) => b.qty - a.qty).slice(0, 6);

  res.json({ ok: true, data: {
    todayOrders: today.c, todayRevenue: today.rev,
    totalOrders: totals.c, totalRevenue: totals.rev,
    openOrders: open, totalUsers: users, avgOrderValue: avg,
    revenue7d: out7, topItems: top
  } });
});

app.get('/api/admin/orders', requireAdmin, (req, res) => {
  const { status } = req.query;
  let sql = `SELECT o.*, r.name AS restaurant_name, r.image AS restaurant_image, r.delivery_time AS eta_minutes, u.name AS user_name
    FROM orders o JOIN restaurants r ON r.id = o.restaurant_id JOIN users u ON u.id = o.user_id`;
  const params = [];
  if (status && status !== 'all') { sql += ' WHERE o.status = ?'; params.push(status); }
  sql += ' ORDER BY o.id DESC LIMIT 200';
  const rows = db.prepare(sql).all(...params);
  res.json({ ok: true, data: rows.map(row => ({ ...parseOrder(row), userName: row.user_name })) });
});

app.patch('/api/admin/orders/:id/status', requireAdmin, (req, res) => {
  const { status } = req.body || {};
  if (!STATUS_FLOW.includes(status) && status !== 'cancelled')
    return res.status(422).json({ ok: false, error: 'Invalid status.' });
  const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ ok: false, error: 'Order not found.' });
  if (row.status === 'delivered' || row.status === 'cancelled')
    return res.status(422).json({ ok: false, error: `Order is already ${row.status}.` });
  const history = appendHistory(row, status);
  db.prepare("UPDATE orders SET status=?, history=?, updated_at=datetime('now') WHERE id=?").run(status, history, row.id);
  res.json({ ok: true, data: { status } });
});

/* ---- restaurant & menu management ---- */
function restPayload(b) {
  return {
    name: String(b.name || '').trim(),
    cuisine: String(b.cuisine || '').trim(),
    description: String(b.description || '').trim(),
    image: String(b.image || '').trim(),
    delivery_time: Math.max(5, Math.min(120, parseInt(b.deliveryTime, 10) || 30)),
    delivery_fee: Math.max(0, parseInt(b.deliveryFee, 10) || 0),
    min_order: Math.max(0, parseInt(b.minOrder, 10) || 0),
    rating: Math.min(5, Math.max(0, parseFloat(b.rating) || 4.5)),
    rating_count: Math.max(0, parseInt(b.ratingCount, 10) || 1),
    is_open: b.isOpen === false ? 0 : 1
  };
}
app.post('/api/admin/restaurants', requireAdmin, (req, res) => {
  const p = restPayload(req.body || {});
  if (!p.name || !p.cuisine) return res.status(422).json({ ok: false, error: 'Name and cuisine are required.' });
  const info = db.prepare(`INSERT INTO restaurants (name, cuisine, description, image, delivery_time, delivery_fee, min_order, rating, rating_count, is_open)
    VALUES (@name, @cuisine, @description, @image, @delivery_time, @delivery_fee, @min_order, @rating, @rating_count, @is_open)`).run(p);
  res.status(201).json({ ok: true, data: { id: info.lastInsertRowid } });
});
app.put('/api/admin/restaurants/:id', requireAdmin, (req, res) => {
  const p = restPayload(req.body || {});
  if (!p.name || !p.cuisine) return res.status(422).json({ ok: false, error: 'Name and cuisine are required.' });
  const result = db.prepare(`UPDATE restaurants SET name=@name, cuisine=@cuisine, description=@description, image=@image,
    delivery_time=@delivery_time, delivery_fee=@delivery_fee, min_order=@min_order, rating=@rating,
    rating_count=@rating_count, is_open=@is_open WHERE id=@id`).run({ ...p, id: req.params.id });
  if (!result.changes) return res.status(404).json({ ok: false, error: 'Restaurant not found.' });
  res.json({ ok: true, data: { id: Number(req.params.id) } });
});
app.delete('/api/admin/restaurants/:id', requireAdmin, (req, res) => {
  const restaurant = db.prepare('SELECT id FROM restaurants WHERE id = ?').get(req.params.id);
  if (!restaurant) return res.status(404).json({ ok: false, error: 'Restaurant not found.' });
  const order = db.prepare('SELECT id FROM orders WHERE restaurant_id = ? LIMIT 1').get(req.params.id);
  if (order) return res.status(409).json({ ok: false, error: 'This restaurant has order history and cannot be deleted.' });
  db.prepare('DELETE FROM restaurants WHERE id = ?').run(req.params.id);
  res.json({ ok: true, data: null });
});

app.post('/api/admin/restaurants/:id/items', requireAdmin, (req, res) => {
  const b = req.body || {};
  const name = String(b.name || '').trim();
  const price = parseInt(b.price, 10);
  if (!name || !price || price <= 0) return res.status(422).json({ ok: false, error: 'Name and a valid price are required.' });
  const rest = db.prepare('SELECT id FROM restaurants WHERE id = ?').get(req.params.id);
  if (!rest) return res.status(404).json({ ok: false, error: 'Restaurant not found.' });
  const info = db.prepare(`INSERT INTO menu_items (restaurant_id, name, description, price, category, veg, icon, available, sort)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(req.params.id, name, String(b.description || '').trim(), price,
         String(b.category || 'Main').trim(), b.veg ? 1 : 0, String(b.icon || '🍽️').trim(), b.available === false ? 0 : 1,
         parseInt(b.sort, 10) || 99);
  res.status(201).json({ ok: true, data: { id: info.lastInsertRowid } });
});
app.put('/api/admin/items/:id', requireAdmin, (req, res) => {
  const b = req.body || {};
  const name = String(b.name || '').trim();
  const price = parseInt(b.price, 10);
  if (!name || !price || price <= 0) return res.status(422).json({ ok: false, error: 'Name and a valid price are required.' });
  const result = db.prepare(`UPDATE menu_items SET name=?, description=?, price=?, category=?, veg=?, icon=?, available=?, sort=?
    WHERE id=?`)
    .run(name, String(b.description || '').trim(), price, String(b.category || 'Main').trim(),
         b.veg ? 1 : 0, String(b.icon || '🍽️').trim(), b.available === false ? 0 : 1, parseInt(b.sort, 10) || 99, req.params.id);
  if (!result.changes) return res.status(404).json({ ok: false, error: 'Menu item not found.' });
  res.json({ ok: true, data: { id: Number(req.params.id) } });
});
app.delete('/api/admin/items/:id', requireAdmin, (req, res) => {
  const result = db.prepare('DELETE FROM menu_items WHERE id = ?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ ok: false, error: 'Menu item not found.' });
  res.json({ ok: true, data: null });
});

/* ============================================================
   Live demo tick — orders progress automatically
============================================================ */
function tickOrders() {
  const rows = db.prepare(`SELECT id, status, history FROM orders WHERE status IN ('placed','confirmed','preparing','out_for_delivery')`).all();
  for (const r of rows) {
    const i = STATUS_FLOW.indexOf(r.status);
    const next = STATUS_FLOW[i + 1];
    if (!next) continue;
    const history = appendHistory(r, next);
    db.prepare("UPDATE orders SET status=?, history=?, updated_at=datetime('now') WHERE id=?").run(next, history, r.id);
  }
}
setInterval(tickOrders, 20000);

/* ============================================================
   Demo seed: accounts + historical orders
============================================================ */
function seedAccounts() {
  if (db.prepare('SELECT id FROM users WHERE lower(email) = ?').get(ADMIN_EMAIL)) return;
  if (!ADMIN_PASSWORD) return false;
  const ins = db.prepare('INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)');
  ins.run('Eatsy Admin', ADMIN_EMAIL, '', hashPassword(ADMIN_PASSWORD), 'admin');
  if (!isProduction && DEMO_EMAIL && DEMO_PASSWORD) {
    ins.run('Demo Customer', DEMO_EMAIL, '+91 90000 00002', hashPassword(DEMO_PASSWORD), 'user');
  }
}

function seedDemoOrders() {
  if (db.prepare('SELECT COUNT(*) c FROM orders').get().c > 0) return;
  const users = db.prepare("SELECT id FROM users WHERE role='user'").all();
  if (!users.length) return;
  const rests = db.prepare('SELECT id, name, image, delivery_time, delivery_fee FROM restaurants').all();
  const itemsByRest = {};
  db.prepare('SELECT * FROM menu_items').all().forEach(i => {
    (itemsByRest[i.restaurant_id] = itemsByRest[i.restaurant_id] || []).push(i);
  });
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const addr = ['221B Baker Street, Civil Lines', '12 MG Road, Indiranagar', '45 Lake View, Green Park', '7 Shastri Nagar, Meerut'];
  const methods = ['card', 'upi', 'cod'];
  const insert = db.prepare(`INSERT INTO orders (order_no, user_id, restaurant_id, items, subtotal, delivery_fee, tax, total,
    address, phone, note, payment_method, payment_ref, status, history, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);

  const seedAll = db.transaction(() => {
    for (let i = 0; i < 46; i++) {
      const rest = pick(rests);
      const pool = itemsByRest[rest.id] || [];
      if (!pool.length) continue;
      const chosen = [];
      for (let k = 0; k < 1 + Math.floor(Math.random() * 3); k++) {
        const it = pick(pool);
        const ex = chosen.find(c => c.itemId === it.id);
        if (ex) ex.qty += 1; else chosen.push({ itemId: it.id, name: it.name, price: it.price, icon: it.icon, veg: !!it.veg, qty: 1 + Math.floor(Math.random() * 2) });
      }
      const subtotal = chosen.reduce((s, l) => s + l.price * l.qty, 0);
      const tax = Math.round(subtotal * 0.05);
      const total = subtotal + rest.delivery_fee + tax;
      const ageH = Math.floor(Math.random() * 168) + 1;              /* 1h – 7d ago */
      const created = new Date(Date.now() - ageH * 3600e3).toISOString();
      const r = Math.random();
      const status = r < 0.62 ? 'delivered' : r < 0.78 ? 'cancelled' : r < 0.88 ? 'out_for_delivery' : r < 0.95 ? 'preparing' : 'confirmed';
      const flow = ['placed', 'confirmed', 'preparing', 'out_for_delivery'];
      const history = [];
      const at = new Date(created).getTime();
      for (let s = 0; s <= flow.indexOf(status); s++) {
        history.push({ status: flow[s], at: new Date(at + s * 25 * 60e3).toISOString() });
      }
      if (status === 'cancelled') history.push({ status: 'cancelled', at: new Date(at + 12 * 60e3).toISOString() });
      const method = pick(methods);
      const ref = { card: 'PAY-', upi: 'UPI-', cod: 'COD-' }[method] + Math.random().toString(36).slice(2, 8).toUpperCase();
      const user = pick(users);
      insert.run(
        'E' + (Date.now() - ageH * 3600e3).toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
        user.id, rest.id, JSON.stringify(chosen), subtotal, rest.delivery_fee, tax, total,
        pick(addr), '+91 98' + String(Math.floor(10000000 + Math.random() * 89999999)), '',
        method, ref, status, JSON.stringify(history), created, created
      );
    }
  });
  seedAll();
}

seedAccounts();
if (!isProduction) {
  seed();            /* restaurants + menus first */
  seedDemoOrders();
}

/* ============================================================
   SPA fallback + boot
============================================================ */
app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.use((req, res) => res.status(404).json({ ok: false, error: 'Not found.' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    ok: false,
    error: isProduction ? 'Internal server error.' : (err.message || 'Internal server error.')
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🍽️  Eatsy running on http://0.0.0.0:${PORT}`);
  console.log(`   Environment: ${isProduction ? 'production' : 'development'}`);
});
