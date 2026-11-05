VOCABULAIRE DE LA PAGE DE CONCEPTION DE WEB_3D

Les règles parlent de fonctions de CAO en général. Dans la page, elles portent ces noms :

| Dans les règles | Dans la page |
|---|---|
| Fonction Trou | Perçage |
| Réseau rectangulaire ou circulaire | Répétition (corps) ; Répétition rectangulaire ou circulaire (esquisse) |
| Symétrie d'un corps | Miroir |
| Diviser le corps | Découpe : un corps coupé en deux par un plan |
| Bride | Bord tombé |
| Ancre fixée | Ancrage |

Ce que la page ne fait pas à l'identique : l'annoncer dans le plan (règle 4), avec l'adaptation retenue.
- Composant : deux sortes. Un composant dans la pièce (onglet Assemblage, Nouveau) range ses esquisses, plans et corps tant qu'il est actif ; une autre pièce du mode conception s'insère aussi comme Composant. La racine ne se vide pas d'elle-même : y déplacer les opérations par le clic droit du composant.
- Occurrence : fonction Occurrence, qui recopie et pose les corps d'un composant de la pièce, et le suit.
- Liaison : rigide, pivot, glissière, cylindrique, plan ou sphérique ; « Telle quelle » est l'as-built ; une liaison commandée par une autre porte une loi (engrenage, crémaillère, vis, came).
- Trou en goutte d'eau : pas de fonction dédiée ; le dessiner en esquisse.
- Projection : les points projetés suivent l'arête quand la pièce change ; Délier les fige. La projection d'une arête disparue s'annonce en erreur sur l'esquisse.
- Commentaire d'un paramètre : colonne Commentaire de la fenêtre des paramètres.

Contrôle automatique : bouton Règles de l'onglet Inspecter (groupe Vérifier), `W3D.conception.controlerRegles(procede)` dans la page, ou `web3d_regles` par le MCP. Il vérifie les esquisses entièrement contraintes sans Fixe posé à la main (règle 5), les noms des paramètres (règle 6) et, en FDM, la grille (règle 15). Le lancer après chaque esquisse (règle 5) et avant le compte rendu (règle 19), et y reporter son résultat. Il ne couvre pas le reste des règles.


RÈGLES DE CONCEPTION D'UNE PIÈCE 3D

1. MÉTHODE
- Suivre l'ordre : cadrer, identifier le procédé, lire l'existant, planifier, construire.
- Ne jamais modifier le modèle avant que le plan soit validé.
- Question rapide (règle, valeur, conseil) : répondre directement, sans dérouler les étapes.
- En cas de contradiction, appliquer la règle la moins ambiguë, celle qui contient l'autre, et le signaler.
- Sur une capture d'écran, un point, une arête ou une face en surbrillance est le repère désigné : l'identifier, puis le confirmer en une ligne avant d'agir.
- Lire l'existant avant toute proposition et le résumer en 3 à 5 lignes.
- Ne jamais enregistrer sans demande explicite.

2. CONTENU DE LA DEMANDE
- Regrouper les questions manquantes en une seule fois. Pour le reste, prendre une valeur par défaut et l'annoncer dans le plan.
- Bloquant : fonction de la pièce et ensemble dans lequel elle s'insère ; dimensions principales ; procédé ; pour un PCB, diamètre des trous de fixation et entraxe.
- Important : boîtier compact ou non ; matériau et machine ; interfaces (vis, inserts, perçages, pièces voisines, jeux) ; pièce existante à recopier ; pièces de référence voisines, jeu demandé, faces de contact ou serrées ; contraintes mécaniques ou environnementales (charge, température, étanchéité).
- Optionnel : esthétique (congés, chanfreins, texte, logo), nombre de pièces, coût, poids.

3. CHOIX DU PROCÉDÉ
- Déterminer le procédé de chaque pièce ; un assemblage peut en mélanger plusieurs.
- FDM : imprimer, Prusa, PETG, PLA, prototype, filament.
- Injection : injection, moule, série, plasturgie, dépouille.
- Tôlerie : tôle, pliage, découpe laser, facteur K, acier ou alu en feuille.
- Sans précision, supposer le FDM et le dire.

4. PLAN DE CONSTRUCTION
- Plan numéroté court : procédé et règles clés, orientation d'impression et justification, fûts de fermeture (intérieurs ou extérieurs), paramètres préfixés par pièce, découpe en composants, ordre des opérations, regroupements prévus, règles impossibles à respecter.
- Annoncer aussi : modélisation en -Z, pièce rendue modulaire, paroi de fût réduite, jeu d'une pièce amovible, ponts sacrificiels, surépaisseur locale, toute exception avec sa justification.

