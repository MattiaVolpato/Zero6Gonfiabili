import { getDB } from "../config/db.js";

function genCode() {
  return "LCH-" + Math.random().toString(36).slice(2, 8).toUpperCase();
}

// utile lato SQL per capire se un record è scaduto
// (status diverso da 'available' OPPURE expires_at < oggi)
const EXPIRED_CASE_EXPR = `
  CASE
    WHEN status <> 'available' THEN 1
    WHEN expires_at IS NOT NULL AND date(expires_at) < date('now') THEN 1
    ELSE 0
  END AS is_expired
`;

const LoyaltyVoucherDAO = {
  async countIssuedForUser(userId) {
    const db = await getDB();
    const row = await db.get(
      "SELECT COUNT(*) AS c FROM loyalty_vouchers WHERE user_id = ?",
      [userId]
    );
    return row?.c ?? 0;
  },

  // SOLO i disponibili e non scaduti (per l'applicazione del codice)
  async listAvailableForUser(userId) {
    const db = await getDB();
    return db.all(
      `SELECT id, code, discount_percent, status, created_at, expires_at
         FROM loyalty_vouchers
        WHERE user_id = ?
          AND status = 'available'
          AND (expires_at IS NULL OR date(expires_at) >= date('now'))
        ORDER BY created_at DESC`,
      [userId]
    );
  },

  // Elenco COMPLETO con flag is_expired per la pagina Tessera
  async listAllForUser(userId) {
    const db = await getDB();
    return db.all(
      `SELECT
        id, code, discount_percent, status, created_at, expires_at, used_at

         FROM loyalty_vouchers
        WHERE user_id = ?
        ORDER BY created_at DESC`,
      [userId]
    );
  },

  async createOne(userId, { discountPercent = 10, expiresAt = null } = {}) {
    const db = await getDB();
    const code = genCode();
    await db.run(
      `INSERT INTO loyalty_vouchers (user_id, code, discount_percent, expires_at, status)
       VALUES (?, ?, ?, ?, 'available')`,
      [userId, code, discountPercent, expiresAt]
    );
    return db.get(`SELECT * FROM loyalty_vouchers WHERE code = ?`, [code]);
  },

  // Porta i buoni emessi al numero che deve essere (floor(completed/2))
  async ensureUpToDate(userId, completedFinishedCount) {
    const shouldHave = Math.floor(completedFinishedCount / 2);
    const issued = await this.countIssuedForUser(userId);
    const missing = shouldHave - issued;
    const created = [];
    for (let i = 0; i < missing; i++) {
      created.push(await this.createOne(userId, { discountPercent: 10 }));
    }
    return created;
  },

  // lookup LCH per utente (case-insensitive) SOLO se disponibile e NON scaduto
  async findAvailableByCode(userId, code) {
    const db = await getDB();
    const cleaned = String(code || "").trim();
    if (!cleaned) return null;
    return db.get(
      `SELECT id, user_id, code, discount_percent, status, created_at, expires_at
         FROM loyalty_vouchers
        WHERE user_id = ?
          AND UPPER(code) = UPPER(?)
          AND status = 'available'
          AND (expires_at IS NULL OR date(expires_at) >= date('now'))
        LIMIT 1`,
      [userId, cleaned]
    );
  },

  // Marca il buono come USATO (monouso).
  // Se la colonna used_at esiste nel tuo schema, verrà valorizzata.
  async useById({ userId, voucherId, bookingId = null }) {
    const db = await getDB();
    const res = await db.run(
      `UPDATE loyalty_vouchers
        SET status = 'used',
            updated_at = datetime('now'),
            used_at = COALESCE(used_at, datetime('now')),
            used_booking_id = COALESCE(used_booking_id, ?)
      WHERE id = ?
        AND user_id = ?
        AND status = 'available'`,
      [bookingId, voucherId, userId]
    );
    return res?.changes > 0;
  },
};

export default LoyaltyVoucherDAO;
