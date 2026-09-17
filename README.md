# Visionneuse 3D — STEP / IGES / BREP / 3MF / OBJ / STL

Ouvrir un fichier de CAO volumique et le regarder : la géométrie exacte
triangulée à l'écran, l'arbre d'assemblage, les couleurs de pièces, les cotes.
Même esprit que la visionneuse IPC-2581 du dépôt [WEB_CAO](../WEB_CAO) — on
lit, on inspecte, **on ne modifie rien** — et les mêmes conventions : HTML5 et
JavaScript nature, aucune compilation, aucun `npm install`, tout en local.

Le format **STEP** (`.stp`, `.step`, ISO 10303 AP203/AP214/AP242) est l'échange
standard entre logiciels de conception. Il ne contient pas de triangles mais
des surfaces exactes (B-Rep), la hiérarchie d'assemblage, les noms de pièces et
les couleurs. La traduction en maillage affichable est faite **dans le
navigateur** par le noyau [OpenCascade](https://dev.opencascade.org) compilé en
WebAssembly : aucun fichier n'est envoyé nulle part.

Les formats de maillage — **3MF**, **OBJ**, **STL** — arrivent, eux, déjà
triangulés : ce sont ceux des chaînes d'impression 3D et des outils de rendu.
Le 3MF apporte sa hiérarchie, ses noms d'objets et ses couleurs ; l'OBJ ses
noms d'objets et, si le `.mtl` est déposé avec lui, ses matériaux.

---

## Démarrage

**Double-cliquez sur `web_3D.py`** — ou, depuis un terminal :

```bash
python web_3D.py
```

Dans les deux cas le serveur démarre et la page s'ouvre seule sur
`http://127.0.0.1:8139/` (le port suivant si celui-ci est déjà pris). Le serveur
ne fait que servir des fichiers : il n'y a aucun calcul côté Python.

> [!IMPORTANT]
> Contrairement aux éditeurs de WEB_CAO, **le double-clic sur `index.html` ne
> suffit pas** — c'est sur `web_3D.py` qu'il faut cliquer. En `file://`, le
> navigateur refuse de charger le module WebAssembly (origine « null ») et
> ignore le type MIME `application/wasm`. Il faut passer par le serveur —
> c'est sa seule raison d'être.

Options utiles :

| Option | Effet |
| :--- | :--- |
| `--port 8140` | changer de port |
| `--local` | n'écouter que sur `127.0.0.1` |
| `--sans-navigateur` | ne pas ouvrir le navigateur au lancement |
| `--dossier <chemin>` | servir un autre dossier |

Sur le réseau local, l'adresse affichée au démarrage s'ouvre telle quelle
depuis une tablette : la navigation tactile (un doigt tourne, deux doigts
déplacent et pincent pour zoomer) est prévue.

Un modèle peut aussi être ouvert directement par l'URL :
`http://127.0.0.1:8139/?modele=exemples/assemblage-as1.stp`.

---

## Ce que la page sait faire

### Ouvrir
- **Formats** : `.stp`, `.step`, `.igs`, `.iges`, `.brep` (OpenCascade),
  `.3mf`, `.obj` et `.stl` (lecteurs three.js).
- Glisser-déposer n'importe où dans la fenêtre, ou `Ctrl+O`. Plusieurs fichiers
  déposés ensemble composent un assemblage dans une même scène.
- Un `.obj` déposé **avec son `.mtl`** (et ses images de texture) garde ses
  matériaux : les chemins écrits dans le `.mtl` sont réécrits à la volée vers
  les fichiers réellement déposés, puisqu'aucun d'eux n'a d'adresse sur le
  serveur. Déposé seul, le `.mtl` n'est pas une erreur — simplement rien à
  afficher.
- Les unités sont ramenées au **millimètre** : le 3MF déclare la sienne
  (micron, centimètre, pouce, pied, mètre) et le facteur est appliqué au
  chargement. L'OBJ et le STL, eux, ne déclarent aucune unité : une unité de
  fichier y vaut un millimètre.
- La lecture se fait dans un *worker* : la page reste vivante pendant qu'un
  assemblage de plusieurs dizaines de méga-octets est triangulé.

### Regarder
- **Cube de vues** dans le coin, comme dans un modeleur : 6 faces, 12 arêtes et
  8 coins cliquables — une face donne une vue normalisée, une arête une vue à
  45°, un coin une isométrique. Le cube se glisse aussi à la souris pour
  tourner la scène, et porte la triade X/Y/Z.
- Vues normalisées au clavier (<kbd>1</kbd>…<kbd>7</kbd>) et par les boutons à
  gauche de la vue.
- **Perspective ou orthographique** (<kbd>O</kbd>) sans que le cadrage bouge.
- Modes d'affichage : arêtes vives (<kbd>A</kbd>), filaire (<kbd>W</kbd>),
  rayons X (<kbd>X</kbd>), grille (<kbd>G</kbd>), ombres portées.
- **Plan de coupe** (<kbd>C</kbd>) le long de X, Y ou Z, à position réglable.

### Inspecter
- **Arbre d'assemblage** tel qu'il vient du fichier : noms de sous-ensembles et
  de pièces, couleur, nombre de triangles ; filtre par nom, œil de visibilité,
  isolement d'une branche (<kbd>I</kbd>).
- Une pièce masquée n'attrape plus les clics : **on sélectionne, on mesure et on
  zoome sur ce qui se trouve derrière**, exactement comme à l'écran. Masquer un
  ensemble masque tout son contenu, et l'arbre grise les lignes concernées —
  une pièce absente de la vue ne s'y affiche jamais comme visible.
- Clic dans la vue → la pièce est sélectionnée dans l'arbre, et réciproquement.
  Double-clic dans la vue → le point visé devient le centre de rotation.
- **Fiche de propriétés** : encombrement, diagonale, centre, couleur d'origine,
  fichier de provenance, volume et surface calculés sur le maillage.

### Mesurer

<kbd>K</kbd> ouvre l'outil, <kbd>M</kbd> fait tourner les trois modes.
On ne mesure pas des triangles : la visionneuse reconstruit d'abord les arêtes
et les faces du modèle, puis reconnaît ce qu'elles sont — une droite, un cercle,
un plan, un cylindre — et donne la cote qu'un mécanicien attend de ce couple-là.

| Mode | Ce qu'on désigne | Ce qu'on obtient |
| :--- | :--- | :--- |
| **Point** | deux points, accrochés aux sommets | distance, ΔX, ΔY, ΔZ |
| **Arête** | deux arêtes | deux perçages → **entraxe** de centre à centre et les deux ⌀ ; deux droites parallèles → écartement ; sécantes → angle et point de croisement ; gauches → perpendiculaire commune ; un perçage et un bord → cote de pose et distance au bord du trou |
| **Face** | deux faces | deux plans parallèles → **épaisseur** (et si les normales s'opposent, c'est bien de la matière entre les deux) ; deux cylindres → **entraxe**, ⌀ et jeu ; un cylindre et un plan → hauteur d'axe et jeu sous la matière ; sinon → plus court chemin |

Ce qui est désigné est surligné : la nappe teintée et, surtout, le trait de son
contour — une teinte seule se confond avec la couleur de la pièce.

D'où viennent les faces :

- **STEP, IGES, BREP** : d'OpenCascade, qui donne pour chaque face du modèle
  d'origine l'intervalle de triangles qui en est sorti. C'est la topologie
  exacte — un cylindre coupé par sa couture reste une face, un congé tangent à
  un plan reste une face à part.
- **STL, OBJ, 3MF** : reconstruites par propagation, en s'arrêtant sur les plis
  vifs, au même angle que les arêtes d'affichage. Ce n'est pas la topologie
  d'origine — le format ne la porte pas — mais c'est ce que l'œil appelle une
  face. Changer l'angle des arêtes dans les réglages refait l'analyse.

L'analyse d'une pièce se fait au premier clic qui la vise, puis se garde. Au-delà
de 400 000 triangles sur une seule pièce, elle est refusée plutôt que de figer la
page : la mesure point à point reste disponible.

Les distances entre formes reconnues sont analytiques, donc exactes à la
triangulation près. Le repli « plus court chemin » entre deux surfaces qu'on ne
sait pas nommer — sphère, tore, carreau gauche — est calculé sur le maillage
d'affichage, et le texte le dit.

### Exporter
- **PNG** de la vue courante.
- **glTF binaire** (`.glb`) de la scène triangulée, pour une visionneuse tierce
  ou un moteur temps réel. Les arêtes d'affichage ne sont pas exportées.

---

## La souris — le vrai sujet d'une visionneuse

Personne n'apprend une nouvelle souris pour regarder un fichier : chacun arrive
avec les réflexes de son modeleur. Le bouton **🖱 Souris & vue…** donne donc la
convention complète d'une dizaine de logiciels, et la navigation lit cette table
plutôt que de coder un bouton en dur.

| Préréglage | Orbite | Panoramique | Zoom (glisser) |
| :--- | :--- | :--- | :--- |
| **Onshape** *(défaut)* | clic droit | Ctrl + droit, ou clic milieu | Maj + droit |
| **SolidWorks** | clic milieu | Ctrl + milieu | Maj + milieu |
| **Fusion 360 / Inventor** | Maj + milieu | clic milieu | Ctrl + milieu |
| **Tinkercad** | clic droit | clic milieu, ou Maj + droit | Ctrl + droit |
| **CATIA** | Ctrl + milieu | clic milieu | Maj + milieu |
| **Creo, NX, Blender** | clic milieu | Maj + milieu | Ctrl + milieu |
| **Solid Edge** | clic milieu | Ctrl + milieu | Maj + milieu |
| **Portable / pavé tactile** | clic gauche | Maj + gauche | Ctrl + gauche |
| **Personnalisé** | chaque geste se règle ligne à ligne | | |

Quel que soit le préréglage, **un clic gauche qui ne bouge pas sélectionne** :
ce qui distingue les deux gestes, c'est le déplacement, pas le bouton.

Deux orbites, au choix, comme dans les modeleurs qui posent la question :

- **Orbite libre** : le modèle roule dans toutes les directions, sans verticale
  imposée. Directe sur une pièce seule.
- **Orbite contrainte** : la verticale de la scène reste droite, comme un
  plateau tournant. On garde ses repères sur un grand assemblage, au prix de ne
  pas basculer par-dessus le pôle.

S'y ajoutent l'inversion de la molette, le zoom vers le curseur, l'inertie, le
mode pavé tactile (deux doigts = panoramique) et trois sensibilités séparées.
Tout est conservé dans le `localStorage` du navigateur.

---

## Qualité du maillage

La géométrie STEP est exacte ; l'affichage, lui, est triangulé par
OpenCascade. L'onglet *Qualité* règle le compromis, appliqué au prochain
fichier ouvert :

| Réglage | Rôle |
| :--- | :--- |
| Tolérance linéaire | écart maximal entre la surface exacte et la corde, exprimé en fraction de la diagonale de l'encombrement. 0,001 : maillage fin ; 0,01 : rapide mais facetté. |
| Tolérance angulaire | angle maximal entre deux facettes d'une surface courbe. |
| Unité de sortie | millimètre par défaut ; le fichier porte sa propre unité, celle-ci est celle du résultat. |

Les **arêtes vives** sont calculées à part, par seuil d'angle (25° par défaut).
Au-delà de deux millions de triangles, le calcul est ignoré — la barre d'état le
signale — sauf si l'option correspondante est cochée.

---

## Organisation des fichiers

```
WEB_3D/
├── index.html                    structure de la page et carte des imports
├── web_3D.py                     serveur statique (bibliothèque standard)
├── css/
│   └── visionneuse-3d.css        thème « dashboard nocturne », comme WEB_CAO
├── js/                           11 modules ES, chargés par 09-demarrage.js
├── exemples/                     fichiers d'essai, un par voie de lecture
└── vendor/                       bibliothèques, servies en local
    ├── three/                    three.js r186 + modules d'exemples (lecteurs
    │                              STL, 3MF, OBJ, MTL, export glTF, fflate)
    └── occt/                     occt-import-js 0.0.23 (+ occt-import-js.wasm)
```

| Fichier | Lignes | Rôle |
| :--- | ---: | :--- |
| `js/00-config.js` | 255 | préférences et **table des gestes de souris** : c'est elle que lit la navigation |
| `js/01-scene.js` | 523 | scène, deux caméras pour un même cadrage, éclairage, sol, modes d'affichage, plan de coupe |
| `js/02-import.js` | 486 | fichier → maillages : les six formats, hiérarchie, couleurs (y compris par face B-Rep), unités, arêtes vives |
| `js/03-navigation.js` | 455 | orbite (libre / contrainte), panoramique, zoom, tactile, inertie, animations de vue |
| `js/04-cube-vue.js` | 307 | cube de vues : 26 zones cliquables, triade, rendu dans son propre canevas |
| `js/05-arbre.js` | 386 | arbre d'assemblage, sélection, isolement, fiche de propriétés, volume et surface |
| `js/06-topologie.js` | 973 | **arêtes et faces sous les triangles** : soudure, régions, chaînes, reconnaissance des formes, formules de cotation |
| `js/07-mesure.js` | 471 | les trois modes de mesure : point, arête, face — désignation, surlignage, étiquettes |
| `js/08-interface.js` | 634 | barre d'outils, ouverture, dialogues de réglages, clavier |
| `js/09-demarrage.js` | 98 | assemblage des modules et branchements |
| `js/travailleur-occt.js` | 88 | le fil d'exécution qui appelle OpenCascade et renvoie des tableaux typés |

---

## Dépendances

Tout est servi depuis `vendor/`, rien n'est téléchargé à l'exécution.

| Bibliothèque | Version | Licence | Rôle |
| :--- | :--- | :--- | :--- |
| [three.js](https://threejs.org) | r186 | MIT | rendu WebGL, lecteurs STL / 3MF / OBJ / MTL, export glTF |
| [fflate](https://github.com/101arrowz/fflate) | livré avec three.js | MIT | décompression du 3MF (une archive ZIP) |
| [occt-import-js](https://github.com/kovacsv/occt-import-js) | 0.0.23 | MIT | OpenCascade en WebAssembly : lecture STEP / IGES / BREP |

Les textes de licence accompagnent les fichiers dans `vendor/three/` et
`vendor/occt/`. Côté `exemples/`, `assemblage-as1.stp`, `cube-conges.step` et
`surface-conique.step` proviennent du jeu d'essai de occt-import-js (MIT) et
des exemples publics du CAx Interoperability Forum ; `support.3mf`,
`support-pouces.3mf`, `equerre.obj` + `equerre.mtl` et `tetraedre.stl` ont été
fabriqués pour ce dépôt, un par voie de lecture.

## Navigateurs

Chrome, Edge, Firefox et Safari récents : la page utilise les modules ES avec
*import map*, WebGL 2, les `<dialog>` natifs et les évènements *pointer*.
Le noyau WebAssembly pèse 7,3 Mo — il n'est chargé qu'à la première ouverture
de fichier, puis réutilisé pour les suivants.

---

## Raccourcis

| Touche | Action |
| :--- | :--- |
| <kbd>Ctrl</kbd>+<kbd>O</kbd> | ouvrir un fichier |
| <kbd>F</kbd> | ajuster la vue au modèle, ou à la sélection |
| <kbd>O</kbd> | perspective ↔ orthographique |
| <kbd>A</kbd> / <kbd>W</kbd> / <kbd>X</kbd> / <kbd>G</kbd> | arêtes / filaire / rayons X / grille |
| <kbd>C</kbd> | plan de coupe |
| <kbd>K</kbd> | ouvrir / fermer la mesure |
| <kbd>M</kbd> | mode de mesure : point → arête → face |
| <kbd>I</kbd> / <kbd>H</kbd> | isoler la sélection / tout réafficher |
| <kbd>Suppr</kbd> | masquer la sélection |
| <kbd>1</kbd>…<kbd>7</kbd> | avant, arrière, gauche, droite, dessus, dessous, isométrique |
| <kbd>Échap</kbd> | effacer la mesure en cours, puis fermer l'outil, désélectionner, sortir de l'isolement |
