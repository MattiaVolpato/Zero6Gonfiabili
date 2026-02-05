import { escapeHtml } from "../../core/ui.js";

export async function showItemsAdmin(panel) {
    if (!panel) panel = document.getElementById("admin-panel");
    panel.innerHTML = `
    <h2 class="h4">Gonfiabili</h2>

    <form id="form-item-new" class="stack">
      <strong>Nuovo gonfiabile</strong>
      <label>Nome <input type="text" name="name" required /></label>
      <label>Descrizione <textarea name="description" rows="2"></textarea></label>
      <label>Prezzo al giorno (€) <input type="number" step="0.01" min="0" name="price_per_day" required /></label>
      <label>URL immagine <input type="text" name="image_url" /></label>
      <button type="submit" class="btn">Crea</button>
    </form>

    <div class="admin-filters-toolbar">
      <label>Filtra stato
        <select id="admin-items-filter">
          <option value="all">Tutti</option>
          <option value="active">Attivi</option>
          <option value="inactive">Non attivi</option>
        </select>
      </label>
    </div>

    <h3 class="h5">Catalogo</h3>
    <div id="items-admin-list" class="stack"></div>
  `;

    const listBox = document.getElementById("items-admin-list");
    const filterSel = document.getElementById("admin-items-filter");

    // Ricarica al cambio filtro
    filterSel.addEventListener("change", () => loadAndRender());

    async function loadAndRender() {
        const filter = filterSel.value || "all";
        const res = await fetch(`/api/admin/items?filter=${filter}`, { credentials: "include" });
        const items = await res.json();
        renderItemsAdmin(items);
    }

    function renderItemsAdmin(items) {
        if (!items.length) {
            listBox.innerHTML = '<p class="muted">Nessun elemento.</p>';
            return;
        }
        listBox.innerHTML = items
            .map(
                (it) => `
      <article class="card" data-item-id="${it.id}">
        <div class="card-body stack">
          <div class="flex-row items-center gap-2">
            <strong class="mr-auto">#${it.id} ${escapeHtml(
                    it.name || ""
                )}</strong>
            <span class="muted">${it.is_active ? "attivo" : "disattivo"}</span>
          </div>

          <form class="form-item-edit stack">
            <label>Nome <input type="text" name="name" value="${escapeHtml(
                    it.name || ""
                )}" required /></label>
            <label>Descrizione <textarea name="description" rows="2">${escapeHtml(
                    it.description || ""
                )}</textarea></label>
            <label>Prezzo al giorno (€) <input type="number" step="0.01" min="0" name="price_per_day" value="${Number(
                    it.price_per_day || 0
                )}" required /></label>
            <label>URL immagine <input type="text" name="image_url" value="${escapeHtml(
                    it.image_url || ""
                )}" /></label>
            <label class="flex-row items-center gap-2">
              <input type="checkbox" name="is_active" ${it.is_active ? "checked" : ""
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

        // bind salva
        listBox.querySelectorAll(".form-item-edit").forEach((form) => {
            form.addEventListener("submit", async (e) => {
                e.preventDefault();
                const card = form.closest("[data-item-id]");
                const id = Number(card.dataset.itemId);
                const fd = new FormData(form);
                const payload = {
                    name: (fd.get("name") || "").toString().trim(),
                    description: (fd.get("description") || "").toString(),
                    price_per_day: Number(fd.get("price_per_day")),
                    image_url: (fd.get("image_url") || "").toString().trim(),
                    is_active: form.querySelector('input[name="is_active"]').checked,
                };
                if (!payload.name || !(payload.price_per_day >= 0))
                    return alert("Controlla Nome e Prezzo.");
                try {
                    await fetch(`/api/admin/items/${id}`, {
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

        // bind elimina
        listBox.querySelectorAll(".btn-delete").forEach((btn) => {
            btn.addEventListener("click", async () => {
                if (!confirm("Eliminare definitivamente questo elemento?")) return;
                const id = Number(btn.closest("[data-item-id]").dataset.itemId);
                try {
                    await fetch(`/api/admin/items/${id}`, {
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
    const formNew = document.getElementById("form-item-new");
    formNew.addEventListener("submit", async (e) => {
        e.preventDefault();
        const fd = new FormData(formNew);
        const payload = {
            name: (fd.get("name") || "").toString().trim(),
            description: (fd.get("description") || "").toString(),
            price_per_day: Number(fd.get("price_per_day")),
            image_url: (fd.get("image_url") || "").toString().trim(),
        };
        if (!payload.name || !(payload.price_per_day >= 0))
            return alert("Controlla Nome e Prezzo.");
        try {
            await fetch("/api/admin/items", {
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

    // prima render
    await loadAndRender();
}
