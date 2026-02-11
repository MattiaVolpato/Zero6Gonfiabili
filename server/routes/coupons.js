import { Router } from "express";
import { ensureAuth, ensureRole } from "./guards.js";
import { getDB } from "../config/db.js";
import BookingsDAO from "../dao/BookingsDAO.js";
import CouponsDAO from "../dao/CouponsDAO.js";
import LoyaltyVoucherDAO from "../dao/LoyaltyVoucherDAO.js"; // ⬅️ gestiamo i LCH

const r = Router();

/**
 * GET /api/coupons/:code
 * Ritorna:
 *   { valid: boolean, reason?: string, coupon?: { code, discount_percent, starts_at, expires_at, type? } }
 *
 * Nota: gestisce sia i coupon classici sia i buoni tessera (prefisso LCH-).
 * Richiede autenticazione perché i LCH sono legati all'utente.
 */
r.get("/:code", ensureAuth, async (req, res, next) => {
  try {
    const code = (req.params.code || "").trim();
    if (!code) {
      return res.status(400).json({ valid: false, reason: "not_found" });
    }

    // --- Buoni tessera (LCH-...) ---
    if (code.toUpperCase().startsWith("LCH-")) {
      // Valido solo se appartiene all'utente ed è ancora disponibile (non usato, non scaduto)
      const lv = await LoyaltyVoucherDAO.findAvailableByCode(req.user.id, code);
      if (!lv) {
        // Per compatibilità col frontend attuale usiamo "not_found"
        return res.json({ valid: false, reason: "not_found" });
      }

      return res.json({
        valid: true,
        coupon: {
          code: lv.code,
          discount_percent: lv.discount_percent ?? 10, // fallback prudente
          starts_at: null,
          expires_at: lv.expires_at || null,
          type: "loyalty", // opzionale, non rompe nulla se ignorato
        },
      });
    }

    // --- Coupon classici ---
    const c = await CouponsDAO.findByCode(code);
    const check = CouponsDAO.isCurrentlyValid(c);

    if (!check.valid) {
      // reason è quello già usato dal progetto (es: "not_found", "inactive", "expired", ...)
      return res.json({ valid: false, reason: check.reason });
    }

    return res.json({
      valid: true,
      coupon: {
        code: c.code,
        discount_percent: c.discount_percent,
        starts_at: c.starts_at,
        expires_at: c.expires_at,
        type: "coupon", // opzionale, informativo
      },
    });
  } catch (e) {
    next(e);
  }
});

// --------- utility date ----------
function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function daysBetween(from, to) {
  const a = new Date(from + "T00:00:00Z");
  const b = new Date(to + "T00:00:00Z");
  return Math.floor((b - a) / 86400000) + 1;
}
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

// =============================
//        ROTTE ADMIN
// =============================

