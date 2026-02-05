-- SQLite Dump generato automaticamente
-- Data: 2026-01-19T10:58:37.833Z

PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;

-- Tabella: sessions
DROP TABLE IF EXISTS sessions;
CREATE TABLE IF NOT EXISTS sessions (sid PRIMARY KEY, expired, sess);

-- Dati per: sessions
INSERT INTO sessions (sid, expired, sess) VALUES ('V3fzfMRE_dEEI-JxcXePojn56na4q_KI', 1768827262432, '{"cookie":{"originalMaxAge":7200000,"expires":"2026-01-19T12:53:56.249Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":2},"rememberMe":false}');

-- Tabella: email_reminders
DROP TABLE IF EXISTS email_reminders;
CREATE TABLE IF NOT EXISTS email_reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reminder_type TEXT NOT NULL,   -- 'birthday-1m'
      user_id INTEGER NOT NULL,
      child_id INTEGER NOT NULL,
      target_date TEXT NOT NULL,     -- YYYY-MM-DD del compleanno in quell'anno
      sent_at TEXT NOT NULL,
      UNIQUE(reminder_type, child_id, target_date)
    );

-- Dati per: email_reminders
INSERT INTO email_reminders (id, reminder_type, user_id, child_id, target_date, sent_at) VALUES (1, 'birthday-1m', 1, 6, '2025-11-15', '2025-10-15 14:33:03');
INSERT INTO email_reminders (id, reminder_type, user_id, child_id, target_date, sent_at) VALUES (2, 'birthday-1m', 1, 7, '2025-11-15', '2025-10-15 14:40:23');
INSERT INTO email_reminders (id, reminder_type, user_id, child_id, target_date, sent_at) VALUES (3, 'birthday-1m', 1, 8, '2025-11-15', '2025-10-15 14:46:51');
INSERT INTO email_reminders (id, reminder_type, user_id, child_id, target_date, sent_at) VALUES (4, 'birthday-1m', 1, 9, '2025-11-15', '2025-10-15 14:50:08');
INSERT INTO email_reminders (id, reminder_type, user_id, child_id, target_date, sent_at) VALUES (5, 'birthday-1m', 1, 10, '2025-11-15', '2025-10-15 15:27:39');
INSERT INTO email_reminders (id, reminder_type, user_id, child_id, target_date, sent_at) VALUES (6, 'birthday-1m', 1, 11, '2025-11-15', '2025-10-15 15:30:30');
INSERT INTO email_reminders (id, reminder_type, user_id, child_id, target_date, sent_at) VALUES (7, 'birthday-1m', 1, 12, '2025-11-15', '2025-10-15 15:32:08');
INSERT INTO email_reminders (id, reminder_type, user_id, child_id, target_date, sent_at) VALUES (8, 'birthday-1m', 1, 13, '2025-11-15', '2025-10-15 15:33:48');
INSERT INTO email_reminders (id, reminder_type, user_id, child_id, target_date, sent_at) VALUES (9, 'birthday-1m', 1, 14, '2025-11-15', '2025-10-15 15:34:44');
INSERT INTO email_reminders (id, reminder_type, user_id, child_id, target_date, sent_at) VALUES (10, 'birthday-1m', 1, 15, '2025-11-15', '2025-10-15 15:36:55');
INSERT INTO email_reminders (id, reminder_type, user_id, child_id, target_date, sent_at) VALUES (11, 'birthday-1m', 1, 16, '2025-11-15', '2025-10-15 15:38:01');
INSERT INTO email_reminders (id, reminder_type, user_id, child_id, target_date, sent_at) VALUES (12, 'birthday-1m', 1, 17, '2025-11-15', '2025-10-15 15:39:41');
INSERT INTO email_reminders (id, reminder_type, user_id, child_id, target_date, sent_at) VALUES (13, 'birthday-1m', 2, 18, '2025-11-16', '2025-10-16 09:07:29');
INSERT INTO email_reminders (id, reminder_type, user_id, child_id, target_date, sent_at) VALUES (14, 'birthday-1m', 6, 19, '2025-11-16', '2025-10-16 09:31:26');
INSERT INTO email_reminders (id, reminder_type, user_id, child_id, target_date, sent_at) VALUES (15, 'birthday-1m', 1, 3, '2025-11-17', '2025-10-17 09:44:03');
INSERT INTO email_reminders (id, reminder_type, user_id, child_id, target_date, sent_at) VALUES (16, 'birthday-1m', 1, 6, '2025-11-28', '2025-10-28 21:10:14');
INSERT INTO email_reminders (id, reminder_type, user_id, child_id, target_date, sent_at) VALUES (17, 'birthday-1m', 1, 7, '2025-12-11', '2025-11-11 14:39:05');
INSERT INTO email_reminders (id, reminder_type, user_id, child_id, target_date, sent_at) VALUES (18, 'birthday-1m', 1, 8, '2025-12-11', '2025-11-11 14:40:18');
INSERT INTO email_reminders (id, reminder_type, user_id, child_id, target_date, sent_at) VALUES (19, 'birthday-1m', 2, 10, '2025-12-11', '2025-11-11 15:06:03');
INSERT INTO email_reminders (id, reminder_type, user_id, child_id, target_date, sent_at) VALUES (20, 'birthday-1m', 2, 11, '2025-12-11', '2025-11-11 15:10:34');
INSERT INTO email_reminders (id, reminder_type, user_id, child_id, target_date, sent_at) VALUES (21, 'birthday-1m', 2, 12, '2025-12-11', '2025-11-11 15:14:16');
INSERT INTO email_reminders (id, reminder_type, user_id, child_id, target_date, sent_at) VALUES (22, 'birthday-1m', 2, 13, '2025-12-11', '2025-11-11 15:14:53');
INSERT INTO email_reminders (id, reminder_type, user_id, child_id, target_date, sent_at) VALUES (23, 'birthday-1m', 2, 15, '2025-12-11', '2025-11-11 15:15:44');
INSERT INTO email_reminders (id, reminder_type, user_id, child_id, target_date, sent_at) VALUES (24, 'birthday-1m', 3, 3, '2026-02-14', '2026-01-13 23:00:09');

