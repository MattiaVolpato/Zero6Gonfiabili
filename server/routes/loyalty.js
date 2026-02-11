// server/routes/loyalty.js
import { Router } from "express";
import { ensureAuth, ensureRole } from "./guards.js";
import { getDB } from "../config/db.js";
import LoyaltyDAO from "../dao/LoyaltyDAO.js";

const r = Router();

// [TESSERA: SWEEP] — sweep mirato per utente (riduce lock e fa solo ciò che serve)
async function sweepAgingBookingsForUser(userId) {
  const db = await getDB();
  await db.run(
    `UPDATE bookings
       SET status = 'cancelled', updated_at = datetime('now')
     WHERE user_id = ?
       AND status = 'pending'
       AND date('now') > date(date_to)`,
    [userId]
  );
  await db.run(
    `UPDATE bookings
       SET status = 'finished', updated_at = datetime('now')
     WHERE user_id = ?
       AND status = 'confirmed'
       AND date('now') > date(date_to)`,
    [userId]
  );
}

// [TESSERA: UTIL] — arricchisce la risposta con meta utili al front-end
function enrichLoyalty(infoRaw) {
  const completed = Number(infoRaw?.completed ?? 0);
  const used = Number(infoRaw?.used ?? 0);
  const available = Number(infoRaw?.available ?? 0);
  // fallback percentuale default 10 se la DAO non la espone
  const discountPct = Number(infoRaw?.discountPct ?? 10);

  // Quanti "finished" mancano al prossimo premio:
  // - se ho già un premio disponibile => 0
  // - altrimenti 2 - (completed % 2); (0->2, 1->1, 2->0 ma available dovrebbe essere 1 se non usato)
  const nextRewardIn =
    available > 0
      ? 0
      : (2 - (completed % 2 || 0)) % 2 || (completed % 2 === 0 ? 2 : 1);

  return {
    ...infoRaw,
    discountPct,
    nextRewardIn,
    lastUpdated: new Date().toISOString(),
  };
}

// === Tessera dell’utente loggato ===
r.get("/", ensureAuth, async (req, res, next) => {
  try {
    // [TESSERA: SWEEP] — aggiorna gli stati scaduti SOLO di questo utente
    await sweepAgingBookingsForUser(req.user.id);

    const info = await LoyaltyDAO.getSummary(req.user.id);

    // [TESSERA: NO-CACHE] — evita che browser/proxy servano dati vecchi
    res.set("Cache-Control", "no-store");

    // [TESSERA: ENRICH] — aggiunge campi utili al client
    res.json(enrichLoyalty(info));
  } catch (e) {
    next(e);
  }
});

// === Tessera di un utente vista dall’admin ===
r.get("/admin/:userId", ensureRole("admin"), async (req, res, next) => {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId)) {
      return res.status(400).json({ error: "userId non valido" });
    }

    // [TESSERA: SWEEP] — aggiorna stati scaduti SOLO per quell’utente
    await sweepAgingBookingsForUser(userId);

    const info = await LoyaltyDAO.getSummary(userId);

    // [TESSERA: NO-CACHE]
    res.set("Cache-Control", "no-store");

    // [TESSERA: ENRICH]
    res.json(enrichLoyalty(info));
  } catch (e) {
    next(e);
  }
});

export default r;
