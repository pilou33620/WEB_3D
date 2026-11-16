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

Tout ce qui était faisable sur la liste de solidcraft est fait. Reste ce qui suit, avec la raison.

**Pas fait, limité par le noyau compilé** (`replicad_single.wasm` ; il faudrait recompiler OpenCascade) :

- Écriture IGES : l'écrivain n'est pas compilé.
- Suppression exacte d'une face (`BRepAlgoAPI_Defeaturing`, absente) : la face est bouchée et ses voisines ne sont pas prolongées, donc retirer un congé laisse une petite facette.
- Projection sur une surface : aucune classe de projection n'est compilée.
- Lissage de surface (fair) : `TColgp_Array2OfPnt` manque, et `GeomAPI_PointsToBSplineSurface` ne peut pas recevoir ses points.

**Limité : ça marche, mais pas partout**

- Gravure : plane, ou sur un cylindre. Le décalage d'un corps entier rend un volume nul sur les autres faces courbes.
- Décaler une face en ajoutant de la matière : faces planes et cylindriques seulement, même cause (la fusion de faces courbes coïncidentes rend un volume nul ; l'erreur est signalée).
- Remplacer une face : pour la prolonger jusqu'à la surface, la face doit être plane.
- Ellipse, conique et courbe par équation : ce sont des splines, leurs axes ne se cotent pas.
- Décalage lié : suit les lignes et les centres, pas le rayon d'un cercle.
- Chemin 3D : des points et des expressions, sans contraintes. Le solveur planegcs n'a ni contrainte de courbure (G2) ni esquisse 3D.
- Maillage converti : une seule section constante, en lignes, arcs et cercles. Une pièce à plusieurs niveaux est refusée ; on peut seulement y réunir les faces planes.
- Contacts et butées : lus sur des triangles qui se traversent. Deux corps de même section qui glissent exactement l'un dans l'autre n'en montrent pas.
- Études de mouvement : une loi ou une valeur par liaison, à chaque pas ; pas de solveur de mécanisme fermé.
- Voile : il faut que le milieu de ses lignes soit dans le vide du corps.
- URDF : refuse les liaisons cylindrique, plan et sphérique, qu'il ne sait pas dire.
- Rendu : celui de la vue (WebGL), ombres et occlusion ambiante comprises.

**Pas tenté**

- Accord de surfaces (match) : il faudrait une surface lissée de départ, voir ci-dessus.

**Écarté**

- Congé de surfaces : solidcraft ne l'a pas non plus (prévu chez lui).
- Lire FreeCAD et Rhino : solidcraft passe par cadmpeg, à intégrer à part.
- Envoyer au trancheur : une page ne lance pas un logiciel du poste ; exporter en 3MF.
- Atelier de rendu réaliste (lancer de rayons, HDRI, textures, lots de plans, environ 70 commandes) : trop lourd pour un Raspberry Pi sans GPU utile.
- Noyau et mailleur en Rust, interface egui, mises à jour, rapports de plantage, souris 3D, greffons, 3DEXPERIENCE : propres à l'application de solidcraft, sans objet ici.
