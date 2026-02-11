import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import csurf from "csurf";
import "dotenv/config";

import loyaltyRoutes from "./routes/loyalty.js";
import loyaltyVouchersRouter from "./routes/loyalty-vouchers.js";

import {
  startBirthdayReminderScheduler,
  runBirthdayReminderOnce,
} from "./services/birthdayReminder.js";

import viewsRouter from "./routes/views.js";
import itemsRouter from "./routes/items.js";
import authRouter from "./routes/auth-routes.js";
import favoritesRouter from "./routes/favorites.js";
import bookingsRouter from "./routes/bookings.js";
import childrenRouter from "./routes/children.js";
import couponsRouter from "./routes/coupons.js";
import newsletterRouter from "./routes/newsletter.js";
import adminRouter from "./routes/admin.js";
import passport from "./config/passport.js";
import usersRouter from "./routes/users.js";
import pricingRouter from "./routes/pricing.js";
import reviewsRouter from "./routes/reviews.js";
import { makeSessionMiddleware } from "./config/session.js";
import adminReviewsRouter from "./routes/admin-reviews.js";
import addressesRouter from "./routes/addresses.js";
import blogRouter from "./routes/blog.js";

// ====== __dirname / __filename (PRIMA di usarli) ======
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ====== App (PRIMA di usarla) ======
const app = express();

/* ---------------- Sicurezza base ---------------- */
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'"],
        "style-src": ["'self'"],
        "img-src": ["'self'", "data:"], // consenti eventuali data: nei <img>
        "font-src": ["'self'"],
        "connect-src": ["'self'"], // fetch/XHR solo verso il tuo origin
        "frame-ancestors": ["'self'"],
        "base-uri": ["'self'"],
        "form-action": ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false, // mantenere a false se si hanno asset legacy
  })
);
app.use(helmet.referrerPolicy({ policy: "same-origin" }));
app.use(helmet.frameguard({ action: "sameorigin" }));

/* ---------------- Parsers ---------------- */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

/* ---------------- Proxy ---------------- */
if (process.env.TRUST_PROXY === "1") {
  app.set("trust proxy", 1);
}

/* ---------------- Sessione (PRIMA di passport) ---------------- */
const [sessionMiddleware, rememberMeMiddleware] = makeSessionMiddleware({
  dbFile: "./server/db/app.sqlite",
});
app.use(sessionMiddleware);
app.use(rememberMeMiddleware);

/* ---------------- Passport ---------------- */
app.use(passport.initialize());
app.use(passport.session());

/* ---------------- CSRF ---------------- */
const csrfProtection = csurf({
  cookie: {
    key: "_csrf",
    httpOnly: true,
    sameSite: "lax",
    secure: false, // true solo in produzione su HTTPS
  },
});
app.get("/api/csrf", csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});
app.use((req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  if (req.path.startsWith("/api/")) return csrfProtection(req, res, next);
  return next();
});

// Rende visibile alle EJS se l'utente è autenticato
app.use((req, res, next) => {
  res.locals.isAuthenticated =
    typeof req.isAuthenticated === "function" ? req.isAuthenticated() : false;
  res.locals.user = req.user || null;
  next();
});

/* ---------------- Env mode (per banner DEV mail) ---------------- */
app.get("/api/env-mode", (_req, res) => {
  const mailMode = process.env.SMTP_HOST ? "real" : "dev";
  res.json({ mailMode });
});

/* ---------------- Statici ---------------- */
// 1) server/public
const publicDir = path.join(__dirname, "public");
if (fs.existsSync(publicDir)) {
  // mount espliciti (aiutano anche il caching/CDN)
  app.use("/js", express.static(path.join(publicDir, "js")));
  app.use("/css", express.static(path.join(publicDir, "css")));
  app.use("/img", express.static(path.join(publicDir, "img")));
  app.use(express.static(publicDir));
}

// 2) client/
const clientDir = path.join(__dirname, "../client");
if (fs.existsSync(clientDir)) {
  app.use(express.static(clientDir));
}

/* ---------------- EJS ---------------- */
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

/* ---------------- API ---------------- */
app.use("/api/items", itemsRouter);
app.use("/api/auth", authRouter);
app.use("/api/favorites", favoritesRouter);
app.use("/api/bookings", bookingsRouter);
app.use("/api/children", childrenRouter);
app.use("/api/coupons", couponsRouter);
app.use("/api/newsletter", newsletterRouter);
app.use("/api/admin", adminRouter);
app.use("/api/users", usersRouter);
app.use("/api/addresses", addressesRouter);
app.use("/api/pricing", pricingRouter);
app.use("/api/reviews", reviewsRouter);
app.use("/api/admin/reviews", adminReviewsRouter);
app.use("/api/loyalty/vouchers", loyaltyVouchersRouter);
app.use("/api/loyalty", loyaltyRoutes);
app.use("/api/blog", blogRouter);

// ---- No-store per pagine sensibili (login/register/profile/admin) ----
const noStore = (req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
};

// Top-level pages
app.use(["/login", "/register", "/profile", "/admin", "/blog"], noStore);

// Frammenti SPA
app.use(
  ["/views/login", "/views/register", "/views/profile", "/views/admin", "/views/blog"],
  noStore
);

