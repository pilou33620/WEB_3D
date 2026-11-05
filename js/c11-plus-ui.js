/* =============================================================================
   Conception 3D — c11-plus-ui.js
   L'interface des commandes ajoutées : champs et valeurs par défaut des nouvelles
   opérations, puis les boutons du ruban (exports, analyses, apparences, rendu,
   études de mouvement, points de reprise…). Tout passe par le contrôleur de
   c6-conception.js (`c`).
   ============================================================================= */
"use strict";

import * as THREE from "three";
import { prefs, enregistrerPrefs } from "./00-config.js";
import { telechargerFichier } from "./10-export-step.js";
import { nomProjet } from "./11-projets.js";
import { chercherCollisions } from "./12-collisions.js";
import { demander, avertir, confirmer } from "./c0-dialogues.js";
import { nomenclature, operationsCollees, csvBalayage, archive, dxfEsquisse, contoursImage } from "./c12-exports.js";
import { echantillonSpline, nouvelleEsquisse, ajouterPrimitives } from "./c2-esquisse.js";
import { repereImage } from "./c9-ateliers-ui.js";

const $ = (id) => document.getElementById(id);
const etat = (t) => { $("etatSel").textContent = t; };
const CLE_PRESSE_PAPIER = "web3d.conception.presse-papier";
const OUI_NON = { oui:"Oui", non:"Non" };
const CLE_FAVORIS = "web3d.conception.apparences", CLE_DISPOSITION = "web3d.conception.disposition", CLE_BIBLIOTHEQUE = "web3d.conception.bibliotheque";
const lireLocal = (cle, defaut) => { try{ return JSON.parse(localStorage.getItem(cle)) ?? defaut; }catch(_){ return defaut; } };

/* Tôles courantes : épaisseur, rayon intérieur, facteur K. */
export const REGLES_TOLE = {
  "Acier 1 mm":[1, 1, 0.42], "Acier 1,5 mm":[1.5, 1.5, 0.42], "Acier 2 mm":[2, 2, 0.44], "Acier 3 mm":[3, 3, 0.44],
  "Alu 1 mm":[1, 1, 0.4], "Alu 1,5 mm":[1.5, 1.5, 0.4], "Alu 2 mm":[2, 2.5, 0.42], "Alu 3 mm":[3, 4, 0.44],
  "Inox 1 mm":[1, 1.5, 0.44], "Inox 1,5 mm":[1.5, 2, 0.44], "Inox 2 mm":[2, 3, 0.45],
};

/* Une bibliothèque d'apparences : couleur, part de métal, rugosité, opacité. */
export const APPARENCES = {
  "Acier brossé":["#a8acb0", 0.9, 0.42, 1], "Acier poli":["#c8ccd0", 1, 0.12, 1], "Aluminium anodisé":["#b9bdc2", 0.85, 0.38, 1], "Aluminium noir":["#2a2c30", 0.8, 0.4, 1],
  Laiton:["#c9a84a", 1, 0.3, 1], Cuivre:["#b87333", 1, 0.28, 1], "Plastique noir mat":["#1c1d20", 0, 0.75, 1], "Plastique blanc":["#e8e8e4", 0, 0.45, 1],
  "PLA rouge":["#c0392b", 0, 0.5, 1], "PLA bleu":["#2869b0", 0, 0.5, 1], "PETG vert":["#3f9b5e", 0, 0.32, 1], Caoutchouc:["#26272a", 0, 0.9, 1],
  Verre:["#bcd6df", 0, 0.05, 0.35], "Circuit imprimé":["#1f5e3a", 0.1, 0.5, 1], Bois:["#9a6b3f", 0, 0.7, 1],
};

/* -----------------------------------------------------------------------------
   Champs
   --------------------------------------------------------------------------- */
const AXE_ALIGNE = { "":"Ne pas bouger", min:"Mêmes minimums", centre:"Mêmes centres", max:"Mêmes maximums", apres:"Posé après", avant:"Posé avant" };
const axes = (nom) => ({ cle:nom, type:"choix", nom:`En ${nom.toUpperCase()}`, options:AXE_ALIGNE });
const plansConstruits = (c, op) => Object.fromEntries(c.doc.operations.slice(0, c.doc.operations.indexOf(op)).filter(o => o.type === "plan").map(o => [o.id, o.nom]));

export function champsPlus({ NOM, MODE, CIBLE }){
  const E = { cle:"esquisse", type:"esquisse", nom:"Esquisse" }, C = { cle:"corps", type:"corps", nom:"Corps" };
  return {
    englobant:[NOM, { cle:"outils", type:"corpsMulti", nom:"Corps (aucun coché : tous)" }, { cle:"marge", type:"expr", nom:"Marge (mm)" }, MODE, CIBLE],
    retirerCorps:[NOM, { cle:"corps", type:"corps", nom:"Corps à retirer", choisir:true }],
    aligner:[NOM, { cle:"corps", type:"corps", nom:"Corps à déplacer" }, { cle:"reference", type:"corps", nom:"Sur le corps", choisir:true }, axes("x"), axes("y"), axes("z")],
    decalerFace:[NOM, C, { cle:"faces", type:"designer", nom:"Faces", quoi:"faces" }, { cle:"distance", type:"expr", nom:"Distance (mm, négative : enlève)" }],
    supprimerFace:[NOM, C, { cle:"faces", type:"designer", nom:"Faces", quoi:"faces" }, { cle:"ouvrir", type:"case", nom:"Laisser ouvert (une surface)" }],
    remplacerFace:[NOM, C, { cle:"faces", type:"designer", nom:"Face à remplacer", quoi:"faces" }, { cle:"outil", type:"corps", nom:"Surface de remplacement", choisir:true }],
    cellule:[NOM, { cle:"outils", type:"corpsMulti", nom:"Corps et surfaces qui bornent" }, { cle:"x", type:"expr", nom:"Point dans la cellule X (mm)" }, { cle:"y", type:"expr", nom:"Y (mm)" }, { cle:"z", type:"expr", nom:"Z (mm)" }, MODE, CIBLE],
    diviser:[NOM, C, { cle:"mode", type:"choix", nom:"Par", options:{ plan:"Un plan de construction", esquisse:"Les lignes d'une esquisse", corps:"Une surface ou un corps" } },
      { cle:"plan", type:"choix", nom:"Plan", options:(c, op) => ({ "":"— choisir —", ...plansConstruits(c, op) }), si:(o) => o.mode === "plan" },
      { ...E, si:(o) => o.mode === "esquisse" }, { cle:"outil", type:"corps", nom:"Outil", choisir:true, si:(o) => o.mode === "corps" }],
    diviserFace:[NOM, C, { cle:"faces", type:"designer", nom:"Faces à diviser", quoi:"faces" }, { ...E, nom:"Esquisse (lignes de coupe)" }],
    repChemin:[NOM, C, { cle:"chemin", type:"esquisse", nom:"Chemin" }, { cle:"nombre", type:"expr", nom:"Nombre d'exemplaires" }, { cle:"orienter", type:"case", nom:"Tourner avec le chemin" }, { cle:"separe", type:"case", nom:"Corps séparés (sinon joints)" }],
    voile:[NOM, { ...E, nom:"Esquisse (lignes)" }, C, { cle:"epaisseur", type:"expr", nom:"Épaisseur (mm)" }],

    surfReglee:[NOM, { cle:"corps", type:"corps", nom:"Surface" }, { cle:"aretes", type:"designer", nom:"Arêtes", quoi:"aretes" }, { cle:"distance", type:"expr", nom:"Distance (mm)" },
      { cle:"sens", type:"choix", nom:"Direction", options:{ tangente:"Dans le plan de la face", normale:"Selon la normale" } }],
    surfRaccord:[NOM, { cle:"aretes", type:"designer", nom:"Arêtes du premier côté", quoi:"aretes" }, { cle:"aretes2", type:"designer", nom:"Arêtes du second côté", quoi:"aretes2" }, { cle:"regle", type:"case", nom:"Raccord réglé" }],
    surfInverser:[NOM, { cle:"corps", type:"corps", nom:"Surface" }],
    surfDecoudre:[NOM, { cle:"corps", type:"corps", nom:"Surface ou corps" }],
    surfDetourer:[NOM, { cle:"corps", type:"corps", nom:"Surface" }, { cle:"faces", type:"designer", nom:"Faces à détourer", quoi:"faces" }],

    bossage:[NOM, { ...E, nom:"Esquisse des centres" }, C, { cle:"de", type:"expr", nom:"Diamètre extérieur (mm)" }, { cle:"di", type:"expr", nom:"Diamètre du trou (mm, 0 : plein)" },
      { cle:"hauteur", type:"expr", nom:"Hauteur (mm)" }, { cle:"profondeur", type:"expr", nom:"Profondeur du trou (mm)" }, { cle:"depouille", type:"expr", nom:"Dépouille (°)" },
      { cle:"nervures", type:"expr", nom:"Nervures (nombre)" }, { cle:"epNervure", type:"expr", nom:"Épaisseur des nervures (mm)" }, { cle:"largeurNervure", type:"expr", nom:"Largeur des nervures (mm)" }, { cle:"inverse", type:"case", nom:"Inverser le sens" }],
    levre:[NOM, E, { cle:"contours", type:"contours", nom:"Contours (aucun coché : tous)" }, C, { cle:"mode", type:"choix", nom:"Type", options:{ levre:"Lèvre (ajoute)", rainure:"Rainure (enlève)" } },
      { cle:"largeur", type:"expr", nom:"Largeur (mm)" }, { cle:"hauteur", type:"expr", nom:"Hauteur (mm)" }, { cle:"jeu", type:"expr", nom:"Jeu (mm)", si:(o) => o.mode === "rainure" }, { cle:"inverse", type:"case", nom:"Inverser le sens" }],
    repos:[NOM, E, { cle:"contours", type:"contours", nom:"Contours (aucun coché : tous)" }, C, { cle:"largeur", type:"expr", nom:"Largeur (mm)" }, { cle:"hauteur", type:"expr", nom:"Hauteur (mm)" }, { cle:"inverse", type:"case", nom:"Inverser le sens" }],
    clip:[NOM, { ...E, nom:"Esquisse des emplacements" }, C, { cle:"mode", type:"choix", nom:"Élément", options:{ crochet:"Crochet", logement:"Logement du crochet" } },
      { cle:"longueur", type:"expr", nom:"Longueur (mm)" }, { cle:"largeur", type:"expr", nom:"Largeur (mm)" }, { cle:"epaisseur", type:"expr", nom:"Épaisseur (mm)" },
      { cle:"crochet", type:"expr", nom:"Hauteur du crochet (mm)" }, { cle:"surplomb", type:"expr", nom:"Surplomb (mm)" }, { cle:"jeu", type:"expr", nom:"Jeu (mm)", si:(o) => o.mode === "logement" }, { cle:"angle", type:"expr", nom:"Orientation (°)" }, { cle:"inverse", type:"case", nom:"Inverser le sens" }],

    toleConvertie:[NOM, { cle:"corps", type:"corps", nom:"Corps" }, { cle:"face", type:"designer", nom:"Face de la tôle", quoi:"faceTiree" }, { cle:"rayon", type:"expr", nom:"Rayon de pliage (mm)" }, { cle:"k", type:"expr", nom:"Facteur K" }],
    brideChaine:[NOM, { cle:"corps", type:"corps", nom:"Tôle" }, { cle:"aretes", type:"designer", nom:"Arêtes", quoi:"aretes" }, { cle:"hauteur", type:"expr", nom:"Hauteur (mm)" }, { cle:"angle", type:"expr", nom:"Angle (°)" },
      { cle:"rayon", type:"expr", nom:"Rayon (mm, vide : celui de la tôle)", vide:true }, { cle:"vers", type:"choix", nom:"Vers", options:{ haut:"Le haut", bas:"Le bas" } }],
    perforation:[NOM, { ...E, nom:"Esquisse (contour à perforer)" }, C, { cle:"diametre", type:"expr", nom:"Diamètre (mm)" }, { cle:"pas", type:"expr", nom:"Pas (mm)" },
      { cle:"disposition", type:"choix", nom:"Disposition", options:{ carre:"Carrée", quinconce:"En quinconce" } }, { cle:"marge", type:"expr", nom:"Marge au bord (mm)" }],
    nuage:[NOM, { cle:"taille", type:"expr", nom:"Taille des points (pixels)" }],
    gravureCylindre:[NOM, { ...E, nom:"Esquisse (devant le cylindre)" }, { cle:"contours", type:"contours", nom:"Contours (aucun coché : tous)" }, C, { cle:"cylindre", type:"designer", nom:"Face cylindrique", quoi:"cylindreAxe" },
      { cle:"mode", type:"choix", nom:"Sens", options:{ creux:"En creux", relief:"En relief" } }, { cle:"profondeur", type:"expr", nom:"Profondeur (mm)" }, { cle:"inverse", type:"case", nom:"Esquisse de l'autre côté" }],
    chemin3d:[NOM, { cle:"points", type:"texte", nom:"Points : x, y, z ; x, y, z ; …" }, { cle:"mode", type:"choix", nom:"Entre les points", options:{ lignes:"Des droites", spline:"Une courbe" } }],
    occurrence:[NOM, { cle:"source", type:"choix", nom:"Composant", options:(c) => ({ "":"— choisir —", ...Object.fromEntries((c.doc.composants || []).map(k => [k.id, k.nom])) }) },
      ...["tx", "ty", "tz"].map((k, i) => ({ cle:k, type:"expr", nom:`Translation ${"XYZ"[i]} (mm)` })), ...["rx", "ry", "rz"].map((k, i) => ({ cle:k, type:"expr", nom:`Rotation ${"XYZ"[i]} (°)` }))],
  };
}

