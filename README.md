# Codex des héros

Création et fiche de personnage pour un jeu de rôle médiéval-fantastique.

- `index.html` (+ `js/accueil.js`) : page d'accueil, le système de jeu expliqué aux nouveaux joueurs
- `creation.html` : création du personnage (identité, portrait, apparence, race, métier, royaume d'origine, sorts de départ, vocation)
- `fiche.html` : fiche du personnage, consultable et exportable en PDF
- `donnees_fantasy.json` : races, métiers, royaumes, sorts et descriptions physiques, plus :
  - `degats_sorts` : dégâts des sorts d'attaque par niveau (`6` = ultime), sur une cible (`une`) et en zone (`zone`).
    Dans l'effet d'un sort, `{une}` et `{zone}` sont remplacés par ces dés (bonus du sceptre compris).
  - `paliers_competences` : ce que donne chaque palier (0-3 · 4-7 · 8-11 · 12-14 · 15-16 · 17 · 18) pour Force, Adresse, Magie, Résistance et Soin
  - `descriptions_competences` : à quoi sert chaque compétence (page d'accueil)
  - `equipement` : les cinq catégories d'objets (armes de mêlée, armes à distance, armures, boucliers, objets et artefacts),
    avec leurs types, leurs niveaux (5 pour les armes, 3 pour armures et boucliers), dégâts, défense et malus de Vélocité
  - `armes_magiques` : bâtons (réduction du coût en PM, deux mains) et sceptres (dés en plus aux sorts d'attaque, une main),
    avec leurs dégâts en mêlée
  - royaumes : `description` (phrase d'accroche), `points` (paragraphes courts) et `venir` (« Venir d'ici, c'est… »)
- `css/`, `js/` : styles et scripts (`codex.css` / `commun.js` sont partagés par les pages)
- `js/regles.js` : règles du jeu (plafonds, coût des points, vocations et montée de niveau, grille des paliers, tirage des sorts, dégâts, bâtons et sceptres)
- `js/telechargement.js` : génère la fiche HTML autonome (bouton « Télécharger ma fiche »)
- `js/fiche-autonome.js`, `css/fiche-autonome.css` : intégrés dans la fiche téléchargée, qui fonctionne seule, hors ligne
- `css/codex-ajouts.css` : styles des ajouts (royaume, sorts, vocation, téléchargement, page d'accueil)
- `img/` : illustrations des races (chemin indiqué dans le champ `image` de chaque race)

Les pages chargent le JSON avec `fetch` : ouvrez-les via un serveur local
(par exemple l'extension Live Server de VS Code), pas directement en `file://`.
La fiche téléchargée, elle, s'ouvre d'un simple double-clic.
