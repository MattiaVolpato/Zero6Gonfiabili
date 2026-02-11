// --- FOOTER YEAR: Aggiornamento Anno ---
/**
 * Piccolo script utility per mantenere aggiornato l'anno di copyright nel footer.
 * Cerca l'elemento con id="year" e imposta l'anno corrente.
 */
(function () {
  const y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();
})();