export function defautsPlus({ derniere, mode, composants = [] }){
  return {
    gravureCylindre:{ esquisse:derniere, corps:"", cylindre:null, mode:"creux", profondeur:"1", inverse:false },
    chemin3d:{ points:"0, 0, 0; 20, 0, 0; 20, 20, 10", mode:"lignes" },
    occurrence:{ source:composants[0]?.id || "", tx:"30", ty:"0", tz:"0", rx:"0", ry:"0", rz:"0" },
    englobant:{ outils:[], marge:"0", operation:"nouveau", corps:"" },
    retirerCorps:{ corps:"" },
    aligner:{ corps:"", reference:"", x:"", y:"", z:"" },
    decalerFace:{ corps:"", faces:[], distance:"2" },
    supprimerFace:{ corps:"", faces:[], ouvrir:false },
    remplacerFace:{ corps:"", faces:[], outil:"" },
    cellule:{ outils:[], x:"0", y:"0", z:"0", operation:"nouveau", corps:"" },
    diviser:{ corps:"", mode:"plan", plan:"", esquisse:derniere, outil:"" },
    diviserFace:{ corps:"", faces:[], esquisse:derniere },
    repChemin:{ corps:"", chemin:derniere, nombre:"5", orienter:false, separe:false },
    voile:{ esquisse:derniere, corps:"", epaisseur:"2" },
    surfReglee:{ corps:"", aretes:[], distance:"10", sens:"tangente" },
    surfRaccord:{ aretes:[], aretes2:[], regle:false },
    surfInverser:{ corps:"" }, surfDecoudre:{ corps:"" }, surfDetourer:{ corps:"", faces:[] },
    bossage:{ esquisse:derniere, corps:"", de:"8", di:"3", hauteur:"10", profondeur:"8", depouille:"1", nervures:"0", epNervure:"1", largeurNervure:"3", inverse:false },
    levre:{ esquisse:derniere, corps:"", mode:"levre", largeur:"1.5", hauteur:"2", jeu:"0.2", inverse:false },
    repos:{ esquisse:derniere, corps:"", largeur:"2", hauteur:"2", inverse:false },
    clip:{ esquisse:derniere, corps:"", mode:"crochet", longueur:"10", largeur:"6", epaisseur:"1.5", crochet:"2", surplomb:"1", jeu:"0.2", angle:"0", inverse:false },
    toleConvertie:{ corps:"", face:null, rayon:"2", k:"0.44" },
    brideChaine:{ corps:"", aretes:[], hauteur:"20", angle:"90", rayon:"", vers:"haut" },
    perforation:{ esquisse:derniere, corps:"", diametre:"4", pas:"8", disposition:"quinconce", marge:"2" },
  };
}