-- Tabella: users
DROP TABLE IF EXISTS users;
CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT,
      last_name  TEXT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      city TEXT,
      cap TEXT,
      address TEXT,
      role TEXT NOT NULL DEFAULT 'user', -- 'user' | 'admin'
      birthday TEXT,
      phone TEXT,
      reset_token TEXT,
      reset_expires INTEGER
    );

-- Dati per: users
INSERT INTO users (id, first_name, last_name, email, password_hash, city, cap, address, role, birthday, phone, reset_token, reset_expires) VALUES (1, 'Mario', 'Rossi', 'test@example.com', '$2b$10$fa3e8nYmo/89Q.5vmgwPNOQGG0UIscMOHp6q/gECdmf2O028lI6uO', 'Padova', '35100', 'Via Roma 1', 'user', NULL, '3401234567', NULL, NULL);
INSERT INTO users (id, first_name, last_name, email, password_hash, city, cap, address, role, birthday, phone, reset_token, reset_expires) VALUES (2, 'Admin', 'Site', 'admin@example.com', '$2b$10$YZEzZhd0qQOUFMnq1ex1aOKEKggHWUnQE62PnrQj.C55yv6JUU5YC', 'Padova', '35100', 'Via Verdi 2', 'admin', NULL, '3494321239', NULL, NULL);
INSERT INTO users (id, first_name, last_name, email, password_hash, city, cap, address, role, birthday, phone, reset_token, reset_expires) VALUES (3, 'Lucia', 'Bianchi', 'lucia@example.com', '$2b$10$fa3e8nYmo/89Q.5vmgwPNOQGG0UIscMOHp6q/gECdmf2O028lI6uO', 'Venezia', '30100', 'Calle Lunga 42', 'user', NULL, '3339876543', NULL, NULL);
INSERT INTO users (id, first_name, last_name, email, password_hash, city, cap, address, role, birthday, phone, reset_token, reset_expires) VALUES (4, 'Marco', 'Verdi', 'marco@example.com', '$2b$10$fa3e8nYmo/89Q.5vmgwPNOQGG0UIscMOHp6q/gECdmf2O028lI6uO', 'Treviso', '31100', 'Piazza dei Signori 5', 'user', NULL, '3201122334', NULL, NULL);
INSERT INTO users (id, first_name, last_name, email, password_hash, city, cap, address, role, birthday, phone, reset_token, reset_expires) VALUES (5, 'Sara', 'Neri', 'sara@example.com', '$2b$10$fa3e8nYmo/89Q.5vmgwPNOQGG0UIscMOHp6q/gECdmf2O028lI6uO', 'Vicenza', '36100', 'Corso Palladio 10', 'user', NULL, '3475566778', NULL, NULL);

