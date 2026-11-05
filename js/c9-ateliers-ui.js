/* =============================================================================
   Conception 3D — c9-ateliers-ui.js
   L'interface des ateliers Surface, Assemblage, Tôlerie, Soudures et des
   insertions : les champs de leurs opérations, les désignations dans la vue, la
   poignée qu'on tire pour régler une distance, l'animation des liaisons, l'éclaté,
   le développé, et le dessin de ce que le noyau ne construit pas (axes, points,
   filetages cosmétiques, images de référence).
   Tout passe par le contrôleur de c6-conception.js (`c`).
   ============================================================================= */
"use strict";

import * as THREE from "three";
import { ouvrirFichiers as lireMaillages } from "./02-import.js";
import { faceSous } from "./06-topologie.js";
import { telechargerFichier } from "./10-export-step.js";
import { nomProjet } from "./11-projets.js";
import { perimerCaches } from "./13-deplacement.js";
import { repere, profils, dedans, axeConstruction, pointConstruction, pointsChemin3d, axePerpendiculaire } from "./c2-esquisse.js";
import { VISSERIE } from "./c3b-ateliers.js";
import { lireNuage } from "./c12-exports.js";
import { demanderTexte, avertir } from "./c0-dialogues.js";

const $ = (id) => document.getElementById(id);
const estNombre = (t) => /^\s*-?\d+(?:[.,]\d+)?\s*$/.test(String(t));
const arrondi = (p) => p.toArray().map(x => +x.toFixed(5));
const POSE = [...["tx", "ty", "tz"].map((c, i) => ({ cle:c, type:"expr", nom:`Translation ${"XYZ"[i]} (mm)` })),
              ...["rx", "ry", "rz"].map((c, i) => ({ cle:c, type:"expr", nom:`Rotation ${"XYZ"[i]} (°)` }))];
const COORD = (s, nom, si) => ["x", "y", "z"].map(c => ({ cle:c + s, type:"expr", nom:`${nom} ${c.toUpperCase()} (mm)`, si }));
const TAILLES = Object.fromEntries(Object.keys(VISSERIE).map(m => [m, m]));
const SECTIONS = { carre:"Tube ou barre carrée", rond:"Tube ou barre ronde", corniere:"Cornière", plat:"Plat" };

