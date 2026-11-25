/* ═══════════════════════════════════════════════════════════════
   CODEX DES HÉROS — page de création
   ═══════════════════════════════════════════════════════════════ */
'use strict';

(() => {
  const $ = id => document.getElementById(id);
  const { echapper } = Codex;

  const CHAMPS = [
    { id: 'prenom',      libelle: 'le prénom' },
    { id: 'nom',         libelle: 'le nom' },
    { id: 'age',         libelle: "l'âge" },
    { id: 'genre',       libelle: 'le genre' }
  ];

  const etat = {
    donnees: null,
    race: null,
    metier: null,
    portrait: null,
    tentative: false,
    royaume: null,
    sorts: {},          // { niveau: nom du sort }
    origineSorts: {},   // { niveau: 'roue' | 'catalogue' }
    catalogueNiveau: null,
    sortsCle: null,
    retraitSort: null,  // emplacement dont le retrait attend confirmation
    vocation: null,
    id:`perso-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
  };

  demarrer();

  async function demarrer() {
    Codex.observerRevelations();

    try {
      etat.donnees = await Codex.chargerDonnees();
    } catch (erreur) {
      console.error('Erreur de chargement des données :', erreur);
      $('contenu').innerHTML = Codex.panneauErreur();
      $('registre').hidden = true;
      return;
    }

    rendreRaces();
    rendreMetiers();
    brancherIdentite();
    brancherApparence();
    brancherPortrait();
    Codex.brancherDialogue($('raceModal'));
    Codex.brancherDialogue($('imageEditModal'));
    $('createBtn').addEventListener('click', forger);
    rendreRoyaumes();
    Codex.brancherDialogue($('royaumeModal'));
    Codex.brancherDialogue($('catalogueModal'));
    // Flèches et clavier : race ou royaume précédent / suivant, sans fermer la fenêtre
    brancherNavigation($('raceModal'), () => Object.keys(etat.donnees.races), cle => ouvrirRace(cle, true));
    brancherNavigation($('royaumeModal'), () => Object.keys(etat.donnees.royaumes || {}), cle => ouvrirRoyaume(cle, true));
    brancherSorts();
    rendreVocations();
    $('btnTelecharger').addEventListener('click', telechargerFiche);
    majRegistre();
  }

  // ─── Races ────────────────────────────────────────────────────

  function rendreRaces() {
    const grille = $('raceGrid');
    grille.innerHTML = Object.entries(etat.donnees.races).map(([cle, race], i) => `
      <button type="button" class="race" data-race="${echapper(cle)}" aria-haspopup="dialog" style="--i:${i}">
        <span class="cire cire--mini" aria-hidden="true"><svg viewBox="0 0 48 48"><use href="#etoile"/></svg></span>
        <span class="niche" data-initiale="${echapper(race.label.charAt(0))}">${Codex.imageRace(race)}</span>
        <span class="race-nom">${echapper(race.label)}</span>
        <span class="race-resume">${echapper(race.short_description)}</span>
        <span class="race-chiffres">
          <span>PV <b>${race.pv}</b></span>
          <span>Magie <b>${race.reserve_magie}</b></span>
        </span>
        <span class="sr-only race-etat"></span>
      </button>`).join('');

    grille.addEventListener('click', e => {
      const carte = e.target.closest('.race');
      if (carte) ouvrirRace(carte.dataset.race);
    });
  }

  function ouvrirRace(cle, feuillete = false) {
    const race = etat.donnees.races[cle];
    const dialogue = $('raceModal');
    const confirmer = $('confirmRaceBtn');

    $('modalRaceContent').innerHTML = Codex.detailsRace(race, 'modalRaceTitle');
    majNavigation(dialogue, Object.keys(etat.donnees.races), cle, $('modalRaceContent'), feuillete);
    confirmer.textContent = etat.race === cle ? 'Garder cette race' : 'Choisir cette race';
    confirmer.onclick = () => {
      choisirRace(cle);
      dialogue.close();
    };

    if (!dialogue.open) dialogue.showModal();
    dialogue.scrollTop = 0;
  }

  // ─── Navigation dans les fenêtres (races, royaumes) ───────────

  // La liste boucle : après le dernier, on revient au premier.
  function brancherNavigation(dialogue, cles, afficher) {
    const aller = sens => {
      const liste = cles();
      const i = liste.indexOf(dialogue.dataset.cle);
      afficher(liste[(i + sens + liste.length) % liste.length]);
    };
    dialogue.querySelectorAll('[data-sens]').forEach(bouton => {
      bouton.addEventListener('click', () => aller(Number(bouton.dataset.sens)));
    });
    dialogue.addEventListener('keydown', e => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (e.altKey || e.ctrlKey || e.metaKey || e.target.matches('input, textarea, select')) return;
      e.preventDefault();
      aller(e.key === 'ArrowLeft' ? -1 : 1);
    });
  }

  function majNavigation(dialogue, liste, cle, contenu, feuillete) {
    dialogue.dataset.cle = cle;
    dialogue.querySelector('.folio-position').textContent = `${liste.indexOf(cle) + 1} / ${liste.length}`;
    if (!feuillete) return;
    contenu.classList.remove('est-feuillete');
    void contenu.offsetWidth; // relance l'animation d'apparition
    contenu.classList.add('est-feuillete');
  }

  function choisirRace(cle) {
    etat.race = cle;
    document.querySelectorAll('.race').forEach(carte => {
      const choisie = carte.dataset.race === cle;
      carte.classList.toggle('est-choisie', choisie);
      carte.querySelector('.race-etat').textContent = choisie ? ' (choisie)' : '';
    });
    majRegistre();
  }

  // ─── Métiers ──────────────────────────────────────────────────

  function rendreMetiers() {
    const grille = $('metierGrid');
    grille.innerHTML = Object.entries(etat.donnees.metiers).map(([cle, metier], i) => {
      const bonus = Object.entries(metier.bonus)
        .map(([competence, valeur]) => `<span><b>+${valeur}</b> ${echapper(competence)}</span>`)
        .join('');
      // Les lettrines alternent lapis et vermillon, comme dans les manuscrits.
      const pigment = i % 2 ? 'rubrique' : 'lapis';
      return `
        <button type="button" class="metier" data-metier="${echapper(cle)}" aria-pressed="false" style="--i:${i}">
          <span class="cire cire--mini" aria-hidden="true"><svg viewBox="0 0 48 48"><use href="#etoile"/></svg></span>
          <span class="lettrine-bloc lettrine-bloc--${pigment}" aria-hidden="true"><span>${echapper(metier.label.charAt(0))}</span></span>
          <span class="metier-nom">
            <span aria-hidden="true">${echapper(metier.label.slice(1))}</span>
            <span class="sr-only">${echapper(metier.label)}</span>
          </span>
          <span class="metier-resume">${echapper(metier.short_description)}</span>
          <span class="metier-bonus">${bonus}</span>
          <span class="metier-don">
            <span class="metier-don-nom">${echapper(metier.pouvoir.name)}</span>
            <span class="metier-don-effet">${echapper(metier.pouvoir.effect)}</span>
          </span>
        </button>`;
    }).join('');

    grille.addEventListener('click', e => {
      const carte = e.target.closest('.metier');
      if (!carte) return;
      etat.metier = carte.dataset.metier;
      grille.querySelectorAll('.metier').forEach(c => c.setAttribute('aria-pressed', String(c === carte)));
      majRegistre();
    });
  }

  // ─── Identité & apparence ─────────────────────────────────────

  function brancherIdentite() {
    CHAMPS.forEach(({ id }) => {
      const champ = $(id);
      champ.addEventListener('input', () => {
        if (champ.value.trim()) champ.closest('.champ').classList.remove('manque');
        majRegistre();
      });
    });
  }

  function brancherApparence() {
    const bouton = $('btnDes');
    bouton.addEventListener('click', () => {
      const d = etat.donnees.physical_descriptions;
      const tirer = liste => liste[Math.floor(Math.random() * liste.length)];
      $('description').value = [
        `Taille : ${tirer(d.taille)}`,
        `Corpulence : ${tirer(d.corpulence)}`,
        `Cheveux : ${tirer(d.cheveux)}`,
        `Yeux : ${tirer(d.yeux)}`,
        `Peau : ${tirer(d.peau)}`,
        `Style : ${tirer(d.style)}`,
        `Signe distinctif : ${tirer(d.signes_distinctifs)}`
      ].join('\n');
      bouton.classList.remove('lance');
      void bouton.offsetWidth; // relance l'animation du dé
      bouton.classList.add('lance');
    });
  }

  // ─── Registre ─────────────────────────────────────────────────

  function majRegistre() {
    majSorts();
    const valeurs = Object.fromEntries(CHAMPS.map(({ id }) => [id, $(id).value.trim()]));
    const remplis = CHAMPS.filter(({ id }) => valeurs[id]).length;

    const nomComplet = [valeurs.prenom, valeurs.nom].filter(Boolean).join(' ');
    const regNom = $('regNom');
    regNom.textContent = nomComplet || 'Héros sans nom';
    regNom.classList.toggle('est-vide', !nomComplet);

    const race = etat.race ? etat.donnees.races[etat.race] : null;
    const metier = etat.metier ? etat.donnees.metiers[etat.metier] : null;
    const royaume = etat.royaume ? etat.donnees.royaumes[etat.royaume] : null;
    $('regLignee').textContent =
      [race?.label, metier?.label].filter(Boolean).join(' · ') || 'Race et métier à choisir';

    if (!etat.portrait) {
      const initiales = (valeurs.prenom.charAt(0) + valeurs.nom.charAt(0)).toUpperCase();
      $('regPortrait').innerHTML = `<span class="medaillon-initiales">${echapper(initiales || '?')}</span>`;
    }

    const etapes = {
      identite: { ok: remplis === CHAMPS.length, val: `${remplis}/${CHAMPS.length}` },
      race:     { ok: !!race,       val: race?.label ?? '—' },
      metier:   { ok: !!metier,     val: metier?.label ?? '—' },
      royaume:  { ok: !!royaume,    val: royaume?.label ?? '—' },
      sorts:    etatSorts(),
      vocation: { ok: !!etat.vocation, val: Regles.VOCATIONS[etat.vocation]?.label ?? '—' }
    };

    let restantes = 0;
    Object.entries(etapes).forEach(([cle, etape]) => {
      const ligne = document.querySelector(`.etapes [data-etape="${cle}"]`);
      ligne.classList.toggle('est-faite', etape.ok);
      ligne.classList.toggle('manque', etat.tentative && !etape.ok);
      ligne.querySelector('.etape-val').textContent = etape.val;
      if (!etape.ok) restantes++;
    });

    $('createBtn').classList.toggle('est-pret', restantes === 0);
    $('regReste').textContent = restantes === 0
      ? 'Tout est prêt : apposez le sceau'
      : `${restantes} étape${restantes > 1 ? 's' : ''} restante${restantes > 1 ? 's' : ''}`;

    const alerte = $('errorMsg');
    if (restantes === 0) alerte.hidden = true;
    else if (!alerte.hidden) alerte.textContent = phraseManques(listerManques());
  }

  function listerManques() {
    const manques = CHAMPS
      .filter(({ id }) => !$(id).value.trim())
      .map(({ id, libelle }) => ({ libelle, cible: $(id) }));
    if (!etat.race)   manques.push({ libelle: 'la race',   cible: $('ch-race') });
    if (!etat.metier) manques.push({ libelle: 'le métier', cible: $('ch-metier') });
    if (!etat.royaume) manques.push({ libelle: 'le royaume', cible: $('ch-royaume') });
    if (magieDeCreation() && !etatSorts().ok) manques.push({ libelle: 'vos sorts', cible: $('ch-sorts') });
    if (!etat.vocation) manques.push({ libelle: 'la vocation', cible: $('ch-vocation') });
    return manques;
  }

  function phraseManques(manques) {
    const libelles = manques.map(m => m.libelle);
    const liste = libelles.length > 1
      ? `${libelles.slice(0, -1).join(', ')} et ${libelles[libelles.length - 1]}`
      : libelles[0];
    return `Il manque encore ${liste}.`;
  }

  // ─── Création de la fiche ─────────────────────────────────────

  function forger() {
    etat.tentative = true;
    const alerte = $('errorMsg');
    const manques = listerManques();

    CHAMPS.forEach(({ id }) => {
      $(id).closest('.champ').classList.toggle('manque', !$(id).value.trim());
    });

    if (manques.length) {
      alerte.textContent = phraseManques(manques);
      alerte.hidden = false;
      majRegistre();
      const cible = manques[0].cible;
      cible.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (cible.tagName === 'INPUT') cible.focus({ preventScroll: true });
      return;
    }

    majRegistre();

    const personnage = construirePersonnage();

    try {
      localStorage.setItem(Codex.CLE_STOCKAGE, JSON.stringify(personnage));
    } catch (erreur) {
      console.error(erreur);
      alerte.textContent = "Impossible d'enregistrer la fiche dans ce navigateur (stockage plein ou désactivé).";
      alerte.hidden = false;
      return;
    }

    const bouton = $('createBtn');
    bouton.classList.add('tamponne');
    bouton.disabled = true;
    const attente = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 650;
    setTimeout(() => { window.location.href = 'fiche.html'; }, attente);
  }

  // Retour arrière depuis la fiche : le sceau redevient utilisable.
  window.addEventListener('pageshow', e => {
    if (!e.persisted) return;
    const bouton = $('createBtn');
    bouton.disabled = false;
    bouton.classList.remove('tamponne');
  });

  // ═══ AJOUTS : royaume d'origine, sorts de départ, téléchargement ═══

  const ROMAINS = ['', 'I', 'II', 'III', 'IV', 'V', 'U']; // U : sorts ultimes
  const nomPalier = n => (!n ? 'Aucun' : n === Regles.NIVEAU_ULTIME ? 'Ultime' : `Niv. ${ROMAINS[n]}`);
  const seuilPalier = c => (c.min === c.max ? `${c.min}` : `${c.min}–${c.max}`);

  // Le personnage tel qu'il est enregistré : mêmes champs qu'avant,
  // complétés de l'identifiant, du royaume et des sorts de départ.
  function construirePersonnage() {
    return {
      id: etat.id,
      prenom: $('prenom').value.trim(),
      nom: $('nom').value.trim(),
      age: $('age').value.trim(),
      genre: $('genre').value.trim(),
      description: $('description').value.trim(),
      race: etat.race,
      metier: etat.metier,
      image: etat.portrait,
      royaume: etat.royaume,
      sorts: Object.entries(etat.sorts)
        .map(([niveau, nom]) => ({ niveau: Number(niveau), nom }))
        .sort((a, b) => a.niveau - b.niveau),
      vocation: etat.vocation,
      creeLe: new Date().toISOString()
    };
  }

  // ─── Royaume d'origine ────────────────────────────────────────

  function rendreRoyaumes() {
    const grille = $('royaumeGrid');
    const royaumes = etat.donnees.royaumes || {};
    grille.innerHTML = Object.entries(royaumes).map(([cle, royaume], i) => `
      <button type="button" class="metier" data-royaume="${echapper(cle)}" aria-pressed="false" aria-haspopup="dialog" style="--i:${i}">
        <span class="cire cire--mini" aria-hidden="true"><svg viewBox="0 0 48 48"><use href="#etoile"/></svg></span>
        <span class="lettrine-bloc lettrine-bloc--${i % 2 ? 'rubrique' : 'lapis'}" aria-hidden="true"><span>${echapper(royaume.label.charAt(0))}</span></span>
        <span class="metier-nom">
          <span aria-hidden="true">${echapper(royaume.label.slice(1))}</span>
          <span class="sr-only">${echapper(royaume.label)}</span>
        </span>
        <span class="metier-resume">${echapper(royaume.type)} · ${echapper(royaume.races)}</span>
      </button>`).join('');

    grille.addEventListener('click', e => {
      const carte = e.target.closest('[data-royaume]');
      if (carte) ouvrirRoyaume(carte.dataset.royaume);
    });
  }

  // Même fonctionnement que les races : la fenêtre s'ouvre, le choix se confirme.
  function ouvrirRoyaume(cle, feuillete = false) {
    const dialogue = $('royaumeModal');
    const confirmer = $('confirmRoyaumeBtn');

    $('modalRoyaumeContent').innerHTML = detailsRoyaume(etat.donnees.royaumes[cle], 'modalRoyaumeTitle');
    majNavigation(dialogue, Object.keys(etat.donnees.royaumes), cle, $('modalRoyaumeContent'), feuillete);
    confirmer.textContent = etat.royaume === cle ? 'Garder ce royaume' : 'Choisir ce royaume';
    confirmer.onclick = () => {
      choisirRoyaume(cle);
      dialogue.close();
    };

    if (!dialogue.open) dialogue.showModal();
    dialogue.scrollTop = 0;
  }

  function choisirRoyaume(cle) {
    etat.royaume = cle;
    $('royaumeGrid').querySelectorAll('[data-royaume]').forEach(c => c.setAttribute('aria-pressed', String(c.dataset.royaume === cle)));
    majRegistre();
  }

  // Mise en page du folio des races : niche à l'initiale dorée, puis la chronique.
  function detailsRoyaume(r, idTitre) {
    const ligne = (nom, valeur) => `
      <li><span class="nom">${nom}</span><span class="points" aria-hidden="true"></span><span class="val">${echapper(valeur)}</span></li>`;
    const points = (r.points || []).map(point => `
      <p class="royaume-point"><span class="royaume-point-titre">${echapper(point.titre)}.</span> ${echapper(point.texte)}</p>`).join('');

    return `
      <div class="race-detail">
        <figure class="niche sans-image" data-initiale="${echapper(r.label.charAt(0))}" style="margin:0"></figure>
        <div class="race-detail-texte">
          <p class="surtitre">${echapper(r.type)}</p>
          <h2 class="folio-titre" id="${idTitre}">${echapper(r.label)}</h2>
          <p class="texte-lettrine">${echapper(r.description)}</p>
          ${points}
          <h3 class="titre-filet titre-filet--gauche">En bref</h3>
          <ul class="liste-points liste-points--texte">
            ${ligne('Dirigeant', r.dirigeant)}
            ${ligne('Races les plus présentes', r.races)}
            ${r.relations ? ligne('Relations', r.relations) : ''}
          </ul>
          ${r.venir ? `<p class="glose">${echapper(r.venir)}</p>` : ''}
          <p class="royaume-libre">Choix libre : ces races ne sont qu'une suggestion, un héros de n'importe quelle race peut en être originaire.</p>
        </div>
      </div>`;
  }

  // ─── Sorts de départ ──────────────────────────────────────────

  // Magie réelle à la création : race + métier, plafonnée à 13.
  function magieDeCreation() {
    const race = etat.race && etat.donnees.races[etat.race];
    const metier = etat.metier && etat.donnees.metiers[etat.metier];
    if (!race || !metier) return null;
    const base = race.skills.Magie || 0;
    const bonus = metier.bonus.Magie || 0;
    return { base, bonus, magie: Regles.valeurCreation(base, bonus) };
  }

  function etatSorts() {
    const m = magieDeCreation();
    if (!m) return { ok: false, val: '—' };
    const niveaux = Regles.sortsACreation(m.magie);
    if (!niveaux.length) return { ok: true, val: 'aucun' };
    const choisis = niveaux.filter(n => etat.sorts[n]).length;
    return { ok: choisis === niveaux.length, val: `${choisis}/${niveaux.length}` };
  }

  // Ne redessine les emplacements que si la Magie a changé.
  function majSorts() {
    const m = magieDeCreation();
    const cle = m ? `${m.base}+${m.bonus}` : 'aucune';
    if (cle === etat.sortsCle) return;
    etat.sortsCle = cle;
    etat.retraitSort = null;
    const niveaux = m ? Regles.sortsACreation(m.magie) : [];
    Object.keys(etat.sorts).forEach(n => {
      if (!niveaux.includes(Number(n))) {
        delete etat.sorts[n];
        delete etat.origineSorts[n];
      }
    });
    rendreSorts(m, niveaux);
  }

  function paliersHtml(magie) {
    const palier = Regles.palierSorts(magie);
    const cases = Regles.GRILLE_PALIERS.map(c => `
      <li class="palier${c.niveau <= palier ? ' est-atteint' : ''}${c.niveau === palier ? ' est-actuel' : ''}">
        <span class="palier-nom">${nomPalier(c.niveau)}</span>
        <span class="palier-seuil">${seuilPalier(c)}</span>
      </li>`).join('');
    return `<ol class="paliers" aria-label="Paliers de sorts selon la Magie">${cases}</ol>`;
  }

  function rendreSorts(m, niveaux) {
    const zone = $('sortsCreation');
    if (!m) {
      zone.innerHTML = `<p class="note">Choisissez d'abord une race et un métier : votre Magie décide des sorts que vous recevez.</p>`;
      return;
    }

    const prochain = Regles.prochainPalier(m.magie);
    const plafonnee = m.base + m.bonus > m.magie ? ', plafonnée à 13 au niveau 1' : '';
    const nombre = niveaux.length;
    const resume = `
      <p class="sorts-magie">Magie réelle <b>${m.magie}</b> <span class="note">(race ${m.base} + métier ${m.bonus}${plafonnee})</span></p>
      ${paliersHtml(m.magie)}
      <p class="note">${nombre
        ? `Vous recevez ${nombre} sort${nombre > 1 ? 's' : ''} : un par palier atteint, de son niveau. Choisissez-le dans le catalogue ou tirez-le à la roue. Un sort pris par erreur peut être retiré, puis remplacé.`
        : 'Aucun sort pour l\'instant : le premier palier demande 4 en Magie.'}${prochain ? ` Prochain palier à ${prochain.min} en Magie.` : ''}</p>`;

    const cartes = niveaux.map(n => `
        <div class="carte" data-emplacement="${n}">
          <span class="lettrine-bloc lettrine-bloc--${n % 2 ? 'lapis' : 'rubrique'}" aria-hidden="true"><span>${ROMAINS[n]}</span></span>
          <p class="carte-titre" data-nom="${n}" aria-live="polite"></p>
          <p class="carte-meta" data-meta="${n}"></p>
          <p class="carte-texte" data-effet="${n}"></p>
          <div class="carte-actions" data-actions="${n}"></div>
        </div>`).join('');

    zone.innerHTML = resume + (cartes ? `<div class="cartes">${cartes}</div>` : '');
    niveaux.forEach(n => choisirSort(n, etat.sorts[n], false));
  }

  // Effet du sort, avec les dégâts de son niveau à la place de {une} et {zone}.
  function texteSort(n) {
    const sort = (etat.donnees.sorts[n] || []).find(s => s.nom === etat.sorts[n]);
    return sort ? Regles.effetSort(sort.effet, n, etat.donnees.degats_sorts) : '';
  }

  // Boutons d'un emplacement : tirage, retrait, ou confirmation du retrait.
  function actionsSort(n, tire) {
    if (tire && etat.retraitSort === n) {
      return `
        <span class="carte-confirmation" role="group" aria-label="Confirmer le retrait">
          <span class="carte-confirmation-question">Retirer ce sort ?</span>
          <button type="button" class="bouton bouton--petit" data-retrait-oui="${n}">Oui</button>
          <button type="button" class="bouton bouton--petit bouton--discret" data-retrait-non="${n}">Annuler</button>
        </span>`;
    }
    // Les deux façons d'obtenir le sort restent côte à côte : la roue et le catalogue.
    if (!tire) {
      return `
        <button type="button" class="bouton bouton--petit" data-tirer="${n}">
          <svg class="icone de" viewBox="0 0 24 24" aria-hidden="true"><use href="#de"/></svg>
          <span class="libelle">Tirer à la roue</span>
        </button>
        <button type="button" class="bouton bouton--petit bouton--lapis" data-catalogue="${n}" aria-haspopup="dialog">Choisir dans le catalogue</button>`;
    }
    return `
      <button type="button" class="bouton bouton--petit" data-tirer="${n}" disabled>
        <svg class="icone de" viewBox="0 0 24 24" aria-hidden="true"><use href="#de"/></svg>
        <span class="libelle">${etat.origineSorts[n] === 'catalogue' ? 'Sort choisi' : 'Sort tiré'}</span>
      </button>
      <button type="button" class="bouton bouton--petit bouton--discret" data-retirer="${n}">Retirer</button>`;
  }

  function brancherSorts() {
    $('sortsCreation').addEventListener('click', e => {
      const cible = e.target.closest('button');
      if (!cible || cible.disabled) return;
      const { tirer, catalogue, retirer, retraitOui, retraitNon } = cible.dataset;
      if (tirer) tirerSort(Number(tirer), cible);
      else if (catalogue) ouvrirCatalogue(Number(catalogue));
      else if (retirer) demanderRetrait(Number(retirer));
      else if (retraitOui) retirerSort(Number(retraitOui));
      else if (retraitNon) annulerRetrait(Number(retraitNon));
    });
    $('catalogueSorts').addEventListener('click', e => {
      const bouton = e.target.closest('[data-choisir-sort]');
      if (bouton) prendreDansCatalogue(bouton.dataset.choisirSort);
    });
  }

  // Inscrit le sort sur sa carte (ou l'emplacement vide s'il n'y en a pas).
  function choisirSort(n, nom, enregistrer = true, origine = 'roue') {
    if (enregistrer) {
      etat.sorts[n] = nom;
      etat.origineSorts[n] = origine;
    }
    const carte = document.querySelector(`#sortsCreation [data-emplacement="${n}"]`);
    if (!carte) return;
    const sort = (etat.donnees.sorts[n] || []).find(s => s.nom === nom);
    const total = (etat.donnees.sorts[n] || []).length;
    carte.classList.toggle('est-choisie', !!sort);
    carte.querySelector('[data-nom]').textContent = sort ? sort.nom : `Sort de niveau ${n}`;
    carte.querySelector('[data-meta]').textContent = sort
      ? `Niveau ${n} · ${sort.cout} PM · ${etat.origineSorts[n] === 'catalogue' ? 'choisi dans le catalogue' : 'tiré au sort'}`
      : `Un sort parmi ${total}, au choix ou au hasard`;
    carte.querySelector('[data-effet]').textContent = texteSort(n);
    carte.querySelector('[data-actions]').innerHTML = actionsSort(n, !!sort);
    if (enregistrer) majRegistre();
  }

  // ─── Retrait d'un sort tiré (avec confirmation) ───────────────

  function focaliser(selecteur) {
    document.querySelector(`#sortsCreation ${selecteur}`)?.focus({ preventScroll: true });
  }

  function demanderRetrait(n) {
    const precedent = etat.retraitSort;
    etat.retraitSort = n;
    if (precedent && precedent !== n) choisirSort(precedent, etat.sorts[precedent], false);
    choisirSort(n, etat.sorts[n], false);
    focaliser(`[data-retrait-non="${n}"]`);
  }

  function annulerRetrait(n) {
    etat.retraitSort = null;
    choisirSort(n, etat.sorts[n], false);
    focaliser(`[data-retirer="${n}"]`);
  }

  // L'emplacement redevient vide : le sort retourne parmi ceux qu'on peut tirer.
  function retirerSort(n) {
    etat.retraitSort = null;
    delete etat.sorts[n];
    delete etat.origineSorts[n];
    choisirSort(n, null, false);
    majRegistre();
    focaliser(`[data-tirer="${n}"]`);
  }

  // ─── Catalogue : choisir le sort d'un emplacement ─────────────

  // Dégâts d'un sort d'attaque pour son niveau (« une cible 2D20, zone 1D20 »).
  function degatsTexte(sort, n) {
    const libelles = { une: 'une cible', zone: 'zone' };
    return Regles.ciblesSort(sort.effet)
      .map(c => `${libelles[c]} ${Regles.degatsSort(n, c, etat.donnees.degats_sorts)}`)
      .join(', ');
  }

  function ouvrirCatalogue(n) {
    etat.catalogueNiveau = n;
    const liste = [...(etat.donnees.sorts[n] || [])].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    $('catalogueTitre').textContent = `Sorts de niveau ${ROMAINS[n]}`;
    $('catalogueNote').textContent = `Choisissez le sort de votre emplacement de niveau ${ROMAINS[n]}. Vous pourrez le retirer pour en prendre un autre.`;
    $('catalogueSorts').innerHTML = liste.map(sort => {
      const degats = degatsTexte(sort, n);
      return `
        <article class="carte">
          <span class="lettrine-bloc lettrine-bloc--${n % 2 ? 'lapis' : 'rubrique'}" aria-hidden="true"><span>${ROMAINS[n]}</span></span>
          <p class="carte-titre">${echapper(sort.nom)}</p>
          <p class="carte-meta">Niveau ${n} · ${sort.cout} PM${degats ? ` · dégâts : ${echapper(degats)}` : ''}</p>
          <p class="carte-texte">${echapper(Regles.effetSort(sort.effet, n, etat.donnees.degats_sorts))}</p>
          <div class="carte-actions">
            <button type="button" class="bouton bouton--petit bouton--lapis" data-choisir-sort="${echapper(sort.nom)}">Choisir ce sort</button>
          </div>
        </article>`;
    }).join('');
    const dialogue = $('catalogueModal');
    dialogue.showModal();
    dialogue.scrollTop = 0;
  }

  function prendreDansCatalogue(nom) {
    const n = etat.catalogueNiveau;
    if (!n || etat.sorts[n]) return;
    $('catalogueModal').close();
    choisirSort(n, nom, true, 'catalogue');
    focaliser(`[data-retirer="${n}"]`);
  }

  // La roue fait défiler quelques noms avant de s'arrêter sur le sort tiré.
  // Un tirage par emplacement, parmi les sorts inconnus (un sort retiré redevient tirable).
  function tirerSort(n, bouton) {
    if (etat.sorts[n]) return;
    const liste = Regles.sortsATirer(etat.donnees.sorts[n], Object.values(etat.sorts));
    const nom = document.querySelector(`#sortsCreation [data-nom="${n}"]`);
    if (!liste.length || !nom) return;
    const tire = liste[Math.floor(Math.random() * liste.length)];

    bouton.classList.remove('lance');
    void bouton.offsetWidth;
    bouton.classList.add('lance');

    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      choisirSort(n, tire.nom);
      return;
    }

    // Pendant que la roue tourne, ni second tirage ni catalogue pour cet emplacement
    bouton.closest('.carte-actions').querySelectorAll('button').forEach(b => { b.disabled = true; });
    let tour = 0;
    const roue = setInterval(() => {
      tour += 1;
      nom.textContent = (tour < 14 ? liste[Math.floor(Math.random() * liste.length)] : tire).nom;
      if (tour >= 14) {
        clearInterval(roue);
        choisirSort(n, tire.nom);
      }
    }, 65);
  }

  // ─── Vocation ─────────────────────────────────────────────────

  function rendreVocations() {
    const grille = $('vocationGrid');
    grille.innerHTML = Object.entries(Regles.VOCATIONS).map(([cle, v], i) => `
      <button type="button" class="metier" data-vocation="${echapper(cle)}" aria-pressed="false" style="--i:${i}">
        <span class="cire cire--mini" aria-hidden="true"><svg viewBox="0 0 48 48"><use href="#etoile"/></svg></span>
        <span class="lettrine-bloc lettrine-bloc--${i % 2 ? 'rubrique' : 'lapis'}" aria-hidden="true"><span>${echapper(v.label.charAt(0))}</span></span>
        <span class="metier-nom">
          <span aria-hidden="true">${echapper(v.label.slice(1))}</span>
          <span class="sr-only">${echapper(v.label)}</span>
        </span>
        <span class="metier-resume">À chaque niveau, en plus du point de compétence :</span>
        <span class="metier-bonus"><span><b>+${v.pv}</b> PV</span><span><b>+${v.pm}</b> Réserve magique</span></span>
      </button>`).join('');

    $('vocationRegle').textContent = `À chaque montée de niveau, le héros gagne ${Regles.POINTS_PAR_NIVEAU} point de compétence, plus les PV et la réserve de sa vocation. À n'importe quel niveau, il peut renoncer à ce point pour gagner +${Regles.GAIN_RENONCEMENT} PV ou +${Regles.GAIN_RENONCEMENT} réserve magique à la place.`;

    grille.addEventListener('click', e => {
      const carte = e.target.closest('[data-vocation]');
      if (!carte) return;
      etat.vocation = carte.dataset.vocation;
      grille.querySelectorAll('[data-vocation]').forEach(c => c.setAttribute('aria-pressed', String(c === carte)));
      majRegistre();
    });
  }

  // ─── Téléchargement de la fiche autonome ──────────────────────

  async function telechargerFiche() {
    etat.tentative = true;
    const alerte = $('errorMsg');
    const manques = listerManques();

    CHAMPS.forEach(({ id }) => {
      $(id).closest('.champ').classList.toggle('manque', !$(id).value.trim());
    });

    if (manques.length) {
      alerte.textContent = phraseManques(manques);
      alerte.hidden = false;
      majRegistre();
      const cible = manques[0].cible;
      cible.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (cible.tagName === 'INPUT') cible.focus({ preventScroll: true });
      return;
    }

    majRegistre();
    const bouton = $('btnTelecharger');
    const libelle = bouton.querySelector('.libelle');
    bouton.disabled = true;
    libelle.textContent = 'Préparation de la fiche…';
    try {
      await Telechargement.telecharger(construirePersonnage(), etat.donnees);
      libelle.textContent = 'Fiche téléchargée';
    } catch (erreur) {
      console.error(erreur);
      alerte.textContent = "Le téléchargement de la fiche a échoué. Vérifiez que le site est bien ouvert via un serveur local, puis réessayez.";
      alerte.hidden = false;
      libelle.textContent = 'Télécharger ma fiche';
    } finally {
      setTimeout(() => {
        bouton.disabled = false;
        libelle.textContent = 'Télécharger ma fiche';
      }, 2000);
    }
  }

  // ─── Portrait : import et recadrage ───────────────────────────

  const editeur = {
    img: null,
    ctx: null,
    cw: 0,
    ch: 0,
    zoom: 1,
    x: 0,
    y: 0,
    pointeurs: new Map(),
    ecart: 0
  };

  function brancherPortrait() {
    const input = $('imageInput');
    $('portraitBouton').addEventListener('click', () => input.click());
    $('retirerPortrait').addEventListener('click', () => definirPortrait(null));

    input.addEventListener('change', () => {
      const fichier = input.files[0];
      input.value = ''; // permet de re-choisir le même fichier
      if (!fichier || !fichier.type.startsWith('image/')) return;
      const lecteur = new FileReader();
      lecteur.onload = () => {
        const img = new Image();
        img.onload = () => {
          editeur.img = img;
          ouvrirEditeur();
        };
        img.src = lecteur.result;
      };
      lecteur.readAsDataURL(fichier);
    });

    const canvas = $('imageCanvas');
    editeur.ctx = canvas.getContext('2d');

    canvas.addEventListener('pointerdown', e => {
      canvas.setPointerCapture(e.pointerId);
      editeur.pointeurs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (editeur.pointeurs.size === 2) editeur.ecart = ecartDoigts();
    });

    canvas.addEventListener('pointermove', e => {
      const precedent = editeur.pointeurs.get(e.pointerId);
      if (!precedent || !editeur.img) return;
      const courant = { x: e.clientX, y: e.clientY };
      editeur.pointeurs.set(e.pointerId, courant);

      if (editeur.pointeurs.size === 1) {
        editeur.x += courant.x - precedent.x;
        editeur.y += courant.y - precedent.y;
        borner();
        dessiner();
      } else if (editeur.pointeurs.size === 2 && editeur.ecart) {
        const ecart = ecartDoigts();
        const [a, b] = [...editeur.pointeurs.values()];
        zoomerVers(editeur.zoom * ecart / editeur.ecart, (a.x + b.x) / 2, (a.y + b.y) / 2);
        editeur.ecart = ecart;
      }
    });

    const relacher = e => {
      editeur.pointeurs.delete(e.pointerId);
      editeur.ecart = editeur.pointeurs.size === 2 ? ecartDoigts() : 0;
    };
    canvas.addEventListener('pointerup', relacher);
    canvas.addEventListener('pointercancel', relacher);

    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      if (editeur.img) zoomerVers(editeur.zoom * (e.deltaY > 0 ? 0.9 : 1.1), e.clientX, e.clientY);
    }, { passive: false });

    $('btnReinitialiser').addEventListener('click', reinitialiser);
    $('btnAppliquer').addEventListener('click', appliquer);
  }

  function ecartDoigts() {
    const [a, b] = [...editeur.pointeurs.values()];
    return Math.hypot(a.x - b.x, a.y - b.y) || 1;
  }

  function ouvrirEditeur() {
    $('imageEditModal').showModal();
    const canvas = $('imageCanvas');
    const ratio = window.devicePixelRatio || 1;
    editeur.cw = canvas.clientWidth;
    editeur.ch = canvas.clientHeight;
    canvas.width = Math.round(editeur.cw * ratio);
    canvas.height = Math.round(editeur.ch * ratio);
    editeur.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    editeur.ctx.imageSmoothingQuality = 'high';
    editeur.pointeurs.clear();
    reinitialiser();
  }

  function tailleRecadrage() {
    return document.querySelector('#imageEditModal .crop-frame').offsetWidth || 300;
  }

  function zoomMinimum() {
    const cadre = tailleRecadrage();
    return Math.max(cadre / editeur.img.width, cadre / editeur.img.height);
  }

  function reinitialiser() {
    const { img, cw, ch } = editeur;
    if (!img) return;
    editeur.zoom = zoomMinimum();
    editeur.x = (cw - img.width * editeur.zoom) / 2;
    editeur.y = (ch - img.height * editeur.zoom) / 2;
    borner();
    dessiner();
  }

  function zoomerVers(zoomVoulu, clientX, clientY) {
    const minimum = zoomMinimum();
    const zoom = Math.min(Math.max(zoomVoulu, minimum), Math.max(minimum * 6, 3));
    const r = $('imageCanvas').getBoundingClientRect();
    const px = clientX - r.left;
    const py = clientY - r.top;
    const facteur = zoom / editeur.zoom;
    editeur.x = px - (px - editeur.x) * facteur;
    editeur.y = py - (py - editeur.y) * facteur;
    editeur.zoom = zoom;
    borner();
    dessiner();
  }

  // Le cadre de recadrage doit toujours rester couvert par l'image.
  function borner() {
    const cadre = tailleRecadrage();
    const gauche = (editeur.cw - cadre) / 2;
    const haut = (editeur.ch - cadre) / 2;
    const largeur = editeur.img.width * editeur.zoom;
    const hauteur = editeur.img.height * editeur.zoom;
    editeur.x = Math.min(gauche, Math.max(gauche + cadre - largeur, editeur.x));
    editeur.y = Math.min(haut, Math.max(haut + cadre - hauteur, editeur.y));
  }

  function dessiner() {
    const { ctx, img, cw, ch, zoom, x, y } = editeur;
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, x, y, img.width * zoom, img.height * zoom);
  }

  function appliquer() {
    if (!editeur.img) return;
    const cadre = tailleRecadrage();
    const { img, zoom, x, y, cw, ch } = editeur;
    const taille = 400;
    const sortie = document.createElement('canvas');
    sortie.width = sortie.height = taille;
    const ctx = sortie.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#f4ecd9'; // fond vélin pour les PNG transparents
    ctx.fillRect(0, 0, taille, taille);
    ctx.drawImage(
      img,
      ((cw - cadre) / 2 - x) / zoom,
      ((ch - cadre) / 2 - y) / zoom,
      cadre / zoom,
      cadre / zoom,
      0, 0, taille, taille
    );
    definirPortrait(sortie.toDataURL('image/jpeg', 0.9));
    $('imageEditModal').close();
  }

  function definirPortrait(source) {
    etat.portrait = source;
    const apercu = $('imagePreview');
    if (source) {
      apercu.innerHTML = `<img src="${source}" alt="Portrait du personnage">`;
      $('regPortrait').innerHTML = `<img src="${source}" alt="">`;
    } else {
      apercu.innerHTML = `
        <span class="portrait-vide">
          <svg viewBox="0 0 64 64" aria-hidden="true"><use href="#silhouette"/></svg>
          <span>Ajouter un portrait</span>
        </span>`;
    }
    $('retirerPortrait').hidden = !source;
    $('portraitBouton').setAttribute('aria-label', source ? 'Changer le portrait' : 'Importer un portrait');
    majRegistre();
  }
})();
