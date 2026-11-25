/* ═══════════════════════════════════════════════════════════════
   CODEX DES HÉROS — page d'accueil : les règles du jeu
   Les textes sont dans index.html ; les chiffres, tableaux et listes
   viennent des règles (regles.js) et des données (donnees_fantasy.json).
   ═══════════════════════════════════════════════════════════════ */
'use strict';

(() => {
  const $ = id => document.getElementById(id);
  const { echapper } = Codex;
  const R = Regles;
  const ROMAINS = ['', 'I', 'II', 'III', 'IV', 'V', 'U']; // U : sorts ultimes
  const nomNiveau = n => (n === R.NIVEAU_ULTIME ? 'Ultime' : `Niv. ${ROMAINS[n]}`);
  const seuil = c => (c.min === c.max ? `${c.min}` : `${c.min}–${c.max}`);
  const signe = n => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : 'aucun');

  demarrer();

  async function demarrer() {
    remplirRegles();
    rendrePaliersSorts();
    rendreVocations();
    Codex.observerRevelations();

    let d;
    try {
      d = await Codex.chargerDonnees();
    } catch (erreur) {
      console.error('Erreur de chargement des données :', erreur);
      document.querySelectorAll('[data-donnees]').forEach(el => {
        el.innerHTML = '<p class="note">Ces informations viennent du fichier de données : ouvrez le site via un serveur local pour les afficher.</p>';
      });
      return;
    }

    rendreCompetences(d);
    rendrePaliers(d);
    rendreRaces(d);
    rendreMetiers(d);
    rendreRoyaumes(d);
    rendreDegatsSorts(d);
    rendreUltimes(d);
    rendreArmesMagiques(d);
    rendreArmes(d);
    rendreProtections(d);
    Codex.observerRevelations();
  }

  // Les chiffres cités dans le texte viennent des règles (plafonds, coût double, sacrifice…).
  function remplirRegles() {
    document.querySelectorAll('[data-regle]').forEach(el => {
      const valeur = R[el.dataset.regle];
      if (valeur !== undefined) el.textContent = valeur;
    });
  }

  // ─── Petits gabarits (mêmes composants que le reste du site) ───

  function carte({ lettre, pigment, titre, meta, texte }, i) {
    return `
      <article class="carte">
        ${lettre ? `<span class="lettrine-bloc lettrine-bloc--${pigment || (i % 2 ? 'rubrique' : 'lapis')}" aria-hidden="true"><span>${echapper(lettre)}</span></span>` : ''}
        <p class="carte-titre">${echapper(titre)}</p>
        ${meta ? `<p class="carte-meta">${echapper(meta)}</p>` : ''}
        ${texte ? `<p class="carte-texte">${echapper(texte)}</p>` : ''}
      </article>`;
  }

  function tableau(legende, entetes, lignes) {
    return `
      <table class="tableau-regles">
        <caption class="sr-only">${echapper(legende)}</caption>
        <thead><tr>${entetes.map(e => `<th scope="col"${/^\d/.test(e) ? ' class="est-chiffre"' : ''}>${echapper(e)}</th>`).join('')}</tr></thead>
        <tbody>${lignes.map(([tete, ...cellules]) => `
          <tr><th scope="row">${tete}</th>${cellules.map(c => `<td>${echapper(c)}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>`;
  }

  // ─── II. Compétences ──────────────────────────────────────────

  function rendreCompetences(d) {
    const descriptions = d.descriptions_competences || {};
    const paliers = d.paliers_competences || {};
    $('accueilCompetences').innerHTML = Codex.ORDRE_COMPETENCES.map((nom, i) => carte({
      titre: nom,
      meta: paliers[nom] ? 'Avec paliers' : '',
      texte: descriptions[nom] || ''
    }, i)).join('');
  }

  // ─── III. Paliers ─────────────────────────────────────────────

  function rendrePaliers(d) {
    const paliers = d.paliers_competences || {};
    const lignes = Codex.ORDRE_COMPETENCES.filter(nom => paliers[nom]).map(nom => {
      const t = paliers[nom];
      const tete = `${echapper(nom)}<span class="tableau-detail">${echapper(t.effet)}</span>`;
      return [tete, ...(t.court || t.valeurs)];
    });
    $('accueilPaliers').innerHTML = tableau(
      'Ce que donne chaque palier selon la valeur réelle',
      ['Valeur réelle', ...R.GRILLE_PALIERS.map(seuil)],
      lignes
    );
  }

  // ─── IV. Races, métiers, royaumes, vocations ──────────────────

  function rendreRaces(d) {
    $('accueilRaces').innerHTML = Object.values(d.races).map((race, i) => carte({
      lettre: race.label.charAt(0),
      titre: race.label,
      meta: `${race.pv} PV · réserve de magie ${race.reserve_magie}`,
      texte: race.short_description
    }, i)).join('');
  }

  function rendreMetiers(d) {
    $('accueilMetiers').innerHTML = Object.values(d.metiers).map((metier, i) => carte({
      lettre: metier.label.charAt(0),
      titre: metier.label,
      meta: Object.entries(metier.bonus).map(([nom, valeur]) => `+${valeur} ${nom}`).join(', '),
      texte: `${metier.pouvoir.name} : ${metier.pouvoir.effect}`
    }, i)).join('');
  }

  function rendreRoyaumes(d) {
    $('accueilRoyaumes').innerHTML = Object.values(d.royaumes || {}).map((royaume, i) => carte({
      lettre: royaume.label.charAt(0),
      titre: royaume.label,
      meta: `${royaume.type} · ${royaume.dirigeant}`,
      texte: royaume.description
    }, i)).join('');
  }

  function rendreVocations() {
    $('accueilVocations').innerHTML = Object.values(R.VOCATIONS).map((v, i) => carte({
      lettre: v.label.charAt(0),
      titre: v.label,
      meta: 'À chaque niveau',
      texte: `+${R.POINTS_PAR_NIVEAU} point de compétence, +${v.pv} PV et +${v.pm} réserve de magie.`
    }, i)).join('');
  }

  // ─── VI. Magie ────────────────────────────────────────────────

  function rendrePaliersSorts() {
    $('accueilPaliersSorts').innerHTML = `
      <ol class="paliers" aria-label="Paliers de sorts selon la Magie réelle">${R.GRILLE_PALIERS.map(c => `
        <li class="palier${c.niveau ? ' est-atteint' : ''}">
          <span class="palier-nom">${c.niveau ? nomNiveau(c.niveau) : 'Aucun'}</span>
          <span class="palier-seuil">${seuil(c)}</span>
        </li>`).join('')}</ol>`;
  }

  function rendreDegatsSorts(d) {
    const table = d.degats_sorts || {};
    $('accueilDegatsSorts').innerHTML = tableau(
      'Dégâts des sorts d\'attaque selon leur niveau',
      ['Niveau du sort', 'Une cible', 'Zone'],
      R.NIVEAUX_SORTS.filter(n => table[n]).map(n => [nomNiveau(n), table[n].une, table[n].zone])
    );
  }

  function rendreUltimes(d) {
    const ultimes = d.sorts?.[R.NIVEAU_ULTIME] || [];
    $('accueilUltimes').innerHTML = ultimes.map((sort, i) => carte({
      lettre: ROMAINS[R.NIVEAU_ULTIME],
      pigment: 'rubrique',
      titre: sort.nom,
      meta: `Ultime · ${sort.cout} PM`,
      texte: R.effetSort(sort.effet, R.NIVEAU_ULTIME, d.degats_sorts)
    }, i)).join('');
  }

  function rendreArmesMagiques(d) {
    const baton = d.armes_magiques?.['Bâton'];
    const sceptre = d.armes_magiques?.Sceptre;
    if (!baton || !sceptre) return;
    const niveaux = Object.keys(baton.melee || {}).map(Number);
    $('accueilArmesMagiques').innerHTML = tableau(
      'Effets des bâtons et des sceptres selon leur niveau',
      ['Niveau', 'Bâton : coût des sorts', 'Sceptre : sorts d\'attaque', 'En mêlée'],
      niveaux.map(n => [`Niv. ${ROMAINS[n]}`, `−${baton.reduction_pm[n]} %`, `+${sceptre.bonus_sorts[n]}`, `${baton.melee[n]} + palier de Force`])
    );
  }

  // ─── VII. Armes, armures et boucliers ─────────────────────────

  function rendreArmes(d) {
    const melee = d.equipement?.melee;
    const distance = d.equipement?.distance;
    const magique = d.armes_magiques?.['Bâton'];
    if (!melee || !distance) return;
    const niveaux = Array.from({ length: melee.niveaux }, (_, i) => i + 1);
    $('accueilArmes').innerHTML = tableau(
      'Dégâts des armes selon leur niveau',
      ['Niveau', `${melee.label} (${melee.competence})`, `${distance.label} (${distance.competence})`, 'Bâton et sceptre'],
      niveaux.map(n => [`Niv. ${ROMAINS[n]}`, melee.degats[n], distance.degats[n], magique?.melee?.[n] || '—'])
    );
  }

  // Armures et boucliers : un seul tableau s'ils suivent les mêmes valeurs.
  function rendreProtections(d) {
    const categories = ['armure', 'bouclier'].map(cle => d.equipement?.[cle]).filter(Boolean);
    if (!categories.length) return;
    const lignes = c => Array.from({ length: c.niveaux }, (_, i) => i + 1)
      .map(n => [`Niv. ${ROMAINS[n]}`, c.defense[n], signe(Number(c.malus?.valeurs?.[n]) || 0)]);
    const identiques = categories.length === 2 && JSON.stringify(lignes(categories[0])) === JSON.stringify(lignes(categories[1]));
    const groupes = identiques ? [{ label: 'Armures et boucliers', c: categories[0] }] : categories.map(c => ({ label: c.label, c }));
    $('accueilProtections').innerHTML = groupes.map(({ label, c }) => `
      <div class="tableau-defile">${tableau(
        `${label} : défense et malus selon le niveau`,
        ['Niveau', `${label} : défense`, `Malus de ${c.malus?.competence || 'Vélocité'}`],
        lignes(c)
      )}</div>`).join('');
  }
})();
