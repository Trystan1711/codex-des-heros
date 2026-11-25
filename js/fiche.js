/* ═══════════════════════════════════════════════════════════════
   CODEX DES HÉROS — fiche de personnage
   ═══════════════════════════════════════════════════════════════ */
'use strict';

(() => {
  const $ = id => document.getElementById(id);
  const { echapper } = Codex;

  let perso = null;
  let race = null;
  let metier = null;
  let royaume = null;   // ajout : l'origine affichée est le royaume choisi à la création
  let vocation = null;  // ajout
  let paliers = {};     // ajout : ce que donne chaque palier de compétence (données)

  demarrer();

  async function demarrer() {
    let donnees;
    try {
      donnees = await Codex.chargerDonnees();
    } catch (erreur) {
      console.error('Erreur de chargement des données :', erreur);
      $('contenu').innerHTML = Codex.panneauErreur();
      return;
    }

    try {
      perso = JSON.parse(localStorage.getItem(Codex.CLE_STOCKAGE));
    } catch {
      perso = null;
    }
    race = perso && donnees.races[perso.race];
    metier = perso && donnees.metiers[perso.metier];
    royaume = perso && donnees.royaumes?.[perso.royaume];
    vocation = perso && Regles.VOCATIONS[perso.vocation];
    paliers = donnees.paliers_competences || {};

    if (!perso || !race || !metier) {
      afficherPageBlanche();
      return;
    }

    remplir();
    $('characterSheet').hidden = false;
    $('barreActions').hidden = false;
    Codex.observerRevelations();
    Codex.brancherDialogue($('raceModal'));
    $('race').addEventListener('click', ouvrirRace);
    $('btnNouveau').addEventListener('click', nouvelleCreation);
    $('btnPDF').addEventListener('click', exporterPDF);
    $('btnTelecharger').addEventListener('click', () => telechargerFiche(donnees));
  }

  function afficherPageBlanche() {
    $('contenu').innerHTML = `
      <div class="panneau">
        <p class="surtitre">Page blanche</p>
        <h2>Aucun héros n'est encore inscrit</h2>
        <p>Le codex attend son premier personnage : choisissez une race, un métier
        et un royaume pour forger sa fiche.</p>
        <a class="bouton bouton--lapis" href="creation.html">Créer un personnage</a>
      </div>`;
  }

  // ─── Remplissage de la charte ─────────────────────────────────

  function nomComplet() {
    return [perso.prenom, perso.nom].filter(Boolean).join(' ');
  }

  function initiales() {
    return ((perso.prenom || '').charAt(0) + (perso.nom || '').charAt(0)).toUpperCase() || '?';
  }

  function remplir() {
    const nom = nomComplet();
    document.title = `${nom} — Fiche de personnage`;

    const [premiere = '', ...reste] = Array.from(nom);
    $('nomComplet').innerHTML = `<span class="initiale-or">${echapper(premiere)}</span>${echapper(reste.join(''))}`;

    $('race').textContent = race.label;
    $('metier').textContent = metier.label;
    $('age').textContent = perso.age;
    $('genre').textContent = perso.genre;
    $('nationalite').textContent = royaume?.label || perso.nationalite || '—';
    $('vocation').textContent = vocation ? `${vocation.label} · +${vocation.pv} PV, +${vocation.pm} réserve par niveau` : '—';

    $('imagePreview').innerHTML = perso.image
      ? `<img src="${echapper(perso.image)}" alt="Portrait de ${echapper(nom)}">`
      : `<span class="medaillon-initiales">${echapper(initiales())}</span>`;

    $('pvValue').textContent = race.pv;
    $('magieValue').textContent = race.reserve_magie + (metier.bonus['Réserve magique'] || 0);

    rendreCompetences();
    rendreDon();
    rendreApparence(); // les anciennes fiches peuvent avoir une vertu et un vice : ils sont ignorés

    const date = perso.creeLe ? new Date(perso.creeLe) : null;
    if (date && !Number.isNaN(date.getTime())) {
      $('colophon').textContent = `Inscrit au Codex des héros le ${date.toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'long', year: 'numeric'
      })}`;
    }
  }

  function rendreCompetences() {
    $('skillsGrid').innerHTML = Codex.ORDRE_COMPETENCES.map((nom, i) => {
      const base = race.skills[nom] || 0;
      const total = Regles.valeurCreation(base, metier.bonus[nom] || 0); // plafond de 13 au niveau 1
      const bonus = total - base;
      const marqueBonus = bonus
        ? `<span class="competence-bonus" title="${base} de race + ${bonus} de ${echapper(metier.label)}" aria-hidden="true">+${bonus}</span>`
        : '<span></span>';
      // Palier calculé sur la valeur réelle (race + métier, sans objets au niveau 1)
      const palier = Regles.palierCompetence(total, paliers[nom]);
      return `
        <li class="competence${bonus ? ' a-bonus' : ''}" style="--i:${i}">
          <span class="competence-nom">${echapper(nom)}</span>
          <span class="points" aria-hidden="true"></span>
          ${marqueBonus}
          <span class="competence-total">${total}${bonus ? `<span class="sr-only"> (dont ${bonus} de bonus de métier)</span>` : ''}</span>
          <span class="jauge" aria-hidden="true">
            <span class="jauge-remplissage">
              <span class="jauge-base" style="--v:${base}"></span>
              <span class="jauge-bonus" style="--v:${bonus}"></span>
            </span>
          </span>
          ${palier ? lignePalier(palier) : ''}
        </li>`;
    }).join('');
  }

  function lignePalier(p) {
    const seuil = p.min === p.max ? p.min : `${p.min}–${p.max}`;
    return `<p class="comp-palier">Palier ${seuil} · ${echapper(p.effet)} : <b>${echapper(p.valeur)}</b></p>`;
  }

  function rendreDon() {
    const nomDon = metier.pouvoir.name;
    const [premiere = '', ...reste] = Array.from(nomDon);
    $('donInitiale').textContent = premiere;
    $('pouvoirName').innerHTML =
      `<span aria-hidden="true">${echapper(reste.join(''))}</span><span class="sr-only">${echapper(nomDon)}</span>`;
    $('pouvoirEffect').textContent = metier.pouvoir.effect;
  }

  function rendreApparence() {
    const texte = (perso.description || '').trim();
    if (!texte) return;

    // « Taille : Grand(e) » sur chaque ligne → liste à points de conduite.
    const lignes = texte.split(/\n+/).map(l => l.trim()).filter(Boolean);
    const paires = lignes.map(l => l.match(/^([^:]{1,30}?)\s*:\s*(.+)$/));
    const conteneur = $('descriptionTexte');

    if (paires.every(Boolean)) {
      conteneur.innerHTML = `<dl class="apparence-liste">${paires
        .map(([, cle, valeur]) => `<div><dt>${echapper(cle)}</dt><dd>${echapper(valeur)}</dd></div>`)
        .join('')}</dl>`;
    } else {
      conteneur.innerHTML = `<p class="texte-lettrine apparence-texte">${echapper(texte)}</p>`;
    }
    $('apparenceSection').hidden = false;
  }

  // ─── Actions ──────────────────────────────────────────────────

  function ouvrirRace() {
    const dialogue = $('raceModal');
    $('modalRaceContent').innerHTML = Codex.detailsRace(race, 'modalRaceTitle');
    dialogue.showModal();
    dialogue.scrollTop = 0;
  }

  function nouvelleCreation() {
    if (!confirm('Créer un nouveau personnage ? La fiche actuelle sera effacée de ce navigateur.')) return;
    localStorage.removeItem(Codex.CLE_STOCKAGE);
    window.location.href = 'creation.html';
  }

  // ─── Téléchargement de la fiche autonome (ajout) ──────────────

  async function telechargerFiche(donnees) {
    const bouton = $('btnTelecharger');
    const libelle = bouton.querySelector('.libelle');
    // Un identifiant stable : chaque nouveau téléchargement garde la même sauvegarde locale.
    if (!perso.id) {
      perso.id = Telechargement.nouvelId();
      try { localStorage.setItem(Codex.CLE_STOCKAGE, JSON.stringify(perso)); } catch { /* sans effet */ }
    }
    bouton.disabled = true;
    libelle.textContent = 'Préparation…';
    try {
      await Telechargement.telecharger(perso, donnees);
    } catch (erreur) {
      console.error(erreur);
      alert('Le téléchargement de la fiche a échoué. Réessayez.');
    } finally {
      bouton.disabled = false;
      libelle.textContent = 'Télécharger ma fiche';
    }
  }

  // ─── Export PDF ───────────────────────────────────────────────

  // Les polices standard de jsPDF ne couvrent que le Latin-1.
  function textePDF(texte) {
    return String(texte ?? '')
      .replace(/[‘’ʼ]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/Œ/g, 'OE')
      .replace(/œ/g, 'oe')
      .replace(/…/g, '...')
      .replace(/[–—]/g, '-')
      .replace(/[  ]/g, ' ')
      .replace(/[^\x00-\xFF]/g, '');
  }

  function exporterPDF() {
    if (!window.jspdf) {
      alert("La bibliothèque PDF n'a pas pu être chargée. Vérifiez votre connexion internet puis réessayez.");
      return;
    }

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const W = 210;
    const H = 297;
    const G = 22;          // marge gauche du texte
    const D = W - 22;      // marge droite du texte
    const L = D - G;       // largeur utile

    const C = {
      encre: [42, 32, 23],
      encre2: [79, 65, 51],
      encre3: [123, 105, 84],
      rubrique: [159, 47, 31],
      lapis: [36, 68, 125],
      vert: [60, 106, 85],
      or: [176, 138, 62],
      orPale: [214, 190, 130],
      filet: [214, 196, 159],
      pointille: [171, 146, 102],
      jauge: [232, 220, 194],
      velin: [251, 247, 236],
      velin2: [240, 231, 210]
    };

    const remplissage = c => pdf.setFillColor(c[0], c[1], c[2]);
    const trait = c => pdf.setDrawColor(c[0], c[1], c[2]);
    const encre = c => pdf.setTextColor(c[0], c[1], c[2]);
    const police = (style, taille) => { pdf.setFont('times', style); pdf.setFontSize(taille); };
    const losange = (x, y, r) => pdf.lines([[r, r], [-r, r], [-r, -r]], x, y - r, [1, 1], 'F', true);

    // Texte espacé (capitales de titrage) ; renvoie sa largeur.
    function espace(texte, x, y, ecart, centre = false) {
      const largeur = pdf.getTextWidth(texte) + ecart * (texte.length - 1);
      pdf.text(texte, centre ? x - largeur / 2 : x, y, { charSpace: ecart });
      return largeur;
    }

    function pointille(x1, x2, y) {
      if (x2 - x1 < 2) return;
      trait(C.pointille);
      pdf.setLineWidth(0.25);
      pdf.setLineDashPattern([0.35, 1.1], 0);
      pdf.line(x1, y, x2, y);
      pdf.setLineDashPattern([], 0);
    }

    function titreSection(texte, y, x = null, largeur = null) {
      police('normal', 10.5);
      encre(C.rubrique);
      trait(C.filet);
      const t = textePDF(texte.toUpperCase());
      if (x === null) {
        const w = espace(t, W / 2, y, 0.8, true);
        pdf.setLineWidth(0.3);
        pdf.line(G, y - 1.3, W / 2 - w / 2 - 4, y - 1.3);
        pdf.line(W / 2 + w / 2 + 4, y - 1.3, D, y - 1.3);
      } else {
        const w = espace(t, x, y, 0.8);
        pdf.setLineWidth(0.3);
        pdf.line(x + w + 4, y - 1.3, x + largeur, y - 1.3);
      }
    }

    function ligneAPoints(libelle, valeur, x, y, largeur) {
      police('normal', 9.5);
      encre(C.encre3);
      const wl = espace(textePDF(libelle.toUpperCase()), x, y, 0.4);

      police('normal', 12.5);
      encre(C.encre);
      const maxV = largeur - wl - 6;
      let v = textePDF(valeur);
      if (pdf.getTextWidth(v) > maxV) {
        while (v.length > 1 && pdf.getTextWidth(`${v}...`) > maxV) v = v.slice(0, -1);
        v = `${v.trimEnd()}...`;
      }
      const wv = pdf.getTextWidth(v);
      pdf.text(v, x + largeur, y, { align: 'right' });
      pointille(x + wl + 2, x + largeur - wv - 2, y - 0.5);
    }

    // Fond, double cadre et losanges d'angle
    remplissage(C.velin);
    pdf.rect(0, 0, W, H, 'F');
    trait(C.encre2);
    pdf.setLineWidth(0.5);
    pdf.rect(8, 8, W - 16, H - 16);
    trait(C.or);
    pdf.setLineWidth(0.25);
    pdf.rect(10.5, 10.5, W - 21, H - 21);
    remplissage(C.or);
    [[10.5, 10.5], [W - 10.5, 10.5], [10.5, H - 10.5], [W - 10.5, H - 10.5]]
      .forEach(([x, y]) => losange(x, y, 1.8));

    // En-tête
    let y = 25;
    police('normal', 9);
    encre(C.rubrique);
    espace('FICHE DE PERSONNAGE', W / 2, y, 0.9, true);

    const nom = textePDF(nomComplet());
    let taille = 28;
    police('bold', taille);
    while (pdf.getTextWidth(nom) > L && taille > 14) pdf.setFontSize(--taille);
    encre(C.encre);
    y += 12;
    pdf.text(nom, W / 2, y, { align: 'center' });

    y += 8;
    police('italic', 13);
    encre(C.rubrique);
    pdf.text(textePDF(`${race.label} · ${metier.label}`), W / 2, y, { align: 'center' });

    y += 6;
    trait(C.or);
    pdf.setLineWidth(0.3);
    pdf.line(W / 2 - 42, y, W / 2 - 5, y);
    pdf.line(W / 2 + 5, y, W / 2 + 42, y);
    remplissage(C.or);
    losange(W / 2, y, 2);
    losange(W / 2 - 44, y, 0.9);
    losange(W / 2 + 44, y, 0.9);

    // Portrait
    y += 11;
    const P = 44;
    remplissage(C.velin2);
    pdf.rect(G, y, P, P, 'F');
    if (perso.image) {
      try {
        pdf.addImage(perso.image, 'JPEG', G, y, P, P);
      } catch (erreur) {
        console.warn('Portrait non exporté :', erreur);
      }
    } else {
      police('normal', 26);
      encre(C.orPale);
      pdf.text(textePDF(initiales()), G + P / 2, y + P / 2 + 3, { align: 'center' });
    }
    trait(C.or);
    pdf.setLineWidth(0.8);
    pdf.rect(G - 1.2, y - 1.2, P + 2.4, P + 2.4);
    pdf.setLineWidth(0.25);
    pdf.rect(G - 2.8, y - 2.8, P + 5.6, P + 5.6);

    // Identité
    const ix = G + P + 12;
    const iw = D - ix;
    let iy = y + 5;
    [['Âge', perso.age], ['Genre', perso.genre], ['Origine', royaume?.label || perso.nationalite], ['Vocation', vocation?.label || '—']].forEach(([libelle, valeur]) => {
      ligneAPoints(libelle, valeur, ix, iy, iw);
      iy += 7.6;
    });

    // Points de vie & magie
    [['Points de vie', race.pv, C.rubrique], ['Réserve de magie', race.reserve_magie + (metier.bonus['Réserve magique'] || 0), C.lapis]]
      .forEach(([libelle, valeur, couleur], k) => {
        const cx = ix + 7 + k * (iw / 2);
        const cy = iy + 7;
        trait(C.or);
        pdf.setLineWidth(0.5);
        remplissage(couleur);
        pdf.circle(cx, cy, 6.4, 'FD');
        police('bold', 12.5);
        encre(C.velin);
        pdf.text(String(valeur), cx, cy + 1.6, { align: 'center' });
        police('normal', 10.5);
        encre(C.encre2);
        pdf.text(textePDF(libelle), cx + 9, cy + 1.3);
      });

    // Compétences
    y += P + 13;
    titreSection('Compétences', y);
    y += 8.5;
    const colW = (L - 12) / 2;
    const unite = colW / Codex.ECHELLE_MAX;
    Codex.ORDRE_COMPETENCES.forEach((nomComp, i) => {
      const x = G + (i < 6 ? 0 : colW + 12);
      const yy = y + (i % 6) * 10.5;
      const base = race.skills[nomComp] || 0;
      const valeur = Regles.valeurCreation(base, metier.bonus[nomComp] || 0); // plafond de 13 au niveau 1
      const bonus = valeur - base;
      const total = String(valeur);

      police('normal', 11.5);
      encre(bonus ? C.encre : C.encre2);
      const n = textePDF(nomComp);
      pdf.text(n, x, yy);
      const wn = pdf.getTextWidth(n);

      police('bold', 12.5);
      encre(C.encre);
      pdf.text(total, x + colW, yy, { align: 'right' });
      let fin = x + colW - pdf.getTextWidth(total) - 1.8;

      if (bonus) {
        police('italic', 10);
        encre(C.rubrique);
        const b = `+${bonus}`;
        pdf.text(b, fin, yy, { align: 'right' });
        fin -= pdf.getTextWidth(b) + 1.8;
      }
      pointille(x + wn + 1.8, fin, yy - 0.5);

      const jy = yy + 2.4;
      remplissage(C.jauge);
      pdf.rect(x, jy, colW, 1.3, 'F');
      remplissage(C.encre2);
      pdf.rect(x, jy, base * unite, 1.3, 'F');
      if (bonus) {
        remplissage(C.rubrique);
        pdf.rect(x + base * unite, jy, bonus * unite, 1.3, 'F');
      }
    });
    y += 6 * 10.5 + 5;

    // Don du métier (pleine largeur : le tempérament n'existe plus)
    titreSection('Don du métier', y);

    let yg = y + 8.5;
    police('bolditalic', 13);
    encre(C.encre);
    const lignesNom = pdf.splitTextToSize(textePDF(metier.pouvoir.name), L);
    pdf.text(lignesNom, G, yg);
    yg += lignesNom.length * 5.6;
    police('italic', 11);
    encre(C.encre2);
    const lignesEffet = pdf.splitTextToSize(textePDF(metier.pouvoir.effect), L);
    pdf.text(lignesEffet, G, yg);
    yg += lignesEffet.length * 4.8;

    y = yg + 7;

    // Apparence
    const description = (perso.description || '').trim();
    const limite = H - 24;
    if (description && y < limite - 14) {
      titreSection('Apparence', y);
      y += 8;
      police('italic', 11);
      encre(C.encre2);
      const interligne = 4.9;
      const lignes = pdf.splitTextToSize(textePDF(description), L);
      const place = Math.max(0, Math.floor((limite - y) / interligne));
      const visibles = lignes.slice(0, place);
      if (lignes.length > place && visibles.length) {
        visibles[visibles.length - 1] = `${visibles[visibles.length - 1].replace(/\s*\S*$/, '')}...`;
      }
      pdf.text(visibles, G, y, { lineHeightFactor: interligne / (11 * 0.3528) });
    }

    // Colophon
    police('italic', 9);
    encre(C.encre3);
    pdf.text(textePDF($('colophon').textContent), W / 2, H - 15, { align: 'center' });

    const fichier = `${perso.prenom || 'Personnage'}_${perso.nom || 'Fantasy'}_Fiche`
      .replace(/[\\/:*?"<>|]+/g, '')
      .replace(/\s+/g, '_');
    pdf.save(`${fichier}.pdf`);
  }
})();