5. ESQUISSES ET COTES
- Chaque esquisse est entièrement contrainte : une fausse manipulation ne doit rien pouvoir déplacer. Le contrôler après chaque esquisse.
- Poser les contraintes géométriques d'abord (horizontal, vertical, coïncidence, symétrie, égalité, concentricité, tangence), puis les cotes.
- Interdit : verrouiller une esquisse avec la contrainte Fixe.
- Point de départ des cotes, par ordre de préférence :
  1) l'origine du repère (obligatoire pour la première esquisse), puis placée sur un coin ou un axe de symétrie ;
  2) un coin ou une arête réelle de la pièce, projeté ;
  3) une face ou une arête d'une pièce de référence (projection, intersection ou silhouette), puis un décalage piloté par un paramètre de jeu : méthode préférée pour une face qui suit une pièce existante.
- Jamais de point flottant sans existence physique sur la pièce finie.
- Exception : une limite de construction entièrement enlevée ensuite, pilotée par <piece>_lim_… et commentée.
- Coter des distances mesurables au pied à coulisse, au réglet ou à la jauge de profondeur : arête à arête, arête au bord d'un trou, diamètres, cotes hors-tout.
- Coter en parallèle depuis la référence, pas en chaîne.
- Les cotes reprennent les paramètres, jamais de valeurs en dur.
- Esquisser sur une face plane existante en priorité ; un plan de construction seulement s'il n'y a aucune face à cet endroit (plan médian, plan incliné, référence sur un support pas encore modélisé).
- Projeter plutôt que recoter : une cote existante n'est jamais recopiée.

6. PARAMÈTRES
- Toute cote fonctionnelle est un paramètre en snake_case, avec un commentaire (rôle, règle appliquée).
- Préfixer par le nom de la pièce : capot_longueur, boitier_bas_epaisseur_paroi, capot_lim_x.
- Référence REF_<Nom> : préfixe ref_<nom>_.
- Sans préfixe, seulement les familles partagées : jeu…, avant_trou_…, passage_…, lamage_…, diam_insert_…, diam_fut_…, prof_vissage…, degagement_vis, marge_pcb, fond_fut, paroi_sous_tete, paroi_fond_lamage, paroi_bord_lamage, chanfrein_45, angle_chanfrein.
- Écrire les cotes dérivées en formules : capot_entraxe_x = capot_longueur - 2 * capot_marge.

7. STRUCTURE
- Une pièce = un composant, en PascalCase sans accent ni espace (BoitierBas, Capot).
- Tout ce qui construit la pièce reste dans son composant : esquisses, plans, axes, points, corps et fonctions.
- Rien à la racine, sauf les occurrences et les liaisons, même pour une pièce seule.
- Nommer les esquisses SK_<rôle> et les corps BD_<rôle>.
- Ordre : volume principal, enlèvements, fonctions secondaires, congés et chanfreins.
- Éléments à la racine d'un document existant : les signaler et proposer de les déplacer, sans le faire d'office.

8. ORIGINE ET ORIENTATION
- La pièce seule, ou l'ancre d'un assemblage, est dans sa position d'utilisation, sa face d'appui sur le plan XY, Z en hauteur.
- Volume en +Z par défaut ; -Z autorisé si le besoin le justifie.
- Première esquisse sur un plan d'origine (XY, XZ ou YZ), choisi pour que la pièce finale soit droite sans la déplacer.
- Le point 0/0/0 est l'origine de cotation de la première esquisse : un coin, un axe de symétrie ou un axe de révolution y coïncide.
- Les esquisses suivantes s'appuient sur les faces de cette géométrie et ses projections.
- Interdit : remettre la pièce dans le bon sens à la fin par un déplacement ou une rotation.
- Référence importée à des coordonnées imposées : elle reste fixée dans son repère, sous un composant REF_* ; chaque pièce a son repère, origine sur un élément mesurable, posée sur XY en +Z ou -Z, et positionnée par une liaison rigide classique, en décalage si besoin.

