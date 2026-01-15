// server/dao/ItemsDAO.js
import { getDB } from "../config/db.js";

export default class ItemsDAO {
  // Elenco completo (eventuale filtro testo/prezzo/date lo gestisci nella route se vuoi)
  static async all() {
    const db = await getDB();
    return db.all(`
      SELECT 
        i.id, i.name, i.description, i.price_per_day, i.image_url, i.is_active,
        ROUND(AVG(CASE WHEN r.is_approved = 1 THEN r.rating END), 1) AS avg_rating,
        COUNT(CASE WHEN r.is_approved = 1 THEN 1 END)               AS reviews_count
      FROM items i
      LEFT JOIN reviews r ON r.item_id = i.id AND r.is_approved = 1
      GROUP BY i.id
      ORDER BY i.id DESC
    `);
  }

  // Ricerca base per q su nome/descrizione
  static async search(q = "") {
    const term = String(q || "").trim();
    if (!term) return this.all();

    const db = await getDB();
    const like = `%${term}%`;
    return db.all(
      `
      SELECT 
        i.id, i.name, i.description, i.price_per_day, i.image_url, i.is_active,
        ROUND(AVG(CASE WHEN r.is_approved = 1 THEN r.rating END), 1) AS avg_rating,
        COUNT(CASE WHEN r.is_approved = 1 THEN 1 END)               AS reviews_count
      FROM items i
      LEFT JOIN reviews r ON r.item_id = i.id AND r.is_approved = 1
      WHERE i.name LIKE ? OR i.description LIKE ?
      GROUP BY i.id
      ORDER BY i.id DESC
      `,
      [like, like]
    );
  }

  static async listActive() {
    const db = await getDB();
    return db.all("SELECT * FROM items WHERE is_active = 1");
  }

  static async findById(id) {
    const db = await getDB();
    return db.get(
      `
      SELECT 
        i.id, i.name, i.description, i.price_per_day, i.image_url, i.is_active,
        ROUND(AVG(CASE WHEN r.is_approved = 1 THEN r.rating END), 1) AS avg_rating,
        COUNT(CASE WHEN r.is_approved = 1 THEN 1 END)               AS reviews_count
      FROM items i
      LEFT JOIN reviews r ON r.item_id = i.id AND r.is_approved = 1
      WHERE i.id = ?
      GROUP BY i.id
      `,
      [id]
    );
  }

  static async findByIds(ids = []) {
    const clean = (ids || [])
      .map((x) => Number(x))
      .filter((x) => Number.isInteger(x));
    if (clean.length === 0) return [];

    const db = await getDB();
    const placeholders = clean.map(() => "?").join(",");
    return db.all(
      `
      SELECT 
        i.id, i.name, i.description, i.price_per_day, i.image_url, i.is_active,
        ROUND(AVG(CASE WHEN r.is_approved = 1 THEN r.rating END), 1) AS avg_rating,
        COUNT(CASE WHEN r.is_approved = 1 THEN 1 END)               AS reviews_count
      FROM items i
      LEFT JOIN reviews r ON r.item_id = i.id AND r.is_approved = 1
      WHERE i.id IN (${placeholders})
      GROUP BY i.id
      ORDER BY i.id DESC
      `,
      clean
    );
  }

  // --- metodi admin ---

  static async create({ name, description, price_per_day, image_url }) {
    const db = await getDB();
    const { lastID } = await db.run(
      `INSERT INTO items (name, description, price_per_day, image_url, is_active)
       VALUES (?, ?, ?, ?, 1)`,
      [name, description, price_per_day, image_url]
    );
    return this.findById(lastID);
  }

  static async update(
    id,
    { name, description, price_per_day, image_url, is_active }
  ) {
    const db = await getDB();
    await db.run(
      `UPDATE items
         SET name = ?, description = ?, price_per_day = ?, image_url = ?, is_active = ?
       WHERE id = ?`,
      [name, description, price_per_day, image_url, is_active ? 1 : 0, id]
    );
    return this.findById(id);
  }

  static async remove(id) {
    const db = await getDB();
    await db.run(`DELETE FROM items WHERE id = ?`, [id]);
  }

  static async searchWithFilters({ q = "", maxPrice, dateFrom, dateTo } = {}) {
    const db = await getDB();

    const where = [];
    const params = [];

    where.push("i.is_active = 1");

    // Filtro testo (facoltativo)
    if (q && String(q).trim()) {
      where.push(`(i.name LIKE ? OR i.description LIKE ?)`);
      const like = `%${String(q).trim()}%`;
      params.push(like, like);
    }

    // Prezzo massimo (facoltativo)
    if (
      maxPrice !== undefined &&
      maxPrice !== "" &&
      !Number.isNaN(Number(maxPrice))
    ) {
      where.push(`i.price_per_day <= ?`);
      params.push(Number(maxPrice));
    }

    // Disponibilità per intervallo (facoltativo)
    // Escludi item con prenotazioni attive sovrapposte all'intervallo richiesto
    if (dateFrom && dateTo) {
      where.push(`
        i.id NOT IN (
          SELECT item_id FROM bookings
          WHERE status NOT IN ('cancelled', 'rejected')
          AND date_from <= ? 
          AND date_to >= ?
        )
      `);
      // Logica sovrapposizione: (InizioPrenotazione <= FineRichiesta) E (FinePrenotazione >= InizioRichiesta)
      params.push(dateTo, dateFrom);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const sql = `
      SELECT 
        i.id, i.name, i.description, i.price_per_day, i.image_url, i.is_active,
        ROUND(AVG(CASE WHEN r.is_approved = 1 THEN r.rating END), 1) AS avg_rating,
        COUNT(CASE WHEN r.is_approved = 1 THEN 1 END)               AS reviews_count
      FROM items i
      LEFT JOIN reviews r ON r.item_id = i.id AND r.is_approved = 1
      ${whereSql}
      GROUP BY i.id
      ORDER BY i.id DESC
    `;

    return db.all(sql, params);
  }
}
