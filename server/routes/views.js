import { Router } from "express";
const r = Router();

// debug: utile se qualcosa non monta
r.get("/_debug", (_req, res) => res.type("text").send("OK VIEWS"));

r.get("/home", (req, res) =>
  res.render("partials/home", { user: req.user ?? null })
);
r.get("/login", (req, res) => {
  if (req.user) {
    // evita di rivedere la login se sei già autenticato
    return res.redirect("/");
  }
  // evita cache della pagina login (no-store)
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  return res.render("partials/login", { user: req.user ?? null });
});
r.get("/gonfiabili", (req, res) =>
  res.render("partials/gonfiabili", { user: req.user ?? null })
);
r.get("/faq", (req, res) =>
  res.render("partials/faq", { user: req.user ?? null })
);
r.get("/blog", (req, res) =>
  res.render("partials/blog", { user: req.user ?? null })
);
r.get("/newsletter", (req, res) =>
  res.render("partials/newsletter", { user: req.user ?? null })
);
r.get("/prenotazioni", (req, res) =>
  res.render("partials/prenotazioni", { user: req.user ?? null })
);
r.get("/figli", (req, res) =>
  res.render("partials/figli", { user: req.user ?? null })
);
r.get("/buoni", (req, res) =>
  res.render("partials/buoni", { user: req.user ?? null })
);
r.get("/admin", (req, res) =>
  res.render("partials/admin", { user: req.user ?? null })
);

r.get("/register", (req, res) =>
  res.render("partials/register", { user: req.user ?? null })
);

r.get("/forgot-password", (req, res) =>
  res.render("partials/forgot-password", { user: req.user ?? null })
);

r.get("/reset-password/:token?", (req, res) =>
  res.render("partials/reset-password", { user: req.user ?? null })
);

r.get("/profile", (req, res) =>
  res.render("partials/profile", { user: req.user ?? null })
);

r.get("/preferiti", (req, res) =>
  res.render("partials/preferiti", { user: req.user ?? null })
);

r.get("/gonfiabile-dettaglio", (req, res) =>
  res.render("partials/gonfiabile-dettaglio", { user: req.user ?? null })
);

r.get("/cookie-policy", (req, res) =>
  res.render("partials/cookie-policy", { user: req.user ?? null })
);

r.get("/privacy-policy", (req, res) =>
  res.render("partials/privacy-policy", { user: req.user ?? null })
);

r.get("/tessera", (req, res) => {
  if (!req.user) return res.redirect("/login");
  res.render("partials/tessera", { user: req.user ?? null });
});

r.get("/404", (req, res) => {
  const status = 404;
  const message = "Pagina non trovata.";
  // Frammento → deve rispondere 200, non 404
  res
    .status(200)
    .render("partials/404", { status, message, user: req.user ?? null });
});

r.get("/500", (req, res) => {
  const status = Number(req.query.status || 500) || 500;
  const message = "Si è verificato un errore interno. Riprova più tardi.";
  // Anche qui: frammento → 200
  res
    .status(200)
    .render("partials/500", { status, message, user: req.user ?? null });
});

export default r;
