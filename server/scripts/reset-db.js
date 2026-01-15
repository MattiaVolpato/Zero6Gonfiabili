// server/scripts/reset-db.js
import { getDB } from "../config/db.js";
import bcrypt from "bcrypt";

const db = await getDB();

try {
  // Spegni FK
  await db.exec("PRAGMA foreign_keys = OFF;");

  // NOTA: Rimossi BEGIN, COMMIT e ROLLBACK per evitare l'errore "transaction within a transaction"

  // ---- DROP: ELIMINA TABELLE VECCHIE ----
  await db.exec(`
    DROP TABLE IF EXISTS coupon_redemptions;
    DROP TABLE IF EXISTS loyalty_vouchers;
    DROP TABLE IF EXISTS reviews;
    DROP TABLE IF EXISTS newsletter_subscriptions;
    DROP TABLE IF EXISTS coupons;
    DROP TABLE IF EXISTS children;
    DROP TABLE IF EXISTS bookings;
    DROP TABLE IF EXISTS favorites;
    DROP TABLE IF EXISTS items;
    DROP TABLE IF EXISTS users;
    DROP TABLE IF EXISTS addresses;
    DROP TABLE IF EXISTS posts;
  `);

  // ---- CREATE: CREA TABELLE NUOVE ----
  await db.exec(`
    CREATE TABLE users (
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

    CREATE TABLE addresses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      label TEXT,
      city TEXT NOT NULL,
      cap TEXT NOT NULL,
      address TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price_per_day REAL NOT NULL,
      image_url TEXT,
      is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1))
    );

    CREATE TABLE favorites (
      user_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      PRIMARY KEY (user_id, item_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
    );

    CREATE TABLE bookings (
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

    CREATE INDEX IF NOT EXISTS idx_bookings_item_dates ON bookings(item_id, date_from, date_to, status);
    CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id, created_at DESC);

    DROP TRIGGER IF EXISTS trg_bookings_updated_at;
    CREATE TRIGGER trg_bookings_updated_at
    AFTER UPDATE ON bookings
    FOR EACH ROW
    BEGIN
      UPDATE bookings SET updated_at = datetime('now') WHERE id = NEW.id;
    END;

    CREATE TABLE children (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      birthday TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    /* --- Loyalty --- */
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

    CREATE INDEX IF NOT EXISTS idx_loyalty_vouchers_user_status ON loyalty_vouchers(user_id, status);

    CREATE TABLE IF NOT EXISTS coupon_redemptions (
      id INTEGER PRIMARY KEY,
      voucher_id INTEGER NOT NULL UNIQUE,
      order_id INTEGER NOT NULL,
      redeemed_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (voucher_id) REFERENCES loyalty_vouchers(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_voucher ON coupon_redemptions(voucher_id);

    /* --- Coupons / Newsletter / Reviews --- */
    CREATE TABLE coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      discount_percent INTEGER NOT NULL CHECK (discount_percent BETWEEN 1 AND 100),
      starts_at TEXT,
      expires_at TEXT,
      is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1))
    );

    CREATE TABLE newsletter_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      email TEXT NOT NULL UNIQUE,
      is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
      subscribed_at TEXT DEFAULT CURRENT_TIMESTAMP,
      unsubscribed_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE reviews (
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

    CREATE TABLE posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      image_url TEXT,
      author TEXT DEFAULT 'Admin',
      is_published INTEGER NOT NULL DEFAULT 1 CHECK(is_published IN (0,1)),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ---- SEED DATI (POPOLAMENTO) ----

  const pwdUser = await bcrypt.hash("password", 10);
  const pwdAdmin = await bcrypt.hash("admin123", 10);

  // 1. UTENTI
  console.log("Creazione utenti...");
  await db.run(
    `INSERT INTO users (first_name, last_name, email, password_hash, city, cap, address, role, phone) VALUES 
    ('Mario', 'Rossi', 'test@example.com', ?, 'Padova', '35100', 'Via Roma 1', 'user', '3401234567'),
    ('Admin', 'Site', 'admin@example.com', ?, 'Padova', '35100', 'Via Verdi 2', 'admin', '3494321239'),
    ('Lucia', 'Bianchi', 'lucia@example.com', ?, 'Venezia', '30100', 'Calle Lunga 42', 'user', '3339876543'),
    ('Marco', 'Verdi', 'marco@example.com', ?, 'Treviso', '31100', 'Piazza dei Signori 5', 'user', '3201122334'),
    ('Sara', 'Neri', 'sara@example.com', ?, 'Vicenza', '36100', 'Corso Palladio 10', 'user', '3475566778')`,
    pwdUser,
    pwdAdmin,
    pwdUser,
    pwdUser,
    pwdUser
  );

  const uMario = await db.get(
    "SELECT id FROM users WHERE email='test@example.com'"
  );
  const uLucia = await db.get(
    "SELECT id FROM users WHERE email='lucia@example.com'"
  );
  const uMarco = await db.get(
    "SELECT id FROM users WHERE email='marco@example.com'"
  );

  // 2. INDIRIZZI SPEDIZIONE
  console.log("Creazione indirizzi...");
  await db.run(
    `INSERT INTO addresses (user_id, label, city, cap, address) VALUES
    (?, 'Casa', 'Padova', '35100', 'Via Roma 1'),
    (?, 'Casa al mare', 'Jesolo', '30016', 'Via Bafile 20'),
    (?, 'Ufficio', 'Mestre', '30170', 'Via Torino 15'),
    (?, 'Casa', 'Venezia', '30100', 'Calle Lunga 42'),
    (?, 'Casa Genitori', 'Mirano', '30035', 'Via della Vittoria 8'),
    (?, 'Casa', 'Treviso', '31100', 'Piazza dei Signori 5')`,
    uMario.id,
    uMario.id,
    uMario.id,
    uLucia.id,
    uLucia.id,
    uMarco.id
  );

  // 3. ITEMS
  console.log("Creazione gonfiabili...");
  await db.run(`INSERT INTO items (name, description, price_per_day, image_url, is_active) VALUES
    ('Gonfiabile George', 'Divertiti con la scimmietta George dei cartoni animati!', 100.00, '/img/gonfiabili/george.jpg', 1),
    ('Gonfiabile Alvin', 'I tuoi figli adoreranno questo gonfiabile, con Alvin e suoi amichetti!', 150.00, '/img/gonfiabili/alvin.jpg', 1),
    ('Gonfiabile Peppa Pig', 'Area salta-salta recintata con scivolo, ideale per i più piccoli.', 80.00, '/img/gonfiabili/peppapig.jpg', 1),
    ('Gonfiabile Winx', 'Gonfiabile perfetto per le tue bambine, falle divertire con le loro fate preferite!', 180.00, '/img/gonfiabili/winx.jpg', 1),
    ('Gonfiabile LadyBug', 'Gonfiabile con vasca palline integrata. Divertimento colorato.', 90.00, '/img/gonfiabili/ladybug.jpg', 1),
    ('Gonfiabile Vampirina', 'Edizione speciale spaventosa! Disponibile solo a Ottobre.', 130.00, '/img/gonfiabili/vampirina.jpg', 0)`);

  // Recupero ID items (CERCA I NOMI GIUSTI)
  const itGeorge = await db.get(
    "SELECT id, price_per_day FROM items WHERE name LIKE '%George%'"
  );
  const itAlvin = await db.get(
    "SELECT id, price_per_day FROM items WHERE name LIKE '%Alvin%'"
  );
  const itPeppa = await db.get(
    "SELECT id, price_per_day FROM items WHERE name LIKE '%Peppa%'"
  );
  const itWinx = await db.get(
    "SELECT id, price_per_day FROM items WHERE name LIKE '%Winx%'"
  );

  // 4. FIGLI & PREFERITI
  console.log("Creazione figli e preferiti...");
  await db.run(
    `INSERT INTO children (user_id, name, birthday) VALUES 
    (?, 'Giulia', '2018-05-12'),
    (?, 'Luca', '2020-11-03'),
    (?, 'Sofia', '2019-02-14'),
    (?, 'Matteo', '2021-08-20'),
    (?, 'Chiara', '2015-06-30')`,
    uMario.id,
    uMario.id,
    uLucia.id,
    uLucia.id,
    uMarco.id
  );

  if (itGeorge && itPeppa && itAlvin) {
    await db.run(
      `INSERT INTO favorites (user_id, item_id) VALUES (?, ?), (?, ?), (?, ?)`,
      uMario.id,
      itGeorge.id,
      uLucia.id,
      itPeppa.id,
      uMarco.id,
      itAlvin.id
    );
  }

  // 5. COUPON
  console.log("Creazione coupon...");
  await db.run(`INSERT INTO coupons (code, discount_percent, starts_at, expires_at, is_active) VALUES
    ('FESTA10', 10, date('now','-30 day'), date('now','+180 day'), 1),
    ('SUPER20', 20, date('now','-10 day'), date('now','+30 day'), 1),
    ('SCADUTO', 15, date('now','-60 day'), date('now','-1 day'), 1),
    ('ESTATE25', 25, date('now','+60 day'), date('now','+120 day'), 1)`);

  // 6. PRENOTAZIONI (Mix di stati e date)
  console.log("Creazione prenotazioni...");

  // MARIO: Una passata finita (per recensione) e una futura confermata
  if (itGeorge && itAlvin) {
    await db.run(
      `INSERT INTO bookings (user_id, item_id, shipping_address, date_from, date_to, unit_price, final_price, status, created_at, payment_method, payment_status) VALUES
      (?, ?, 'Via Roma 1, Padova', date('now','-10 day'), date('now','-8 day'), ?, ?, 'finished', date('now','-15 day'), 'credit_card', 'paid'),
      (?, ?, 'Via Bafile 20, Jesolo', date('now','+10 day'), date('now','+12 day'), ?, ?, 'confirmed', date('now','-2 day'), 'paypal', 'paid')`,
      uMario.id,
      itGeorge.id,
      itGeorge.price_per_day,
      itGeorge.price_per_day * 3,
      uMario.id,
      itAlvin.id,
      itAlvin.price_per_day,
      itAlvin.price_per_day * 3
    );
  }

  // LUCIA: Una pending (in attesa) e una cancellata
  if (itPeppa && itWinx) {
    await db.run(
      `INSERT INTO bookings (user_id, item_id, shipping_address, date_from, date_to, unit_price, final_price, status, created_at, payment_method, payment_status) VALUES
      (?, ?, 'Calle Lunga 42, Venezia', date('now','+5 day'), date('now','+6 day'), ?, ?, 'pending', date('now','-1 day'), 'cash', 'unpaid'),
      (?, ?, 'Calle Lunga 42, Venezia', date('now','-20 day'), date('now','-19 day'), ?, ?, 'cancelled', date('now','-25 day'), 'credit_card', 'paid')`,
      uLucia.id,
      itPeppa.id,
      itPeppa.price_per_day,
      itPeppa.price_per_day * 2,
      uLucia.id,
      itWinx.id,
      itWinx.price_per_day,
      itWinx.price_per_day * 2
    );
  }

  // MARCO: Cliente fedele, molte prenotazioni passate
  if (itAlvin && itWinx) {
    await db.run(
      `INSERT INTO bookings (user_id, item_id, shipping_address, date_from, date_to, unit_price, final_price, status, created_at, payment_method, payment_status) VALUES
      (?, ?, 'Piazza dei Signori 5, Treviso', date('now','-40 day'), date('now','-38 day'), ?, ?, 'finished', date('now','-45 day'), 'paypal', 'paid'),
      (?, ?, 'Piazza dei Signori 5, Treviso', date('now','-5 day'), date('now','-4 day'), ?, ?, 'finished', date('now','-10 day'), 'cash', 'paid')`,
      uMarco.id,
      itAlvin.id,
      itAlvin.price_per_day,
      itAlvin.price_per_day * 3,
      uMarco.id,
      itWinx.id,
      itWinx.price_per_day,
      itWinx.price_per_day * 2
    );
  }

  // 7. RECENSIONI
  console.log("Creazione recensioni...");
  if (itGeorge && itAlvin && itWinx && itPeppa) {
    await db.run(
      `INSERT INTO reviews (user_id, item_id, rating, comment, is_approved, created_at) VALUES
      (?, ?, 5, 'Fantastico! I miei figli lo hanno adorato. Servizio puntuale.', 1, date('now','-7 day')),
      (?, ?, 4, 'Bello ma un po’ difficile da montare se non si ha spazio.', 1, date('now','-3 day')),
      (?, ?, 5, 'Consigliatissimo per feste numerose!', 0, date('now','-1 day')), 
      (?, ?, 2, 'Purtroppo è arrivato un po’ sporco.', 0, date('now'))`,
      uMario.id,
      itGeorge.id,
      uMarco.id,
      itAlvin.id,
      uMarco.id,
      itWinx.id,
      uLucia.id,
      itPeppa.id
    );
  }

  // 8. NEWSLETTER
  console.log("Iscrizioni newsletter...");
  await db.run(
    `INSERT INTO newsletter_subscriptions (user_id, email, is_active) VALUES
    (?, 'test@example.com', 1),
    (?, 'lucia@example.com', 1),
    (NULL, 'anonimo@gmail.com', 1),
    (NULL, 'fan@hotmail.it', 1),
    (?, 'marco@example.com', 0)`,
    uMario.id,
    uLucia.id,
    uMarco.id
  );

  console.log("✅ DB RESETTATO E POPOLATO CON SUCCESSO!");
} catch (e) {
  console.error("❌ ERRORE RESET DB:", e);
  process.exit(1);
} finally {
  await db.exec("PRAGMA foreign_keys = ON;");
  await db.close();
}
