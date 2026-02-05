import { escapeHtml } from "../../core/ui.js";

export async function showBlogAdmin(panel) {
    if (!panel) panel = document.getElementById("admin-panel");
    panel.innerHTML = `
        <h2 class="h4">Gestione Blog</h2>
        <form id="form-blog-new" class="stack">
          <strong>Nuovo articolo</strong>
          <label>Titolo <input type="text" name="title" required /></label>
          <label>Contenuto <textarea name="content" rows="4" required></textarea></label>
          <label>URL Immagine <input type="text" name="image_url" placeholder="/img/..." /></label>
          <label>Pubblicato <select name="is_published"><option value="1">Sì</option><option value="0">No</option></select></label>
          <button type="submit" class="btn">Crea Articolo</button>
        </form>

        <div class="admin-filters-toolbar mt-3 mb-3">
            <label>Filtro: 
                <select id="admin-blog-filter">
                    <option value="all">Tutti</option>
                    <option value="published">Pubblicati</option>
                    <option value="draft">Bozze</option>
                </select>
            </label>
        </div>

        <h3 class="h5 mt-4">Articoli esistenti</h3>
        <div id="blog-admin-list" class="stack"></div>
      `;

    const formNew = document.getElementById("form-blog-new");
    const listContainer = document.getElementById("blog-admin-list");
    const filterSel = document.getElementById("admin-blog-filter");

    let allPosts = [];

    // Filter logic
    const applyFilter = () => {
        const val = filterSel.value;
        const filtered = allPosts.filter(p => {
            if (val === "published") return p.is_published;
            if (val === "draft") return !p.is_published;
            return true;
        });
        renderPosts(filtered);
    };

    filterSel.addEventListener("change", applyFilter);

    // Load items
    const loadPosts = async () => {
        listContainer.innerHTML = '<p class="muted">Caricamento...</p>';
        try {
            const res = await fetch("/api/admin/blog", { credentials: "include" });
            allPosts = await res.json();
            applyFilter();
        } catch (e) {
            listContainer.innerHTML = '<p class="muted">Errore caricamento</p>';
        }
    };
    loadPosts();

    // Create
    formNew.addEventListener("submit", async (e) => {
        e.preventDefault();
        const fd = new FormData(formNew);
        const data = {
            title: fd.get("title").trim(),
            content: fd.get("content").trim(),
            image_url: fd.get("image_url").trim(),
            is_published: fd.get("is_published") === "1"
        };
        try {
            const res = await fetch("/api/admin/blog", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
                credentials: "include"
            });
            if (!res.ok) throw new Error("Errore creazione");
            formNew.reset();
            loadPosts();
        } catch (e) {
            alert("Impossibile creare l'articolo.");
        }
    });

    function renderPosts(posts) {
        if (!posts.length) {
            listContainer.innerHTML = '<p class="muted">Nessun articolo.</p>';
            return;
        }
        listContainer.innerHTML = posts.map(p => `
          <article class="card stack" data-post-id="${p.id}">
             <div class="flex-row items-center gap-2">
                <strong>${escapeHtml(p.title)}</strong>
                <span class="muted">${p.is_published ? "Pubblicato" : "Bozza"}</span>
                <span class="muted text-small">${new Date(p.created_at).toLocaleDateString()}</span>
             </div>
             <form class="form-blog-edit stack">
                <input type="text" name="title" value="${escapeHtml(p.title)}" required />
                <textarea name="content" rows="3" required>${escapeHtml(p.content)}</textarea>
                <input type="text" name="image_url" value="${escapeHtml(p.image_url || "")}" placeholder="URL immagine" />
                <select name="is_published">
                  <option value="1" ${p.is_published ? "selected" : ""}>Pubblicato</option>
                  <option value="0" ${!p.is_published ? "selected" : ""}>Bozza</option>
                </select>
                <div class="flex-row gap-2">
                  <button type="submit" class="btn btn-sm">Salva</button>
                  <button type="button" class="btn btn-danger btn-sm btn-delete">Elimina</button>
                </div>
             </form>
          </article>
        `).join("");

        // Bind events
        listContainer.querySelectorAll("article").forEach(row => {
            const id = row.dataset.postId;
            const form = row.querySelector(".form-blog-edit");
            const btnDel = row.querySelector(".btn-delete");

            form.addEventListener("submit", async (e) => {
                e.preventDefault();
                const fd = new FormData(form);
                const data = {
                    title: fd.get("title").trim(),
                    content: fd.get("content").trim(),
                    image_url: fd.get("image_url").trim(),
                    is_published: fd.get("is_published") === "1"
                };
                try {
                    const res = await fetch(`/api/admin/blog/${id}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(data),
                        credentials: "include"
                    });
                    if (!res.ok) throw new Error("Errore salvataggio");
                    alert("Salvato!");
                    loadPosts();
                } catch (e) {
                    alert("Errore salvataggio");
                }
            });

            btnDel.addEventListener("click", async () => {
                if (!confirm("Eliminare questo articolo?")) return;
                try {
                    const res = await fetch(`/api/admin/blog/${id}`, { method: "DELETE", credentials: "include" });
                    if (!res.ok) throw new Error("Errore eliminazione");
                    loadPosts();
                } catch (e) { alert("Errore eliminazione"); }
            });
        });
    }
}
