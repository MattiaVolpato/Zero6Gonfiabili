// server/guards.js
export function ensureAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  return res.status(401).json({ error: "Authentication required" });
}

export function ensureRole(role) {
  return (req, res, next) => {
    if (
      req.isAuthenticated &&
      req.isAuthenticated() &&
      req.user?.role === role
    ) {
      return next();
    }
    return res.status(403).json({ error: "Forbidden" });
  };
}
