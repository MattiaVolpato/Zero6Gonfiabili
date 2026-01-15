import { Router } from "express";
import bcrypt from "bcrypt";
import UsersDAO from "../dao/UsersDAO.js";
import { ensureAuth } from "./guards.js";

const r = Router();

// Tutto protetto: deve essere loggato
r.use(ensureAuth);

/**
 * GET /api/users/me  -> dati pubblici profilo
 */
r.get("/me", async (req, res, next) => {
  try {
    const me = await UsersDAO.findPublicById(req.user.id);
    res.json(me);
  } catch (e) {
    next(e);
  }
});

/**
 * PUT /api/users/me  -> aggiorna profilo (no email/password)
 * body: { first_name, last_name, city, cap, address, phone }
 */
// server/routes/users.js (solo handler PUT /me)
r.put("/me", async (req, res, next) => {
  try {
    const body = req.body ?? {};
    const first_name = (body.first_name || "").toString().trim();
    const last_name = (body.last_name || "").toString().trim();
    const city = (body.city || "").toString().trim();
    const cap = (body.cap || "").toString().trim();
    const address = (body.address || "").toString().trim();
    const phoneRaw = (body.phone || "").toString().trim();

    // normalizza telefono rimuovendo non-cifre
    const phone = phoneRaw.replace(/\D/g, "");

    // validazioni
    if (!first_name || !last_name)
      return res.status(400).json({ error: "Nome e cognome sono obbligatori" });
    if (cap && !/^\d{5}$/.test(cap))
      return res.status(400).json({ error: "CAP non valido (5 cifre)" });
    if (!/^\d{10}$/.test(phone))
      return res
        .status(400)
        .json({ error: "Telefono obbligatorio: inserisci 10 cifre" });

    const updated = await UsersDAO.updateProfile(req.user.id, {
      first_name,
      last_name,
      city,
      cap,
      address,
      phone,
    });

    res.json(updated);
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/users/change-password
 * body: { current_password, new_password }
 */
r.post("/change-password", async (req, res, next) => {
  try {
    const { current_password = "", new_password = "" } = req.body ?? {};
    if (new_password.length < 6)
      return res
        .status(400)
        .json({ error: "La nuova password deve avere almeno 6 caratteri" });

    const row = await UsersDAO.getSensitiveById(req.user.id);
    if (!row) return res.status(401).json({ error: "Utente non trovato" });

    const ok = await bcrypt.compare(current_password, row.password_hash);
    if (!ok) return res.status(401).json({ error: "Password attuale errata" });

    const hash = await bcrypt.hash(new_password, 10);
    await UsersDAO.setPasswordHash(req.user.id, hash);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

/**
 * DELETE /api/users/me  { current_password }
 * Richiede password attuale; cancella account + logout
 */
r.delete("/me", async (req, res, next) => {
  try {
    if (req.user?.role === "admin") {
      return res.status(403).json({
        error: "Gli account amministratore non possono essere eliminati",
      });
    }
    const { current_password = "" } = req.body ?? {};
    const row = await UsersDAO.getSensitiveById(req.user.id);
    if (!row) return res.status(401).json({ error: "Utente non trovato" });

    const ok = await bcrypt.compare(current_password, row.password_hash);
    if (!ok) return res.status(401).json({ error: "Password attuale errata" });

    await UsersDAO.deleteUserDeep(req.user.id);

    // termina la sessione
    req.logout((err) => {
      if (err) return next(err);
      res.status(204).end();
    });
  } catch (e) {
    next(e);
  }
});

export default r;