/** Les champs : ils s'ajoutent à ceux de c6-conception.js. */
export function champsAteliers({ NOM, MODE, CIBLE, POSITION }){
  return {
    surfExtrusion:[NOM, { cle:"esquisse", type:"esquisse", nom:"Esquisse" }, { cle:"distance", type:"expr", nom:"Distance (mm)" }, { cle:"inverse", type:"case", nom:"Inverser le sens" }],
    surfRevolution:[NOM, { cle:"esquisse", type:"esquisse", nom:"Esquisse" }, { cle:"axe", type:"choix", nom:"Axe", options:{ x:"Axe X de l'esquisse", y:"Axe Y de l'esquisse" } }, { cle:"angle", type:"expr", nom:"Angle (°)" }],
    surfBalayage:[NOM, { cle:"esquisse", type:"esquisse", nom:"Profil" }, { cle:"chemin", type:"esquisse", nom:"Chemin" }],
    surfLissage:[NOM, { cle:"esquisses", type:"esquisses", nom:"Sections (dans l'ordre coché)" }, { cle:"regle", type:"case", nom:"Surfaces réglées" }],
    surfRemplissage:[NOM, { cle:"esquisse", type:"esquisse", nom:"Esquisse (contour plan)" }, { cle:"contours", type:"contours", nom:"Contours (aucun coché : tous)" },
      { cle:"aretes", type:"designer", nom:"Ou un contour d'arêtes", quoi:"aretes" }],
    surfAjuster:[NOM, { cle:"corps", type:"corps", nom:"Surface" }, { cle:"outil", type:"corps", nom:"Volume qui coupe", choisir:true },
      { cle:"garder", type:"choix", nom:"Garder", options:{ dehors:"Ce qui est dehors", dedans:"Ce qui est dedans" } }],
    surfProlonger:[NOM, { cle:"corps", type:"corps", nom:"Surface" }, { cle:"aretes", type:"designer", nom:"Arêtes à prolonger", quoi:"aretes" }, { cle:"distance", type:"expr", nom:"Distance (mm)" }],
    surfCoudre:[NOM, { cle:"corps", type:"corps", nom:"Surface" }, { cle:"outils", type:"corpsMulti", nom:"Surfaces à coudre" }, { cle:"solide", type:"case", nom:"Fermée : en faire un volume" }],
    surfDecaler:[NOM, { cle:"corps", type:"corps", nom:"Surface" }, { cle:"distance", type:"expr", nom:"Distance (mm, négative : de l'autre côté)" }],
    surfEpaissir:[NOM, { cle:"corps", type:"corps", nom:"Surface" }, { cle:"epaisseur", type:"expr", nom:"Épaisseur (mm)" }, { cle:"inverse", type:"case", nom:"De l'autre côté" }],
    composant:[NOM, ...POSE],
    liaison:[NOM, { cle:"mode", type:"choix", nom:"Type", options:{ rigide:"Rigide", pivot:"Pivot", glissiere:"Glissière" } },
      { cle:"repereA", type:"designer", nom:"Face du corps fixe", quoi:"repereA" }, { cle:"repereB", type:"designer", nom:"Face du corps mobile", quoi:"repereB" },
      { cle:"corpsA", type:"corps", nom:"Corps fixe", choisir:true }, { cle:"corpsB", type:"corps", nom:"Corps mobile", choisir:true },
      { cle:"decalage", type:"expr", nom:"Décalage (mm)" },
      { cle:"valeur", type:"expr", nom:"Angle (°)", si:(o) => o.mode === "pivot" }, { cle:"valeur", type:"expr", nom:"Position (mm)", si:(o) => o.mode === "glissiere" }],
    ancrer:[NOM, { cle:"corps", type:"corps", nom:"Corps à ancrer" }],
    tole:[NOM, { cle:"esquisse", type:"esquisse", nom:"Esquisse" }, { cle:"contours", type:"contours", nom:"Contours (aucun coché : tous)" },
      { cle:"epaisseur", type:"expr", nom:"Épaisseur (mm)" }, { cle:"rayon", type:"expr", nom:"Rayon de pliage (mm)" }, { cle:"k", type:"expr", nom:"Facteur K" }, { cle:"inverse", type:"case", nom:"Inverser le sens" }],
    bride:[NOM, { cle:"corps", type:"corps", nom:"Tôle" }, { cle:"arete", type:"designer", nom:"Arête", quoi:"arete" }, { cle:"hauteur", type:"expr", nom:"Hauteur (mm)" },
      { cle:"angle", type:"expr", nom:"Angle (°)" }, { cle:"rayon", type:"expr", nom:"Rayon (mm, vide : celui de la tôle)", vide:true }, { cle:"vers", type:"choix", nom:"Vers", options:{ haut:"Le haut", bas:"Le bas" } }],
    ourlet:[NOM, { cle:"corps", type:"corps", nom:"Tôle" }, { cle:"arete", type:"designer", nom:"Arête", quoi:"arete" }, { cle:"hauteur", type:"expr", nom:"Longueur repliée (mm)" },
      { cle:"rayon", type:"expr", nom:"Rayon (mm)" }, { cle:"vers", type:"choix", nom:"Vers", options:{ haut:"Le haut", bas:"Le bas" } }],
    pli:[NOM, { cle:"corps", type:"corps", nom:"Tôle" }, { cle:"esquisse", type:"esquisse", nom:"Esquisse (ligne de pli)" }, { cle:"angle", type:"expr", nom:"Angle (°)" }, { cle:"rayon", type:"expr", nom:"Rayon (mm, vide : celui de la tôle)", vide:true },
      { cle:"vers", type:"choix", nom:"Vers", options:{ haut:"Le haut", bas:"Le bas" } }, { cle:"inverse", type:"case", nom:"Plier l'autre côté" }],
    profile:[NOM, { cle:"esquisse", type:"esquisse", nom:"Ossature (lignes)" }, { cle:"section", type:"choix", nom:"Section", options:SECTIONS },
      { cle:"a", type:"expr", nom:"Diamètre, ou cote hors du plan de l'esquisse (mm)" }, { cle:"b", type:"expr", nom:"Cote dans le plan de l'esquisse (mm)", si:(o) => o.section !== "rond" },
      { cle:"ep", type:"expr", nom:"Paroi (mm, 0 : plein)" }, { cle:"joint", type:"choix", nom:"Coins", options:{ onglet:"En onglet", droit:"Coupés droits" } }, { cle:"fusion", type:"case", nom:"Tout en un seul corps" }],
    vis:[NOM, { cle:"modele", type:"choix", nom:"Élément", options:{ chc:"Vis CHC (ISO 4762)", hexa:"Vis H (ISO 4014)", ecrou:"Écrou (ISO 4032)", rondelle:"Rondelle (ISO 7089)" } },
      { cle:"norme", type:"choix", nom:"Taille", options:TAILLES }, { cle:"longueur", type:"expr", nom:"Longueur sous tête (mm)", si:(o) => o.modele === "chc" || o.modele === "hexa" }, ...POSITION],
    maillage:[NOM, { cle:"reference", type:"case", nom:"Référence (pour dessiner autour, non exportée)" },
      { cle:"fusionner", type:"case", nom:"Convertir : réunir les faces planes", si:(o) => !o.reference }],
    filetage:[NOM, { cle:"corps", type:"corps", nom:"Corps" }, { cle:"cylindre", type:"designer", nom:"Face cylindrique", quoi:"cylindreAxe" },
      { cle:"taille", type:"choix", nom:"Taille", options:{ "":"D'après le diamètre", ...TAILLES } },
      { cle:"modele", type:"case", nom:"Modélisé, pour imprimer (calcul long)" },
      { cle:"jeu", type:"expr", nom:"Jeu d'impression (mm)", si:(o) => o.modele }],
    axe:[NOM, { cle:"mode", type:"choix", nom:"Par", options:{ points:"Deux points", cylindre:"L'axe d'un cylindre" } },
      { cle:"cylindre", type:"designer", nom:"Face cylindrique", quoi:"cylindreAxe", si:(o) => o.mode === "cylindre" },
      { cle:"sommets", type:"designer", nom:"Sommets du modèle", quoi:"sommets", nb:2, si:(o) => o.mode !== "cylindre" },
      ...COORD("1", "Point 1", (o) => o.mode !== "cylindre"), ...COORD("2", "Point 2", (o) => o.mode !== "cylindre")],
    point:[NOM, { cle:"sommets", type:"designer", nom:"Sommet du modèle", quoi:"sommets", nb:1 }, ...COORD("1", "Position")],
    plan:[NOM, { cle:"mode", type:"choix", nom:"Par", options:{ decale:"Décalage et inclinaison", median:"Milieu de deux décalages", trois:"Trois points" } },
      { cle:"base", type:"choix", nom:"Plan de départ", options:{ XY:"XY (dessus)", XZ:"XZ (face)", YZ:"YZ (côté)" }, si:(o) => o.mode !== "trois" },
      { cle:"decalage", type:"expr", nom:"Décalage (mm)", si:(o) => o.mode !== "trois" }, { cle:"decalage2", type:"expr", nom:"Décalage 2 (mm)", si:(o) => o.mode === "median" },
      { cle:"angle", type:"expr", nom:"Inclinaison (°)", si:(o) => !o.mode || o.mode === "decale" }, { cle:"axe", type:"choix", nom:"Autour de", options:{ x:"Axe X du plan", y:"Axe Y du plan" }, si:(o) => !o.mode || o.mode === "decale" },
      { cle:"sommets", type:"designer", nom:"Sommets du modèle", quoi:"sommets", nb:3, si:(o) => o.mode === "trois" },
      ...COORD("1", "Point 1", (o) => o.mode === "trois"), ...COORD("2", "Point 2", (o) => o.mode === "trois"), ...COORD("3", "Point 3", (o) => o.mode === "trois")],
    image:[NOM, { cle:"base", type:"choix", nom:"Plan", options:{ XY:"XY (dessus)", XZ:"XZ (face)", YZ:"YZ (côté)", face:"Sur une face (décalque)" } },
      { cle:"face", type:"designer", nom:"Face", quoi:"faceTiree", si:(o) => o.base === "face" }, { cle:"decalage", type:"expr", nom:"Décalage (mm)", si:(o) => o.base !== "face" },
      { cle:"calibre", type:"designer", nom:"Calibrer : une longueur connue", quoi:"calibrer" },
      { cle:"largeur", type:"expr", nom:"Largeur (mm)" }, { cle:"x", type:"expr", nom:"Centre X du plan (mm)" }, { cle:"y", type:"expr", nom:"Centre Y du plan (mm)" }, { cle:"opacite", type:"expr", nom:"Opacité (0 à 1)" }],
  };
}

