// --- Loader frammenti server (forza il server a capire che vuoi un FRAMMENTO) ---
export class ViewLoader {
  static async load(viewPath) {
    const res = await fetch(`/views/${viewPath}`, {
      credentials: "include",
      headers: {
        "X-Fragment": "1",
        Accept: "text/html, text/html-fragment;q=0.9, */*;q=0.1",
      },
    });

    // << aggiungi questo blocco >>
    if (res.status === 401) {
      setFlash("Devi effettuare l’accesso per continuare.");
      const next = encodeURIComponent(window.location.pathname);
      if (window.page?.replace) window.page.replace(`/login?next=${next}`);
      else {
        history.replaceState(null, "", `/login?next=${next}`);
        window.location.replace(`/login?next=${next}`);
      }
      return "";
    }

    // << fine blocco >>

    if (!res.ok) {
      throw new Error(
        `Impossibile caricare la vista: ${viewPath} (status ${res.status})`
      );
    }
    const html = await res.text();
    if (/<!doctype html>/i.test(html)) {
      throw new Error(`Vista ${viewPath}: ricevuto index.html (fallback).`);
    }
    return html;
  }
}
