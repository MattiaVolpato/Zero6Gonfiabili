import { favorites } from "./favorites-state.js";

export const auth = {
  user: null,
  setUser(u) {
    auth.user = u;
    updateNavAuth();
  },

  async refresh() {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    const data = await res.json();
    auth.setUser(data.user);
  },
  async login(email, password) {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error("Credenziali non valide");
    const data = await res.json();
    auth.setUser(data.user);
  },
  async logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    auth.setUser(null);
    window.page.show("/");
  },
};
window.auth = auth;

export function updateNavAuth() {
  const loginLink = document.getElementById("nav-login");
  const registerLink = document.getElementById("nav-register");
  const logoutLink = document.getElementById("nav-logout");
  const adminLink = document.getElementById("nav-admin");
  const profileLink = document.getElementById("nav-profile");
  const favoritesLink = document.getElementById("nav-favorites"); // <-- nuovo

  const userBox = document.getElementById("nav-userbox");
  const userNameEl = document.getElementById("nav-username");

  const logged = !!auth.user;
  const isAdmin = !!(auth.user && auth.user.role === "admin");

  if (loginLink) loginLink.style.display = logged ? "none" : "";
  if (registerLink) registerLink.style.display = logged ? "none" : "";

  if (logoutLink) {
    logoutLink.style.display = logged ? "" : "none";
    // aggancia l'handler UNA SOLA VOLTA
    if (!logoutLink.dataset.boundLogout) {
      logoutLink.addEventListener("click", async (e) => {
        e.preventDefault();
        try {
          await auth.logout();
        } catch (err) {
          console.warn("[logout] errore:", err);
        }
      });
      logoutLink.dataset.boundLogout = "1";
    }
  }
  if (profileLink) profileLink.style.display = logged ? "" : "none";
  if (adminLink) adminLink.hidden = !isAdmin;

  // Preferiti: visibile solo da loggati (usiamo hidden per non “saltare” il layout)
  if (favoritesLink) favoritesLink.hidden = !logged;

  if (userBox) userBox.hidden = !logged;
  if (userNameEl) {
    const fn = auth.user?.first_name || "";
    const ln = auth.user?.last_name || "";
    const name = (fn + " " + ln).trim() || auth.user?.email || "Utente";
    userNameEl.textContent = logged ? `Ciao, ${name}` : "";
  }

  if (logged) {
    // Se loggato, aggiorna la lista dei preferiti dal server
    favorites.refresh().catch(() => { });
  } else {
    // Se sloggato, svuota il set dei preferiti locale
    favorites.set.clear();
  }
}

export function isLoggedIn() {
  return !!auth.user;
}
