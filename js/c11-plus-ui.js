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
import { nomenclature, operationsCollees, csvBalayage, archive, dxfEsquisse } from "./c12-exports.js";
import { echantillonSpline } from "./c2-esquisse.js";

const $ = (id) => document.getElementById(id);
const etat = (t) => { $("etatSel").textContent = t; };
const CLE_PRESSE_PAPIER = "web3d.conception.presse-papier";
const OUI_NON = { oui:"Oui", non:"Non" };

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
  };
}

export function defautsPlus({ derniere, mode }){
  return {
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
  lp[i] = { ...lp[i], options:{ rigide:"Rigide", pivot:"Pivot", glissiere:"Glissière", cylindrique:"Cylindrique", plan:"Plan" } };
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
  pl[mp] = { ...pl[mp], options:{ ...pl[mp].options, chemin:"Le long d'un chemin", tangent:"Tangent à un cylindre" } };
  const horsNouveaux = (o) => o.mode !== "chemin" && o.mode !== "tangent";
  for(const ch of pl.filter(c => c.cle === "base" || c.cle === "decalage")) ch.si = ((si) => (o) => horsNouveaux(o) && (!si || si(o)))(ch.si);
  pl.push({ cle:"chemin", type:"esquisse", nom:"Chemin", si:(o) => o.mode === "chemin" }, { cle:"position", type:"expr", nom:"Position (0 à 1)", si:(o) => o.mode === "chemin" },
    { cle:"cylindre", type:"designer", nom:"Face cylindrique", quoi:"cylindreAxe", si:(o) => o.mode === "tangent" });

  const ax = CHAMPS.axe;
  const ma = ax.findIndex(ch => ch.cle === "mode");
  ax[ma] = { ...ax[ma], options:{ ...ax[ma].options, normale:"Perpendiculaire à une face" } };
  for(const ch of ax.filter(c => c.quoi === "sommets" || /^[xyz][12]$/.test(c.cle))) ch.si = ((si) => (o) => o.mode !== "normale" && (!si || si(o)))(ch.si);
  ax.push({ cle:"face", type:"designer", nom:"Face plane", quoi:"faceTiree", si:(o) => o.mode === "normale" });

  CHAMPS.point.splice(1, 0, { cle:"cylindre", type:"designer", nom:"Centre d'un cylindre", quoi:"cylindreAxe" });
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
  c.vue.recenserMateriaux?.();
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

async function rendreImage(c, { largeur, hauteur, fond, ombres }){
  const { vue } = c, r = vue.renderer, cam = vue.camera();
  const taille = r.getSize(new THREE.Vector2()), ratio = r.getPixelRatio();
  const decor = [vue.annotations, vue.decor].map(o => [o, o.visible]);
  const fondScene = vue.scene.background, couleur = r.getClearColor(new THREE.Color()), alpha = r.getClearAlpha(), intensite = vue.scene.environmentIntensity;
  const ombresAvant = prefs.ombres;
  const memoCam = cam.isPerspectiveCamera ? { aspect:cam.aspect } : { left:cam.left, right:cam.right };
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
    r.render(vue.scene, cam);
    return await blobToile(r.domElement);
  }finally{
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

const REGLAGES_RENDU = [{ nom:"Largeur (pixels)", valeur:"1920" }, { nom:"Hauteur (pixels)", valeur:"1080" },
  { nom:"Fond", valeur:"theme", options:{ theme:"Celui de la vue", blanc:"Blanc", transparent:"Transparent" } }, { nom:"Ombres", valeur:"oui", options:OUI_NON }];

async function demanderRendu(){
  const r = await demander("Rendu", REGLAGES_RENDU, ([l, h]) => (+l >= 16 && +l <= 8192 && +h >= 16 && +h <= 8192) ? null : "De 16 à 8192 pixels de côté.");
  return r && { largeur:Math.round(+r[0]), hauteur:Math.round(+r[1]), fond:r[2], ombres:r[3] === "oui" };
}

/* -----------------------------------------------------------------------------
   Études de mouvement
   --------------------------------------------------------------------------- */
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
      const res = await chercherCollisions(c.vue.modele, { tol:0.05, pauses:false });
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
    { nom:"Chercher les contacts", valeur:"non", options:OUI_NON },
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
    nom:r[0] || "Étude", pas:Math.round(+r[1 + k]), suivi:r[2 + k] || null, contact:r[3 + k] === "oui" || r[4 + k] === "oui", arret:r[4 + k] === "oui", images:r[5 + k] === "oui",
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
    { nom:"Bibliothèque", valeur:"", options:{ "":"Personnalisée", ...Object.fromEntries(Object.keys(APPARENCES).map(n => [n, n])) } },
    { nom:"Couleur", valeur:base.couleur || "#a9b1bb", type:"color" },
    { nom:"Métal (0 à 1)", valeur:String(base.metal ?? 0.25) }, { nom:"Rugosité (0 à 1)", valeur:String(base.rugosite ?? 0.52) }, { nom:"Opacité (0 à 1)", valeur:String(base.opacite ?? 1) },
    { nom:"Matériau physique (masse)", valeur:base.materiau || "", options:{ "":"Celui de la pièce", ...Object.fromEntries(c.materiaux().map(n => [n, n])) } },
    { nom:"Effacer ce qui est posé", valeur:"non", options:OUI_NON },
  ], ([, , m, ru, op]) => [m, ru, op].every(x => x !== "" && +x >= 0 && +x <= 1) ? null : "Trois valeurs de 0 à 1.");
  if(!r) return;
  const lib = APPARENCES[r[0]];
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
