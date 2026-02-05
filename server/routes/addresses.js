// server/routes/addresses.js
import { Router } from "express";
import { ensureAuth } from "./guards.js";
import AddressesDAO from "../dao/AddressesDAO.js";

const r = Router();
r.use(ensureAuth); // Proteggi tutte le rotte

// Lista indirizzi
r.get("/", async (req, res, next) => {
  try {
    const list = await AddressesDAO.listByUser(req.user.id);
    res.json(list);
  } catch (e) {
    next(e);
  }
});

// Aggiungi indirizzo
r.post("/", async (req, res, next) => {
  try {
    const { label, city, cap, address } = req.body;
    if (!city || !cap || !address) {
      return res.status(400).json({ error: "Dati incompleti" });
    }
    await AddressesDAO.create({
      userId: req.user.id,
      label,
      city,
      cap,
      address,
    });
    res.status(201).json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// Elimina indirizzo
r.delete("/:id", async (req, res, next) => {
  try {
    await AddressesDAO.delete(req.params.id, req.user.id);
    res.sendStatus(204);
  } catch (e) {
    next(e);
  }
});

export default r;