export function defautsAteliers({ derniere, avant, mode, P, premierCorps }){
  const Z = { x1:"0", y1:"0", z1:"0", x2:"0", y2:"0", z2:"10", x3:"10", y3:"0", z3:"0" };
  return {
    surfExtrusion:{ esquisse:derniere, distance:"10", inverse:false },
    surfRevolution:{ esquisse:derniere, axe:"y", angle:"360" },
    surfBalayage:{ esquisse:avant, chemin:derniere },
    surfLissage:{ esquisses:[], regle:false },
    surfRemplissage:{ esquisse:derniere, aretes:[] },
    surfAjuster:{ corps:"", outil:"", garder:"dehors" },
    surfProlonger:{ corps:"", aretes:[], distance:"5" },
    surfCoudre:{ corps:premierCorps, outils:[], solide:false },
    surfDecaler:{ corps:"", distance:"2" },
    surfEpaissir:{ corps:"", epaisseur:"2", inverse:false },
    composant:{ tx:"0", ty:"0", tz:"0", rx:"0", ry:"0", rz:"0" },
    liaison:{ mode:"rigide", corpsA:"", corpsB:"", repereA:null, repereB:null, decalage:"0", valeur:"0" },
    ancrer:{ corps:premierCorps },
    tole:{ esquisse:derniere, epaisseur:"2", rayon:"2", k:"0.44", inverse:false },
    bride:{ corps:"", arete:null, hauteur:"20", angle:"90", rayon:"", vers:"haut" },
    ourlet:{ corps:"", arete:null, hauteur:"10", rayon:"0.5", vers:"haut" },
    pli:{ corps:"", esquisse:derniere, angle:"90", rayon:"", vers:"haut", inverse:false },
    profile:{ esquisse:derniere, section:"carre", a:"20", b:"20", ep:"2", joint:"onglet", fusion:false },
    vis:{ modele:"chc", norme:"M4", longueur:"12", ...P, operation:"nouveau" },
    filetage:{ corps:"", cylindre:null, taille:"", modele:false, jeu:"0.1" },
    axe:{ mode:"points", cylindre:null, ...Z },
    point:{ ...Z },
    plan:{ mode:"decale", base:"XY", decalage:"10", decalage2:"20", angle:"0", axe:"x", ...Z, x2:"10", z2:"0", y3:"10", x3:"0", z3:"0" },
  };
}

/* -----------------------------------------------------------------------------
   Désignations dans la vue
   --------------------------------------------------------------------------- */
export const DESIGNATIONS_UNIQUES = ["arete", "repereA", "repereB", "cylindreAxe", "calibrer"];

export const AIDES_DESIGNATION = {
  arete:"Cliquez l'arête droite de la tôle.", repereA:"Cliquez une face plane ou cylindrique du corps fixe.",
  repereB:"Cliquez une face plane ou cylindrique du corps mobile.", cylindreAxe:"Cliquez une face cylindrique.",
  aretes2:"Cliquez les arêtes du second côté, Échap pour finir.", lignes:"Cliquez deux arêtes droites.", calibrer:"Cliquez les deux bouts d'une longueur connue sur l'image.",
  sommets:"Cliquez les sommets du modèle.", contourClic:"Cliquez dans un contour de l'esquisse pour le prendre ou le retirer ; Échap pour finir.",
};

