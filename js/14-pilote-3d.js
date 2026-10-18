/* =============================================================================
   Commandes du canal de pilotage (MCP de web_suite) pour la visionneuse 3D.

   Deux étages :
   - des FONCTIONS PURES sur une scène three.js (identifier une pièce, décrire la
     scène, mesurer, chercher les collisions, déplacer, extraire un STEP), qui
     rendent des nombres et des chaînes, jamais un Vector3 ni un maillage —
     éprouvées sous Node par test/banc-pilote-3d.mjs ;
   - brancherPilote3d, qui les déclare au canal (js/pilote.js) et fait le lien
     avec l'interface.
   Spec : web_suite/lanceur/docs/SPEC-mcp-registre-3d.md.
   ========================================================================== */

import * as THREE from "three";
import { formatDe, LISTE_FORMATS, liberer } from "./02-import.js";
import { mesurerSolide } from "./05-arbre.js";
import { compagnons, lireFichiersProjets } from "./11-projets.js";
import { analyser, faceSous, mesurerEntites } from "./06-topologie.js";
import { StepExtractor, sanitiserNomFichier } from "./10-export-step.js";
import { chercherCollisions, maillageCollisions } from "./12-collisions.js";
import { contraindre, perimerCaches, apresDeplacement } from "./13-deplacement.js";

/* Les noms viennent du fichier (produits STEP) : sans caractères de contrôle ni de sens d'écriture,
   bornés, avant d'aller à Claude ou sur une carte — un nom n'est pas une consigne. */
export function nomSur(s){
  return String(s ?? "").replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, "").slice(0, 120);
}

/* Arrondi au µm (ou au millième de degré) : des nombres lisibles, et -0 n'existe pas. */
function arrondir(x){ return Math.round(x * 1000) / 1000 + 0; }
const DEG = 180 / Math.PI;

/** Les pièces de la scène, dans l'ordre de l'arbre. */
export function pieces(modele){
  const liste = [];
  modele.traverse(o => { if(o.isMesh && o.userData.estPiece) liste.push(o); });
  return liste;
}

/** Chemin d'indices sous la scène : « 0/3/1 ». Calculé à la volée : il change si l'on ferme
    ou ajoute un fichier, l'uuid non. */
export function cheminDe(modele, objet){
  const indices = [];
  for(let o = objet; o && o !== modele; o = o.parent){
    if(!o.parent) return null;
    indices.unshift(o.parent.children.indexOf(o));
  }
  return indices.join("/");
}

function visibleEnTout(objet, modele){
  for(let o = objet; o && o !== modele; o = o.parent) if(!o.visible) return false;
  return true;
}

function fichierDe(modele, objet){
  let o = objet;
  while(o.parent && o.parent !== modele) o = o.parent;
  return modele.children.indexOf(o);
}

/* La sélection remplace le matériau par un clone surligné : la vraie couleur est dans matSauve. */
function couleurDe(piece){
  const m = piece.userData.matSauve || piece.material;
  return (m && m.userData && m.userData.couleurHex) || null;
}

/**
 * Une pièce par uuid ou par chemin d'indices. Un nom n'est accepté que s'il est unique :
 * les noms se répètent (8 « nut » dans l'assemblage d'exemple).
 */
export function trouverPiece(modele, ref){
  if(typeof ref !== "string" || !ref.trim()) throw new Error("Référence de pièce invalide.");
  let objet;
  if(/^\d+(\/\d+)+$/.test(ref)){
    objet = modele;
    for(const i of ref.split("/").map(Number)){
      objet = objet.children[i];
      if(!objet) throw new Error(`Pièce « ${ref} » introuvable : chemin hors de l'arbre.`);
    }
  }else if(/^[0-9A-Fa-f-]{36}$/.test(ref)){
    objet = modele.getObjectByProperty("uuid", ref);
    if(!objet) throw new Error(`Pièce « ${ref} » inconnue (uuid d'une autre session ?).`);
  }else{
    const memes = pieces(modele).filter(p => p.name === ref);
    if(!memes.length) throw new Error(`Pièce « ${ref} » inconnue.`);
    if(memes.length > 1){
      const liste = memes.map(p => `${cheminDe(modele, p)} (${p.uuid})`).join(", ");
      throw new Error(`« ${ref} » désigne ${memes.length} pièces : ${liste}. Désigne-la par son chemin ou son uuid.`);
    }
    objet = memes[0];
  }
  if(!objet.isMesh || !objet.userData.estPiece) throw new Error(`« ${ref} » n'est pas une pièce.`);
  return objet;
}

