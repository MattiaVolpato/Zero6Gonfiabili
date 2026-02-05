import { auth } from "../state/auth-state.js";
import { requireLogin } from "../core/guards.js";
import { favorites } from "../state/favorites-state.js"; // serve per favoriti
import { escapeHtml } from "../core/ui.js";

// === FIGLI ===
//helpers
async function apiChildrenList() {
    const r = await fetch("/api/children", { credentials: "include" });
    if (!r.ok) throw new Error("Errore caricamento elenco figli");
    return r.json();
}
async function apiChildrenCreate(p) {
    const r = await fetch("/api/children", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(p),
    });
    if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error || "Errore creazione figlio");
    }
    return r.json();
}
async function apiChildrenDelete(id) {
    const r = await fetch(`/api/children/${id}`, {
        method: "DELETE",
        credentials: "include",
    });
    if (!r.ok && r.status !== 204) throw new Error("Errore eliminazione");
}
function renderChildren(list) {
    const box = document.getElementById("children-list");
    if (!list.length) {
        box.innerHTML = '<p class="muted">Nessun figlio inserito.</p>';
        return;
    }
    box.innerHTML = list
        .map(
            (c) => `
    <article class="card">
      <div class="card-body flex-row items-center gap-2">
        <div class="mr-auto">
          <div><strong>${c.name}</strong></div>
          <div class="muted">🎂 ${c.birthday}</div>
        </div>
        <button class="btn btn-del" data-cid="${c.id}">Elimina</button>
      </div>
    </article>
  `
        )
        .join("");

    box.querySelectorAll(".btn-del").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
            e.preventDefault();
            const id = Number(btn.getAttribute("data-cid"));
            try {
                await apiChildrenDelete(id);
                renderChildren(await apiChildrenList());
            } catch (err) {
                alert(err.message);
            }
        });
    });
}

export async function initChildrenPage() {
    if (!(await requireLogin())) return;

    renderChildren(
        await apiChildrenList().catch((err) => {
            console.error(err);
            return [];
        })
    );
    const form = document.getElementById("form-child");
    form?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const payload = {
            name: (fd.get("name") || "").toString().trim(),
            birthday: fd.get("birthday"),
        };
        if (!payload.name || !payload.birthday) {
            alert("Inserisci nome e compleanno");
            return;
        }
        try {
            await apiChildrenCreate(payload);
            form.reset();
            renderChildren(await apiChildrenList());
        } catch (err) {
            alert(err.message);
        }
    });
}

// === BUONI (COUPONS) ===

//Helpers
function renderCouponResult(data) {
    const box = document.getElementById("coupon-result");
    if (!box) return;
    if (!data) {
        box.innerHTML = "";
        return;
    }
    if (!data.valid) {
        const reasons = {
            not_found: "Codice non trovato.",
            inactive: "Il codice non è attivo.",
            expired: "Il codice è scaduto.",
            not_started: "Il codice non è ancora attivo.",
        };
        box.innerHTML = `<p class="muted">${reasons[data.reason] || "Codice non valido."
            }</p>`;
        return;
    }
    box.innerHTML = `
    <article class="card">
      <div class="card-body">
        <strong>Codice:</strong> ${data.coupon.code}<br/>
        <strong>Sconto:</strong> ${data.coupon.discount_percent}%<br/>
        ${data.coupon.starts_at || data.coupon.expires_at
            ? `<span class="muted">Validità: ${data.coupon.starts_at ?? "sempre"
            } → ${data.coupon.expires_at ?? "senza scadenza"}</span>`
            : ""
        }
      </div>
    </article>`;
}
async function validateCoupon(code) {
    const c = (code || "").trim();
    if (!c) {
        renderCouponResult(null);
        return;
    }
    const res = await fetch(`/api/coupons/${encodeURIComponent(c)}`, {
        credentials: "include",
    });
    if (!res.ok) {
        renderCouponResult({ valid: false });
        return;
    }
    renderCouponResult(await res.json());
}

export function initCouponsPage() {
    const form = document.getElementById("form-coupon");
    const input = document.getElementById("coupon-code");
    form?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const code = input.value.trim();
        if (!code) {
            alert("Inserisci un codice prima di confermare.");
            return;
        }
        await validateCoupon(code);
    });
    const qs = new URLSearchParams(location.search);
    const preset = qs.get("code");
    if (preset) {
        input.value = preset;
    }
}