/** Ce qui s'ajoute aux panneaux des opérations qui existaient déjà. */
export function completerChamps(CHAMPS){
  const lp = CHAMPS.liaison;
  const i = lp.findIndex(ch => ch.cle === "mode");
  lp[i] = { ...lp[i], options:{ rigide:"Rigide", pivot:"Pivot", glissiere:"Glissière", cylindrique:"Cylindrique", plan:"Plan", spherique:"Sphérique" } };
  const sansTelle = (o) => !o.telleQuelle;
  const j = lp.findIndex(ch => ch.cle === "repereB");
  lp[j] = { ...lp[j], si:sansTelle };
  const mobile = lp.findIndex(ch => ch.cle === "corpsB");
  lp.splice(mobile + 1, 0, { cle:"telleQuelle", type:"case", nom:"Telle quelle (sans recaler le corps)", si:(o) => o.mode === "pivot" || o.mode === "glissiere" || o.mode === "cylindrique" });
  const dec = lp.findIndex(ch => ch.cle === "decalage");
  lp[dec] = { ...lp[dec], si:sansTelle };
  const anim = (o) => o.mode !== "rigide";
  for(const ch of lp.filter(c => c.cle === "valeur")) ch.si = ((si) => (o) => si(o) && !o.pilote)(ch.si);
  lp.push(
    { cle:"valeur", type:"expr", nom:"Angle (°)", si:(o) => o.mode === "cylindrique" && !o.pilote },
    { cle:"valeur", type:"expr", nom:"Glissement U (mm)", si:(o) => o.mode === "plan" && !o.pilote },
    { cle:"valeur2", type:"expr", nom:"Position (mm)", si:(o) => o.mode === "cylindrique" },
    { cle:"valeur2", type:"expr", nom:"Glissement V (mm)", si:(o) => o.mode === "plan" },
    { cle:"valeur3", type:"expr", nom:"Rotation (°)", si:(o) => o.mode === "plan" },
    { cle:"valeur", type:"expr", nom:"Rotation X (°)", si:(o) => o.mode === "spherique" && !o.pilote },
    { cle:"valeur2", type:"expr", nom:"Rotation Y (°)", si:(o) => o.mode === "spherique" },
    { cle:"valeur3", type:"expr", nom:"Rotation Z (°)", si:(o) => o.mode === "spherique" },
    { cle:"pilote", type:"choix", nom:"Commandée par", si:anim,
      options:(c, op) => ({ "":"Elle-même", ...Object.fromEntries(c.doc.operations.slice(0, c.doc.operations.indexOf(op)).filter(o => o.type === "liaison" && o.mode !== "rigide").map(o => [o.id, o.nom])) }) },
    { cle:"loi", type:"texte", nom:"Loi (x : valeur du pilote)", si:(o) => anim(o) && o.pilote },
    { cle:"min", type:"expr", nom:"Limite basse", vide:true, si:anim }, { cle:"max", type:"expr", nom:"Limite haute", vide:true, si:anim },
    { cle:"suiveurs", type:"corpsMulti", nom:"Groupe rigide : corps suiveurs" });

  const rp = CHAMPS.repetition;
  rp.splice(rp.findIndex(ch => ch.cle === "separe"), 0,
    { cle:"axe2", type:"choix", nom:"Seconde direction", options:{ "":"Aucune", X:"X", Y:"Y", Z:"Z" } },
    { cle:"nombre2", type:"expr", nom:"Nombre (seconde direction)", si:(o) => o.axe2 }, { cle:"pas2", type:"expr", nom:"Pas (mm, seconde direction)", si:(o) => o.axe2 });

  CHAMPS.tole.splice(2, 0, { cle:"regle", type:"choix", nom:"Règle de pliage", options:{ "":"Personnalisée", ...Object.fromEntries(Object.keys(REGLES_TOLE).map(n => [n, n])) },
    set:(o, v) => { o.regle = v; const t = REGLES_TOLE[v]; if(t){ o.epaisseur = String(t[0]); o.rayon = String(t[1]); o.k = String(t[2]); } } });

  const pf = CHAMPS.profile;
  const s = pf.findIndex(ch => ch.cle === "section");
  pf[s] = { ...pf[s], options:{ ...pf[s].options, ipe:"Poutre IPE" } };
  pf.splice(s + 1, 0, { cle:"norme", type:"choix", nom:"Taille", si:(o) => o.section === "ipe", options:{ IPE80:"IPE 80", IPE100:"IPE 100", IPE120:"IPE 120", IPE140:"IPE 140", IPE160:"IPE 160", IPE180:"IPE 180", IPE200:"IPE 200" } });
  for(const ch of pf.filter(c => c.cle === "a" || c.cle === "b" || c.cle === "ep")) ch.si = ((si) => (o) => o.section !== "ipe" && (!si || si(o)))(ch.si);

  const pl = CHAMPS.plan;
  const mp = pl.findIndex(ch => ch.cle === "mode");
  pl[mp] = { ...pl[mp], options:{ ...pl[mp].options, chemin:"Le long d'un chemin", tangent:"Tangent à un cylindre", aretes:"Par deux arêtes" } };
  const horsNouveaux = (o) => !["chemin", "tangent", "aretes"].includes(o.mode);
  for(const ch of pl.filter(c => c.cle === "base" || c.cle === "decalage")) ch.si = ((si) => (o) => horsNouveaux(o) && (!si || si(o)))(ch.si);
  pl.push({ cle:"chemin", type:"esquisse", nom:"Chemin", si:(o) => o.mode === "chemin" }, { cle:"position", type:"expr", nom:"Position (0 à 1)", si:(o) => o.mode === "chemin" },
    { cle:"cylindre", type:"designer", nom:"Face cylindrique", quoi:"cylindreAxe", si:(o) => o.mode === "tangent" },
    { cle:"lignes", type:"designer", nom:"Deux arêtes droites", quoi:"lignes", si:(o) => o.mode === "aretes" });

  const ax = CHAMPS.axe;
  const ma = ax.findIndex(ch => ch.cle === "mode");
  ax[ma] = { ...ax[ma], options:{ ...ax[ma].options, normale:"Perpendiculaire à une face", deuxPlans:"Deux plans" } };
  for(const ch of ax.filter(c => c.quoi === "sommets" || /^[xyz][12]$/.test(c.cle))) ch.si = ((si) => (o) => o.mode !== "normale" && o.mode !== "deuxPlans" && (!si || si(o)))(ch.si);
  const planDeConstruction = (cle, nom, si) => ({ cle, type:"choix", nom, si, options:(c, op) => ({ "":"— choisir —", ...plansConstruits(c, op) }) });
  ax.push({ cle:"face", type:"designer", nom:"Face plane", quoi:"faceTiree", si:(o) => o.mode === "normale" },
    planDeConstruction("plan1", "Premier plan", (o) => o.mode === "deuxPlans"), planDeConstruction("plan2", "Second plan", (o) => o.mode === "deuxPlans"));

  const po = CHAMPS.point, coord = (o) => !o.mode || o.mode === "coord";
  for(const ch of po.filter(c => c.quoi === "sommets" || /^[xyz]1$/.test(c.cle))) ch.si = coord;
  po.splice(1, 0, { cle:"mode", type:"choix", nom:"Par", options:{ coord:"Ses coordonnées", axePlan:"Un axe et un plan", troisPlans:"Trois plans" } },
    { cle:"cylindre", type:"designer", nom:"Centre d'un cylindre", quoi:"cylindreAxe", si:coord });
  po.push({ cle:"axe", type:"choix", nom:"Axe", si:(o) => o.mode === "axePlan", options:(c, op) => ({ "":"— choisir —", ...Object.fromEntries(c.doc.operations.slice(0, c.doc.operations.indexOf(op)).filter(o => o.type === "axe").map(o => [o.id, o.nom])) }) },
    planDeConstruction("plan1", "Plan", (o) => o.mode === "axePlan" || o.mode === "troisPlans"), planDeConstruction("plan2", "Deuxième plan", (o) => o.mode === "troisPlans"), planDeConstruction("plan3", "Troisième plan", (o) => o.mode === "troisPlans"));
}

/* -----------------------------------------------------------------------------
   Aides
   --------------------------------------------------------------------------- */
const csv = (c, nom, texte) => telechargerFichier(texte, `${nomProjet(c.doc.nom)}-${nom}.csv`, "text/csv");

/** Le travail long d'un bouton : voile d'attente, panne du noyau relancée, erreur montrée. */
async function tache(c, titre, f){
  c.ui.attendre(true, titre, "");
  try{ return await f(); }
  catch(e){
    if(e.fatale) c.relancerNoyau("Le noyau s'est planté : il a été relancé.");
    else if(!e.abandon) avertir(`${titre} impossible : ${e.message}`);
    return null;
  }
  finally{ c.ui.attendre(false); }
}

const corpsVisibles = (c) => {
  const noms = [];
  c.vue.modele.traverse(o => { if(o.userData.estPiece && o.visible && !c.estReference(o)) noms.push(o.name); });
  return noms;
};

/** Le matériau d'un corps : le sien, ou celui de la pièce. */
export const matiereDe = (doc, nom) => doc.apparences?.[nom]?.materiau || doc.materiau;

/** Le bloc de la vue où l'on pose ce que les analyses tracent ; vidé à chaque reconstruction. */
function trace(c){
  if(!c.traceAnalyse){ c.traceAnalyse = new THREE.Group(); c.vue.annotations.add(c.traceAnalyse); }
  return c.traceAnalyse;
}
const viderTrace = (c) => {
  if(!c.traceAnalyse) return;
  for(const o of [...c.traceAnalyse.children]){ o.geometry?.dispose(); o.material?.dispose(); c.traceAnalyse.remove(o); }
};
const segments = (plat, couleur) => {
  const l = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(plat, 3)),
    new THREE.LineBasicMaterial({ color:couleur, depthTest:false, transparent:true }));
  l.renderOrder = 12;
  l.raycast = () => {};
  return l;
};

/** Ce qui suit chaque reconstruction : apparences physiques, repère du centre de gravité. */
export function apresAffichage(c){
  viderTrace(c);
  for(const m of c.vue.modele.children){
    const a = c.doc.apparences?.[m.name];
    if(!a || !m.isMesh) continue;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    const neufs = mats.map(x => {
      const q = x.clone();
      if(a.metal !== undefined) q.metalness = a.metal;
      if(a.rugosite !== undefined) q.roughness = a.rugosite;
      if(a.opacite !== undefined && a.opacite < 1){
        Object.assign(q, { transparent:true, opacity:a.opacite, depthWrite:false });
        Object.assign(q.userData, { opaciteDorigine:a.opacite, transparentDorigine:true });
      }
      return q;
    });
    m.material = Array.isArray(m.material) ? neufs : neufs[0];
  }
  if(c.centreGravite) montrerCentre(c);
  if((c.doc.composants || []).length) montrerComposants(c);
  else c.vue.recenserMateriaux?.();
}

function montrerCentre(c){
  const corps = (c.resultat?.maillages || []).filter(m => !m.reference && !m.erreur && m.proprietes);
  let total = 0;
  const g = [0, 0, 0];
  for(const m of corps){
    const masse = m.proprietes.volume * c.densite(matiereDe(c.doc, m.nom));
    total += masse;
    m.proprietes.centre.forEach((x, i) => { g[i] += x * masse; });
  }
  if(!total) return null;
  const p = g.map(x => x / total);
  const pts = new THREE.Points(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(p, 3)),
    new THREE.PointsMaterial({ color:0xff5fa2, size:14, sizeAttenuation:false, depthTest:false, transparent:true }));
  pts.renderOrder = 13;
  pts.raycast = () => {};
  trace(c).add(pts);
  c.vue.invalider();
  return p;
}

/* -----------------------------------------------------------------------------
   Rendu : une image soignée, à la taille demandée, sans les aides de construction
   --------------------------------------------------------------------------- */
const blobToile = (toile) => new Promise((ok, ko) => toile.toBlob(b => b ? ok(b) : ko(new Error("le navigateur n'a pas pu écrire l'image")), "image/png"));

/** La scène rendue avec l'occlusion ambiante : les creux s'assombrissent. Chargée à la demande : la vue n'en a pas besoin. */
async function rendreAvecOcclusion(vue, cam, l, h){
  const [{ EffectComposer }, { RenderPass }, { GTAOPass }, { OutputPass }] = await Promise.all([
    import("three/addons/postprocessing/EffectComposer.js"), import("three/addons/postprocessing/RenderPass.js"),
    import("three/addons/postprocessing/GTAOPass.js"), import("three/addons/postprocessing/OutputPass.js")]);
  const composeur = new EffectComposer(vue.renderer);
  composeur.setSize(l, h);
  composeur.addPass(new RenderPass(vue.scene, cam));
  composeur.addPass(new GTAOPass(vue.scene, cam, l, h));
  composeur.addPass(new OutputPass());
  composeur.render();
  return composeur;
}

