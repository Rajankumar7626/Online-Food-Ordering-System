/* ============================================================
   Eatsy — database layer (better-sqlite3)
   Schema + seed data (restaurants, menus, demo orders)
============================================================ */
'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const databasePath = process.env.SQLITE_PATH
  ? path.resolve(process.env.SQLITE_PATH)
  : path.join(__dirname, 'data', 'eatsy.db');
const dir = path.dirname(databasePath);
fs.mkdirSync(dir, { recursive: true });

const db = new Database(databasePath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  phone         TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS restaurants (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  cuisine       TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  image         TEXT NOT NULL DEFAULT '',
  delivery_time INTEGER NOT NULL DEFAULT 30,
  delivery_fee  INTEGER NOT NULL DEFAULT 0,
  min_order     INTEGER NOT NULL DEFAULT 0,
  rating        REAL NOT NULL DEFAULT 4.5,
  rating_count  INTEGER NOT NULL DEFAULT 0,
  is_open       INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS menu_items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  price         INTEGER NOT NULL,
  category      TEXT NOT NULL DEFAULT 'Main',
  veg           INTEGER NOT NULL DEFAULT 1,
  icon          TEXT NOT NULL DEFAULT '🍽️',
  available     INTEGER NOT NULL DEFAULT 1,
  sort          INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS orders (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no      TEXT NOT NULL UNIQUE,
  user_id       INTEGER NOT NULL REFERENCES users(id),
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id),
  items         TEXT NOT NULL,
  subtotal      INTEGER NOT NULL,
  delivery_fee  INTEGER NOT NULL DEFAULT 0,
  tax           INTEGER NOT NULL DEFAULT 0,
  total         INTEGER NOT NULL,
  address       TEXT NOT NULL,
  phone         TEXT NOT NULL DEFAULT '',
  note          TEXT NOT NULL DEFAULT '',
  payment_method TEXT NOT NULL,
  payment_ref   TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'placed',
  history       TEXT NOT NULL DEFAULT '[]',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_orders_user   ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_menu_rest     ON menu_items(restaurant_id);
`);

/* ---------------- seed ---------------- */

const RESTAURANTS = [
  {
    name: 'Spice Route', cuisine: 'North Indian', image: '/img/rest-spice.jpg',
    description: 'Slow-cooked curries, tandoor classics and the aroma of a thousand spices — straight from the heart of Delhi.',
    delivery_time: 32, delivery_fee: 39, min_order: 199, rating: 4.7, rating_count: 2410,
    menu: [
      { name: 'Butter Chicken', category: 'Mains', price: 329, veg: 0, icon: '🍛', sort: 1, description: 'Tandoori chicken simmered in a silky tomato-butter gravy with kasuri methi.' },
      { name: 'Paneer Tikka Masala', category: 'Mains', price: 289, veg: 1, icon: '🧀', sort: 2, description: 'Charred paneer cubes in a smoky onion-tomato masala, finished with cream.' },
      { name: 'Dal Makhani', category: 'Mains', price: 249, veg: 1, icon: '🫘', sort: 3, description: 'Black lentils simmered overnight with butter and cream — a 24-hour labour of love.' },
      { name: 'Tandoori Chicken (Half)', category: 'Starters', price: 329, veg: 0, icon: '🍗', sort: 1, description: 'Yogurt-marinated chicken roasted in the clay tandoor, mint chutney on the side.' },
      { name: 'Hara Bhara Kebab', category: 'Starters', price: 219, veg: 1, icon: '🥟', sort: 2, description: 'Spinach and green-pea patties, crisp outside, melting inside.' },
      { name: 'Garlic Butter Naan', category: 'Breads', price: 79, veg: 1, icon: '🫓', sort: 1, description: 'Pillowy naan brushed with garlic butter, blistered in the tandoor.' },
      { name: 'Jeera Rice', category: 'Breads', price: 189, veg: 1, icon: '🍚', sort: 2, description: 'Basmati tossed with roasted cumin and ghee.' },
      { name: 'Mango Lassi', category: 'Beverages', price: 129, veg: 1, icon: '🥭', sort: 1, description: 'Thick, creamy yogurt shake with Alphonso mango pulp.' }
    ]
  },
  {
    name: 'Madras Mornings', cuisine: 'South Indian', image: '/img/rest-dosa.jpg',
    description: 'Crisp dosas, filter coffee and coconut chutney — a temple of South Indian comfort food.',
    delivery_time: 26, delivery_fee: 29, min_order: 149, rating: 4.5, rating_count: 1832,
    menu: [
      { name: 'Masala Dosa', category: 'Dosas', price: 159, veg: 1, icon: '🥞', sort: 1, description: 'Golden crepe stuffed with spiced potato, served with sambar and three chutneys.' },
      { name: 'Ghee Podi Dosa', category: 'Dosas', price: 179, veg: 1, icon: '✨', sort: 2, description: 'Paper dosa drizzled with ghee and dusted with fiery gunpowder podi.' },
      { name: 'Idli Sambar (3 pc)', category: 'Classics', price: 119, veg: 1, icon: '🥣', sort: 1, description: 'Steamed rice cakes dunked in piping-hot sambar.' },
      { name: 'Medu Vada (2 pc)', category: 'Classics', price: 109, veg: 1, icon: '🍩', sort: 2, description: 'Crisp, fluffy lentil doughnuts with coconut chutney.' },
      { name: 'Chettinad Chicken Curry', category: 'Mains', price: 299, veg: 0, icon: '🍗', sort: 1, description: 'Fiery black-pepper chicken from the Chettinad heartland.' },
      { name: 'Curd Rice', category: 'Mains', price: 139, veg: 1, icon: '🍚', sort: 2, description: 'Cooling yogurt rice tempered with mustard, curry leaves and ginger.' },
      { name: 'Filter Coffee', category: 'Beverages', price: 79, veg: 1, icon: '☕', sort: 1, description: 'Brewed in the traditional steel davara — frothy, strong, unapologetic.' },
      { name: 'Coconut Water', category: 'Beverages', price: 89, veg: 1, icon: '🥥', sort: 2, description: 'Chilled tender coconut, straight from the farm.' }
    ]
  },
  {
    name: 'Wok & Roll', cuisine: 'Chinese · Asian', image: '/img/rest-wok.jpg',
    description: 'Wok-tossed noodles, dumplings and fiery Indo-Chinese classics with serious wok hei.',
    delivery_time: 30, delivery_fee: 35, min_order: 179, rating: 4.4, rating_count: 1567,
    menu: [
      { name: 'Chilli Garlic Noodles', category: 'Noodles & Rice', price: 219, veg: 1, icon: '🍜', sort: 1, description: 'Hand-pulled noodles wok-tossed with garlic, chilli and spring onion.' },
      { name: 'Chicken Fried Rice', category: 'Noodles & Rice', price: 249, veg: 0, icon: '🍚', sort: 2, description: 'Smoky jasmine rice tossed with egg, chicken and wok vegetables.' },
      { name: 'Veg Hakka Noodles', category: 'Noodles & Rice', price: 199, veg: 1, icon: '🥬', sort: 3, description: 'A classic — crunchy vegetables, soy and a whiff of sesame oil.' },
      { name: 'Chicken Momos (8 pc)', category: 'Dumplings', price: 229, veg: 0, icon: '🥟', sort: 1, description: 'Steamed to order, served with fiery red chutney.' },
      { name: 'Veg Steam Momos (8 pc)', category: 'Dumplings', price: 189, veg: 1, icon: '🥟', sort: 2, description: 'Delicate parcels of cabbage, carrot and spring onion.' },
      { name: 'Chilli Chicken (Dry)', category: 'Starters', price: 289, veg: 0, icon: '🌶️', sort: 1, description: 'Crispy chicken tossed in a glossy soy-chilli glaze.' },
      { name: 'Manchow Soup', category: 'Starters', price: 149, veg: 1, icon: '🥣', sort: 2, description: 'Peppery vegetable soup crowned with golden fried noodles.' },
      { name: 'Honey Chilli Potato', category: 'Starters', price: 199, veg: 1, icon: '🍟', sort: 3, description: 'Crackling potato fingers in a sweet-spicy honey glaze.' }
    ]
  },
  {
    name: 'Flame & Bun', cuisine: 'Burgers · American', image: '/img/rest-burger.jpg',
    description: 'Smash burgers, loaded fries and milkshakes. Charred, juicy, unapologetically messy.',
    delivery_time: 24, delivery_fee: 49, min_order: 249, rating: 4.6, rating_count: 2094,
    menu: [
      { name: 'Classic Smash Burger', category: 'Burgers', price: 259, veg: 0, icon: '🍔', sort: 1, description: 'Double smashed patty, American cheese, house sauce, pickles, brioche.' },
      { name: 'Flame Veggie Burger', category: 'Burgers', price: 209, veg: 1, icon: '🍔', sort: 2, description: 'Charred corn-pea patty with smoked chipotle mayo.' },
      { name: 'Chicken BBQ Burger', category: 'Burgers', price: 279, veg: 0, icon: '🍔', sort: 3, description: 'Grilled chicken thigh, smoky BBQ glaze, slaw, toasted brioche.' },
      { name: 'Peri-Peri Fries', category: 'Sides', price: 149, veg: 1, icon: '🍟', sort: 1, description: 'Crispy fries dusted with fiery peri-peri seasoning.' },
      { name: 'Loaded Cheese Fries', category: 'Sides', price: 199, veg: 1, icon: '🧀', sort: 2, description: 'Fries buried under molten cheese sauce and jalapeños.' },
      { name: 'Chicken Wings (6 pc)', category: 'Sides', price: 269, veg: 0, icon: '🍗', sort: 3, description: 'Sticky buffalo glaze, buttermilk ranch on the side.' },
      { name: 'Oreo Thickshake', category: 'Beverages', price: 199, veg: 1, icon: '🥤', sort: 1, description: 'Biscoff-level indulgence — Oreo blended into vanilla ice cream.' },
      { name: 'Cold Coffee', category: 'Beverages', price: 159, veg: 1, icon: '🧋', sort: 2, description: 'Brewed strong, shaken with ice and a crown of cream.' }
    ]
  },
  {
    name: 'Napoli Slice', cuisine: 'Pizza · Italian', image: '/img/rest-pizza.jpg',
    description: 'Wood-fired Neapolitan pizzas with 48-hour dough and San Marzano tomatoes.',
    delivery_time: 34, delivery_fee: 45, min_order: 299, rating: 4.8, rating_count: 3120,
    menu: [
      { name: 'Margherita', category: 'Pizzas', price: 299, veg: 1, icon: '🍕', sort: 1, description: 'San Marzano, fior di latte, fresh basil, olive oil. The benchmark.' },
      { name: 'Pepperoni Classic', category: 'Pizzas', price: 399, veg: 0, icon: '🍕', sort: 2, description: 'Cups of crispy pepperoni over bubbling mozzarella.' },
      { name: 'Farmhouse Veg', category: 'Pizzas', price: 349, veg: 1, icon: '🍕', sort: 3, description: 'Bell peppers, mushrooms, onions, sweet corn and olives.' },
      { name: 'Truffle Mushroom', category: 'Pizzas', price: 449, veg: 1, icon: '🍄', sort: 4, description: 'Roasted mushrooms, truffle cream, thyme, parmesan.' },
      { name: 'Garlic Breadsticks', category: 'Sides', price: 179, veg: 1, icon: '🥖', sort: 1, description: 'Golden sticks of pizza dough, garlic butter, marinara dip.' },
      { name: 'Chicken Wings (BBQ)', category: 'Sides', price: 289, veg: 0, icon: '🍗', sort: 2, description: 'Smoky BBQ-glazed wings with ranch.' },
      { name: 'Tiramisu', category: 'Desserts', price: 219, veg: 1, icon: '🍰', sort: 1, description: 'Espresso-soaked ladyfingers, mascarpone, cocoa dust.' },
      { name: 'Choco Lava Cake', category: 'Desserts', price: 159, veg: 1, icon: '🍫', sort: 2, description: 'Warm cake with a river of molten dark chocolate.' }
    ]
  },
  {
    name: 'Sugar Rush', cuisine: 'Desserts · Cafe', image: '/img/rest-dessert.jpg',
    description: 'Pastries, shakes and indulgent desserts for every sweet tooth — and the ones pretending not to have one.',
    delivery_time: 22, delivery_fee: 25, min_order: 99, rating: 4.5, rating_count: 998,
    menu: [
      { name: 'Belgian Chocolate Brownie', category: 'Bakes', price: 149, veg: 1, icon: '🍫', sort: 1, description: 'Fudgy brownie with a molten centre, walnut crunch.' },
      { name: 'Red Velvet Slice', category: 'Bakes', price: 179, veg: 1, icon: '🍰', sort: 2, description: 'Velvet crumb, cream-cheese frosting, cocoa dust.' },
      { name: 'Blueberry Cheesecake', category: 'Bakes', price: 219, veg: 1, icon: '🍰', sort: 3, description: 'Baked NY-style cheesecake with blueberry compote.' },
      { name: 'Gulab Jamun Cheesecake', category: 'Bakes', price: 229, veg: 1, icon: '🍮', sort: 4, description: 'Our signature — fusion of two desserts in one slice.' },
      { name: 'Ferrero Rocher Shake', category: 'Shakes', price: 219, veg: 1, icon: '🥤', sort: 1, description: 'Chocolate-hazelnut shake crowned with crushed Rocher.' },
      { name: 'Cold Coffee Frappe', category: 'Shakes', price: 169, veg: 1, icon: '🧋', sort: 2, description: 'Blended, iced, and topped with whipped cream.' },
      { name: 'Hot Chocolate', category: 'Beverages', price: 139, veg: 1, icon: '☕', sort: 1, description: 'Belgian couverture, steamed milk, marshmallows.' },
      { name: 'Masala Chai', category: 'Beverages', price: 79, veg: 1, icon: '🫖', sort: 2, description: 'Kadak chai brewed with ginger and cardamom.' }
    ]
  }
];

function seed() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM restaurants').get().c;
  if (count > 0) return false;

  const insRest = db.prepare(`INSERT INTO restaurants
    (name, cuisine, description, image, delivery_time, delivery_fee, min_order, rating, rating_count)
    VALUES (@name, @cuisine, @description, @image, @delivery_time, @delivery_fee, @min_order, @rating, @rating_count)`);
  const insItem = db.prepare(`INSERT INTO menu_items
    (restaurant_id, name, description, price, category, veg, icon, sort)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);

  const seedAll = db.transaction(() => {
    RESTAURANTS.forEach(r => {
      const { menu, ...rest } = r;
      const info = insRest.run(rest);
      menu.forEach(m => insItem.run(info.lastInsertRowid, m.name, m.description, m.price, m.category, m.veg, m.icon, m.sort));
    });
  });
  seedAll();
  return true;
}

module.exports = { db, seed };
