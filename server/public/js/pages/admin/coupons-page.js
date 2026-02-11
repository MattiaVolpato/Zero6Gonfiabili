import { escapeHtml } from "../../core/ui.js";

export async function showCouponsAdmin(panel) {
    if (!panel) panel = document.getElementById("admin-panel");
    panel.innerHTML = `
    <h2 class="h4">Coupon</h2>

    <form id="form-coupon-new" class="stack">
      <strong>Nuovo coupon</strong>
      <label>Codice <input type="text" name="code" required placeholder="FESTA10" /></label>
      <label>Sconto (%) <input type="number" name="discount_percent" min="1" max="100" required /></label>
      <div class="flex-row gap-2">
        <label>Valido dal <input type="date" name="starts_at" /></label>
        <label>Valido al <input type="date" name="expires_at" /></label>
      </div>
      <label class="flex-row items-center gap-2">
        <input type="checkbox" name="is_active" checked /> Attivo
      </label>
      <button type="submit" class="btn">Crea</button>
    </form>

    <h3 class="h5 mt-3">Elenco</h3>
    
    <div class="admin-filters-toolbar">
      <label>Filtra stato
        <select id="admin-coupons-filter">
          <option value="all">Tutti</option>
          <option value="active">Attivi</option>
          <option value="inactive">Non attivi</option>
        </select>
      </label>
    </div>

    <div id="coupons-admin-list" class="stack"></div>
  `;

    const listBox = document.getElementById("coupons-admin-list");
    const filterSel = document.getElementById("admin-coupons-filter");

    filterSel.addEventListener("change", () => loadAndRender());

    async function loadAndRender() {
        const filter = filterSel.value || "all";
        const res = await fetch(`/api/admin/coupons?filter=${filter}`, { credentials: "include" });
        const cps = await res.json();
        renderCouponsAdmin(cps);
    }

    function renderCouponsAdmin(cps) {
        if (!cps.length) {
            listBox.innerHTML = '<p class="muted">Nessun coupon.</p>';
            return;
        }
        listBox.innerHTML = cps
            .map(
                (c) => `
      <article class="card" data-coupon-id="${c.id}">
        <div class="card-body stack">
          <div class="flex-row items-center gap-2">
            <strong class="mr-auto">#${c.id} ${escapeHtml(c.code)}</strong>
            <span class="muted">${c.is_active ? "attivo" : "off"}</span>
          </div>

          <form class="form-coupon-edit stack">
            <label>Codice <input type="text" name="code" value="${escapeHtml(
                    c.code
                )}" required /></label>
            <label>Sconto (%) <input type="number" name="discount_percent" min="1" max="100" value="${Number(
                    c.discount_percent
                )}" required /></label>
            <div class="flex-row gap-2">
              <label>Valido dal <input type="date" name="starts_at" value="${c.starts_at || ""
                    }" /></label>
              <label>Valido al <input type="date" name="expires_at" value="${c.expires_at || ""
                    }" /></label>
            </div>
            <label class="flex-row items-center gap-2">
              <input type="checkbox" name="is_active" ${c.is_active ? "checked" : ""
                    }/> Attivo
            </label>
            <div class="flex-row gap-2">
              <button class="btn btn-save" type="submit">Salva</button>
              <button class="btn btn-danger btn-delete" type="button">Elimina</button>
            </div>
          </form>
        </div>
      </article>
    `
            )
            .join("");

        // salva
        listBox.querySelectorAll(".form-coupon-edit").forEach((form) => {
            form.addEventListener("submit", async (e) => {
                e.preventDefault();
                const card = form.closest("[data-coupon-id]");
                const id = Number(card.dataset.couponId);
                const fd = new FormData(form);
                const payload = {
                    code: (fd.get("code") || "").toString().trim(),
                    discount_percent: Number(fd.get("discount_percent")),
                    starts_at: fd.get("starts_at") || null,
                    expires_at: fd.get("expires_at") || null,
                    is_active: form.querySelector('input[name="is_active"]').checked,
                };
                if (
                    !payload.code ||
                    !(payload.discount_percent >= 1 && payload.discount_percent <= 100)
                )
                    return alert("Controlla Codice e Sconto.");
                try {
                    await fetch(`/api/admin/coupons/${id}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify(payload),
                    });
                    alert("Salvato");
                    await loadAndRender();
                } catch (err) {
                    alert("Errore salvataggio");
                    console.error(err);
                }
            });
        });

        // elimina
        listBox.querySelectorAll(".btn-delete").forEach((btn) => {
            btn.addEventListener("click", async () => {
                if (!confirm("Eliminare definitivamente questo coupon?")) return;
                const id = Number(btn.closest("[data-coupon-id]").dataset.couponId);
                try {
                    await fetch(`/api/admin/coupons/${id}`, {
                        method: "DELETE",
                        credentials: "include",
                    });
                    await loadAndRender();
                } catch (err) {
                    alert("Errore eliminazione");
                    console.error(err);
                }
            });
        });
    }

    // crea nuovo
    const formNew = document.getElementById("form-coupon-new");
    formNew.addEventListener("submit", async (e) => {
        e.preventDefault();
        const fd = new FormData(formNew);
        const payload = {
            code: (fd.get("code") || "").toString().trim(),
            discount_percent: Number(fd.get("discount_percent")),
            starts_at: fd.get("starts_at") || null,
            expires_at: fd.get("expires_at") || null,
            is_active: formNew.querySelector('input[name="is_active"]').checked,
        };
        if (
            !payload.code ||
            !(payload.discount_percent >= 1 && payload.discount_percent <= 100)
        )
            return alert("Controlla Codice e Sconto.");
        try {
            await fetch("/api/admin/coupons", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(payload),
            });
            formNew.reset();
            await loadAndRender();
        } catch (err) {
            alert("Errore creazione");
            console.error(err);
        }
    });

    await loadAndRender();
}
