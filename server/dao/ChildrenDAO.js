import { getDB } from "../config/db.js";

export default class ChildrenDAO {
  static async listForUser(userId) {
    const db = await getDB();
    return db.all(
      `SELECT id, name, birthday, created_at
       FROM children
       WHERE user_id = ?
       ORDER BY date(birthday) ASC, name ASC`,
      userId
    );
  }

  static async create({ userId, name, birthday }) {
    const db = await getDB();
    const res = await db.run(
      `INSERT INTO children (user_id, name, birthday) VALUES (?, ?, ?)`,
      userId,
      name,
      birthday
    );
    return res.lastID;
  }

  static async remove({ userId, childId }) {
    const db = await getDB();
    const row = await db.get(
      `SELECT id FROM children WHERE id = ? AND user_id = ?`,
      childId,
      userId
    );
    if (!row) return false;
    await db.run(`DELETE FROM children WHERE id = ?`, childId);
    return true;
  }
}
