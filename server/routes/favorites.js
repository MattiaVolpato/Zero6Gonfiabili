// server/routes/favorites.js
import { Router } from "express";
import { ensureLoggedIn } from "../middlewares/auth.js";
import FavoritesDAO from "../dao/FavoritesDAO.js";
import ItemsDAO from "../dao/ItemsDAO.js";

const r = Router();

// tutte le rotte preferiti richiedono login
r.use(ensureLoggedIn);

/**
 * GET /api/favorites/items
 * Ritorna la lista degli item preferiti dell'utente, come array di oggetti.
 * Accetta che FavoritesDAO.listIdsByUser possa restituire numeri o oggetti {item_id}.
 */
r.get("/items", async (req, res, next) => {
  try {
    const raw = await FavoritesDAO.listIdsByUser(req.user.id);

    // normalizza: array di interi unici
    const seen = new Set();
    const ids = [];
    for (const row of raw || []) {
      const v = typeof row === "number" ? row : row?.item_id ?? row?.id;
      const n = Number(v);
      if (Number.isInteger(n) && n > 0 && !seen.has(n)) {
        seen.add(n);
        ids.push(n);
      }
    }

    if (ids.length === 0) return res.json([]);

    // items coerenti: assicurati che il DAO ritorni almeno id, name, price_per_day, image_url/cover_url e (se disponibili) avg_rating, reviews_count
    const items = await ItemsDAO.findByIds(ids);
    // fallback sicuro: se il DAO tornasse un singolo oggetto
    const out = Array.isArray(items) ? items : items ? [items] : [];
    return res.json(out);
  } catch (e) {
    next(e);
  }
});

/** GET /api/favorites -> array semplice di ID */
r.get("/", async (req, res, next) => {
  try {
    const raw = await FavoritesDAO.listIdsByUser(req.user.id);
    const ids = []
      .concat(raw || [])
      .map((row) =>
        Number(typeof row === "number" ? row : row?.item_id ?? row?.id)
      )
      .filter((n) => Number.isInteger(n) && n > 0);
    res.json(ids);
  } catch (e) {
    next(e);
  }
});

/** POST /api/favorites/:itemId */
r.post("/:itemId", async (req, res, next) => {
  try {
    const itemId = Number(req.params.itemId);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      return res.status(400).json({ error: "itemId non valido" });
    }
    await FavoritesDAO.add(req.user.id, itemId);
    res.status(201).json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/** DELETE /api/favorites/:itemId */
r.delete("/:itemId", async (req, res, next) => {
  try {
    const itemId = Number(req.params.itemId);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      return res.status(400).json({ error: "itemId non valido" });
    }
    await FavoritesDAO.remove(req.user.id, itemId);
    res.sendStatus(204);
  } catch (e) {
    next(e);
  }
});

export default r;