9. ASSEMBLAGE CONÇU EN PLACE
- Créer d'abord tous les composants vides, à la matrice identité : ancre fixée, pièces dans l'ordre de montage, références REF_* en dernier. Fixer aussi les autres occurrences pendant la conception.
- Construire d'abord la référence (import ou modèle simplifié). Elle peut démarrer sur un plan décalé à la hauteur de son support, piloté par un paramètre.
- Construire ensuite chaque pièce à partir de la géométrie projetée des précédentes. Une pièce qui se pose sur une autre se construit sur sa face d'appui, jamais sur ses propres plans d'origine.
- Seule l'ancre est posée sur XY ; les autres pièces sont à leur place d'assemblage. L'origine commune est celle de l'ancre, sur un élément mesurable.
- Poser les liaisons en fin de conception, classiques de préférence : type de mouvement adapté (rigide pour une pièce vissée, pivot, glissière, cylindrique, plan), géométries sur des éléments fonctionnels (axe d'une vis ou d'un perçage, face d'appui), décalage ou angle si nécessaire.
- Liaison as-built seulement à défaut de géométrie commune, à justifier.
- Historique par blocs : référence, ancre, pièces, chaque pièce d'un seul tenant.

10. REGROUPEMENT
- Fonctions identiques = une seule opération. Exemple pour 4 fûts : une esquisse avec 4 paires de cercles concentriques, une extrusion des 4 profils annulaires.
- Perçages identiques : une seule fonction Trou à plusieurs points, ou un seul enlèvement.
- Motifs réguliers : réseau rectangulaire ou circulaire.
- Formes symétriques : symétrie.
- Pièces strictement identiques : plusieurs occurrences d'un même composant, jamais un composant indépendant.
- Objectif : historique court, lisible et modifiable par paramètres.

11. ÉPAISSEUR ET FORMES
- Épaisseur uniforme : fond, dessus et parois pilotés par un seul paramètre (<piece>_paroi), sauf demande contraire et fonctions locales (fûts, nervures, bossages, lèvres, creusements sous vis).
- Pan incliné qui part d'une arête existante : Chanfrein d'abord, en distance égale (45° symétrique), deux distances (mesurables) ou distance et angle.
- Distances et angle en paramètres (chanfrein_45, angle_chanfrein), un seul chanfrein pour toutes les arêtes de même cote.
- À éviter : plan incliné + esquisse + enlèvement pour un simple pan. Seulement si le chanfrein est impossible, et justifié.
- Un chanfrein fonctionnel peut venir plus tôt dans l'historique ; les chanfreins esthétiques restent à la fin.
- Facette impossible au chanfrein : ligne d'esquisse, plan à angle (angles en paramètres), diviser le corps, supprimer le morceau. La justifier et la placer après les chanfreins.
- Faces dépouillées d'un profil complexe : fonction Dépouille, plutôt qu'une extrusion avec dépouille.
- Arêtes verticales extérieures : congé de préférence, avec un congé intérieur de rayon R - épaisseur.
- Angle occupé par un fût intérieur : rayon extérieur = rayon du fût.
- Oreilles extérieures : angles de la cavité en congé d'esquisse et congé concave de raccord oreille / parois.

12. ÉPOUSER UNE PIÈCE DE RÉFÉRENCE : L'OUTIL DE JEU
- Modéliser dans le composant de la pièce un corps BD_Outil_<référence> qui reproduit l'enveloppe, avec les cotes mesurées en paramètres.
- Décaler ses faces de jeu_ref, sauf les faces de contact.
- Couper la pièce par l'outil, sans garder l'outil.
- À préférer aux décalages d'esquisse dès que la forme n'est pas un simple profil.
- Si l'outil n'agit que sur une partie, le construire en plusieurs corps et ajouter après la découpe les fonctions à garder intactes.

13. LAMAGES ET LOGEMENTS (TOUS PROCÉDÉS)
- Sous une tête de vis : au moins 2 mm de matière pleine (paroi_sous_tete), ponts sacrificiels non comptés.
- Au fond des autres logements : 1 mm (paroi_fond_lamage).
- Sur les bords : au moins 0,5 mm, idéalement 1 mm (paroi_bord_lamage).
- Contrôler la profondeur et chaque distance latérale vers les faces ou fonctions voisines.
- Déduire la profondeur et la position du lamage de ces paramètres.
- Si c'est impossible, ne pas creuser : le signaler et demander quoi faire, avec une alternative (vis plus courte, tête plus basse, surépaisseur locale, bossage, déplacement du perçage).
- Perçages non débouchants : fonction Trou sur les centres projetés, une seule pour les trous identiques.

14. FÛTS DE FERMETURE ET PLAN DE JOINT
- Extérieurs (oreilles d'angle) si le boîtier est compact ou si le PCB a des connecteurs en bord. Cavité au plus près, côté par côté : max(marge_pcb ; saillie des connecteurs + jeu).
- Intérieurs sinon. Dégagement entre PCB et parois d'au moins marge_pcb : R_fût - R_pcb + (R_fût + R_pcb + jeu) / √2 - paroi.
- Positionner les fûts par tangence, jamais par une cote de position.
- Fût intérieur : tangent aux faces extérieures des deux parois de l'angle, sans vide ni îlot pour le slicer.
- Fût extérieur : centré sur la diagonale de l'angle, tangent au congé intérieur de la cavité.
- Fûts au ras du plan de joint, dans les deux pièces : une seule face d'appui, sans hyperstatisme.
- Empilement sous la tête de vis entièrement dans la pièce supérieure : lamage + 2 × pont sacrificiel + paroi_sous_tete.
- Avant-trous : mêmes règles que les trous de vissage du procédé.
- Pièce supérieure construite sur la face de joint projetée : une extrusion donne d'un coup jupe et bossages.
- Si des encoches fragmentent la jupe, joindre la plaque à tous les corps.
- Lèvre de centrage : contour intérieur projeté, décalé du jeu, rattachée à la plaque ; au-dessus du plan de joint, elle remplit jusqu'à la jupe ; au-dessous, elle garde le jeu avec le fond ; interrompue au droit des composants qu'elle heurterait (silhouette de la référence + jeu).
- Lamage et passage de vis dans une même esquisse, avec deux extrusions.
- Une ouverture qui traverse le plan de joint s'enlève aussi dans la pièce supérieure, à partir de la même projection.

15. IMPRESSION 3D FDM

Machines et matière
- Core One+ par défaut : 250 × 220 × 270 mm, enceinte fermée, adaptée au PETG, à l'ASA et à l'ABS.
- MK3S : 250 × 210 × 210 mm, cadre ouvert, privilégier le PLA et le PETG.
- Buse 0,4 mm, largeur d'extrusion ~0,45 mm, couches de 0,2 mm, PETG par défaut.

Pièce plus grande que le plateau
- Vérifier que chaque pièce tient sur le plateau, selon son orientation d'impression.
- Si elle dépasse, la rendre modulaire au lieu de la réduire, et le signaler dès le plan.
- Modules avec ~5 mm de marge sur les limites.
- Coupes dans des zones peu sollicitées et peu visibles, de préférence sur des faces planes.
- Clips (montage sans outil, peu chargé) : languette dans le plan XY, épaisseur 1,5-2,5 mm, longueur ≥ 5 × épaisseur, crochet avec rampe de 30-45°.
- Vissage (chargé, rigide, démontable durablement) : inserts laiton M3 ou écrous prisonniers, au moins 2 vis par jonction.
- Toujours un centrage à la jonction (tenons, ergots, emboîtement), avec le jeu standard.
- Chaque module est un composant distinct.

Grille (dans l'orientation d'impression)
- Hauteurs multiples de 0,2 mm : pièce, fonds, dessus, marches, fûts, nervures, poches, faces horizontales.
- Parois multiples de 0,5 mm, avec dérogation locale possible pour un congé ou un chanfrein.
- Dimensions XY libres, hors épaisseurs de parois.
- Épaisseur uniforme multiple des deux : 1, 2 ou 3 mm.
- Chanfrein en hauteur ≥ 0,6 mm, congé en hauteur ≥ 1 mm et multiple de 0,2 mm.
- Vérifier la grille sur les paramètres avant de construire, et la rappeler dans le compte rendu.

Épaisseurs et détails
- Paroi porteuse de 2 mm.
- 1,5 mm si un boîtier très compact est demandé explicitement.
- Rester à 2 mm s'il doit aussi être robuste.
- Fond et dessus égaux à la paroi, jamais moins de 0,8 mm (4 couches).
- Détail minimal ~0,8 mm.
- Texte en relief ≥ 0,6 mm de haut, trait ≥ 0,5 mm.

Porte-à-faux et trous
- Aucune surface dans le vide sans support prévu par la géométrie.
- Porte-à-faux ≤ 45° par rapport à la verticale ; remplacer les surplombs par des chanfreins à 45°.
- Pont entre deux appuis : très bien jusqu'à 30 mm, acceptable jusqu'à 50 mm. Au-delà, ajouter un appui ou revoir l'orientation.
- Tout trou non vertical prend une forme de goutte d'eau, pointe vers le haut à 45°, quel que soit son diamètre. Les trous verticaux restent ronds.
- Côté plateau : pas de congé. Une arête adoucie s'y fait en chanfrein.

Orientation
- La choisir dès la conception.
- Pièce sollicitée : effort principal le long des filaments, dans le plan XY.
- Ne jamais faire travailler une zone sollicitée entre les couches (traction ou flexion selon Z).
- Clips et languettes flexibles toujours dans le plan XY.
- Grande face plane sur le plateau.
- Patte d'éléphant jamais anticipée en CAO ; un chanfrein de design côté plateau est conservé.
- Si l'orientation idéale contredit une autre règle, le signaler et proposer un compromis.

Jeux
- Assemblage : 0,15 mm par côté (jeu).
- Ajustement serré : 0,05-0,1 mm.
- Axe tournant : 0,25-0,3 mm.
- Pièce de référence : 0,2 mm (jeu_ref).
- Pièce amovible ou glissante : 0,2-0,4 mm.
- Faces serrées par une vis ou d'appui : contact, jeu 0.
- Trou vertical à cote nominale : +0,1 à +0,2 mm sur le Ø, sauf valeurs qui l'incluent déjà (insert Ø 4,2, avant-trous de vis plastique).

Fixations
- Insert laiton M3 à chaud : trou Ø 4,2 mm (diam_insert_m3), profondeur = longueur de l'insert + 1 mm.
- Fûts de vissage reliés aux parois par des nervures.
- Fût de fermeture : Ø = lamage + 2 × 1 mm (diam_fut_angle).
- Rayons d'arêtes verticales : <piece>_rayon_ext et <piece>_rayon_int.

Fixation de PCB
- Par défaut, sur des fûts pour vis autotaraudeuses plastique, souvent M2,5 ou M3.
- Partir du diamètre de perçage et de l'entraxe ; s'ils sont inconnus, les demander avant de modéliser les fûts.
- Avant-trou : 0,8 × Ø nominal + 0,2 mm (M2,5 = 2,2 ; M3 = 2,6), à ajuster selon la vis réelle si elle est précisée.
- Paroi du fût : 2 mm, ou 1,5 mm en cas de risque de collision avec un composant.
- Hauteur sous le PCB : ≥ 4 mm, 5 mm si le boîtier n'a pas à être compact. Augmenter si des composants traversants ou des soudures dépassent.
- Trou de vissage non débouchant : profondeur ≥ 2 × Ø de vis depuis le sommet du fût, et ≥ longueur vissée + dégagement.
- Dégagement sous la pointe ≥ 1 mm (0,6 mm si compact) ; choisir la longueur de vis en conséquence, ou approfondir au multiple de 0,2 mm supérieur.
- Fond plein ≥ 1,2 mm, ou 1 mm si la pointe va vers le plateau.
- Fond plat, sans pointe conique.
- Condition : hauteur du fût + fond ≥ profondeur + fond plein. Sinon, rehausser le fût ou ajouter une surépaisseur locale.
- Fûts identiques : une seule esquisse, une seule extrusion.
- Marge ≥ 1 mm autour du PCB (marge_pcb) ; 0,15 mm ponctuellement sur des détrompeurs, plots ou nervures de guidage.

Lamage ouvert côté plateau : ponts sacrificiels
- Seulement si le plafond du lamage est dans le vide et pour éviter un support.
- Ne pas en ajouter si le lamage s'ouvre vers le haut, si le plafond est autoportant, si des supports sont prévus ou hors FDM.
- Une esquisse sur la face d'appui de la tête : cercles du lamage et du passage concentriques, centres projetés. Deux extrusions : le lamage, puis le passage sur toute l'épaisseur.
- Une esquisse sur le fond du lamage : 2 lignes parallèles à X tangentes au passage, extrémités sur le cercle du lamage ; 2 lignes parallèles à Y tangentes au passage, extrémités sur les 2 premières.
- Deux enlèvements depuis le fond du lamage : la fente sur 0,2 mm, puis le carré seul sur 0,4 mm.
- Aucune cote dans l'esquisse des ponts : tout découle des tangences.
- 2 couches de 0,2 mm, plafond sur la grille de 0,2 mm, profondeur du lamage inchangée.
- Matière sous la tête ≥ 2 mm hors ponts, soit ≥ 2,4 mm avec.
- Signaler dans le plan et le compte rendu que les ponts sont à percer.
- Lamages identiques : une esquisse et une extrusion par couche.

16. INJECTION PLASTIQUE
- Dépouille ≥ 1,5° sur les faces parallèles au démoulage ; flancs de nervures ≥ 1° par face ; ~1° de plus par 0,025 mm de grain.
- Définir le sens de démoulage et le plan de joint avant de modéliser.
- Aligner si possible le démoulage sur Z, pièce droite sur XY.
- Épaisseur uniforme de 1,5 à 3 mm (ABS, PC, PP), transitions ≥ 3 × la différence, évider les masses.
- Nervures : 50-60 % de la paroi, hauteur ≤ 3 × paroi, espacement ≥ 2 × paroi, congé en pied 0,25-0,5 × t.
- Fûts : Ø ≈ 2 × trou, paroi ≈ 60 % de l'épaisseur, reliés par des nervures, jamais directement contre une paroi.
- Congé intérieur ≥ 0,5 × t, congé extérieur = intérieur + t, aucun angle vif intérieur.
- Éviter les contre-dépouilles, sinon les signaler (tiroir, noyau mobile).
- Clips : fenêtres de démoulage dans la paroi opposée si possible.

17. TÔLERIE
- Utiliser l'environnement Tôlerie avec une règle dédiée, et les fonctions Bride, Pli, Déplier ; pas d'extrusions classiques pour les pliages.
- Toujours vérifier que le déplié se génère sans erreur.
- Pièce pliée droite, posée sur XY.
- Facteur K de 0,44, défini dans la règle et non pièce par pièce.
- Épaisseurs : 0,8 / 1 / 1,5 / 2 / 3 mm.
- Rayon intérieur ≥ 1 × t (≥ 1,5 × t pour l'alu 5754/6061).
- Bord plié ≥ 4 × t, ou 3 × t + rayon.
- Trou-pli ≥ 2,5 × t + rayon ; trou-bord ≥ 1 à 1,5 × t ; Ø du trou ≥ t.
- Dégagements de pli : largeur ≥ t, profondeur ≥ t + rayon ; dégagement de coin contre les déchirures.
- Assemblage : inserts sertis (type PEM), taraudage dans la tôle ≥ 1,5 × pas, ou rivets.

18. COPIE D'UNE PIÈCE EXISTANTE
- La géométrie de l'original prime : tout écart aux règles est signalé, jamais corrigé ; aucun ajout ni retouche.
- Conserver les jeux d'origine s'ils sont plus grands que le jeu demandé, ainsi que les contacts d'origine.
- Les méthodes de construction restent obligatoires.
- Reprendre la géométrie des pièces voisines par projection ou intersection, pas par cotes recopiées.
- Comparer chaque pièce à l'original (volume, nombre de faces, booléen de différence, ou échantillonnage des faces) : écart ≤ 0,01 mm, sinon le justifier.

19. VÉRIFICATIONS
- Après chaque opération importante, contrôler l'état de l'historique.
- Historique sans erreur ni avertissement.
- Toutes les esquisses contraintes, en listant les autres.
- Dimensions clés contrôlées (encombrements, volumes).
- Pièce ou ancre droite sur XY, première esquisse sur un plan d'origine et cotée depuis 0/0/0.
- Historique par blocs, aucune interférence entre pièces ni avec la référence, fûts au ras du plan de joint.
- En FDM : hauteurs × 0,2 mm et parois × 0,5 mm.
- Lamages : ≥ 2 mm sous tête, 1 mm ailleurs, bords ≥ 0,5 mm, en listant ceux sous 1 mm.
- Pans inclinés par Chanfrein, exceptions justifiées.
- Racine vide de géométrie, chaque élément dans le composant de sa pièce.
- Paramètres préfixés.
- Pièce épousant une référence : interférence nulle et jeu minimal = jeu_ref, hors faces de contact voulues.
- Mode copie : comparaison à l'original et liste des écarts conservés.
- Capture d'écran de contrôle.

20. COMPTE RENDU FINAL
- Procédé et règles : procédé, orientation d'impression, règles clés respectées.
- Réalisé : opérations et regroupements.
- Paramètres : nom = valeur (unité), préfixés par pièce.
- Vérifications : résultats et dimensions contrôlées.
- Références de cotation : d'où mesurer la pièce fabriquée.
- Hypothèses : valeurs par défaut choisies.
- Écarts conservés (mode copie) : règle, valeur de l'original, raison.
- Points d'attention : risques de fabrication et 1 à 3 suggestions.
- Injection : sens de démoulage, plan de joint, épaisseur nominale, retrait à prévoir par le mouliste.
- Tôlerie : sens de pliage et plis à 90°.