/** Un clic pendant une désignation d'atelier. Rend vrai s'il l'a prise ; `fini` arrête la désignation. */
export function clicAtelier(c, ev){
  const quoi = c.designation, op = c.edition?.op;
  if(!op || !(quoi in AIDES_DESIGNATION)) return false;
  const message = (t) => { $("etatSel").textContent = t; return true; };
  if(quoi === "contourClic"){
    const esq = c.doc.operations.find(o => o.id === op.esquisse);
    if(!esq) return true;
    const r = repere(esq.plan, c.v());
    const ray = new THREE.Raycaster();
    ray.setFromCamera(c.vue.ndc(ev), c.vue.camera());
    const pl = new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(...r.n), new THREE.Vector3(...r.o));
    const p = ray.ray.intersectPlane(pl, new THREE.Vector3());
    if(!p) return true;
    p.sub(new THREE.Vector3(...r.o));
    const m = [p.dot(new THREE.Vector3(...r.x)), p.dot(new THREE.Vector3(...r.y))];
    /* Le plus petit contour qui contient le clic : le disque, pas la plaque qui l'entoure. */
    const f = profils(esq).faces.filter(x => dedans(m, x.poly)).sort((a, b) => a.aire - b.aire)[0];
    if(!f) return message("Aucun contour ici.");
    const a = op.contours || [];
    op.contours = a.includes(f.cle) ? a.filter(x => x !== f.cle) : [...a, f.cle];
    return true;
  }
  if(quoi === "lignes"){
    const t = c.toucherArete(ev);
    if(!t) return message("Aucune arête ici.");
    const s = c.traitDe(t), bout = (i) => s.slice(i, i + 3).map(x => +x.toFixed(5));
    op.lignes = [...(op.lignes || []).slice(-1), [bout(0), bout(s.length - 3)]];
    if(op.lignes.length === 2) c.designer(null);
    return true;
  }
  if(quoi === "aretes2"){
    const p = c.areteSous(ev);
    if(!p) return message("Aucune arête ici.");
    const l = op.aretes2 || (op.aretes2 = []);
    const i = l.findIndex(q => Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) < 1e-3);
    if(i >= 0) l.splice(i, 1); else l.push(p);
    return true;
  }
  if(quoi === "arete"){
    const t = c.toucherArete(ev), p = c.areteSous(ev);
    if(!p) return message("Aucune arête ici.");
    op.arete = p;
    op.corps = t.objet.parent.name;      // plusieurs tôles : celle de l'arête cliquée, pas la dernière
    c.designer(null);
    return true;
  }
  if(quoi === "calibrer"){
    const r = repereImage(op, c.v());
    const ray = new THREE.Raycaster();
    ray.setFromCamera(c.vue.ndc(ev), c.vue.camera());
    const p = ray.ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(...r.n), new THREE.Vector3(...r.o)), new THREE.Vector3());
    if(!p) return true;
    (c.pointsCalibre ||= []).push(p);
    if(c.pointsCalibre.length < 2) return message("Second bout : cliquez-le.");
    const d = c.pointsCalibre[0].distanceTo(c.pointsCalibre[1]);
    c.pointsCalibre = [];
    c.designer(null);
    if(d < 1e-6) return message("Ces deux points sont confondus.");
    demanderTexte("Calibrer l'image", "Longueur réelle (mm)", String(+d.toFixed(3))).then(t => {
      const vraie = parseFloat(String(t).replace(",", "."));
      if(!(vraie > 0) || c.edition?.op !== op) return;
      op.largeur = String(+(c.v()(op.largeur) * vraie / d).toFixed(4));
      c.construirePanneau();
      c.apercu();
    });
    return true;
  }
  const touche = c.vue.lancerRayon(ev, c.selectionnables())[0];
  if(!touche) return true;
  if(quoi === "sommets"){
    const pos = touche.object.geometry.attributes.position, f = touche.face;
    const candidats = [f.a, f.b, f.c].map(i => new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(touche.object.matrixWorld));
    const s = candidats.sort((a, b) => a.distanceTo(touche.point) - b.distanceTo(touche.point))[0];
    const rang = c.rangSommet || 0, nb = op.type === "point" ? 1 : op.type === "axe" ? 2 : 3;
    ["x", "y", "z"].forEach((k, i) => { op[k + (rang + 1)] = String(+s.getComponent(i).toFixed(4)); });
    c.rangSommet = rang + 1;
    if(c.rangSommet >= nb) c.designer(null);
    return true;
  }
  const e = faceSous(c.vue, touche);
  if(quoi === "cylindreAxe"){
    if(e?.type !== "cylindre") return message("Cette face n'est pas cylindrique.");
    op.cylindre = { point:arrondi(e.point), axe:e.axe.toArray(), rayon:e.rayon, hauteur:e.hauteur, centre:arrondi(e.centre), surf:arrondi(touche.point) };
    if("corps" in op) op.corps = touche.object.name;
    /* Le point de construction se pose au centre du cylindre désigné. */
    if(op.type === "point") ["x1", "y1", "z1"].forEach((k, i) => { op[k] = String(+e.centre.getComponent(i).toFixed(4)); });
    c.designer(null);
    return true;
  }
  if(e?.type !== "plan" && e?.type !== "cylindre") return message("Choisissez une face plane ou cylindrique.");
  const rep = e.type === "plan" ? { type:"plan", point:arrondi(e.centre), normale:e.normale.toArray() }
    : { type:"cylindre", point:arrondi(e.point), axe:e.axe.toArray() };
  op[quoi] = rep;
  op[quoi === "repereA" ? "corpsA" : "corpsB"] = touche.object.name;
  c.designer(null);
  return true;
}

/* -----------------------------------------------------------------------------
   La poignée : une flèche qu'on tire dans la vue pour régler la distance
   --------------------------------------------------------------------------- */
function poignee(c){
  const op = c.edition?.op;
  if(!op || c.designation || !estNombre(op.distance)) return null;
  const d = parseFloat(String(op.distance).replace(",", "."));
  if(op.type === "tirer" && op.face){
    return { base:new THREE.Vector3(...op.face.point), dir:new THREE.Vector3(...op.face.normale).normalize(), d, min:-Infinity };
  }
  if(op.type === "extrusion" && (!op.sens || op.sens === "un")){
    const esq = c.doc.operations.find(o => o.id === op.esquisse);
    const f = esq && profils(esq).faces[0];
    if(!f) return null;
    let r;
    try{ r = repere(esq.plan, c.v()); }catch(_){ return null; }
    const m = f.poly.reduce((s, p) => [s[0] + p[0] / f.poly.length, s[1] + p[1] / f.poly.length], [0, 0]);
    const base = new THREE.Vector3(...r.o).addScaledVector(new THREE.Vector3(...r.x), m[0]).addScaledVector(new THREE.Vector3(...r.y), m[1]);
    return { base, dir:new THREE.Vector3(...r.n).multiplyScalar(op.inverse ? -1 : 1), d, min:0.1 };
  }
  return null;
}

/** Appui sur la pointe de la flèche : le glissé règle la distance, l'aperçu suit. */
export function poigneeBas(c, ev){
  if(ev.button !== 0) return false;
  const g = poignee(c);
  if(!g) return false;
  const pointe = c.vue.versEcran(g.base.clone().addScaledVector(g.dir, g.d));
  const r = c.vue.canvas.getBoundingClientRect();
  if(Math.hypot(pointe.x + r.left - ev.clientX, pointe.y + r.top - ev.clientY) > 16) return false;
  const op = c.edition.op;
  const ray = new THREE.Raycaster();
  const bouger = (e) => {
    ray.setFromCamera(c.vue.ndc(e), c.vue.camera());
    /* Le point de la droite de la flèche le plus proche du rayon de la souris. */
    const w = g.base.clone().sub(ray.ray.origin), a = g.dir.dot(ray.ray.direction);
    const den = 1 - a * a;
    if(Math.abs(den) < 1e-6) return;                    // la flèche pointe vers l'œil : rien à lire
    const t = (a * w.dot(ray.ray.direction) - w.dot(g.dir)) / den;
    op.distance = String(Math.max(g.min, Math.round(t * 10) / 10));
    c.majMarques();
    c.apercu();
  };
  const lacher = () => {
    removeEventListener("pointermove", bouger);
    removeEventListener("pointerup", lacher);
    if(c.edition) c.construirePanneau();
  };
  addEventListener("pointermove", bouger);
  addEventListener("pointerup", lacher);
  return true;
}

const ligneJaune = (pts, couleur = 0xf2c744) => {
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color:couleur, depthTest:false, transparent:true }));
  l.renderOrder = 12;
  return l;
};

