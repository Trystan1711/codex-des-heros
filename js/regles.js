/* ═══════════════════════════════════════════════════════════════
   CODEX DES HÉROS — règles du jeu
   Source : bas de la fiche des métiers. Partagé par le site
   et par la fiche HTML téléchargée (où ce fichier est intégré).
   ═══════════════════════════════════════════════════════════════ */
'use strict';

window.Regles = (() => {
  const PLAFOND_NIVEAU_1 = 13;   // aucune compétence au-dessus de 13 au niveau 1, même avec le métier
  const PLAFOND = 18;            // plafond absolu
  const SEUIL_COUT_DOUBLE = 15;  // passer de 14 à 15 coûte 2 points, et chaque point suivant aussi

  // Montée de niveau : 1 point de compétence, plus les PV et la réserve de la vocation.
  // À n'importe quel niveau, le point peut être échangé contre +25 PV ou +25 réserve magique.
  const POINTS_PAR_NIVEAU = 1;
  const GAIN_RENONCEMENT = 25;

  // Vocation choisie à la création, définitive : gains à chaque montée de niveau.
  const VOCATIONS = {
    equilibre: { label: 'Équilibré', pv: 10, pm: 5 },
    endurant:  { label: 'Endurant',  pv: 15, pm: 0 },
    mystique:  { label: 'Mystique',  pv: 5,  pm: 10 }
  };

  // Grille des paliers, commune à Force, Adresse, Magie, Résistance et Soin,
  // calculée sur la valeur réelle (race + métier + points de niveau, sans objets).
  // Pour la Magie, le palier est le plus haut niveau de sort débloqué (6 = ultimes).
  // Ce que donne chaque palier est dans les données (« paliers_competences »).
  const PALIER_DE_BASE = { niveau: 0, min: 0, max: 3 };
  const PALIERS = [
    { niveau: 1, min: 4,  max: 7 },
    { niveau: 2, min: 8,  max: 11 },
    { niveau: 3, min: 12, max: 14 },
    { niveau: 4, min: 15, max: 16 },
    { niveau: 5, min: 17, max: 17 },
    { niveau: 6, min: 18, max: 18 }
  ];
  const GRILLE_PALIERS = [PALIER_DE_BASE, ...PALIERS];
  const NIVEAU_ULTIME = 6;                       // sorts ultimes : Magie réelle à 18
  const NIVEAUX_SORTS = PALIERS.map(p => p.niveau);

  const REUSSITE_CRITIQUE = 1;  // au D20
  const ECHEC_CRITIQUE = 20;

  /** Jet de compétence : réussi si le D20 est égal ou inférieur au total ; 1 = réussite critique, 20 = échec critique. */
  function resultatJet(de, total) {
    if (de === REUSSITE_CRITIQUE) return { reussi: true, critique: true };
    if (de === ECHEC_CRITIQUE) return { reussi: false, critique: true };
    return { reussi: de <= total, critique: false };
  }

  function jetReussi(de, total) {
    return resultatJet(de, total).reussi;
  }

  /** Valeur d'une compétence au niveau 1 : race + métier, plafonnée à 13. */
  function valeurCreation(race, metier) {
    return Math.min(PLAFOND_NIVEAU_1, (race || 0) + (metier || 0));
  }

  /** Coût en points de compétence pour passer de `valeur` à `valeur + 1`. */
  function coutPoint(valeur) {
    return valeur + 1 >= SEUIL_COUT_DOUBLE ? 2 : 1;
  }

  /** Plus haut niveau de sort débloqué par la Magie réelle (0 = aucun). */
  function palierSorts(magie) {
    let niveau = 0;
    PALIERS.forEach(p => { if (magie >= p.min) niveau = p.niveau; });
    return niveau;
  }

  /** Palier suivant à atteindre, ou null si tout est débloqué. */
  function prochainPalier(magie) {
    return PALIERS.find(p => magie < p.min) || null;
  }

  /** Tirage d'un sort au hasard dans un niveau, parmi ceux que le personnage ne connaît pas. */
  function sortsATirer(liste, connus) {
    const deja = new Set(connus);
    return (liste || []).filter(s => !deja.has(s.nom));
  }

  /** Niveaux des sorts reçus à la création : un sort par palier atteint. */
  function sortsACreation(magie) {
    return Array.from({ length: palierSorts(magie) }, (_, i) => i + 1);
  }

  // ─── Paliers de compétence ────────────────────────────────────

  /**
   * Palier d'une compétence et ce qu'il donne, d'après la table des données
   * (`{ effet, valeurs: [7 valeurs, une par palier] }`). Null si la compétence n'a pas de paliers.
   */
  function palierCompetence(valeurReelle, table) {
    if (!table || !Array.isArray(table.valeurs)) return null;
    const niveau = palierSorts(valeurReelle);
    const palier = GRILLE_PALIERS[niveau];
    return { niveau, min: palier.min, max: palier.max, effet: table.effet, valeur: table.valeurs[niveau] ?? '' };
  }

  // ─── Dés ──────────────────────────────────────────────────────

  /** Additionne des formules de dés en regroupant les dés identiques : « 2D20 » + « +1D20 » + « 1D10 » = « 3D20 + 1D10 ». */
  function additionnerDes(...formules) {
    const compte = new Map();
    formules.forEach(formule => {
      String(formule ?? '').toUpperCase().replace(/\s+/g, '').split('+').forEach(terme => {
        const m = terme.match(/^(\d*)D(\d+)$/);
        if (!m) return; // « aucun », texte libre : ignoré
        const faces = Number(m[2]);
        compte.set(faces, (compte.get(faces) || 0) + (m[1] ? Number(m[1]) : 1));
      });
    });
    return [...compte.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([faces, nombre]) => `${nombre}D${faces}`)
      .join(' + ');
  }

  // ─── Sorts : dégâts et coût ───────────────────────────────────

  // Dans l'effet d'un sort d'attaque, {une} = dégâts sur une cible, {zone} = dégâts de zone.
  const MARQUES_DEGATS = /\{(une|zone)\}/g;

  /** Le sort a-t-il des dégâts calculés selon son niveau ? */
  function estSortAttaque(effet) {
    return /\{(une|zone)\}/.test(String(effet ?? ''));
  }

  /** Cibles d'un sort d'attaque présentes dans son effet, dans l'ordre : ['une', 'zone']… */
  function ciblesSort(effet) {
    return [...new Set([...String(effet ?? '').matchAll(MARQUES_DEGATS)].map(m => m[1]))];
  }

  /** Dégâts d'un sort d'attaque selon son niveau et sa cible (table des données), plus un éventuel bonus (sceptre). */
  function degatsSort(niveau, cible, table, bonus = '') {
    const base = table?.[niveau]?.[cible];
    return base ? additionnerDes(base, bonus) : '';
  }

  /** Texte de l'effet, où {une} et {zone} sont remplacés par les dégâts réels du sort. */
  function effetSort(effet, niveau, table, bonus = '') {
    return String(effet ?? '').replace(MARQUES_DEGATS, (marque, cible) => degatsSort(niveau, cible, table, bonus) || marque);
  }

  /** Coût en PM après la réduction d'un bâton (en %), arrondi à l'entier supérieur. */
  function coutReduit(cout, reductionPourcent) {
    const base = Math.max(0, parseInt(cout, 10) || 0);
    const r = Math.max(0, Math.min(100, Number(reductionPourcent) || 0));
    return r ? Math.ceil(base * (100 - r) / 100) : base;
  }

  // ─── Bâtons et sceptres ───────────────────────────────────────

  /**
   * Effets des bâtons et sceptres équipés, d'après la table des données (« armes_magiques »).
   * `objets` : [{ type, niveau, equipe }]. Le meilleur bâton et le meilleur sceptre comptent.
   */
  function effetsArmesMagiques(objets, table) {
    const meilleur = type => (objets || [])
      .filter(o => o.equipe && o.type === type && table?.[type])
      .sort((a, b) => (parseInt(b.niveau, 10) || 0) - (parseInt(a.niveau, 10) || 0))[0] || null;
    const baton = meilleur('Bâton');
    const sceptre = meilleur('Sceptre');
    return {
      baton,
      sceptre,
      reductionPM: baton ? Number(table['Bâton'].reduction_pm?.[baton.niveau]) || 0 : 0,
      bonusSorts: sceptre ? table['Sceptre'].bonus_sorts?.[sceptre.niveau] || '' : ''
    };
  }

  // ─── Équipement (catégories des données : « equipement ») ─────

  /**
   * Arme de mêlée (Force) ou à distance (Adresse) : compétence utilisée pour toucher
   * et pour le bonus de dégâts, et dés de l'arme selon son niveau (D10 pour un bâton ou un sceptre).
   */
  function infosArme(objet, equipement, armesMagiques) {
    const categorie = equipement?.[objet.categorie];
    if (!categorie?.competence) return null;
    const magique = categorie.competence === 'Force' ? armesMagiques?.[objet.type] : null;
    return {
      competence: categorie.competence,
      base: (magique?.melee || categorie.degats)?.[objet.niveau] || '',
      magique: !!magique
    };
  }

  /** Armure ou bouclier : dés de défense et malus de compétence (Vélocité) selon le niveau. */
  function protectionObjet(objet, equipement) {
    const categorie = equipement?.[objet.categorie];
    if (!categorie?.defense) return null;
    return {
      defense: categorie.defense[objet.niveau] || '',
      malus: categorie.malus ? { competence: categorie.malus.competence, valeur: Number(categorie.malus.valeurs?.[objet.niveau]) || 0 } : null
    };
  }

  /** Mains occupées par un objet : bâton 2, sceptre 1, bouclier 1 (d'après les données), 0 sinon. */
  function mainsObjet(objet, equipement, armesMagiques) {
    const magique = equipement?.[objet.categorie]?.competence === 'Force' ? armesMagiques?.[objet.type] : null;
    return Number(magique?.mains ?? equipement?.[objet.categorie]?.mains) || 0;
  }

  /** Mains occupées par les objets équipés. `mainsDe(objet)` donne les mains d'un objet. */
  function mainsOccupees(objets, mainsDe) {
    return (objets || []).filter(o => o.equipe).reduce((total, o) => total + (Number(mainsDe(o)) || 0), 0);
  }

  return {
    PLAFOND_NIVEAU_1,
    PLAFOND,
    SEUIL_COUT_DOUBLE,
    POINTS_PAR_NIVEAU,
    GAIN_RENONCEMENT,
    VOCATIONS,
    PALIER_DE_BASE,
    PALIERS,
    GRILLE_PALIERS,
    NIVEAU_ULTIME,
    NIVEAUX_SORTS,
    REUSSITE_CRITIQUE,
    ECHEC_CRITIQUE,
    resultatJet,
    jetReussi,
    valeurCreation,
    coutPoint,
    palierSorts,
    prochainPalier,
    sortsACreation,
    sortsATirer,
    palierCompetence,
    additionnerDes,
    estSortAttaque,
    ciblesSort,
    degatsSort,
    effetSort,
    coutReduit,
    effetsArmesMagiques,
    infosArme,
    protectionObjet,
    mainsObjet,
    mainsOccupees
  };
})();
