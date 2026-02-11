// server/routes/newsletter.js
import { Router } from "express";
import { getDB } from "../config/db.js"; // <-- FIX: import mancante
import NewsletterDAO from "../dao/NewsletterDAO.js";

const r = Router();

// POST /api/newsletter/subscribe  { email }
r.post("/subscribe", async (req, res, next) => {
  try {
    const raw = (req.body?.email || "").toString().trim();
    const email = raw.toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return res.status(400).json({ error: "Email non valida" });
    }

    // se loggato e le email combaciano, collega l'utente
    const userId =
      req.user && req.user.email?.toLowerCase() === email ? req.user.id : null;

    await NewsletterDAO.subscribe({ email, userId });

    return res.status(201).json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// POST /api/newsletter/unsubscribe  { email }
r.post("/unsubscribe", async (req, res, next) => {
  try {
    const email = (req.body?.email || "").toString().trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return res.status(400).json({ error: "Email non valida" });
    }

    const ok = await NewsletterDAO.unsubscribe(email);
    if (!ok) return res.status(404).json({ error: "Email non trovata" });

    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

// GET /api/newsletter/status?email=...
r.get("/status", async (req, res, next) => {
  try {
    const email = (req.query?.email || "").toString().trim().toLowerCase();
    if (!email) return res.status(400).json({ error: "Email richiesta" });
    const st = await NewsletterDAO.status(email);
    res.json(st);
  } catch (e) {
    next(e);
  }
});

export default r;
