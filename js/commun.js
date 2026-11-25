/* ═══════════════════════════════════════════════════════════════
   CODEX DES HÉROS — fonctions partagées par la création et la fiche
   ═══════════════════════════════════════════════════════════════ */
'use strict';

window.Codex = (() => {
  const SOURCE = 'donnees_fantasy.json';
  const CLE_STOCKAGE = 'fantasyCharacter';
  const ECHELLE_MAX = 15; // valeur maximale possible : 12 (race) + 3 (métier)
  const ORDRE_COMPETENCES = [
    'Force', 'Magie', 'Résistance', 'Vélocité', 'Adresse', 'Soin',
    'Vol à la tire', 'Furtivité', 'Fabrication', 'Élocution', 'Perception', 'Intimidation'
  ];

  async function chargerDonnees() {
    const reponse = await fetch(SOURCE, { cache: 'no-cache' });
    if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
    return reponse.json();
  }

  function echapper(texte) {
    return String(texte ?? '').replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  function imageRace(race) {
    if (!race.image) return '';
    return `<img src="${echapper(race.image)}" alt="" loading="lazy" decoding="async">`;
  }

  // Une illustration introuvable laisse place à l'initiale dorée de la race.
  document.addEventListener('error', e => {
    const img = e.target;
    if (img.tagName !== 'IMG') return;
    const niche = img.closest('.niche');
    if (niche) {
      niche.classList.add('sans-image');
      img.remove();
    }
  }, true);

  // Les illustrations sur fond blanc ou transparent se fondent dans le vélin.
  // Celles qui ont un fond coloré (coins opaques et non blancs) remplissent
  // plutôt toute la niche, comme un tableau dans une fenêtre en arc.
  document.addEventListener('load', e => {
    const img = e.target;
    if (img.tagName !== 'IMG') return;
    const niche = img.closest('.niche');
    if (niche && aUnFondOpaque(img)) niche.classList.add('a-fond');
  }, true);

  function aUnFondOpaque(img) {
    try {
      const toile = document.createElement('canvas');
      toile.width = toile.height = 16;
      const ctx = toile.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, 16, 16);
      const pixels = ctx.getImageData(0, 0, 16, 16).data;
      const coinsColores = [[0, 0], [15, 0], [0, 15], [15, 15]].filter(([x, y]) => {
        const i = (y * 16 + x) * 4;
        const luminosite = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
        return pixels[i + 3] > 200 && luminosite < 247;
      });
      return coinsColores.length >= 3;
    } catch {
      return false; // image d'une autre origine : on garde l'affichage par défaut
    }
  }

  function meilleuresCompetences(competences, nombre) {
    return Object.entries(competences)
      .sort((a, b) => b[1] - a[1])
      .slice(0, nombre)
      .map(([nom, val]) => ({ nom, val }));
  }

  function vitaux(race) {
    return `
      <div class="vitaux">
        <div class="vital vital--pv">
          <span class="vital-medaillon">${race.pv}</span>
          <span class="vital-libelle">Points<br>de vie</span>
        </div>
        <div class="vital vital--magie">
          <span class="vital-medaillon">${race.reserve_magie}</span>
          <span class="vital-libelle">Réserve<br>de magie</span>
        </div>
      </div>`;
  }

  function detailsRace(race, idTitre) {
    const fortes = new Set(meilleuresCompetences(race.skills, 3).map(c => c.nom));
    const lignes = ORDRE_COMPETENCES
      .filter(nom => nom in race.skills)
      .map(nom => `
        <li class="${fortes.has(nom) ? 'fort' : ''}">
          <span class="nom">${echapper(nom)}</span>
          <span class="points" aria-hidden="true"></span>
          <span class="val">${race.skills[nom]}</span>
        </li>`)
      .join('');

    return `
      <div class="race-detail">
        <figure class="niche" data-initiale="${echapper(race.label.charAt(0))}" style="margin:0">
          ${imageRace(race)}
        </figure>
        <div class="race-detail-texte">
          <p class="surtitre">Race</p>
          <h2 class="folio-titre" id="${idTitre}">${echapper(race.label)}</h2>
          <p class="texte-lettrine">${echapper(race.description)}</p>
          ${(race.points || []).map(p => `<p class="race-point"><span class="race-point-titre">${echapper(p.titre)}.</span> ${echapper(p.texte)}</p>`).join('')}
          ${vitaux(race)}
          <h3 class="titre-filet titre-filet--gauche">Compétences de base</h3>
          <ul class="liste-points">${lignes}</ul>
        </div>
      </div>`;
  }

  // Ellipse « à la plume » entourant une vertu ou un vice.
  function cercleEncre() {
    return `
      <svg class="cercle-encre" viewBox="0 0 120 48" preserveAspectRatio="none" aria-hidden="true">
        <path pathLength="1" d="M14 30 C8 18 34 7 64 6 C92 5 114 12 113 24 C112 37 84 44 56 43 C30 42 8 36 10 24 C12 16 24 11 36 9"/>
      </svg>`;
  }

  function brancherDialogue(dialogue) {
    // Un clic sur le voile (hors du folio) referme la fenêtre.
    dialogue.addEventListener('click', e => {
      if (e.target === dialogue) dialogue.close();
    });
    dialogue.querySelectorAll('[data-fermer]').forEach(bouton => {
      bouton.addEventListener('click', () => dialogue.close());
    });
  }

  function observerRevelations(racine = document) {
    const elements = racine.querySelectorAll('.revele:not(.est-visible)');
    if (!('IntersectionObserver' in window)) {
      elements.forEach(el => el.classList.add('est-visible'));
      return;
    }
    const observateur = new IntersectionObserver(entrees => {
      entrees.forEach(entree => {
        if (!entree.isIntersecting) return;
        entree.target.classList.add('est-visible');
        observateur.unobserve(entree.target);
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    elements.forEach(el => observateur.observe(el));
  }

  function panneauErreur() {
    return `
      <div class="panneau">
        <p class="surtitre">Le codex reste scellé</p>
        <h2>Impossible de lire les données</h2>
        <p>Le fichier <code>${SOURCE}</code> n'a pas pu être chargé.
        Si la page a été ouverte directement depuis le disque (<code>file://</code>),
        lancez-la plutôt via un petit serveur local — par exemple l'extension
        <em>Live Server</em> de VS Code.</p>
      </div>`;
  }

  return {
    CLE_STOCKAGE,
    ECHELLE_MAX,
    ORDRE_COMPETENCES,
    chargerDonnees,
    echapper,
    imageRace,
    meilleuresCompetences,
    vitaux,
    detailsRace,
    cercleEncre,
    brancherDialogue,
    observerRevelations,
    panneauErreur
  };
})();
