// server/dao/BookingsDAO.js
import { getDB } from "../config/db.js";

export default class BookingsDAO {
  // === Disponibilità ===
  static async isAvailable(itemId, dateFrom, dateTo, excludeId = null) {
    const db = await getDB();
    const params = [itemId, dateTo, dateFrom];
    if (excludeId) params.push(excludeId);
    const row = await db.get(
      `SELECT COUNT(*) AS c
         FROM bookings
        WHERE item_id = ?
          AND status NOT IN ('cancelled','rejected')
          AND date_from <= ?
          AND date_to   >= ?
          ${excludeId ? "AND id <> ?" : ""}`,
      params
    );
    return (row?.c || 0) === 0;
  }

  // === Crea prenotazione ===
  static async create({
    user_id,
    item_id,
    date_from,
    date_to,
    coupon_code = null,
    unit_price,
    discount_percent,
    final_price,
    shipping_address,
    payment_method,
    payment_status,
  }) {
    const db = await getDB();
    const res = await db.run(
      `INSERT INTO bookings 
        (user_id, item_id, date_from, date_to, coupon_code, unit_price, discount_percent, final_price, shipping_address, payment_method, payment_status, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))`,
      [
        user_id,
        item_id,
        date_from,
        date_to,
        coupon_code,
        unit_price,
        discount_percent,
        final_price,
        shipping_address,
        payment_method,
        payment_status,
      ]
    );
    return res.lastID;
  }

  // === NUOVO: leggi prenotazione per id (incluso user_id) ===
  static async getById(id) {
    const db = await getDB();
    return db.get(
      `SELECT id, user_id, item_id, date_from, date_to, status, created_at, updated_at
         FROM bookings
        WHERE id = ?`,
      [id]
    );
  }

  // === Lista prenotazioni per utente ===
  static async listForUser(userId) {
    const db = await getDB();
    const todayStr = new Date().toISOString().slice(0, 10);

    return db.all(
      `SELECT b.id, b.item_id, i.name AS item_name,
              b.date_from, b.date_to, b.status, b.created_at,
              b.coupon_code, b.unit_price, b.discount_percent, b.final_price,
              b.shipping_address,
              b.payment_method, b.payment_status,
              CASE b.status
                WHEN 'pending'   THEN 'in attesa'
                WHEN 'confirmed' THEN 'confermato'
                WHEN 'rejected'  THEN 'rifiutato'
                WHEN 'cancelled' THEN 'annullato'
                WHEN 'finished'  THEN 'terminato'
                ELSE b.status
              END AS status_label,
              CASE WHEN date(?) > date(b.date_to) THEN 1 ELSE 0 END AS is_finished
         FROM bookings b
         JOIN items i ON i.id = b.item_id
        WHERE b.user_id = ?
        ORDER BY b.created_at DESC`,
      [todayStr, userId]
    );
  }

  // === Annullamento utente ===
  static async cancel({ userId, bookingId }) {
    const db = await getDB();
    const b = await db.get(
      `SELECT id, status FROM bookings WHERE id = ? AND user_id = ?`,
      [bookingId, userId]
    );
    if (!b) return false;
    if (["finished", "rejected"].includes(b.status)) return false;

    await db.run(
      `UPDATE bookings 
          SET status = 'cancelled', updated_at = datetime('now')
        WHERE id = ?`,
      [bookingId]
    );
    return true;
  }

  // Aggiorna solo lo stato del pagamento
  static async updatePaymentStatus(id, status) {
    const db = await getDB();
    const res = await db.run(
      "UPDATE bookings SET payment_status = ?, updated_at = datetime('now') WHERE id = ?",
      [status, id]
    );
    return res.changes > 0;
  }