async function rendreImage(c, { largeur, hauteur, fond, ombres, occlusion }){
  const { vue } = c, r = vue.renderer, cam = vue.camera();
  const taille = r.getSize(new THREE.Vector2()), ratio = r.getPixelRatio();
  const decor = [vue.annotations, vue.decor].map(o => [o, o.visible]);
  const fondScene = vue.scene.background, couleur = r.getClearColor(new THREE.Color()), alpha = r.getClearAlpha(), intensite = vue.scene.environmentIntensity;
  const ombresAvant = prefs.ombres;
  const memoCam = cam.isPerspectiveCamera ? { aspect:cam.aspect } : { left:cam.left, right:cam.right };
  let composeur = null;
  try{
    vue.annotations.visible = false;
    vue.decor.visible = !!ombres;
    if(ombres) vue.definirOmbres(true);
    vue.scene.environmentIntensity = 1;
    if(fond === "transparent"){ vue.scene.background = null; r.setClearAlpha(0); }
    else if(fond === "blanc") vue.scene.background = new THREE.Color(0xffffff);
    r.setPixelRatio(1);
    r.setSize(largeur, hauteur, false);
    if(cam.isPerspectiveCamera) cam.aspect = largeur / hauteur;
    else{ const m = (cam.top - cam.bottom) * (largeur / hauteur) / 2, cx = (cam.left + cam.right) / 2; cam.left = cx - m; cam.right = cx + m; }
    cam.updateProjectionMatrix();
    if(occlusion) composeur = await rendreAvecOcclusion(vue, cam, largeur, hauteur);
    else r.render(vue.scene, cam);
    return await blobToile(r.domElement);
  }finally{
    composeur?.dispose();
    for(const [o, v] of decor) o.visible = v;
    vue.scene.background = fondScene;
    r.setClearColor(couleur, alpha);
    vue.scene.environmentIntensity = intensite;
    if(ombres && !ombresAvant) vue.definirOmbres(false);
    r.setPixelRatio(ratio);
    r.setSize(taille.x, taille.y, false);
    Object.assign(cam, memoCam);
    cam.updateProjectionMatrix();
    vue.invalider();
  }
}

/* -----------------------------------------------------------------------------
   Composants : un conteneur dans la pièce, dont les opérations portent le nom
   --------------------------------------------------------------------------- */
/** La liste du navigateur : activer d'un clic, œil, clic droit pour le reste. */
export function majComposants(c, hote){
  if(!hote) return;
  const liste = c.doc.composants || [];
  hote.replaceChildren(...liste.map(k => {
    const d = document.createElement("div");
    d.className = "nv" + (c.doc.composantActif === k.id ? " sel" : "");
    d.title = "Clic : l'activer, ce qu'on crée entre dedans — clic droit : menu";
    d.innerHTML = '<span class="fl"></span>';
    const oeil = Object.assign(document.createElement("span"), { className:"oeil", textContent:k.cache ? "◌" : "◉", title:k.cache ? "Afficher ce composant" : "Masquer ce composant" });
    oeil.onclick = (e) => { e.stopPropagation(); k.cache = !k.cache; if(!k.cache) delete k.cache; c.marquerModifie(); majComposants(c, hote); montrerComposants(c); };
    d.append(oeil, Object.assign(document.createElement("span"), { className:"ic", textContent:"⧈" }),
      Object.assign(document.createElement("span"), { className:"lbl", textContent:`${k.nom} (${c.doc.operations.filter(o => o.composant === k.id).length})` }));
    d.onclick = () => activerComposant(c, c.doc.composantActif === k.id ? null : k.id);
    d.oncontextmenu = (e) => { e.preventDefault(); menuComposant(c, k, e.clientX, e.clientY); };
    return d;
  }));
}

function activerComposant(c, id){
  if(id) c.doc.composantActif = id; else delete c.doc.composantActif;
  c.marquerModifie();
  majComposants(c, $("navComposants"));
  montrerComposants(c);
  const k = (c.doc.composants || []).find(x => x.id === id);
  etat(k ? `Composant actif : « ${k.nom} ». Ce qu'on crée y entre, le reste de la pièce s'estompe.` : "Plus de composant actif.");
}

/** Le composant actif ressort, les autres s'estompent ; un composant masqué disparaît. */
export function montrerComposants(c){
  const actif = c.doc.composantActif, par = new Map((c.resultat?.maillages || []).map(m => [m.nom, m.composant]));
  const caches = new Set((c.doc.composants || []).filter(k => k.cache).map(k => k.id));
  for(const m of c.vue.modele.children){
    if(!m.isMesh) continue;
    const k = par.get(m.name);
    m.visible = !caches.has(k);
    /* Les corps de même couleur partagent un matériau : l'estomper toucherait aussi le composant actif. */
    if(!m.userData.matPropre){
      m.material = Array.isArray(m.material) ? m.material.map(x => x.clone()) : m.material.clone();
      m.userData.matPropre = true;
    }
    for(const x of Array.isArray(m.material) ? m.material : [m.material]){
      if(x.userData.opaciteComposant === undefined){ x.userData.opaciteComposant = x.opacity; x.userData.transparentComposant = x.transparent; }
      const estompe = actif && k !== actif;
      x.opacity = estompe ? 0.25 : x.userData.opaciteComposant;
      x.transparent = estompe || x.userData.transparentComposant;
      x.needsUpdate = true;
    }
  }
  c.vue.recenserMateriaux?.();
  c.vue.invalider();
}

function menuComposant(c, k, x, y){
  c.menu([
    { texte:"Renommer…", action:async () => {
      const r = await demander("Renommer le composant", [{ nom:"Nom", valeur:k.nom }], ([n]) => n ? null : "Donnez un nom.");
      if(r) c.modifierDoc(() => { k.nom = r[0]; });
    } },
    { texte:"Y déplacer les opérations choisies", action:() => {
      const ids = c.selOps.size ? [...c.selOps] : c.selOp ? [c.selOp] : [];
      if(!ids.length){ etat("Choisissez d'abord des opérations dans la frise."); return; }
      c.modifierDoc(() => { for(const o of c.doc.operations) if(ids.includes(o.id)) o.composant = k.id; });
    } },
    { texte:"Nouvelle occurrence", action:() => { c.creer("occurrence"); if(c.edition){ c.edition.op.source = k.id; c.construirePanneau(); c.apercu(); } } },
    { texte:"Extraire en nouvelle pièce", action:async () => {
      const ops = c.doc.operations.filter(o => o.composant === k.id).map(o => { const n = structuredClone(o); delete n.composant; return n; });
      if(!ops.length){ etat("Ce composant est vide."); return; }
      const doc = { ...structuredClone(c.docVide()), nom:k.nom, parametres:structuredClone(c.doc.parametres), operations:ops, compteur:c.doc.compteur };
      await c.ouvrirOnglet(doc, null, true);
    } },
    { texte:"Dissoudre (les opérations restent dans la pièce)", action:() => c.modifierDoc(() => {
      for(const o of c.doc.operations) if(o.composant === k.id) delete o.composant;
      c.doc.composants = c.doc.composants.filter(q => q !== k);
      if(c.doc.composantActif === k.id) delete c.doc.composantActif;
    }) },
  ], x, y);
}

const REGLAGES_RENDU = [{ nom:"Largeur (pixels)", valeur:"1920" }, { nom:"Hauteur (pixels)", valeur:"1080" },
  { nom:"Fond", valeur:"theme", options:{ theme:"Celui de la vue", blanc:"Blanc", transparent:"Transparent" } }, { nom:"Ombres", valeur:"oui", options:OUI_NON }, { nom:"Occlusion ambiante (plus lent)", valeur:"non", options:OUI_NON }];

async function demanderRendu(){
  const r = await demander("Rendu", REGLAGES_RENDU, ([l, h]) => (+l >= 16 && +l <= 8192 && +h >= 16 && +h <= 8192) ? null : "De 16 à 8192 pixels de côté.");
  return r && { largeur:Math.round(+r[0]), hauteur:Math.round(+r[1]), fond:r[2], ombres:r[3] === "oui", occlusion:r[4] === "oui" };
}

/* -----------------------------------------------------------------------------
   Études de mouvement
   --------------------------------------------------------------------------- */
/** Les corps qui se touchent ; un jeu de contact restreint la recherche à ses corps. */
function contacts(c, nomJeu){
  const jeu = nomJeu && (c.doc.contacts || []).find(j => j.nom === nomJeu);
  const corps = jeu ? new Set(jeu.corps) : null;
  return chercherCollisions(c.vue.modele, { tol:0.05, pauses:false, visible:(o) => o.visible && (!corps || corps.has(o.name)) });
}

/** Une valeur de liaison le temps d'un calcul, et les corps qui se touchent alors. */
async function contactsA(c, op, valeur, nomJeu){
  while(c.enCours) await new Promise(r => setTimeout(r, 30));
  c.valeursAnimees = { [op.id]:String(valeur) };
  await c.reconstruire();
  return (await contacts(c, nomJeu)).length;
}

/**
 * Cherche où une liaison s'arrête : pas à pas depuis `de` dans chaque sens, puis par dichotomie sur le dernier pas.
 * Rend les limites trouvées, null si rien ne l'arrête dans l'intervalle.
 */
async function chercherLimites(c, op, de, bas, haut, pas, nomJeu){
  const borne = async (fin) => {
    const sens = Math.sign(fin - de);
    if(!sens) return null;
    let libre = de;
    for(let x = de + sens * pas; sens > 0 ? x <= fin + 1e-9 : x >= fin - 1e-9; x += sens * pas){
      if(!c.animation) return null;
      if(await contactsA(c, op, x, nomJeu)){
        let a = libre, b = x;
        for(let i = 0; i < 6 && c.animation; i++){ const m = (a + b) / 2; if(await contactsA(c, op, m, nomJeu)) b = m; else a = m; }
        return a;
      }
      libre = x;
    }
    return null;
  };
  return { min:await borne(bas), max:await borne(haut) };
}

