import { auth } from "../state/auth-state.js";
import { favorites } from "../state/favorites-state.js";
import { escapeHtml, debounce } from "../core/ui.js";
import { requireLogin } from "../core/guards.js";
import { apiNewsSubscribe } from "../core/newsletter-api.js";
import { fetchItems, renderItemCard } from "../core/items-shared.js";

//funzioni per la home page riguardano: 
// Carica e mostra ultime recensioni approvate (pubbliche), 
// Newsletter
// Lista gonfiabili (limitata con "Mostra altro")

// --- LISTA GONFIABILI HOME (con limite e ricerca) ---
export function initHomeItems() {
    const list = document.getElementById("items-list");
    if (!list) return;

    // Form di ricerca (solo input q nella home)
    const form = document.getElementById("form-search");
    const input = form?.querySelector('input[name="q"]');

    // Stato paginazione locale
    const initialLimit = Number(list.dataset.limit) || 3;
    let renderLimit = initialLimit;
    let lastItems = [];
    let itemsAbortCtrl = null;

    function renderItems(items = []) {
        lastItems = items;
        if (!items.length) {
            list.innerHTML = '<p class="muted">Nessun risultato.</p>';
            return;
        }

        let visibleItems = items;
        let showLoadMore = false;
        let showShowLess = false;

        // Logica limite specifica della Home
        if (initialLimit > 0) {
            if (items.length > renderLimit) {
                // Ci sono ancora item da mostrare -> taglio e mostro "Mostra altri"
                visibleItems = items.slice(0, renderLimit);
                showLoadMore = true;
            } else if (renderLimit > initialLimit) {
                // Li sto mostrando tutti ma ne ho caricati più del limite iniziale -> mostro "Nascondi"
                showShowLess = true;
            }
        }

        const itemsHtml = visibleItems
            .map((it) => renderItemCard(it, favorites.has(it.id)))
            .join("");

        if (showLoadMore) {
            list.innerHTML = itemsHtml + `
                <div class="w-100 flex-center mt-4 col-full">
                    <button class="z6-btn z6-btn--primary btn-load-more" type="button">Mostra altro</button>
                </div>
            `;
        } else if (showShowLess) {
            list.innerHTML = itemsHtml + `
                <div class="w-100 flex-center mt-4 col-full">
                    <button class="z6-btn z6-btn--primary btn-show-less" type="button">Mostra meno</button>
                </div>
            `;
        } else {
            list.innerHTML = itemsHtml;
        }
    }

    // Deleghe click (handler nominato + cleanup)
    const onListClick = async (e) => {
        // Gestione "Mostra altri"
        if (e.target.classList.contains("btn-load-more")) {
            renderLimit += initialLimit; // incrementa dello step iniziale
            renderItems(lastItems);
            return;
        }

        // Gestione "Nascondi"
        if (e.target.classList.contains("btn-show-less")) {
            renderLimit = initialLimit; // resetta al limite iniziale
            renderItems(lastItems);
            list.scrollIntoView({ behavior: "smooth", block: "start" });
            return;
        }

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
    list.addEventListener("click", onListClick);

    // Ricerca (debounced)
    const doSearch = debounce(() => {
        const q = input?.value || "";

        // Reset limite quando cambia la ricerca
        renderLimit = initialLimit;

        try { itemsAbortCtrl?.abort?.(); } catch { }
        itemsAbortCtrl = new AbortController();

        fetchItems({ q }, itemsAbortCtrl.signal)
            .then(renderItems)
            .catch(err => {
                if (err.name !== 'AbortError') console.error(err);
            });
    }, 250);

    if (input) {
        input.addEventListener("input", doSearch);
    }

    // Caricamento iniziale
    const initial = () => {
        const q = input?.value || "";
        try { itemsAbortCtrl?.abort?.(); } catch { }
        itemsAbortCtrl = new AbortController();
        return fetchItems({ q }, itemsAbortCtrl.signal);
    };

    (auth.user ? favorites.refresh() : Promise.resolve())
        .then(initial)
        .then(renderItems)
        .catch((err) => {
            if (err.name === 'AbortError') return;
            console.error(err);
            list.innerHTML = '<p class="muted">Errore nel caricamento.</p>';
        });
}

// Carica e mostra ultime recensioni approvate (pubbliche)
export async function initHomeReviews() {
    const grid = document.getElementById("home-reviews-list");
    const empty = document.getElementById("home-reviews-empty");
    const actions = document.getElementById("home-reviews-actions");
    const btnMore = document.getElementById("home-reviews-more");
    const btnLess = document.getElementById("home-reviews-less");
    const avgBox = document.getElementById("home-reviews-average"); // ✅ mancava
    if (!grid || !btnMore) return;

    const LIMIT = 3;
    let offset = 0;
    let total = null;
    let reviews = []; // cache locale
    let loading = false;

    const tpl = (r) => {
        const stars = "★".repeat(r.rating) + "☆".repeat(5 - r.rating);
        return `
      <article class="review-card">
        <header class="review-card__head">
          <strong>${escapeHtml(r.user_name ?? "Utente")}</strong>
          <span class="review-card__stars" aria-label="${r.rating
            } su 5">${stars}</span>
        </header>
        ${r.comment
                ? `<p class="review-card__text">${escapeHtml(r.comment)}</p>`
                : ""
            }
        <footer class="review-card__foot">
          <time>
          ${new Date(r.created_at).toLocaleString("it-IT", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
            })}
        </time>
        </footer>
      </article>
    `;
    };

    // --- carica la media prima di tutto ---
    try {
        const resAvg = await fetch("/api/reviews/average", {
            credentials: "include",
        });
        const avgData = await resAvg.json();

        const avg = Number.parseFloat(avgData.avg);
        const cnt = Number.parseInt(avgData.count, 10);

        if (cnt > 0 && Number.isFinite(avg)) {
            const starCount = Math.min(5, Math.max(0, Math.round(avg)));
            const fullStars = "★".repeat(starCount);
            const emptyStars = "☆".repeat(5 - starCount);

            avgBox?.insertAdjacentHTML(
                "afterbegin",
                `
      <div class="reviews-average-content">
        <span class="reviews-average-stars">${fullStars}${emptyStars}</span>
        <span class="reviews-average-text">${avg.toFixed(
                    1
                )} / 5 (${cnt} recensioni)</span>
      </div>
    `
            );
        } else {
            avgBox?.insertAdjacentHTML(
                "afterbegin",
                `<p class="muted">Nessuna recensione disponibile.</p>`
            );
        }
    } catch (err) {
        console.error("Errore nel caricamento della media recensioni:", err);
        avgBox?.insertAdjacentHTML(
            "afterbegin",
            `<p class="muted">Media non disponibile.</p>`
        );
    }

    function render() {
        grid.innerHTML = reviews.map(tpl).join("");

        // Usa toggle della classe hidden invece di style.display perché
        // .hidden ha !important nel CSS
        if (empty) empty.classList.toggle("hidden", reviews.length > 0);

        if (btnLess) btnLess.classList.toggle("hidden", reviews.length <= LIMIT);

        const hasMore = total != null && reviews.length < total;
        if (btnMore) {
            btnMore.classList.toggle("hidden", !hasMore);
            btnMore.disabled = !hasMore;
        }

        if (actions) actions.classList.toggle("hidden", total <= 0);
    }

    async function loadMore() {
        if (loading) return;
        loading = true;
        btnMore.disabled = true;
        grid.setAttribute("aria-busy", "true");

        try {
            const res = await fetch(
                `/api/reviews/latest?limit=${LIMIT}&offset=${offset}`,
                {
                    credentials: "include",
                    headers: { Accept: "application/json" },
                }
            );
            if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
            const data = await res.json();

            total ??= data.total ?? 0;
            reviews = reviews.concat(data.rows ?? []);
            offset += (data.rows ?? []).length;

            render();
        } catch (err) {
            console.error(err);
            if (reviews.length === 0) {
                grid.innerHTML =
                    "<p class='muted'>Impossibile caricare le recensioni.</p>";
                actions.style.display = "none";
            }
        } finally {
            loading = false;
            btnMore.disabled = false;
            grid.removeAttribute("aria-busy");
        }
    }

    function showLess() {
        reviews = reviews.slice(0, LIMIT);
        offset = Math.min(offset, LIMIT);
        render();
        grid.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    // Eventi pulsanti
    btnMore.addEventListener("click", (e) => {
        e.preventDefault();
        loadMore();
    });

    btnLess.addEventListener("click", (e) => {
        e.preventDefault();
        showLess();
    });

    // Primo caricamento
    await loadMore();
}

// --- Newsletter inline in home ---
export function initHomeNewsletter() {
    const form = document.getElementById("form-home-news");
    if (!form) return; // non siamo in home o blocco non presente

    const emailInput = document.getElementById("home-news-email");
    const btn = document.getElementById("home-news-submit");
    const msg = document.getElementById("home-news-msg");

    // Precompila se utente loggato
    if (auth.user?.email && !emailInput.value) {
        emailInput.value = auth.user.email.toLowerCase();
    }

    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

    function setBusy(v) {
        btn.disabled = v;
        emailInput.disabled = v;
    }
    function showMsg(html, ok = false) {
        msg.innerHTML = html;
        msg.classList.toggle("ok", ok);
        msg.classList.toggle("err", !ok);
    }

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = (emailInput.value || "").trim().toLowerCase();
        if (!EMAIL_RE.test(email)) {
            showMsg("Inserisci un indirizzo email valido.");
            return;
        }
        try {
            setBusy(true);
            await apiNewsSubscribe(email);
            showMsg(`Iscrizione completata per <strong>${email}</strong>.`, true);
            form.reset();
        } catch (err) {
            showMsg(err?.message || "Errore iscrizione. Riprova.");
        } finally {
            setBusy(false);
        }
    });
}