import { escapeHtml } from "../core/ui.js";

export async function initBlogPage() {
    const container = document.getElementById("blog-list");
    if (!container) return; // Should be in partial

    try {
        const res = await fetch("/api/blog");
        if (!res.ok) throw new Error("Errore caricamento blog");
        const posts = await res.json();
        renderPosts(posts, container);
    } catch (e) {
        console.error(e);
        container.innerHTML = '<p class="z6-muted">Impossibile caricare gli articoli.</p>';
    }
}

function renderPosts(posts, container) {
    if (!posts || posts.length === 0) {
        container.innerHTML = '<p class="z6-muted">Nessun articolo disponibile.</p>';
        return;
    }

    container.innerHTML = posts.map(post => {
        const date = new Date(post.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
        const imgStyle = post.image_url ? `src="${escapeHtml(post.image_url)}"` : 'src="/img/blog-placeholder.jpg"'; // Fallback image?
        // Using a generic fallback if no image or standard one

        return `
      <article class="blog-card">
        ${post.image_url ? `<img src="${escapeHtml(post.image_url)}" alt="${escapeHtml(post.title)}" class="blog-card__img" loading="lazy">` : ''}
        <div class="blog-card__content">
          <time class="blog-card__date">${date}</time>
          <h2 class="blog-card__title">${escapeHtml(post.title)}</h2>
          <div class="blog-card__excerpt">${escapeHtml(post.content)}</div>
          <!-- Link to full post if we had a detail page, for now just show content or expand? 
               User asked for "a page with blog". Assuming list is fine. 
               Maybe a "Read more" that expands? Or just full content if short? 
               Let's assume generic list for now. -->
        </div>
      </article>
    `;
    }).join("");
}
