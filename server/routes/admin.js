// server/routes/admin.js
import { Router } from "express";
import { ensureAuth, ensureRole } from "./guards.js";
import AdminDAO from "../dao/AdminDAO.js";
import UsersDAO from "../dao/UsersDAO.js";
import NewsletterDAO from "../dao/NewsletterDAO.js";
import BlogDAO from "../dao/BlogDAO.js";
import { sendNewsletterCampaign } from "../services/newsletterSender.js";

const r = Router();

// Protezione globale per tutti i percorsi admin
r.use(ensureAuth, ensureRole("admin"));

// ---- ITEMS ----
r.get("/items", async (req, res, next) => {
  try {
    const filter = (req.query.filter || "all").toString();
    res.json(await AdminDAO.allItems(filter));
  } catch (e) {
    next(e);
  }
});

r.post("/items", async (req, res, next) => {
  try {
    const { name, description, price_per_day, image_url } = req.body ?? {};
    if (!name || price_per_day == null) {
      return res.status(400).json({ error: "Dati mancanti" });
    }
    const id = await AdminDAO.createItem({
      name,
      description,
      price_per_day,
      image_url,
    });
    res.status(201).json({ id });
  } catch (e) {
    next(e);
  }
});

r.put("/items/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { name, description, price_per_day, image_url, is_active } =
      req.body ?? {};
    await AdminDAO.updateItem({
      id,
      name,
      description,
      price_per_day,
      image_url,
      is_active,
    });
    res.sendStatus(204);
  } catch (e) {
    next(e);
  }
});

r.delete("/items/:id", async (req, res, next) => {
  try {
    await AdminDAO.deleteItem(Number(req.params.id));
    res.sendStatus(204);
  } catch (e) {
    next(e);
  }
});

// ---- COUPONS ----
r.get("/coupons", async (req, res, next) => {
  try {
    const filter = (req.query.filter || "all").toString();
    res.json(await AdminDAO.allCoupons(filter));
  } catch (e) {
    next(e);
  }
});

r.post("/coupons", async (req, res, next) => {
  try {
    const { code, discount_percent, starts_at, expires_at, is_active } =
      req.body ?? {};
    if (!code || discount_percent == null) {
      return res.status(400).json({ error: "Dati mancanti" });
    }
    const id = await AdminDAO.createCoupon({
      code,
      discount_percent,
      starts_at,
      expires_at,
      is_active,
    });
    res.status(201).json({ id });
  } catch (e) {
    next(e);
  }
});

r.put("/coupons/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { code, discount_percent, starts_at, expires_at, is_active } =
      req.body ?? {};
    await AdminDAO.updateCoupon({
      id,
      code,
      discount_percent,
      starts_at,
      expires_at,
      is_active,
    });
    res.sendStatus(204);
  } catch (e) {
    next(e);
  }
});

r.put("/coupons/:id/toggle", async (req, res, next) => {
  try {
    await AdminDAO.toggleCoupon(Number(req.params.id), !!req.body?.active);
    res.sendStatus(204);
  } catch (e) {
    next(e);
  }
});

r.delete("/coupons/:id", async (req, res, next) => {
  try {
    await AdminDAO.deleteCoupon(Number(req.params.id));
    res.sendStatus(204);
  } catch (e) {
    next(e);
  }
});

// ---- NEWSLETTER ----
r.get("/newsletter", async (req, res, next) => {
  try {
    const filter = (req.query.filter || "all").toString();
    res.json(await AdminDAO.allSubscribers(filter));
  } catch (e) {
    next(e);
  }
});

/**
 * Nuova route "ufficiale" per il toggle attiva/disattiva:
 * PATCH /api/admin/newsletter/:id  { is_active: true|false }
 * Ritorna JSON, così la UI può reagire subito.
 */
r.patch("/newsletter/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "ID non valido" });
    }
    const isActive = !!req.body?.is_active;
    const ok = await NewsletterDAO.setActiveById(id, isActive);
    if (!ok) return res.status(404).json({ error: "Iscrizione non trovata" });
    res.status(200).json({ ok: true, id, is_active: isActive });
  } catch (e) {
    next(e);
  }
});

/**
 * Route legacy rimasta compatibile con la UI precedente:
 * PUT /api/admin/newsletter/:id/toggle  { active: true|false }
 * Usa la stessa logica della PATCH sopra.
 */
r.put("/newsletter/:id/toggle", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "ID non valido" });
    }
    const isActive = !!req.body?.active;
    const ok = await AdminDAO.setSubscriberActive(id, isActive);
    if (!ok) return res.status(404).json({ error: "Iscrizione non trovata" });
    res.sendStatus(204);
  } catch (e) {
    next(e);
  }
});

r.delete("/newsletter/:id", async (req, res, next) => {
  try {
    await AdminDAO.deleteSubscriber(Number(req.params.id));
    res.sendStatus(204);
  } catch (e) {
    next(e);
  }
});

// Quanti iscritti attivi (per mostrare badge/numero in UI)
r.get("/newsletter/count", async (_req, res, next) => {
  try {
    const n = await NewsletterDAO.countActive();
    res.json({ active: n });
  } catch (e) {
    next(e);
  }
});

// Invio campagna
// body: { subject, html?, text?, previewEmail? }
r.post("/newsletter/send", async (req, res, next) => {
  try {
    const { subject, html, text, previewEmail } = req.body ?? {};
    const result = await sendNewsletterCampaign({
      subject,
      html,
      text,
      previewEmail,
    });
    res.json(result);
  } catch (e) {
    next(e);
  }
});

// ---- USERS ----
r.get("/users", async (req, res, next) => {
  try {
    const q = (req.query.q || "").toString();
    res.json(await AdminDAO.allUsers(q));
  } catch (e) {
    next(e);
  }
});

// Versione unica e definitiva: usa il DAO che fa fallback email + autoripara user_id
r.get("/users/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "ID non valido" });
    }
    const data = await AdminDAO.userDetails(id);
    if (!data?.user) {
      return res.status(404).json({ error: "Utente non trovato" });
    }
    res.json(data);
  } catch (e) {
    next(e);
  }
});

// elimina utente (solo admin)
r.delete("/users/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id))
      return res.status(400).json({ error: "ID non valido" });

    const target = await UsersDAO.findById(id);
    if (!target) return res.status(404).json({ error: "Utente non trovato" });

    if ((target.role || "").toLowerCase() === "admin") {
      return res
        .status(403)
        .json({ error: "Non è possibile eliminare un amministratore" });
    }

    await UsersDAO.deleteUserDeep(id);
    return res.sendStatus(204);
  } catch (err) {
    // log utile per capire eventuali FK che bloccano
    console.error("Admin delete user failed:", err);
    return res
      .status(500)
      .json({ error: err.message || "Errore eliminazione" });
  }
});

// ---- BLOG ----
r.get("/blog", async (req, res, next) => {
  try {
    res.json(await BlogDAO.listAll());
  } catch (e) {
    next(e);
  }
});

r.post("/blog", async (req, res, next) => {
  try {
    const { title, content, image_url, is_published } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: "Titolo e contenuto obbligatori" });
    }
    const id = await BlogDAO.create({ title, content, image_url, is_published });
    res.status(201).json({ id });
  } catch (e) {
    next(e);
  }
});

r.put("/blog/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { title, content, image_url, is_published } = req.body;
    await BlogDAO.update(id, { title, content, image_url, is_published });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

r.delete("/blog/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await BlogDAO.delete(id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});


export default r;
