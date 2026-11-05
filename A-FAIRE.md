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

- Projection d'arêtes qui reste liée à sa source : les points projetés sont fixés à leur place du moment. Il faudrait que le noyau
  renvoie leur nouvelle position à la page à chaque reconstruction.
- Sélectionner tous les corps de même apparence : l'arbre ne sélectionne qu'un corps à la fois.
- Conversion d'un maillage en vrai solide paramétrique (cylindres reconnus, cotes) : aujourd'hui les faces planes sont seulement réunies.

**Écarté, avec la raison :**

- Absent du noyau compilé `replicad_single.wasm`, il faudrait recompiler OpenCascade : écriture IGES ; suppression de face exacte
  (`BRepAlgoAPI_Defeaturing`) : la face est bouchée, pas refaite ; projection sur une surface (aucune classe de projection) ;
  lissage de surface (`TColgp_Array2OfPnt`, sans quoi `GeomAPI_PointsToBSplineSurface` ne reçoit pas ses points).
- Booléens du noyau : décalage d'un corps entier et ajout sur une face coïncidente rendent un volume nul sur les faces courbes. D'où la
  gravure limitée aux cylindres, et l'ajout de matière aux faces planes et cylindriques.
- Contrainte de courbure (G2) et esquisses 3D contraintes : le solveur planegcs n'a ni l'une ni les autres ; le chemin 3D en tient lieu, sans contraintes.
- Accord de surfaces (match) : pas tenté, faute de pouvoir lui donner une surface de départ lissée. Congé de surfaces : solidcraft ne l'a pas non plus (prévu chez lui).
- Lire FreeCAD et Rhino : solidcraft passe par cadmpeg, à intégrer à part.
- Envoyer au trancheur : une page ne lance pas un logiciel du poste ; exporter en 3MF.
- Atelier de rendu réaliste (lancer de rayons, HDRI, textures, lots de plans, environ 70 commandes) : trop lourd pour un
  Raspberry Pi sans GPU utile. Reste le rendu WebGL de l'onglet Rendu.
- Noyau et mailleur en Rust, interface egui, mises à jour, rapports de plantage, souris 3D, greffons, 3DEXPERIENCE : propres à
  l'application de solidcraft, sans objet ici.
