# À faire — fonctionnalités et bugs

Ce qui reste à coder dans WEB_3D, au 05/11/2026 : nouvelles fonctionnalités et bugs, rien
d'autre (les essais sont repoussés à plus tard).

## Bugs

Aucun bug connu ouvert. Le dernier (un STL corrompu rendait l'erreur brute du lecteur au lieu du
message de la page) est corrigé depuis le 21/10/2026.

## Fonctionnalités

Côté pilotage par Claude (MCP), les fonctionnalités possibles sont listées dans
[l'A-FAIRE de web_suite](https://github.com/pilou33620/web_suite/blob/main/A-FAIRE.md).

### Écart restant avec solidcraft (relevé du 05/11/2026)

**Faisable, pas encore fait :**

- Esquisse : esquisses 3D, contrainte de courbure (G2), courbe de raccord, projection sur une surface, décalage et projection
  qui restent liés à leur source, ajout ou retrait d'un point de spline, chanfrein de coin dissymétrique.
- Solides : vraie gravure sur une face courbe (la gravure actuelle part d'un plan), décaler en ajoutant de la matière sur
  une face autre que plane ou cylindrique, remplacer une face en prolongeant le corps, voile arrêté aux parois.
- Surfaces : lissage (fair), accord (match), congé de surfaces, retour à la surface d'origine au-delà du contour.
- Construction : plan par deux arêtes, axe par deux plans, points d'intersection (arête et plan, deux arêtes, trois plans).
- Assemblage : composants à l'intérieur d'une pièce (éditer sur place, déplacer corps et opérations entre composants, occurrences,
  remplacer ou réassigner un lien), jeux de contact nommés, chercher les limites d'une liaison, liaison sphérique, vues éclatées nommées.
- Apparences : pinceau, favoris, sélection par apparence, remplacer une apparence partout. Calque de référence (canvas) : calibrer,
  décalque, image vers esquisse.
- Fichiers : maillage vers solide paramétrique (mesh.convert), plusieurs brouillons à récupérer, bibliothèque de pièces.
- Interface : dispositions de panneaux enregistrées, styles d'affichage nommés, occlusion ambiante, onglets au clavier.

**Écarté, avec la raison :**

- Écrire de l'IGES : l'écrivain n'est pas compilé dans le noyau `replicad_single.wasm`, comme la suppression de face exacte
  (`BRepAlgoAPI_Defeaturing`). Il faudrait recompiler OpenCascade.
- Lire FreeCAD et Rhino : solidcraft passe par cadmpeg, à intégrer à part.
- Envoyer au trancheur : une page ne lance pas un logiciel du poste ; exporter en 3MF.
- Atelier de rendu réaliste (lancer de rayons, HDRI, textures, lots de plans, environ 70 commandes) : trop lourd pour un
  Raspberry Pi sans GPU utile. Reste le rendu WebGL de l'onglet Rendu.
- Noyau et mailleur en Rust, interface egui, mises à jour, rapports de plantage, souris 3D, greffons, 3DEXPERIENCE : propres à
  l'application de solidcraft, sans objet ici.
