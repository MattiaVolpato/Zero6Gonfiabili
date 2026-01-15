// server/dao/CouponsDAO.js
import { getDB } from "../config/db.js";

export default class CouponsDAO {
  static async findByCode(code) {
    const db = await getDB();
    return db.get(`SELECT * FROM coupons WHERE code = ?`, code);
  }

  static isCurrentlyValid(c) {
    if (!c) return { valid: false, reason: "not_found" };
    if (!c.is_active) return { valid: false, reason: "inactive" };
    const today = new Date().toISOString().slice(0, 10);
    if (c.starts_at && c.starts_at > today)
      return { valid: false, reason: "not_started" };
    if (c.expires_at && c.expires_at < today)
      return { valid: false, reason: "expired" };
    return { valid: true, coupon: c };
  }

  // ✅ nuovo: creazione coupon “buono” una-tantum
  static async create({
    code,
    discount_percent,
    starts_at = null,
    expires_at = null,
    is_active = 1,
  }) {
    const db = await getDB();
    const res = await db.run(
      `INSERT INTO coupons (code, discount_percent, starts_at, expires_at, is_active)
       VALUES (?, ?, ?, ?, ?)`,
      code,
      Number(discount_percent),
      starts_at,
      expires_at,
      is_active ? 1 : 0
    );
    return res.lastID;
  }
}
