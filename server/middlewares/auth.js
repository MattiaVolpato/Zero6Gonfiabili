// server/middlewares/auth.js

export function ensureLoggedIn(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();

  // Usa l'URL completo per capire se è una chiamata API
  const url = req.originalUrl || req.url || "";
  const isApi = url.startsWith("/api/");

  if (isApi) {
    return res.status(401).json({ error: "Login richiesto" });
  }
  return res.redirect("/login");
}

export function ensureAdmin(req, res, next) {
  if (
    req.isAuthenticated &&
    req.isAuthenticated() &&
    req.user?.role === "admin"
  ) {
    return next();
  }
  if (req.path.startsWith("/api")) {
    return res
      .status(403)
      .json({ error: "Accesso riservato agli amministratori" });
  }
  res.redirect("/");
}
