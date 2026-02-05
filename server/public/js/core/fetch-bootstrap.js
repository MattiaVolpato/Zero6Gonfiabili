import { getCsrfToken, CSRF } from "./csrf.js";

// Wrap globale di window.fetch
const __origFetch = window.fetch.bind(window);

window.fetch = async (input, init = {}) => {
  const method = (init?.method || "GET").toUpperCase();

  // 1) invia sempre cookie di sessione
  if (!init.credentials) init.credentials = "include";

  // Helper per aggiungere il token agli headers in modo sicuro
  const attachToken = async (headersObj) => {
    const token = await getCsrfToken();
    if (headersObj instanceof Headers) {
      headersObj.set("X-CSRF-Token", token);
      return headersObj;
    }
    return Object.assign({}, headersObj, { "X-CSRF-Token": token });
  };

  // 2) token CSRF solo per metodi con side-effect
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    init.headers = await attachToken(init.headers);
  }

  // 3) Esegui la richiesta originale
  let response = await __origFetch(input, init);

  // 4) AUTO-RETRY: Se riceviamo 403 (Forbidden) potrebbe essere il token scaduto
  if (response.status === 403) {
    const clone = response.clone();
    try {
      const data = await clone.json();
      // Se l'errore riguarda il CSRF (messaggio dal server)
      if (data.error && /CSRF|token/i.test(data.error)) {
        console.warn(
          "[Fetch] Token CSRF scaduto. Rinnovo e riprovo la richiesta..."
        );

        // Forza il refresh del token dal server
        await CSRF.refresh();

        // Riapplica il nuovo token agli headers
        init.headers = await attachToken(init.headers);

        // Riprova la fetch
        response = await __origFetch(input, init);
      }
    } catch (e) {
      // Se non è un JSON o non riusciamo a leggere, teniamo l'errore originale
    }
  }

  return response;
};
