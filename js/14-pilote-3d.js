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
import { mesurerSolide } from "./05-arbre.js";
import { analyser, faceSous, mesurerEntites } from "./06-topologie.js";
import { chercherCollisions } from "./12-collisions.js";
import { contraindre, perimerCaches } from "./13-deplacement.js";

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
    index, nom: g.name, fichier: g.userData.fichier || g.name, format: g.userData.format || "",
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
      uuid: p.uuid, chemin: cheminDe(modele, p), nom: p.name,
      parent: p.parent && p.parent !== modele ? p.parent.name : "",
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
  if(!r) throw new Error(`Distance impossible entre « ${A.name} » et « ${B.name} ».`);
  const d = r.p1.distanceTo(r.p2);
  return { distance:arrondir(d), contact:d <= 1e-6, p1:vec(r.p1), p2:vec(r.p2) };
}

/** Les faces d'une pièce : index stable (région de la topologie), type, géométrie, aire. */
export function faces(piece){
  piece.updateMatrixWorld(true);
  const topo = analyser(piece);
  if(!topo) throw new Error(`« ${piece.name} » : trop de triangles pour analyser ses faces.`);
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
const decrire = (modele, p) => ({ uuid:p.uuid, chemin:cheminDe(modele, p), nom:p.name });

/** Les pièces masquées sont ignorées ; la tolérance est un argument, jamais une préférence écrite. */
export async function collisions(modele, { tolerance = 0.1 } = {}){
  const debut = performance.now();
  const brut = await chercherCollisions(modele, { tol:tolerance, visible:o => visibleEnTout(o, modele) });
  return {
    nombre:brut.length, tolerance, duree_s:arrondir((performance.now() - debut) / 1000),
    collisions:brut.map(c => ({ a:decrire(modele, c.a), b:decrire(modele, c.b), longueur:arrondir(c.longueur) })),
  };
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
  if(!tris) throw new Error(`Face ${index} hors limites pour « ${piece.name} » (${topo ? topo.trisParRegion.length : 0} faces).`);
  return faceSous(null, { object:piece, faceIndex:tris[0] });
}

/** Plaquer deux plans ou aligner deux axes : la face mobile sur le fichier g, la fixe sur un autre. */
export function contrainte(modele, g, { mobile, fixe, decalage = 0 }){
  const pA = trouverPiece(modele, mobile.piece), pB = trouverPiece(modele, fixe.piece);
  const fichierA = modele.children[fichierDe(modele, pA)], fichierB = modele.children[fichierDe(modele, pB)];
  if(fichierA !== g) throw new Error(`La face mobile doit être sur le fichier déplacé (« ${g.name} »).`);
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
    g.position.fromArray(e.position); g.quaternion.fromArray(e.quaternion); g.scale.fromArray(e.scale);
    perimerCaches(g);
  });
}
