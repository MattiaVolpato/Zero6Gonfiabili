/**
 * Modulo condiviso per la gestione dei gonfiabili (items).
 * Contiene funzioni di utilità per il fetch API e il rendering delle card,
 * usate sia nella Home Page che nel Catalogo completo.
 */

import { escapeHtml } from "./ui.js";

/**
 * Esegue il fetch degli items con filtri opzionali.
 * @param {Object} filters - Filtri (q, maxPrice, dateFrom, dateTo).
 * @param {AbortSignal} [signal] - Signal per abortire la fetch.
 */
export async function fetchItems(filters = {}, signal = null) {
    //q sta per "Query" di ricerca (la parola che cerchi).
    //maxPrice è il prezzo massimo che vuoi spendere.
    //dateFrom e dateTo sono le date tra cui vuoi noleggiare (inclusi).
    const { q = "", maxPrice = "", dateFrom = "", dateTo = "" } = filters;

    // new URL() crea un oggetto URL nativo.
    // .searchParams è una proprietà automatica di questo oggetto che permette
    // di aggiungere parametri (come ?q=...) in modo sicuro e facile. 
    // In modo da poter mostrare gli elementi con quelle caratteristiche
    const url = new URL("/api/items", location.origin);

    if (q) url.searchParams.set("q", q);
    if (maxPrice !== "" && !Number.isNaN(Number(maxPrice))) {
        url.searchParams.set("maxPrice", String(maxPrice));
    }
    if (dateFrom) {
        url.searchParams.set("date_from", dateFrom);
        url.searchParams.set("date_to", dateTo || dateFrom);
    }

    const res = await fetch(url, { credentials: "include", signal });
    if (!res.ok) throw new Error("Errore nel caricamento items");
    return res.json();
}

/**
 * Genera l'HTML delle stelline per il rating.
 */
export function renderStars(avg, count) {
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

/**
 * Genera l'HTML di una singola card gonfiabile.
 * @param {Object} it - Oggetto item.
 * @param {boolean} isFav - Se è nei preferiti.
 */
export function renderItemCard(it, isFav) {
    const img = it.image_url || "/img/placeholder.jpg";
    const stars = renderStars(it.avg_rating, it.reviews_count);

    return `
    <article class="card" data-itemid="${it.id}">
      <img class="card-media-img" src="${img}" alt="${escapeHtml(it.name)}" />
      <div class="card-body flex-row gap-3 items-center">
        <div class="mr-auto">
            <strong>${escapeHtml(it.name)}</strong>
            <div>${stars}</div>
            <div class="muted">€${Number(it.price_per_day).toFixed(2)}/giorno</div>
        </div>
        <div class="flex-row gap-2 items-center">
            <button class="btn btn-secondary btn-view-item" data-id="${it.id}" type="button">Dettagli</button>
            <button class="btn btn-fav ${isFav ? "is-fav" : ""}" data-id="${it.id}" type="button" aria-pressed="${isFav}">
            ${isFav ? "♥" : "♡"}
            </button>
        </div>
      </div>
    </article>`;
}
