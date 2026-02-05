// server/routes/reviews.js
import { Router } from "express";
import { ensureLoggedIn } from "../middlewares/auth.js";
import ReviewsDAO from "../dao/ReviewsDAO.js";

const r = Router();

r.get("/latest", async (req, res, next) => {
  try {
    const limit = Math.max(
      1,
      Math.min(24, parseInt(req.query.limit ?? "4", 10))
    );
    const offset = Math.max(0, parseInt(req.query.offset ?? "0", 10));

    const [rows, total] = await Promise.all([
      ReviewsDAO.listLatestApproved({ limit, offset }),
      ReviewsDAO.countApproved(),
    ]);

    res.json({ rows, total, limit, offset });
  } catch (e) {
    next(e);
  }
});

// GET /api/reviews/average
r.get("/average", async (req, res, next) => {
  try {
    const db = await (await import("../config/db.js")).getDB();
    const row = await db.get(
      `SELECT 
         ROUND(AVG(rating), 1) AS avg_rating,
         COUNT(*) AS count
       FROM reviews
       WHERE is_approved = 1`
    );
    res.json({
      avg: row?.avg_rating ?? 0,
      count: row?.count ?? 0,
    });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /api/reviews/:itemId
 * Ritorna:
 *   { reviews: [...approved], summary: { avg, count } }
 */
r.get("/:itemId", async (req, res, next) => {
  try {
    const itemId = Number.parseInt(req.params.itemId, 10);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      return res.status(400).json({ error: "itemId non valido" });
    }

    const [reviews, summary] = await Promise.all([
      ReviewsDAO.listApprovedByItem(itemId),
      ReviewsDAO.avgForItem(itemId),
    ]);

    return res.json({ reviews, summary });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /api/reviews/:itemId/eligibility
 * -> { canReview: boolean }
 */
r.get("/:itemId/eligibility", ensureLoggedIn, async (req, res, next) => {
  try {
    const itemId = Number.parseInt(req.params.itemId, 10);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      return res.status(400).json({ error: "itemId non valido" });
    }

    const canReview = await ReviewsDAO.userCanReview(req.user.id, itemId);
    return res.json({ canReview });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/reviews
 * body: { itemId, rating (1..5), comment? }
 * Ritorna:
 *   201 { ok: true, needsApproval: true }
 *   400/403 in caso di errore
 */
r.post("/", ensureLoggedIn, async (req, res, next) => {
  try {
    const body = req.body || {};
    const iid = Number.parseInt(body.itemId, 10);
    const rtt = Number.parseInt(body.rating, 10);
    const rawComment = (body.comment ?? "").toString();

    if (!Number.isInteger(iid) || iid <= 0) {
      return res.status(400).json({ error: "itemId non valido" });
    }
    if (!Number.isInteger(rtt) || rtt < 1 || rtt > 5) {
      return res.status(400).json({ error: "rating deve essere tra 1 e 5" });
    }

    // opzionale: normalizza il commento, max 300 char
    const comment = rawComment.trim().slice(0, 300);

    // Autorizzazione: l'utente deve aver noleggiato l'item
    const can = await ReviewsDAO.userCanReview(req.user.id, iid);
    if (!can) {
      return res
        .status(403)
        .json({ error: "Non puoi recensire questo elemento" });
    }

    // Crea recensione come "in attesa" (is_approved = 0) – il DAO lo fa di default
    await ReviewsDAO.create({
      userId: req.user.id,
      itemId: iid,
      rating: rtt,
      comment,
    });

    // Risposta coerente per la SPA
    return res.status(201).json({ ok: true, needsApproval: true });
  } catch (e) {
    next(e);
  }
});

export default r;
