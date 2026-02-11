// server/routes/items.js
import { Router } from "express";
import ItemsDAO from "../dao/ItemsDAO.js";

const r = Router();

// Lista con filtri
r.get("/", async (req, res, next) => {
  try {
    const q = (req.query.q || "").toString().trim();
    const maxPrice =
      req.query.maxPrice !== undefined ? Number(req.query.maxPrice) : undefined;

    // Normalizza date: se arriva solo date_from, la SPA già imposta date_to = date_from
    const dateFrom = (req.query.date_from || "").toString().trim();
    const dateTo = (req.query.date_to || "").toString().trim();

    const rows = await ItemsDAO.searchWithFilters({
      q,
      maxPrice: Number.isNaN(maxPrice) ? undefined : maxPrice,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    });

    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// Dettaglio
r.get("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "id non valido" });
    }
    const it = await ItemsDAO.findById(id);
    if (!it) return res.status(404).json({ error: "Gonfiabile non trovato" });
    // restituisci direttamente l'oggetto (il tuo client gestisce sia raw che {item})
    res.json(it);
  } catch (e) {
    next(e);
  }
});

export default r;