  // === Admin: aggiorna stato ===
  static async adminUpdateStatus(id, nextStatus) {
    const db = await getDB();
    const allowed = [
      "pending",
      "confirmed",
      "rejected",
      "cancelled",
      "finished",
    ];
    if (!allowed.includes(nextStatus))
      return { ok: false, reason: "bad_status" };

    // includo user_id per poter emettere buoni subito dopo (senza altra query)
    const b = await db.get(
      `SELECT id, user_id, status, date_to FROM bookings WHERE id = ?`,
      [id]
    );
    if (!b) return { ok: false, reason: "not_found" };

    const from = b.status;
    const to = nextStatus;
    const nowYMD = new Date().toISOString().slice(0, 10);
    const isPast = b.date_to && b.date_to < nowYMD;

    // Nota: calcolo la validità ma mantengo il comportamento attuale (nessun blocco)
    // in modo da non rompere flussi esistenti.
    const validTransition =
      (from === "pending" &&
        ["confirmed", "rejected", "cancelled"].includes(to)) ||
      (from === "confirmed" && ["cancelled", "finished"].includes(to)) ||
      (isPast && from !== "finished" && to === "finished");

    await db.run(
      `UPDATE bookings SET status = ?, updated_at = datetime('now') WHERE id = ?`,
      [to, id]
    );

    // Ritorno info minime utili a chi chiama (backward compatible)
    return {
      ok: true,
      booking: { id: b.id, user_id: b.user_id, from, to, validTransition },
    };
  }

  static async listAll({ status, q, itemId, userId, id, date_from, date_to }) {
    const db = await getDB();
    const params = [];
    const where = [];

    // Status effettivo calcolato dal DB (niente placeholder -> più robusto)
    const statusEff = `
    CASE
      WHEN date('now') > date(b.date_to) THEN
        CASE b.status
          WHEN 'pending'   THEN 'cancelled'
          WHEN 'confirmed' THEN 'finished'
          ELSE b.status
        END
      ELSE b.status
    END
  `;

    // Filtro sullo status EFFETTIVO
    if (status && status !== "all") {
      where.push(`${statusEff} = ?`);
      params.push(status);
    }

    if (id) {
      where.push("b.id = ?");
      params.push(Number(id));
    }

    if (itemId) {
      where.push("b.item_id = ?");
      params.push(Number(itemId));
    }
    if (userId) {
      where.push("b.user_id = ?");
      params.push(Number(userId));
    }
    if (q) {
      where.push("(i.name LIKE ? OR u.email LIKE ?)");
      params.push(`%${q}%`, `%${q}%`);
    }
    if (date_from) {
      where.push("date(b.date_from) >= date(?)");
      params.push(date_from);
    }
    if (date_to) {
      where.push("date(b.date_to)   <= date(?)");
      params.push(date_to);
    }

    const sql = `
    SELECT
      b.id, b.user_id, u.email AS user_email,
      b.item_id, i.name AS item_name,
      b.date_from, b.date_to,
      b.shipping_address,

      ${statusEff} AS status,        -- restituiamo lo status *effettivo* come 'status'
      b.status AS status_raw,        -- opzionale: stato grezzo

      CASE ${statusEff}
        WHEN 'pending'   THEN 'in attesa'
        WHEN 'confirmed' THEN 'confermato'
        WHEN 'rejected'  THEN 'rifiutato'
        WHEN 'cancelled' THEN 'annullato'
        WHEN 'finished'  THEN 'terminato'
        ELSE ${statusEff}
      END AS status_label,

      CASE WHEN date('now') >= date(b.date_from) THEN 1 ELSE 0 END AS is_started,
      CASE WHEN date('now') >  date(b.date_to)   THEN 1 ELSE 0 END AS is_finished,

      b.coupon_code, b.discount_percent, b.final_price,
      b.payment_method, 
      b.payment_status,
      b.created_at, b.updated_at
    FROM bookings b
    JOIN users u ON u.id = b.user_id
    JOIN items i ON i.id = b.item_id
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY b.created_at DESC
    LIMIT 500
  `;

    return db.all(sql, params);
  }

  // === Admin: elimina prenotazione ===
  static async deleteAdmin(id) {
    const db = await getDB();
    const r = await db.run(`DELETE FROM bookings WHERE id = ?`, [id]);
    return r.changes > 0;
  }

  // Aggiorna in modo permanente gli stati scaduti nel DB
  static async sweepExpired() {
    const db = await getDB();
    const todayStr = new Date().toISOString().slice(0, 10);

    // pending scadute -> cancelled
    await db.run(
      `UPDATE bookings
       SET status = 'cancelled', updated_at = datetime('now')
     WHERE status = 'pending' AND date(?) > date(date_to)`,
      [todayStr]
    );

    // confirmed scadute -> finished
    await db.run(
      `UPDATE bookings
       SET status = 'finished', updated_at = datetime('now')
     WHERE status = 'confirmed' AND date(?) > date(date_to)`,
      [todayStr]
    );
  }

  // Helper per oggi YYYY-MM-DD
  static todayYMD() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(d.getDate()).padStart(2, "0")}`;
  }
}