/** Les fichiers ouverts et leurs pièces, sérialisés ; filtre (sur le nom) et pagination. */
export function decrireScene(modele, { filtre = "", debut = 0, nombre = 200 } = {}){
  const fichiers = modele.children.map((g, index) => ({
    index, nom:nomSur(g.name), fichier:nomSur(g.userData.fichier || g.name), format:g.userData.format || "",
    projet:g.userData.projet || null,
    pieces: pieces(g).length, visible: g.visible,
    position: g.position.toArray().map(arrondir),
    rotation_deg: [g.rotation.x, g.rotation.y, g.rotation.z].map(r => arrondir(r * DEG)),
  }));
  const toutes = pieces(modele);
  const f = String(filtre).toLowerCase();
  const trouvees = f ? toutes.filter(p => p.name.toLowerCase().includes(f)) : toutes;
  const page = trouvees.slice(Math.max(0, debut), Math.max(0, debut) + Math.max(0, Math.min(nombre, 1000)));
  return {
    fichiers, pieces_total: toutes.length, trouvees: trouvees.length, debut,
    pieces: page.map(p => ({
      uuid: p.uuid, chemin: cheminDe(modele, p), nom: nomSur(p.name),
      parent: p.parent && p.parent !== modele ? nomSur(p.parent.name) : "",
      fichier: fichierDe(modele, p), visible: visibleEnTout(p, modele),
      triangles: p.userData.triangles || 0, couleur: couleurDe(p),
    })),
  };
}

const vec = v => [v.x, v.y, v.z].map(arrondir);

/* ---------------------------------------------------------------------------
   Mesures : nombres en mm, repère du monde
   ------------------------------------------------------------------------- */

/** Encombrement (sur les sommets, exact même tourné), volume, surface, nombre de pièces. */
export function dimensions(objet){
  objet.updateMatrixWorld(true);
  const boite = new THREE.Box3();
  const nb = pieces(objet).length || (objet.isMesh ? 1 : 0);
  objet.traverse(o => { if(o.isMesh) boite.expandByObject(o, true); });
  const { volume, aire } = mesurerSolide(objet);
  const taille = boite.isEmpty() ? [0, 0, 0] : vec(boite.getSize(new THREE.Vector3()));
  return { pieces:nb, taille, min:boite.isEmpty() ? [0, 0, 0] : vec(boite.min),
           max:boite.isEmpty() ? [0, 0, 0] : vec(boite.max), volume:arrondir(volume), surface:arrondir(aire) };
}

/** Distance minimale entre deux pièces (triangles du maillage d'affichage), avec les deux points. */
export function distance(A, B){
  const r = mesurerEntites({ genre:"piece", maillage:A }, { genre:"piece", maillage:B });
  if(!r) throw new Error(`Distance impossible entre « ${nomSur(A.name)} » et « ${nomSur(B.name)} ».`);
  const d = r.p1.distanceTo(r.p2);
  return { distance:arrondir(d), contact:d <= 1e-6, p1:vec(r.p1), p2:vec(r.p2) };
}

/** Les faces d'une pièce : index stable (région de la topologie), type, géométrie, aire. */
export function faces(piece){
  piece.updateMatrixWorld(true);
  const topo = analyser(piece);
  if(!topo) throw new Error(`« ${nomSur(piece.name)} » : trop de triangles pour analyser ses faces.`);
  const liste = topo.trisParRegion.map((tris, index) => {
    const e = faceSous(null, { object:piece, faceIndex:tris[0] });
    const f = { index, type:e.type, aire:arrondir(e.aire), centre:vec(e.centre) };
    if(e.type === "plan") f.normale = vec(e.normale);
    if(e.type === "cylindre") Object.assign(f, { axe:vec(e.axe), rayon:arrondir(e.rayon), hauteur:arrondir(e.hauteur),
                                                 ferme:!!e.ferme });
    return f;
  });
  return { piece:piece.name, uuid:piece.uuid, faces:liste };
}

