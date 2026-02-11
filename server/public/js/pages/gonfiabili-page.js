/**
 * Gestisce la pagina del Catalogo completo (/gonfiabili).
 * Si occupa di visualizzare la lista items, i filtri di ricerca
 * e la gestione dei preferiti (delegando il rendering a items-shared.js).
 */

import { debounce } from "../core/ui.js";
import { auth } from "../state/auth-state.js";
import { favorites } from "../state/favorites-state.js";
import { requireLogin } from "../core/guards.js";
import { fetchItems, renderItemCard } from "../core/items-shared.js";

let itemsAbortCtrl = null;

export function initGonfiabiliPage() {
    // lifecycle locale
    const cleanups = [];
    const on = (el, type, fn) => {
        if (!el || !fn) return;
        el.addEventListener(type, fn);
        cleanups.push(() => el.removeEventListener(type, fn));
    };

    // registra un destroy per questa vista
    if (window.currentView) {
        // Se c'è già una view attiva, agganciamo il destroy se vogliamo, 
        // ma solitamente spa.js gestisce il destroy della PRECEDENTE.
        // Qui stiamo definendo LA NUOVA view.
        window.currentView = {
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
    }

    const form = document.getElementById("form-search");
    const input = form?.querySelector('input[name="q"]');
    const list = document.getElementById("items-list");

    // Filtri extra
    const priceMax = document.getElementById("filter-price");
    const fromInput = document.getElementById("filter-from");
    const toInput = document.getElementById("filter-to");

    let lastItems = [];

    function renderItems(items = []) {
        lastItems = items;
        if (!list) return;
        if (!items.length) {
            list.innerHTML = '<p class="muted">Nessun risultato.</p>';
            return;
        }

        // Nel catalogo mostriamo TUTTI gli items trovati (nessun "Mostra altri" stile home)
        //Chiamiamo renderItemCard per ogni item dal file items-shared.js
        list.innerHTML = items
            .map((it) => renderItemCard(it, favorites.has(it.id)))
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

        // abort precedente
        try { itemsAbortCtrl?.abort?.(); } catch { }
        itemsAbortCtrl = new AbortController();

        fetchItems({ q, maxPrice, dateFrom, dateTo }, itemsAbortCtrl.signal)
            .then(renderItems)
            .catch(err => {
                if (err.name !== 'AbortError') console.error(err);
            });
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

        try { itemsAbortCtrl?.abort?.(); } catch { }
        itemsAbortCtrl = new AbortController();

        return fetchItems({ q, maxPrice, dateFrom, dateTo }, itemsAbortCtrl.signal);
    };

    (auth.user ? favorites.refresh() : Promise.resolve())
        .then(initial)
        .then(renderItems)
        .catch((err) => {
            if (err.name === 'AbortError') return;
            console.error(err);
            if (list)
                list.innerHTML =
                    '<p class="muted">Errore nel caricamento catalogo.</p>';
        });
}