/** Ce que le panneau ouvert montre dans la vue : contours de l'esquisse, repères, poignée. */
export function marquesAteliers(c, op){
  const g = c.marques;
  const pts = [];
  if(op?.arete) pts.push(op.arete);
  if(op?.repereA) pts.push(op.repereA.point);
  if(op?.repereB) pts.push(op.repereB.point);
  if(op?.cylindre) pts.push(op.cylindre.centre);
  if(pts.length){
    const p = new THREE.Points(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(pts.flat(), 3)),
      new THREE.PointsMaterial({ color:0xf2c744, size:10, sizeAttenuation:false, depthTest:false }));
    p.renderOrder = 12;
    g.add(p);
  }
  /* Les contours de l'esquisse visée, pour les voir et les cliquer : jaunes s'ils sont choisis. */
  const esq = op && "contours" in (CONTOURS_POSSIBLES[op.type] || {}) ? c.doc.operations.find(o => o.id === op.esquisse) : null;
  if(esq){
    try{
      const r = repere(esq.plan, c.v());
      const X = new THREE.Vector3(...r.x), Y = new THREE.Vector3(...r.y), O = new THREE.Vector3(...r.o);
      for(const f of profils(esq).faces){
        const lignes = [...f.poly, f.poly[0]].map(([x, y]) => O.clone().addScaledVector(X, x).addScaledVector(Y, y));
        g.add(ligneJaune(lignes, (op.contours || []).includes(f.cle) ? 0xf2c744 : 0x3fa0ea));
      }
    }catch(_){ /* plan illisible : signalé par le noyau */ }
  }
  const h = poignee(c);
  if(h){
    const bout = h.base.clone().addScaledVector(h.dir, h.d);
    g.add(ligneJaune([h.base, bout], 0x8af0ff));
    const pointe = new THREE.Points(new THREE.BufferGeometry().setFromPoints([bout]),
      new THREE.PointsMaterial({ color:0x8af0ff, size:14, sizeAttenuation:false, depthTest:false }));
    pointe.renderOrder = 13;
    g.add(pointe);
  }
}
const CONTOURS_POSSIBLES = { extrusion:{ contours:1 }, revolution:{ contours:1 }, gravure:{ contours:1 }, surfRemplissage:{ contours:1 }, tole:{ contours:1 }, levre:{ contours:1 }, repos:{ contours:1 } };

/* -----------------------------------------------------------------------------
   Ce que le noyau ne construit pas : axes, points, filetages, images
   --------------------------------------------------------------------------- */
export function dessinerAides(c, g){
  const v = c.v();
  const fin = c.doc.curseur ?? c.doc.operations.length;
  const taille = Math.max(10, (c.vue.rayonModele || 50));
  c.doc.operations.forEach((op, i) => {
    if(op.suspendue || i >= fin) return;
    try{
      if(op.type === "chemin3d"){
        const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pointsChemin3d(op, v).map(p => new THREE.Vector3(...p))),
          new THREE.LineBasicMaterial({ color:0xf2c744, depthTest:false, transparent:true }));
        l.raycast = () => {};
        g.add(l);
      }else if(op.type === "axe"){
        const a = axeConstruction(op, v, c.doc), o = new THREE.Vector3(...a.point), d = new THREE.Vector3(...a.dir);
        const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([o.clone().addScaledVector(d, -taille), o.clone().addScaledVector(d, taille)]),
          new THREE.LineDashedMaterial({ color:0xf2c744, dashSize:taille * 0.04, gapSize:taille * 0.02, depthTest:false, transparent:true }));
        l.computeLineDistances();
        l.raycast = () => {};
        g.add(l);
      }else if(op.type === "point"){
        const p = new THREE.Points(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...pointConstruction(op, v, c.doc))]),
          new THREE.PointsMaterial({ color:0xf2c744, size:8, sizeAttenuation:false, depthTest:false }));
        p.raycast = () => {};
        g.add(p);
      }else if(op.type === "nuage" && op.donnees){
        const octets = Uint8Array.from(atob(op.donnees), x => x.charCodeAt(0));
        const pts = new THREE.Points(new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(octets.buffer), 3)),
          new THREE.PointsMaterial({ color:0x8af0ff, size:v(op.taille ?? 2), sizeAttenuation:false }));
        pts.raycast = () => {};
        g.add(pts);
      }else if(op.type === "filetage" && op.cylindre && !op.modele){
        /* Cosmétique : des anneaux pointillés le long du cylindre, comme le trait fin d'un plan. */
        const cy = op.cylindre, axe = new THREE.Vector3(...cy.axe).normalize(), cen = new THREE.Vector3(...cy.centre);
        const rayon = op.taille ? parseFloat(op.taille.slice(1)) / 2 : cy.rayon;
        const u = new THREE.Vector3(1, 0, 0);
        if(Math.abs(u.dot(axe)) > 0.9) u.set(0, 1, 0);
        const x = u.clone().cross(axe).normalize(), y = axe.clone().cross(x);
        for(let k = -3; k <= 3; k++){
          const z = cy.hauteur * k / 6.5;
          const pts = Array.from({ length:49 }, (_, a) => cen.clone().addScaledVector(axe, z)
            .addScaledVector(x, rayon * Math.cos(a / 48 * Math.PI * 2)).addScaledVector(y, rayon * Math.sin(a / 48 * Math.PI * 2)));
          const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
            new THREE.LineDashedMaterial({ color:0x4cc38a, dashSize:rayon * 0.2, gapSize:rayon * 0.12, depthTest:false, transparent:true }));
          l.computeLineDistances();
          l.raycast = () => {};
          g.add(l);
        }
      }else if(op.type === "image" && String(op.donnees).startsWith("data:image/")){     // jamais une adresse : un fichier reçu ne doit rien aller chercher
        const tex = texture(c, op);
        const asp = tex.image?.width ? tex.image.height / tex.image.width : 1;
        const r = repereImage(op, v), L = v(op.largeur);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(L, L * asp), new THREE.MeshBasicMaterial({ map:tex, transparent:true, opacity:v(op.opacite ?? 0.6), side:THREE.DoubleSide, depthWrite:false }));
        const M = new THREE.Matrix4().makeBasis(new THREE.Vector3(...r.x), new THREE.Vector3(...r.y), new THREE.Vector3(...r.n));
        const o = new THREE.Vector3(...r.o).addScaledVector(new THREE.Vector3(...r.x), v(op.x ?? 0)).addScaledVector(new THREE.Vector3(...r.y), v(op.y ?? 0));
        M.setPosition(o);
        m.applyMatrix4(M);
        m.raycast = () => {};
        g.add(m);
      }
    }catch(_){ /* cote illisible : l'aide n'est pas dessinée, le panneau le signale */ }
  });
}