async function jouerEtude(c, etude){
  const liens = etude.lignes.map(l => ({ ...l, op:c.doc.operations.find(o => o.id === l.liaison) })).filter(l => l.op);
  if(!liens.length){ etat("Cette étude ne vise plus aucune liaison."); return; }
  const doc = c.doc, tableau = [], images = {};
  c.animation = true;
  $("bEtude").classList.add("on");
  viderTrace(c);
  const piste = [];
  let contact = null;
  for(let i = 0; i <= etude.pas && c.animation && c.doc === doc; i++){
    while(c.enCours) await new Promise(r => setTimeout(r, 30));
    const valeurs = {};
    for(const l of liens) valeurs[l.op.id] = l.de + (l.a - l.de) * i / etude.pas;
    c.valeursAnimees = Object.fromEntries(Object.entries(valeurs).map(([k, x]) => [k, String(x)]));
    await c.reconstruire();
    const ligne = { pas:i, valeurs, contacts:0, centre:null };
    if(etude.suivi){
      const m = c.resultat?.maillages.find(x => x.nom === etude.suivi);
      if(m?.proprietes){ ligne.centre = m.proprietes.centre; piste.push(m.proprietes.centre); }
    }
    if(etude.contact){
      const res = await contacts(c, etude.jeu);
      ligne.contacts = res.length;
      if(res.length && !contact){ contact = { pas:i, paires:res.map(p => `${p.a.name} / ${p.b.name}`) }; }
    }
    tableau.push(ligne);
    if(etude.images){
      c.vue.rendre();
      images[`pas-${String(i).padStart(4, "0")}.png`] = await new Promise(ok => c.vue.canvas.toBlob(async b => ok(new Uint8Array(await b.arrayBuffer())), "image/png"));
    }
    if(etude.arret && ligne.contacts) break;
  }
  c.animation = false;
  c.valeursAnimees = null;
  $("bEtude").classList.remove("on");
  await c.reconstruire();
  if(piste.length > 1){
    const plat = [];
    piste.slice(1).forEach((p, i) => plat.push(...piste[i], ...p));
    trace(c).add(segments(plat, 0xff5fa2));
    c.vue.invalider();
  }
  c.derniereEtude = { etude, tableau };
  etat(`Étude terminée : ${tableau.length} pas${contact ? ` · contact au pas ${contact.pas} (${contact.paires[0]})` : etude.contact ? " · aucun contact" : ""}.`);
  if(Object.keys(images).length) telechargerFichier(archive(images).buffer, `${nomProjet(c.doc.nom)}-animation.zip`, "application/zip");
}

function csvEtude({ etude, tableau }, doc){
  const noms = etude.lignes.map(l => doc.operations.find(o => o.id === l.liaison)?.nom || l.liaison);
  const f = (x) => String(+(+x).toFixed(4)).replace(".", ",");
  return [["pas", ...noms, "X (mm)", "Y (mm)", "Z (mm)", "contacts"].join(";"),
    ...tableau.map(l => [l.pas, ...etude.lignes.map(k => f(l.valeurs[k.liaison])), ...(l.centre ? l.centre.map(f) : ["", "", ""]), l.contacts].join(";"))].join("\n");
}

async function nouvelleEtude(c){
  const liaisons = c.doc.operations.filter(o => o.type === "liaison" && o.mode !== "rigide" && !o.pilote);
  if(!liaisons.length){ etat("Aucune liaison mobile à animer."); return null; }
  const r = await demander("Étude de mouvement", [
    { nom:"Nom", valeur:`Étude ${(c.doc.etudes || []).length + 1}` },
    ...liaisons.map(o => ({ nom:`${o.nom} : de, à (vide : ne bouge pas)`, valeur:liaisons.length === 1 ? (o.mode === "pivot" ? "0, 360" : "0, 50") : "" })),
    { nom:"Nombre de pas", valeur:"24" },
    { nom:"Suivre le centre de", valeur:"", options:{ "":"Aucun corps", ...Object.fromEntries(c.nomsCorps.map(n => [n, n])) } },
    { nom:"Chercher les contacts", valeur:"non", options:{ non:"Non", oui:"Entre tous les corps", ...Object.fromEntries((c.doc.contacts || []).map(j => [`j:${j.nom}`, `Jeu « ${j.nom} »`])) } },
    { nom:"S'arrêter au premier contact", valeur:"non", options:OUI_NON },
    { nom:"Enregistrer les images (zip)", valeur:"non", options:OUI_NON },
  ], (v) => {
    const couples = v.slice(1, 1 + liaisons.length);
    if(!couples.some(Boolean)) return "Donnez le mouvement d'une liaison au moins.";
    if(couples.some(t => t && !(t.split(",").length === 2 && t.split(",").every(x => Number.isFinite(+x) && x.trim() !== "")))) return "Écrivez deux nombres : de, à.";
    const n = +v[1 + liaisons.length];
    return n >= 1 && n <= 500 ? null : "De 1 à 500 pas.";
  });
  if(!r) return null;
  const k = liaisons.length;
  const etude = {
    nom:r[0] || "Étude", pas:Math.round(+r[1 + k]), suivi:r[2 + k] || null, contact:r[3 + k] !== "non" || r[4 + k] === "oui", jeu:r[3 + k].startsWith("j:") ? r[3 + k].slice(2) : null, arret:r[4 + k] === "oui", images:r[5 + k] === "oui",
    lignes:liaisons.flatMap((o, i) => { if(!r[1 + i]) return []; const [de, a] = r[1 + i].split(",").map(Number); return [{ liaison:o.id, de, a }]; }),
  };
  c.memoriser();
  (c.doc.etudes ||= []).push(etude);
  c.marquerModifie();
  return etude;
}

/* -----------------------------------------------------------------------------
   Apparences
   --------------------------------------------------------------------------- */
async function poserApparence(c){
  const face = c.faceChoisie, objet = c.arbre.selection;
  const cibles = objet?.userData.estPiece ? [objet.name] : c.nomsCorps;
  if(!cibles.length){ etat("Aucun corps à habiller."); return; }
  const base = c.doc.apparences?.[cibles[0]] || {};
  const r = await demander(face ? `Apparence de la face de « ${objet?.name} »` : cibles.length > 1 ? "Apparence de tous les corps" : `Apparence de « ${cibles[0]} »`, [
    { nom:"Bibliothèque", valeur:"", options:{ "":"Personnalisée", ...Object.fromEntries([...Object.keys(APPARENCES), ...Object.keys(lireLocal(CLE_FAVORIS, {}))].map(n => [n, n])) } },
    { nom:"Couleur", valeur:base.couleur || "#a9b1bb", type:"color" },
    { nom:"Métal (0 à 1)", valeur:String(base.metal ?? 0.25) }, { nom:"Rugosité (0 à 1)", valeur:String(base.rugosite ?? 0.52) }, { nom:"Opacité (0 à 1)", valeur:String(base.opacite ?? 1) },
    { nom:"Matériau physique (masse)", valeur:base.materiau || "", options:{ "":"Celui de la pièce", ...Object.fromEntries(c.materiaux().map(n => [n, n])) } },
    { nom:"Effacer ce qui est posé", valeur:"non", options:OUI_NON },
  ], ([, , m, ru, op]) => [m, ru, op].every(x => x !== "" && +x >= 0 && +x <= 1) ? null : "Trois valeurs de 0 à 1.");
  if(!r) return;
  const fav = lireLocal(CLE_FAVORIS, {})[r[0]];
  const lib = APPARENCES[r[0]] || (fav && [fav.couleur, fav.metal, fav.rugosite, fav.opacite]);
  const a = lib ? { couleur:lib[0], metal:lib[1], rugosite:lib[2], opacite:lib[3] } : { couleur:r[1], metal:+r[2], rugosite:+r[3], opacite:+r[4] };
  c.modifierDoc(() => {
    const table = (c.doc.apparences ||= {});
    for(const nom of cibles){
      if(r[6] === "oui"){ delete table[nom]; continue; }
      if(face && objet){
        const f = (table[nom] ||= {}).faces ||= [];
        f.push({ point:face.point, couleur:a.couleur });
      }else table[nom] = { ...table[nom], ...a, ...(r[5] ? { materiau:r[5] } : {}) };
    }
  });
}

function copierLook(c){
  const o = c.arbre.selection;
  const a = o && c.doc.apparences?.[o.name];
  if(!a){ etat("Choisissez un corps qui porte une apparence."); return; }
  const { faces, ...look } = a;
  c.lookCopie = look;
  etat(`Apparence de « ${o.name} » copiée.`);
}

function collerLook(c){
  const o = c.arbre.selection;
  if(!c.lookCopie){ etat("Copiez d'abord une apparence."); return; }
  if(!o?.userData.estPiece){ etat("Choisissez le corps à habiller."); return; }
  c.modifierDoc(() => { const t = (c.doc.apparences ||= {}); t[o.name] = { ...t[o.name], ...c.lookCopie }; });
}

/* -----------------------------------------------------------------------------
   Opérations : copier, coller, voir ce qui en dépend
   --------------------------------------------------------------------------- */
export function copierOperations(c){
  const ids = c.selOps.size ? [...c.selOps] : c.selOp ? [c.selOp] : [];
  const ops = c.doc.operations.filter(o => ids.includes(o.id));
  if(!ops.length) return false;
  c.pressePapier = JSON.stringify(ops);
  try{ localStorage.setItem(CLE_PRESSE_PAPIER, c.pressePapier); }catch(_){ /* trop gros pour un autre onglet : il reste dans celui-ci */ }
  etat(`${ops.length} opération(s) copiée(s) : Ctrl+V pour coller.`);
  return true;
}

export function collerOperations(c){
  if(c.edition || c.editeur.ouvert) return false;
  let texte = null;
  try{ texte = localStorage.getItem(CLE_PRESSE_PAPIER); }catch(_){ /* stockage indisponible */ }
  texte ||= c.pressePapier;
  if(!texte) return false;
  let ops;
  try{ ops = JSON.parse(texte); }catch(_){ return false; }
  if(!Array.isArray(ops) || !ops.every(o => o && typeof o.type === "string" && typeof o.id === "string")) return false;
  c.modifierDoc(() => { for(const o of operationsCollees(c.doc, ops)) c.inserer(o); });
  etat(`${ops.length} opération(s) collée(s).`);
  return true;
}

/* -----------------------------------------------------------------------------
   Les boutons
   --------------------------------------------------------------------------- */
function appliquerDisposition(){
  for(const [id, v] of Object.entries(lireLocal(CLE_DISPOSITION, {}))){
    const f = $(id);
    if(!f || typeof v?.style !== "string") continue;
    f.setAttribute("style", v.style);
    f.classList.toggle("replie", !!v.replie);
  }
}

