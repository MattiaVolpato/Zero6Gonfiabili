import { Router } from "express";
import passport from "../config/passport.js";
import bcrypt from "bcrypt";
import UsersDAO from "../dao/UsersDAO.js";
import crypto from "crypto";
import { getMailer } from "../config/mail.js";
import db from "../config/db.js";

const r = Router();

function calcAgeYMD(yyyyMmDd) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(yyyyMmDd)) return null;
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  const birth = new Date(Date.UTC(y, m - 1, d));
  if (isNaN(birth)) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const mDiff = now.getUTCMonth() + 1 - m;
  const dDiff = now.getUTCDate() - d;
  if (mDiff < 0 || (mDiff === 0 && dDiff < 0)) age--;
  return age;
}

// me
r.get("/me", (req, res) => {
  if (!req.user) return res.json({ user: null });
  const { id, email, role, first_name, last_name, city, cap, address } =
    req.user;
  res.json({
    user: { id, email, role, first_name, last_name, city, cap, address },
  });
});

// LOGIN
r.post("/login", (req, res, next) => {
  passport.authenticate("local", async (err, user, info) => {
    if (err) return next(err);
    if (!user)
      return res
        .status(401)
        .json({ error: info?.message || "Credenziali non valide" });

    // opzionale: “ricordami” dal body
    const rememberMe = !!req.body.rememberMe;

    // Rigenera sessione per prevenire fixation
    req.session.regenerate((regenErr) => {
      if (regenErr) return next(regenErr);

      req.login(user, (loginErr) => {
        if (loginErr) return next(loginErr);

        // flag per durata lunga cookie
        req.session.rememberMe = rememberMe;

        // puoi salvare qualcosa in sessione se serve
        // req.session.lastLoginAt = Date.now();

        return res.json({
          user: {
            id: user.id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            role: user.role,
          },
        });
      });
    });
  })(req, res, next);
});

r.post("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);

    // distruggi la sessione sul server
    req.session?.destroy?.(() => { });

    // ⚠️ usa le stesse opzioni con cui hai creato i cookie
    const cookieOpts = {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    };

    // cookie di sessione (nome come da session.js)
    res.clearCookie("sid", cookieOpts);

    // se usi un cookie di remember-me nel tuo rememberMeMiddleware
    res.clearCookie("remember_me", { ...cookieOpts, httpOnly: true });

    // (opzionale) se hai un cookie CSRF httpOnly
    res.clearCookie("_csrf", { ...cookieOpts });

    return res.sendStatus(204);
  });
});

/*ping sessione*/
r.get("/session/keep-alive", (req, res) => {
  if (!req.user) return res.status(401).json({ ok: false });
  req.session.touch(); // rinnova l’expiration (rolling lo fa comunque, ma questo è esplicito)
  res.json({ ok: true, expires: req.session.cookie.expires });
});

