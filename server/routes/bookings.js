// server/routes/bookings.js
import { Router } from "express";
import { ensureAuth, ensureRole } from "./guards.js";
import { getDB } from "../config/db.js";
import BookingsDAO from "../dao/BookingsDAO.js";
import CouponsDAO from "../dao/CouponsDAO.js";
import LoyaltyDAO from "../dao/LoyaltyDAO.js";
import LoyaltyVoucherDAO from "../dao/LoyaltyVoucherDAO.js";

const r = Router();

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function todayYMD() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function daysBetweenUTC(from, to) {
  const a = new Date(`${from}T00:00:00.000Z`);
  const b = new Date(`${to}T00:00:00.000Z`);
  return Math.floor((b - a) / 86400000) + 1;
}

function round2(x) {
  return Math.round((Number(x) + Number.EPSILON) * 100) / 100;
}

// Pulizia prenotazioni scadute
async function sweepAgingBookings() {
  try {
    const db = await getDB();
    await db.run(
      `UPDATE bookings
       SET status = 'cancelled', updated_at = datetime('now')
       WHERE status = 'pending' AND date('now') > date(date_to)`
    );
    await db.run(
      `UPDATE bookings
       SET status = 'finished', updated_at = datetime('now')
       WHERE status = 'confirmed' AND date('now') > date(date_to)`
    );
  } catch (e) {
    // Ignora errori di lock durante lo sweep background
    console.warn("Sweep saltato per lock DB");
  }
}

// === UTENTE: elenco proprie prenotazioni ===
r.get("/mine", ensureAuth, async (req, res, next) => {
  try {
    await sweepAgingBookings(); // Qui va bene, è lettura
    const rows = await BookingsDAO.listForUser(req.user.id);
    const today = todayYMD();
    const out = rows.map((b) => {
      const isPast = today > b.date_to;
      const status_label = isPast
        ? b.status === "pending"
          ? "annullato"
          : b.status === "confirmed"
            ? "terminato"
            : b.status_label
        : b.status_label;
      return { ...b, is_finished: isPast ? 1 : b.is_finished, status_label };
    });
    res.json(out);
  } catch (e) {
    next(e);
  }
});

// === UTENTE: crea prenotazione ===
r.post("/", ensureAuth, async (req, res, next) => {
  let txOpened = false;
  const db = await getDB();

  try {
    // 1. Estrai anche paymentMethod
    const { itemId, date_from, date_to, couponCode, addressId, paymentMethod } =
      req.body ?? {};

    // NOTA: Rimossa sweepAgingBookings() qui per evitare SQLITE_BUSY e velocizzare

    // 2. Validazioni
    if (Array.isArray(couponCode)) {
      return res
        .status(400)
        .json({ error: "È possibile usare un solo buono per prenotazione" });
    }

    if (!itemId || !date_from || !date_to || !addressId || !paymentMethod) {
      return res.status(400).json({
        error: "Dati incompleti (indirizzo o pagamento mancanti)",
      });
    }

    if (!ISO.test(date_from) || !ISO.test(date_to)) {
      return res
        .status(400)
        .json({ error: "Formato data non valido (YYYY-MM-DD)" });
    }

    const today = todayYMD();
    if (date_from < today || date_to < today) {
      return res
        .status(400)
        .json({ error: "Le date non possono essere nel passato" });
    }
    if (date_to < date_from) {
      return res
        .status(400)
        .json({ error: "La data di fine non può precedere la data di inizio" });
    }

    // 3. Recupera dati (indirizzo, item)
    const addrRow = await db.get(
      "SELECT address, city, cap FROM addresses WHERE id = ? AND user_id = ?",
      [addressId, req.user.id]
    );

    if (!addrRow) {
      return res
        .status(400)
        .json({ error: "Indirizzo di spedizione non valido" });
    }

    const shipping_address = `${addrRow.address}, ${addrRow.city} (${addrRow.cap})`;

    const item = await db.get(
      `SELECT id, price_per_day FROM items WHERE id = ?`,
      Number(itemId)
    );
    if (!item) {
      return res.status(404).json({ error: "Gonfiabile non trovato" });
    }

    const free = await BookingsDAO.isAvailable(
      Number(itemId),
      date_from,
      date_to
    );
    if (!free) {
      return res.status(400).json({
        error: "Gonfiabile non disponibile per le date selezionate",
      });
    }

    // 4. Logica pagamento (simulata)
    let payment_status = "unpaid";
    if (["credit_card", "paypal"].includes(paymentMethod)) {
      payment_status = "paid";
    }

    // 5. Coupon e Calcoli
    let coupon_code = null;
    let discount_percent = 0;
    let appliedLoyalty = false;
    let loyaltyVoucherId = null;

    const trimmedCode = (couponCode || "").toString().trim();

    // INIZIO TRANSAZIONE
    await db.exec("BEGIN IMMEDIATE");
    txOpened = true;

    if (trimmedCode) {
      const lv = await db.get(
        `SELECT id, code, discount_percent FROM loyalty_vouchers 
         WHERE user_id = ? AND code = ? AND status = 'available' 
         AND (expires_at IS NULL OR expires_at > datetime('now'))`,
        req.user.id,
        trimmedCode
      );

      if (lv) {
        coupon_code = lv.code;
        discount_percent = Number(lv.discount_percent) || 0;
        appliedLoyalty = true;
        loyaltyVoucherId = lv.id;
      } else {
        const c = await CouponsDAO.findByCode(trimmedCode);
        const check = CouponsDAO.isCurrentlyValid(c);
        if (!check || !check.valid) {
          await db.exec("ROLLBACK");
          return res
            .status(400)
            .json({ error: "Coupon non valido per la prenotazione" });
        }
        coupon_code = c.code;
        discount_percent = Number(c.discount_percent) || 0;
      }
    }

    const unit_price = Number(item.price_per_day);
    const days = daysBetweenUTC(date_from, date_to);
    const subtotal = round2(unit_price * days);
    const discount_amount = round2(subtotal * (discount_percent / 100));
    const final_price = round2(subtotal - discount_amount);

    // 6. Salvataggio
    const bookingId = await BookingsDAO.create({
      user_id: req.user.id,
      item_id: Number(itemId),
      date_from,
      date_to,
      coupon_code,
      unit_price,
      discount_percent,
      final_price,
      shipping_address,
      payment_method: paymentMethod, // <--- Salviamo il metodo
      payment_status, // <--- Salviamo lo stato
    });

    // Consumo buono fedeltà
    if (appliedLoyalty && loyaltyVoucherId) {
      const upd = await db.run(
        `UPDATE loyalty_vouchers SET status = 'used', used_at = datetime('now')
         WHERE id = ? AND user_id = ? AND status = 'available'`,
        loyaltyVoucherId,
        req.user.id
      );
      if (!upd || upd.changes !== 1) {
        await db.exec("ROLLBACK");
        return res.status(400).json({ error: "Codice già usato" });
      }
      try {
        await LoyaltyDAO.redeemOnBooking({ userId: req.user.id, bookingId });
      } catch { }
    }

    await db.exec("COMMIT");
    txOpened = false;

    res.status(201).json({
      id: bookingId,
      appliedLoyalty,
      discount_percent,
      final_price,
      payment_status, // info utile al client
    });
  } catch (e) {
    if (txOpened) {
      try {
        await db.exec("ROLLBACK");
      } catch { }
    }
    next(e);
  }
});