/**
 * La cote de Claude : une ligne et deux pastilles, à poser dans vue.annotations. Elle est
 * à part de l'outil Mesure, qui ne prévoit pas qu'on lui fournisse un résultat. L'étiquette
 * texte demande un canevas : la page la fournit (etiquette), le banc s'en passe.
 */
export function coteClaude(p1, p2, texte, { etiquette } = {}){
  const g = new THREE.Group();
  g.name = "cote-claude";
  g.userData.texte = texte;
  const geo = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute([...p1, ...p2], 3));
  const ligne = new THREE.Line(geo, new THREE.LineBasicMaterial({ color:0xffb000, depthTest:false }));
  ligne.renderOrder = 999;
  g.add(ligne);
  for(const p of [p1, p2]){
    const pastille = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 8),
                                    new THREE.MeshBasicMaterial({ color:0xffb000, depthTest:false }));
    pastille.position.fromArray(p);
    g.add(pastille);
  }
  if(etiquette){
    const e = etiquette(texte);
    e.position.fromArray(p1.map((x, i) => (x + p2[i]) / 2));
    g.add(e);
  }
  return g;
}

/* ---------------------------------------------------------------------------
   Collisions : couples de pièces dont les surfaces se croisent
   ------------------------------------------------------------------------- */
const decrire = (modele, p) => ({ uuid:p.uuid, chemin:cheminDe(modele, p), nom:nomSur(p.name) });

/** Les pièces masquées sont ignorées ; la tolérance est un argument, jamais une préférence écrite. */
export async function collisions(modele, options = {}){
  return (await calculerCollisions(modele, options)).resume;
}

/** Le résultat brut (pour dessiner) et sa version sérialisée (pour Claude). */
export async function calculerCollisions(modele, { tolerance = 0.1, pauses = true } = {}){
  const debut = performance.now();
  const brut = await chercherCollisions(modele, { tol:tolerance, visible:o => visibleEnTout(o, modele), pauses });
  return { brut, resume:{
    nombre:brut.length, tolerance, duree_s:arrondir((performance.now() - debut) / 1000),
    collisions:brut.map(c => ({ a:decrire(modele, c.a), b:decrire(modele, c.b), longueur:arrondir(c.longueur) })),
  } };
}

/* ---------------------------------------------------------------------------
   Déplacement : on déplace un FICHIER (son groupe), jamais une pièce — comme le
   panneau Déplacer, dont on reprend les conventions (valeurs absolues, rotation
   autour du centre de la boîte).
   ------------------------------------------------------------------------- */
const RAD = Math.PI / 180;
const centreBoite = g => new THREE.Box3().setFromObject(g, true).getCenter(new THREE.Vector3());

/** Le groupe d'un fichier par son index. */
export function trouverFichier(modele, index){
  const g = Number.isInteger(index) ? modele.children[index] : undefined;
  if(!g) throw new Error(`Fichier ${index} inconnu : ${modele.children.length} fichier(s) ouvert(s).`);
  return g;
}

/** origine, puis position (absolue, mm), translation (relative), rotation_deg (absolue, Euler XYZ). */
export function deplacer(g, { position, translation, rotation_deg, origine } = {}){
  if(origine){ g.position.set(0, 0, 0); g.rotation.set(0, 0, 0); }
  if(position) g.position.fromArray(position);
  if(translation) g.position.add(new THREE.Vector3().fromArray(translation));
  if(rotation_deg){
    g.updateMatrixWorld(true);
    const avant = centreBoite(g);
    g.rotation.set(rotation_deg[0] * RAD, rotation_deg[1] * RAD, rotation_deg[2] * RAD);
    g.updateMatrixWorld(true);
    g.position.add(avant.sub(centreBoite(g)));
  }
  perimerCaches(g);
}

/** La face d'index donné d'une pièce, en coordonnées du monde (06-topologie). */
export function faceDe(piece, index){
  piece.updateMatrixWorld(true);
  const topo = analyser(piece);
  const tris = topo && topo.trisParRegion[index];
  if(!tris) throw new Error(`Face ${index} hors limites pour « ${nomSur(piece.name)} » (${topo ? topo.trisParRegion.length : 0} faces).`);
  return faceSous(null, { object:piece, faceIndex:tris[0] });
}

