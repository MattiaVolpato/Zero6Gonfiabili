// server/dao/NewsletterDAO.js
import { getDB } from "../config/db.js";

const normEmail = (v) => (v || "").toString().trim().toLowerCase();

export default class NewsletterDAO {
  static async getById(id) {
    const db = await getDB();
    return db.get(`SELECT * FROM newsletter_subscriptions WHERE id = ?`, id);
  }

  static async getByEmail(email) {
    const db = await getDB();
    return db.get(
      `SELECT * FROM newsletter_subscriptions WHERE LOWER(email) = LOWER(?)`,
      normEmail(email)
    );
  }

  /**
   * Iscrive/riattiva una email; se userId è fornito e mancante, lo collega.
   * - Evita duplicati (UNIQUE su email) con UPSERT
   * - Mantiene subscribed_at se già presente; pulisce unsubscribed_at
   */
  static async subscribe({ email, userId = null }) {
    const db = await getDB();
    const e = normEmail(email);

    await db.run(
      `INSERT INTO newsletter_subscriptions
         (email, user_id, is_active, subscribed_at, unsubscribed_at)
       VALUES (?, ?, 1, datetime('now'), NULL)
       ON CONFLICT(email) DO UPDATE SET
         is_active = 1,
         subscribed_at = COALESCE(newsletter_subscriptions.subscribed_at, excluded.subscribed_at),
         unsubscribed_at = NULL,
         user_id = COALESCE(newsletter_subscriptions.user_id, excluded.user_id)`,
      e,
      userId
    );
    return true;
  }

  /**
   * Disiscrive per email (false se non esiste).
   */
  static async unsubscribe(email) {
    const db = await getDB();
    const e = normEmail(email);

    const res = await db.run(
      `UPDATE newsletter_subscriptions
         SET is_active = 0,
             unsubscribed_at = datetime('now')
       WHERE LOWER(email) = LOWER(?)`,
      e
    );
    return res.changes > 0;
  }

  /**
   * Stato per email.
   */
  static async status(email) {
    const row = await this.getByEmail(email);
    if (!row) return { exists: false, is_active: false };
    return { exists: true, is_active: !!row.is_active };
  }

  /**
   * TRUE se l'email è presente ed attiva; FALSE se non esiste o se è disattivata.
   * Utile per bloccare invii verso disiscritti nei “send to single”.
   */
  static async isActiveByEmail(email) {
    const db = await getDB();
    const e = normEmail(email);
    const row = await db.get(
      `SELECT is_active
         FROM newsletter_subscriptions
        WHERE LOWER(email) = LOWER(?)`,
      e
    );
    return !!(row && row.is_active);
  }

  /**
   * Toggle da area admin: attiva/disattiva per id
   * - Se attivo: pulisce unsubscribed_at; se subscribed_at è NULL, lo valorizza ora
   * - Se disattivo: imposta unsubscribed_at = ora
   * Ritorna true se la riga esiste (anche se era già allo stesso stato).
   */
  static async setActiveById(id, isActive) {
    const db = await getDB();
    const active = isActive ? 1 : 0;

    const sql = `
      UPDATE newsletter_subscriptions
         SET is_active = ?,
             subscribed_at = CASE
               WHEN ? = 1 AND (subscribed_at IS NULL) THEN datetime('now')
               ELSE subscribed_at
             END,
             unsubscribed_at = CASE
               WHEN ? = 1 THEN NULL
               ELSE datetime('now')
             END
       WHERE id = ?
    `;
    const res = await db.run(sql, active, active, active, id);

    if (res.changes > 0) return true;

    // No-op: considera riuscito se la riga esiste (stato invariato).
    const row = await db.get(
      `SELECT id FROM newsletter_subscriptions WHERE id = ?`,
      id
    );
    return !!row;
  }

  /**
   * (Opzionale) collega l'utente se manca, dato email+userId.
   */
  static async attachUserIfMissing(email, userId) {
    const db = await getDB();
    const e = normEmail(email);
    const res = await db.run(
      `UPDATE newsletter_subscriptions
          SET user_id = ?
        WHERE user_id IS NULL AND LOWER(email) = LOWER(?)`,
      userId,
      e
    );
    return res.changes > 0;
  }

  /* =========================================================
   *  Metodi per campagne (admin + servizi newsletter)
   * =======================================================*/

  /**
   * Restituisce SOLO le email attive (lowercase, filtrate da falsy/duplicati).
   * Utile per gli invii massivi.
   */
  static async listActiveEmails() {
    const db = await getDB();
    const rows = await db.all(
      `SELECT email
         FROM newsletter_subscriptions
        WHERE is_active = 1
        ORDER BY id ASC`
    );
    const out = [];
    const seen = new Set();
    for (const r of rows) {
      const e = normEmail(r.email);
      if (!e || seen.has(e)) continue;
      seen.add(e);
      out.push(e);
    }
    return out;
  }

  /**
   * Conteggio iscritti attivi (per badge/indicatori in UI).
   */
  static async countActive() {
    const db = await getDB();
    const row = await db.get(
      `SELECT COUNT(*) AS n
         FROM newsletter_subscriptions
        WHERE is_active = 1`
    );
    return Number(row?.n || 0);
  }
}
