# 🍽️ Eatsy — Online Food Ordering System

A full-stack food ordering platform: customers browse restaurants, build a cart, pay, and track orders in real time — while admins manage restaurants, menus and orders from a dedicated dashboard.

**Stack:** Node.js · Express · SQLite (better-sqlite3) · vanilla-JS SPA (no build step)
**Payment:** simulated gateway (Card with Luhn/expiry validation, UPI, Cash on Delivery)

---

## Quick start

```bash
cd food-ordering
npm install          # express + better-sqlite3
npm start            # → http://localhost:8430
```

The database (`data/eatsy.db`) is created and seeded automatically on first boot:
6 restaurants, 48 menu items, ~45 historical orders, and two accounts.

### Demo accounts

| Role     | Email             | Password  |
|----------|-------------------|-----------|
| Admin    | `admin@eatsy.in`  | `admin123`|
| Customer | `demo@eatsy.in`   | `demo123` |

> The login page has one-click "Use" buttons for both accounts.

---

## Features

### 👤 User authentication
- Register / login with **scrypt-hashed passwords** (salted, `timingSafeEqual` comparison)
- Session cookies (`httpOnly`, 7-day expiry) backed by a sessions table
- Role-based access: `user` vs `admin`, enforced server-side on every protected route

### 🏪 Restaurant & menu management
- Browse 6 seeded restaurants with cuisine filters, live search, ratings, delivery ETA & fees
- Menu grouped by category, veg/non-veg markers, per-item availability
- **Admin**: full CRUD for restaurants and menu items (add / edit / delete / hide items, toggle open status)

### 🛒 Shopping cart
- Slide-in cart drawer + full cart page, quantity steppers, single-restaurant cart rule
- Persistent in `localStorage`, totals with **GST 5%** computed client-side and re-validated server-side

### 📦 Order tracking
- Live timeline: placed → confirmed → preparing → out for delivery → delivered (or cancelled)
- Status history with timestamps, ETA banner, payment reference badge
- **Demo engine**: orders auto-advance ~every 20s so tracking feels alive; users can cancel while "placed"
- Order page polls every 6s and updates the timeline in real time

### 💳 Payment integration
- Checkout with three methods: **Card** (Luhn check, MM/YY expiry, CVV), **UPI**, **COD**
- Mock gateway: processing overlay → success screen with a generated transaction reference
- **Server-side pricing**: prices, taxes and totals are always recomputed from the DB — tampered client payloads are ignored

### 🛠️ Admin dashboard (`/#/admin`)
- Overview: today's revenue/orders, open orders, customer count, 7-day revenue chart, top sellers
- Orders: full table with inline status control (mirrors the customer's tracking instantly)
- Restaurants & menu: visual CRUD with image picker, availability toggles

---

## API reference

```
POST   /api/auth/register          { name, email, phone, password }
POST   /api/auth/login             { email, password }
POST   /api/auth/logout
GET    /api/auth/me

GET    /api/restaurants
GET    /api/restaurants/:id        (+ menu grouped by category)

POST   /api/orders                 (auth) { restaurantId, items[], address, phone, note, payment }
GET    /api/orders/mine            (auth)
GET    /api/orders/:id             (auth owner/admin)
POST   /api/orders/:id/cancel      (auth owner, status must be "placed")

GET    /api/admin/stats            (admin)
GET    /api/admin/orders?status=   (admin)
PATCH  /api/admin/orders/:id/status { status }            (admin)
POST   /api/admin/restaurants      (admin)
PUT    /api/admin/restaurants/:id  (admin)
DELETE /api/admin/restaurants/:id  (admin)
POST   /api/admin/restaurants/:id/items  (admin)
PUT    /api/admin/items/:id        (admin)
DELETE /api/admin/items/:id        (admin)
```

Order statuses: `placed · confirmed · preparing · out_for_delivery · delivered · cancelled`

---

## Project structure

```
food-ordering/
├── server.js            Express app: auth, sessions, all APIs, demo ticker
├── db.js                SQLite schema + restaurant/menu seed
├── package.json
├── data/                eatsy.db (auto-created, persists)
└── public/
    ├── index.html       SPA shell (nav, drawer, toasts, modal root)
    ├── css/style.css    design system (warm editorial theme)
    ├── img/             hero + restaurant photography
    └── js/
        ├── api.js       fetch client + session state
        ├── ui.js        toasts, modals, helpers
        ├── app.js       router, cart store, drawer
        ├── views.js     home, restaurant, cart, checkout, orders, tracking, auth
        └── admin.js     admin dashboard (4 tabs)
```

---

## Security notes (demo-grade)

- Passwords hashed with `crypto.scrypt` + per-user salt
- SQL is fully parameterized (better-sqlite3 prepared statements)
- All user-supplied strings HTML-escaped on render; API returns JSON errors
- Role checks on every admin route; order ownership enforced
- Prices/taxes recomputed server-side at order time

Not included for a production rollout: TLS termination, CSRF tokens for cookie auth, rate limiting, real payment provider integration, email verification, and password reset.

---

© 2026 Eatsy — built as a full-stack demonstration.
