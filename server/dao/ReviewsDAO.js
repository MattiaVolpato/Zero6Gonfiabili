// server/dao/ReviewsDAO.js
import { getDB } from "../config/db.js";

const ReviewsDAO = {
  /**
   * Crea una nuova recensione: per default non approvata (is_approved = 0)
   */
  async create({ userId, itemId, rating, comment }) {
    const db = await getDB();
    await db.run(
      `INSERT INTO reviews (user_id, item_id, rating, comment, is_approved, created_at)
       VALUES (?, ?, ?, ?, 0, datetime('now'))`,
      [userId, itemId, rating, comment ?? null]
    );
  },

  /**
   * Restituisce tutte le recensioni approvate per un item.
   */
  async listApprovedByItem(itemId) {
    const db = await getDB();
    return db.all(
      `SELECT r.id, r.user_id, r.item_id, r.rating, r.comment, r.created_at,
              u.first_name, u.last_name
       FROM reviews r
       JOIN users u ON u.id = r.user_id
       WHERE r.item_id = ? AND r.is_approved = 1
       ORDER BY r.created_at DESC`,
      [itemId]
    );
  },

  /**
   * Calcola la media e il conteggio recensioni approvate per un item.
   */
  async avgForItem(itemId) {
    const db = await getDB();
    const row = await db.get(
      `SELECT ROUND(AVG(rating), 1) AS avg_rating, COUNT(*) AS count
       FROM reviews
       WHERE item_id = ? AND is_approved = 1`,
      [itemId]
    );
    return { avg: row?.avg_rating || 0, count: row?.count || 0 };
  },

  /**
   * Verifica se l'utente può recensire (ha prenotato quell'item)
   */
  async userCanReview(userId, itemId) {
    const db = await getDB();
    const row = await db.get(
      `SELECT 1
     FROM bookings
     WHERE user_id = ?
       AND item_id = ?
       -- recensione consentita se la fine è oggi o prima
       AND datetime(date_to) <= datetime('now','localtime')
     LIMIT 1`,
      [userId, itemId]
    );
    return !!row;
  },

  /**
   * Elenco completo per l’admin con filtro di stato
   */
  async listAdmin(status = "pending") {
    const db = await getDB();
    let where = "";
    const params = [];

    if (status === "pending") {
      where = "WHERE r.is_approved = 0";
    } else if (status === "approved") {
      where = "WHERE r.is_approved = 1";
    } else {
      where = ""; // "all"
    }

    return db.all(
      `SELECT 
         r.*,
         u.first_name, 
         u.last_name, 
         u.email AS user_email, 
         i.name AS item_name
       FROM reviews r
       JOIN users u ON u.id = r.user_id
       JOIN items i ON i.id = r.item_id
       ${where}
       ORDER BY r.created_at DESC`,
      params
    );
  },

  /**
   * Approva una recensione
   */
  async approve(id) {
    const db = await getDB();
    await db.run(`UPDATE reviews SET is_approved = 1 WHERE id = ?`, [id]);
  },

  /**
   * Rimuove una recensione
   */
  async remove(id) {
    const db = await getDB();
    await db.run(`DELETE FROM reviews WHERE id = ?`, [id]);
  },

  /**
   * Recensioni approvate più recenti (paginato) per la home
   */
  async listLatestApproved({ limit = 4, offset = 0 }) {
    const db = await getDB();
    const rows = await db.all(
      `
      SELECT
        r.id,
        r.rating,
        r.comment,
        r.created_at,
        COALESCE(
          NULLIF(TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')), ''),
          u.email,
          'Utente'
        ) AS user_name,
        i.id   AS item_id,
        i.name AS item_name
      FROM reviews r
      JOIN users u  ON u.id = r.user_id
      LEFT JOIN items i ON i.id = r.item_id
      WHERE r.is_approved = 1
      ORDER BY r.created_at DESC, r.id DESC
      LIMIT ? OFFSET ?
      `,
      [limit, offset]
    );
    return rows;
  },

  async countApproved() {
    const db = await getDB();
    const row = await db.get(
      `SELECT COUNT(*) AS cnt FROM reviews WHERE is_approved = 1`
    );
    return row?.cnt ?? 0;
  },
};

export default ReviewsDAO;
