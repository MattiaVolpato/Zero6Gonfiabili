// server/dao/LoyaltyDAO.js
import { getDB } from "../config/db.js";

// status che significano noleggio terminato
const COMPLETED_STATUSES = ["finished"];

const LoyaltyDAO = {
  /**
   * Riepilogo tessera per l'utente (nuova logica):
   * - completed: noleggi terminati (status in COMPLETED_STATUSES)
   * - earned: 1 premio ogni 2 completed (solo per progress)
   * - available: # buoni LCH realmente disponibili (loyalty_vouchers.status = 'available')
   * - used: derivato = max(0, earned - available) (solo informativo)
   * - progressInCycle: 0..1 => quanti terminati nel ciclo corrente (mod 2)
   * - remainingToNext: 0..2 => quanti mancano al prossimo premio
   */
  async getSummary(userId) {
    const db = await getDB();

    const completedRow = await db.get(
      `SELECT COUNT(*) AS cnt FROM bookings WHERE user_id = ? AND status = 'finished'`,
      [userId]
    );
    const completed = completedRow?.cnt ?? 0;

    const availableRow = await db.get(
      `SELECT COUNT(*) AS cnt FROM loyalty_vouchers WHERE user_id = ? AND status = 'available'`,
      [userId]
    );
    const available = availableRow?.cnt ?? 0;

    const earned = Math.floor(completed / 2);
    const used = Math.max(0, earned - available); // informativo
    const progressInCycle = completed % 2;
    const remainingToNext = available > 0 ? 0 : 2 - progressInCycle;

    return {
      completed,
      earned,
      used,
      available,
      progressInCycle,
      remainingToNext,
      discountPct: 10,
    };
  },
  /**
   * Conteggio dei noleggi "terminati" (riuso in admin finish → ensureUpToDate).
   */
  async getCompletedFinishedCount(userId) {
    const db = await getDB();
    const placeholders = COMPLETED_STATUSES.map(() => "?").join(",");
    const row = await db.get(
      `SELECT COUNT(*) AS c
         FROM bookings
        WHERE user_id = ?
          AND status IN (${placeholders})`,
      [userId, ...COMPLETED_STATUSES]
    );
    return row?.c ?? 0;
  },

  /**
   * Log del riscatto su un booking scontato (facoltativo, non influenza "available").
   * Utile come tracciamento quando si usa un LCH-… al checkout.
   */
  async redeemOnBooking({ userId, bookingId }) {
    const db = await getDB();
    await db.run(
      `INSERT OR IGNORE INTO loyalty_redemptions (user_id, booking_id)
       VALUES (?, ?)`,
      [userId, bookingId]
    );
  },

  /**
   * Espone gli status "terminati" per eventuale riuso esterno.
   */
  getCompletedStatuses() {
    return [...COMPLETED_STATUSES];
  },
};

export default LoyaltyDAO;