/** Plaquer deux plans ou aligner deux axes : la face mobile sur le fichier g, la fixe sur un autre. */
export function contrainte(modele, g, { mobile, fixe, decalage = 0 }){
  const pA = trouverPiece(modele, mobile.piece), pB = trouverPiece(modele, fixe.piece);
  const fichierA = modele.children[fichierDe(modele, pA)], fichierB = modele.children[fichierDe(modele, pB)];
  if(fichierA !== g) throw new Error(`La face mobile doit être sur le fichier déplacé (« ${nomSur(g.name)} »).`);
  if(fichierB === g) throw new Error("La face fixe doit être sur un autre fichier que celui qu'on déplace.");
  const A = faceDe(pA, mobile.face), B = faceDe(pB, fixe.face);
  const erreur = contraindre(g, A, B, decalage);
  if(erreur) throw new Error(erreur);
  perimerCaches(g);
}

/** Position, orientation et échelle de chaque fichier : l'Annuler des cartes les remet au bit près. */
export function etatMatrices(modele){
  return modele.children.map((g, index) => ({ index, fichier:g.userData.fichier || g.name,
    position:g.position.toArray(), quaternion:g.quaternion.toArray(), scale:g.scale.toArray() }));
}

export function remettreMatrices(modele, etat){
  if(etat.length !== modele.children.length)
    throw new Error("Le nombre de fichiers ouverts a changé depuis : impossible de remettre les positions.");
  etat.forEach((e, i) => {
    const g = modele.children[i];
    if(e.fichier !== (g.userData.fichier || g.name))
      throw new Error("Les fichiers ouverts ont changé depuis : impossible de remettre les positions.");
    g.position.fromArray(e.position); g.quaternion.fromArray(e.quaternion); g.scale.fromArray(e.scale);
    perimerCaches(g);
  });
}

/* ---------------------------------------------------------------------------
   Ouvrir : seulement des fichiers de PROJETS/3D, tels que les rend web3d_projets
   ------------------------------------------------------------------------- */

/** Les chemins à lire : validés (relatifs, format 3D, présents), un .obj suivi de son .mtl. */
export function preparerOuverture(chemins, disponibles){
  if(!Array.isArray(chemins) || !chemins.length) throw new Error("Donne au moins un fichier de PROJETS/3D.");
  if(chemins.length > 20) throw new Error("20 fichiers au plus à la fois.");
  const connus = new Set(disponibles.map(f => f.chemin));
  const sortie = [];
  for(const c of chemins){
    if(typeof c !== "string" || !c || c.startsWith("/") || c.includes("\\") || c.includes(":")
       || c.split("/").some(b => b === "" || b === "." || b === ".."))
      throw new Error(`Chemin invalide : ${c} (relatif à PROJETS/3D, tel que le rend web3d_projets).`);
    if(!formatDe(c)) throw new Error(`« ${c} » n'est pas un format 3D lisible (${LISTE_FORMATS}).`);
    if(!connus.has(c)) throw new Error(`« ${c} » absent de PROJETS/3D.`);
    for(const x of compagnons(c, disponibles)) if(!sortie.includes(x)) sortie.push(x);
  }
  return sortie;
}

/* ---------------------------------------------------------------------------
   Extraire un STEP : la pièce recopiée du STEP d'origine, aux positions d'origine —
   un déplacement fait dans la vue n'y est pas.
   ------------------------------------------------------------------------- */

/**
 * Une pièce à la fois. StepExtractor retrouve un produit par nom exact, puis approché : on
 * n'accepte que l'exact (les 8 « nut » sont 8 occurrences d'un même produit : ça va). Un
 * sous-ensemble choisi pièce par pièce n'est pas fiable : exportAssemblageFiltre remonte au
 * sous-ensemble parent et redescend vers tous ses enfants, voisins compris.
 */
