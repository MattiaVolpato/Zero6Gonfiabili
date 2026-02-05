import { debounce, escapeHtml } from "../core/ui.js";
import { auth } from "../state/auth-state.js";
import { favorites } from "../state/favorites-state.js";
import { requireLogin } from "../core/guards.js";

let itemsAbortCtrl = null;

async function fetchItems(filters = {}) {
    const { q = "", maxPrice = "", dateFrom = "", dateTo = "" } = filters;

    // abort il fetch precedente (se ancora in corso)
    try {
        itemsAbortCtrl?.abort?.();
    } catch { }
    itemsAbortCtrl = new AbortController();

    const url = new URL("/api/items", location.origin);
    if (q) url.searchParams.set("q", q);
    if (maxPrice !== "" && !Number.isNaN(Number(maxPrice))) {
        url.searchParams.set("maxPrice", String(maxPrice));
    }
    // se c'è solo "dal", usa stesso giorno per "al"
    if (dateFrom) {
        url.searchParams.set("date_from", dateFrom);
        url.searchParams.set("date_to", dateTo || dateFrom);
    }

    const res = await fetch(url, {
        credentials: "include",
        signal: itemsAbortCtrl.signal,
    });
    if (!res.ok) throw new Error("Errore nel caricamento items");
    return res.json();
}

// --- RENDERING LISTA GONFIABILI CON CUORICINI ---
export function initGonfiabiliPage() {
    // lifecycle locale
    const cleanups = [];
    const on = (el, type, fn) => {
        if (!el || !fn) return;
        el.addEventListener(type, fn);
        cleanups.push(() => el.removeEventListener(type, fn));
    };

    // registra un destroy per questa vista
    currentView = {
        name: "catalogo",
        destroy() {
            try {
                itemsAbortCtrl?.abort?.();
            } catch { }
            cleanups.forEach((fn) => {
                try {
                    fn();
                } catch { }
            });
        },
    };

    const form = document.getElementById("form-search");
    const input = form?.querySelector('input[name="q"]');
    const list = document.getElementById("items-list");

    // Filtri extra
    const priceMax = document.getElementById("filter-price");
    const fromInput = document.getElementById("filter-from");
    const toInput = document.getElementById("filter-to");

    function renderStars(avg, count) {
        const a = Number(avg || 0),
            c = Number(count || 0);
        if (c === 0) return `<span class="stars muted">—</span>`;
        const full = Math.floor(a),
            half = a - full >= 0.5 ? 1 : 0,
            empty = 5 - full - half;
        return `<span class="stars" aria-label="${a} su 5"> ${"★".repeat(full)}${half ? "★" : ""
            }${"☆".repeat(empty)} <span class="stars-avg">${a.toFixed(
                1
            )}</span> <span class="stars-count">(${c})</span></span>`;
    }

    let lastItems = [];

    function renderItems(items = []) {
        lastItems = items;
        if (!list) return;
        if (!items.length) {
            list.innerHTML = '<p class="muted">Nessun risultato.</p>';
            return;
        }
        list.innerHTML = items
            .map((it) => {
                const fav = favorites.has(it.id);
                const img = it.image_url || "/img/placeholder.jpg";
                const stars = renderStars(it.avg_rating, it.reviews_count);
                return `
        <article class="card" data-itemid="${it.id}">
          <img class="card-media-img" src="${img}" alt="${escapeHtml(
                    it.name
                )}" />
          <div class="card-body flex-row gap-3 items-center">
            <div class="mr-auto">
              <strong>${escapeHtml(it.name)}</strong>
              <div>${stars}</div>
              <div class="muted">€${Number(it.price_per_day).toFixed(
                    2
                )}/giorno</div>
            </div>
            <div class="flex-row gap-2 items-center">
                <button class="btn btn-secondary btn-view-item" data-id="${it.id
                    }" type="button">Dettagli</button>
                <button class="btn btn-fav ${fav ? "is-fav" : ""}" data-id="${it.id
                    }" type="button" aria-pressed="${fav}">
                ${fav ? "♥" : "♡"}
                </button>
            </div>
          </div>
        </article>`;
            })
            .join("");
    }

    // Deleghe click (handler nominato + cleanup)
    const onListClick = async (e) => {
        const favBtn = e.target.closest(".btn-fav");
        if (favBtn) {
            if (
                !(await requireLogin(true, {
                    message: "Devi essere loggato per utilizzare i preferiti.",
                }))
            )
                return;

            const id = Number(favBtn.dataset.id);
            const already = favBtn.classList.contains("is-fav");
            try {
                const url = `/api/favorites/${id}`;
                const opt = {
                    method: already ? "DELETE" : "POST",
                    credentials: "include",
                };
                const r = await fetch(url, opt);
                if (!r.ok && r.status !== 204) throw new Error();
                await favorites.refresh();
                const now = favorites.has(id);
                favBtn.classList.toggle("is-fav", now);
                favBtn.setAttribute("aria-pressed", String(now));
                favBtn.textContent = now ? "♥" : "♡";
            } catch {
                alert("Errore preferiti");
            }
            return;
        }
        const view = e.target.closest(".btn-view-item");
        if (view) window.page.show(`/gonfiabili/${Number(view.dataset.id)}`);
    };
    on(list, "click", onListClick);

    // Ricerca + filtri (debounced)
    const doSearch = debounce(() => {
        const q = input?.value || "";
        const maxPrice = priceMax?.value || "";
        const dateFrom = fromInput?.value || "";
        const dateTo = toInput?.value || "";
        fetchItems({ q, maxPrice, dateFrom, dateTo })
            .then(renderItems)
            .catch(console.error);
    }, 250);

    // IME-safe + filtri (handler nominati + cleanup)
    let composing = false;
    const onCompStart = () => (composing = true);
    const onCompEnd = () => {
        composing = false;
        doSearch();
    };
    const onTyping = () => {
        if (!composing) doSearch();
    };
    on(input, "compositionstart", onCompStart);
    on(input, "compositionend", onCompEnd);
    on(input, "input", onTyping);
    on(priceMax, "input", doSearch);
    on(fromInput, "change", doSearch);
    on(toInput, "change", doSearch);

    // Primo caricamento
    const initial = () => {
        const q = input?.value || "";
        const maxPrice = priceMax?.value || "";
        const dateFrom = fromInput?.value || "";
        const dateTo = toInput?.value || "";
        return fetchItems({ q, maxPrice, dateFrom, dateTo });
    };

    (auth.user ? favorites.refresh() : Promise.resolve())
        .then(initial)
        .then(renderItems)
        .catch((err) => {
            console.error(err);
            if (list)
                list.innerHTML =
                    '<p class="muted">Errore nel caricamento catalogo.</p>';
        });
}