/** GUEST-ONLY REGISTER GUARDS */
//Navigazione Diretta (scrivo l'URL nel browser).
app.get("/views/register", (req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");

  // SE l'utente è loggato...
  if (req.user) {
    // ...risponde "Nessun Contenuto" (204).
    // Significa: "Stop, non ti do il form di registrazione HTML".
    return res.status(204).end();
  }
  // SE è un ospite, prosegue (next) verso il router vero che manda l'HTML.
  // next() dice a Express di cercare il prossimo handler in basso che corrisponda alla rotta.
  // 1. Salta "/register" perché manca il prefisso "/views".
  // 2. Salta "/views/login" perché l'URL non è quello.
  // 3. Arriva a app.use("/views", viewsRouter) che intercetta tutto ciò che inizia con "/views".
  return next();
});

//Navigazione SPA (clicco un link e Javascript carica il pezzo di pagina).
app.get("/register", (req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");

  if (req.user) {
    // SE l'utente è loggato...
    // ...reindirizza alla Home Page "/".
    return res.redirect(302, "/");
  }


  //Qui stiamo dando al client che si vuole registrare la scatola vuota, ovvero
  //la pagina index.html. Successivamente, il sistema automatico al suo interno
  //provvederà a riempirla con il modulo giusto.
  return res
    .status(200)
    .sendFile(path.join(__dirname, "../client", "index.html"));
});

/** GUEST-ONLY LOGIN GUARDS */
app.get("/views/login", (req, res, next) => {
  res.set("Cache-Control", "no-store, must-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");

  if (req.user) {
    return res.status(204).end();
  }
  return next();
});

app.get("/login", (req, res) => {
  res.set("Cache-Control", "no-store, must-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");

  if (req.user) {
    return res.redirect(302, "/");
  }

  return res
    .status(200)
    .sendFile(path.join(__dirname, "../client", "index.html"));
});

app.get("/reset-password/:token", (req, res) => {
  res.sendFile(path.join(__dirname, "../client", "index.html"));
});

// Fix 404 blog
app.get("/blog", (req, res) => {
  res.sendFile(path.join(__dirname, "../client", "index.html"));
});

// Router delle viste (frammenti)
app.use("/views", viewsRouter);

/* ---------------- Test errori (dev) ---------------- */
if (process.env.NODE_ENV !== "production") {
  app.get("/test-500", (_req, _res, next) =>
    next(new Error("Boom 500 di test"))
  );
  app.get("/test-505", (_req, _res, next) => {
    const err = new Error("HTTP Version Not Supported (simulato)");
    err.status = 505;
    next(err);
  });
}

/* ---------------- 404 + fallback SPA ---------------- */
app.use((req, res) => {
  const url = req.originalUrl || req.url || req.path || "";

  if (url.startsWith("/api/")) {
    return res.status(404).json({ error: "Not Found" });
  }

  if (url.startsWith("/views/")) {
    return res.status(404).type("text").send("View not found");
  }

  if (
    url.startsWith("/js/") ||
    url.startsWith("/css/") ||
    url.startsWith("/img/") ||
    url.startsWith("/fonts/") ||
    url.startsWith("/assets/") ||
    url === "/favicon.ico" ||
    /\.[a-z0-9]+$/i.test(url)
  ) {
    return res.status(404).type("text").send("Not Found");
  }

  const accepts = (req.headers.accept || "").toLowerCase();
  const acceptsHtml =
    req.method === "GET" &&
    (accepts.includes("text/html") || accepts === "*/*");

  if (acceptsHtml) {
    const clientIndex = path.join(__dirname, "../client", "index.html");

    if (fs.existsSync(clientIndex)) return res.sendFile(clientIndex);

    return res
      .status(404)
      .type("text")
      .send("Not Found (manca client/index.html)");
  }

  return res.status(404).type("text").send("Not Found");
});

/* ---------------- Error handler globale ---------------- */
app.use((err, req, res, _next) => {
  const isProd = process.env.NODE_ENV === "production";

  if (err.code === "EBADCSRFTOKEN") {
    if (req.path.startsWith("/api/")) {
      return res
        .status(403)
        .json({ error: "CSRF token non valido o mancante" });
    }
    return res.status(403).render("partials/500", {
      status: 403,
      message: "Richiesta non valida (token CSRF). Riprova.",
    });
  }

  const status = err.status || err.statusCode || 500;
  const defaultMsg =
    status === 505
      ? "HTTP Version Not Supported"
      : "Si è verificato un errore interno. Riprova più tardi.";
  const message = isProd ? defaultMsg : err.message || defaultMsg;

  if (isProd)
    console.error(`[${new Date().toISOString()}] ${status} ${message}`);
  else console.error(err);

  if (req.path.startsWith("/api/")) {
    const payload = { error: message, code: status };
    if (!isProd) payload.stack = err.stack;
    return res.status(status).json(payload);
  }

  const isFragment =
    req.xhr ||
    req.headers["x-fragment"] ||
    req.headers.accept?.includes("text/html-fragment");

  if (isFragment) {
    const view = status === 404 ? "partials/404" : "partials/500";
    return res.status(status).render(view, { status, message });
  }

  const isTopLevelNav =
    req.headers["sec-fetch-dest"] === "document" ||
    req.headers["sec-fetch-mode"] === "navigate" ||
    (!req.xhr && !req.headers["x-fragment"]);

  if (isTopLevelNav) {
    const code = Number(status) || 500;
    return res.redirect(302, `/?__e=${code}`);
  }

  return res.status(status).type("text").send(`Errore ${status}: ${message}`);
});

/* ---------------- Avvio ---------------- */
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server http://localhost:${port}`);

  startBirthdayReminderScheduler();

  if (process.env.NODE_ENV !== "production") {
    runBirthdayReminderOnce().catch(console.error);
  }
});