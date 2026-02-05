import { getDB } from "../config/db.js";

export default class AdminDAO {
  // ---- ITEMS ----
  static async allItems(filter = "all") {
    const db = await getDB();
    let sql = "SELECT * FROM items";
    const params = [];

    if (filter === "active") {
      sql += " WHERE is_active = 1";
    } else if (filter === "inactive") {
      sql += " WHERE is_active = 0";
    }

    sql += " ORDER BY id DESC";
    return db.all(sql, params);
  }

  static async createItem({ name, description, price_per_day, image_url }) {
    const db = await getDB();
    const res = await db.run(
      `INSERT INTO items (name, description, price_per_day, image_url, is_active)
       VALUES (?, ?, ?, ?, 1)`,
      name,
      description,
      price_per_day,
      image_url
    );
    return res.lastID;
  }

  static async updateItem({
    id,
    name,
    description,
    price_per_day,
    image_url,
    is_active,
  }) {
    const db = await getDB();
    await db.run(
      `UPDATE items
         SET name = ?, description = ?, price_per_day = ?, image_url = ?, is_active = ?
       WHERE id = ?`,
      name,
      description,
      price_per_day,
      image_url,
      is_active ? 1 : 0,
      id
    );
  }

  static async deleteItem(id) {
    const db = await getDB();
    await db.run(`DELETE FROM items WHERE id = ?`, id);
  }

  // ---- COUPONS ----
  static async allCoupons(filter = "all") {
    const db = await getDB();
    let sql = "SELECT * FROM coupons";
    if (filter === "active") sql += " WHERE is_active = 1";
    if (filter === "inactive") sql += " WHERE is_active = 0";
    sql += " ORDER BY id DESC";
    return db.all(sql);
  }

  static async createCoupon({
    code,
    discount_percent,
    starts_at,
    expires_at,
    is_active,
  }) {
    const db = await getDB();
    const res = await db.run(
      `INSERT INTO coupons (code, discount_percent, starts_at, expires_at, is_active)
       VALUES (?, ?, ?, ?, ?)`,
      code.toUpperCase().trim(),
      Number(discount_percent),
      starts_at || null,
      expires_at || null,
      is_active ? 1 : 0
    );
    return res.lastID;
  }

  static async updateCoupon({
    id,
    code,
    discount_percent,
    starts_at,
    expires_at,
    is_active,
  }) {
    const db = await getDB();
    await db.run(
      `UPDATE coupons
         SET code = ?, discount_percent = ?, starts_at = ?, expires_at = ?, is_active = ?
       WHERE id = ?`,
      code.toUpperCase().trim(),
      Number(discount_percent),
      starts_at || null,
      expires_at || null,
      is_active ? 1 : 0,
      id
    );
  }

  static async deleteCoupon(id) {
    const db = await getDB();
    await db.run(`DELETE FROM coupons WHERE id = ?`, id);
  }

  static async toggleCoupon(id, active) {
    const db = await getDB();
    await db.run(
      `UPDATE coupons SET is_active = ? WHERE id = ?`,
      active ? 1 : 0,
      id
    );
  }

  // ---- NEWSLETTER ----
  static async allSubscribers(filter = "all") {
    const db = await getDB();
    let sql = `
      SELECT n.id, n.email, n.is_active, n.subscribed_at, n.unsubscribed_at,
             u.first_name, u.last_name, u.id AS user_id
        FROM newsletter_subscriptions n
        LEFT JOIN users u ON u.id = n.user_id`;

    if (filter === "active") sql += " WHERE n.is_active = 1";
    if (filter === "inactive") sql += " WHERE n.is_active = 0";

    sql += " ORDER BY n.subscribed_at DESC";
    return db.all(sql);
  }

  static async deleteSubscriber(id) {
    const db = await getDB();
    await db.run(`DELETE FROM newsletter_subscriptions WHERE id = ?`, id);
  }

  // ---- USERS ----
  static async allUsers(searchQuery = "") {
    const db = await getDB();
    let sql = `SELECT id, first_name, last_name, email, role, city, cap, address, phone, birthday
               FROM users`;
    const params = [];

    if (searchQuery) {
      const q = `%${searchQuery.trim()}%`;
      sql += ` WHERE (first_name || ' ' || last_name) LIKE ? OR email LIKE ?`;
      params.push(q, q);
    }

    sql += ` ORDER BY id DESC`;
    return db.all(sql, params);
  }

  static async userDetails(userId) {
    const db = await getDB();

    // Aggiungo phone anche nel dettaglio
    const user = await db.get(
      `SELECT id, first_name, last_name, email, role, city, cap, address, phone, birthday
         FROM users
        WHERE id = ?`,
      userId
    );
    if (!user) return null;

    const favorites = await db.all(
      `SELECT f.item_id, i.name, i.price_per_day
         FROM favorites f
         JOIN items i ON i.id = f.item_id
        WHERE f.user_id = ?
        ORDER BY i.name ASC`,
      userId
    );

    // Prenotazioni: aggiungo status_label in italiano + indicatori temporali
    const bookings = await db.all(
      `SELECT b.id, b.item_id, i.name AS item_name,
              b.date_from, b.date_to, b.status, b.created_at,
              b.coupon_code, b.unit_price, b.discount_percent, b.final_price,b.shipping_address,
              CASE b.status
                WHEN 'pending'   THEN 'in attesa'
                WHEN 'confirmed' THEN 'confermata'
                WHEN 'rejected'  THEN 'rifiutata'
                WHEN 'cancelled' THEN 'annullata'
                WHEN 'finished'  THEN 'terminata'
                ELSE b.status
              END AS status_label,
              CASE WHEN date('now') >= date(b.date_from) THEN 1 ELSE 0 END AS is_started,
              CASE WHEN date('now') >  date(b.date_to)   THEN 1 ELSE 0 END AS is_finished
         FROM bookings b
         JOIN items i ON i.id = b.item_id
        WHERE b.user_id = ?
        ORDER BY b.created_at DESC`,
      userId
    );

    const children = await db.all(
      `SELECT id, name, birthday, created_at
         FROM children
        WHERE user_id = ?
        ORDER BY created_at DESC`,
      userId
    );

    // newsletter: match per user_id oppure (fallback) per email, case-insensitive
    let newsletter = await db.get(
      `SELECT id, email, is_active, subscribed_at, unsubscribed_at
     FROM newsletter_subscriptions
    WHERE user_id = ?`,
      userId
    );

    if (!newsletter) {
      newsletter = await db.get(
        `SELECT id, email, is_active, subscribed_at, unsubscribed_at
       FROM newsletter_subscriptions
      WHERE LOWER(email) = LOWER(?)`,
        user.email
      );

      // 🔧 se trovata per email ma non collegata all’utente, la colleghiamo ora
      if (newsletter) {
        await db.run(
          `UPDATE newsletter_subscriptions
          SET user_id = ?
        WHERE id = ?`,
          userId,
          newsletter.id
        );
      }
    }

    // opzionale: elenco di coupon disponibili (panoramica)
    const coupons = await db.all(
      `SELECT id, code, discount_percent, starts_at, expires_at, is_active
         FROM coupons
         ORDER BY id DESC`
    );

    return { user, favorites, bookings, children, newsletter, coupons };
  }
}
