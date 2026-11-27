// Applique le thème choisi avant l'affichage (évite un éclair de la mauvaise couleur).
// Même clé que src/domain/theme.ts. Fichier externe : la politique de sécurité interdit le script en ligne.
(function () {
  try {
    var choix = window.localStorage.getItem('invoice-pdf.theme');
    if (choix === 'light' || choix === 'dark') {
      document.documentElement.setAttribute('data-theme', choix);
    }
  } catch {
    // Stockage indisponible : thème de l'appareil.
  }
})();
