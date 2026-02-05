import { getDB } from "../config/db.js";

export default class FavoritesDAO {
  static async listIdsByUser(userId) {
    const db = await getDB();
    const rows = await db.all(
      `SELECT item_id FROM favorites WHERE user_id=?`,
      userId
    );
    return rows.map((r) => r.item_id);
  }

  static async isFavorite(userId, itemId) {
    const db = await getDB();
    const r = await db.get(
      `SELECT 1 FROM favorites WHERE user_id=? AND item_id=?`,
      userId,
      itemId
    );
    return !!r;
  }
  static async add(userId, itemId) {
    const db = await getDB();
    await db.run(
      `INSERT OR IGNORE INTO favorites (user_id, item_id) VALUES (?, ?)`,
      userId,
      itemId
    );
  }
  static async remove(userId, itemId) {
    const db = await getDB();
    await db.run(
      `DELETE FROM favorites WHERE user_id=? AND item_id=?`,
      userId,
      itemId
    );
  }
}
