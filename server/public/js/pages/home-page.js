import { auth } from "../state/auth-state.js";
import { escapeHtml } from "../core/ui.js";

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
        empty.style.display = reviews.length ? "none" : "";
        btnLess.style.display = reviews.length > LIMIT ? "" : "none";

        const hasMore = total != null && reviews.length < total;
        btnMore.style.display = hasMore ? "" : "none";
        btnMore.disabled = !hasMore;

        actions.style.display = total > 0 ? "" : "none";
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
        // opzionale: scroll all’inizio della sezione
        // document.getElementById("home-reviews").scrollIntoView({ behavior: "smooth" });
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