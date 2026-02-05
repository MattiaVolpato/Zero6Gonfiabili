// server/dao/UsersDAO.js
import { getDB } from "../config/db.js";

class UsersDAO {
  /** Trova utente per email (case-insensitive) */
  static async findByEmail(email) {
    const db = await getDB();
    return db.get(`SELECT * FROM users WHERE LOWER(email) = LOWER(?)`, [email]);
  }

  /** Dati pubblici/sicuri dell'utente (per API/UI) */
  static async findPublicById(id) {
    const db = await getDB();
    return db.get(
      `SELECT id, first_name, last_name, email, city, cap, address, phone, birthday, role
       FROM users
       WHERE id = ?`,
      [id]
    );
  }

  /** Crea nuovo utente e restituisce i dati pubblici */
  static async create({
    first_name,
    last_name,
    email,
    password_hash,
    birthday,
    city,
    cap,
    address,
    phone,
  }) {
    const db = await getDB();
    const { lastID } = await db.run(
      `INSERT INTO users
         (first_name, last_name, email, password_hash, birthday, city, cap, address, phone, role)
       VALUES
         (?, ?, ?, ?, ?, ?, ?, ?, ?, 'user')`,
      [
        first_name,
        last_name,
        email,
        password_hash,
        birthday,
        city,
        cap,
        address,
        phone,
      ]
    );
    return this.findPublicById(lastID);
  }

  /** Dati sensibili (hash) */
  static async getSensitiveById(id) {
    const db = await getDB();
    return db.get(`SELECT id, email, password_hash FROM users WHERE id = ?`, [
      id,
    ]);
  }

  /** Aggiorna profilo e restituisce i dati pubblici aggiornati */
  static async updateProfile(
    id,
    { first_name, last_name, city, cap, address, phone }
  ) {
    const db = await getDB();
    await db.run(
      `UPDATE users
          SET first_name = ?, last_name = ?, city = ?, cap = ?, address = ?, phone = ?
        WHERE id = ?`,
      [first_name, last_name, city, cap, address, phone, id]
    );
    return this.findPublicById(id);
  }

  /** Imposta nuova password (hash già calcolato) */
  static async setPasswordHash(id, password_hash) {
    const db = await getDB();
    await db.run(`UPDATE users SET password_hash = ? WHERE id = ?`, [
      password_hash,
      id,
    ]);
  }

  /** Trova utente per id (tutti i campi) */
  static async findById(id) {
    const db = await getDB();
    return db.get(`SELECT * FROM users WHERE id = ?`, [id]);
  }

  /**
   * Elimina un utente e TUTTE le entità collegate via FK CASCADE.
   * Restituisce il numero di righe cancellate (0 se non trovato).
   */
  static async deleteUserDeep(userId) {
    const idNum = Number(userId);
    if (!Number.isInteger(idNum)) {
      throw new Error("userId non valido");
    }

    const db = await getDB();
    // Garantiamo che le FK siano attive
    await db.exec("PRAGMA foreign_keys = ON;");
    await db.exec("BEGIN;");
    try {
      const { changes } = await db.run(`DELETE FROM users WHERE id = ?`, [
        idNum,
      ]);
      await db.exec("COMMIT;");
      return changes; // 1 se eliminato, 0 se non trovato
    } catch (e) {
      await db.exec("ROLLBACK;");
      throw e;
    }
  }
}

export default UsersDAO;