// === UTENTE: annulla prenotazione (non annullabile se 'finished' o 'rejected') ===
r.delete("/:id", ensureAuth, async (req, res, next) => {
  try {
    const bookingId = Number(req.params.id);
    if (!Number.isInteger(bookingId)) {
      return res.status(400).json({ error: "id non valido" });
    }
    const ok = await BookingsDAO.cancel({ userId: req.user.id, bookingId });
    if (!ok) {
      return res
        .status(404)
        .json({ error: "Prenotazione non trovata o non annullabile" });
    }
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

// === ADMIN: elenco prenotazioni con filtri ===
r.get("/admin/list", ensureRole("admin"), async (req, res, next) => {
  try {
    const status = (req.query.status || "all").toString();
    const q = (req.query.q || "").toString().trim();
    const id = req.query.id ? Number(req.query.id) : undefined;
    const itemId = req.query.itemId ? Number(req.query.itemId) : undefined;
    const userId = req.query.userId ? Number(req.query.userId) : undefined;
    const date_from = ISO.test(req.query.date_from || "")
      ? req.query.date_from
      : "";
    const date_to = ISO.test(req.query.date_to || "") ? req.query.date_to : "";

    // === MODIFICA QUI ===
    // Proviamo a fare pulizia, ma se il DB è occupato (SQLITE_BUSY) ignoriamo l'errore
    // così la pagina Admin carica lo stesso.
    try {
      await sweepAgingBookings();
    } catch (warn) {
      console.warn("Manutenzione skip (DB occupato):", warn.message);
    }
    // ====================

    // Lista con filtro sullo status effettivo direttamente in SQL
    const rows = await BookingsDAO.listAll({
      status,
      q,
      id,
      itemId,
      userId,
      date_from,
      date_to,
    });

    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// === ADMIN: transizioni stato (con regole dentro BookingsDAO.adminUpdateStatus) ===
r.put("/admin/:id/confirm", ensureRole("admin"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "bad_id" });
    const out = await BookingsDAO.adminUpdateStatus(id, "confirmed");
    if (!out.ok)
      return res.status(409).json({ error: out.reason || "update_failed" });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

r.put("/admin/:id/reject", ensureRole("admin"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "bad_id" });
    const out = await BookingsDAO.adminUpdateStatus(id, "rejected");
    if (!out.ok)
      return res.status(409).json({ error: out.reason || "update_failed" });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

r.put("/admin/:id/cancel", ensureRole("admin"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "bad_id" });
    const out = await BookingsDAO.adminUpdateStatus(id, "cancelled");
    if (!out.ok)
      return res.status(409).json({ error: out.reason || "update_failed" });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

// === ADMIN: finisci prenotazione + emetti buoni "ottenuti" (nuovi) ===
r.put("/admin/:id/finish", ensureRole("admin"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "bad_id" });

    const out = await BookingsDAO.adminUpdateStatus(id, "finished");
    if (!out.ok)
      return res.status(409).json({ error: out.reason || "update_failed" });

    // [LOYALTY VOUCHERS] — crea i buoni mancanti per l'utente della prenotazione
    const userId = out?.booking?.user_id;
    if (userId) {
      const completed = await LoyaltyDAO.getCompletedFinishedCount(userId);
      await LoyaltyVoucherDAO.ensureUpToDate(userId, completed);
    }

    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

// === ADMIN: Segna come pagato ===
r.patch("/admin/:id/pay", ensureRole("admin"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await BookingsDAO.updatePaymentStatus(id, "paid");
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

export default r;