/** Le plan d'une image : un plan de base, ou une face désignée (décalque). */
export function repereImage(op, v){
  if(op.base === "face" && op.face) return repere({ origine:op.face.point, normale:op.face.normale, xdir:axePerpendiculaire(op.face.normale) }, v);
  return repere({ base:op.base === "face" ? "XY" : op.base, decalage:op.decalage ?? 0 }, v);
}

const TEXTURES = new Map();
function texture(c, op){
  let t = TEXTURES.get(op.id);
  if(t?.source === op.donnees) return t.tex;
  const tex = new THREE.TextureLoader().load(op.donnees, () => c.dessinerEsquisses());
  tex.colorSpace = THREE.SRGBColorSpace;
  TEXTURES.set(op.id, { source:op.donnees, tex });
  return tex;
}

/* -----------------------------------------------------------------------------
   Commandes : composant, maillage, image, animation, éclaté, développé, listes
   --------------------------------------------------------------------------- */
function insererOp(c, type, champs){
  if(c.edition || c.editeur.ouvert) throw new Error("terminez d'abord l'opération ou l'esquisse en cours");
  const avant = JSON.stringify(c.doc);
  const op = { id:c.nouvelId(), type, ...champs };
  c.inserer(op);
  c.ouvrirPanneau(op, avant, true);
}

const b64 = (octets) => {
  let s = "";
  for(let i = 0; i < octets.length; i += 0x8000) s += String.fromCharCode(...octets.subarray(i, i + 0x8000));
  return btoa(s);
};

/** Un fichier d'atelier, selon l'intention du bouton qui l'a demandé. Rend vrai s'il l'a pris. */
export async function fichierAtelier(c, f, ext, lien = {}){
  if(c.intention === "composant" && ext === "json"){
    c.intention = null;
    const texte = await f.text();
    const d = JSON.parse(texte);
    if(d.format !== "web3d-conception" || !Array.isArray(d.operations)) throw new Error("ce fichier n'est pas une pièce du mode conception");
    insererOp(c, "composant", { nom:f.name.replace(/\.json$/i, ""), donnees:texte, tx:"0", ty:"0", tz:"0", rx:"0", ry:"0", rz:"0", ...lien });
    return true;
  }
  if(["xyz", "csv", "pts", "ply", "txt"].includes(ext)){
    const { points, reduit, total } = lireNuage(await f.text());
    insererOp(c, "nuage", { nom:f.name, taille:"2", donnees:b64(new Uint8Array(points.buffer)) });
    if(reduit) $("etatSel").textContent = `${total} points : un sur ${reduit} gardé, pour que la pièce reste légère.`;
    return true;
  }
  if(["stl", "obj", "3mf", "glb", "gltf"].includes(ext)){
    /* Les lecteurs de la visionneuse donnent les triangles, quel que soit le format. */
    const { groupes } = await lireMaillages([f]);
    const tris = [];
    const p = new THREE.Vector3();
    for(const g of groupes){
      g.updateMatrixWorld(true);
      g.traverse(o => {
        if(!o.isMesh) return;
        const pos = o.geometry.attributes.position, idx = o.geometry.index;
        const n = idx ? idx.count : pos.count;
        for(let i = 0; i < n; i++){
          p.fromBufferAttribute(pos, idx ? idx.getX(i) : i).applyMatrix4(o.matrixWorld);
          tris.push(p.x, p.y, p.z);
        }
      });
    }
    const nb = tris.length / 9;
    if(nb > 5000) throw new Error(`${nb} triangles : 5000 au plus pour en faire un corps. Ouvrez ce maillage dans la visionneuse.`);
    insererOp(c, "maillage", { nom:f.name, reference:true, donnees:b64(new Uint8Array(new Float32Array(tris).buffer)) });
    return true;
  }
  if(["png", "jpg", "jpeg", "webp"].includes(ext)){
    /* Réduite à 1600 px : elle voyage dans le fichier, le brouillon et chaque étape d'annulation. */
    const img = await createImageBitmap(f);
    const k = Math.min(1, 1600 / Math.max(img.width, img.height));
    const toile = document.createElement("canvas");
    toile.width = Math.round(img.width * k); toile.height = Math.round(img.height * k);
    toile.getContext("2d").drawImage(img, 0, 0, toile.width, toile.height);
    const url = toile.toDataURL("image/jpeg", 0.85);
    insererOp(c, "image", { nom:f.name, donnees:url, base:"XY", decalage:"0", largeur:"100", x:"0", y:"0", opacite:"0.6" });
    return true;
  }
  return false;
}

/** Ce qui lie une opération à son fichier des projets : son chemin, et de quoi voir qu'il a changé. */
const lienDe = (f) => ({ source:f.chemin, sourceDate:f.date, sourceTaille:f.taille });

const octetsEnBase64 = async (blob) => b64(new Uint8Array(await blob.arrayBuffer()));

/** Les opérations liées dont le fichier a changé (ou disparu) dans le dossier des projets. */
async function etatLiens(c){
  const liees = c.doc.operations.filter(o => o.source);
  if(!liees.length || !c.projetsDispo) return { liees, changees:[], perdues:[] };
  const { fichiers } = await (await fetch("api/projets", { cache:"no-store" })).json();
  const par = new Map(fichiers.map(f => [f.chemin, f]));
  return { liees, par, perdues:liees.filter(o => !par.has(o.source)),
    changees:liees.filter(o => { const f = par.get(o.source); return f && (f.date !== o.sourceDate || f.taille !== o.sourceTaille); }) };
}

/** Le bouton s'allume si un fichier lié a changé : la mise à jour reste un geste, jamais une surprise. */
export async function verifierLiens(c){
  try{
    const { changees, perdues } = await etatLiens(c);
    $("bMajComposants").classList.toggle("alerte", changees.length > 0 || perdues.length > 0);
    $("bMajComposants").title = changees.length ? `À mettre à jour : ${changees.map(o => o.nom).join(", ")}`
      : perdues.length ? `Fichier introuvable : ${perdues.map(o => o.source).join(", ")}` : "Reprendre les composants et STEP dont le fichier a changé";
    return { changees, perdues };
  }catch(_){ return { changees:[], perdues:[] }; }     // liste indisponible : rien à signaler
}

