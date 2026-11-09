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

La visionneuse ne modifie aucun fichier ; à côté d'elle, le **mode conception**
(`conception.html`, voir *Concevoir une pièce*) dessine des pièces paramétriques.

---

## Installation

Il faut Python 3.8 ou plus, et git pour les mises à jour. Rien d'autre à installer : voir *Dépendances*.

| Système | Installer | Lancer |
| :--- | :--- | :--- |
| Raspberry Pi, Linux | `git clone https://github.com/pilou33620/WEB_3D.git` | `python3 web_3D.py` |
| Windows | le même `git clone` | double-clic sur `web_3D.py`, ou `python web_3D.py` |

Dans WEB·SUITE, le lanceur télécharge l'outil (`python lanceur/installer.py 3d`) et le démarre :
voir [son README](../README.md).

---

## Démarrage

**Double-cliquez sur `web_3D.py`** — ou, depuis un terminal :

```bash
python web_3D.py
```

Dans les deux cas le serveur démarre et la page s'ouvre seule sur
`http://127.0.0.1:8139/` (le port suivant si celui-ci est déjà pris). Le serveur
ne fait que servir et ranger des fichiers : il n'y a aucun calcul côté Python.

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
| `--local` | n'écouter que sur `127.0.0.1` (sans elle : réseau local, avec code d'appairage) |
| `--sans-navigateur` | ne pas ouvrir le navigateur au lancement |
| `--sans-pause` | ne pas attendre une touche à l'arrêt (fenêtre d'un double-clic sous Windows) |
| `--sans-maj` | ne pas vérifier les mises à jour au démarrage |
| `--dossier <chemin>` | servir un autre dossier |
| `--projets <chemin>` | dossier des projets, créé s'il manque : bouton **🗂 Projets…** (WEB·SUITE y passe `PROJETS/3D`) |

Un modèle peut aussi être ouvert directement par l'URL :
`http://127.0.0.1:8139/?modele=exemples/assemblage-as1.stp`.

Le serveur ne sert que les pages (`index.html`, `conception.html`, `regles-conception.md`,
`css/`, `js/`, `vendor/`, `exemples/`) et les fichiers 3D et leurs images posés dans le dossier :
ni `.git/`, ni le script, ni la liste des
fichiers ne sortent. Il refuse aussi un en-tête `Host` qui n'est ni une IP, ni
`localhost`, ni le nom du poste (DNS rebinding). Vérification :
`python test/banc-serveur.py`.

### Utiliser depuis un autre appareil

Sans `--local`, le serveur écoute aussi sur le réseau local ; lancé par WEB·SUITE, seulement
si le lanceur y écoute lui-même. L'adresse de la ligne `réseau` (et `tailscale`, s'il y en a
une) affichée au démarrage s'ouvre telle quelle
depuis une tablette : la navigation tactile (un doigt tourne, deux doigts
déplacent et pincent pour zoomer) est codée, mais pas encore essayée sur une
vraie tablette.

La première fois, la tablette demande un **code d'appairage** à 6 chiffres, affiché
dans le terminal du serveur (ou dans les logs de WEB_3D, dans WEB·SUITE).
Elle s'en souvient ensuite, pour tous les web tools de ce poste
(`appairage.py`, commun aux web tools). Le poste lui-même n'a jamais besoin de code.

En mode réseau, la connexion est **chiffrée (HTTPS)** quand la commande `openssl` est présente sur le poste (Raspberry Pi, Linux, macOS ; sous Windows, celle de Git) : une autorité propre au poste, créée une fois dans `~/.web_tools/tls/`, signe le certificat du serveur. Chaque appareil l'installe une fois, depuis le lien de la page du code (`/appairage/ca.pem`) ; sur iPad : Réglages › Profil téléchargé › Installer, puis Général › Informations › Réglages des certificats › activer. Comparer son empreinte SHA-256 avec celle du terminal. Sans `openssl` (ou avec `WEB_TOOLS_HTTP=1`), tout reste en HTTP et le terminal le dit.

### Où vivent les données

**Les projets.** Avec `--projets`, le bouton **🗂 Projets…** liste les modèles du dossier
(un clic les ouvre, un `.obj` avec son `.mtl`) et **Ranger le modèle ouvert ici** y copie le
fichier qu'on vient d'ouvrir — sans jamais en écraser un : un nom pris devient
`piece (2).stp`. Lancée par WEB·SUITE, la visionneuse pointe sur `PROJETS/3D`, que le
lanceur envoie sur GitHub à l'arrêt de l'outil : le modèle rangé sur un poste s'ouvre sur
l'autre. Le serveur ne lit et n'écrit que dans ce dossier, et seulement des modèles (`.glb` et
`.gltf` compris), ce qui accompagne un `.obj` (`.mtl`, images) et les pièces `.json` du mode conception.
Sans `--projets`, *Enregistrer* du mode conception télécharge le `.json`.

**Le navigateur.** Les préférences et le brouillon du mode conception restent dans le
`localStorage` de chaque appareil (`web3d.prefs`, `web3d.conception.brouillon`).

**Le poste.** `~/.web_tools/` garde le jeton du code d'appairage (`jeton-reseau.txt`) et l'autorité
HTTPS (`tls/`), communs aux web tools, et les copies de fichiers ouverts depuis le gestionnaire de
fichiers (`ouvrir/`).

### Mises à jour

Au démarrage, sauf `--sans-maj`, `web_3D.py` cherche une nouvelle version sur GitHub (`git fetch`,
10 s au plus) et, s'il y en a une, l'applique par `git pull --ff-only` puis se relance avec les mêmes
arguments. Un historique réécrit ou divergent est refusé, jamais fusionné. Des fichiers suivis modifiés
sont mis en réserve (`git stash`) puis réappliqués ; un conflit est signalé et ils restent dans la
réserve. Sans git, hors ligne ou après un échec, l'outil démarre avec la version actuelle. Sous WEB·SUITE,
le lanceur fait cette vérification à son démarrage et passe alors `--sans-maj` à l'outil.

### Bancs d'essai