// === NEWSLETTER PAGE ===
//helpers
async function apiNewsSubscribe(email) {
    const r = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
    });
    if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error || "Errore iscrizione");
    }
}
async function apiNewsUnsubscribe(email) {
    const r = await fetch("/api/newsletter/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
    });
    if (r.status === 404) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error || "Email non trovata");
    }
    if (!r.ok && r.status !== 204) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error || "Errore disiscrizione");
    }
}
async function apiNewsStatus(email) {
    const url = new URL("/api/newsletter/status", location.origin);
    url.searchParams.set("email", email);
    const r = await fetch(url, { credentials: "include" });
    if (!r.ok) throw new Error("Errore verifica stato");
    return r.json();
}
function renderNewsMsg(html) {
    const box = document.getElementById("news-result");
    if (box) box.innerHTML = html;
}
export function initNewsletterPage() {
    const form = document.getElementById("form-news-sub");
    const emailInput = document.getElementById("news-email");
    const btnUnsub = document.getElementById("btn-news-unsub");
    const btnCheck = document.getElementById("btn-news-check");

    if (!form || !emailInput) return; // pagina non presente: esco pulito

    // Se l'utente è loggato, precompila senza sovrascrivere un valore già inserito
    if (window.__USER?.email && !emailInput.value) {
        emailInput.value = window.__USER.email.toLowerCase();
    }

    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

    const norm = (v) => (v || "").toString().trim().toLowerCase();
    const isValidEmail = (v) => EMAIL_RE.test(v);

    const escapeHTML = (s) =>
        s.replace(
            /[&<>"']/g,
            (ch) =>
            ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;",
            }[ch])
        );

    const messageFromError = (err) =>
        err?.response?.data?.error ||
        err?.data?.error ||
        err?.message ||
        "Si è verificato un errore. Riprova.";

    let busy = false;
    const setBusy = (v) => {
        busy = v;
        const controls = [
            form.querySelector("button[type=submit]"),
            btnUnsub,
            btnCheck,
            emailInput,
        ].filter(Boolean);
        controls.forEach((el) => (el.disabled = v));
    };

    const getEmailOrAlert = () => {
        const email = norm(emailInput.value);
        if (!email) {
            alert("Inserisci una email");
            return null;
        }
        if (!isValidEmail(email)) {
            alert("Email non valida");
            return null;
        }
        return email;
    };

    // SUBSCRIBE
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (busy) return;
        const email = getEmailOrAlert();
        if (!email) return;

        try {
            setBusy(true);
            await apiNewsSubscribe(email); // <-- invia sempre in minuscolo
            renderNewsMsg(
                `<p class="muted">Iscrizione completata per <strong>${escapeHTML(
                    email
                )}</strong>.</p>`
            );
        } catch (err) {
            alert(messageFromError(err));
        } finally {
            setBusy(false);
        }
    });

    // UNSUBSCRIBE
    btnUnsub?.addEventListener("click", async () => {
        if (busy) return;
        const email = getEmailOrAlert();
        if (!email) return;

        try {
            setBusy(true);
            await apiNewsUnsubscribe(email);
            renderNewsMsg(
                `<p class="muted">Disiscritto <strong>${escapeHTML(
                    email
                )}</strong>.</p>`
            );
        } catch (err) {
            alert(messageFromError(err));
        } finally {
            setBusy(false);
        }
    });

    // CHECK STATUS
    btnCheck?.addEventListener("click", async () => {
        if (busy) return;
        const email = getEmailOrAlert();
        if (!email) return;

        try {
            setBusy(true);
            const st = await apiNewsStatus(email);
            if (!st?.exists) {
                renderNewsMsg(
                    `<p class="muted">Nessuna iscrizione per <strong>${escapeHTML(
                        email
                    )}</strong>.</p>`
                );
            } else {
                renderNewsMsg(
                    `<p class="muted">Stato per <strong>${escapeHTML(email)}</strong>: ${st.is_active ? "attiva ✅" : "disattiva ❌"
                    }</p>`
                );
            }
        } catch (err) {
            alert(messageFromError(err));
        } finally {
            setBusy(false);
        }
    });
}