export function brancherPlus(c){
  const si = (id, f) => { const b = $(id); if(b) b.onclick = f; };
  const exp = (format, ext, titre, extra = {}) => async () => {
    const noms = corpsVisibles(c);
    if(!noms.length){ avertir("Aucun corps visible à exporter (les références ne sont pas exportées)."); return; }
    await tache(c, titre, async () => {
      const r = await c.envoyer({ type:"exporter", doc:c.docPourNoyau(), format, corps:noms, ...extra(noms) });
      telechargerFichier(await r.blob.arrayBuffer(), `${nomProjet(c.doc.nom)}.${ext}`);
    });
  };
  const sans = () => ({});
  si("bExportObj", exp("obj", "obj", "Export OBJ", sans));
  si("bExport3mf", exp("3mf", "3mf", "Export 3MF", sans));
  si("bExportUrdf", exp("urdf", "zip", "Export URDF", (noms) => ({ densites:Object.fromEntries(noms.map(n => [n, c.densite(matiereDe(c.doc, n))])) })));

  si("bExportVueDxf", async () => {
    const noms = corpsVisibles(c);
    if(!noms.length){ avertir("Aucun corps visible à dessiner."); return; }
    const r = await demander("DXF de la vue", [{ nom:"Arêtes cachées", valeur:"calque", options:{ calque:"Sur le calque CACHEES", omises:"Omises" } }]);
    if(!r) return;
    const cam = c.vue.camera(), dir = cam.position.clone().sub(c.vue.cible).normalize(), x = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0).normalize();
    await tache(c, "DXF de la vue", async () => {
      const q = await c.envoyer({ type:"vueDxf", doc:c.docPourNoyau(), corps:noms, cachees:r[0], camera:{ position:cam.position.toArray(), direction:dir.toArray(), xdir:x.toArray() } });
      telechargerFichier(q.dxf, `${nomProjet(c.doc.nom)}-vue.dxf`, "application/dxf");
    });
  });

  si("bExportScript", () => {
    const texte = `/* Pièce « ${c.doc.nom} » : à coller dans la console de la page de conception. */\nW3D.conception.ouvrirOnglet(${JSON.stringify(c.doc, null, 1)}, null, false);\n`;
    telechargerFichier(texte, `${nomProjet(c.doc.nom)}-script.js`, "text/javascript");
  });

  si("bEsquisseDxf", () => {
    try{ telechargerFichier(dxfEsquisse(c.editeur.esq, echantillonSpline), `${nomProjet(c.editeur.esq.nom)}.dxf`, "application/dxf"); }
    catch(e){ avertir(e.message); }
  });

  /* ---------------- inspecter ---------------- */
  si("bAnalyseCorps", async () => {
    const noms = corpsVisibles(c);
    if(!noms.length){ etat("Aucun corps à analyser."); return; }
    await tache(c, "Analyse", async () => {
      const { analyses } = await c.envoyer({ type:"analyse", doc:c.docPourNoyau(), corps:noms });
      viderTrace(c);
      const lignes = [];
      for(const [nom, a] of Object.entries(analyses)){
        if(a.traces.tangentes.length) trace(c).add(segments(a.traces.tangentes, 0x4cc38a));
        if(a.traces.vives.length) trace(c).add(segments(a.traces.vives, 0xf2a33c));
        if(a.traces.libres.length) trace(c).add(segments(a.traces.libres, 0xe8443a));
        lignes.push(`${nom} : rayon min ${a.rayonMin === null ? "aucun" : a.rayonMin.toFixed(3) + " mm"} · ${a.jonctions.tangentes} jonctions tangentes, ${a.jonctions.vives} vives, ${a.jonctions.libres} bords libres.`);
      }
      c.vue.invalider();
      etat(lignes.join(" "));
      await avertir(`Vert : jonction tangente · orange : arête vive · rouge : bord libre.\n\n${lignes.join("\n")}`);
    });
  });

  si("bComparer", async () => {
    const liste = Object.fromEntries(c.nomsCorps.map(n => [n, n]));
    if(c.nomsCorps.length < 2){ etat("Il faut deux corps pour comparer."); return; }
    const r = await demander("Comparer deux corps", [{ nom:"Corps A", valeur:c.nomsCorps[0], options:liste }, { nom:"Corps B", valeur:c.nomsCorps[1], options:liste }], ([a, b]) => a === b ? "Choisissez deux corps différents." : null);
    if(!r) return;
    await tache(c, "Comparaison", async () => {
      const { ecart:e } = await c.envoyer({ type:"comparer", doc:c.docPourNoyau(), corps:r });
      const f = (x) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits:2 }).format(x);
      await avertir(`${r[0]} : ${f(e.volumeA)} mm³\n${r[1]} : ${f(e.volumeB)} mm³\n\nSeulement dans ${r[0]} : ${f(e.seulA)} mm³\nSeulement dans ${r[1]} : ${f(e.seulB)} mm³\nEn commun : ${f(e.commun)} mm³`);
    });
  });

  si("bBalayage", async () => {
    if(!c.doc.parametres.length){ etat("Ajoutez d'abord un paramètre (ƒx)."); return; }
    const r = await demander("Balayage d'un paramètre", [{ nom:"Paramètre", valeur:c.doc.parametres[0].nom, options:Object.fromEntries(c.doc.parametres.map(p => [p.nom, p.nom])) },
      { nom:"De", valeur:"10" }, { nom:"À", valeur:"50" }, { nom:"Nombre de valeurs", valeur:"5" }],
      ([, de, a, n]) => [de, a].every(x => Number.isFinite(+x) && x !== "") && +n >= 2 && +n <= 100 ? null : "Deux nombres, et de 2 à 100 valeurs.");
    if(!r) return;
    const n = Math.round(+r[3]), valeurs = Array.from({ length:n }, (_, i) => +r[1] + (+r[2] - +r[1]) * i / (n - 1));
    await tache(c, "Balayage", async () => {
      const q = await c.envoyer({ type:"balayage", doc:c.docPourNoyau(), nom:r[0], valeurs });
      csv(c, `balayage-${r[0]}`, csvBalayage(r[0], q.lignes));
      const ko = q.lignes.filter(l => l.erreurs).length;
      etat(`${q.lignes.length} valeurs calculées${ko ? ` · ⚠ ${ko} avec des opérations en erreur` : ""} : table enregistrée.`);
    });
  });

  si("bCentreGravite", () => {
    c.centreGravite = !c.centreGravite;
    $("bCentreGravite").classList.toggle("on", c.centreGravite);
    viderTrace(c);
    if(c.centreGravite){
      const p = montrerCentre(c);
      etat(p ? `Centre de gravité : ${p.map(x => x.toFixed(2).replace(".", ",")).join(" · ")} mm` : "Aucun volume dans cette pièce.");
    }else{ etat(""); c.vue.invalider(); }
  });

  /* ---------------- assemblage ---------------- */
  si("bNomenclature", () => {
    const corps = (c.resultat?.maillages || []).filter(m => !m.reference && !m.erreur);
    if(!corps.length){ etat("Aucun corps dans cette pièce."); return; }
    csv(c, "nomenclature", nomenclature(corps, { matiereDe:(n) => matiereDe(c.doc, n), densiteDe:(m) => c.densite(m) }));
  });

  si("bEtude", async (e) => {
    if(c.animation){ c.animation = false; return; }
    const r = e.currentTarget.getBoundingClientRect();
    const etudes = c.doc.etudes || [];
    c.menu([
      { texte:"Nouvelle étude…", action:async () => { const x = await nouvelleEtude(c); if(x) jouerEtude(c, x); } },
      ...etudes.map(x => ({ texte:`▶ ${x.nom}`, action:() => jouerEtude(c, x) })),
      ...(c.derniereEtude ? ["-", { texte:"Exporter la dernière étude en CSV", action:() => csv(c, "etude", csvEtude(c.derniereEtude, c.doc)) }] : []),
      ...(etudes.length ? ["-", { texte:"Supprimer toutes les études", action:() => c.modifierDoc(() => { c.doc.etudes = []; }) }] : []),
    ], r.left, r.bottom + 2);
  });

  si("bLimites", async () => {
    if(c.animation){ c.animation = false; return; }
    const liaisons = c.doc.operations.filter(o => o.type === "liaison" && o.mode !== "rigide" && !o.pilote);
    if(!liaisons.length){ etat("Aucune liaison mobile."); return; }
    const r = await demander("Chercher les limites d'une liaison", [{ nom:"Liaison", valeur:liaisons[0].id, options:Object.fromEntries(liaisons.map(o => [o.id, o.nom])) },
      { nom:"Départ (sans contact)", valeur:"0" }, { nom:"Chercher jusqu'à, vers le bas", valeur:"-180" }, { nom:"Chercher jusqu'à, vers le haut", valeur:"180" }, { nom:"Pas", valeur:"15" },
      { nom:"Entre", valeur:"", options:{ "":"Tous les corps", ...Object.fromEntries((c.doc.contacts || []).map(j => [j.nom, `Jeu « ${j.nom} »`])) } }],
      ([, de, b, h, p]) => [de, b, h, p].every(x => Number.isFinite(+x) && x !== "") && +p > 0 ? null : "Quatre nombres, et un pas positif.");
    if(!r) return;
    const op = c.doc.operations.find(o => o.id === r[0]);
    c.animation = true;
    $("bLimites").classList.add("on");
    let res = null;
    try{
      if(await contactsA(c, op, +r[1], r[5])){ etat("Au départ, des corps se touchent déjà : choisissez un autre départ ou un jeu de contact."); return; }
      res = await chercherLimites(c, op, +r[1], +r[2], +r[3], +r[4], r[5]);
    }finally{
      c.animation = false;
      c.valeursAnimees = null;
      $("bLimites").classList.remove("on");
      await c.reconstruire();
    }
    c.dernieresLimites = res;
    const f = (x) => x === null ? "rien" : String(+x.toFixed(2));
    if(await confirmer(`« ${op.nom} » : butée basse ${f(res.min)}, butée haute ${f(res.max)}. Les poser comme limites de la liaison ?`, "Poser"))
      c.modifierDoc(() => { if(res.min !== null) op.min = String(+res.min.toFixed(3)); if(res.max !== null) op.max = String(+res.max.toFixed(3)); });
  });

  si("bContacts", (e) => {
    const r = e.currentTarget.getBoundingClientRect(), jeux = c.doc.contacts || [];
    c.menu([{ texte:"Nouveau jeu de contact…", action:async () => {
      if(c.nomsCorps.length < 2){ etat("Il faut au moins deux corps."); return; }
      const q = await demander("Jeu de contact", [{ nom:"Nom", valeur:`Jeu ${jeux.length + 1}` }, { nom:"Corps, séparés par des virgules", valeur:c.nomsCorps.slice(0, 2).join(", ") }], ([n, l]) => {
        if(!n) return "Donnez un nom.";
        const noms = l.split(",").map(x => x.trim());
        const inconnu = noms.find(x => !c.nomsCorps.includes(x));
        return inconnu ? `Corps inconnu : « ${inconnu} ».` : noms.length < 2 ? "Deux corps au moins." : null;
      });
      if(q) c.modifierDoc(() => { (c.doc.contacts ||= []).push({ nom:q[0], corps:q[1].split(",").map(x => x.trim()) }); });
    } }, ...jeux.map(j => ({ texte:`✕ Supprimer « ${j.nom} » (${j.corps.length} corps)`, action:() => c.modifierDoc(() => { c.doc.contacts = c.doc.contacts.filter(x => x !== j); }) }))], r.left, r.bottom + 2);
  });

  si("bNouveauComposant", async () => {
    const liste = c.doc.composants || [];
    const q = await demander("Nouveau composant", [{ nom:"Nom", valeur:`Composant ${liste.length + 1}` }], ([n]) => n ? null : "Donnez un nom.");
    if(!q) return;
    c.modifierDoc(() => { const id = "k" + (c.doc.compteur = (c.doc.compteur || 0) + 1); (c.doc.composants ||= []).push({ id, nom:q[0] }); c.doc.composantActif = id; });
    montrerComposants(c);
  });

  si("bLiens", (e) => {
    const r = e.currentTarget.getBoundingClientRect(), lies = c.doc.operations.filter(o => o.source && (o.type === "composant" || o.type === "step"));
    if(!lies.length){ etat("Aucun composant ni STEP lié à un fichier."); return; }
    c.menu(lies.flatMap(o => [{ texte:`Casser le lien de « ${o.nom} »`, titre:o.source, action:() => c.modifierDoc(() => { delete o.source; delete o.sourceDate; delete o.sourceTaille; }) },
      { texte:`Réassigner « ${o.nom} »…`, titre:o.source, action:async () => {
        let fichiers = [];
        try{ fichiers = (await (await fetch("api/projets", { cache:"no-store" })).json()).fichiers.filter(f => o.type === "composant" ? /\.json$/i.test(f.chemin) : /\.(stp|step)$/i.test(f.chemin)); }
        catch(err){ avertir(`Dossier des projets injoignable : ${err.message}`); return; }
        if(!fichiers.length){ etat("Aucun fichier de ce genre dans les projets."); return; }
        const q = await demander("Réassigner le lien", [{ nom:"Fichier", valeur:fichiers[0].chemin, options:Object.fromEntries(fichiers.map(f => [f.chemin, f.chemin])) }]);
        if(q) c.modifierDoc(() => { o.source = q[0]; o.sourceDate = 0; o.sourceTaille = 0; });     // la date ne colle plus : Mettre à jour s'allume
      } }]), r.left, r.bottom + 2);
  });

  /* ---------------- gérer ---------------- */
  si("bProprietesDoc", async () => {
    const p = c.doc.proprietes || {};
    const r = await demander("Propriétés de la pièce", [{ nom:"Référence", valeur:p.reference || "" }, { nom:"Révision", valeur:p.revision || "" }, { nom:"Auteur", valeur:p.auteur || "" }, { nom:"Description", valeur:p.description || "" }]);
    if(r) c.modifierDoc(() => { c.doc.proprietes = { reference:r[0], revision:r[1], auteur:r[2], description:r[3] }; });
  });

  si("bMateriauPerso", async () => {
    const r = await demander("Nouveau matériau", [{ nom:"Nom", valeur:"" }, { nom:"Masse volumique (g/cm³)", valeur:"1" }], ([n, d]) => !n ? "Donnez un nom." : +d > 0 ? null : "La masse volumique est positive.");
    if(r) c.modifierDoc(() => { (c.doc.materiauxPerso ||= {})[r[0]] = +r[1]; c.doc.materiau = r[0]; });
  });

  si("bReglesPlastique", async () => {
    const q = c.doc.reglesPlastique || { paroi:"2", depouille:"1", rayon:"0.5" };
    const r = await demander("Règle plastique", [{ nom:"Paroi nominale (mm)", valeur:q.paroi }, { nom:"Dépouille minimale (°)", valeur:q.depouille }, { nom:"Rayon minimal (mm)", valeur:q.rayon }],
      (v) => v.every(x => +x >= 0 && x !== "") ? null : "Trois valeurs positives.");
    if(r) c.modifierDoc(() => { c.doc.reglesPlastique = { paroi:r[0], depouille:r[1], rayon:r[2] }; });
  });

  si("bRecalculer", async () => {
    await tache(c, "Tout recalculer", async () => { await c.envoyer({ type:"viderCache" }); });
    c.reconstruire();
  });

  si("bReprises", (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const liste = (c.reprises ||= []);
    c.menu([
      { texte:"Créer un point de reprise", action:() => { liste.push({ nom:`${new Date().toLocaleTimeString("fr-FR")} · ${c.doc.operations.length} opérations`, json:JSON.stringify(c.doc) }); etat("Point de reprise créé (gardé jusqu'à la fermeture de la page)."); } },
      ...liste.map(p => ({ texte:`↩ ${p.nom}`, action:async () => {
        if(c.edition || c.editeur.ouvert){ etat("Terminez d'abord l'opération ou l'esquisse en cours."); return; }
        if(await confirmer(`Revenir à « ${p.nom} » ? Annuler (Ctrl+Z) reste possible.`, "Revenir")){ c.memoriser(); c.restaurer(p.json); c.marquerModifie(); }
      } })),
    ], r.left, r.bottom + 2);
  });

  si("bProfilExporter", () => telechargerFichier(JSON.stringify(prefs, null, 2), "web3d-reglages.json", "application/json"));
  si("bProfilImporter", () => {
    const f = Object.assign(document.createElement("input"), { type:"file", accept:".json" });
    f.onchange = async () => {
      try{
        const lu = JSON.parse(await f.files[0].text());
        if(typeof lu !== "object" || lu === null || Array.isArray(lu)) throw new Error("ce fichier n'est pas un profil");
        /* Seules les clés connues, du bon type : comme à la lecture des préférences. */
        for(const k of Object.keys(prefs)) if(lu[k] !== undefined && typeof lu[k] === typeof prefs[k]) prefs[k] = lu[k];
        enregistrerPrefs();
        await avertir("Réglages importés. La page va se recharger.");
        location.reload();
      }catch(e){ avertir(`Import impossible : ${e.message}`); }
    };
    f.click();
  });

  /* ---------------- apparences ---------------- */
  si("bApparence", () => poserApparence(c));
  si("bApparence2", () => poserApparence(c));
  si("bCopierLook", () => copierLook(c));
  si("bCollerLook", () => collerLook(c));
  si("bPinceau", () => {
    if(!c.pinceau && !c.lookCopie){ etat("Copiez d'abord une apparence."); return; }
    c.pinceau = !c.pinceau;
    $("bPinceau").classList.toggle("on", c.pinceau);
    etat(c.pinceau ? "Pinceau : cliquez les corps à habiller ; second appui pour finir." : "");
  });
  si("bFavoriLook", async () => {
    if(!c.lookCopie){ etat("Copiez d'abord une apparence."); return; }
    const q = await demander("Apparence favorite", [{ nom:"Nom", valeur:"Ma couleur" }], ([n]) => n ? null : "Donnez un nom.");
    if(!q) return;
    try{ localStorage.setItem(CLE_FAVORIS, JSON.stringify({ ...lireLocal(CLE_FAVORIS, {}), [q[0]]:c.lookCopie })); etat(`« ${q[0]} » rejoint la bibliothèque.`); }
    catch(_){ avertir("Stockage du navigateur indisponible : la favorite n'est pas gardée."); }
  });
  si("bRemplacerLook", () => {
    const o = c.arbre.selection, a = o && c.doc.apparences?.[o.name];
    if(!a || !c.lookCopie){ etat("Copiez la nouvelle apparence, puis choisissez un corps qui porte l'ancienne."); return; }
    const pareil = (x) => x && ["couleur", "metal", "rugosite", "opacite"].every(k => x[k] === a[k]);
    let n = 0;
    c.modifierDoc(() => { for(const [nom, x] of Object.entries(c.doc.apparences)) if(pareil(x)){ c.doc.apparences[nom] = { ...x, ...c.lookCopie }; n++; } });
    etat(`${n} corps changé(s).`);
  });

  /* ---------------- calque de référence ---------------- */
  si("bImageEsquisse", async () => {
    const images = c.doc.operations.filter(o => o.type === "image" && !o.suspendue);
    if(!images.length){ etat("Insérez d'abord une image (onglet Insérer)."); return; }
    if(c.edition || c.editeur.ouvert){ etat("Terminez d'abord l'opération ou l'esquisse en cours."); return; }
    const q = await demander("Image vers esquisse", [{ nom:"Image", valeur:images[0].id, options:Object.fromEntries(images.map(o => [o.id, o.nom])) }, { nom:"Seuil (0 à 255 : ce qui est plus sombre devient contour)", valeur:"128" }, { nom:"Tolérance (pixels)", valeur:"1.5" }],
      ([, s, t]) => +s >= 0 && +s <= 255 && +t >= 0 ? null : "Un seuil de 0 à 255 et une tolérance positive.");
    if(!q) return;
    await tache(c, "Image vers esquisse", async () => {
      const op = images.find(o => o.id === q[0]);
      const img = new Image();
      await new Promise((ok, ko) => { img.onload = ok; img.onerror = () => ko(new Error("image illisible")); img.src = op.donnees; });
      /* Réduite : une esquisse de milliers de segments serait inutilisable. */
      const k = Math.min(1, 400 / Math.max(img.width, img.height)), l = Math.round(img.width * k), h = Math.round(img.height * k);
      const toile = Object.assign(document.createElement("canvas"), { width:l, height:h }), ctx = toile.getContext("2d");
      ctx.drawImage(img, 0, 0, l, h);
      const d = ctx.getImageData(0, 0, l, h).data;
      const boucles = contoursImage((x, y) => { const i = 4 * (y * l + x); return (0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]) * d[i + 3] / 255 + 255 - d[i + 3]; }, l, h, +q[1], +q[2]);
      if(!boucles.length) throw new Error("rien de plus sombre que ce seuil");
      const v = c.v(), L = v(op.largeur), mm = L / l, x0 = v(op.x ?? 0), y0 = v(op.y ?? 0), H = mm * h;
      const prims = boucles.flatMap(b => b.map((p, i) => { const s = b[(i + 1) % b.length], u = (a) => [x0 - L / 2 + a[0] * mm, y0 + H / 2 - a[1] * mm]; return { type:"ligne", a:u(p), b:u(s) }; }));
      if(prims.length > 3000) throw new Error(`${prims.length} segments : montez la tolérance`);
      const r = repereImage(op, v);
      const avant = JSON.stringify(c.doc), esq = nouvelleEsquisse(c.nouvelId(), `Tracé de ${op.nom}`, op.base === "face" ? { origine:r.o, normale:r.n, xdir:r.x } : { base:op.base, decalage:op.decalage ?? "0" });
      ajouterPrimitives(esq, prims);
      c.inserer(esq);
      c.memoriser(avant);
      c.marquerModifie();
      c.majHistorique();
      await c.reconstruire();
      etat(`${boucles.length} contour(s), ${prims.length} segments.`);
    });
  });

  /* ---------------- bibliothèque de la page ---------------- */
  si("bBibliotheque", (e) => {
    const r = e.currentTarget.getBoundingClientRect(), liste = lireLocal(CLE_BIBLIOTHEQUE, []);
    const garder = (l) => { try{ localStorage.setItem(CLE_BIBLIOTHEQUE, JSON.stringify(l)); return true; }catch(_){ avertir("Trop gros pour le stockage du navigateur : enregistrez plutôt une pièce."); return false; } };
    c.menu([
      { texte:"Y ranger les opérations choisies…", action:async () => {
        const ids = c.selOps.size ? [...c.selOps] : c.selOp ? [c.selOp] : [];
        const ops = c.doc.operations.filter(o => ids.includes(o.id));
        if(!ops.length){ etat("Choisissez d'abord des opérations dans la frise."); return; }
        const q = await demander("Bibliothèque", [{ nom:"Nom", valeur:ops[0].nom }], ([n]) => n ? null : "Donnez un nom.");
        if(q && garder([...liste, { nom:q[0], ops }])) etat(`« ${q[0]} » rangé.`);
      } },
      ...liste.map(x => ({ texte:`⧉ ${x.nom}`, titre:`${x.ops.length} opération(s) : les insérer ici`, action:() => {
        if(c.edition || c.editeur.ouvert){ etat("Terminez d'abord l'opération ou l'esquisse en cours."); return; }
        c.modifierDoc(() => { for(const o of operationsCollees(c.doc, x.ops)) c.inserer(o); });
      } })),
      "-",
      { texte:"Enregistrer la bibliothèque en fichier", action:() => telechargerFichier(JSON.stringify(liste, null, 1), "web3d-bibliotheque.json", "application/json") },
      { texte:"Reprendre une bibliothèque…", action:() => {
        const f = Object.assign(document.createElement("input"), { type:"file", accept:".json" });
        f.onchange = async () => {
          try{
            const lu = JSON.parse(await f.files[0].text());
            if(!Array.isArray(lu) || !lu.every(x => typeof x?.nom === "string" && Array.isArray(x.ops) && x.ops.every(o => typeof o?.type === "string" && typeof o?.id === "string"))) throw new Error("ce fichier n'est pas une bibliothèque");
            if(garder([...liste, ...lu])) etat(`${lu.length} entrée(s) reprise(s).`);
          }catch(err){ avertir(`Lecture impossible : ${err.message}`); }
        };
        f.click();
      } },
      ...liste.map(x => ({ texte:`✕ Retirer « ${x.nom} »`, action:() => garder(liste.filter(y => y !== x)) })),
    ], r.left, r.bottom + 2);
  });

  /* ---------------- disposition et style ---------------- */
  si("bDisposition", (e) => {
    const r = e.currentTarget.getBoundingClientRect(), pan = () => [...document.querySelectorAll(".flottant[id]")];
    c.menu([
      { texte:"Enregistrer la disposition", action:() => {
        const d = Object.fromEntries(pan().map(f => [f.id, { style:f.getAttribute("style") || "", replie:f.classList.contains("replie") }]));
        try{ localStorage.setItem(CLE_DISPOSITION, JSON.stringify(d)); etat("Disposition enregistrée : elle revient au chargement."); }catch(_){ avertir("Stockage du navigateur indisponible."); }
      } },
      { texte:"Reprendre la disposition", action:() => appliquerDisposition() },
      { texte:"Disposition d'origine", action:() => {
        localStorage.removeItem(CLE_DISPOSITION);
        for(const f of pan()){ f.removeAttribute("style"); f.classList.remove("replie"); f.querySelector(".plier")?.replaceChildren(document.createTextNode("−")); }
      } },
    ], r.left, r.bottom + 2);
  });
  appliquerDisposition();

  si("bStyle", (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const poser = (filaire, rayons, aretes) => {
      if(!!c.vue.modeFilaire !== filaire) $("bFilaire").click();
      if(!!c.vue.modeTransparent !== rayons) $("bTransparence").click();
      if(!!prefs.aretes !== aretes) $("bAretes").click();
    };
    c.menu([{ texte:"Ombré", action:() => poser(false, false, false) }, { texte:"Ombré avec arêtes", action:() => poser(false, false, true) },
      { texte:"Filaire", action:() => poser(true, false, false) }, { texte:"Rayons X", action:() => poser(false, true, true) }], r.left, r.bottom + 2);
  });

  /* ---------------- gérer ---------------- */

  /* ---------------- affichage ---------------- */
  si("bNormaleA", () => {
    const f = c.faceChoisie;
    const n = f?.type === "plan" ? f.normale : f?.type === "cylindre" ? f.axe : null;
    if(!n){ etat("Choisissez d'abord une face dans la vue."); return; }
    c.nav.allerVersDirection(new THREE.Vector3(...n.toArray()));
  });

  si("bRotation", () => {
    c.rotation = !c.rotation;
    $("bRotation").classList.toggle("on", c.rotation);
    if(!c.rotation) return;
    let t = performance.now();
    const tourner = (now) => {
      if(!c.rotation) return;
      const cam = c.vue.camera(), dt = (now - t) / 1000;
      t = now;
      const v = cam.position.clone().sub(c.vue.cible).applyAxisAngle(cam.up.clone().normalize(), dt * 0.6);
      cam.position.copy(c.vue.cible).add(v);
      cam.lookAt(c.vue.cible);
      c.vue.invalider();
      requestAnimationFrame(tourner);
    };
    requestAnimationFrame(tourner);
  });

  /* ---------------- rendu ---------------- */
  si("bRendu", async () => {
    const o = await demanderRendu();
    if(!o) return;
    await tache(c, "Rendu", async () => {
      telechargerFichier(await (await rendreImage(c, o)).arrayBuffer(), `${nomProjet(c.doc.nom)}-rendu.png`);
    });
  });

  si("bRenduVues", async () => {
    const vues = c.doc.vues || [];
    if(!vues.length){ etat("Enregistrez d'abord des vues (onglet Affichage)."); return; }
    const o = await demanderRendu();
    if(!o) return;
    await tache(c, "Rendu des vues", async () => {
      const cam = c.vue.camera(), memo = { p:cam.position.clone(), u:cam.up.clone(), q:c.vue.cible.clone() };
      const images = {};
      try{
        for(const v of vues){
          cam.position.fromArray(v.position); cam.up.fromArray(v.haut); c.vue.cible.fromArray(v.cible);
          cam.lookAt(c.vue.cible);
          cam.updateMatrixWorld();
          images[`${nomProjet(v.nom)}.png`] = new Uint8Array(await (await rendreImage(c, o)).arrayBuffer());
        }
      }finally{
        cam.position.copy(memo.p); cam.up.copy(memo.u); c.vue.cible.copy(memo.q);
        cam.lookAt(c.vue.cible);
        c.vue.invalider();
      }
      telechargerFichier(archive(images).buffer, `${nomProjet(c.doc.nom)}-rendus.zip`, "application/zip");
    });
  });
}