-- Tabella: addresses
DROP TABLE IF EXISTS addresses;
CREATE TABLE IF NOT EXISTS addresses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      label TEXT,
      city TEXT NOT NULL,
      cap TEXT NOT NULL,
      address TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

-- Dati per: addresses
INSERT INTO addresses (id, user_id, label, city, cap, address, created_at) VALUES (1, 1, 'Casa', 'Padova', '35100', 'Via Roma 1', '2026-01-19 10:58:34');
INSERT INTO addresses (id, user_id, label, city, cap, address, created_at) VALUES (2, 1, 'Casa al mare', 'Jesolo', '30016', 'Via Bafile 20', '2026-01-19 10:58:34');
INSERT INTO addresses (id, user_id, label, city, cap, address, created_at) VALUES (3, 1, 'Ufficio', 'Mestre', '30170', 'Via Torino 15', '2026-01-19 10:58:34');
INSERT INTO addresses (id, user_id, label, city, cap, address, created_at) VALUES (4, 3, 'Casa', 'Venezia', '30100', 'Calle Lunga 42', '2026-01-19 10:58:34');
INSERT INTO addresses (id, user_id, label, city, cap, address, created_at) VALUES (5, 3, 'Casa Genitori', 'Mirano', '30035', 'Via della Vittoria 8', '2026-01-19 10:58:34');
INSERT INTO addresses (id, user_id, label, city, cap, address, created_at) VALUES (6, 4, 'Casa', 'Treviso', '31100', 'Piazza dei Signori 5', '2026-01-19 10:58:34');

-- Tabella: items
DROP TABLE IF EXISTS items;
CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price_per_day REAL NOT NULL,
      image_url TEXT,
      is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1))
    );

-- Dati per: items
INSERT INTO items (id, name, description, price_per_day, image_url, is_active) VALUES (1, 'Gonfiabile George', 'Divertiti con la scimmietta George dei cartoni animati!', 100, '/img/gonfiabili/george.jpg', 1);
INSERT INTO items (id, name, description, price_per_day, image_url, is_active) VALUES (2, 'Gonfiabile Alvin', 'I tuoi figli adoreranno questo gonfiabile, con Alvin e suoi amichetti!', 150, '/img/gonfiabili/alvin.jpg', 1);
INSERT INTO items (id, name, description, price_per_day, image_url, is_active) VALUES (3, 'Gonfiabile Peppa Pig', 'Area salta-salta recintata con scivolo, ideale per i più piccoli.', 80, '/img/gonfiabili/peppapig.jpg', 1);
INSERT INTO items (id, name, description, price_per_day, image_url, is_active) VALUES (4, 'Gonfiabile Winx', 'Gonfiabile perfetto per le tue bambine, falle divertire con le loro fate preferite!', 180, '/img/gonfiabili/winx.jpg', 1);
INSERT INTO items (id, name, description, price_per_day, image_url, is_active) VALUES (5, 'Gonfiabile LadyBug', 'Gonfiabile con vasca palline integrata. Divertimento colorato.', 90, '/img/gonfiabili/ladybug.jpg', 1);
INSERT INTO items (id, name, description, price_per_day, image_url, is_active) VALUES (6, 'Gonfiabile Vampirina', 'Edizione speciale spaventosa! Disponibile solo a Ottobre.', 130, '/img/gonfiabili/vampirina.jpg', 0);

-- Tabella: favorites
DROP TABLE IF EXISTS favorites;
CREATE TABLE IF NOT EXISTS favorites (
      user_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      PRIMARY KEY (user_id, item_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
    );

-- Dati per: favorites
INSERT INTO favorites (user_id, item_id) VALUES (1, 1);
INSERT INTO favorites (user_id, item_id) VALUES (3, 3);
INSERT INTO favorites (user_id, item_id) VALUES (4, 2);

-- Tabella: bookings
DROP TABLE IF EXISTS bookings;
CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      shipping_address TEXT,
      date_from TEXT NOT NULL,
      date_to   TEXT NOT NULL,
      coupon_code TEXT,
      unit_price REAL NOT NULL,
      discount_percent INTEGER NOT NULL DEFAULT 0,
      final_price REAL NOT NULL,
      
      -- NUOVE COLONNE PAGAMENTO
      payment_method TEXT, -- 'credit_card', 'paypal', 'cash'
      payment_status TEXT DEFAULT 'unpaid', -- 'paid', 'unpaid'

      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','rejected','cancelled','finished')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
    );