// elenco con filtro stato: pending|confirmed|rejected|cancelled|finished|all
r.get("/admin", ensureRole("admin"), async (req, res, next) => {
  try {
    const status = (req.query.status || "pending").toString();
    const db = await getDB();
    const params = [];
    let where = "1=1";
    if (status !== "all") {
      where += " AND b.status = ?";
      params.push(status);
    }
    const rows = await db.all(
      `SELECT b.*, u.email AS user_email, i.name AS item_name,
              CASE WHEN date(?) >= date(b.date_from) THEN 1 ELSE 0 END AS is_started,
              CASE WHEN date(?) >  date(b.date_to)   THEN 1 ELSE 0 END AS is_finished
         FROM bookings b
         JOIN users u ON u.id = b.user_id
         JOIN items i ON i.id = b.item_id
        WHERE ${where}
        ORDER BY b.created_at DESC`,
      todayStr(),
      todayStr(),
      ...params
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// conferma (da pending -> confirmed)
r.put("/admin/:id/confirm", ensureRole("admin"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const db = await getDB();
    const row = await db.get(`SELECT status FROM bookings WHERE id = ?`, id);
    if (!row)
      return res.status(404).json({ error: "Prenotazione non trovata" });
    if (row.status !== "pending")
      return res
        .status(409)
        .json({
          error: "Solo le prenotazioni in attesa possono essere confermate",
        });

    await db.run(
      `UPDATE bookings SET status='confirmed', updated_at = datetime('now') WHERE id = ?`,
      id
    );
    return res.status(204).end();
  } catch (e) {
    next(e);
  }
});

// rifiuta (da pending -> rejected)
r.put("/admin/:id/reject", ensureRole("admin"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const db = await getDB();
    const row = await db.get(`SELECT status FROM bookings WHERE id = ?`, id);
    if (!row)
      return res.status(404).json({ error: "Prenotazione non trovata" });
    if (row.status !== "pending")
      return res
        .status(409)
        .json({
          error: "Solo le prenotazioni in attesa possono essere rifiutate",
        });

    await db.run(
      `UPDATE bookings SET status='rejected', updated_at = datetime('now') WHERE id = ?`,
      id
    );
    return res.status(204).end();
  } catch (e) {
    next(e);
  }
});

// ✅ ANNULLA (consentito SOLO se confirmed e OGGI < date_from)
r.put("/admin/:id/cancel", ensureRole("admin"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const db = await getDB();
    const b = await db.get(
      `SELECT id, status, date_from FROM bookings WHERE id = ?`,
      id
    );
    if (!b) return res.status(404).json({ error: "Prenotazione non trovata" });

    if (b.status !== "confirmed")
      return res
        .status(409)
        .json({ error: "Si possono annullare solo prenotazioni confermate" });

    const today = todayStr();
    if (!(today < b.date_from)) {
      return res
        .status(400)
        .json({
          error: "Non è possibile annullare dopo l’inizio del noleggio",
        });
    }

    await db.run(
      `UPDATE bookings SET status='cancelled', updated_at = datetime('now') WHERE id = ?`,
      id
    );
    return res.status(204).end();
  } catch (e) {
    next(e);
  }
});

// ✅ TERMINA (consentito se confirmed e OGGI ≥ date_from)
//    opzionale: genera un coupon “buono” sui giorni non goduti
r.put("/admin/:id/finish", ensureRole("admin"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { award_coupon = false, percent_override = null } = req.body ?? {};

    const db = await getDB();
    const b = await db.get(
      `SELECT id, status, date_from, date_to, unit_price FROM bookings WHERE id = ?`,
      id
    );
    if (!b) return res.status(404).json({ error: "Prenotazione non trovata" });
    if (b.status !== "confirmed")
      return res
        .status(409)
        .json({ error: "Si possono terminare solo prenotazioni confermate" });

    const today = todayStr();
    if (today < b.date_from) {
      return res
        .status(400)
        .json({
          error: "Non è possibile terminare prima dell’inizio. Usa annulla.",
        });
    }

    // Calcolo pro-rata giorni non goduti
    const totalDays = daysBetween(b.date_from, b.date_to);
    const usedUntil = today > b.date_to ? b.date_to : today;
    const usedDays = clamp(daysBetween(b.date_from, usedUntil), 0, totalDays);
    const remainingDays = clamp(totalDays - usedDays, 0, totalDays);

    // Aggiorna stato a finished
    await db.run(
      `UPDATE bookings SET status='finished', updated_at = datetime('now') WHERE id = ?`,
      id
    );

    let couponInfo = null;
    if (award_coupon && remainingDays > 0) {
      // percentuale pro-rata (o manuale se fornita)
      let pct =
        percent_override != null
          ? Number(percent_override)
          : Math.round((remainingDays / totalDays) * 100);

      pct = clamp(pct, 1, 100);

      const code = `BUONO-${id}-${Date.now().toString(36)}`.toUpperCase();
      const starts_at = today;
      // scadenza fra 6 mesi
      const expires = new Date();
      expires.setMonth(expires.getMonth() + 6);
      const expires_at = expires.toISOString().slice(0, 10);

      await CouponsDAO.create({
        code,
        discount_percent: pct,
        starts_at,
        expires_at,
        is_active: 1,
      });

      couponInfo = { code, discount_percent: pct, starts_at, expires_at };
    }

    // Rispondi con eventuale coupon creato
    return res.status(200).json({
      ok: true,
      coupon: couponInfo,
      meta: { totalDays, usedDays, remainingDays },
    });
  } catch (e) {
    next(e);
  }
});

export default r;
