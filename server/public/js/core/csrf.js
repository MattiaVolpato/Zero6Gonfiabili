// --- CSRF helper per SPA ---
let __csrfToken = null;

export async function getCsrfToken() {
  if (__csrfToken) return __csrfToken;
  const r = await fetch("/api/csrf", { credentials: "include" });
  if (!r.ok) throw new Error("CSRF bootstrap failed");
  const j = await r.json();
  __csrfToken = j.csrfToken;
  return __csrfToken;
}

// Utility per forzare il refresh del token CSRF
export const CSRF = {
  async refresh() {
    __csrfToken = null;
    return getCsrfToken();
  },
};