Les exemples ont leur banc, sous Node et sans navigateur (`node test/banc-exemples.mjs`) :
les STEP passent par le vrai noyau OpenCascade de `vendor/occt/`, l'OBJ et le STL par les
lecteurs three.js, et l'équerre tournée d'`essai-mesure.obj` doit retrouver son repère
propre. Le canal de pilotage a le sien (`node test/banc-pilote-3d.mjs`) : les commandes
de la page 3D, sur une vraie scène. Le mode conception se vérifie sous Node
(`node test/banc-conception.mjs`, `banc-conception-plus.mjs`, `banc-pieces-reference.mjs`) et dans la
page, avec un Chromium sans écran : `node --experimental-websocket test/banc-conception-page.mjs`, de
même `banc-conception-plus-page.mjs` et `banc-conception-retours.mjs` (`CHROMIUM=` donne son chemin,
`/usr/bin/chromium` par défaut ; longs sur un Raspberry Pi : à lancer en arrière-plan). Ces huit bancs et
`test/banc-serveur.py` tournent sur GitHub à chaque envoi (`.github/workflows/ci.yml`). Restent à
lancer à la main : `node test/banc-conception-perf.mjs`, ainsi que `python appairage.py` et
`python pilote.py`, qui vérifient les modules communs.

---

## Ce que la page sait faire

### Ouvrir
- **Formats** : `.stp`, `.step`, `.igs`, `.iges`, `.brep` (OpenCascade),
  `.3mf`, `.obj`, `.stl`, `.glb` et `.gltf` (lecteurs three.js). Un `.stpz` (STEP compressé en
  gzip, sortie de NX ou CATIA) est décompressé par le navigateur puis lu comme
  un `.stp`.
- Glisser-déposer n'importe où dans la fenêtre, ou `Ctrl+O`. Plusieurs fichiers
  déposés ensemble composent un assemblage dans une même scène.
- **Depuis le gestionnaire de fichiers** : au premier démarrage, WEB_3D ajoute
  « Ouvrir avec WEB_3D » aux `.step` / `.stp` de l'utilisateur (refait seulement
  si le dossier a bougé ; `python3 ouvrir.py --associer` le force). Sous Linux il
  devient aussi l'application du double-clic ; sous Windows, choisir WEB_3D au
  premier double-clic puis « Toujours ». Le fichier est copié dans
  `~/.web_tools/ouvrir/` (copies retirées après un jour), servi au seul poste
  (`/ouvrir/…`), et WEB_3D démarre s'il le faut : par le lanceur de WEB_SUITE
  quand l'outil en fait partie, seul sinon. Il est seulement affiché :
  **Ranger** le garde dans les projets.
- Un `.obj` déposé **avec son `.mtl`** (et ses images de texture) garde ses
  matériaux : les chemins écrits dans le `.mtl` sont réécrits à la volée vers
  les fichiers réellement déposés, puisqu'aucun d'eux n'a d'adresse sur le
  serveur. Déposé seul, le `.mtl` n'est pas une erreur — simplement rien à
  afficher.
- Les unités sont ramenées au **millimètre** : le 3MF déclare la sienne
  (micron, centimètre, pouce, pied, mètre) et le facteur est appliqué au
  chargement. L'OBJ et le STL, eux, ne déclarent aucune unité : une unité de
  fichier y vaut un millimètre.
- La lecture des STEP, IGES et BREP se fait dans un *worker* : la page reste vivante pendant qu'un
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
- **Plan de coupe** (<kbd>C</kbd>) le long de X, Y ou Z, ou d'une face désignée sur le
  modèle : décalage au millimètre (curseur, saisie ou manipulateur à la souris),
  côté gardé inversable, vue alignée sur le plan.

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

<kbd>K</kbd> ouvre l'outil, <kbd>M</kbd> fait tourner les cinq modes (Auto par défaut).
On ne mesure pas des triangles : la visionneuse reconstruit d'abord les arêtes
et les faces du modèle, puis reconnaît ce qu'elles sont — une droite, un cercle,
un plan, un cylindre — et donne la cote qu'un mécanicien attend de ce couple-là.

| Mode | Ce qu'on désigne | Ce qu'on obtient |
| :--- | :--- | :--- |
| **Auto** *(défaut)* | un élément seul ou deux entités : approche d'un bord → arête, surface → face | clic unique : cercle complet → **diamètre ⌀**, arc → **rayon R**, arête → longueur. Deux entités : distance, **angle**, entraxe, épaisseur, hauteur d'axe |
| **Point** | deux points, accrochés aux sommets | distance, ΔX, ΔY, ΔZ |
| **Arête** | une arête ou deux arêtes | clic unique : cercle complet → **diamètre ⌀**, arc → **rayon R**, droite → longueur. Deux arêtes : perçages → **entraxe** de centre à centre et ⌀/R ; droites parallèles → écartement ; sécantes → angle ; perçage et bord → cote de pose |
| **Pièce** | une pièce ou deux pièces entières | une pièce : nom, triangles, encombrement, centre. Deux pièces : **distance minimale** entre les corps (0 au contact) |
| **Face** | une face ou deux faces | clic unique : cylindre → ⌀/R et hauteur, plan → aire. Deux faces : plans parallèles → **épaisseur** ; cylindres → **entraxe**, ⌀/R et jeu ; cylindre et plan → hauteur d'axe et jeu |

Ce qui est désigné est surligné : la nappe teintée et, surtout, le trait de son
contour — une teinte seule se confond avec la couleur de la pièce.

La cote reste posée sur la pièce ; le détail chiffré s'ouvre dans une
**fenêtre de résultats**, à la manière du panneau *Measure* de Fusion 360 :

- **Résultats** : les valeurs de la mesure (distance, écartement, entraxe,
  angle, jeu…), la position Min / Max / glissée, puis ΔX, ΔY, ΔZ.
- **Sélection 1**, **Sélection 2** : ce que l'on a désigné et ses propriétés —
  position X/Y/Z d'un point, longueur d'une arête, rayon, diamètre et centre
  d'un cercle, aire et normale d'une face plane, axe et hauteur d'un cylindre.

