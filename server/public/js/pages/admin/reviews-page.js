import { escapeHtml } from "../../core/ui.js";

export async function showReviewsAdmin(panel) {
    if (!panel) panel = document.getElementById("admin-panel");
    panel.innerHTML = `
    <h2 class="h4">Recensioni</h2>
    <div class="flex-row items-center gap-2 mt-2 mb-4">
      <label>Filtro:
        <select id="admin-rev-filter">
          <option value="pending">In attesa</option>
          <option value="approved">Approvate</option>
          <option value="all">Tutte</option>
        </select>
      </label>
    </div>
    <div id="reviews-admin-list" class="stack"></div>
  `;

    const listBox = document.getElementById("reviews-admin-list");
    const filterSel = document.getElementById("admin-rev-filter");

    // carica con filtro selezionato
    async function loadReviews() {
        const status = filterSel.value;
        listBox.innerHTML = '<p class="muted">Caricamento…</p>';
        try {
            const res = await fetch(
                `/api/admin/reviews?status=${encodeURIComponent(status)}`,
                { credentials: "include" }
            );
            if (!res.ok) throw new Error("Errore caricamento");
            const rows = await res.json();
            render(rows);
        } catch (e) {
            console.error(e);
            listBox.innerHTML = '<p class="muted">Errore nel caricamento.</p>';
        }
    }

    // renderizza elenco
    function render(rows) {
        if (!rows.length) {
            listBox.innerHTML = '<p class="muted">Nessuna recensione.</p>';
            return;
        }
        listBox.innerHTML = rows
            .map(
                (rev) => `
        <article class="card" data-rev-id="${rev.id}">
          <div class="card-body flex-row items-center gap-3">
            <div class="mr-auto">
              <div><strong>${escapeHtml(rev.item_name || "")}</strong> • ⭐${rev.rating
                    }</div>
              <div class="muted">${escapeHtml(rev.user_email || "")} • ${rev.created_at?.slice(0, 10) || ""
                    }</div>
              <div>${escapeHtml(rev.comment || "")}</div>
            </div>
            ${rev.is_approved
                        ? ""
                        : '<button class="btn btn-approve">Approva</button>'
                    }
            <button class="btn btn-danger btn-delete">Elimina</button>
          </div>
        </article>
      `
            )
            .join("");

        // Approva
        listBox.querySelectorAll(".btn-approve").forEach((b) => {
            b.addEventListener("click", async () => {
                const id = Number(b.closest("[data-rev-id]").dataset.revId);
                try {
                    await fetch(`/api/admin/reviews/${id}/approve`, {
                        method: "PUT",
                        credentials: "include",
                    });
                    await loadReviews();
                } catch {
                    alert("Errore approvazione");
                }
            });
        });

        // Elimina
        listBox.querySelectorAll(".btn-delete").forEach((b) => {
            b.addEventListener("click", async () => {
                const id = Number(b.closest("[data-rev-id]").dataset.revId);
                if (!confirm("Eliminare questa recensione?")) return;
                try {
                    await fetch(`/api/admin/reviews/${id}`, {
                        method: "DELETE",
                        credentials: "include",
                    });
                    await loadReviews();
                } catch {
                    alert("Errore eliminazione");
                }
            });
        });
    }

    // cambia filtro
    filterSel.addEventListener("change", loadReviews);

    // carica iniziale
    await loadReviews();
}