// === PREFERITI ===
// ======= Preferiti (robusto ai nomi campo + mostra errori utili) =======
export async function initFavoritesPage(rootEl = document.getElementById("app-root")) {
    rootEl.innerHTML = `
    <h1 class="h3">I miei preferiti</h1>
    <div id="fav-error" class="alert alert-error hidden"></div>
    <p id="fav-empty" class="muted hidden" aria-live="polite">Non hai ancora preferiti.</p>
    <div id="fav-list" class="fav-grid"></div>
  `;

    const errorBox = rootEl.querySelector("#fav-error");
    const listEl = rootEl.querySelector("#fav-list");
    const emptyEl = rootEl.querySelector("#fav-empty");

    const getImg = (it) =>
        it?.cover_url ||
        it?.image_url ||
        it?.thumbnail_url ||
        it?.photo_url ||
        "/img/placeholder.jpg";

    const getName = (it) => it?.name || it?.title || "Senza nome";

    // escape base per evitare XSS in <img alt> e <h3>
    const escapeHtml = (s) =>
        String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

    try {
        const res = await fetch("/api/favorites/items", {
            method: "GET",
            credentials: "include",
            headers: { Accept: "application/json" },
        });

        if (res.status === 401) {
            errorBox.classList.remove("hidden");
            errorBox.textContent =
                "Devi effettuare l’accesso per vedere i preferiti.";
            return;
        }

        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(
                `${res.status} ${res.statusText}${text ? ` – ${text}` : ""}`
            );
        }

        const itemsRaw = await res.json().catch(() => []);
        const items = Array.isArray(itemsRaw)
            ? itemsRaw
            : Array.isArray(itemsRaw?.items)
                ? itemsRaw.items
                : [];

        // ---- STATO VUOTO: nessun preferito ----
        if (!Array.isArray(items) || items.length === 0) {
            emptyEl.classList.remove("hidden");
            listEl.classList.add("hidden");
            return;
        }

        const html = items
            .map((it) => {
                const id = Number(it.id ?? it.item_id ?? it.itemId);
                const avg =
                    it.avg_rating != null
                        ? Number(it.avg_rating).toFixed(1)
                        : it.rating_avg != null
                            ? Number(it.rating_avg).toFixed(1)
                            : "–";
                const reviews =
                    it.reviews_count != null
                        ? it.reviews_count
                        : it.rating_count != null
                            ? it.rating_count
                            : 0;

                return `
        <article class="fav-card" data-id="${id}">
          <img src="${getImg(it)}" alt="${escapeHtml(getName(it))}"/>
          <div class="card-body">
            <h3>${escapeHtml(getName(it))}</h3>
            <p class="muted">⭐ ${avg} · ${reviews} recensioni</p>
            <div class="actions">
              <a class="btn" href="/gonfiabili/${id}" data-link>Dettaglio</a>
              <button class="btn btn-remove" data-id="${id}">Rimuovi</button>
            </div>
          </div>
        </article>`;
            })
            .join("");

        listEl.innerHTML = html;
        listEl.classList.remove("hidden");
        emptyEl.classList.add("hidden");

        // handler rimozione
        listEl.querySelectorAll(".btn-remove").forEach((btn) => {
            btn.addEventListener("click", async (e) => {
                e.preventDefault();
                const id = Number(btn.dataset.id);
                btn.disabled = true;
                try {
                    const delRes = await fetch(`/api/favorites/${id}`, {
                        method: "DELETE",
                        credentials: "include",
                        headers: { Accept: "application/json" },
                    });
                    if (!delRes.ok && delRes.status !== 204) {
                        const t = await delRes.text().catch(() => "");
                        throw new Error(
                            `${delRes.status} ${delRes.statusText}${t ? ` – ${t}` : ""}`
                        );
                    }

                    // Aggiorna lo stato globale
                    if (favorites.set) {
                        favorites.set.delete(id);
                    }

                    btn.closest("article.fav-card")?.remove();

                    // ---- STATO VUOTO dopo rimozione ultimo elemento ----
                    if (listEl.querySelectorAll("article.fav-card").length === 0) {
                        emptyEl.classList.remove("hidden");
                        listEl.classList.add("hidden");
                    }
                } catch (err) {
                    alert("Errore nella rimozione dai preferiti:\n" + err.message);
                } finally {
                    btn.disabled = false;
                }
            });
        });
    } catch (err) {
        errorBox.classList.remove("hidden");
        errorBox.textContent =
            "Errore nel caricamento dei preferiti. Dettagli: " + err.message;
    }
}