/* ═══════════════════════════════════════════════════════════════
   CODEX DES HÉROS — fiche autonome
   Ce script est intégré tel quel dans la fiche HTML téléchargée.
   Il ne dépend que de Regles (js/regles.js, intégré juste avant).
   ═══════════════════════════════════════════════════════════════ */
'use strict';

(() => {
  // Copie exacte du fichier tel qu'il a été ouvert, prise avant toute
  // modification de la page : « Enregistrer le fichier » la réécrit
  // en y remplaçant seulement le bloc de données.
  const SOURCE = `<!DOCTYPE html>\n${document.documentElement.outerHTML}`;

  const R = window.Regles;
  const $ = id => document.getElementById(id);
  const ROMAINS = ['', 'I', 'II', 'III', 'IV', 'V', 'U']; // U : sorts ultimes
  // Anciens types d'objet (fiches d'avant les catégories) : [catégorie, type]
  const ANCIENS_TYPES = {
    'Arme': ['melee', 'Autre'], 'Bâton': ['melee', 'Bâton'], 'Sceptre': ['melee', 'Sceptre'],
    'Armure': ['armure', ''], 'Bouclier': ['bouclier', ''], 'Objet divers': ['objet', 'Autre']
  };
  const nomNiveau = n => (n === R.NIVEAU_ULTIME ? 'Ultime' : `Niveau ${n}`);
  const nomPalier = n => (!n ? 'Aucun' : n === R.NIVEAU_ULTIME ? 'Ultime' : `Niv. ${ROMAINS[n]}`);
  const seuilPalier = c => (c.min === c.max ? `${c.min}` : `${c.min}–${c.max}`);

  const echapper = texte => String(texte ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
  const entier = (valeur, defaut = 0) => {
    const n = parseInt(valeur, 10);
    return Number.isFinite(n) ? n : defaut;
  };
  const borner = (v, min, max) => Math.min(max, Math.max(min, v));
  const signe = n => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`);
  const nouvelId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

  // ─── Données ──────────────────────────────────────────────────

  const embarque = JSON.parse($('donnees-fiche').textContent);
  const COMPETENCES = embarque.reference.competences;
  const GRIMOIRE = embarque.reference.sorts || {};
  const DEGATS_SORTS = embarque.reference.degatsSorts || {};    // dégâts des sorts d'attaque par niveau
  const PALIERS = embarque.reference.paliers || {};             // ce que donne chaque palier de compétence
  const ARMES_MAGIQUES = embarque.reference.armesMagiques || {}; // bâtons et sceptres
  const EQUIPEMENT = embarque.reference.equipement || {};       // mêlée, distance, armures, boucliers, objets
  const CATEGORIES = Object.keys(EQUIPEMENT);
  // Boutons d'ajout : « Arme » (mêlée ou distance), « Armure » (armure ou bouclier), « Objet »
  const GROUPES = (embarque.reference.groupesEquipement?.length
    ? embarque.reference.groupesEquipement
    : CATEGORIES.map(c => ({ cle: c, bouton: EQUIPEMENT[c].onglet || EQUIPEMENT[c].label, titre: `Ajouter ${EQUIPEMENT[c].un}`, categories: [c] })))
    .map(g => ({ ...g, categories: g.categories.filter(c => EQUIPEMENT[c]) }))
    .filter(g => g.categories.length);
  const groupeDe = categorie => GROUPES.find(g => g.categories.includes(categorie)) || GROUPES[0];
  const CLE_STOCKAGE = `codex-fiche:${embarque.id}`;

  let p = embarque.perso;
  let modifieLe = embarque.modifieLe;
  let fichierModifieLe = embarque.modifieLe;
  let stockageDisponible = true;

  // La sauvegarde du navigateur l'emporte si elle est plus récente que le fichier.
  try {
    const local = JSON.parse(localStorage.getItem(CLE_STOCKAGE));
    if (local && local.perso && local.modifieLe > modifieLe) {
      p = local.perso;
      modifieLe = local.modifieLe;
    }
  } catch {
    stockageDisponible = false;
  }

  function normaliser() {
    p.niveau = Math.max(1, entier(p.niveau, 1));
    p.pv = { actuel: entier(p.pv?.actuel), max: entier(p.pv?.max) };
    p.pm = { actuel: entier(p.pm?.actuel), max: entier(p.pm?.max) };
    p.argent = Math.max(0, entier(p.argent));
    p.pointsLibres = Math.max(0, entier(p.pointsLibres));
    p.historique = Array.isArray(p.historique) ? p.historique : [];
    ['objets', 'sorts', 'boosts'].forEach(cle => { if (!Array.isArray(p[cle])) p[cle] = []; });
    p.notes = p.notes || '';
    p.competences = p.competences || {};
    COMPETENCES.forEach(nom => {
      p.competences[nom] = Object.assign({ race: 0, metier: 0, points: 0 }, p.competences[nom]);
    });
    // Fiches faites avec l'ancienne règle (+5 PV, puis un bonus de 10 au choix) :
    // chaque niveau garde ce qu'il a donné, et un niveau encore en attente reçoit son point.
    p.historique.forEach(h => {
      if (h.gain) return;
      h.gain = { pv: 5, pm: 0 };
      if (h.choix === 'pv' || h.choix === 'pm') h.montant = 10;
      if (!h.choix) p.pointsLibres += R.POINTS_PAR_NIVEAU;
    });
    // Objets d'avant les catégories : rangés dans la bonne catégorie, niveau ramené dans ses bornes.
    if (CATEGORIES.length) p.objets.forEach(o => {
      if (!EQUIPEMENT[o.categorie]) {
        const ancien = ANCIENS_TYPES[o.type];
        if (ancien) [o.categorie, o.type] = ancien;
        else {
          o.categorie = 'objet';
          if (!(EQUIPEMENT.objet?.types || []).includes(o.type)) o.type = 'Autre';
        }
      }
      const categorie = EQUIPEMENT[o.categorie];
      if (categorie.types && !categorie.types.includes(o.type)) o.type = 'Autre';
      if (categorie.niveaux) o.niveau = borner(entier(o.niveau, 1), 1, categorie.niveaux);
    });
  }

  // ─── Calculs ──────────────────────────────────────────────────

  // Détail d'une compétence : base (race), métier (plafonné à 13 au niveau 1),
  // points de niveau, puis objets équipés (bonus, malus d'armure).
  function sources(nom) {
    const c = p.competences[nom];
    const creation = R.valeurCreation(c.race, c.metier);
    const reel = creation + entier(c.points);
    const modificateurs = [];
    p.objets.filter(o => o.equipe).forEach(o => {
      (o.bonus || []).forEach(b => {
        const v = entier(b.valeur);
        if (b.competence === nom && v) modificateurs.push({ type: v < 0 ? 'malus' : 'objet', source: o.nom || 'Objet', valeur: v });
      });
      // Armure ou bouclier équipé : malus de Vélocité selon son niveau
      const malus = R.protectionObjet(o, EQUIPEMENT)?.malus;
      if (malus && malus.competence === nom && malus.valeur) modificateurs.push({ type: 'malus', source: o.nom || 'Armure', valeur: malus.valeur });
    });
    // Les boosts temporaires ne sont plus affichés : ils ne comptent plus dans le total.
    const total = reel + modificateurs.reduce((s, m) => s + m.valeur, 0);
    return {
      base: c.race,
      metier: creation - c.race,
      plafonne: c.race + c.metier > creation,
      points: entier(c.points),
      reel,
      modificateurs,
      total: Math.max(0, total)
    };
  }

  // Seule la Magie réelle (race + métier + points de niveau) débloque les sorts.
  const magieReelle = () => sources('Magie').reel;
  const palierActuel = () => R.palierSorts(magieReelle());

  // Bâton et sceptre équipés : coût des sorts réduit, dés en plus aux sorts d'attaque.
  const armesMagiques = () => R.effetsArmesMagiques(p.objets, ARMES_MAGIQUES);
  const coutReel = (sort, am = armesMagiques()) => R.coutReduit(sort.cout, am.reductionPM);
  const effetReel = (sort, am = armesMagiques()) => R.effetSort(sort.effet, sort.niveau, DEGATS_SORTS, am.bonusSorts);

  // Arme : la mêlée utilise la Force, la distance l'Adresse, pour toucher comme pour le bonus de dégâts
  // (palier sur la valeur réelle). Bâton et sceptre font des D10 au lieu de D20.
  function armeObjet(objet) {
    const arme = R.infosArme(objet, EQUIPEMENT, ARMES_MAGIQUES);
    if (!arme) return null;
    const s = sources(arme.competence);
    const palier = R.palierCompetence(s.reel, PALIERS[arme.competence]);
    const bonus = palier ? R.additionnerDes(palier.valeur) : '';
    return { ...arme, bonus, total: R.additionnerDes(arme.base, bonus), toucher: s.total };
  }

  // Objets déjà équipés qui empêchent d'équiper celui-ci (bâton à deux mains, sceptre et bouclier à une).
  const mainsDe = objet => R.mainsObjet(objet, EQUIPEMENT, ARMES_MAGIQUES);
  function mainsPrises(objet, exclu = objet) {
    const besoin = mainsDe(objet);
    if (!besoin) return [];
    const autres = p.objets.filter(o => o !== exclu && o.equipe && mainsDe(o));
    return R.mainsOccupees(autres, mainsDe) + besoin > 2 ? autres : [];
  }

  function messageMains(objet, genants) {
    const besoin = mainsDe(objet);
    return `${objet.nom || 'Cet objet'} se tient à ${besoin > 1 ? 'deux mains' : 'une main'} : retirez d'abord ${genants.map(o => o.nom || o.type).join(', ')}.`;
  }

  // ─── Sauvegarde ───────────────────────────────────────────────

  let minuterieSauvegarde = null;

  function memoriser(differe = false) {
    modifieLe = new Date().toISOString();
    clearTimeout(minuterieSauvegarde);
    if (differe) minuterieSauvegarde = setTimeout(sauver, 400);
    else sauver();
    majEtatSauvegarde();
  }

  function sauver() {
    try {
      localStorage.setItem(CLE_STOCKAGE, JSON.stringify({ id: embarque.id, modifieLe, perso: p }));
      stockageDisponible = true;
    } catch {
      stockageDisponible = false;
    }
    majEtatSauvegarde();
  }

  function majEtatSauvegarde() {
    const el = $('etatSauvegarde');
    if (!el) return;
    const fichierAJour = modifieLe <= fichierModifieLe;
    el.textContent = !stockageDisponible
      ? 'Sauvegarde automatique indisponible : pensez à enregistrer le fichier'
      : fichierAJour
        ? 'Sauvegardé dans ce navigateur · fichier à jour'
        : 'Sauvegardé dans ce navigateur · fichier à réenregistrer';
    el.classList.toggle('est-en-retard', !stockageDisponible || !fichierAJour);
  }

  // Modifie l'état, sauvegarde, redessine, et rend le focus au même bouton.
  function changer() {
    const actif = document.activeElement;
    const action = actif?.dataset?.action;
    const repere = actif && (actif.dataset.competence || actif.closest('[data-id]')?.dataset.id || actif.dataset.ressource || actif.dataset.choix);
    memoriser();
    rendreTout();
    if (!action) return;
    const cible = [...document.querySelectorAll(`[data-action="${action}"]`)].find(el =>
      [el.dataset.competence, el.closest('[data-id]')?.dataset.id, el.dataset.ressource, el.dataset.choix].includes(repere));
    if (cible && !cible.disabled) cible.focus({ preventScroll: true });
  }

  function enregistrerFichier() {
    clearTimeout(minuterieSauvegarde);
    sauver();
    const donnees = { ...embarque, modifieLe, perso: p };
    const json = JSON.stringify(donnees).replace(/</g, '\\u003c');
    const html = SOURCE.replace(
      /(<script type="application\/json" id="donnees-fiche">)[\s\S]*?(<\/script>)/,
      (_, debut, fin) => debut + json + fin
    );
    const nom = [p.prenom, p.nom].filter(Boolean).join(' ').replace(/[\\/:*?"<>|]+/g, '').trim() || 'Personnage';
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = `${nom}.html`;
    document.body.appendChild(lien);
    lien.click();
    lien.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    fichierModifieLe = modifieLe;
    majEtatSauvegarde();
    toast(`Fiche enregistrée : ${nom}.html`, 'succes');
  }

  // ─── Squelette de la page ─────────────────────────────────────

  function construire() {
    const ressource = (cle, libelle) => `
      <div class="ressource ressource--${cle}">
        <div class="ressource-tete">
          <div class="vital vital--${cle === 'pv' ? 'pv' : 'magie'}">
            <span class="vital-medaillon" id="${cle}-actuel">0</span>
            <span class="vital-libelle">${libelle}<br><span class="ressource-max">sur <b id="${cle}-max-texte">0</b></span></span>
          </div>
        </div>
        <div class="jauge-ressource" aria-hidden="true"><span id="${cle}-jauge"></span></div>
        <div class="ressource-actions">
          <label class="champ champ--compact champ--nombre"><span class="champ-libelle">Montant</span>
            <input type="number" min="0" step="1" value="5" id="${cle}-montant" inputmode="numeric"></label>
          <button type="button" class="bouton bouton--petit" data-action="retirer" data-ressource="${cle}">− Retirer</button>
          <button type="button" class="bouton bouton--petit bouton--lapis" data-action="ajouter" data-ressource="${cle}">+ Ajouter</button>
          <label class="champ champ--compact champ--nombre"><span class="champ-libelle">Maximum</span>
            <input type="number" min="0" step="1" id="${cle}-max" data-max="${cle}" inputmode="numeric"></label>
        </div>
      </div>`;

    const ongletsObjet = CATEGORIES.map(cle => `
      <button type="button" class="onglet" role="tab" data-action="onglet-objet" data-categorie="${cle}" aria-selected="false" title="${echapper(EQUIPEMENT[cle].label)}">${echapper(EQUIPEMENT[cle].onglet || EQUIPEMENT[cle].label)}</button>`).join('');
    // Ajout d'équipement : une seule ligne de boutons (Arme, Armure, Objet)
    const boutonsObjets = GROUPES.map(g => `
      <button type="button" class="bouton bouton--petit" data-action="nouvel-objet" data-groupe="${echapper(g.cle)}" title="${echapper(g.titre)}">+ ${echapper(g.bouton)}</button>`).join('');

    $('application').innerHTML = `
      <header class="barre">
        <span class="barre-marque">Codex des héros</span>
        <div class="barre-actions">
          <p class="etat-sauvegarde" id="etatSauvegarde" role="status"></p>
          <button type="button" class="bouton bouton--or" data-action="enregistrer-fichier">
            <svg class="icone" viewBox="0 0 24 24" aria-hidden="true"><use href="#telecharger"/></svg>
            Enregistrer le fichier
          </button>
        </div>
      </header>

      <main class="fiche-page">
        <article class="charte charte--compacte" id="charte">
          <svg class="coin coin--hg" aria-hidden="true"><use href="#coin"/></svg>
          <svg class="coin coin--hd" aria-hidden="true"><use href="#coin"/></svg>
          <svg class="coin coin--bg" aria-hidden="true"><use href="#coin"/></svg>
          <svg class="coin coin--bd" aria-hidden="true"><use href="#coin"/></svg>

          <!-- En-tête sur une ligne : portrait, identité, niveau -->
          <header class="fiche-tete">
            <div class="medaillon fiche-portrait"><div class="medaillon-interieur" id="portrait"></div></div>
            <div class="fiche-identite">
              <h1 class="charte-nom" id="nomComplet"></h1>
              <p class="charte-lignee" id="lignee"></p>
              <dl class="identite-ligne" id="identite"></dl>
            </div>
            <div class="niveau" id="niveau"></div>
          </header>
          <div id="niveauChoix"></div>

          <!-- PV, réserve de magie et bourse côte à côte -->
          <section class="ressources ressources--trois" aria-label="Points de vie, réserve de magie et bourse">
            ${ressource('pv', 'Points de vie')}
            ${ressource('pm', 'Réserve de magie')}
            <div class="ressource ressource--bourse">
              <div class="ressource-tete">
                <div class="vital">
                  <span class="vital-medaillon bourse-piece" id="argent">0</span>
                  <span class="vital-libelle">Pièces<br>dans la bourse</span>
                </div>
              </div>
              <div class="ressource-actions">
                <label class="champ champ--compact champ--nombre"><span class="champ-libelle">Montant</span>
                  <input type="number" min="0" step="1" value="10" id="argent-montant" inputmode="numeric"></label>
                <button type="button" class="bouton bouton--petit" data-action="depenser">Dépenser</button>
                <button type="button" class="bouton bouton--petit bouton--lapis" data-action="gagner">Gagner</button>
              </div>
            </div>
          </section>

          <div class="fiche-grille">
            <section class="fiche-bloc fiche-bloc--competences" aria-labelledby="t-competences">
              <h2 class="titre-filet titre-filet--gauche" id="t-competences">Compétences</h2>
              <div class="points-libres" id="pointsLibres" hidden></div>
              <ul class="comps" id="competences"></ul>
            </section>

            <section class="fiche-bloc fiche-bloc--sorts" aria-labelledby="t-sorts">
              <h2 class="titre-filet titre-filet--gauche" id="t-sorts">Sorts et don du métier</h2>
              <div id="sortsEntete"></div>
              <div class="cartes" id="sorts"></div>
              <button type="button" class="bouton bouton--petit bouton-ajout" data-action="ouvrir-grimoire">+ Ajouter un sort</button>
            </section>

            <section class="fiche-bloc fiche-bloc--objets" aria-labelledby="t-objets">
              <h2 class="titre-filet titre-filet--gauche" id="t-objets">Équipement</h2>
              <div class="equipement-ajout">${boutonsObjets}</div>
              <div id="objets"></div>
            </section>
          </div>

          <section class="fiche-bloc" aria-labelledby="t-apparence" id="apparenceSection" hidden>
            <h2 class="titre-filet titre-filet--gauche" id="t-apparence">Apparence</h2>
            <div id="apparence"></div>
          </section>

          <footer class="charte-pied">
            <p id="colophon">Inscrit au Codex des héros</p>
          </footer>
        </article>
      </main>

      <dialog class="folio" id="dlgObjet" aria-labelledby="dlgObjetTitre">
        <div class="folio-cadre">
          <button type="button" class="folio-fermer" data-fermer aria-label="Fermer">×</button>
          <p class="surtitre">Équipement</p>
          <h2 class="folio-titre" id="dlgObjetTitre">Ajouter un objet</h2>
          <div class="onglets" id="ongletsObjet" role="tablist" aria-label="Catégorie">${ongletsObjet}
          </div>
          <form id="formObjet" novalidate>
            <div class="champs" id="formObjetChamps"></div>
            <p class="note form-degats" id="formObjetDegats"></p>
            <fieldset class="bonus-objet" id="formObjetBonusBloc">
              <legend class="champ-libelle">Bonus de compétence — appliqués quand l'objet est équipé</legend>
              <ul class="bonus-liste" id="formObjetBonus"></ul>
              <button type="button" class="bouton bouton--petit bouton--discret" data-action="ajouter-bonus">+ Ajouter un bonus (ou un malus)</button>
            </fieldset>
            <label class="case"><input type="checkbox" name="equipe"> Équipé</label>
            <div class="folio-actions">
              <button type="button" class="bouton bouton--discret" data-fermer>Annuler</button>
              <button type="submit" class="bouton bouton--lapis">Enregistrer l'objet</button>
            </div>
          </form>
        </div>
      </dialog>

      <dialog class="folio" id="dlgSort" aria-labelledby="dlgSortTitre">
        <div class="folio-cadre">
          <button type="button" class="folio-fermer" data-fermer aria-label="Fermer">×</button>
          <p class="surtitre">Grimoire</p>
          <h2 class="folio-titre" id="dlgSortTitre">Ajouter un sort</h2>
          <div class="onglets" id="ongletsSort" role="tablist">
            <button type="button" class="onglet" role="tab" data-action="onglet" data-onglet="catalogue" aria-selected="true">Choisir dans le catalogue</button>
            <button type="button" class="onglet" role="tab" data-action="onglet" data-onglet="hasard" aria-selected="false">Sort aléatoire</button>
            <button type="button" class="onglet" role="tab" data-action="onglet" data-onglet="perso" aria-selected="false">Sort personnalisé</button>
          </div>
          <div class="onglet-panneau" data-panneau="grimoire" id="grimoire"></div>
          <form class="onglet-panneau" data-panneau="perso" id="formSort" novalidate hidden>
            <div class="champs">
              <label class="champ champ--plein"><span class="champ-libelle">Nom du sort</span><input type="text" name="nom" autocomplete="off"></label>
              <label class="champ"><span class="champ-libelle">Niveau</span><select name="niveau"></select></label>
              <label class="champ"><span class="champ-libelle">Coût (PM)</span><input type="number" name="cout" min="0" step="1" value="10"></label>
              <label class="champ champ--plein"><span class="champ-libelle">Effet</span><textarea name="effet" rows="3"></textarea></label>
            </div>
            <p class="note" id="formSortNote"></p>
            <div class="folio-actions">
              <button type="button" class="bouton bouton--discret" data-fermer>Annuler</button>
              <button type="submit" class="bouton bouton--lapis" id="formSortValider">Ajouter le sort</button>
            </div>
          </form>
        </div>
      </dialog>

      <div class="toast" id="toast" role="status" aria-live="polite"></div>`;
  }

  // ─── Parties fixes (identité, don, tempérament, apparence) ────

  function rendreFixe() {
    const nom = [p.prenom, p.nom].filter(Boolean).join(' ') || 'Héros sans nom';
    document.title = `${nom} — Fiche de personnage`;
    const [premiere = '', ...reste] = Array.from(nom);
    $('nomComplet').innerHTML = `<span class="initiale-or">${echapper(premiere)}</span>${echapper(reste.join(''))}`;
    // Race · métier · royaume d'origine, sur une seule ligne
    $('lignee').innerHTML = [
      p.race?.label && echapper(p.race.label),
      p.metier?.label && echapper(p.metier.label),
      p.royaume?.label && `<span title="Royaume d'origine">${echapper(p.royaume.label)}</span>`
    ].filter(Boolean).join(' <span class="sep" aria-hidden="true">·</span> ');

    const initiales = ((p.prenom || '').charAt(0) + (p.nom || '').charAt(0)).toUpperCase() || '?';
    $('portrait').innerHTML = p.portrait
      ? `<img src="${echapper(p.portrait)}" alt="Portrait de ${echapper(nom)}">`
      : `<span class="medaillon-initiales">${echapper(initiales)}</span>`;

    const lignes = [['Âge', p.age], ['Genre', p.genre], ['Origine', p.origine], ['Vocation', p.vocation?.label]];
    $('identite').innerHTML = lignes.filter(([, v]) => v)
      .map(([cle, val]) => `<div><dt>${cle}</dt><dd>${echapper(val)}</dd></div>`).join('');

    // Les anciennes fiches peuvent encore contenir une vertu et un vice, des boosts et des notes :
    // ils restent dans le fichier mais ne sont plus affichés.
    const texte = (p.description || '').trim();
    if (texte) {
      const paires = texte.split(/\n+/).map(l => l.trim()).filter(Boolean).map(l => l.match(/^([^:]{1,30}?)\s*:\s*(.+)$/));
      $('apparence').innerHTML = paires.every(Boolean)
        ? `<dl class="apparence-liste">${paires.map(([, c, v]) => `<div><dt>${echapper(c)}</dt><dd>${echapper(v)}</dd></div>`).join('')}</dl>`
        : `<p class="texte-lettrine apparence-texte">${echapper(texte)}</p>`;
      $('apparenceSection').hidden = false;
    }

    const date = p.creeLe ? new Date(p.creeLe) : null;
    if (date && !Number.isNaN(date.getTime())) {
      $('colophon').textContent = `Inscrit au Codex des héros le ${date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
    }
  }

  // ─── Parties vivantes ─────────────────────────────────────────

  function rendreTout() {
    rendreNiveau();
    rendreRessources();
    rendreCompetences();
    rendreSorts();
    rendreObjets();
    $('argent').textContent = p.argent;
  }

  function rendreNiveau() {
    const v = p.vocation;
    const entree = p.historique.find(h => !h.choix);
    const enAttente = p.historique.filter(h => !h.choix).length;
    const gain = R.GAIN_RENONCEMENT;
    const pointDispo = p.pointsLibres >= R.POINTS_PAR_NIVEAU;
    // Points déjà échangés contre +25 PV ou +25 réserve : l'échange peut être annulé.
    const echanges = p.historique.filter(h => (h.choix === 'pv' || h.choix === 'pm') && h.montant === gain);
    // En-tête : le niveau et ses deux boutons. Les choix en attente s'affichent juste dessous.
    $('niveau').innerHTML = `
      <div class="niveau-tete">
        <div class="vital">
          <span class="vital-medaillon niveau-medaillon">${p.niveau}</span>
          <span class="vital-libelle">Niveau</span>
        </div>
        <div class="niveau-boutons">
          <button type="button" class="bouton bouton--petit bouton--lapis" data-action="niveau-plus"${v ? '' : ' disabled'}${v ? ` title="+${R.POINTS_PAR_NIVEAU} point de compétence, +${v.pv} PV et +${v.pm} réserve magique"` : ''}>Monter de niveau</button>
          <button type="button" class="bouton bouton--petit bouton--discret" data-action="niveau-moins"${p.niveau <= 1 ? ' disabled' : ''}>Redescendre</button>
        </div>
      </div>`;
    $('niveauChoix').innerHTML = `
      ${v ? '' : `
        <div class="niveau-choix" role="group" aria-label="Vocation à choisir">
          <p>Cette fiche n'a pas encore de vocation : choisissez-la avant de monter de niveau. Le choix est définitif.</p>
          <div class="niveau-choix-boutons">${Object.entries(R.VOCATIONS).map(([cle, x]) => `
            <button type="button" class="bouton bouton--petit" data-action="vocation" data-choix="${cle}">${x.label} · +${x.pv} PV, +${x.pm} réserve</button>`).join('')}
          </div>
        </div>`}
      ${entree ? `
        <div class="niveau-choix" role="group" aria-label="Point de compétence du niveau ${entree.niveau}">
          <p>${enAttente > 1 ? `${enAttente} niveaux en attente — niveau ${entree.niveau}` : `Niveau ${entree.niveau} atteint`} : +${R.POINTS_PAR_NIVEAU} point de compétence, +${entree.gain.pv} PV et +${entree.gain.pm} réserve magique ajoutés.
            Vous pouvez renoncer à ce point pour gagner à la place :${pointDispo ? '' : ' (le point est déjà dépensé : rendez-le d\'abord avec le bouton −)'}</p>
          <div class="niveau-choix-boutons">
            <button type="button" class="bouton bouton--petit" data-action="choix-niveau" data-choix="pv"${pointDispo ? '' : ' disabled'}>+${gain} PV max</button>
            <button type="button" class="bouton bouton--petit" data-action="choix-niveau" data-choix="pm"${pointDispo ? '' : ' disabled'}>+${gain} réserve magique</button>
            <button type="button" class="bouton bouton--petit bouton--discret" data-action="choix-niveau" data-choix="point">Garder le point</button>
          </div>
        </div>` : ''}
      ${echanges.map(h => `
        <p class="note niveau-regle">Niveau ${h.niveau} : point de compétence échangé contre +${h.montant} ${h.choix === 'pv' ? 'PV' : 'réserve magique'}.
          <button type="button" class="lien" data-action="annuler-echange" data-choix="${h.niveau}">Annuler l'échange et récupérer le point</button></p>`).join('')}`;
  }

  function rendreRessources() {
    ['pv', 'pm'].forEach(cle => {
      const r = p[cle];
      $(`${cle}-actuel`).textContent = r.actuel;
      $(`${cle}-max-texte`).textContent = r.max;
      $(`${cle}-jauge`).style.width = `${r.max ? borner(r.actuel / r.max, 0, 1) * 100 : 0}%`;
      const champMax = $(`${cle}-max`);
      if (document.activeElement !== champMax) champMax.value = r.max;
    });
  }

  function rendreCompetences() {
    const libres = p.pointsLibres;
    const bloc = $('pointsLibres');
    bloc.hidden = !libres;
    bloc.innerHTML = libres
      ? `<b>${libres}</b> point${libres > 1 ? 's' : ''} à placer avec + (2 points par cran à partir de ${R.SEUIL_COUT_DOUBLE}, plafond ${R.PLAFOND}). Le − rend un point placé par erreur.`
      : '';

    $('competences').innerHTML = COMPETENCES.map((nom, i) => {
      const s = sources(nom);
      const types = new Set(s.modificateurs.map(m => m.type));
      const classes = ['comp', ...[...types].map(t => `a-${t}`)].join(' ');

      // Le détail du total (race, métier, niveaux, objets) reste accessible en infobulle.
      const detail = [
        `Base ${s.base}`,
        s.metier ? `${p.metier?.label || 'Métier'} ${signe(s.metier)}${s.plafonne ? ' (plafond 13)' : ''}` : '',
        s.points ? `niveaux ${signe(s.points)}` : '',
        ...s.modificateurs.map(m => `${m.source} ${signe(m.valeur)}`)
      ].filter(Boolean).join(' · ');

      let controles = '';
      if (libres || s.points) {
        const cout = R.coutPoint(s.reel);
        const rendu = s.points ? R.coutPoint(s.reel - 1) : 0; // ce que le dernier point a coûté
        const auPlafond = s.reel >= R.PLAFOND;
        const aideMoins = s.points
          ? `Retirer un point de ${echapper(nom)} (rend ${rendu} point${rendu > 1 ? 's' : ''})`
          : `Retirer un point de ${echapper(nom)} : impossible sous la valeur de race et de métier`;
        controles = `
          <span class="comp-points">
            <button type="button" class="mini" data-action="point-moins" data-competence="${echapper(nom)}" aria-label="${aideMoins}" title="${aideMoins}"${s.points ? '' : ' disabled'}>−</button>
            <button type="button" class="mini" data-action="point-plus" data-competence="${echapper(nom)}" aria-label="Ajouter un point à ${echapper(nom)} (coût ${cout})"${!auPlafond && libres >= cout ? '' : ' disabled'}>+</button>
            <span class="comp-cout">${auPlafond ? `plafond ${R.PLAFOND}` : `coût ${cout}`}</span>
          </span>`;
      }

      return `
        <li class="${classes}" style="--i:${i}">
          <div class="comp-ligne">
            <span class="competence-nom">${echapper(nom)}</span>
            <span class="points" aria-hidden="true"></span>
            ${palierCourt(R.palierCompetence(s.reel, PALIERS[nom]), PALIERS[nom])}
            <span class="comp-total" title="${echapper(detail)}">${s.total}</span>
            <button type="button" class="comp-jet" data-action="jet" data-competence="${echapper(nom)}" title="Jet de ${echapper(nom)} : D20 ≤ ${s.total}">
              <svg class="icone" viewBox="0 0 24 24" aria-hidden="true"><use href="#de"/></svg>
              <span class="sr-only">Lancer un D20 pour ${echapper(nom)}</span>
            </button>
          </div>
          ${controles ? `<div class="comp-sources">${controles}</div>` : ''}
        </li>`;
    }).join('');
  }

  // Palier actuel (valeur réelle, sans objets) en version courte : « dégâts +2D10 », « sorts niv. III »…
  // Le palier et l'effet complet sont dans l'infobulle.
  function palierCourt(palier, table) {
    if (!palier) return '';
    const valeur = table.court?.[palier.niveau] ?? palier.valeur;
    if (!valeur || valeur === 'aucun') return '';
    return `<span class="comp-palier" title="Palier ${seuilPalier(palier)} · ${echapper(palier.effet)} : ${echapper(palier.valeur)}">${table.abrege ? `${echapper(table.abrege)} ` : ''}<b>${echapper(valeur)}</b></span>`;
  }

  function paliersHtml(magie) {
    const palier = R.palierSorts(magie);
    return `<ol class="paliers" aria-label="Paliers de sorts selon la Magie">${R.GRILLE_PALIERS.map(c => `
      <li class="palier${c.niveau <= palier ? ' est-atteint' : ''}${c.niveau === palier ? ' est-actuel' : ''}">
        <span class="palier-nom">${nomPalier(c.niveau)}</span>
        <span class="palier-seuil">${seuilPalier(c)}</span>
      </li>`).join('')}</ol>`;
  }

  // Retrait d'un sort en attente de confirmation : { id } d'un sort, ou { verrouilles: true }.
  let retrait = null;

  function confirmationRetrait(question) {
    return `
      <span class="carte-confirmation" role="group" aria-label="${echapper(question)}">
        <span class="carte-confirmation-question">${echapper(question)}</span>
        <button type="button" class="bouton bouton--petit" data-action="confirmer-retrait">Oui</button>
        <button type="button" class="bouton bouton--petit bouton--discret" data-action="annuler-retrait">Annuler</button>
      </span>`;
  }

  // Dégâts réels d'un sort d'attaque (bonus du sceptre compris), comme ceux des armes.
  function degatsSortHtml(sort, am) {
    const cibles = R.ciblesSort(sort.effet);
    if (!cibles.length) return '';
    const libelles = { une: 'Dégâts', zone: 'Zone' };
    const des = cibles.map(c => {
      const valeur = R.degatsSort(sort.niveau, c, DEGATS_SORTS, am.bonusSorts);
      return valeur ? `<span class="etiquette etiquette--degats">${libelles[c]} ${echapper(valeur)}</span>` : '';
    }).join(' ');
    const sceptre = am.bonusSorts && des
      ? ` <span class="etiquette etiquette--objet" title="Objet équipé">+${echapper(am.bonusSorts)} ${echapper(am.sceptre.nom || 'Sceptre')}</span>`
      : '';
    return des ? `<p class="carte-degats">${des}${sceptre}</p>` : '';
  }

  function rendreSorts() {
    const magie = magieReelle();
    const palier = R.palierSorts(magie);
    const prochain = R.prochainPalier(magie);
    const debloques = R.palierCompetence(magie, PALIERS.Magie);
    const am = armesMagiques();
    const verrouilles = p.sorts.filter(s => s.niveau > palier);
    if (retrait?.verrouilles && !verrouilles.length) retrait = null;

    const armes = [
      am.baton && `−${am.reductionPM} % PM · ${am.baton.nom || 'Bâton'}`,
      am.sceptre && `+${am.bonusSorts} aux sorts d'attaque · ${am.sceptre.nom || 'Sceptre'}`
    ].filter(Boolean);

    // En-tête court : Magie réelle, niveaux débloqués, prochain palier
    $('sortsEntete').innerHTML = `
      <p class="sorts-magie">Magie réelle <b>${magie}</b> <span class="note">${palier
        ? `${debloques ? debloques.valeur : `niveaux I à ${ROMAINS[palier]}`}`
        : 'aucun sort débloqué'}${prochain ? ` · prochain palier à ${prochain.min}` : ''}</span></p>
      ${paliersHtml(magie)}
      ${armes.length ? `<p class="carte-bonus">${armes.map(a => `<span class="etiquette etiquette--objet" title="Objet équipé">${echapper(a)}</span>`).join('')}</p>` : ''}
      ${verrouilles.length ? `
        <div class="sorts-perdus">
          <p class="carte-alerte"><svg class="icone" viewBox="0 0 24 24" aria-hidden="true"><use href="#cadenas"/></svg>
            ${verrouilles.length > 1 ? `${verrouilles.length} sorts ne sont plus débloqués` : '1 sort n\'est plus débloqué'} par votre Magie réelle (signalé${verrouilles.length > 1 ? 's' : ''} en rouge).</p>
          <div class="carte-actions">${retrait?.verrouilles
            ? confirmationRetrait(verrouilles.length > 1 ? `Retirer ces ${verrouilles.length} sorts ?` : 'Retirer ce sort ?')
            : `<button type="button" class="bouton bouton--petit bouton--discret" data-action="retirer-verrouilles">${verrouilles.length > 1 ? 'Retirer ces sorts' : 'Retirer ce sort'}</button>`}</div>
        </div>` : ''}`;

    const tries = [...p.sorts].sort((a, b) => a.niveau - b.niveau || String(a.nom).localeCompare(String(b.nom), 'fr'));
    // Le don du métier (capacité spéciale) ouvre la liste, dans la même case que les sorts.
    $('sorts').innerHTML = donHtml() + (tries.length ? tries.map(s => {
      const verrouille = s.niveau > palier;
      const cout = coutReel(s, am);
      const assez = p.pm.actuel >= cout;
      const actions = retrait?.id === s.id
        ? confirmationRetrait('Retirer ce sort ?')
        : `
            <button type="button" class="bouton bouton--petit bouton--lapis" data-action="lancer"${verrouille || !assez ? ' disabled' : ''}>Lancer · −${cout} PM</button>
            <button type="button" class="bouton bouton--petit bouton--discret" data-action="modifier-sort">Modifier</button>
            <button type="button" class="bouton bouton--petit bouton--discret" data-action="supprimer-sort">Retirer</button>`;
      return `
        <article class="carte carte--sort${verrouille ? ' est-verrouille' : ''}" data-id="${echapper(s.id)}">
          <span class="lettrine-bloc lettrine-bloc--${s.niveau % 2 ? 'lapis' : 'rubrique'}" aria-hidden="true"><span>${ROMAINS[s.niveau] || s.niveau}</span></span>
          <p class="carte-titre">${echapper(s.nom)}</p>
          <p class="carte-meta">${nomNiveau(s.niveau)} · ${cout} PM${cout !== entier(s.cout) ? ` (base ${entier(s.cout)}, bâton −${am.reductionPM} %)` : ''}${s.personnalise ? ' · personnalisé' : ''}</p>
          ${verrouille ? `<p class="carte-alerte"><svg class="icone" viewBox="0 0 24 24" aria-hidden="true"><use href="#cadenas"/></svg> Verrouillé : il faut ${R.PALIERS[s.niveau - 1]?.min ?? R.PLAFOND} en Magie réelle</p>`
            : !assez ? `<p class="carte-alerte">Réserve insuffisante : ${p.pm.actuel} PM sur ${cout}</p>` : ''}
          ${degatsSortHtml(s, am)}
          <p class="carte-texte">${echapper(effetReel(s, am))}</p>
          <div class="carte-actions">${actions}
          </div>
        </article>`;
    }).join('') : `<p class="vide note">Aucun sort connu pour l'instant.</p>`);
  }

  function donHtml() {
    const pouvoir = p.metier?.pouvoir;
    if (!pouvoir?.name) return '';
    return `
      <article class="carte carte--don">
        <span class="lettrine-bloc lettrine-bloc--rubrique" aria-hidden="true"><span>${echapper(pouvoir.name.charAt(0))}</span></span>
        <p class="carte-titre">${echapper(pouvoir.name)}</p>
        <p class="carte-meta">Don du métier · ${echapper(p.metier.label || '')}</p>
        <p class="carte-texte">${echapper(pouvoir.effect)}</p>
      </article>`;
  }

  // Seules les catégories qui contiennent quelque chose s'affichent (mêlée, distance, armures, boucliers, objets).
  function rendreObjets() {
    const sections = CATEGORIES.map(cle => {
      const c = EQUIPEMENT[cle];
      const objets = p.objets.filter(o => o.categorie === cle);
      if (!objets.length) return '';
      return `
        <section class="equipement-categorie" aria-labelledby="t-objets-${cle}">
          <h3 class="equipement-titre" id="t-objets-${cle}">${echapper(c.label)}${c.competence ? ` <span class="note">· ${echapper(c.competence)}</span>` : ''}</h3>
          <div class="cartes">${objets.map(carteObjet).join('')}</div>
        </section>`;
    }).join('');
    $('objets').innerHTML = sections || '<p class="vide note">Aucun équipement pour l\'instant.</p>';
  }

  function carteObjet(o) {
    const c = EQUIPEMENT[o.categorie] || {};
    const bonus = (o.bonus || []).filter(b => entier(b.valeur)).map(b => {
      const v = entier(b.valeur);
      return `<span class="etiquette etiquette--${v < 0 ? 'malus' : 'objet'}">${signe(v)} ${echapper(b.competence)}</span>`;
    }).join('');
    const mains = mainsDe(o);
    const meta = [
      o.type || c.singulier || c.label,
      c.niveaux ? `niveau ${o.niveau}` : '',
      mains ? (mains > 1 ? 'deux mains' : 'une main') : '',
      o.equipe ? 'équipé' : ''
    ].filter(Boolean).join(' · ');
    return `
      <article class="carte carte--objet${o.equipe ? ' est-equipe' : ''}" data-id="${echapper(o.id)}">
        <span class="lettrine-bloc lettrine-bloc--${c.competence ? 'rubrique' : 'lapis'}" aria-hidden="true"><span>${echapper((o.nom || '?').charAt(0).toUpperCase())}</span></span>
        <p class="carte-titre">${echapper(o.nom || 'Objet sans nom')}</p>
        <p class="carte-meta">${echapper(meta)}</p>
        ${armeHtml(o)}
        ${protectionHtml(o)}
        ${o.description ? `<p class="carte-texte">${echapper(o.description)}</p>` : ''}
        ${bonus ? `<p class="carte-bonus">${bonus}${o.equipe ? '' : ' <span class="note">s\'appliquent une fois équipé</span>'}</p>` : ''}
        <div class="carte-actions">
          <label class="case"><input type="checkbox" data-action="equiper"${o.equipe ? ' checked' : ''}> Équipé</label>
          ${o.categorie === 'objet' || entier(o.quantite, 1) !== 1 ? `
          <span class="quantite" aria-label="Quantité">
            <button type="button" class="mini" data-action="quantite-moins" aria-label="Retirer un exemplaire"${o.quantite > 0 ? '' : ' disabled'}>−</button>
            <span class="quantite-valeur">×${o.quantite}</span>
            <button type="button" class="mini" data-action="quantite-plus" aria-label="Ajouter un exemplaire">+</button>
          </span>` : ''}
          <button type="button" class="bouton bouton--petit bouton--discret" data-action="modifier-objet">Modifier</button>
          <button type="button" class="bouton bouton--petit bouton--discret" data-action="supprimer-objet">Supprimer</button>
        </div>
      </article>`;
  }

  // Bâton ou sceptre : effet sur les sorts.
  function effetArmeMagique(type, niveau) {
    const table = ARMES_MAGIQUES[type];
    if (!table) return '';
    if (table.reduction_pm) return `Sorts −${table.reduction_pm[niveau] ?? 0} % PM`;
    if (table.bonus_sorts) return `Sorts d'attaque +${table.bonus_sorts[niveau] ?? ''}`;
    return '';
  }

  // Arme : dégâts réels (dés de l'arme + palier) et jet pour toucher avec sa compétence.
  function armeHtml(o) {
    const arme = armeObjet(o);
    if (!arme) return '';
    // Une seule ligne : dégâts réels et jet pour toucher ; le détail est dans les infobulles.
    const detail = arme.bonus
      ? `${arme.base} + palier de ${arme.competence} (+${arme.bonus})`
      : `${arme.base} (palier de ${arme.competence} : aucun bonus)`;
    const effet = arme.magique ? effetArmeMagique(o.type, o.niveau) : '';
    return `
      <p class="carte-degats">
        <span class="etiquette etiquette--degats" title="${echapper(detail)}">Dégâts ${echapper(arme.total || arme.base)}</span>
        <span class="etiquette etiquette--race" title="${echapper(arme.competence)} · sur un ${R.REUSSITE_CRITIQUE} : +1D20 de dégâts">Toucher ≤ ${arme.toucher} · ${echapper(arme.competence)}</span>
        ${effet ? `<span class="etiquette etiquette--objet"${o.equipe ? '' : ' title="S\'applique une fois équipé"'}>${echapper(effet)}</span>` : ''}
      </p>`;
  }

  // Armure ou bouclier : défense et malus de Vélocité (appliqué une fois équipé).
  function protectionHtml(o) {
    const protection = R.protectionObjet(o, EQUIPEMENT);
    if (!protection) return '';
    const malus = protection.malus?.valeur
      ? `<span class="etiquette etiquette--malus"${o.equipe ? '' : ' title="S\'applique une fois équipé"'}>${signe(protection.malus.valeur)} ${echapper(protection.malus.competence)}</span>`
      : '';
    return `<p class="carte-degats"><span class="etiquette etiquette--race">Défense ${echapper(protection.defense)}</span> ${malus}</p>`;
  }

  // ─── Actions ──────────────────────────────────────────────────

  function brancher() {
    document.addEventListener('click', e => {
      const cible = e.target.closest('[data-action]');
      if (!cible || cible.disabled || cible.type === 'checkbox') return;
      const id = cible.closest('[data-id]')?.dataset.id;
      const nom = cible.dataset.competence;
      const actions = {
        'enregistrer-fichier': enregistrerFichier,
        'retirer': () => modifierRessource(cible.dataset.ressource, -1),
        'ajouter': () => modifierRessource(cible.dataset.ressource, 1),
        'depenser': () => modifierBourse(-1),
        'gagner': () => modifierBourse(1),
        'niveau-plus': monterNiveau,
        'niveau-moins': redescendre,
        'choix-niveau': () => choisirBonus(cible.dataset.choix),
        'annuler-echange': () => annulerEchange(entier(cible.dataset.choix)),
        'vocation': () => choisirVocation(cible.dataset.choix),
        'point-plus': () => ajouterPoint(nom),
        'point-moins': () => retirerPoint(nom),
        'jet': () => jet(nom),
        'ouvrir-grimoire': ouvrirGrimoire,
        'onglet': () => afficherOnglet(cible.dataset.onglet),
        'choisir-palier': () => choisirPalier(entier(cible.dataset.niveau)),
        'tirer-sort': tirerSortGrimoire,
        'apprendre-sort': () => apprendreSort(cible.dataset.nom),
        'lancer': () => lancerSort(id),
        'modifier-sort': () => ouvrirEditionSort(id),
        'supprimer-sort': () => demanderRetrait({ id }),
        'retirer-verrouilles': () => demanderRetrait({ verrouilles: true }),
        'confirmer-retrait': confirmerRetrait,
        'annuler-retrait': annulerRetrait,
        'nouvel-objet': () => ouvrirObjet(null, cible.dataset.groupe),
        'onglet-objet': () => changerCategorieObjet(cible.dataset.categorie),
        'modifier-objet': () => ouvrirObjet(id),
        'supprimer-objet': () => supprimer('objets', id),
        'quantite-plus': () => changerQuantite(id, 1),
        'quantite-moins': () => changerQuantite(id, -1),
        'ajouter-bonus': () => $('formObjetBonus').insertAdjacentHTML('beforeend', ligneBonus()),
        'retirer-bonus': () => cible.closest('.bonus-ligne').remove()
      };
      actions[cible.dataset.action]?.();
    });

    // Objet équipé ou non
    $('objets').addEventListener('change', e => {
      if (e.target.dataset.action !== 'equiper') return;
      const objet = p.objets.find(o => o.id === e.target.closest('[data-id]').dataset.id);
      const genants = e.target.checked ? mainsPrises(objet) : [];
      if (genants.length) {
        e.target.checked = false;
        toast(messageMains(objet, genants), 'erreur');
        return;
      }
      objet.equipe = e.target.checked;
      changer();
      toast(objet.equipe ? `${objet.nom} équipé : ses bonus s'appliquent.` : `${objet.nom} retiré.`);
    });

    // Maximums de PV et de réserve
    document.addEventListener('change', e => {
      const cle = e.target.dataset?.max;
      if (!cle) return;
      p[cle].max = Math.max(0, entier(e.target.value, p[cle].max));
      p[cle].actuel = Math.min(p[cle].actuel, p[cle].max);
      changer();
    });

    // Fenêtres : fermeture par la croix, « Annuler » ou un clic sur le voile
    // (délégué : le grimoire redessine ses propres boutons « Fermer »)
    document.querySelectorAll('dialog.folio').forEach(dialogue => {
      dialogue.addEventListener('click', e => {
        if (e.target === dialogue || e.target.closest('[data-fermer]')) dialogue.close();
      });
    });

    $('formObjet').addEventListener('submit', enregistrerObjet);
    // Les champs changent avec la catégorie : écoute déléguée
    $('formObjet').addEventListener('change', e => {
      if (e.target.name === 'type' || e.target.name === 'niveau') majDegatsFormulaire();
    });
    $('formSort').addEventListener('submit', enregistrerSortPerso);

    // Ne rien perdre si la page se ferme pendant une saisie
    window.addEventListener('pagehide', () => {
      clearTimeout(minuterieSauvegarde);
      sauver();
    });
  }

  function montant(id) {
    return Math.abs(entier($(id).value));
  }

  function modifierRessource(cle, sens) {
    const valeur = montant(`${cle}-montant`);
    if (!valeur) return;
    const r = p[cle];
    r.actuel = borner(r.actuel + sens * valeur, 0, r.max);
    changer();
  }

  function modifierBourse(sens) {
    const valeur = montant('argent-montant');
    if (!valeur) return;
    if (sens < 0 && valeur > p.argent) {
      toast(`La bourse ne contient que ${p.argent} pièces.`, 'erreur');
      return;
    }
    p.argent += sens * valeur;
    changer();
  }

  // Niveau : 1 point de compétence, plus les PV et la réserve de la vocation.
  function monterNiveau() {
    const v = p.vocation;
    if (!v) return toast('Choisissez d\'abord la vocation du personnage.', 'erreur');
    p.niveau += 1;
    p.pv.max += v.pv;
    p.pv.actuel += v.pv;
    p.pm.max += v.pm;
    p.pm.actuel += v.pm;
    p.pointsLibres += R.POINTS_PAR_NIVEAU;
    p.historique.push({ niveau: p.niveau, gain: { pv: v.pv, pm: v.pm }, choix: null });
    changer();
    toast(`Niveau ${p.niveau} : +${R.POINTS_PAR_NIVEAU} point de compétence, +${v.pv} PV et +${v.pm} réserve magique.`, 'succes');
  }

  // Garder le point du niveau, ou y renoncer pour +25 PV ou +25 réserve magique.
  function choisirBonus(choix) {
    const entree = p.historique.find(h => !h.choix);
    if (!entree) return;
    if (choix === 'pv' || choix === 'pm') {
      if (p.pointsLibres < R.POINTS_PAR_NIVEAU) return toast('Ce point est déjà dépensé : rendez-le d\'abord (bouton −).', 'erreur');
      p.pointsLibres -= R.POINTS_PAR_NIVEAU;
      entree.montant = R.GAIN_RENONCEMENT;
      p[choix].max += R.GAIN_RENONCEMENT;
      p[choix].actuel += R.GAIN_RENONCEMENT;
    }
    entree.choix = choix;
    changer();
  }

  // Annule l'échange d'un niveau : les +25 PV (ou réserve) disparaissent et le point revient à placer.
  function annulerEchange(niveau) {
    const entree = p.historique.find(h => h.niveau === niveau && (h.choix === 'pv' || h.choix === 'pm') && h.montant === R.GAIN_RENONCEMENT);
    if (!entree) return;
    const r = p[entree.choix];
    r.max = Math.max(0, r.max - entree.montant);
    r.actuel = Math.min(r.actuel, r.max);
    p.pointsLibres += R.POINTS_PAR_NIVEAU;
    entree.choix = null; // le niveau redevient en attente : garder le point ou l'échanger autrement
    delete entree.montant;
    changer();
    toast(`Échange du niveau ${niveau} annulé : +${R.POINTS_PAR_NIVEAU} point de compétence à placer.`, 'succes');
  }

  // Annule le dernier niveau : ses gains de vocation, et son point ou ce qui l'a remplacé.
  function redescendre() {
    if (p.niveau <= 1) return;
    const entree = p.historique[p.historique.length - 1] || { gain: { pv: 0, pm: 0 }, choix: null };
    const echange = entree.choix === 'pv' || entree.choix === 'pm';
    const point = echange ? 0 : R.POINTS_PAR_NIVEAU;
    if (p.pointsLibres < point) {
      toast('Rendez d\'abord un point de compétence (bouton −) avant de redescendre.', 'erreur');
      return;
    }
    p.historique.pop();
    p.niveau -= 1;
    p.pointsLibres -= point;
    p.pv.max = Math.max(0, p.pv.max - (entree.gain?.pv || 0) - (entree.choix === 'pv' ? entree.montant : 0));
    p.pm.max = Math.max(0, p.pm.max - (entree.gain?.pm || 0) - (entree.choix === 'pm' ? entree.montant : 0));
    p.pv.actuel = Math.min(p.pv.actuel, p.pv.max);
    p.pm.actuel = Math.min(p.pm.actuel, p.pm.max);
    changer();
  }

  // Fiches antérieures à la vocation : elle se choisit une fois, définitivement.
  function choisirVocation(cle) {
    const v = R.VOCATIONS[cle];
    if (!v || p.vocation) return;
    if (!confirm(`Choisir la vocation ${v.label} (+${v.pv} PV et +${v.pm} réserve magique par niveau) ? Ce choix est définitif.`)) return;
    p.vocation = { cle, ...v };
    rendreFixe();
    changer();
  }

  function ajouterPoint(nom) {
    const s = sources(nom);
    if (s.reel >= R.PLAFOND) return toast(`${nom} est déjà au plafond de ${R.PLAFOND}.`, 'erreur');
    const cout = R.coutPoint(s.reel);
    if (p.pointsLibres < cout) return toast(`Passer ${nom} à ${s.reel + 1} coûte ${cout} points.`, 'erreur');
    p.competences[nom].points = s.points + 1;
    p.pointsLibres -= cout;
    changer();
  }

  // Rend exactement ce que le point a coûté ; impossible sous la valeur de race + métier.
  function retirerPoint(nom) {
    const s = sources(nom);
    if (!s.points) return;
    const palierAvant = palierActuel();
    p.competences[nom].points = s.points - 1;
    p.pointsLibres += R.coutPoint(s.reel - 1);
    changer();
    const palier = palierActuel();
    if (palier < palierAvant) {
      const perdus = p.sorts.filter(x => x.niveau > palier).length;
      toast(perdus
        ? `Palier de Magie perdu : ${perdus > 1 ? `${perdus} sorts ne sont plus débloqués` : '1 sort n\'est plus débloqué'} (en rouge dans Sorts).`
        : 'Palier de Magie perdu.', 'erreur');
    }
  }

  function jet(nom) {
    const s = sources(nom);
    const de = 1 + Math.floor(Math.random() * 20);
    const { reussi, critique } = R.resultatJet(de, s.total);
    const verdict = critique ? (reussi ? 'réussite critique' : 'échec critique') : reussi ? 'réussite' : 'échec';
    toast(`${nom} : D20 = ${de} ${de <= s.total ? '≤' : '>'} ${s.total} — ${verdict}`, reussi ? 'succes' : 'erreur');
  }

  function supprimer(liste, id) {
    const element = p[liste].find(x => x.id === id);
    if (!element) return;
    const nom = element.nom || 'cet élément';
    if (!confirm(`Supprimer « ${nom} » ?`)) return;
    p[liste] = p[liste].filter(x => x.id !== id);
    changer();
  }

  function changerQuantite(id, sens) {
    const objet = p.objets.find(o => o.id === id);
    if (!objet) return;
    objet.quantite = Math.max(0, entier(objet.quantite) + sens);
    changer();
  }

  // ─── Sorts ────────────────────────────────────────────────────

  let sortEnEdition = null;

  function lancerSort(id) {
    const sort = p.sorts.find(s => s.id === id);
    if (!sort) return;
    if (sort.niveau > palierActuel()) return toast('Ce sort est verrouillé : votre Magie réelle est trop basse.', 'erreur');
    const cout = coutReel(sort); // réduction du bâton comprise
    if (p.pm.actuel < cout) return toast(`Réserve insuffisante : ${cout} PM nécessaires.`, 'erreur');
    p.pm.actuel -= cout;
    changer();
    toast(`${sort.nom} lancé : −${cout} PM (reste ${p.pm.actuel}).`, 'succes');
  }

  // ─── Retrait d'un sort : petite confirmation dans la carte ────

  function focaliser(selecteur) {
    document.querySelector(selecteur)?.focus({ preventScroll: true });
  }

  function demanderRetrait(cible) {
    retrait = cible;
    rendreSorts();
    focaliser(cible.id ? `#sorts [data-id="${CSS.escape(cible.id)}"] [data-action="annuler-retrait"]` : '#sortsEntete [data-action="annuler-retrait"]');
  }

  function annulerRetrait() {
    const precedent = retrait;
    retrait = null;
    rendreSorts();
    focaliser(precedent?.id ? `#sorts [data-id="${CSS.escape(precedent.id)}"] [data-action="supprimer-sort"]` : '#sortsEntete [data-action="retirer-verrouilles"]');
  }

  // Un sort retiré redevient disponible au tirage (et peut être réécrit à la main).
  function confirmerRetrait() {
    if (!retrait) return;
    const palier = palierActuel();
    const retires = retrait.id
      ? p.sorts.filter(s => s.id === retrait.id)
      : p.sorts.filter(s => s.niveau > palier);
    retrait = null;
    if (!retires.length) return rendreSorts();
    p.sorts = p.sorts.filter(s => !retires.includes(s));
    changer();
    focaliser('[data-action="ouvrir-grimoire"]');
    toast(retires.length > 1 ? `${retires.length} sorts retirés.` : `${retires[0].nom} retiré : il pourra être réappris.`, 'succes');
  }

  // Onglets du grimoire : « catalogue » et « hasard » partagent le panneau #grimoire, « perso » est le formulaire.
  function afficherOnglet(nom) {
    if (tirageEnCours) return;
    document.querySelectorAll('#ongletsSort [data-onglet]').forEach(o => o.setAttribute('aria-selected', String(o.dataset.onglet === nom)));
    const grimoire = nom === 'catalogue' || nom === 'hasard';
    if (grimoire && nom !== modeGrimoire) {
      modeGrimoire = nom;
      rendreGrimoire();
    }
    $('grimoire').hidden = !grimoire;
    $('formSort').hidden = grimoire;
  }

  function ouvrirGrimoire() {
    sortEnEdition = null;
    // Par défaut, le plus haut palier débloqué où il reste des sorts à apprendre
    palierTirage = [...R.NIVEAUX_SORTS].reverse()
      .find(n => n <= palierActuel() && R.sortsATirer(GRIMOIRE[n], connus()).length) || null;
    $('dlgSortTitre').textContent = 'Ajouter un sort';
    $('ongletsSort').hidden = false;
    rendreGrimoire();
    remplirFormulaireSort(null);
    afficherOnglet(modeGrimoire);
    $('dlgSort').showModal();
    $('dlgSort').scrollTop = 0;
  }

  function ouvrirEditionSort(id) {
    const sort = p.sorts.find(s => s.id === id);
    if (!sort) return;
    sortEnEdition = id;
    $('dlgSortTitre').textContent = 'Modifier le sort';
    $('ongletsSort').hidden = true;
    remplirFormulaireSort(sort);
    afficherOnglet('perso');
    $('dlgSort').showModal();
  }

  // ─── Ajout d'un sort : le joueur choisit le palier, puis le sort (catalogue) ou le hasard ──

  let palierTirage = null;
  let tirageEnCours = false;
  let modeGrimoire = 'catalogue'; // ou 'hasard'

  const connus = () => p.sorts.map(s => s.nom);

  function carteTirage(s) {
    return `
      <article class="carte est-choisie">
        <span class="lettrine-bloc lettrine-bloc--${s.niveau % 2 ? 'lapis' : 'rubrique'}" aria-hidden="true"><span>${ROMAINS[s.niveau]}</span></span>
        <p class="carte-titre" aria-live="polite">${echapper(s.nom)}</p>
        <p class="carte-meta">${s.effet ? `${nomNiveau(s.niveau)} · ${coutReel(s)} PM` : `${nomNiveau(s.niveau)} · la roue tourne…`}</p>
        <p class="carte-texte">${echapper(effetReel(s))}</p>
      </article>`;
  }

  // Seuls les paliers débloqués par la Magie réelle sont proposés.
  // Catalogue : tout le niveau, les sorts connus marqués. Hasard : parmi les sorts inconnus seulement.
  function rendreGrimoire(tire = null) {
    const palier = palierActuel();
    const catalogue = modeGrimoire === 'catalogue';
    const restants = n => R.sortsATirer(GRIMOIRE[n], connus()).length;
    if (palierTirage && (palierTirage > palier || (!catalogue && !restants(palierTirage)))) palierTirage = null;

    const cases = R.NIVEAUX_SORTS.map(n => {
      const verrouille = n > palier;
      const reste = restants(n);
      const etat = verrouille ? `Magie ${R.PALIERS[n - 1].min}` : reste ? `${reste} à découvrir` : 'tous connus';
      const indisponible = verrouille || (!catalogue && !reste);
      return `
        <li><button type="button" class="palier${verrouille ? '' : ' est-atteint'}" data-action="choisir-palier" data-niveau="${n}" aria-pressed="${palierTirage === n}"${indisponible ? ' disabled' : ''}>
          <span class="palier-nom">${nomPalier(n)}</span>
          <span class="palier-seuil">${etat}</span>
        </button></li>`;
    }).join('');

    const note = !palier
      ? 'Aucun niveau de sort débloqué : il faut 4 en Magie réelle.'
      : catalogue
        ? 'Choisissez un palier débloqué par votre Magie réelle (sans les objets), puis le sort à apprendre.'
        : 'Choisissez un palier débloqué par votre Magie réelle (sans les objets). Le sort est ensuite tiré au hasard parmi ceux de ce niveau que vous ne connaissez pas encore.';

    $('grimoire').innerHTML = `
      <p class="note">${note}</p>
      <ol class="paliers paliers--choix" aria-label="Palier du sort">${cases}</ol>
      ${catalogue ? catalogueHtml() : `<div class="cartes" id="tirage">${tire ? carteTirage(tire) : ''}</div>`}
      <div class="folio-actions">
        <button type="button" class="bouton bouton--discret" data-fermer>Fermer</button>
        ${catalogue ? '' : `
        <button type="button" class="bouton bouton--lapis" data-action="tirer-sort" id="btnTirer"${palierTirage ? '' : ' disabled'}>
          <svg class="icone de" viewBox="0 0 24 24" aria-hidden="true"><use href="#de"/></svg>
          ${tire ? 'Tirer un autre sort' : 'Tirer à la roue'}
        </button>`}
      </div>`;
  }

  // Sorts du palier choisi, avec leur description, leur coût et leurs dégâts réels.
  function catalogueHtml() {
    const n = palierTirage;
    if (!n) return '';
    const am = armesMagiques();
    const deja = new Set(connus());
    const liste = [...(GRIMOIRE[n] || [])].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    return `<div class="cartes" id="catalogue">${liste.map(ref => {
      const s = { ...ref, niveau: n };
      const connu = deja.has(ref.nom);
      const cout = coutReel(s, am);
      return `
        <article class="carte carte--sort${connu ? ' est-choisie' : ''}">
          <span class="lettrine-bloc lettrine-bloc--${n % 2 ? 'lapis' : 'rubrique'}" aria-hidden="true"><span>${ROMAINS[n]}</span></span>
          <p class="carte-titre">${echapper(ref.nom)}</p>
          <p class="carte-meta">${nomNiveau(n)} · ${cout} PM${cout !== entier(ref.cout) ? ` (base ${entier(ref.cout)}, bâton −${am.reductionPM} %)` : ''}</p>
          ${degatsSortHtml(s, am)}
          <p class="carte-texte">${echapper(effetReel(s, am))}</p>
          <div class="carte-actions">
            <button type="button" class="bouton bouton--petit bouton--lapis" data-action="apprendre-sort" data-nom="${echapper(ref.nom)}"${connu ? ' disabled' : ''}>${connu ? 'Déjà connu' : 'Apprendre ce sort'}</button>
          </div>
        </article>`;
    }).join('')}</div>`;
  }

  function apprendreSort(nom) {
    const n = palierTirage;
    if (!n || n > palierActuel()) return;
    const ref = (GRIMOIRE[n] || []).find(s => s.nom === nom);
    if (!ref || connus().includes(ref.nom)) return;
    const boutons = [...document.querySelectorAll('#catalogue [data-action="apprendre-sort"]')];
    const position = boutons.findIndex(b => b.dataset.nom === nom);
    p.sorts.push({ id: nouvelId(), nom: ref.nom, niveau: n, cout: ref.cout, effet: ref.effet, personnalise: false });
    changer();
    rendreGrimoire();
    // Le focus passe au sort suivant encore à apprendre, sans faire défiler la fenêtre.
    const suivants = [...document.querySelectorAll('#catalogue [data-action="apprendre-sort"]')];
    const cible = suivants.slice(position + 1).find(b => !b.disabled) || suivants.find(b => !b.disabled)
      || document.querySelector('#grimoire [data-fermer]');
    cible?.focus({ preventScroll: true });
    toast(`${ref.nom} appris et ajouté à vos sorts.`, 'succes');
  }

  function choisirPalier(n) {
    if (tirageEnCours) return;
    palierTirage = n;
    rendreGrimoire();
    document.querySelector(`#grimoire [data-niveau="${n}"]`)?.focus();
  }

  // La roue fait défiler quelques noms, puis le sort tiré rejoint la fiche.
  function tirerSortGrimoire() {
    const n = palierTirage;
    if (!n || tirageEnCours || n > palierActuel()) return;
    const liste = R.sortsATirer(GRIMOIRE[n], connus());
    if (!liste.length) return;
    const ref = liste[Math.floor(Math.random() * liste.length)];
    const sort = { id: nouvelId(), nom: ref.nom, niveau: n, cout: ref.cout, effet: ref.effet, personnalise: false };

    const finir = () => {
      tirageEnCours = false;
      p.sorts.push(sort);
      rendreGrimoire(sort);
      changer();
      $('btnTirer')?.focus();
      toast(`${sort.nom} tiré au sort et ajouté à vos sorts.`, 'succes');
    };

    const bouton = $('btnTirer');
    bouton.classList.remove('lance');
    void bouton.offsetWidth;
    bouton.classList.add('lance');
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return finir();

    tirageEnCours = true;
    document.querySelectorAll('#grimoire button').forEach(b => { b.disabled = !b.matches('[data-fermer]'); });
    $('tirage').innerHTML = carteTirage({ nom: liste[0].nom, niveau: n, cout: 0, effet: '' });
    const nom = $('tirage').querySelector('.carte-titre');
    let tour = 0;
    const roue = setInterval(() => {
      tour += 1;
      nom.textContent = liste[Math.floor(Math.random() * liste.length)].nom;
      if (tour >= 14) {
        clearInterval(roue);
        finir();
      }
    }, 65);
  }

  function remplirFormulaireSort(sort) {
    const f = $('formSort');
    const palier = palierActuel();
    const courant = sort?.niveau;
    f.elements.namedItem('niveau').innerHTML = R.NIVEAUX_SORTS.map(n => {
      const verrouille = n > palier && n !== courant;
      return `<option value="${n}"${verrouille ? ' disabled' : ''}>${n === R.NIVEAU_ULTIME ? 'Ultime' : `Niveau ${ROMAINS[n]}`}${n > palier ? ' — verrouillé' : ''}</option>`;
    }).join('');
    f.elements.namedItem('nom').value = sort?.nom || '';
    f.elements.namedItem('niveau').value = String(courant || Math.max(1, palier));
    f.elements.namedItem('cout').value = sort?.cout ?? 10;
    f.elements.namedItem('effet').value = sort?.effet || '';
    const aucun = !palier && !sort;
    $('formSortNote').textContent = aucun
      ? 'Aucun niveau de sort débloqué : il faut 4 en Magie réelle.'
      : 'Coût de base, avant la réduction d\'un bâton. Dans l\'effet, {une} et {zone} affichent les dégâts du niveau (sur une cible, en zone), bonus du sceptre compris.';
    $('formSortValider').disabled = aucun;
    $('formSortValider').textContent = sort ? 'Enregistrer le sort' : 'Ajouter le sort';
  }

  function enregistrerSortPerso(e) {
    e.preventDefault();
    const f = e.target;
    const nom = f.elements.namedItem('nom').value.trim();
    const niveau = borner(entier(f.elements.namedItem('niveau').value, 1), 1, R.NIVEAU_ULTIME);
    const existant = sortEnEdition ? p.sorts.find(s => s.id === sortEnEdition) : null;
    if (!nom) return toast('Donnez un nom au sort.', 'erreur');
    if (niveau > palierActuel() && niveau !== existant?.niveau) return toast('Ce niveau de sort est verrouillé.', 'erreur');
    const valeurs = {
      nom,
      niveau,
      cout: Math.max(0, entier(f.elements.namedItem('cout').value)),
      effet: f.elements.namedItem('effet').value.trim()
    };
    if (existant) Object.assign(existant, valeurs);
    else p.sorts.push({ id: nouvelId(), personnalise: true, ...valeurs });
    $('dlgSort').close();
    changer();
    toast(existant ? `${nom} modifié.` : `${nom} ajouté à vos sorts.`, 'succes');
  }

  // ─── Équipement ───────────────────────────────────────────────

  let objetEnEdition = null;

  function ligneBonus(bonus = { competence: COMPETENCES[0], valeur: 1 }) {
    const options = COMPETENCES.map(nom => `<option${nom === bonus.competence ? ' selected' : ''}>${echapper(nom)}</option>`).join('');
    return `
      <li class="bonus-ligne">
        <label class="champ champ--compact"><span class="champ-libelle">Compétence</span><select data-bonus="competence">${options}</select></label>
        <label class="champ champ--compact champ--nombre"><span class="champ-libelle">Valeur</span><input type="number" step="1" data-bonus="valeur" value="${entier(bonus.valeur, 1)}"></label>
        <button type="button" class="croix" data-action="retirer-bonus" aria-label="Retirer ce bonus">×</button>
      </li>`;
  }

  // Catégorie affichée dans la fenêtre d'objet (onglet sélectionné)
  let categorieObjet = null;

  // « Arme » propose mêlée ou distance, « Armure » armure ou bouclier, « Objet » les objets.
  function ouvrirObjet(id, cleGroupe) {
    const objet = id ? p.objets.find(o => o.id === id) : null;
    objetEnEdition = objet ? id : null;
    const groupe = objet ? groupeDe(objet.categorie) : GROUPES.find(g => g.cle === cleGroupe) || GROUPES[0];
    categorieObjet = objet?.categorie || groupe.categories[0];
    $('dlgObjetTitre').textContent = objet ? 'Modifier l\'objet' : groupe.titre;
    document.querySelectorAll('#ongletsObjet [data-categorie]').forEach(o => { o.hidden = !groupe.categories.includes(o.dataset.categorie); });
    $('ongletsObjet').hidden = groupe.categories.length < 2;
    $('formObjetBonus').innerHTML = (objet?.bonus || []).map(ligneBonus).join('');
    rendreFormObjet({
      nom: objet?.nom || '',
      type: objet?.type,
      niveau: objet?.niveau || 1,
      quantite: objet?.quantite ?? 1,
      description: objet?.description || '',
      equipe: objet ? !!objet.equipe : true
    });
    $('dlgObjet').showModal();
    $('dlgObjet').scrollTop = 0;
  }

  // Seulement les champs de la catégorie : type d'arme ou d'objet, niveau (1 à 5 ou 1 à 3), bonus pour les objets.
  function rendreFormObjet(v) {
    const c = EQUIPEMENT[categorieObjet];
    document.querySelectorAll('#ongletsObjet [data-categorie]').forEach(o => o.setAttribute('aria-selected', String(o.dataset.categorie === categorieObjet)));
    const niveaux = Array.from({ length: c.niveaux || 0 }, (_, i) => i + 1);
    const niveau = borner(entier(v.niveau, 1), 1, c.niveaux || 1);
    const type = c.types?.includes(v.type) ? v.type : c.types?.[0];
    $('formObjetChamps').innerHTML = `
      <label class="champ champ--plein"><span class="champ-libelle">Nom</span><input type="text" name="nom" autocomplete="off" placeholder="${echapper(c.exemple || '')}" value="${echapper(v.nom)}"></label>
      ${c.types ? `<label class="champ"><span class="champ-libelle">${echapper(c.libelle_type || 'Type')}</span><select name="type">${c.types.map(t => `<option${t === type ? ' selected' : ''}>${echapper(t)}</option>`).join('')}</select></label>` : ''}
      ${niveaux.length ? `<label class="champ"><span class="champ-libelle">Niveau</span><select name="niveau">${niveaux.map(n => `<option value="${n}"${n === niveau ? ' selected' : ''}>Niveau ${ROMAINS[n]}</option>`).join('')}</select></label>` : ''}
      <label class="champ"><span class="champ-libelle">Quantité</span><input type="number" name="quantite" min="0" step="1" value="${Math.max(0, entier(v.quantite, 1))}"></label>
      <label class="champ champ--plein"><span class="champ-libelle">Description</span><textarea name="description" rows="3">${echapper(v.description)}</textarea></label>`;
    $('formObjetBonusBloc').hidden = !c.bonus;
    $('formObjet').elements.namedItem('equipe').checked = !!v.equipe;
    majDegatsFormulaire();
  }

  // Changer d'onglet garde le nom, la quantité, la description et l'état équipé déjà saisis.
  function changerCategorieObjet(cle) {
    if (!EQUIPEMENT[cle] || cle === categorieObjet) return;
    const champ = nom => $('formObjet').elements.namedItem(nom);
    const v = {
      nom: champ('nom').value,
      type: champ('type')?.value,
      niveau: champ('niveau')?.value,
      quantite: champ('quantite').value,
      description: champ('description').value,
      equipe: champ('equipe').checked
    };
    categorieObjet = cle;
    rendreFormObjet(v);
    document.querySelector(`#ongletsObjet [data-categorie="${cle}"]`)?.focus();
  }

  function majDegatsFormulaire() {
    const champ = nom => $('formObjet').elements.namedItem(nom);
    const c = EQUIPEMENT[categorieObjet] || {};
    const objet = { categorie: categorieObjet, type: champ('type')?.value || '', niveau: entier(champ('niveau')?.value, 1) };
    const arme = armeObjet(objet);
    const protection = R.protectionObjet(objet, EQUIPEMENT);
    const mains = mainsDe(objet);
    const texteMains = mains > 1 ? ' Deux mains : pas de bouclier.' : mains ? ' Une main.' : '';
    let texte = '';
    if (arme) {
      const effet = arme.magique ? ` ${effetArmeMagique(objet.type, objet.niveau)}.` : '';
      texte = `Dégâts : ${arme.base} + palier de ${arme.competence}${arme.bonus ? ` (+${arme.bonus}), soit ${arme.total}` : ' (aucun bonus pour l\'instant)'}. Pour toucher : D20 ≤ ${arme.toucher} (${arme.competence}).${effet}${texteMains}`;
    } else if (protection) {
      const malus = protection.malus?.valeur
        ? ` ${signe(protection.malus.valeur)} en ${protection.malus.competence} une fois équipé.`
        : ` Aucun malus de ${protection.malus?.competence || 'Vélocité'}.`;
      texte = `Défense : ${protection.defense}.${malus}${texteMains}`;
    } else if (c.bonus) {
      texte = 'Les bonus de compétence s\'appliquent quand l\'objet est équipé.';
    }
    $('formObjetDegats').textContent = texte;
  }

  function enregistrerObjet(e) {
    e.preventDefault();
    const champ = nom => e.target.elements.namedItem(nom);
    const c = EQUIPEMENT[categorieObjet];
    const existant = objetEnEdition ? p.objets.find(o => o.id === objetEnEdition) : null;
    const valeurs = {
      nom: champ('nom').value.trim() || 'Objet sans nom',
      categorie: categorieObjet,
      type: c.types ? champ('type').value : '',
      niveau: c.niveaux ? borner(entier(champ('niveau').value, 1), 1, c.niveaux) : null,
      quantite: Math.max(0, entier(champ('quantite').value, 1)),
      description: champ('description').value.trim(),
      equipe: champ('equipe').checked,
      // Bonus de compétence : seulement pour les objets et artefacts (ceux d'anciens objets sont gardés)
      bonus: c.bonus
        ? [...$('formObjetBonus').querySelectorAll('.bonus-ligne')]
          .map(ligne => ({
            competence: ligne.querySelector('[data-bonus="competence"]').value,
            valeur: entier(ligne.querySelector('[data-bonus="valeur"]').value)
          }))
          .filter(b => b.valeur)
        : existant?.bonus || []
    };
    // Pas assez de mains libres (bâton à deux mains, sceptre, bouclier) : l'objet est rangé, pas équipé.
    const genants = valeurs.equipe ? mainsPrises(valeurs, existant) : [];
    if (genants.length) valeurs.equipe = false;
    if (existant) Object.assign(existant, valeurs);
    else p.objets.push({ id: nouvelId(), ...valeurs });
    $('dlgObjet').close();
    changer();
    if (genants.length) toast(`${valeurs.nom} enregistré sans être équipé. ${messageMains(valeurs, genants)}`, 'erreur');
    else toast(existant ? `${valeurs.nom} modifié.` : `${valeurs.nom} ajouté à l'équipement.`, 'succes');
  }

  // ─── Messages ─────────────────────────────────────────────────

  let minuterieToast = null;

  function toast(message, ton = '') {
    const el = $('toast');
    el.textContent = message;
    el.className = `toast est-visible${ton ? ` toast--${ton}` : ''}`;
    clearTimeout(minuterieToast);
    minuterieToast = setTimeout(() => el.classList.remove('est-visible'), 3800);
  }

  // ─── Démarrage (en dernier : toutes les déclarations sont prêtes) ──

  normaliser();
  construire();
  brancher();
  rendreFixe();
  rendreTout();
  majEtatSauvegarde();
  document.documentElement.classList.add('js');
})();
