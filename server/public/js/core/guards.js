import { auth } from "../state/auth-state.js";
// ---- Guard login riutilizzabile (con messaggio personalizzabile) ----
export async function requireLogin(orRedirect = true, opts = {}) {
  const {
    message = "Devi essere loggato per accedere a questa pagina.",
    next = () => window.location.pathname,
  } = opts;

  if (auth.user) return true;
  try {
    await auth.refresh();
  } catch { }
  if (auth.user) return true;

  if (orRedirect) {
    setFlash(message);
    const nextPath = typeof next === "function" ? next() : next;
    window.page.show(`/login?next=${encodeURIComponent(nextPath || "/")}`);
  }
  return false;
}

export function requireAuth(handler) {
  return async (ctx) => {
    if (!auth.user) {
      try {
        await auth.refresh();
      } catch { }
    }
    if (!auth.user) {
      setFlash("Devi effettuare l’accesso per continuare.");
      const next = encodeURIComponent(ctx?.path || window.location.pathname);
      if (window.page?.replace) window.page.replace(`/login?next=${next}`);
      else {
        history.replaceState(null, "", `/login?next=${next}`);
        window.location.replace(`/login?next=${next}`);
      }
      return;
    }
    return handler(ctx);
  };
}

export function requireGuest(next) {
  return async (ctx) => {
    try {
      await auth.refresh().catch(() => { });
    } catch { }
    if (auth.user) {
      if (window.page?.replace) window.page.replace("/");
      else {
        history.replaceState(null, "", "/");
        window.page?.show?.("/");
      }
      return;
    }
    return next(ctx);
  };
}