/**
 * Reprend le contenu des fichiers liés qui ont changé. Tout est lu et vérifié d'abord : un fichier illisible
 * ne remplace jamais ce qu'on a, et le document n'est touché qu'en une fois, s'il est toujours celui d'avant.
 */
export async function majLiens(c){
  if(c.edition || c.editeur.ouvert){ $("etatSel").textContent = "Terminez d'abord l'opération ou l'esquisse en cours."; return 0; }
  const doc = c.doc;
  let etat;
  try{ etat = await etatLiens(c); }
  catch(e){ $("etatSel").textContent = `⚠ Dossier des projets injoignable : ${e.message}`; return 0; }
  const { changees, perdues, par } = etat;
  if(!changees.length){
    $("etatSel").textContent = perdues.length ? `⚠ Fichier introuvable : ${perdues.map(o => o.source).join(", ")}` : "Tout est à jour.";
    return 0;
  }
  const lus = [], refuses = [];
  for(const o of changees){
    try{
      const r = await fetch("projets/" + o.source.split("/").map(encodeURIComponent).join("/"), { cache:"no-store" });
      if(!r.ok) throw new Error(String(r.status));
      if(o.type === "composant"){
        const texte = await r.text(), d = JSON.parse(texte);
        if(d?.format !== "web3d-conception" || !Array.isArray(d.operations)) throw new Error("pas une pièce du mode conception");
        lus.push({ o, donnees:texte });
      }else{
        const blob = await r.blob();
        if(blob.size > 60e6) throw new Error("plus de 60 Mo");
        lus.push({ o, donnees:await octetsEnBase64(blob) });
      }
    }catch(e){ refuses.push(`${o.nom} (${e.message})`); }
  }
  if(c.doc !== doc || c.edition || c.editeur.ouvert){ $("etatSel").textContent = "Mise à jour abandonnée : la pièce a changé entre-temps."; return 0; }
  if(lus.length){
    c.memoriser();
    for(const { o, donnees } of lus){
      o.donnees = donnees;
      o.sourceDate = par.get(o.source).date;
      o.sourceTaille = par.get(o.source).taille;
    }
    c.marquerModifie();
  }
  $("etatSel").textContent = (lus.length ? `${lus.length} mis à jour : ${lus.map(l => l.o.nom).join(", ")}.` : "")
    + (refuses.length ? ` ⚠ Gardés tels quels : ${refuses.join(", ")}.` : "");
  await verifierLiens(c);
  if(lus.length) await c.reconstruire();
  return lus.length;
}

/** Un STEP : ceux du dossier des projets (liés à leur fichier : une carte de WEB_CAO y est rangée), ou un fichier. */
async function menuStep(c, ev){
  const r = ev.currentTarget.getBoundingClientRect();
  const parFichier = { texte:"Depuis un fichier…", action:() => c.choisirFichier(".stp,.step") };
  let steps = [];
  if(c.projetsDispo){
    try{ steps = (await (await fetch("api/projets", { cache:"no-store" })).json()).fichiers.filter(f => /\.(stp|step)$/i.test(f.chemin)); }
    catch(_){ /* liste indisponible : le choix par fichier reste */ }
  }
  c.menu([...steps.slice(0, 12).map(f => ({ texte:f.chemin, action:async () => {
    try{
      const rep = await fetch("projets/" + f.chemin.split("/").map(encodeURIComponent).join("/"), { cache:"no-store" });
      if(!rep.ok) throw new Error(String(rep.status));
      await c.insererStep(new File([await rep.blob()], f.chemin.split("/").pop()), lienDe(f));
    }catch(e){ avertir(`Impossible d'insérer : ${e.message}`); }
  } })), ...(steps.length ? ["-"] : []), parFichier], r.left, r.bottom + 2);
}

/** Une pièce à insérer : celles du dossier des projets, ou un fichier. */
async function menuComposant(c, ev){
  const r = ev.currentTarget.getBoundingClientRect();
  const parFichier = { texte:"Depuis un fichier…", action:() => c.choisirFichier(".json", "composant") };
  let pieces = [];
  if(c.projetsDispo){
    try{ pieces = (await (await fetch("api/projets", { cache:"no-store" })).json()).fichiers.filter(f => /\.json$/i.test(f.chemin)); }
    catch(_){ /* liste indisponible : le choix par fichier reste */ }
  }
  c.menu([...pieces.slice(0, 12).map(f => ({ texte:f.chemin, action:async () => {
    try{
      const rep = await fetch("projets/" + f.chemin.split("/").map(encodeURIComponent).join("/"), { cache:"no-store" });
      if(!rep.ok) throw new Error(String(rep.status));
      c.intention = "composant";
      await fichierAtelier(c, new File([await rep.blob()], f.chemin.split("/").pop()), "json", lienDe(f));
    }catch(e){ avertir(`Impossible d'insérer : ${e.message}`); }
  } })), ...(pieces.length ? ["-"] : []), parFichier], r.left, r.bottom + 2);
}

/** Fait varier la valeur d'une liaison et reconstruit à chaque pas ; un second appui arrête. */
async function animer(c, op, de, a, pas){
  c.animation = true;
  $("bAnimer").classList.add("on");
  const doc = c.doc;
  for(let i = 0; i <= pas && c.animation && c.doc === doc && doc.operations.includes(op); i++){
    while(c.enCours) await new Promise(r => setTimeout(r, 30));     // un pas à la fois, le calcul en cours d'abord
    /* La valeur ne passe que par le document envoyé au noyau : la pièce n'est jamais modifiée. */
    c.valeurAnimee = { id:op.id, valeur:String(de + (a - de) * i / pas) };
    await c.reconstruire();
  }
  c.animation = false;
  c.valeurAnimee = null;
  $("bAnimer").classList.remove("on");
  c.reconstruire();
}