export function extraireStep(modele, refs){
  if(!Array.isArray(refs) || !refs.length) throw new Error("Donne une pièce.");
  if(refs.length > 1) throw new Error("Une pièce à la fois : l'extraction d'un sous-ensemble choisi pièce par pièce " +
                                      "emporterait aussi ses pièces voisines.");
  const piece = trouverPiece(modele, refs[0]);
  const texte = modele.children[fichierDe(modele, piece)].userData.stepTexte;
  if(!texte) throw new Error("Ce fichier n'est pas un STEP (ou son texte n'a pas été gardé) : extraction impossible.");
  const ex = new StepExtractor(texte);
  const memes = [...ex.produits.values()].filter(pr => pr.nom === piece.name);   // exact, la casse compte
  if(!memes.length) throw new Error(`Pièce « ${nomSur(piece.name)} » introuvable dans le STEP d'origine (nom différent ?).`);
  if(new Set(memes.map(m => m.defId)).size > 1)
    throw new Error(`Deux produits STEP différents s'appellent « ${nomSur(piece.name)} » : extraction ambiguë.`);
  const sortie = ex.exportPiece(memes[0]);
  return { produits:[memes[0].nom], texte:sortie, octets:new TextEncoder().encode(sortie).length,
           note:"Positions d'origine du STEP : les déplacements faits dans la vue n'y sont pas." };
}

/* ===========================================================================
   Branchement au canal (js/pilote.js) : les 9 commandes de registre-3d.
   Lectures et réglages visuels s'appliquent tout de suite (trace dans le
   panneau) ; ouvrir et déplacer passent par une carte annulable ; ranger un
   STEP par une carte irréversible. Aucune commande n'écrit les préférences.
   ========================================================================== */
const VUES = ["avant", "arriere", "gauche", "droite", "dessus", "dessous", "iso"];
const AXES = ["x", "y", "z"];

function objetVise(modele, { piece, fichier } = {}){
  if(piece !== undefined) return trouverPiece(modele, piece);
  if(fichier !== undefined) return trouverFichier(modele, fichier);
  return modele;
}

/* L'étiquette de la cote : un sprite texte (canevas), seulement dans un navigateur. Sa largeur suit
   le modèle (25 % de sa diagonale) : une taille fixe la rendait illisible sur un grand assemblage. */
function etiquetteTexte(THREE_, texte, largeur){
  const c = document.createElement("canvas");
  c.width = 512; c.height = 96;
  const g = c.getContext("2d");
  g.fillStyle = "rgba(20,20,28,0.85)"; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = "#ffb000"; g.font = "bold 48px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(texte, c.width / 2, c.height / 2);
  const s = new THREE_.Sprite(new THREE_.SpriteMaterial({ map:new THREE_.CanvasTexture(c), depthTest:false }));
  s.scale.set(largeur, largeur * c.height / c.width, 1);
  s.renderOrder = 1000;
  return s;
}