Entre deux arêtes droites non parallèles, la cote donne la plus courte distance
entre les arêtes réelles, bouts compris, et l'angle se lit sur un **arc** posé au
croisement de leurs **prolongements**, tracés en tirets. Si les arêtes ne sont
pas dans un même plan, l'arc se pose au pied de leur perpendiculaire commune,
tracée elle aussi, et la fenêtre donne l'écart entre les deux droites. Le même
tracé accompagne deux **plans sécants** (arc sur leur droite d'intersection) et
une **arête inclinée sur un plan** (arc au point de percée, entre l'arête et sa
projection sur le plan).

La distance entre **deux pièces entières** se calcule triangle contre triangle —
arête contre arête comprise, ce qui compte pour deux cylindres croisés — en ne
regardant que ce qui peut encore battre la meilleure distance trouvée : une
borne tirée d'un échantillon de sommets, une grille sur les triangles de la
seconde pièce, et l'arrêt dès qu'aucun triangle ne peut plus faire mieux.

La fenêtre se déplace par sa barre de titre (double-clic pour la remettre en
place) et chaque section se replie. La barre d'état ne garde que la consigne.

**Accroche du mode Point.** Le point tombe, par ordre de préférence, sur ce qui
est à moins de 14 pixels du curseur : un sommet de la pièce, le milieu d'une
arête, le centre d'un cercle ou d'un arc (même le curseur dans le trou), le
centre d'une face plane ; sinon sur l'arête la plus proche, sinon sur la
surface. Seuls les points visibles comptent : un coin au dos de la pièce
n'attrape pas le curseur. Les points proposés s'affichent en petits carrés, et
une étiquette dit sur quoi le clic tombera. <kbd>Maj</kbd> enfoncée : point
libre, sans accroche.

**Décomposition ΔXYZ** — quatre réglages, comme dans Fusion 360 :

| Réglage | Repère | L'escalier coloré part de |
| :--- | :--- | :--- |
| ⊘ | — (distance seule) | — |
| **1** | celui de la pièce de la sélection 1 | la sélection 1 |
| **2** | celui de la pièce de la sélection 2 | la sélection 2, et se déroule à rebours |
| **Global** *(défaut)* | celui du projet | la sélection 1 |

Les écarts sont **signés**, comptés de la sélection 1 vers la sélection 2.
OpenCascade livre la géométrie déjà placée dans l'assemblage : la rotation d'une
instance n'est pas conservée. Le repère d'une pièce est donc retrouvé par ses
**faces planes** — la normale de la plus grande direction plane, puis celle de
la plus grande qui lui est perpendiculaire — et une pièce posée droite retombe
exactement sur les axes du projet.

**Précision** : de 0 à 5 décimales. Les zéros de queue tombent jusqu'à deux
décimales (`2,00`, `63,64`, mais `58,693`) ; les angles gardent deux décimales.

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

### Concevoir une pièce (mode conception)
Le bouton **✏️ Conception** de l'en-tête ouvre `conception.html` : on y dessine une pièce
paramétrique, à la manière de [solidcraft](https://github.com/tangency-labs/solidcraft) dont la page
reprend l'organisation (ruban, historique, paramètres). Le thème, la souris, le cube de vues, la
mesure, la coupe, les collisions et la boîte **🖱 Souris & vue** sont ceux de la visionneuse ;
**◈ Visionneuse** y revient. La géométrie est exacte (B-Rep) : elle est calculée par OpenCascade
([replicad](https://replicad.xyz)) dans un fil d'exécution à part, dans le navigateur, hors ligne.

- **Disposition** — celle de solidcraft, aux couleurs de la suite : barre fine en haut (menu
  *Fichier*, enregistrer, annuler / refaire, nom de la pièce), atelier *Design* et ruban à onglets
  (Modèle, Surface, Assemblage, Insérer, Inspecter, Gérer, Affichage, Tôlerie, Plastique, Rendu,
  Soudures), dont chaque titre de groupe ouvre la liste de ses commandes (faute de place, le ruban passe sur une
  seconde rangée), et recherche de commandes (touche **S**) ; **navigateur** flottant (pièce, paramètres, origine et ses
  plans — un clic ouvre une esquisse dessus —, corps, esquisses avec leur œil, opérations) ;
  propriétés et panneau d'opération flottants à droite ; barre de navigation en bas au centre
  (orbite, ajuster, accueil, vues, projection, affichage) ; **frise d'historique** tout en bas.
- **Frise d'historique** — comme Fusion : une icône par opération, marqueur bleu à glisser pour
  revenir en arrière, ⏮ ◀ ▶ ⏭ pour rejouer pas à pas, double-clic pour modifier, glisser une icône
  pour réordonner (refusé si elle passerait avant l'esquisse dont elle dépend), clic droit pour
  renommer, suspendre, supprimer, placer le marqueur, créer un dossier ; dossiers repliables
  (Maj / Ctrl + clic pour choisir plusieurs opérations).
- **Plusieurs pièces** — une par onglet, en haut ; ⌂ ouvre la page d'accueil (nouvelle pièce, ouvrir,
  pièces récentes) ; les panneaux flottants se déplacent par leur titre.
- **Ruban MODÈLE** — *Esquisse* ; *Créer* : extrusion (un côté, symétrique, deux côtés), révolution,
  balayage, lissage, perçage (simple, lamé, fraisé, sur les points d'une esquisse), boîte, cylindre,
  sphère, cône, tore, tuyau, ressort, nervure, gravure (aussi sur un cylindre), voile (d'une paroi à l'autre), solide englobant, remplissage de frontière
  (le volume fermé par des corps et des surfaces, autour d'un point) ; *Modifier* : tirer une face (Press Pull), congé,
  chanfrein (arêtes désignées dans la vue, ou toutes), coque (faces retirées désignées), combiner,
  dépouille, découpe par un plan, échelle ; le congé peut évoluer d'un rayon à un autre, le chanfrein être dissymétrique ; décaler des faces (planes ou cylindriques), supprimer des faces (le trou se
  bouche, ou le corps devient une surface), remplacer une face par une surface (le corps s'y arrête, ou une face plane va la rejoindre), diviser un corps
  (plan de construction, lignes d'esquisse, surface) ou une face, retirer un corps ; *Disposer* : déplacer, miroir,
  répétition linéaire ou circulaire en une ou deux directions, répétition sur un chemin, aligner ; *Habiller* : apparence ;
  *Configurer* : paramètres ; *Construire* : plans décalés et inclinés. L'extrusion va
  à une distance ou jusqu'à une face ; on y coche ou on clique les contours à prendre, et une poignée se
  tire dans la vue pour régler la distance (extrusion, Tirer). Plans, axes et points de construction :
  décalés, médians, par trois points, par l'axe d'un cylindre ; les axes servent aux révolutions et répétitions. Le perçage propose les
  tailles M2 à M12 (taraudé ou passage) : le filetage est cosmétique, dessiné dans la vue, absent du
  volume et du STEP. Une esquisse sur une face peut la suivre quand la pièce change.
- **Surface** — extrusion, révolution, balayage, lissage, remplissage, surface réglée et raccord entre deux séries
  d'arêtes, en surfaces sans volume ; ajuster par un volume, prolonger, coudre (fermées : un volume), décaler, épaissir,
  inverser la normale, découdre (une surface par face), détourer (refermer les trous d'une face).
- **Assemblage** — composants de deux sortes : une autre pièce `.json` intégrée au fichier, ou un composant *dans* la pièce
  (navigateur : un clic l'active, ce qu'on crée y entre, le reste s'estompe ; œil ; clic droit pour renommer, y déplacer des
  opérations, en faire une nouvelle pièce, le dissoudre), occurrences qui suivent leur composant, liens à casser ou réassigner ;
  liaisons rigide, pivot, glissière, cylindrique, plan ou sphérique par une face de chaque corps, ou *telle quelle* (as-built : le corps reste où il est), limites
  basse et haute, liaison commandée par une autre selon une loi (`x * -0.5` pour un engrenage, `x / 360 * 2` pour une vis,
  `5 * sin(x)` pour une came), groupe rigide, ancrage, recherche des butées d'une liaison, jeux de contact, animation d'une liaison (sans modifier la pièce), éclaté et ses vues nommées ; **étude
  de mouvement** : plusieurs liaisons ensemble, trajectoire d'un corps tracée dans la vue, contacts cherchés à chaque pas et
  arrêt au premier, table en CSV, images en zip ; nomenclature en CSV (pièces identiques regroupées) ; export **URDF**
  (zip : le robot et ses maillages).
- **Tôlerie** — tôle plane (épaisseur, rayon, facteur K, ou une règle d'acier, d'alu ou d'inox), conversion d'une plaque
  déjà modélisée, bord tombé seul ou en chaîne, ourlet, pli le long d'une ligne, perforation (grille carrée ou en quinconce
  dans un contour) ; dépliage à l'écran, développé DXF (contour et lignes de pli sur leur calque), table de pliage en CSV.
- **Plastique** — bossage (fût percé, dépouille, nervures), lèvre et rainure pour fermer deux demi-coques, repos, clip
  (crochet flexible et son logement) ; une règle (paroi, dépouille, rayon) que le contrôle *Injection* vérifie.
- **Soudures** — profilés (tube carré ou rond, cornière, plat, poutre IPE 80 à 200) le long d'une ossature, coupés droits ou en
  onglet ; liste de débit en CSV.
- **Autres onglets** — *Insérer* : un STEP (référence pour dessiner autour, ou corps), un DXF ou un SVG comme
  esquisse, une image de référence sur un plan ou une face (décalque), à calibrer sur une longueur connue, à tracer en esquisse d'après ses contours, un maillage STL, OBJ, 3MF ou glTF (5000 triangles au plus ; ses triangles coplanaires peuvent ne faire qu'une face, et *Convertir* rend à une pièce de section constante sa vraie forme : une esquisse de lignes, d'arcs et de cercles, une extrusion, la hauteur en paramètre), un nuage de
  points XYZ, CSV, PTS ou PLY en texte (200 000 points gardés au plus), la visserie M2 à M12 (vis CHC, vis H, écrou,
  rondelle) ; *Inspecter* : mesure, centre de gravité, coupe, collisions, rayon minimal et jonctions tangentes ou vives
  tracées dans la vue, comparaison de deux corps, balayage d'un paramètre en CSV, zébrures, dépouille, courbure, reflets,
  isocourbes, accessibilité depuis +Z ; *Gérer* : paramètres (import et export CSV, favoris, commentaires, ce que chacun
  commande), table de configurations (valeurs et opérations suspendues), unités (les cotes acceptent `1in`, `2cm` ; l'unité
  choisie vaut pour les propriétés et le STEP), propriétés de la pièce, matériaux ajoutés, points de reprise (gardés
  jusqu'à la fermeture de la page), tout recalculer, script, réglages en fichier ; *Affichage* : regarder une face de
  face, rotation continue, styles, place des panneaux enregistrée, vues nommées, filtre de sélection (cliquer à travers une référence) ; *Rendu* : apparence d'un
  corps ou d'une face (bibliothèque et favoris, couleur, métal, rugosité, opacité, matériau physique par corps), tous les corps de même apparence, pinceau, remplacer partout, image PNG à la taille
  voulue sans les aides de construction, fond transparent, ombres et occlusion ambiante, toutes les vues enregistrées dans une archive.
- **Plans et axes** — en plus des décalés, médians et par trois points : un plan le long d'un chemin, tangent à un
  cylindre ou par deux arêtes, un axe perpendiculaire à une face ou par deux plans, un point au centre d'un cylindre ou à une
  intersection (axe et plan, trois plans), un chemin 3D par des points de l'espace, pour un tuyau ou un balayage. Ctrl+C et Ctrl+V copient des opérations
  (les renvois vers une opération copiée suivent la copie), Maj+R répète la dernière commande, le clic droit sur une
  opération montre ce qu'elle cite et ce qui s'appuie sur elle.
- **Sur téléphone** — mêmes outils, panneaux repliés d'entrée, ruban et frise qui défilent au doigt.
- **Ruban ESQUISSE** (pendant l'édition) — ligne (ou par son milieu), rectangle (deux coins, centré, trois points,
  arrondi), cercle (centre, deux ou trois points, tangent à deux ou trois courbes), arcs (dont tangent), polygone (inscrit,
  circonscrit, par une arête), oblong (trois façons), ellipse, conique, courbe par équation, point, spline, texte (DejaVu
  Sans), lignes de construction, bissectrice, tangente depuis un point, projection d'arêtes du modèle (qui suivent la pièce quand elle change ; *Délier* les fige), intersection du
  modèle avec le plan, courbe de raccord tangente, points de spline ajoutés ou retirés ; ajuster, prolonger, couper, décaler
  (libre ou lié à l'original), congé et chanfrein de coin (dissymétrique au besoin), échelle, déplacer ou copier
  (Ctrl+C, Ctrl+V), construction, suppression, plan ; miroir, répétitions ; cotes (longueur, distance, horizontale,
  verticale, rayon, diamètre, angle), pilotées au besoin, et contraintes (horizontale, verticale, coïncidence, parallèles,
  perpendiculaires, tangence, égalité, concentriques, milieu, symétrie, point sur, fixe, colinéaires), auto-contrainte ;
  bouts libres, peigne de courbure, DXF de l'esquisse ; résolues
  par le solveur de FreeCAD (planegcs). Les points accrochés sont partagés : les contours se ferment
  seuls. Un cercle dans un rectangle est un trou.
- **Paramètres** — `L = 40`, puis `L/2`, `2*e + 1`, `sqrt(L^2 + l^2)` dans n'importe quelle cote.
  Changer un paramètre reconstruit toute la pièce ; seules les opérations touchées sont refaites.
- **Historique** — modifier (✎ ou double-clic), suspendre, supprimer, placer le curseur ; une
  opération en échec est marquée ⚠ avec la raison, la suite se construit sans elle.
- **Propriétés** — volume, surface, masse selon le matériau (PLA, PETG, aluminium, acier…),
  centre de gravité, encombrement.
- **Fichiers** — la pièce est un `.json` (la recette, rouvrable et modifiable) rangé dans le dossier
  des projets : *Enregistrer* remplace le fichier ouvert, *Enregistrer sous…* ne remplace jamais.
  Un brouillon est gardé dans le navigateur. Export **STEP** (exact), **STL**, **3MF** et **OBJ** des corps visibles, et **DXF de la vue** (arêtes vues et cachées sur leurs calques).
  Dans *🗂 Projets…* de la visionneuse, une pièce `.json` s'ouvre dans la conception.

**Solidité.** Une arête ou une face désignée est retrouvée par sa description (nature, direction, faces
voisines, angle rentrant ou saillant, place relative) : elle suit les changements de cotes, et une référence
disparue s'annonce en erreur au lieu de viser sa voisine. Une panne du noyau (mémoire, plantage) relance un
noyau neuf, le document intact, et suspend l'opération en cause ; un calcul de plus de 20 s peut être arrêté ;
le noyau est recyclé au repos quand son tas devient trop grand. Les composants et les STEP pris dans le dossier
des projets restent liés à leur fichier (une carte de WEB_CAO, par exemple) : *⟳ Mettre à jour* s'allume quand
il a changé. Le filetage peut être modélisé pour l'impression 3D, avec un jeu réglable (calcul d'environ 30 s
sur un Raspberry Pi pour un M8 × 20).

**Désigner et mesurer.** Pendant une désignation, l'arête ou la face que le clic prendrait se surligne au
survol, et ce qui est désigné reste tracé en entier. Le clic prend l'arête la plus proche du curseur, et jamais
une arête cachée par la matière. La mesure lit les plans et les cylindres sur le noyau (axe, normale et rayon
exacts) au lieu de les ajuster sur le maillage ; un cylindre debout sur un plan donne la distance de son bout.
Le plus court chemin entre plans, cylindres, cercles et droites se recale sur leur vraie forme, et ne garde la
valeur du maillage que là où la forme réelle s'arrête. La cote « Max » reste calculée sur les sommets du maillage.
L'affichage compte au moins 24 facettes par tour, avec une tolérance quatre fois plus fine que pour un fichier
ouvert (réglage *Qualité*), et son maillage ne dépend que de la géométrie ; l'export STL
est plus fin (0,01 mm).

**Sélection.** Un clic dans la vue prend la **face** sous la souris : elle se teinte et sa fiche (aire, normale ou
diamètre) s'ajoute aux propriétés. Le corps entier se prend dans le navigateur, ou d'un clic en décochant le filtre
*Faces*. *Esquisse* se pose sur la face choisie ; le panneau d'une esquisse ouvert prend la face plane qu'on clique.
L'historique nomme chaque opération par sa fonction et son nom : un nom donné « Cabine » s'affiche *Boîte-Cabine*.

**Règles de conception.** `regles-conception.md` (lien *Règles* de la barre du haut) est le seul texte des règles à suivre pour concevoir une pièce : le MCP de web_suite le lit par `savoir_lire` (fiche `conception-3d`), et un raccourci de Claude in Chrome renvoie à ce lien. Le bouton *Règles* de l'onglet Inspecter contrôle ce qu'un programme peut vérifier (esquisses contraintes, noms des paramètres, grille FDM), comme `W3D.conception.controlerRegles(procede)` et l'outil MCP `web3d_regles`. La page est aussi pilotable par le MCP (`pilote_interface`, page `conception`).

**Écrire une pièce par script.** `W3D.conception` est accessible depuis la page :
- `schema(type)` rend les champs d'une opération et un exemple rempli ; les types sont les clés de `TYPES`
  (`js/c3-operations.js`) ;
- `aretes()` et `faces()` listent ce que montre la vue : leur `point` est ce qu'on met dans `op.aretes` et
  `op.faces` (congé, chanfrein, coque…) ;
- `ajouterOperation(type, champs)` crée une opération comme le ruban (mêmes valeurs par défaut, mêmes réglages,
  une étape d'annulation), refuse un champ inconnu et rend `{ op, erreur }` ;
- `ajouterEsquisse({ nom, plan, primitives, contraintes })` crée une esquisse : primitives `{ type:"ligne", a, b }`,
  `arc` (`a, m, b`), `cercle` (`c, r`), `point` (`a`), `spline` (`pts`), `texte` (`p, contenu, h`) ; `contraintes` peut
  être une fonction qui reçoit les éléments créés pour citer leurs identifiants ;
- `ouvrirOnglet(doc, null, false)` ouvre une pièce, et refuse un document mal formé ou contenant des fonctions ;
- `enregistrer(true, "nom")` enregistre sans poser de question.

Une esquisse est `{ type:"esquisse", plan:{ base:"XY", decalage:"0" }, elements, contraintes }`. Ses éléments sont
`{ type:"point", x, y }`, `{ type:"ligne", p1, p2 }`, `{ type:"cercle", c, r }`, `{ type:"arc", c, p1, p2 }` (son rayon se déduit de ses points),
`{ type:"spline", pts }` et `{ type:"texte", p, contenu, h }`, où `p1`, `c`, `pts`… sont des identifiants de points. Un point fixé (`{ type:"fixe", a, x, y }`) accepte des expressions
qui citent les paramètres ; dans l'interface, un double-clic sur la contrainte les règle.

Limites connues : une ellipse, une conique ou une courbe par équation sont des splines : leurs axes ne se cotent pas.
La face supprimée est bouchée, pas refaite en prolongeant ses voisines : retirer un congé laisse une petite facette.
Décaler ajoute de la matière sur une face plane ou cylindrique seulement. Un décalage lié suit les lignes et les centres, pas le
rayon d'un cercle. Un chemin 3D n'a pas de contraintes : des points et des expressions. Une occurrence recopie les corps nés dans son composant. Le rendu est celui de la vue (WebGL, sans lancer de rayons). Contacts et butées se lisent sur des triangles qui se traversent : deux corps de même section qui glissent exactement l'un dans l'autre n'en montrent pas. Les études n'ont pas de
solveur : une loi ou une valeur par liaison, à chaque pas. Une esquisse ne coupe pas ses profils qui se croisent (un contour par boucle, ajuster
d'abord) ; deux éléments identiques et symétriques peuvent s'échanger si la pièce change beaucoup (ce n'est
pas un nommage topologique du noyau). Le développé d'une tôle ne vaut que pour des plis partant de la tôle de
base ; un pli oblique garde une couronne à bouts droits. Les liaisons se résolvent une à une, dans l'ordre
de l'historique : pas de solveur de mécanisme fermé ; l'URDF refuse les liaisons cylindrique, plan et sphérique, qu'il ne sait pas dire. Sans lien (composant ou STEP pris depuis un fichier), une
pièce insérée ne suit pas l'original.

### Exporter
- **PNG** de la vue courante.
- **glTF binaire** (`.glb`, en mètres comme le veut le format) de la scène triangulée, pour une visionneuse tierce
  ou un moteur temps réel. Les arêtes d'affichage ne sont pas exportées.
- **STEP** (`.stp`) d'une pièce ou d'une sélection d'un assemblage STEP, extraite du
  fichier d'origine : la géométrie exacte (B-Rep) est reprise telle quelle, sans
  passer par les triangles.
- **Ranger dans le projet** (`#bRangerPiece`, avec son champ de nom, dans le même dialogue, lancé avec
  `--projets`) : le STEP d'une seule pièce va dans PROJETS, toujours en `.stp`. Un nom pris devient
  « x (2) » et le message le dit : rien n'est écrasé.

### Se laisser piloter par Claude
La page reçoit les ordres de Claude par le MCP de web_suite (canal de pilotage,
`js/pilote.js` et `pilote.py`). Elle porte, en bas à droite, un panneau **« Claude »** : on le glisse par sa tête, × le réduit en pastille
« Claude » qu'un clic rouvre (il revient aussi dès que Claude propose une modification).

On peut aussi lui écrire **depuis la page**, sur n'importe quel appareil : la zone
« Demander à Claude » du panneau passe la demande, par WEB·SUITE, à Claude Code du
poste des outils, avec ses pièces jointes éventuelles : images, captures (« Vue »), PDF,
fichiers texte, avec le modèle choisi (Opus, Sonnet, Haiku) ; une ligne d'état dit à chaque
ouverture si Claude Code est prêt (`lanceur/docs/SPEC-claude-pages.md` de web_suite).

| Genre | Commandes | Ce qui se passe |
| :--- | :--- | :--- |
| Lectures | `web3d_projets`, `web3d_scene`, `web3d_mesurer`, `web3d_collisions`, `web3d_regles` | réponse directe ; `web3d_projets` : la liste de la page, sans les annexes ; `web3d_regles` : le bouton *Règles* de la page de conception ; `web3d_mesurer` : `dimensions` exige `piece` ou `fichier`, volume et surface jusqu'à 800 000 triangles comme la fiche, distance et faces refusent une pièce masquée, la cote part avec « Effacer la mesure » et à la fermeture ; `web3d_collisions` avec `afficher` : les courbes, et la tolérance écrite dans les préférences, comme le champ |
| Directes | `web3d_vue`, `web3d_visibilite`, `web3d_coupe` | appliquées tout de suite : vue, œil, plan de coupe — rien du fichier ; la projection s'écrit dans les préférences et `#selProjection`, comme le bouton ; une coupe sur une face refuse une pièce masquée |
| En carte | `web3d_ouvrir` | une carte avant → après, Appliquer ou Refuser ; elle s'annule par la carte |
| Gestes | `pilote_interface` | tout le reste, comme l'utilisateur : déplacer (`#bDeplacer`), exporter une pièce (`#bExportPiece`), ranger son STEP (`#bRangerPiece`) |

L'interrupteur « Appliquer directement (cet onglet) » saute la carte ; il est éteint à
chaque chargement. Le détail du panneau est dans `web_suite/lanceur/docs/DETAILS.md`
(*Le panneau « Claude »*), celui des commandes dans
`web_suite/lanceur/docs/SPEC-mcp-registre-3d.md`.

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

Le fichier porte sa propre unité ; OpenCascade le ramène toujours au millimètre,
l'unité de toute la visionneuse (cotes, coupe, collisions).

Les **arêtes vives** sont calculées à part, par seuil d'angle (25° par défaut).
Au-delà de deux millions de triangles, le calcul est ignoré — la barre d'état le
signale — sauf si l'option correspondante est cochée.

---

## Organisation des fichiers

```
WEB_3D/
├── index.html                    structure de la page et carte des imports
├── conception.html               la page du mode conception
├── regles-conception.md          les règles de conception d'une pièce, lues par le MCP (`savoir_lire`) et Claude in Chrome (lien Règles)
├── web_3D.py                     serveur de la page et des projets
├── ouvrir.py                     ouvrir un .step depuis le gestionnaire de fichiers
├── pilote.py                     canal de pilotage, côté serveur (copie de web_suite)
├── appairage.py                  code d'appairage des tablettes (copie commune aux web tools)
├── css/
│   ├── visionneuse-3d.css        thème « dashboard nocturne », comme WEB_CAO
│   ├── conception.css            ruban, historique, esquisse (mêmes variables de thème)
│   ├── pilote.css                panneau « Claude » (copie de web_suite)
│   └── telephone.css             disposition sur petit écran (copie de WEB_CAO)
├── js/                           modules ES, chargés par 09-demarrage.js ou c6-conception.js
├── exemples/                     fichiers d'essai, un par voie de lecture
├── test/                         bancs d'essai : exemples, pilotage, serveur, conception
└── vendor/                       bibliothèques, servies en local
    ├── three/                    three.js r186 + modules d'exemples (lecteurs
    │                              STL, 3MF, OBJ, MTL, glTF, export glTF, fflate, occlusion ambiante)
    ├── occt/                     occt-import-js 0.0.23 (+ occt-import-js.wasm)
    ├── replicad/                 replicad 1.2.0 + replicad-opencascadejs 1.1.0 (mode conception)
    ├── planegcs/                 @salusoft89/planegcs 1.3.0, solveur d'esquisse de FreeCAD
    └── polices/                  DejaVu Sans, pour le texte des esquisses
```

| Fichier | Rôle |
| :--- | :--- |
| `js/00-config.js` | préférences et **table des gestes de souris** : c'est elle que lit la navigation |
| `js/01-scene.js` | scène, deux caméras pour un même cadrage, éclairage, sol, modes d'affichage, plan de coupe |
| `js/02-import.js` | fichier → maillages : les sept formats, hiérarchie, couleurs (y compris par face B-Rep), unités, arêtes vives |
| `js/03-navigation.js` | orbite (libre / contrainte), panoramique, zoom, tactile, inertie, animations de vue |
| `js/04-cube-vue.js` | cube de vues : 26 zones cliquables, triade, rendu dans son propre canevas |
| `js/05-arbre.js` | arbre d'assemblage, sélection, isolement, fiche de propriétés, volume et surface |
| `js/06-topologie.js` | **arêtes et faces sous les triangles** : soudure, régions, chaînes, reconnaissance des formes, formules de cotation, repère propre d'une pièce, points d'accroche, distance entre pièces |
| `js/07-mesure.js` | les modes de mesure (auto, point, arête, face, pièce) — accroche, désignation, surlignage, étiquettes, ΔXYZ, fenêtre de résultats |
| `js/07b-coupe.js` | coupe selon X, Y, Z ou une face désignée sur le modèle, avec son manipulateur et son panneau |
| `js/08-interface.js` | barre d'outils, ouverture, dialogues de réglages, clavier |
| `js/09-demarrage.js` | assemblage des modules et branchements |
| `js/10-export-step.js` | réexport STEP d'une pièce isolée ou d'une sélection, extraite du fichier d'origine |
| `js/11-projets.js` | le dossier des projets : liste, ouverture, rangement du modèle ouvert |
| `js/12-collisions.js` | interférences entre fichiers ouverts (« Ajouter… » puis « 💥 Collisions ») : triangles qui se traversent, courbe d'intersection en rouge |
| `js/13-deplacement.js` | « ✥ Déplacer » (D) : un fichier entier, à la souris (glisser une pièce, Maj : à la verticale), au clavier (mm, °), ou par contrainte (deux plans plaqués avec décalage, deux cylindres coaxiaux) |
| `js/14-pilote-3d.js` | les commandes du MCP pour la page 3D (`brancherPilote3d`) : scène, vue, visibilité, coupe, mesure, collisions, et en carte ouvrir |
| `js/pilote.js` | canal de pilotage côté page : relais entre onglets, panneau « Claude », cartes, interrupteur. **Copie** de `web_suite/lanceur/pilote.js`, à ne pas modifier ici |
| `pilote.py` | canal de pilotage côté serveur : file des commandes, long-poll, ordres du MCP acceptés de ce poste seulement. Copie de `web_suite/lanceur/pilote.py` |
| `appairage.py` | le code à 6 chiffres qui ouvre l'accès réseau à une tablette ; un seul jeton pour tous les web tools du poste. Copie commune aux web tools |
| `ouvrir.py` | « Ouvrir avec WEB_3D » : copie le `.step` dans `~/.web_tools/ouvrir/`, démarre WEB_3D s'il le faut, ouvre la page ; `--associer` inscrit l'application |
| `js/telephone.js` | disposition de la visionneuse sur un petit écran. **Copie** de `WEB_CAO/commun/telephone.js` |
| `test/` | `banc-exemples.mjs`, `banc-pilote-3d.mjs`, `banc-serveur.py`, `banc-conception.mjs` (expressions, solveur, opérations sur le noyau), `banc-pieces-reference.mjs` (de vraies pièces comparées à leur volume calculé, avant et après un changement de paramètres, avec des points témoins), `banc-conception-page.mjs` (la page dans un Chromium sans écran, avec de vrais gestes, `node --experimental-websocket` ; `CAPTURES=dossier` y dépose des captures), `banc-conception-retours.mjs` (désignation, mesure, boîtes de question, cube, maillage, échec de construction, script ; même lancement ; lancement commun dans `harnais-page.mjs`), `banc-conception-plus.mjs` (commandes ajoutées, sur le noyau, valeurs calculées à la main) et `banc-conception-plus-page.mjs` (les mêmes, par les vrais boutons) — ceux que lance la CI — et `banc-conception-perf.mjs` (temps et mémoire sur une grosse pièce, à la main) |
| `js/travailleur-occt.js` | le fil d'exécution qui appelle OpenCascade et renvoie des tableaux typés |
| `js/c1-expressions.js` | conception : paramètres et expressions des cotes (analyseur maison, jamais `eval`) |
| `js/c2-esquisse.js` | conception : modèle d'esquisse, traduction pour le solveur planegcs, contours et trous, import DXF / SVG |
| `js/c3-operations.js` | conception : les opérations, rejouées sur replicad, avec cache de l'historique |
| `js/c4-travailleur.js` | conception : le fil d'exécution du noyau (reconstruction, maillage, masse, export STEP / STL) |
| `js/c5-esquisse-ui.js` | conception : l'éditeur d'esquisse dans la vue (outils, accrochage, glisser, contraintes, cotes) |
| `js/c6-conception.js` | conception : démarrage de la page, ruban et recherche de commandes, navigateur, menus, panneau d'opération, paramètres, fichiers |
| `js/c3c-references.js` | conception : retrouver une arête ou une face désignée quand la pièce a changé |
| `js/c3b-ateliers.js` | conception : surface, assemblage, tôlerie, soudures, visserie, maillages |
| `js/c3d-operations-plus.js` | conception : solides et surfaces ajoutés, plastique, conversion et perforation de tôle ; analyses (rayons, jonctions, comparaison, coupe, arêtes vues) |
| `js/c2c-esquisse-plus.js` | conception : tracés et outils d'esquisse ajoutés (ellipse, équation, polygones, prolonger, couper, échelle, auto-contrainte, bouts libres, copier-coller) |
| `js/c11-plus-ui.js` | conception : champs des opérations ajoutées, apparences, rendu, études de mouvement, exports, points de reprise |
| `js/c12-exports.js` | conception : OBJ, 3MF, URDF, DXF, nomenclature, nuage de points, copie d'opérations ; sans écran, vérifiés sous Node |
| `js/c9-ateliers-ui.js` | conception : champs et désignations des ateliers, poignée, animation, éclaté, développé, aides dessinées |
| `js/c2b-outils-esquisse.js` | conception : ajuster, décaler, congé et chanfrein de coin, miroir, répétitions |
| `js/c10-regles.js` | conception : le contrôle des règles vérifiables (esquisses contraintes, noms des paramètres, grille FDM) |
| `js/c8-analyses.js` | conception : zébrures, dépouille et courbure, par un matériau à nuanceur |
| `js/c0-dialogues.js` | conception : les boîtes de question du thème, à la place de `prompt()`, `confirm()` et `alert()` |
| `js/c7-frise.js` | conception : la frise d'historique (marqueur, lecture, réordonner, dossiers, clic droit) et ses règles |

---

## Dépendances

Tout est servi depuis `vendor/`, rien n'est téléchargé à l'exécution. Côté serveur, `web_3D.py`
n'utilise aujourd'hui que la bibliothèque standard de Python : pas de `requirements.txt`.

| Bibliothèque | Version | Licence | Rôle |
| :--- | :--- | :--- | :--- |
| [three.js](https://threejs.org) | r186 | MIT | rendu WebGL, lecteurs STL / 3MF / OBJ / MTL / glTF, export glTF |
| [fflate](https://github.com/101arrowz/fflate) | livré avec three.js | MIT | archive ZIP du 3MF (lecture et export) |
| [occt-import-js](https://github.com/kovacsv/occt-import-js) | 0.0.23 | LGPL-2.1 | OpenCascade en WebAssembly : lecture STEP / IGES / BREP |
| [replicad](https://replicad.xyz) | 1.2.0 | MIT | modélisation B-Rep du mode conception |
| [replicad-opencascadejs](https://github.com/sgenoud/replicad) | 1.1.0 | LGPL-2.1 | OpenCascade en WebAssembly pour replicad |
| [planegcs](https://github.com/Salusoft89/planegcs) | 1.3.0 | LGPL-2.0 ou ultérieure (texte livré : LGPL-2.1) | solveur de contraintes d'esquisse de FreeCAD, en WebAssembly |
| [DejaVu Sans](https://dejavu-fonts.github.io) | paquet Debian fonts-dejavu-core | licence libre DejaVu (voir `vendor/polices/`) | police du texte des esquisses |

Les textes de licence accompagnent les fichiers dans `vendor/three/`,
`vendor/occt/`, `vendor/replicad/` et `vendor/planegcs/`. Les modules WebAssembly sous LGPL
(`replicad_single.wasm`, `planegcs.wasm`) sont, comme celui d'occt-import-js, des fichiers à
part, non modifiés et remplaçables. occt-import-js et OpenCascade sont sous **LGPL-2.1** : leurs
sources sont celles des dépôts liés ci-dessus (version 0.0.23, non modifiée), et
le module reste un fichier à part (`vendor/occt/occt-import-js.wasm`) qu'on peut
remplacer par une autre version sans toucher au reste de la visionneuse. Côté `exemples/`, `assemblage-as1.stp`, `cube-conges.step` et
`surface-conique.step` proviennent du jeu d'essai de occt-import-js (LGPL-2.1) et
des exemples publics du CAx Interoperability Forum ; `support.3mf`,
`support-pouces.3mf`, `equerre.obj` + `equerre.mtl` et `tetraedre.stl` ont été
fabriqués pour ce dépôt, un par voie de lecture. `essai-mesure.obj` sert à
éprouver la mesure : une plaque droite percée d'un trou traversant ⌀12 (accroche
au centre, curseur dans le vide) et une équerre tournée de 30° autour de Z puis
12° autour de Y, rotation figée dans les sommets comme après un import STEP —
entre ses coins opposés, les réglages ΔXYZ 1 et 2 doivent donner 40 × 30 × 6.

## Navigateurs

Chrome, Edge, Firefox et Safari récents : la page utilise les modules ES avec
*import map*, WebGL 2, les `<dialog>` natifs et les évènements *pointer*.
Le noyau WebAssembly de la visionneuse pèse 7,3 Mo — il n'est chargé qu'à la première ouverture
d'un STEP, IGES ou BREP, puis réutilisé pour les suivants, sauf après un fichier de plus de
30 Mo ou un échec : le suivant recharge alors un noyau neuf.

---

## Raccourcis

| Touche | Action |
| :--- | :--- |
| <kbd>Ctrl</kbd>+<kbd>O</kbd> | ouvrir un fichier |
| <kbd>F</kbd> | ajuster la vue au modèle, ou à la sélection |
| <kbd>O</kbd> | perspective ↔ orthographique |
| <kbd>A</kbd> / <kbd>W</kbd> / <kbd>X</kbd> / <kbd>G</kbd> | arêtes / filaire / rayons X / grille |
| <kbd>C</kbd> | plan de coupe |
| <kbd>D</kbd> | déplacer un fichier (« ✥ Déplacer ») |
| <kbd>T</kbd> | thème clair ↔ sombre |
| <kbd>K</kbd> | ouvrir / fermer la mesure |
| <kbd>M</kbd> | ouvrir la mesure s'il le faut, puis mode suivant : auto → point → arête → face → pièce |
| <kbd>I</kbd> / <kbd>H</kbd> | isoler la sélection / tout réafficher |
| <kbd>Suppr</kbd> | masquer la sélection |
| <kbd>1</kbd>…<kbd>7</kbd> | avant, arrière, gauche, droite, dessus, dessous, isométrique |
| <kbd>Échap</kbd> | annuler le choix d'une face de coupe ou une contrainte de déplacement, effacer la mesure en cours, puis fermer l'outil, sortir de l'isolement, désélectionner |