// register (campi estesi + controllo età >= 15 anni)
r.post("/register", async (req, res, next) => {
  try {
    const {
      first_name = "",
      last_name = "",
      email = "",
      password = "",
      password2 = "",
      birthday = "",
      city = "",
      cap = "",
      address = "",
      phone = "",
    } = req.body ?? {};

    // Normalizza e valida
    const fn = first_name.trim();
    const ln = last_name.trim();
    const em = email.trim().toLowerCase();
    const pw = password.toString();
    const pw2 = password2.toString();
    const bd = birthday.trim();
    const age = calcAgeYMD(bd);
    if (age == null) {
      return res.status(400).json({ error: "Data di nascita non valida" });
    }
    if (age < 15) {
      return res
        .status(400)
        .json({ error: "Per registrarti devi avere almeno 15 anni" });
    }

    const ct = city.trim();
    const cp = cap.trim();
    const ad = address.trim();
    const ph = phone.replace(/\D/g, "");

    // === VALIDAZIONI ===
    if (!fn || !ln)
      return res.status(400).json({ error: "Nome e cognome obbligatori" });
    if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em))
      return res.status(400).json({ error: "Email non valida" });
    if (pw.length < 6)
      return res.status(400).json({ error: "Password minima di 6 caratteri" });
    if (pw !== pw2)
      return res.status(400).json({ error: "Le password non coincidono" });
    if (!bd || !/^\d{4}-\d{2}-\d{2}$/.test(bd))
      return res.status(400).json({ error: "Data di nascita obbligatoria" });
    if (!ct) return res.status(400).json({ error: "Città obbligatoria" });
    if (!cp || !/^\d{5}$/.test(cp))
      return res.status(400).json({ error: "CAP obbligatorio (5 cifre)" });
    if (!ad) return res.status(400).json({ error: "Indirizzo obbligatorio" });
    if (!/^\d{10}$/.test(ph))
      return res
        .status(400)
        .json({ error: "Telefono obbligatorio (10 cifre numeriche)" });

    // === DUPLICATI ===
    const exists = await UsersDAO.findByEmail(em);
    if (exists) return res.status(409).json({ error: "Email già registrata" });

    // === CREA ACCOUNT ===
    const hash = await bcrypt.hash(pw, 10);
    const newUser = await UsersDAO.create({
      first_name: fn,
      last_name: ln,
      email: em,
      password_hash: hash,
      birthday: bd,
      city: ct,
      cap: cp,
      address: ad,
      phone: ph,
    });

    // Autenticazione automatica
    req.login(newUser, (err) => {
      if (err) return next(err);
      res.status(201).json({ user: newUser });
    });
  } catch (e) {
    next(e);
  }
});

// ==========================================
//      RECUPERO PASSWORD (RESET)
// ==========================================

// 1. Richiesta Password Dimenticata
r.post("/forgot-password", async (req, res) => {
  // Rinominiamo la variabile destrutturata per chiarezza
  const { email: rawEmail } = req.body;

  if (!rawEmail) return res.status(400).json({ error: "Email richiesta" });

  // 1. NORMALIZZAZIONE: Trasforma in minuscolo e toglie spazi (come nella registrazione)
  const email = rawEmail.trim().toLowerCase();

  try {
    // Cerca utente: Usa await db.get direttamente (senza callback)
    const user = await db.get("SELECT * FROM users WHERE email = ?", [email]);

    // Se l'utente non esiste, fingiamo che sia andato tutto bene per privacy
    if (!user) {
      // In sviluppo può essere utile vedere questo log, in prod no
      return res.json({ message: "Se l'email esiste, riceverai istruzioni." });
    }

    // Genera token e scadenza (1 ora)
    const token = crypto.randomBytes(32).toString("hex");
    const expires = Date.now() + 3600000;

    // Salva token su DB: Usa await db.run direttamente
    await db.run(
      "UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?",
      [token, expires, user.id]
    );

    // Ottieni il mailer e invia
    const transporter = await getMailer();

    // Costruisci il link
    const baseUrl = process.env.BASE_URL || "http://localhost:3000";
    const resetLink = `${baseUrl}/reset-password/${token}`;


    await transporter.sendMail({
      from: process.env.MAIL_FROM || "noreply@zerosei.it",
      to: email,
      subject: "Reset Password - ZeroSei",
      text: `Hai richiesto il reset della password.\nCopia questo link per reimpostarla: ${resetLink}\nIl link scade in 1 ora.`,
    });

    res.json({ message: "Se l'email esiste, riceverai istruzioni." });
  } catch (err) {
    console.error("Errore forgot-password:", err);
    // Rispondi con errore JSON così il frontend lo gestisce e toglie "invio in corso..."
    res.status(500).json({ error: "Errore interno del server" });
  }
});

// 2. Salvataggio Nuova Password
r.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword)
    return res.status(400).json({ error: "Dati mancanti" });

  try {
    // Trova utente con token valido e non scaduto: Usa await db.get
    const user = await db.get(
      "SELECT * FROM users WHERE reset_token = ? AND reset_expires > ?",
      [token, Date.now()]
    );

    if (!user)
      return res.status(400).json({ error: "Token non valido o scaduto" });

    // Hash nuova password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Aggiorna password e pulisci token: Usa await db.run
    await db.run(
      "UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?",
      [hashedPassword, user.id]
    );

    res.json({ message: "Password aggiornata con successo." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore reset password" });
  }
});

export default r;