-- Dati per: bookings
INSERT INTO bookings (id, user_id, item_id, shipping_address, date_from, date_to, coupon_code, unit_price, discount_percent, final_price, payment_method, payment_status, status, created_at, updated_at) VALUES (1, 1, 1, 'Via Roma 1, Padova', '2026-01-09', '2026-01-11', NULL, 100, 0, 300, 'credit_card', 'paid', 'finished', '2026-01-04', '2026-01-19 10:58:34');
INSERT INTO bookings (id, user_id, item_id, shipping_address, date_from, date_to, coupon_code, unit_price, discount_percent, final_price, payment_method, payment_status, status, created_at, updated_at) VALUES (2, 1, 2, 'Via Bafile 20, Jesolo', '2026-01-29', '2026-01-31', NULL, 150, 0, 450, 'paypal', 'paid', 'confirmed', '2026-01-17', '2026-01-19 10:58:34');
INSERT INTO bookings (id, user_id, item_id, shipping_address, date_from, date_to, coupon_code, unit_price, discount_percent, final_price, payment_method, payment_status, status, created_at, updated_at) VALUES (3, 3, 3, 'Calle Lunga 42, Venezia', '2026-01-24', '2026-01-25', NULL, 80, 0, 160, 'cash', 'unpaid', 'pending', '2026-01-18', '2026-01-19 10:58:34');
INSERT INTO bookings (id, user_id, item_id, shipping_address, date_from, date_to, coupon_code, unit_price, discount_percent, final_price, payment_method, payment_status, status, created_at, updated_at) VALUES (4, 3, 4, 'Calle Lunga 42, Venezia', '2025-12-30', '2025-12-31', NULL, 180, 0, 360, 'credit_card', 'paid', 'cancelled', '2025-12-25', '2026-01-19 10:58:34');
INSERT INTO bookings (id, user_id, item_id, shipping_address, date_from, date_to, coupon_code, unit_price, discount_percent, final_price, payment_method, payment_status, status, created_at, updated_at) VALUES (5, 4, 2, 'Piazza dei Signori 5, Treviso', '2025-12-10', '2025-12-12', NULL, 150, 0, 450, 'paypal', 'paid', 'finished', '2025-12-05', '2026-01-19 10:58:34');
INSERT INTO bookings (id, user_id, item_id, shipping_address, date_from, date_to, coupon_code, unit_price, discount_percent, final_price, payment_method, payment_status, status, created_at, updated_at) VALUES (6, 4, 4, 'Piazza dei Signori 5, Treviso', '2026-01-14', '2026-01-15', NULL, 180, 0, 360, 'cash', 'paid', 'finished', '2026-01-09', '2026-01-19 10:58:34');

-- Tabella: children
DROP TABLE IF EXISTS children;
CREATE TABLE IF NOT EXISTS children (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      birthday TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

-- Dati per: children
INSERT INTO children (id, user_id, name, birthday, created_at) VALUES (1, 1, 'Giulia', '2018-05-12', '2026-01-19 10:58:34');
INSERT INTO children (id, user_id, name, birthday, created_at) VALUES (2, 1, 'Luca', '2020-11-03', '2026-01-19 10:58:34');
INSERT INTO children (id, user_id, name, birthday, created_at) VALUES (3, 3, 'Sofia', '2019-02-14', '2026-01-19 10:58:34');
INSERT INTO children (id, user_id, name, birthday, created_at) VALUES (4, 3, 'Matteo', '2021-08-20', '2026-01-19 10:58:34');
INSERT INTO children (id, user_id, name, birthday, created_at) VALUES (5, 4, 'Chiara', '2015-06-30', '2026-01-19 10:58:34');

-- Tabella: loyalty_vouchers
DROP TABLE IF EXISTS loyalty_vouchers;
CREATE TABLE IF NOT EXISTS loyalty_vouchers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      code TEXT NOT NULL UNIQUE,
      discount_percent INTEGER NOT NULL DEFAULT 10,
      status TEXT NOT NULL DEFAULT 'available',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NULL,
      used_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

-- Tabella: coupon_redemptions
DROP TABLE IF EXISTS coupon_redemptions;
CREATE TABLE IF NOT EXISTS coupon_redemptions (
      id INTEGER PRIMARY KEY,
      voucher_id INTEGER NOT NULL UNIQUE,
      order_id INTEGER NOT NULL,
      redeemed_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (voucher_id) REFERENCES loyalty_vouchers(id) ON DELETE CASCADE
    );

-- Tabella: coupons
DROP TABLE IF EXISTS coupons;
CREATE TABLE IF NOT EXISTS coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      discount_percent INTEGER NOT NULL CHECK (discount_percent BETWEEN 1 AND 100),
      starts_at TEXT,
      expires_at TEXT,
      is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1))
    );

