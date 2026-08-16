# 🍽️ Eatsy — Online Food Ordering System

A full-stack food ordering platform built with **Node.js**, **Express**, and **SQLite**. Customers can browse restaurants, build a cart, place orders, and track delivery in real-time — while admins manage restaurants, menus, and orders from a dedicated dashboard.

## ✨ Features

### 👤 User Authentication & Authorization
- **Secure Authentication**: Scrypt-hashed passwords with salt and `timingSafeEqual` comparison
- **Session Management**: HTTPOnly cookies with 7-day expiry, backed by database sessions table
- **Role-Based Access Control**: User vs Admin roles, enforced server-side on all protected routes

### 🏪 Restaurant & Menu Management
- Browse 6+ restaurants with:
  - Cuisine filters and live search
  - Restaurant ratings, delivery time & fees
  - Min order amount validation
- **Admin Dashboard**: Full CRUD for:
  - Restaurants (add/edit/delete)
  - Menu items with category grouping
  - Veg/non-veg markers
  - Item availability toggle
  - Restaurant open/close status

### 🛒 Shopping Cart
- Slide-in cart drawer + full cart page
- Quantity steppers and item removal
- **Single-restaurant cart rule**: Prevents mixing items from different restaurants
- **Persistent storage**: Cart saved in localStorage
- **Tax calculation**: GST 5% computed client-side and re-validated server-side

### 📦 Order Management
- **Order Lifecycle**: Placed → Confirmed → Preparing → Out for Delivery → Delivered
- Status history with timestamps
- Real-time ETA updates
- Payment reference badge
- Cancel order option before confirmation

### 💳 Payment Gateway (Simulated)
- **Credit/Debit Card**: Luhn algorithm validation, expiry date verification
- **UPI**: Indian payment method support
- **Cash on Delivery (COD)**: Pay at doorstep option
- Order total with delivery fee calculation

### 📊 Admin Features
- Dashboard with order analytics
- Restaurant performance metrics
- Menu management interface
- Order fulfillment tracking
- Customer feedback & ratings

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Node.js (v18+), Express.js |
| **Database** | SQLite (better-sqlite3 with WAL mode) |
| **Frontend** | Vanilla JavaScript (no build step) |
| **Authentication** | Scrypt hashing, JWT-style sessions |
| **Payment** | Mock gateway with validation |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18 or higher
- npm

### Installation & Running

```bash
# 1. Navigate to project directory
cd food-ordering

# 2. Install dependencies
npm install

# 3. Start the server
npm start

# Server runs on http://localhost:8430
```

The database (`data/eatsy.db`) is **automatically created and seeded** on first boot with:
- 6 restaurants with menus
- 48 sample menu items
- ~45 historical demo orders
- 2 pre-configured demo accounts

---

## 👥 Demo Accounts

Quick access buttons available on login page:

| Role | Email | Password |
|------|-------|----------|
| **Admin** | `admin@eatsy.in` | `admin123` |
| **Customer** | `demo@eatsy.in` | `demo123` |

---

## 📁 Project Structure

```
food-ordering/
├── server.js              # Express server + API endpoints
├── db.js                  # Database schema + seed data
├── package.json           # Dependencies
├── data/
│   └── eatsy.db          # SQLite database (auto-created)
├── public/
│   ├── index.html        # Single Page App shell
│   ├── css/
│   │   └── style.css     # Global styles
│   ├── js/
│   │   ├── app.js        # SPA initialization & routing
│   │   ├── api.js        # API client functions
│   │   ├── views.js      # View components & rendering
│   │   ├── ui.js         # UI interactions & DOM manipulation
│   │   └── admin.js      # Admin dashboard logic
│   └── img/              # Restaurant & food images
└── README.md
```

---

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` — Create new user account
- `POST /api/auth/login` — User login
- `POST /api/auth/logout` — Clear session

### Restaurants
- `GET /api/restaurants` — List all restaurants
- `GET /api/restaurants/:id` — Get restaurant details
- `POST /api/restaurants` — Create (Admin only)
- `PUT /api/restaurants/:id` — Update (Admin only)
- `DELETE /api/restaurants/:id` — Delete (Admin only)

### Menu Items
- `GET /api/restaurants/:id/menu` — Get restaurant menu
- `POST /api/menu` — Add menu item (Admin only)
- `PUT /api/menu/:id` — Update menu item (Admin only)
- `DELETE /api/menu/:id` — Delete menu item (Admin only)

### Orders
- `GET /api/orders` — Get user's orders
- `POST /api/orders` — Place new order
- `GET /api/orders/:id` — Order details
- `PATCH /api/orders/:id/status` — Update order status (Admin only)
- `POST /api/orders/:id/cancel` — Cancel order

### Dashboard (Admin)
- `GET /api/admin/dashboard` — Analytics & metrics

---

## 🗄️ Database Schema

### Users Table
- ID, name, email, phone, password_hash, role, created_at

### Sessions Table
- token (primary key), user_id, expires_at, created_at

### Restaurants Table
- id, name, cuisine, description, image, delivery_time, delivery_fee, min_order, rating, is_open, created_at

### Menu Items Table
- id, restaurant_id, name, description, price, category, is_veg, is_available, created_at

### Orders Table
- id, user_id, restaurant_id, status, total, delivery_fee, payment_method, created_at, updated_at

### Order Items Table
- id, order_id, menu_item_id, quantity, price_at_order, created_at

---

## 🔒 Security Features

✅ **Password Security**: Scrypt hashing with random salt
✅ **Session Management**: HTTPOnly cookies, automatic expiry
✅ **Input Validation**: Server-side validation on all inputs
✅ **CSRF Protection**: Token-based validation
✅ **SQL Injection Prevention**: Prepared statements (better-sqlite3)
✅ **Cart Validation**: Server-side cart integrity checks
✅ **Payment Validation**: Luhn algorithm, expiry verification

---

## 🎯 Future Enhancements

- [ ] Real payment gateway integration (Stripe, Razorpay)
- [ ] Email notifications for order status
- [ ] SMS updates for delivery
- [ ] User reviews and ratings
- [ ] Loyalty points program
- [ ] Multiple payment methods per user
- [ ] Promotional codes and discounts
- [ ] Location-based restaurant suggestions
- [ ] Real-time order tracking with map integration
- [ ] Mobile app (React Native)

---

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 👨‍💻 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 🆘 Support

For issues, questions, or suggestions, please:
- Open an issue on GitHub
- Contact the development team

---

**Made with ❤️ by the Eatsy Team**