/** Les actions d'esquisse du ruban, à ajouter à celles de c6-conception.js. */
export function actionsEsquisse(c){
  const ed = c.editeur;
  return {
    echelle:() => ed.echelle(), deplacerEnt:() => ed.deplacerCopier(false), copierEnt:() => ed.deplacerCopier(true),
    autoContraindre:() => ed.autoContraindre(), boutsLibres:() => ed.boutsLibres(), pilotee:() => ed.basculerPilotee(), rayonDiam:() => ed.basculerRayon(),
    retirerPoint:() => ed.retirerPoint(), inverserSpline:() => ed.inverserSpline(), raccord:() => ed.raccord(),
    courbeEquation:() => ed.courbeEquation(), bissectrice:() => ed.bissectrice(), tangentePoint:() => ed.tangentePoint(), cercleTangent:() => ed.cercleTangent(),
    peigne:() => document.querySelector('[data-action="peigne"]').classList.toggle("on", ed.basculerPeigne()),
    intersection:async () => {
      const { r } = ed;
      if(!c.nomsCorps.length){ ed.statut("Aucun corps à couper."); return; }
      const res = await tache(c, "Coupe du modèle", () => c.envoyer({ type:"section", doc:c.docPourNoyau(), repere:{ o:r.o, x:r.x, y:r.y, n:r.n } }));
      if(!res) return;
      if(!res.lignes.length){ ed.statut("Ce plan ne coupe aucun corps."); return; }
      ed.transformer(() => {
        for(const l of res.lignes) l.slice(1).forEach((p, i) => ed.ligne(ed.point({ x:l[i][0], y:l[i][1], id:null }, { constr:true }), ed.point({ x:p[0], y:p[1], id:null }, { constr:true }), { constr:true }));
        return null;
      });
    },
  };
}