/** Éclaté : les corps s'écartent du centre de la pièce, à l'affichage seulement. */
export function appliquerEclate(c){
  const f = c.eclate || 0;
  const corps = c.vue.modele.children.filter(o => o.userData.estPiece);
  const b = c.vue.boite?.(c.vue.modele);
  for(const m of corps) m.position.set(0, 0, 0);
  c.vue.modele.updateMatrixWorld(true);
  if(f && b && corps.length > 1){
    const centre = new THREE.Box3().setFromObject(c.vue.modele).getCenter(new THREE.Vector3());
    for(const m of corps){
      const ci = new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3());
      m.position.copy(ci.sub(centre).multiplyScalar(f));
    }
  }
  for(const m of corps) perimerCaches(m);
  c.ui.mesure.annuler();
  c.vue.adapterAuModele();
  c.ui.appliquerCoupe();
  if(c.ui.collisions) c.ui.lancerCollisions();
  c.vue.invalider();
}

export function brancherAteliers(c){
  $("bInsererPiece").onclick = (e) => menuComposant(c, e);
  $("bInsererStep").onclick = (e) => menuStep(c, e);
  $("bMajComposants").onclick = () => majLiens(c);
  /* Un fichier lié a pu changer dans WEB_CAO ou une autre pièce : on regarde en revenant sur la page. */
  let vu = 0;
  addEventListener("focus", () => { if(Date.now() - vu > 10000){ vu = Date.now(); verifierLiens(c); } });
  $("bInsererMaillage").onclick = () => c.choisirFichier(".stl,.obj,.3mf");
  $("bInsererImage").onclick = () => c.choisirFichier(".png,.jpg,.jpeg,.webp");
  $("bAnimer").onclick = (e) => {
    if(c.animation){ c.animation = false; return; }
    const r = e.currentTarget.getBoundingClientRect();
    const liaisons = c.doc.operations.filter(o => o.type === "liaison" && o.mode !== "rigide" && !o.pilote);
    if(!liaisons.length){ $("etatSel").textContent = "Aucune liaison pivot ou glissière à animer."; return; }
    c.menu(liaisons.map(o => ({ texte:o.nom, action:async () => {
      const t = await demanderTexte("Animer la liaison", "Valeur de départ, d'arrivée, nombre de pas", o.mode === "pivot" ? "0, 360, 24" : "0, 50, 20");
      const n = (t || "").split(",").map(Number);
      if(n.length === 3 && n.every(Number.isFinite) && n[2] >= 1) animer(c, o, n[0], n[1], Math.min(Math.round(n[2]), 200));
    } })), r.left, r.bottom + 2);
  };
  $("bEclate").onclick = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const poser = (f) => { c.eclate = f; $("bEclate").classList.toggle("on", !!f); appliquerEclate(c); };
    const vues = c.doc.eclates || [];
    c.menu([...[0, 0.5, 1, 2].map(f => ({ texte:`${(c.eclate || 0) === f ? "✓ " : ""}${f ? "Écarter ×" + f : "Assemblé"}`, action:() => poser(f) })),
      ...vues.map(x => ({ texte:`${c.eclate === x.f ? "✓ " : ""}${x.nom} (×${x.f})`, action:() => poser(x.f) })),
      "-", { texte:"Enregistrer cet écart sous un nom…", desactive:!c.eclate, action:async () => {
        const n = await demanderTexte("Vue éclatée", "Nom", `Éclaté ${vues.length + 1}`);
        if(n?.trim()) c.modifierDoc(() => { (c.doc.eclates ||= []).push({ nom:n.trim(), f:c.eclate }); });
      } },
      ...(vues.length ? [{ texte:"Oublier les vues éclatées", action:() => c.modifierDoc(() => { c.doc.eclates = []; }) }] : [])], r.left, r.bottom + 2);
  };
  $("bDeplier").onclick = () => {
    c.plat = !c.plat;
    $("bDeplier").classList.toggle("on", c.plat);
    $("etatSel").textContent = c.plat ? "Tôle dépliée : développé à plat. Recliquez pour la replier." : "";
    c.reconstruire();
  };
  $("bDxf").onclick = async () => {
    c.ui.attendre(true, "Développé DXF…", "");
    try{
      const r = await c.envoyer({ type:"developpe", doc:c.docPourNoyau() });
      telechargerFichier(r.dxf, nomProjet(c.doc.nom) + "-developpe.dxf", "application/dxf");
      if(r.enErreur.length || r.apres.length) avertir("Développé exporté, à vérifier :"
        + (r.enErreur.length ? `\n· en erreur à plat, absentes du DXF : ${r.enErreur.join(", ")}` : "")
        + (r.apres.length ? `\n· faites après un pli, peut-être absentes du DXF : ${r.apres.join(", ")}` : ""));
    }catch(e){
      if(e.fatale) c.relancerNoyau("Le noyau s'est planté pendant le développé : il a été relancé.");
      else if(!e.abandon) avertir(`Développé impossible : ${e.message}`);
    }
    finally{ c.ui.attendre(false); }
  };
  const csv = (nom, lignes) => telechargerFichier(lignes.join("\n"), `${nomProjet(c.doc.nom)}-${nom}.csv`, "text/csv");
  const fx = (x) => String(+x.toFixed(3)).replace(".", ",");
  $("bTablePlis").onclick = () => {
    const et = c.resultat?.etats || {};
    const plis = c.doc.operations.filter(o => et[o.id]?.pli);
    if(!plis.length){ $("etatSel").textContent = "Aucun pli dans cette pièce."; return; }
    csv("pliage", ["opération;angle (°);rayon (mm);longueur dépliée (mm);longueur du pli (mm)",
      ...plis.map(o => { const p = et[o.id].pli; return [o.nom, fx(p.angle), fx(p.rayon), fx(p.ba), fx(p.longueur)].join(";"); })]);
  };
  $("bDebit").onclick = () => {
    const et = c.resultat?.etats || {};
    const barres = c.doc.operations.filter(o => et[o.id]?.debit);
    if(!barres.length){ $("etatSel").textContent = "Aucun profilé dans cette pièce."; return; }
    csv("debit", ["opération;section;a (mm);b (mm);paroi (mm);longueur (mm)",
      ...barres.flatMap(o => et[o.id].debit.map(d => [o.nom, d.section, fx(c.v()(o.a)), fx(c.v()(o.b ?? o.a)), fx(c.v()(o.ep ?? 0)), fx(d.longueur)].join(";")))]);
  };
}