export function brancherPilote3d(W3D, Pilote){
  const { vue, nav, arbre, ui, coupe } = W3D;
  const modele = vue.modele;
  const rafraichir = g => { apresDeplacement(vue, ui, g); ui.surModeleChange?.(); };
  /* Tous les fichiers d'un coup : caches périmés partout, mais mesure, coupe et collisions
     affichées refaites une seule fois (apresDeplacement les relançait pour chaque fichier). */
  const rafraichirTous = () => {
    modele.children.forEach(perimerCaches);
    if(modele.children.length) rafraichir(modele.children[0]);
  };
  const signature = () => modele.children.map(g => g.uuid).join(",");

  Pilote.declarer({ page:"3d", projet:() => (typeof document !== "undefined" ? document.title : "") })
    .capture(() => { vue.rendre(); return vue.canvas; });

  Pilote.commande("web3d_scene", { executer:a => Object.assign(decrireScene(modele, a), {
    selection:arbre.selection ? arbre.selection.uuid : null, isole:arbre.isole ? arbre.isole.uuid : null,
    coupe:{ actif:!!coupe.actif, mode:coupe.mode, decalage_mm:arrondir(coupe.offsetMm || 0), inverse:!!coupe.inverse },
    projection:vue.projection }) });

  Pilote.commande("web3d_vue", { executer:a => {
    if(a.vue !== undefined){
      if(!VUES.includes(a.vue)) throw new Error(`Vue inconnue : ${a.vue} (${VUES.join(", ")}).`);
      nav.allerVersVue(a.vue, false);          // sans animation : un onglet caché ne l'avancerait pas
    }
    if(a.projection !== undefined){
      if(!["ortho", "perspective"].includes(a.projection)) throw new Error("Projection : ortho ou perspective.");
      vue.definirProjection(a.projection);      // la vue seulement, pas les préférences
    }
    // Recadrer seulement si l'on a changé de vue ou demandé un cadrage : la projection seule ne le demande pas
    const cible = objetVise(modele, a.cadrer || {});
    if(a.vue !== undefined || a.cadrer) vue.ajusterVue(cible);
    ui.majEtatBoutons?.();                     // le bouton de projection suit
    vue.invalider();
    return { vue:a.vue || null, projection:vue.projection, cadre:cible === modele ? "scène" : nomSur(cible.name) };
  } });

  Pilote.commande("web3d_visibilite", { executer:a => {
    const refs = Array.isArray(a.pieces) ? a.pieces : [];
    const cibles = refs.map(r => trouverPiece(modele, r));
    switch(a.action){
      case "masquer": cibles.forEach(o => arbre.basculerVisible(o, false)); break;
      case "afficher": cibles.forEach(o => arbre.basculerVisible(o, true)); break;
      case "isoler":
        if(cibles.length !== 1) throw new Error("isoler : une pièce.");
        if(arbre.isole !== cibles[0]) arbre.isoler(cibles[0]);   // isoler bascule : rappelé, il réafficherait tout
        break;
      case "tout_afficher": arbre.toutAfficher(); break;
      case "selectionner": arbre.selectionner(cibles[0] || null); break;
      default: throw new Error(`action inconnue : ${a.action} (masquer, afficher, isoler, tout_afficher, selectionner).`);
    }
    vue.invalider();
    return { action:a.action, pieces:cibles.map(o => o.name), visibles:pieces(modele).filter(o => visibleEnTout(o, modele)).length };
  } });

  Pilote.commande("web3d_coupe", { executer:a => {
    if(a.actif !== undefined) coupe.definirActif(!!a.actif);
    if(a.axe !== undefined){
      if(!AXES.includes(a.axe)) throw new Error("axe : x, y ou z (ou face).");
      coupe.definirActif(true); coupe.definirAxe(a.axe);
    }
    if(a.face){
      const f = faceDe(trouverPiece(modele, a.face.piece), a.face.index);
      if(f.type !== "plan") throw new Error("La coupe se pose sur une face plane.");
      // La face d'abord, puis le choix à la souris coupé : activer avant laisserait le prochain clic choisir
      coupe.poserFace(f.normale.clone(), f.centre.clone(), `face ${a.face.index}`);
      coupe.desactiverChoixFace?.();
      coupe.definirActif(true);
    }
    if(a.decalage_mm !== undefined) coupe.definirOffset(+a.decalage_mm);
    if(a.inverse !== undefined && !!a.inverse !== !!coupe.inverse) coupe.basculerInverse();
    ui.appliquerCoupe();
    vue.invalider?.();
    return { actif:!!coupe.actif, mode:coupe.mode, decalage_mm:arrondir(coupe.offsetMm || 0),
             bornes_mm:[arrondir(coupe.minMm || 0), arrondir(coupe.maxMm || 0)], inverse:!!coupe.inverse };
  } });

  const effacerCote = () => {
    const c = vue.annotations.getObjectByName("cote-claude");
    if(c){ vue.annotations.remove(c); liberer(c); }      // géométrie, matériaux, texture du texte
  };
  Pilote.commande("web3d_mesurer", { executer:a => {
    effacerCote();
    if(a.effacer) { vue.invalider(); return { efface:true }; }
    let r;
    if(a.quoi === "distance"){
      if(!Array.isArray(a.pieces) || a.pieces.length !== 2) throw new Error("distance : deux pièces.");
      r = distance(trouverPiece(modele, a.pieces[0]), trouverPiece(modele, a.pieces[1]));
      if(a.afficher){
        const texte = `${String(r.distance).replace(".", ",")} mm`;
        const diagonale = new THREE.Box3().setFromObject(modele).getSize(new THREE.Vector3()).length() || 100;
        vue.annotations.add(coteClaude(r.p1, r.p2, texte,
          typeof document !== "undefined" ? { etiquette:t => etiquetteTexte(THREE, t, diagonale * 0.25) } : {}));
      }
    }else if(a.quoi === "faces"){
      r = faces(trouverPiece(modele, a.piece));
    }else if(a.quoi === "dimensions" || a.quoi === undefined){
      r = dimensions(objetVise(modele, a));
    }else throw new Error("quoi : dimensions, distance ou faces.");
    vue.invalider();
    return r;
  } });

  Pilote.commande("web3d_collisions", { executer:async a => {
    /* Onglet caché : le navigateur retarde chaque pause d'au moins une seconde (127 s au lieu de
       3 s mesurés) ; personne ne regarde la page, on calcule donc d'un bloc. */
    const cache = typeof document !== "undefined" && document.visibilityState === "hidden";
    const { brut, resume:r } = await calculerCollisions(modele,
      { tolerance:a.tolerance === undefined ? 0.1 : +a.tolerance, pauses:!cache });
    if(cache) r.note = "Onglet caché : calcul fait d'un bloc.";
    if(a.afficher){
      // Le résultat déjà calculé, dessiné comme le fait le bouton Collisions : pas de second calcul
      ui.effacerCollisions?.();
      ui.collisions = maillageCollisions(brut);
      vue.annotations.add(ui.collisions);
      if(typeof document !== "undefined") document.getElementById("bCollisions")?.classList.add("on");
      ui.afficherCollisions?.(brut);
      vue.invalider();
    }
    return r;
  } });

  /* --- ouvrir : remplacement ou ajout, annulable --------------------------- */
  Pilote.commande("web3d_ouvrir", {
    ecriture:true,
    proposer:async a => {
      const r = await fetch("api/projets", { cache:"no-store" });
      if(!r.ok) throw new Error(`Liste de PROJETS/3D illisible : ${r.status}.`);
      const liste = await r.json();
      if(!liste.dispo) throw new Error("WEB_3D n'a pas de dossier PROJETS (lancé sans --projets).");
      const chemins = preparerOuverture(a.chemins, liste.fichiers || []);
      const ajout = !!a.ajout && modele.children.length > 0;
      return { titre:ajout ? "Ajouter à la scène" : "Ouvrir (remplace la scène)", chemins, ajout, scene:signature(),
               avant:modele.children.map(g => nomSur(g.name)).join(" + ") || "scène vide", apres:chemins.join(" + ") };
    },
    appliquer:async (a, prop) => {
      if(signature() !== prop.scene) throw new Error("La scène a changé depuis la carte : redemande-la.");
      const avant = { fichiers:[...(ui.derniersFichiers || [])], matrices:etatMatrices(modele), vide:!modele.children.length };
      const r = await ui.charger(await lireFichiersProjets(prop.chemins), prop.ajout);
      if(!r || !r.ok) throw new Error((r && r.erreur) || "Ouverture impossible.");
      // Un groupe par modèle, dans l'ordre : chacun garde son chemin dans PROJETS (web3d_scene le rend)
      const modeles = prop.chemins.filter(c => formatDe(c));
      r.groupes.forEach((g, i) => { if(modeles[i]) g.userData.projet = modeles[i]; });
      return { avant, groupes:r.groupes, ajout:r.ajout };
    },
    annuler:async (_a, j) => {
      if(j.ajout){
        // Comme charger et fermer : sélection, isolement et collisions ne doivent pas viser des pièces retirées
        const retire = o => j.groupes.some(g => { let x = o; while(x){ if(x === g) return true; x = x.parent; } return false; });
        if(arbre.isole && retire(arbre.isole)) arbre.toutAfficher();
        arbre.selectionner(null);
        ui.effacerCollisions?.();
        for(const g of j.groupes){ modele.remove(g); liberer(g); }
        ui.derniersFichiers = j.avant.fichiers;
        vue.recenserMateriaux?.(); ui.mesure?.annuler?.(); ui.appliquerCoupe?.();
        arbre.reconstruire(); vue.adapterAuModele(); ui.surModeleChange?.(); ui.majEtatBoutons?.(); vue.invalider();
        if(typeof document !== "undefined")
          document.title = `${modele.children.map(g => g.name).join(" + ")} — Visionneuse 3D`;
      }else if(j.avant.vide){
        ui.fermer();
      }else{
        const r = await ui.charger(j.avant.fichiers, false);
        if(!r || !r.ok) throw new Error((r && r.erreur) || "Le modèle d'avant ne se rouvre pas.");
        remettreMatrices(modele, j.avant.matrices);
        rafraichirTous();
      }
    },
    etat:() => JSON.stringify(etatMatrices(modele)),
  });

  /* --- déplacer : un fichier, annulable par les matrices ------------------- */
  Pilote.commande("web3d_deplacer", {
    ecriture:true,
    proposer:a => {
      const g = trouverFichier(modele, a.fichier);
      const quoi = [];
      if(a.origine) quoi.push("retour à l'origine du fichier");
      if(a.position) quoi.push(`position ${a.position.join(" ; ")} mm`);
      if(a.translation) quoi.push(`translation ${a.translation.join(" ; ")} mm`);
      if(a.rotation_deg) quoi.push(`rotation ${a.rotation_deg.join(" ; ")}° (autour du centre)`);
      if(a.contrainte) quoi.push(`contrainte : face ${a.contrainte.mobile.face} sur face ${a.contrainte.fixe.face}` +
                                 (a.contrainte.decalage ? `, décalage ${a.contrainte.decalage} mm` : ""));
      if(!quoi.length) throw new Error("Rien à faire : position, translation, rotation_deg, origine ou contrainte.");
      // L'aperçu : on applique, on lit, on remet (une contrainte impossible échoue dès la carte)
      const lire = () => `position ${vec(g.position).join(" ; ")} mm, rotation ${
        [g.rotation.x, g.rotation.y, g.rotation.z].map(r => arrondir(r * DEG)).join(" ; ")}°`;
      const jeton = etatMatrices(modele), avant = lire();
      let apres;
      try{ deplacer(g, a); if(a.contrainte) contrainte(modele, g, a.contrainte); apres = lire(); }
      finally{ remettreMatrices(modele, jeton); }
      return { titre:`Déplacer « ${nomSur(g.name)} »`, uuid:g.uuid, details:quoi.join("\n"), avant, apres };
    },
    appliquer:(a, prop) => {
      const jeton = etatMatrices(modele);
      const g = trouverFichier(modele, a.fichier);
      if(prop && prop.uuid && g.uuid !== prop.uuid)
        throw new Error("La scène a changé depuis la carte (ce n'est plus le même fichier) : redemande-la.");
      try{
        deplacer(g, a);
        if(a.contrainte) contrainte(modele, g, a.contrainte);
      }catch(e){ remettreMatrices(modele, jeton); throw e; }      // rien à moitié
      rafraichir(g);
      return jeton;
    },
    annuler:(_a, jeton) => { remettreMatrices(modele, jeton); rafraichirTous(); },
    etat:() => JSON.stringify(etatMatrices(modele)),
  });

  /* --- ranger le STEP d'une pièce dans PROJETS/3D (irréversible ici) -------- */
  Pilote.commande("web3d_ranger_step", {
    ecriture:true,
    irreversible:"Crée un nouveau fichier dans PROJETS/3D (jamais d'écrasement : un nom pris devient « x (2) ») ; non annulable ici.",
    proposer:a => {
      const r = extraireStep(modele, [a.piece]);
      let nom = sanitiserNomFichier(a.nom || r.produits[0]).slice(-100);
      if(!/^[\w(]/.test(nom)) nom = "piece_" + nom;       // le serveur exige une lettre, un chiffre ou « ( » en tête
      return { titre:`Ranger « ${nomSur(nom)} » dans PROJETS/3D`, nom, texte:r.texte,
               details:`Pièce « ${nomSur(r.produits[0])} », ${Math.round(r.octets / 1024)} ko. ${r.note}` };
    },
    appliquer:async (_a, prop) => {
      const r = await fetch("api/projets?nom=" + encodeURIComponent(prop.nom),
                            { method:"POST", headers:{ "X-Web3D":"1" }, body:prop.texte });
      if(!r.ok){
        let detail = "";
        try{ detail = (await r.json()).detail || ""; }catch(_){ /* corps illisible */ }
        throw new Error(`Rangement refusé par le serveur : ${detail || r.status}.`);
      }
      delete prop.texte;                                   // le STEP n'a plus à rester en mémoire dans la carte
      return await r.json();
    },
  });
}
