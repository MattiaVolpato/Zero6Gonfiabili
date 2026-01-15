// server/routes/children.js
import { Router } from "express";
import { ensureAuth } from "./guards.js";
import ChildrenDAO from "../dao/ChildrenDAO.js";
// ⬇️ per far partire subito il controllo promemoria in dev
import { runBirthdayReminderOnce } from "../services/birthdayReminder.js";

const r = Router();

// Util: valida davvero una data YYYY-MM-DD (non solo la forma)
function isValidDateYMD(ymd) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

// GET /api/children
r.get("/", ensureAuth, async (req, res, next) => {
  try {
    const rows = await ChildrenDAO.listForUser(req.user.id);
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// POST /api/children { name, birthday(YYYY-MM-DD) }
r.post("/", ensureAuth, async (req, res, next) => {
  try {
    const { name, birthday } = req.body ?? {};
    const trimmedName = (name || "").toString().trim();

    if (!trimmedName || !birthday) {
      return res
        .status(400)
        .json({ error: "Nome e data di nascita richiesti" });
    }
    if (!isValidDateYMD(birthday)) {
      return res
        .status(400)
        .json({ error: "Data non valida (usa formato YYYY-MM-DD)" });
    }

    const id = await ChildrenDAO.create({
      userId: req.user.id,
      name: trimmedName,
      birthday,
    });

    // 🔔 In DEV: lancia subito il job dei promemoria (non blocca la risposta)
    if (process.env.NODE_ENV !== "production") {
      setImmediate(() => {
        runBirthdayReminderOnce().catch(() => {});
      });
    }

    res.status(201).json({ id });
  } catch (e) {
    next(e);
  }
});

// DELETE /api/children/:id
r.delete("/:id", ensureAuth, async (req, res, next) => {
  try {
    const childId = Number(req.params.id);
    if (!Number.isInteger(childId) || childId <= 0) {
      return res.status(400).json({ error: "id non valido" });
    }
    const ok = await ChildrenDAO.remove({ userId: req.user.id, childId });
    if (!ok) return res.status(404).json({ error: "Record non trovato" });

    // opzionale: in dev puoi rilanciare il job anche dopo la cancellazione
    // if (process.env.NODE_ENV !== "production") {
    //   setImmediate(() => runBirthdayReminderOnce().catch(() => {}));
    // }

    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

export default r;
