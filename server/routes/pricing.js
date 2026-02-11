import { Router } from "express";
import { getDB } from "../config/db.js";
import CouponsDAO from "../dao/CouponsDAO.js";
import LoyaltyVoucherDAO from "../dao/LoyaltyVoucherDAO.js";

const r = Router();

r.get("/quote", async (req, res, next) => {
  try {
    const itemId = Number(req.query.itemId);
    const date_from = String(req.query.date_from || "");
    const date_to = String(req.query.date_to || "");
    const couponCode = String(req.query.couponCode || "").trim();

    // validazioni base
    const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
    if (!Number.isInteger(itemId)) {
      return res.status(400).json({ error: "itemId non valido" });
    }
    if (!ISO_DATE.test(date_from) || !ISO_DATE.test(date_to)) {
      return res
        .status(400)
        .json({ error: "Formato data non valido (YYYY-MM-DD)" });
    }

    // oggi (YYYY-MM-DD)
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const todayStr = `${yyyy}-${mm}-${dd}`;

    // niente passato
    if (date_from < todayStr) {
      return res
        .status(400)
        .json({ error: "La data di inizio non può essere nel passato" });
    }
    if (date_to < todayStr) {
      return res
        .status(400)
        .json({ error: "La data di fine non può essere nel passato" });
    }
    // intervallo coerente
    if (date_to < date_from) {
      return res.status(400).json({
        error: "La data di fine non può essere precedente alla data di inizio",
      });
    }

    // recupero item
    const db = await getDB();
    const item = await db.get(
      `SELECT id, price_per_day FROM items WHERE id = ?`,
      itemId
    );
    if (!item) {
      return res.status(404).json({ error: "Gonfiabile non trovato" });
    }

    // calcolo quote
    const days = daysBetween(date_from, date_to);
    if (days < 1) {
      return res.status(400).json({ error: "Intervallo date non valido" });
    }

    const unit = Number(item.price_per_day);
    const subtotal = round2(unit * days);

    // coupon (opzionale)
    let discount_percent = 0;
    if (couponCode) {
      if (couponCode.toUpperCase().startsWith("LCH-")) {
        // Codice tessera temporaneo: applica sconto solo se il buono è dell'utente ed è disponibile
        if (req.user?.id) {
          const lv = await LoyaltyVoucherDAO.findAvailableByCode(
            req.user.id,
            couponCode
          );
          if (lv) {
            discount_percent = Number(lv.discount_percent) || 0;
          }
        }
      } else {
        // Coupon classico (es. FESTA10)
        const c = await CouponsDAO.findByCode(couponCode);
        const chk = CouponsDAO.isCurrentlyValid(c);
        if (chk.valid) {
          discount_percent = Number(c.discount_percent) || 0;
        }
      }
    }

    const discount_amount = round2(subtotal * (discount_percent / 100));
    const total = round2(subtotal - discount_amount);

    res.json({
      days,
      unit_price: unit,
      subtotal,
      discount_percent,
      discount_amount,
      total,
    });
  } catch (e) {
    next(e);
  }
});

// utilità
function daysBetween(from, to) {
  const a = new Date(from + "T00:00:00Z");
  const b = new Date(to + "T00:00:00Z");
  return Math.floor((b - a) / 86400000) + 1; // inclusivo
}
function round2(x) {
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

export default r;
