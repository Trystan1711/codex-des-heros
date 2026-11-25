/* ═══════════════════════════════════════════════════════════════
   CODEX DES HÉROS — génération de la fiche HTML autonome
   Assemble un fichier unique (styles, scripts, polices, portrait
   et données intégrés) qui fonctionne hors ligne en double-cliquant.
   ═══════════════════════════════════════════════════════════════ */
'use strict';

window.Telechargement = (() => {
  const URL_POLICES = 'https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=IM+Fell+English:ital@0;1&family=IM+Fell+English+SC&family=IM+Fell+French+Canon&display=swap';
  // Les styles du site, réutilisés tels quels, puis ceux propres à la fiche autonome.
  const FEUILLES = ['css/codex.css', 'css/creation.css', 'css/fiche.css', 'css/codex-ajouts.css', 'css/fiche-autonome.css'];
  const SCRIPTS = ['js/regles.js', 'js/fiche-autonome.js'];
  const ICONE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%23f4ecd9'/%3E%3Cpath d='M16 3 L27 16 L16 29 L5 16 Z' fill='%23bf9443'/%3E%3Ccircle cx='16' cy='16' r='4.5' fill='%239f2f1f'/%3E%3C/svg%3E";

  const SPRITE = `
<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
  <symbol id="etoile" viewBox="0 0 48 48"><path d="M24 2 L28.5 16 L38 10 L32 19.5 L46 24 L32 28.5 L38 38 L28.5 32 L24 46 L19.5 32 L10 38 L16 28.5 L2 24 L16 19.5 L10 10 L19.5 16 Z"/></symbol>
  <symbol id="coin" viewBox="0 0 48 48"><g fill="none" stroke="currentColor" stroke-linecap="round"><path d="M2 40 V14 Q2 2 14 2 H40" stroke-width="1.1"/><path d="M14 14 C22 14 26 20 26 26 C26 31 21 33 18.5 30.5 C16 28 18 24.5 21 25.5" stroke-width=".9"/></g><path fill="currentColor" d="M14 10 L18 14 L14 18 L10 14 Z"/></symbol>
  <symbol id="fleuron" viewBox="0 0 320 28"><g fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round"><path d="M6 14 H110"/><path d="M210 14 H314"/><path d="M118 14 C128 14 132 5 142 5 C148 5 150 10 146 12"/><path d="M118 14 C128 14 132 23 142 23 C148 23 150 18 146 16"/><path d="M202 14 C192 14 188 5 178 5 C172 5 170 10 174 12"/><path d="M202 14 C192 14 188 23 178 23 C172 23 170 18 174 16"/></g><g fill="currentColor"><circle cx="3" cy="14" r="1.8"/><circle cx="317" cy="14" r="1.8"/><path d="M114 11 L117 14 L114 17 L111 14 Z"/><path d="M206 11 L209 14 L206 17 L203 14 Z"/><path d="M160 3 L168 14 L160 25 L152 14 Z"/><circle cx="146" cy="14" r="1.6"/><circle cx="174" cy="14" r="1.6"/></g></symbol>
  <symbol id="telecharger" viewBox="0 0 24 24"><path d="M12 4 V15 M7 10.5 L12 15.5 L17 10.5 M5 19.5 H19" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="de" viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="17" height="17" rx="3.5" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="8.5" cy="8.5" r="1.4"/><circle cx="15.5" cy="8.5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="8.5" cy="15.5" r="1.4"/><circle cx="15.5" cy="15.5" r="1.4"/></symbol>
  <symbol id="cadenas" viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 10.5 V7.5 a4 4 0 0 1 8 0 V10.5" fill="none" stroke="currentColor" stroke-width="1.6"/></symbol>
</svg>`;

  let ressources = null; // mises en cache après le premier téléchargement

  function nouvelId() {
    return `perso-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function echapper(texte) {
    return String(texte ?? '').replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  async function lireTexte(url) {
    const reponse = await fetch(url, { cache: 'no-cache' });
    if (!reponse.ok) throw new Error(`${url} : HTTP ${reponse.status}`);
    return reponse.text();
  }

  function enDataUrl(blob) {
    return new Promise((resoudre, rejeter) => {
      const lecteur = new FileReader();
      lecteur.onload = () => resoudre(lecteur.result);
      lecteur.onerror = rejeter;
      lecteur.readAsDataURL(blob);
    });
  }

  // Polices intégrées en base64 (jeu de caractères latin seulement) :
  // la fiche garde son apparence même hors ligne.
  async function policesIntegrees() {
    try {
      const css = await lireTexte(URL_POLICES);
      const blocs = css.split('/*').slice(1).map(b => `/*${b}`).filter(b => /^\/\*\s*latin\s*\*\//.test(b));
      if (!blocs.length) throw new Error('aucune police latine');
      const integres = await Promise.all(blocs.map(async bloc => {
        const url = bloc.match(/url\(([^)]+)\)/)[1].replace(/['"]/g, '');
        const reponse = await fetch(url);
        if (!reponse.ok) throw new Error(`police : HTTP ${reponse.status}`);
        return bloc.replace(/url\([^)]+\)/, `url(${await enDataUrl(await reponse.blob())})`);
      }));
      return integres.join('\n');
    } catch (erreur) {
      console.warn('Polices non intégrées (la fiche utilisera les polices en ligne ou de secours) :', erreur);
      return null;
    }
  }

  async function chargerRessources() {
    if (ressources) return ressources;
    const [feuilles, scripts, polices] = await Promise.all([
      Promise.all(FEUILLES.map(lireTexte)),
      Promise.all(SCRIPTS.map(lireTexte)),
      policesIntegrees()
    ]);
    ressources = {
      css: feuilles.join('\n\n'),
      js: scripts.join('\n\n').replace(/<\/script/gi, '<\\/script'),
      polices
    };
    return ressources;
  }

  // Données complètes de la fiche, à partir du personnage enregistré à la création.
  function construireDonnees(p, d) {
    const race = d.races[p.race];
    const metier = d.metiers[p.metier];
    const royaume = p.royaume && d.royaumes ? d.royaumes[p.royaume] : null;
    const vocation = p.vocation ? Regles.VOCATIONS[p.vocation] : null;
    if (!race || !metier) throw new Error('Race ou métier introuvable');

    const competences = {};
    Codex.ORDRE_COMPETENCES.forEach(nom => {
      competences[nom] = { race: race.skills[nom] || 0, metier: metier.bonus[nom] || 0, points: 0 };
    });

    const pmMax = race.reserve_magie + (metier.bonus['Réserve magique'] || 0);
    const sorts = (p.sorts || []).map(choix => {
      const ref = (d.sorts?.[choix.niveau] || []).find(s => s.nom === choix.nom);
      return ref && {
        id: Math.random().toString(36).slice(2, 10),
        nom: ref.nom,
        niveau: Number(choix.niveau),
        cout: ref.cout,
        effet: ref.effet,
        personnalise: false
      };
    }).filter(Boolean);

    return {
      format: 'codex-fiche',
      version: 1,
      id: p.id || nouvelId(),
      modifieLe: new Date().toISOString(),
      perso: {
        prenom: p.prenom,
        nom: p.nom,
        age: p.age,
        genre: p.genre,
        origine: p.nationalite,
        description: p.description || '',
        portrait: p.image || null,
        race: { cle: p.race, label: race.label },
        metier: { cle: p.metier, label: metier.label, bonus: metier.bonus, pouvoir: metier.pouvoir },
        royaume: royaume ? {
          cle: p.royaume,
          label: royaume.label,
          type: royaume.type,
          dirigeant: royaume.dirigeant,
          races: royaume.races
        } : null,
        vocation: vocation ? { cle: p.vocation, ...vocation } : null,
        creeLe: p.creeLe || new Date().toISOString(),
        niveau: 1,
        competences,
        pv: { actuel: race.pv, max: race.pv },
        pm: { actuel: pmMax, max: pmMax },
        argent: 0,
        pointsLibres: 0,
        historique: [],
        objets: [],
        sorts,
        boosts: [],
        notes: ''
      },
      reference: {
        competences: Codex.ORDRE_COMPETENCES,
        sorts: d.sorts || {},
        degatsSorts: d.degats_sorts || {},
        paliers: d.paliers_competences || {},
        armesMagiques: d.armes_magiques || {},
        equipement: d.equipement || {},
        groupesEquipement: d.groupes_equipement || []
      }
    };
  }

  function gabarit({ titre, polices, css, js, donnees }) {
    const json = JSON.stringify(donnees).replace(/</g, '\\u003c');
    const tetePolices = polices
      ? `<style id="polices">\n${polices}\n</style>`
      : `<link rel="stylesheet" href="${URL_POLICES}">`;
    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${echapper(titre)} — Fiche de personnage</title>
<meta name="theme-color" content="#2d1a12">
<link rel="icon" href="${ICONE}">
${tetePolices}
<style>
${css}
</style>
</head>
<body class="cuir">
${SPRITE}
<div id="application"></div>
<script type="application/json" id="donnees-fiche">${json}</script>
<script>
${js}
</script>
</body>
</html>
`;
  }

  function nomFichier(p) {
    const nom = [p.prenom, p.nom].filter(Boolean).join(' ').trim() || 'Personnage';
    return `${nom.replace(/[\\/:*?"<>|]+/g, '').trim() || 'Personnage'}.html`;
  }

  function telechargerTexte(contenu, nom) {
    const url = URL.createObjectURL(new Blob([contenu], { type: 'text/html;charset=utf-8' }));
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = nom;
    document.body.appendChild(lien);
    lien.click();
    lien.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  async function telecharger(personnage, donneesJeu) {
    const { css, js, polices } = await chargerRessources();
    const donnees = construireDonnees(personnage, donneesJeu);
    const titre = [personnage.prenom, personnage.nom].filter(Boolean).join(' ');
    telechargerTexte(gabarit({ titre, polices, css, js, donnees }), nomFichier(personnage));
  }

  return { telecharger, nouvelId };
})();
