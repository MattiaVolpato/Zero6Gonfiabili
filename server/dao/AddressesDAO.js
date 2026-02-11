// server/dao/AddressesDAO.js
import { getDB } from "../config/db.js";

export default class AddressesDAO {
  static async listByUser(userId) {
    const db = await getDB();
    return db.all(
      `SELECT * FROM addresses WHERE user_id = ? ORDER BY id DESC`,
      [userId]
    );
  }

  static async create({ userId, label, city, cap, address }) {
    const db = await getDB();
    const res = await db.run(
      `INSERT INTO addresses (user_id, label, city, cap, address) VALUES (?, ?, ?, ?, ?)`,
      [userId, label, city, cap, address]
    );
    return res.lastID;
  }

  static async delete(id, userId) {
    const db = await getDB();
    // Verifica che l'indirizzo appartenga all'utente prima di cancellare
    await db.run(`DELETE FROM addresses WHERE id = ? AND user_id = ?`, [
      id,
      userId,
    ]);
  }
}
