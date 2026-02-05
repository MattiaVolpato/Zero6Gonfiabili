import { auth } from "../state/auth-state.js";
import { favorites } from "../state/favorites-state.js";
import { requireLogin } from "../core/guards.js";
import { escapeHtml } from "../core/ui.js";

export async function initGonfiabileDettaglioPage() {
    const box = document.getElementById("item-detail");
    if (!box) return;

    const m = location.pathname.match(/\/gonfiabili\/(\d+)/);
    const id = m ? Number(m[1]) : NaN;
    if (!Number.isInteger(id) || id <= 0) {
        box.innerHTML = '<p class="muted">Elemento non trovato.</p>';
        return;
    }

    // preferiti (se loggato)
    if (auth.user) {
        try {
            await favorites.refresh();
        } catch { }
    }

    // ---- dettaglio item
    let it, img, avg, reviewsCount, price, fav;
    try {
        const resp = await fetch(`/api/items/${id}`, {
            method: "GET",
            credentials: "include",
            headers: { Accept: "application/json" },
        });

        if (resp.status === 404) {
            box.innerHTML = '<p class="muted">Gonfiabile non trovato.</p>';
            return;
        }
        if (!resp.ok) {
            const t = await resp.text().catch(() => "");
            box.innerHTML = `
        <p class="muted">
          Errore nel caricamento.<br/>
          <small>${resp.status} ${resp.statusText}${t ? " — " + escapeHtml(t) : ""
                }</small>
        </p>`;
            return;
        }

        const raw = await resp.json().catch(() => null);
        if (!raw) {
            box.innerHTML =
                '<p class="muted">Errore nel caricamento (risposta vuota).</p>';
            return;
        }

        it = raw && raw.item ? raw.item : raw;

        avg = it.avg_rating != null ? Number(it.avg_rating) : null;
        reviewsCount = it.reviews_count != null ? Number(it.reviews_count) : 0;
        img = it.cover_url || it.image_url || "/img/placeholder.jpg";
        price = it.price_per_day != null ? Number(it.price_per_day) : null;
        fav = favorites.has(it.id);

        // valori statici di default per le specifiche
        const power = it.power_required
            ? escapeHtml(it.power_required)
            : "1 presa 230V (standard domestica) — consumo medio 1 kW/h.";
        const mats = it.materials
            ? escapeHtml(it.materials)
            : "Parte inferiore calpestabile in PVC rinforzato e pareti laterali in tessuto Oxford leggero e resistente.";
        // MARKUP “pulito” per il layout richiesto
        box.classList.remove("stack");
        box.classList.add("detail-grid");
        box.innerHTML = `
  <!-- Titolo principale in alto -->
  <h1 class="h3 detail-title">${escapeHtml(it.name || "Senza nome")}</h1>

  <!-- Colonna sinistra: immagine -->
  <div class="detail-media">
    <img src="${escapeHtml(img)}" alt="${escapeHtml(it.name || "")}"
         class="detail-media-img" loading="lazy"/>
  </div>

  <!-- Colonna destra: dettagli ordinati -->
  <div class="detail-body">
    <h3 class="detail-subtitle">Descrizione gonfiabile</h3>

    ${it.description
                ? `<p class="detail-text">${escapeHtml(it.description)}</p>`
                : ""
            }

    <div class="detail-reviews-line">
      ${reviewsCount > 0
                ? `<span class="detail-reviews-count">${reviewsCount} recensioni</span>
           <span class="detail-reviews-sep">•</span>
           <span class="detail-reviews-avg">${(avg ?? 0).toFixed(1)} ★</span>`
                : `<span class="detail-reviews-count muted">Nessuna recensione</span>`
            }
    </div>

    ${price != null
                ? `<div class="detail-price-row">
           <div class="detail-price">€${price.toFixed(2)}</div>
           <span class="detail-price-suffix">/ giorno</span>
         </div>`
                : ""
            }

    <div class="detail-actions">
<a href="/prenotazioni?itemId=${it.id}" data-link class="btn detail-book">
  Prenota questo gonfiabile
</a>

  <button class="btn btn-fav detail-fav ${fav ? "is-fav" : ""}"
          data-id="${it.id}" type="button" aria-pressed="${fav}">
    ${fav ? "♥" : "♡"}
  </button>
</div>

  </div>



   <!-- Riga sotto: inclusi (sinistra) / specifiche (destra) -->
<div class="detail-bottom-grid">
  <!-- Sinistra -->
  <article class="detail-card detail-included">
    <h3 class="h5">Cosa è incluso?</h3>
    <p>
      Nel noleggio sono inclusi gli accessori per un’installazione corretta:
    </p>
    <ul class="detail-list">
      <li>Ventilatore</li>
      <li>Picchetti</li>
      <li>Telo</li>
    </ul>
  </article>

  <!-- Destra -->
  <article class="detail-card detail-specs">
    <h3 class="h5">Specifiche valide per tutti i nostri gonfiabili</h3>
    <div class="specs">
      <p><strong>Energia richiesta:</strong> 1 presa 230V (standard domestica) — consumo medio 1 kW/h.</p>
      <p><strong>Materiali:</strong> Parte inferiore calpestabile in PVC rinforzato e pareti laterali in tessuto Oxford leggero e resistente.</p>
    </div>
  </article>
</div>

    `;

        // toggle cuore
        const favBtn = box.querySelector(".btn-fav");
        favBtn?.addEventListener("click", async () => {
            if (!(await requireLogin())) return;

            try {
                const already = favBtn.classList.contains("is-fav");
                const url = `/api/favorites/${it.id}`;
                const opt = {
                    method: already ? "DELETE" : "POST",
                    credentials: "include",
                };
                const r = await fetch(url, opt);
                if (!r.ok && r.status !== 204) throw new Error();
                await favorites.refresh();
                const now = favorites.has(it.id);
                favBtn.classList.toggle("is-fav", now);
                favBtn.setAttribute("aria-pressed", String(now));
                favBtn.textContent = now ? "♥" : "♡";
            } catch {
                alert("Errore preferiti");
            }
        });
    } catch (err) {
        console.error(err);
        box.innerHTML = `<p class="muted">Errore nel caricamento. <small>${escapeHtml(
            err.message || String(err)
        )}</small></p>`;
        return;
    }

    // ===== Recensioni ===== (restano sotto a tutto)
    const revBox = document.getElementById("reviews-box");
    const revSummary = document.getElementById("reviews-summary");
    const revList = document.getElementById("reviews-list");
    const revForm = document.getElementById("review-form");
    const revMsg = document.getElementById("review-msg");
    if (!revBox || !revSummary || !revList) return;

    async function loadReviews() {
        try {
            const r = await fetch(`/api/reviews/${id}`, {
                credentials: "include",
                headers: { Accept: "application/json" },
            });
            if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
            const data = await r.json();

            if (data.summary?.count > 0) {
                revSummary.textContent = `Media: ${data.summary.avg} ⭐ su ${data.summary.count} recensioni`;
            } else {
                revSummary.textContent = "Non ci sono ancora recensioni.";
            }

            if (!data.reviews?.length) {
                revList.innerHTML = '<p class="muted">—</p>';
            } else {
                revList.innerHTML = data.reviews
                    .map((rv) => {
                        const who =
                            [rv.first_name, rv.last_name].filter(Boolean).join(" ").trim() ||
                            "Utente";
                        const stars = "⭐".repeat(
                            Math.max(1, Math.min(5, Number(rv.rating) || 0))
                        );
                        const date = rv.created_at?.slice(0, 10) || "";
                        return `
              <article class="card review-card">
                <div class="card-body review-body">
                  <div class="review-stars"><strong>${stars}</strong></div>
                  ${rv.comment
                                ? `<div class="review-text">${escapeHtml(
                                    rv.comment
                                )}</div>`
                                : ""
                            }
                  <div class="review-meta muted">${escapeHtml(
                                who
                            )} • ${date}</div>
                </div>
              </article>`;
                    })
                    .join("");
            }
        } catch {
            revSummary.textContent = "Impossibile caricare le recensioni.";
            revList.innerHTML = "";
        }
    }

    async function setupReviewForm() {
        if (!revForm) return;
        if (!auth.user) return;
        try {
            const r = await fetch(`/api/reviews/${id}/eligibility`, {
                credentials: "include",
            });
            if (!r.ok) return;
            const j = await r.json();
            if (j.canReview) {
                revForm.classList.remove("hidden");
            }
        } catch { }
    }

    revForm?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const fd = new FormData(revForm);
        const rating = Number(fd.get("rating"));
        const comment = (fd.get("comment") || "").toString().trim();

        if (!(rating >= 1 && rating <= 5)) {
            if (revMsg) revMsg.textContent = "Seleziona un voto valido (1-5).";
            return;
        }
        try {
            const res = await fetch("/api/reviews", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ itemId: id, rating, comment }),
            });
            if (!res.ok) {
                const e = await res.json().catch(() => ({}));
                throw new Error(e.error || "Errore invio recensione");
            }
            if (revMsg) revMsg.textContent = "Grazie! Recensione inviata.";
            revForm.reset();
            await loadReviews();
        } catch (err) {
            if (revMsg) revMsg.textContent = err.message || "Errore invio recensione";
        }
    });

    await loadReviews();
    await setupReviewForm();
}