-- Dati per: coupons
INSERT INTO coupons (id, code, discount_percent, starts_at, expires_at, is_active) VALUES (1, 'FESTA10', 10, '2025-12-20', '2026-07-18', 1);
INSERT INTO coupons (id, code, discount_percent, starts_at, expires_at, is_active) VALUES (2, 'SUPER20', 20, '2026-01-09', '2026-02-18', 1);
INSERT INTO coupons (id, code, discount_percent, starts_at, expires_at, is_active) VALUES (3, 'SCADUTO', 15, '2025-11-20', '2026-01-18', 1);
INSERT INTO coupons (id, code, discount_percent, starts_at, expires_at, is_active) VALUES (4, 'ESTATE25', 25, '2026-03-20', '2026-05-19', 1);

-- Tabella: newsletter_subscriptions
DROP TABLE IF EXISTS newsletter_subscriptions;
CREATE TABLE IF NOT EXISTS newsletter_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      email TEXT NOT NULL UNIQUE,
      is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
      subscribed_at TEXT DEFAULT CURRENT_TIMESTAMP,
      unsubscribed_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

-- Dati per: newsletter_subscriptions
INSERT INTO newsletter_subscriptions (id, user_id, email, is_active, subscribed_at, unsubscribed_at) VALUES (1, 1, 'test@example.com', 1, '2026-01-19 10:58:34', NULL);
INSERT INTO newsletter_subscriptions (id, user_id, email, is_active, subscribed_at, unsubscribed_at) VALUES (2, 3, 'lucia@example.com', 1, '2026-01-19 10:58:34', NULL);
INSERT INTO newsletter_subscriptions (id, user_id, email, is_active, subscribed_at, unsubscribed_at) VALUES (3, NULL, 'anonimo@gmail.com', 1, '2026-01-19 10:58:34', NULL);
INSERT INTO newsletter_subscriptions (id, user_id, email, is_active, subscribed_at, unsubscribed_at) VALUES (4, NULL, 'fan@hotmail.it', 1, '2026-01-19 10:58:34', NULL);
INSERT INTO newsletter_subscriptions (id, user_id, email, is_active, subscribed_at, unsubscribed_at) VALUES (5, 4, 'marco@example.com', 0, '2026-01-19 10:58:34', NULL);

-- Tabella: reviews
DROP TABLE IF EXISTS reviews;
CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
      comment TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      is_approved INTEGER NOT NULL DEFAULT 0 CHECK(is_approved IN (0,1)),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
    );

-- Dati per: reviews
INSERT INTO reviews (id, user_id, item_id, rating, comment, created_at, is_approved) VALUES (1, 1, 1, 5, 'Fantastico! I miei figli lo hanno adorato. Servizio puntuale.', '2026-01-12', 1);
INSERT INTO reviews (id, user_id, item_id, rating, comment, created_at, is_approved) VALUES (2, 4, 2, 4, 'Bello ma un po’ difficile da montare se non si ha spazio.', '2026-01-16', 1);
INSERT INTO reviews (id, user_id, item_id, rating, comment, created_at, is_approved) VALUES (3, 4, 4, 5, 'Consigliatissimo per feste numerose!', '2026-01-18', 0);
INSERT INTO reviews (id, user_id, item_id, rating, comment, created_at, is_approved) VALUES (4, 3, 3, 2, 'Purtroppo è arrivato un po’ sporco.', '2026-01-19', 0);

-- Tabella: posts
DROP TABLE IF EXISTS posts;
CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      image_url TEXT,
      author TEXT DEFAULT 'Admin',
      is_published INTEGER NOT NULL DEFAULT 1 CHECK(is_published IN (0,1)),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

COMMIT;
