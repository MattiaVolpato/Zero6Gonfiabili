// -------------------------------------
// DOM

export const root =
  document.getElementById("app-root") ||
  document.querySelector("[data-app-root]");

// Evidenzia il link attivo in navbar (tollerante a query/hash e trailing slash)
export function z6UpdateActiveNav(pathname = location.pathname) {
  const clean = (p) =>
    (p || "/").replace(/[#?].*$/, "").replace(/\/+$/, "") || "/";
  const current = clean(pathname);

  const links = document.querySelectorAll(".z6-nav__link");
  links.forEach((a) => {
    const rawHref = a.getAttribute("href") || "/";
    const url = (() => {
      try {
        return new URL(rawHref, location.origin).pathname;
      } catch {
        return rawHref;
      }
    })();
    const href = clean(url);

    const isActive =
      (href === "/" && current === "/") ||
      (href !== "/" && (current === href || current.startsWith(href + "/")));

    a.classList.toggle("is-active", !!isActive);
    a.setAttribute("aria-current", isActive ? "page" : "false");
  });
}

// -------------------------------------
// FLASH (usa solo classi CSS, nessuno stile inline)

const FLASH_KEY = "flash";

export function setFlash(msg, type = "warning") {
  sessionStorage.setItem(
    FLASH_KEY,
    JSON.stringify({
      msg: String(msg ?? ""),
      type: String(type || "warning"),
      ts: Date.now(),
    })
  );
  window.setFlash = setFlash; // compat globale
}

export function consumeFlash() {
  const raw = sessionStorage.getItem(FLASH_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(FLASH_KEY);
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function renderFlashIfAny() {
  const data = consumeFlash();
  if (!data || !data.msg) return;

  // rimuovi eventuale flash precedente per evitare stacking involontario
  document.getElementById("flash")?.remove();

  const el = document.createElement("div");
  el.id = "flash";
  el.className = `flash flash-${cssSafe(data.type || "warning")}`;
  el.innerHTML = `
    <div class="flash__body">
      <span class="flash__msg"></span>
    </div>
  `;
  el.querySelector(".flash__msg").textContent = String(data.msg);
  document.body.prepend(el);

  const close = () => {
    el.classList.add("flash--hide");
    window.setTimeout(() => el.remove(), 400); // la transizione la gestisce il CSS esterno
  };

  el.querySelector(".flash__close")?.addEventListener("click", close);
  const autoMs = data.type === "error" || data.type === "warning" ? 6000 : 4000;
  window.setTimeout(close, autoMs);
}

window.setFlash = setFlash; // compat globale

function cssSafe(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-");
}


// UTILS

export function debounce(fn, ms = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function formatDisplayName(first, last, email) {
  const fn = (first || "").trim();
  const ln = (last || "").trim();
  if (fn || ln) {
    const initial = ln ? ln[0].toUpperCase() + "." : "";
    return `${fn || "Utente"}${initial ? " " + initial : ""}`;
  }
  return (email || "Utente").split("@")[0];
}

export function renderStarsCompact(rating) {
  const n = Math.max(0, Math.min(5, Number(rating) || 0));
  const full = Math.round(n);
  return "★".repeat(full) + "☆".repeat(5 - full);
}

// In js/core/ui.js
export function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (m) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
      m
    ])
  );
}
