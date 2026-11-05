/* =============================================================================
   Conception 3D — c6-conception.js
   La page de conception : démarrage, ruban, historique, panneau d'opération,
   paramètres, fichiers. Organisation reprise de solidcraft (ruban MODÈLE /
   ESQUISSE, historique paramétrique, paramètres nommés), apparence et réglages
   de la visionneuse.

   Tout ce que la visionneuse sait déjà faire est repris tel quel : la scène,
   la navigation et ses préréglages de souris, le cube de vues, l'arbre (ici la
   liste des corps), la mesure, la coupe, les collisions, la boîte « Souris &
   vue ». La classe Interface (08-interface.js) s'y branche par héritage : on
   ne remplace que l'ouverture de fichiers et l'état des boutons.

   La géométrie est calculée dans un travailleur (c4-travailleur.js) ; la page
   ne garde que le document — la recette de la pièce — et le maillage affiché.
   ============================================================================= */
"use strict";

import * as THREE from "three";
import { chargerPrefs, prefs, surPrefs } from "./00-config.js";
import { Vue3D } from "./01-scene.js";
import { fabriqueMateriaux, construireNoeud, recenser, liberer } from "./02-import.js";
import { Navigation } from "./03-navigation.js";
import { CubeVue } from "./04-cube-vue.js";
import { Arbre, echapper } from "./05-arbre.js";
import { faceSous, contourFace, geometrieFace } from "./06-topologie.js";
import { demanderTexte, confirmer, avertir } from "./c0-dialogues.js";
import { Mesure } from "./07-mesure.js";
import { CoupeManager } from "./07b-coupe.js";
import { Interface, pieceSous } from "./08-interface.js";
import { telechargerFichier } from "./10-export-step.js";
import { nomProjet } from "./11-projets.js";
import { evaluerParametres, evaluateur, evaluer, NOM_PARAMETRE, appliquerConfiguration, lireParametresCsv } from "./c1-expressions.js";
import { NOMS_CONTRAINTES, nouvelleEsquisse, nouvelId as nouvelIdEsquisse, resoudre, axePerpendiculaire, ajouterPrimitives, lireDxf, lireSvg, repere, indexer, profils, cercle3Points, planConstruction } from "./c2-esquisse.js";
import { TYPES, nomHistorique, TROUS } from "./c3-operations.js";
import { EditeurEsquisse } from "./c5-esquisse-ui.js";
import { Frise, deplacementRefuse, deplacer, creerDossier, normaliserDossiers, dependances } from "./c7-frise.js";
import { ANALYSES, appliquerAnalyse } from "./c8-analyses.js";
import { controlerRegles, PROCEDES } from "./c10-regles.js";
import { champsAteliers, defautsAteliers, brancherAteliers, clicAtelier, poigneeBas, marquesAteliers, dessinerAides,
         fichierAtelier, appliquerEclate, verifierLiens, DESIGNATIONS_UNIQUES, AIDES_DESIGNATION } from "./c9-ateliers-ui.js";
import { champsPlus, defautsPlus, completerChamps, brancherPlus, actionsEsquisse, apresAffichage, copierOperations, collerOperations, matiereDe } from "./c11-plus-ui.js";
import { init_planegcs_module, GcsWrapper } from "../vendor/planegcs/index.js";

const $ = (id) => document.getElementById(id);
const FORMAT = "web3d-conception";
const CLE_BROUILLON = "web3d.conception.brouillon";
/* Maillage affiché → corps rendu par le noyau. Hors de userData : GLTFExporter le recopierait en entier. */
const CORPS = new WeakMap();

/* Masses volumiques en g/cm³ : de quoi peser une pièce imprimée ou usinée. */
const MATERIAUX = {
  PLA:1.24, PETG:1.27, ABS:1.04, ASA:1.07, "PA (nylon)":1.14, "Résine":1.15,
  Aluminium:2.70, Acier:7.85, Inox:7.93, Laiton:8.50, "Bois (chêne)":0.75,
};

/* Unité d'affichage : facteur depuis le mm. Le document et les calculs restent en mm. */
const UNITES = { mm:1, cm:0.1, m:0.001, in:1 / 25.4 };

/* -----------------------------------------------------------------------------
   Les champs de chaque opération, pour le panneau
   --------------------------------------------------------------------------- */
const MODE = { cle:"operation", type:"choix", nom:"Résultat",
  options:{ nouveau:"Nouveau corps", joindre:"Joindre", enlever:"Enlever", intersection:"Intersection" } };
const CIBLE = { cle:"corps", type:"corps", nom:"Corps visé", si:(o) => o.operation && o.operation !== "nouveau" };
const POSITION = ["x", "y", "z"].map(c => ({ cle:c, type:"expr", nom:`Position ${c.toUpperCase()} (mm)` }));
const NOM = { cle:"nom", type:"texte", nom:"Nom" };

/** Le nom d'axe des répétitions et révolutions : les axes de construction en plus. */
const axesConstruits = (c, op) => Object.fromEntries(c.doc.operations.slice(0, c.doc.operations.indexOf(op))
  .filter(o => o.type === "axe").map(o => ["ref:" + o.id, o.nom]));

/** Une taille normalisée remplit les cotes du trou (on peut les retoucher ensuite). */
function appliquerNorme(o){
  const t = TROUS[o.norme];
  o.filetage = t && o.usage === "taraude" ? o.norme : undefined;
  if(!t) return;
  o.diametre = String(o.usage === "taraude" ? t.taraude : t.passage);
  if(o.forme === "lamage"){ o.diamTete = String(t.lamageD); o.profTete = String(t.lamageP); }
  if(o.forme === "fraisure") o.diamTete = String(t.fraisureD);
}

const CHAMPS = {
  esquisse:[NOM,
    { cle:"plan", type:"choix", nom:"Plan",
      options:(c, o) => ({ XY:"XY (dessus)", XZ:"XZ (face)", YZ:"YZ (côté)",
        ...Object.fromEntries(c.doc.operations.slice(0, c.doc.operations.indexOf(o)).filter(p => p.type === "plan").map(p => ["ref:" + p.id, p.nom])),
        face:"Sur une face plane…" }),
      get:(o) => o.plan.base || (o.plan.ref ? "ref:" + o.plan.ref : "face"),
      set:(o, v) => {
        if(v.startsWith("ref:")) o.plan = { ref:v.slice(4) };
        else if(v !== "face") o.plan = { base:v, decalage:o.plan.decalage ?? "0" };
        else o.plan = { origine:o.plan.ref ? undefined : o.plan.origine, normale:o.plan.normale, xdir:o.plan.xdir };
      } },
    { cle:"decalage", type:"expr", nom:"Décalage (mm)", si:(o) => o.plan.base, get:(o) => o.plan.decalage ?? "0", set:(o, v) => { o.plan.decalage = v; } },
    { cle:"faceplan", type:"designer", nom:"Face", quoi:"facePlan", si:(o) => !o.plan.base && !o.plan.ref },
    { cle:"suivre", type:"case", nom:"Suivre la face si la pièce change", si:(o) => !o.plan.base && !o.plan.ref && o.plan.origine,
      get:(o) => o.plan.suivre, set:(o, v) => { o.plan.suivre = v; } }],
  extrusion:[NOM, { cle:"esquisse", type:"esquisse", nom:"Esquisse" }, { cle:"contours", type:"contours", nom:"Contours (aucun coché : tous)" },
    { cle:"sens", type:"choix", nom:"Sens", options:{ un:"Un côté", sym:"Symétrique (distance totale)", deux:"Deux côtés", jusqua:"Jusqu'à une face" } },
    { cle:"distance", type:"expr", nom:"Distance (mm)", si:(o) => o.sens !== "jusqua" },
    { cle:"distance2", type:"expr", nom:"Distance 2 (mm)", si:(o) => o.sens === "deux" },
    { cle:"faceLimite", type:"designer", nom:"Face limite", quoi:"faceLimite", si:(o) => o.sens === "jusqua" },
    { cle:"inverse", type:"case", nom:"Inverser le sens", si:(o) => !o.sens || o.sens === "un" || o.sens === "jusqua" },
    MODE, CIBLE],
  revolution:[NOM, { cle:"esquisse", type:"esquisse", nom:"Esquisse" }, { cle:"contours", type:"contours", nom:"Contours (aucun coché : tous)" },
    { cle:"axe", type:"axe", nom:"Axe" }, { cle:"angle", type:"expr", nom:"Angle (°)" }, MODE, CIBLE],
  balayage:[NOM, { cle:"esquisse", type:"esquisse", nom:"Profil" }, { cle:"chemin", type:"esquisse", nom:"Chemin" }, MODE, CIBLE],
  lissage:[NOM, { cle:"esquisses", type:"esquisses", nom:"Sections (dans l'ordre coché)" }, { cle:"regle", type:"case", nom:"Surfaces réglées" }, MODE, CIBLE],
  percage:[NOM, { cle:"esquisse", type:"esquisse", nom:"Esquisse des centres" }, { cle:"corps", type:"corps", nom:"Corps percé" },
    { cle:"norme", type:"choix", nom:"Taille normalisée", options:{ "":"Personnalisée", ...Object.fromEntries(Object.keys(TROUS).map(m => [m, m])) },
      set:(o, v) => { o.norme = v; appliquerNorme(o); } },
    { cle:"usage", type:"choix", nom:"Usage", options:{ taraude:"Taraudé (filetage cosmétique)", passage:"Passage de vis" }, si:(o) => o.norme,
      set:(o, v) => { o.usage = v; appliquerNorme(o); } },
    { cle:"forme", type:"choix", nom:"Forme", options:{ simple:"Simple", lamage:"Lamé", fraisure:"Fraisé" },
      set:(o, v) => { o.forme = v; appliquerNorme(o); } },
    { cle:"diametre", type:"expr", nom:"Diamètre (mm)" },
    { cle:"traversant", type:"case", nom:"Traversant" },
    { cle:"profondeur", type:"expr", nom:"Profondeur (mm)", si:(o) => !o.traversant },
    { cle:"diamTete", type:"expr", nom:"Diamètre de tête (mm)", si:(o) => o.forme !== "simple" },
    { cle:"profTete", type:"expr", nom:"Profondeur de tête (mm)", si:(o) => o.forme === "lamage" },
    { cle:"angleTete", type:"expr", nom:"Angle de fraisure (°)", si:(o) => o.forme === "fraisure" }],
  boite:[NOM, { cle:"L", type:"expr", nom:"Longueur X (mm)" }, { cle:"l", type:"expr", nom:"Largeur Y (mm)" }, { cle:"h", type:"expr", nom:"Hauteur Z (mm)" },
    { cle:"centre", type:"case", nom:"Centrée en X et Y" }, ...POSITION, MODE, CIBLE],
  cylindre:[NOM, { cle:"diametre", type:"expr", nom:"Diamètre (mm)" }, { cle:"h", type:"expr", nom:"Hauteur (mm)" },
    { cle:"axe", type:"choix", nom:"Axe", options:{ X:"X", Y:"Y", Z:"Z" } }, ...POSITION, MODE, CIBLE],
  sphere:[NOM, { cle:"diametre", type:"expr", nom:"Diamètre (mm)" }, ...POSITION, MODE, CIBLE],
  cone:[NOM, { cle:"d1", type:"expr", nom:"Diamètre bas (mm)" }, { cle:"d2", type:"expr", nom:"Diamètre haut (mm)" }, { cle:"h", type:"expr", nom:"Hauteur (mm)" }, ...POSITION, MODE, CIBLE],
  tore:[NOM, { cle:"D", type:"expr", nom:"Diamètre du tore (mm)" }, { cle:"d", type:"expr", nom:"Diamètre du tube (mm)" }, ...POSITION, MODE, CIBLE],
  plan:[NOM, { cle:"base", type:"choix", nom:"Plan de départ", options:{ XY:"XY (dessus)", XZ:"XZ (face)", YZ:"YZ (côté)" } },
    { cle:"decalage", type:"expr", nom:"Décalage (mm)" }, { cle:"angle", type:"expr", nom:"Inclinaison (°)" },
    { cle:"axe", type:"choix", nom:"Autour de", options:{ x:"Axe X du plan", y:"Axe Y du plan" } }],
  depouille:[NOM, { cle:"corps", type:"corps", nom:"Corps" }, { cle:"angle", type:"expr", nom:"Angle (°)" },
    { cle:"faces", type:"designer", nom:"Faces", quoi:"faces" },
    { cle:"plan", type:"choix", nom:"Plan neutre", options:{ XY:"XY", XZ:"XZ", YZ:"YZ" } }, { cle:"decalage", type:"expr", nom:"Décalage du plan (mm)" }],
  nervure:[NOM, { cle:"esquisse", type:"esquisse", nom:"Esquisse (lignes ouvertes)" }, { cle:"corps", type:"corps", nom:"Corps" },
    { cle:"epaisseur", type:"expr", nom:"Épaisseur (mm)" }, { cle:"distance", type:"expr", nom:"Hauteur (mm)" }, { cle:"inverse", type:"case", nom:"Inverser le sens" }],
  tuyau:[NOM, { cle:"chemin", type:"esquisse", nom:"Chemin" }, { cle:"diametre", type:"expr", nom:"Diamètre (mm)" },
    { cle:"paroi", type:"expr", nom:"Paroi (mm, 0 : plein)" }, MODE, CIBLE],
  ressort:[NOM, { cle:"diametre", type:"expr", nom:"Diamètre moyen (mm)" }, { cle:"fil", type:"expr", nom:"Diamètre du fil (mm)" },
    { cle:"pas", type:"expr", nom:"Pas (mm)" }, { cle:"tours", type:"expr", nom:"Nombre de tours" }, ...POSITION, MODE, CIBLE],
  gravure:[NOM, { cle:"esquisse", type:"esquisse", nom:"Esquisse" }, { cle:"contours", type:"contours", nom:"Contours (aucun coché : tous)" }, { cle:"corps", type:"corps", nom:"Corps" },
    { cle:"mode", type:"choix", nom:"Sens", options:{ creux:"En creux", relief:"En relief" } }, { cle:"profondeur", type:"expr", nom:"Profondeur (mm)" }],
  decouper:[NOM, { cle:"corps", type:"corps", nom:"Corps" }, { cle:"plan", type:"choix", nom:"Plan", options:{ XY:"XY", XZ:"XZ", YZ:"YZ" } },
    { cle:"decalage", type:"expr", nom:"Position du plan (mm)" }],
  echelle:[NOM, { cle:"corps", type:"corps", nom:"Corps" }, { cle:"facteur", type:"expr", nom:"Facteur" },
    { cle:"origine", type:"case", nom:"Par rapport à l'origine (sinon le centre)" }, { cle:"copie", type:"case", nom:"Copie (nouveau corps)" }],
  tirer:[NOM, { cle:"corps", type:"corps", nom:"Corps" }, { cle:"face", type:"designer", nom:"Face", quoi:"faceTiree" },
    { cle:"distance", type:"expr", nom:"Distance (mm, négative : enlève)" }],
  conge:[NOM, { cle:"corps", type:"corps", nom:"Corps" }, { cle:"rayon", type:"expr", nom:"Rayon (mm)" }, { cle:"rayon2", type:"expr", nom:"Rayon d'arrivée (mm, vide : constant)", vide:true },
    { cle:"toutes", type:"case", nom:"Toutes les arêtes" }, { cle:"aretes", type:"designer", nom:"Arêtes", quoi:"aretes", si:(o) => !o.toutes }],
  chanfrein:[NOM, { cle:"corps", type:"corps", nom:"Corps" }, { cle:"distance", type:"expr", nom:"Distance (mm)" }, { cle:"distance2", type:"expr", nom:"Seconde distance (mm, vide : égale)", vide:true },
    { cle:"toutes", type:"case", nom:"Toutes les arêtes" }, { cle:"aretes", type:"designer", nom:"Arêtes", quoi:"aretes", si:(o) => !o.toutes }],
  coque:[NOM, { cle:"corps", type:"corps", nom:"Corps" }, { cle:"epaisseur", type:"expr", nom:"Épaisseur (mm)" },
    { cle:"faces", type:"designer", nom:"Faces retirées", quoi:"faces" }, { cle:"exterieur", type:"case", nom:"Épaisseur vers l'extérieur" }],
  combiner:[NOM, { cle:"cible", type:"corps", nom:"Corps cible" }, { cle:"outils", type:"corpsMulti", nom:"Corps outils" },
    { cle:"operation", type:"choix", nom:"Opération", options:{ joindre:"Joindre", enlever:"Enlever", intersection:"Intersection" } },
    { cle:"garder", type:"case", nom:"Garder les corps outils" }],
  deplacer:[NOM, { cle:"corps", type:"corps", nom:"Corps" },
    ...["tx", "ty", "tz"].map((c, i) => ({ cle:c, type:"expr", nom:`Translation ${"XYZ"[i]} (mm)` })),
    ...["rx", "ry", "rz"].map((c, i) => ({ cle:c, type:"expr", nom:`Rotation ${"XYZ"[i]} (°)` })),
    { cle:"copie", type:"case", nom:"Copie (nouveau corps)" }],
  miroir:[NOM, { cle:"corps", type:"corps", nom:"Corps" }, { cle:"plan", type:"choix", nom:"Plan", options:{ YZ:"YZ (miroir en X)", XZ:"XZ (miroir en Y)", XY:"XY (miroir en Z)" } },
    { cle:"decalage", type:"expr", nom:"Décalage du plan (mm)" }, { cle:"separe", type:"case", nom:"Corps séparé (sinon joint)" }],
  repetition:[NOM, { cle:"corps", type:"corps", nom:"Corps" },
    { cle:"mode", type:"choix", nom:"Type", options:{ lineaire:"Linéaire", circulaire:"Circulaire (autour d'un axe passant par l'origine)" } },
    { cle:"axe", type:"choix", nom:"Direction / axe", options:(c, op) => ({ X:"X", Y:"Y", Z:"Z", ...axesConstruits(c, op) }) },
    { cle:"nombre", type:"expr", nom:"Nombre d'exemplaires" },
    { cle:"pas", type:"expr", nom:"Pas (mm)", si:(o) => o.mode !== "circulaire" },
    { cle:"angle", type:"expr", nom:"Angle total (°)", si:(o) => o.mode === "circulaire" },
    { cle:"separe", type:"case", nom:"Corps séparés (sinon joints)" }],
  step:[NOM, { cle:"reference", type:"case", nom:"Référence (pour dessiner autour, non exportée)" }],
};

/* Les ateliers apportent leurs champs (le plan de construction y gagne ses autres modes). */
Object.assign(CHAMPS, champsAteliers({ NOM, MODE, CIBLE, POSITION }), champsPlus({ NOM, MODE, CIBLE }));
completerChamps(CHAMPS);

function nouvelleOperation(type, ctrl){
  const esquisses = ctrl.doc.operations.filter(o => o.type === "esquisse");
  const derniere = esquisses[esquisses.length - 1]?.id || "";
  const mode = ctrl.nomsCorps.length ? "joindre" : "nouveau";
  const base = { id:ctrl.nouvelId(), type, nom:`${TYPES[type].nom} ${ctrl.doc.operations.filter(o => o.type === type).length + 1}` };
  const P = { x:"0", y:"0", z:"0" };
  const defauts = {
    ...defautsAteliers({ derniere, avant:esquisses[esquisses.length - 2]?.id || "", mode, P, premierCorps:ctrl.nomsCorps[0] || "" }),
    ...defautsPlus({ derniere, mode }),
    extrusion:{ esquisse:derniere, distance:"10", sens:"un", operation:mode, corps:"" },
    revolution:{ esquisse:derniere, axe:"y", angle:"360", operation:mode, corps:"" },
    balayage:{ esquisse:esquisses[esquisses.length - 2]?.id || "", chemin:derniere, operation:mode, corps:"" },
    lissage:{ esquisses:[], regle:false, operation:mode, corps:"" },
    percage:{ esquisse:derniere, corps:"", norme:"", usage:"taraude", forme:"simple", diametre:"5", traversant:true, profondeur:"10", diamTete:"9", profTete:"3", angleTete:"90" },
    boite:{ L:"20", l:"20", h:"20", centre:true, ...P, operation:mode, corps:"" },
    cylindre:{ diametre:"20", h:"20", axe:"Z", ...P, operation:mode, corps:"" },
    sphere:{ diametre:"20", ...P, operation:mode, corps:"" },
    cone:{ d1:"20", d2:"0", h:"20", ...P, operation:mode, corps:"" },
    tore:{ D:"40", d:"10", ...P, operation:mode, corps:"" },
    tirer:{ corps:"", distance:"5", face:null },
    depouille:{ corps:"", angle:"3", faces:[], plan:"XY", decalage:"0" },
    nervure:{ esquisse:derniere, corps:"", epaisseur:"2", distance:"5", inverse:false },
    tuyau:{ chemin:derniere, diametre:"10", paroi:"0", operation:mode, corps:"" },
    ressort:{ diametre:"20", fil:"2", pas:"5", tours:"5", ...P, operation:mode, corps:"" },
    gravure:{ esquisse:derniere, corps:"", mode:"creux", profondeur:"1" },
    decouper:{ corps:"", plan:"XY", decalage:"0" },
    echelle:{ corps:"", facteur:"2", origine:false, copie:false },
    conge:{ corps:"", rayon:"2", toutes:false, aretes:[] },
    chanfrein:{ corps:"", distance:"1", toutes:false, aretes:[] },
    coque:{ corps:"", epaisseur:"2", faces:[], exterieur:false },
    combiner:{ cible:ctrl.nomsCorps[0] || "", outils:[], operation:"joindre", garder:false },
    deplacer:{ corps:"", tx:"0", ty:"0", tz:"0", rx:"0", ry:"0", rz:"0", copie:false },
    miroir:{ corps:"", plan:"YZ", decalage:"0", separe:false },
    repetition:{ corps:"", mode:"lineaire", axe:"X", nombre:"3", pas:"20", angle:"360", separe:false },
  };
  if(type === "esquisse"){
    const e = nouvelleEsquisse(base.id, base.nom, { base:"XY", decalage:"0" });
    /* L'origine du plan : un point fixe sur lequel accrocher et coter. */
    e.elements.push({ id:"o", type:"point", x:0, y:0, constr:true });
    e.contraintes.push({ id:"ko", type:"fixe", a:"o", x:0, y:0 });
    return e;
  }
  return { ...base, ...(defauts[type] || {}) };
}

/* =============================================================================
   L'interface de la visionneuse, branchée sur la page de conception
   ============================================================================= */
class InterfaceConception extends Interface {
  /** Fichiers choisis ou déposés : ce sont des pièces, des STEP ou des esquisses à importer. */
  charger(fichiers){ return this.conception?.ouvrirFichiers(fichiers); }
  brancherExportPiece(){ /* l'export STEP passe par le noyau de conception (bouton ⬚) */ }
  ouvrirModalExport(){ return this.conception?.exporter("step"); }      // bouton d'export de l'arbre
  majEtatBoutons(){
    const n = this.vue.modele.children.filter(o => o.userData.estPiece).length;
    $("bCollisions").disabled = n < 2;
    $("bGlb").disabled = !n;
    const ortho = this.vue.projection === "ortho";
    $("bProjection").innerHTML = `<i>⬚</i>${ortho ? "Orthographique" : "Perspective"}`;
    $("bProjection").classList.toggle("on", ortho);
    $("bProjectionNav").classList.toggle("on", ortho);
    $("bGrille").classList.toggle("on", prefs.grille);
    $("bAretes").classList.toggle("on", prefs.aretes);
    const clair = prefs.theme === "clair";
    $("bTheme").textContent = clair ? "☾" : "☀️";
    $("bTheme").title = clair ? "Passer au thème sombre — T" : "Passer au thème clair — T";
  }
  nomCourt(){ return this.conception?.doc.nom || "piece"; }
  /** Les arêtes affichées sont celles du B-Rep : l'angle de détection ne les concerne pas. */
  recalculerAretes(){ this.conception?.reconstruire(); }
}

/* =============================================================================
   Le contrôleur de la conception
   ============================================================================= */
class Conception {
  constructor({ vue, nav, arbre, ui, gcs }){
    Object.assign(this, { vue, nav, arbre, ui, gcs });
    this.doc = this.docVide();
    this.cheminProjet = null;
    this.modifie = false;
    this.pileAnnuler = []; this.pileRefaire = [];
    this.nomsCorps = [];
    this.resultat = null;
    this.selOp = null;
    this.selOps = new Set();          // opérations choisies dans la frise (dossiers)
    this.edition = null;              // { op, avant, nouvelle } pendant le panneau
    this.designation = null;          // "aretes" | "faces" | "facePlan"
    this.marques = new THREE.Group();
    this.origine = this.construireOrigine();
    this.esquissesVues = new THREE.Group();
    this.survol = new THREE.Group();
    this.faceVue = new THREE.Group();
    this.faceChoisie = null;
    this.traits = new Map();          // le tracé de chaque désignation, gardé quand la pièce montrée ne l'a plus
    vue.annotations.add(this.marques, this.survol, this.faceVue, this.origine, this.esquissesVues);
    this.frise = new Frise(this, $("frisePiste"));
    this.onglets = [null];            // les autres pièces ouvertes ; celle qu'on édite vit dans this.doc…
    this.ongletActif = 0;
    this.analyse = null;
    this.filtre = { corps:true, faces:true, references:true };
    this.premiereVue = true;
    this.idRequete = 0;
    this.attentes = new Map();
    this.creerTravailleur();

    this.editeur = new EditeurEsquisse({
      vue, nav, gcs, ctr:$("ctr"),
      memoriser:(avant) => this.memoriser(avant),
      surModif:() => this.marquerModifie(),
      surStatut:(t) => { $("etatSel").textContent = t; },
      surListe:() => this.editeur.ouvert && this.editeur.remplirListe($("props")),
      contourTexte:(contenu, h) => this.contourTexte(contenu, h),
    });

    this.brancher();
    /* Petit écran : la vue d'abord, panneaux repliés (au chargement, et quand l'écran rétrécit). */
    const petit = matchMedia("(max-width:900px)");
    const replier = () => { if(petit.matches) for(const b of document.querySelectorAll(".flottant:not(.replie) .plier")) b.click(); };
    petit.addEventListener("change", replier);
    replier();
    this.majHistorique();
    this.majTitre();
  }

  /** Le contour exact d'un texte, demandé une fois au noyau ; null tant qu'il n'est pas arrivé. */
  contourTexte(contenu, h){
    const cle = h + "|" + contenu;
    this.contours ||= new Map();
    if(this.contours.has(cle)) return this.contours.get(cle);
    this.contours.set(cle, null);
    this.envoyer({ type:"contourTexte", contenu, h })
      .then(r => { this.contours.set(cle, r.lignes); if(this.editeur.ouvert) this.editeur.redessiner(); })
      .catch((e) => { if(e.abandon) this.contours.delete(cle); /* sinon police indisponible : le cadre reste, le volume signalera l'erreur */ });
    return null;
  }

  docVide(){
    return { format:FORMAT, version:1, nom:"piece", materiau:"PLA", parametres:[], operations:[], dossiers:[], vues:[], configurations:[], unite:"mm", compteur:0 };
  }

  nouvelId(){ this.doc.compteur = (this.doc.compteur || 0) + 1; return "op" + this.doc.compteur; }

  valeurs(){ return evaluerParametres(this.doc.parametres).valeurs; }
  v(){ return evaluateur(this.valeurs()); }

  /* ==========================================================================
     Boutons et clavier
     ========================================================================== */
  brancher(){
    for(const b of document.querySelectorAll("#ruban [data-op]")) b.onclick = () => this.creer(b.dataset.op);
    for(const b of document.querySelectorAll("#ruban [data-outil]")) b.onclick = () => { this.editeur.choisirOutil(b.dataset.outil); this.majRuban(); };
    for(const b of document.querySelectorAll("#ruban [data-contrainte]")) b.onclick = () => this.editeur.contraindre(b.dataset.contrainte);
    const actions = {
      construction:() => this.editeur.basculerConstruction(),
      supprimer:() => this.editeur.supprimer(),
      cote:() => this.editeur.coter(),
      distanceX:() => this.editeur.coter("distanceX"),
      distanceY:() => this.editeur.coter("distanceY"),
      terminer:() => this.terminerEsquisse(),
      plan:() => this.editerPlan(),
      decaler:() => this.editeur.decaler(),
      conge:() => this.editeur.casserCoin("conge"),
      chanfrein:() => this.editeur.casserCoin("chanfrein"),
      miroir:() => this.editeur.miroir(),
      repRect:() => this.editeur.repetition("rect"),
      repCirc:() => this.editeur.repetition("circ"),
      projeter:() => this.designer(this.designation === "projeter" ? null : "projeter"),
      ...actionsEsquisse(this),
    };
    for(const b of document.querySelectorAll("#ruban [data-action]")) b.onclick = () => actions[b.dataset.action]();
    for(const b of document.querySelectorAll(".ong-ruban")) b.onclick = () => this.ongletRuban(b.dataset.onglet);

    $("bParametres").onclick = $("bParametres2").onclick = $("navParametres").onclick = () => this.ouvrirParametres();
    this.brancherDisposition();
    brancherAteliers(this);
    brancherPlus(this);
    $("bAjouterParametre").onclick = () => this.ajouterParametre();
    $("bInsererDxf").onclick = () => this.choisirFichier(".dxf,.svg");
    $("bFermer").onclick = () => this.nouveau();
    $("bOuvrir").onclick = () => this.choisirFichier(".json,.stp,.step,.dxf,.svg");
    $("bOuvrirRuban").onclick = () => this.choisirFichier(".json");
    $("bInsererNuage").onclick = () => this.choisirFichier(".xyz,.csv,.pts,.ply,.txt");
    $("bEnregistrer").onclick = $("bEnregistrerMenu").onclick = () => this.enregistrer(false);
    $("bEnregistrerSous").onclick = () => this.enregistrer(true);
    $("bAnnuler").onclick = () => this.annuler();
    $("bRefaire").onclick = () => this.refaire();
    $("bExportPiece").onclick = () => this.exporter("step");
    $("bExportStl").onclick = () => this.exporter("stl");
    $("bValiderOperation").onclick = () => this.validerOperation();
    $("bAnnulerOperation").onclick = $("bFermerOperation").onclick = () => this.annulerOperation();

    /* En capture : passe avant le clavier de la visionneuse (08-interface.js), qui garde
       les touches que la conception n'utilise pas (vues, affichage, mesure…). */
    addEventListener("keydown", (e) => {
      const t = e.target;
      if(t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
      if(document.querySelector("dialog[open]")) return;
      if(this.touche(e)){ e.preventDefault(); e.stopImmediatePropagation(); }
    }, true);

    addEventListener("beforeunload", (e) => { this.sauverOnglet(); if(this.onglets.some(o => o.modifie)) e.preventDefault(); });
  }

  touche(e){
    const k = e.key.toLowerCase();
    if(e.ctrlKey || e.metaKey){
      if(k === "z" && !e.shiftKey){ this.annuler(); return true; }
      if(k === "y" || (k === "z" && e.shiftKey)){ this.refaire(); return true; }
      if(k === "s"){ this.enregistrer(false); return true; }
      if(k === "c" && !e.altKey) return this.editeur.ouvert ? this.editeur.copier() : copierOperations(this);
      if(k === "v" && !e.altKey) return this.editeur.ouvert ? this.editeur.coller() : collerOperations(this);
      return false;
    }
    if(e.altKey) return false;
    if(e.shiftKey && k === "r" && this.derniereCommande && !this.editeur.ouvert){ this.creer(this.derniereCommande); return true; }
    if(k === "s"){ $("rechCommande").focus(); return true; }
    if(k === "escape" && this.designation){ this.designer(null); return true; }
    if(k === "escape" && this.edition){ this.annulerOperation(); return true; }
    if(k === "enter" && this.edition){ this.validerOperation(); return true; }
    const ed = this.editeur;
    if(ed.ouvert){
      if(k === "enter" && ed.outil === "spline" && ed.clics.length){ ed.finirSpline(); return true; }
      const outils = { l:"ligne", r:"rectangle", o:"cercle", p:"point", t:"ajuster" };
      if(outils[k]){ ed.choisirOutil(outils[k]); this.majRuban(); return true; }
      if(/^polygone/.test(ed.outil || "") && /^[3-9]$/.test(k)){ ed.nbCotes = +k; ed.statut(); return true; }
      switch(k){
        case "escape": if(!ed.echap()) this.terminerEsquisse(); this.majRuban(); return true;
        case "enter": this.terminerEsquisse(); return true;
        case "d": ed.coter(); return true;
        case "h": ed.contraindre("horizontal"); return true;
        case "v": ed.contraindre("vertical"); return true;
        case "x": ed.basculerConstruction(); return true;
        case "delete": case "backspace": ed.supprimer(); return true;
      }
      return false;
    }
    return false;
  }

  ongletRuban(nom){
    for(const b of document.querySelectorAll(".ong-ruban")) b.classList.toggle("on", b.dataset.onglet === nom);
    for(const g of document.querySelectorAll("#ruban .groupes")) g.hidden = g.dataset.volet !== nom;
  }

  majRuban(){
    const ed = this.editeur.ouvert;
    document.querySelector('.ong-ruban[data-onglet="esquisse"]').hidden = !ed;
    for(const b of document.querySelectorAll("#ruban [data-outil]")) b.classList.toggle("on", this.editeur.outil === b.dataset.outil);
    for(const b of document.querySelectorAll("#ruban [data-op], #bInsererStep, #bInsererDxf, #bOuvrirRuban, #bParametres, #bParametres2, #bParamImporter, #bConfigurations")) b.disabled = ed || !!this.edition;
    $("bAnnuler").disabled = !this.pileAnnuler.length;
    $("bRefaire").disabled = !this.pileRefaire.length;
  }

  /* ==========================================================================
     Annuler / refaire, état modifié, brouillon
     ========================================================================== */
  memoriser(avant = JSON.stringify(this.doc)){
    const instant = JSON.parse(avant);
    if(!instant.operations){                    // l'éditeur d'esquisse n'envoie que l'esquisse d'avant
      const doc = JSON.parse(JSON.stringify(this.doc));
      doc.operations = doc.operations.map(o => o.id === instant.id ? instant : o);
      avant = JSON.stringify(doc);
    }
    this.pileAnnuler.push(avant);
    if(this.pileAnnuler.length > 200) this.pileAnnuler.shift();
    /* Images et STEP voyagent dans chaque étape : 200 Mo d'historique au plus, le Pi n'a pas plus à donner. */
    let total = this.pileAnnuler.reduce((n, t) => n + t.length, 0);
    while(total > 2e8 && this.pileAnnuler.length > 1) total -= this.pileAnnuler.shift().length;
    this.pileRefaire = [];
    this.majRuban();
  }

  restaurer(json){
    this.doc = JSON.parse(json);
    if(this.edition) this.fermerPanneau();
    if(this.designation) this.designer(null);
    if(this.editeur.ouvert){
      const esq = this.doc.operations.find(o => o.id === this.editeur.esq.id);
      if(esq) this.editeur.remplacer(esq);
      else this.terminerEsquisse();
    }
    this.marquerModifie();
    this.majHistorique();
    verifierLiens(this);
    this.reconstruire();
  }

  annuler(){
    if(this.edition && !this.edition.plan){ this.annulerOperation(); return; }
    if(!this.pileAnnuler.length) return;
    this.pileRefaire.push(JSON.stringify(this.doc));
    this.restaurer(this.pileAnnuler.pop());
    this.majRuban();
  }

  refaire(){
    if(!this.pileRefaire.length) return;
    this.pileAnnuler.push(JSON.stringify(this.doc));
    this.restaurer(this.pileRefaire.pop());
    this.majRuban();
  }

  marquerModifie(){
    this.modifie = true;
    this.majTitre();
    clearTimeout(this._tBrouillon);
    this._tBrouillon = setTimeout(() => this.sauverBrouillon(), 800);
  }

  /** Les pièces modifiées et non enregistrées, gardées dans ce navigateur. */
  sauverBrouillon(){
    this.sauverOnglet();
    const pieces = this.onglets.filter(o => o.modifie).map(o => ({ doc:o.doc, chemin:o.chemin }));
    try{
      if(pieces.length) localStorage.setItem(CLE_BROUILLON, JSON.stringify({ onglets:pieces }));
      else localStorage.removeItem(CLE_BROUILLON);
    }catch(_){
      /* Trop gros pour le stockage local (STEP, images) : pas de brouillon périmé qui reviendrait à sa place. */
      localStorage.removeItem(CLE_BROUILLON);
      $("etatSel").textContent = "⚠ Pièce trop lourde pour le brouillon automatique : enregistrez-la.";
    }
  }

  majTitre(){
    this.sauverOnglet();
    const nomDe = (o) => (o.chemin || o.doc.nom + ".json") + (o.modifie ? " •" : "");
    document.title = `${nomDe(this.onglets[this.ongletActif])} — Conception 3D`;
    const hote = $("ongletsDocs");
    hote.replaceChildren();
    this.onglets.forEach((o, i) => {
      const t = document.createElement("div");
      t.className = "onglet-doc" + (i === this.ongletActif ? " on" : "");
      const n = document.createElement("span");
      n.textContent = nomDe(o);
      t.title = nomDe(o);
      t.appendChild(n);
      t.onclick = () => this.activerOnglet(i);
      if(this.onglets.length > 1){
        const x = document.createElement("button");
        x.textContent = "✕"; x.title = "Fermer cette pièce";
        x.onclick = (e) => { e.stopPropagation(); this.fermerOnglet(i); };
        t.appendChild(x);
      }
      hote.appendChild(t);
    });
    const plus = document.createElement("button");
    plus.className = "onglet-plus"; plus.textContent = "+"; plus.title = "Nouvelle pièce";
    plus.onclick = () => this.nouveau();
    hote.appendChild(plus);
  }

  /* ==========================================================================
     Plusieurs pièces ouvertes
     ========================================================================== */
  sauverOnglet(){
    this.onglets[this.ongletActif] = { doc:this.doc, chemin:this.cheminProjet, modifie:this.modifie,
      pileAnnuler:this.pileAnnuler, pileRefaire:this.pileRefaire, selOps:this.selOps };
  }

  chargerOnglet(i){
    const o = this.onglets[i];
    this.ongletActif = i;
    this.doc = o.doc; this.cheminProjet = o.chemin; this.modifie = o.modifie;
    this.pileAnnuler = o.pileAnnuler; this.pileRefaire = o.pileRefaire; this.selOps = o.selOps;
    this.selOp = null;
    this.resultat = null;
    this.premiereVue = true;
    this.majTitre();
    this.majHistorique();
    this.majRuban();
    verifierLiens(this);
    return this.reconstruire();
  }

  /** Quitte proprement ce qui est en cours d'édition avant de changer de pièce. */
  finirEditions(){
    if(this.edition) this.annulerOperation();
    if(this.editeur.ouvert) this.terminerEsquisse();
  }

  activerOnglet(i){
    if(i === this.ongletActif) return;
    this.finirEditions();
    this.sauverOnglet();
    this.chargerOnglet(i);
  }

  /** Une pièce de plus, dans un nouvel onglet. */
  async ouvrirOnglet(doc, chemin, modifie){
    verifierPiece(doc);
    this.finirEditions();
    this.sauverOnglet();
    this.onglets.push({ doc, chemin, modifie, pileAnnuler:[], pileRefaire:[], selOps:new Set() });
    return this.chargerOnglet(this.onglets.length - 1);
  }

  async fermerOnglet(i){
    this.sauverOnglet();
    const o = this.onglets[i];
    if(o.modifie && !await confirmer(`« ${o.doc.nom} » n'est pas enregistrée. La fermer quand même ?`, "Fermer sans enregistrer")) return;
    i = this.onglets.indexOf(o);               // la boîte a laissé la page vivre : un autre onglet a pu se fermer
    if(i < 0) return;
    if(i !== this.ongletActif){               // en arrière-plan : la pièce active et sa vue ne bougent pas
      this.onglets.splice(i, 1);
      if(i < this.ongletActif) this.ongletActif--;
      this.majTitre();
      this.sauverBrouillon();
      return;
    }
    this.finirEditions();
    this.onglets.splice(i, 1);
    this.chargerOnglet(Math.min(i, this.onglets.length - 1));
    this.sauverBrouillon();
  }

  /* ==========================================================================
     Page d'accueil
     ========================================================================== */
  async montrerAccueil(){
    const hote = $("accueil");
    hote.innerHTML = `<div class="vide"><h2>Conception 3D</h2>
      <p>Une pièce paramétrique : des esquisses cotées, des opérations dans l'historique, des paramètres nommés.</p>
      <div class="accueil-actions">
        <button class="tb on" id="bAccueilNouveau">Nouvelle pièce</button>
        <button class="tb" id="bAccueilOuvrir">▱ Ouvrir…</button>
        <button class="tb" id="bAccueilFermer">Revenir à la pièce</button>
      </div>
      <h4>Pièces récentes</h4><div class="accueil-liste" id="accueilListe"><p class="vide-p">Aucune pièce enregistrée.</p></div></div>`;
    hote.hidden = false;
    $("bAccueilNouveau").onclick = () => {
      hote.hidden = true;
      if(this.doc.operations.length || this.modifie) this.nouveau();
    };
    $("bAccueilOuvrir").onclick = () => this.choisirFichier(".json,.stp,.step,.dxf,.svg");
    $("bAccueilFermer").onclick = () => { hote.hidden = true; };
    if(!this.projetsDispo) return;
    try{
      const j = await (await fetch("api/projets", { cache:"no-store" })).json();
      const pieces = j.fichiers.filter(f => /\.json$/i.test(f.chemin)).slice(0, 10);
      if(pieces.length) $("accueilListe").replaceChildren(...pieces.map(f => {
        const b = document.createElement("button");
        b.append(document.createTextNode(f.chemin), Object.assign(document.createElement("span"), {
          className:"date", textContent:new Date(f.date * 1000).toLocaleDateString("fr-FR") }));
        b.onclick = async () => {
          hote.hidden = true;
          try{ await this.ouvrirProjet(f.chemin); }catch(e){ avertir(`Impossible d'ouvrir : ${e.message}`); }
        };
        return b;
      }));
    }catch(_){ /* liste indisponible : l'accueil reste utilisable */ }
  }

  /* ==========================================================================
     Reconstruction
     ========================================================================== */
  creerTravailleur(){
    this.travailleur = new Worker("js/c4-travailleur.js", { type:"module" });
    this.travailleur.onmessage = (ev) => this.recevoir(ev.data);
    this.travailleur.onerror = (e) => {
      const err = new Error("Le noyau OpenCascade s'est arrêté : " + (e.message || "erreur inconnue"));
      err.fatale = this.noyauPret;           // au démarrage, relancer ne servirait à rien : le fichier manque
      for(const a of this.attentes.values()) a.ko(err);        // sinon reconstruire() attendrait pour toujours
      this.attentes.clear();
      this.statutErreur(err.message);
    };
  }

  /**
   * Le noyau est mort ou bloqué : un travailleur neuf, et le document intact. L'opération en cause
   * est suspendue (une étape d'annulation la rétablit) : sinon la reconstruction replanterait.
   */
  relancerNoyau(raison, opId = null){
    this.travailleur.terminate();
    for(const a of this.attentes.values()) a.ko(Object.assign(new Error(raison), { abandon:true }));
    this.attentes.clear();
    this.creerTravailleur();
    this.opEnCalcul = null;
    /* Deux pannes de suite sans coupable : on n'insiste pas, la main revient à l'utilisateur. */
    this.pannes = (this.pannes || 0) + 1;
    const op = opId && this.doc.operations.find(o => o.id === opId);
    if(op && !op.suspendue){
      this.memoriser();
      op.suspendue = true;
      this.marquerModifie();
      this.pannes = 0;
    }
    const nom = op ? ` « ${op.nom} » est suspendue : modifiez-la ou réactivez-la.` : "";
    this.statutErreur(`${raison}${nom}`);
    $("etatSel").textContent = `⚠ ${raison}${nom}`;
    this.majHistorique();
    if(this.pannes < 2) setTimeout(() => this.reconstruire());
    else this.echecConstruction(raison);
  }

  /**
   * Le tas du noyau ne redescend jamais : à force de modifications il finirait par saturer le Pi.
   * Passé le seuil, on repart d'un noyau neuf à la première pause, sans rien perdre (seul le cache est refait).
   */
  surveillerTas(tas){
    clearTimeout(this._tTas);
    /* Une pièce lourde peut dépasser le seuil dès la reconstruction : on ne relance que si le tas a nettement grossi depuis. */
    if(this.tasNeuf === null){ this.tasNeuf = tas; return; }
    if(!(tas > (this.seuilTas ?? 1.2e9)) || tas < 1.5 * (this.tasNeuf || 0)) return;
    this._tTas = setTimeout(() => {
      if(this.enCours || this.edition || this.editeur.ouvert || this.attentes.size){ this.surveillerTas(tas); return; }
      this.travailleur.terminate();
      this.creerTravailleur();
      this.tasNeuf = null;
      this.reconstruire();
      $("etatSel").textContent = "Mémoire du noyau libérée.";
    }, 3000);
  }

  /** Le calcul en cours dure : on propose de l'arrêter. */
  surveillerCalcul(){
    const b = $("bArreterCalcul");
    clearTimeout(this._tSurveille);
    b.hidden = true;
    this._tSurveille = setTimeout(() => { if(this.enCours) b.hidden = false; }, 20000);
  }

  envoyer(message, transferts = []){
    const id = ++this.idRequete;
    return new Promise((ok, ko) => {
      this.attentes.set(id, { ok, ko });
      /* Refusé au départ (pièce non transmissible) : pas de réponse à attendre, sinon le noyau paraît occupé pour toujours. */
      try{ this.travailleur.postMessage({ ...message, id }, transferts); }
      catch(e){ this.attentes.delete(id); ko(e); }
    });
  }

  recevoir(m){
    if(m.type === "progres"){ this.ui.attendre(true, "Conception 3D", m.etape); return; }
    if(m.type === "etape"){ this.opEnCalcul = m.opId; return; }
    const a = this.attentes.get(m.id);
    if(!a) return;
    this.attentes.delete(m.id);
    this.noyauPret = true;
    if(m.type === "erreur") a.ko(Object.assign(new Error(m.message), { fatale:m.fatale, opId:m.opId })); else a.ok(m);
  }

  /** Les esquisses posées sur un plan de construction : leur plan se déduit de lui. */
  resoudrePlans(){
    const v = this.v();
    for(const op of this.doc.operations){
      if(op.type !== "esquisse" || !op.plan.ref) continue;
      const p = this.doc.operations.find(o => o.id === op.plan.ref);
      try{ if(p) Object.assign(op.plan, planConstruction(p, v, this.doc)); }catch(_){ /* cote illisible : le plan garde sa dernière position */ }
    }
  }

  /** Le document tel que le noyau doit le construire : esquisses résolues, curseur d'édition. */
  docPourNoyau(){
    const doc = this.docConstruit();
    const a = this.valeurAnimee, etude = this.valeursAnimees;      // pendant l'animation d'une liaison, sans toucher au document
    if(etude) return { ...doc, operations:doc.operations.map(o => etude[o.id] !== undefined ? { ...o, valeur:etude[o.id] } : o) };
    return a ? { ...doc, operations:doc.operations.map(o => o.id === a.id ? { ...o, valeur:a.valeur } : o) } : doc;
  }

  docConstruit(){
    const v = this.v();
    this.resoudrePlans();
    for(const op of this.doc.operations) if(op.type === "esquisse") resoudre(this.gcs, op, v);
    const doc = this.doc;
    if(this.designation && this.edition && !this.editeur.ouvert){
      /* On désigne sur la pièce d'avant l'opération : sinon l'arête déjà arrondie ne se retrouve plus. */
      return { ...doc, curseur:Math.min(doc.curseur ?? Infinity, doc.operations.indexOf(this.edition.op)) };
    }
    if(!this.editeur.ouvert) return doc;
    /* Pendant l'édition d'une esquisse, on montre la pièce telle qu'elle était juste avant. */
    const i = doc.operations.findIndex(o => o.id === this.editeur.esq.id);
    return { ...doc, curseur:Math.min(doc.curseur ?? Infinity, i) };
  }

  async reconstruire(){
    if(this.enCours){ this.relancer = true; return; }
    this.enCours = true;
    $("etatStats").textContent = "Reconstruction…";
    const t0 = performance.now();
    this.surveillerCalcul();
    this.opEnCalcul = null;
    this.docEnCalcul = this.doc;
    try{
      const doc = this.doc;
      /* Un quart de la tolérance des fichiers ouverts : une pièce unique se regarde de près, pas un assemblage. */
      const res = await this.envoyer({ type:"construire", doc:this.docPourNoyau(), plat:!!this.plat, finesse:prefs.tolLineaire / 4 });
      /* Changé de pièce (ou annulé) pendant le calcul : ce résultat ne vaut plus pour ce document. */
      this.surveillerTas(res.tas);
      if(doc === this.doc) this.afficher(res, performance.now() - t0);
      else this.relancer = true;
      this.pannes = 0;
    }catch(e){
      /* L'identifiant d'une opération ne vaut que pour sa pièce : on a pu changer d'onglet pendant le calcul. */
      if(e.fatale){ this.enCours = false; this.relancerNoyau("Le noyau a manqué de mémoire ou s'est planté : il a été relancé.", this.docEnCalcul === this.doc ? e.opId ?? this.opEnCalcul : null); }
      else if(!e.abandon) this.echecConstruction(e.message);
    }finally{
      clearTimeout(this._tSurveille);
      $("bArreterCalcul").hidden = true;
      this.ui.attendre(false);
      this.enCours = false;
      if(this.relancer){ this.relancer = false; this.reconstruire(); }
    }
  }

  /** La pièce n'a pas pu être construite : on ne laisse pas celle d'avant à l'écran comme si de rien n'était. */
  echecConstruction(message){
    if(this.docAffiche !== this.doc) this.afficher({ maillages:[], etats:{}, erreursParametres:{} }, 0);
    this.statutErreur(message);
    const b = $("vueErreur");
    b.textContent = `⚠ La pièce n'a pas pu être construite : ${message}`;
    b.hidden = false;
  }

  afficher(res, duree){
    const { vue, arbre, ui } = this;
    this.resultat = res;
    this.docAffiche = this.doc;
    $("vueErreur").hidden = true;
    /* Une esquisse posée sur une face : le noyau dit où la face est partie. */
    for(const [id, n] of Object.entries(res.etats)){
      const op = (n.plan || n.corpsNom || n.refs) && this.doc.operations.find(o => o.id === id);
      if(op && n.refs) op.refs = n.refs;      // leurs descriptions à jour : c'est ainsi qu'arêtes et faces suivent la pièce
      if(op && n.plan) op.plan = n.plan;
      if(op && n.corpsNom) op.corpsNom = n.corpsNom;
    }
    const selNom = arbre.selection?.name, discret = !!this.faceChoisie;
    arbre.selectionner(null);
    this.montrerFace(null);           // ses triangles partent avec la pièce d'avant
    ui.mesure.annuler();
    if(this.analyse) appliquerAnalyse(vue, null);     // rend aux corps leur matériau, que liberer() va jeter
    for(const g of [...vue.modele.children]){ liberer(g); vue.modele.remove(g); }

    const valides = res.maillages.filter(m => !m.erreur);
    this.nomsCorps = res.maillages.filter(m => !m.reference).map(m => m.nom);
    if(valides.length){
      const materiau = fabriqueMateriaux();
      const groupe = construireNoeud({ name:this.doc.nom, meshes:valides.map((_, i) => i), children:[] }, valides, materiau);
      recenser(groupe, { compteur:0, triangles:0, pieces:0 });
      groupe.children.forEach((m, i) => {
        const src = valides[i];
        CORPS.set(m, src);
        m.geometry.userData.surfaces = src.surfaces;
        if(src.reference){
          m.material = m.material.clone();
          Object.assign(m.material, { transparent:true, opacity:0.35, depthWrite:false });
          Object.assign(m.material.userData, { opaciteDorigine:0.35, transparentDorigine:true });
        }
        /* Les arêtes exactes du B-Rep, à la place de celles devinées sur les triangles. */
        const geo = new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(src.aretes.position, 3));
        const ligne = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color:0x141a20, transparent:true, opacity:0.75, depthWrite:false }));
        Object.assign(ligne.userData, { estArete:true, areteIndex:src.aretes.arete });
        ligne.name = "arêtes";
        m.add(ligne);
        m.userData.arete = ligne;
      });
      /* Les corps directement dans la scène : le dossier « Corps » du navigateur les liste sans niveau de plus. */
      for(const m of [...groupe.children]) vue.modele.add(m);
    }
    if(this.analyse) appliquerAnalyse(vue, this.analyse);
    vue.recenserMateriaux();
    if(vue.modele.children.length){
      vue.adapterAuModele();
      if(this.premiereVue){ this.nav.allerVersVue("iso", false); vue.ajusterVue(vue.modele); this.premiereVue = false; this.rayonCadre = vue.rayonModele; }
      /* La pièce a beaucoup grandi : elle sortirait du cadre. (Jamais pendant une esquisse : le plan reste où il est.) */
      else if(!this.editeur.ouvert && vue.rayonModele > 1.5 * (this.rayonCadre || 0)){ vue.ajusterVue(vue.modele); this.rayonCadre = vue.rayonModele; }
    }
    vue.definirAretes(prefs.aretes);
    if(vue.modeFilaire) vue.definirFilaire(true);
    if(vue.modeTransparent) vue.definirTransparence(true);
    ui.appliquerCoupe();
    if(ui.collisions) ui.effacerCollisions();
    arbre.reconstruire();
    $("cptPieces").textContent = `${this.nomsCorps.length} corps`;
    if(!vue.modele.children.length) $("arbre").innerHTML = '<p class="vide-p">Aucun corps.</p>';
    this.dessinerEsquisses();
    if(this.eclate) appliquerEclate(this);
    const retrouve = selNom && vue.modele.getObjectByName(selNom);
    if(retrouve?.userData.estPiece) arbre.selectionner(retrouve, { defiler:false, discret });
    else if(!this.editeur.ouvert) this.afficherProprietes(null);
    if(this.editeur.ouvert) this.editeur.remplirListe($("props"));     // l'arbre vient d'écrire sa fiche par-dessus

    const erreurs = Object.values(res.etats).filter(n => n.erreur).length + res.maillages.filter(m => m.erreur).length;
    let tri = 0;
    vue.modele.traverse(o => { if(o.userData.estPiece) tri += o.userData.triangles; });
    $("etatStats").textContent = `${this.nomsCorps.length} corps · ${new Intl.NumberFormat("fr-FR").format(tri)} triangles · ` +
      `${(duree / 1000).toFixed(1).replace(".", ",")} s` + (erreurs ? ` · ⚠ ${erreurs} erreur${erreurs > 1 ? "s" : ""}` : "");
    apresAffichage(this);
    ui.majEtatBoutons();
    this.majHistorique();
    this.majMessageOperation();
    this.majMarques();
    vue.invalider();
  }

  copierOps(){ return copierOperations(this); }

  /** Les matériaux connus de cette pièce : ceux de la page, puis les siens. */
  materiaux(){ return [...Object.keys(MATERIAUX), ...Object.keys(this.doc.materiauxPerso || {})]; }
  densite(nom){ return this.doc.materiauxPerso?.[nom] ?? MATERIAUX[nom] ?? 1; }
  estReference(objet){ return !!CORPS.get(objet)?.reference; }

  statutErreur(message){
    $("etatStats").textContent = "⚠ " + message;
    console.error(message);
  }

  /* ==========================================================================
     Historique
     ========================================================================== */
  /** L'historique se montre à deux endroits : la frise et le navigateur. */
  majHistorique(){
    if(this.doc.operations.length) $("accueil").hidden = true;
    this.frise.rendre();
    this.majNavigateur();
  }

  modifierDoc(f){
    if(this.edition || this.editeur.ouvert) return;      // l'édition en cours porte sur ce document
    this.memoriser();
    f();
    this.marquerModifie();
    this.majHistorique();
    this.reconstruire();
  }

  async supprimerOperation(op){
    if(this.edition || this.editeur.ouvert) return;
    if(!this.doc.operations.includes(op)) return;       // menu resté ouvert sur une opération annulée depuis
    const dependants = this.doc.operations.filter(o => o !== op && dependances(o, this.doc.operations).includes(op.id));
    if(dependants.length && !await confirmer(`« ${op.nom} » sert à : ${dependants.map(o => o.nom).join(", ")}. Supprimer quand même ? (Ces opérations seront en erreur.)`, "Supprimer")) return;
    this.modifierDoc(() => {
      const i = this.doc.operations.indexOf(op);
      this.doc.operations.splice(i, 1);
      if(this.doc.curseur !== undefined && this.doc.curseur > i) this.doc.curseur--;
      normaliserDossiers(this.doc);
    });
  }

  /* ==========================================================================
     Disposition solidcraft : menus, recherche de commandes, navigateur, origine
     ========================================================================== */
  brancherDisposition(){
    /* Menu Fichier */
    $("bMenuFichier").onclick = (e) => { e.stopPropagation(); const m = $("menuFichier"); const ouvrir = m.hidden; this.fermerMenus(); m.hidden = !ouvrir; };
    $("menuFichier").addEventListener("click", () => { $("menuFichier").hidden = true; });
    /* Le titre d'un groupe du ruban ouvre la liste de ses commandes, comme « Create ▾ » */
    for(const h of document.querySelectorAll("#ruban .groupes h5")){
      h.onclick = (e) => {
        const r = h.getBoundingClientRect();
        this.menu([...h.parentElement.querySelectorAll(".btns button")].map(b => ({
          texte:nomBouton(b), titre:b.title,
          action:() => b.click(), desactive:b.disabled })), r.left, r.bottom + 2);
        e.stopPropagation();
      };
    }
    /* Recherche de commandes : tous les boutons du ruban et du menu Fichier */
    const champ = $("rechCommande"), liste = $("menuRecherche");
    const sansAccent = (t) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const commandes = () => {
      const r = [];
      for(const b of document.querySelectorAll("#ruban .groupes button, #menuFichier button")){
        const volet = b.closest("[data-volet]")?.dataset.volet;
        if(volet === "esquisse" && !this.editeur.ouvert) continue;      // outils d'esquisse : seulement en esquisse
        if(b.disabled || b.closest(".a-venir") || b.hidden || b.closest("[hidden]:not([data-volet]):not(#menuFichier)")) continue;
        const nom = nomBouton(b);
        const onglet = volet ? document.querySelector(`.ong-ruban[data-onglet="${volet}"]`)?.textContent : "Fichier";
        r.push({ nom, onglet, titre:b.title, b });
      }
      return r;
    };
    const montrer = () => {
      const q = sansAccent(champ.value.trim());
      const trouves = commandes().filter(c => !q || sansAccent(c.nom + " " + c.titre).includes(q)).slice(0, 14);
      liste.replaceChildren();
      trouves.forEach((c, i) => {
        const b = document.createElement("button");
        b.className = i === 0 ? "actif" : "";
        b.title = c.titre;
        b.append(document.createTextNode(c.nom), Object.assign(document.createElement("span"), { className:"groupe", textContent:c.onglet }));
        b.onmousedown = (e) => { e.preventDefault(); lancer(c); };
        liste.appendChild(b);
      });
      liste.hidden = !trouves.length;
      liste.trouves = trouves;
    };
    const lancer = (c) => { champ.value = ""; liste.hidden = true; champ.blur(); c.b.click(); };
    champ.oninput = champ.onfocus = montrer;
    champ.onblur = () => setTimeout(() => { liste.hidden = true; }, 120);
    champ.onkeydown = (e) => {
      if(e.key === "Escape"){ champ.value = ""; champ.blur(); }
      if(e.key === "Enter" && liste.trouves?.length) lancer(liste.trouves[0]);
    };
    /* Panneaux flottants repliables */
    for(const b of document.querySelectorAll(".flottant .plier")){
      b.onclick = () => { const f = b.closest(".flottant"); f.classList.toggle("replie"); b.textContent = f.classList.contains("replie") ? "▸" : "▾"; };
    }
    /* Navigateur : dossiers, origine, plans */
    for(const d of document.querySelectorAll("#navigateur .dossier")){
      const tete = d.querySelector(":scope > .nv"), enfants = d.querySelector(":scope > .enfants");
      tete.onclick = (e) => {
        if(e.target.classList.contains("oeil")) return;
        enfants.hidden = !enfants.hidden;
        tete.querySelector(".fl").textContent = enfants.hidden ? "▸" : "▾";
      };
    }
    $("navOeilOrigine").onclick = $("bOrigine").onclick = () => this.basculerOrigine();
    for(const p of document.querySelectorAll("#navigateur .nv.plan")) p.onclick = () => this.creerEsquisseSur(p.dataset.plan);
    /* Barre de navigation */
    $("bAjusterNav").onclick = () => $("bAjuster").click();
    $("bProjectionNav").onclick = () => this.ui.basculerProjection();
    $("bVues").onclick = (e) => { e.stopPropagation(); const m = $("vuesRapides"); const ouvrir = m.hidden; this.fermerMenus(); m.hidden = !ouvrir; };
    $("vuesRapides").addEventListener("click", () => { $("vuesRapides").hidden = true; });
    $("bAffichageNav").onclick = (e) => {
      e.stopPropagation();
      const r = e.currentTarget.getBoundingClientRect();
      this.menu([
        { texte:`${prefs.aretes ? "✓ " : ""}Arêtes`, action:() => $("bAretes").click() },
        { texte:`${this.vue.modeFilaire ? "✓ " : ""}Filaire`, action:() => $("bFilaire").click() },
        { texte:`${this.vue.modeTransparent ? "✓ " : ""}Rayons X`, action:() => $("bTransparence").click() },
        { texte:`${prefs.grille ? "✓ " : ""}Grille`, action:() => $("bGrille").click() },
        { texte:`${this.origine.visible ? "✓ " : ""}Origine`, action:() => this.basculerOrigine() },
      ], r.left, r.top - 170);
    };
    /* Inspecter / Gérer */
    $("bControleRegles").onclick = () => { this.montrerControle(); $("dlgControle").showModal(); };
    $("selProcede").onchange = () => this.montrerControle();
    $("bProprietes").onclick = () => { $("panneauProps").classList.remove("replie"); this.afficherProprietes(this.arbre.selection); };
    $("bMateriau").onclick = () => { $("panneauProps").classList.remove("replie"); this.afficherProprietes(this.arbre.selection); $("selMateriau")?.focus(); };
    $("bAccueil").onclick = () => this.montrerAccueil();
    $("bArreterCalcul").onclick = () => this.relancerNoyau("Calcul arrêté à votre demande.", this.docEnCalcul === this.doc ? this.opEnCalcul : null);
    /* Analyses de surface */
    for(const b of document.querySelectorAll("[data-analyse]")) b.onclick = () => this.basculerAnalyse(b.dataset.analyse);
    /* Paramètres en CSV, configurations, unités */
    $("bParamExporter").onclick = () => telechargerFichier(["nom;expression", ...this.doc.parametres.map(p => `${p.nom};${p.expr}`)].join("\n"),
      nomProjet(this.doc.nom) + "-parametres.csv", "text/csv");
    $("bParamImporter").onclick = () => this.choisirFichier(".csv");
    $("bConfigurations").onclick = () => this.ouvrirConfigurations();
    $("bAjouterConfiguration").onclick = () => this.ajouterConfiguration();
    $("bUnites").onclick = (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      this.menu(Object.keys(UNITES).map(u => ({ texte:`${this.doc.unite === u ? "✓ " : ""}${u === "in" ? "pouce (in)" : u}`, action:() => {
        this.memoriser();
        this.doc.unite = u;
        this.marquerModifie();
        this.afficherProprietes(this.arbre.selection);
      } })), r.left, r.bottom + 2);
    };
    /* Vues nommées, filtre de sélection */
    $("bVueEnregistrer").onclick = () => this.enregistrerVue();
    $("bVuesNommees").onclick = (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      const vues = this.doc.vues || [];
      this.menu(vues.length ? vues.map(v => ({ texte:v.nom, action:() => this.allerVue(v) })) : [{ texte:"Aucune vue enregistrée", desactive:true, action(){} }], r.left, r.bottom + 2);
    };
    const filtre = (id, cle) => { $(id).onclick = () => { this.filtre[cle] = !this.filtre[cle]; $(id).classList.toggle("on", this.filtre[cle]); }; };
    filtre("bFiltreCorps", "corps");
    filtre("bFiltreFace", "faces");
    filtre("bFiltreRef", "references");
    /* Les panneaux se déplacent par leur titre ; leur place est gardée dans ce navigateur */
    deplacable(document.querySelector("#navigateur > h3"), $("navigateur"), "navigateur");
    deplacable(document.querySelector("#panneauProps > h3"), document.querySelector(".colonne-droite"), "droite");
    deplacable(document.querySelector("#fenetreOperation .fm-tete"), document.querySelector(".colonne-droite"), "droite");
    /* La frise : rejouer pas à pas */
    const n = () => this.doc.operations.length, c = () => Math.min(this.doc.curseur ?? n(), n());
    $("bFriseDebut").onclick = () => this.placerCurseur(0);
    $("bFriseRecul").onclick = () => this.placerCurseur(c() - 1);
    $("bFriseAvance").onclick = () => this.placerCurseur(c() + 1);
    $("bFriseFin").onclick = () => this.placerCurseur(n());
    /* Un clic ailleurs ferme les menus */
    addEventListener("pointerdown", (e) => { if(!e.target.closest(".menu-flottant, #bMenuFichier, #bVues")) this.fermerMenus(); });
  }

  basculerAnalyse(nom){
    this.arbre.selectionner(null);
    this.analyse = this.analyse === nom ? null : nom;
    appliquerAnalyse(this.vue, this.analyse);
    /* Les matériaux ont changé : filaire, rayons X et coupe se réappliquent, comme à la reconstruction. */
    if(this.vue.modeFilaire) this.vue.definirFilaire(true);
    if(this.vue.modeTransparent) this.vue.definirTransparence(true);
    this.ui.appliquerCoupe();
    for(const b of document.querySelectorAll("[data-analyse]")) b.classList.toggle("on", b.dataset.analyse === this.analyse);
    $("etatSel").textContent = this.analyse ? ANALYSES[this.analyse].aide : "";
  }

  async enregistrerVue(){
    const nom = await demanderTexte("Enregistrer la vue", "Nom", `Vue ${(this.doc.vues || []).length + 1}`);
    if(!nom?.trim()) return;
    const c = this.vue.camera();
    this.memoriser();
    (this.doc.vues ||= []).push({ nom:nom.trim(), position:c.position.toArray(), cible:this.vue.cible.toArray(), haut:c.up.toArray() });
    this.marquerModifie();
    this.majNavigateur();
  }

  allerVue(v){
    const c = this.vue.camera();
    this.nav.animation = { t:0, duree:0.42, posDepart:c.position.clone(), posArrivee:new THREE.Vector3(...v.position),
      hautDepart:c.up.clone(), hautArrivee:new THREE.Vector3(...v.haut),
      cibleDepart:this.vue.cible.clone(), cibleArrivee:new THREE.Vector3(...v.cible) };
    this.vue.invalider();
  }

  /** Les corps que le filtre de sélection laisse réagir aux clics. */
  selectionnables(){
    return this.vue.modele.children.filter(o => {
      const c = CORPS.get(o);
      return !c || (c.reference ? this.filtre.references : this.filtre.corps);
    });
  }

  ouvrirConfigurations(){
    const avant = JSON.stringify(this.doc);
    this.remplirConfigurations();
    const dlg = $("dlgConfigurations");
    dlg.onclose = () => {
      if(this.doc.configActive) appliquerConfiguration(this.doc, this.doc.configActive);
      if(JSON.stringify(this.doc) === avant) return;
      this.memoriser(avant);
      this.marquerModifie();
      this.reconstruire();
    };
    dlg.showModal();
  }

  ajouterConfiguration(){
    const cfgs = (this.doc.configurations ||= []);
    let n = cfgs.length + 1;
    while(cfgs.some(c => c.nom === `Configuration ${n}`)) n++;
    cfgs.push({ nom:`Configuration ${n}`, valeurs:Object.fromEntries(this.doc.parametres.map(p => [p.nom, p.expr])) });
    this.remplirConfigurations();
  }

  remplirConfigurations(){
    const t = $("tabConfigurations"), cfgs = this.doc.configurations || [];
    t.replaceChildren();
    if(!this.doc.parametres.length){ t.innerHTML = '<tr><td>Ajoutez d\'abord des paramètres (ƒx).</td></tr>'; return; }
    const tete = t.insertRow();
    tete.insertCell().textContent = "Paramètre";
    cfgs.forEach((c, i) => {
      const td = tete.insertCell();
      const nom = document.createElement("input"); nom.value = c.nom;
      nom.onchange = () => {
        const v = nom.value.trim();
        if(!v || cfgs.some(x => x !== c && x.nom === v)){ nom.value = c.nom; return; }
        if(this.doc.configActive === c.nom) this.doc.configActive = v;
        c.nom = v;
      };
      const act = document.createElement("button"); act.type = "button"; act.className = "tb mini" + (this.doc.configActive === c.nom ? " on" : "");
      act.textContent = "Activer";
      act.onclick = () => { appliquerConfiguration(this.doc, c.nom); this.remplirConfigurations(); };
      const sup = document.createElement("button"); sup.type = "button"; sup.className = "tb mini"; sup.textContent = "✕";
      sup.onclick = () => { cfgs.splice(i, 1); if(this.doc.configActive === c.nom) delete this.doc.configActive; this.remplirConfigurations(); };
      td.append(nom, act, sup);
    });
    for(const p of this.doc.parametres){
      const tr = t.insertRow();
      tr.insertCell().textContent = p.nom;
      for(const c of cfgs){
        const champ = document.createElement("input");
        champ.value = c.valeurs[p.nom] ?? p.expr;
        champ.onchange = () => { c.valeurs[p.nom] = champ.value.trim(); };
        tr.insertCell().appendChild(champ);
      }
    }
    /* Une dernière ligne : les opérations suspendues par chaque configuration. */
    const noms = this.doc.operations.filter(o => o.type !== "esquisse");
    if(noms.length){
      const tr = t.insertRow();
      tr.insertCell().textContent = "Opérations suspendues";
      for(const c of cfgs){
        const boite = document.createElement("div"); boite.className = "liste-choix";
        for(const o of noms){
          const l = document.createElement("label"), x = document.createElement("input");
          x.type = "checkbox"; x.checked = (c.suspendues || []).includes(o.id);
          x.onchange = () => { const a = (c.suspendues || []).filter(i => i !== o.id); c.suspendues = x.checked ? [...a, o.id] : a; };
          l.append(x, document.createTextNode(o.nom));
          boite.appendChild(l);
        }
        tr.insertCell().appendChild(boite);
      }
    }
  }

  fermerMenus(){
    for(const m of document.querySelectorAll(".menu-flottant:not(#menuRecherche)")) m.hidden = true;
  }

  /** Un menu au point (x, y) de l'écran : [{ texte, action, desactive, titre } | "-"]. */
  menu(entrees, x, y){
    this.fermerMenus();
    const m = $("menuContexte");
    m.replaceChildren();
    for(const e of entrees){
      if(e === "-"){ m.appendChild(document.createElement("hr")); continue; }
      const b = document.createElement("button");
      b.textContent = e.texte; b.disabled = !!e.desactive; if(e.titre) b.title = e.titre;
      b.onclick = () => { m.hidden = true; e.action(); };
      m.appendChild(b);
    }
    m.hidden = false;
    m.style.position = "fixed";
    m.style.left = Math.min(x, innerWidth - m.offsetWidth - 8) + "px";
    m.style.top = Math.max(8, Math.min(y, innerHeight - m.offsetHeight - 8)) + "px";
  }

  /** Clic sur une opération (frise ou navigateur) ; `ajouter` : Maj / Ctrl pour en choisir plusieurs. */
  choisirOperation(id, ajouter){
    if(ajouter){ if(this.selOps.has(id)) this.selOps.delete(id); else this.selOps.add(id); }
    else this.selOps = new Set([id]);
    this.selOp = id;
    this.majHistorique();
  }

  reordonner(de, vers){
    const refus = deplacementRefuse(this.doc.operations, de, vers);
    if(refus){ $("etatSel").textContent = "⚠ " + refus; return; }
    this.modifierDoc(() => deplacer(this.doc, de, vers));
  }

  /** Le marqueur de la frise : on ne construit que les `n` premières opérations. */
  placerCurseur(n){
    if(this.edition || this.editeur.ouvert) return;
    const total = this.doc.operations.length;
    n = Math.max(0, Math.min(n, total));
    const nouveau = n >= total ? undefined : n;
    if(nouveau === this.doc.curseur) return;
    this.doc.curseur = nouveau;        // déplacer le marqueur n'est pas une étape d'annulation, comme dans Fusion
    this.marquerModifie();
    this.majHistorique();
    this.reconstruire();
  }

  async nouveauDossier(ids){
    const nom = await demanderTexte("Nouveau dossier", "Nom", `Dossier ${(this.doc.dossiers || []).length + 1}`);
    if(!nom?.trim()) return;
    let refus = null;
    this.modifierDoc(() => { refus = creerDossier(this.doc, ids, nom.trim()); });
    if(refus){ this.annuler(); this.pileRefaire.pop(); this.majRuban(); $("etatSel").textContent = "⚠ " + refus; }
  }

  /** Modifie un dossier ; `memoriser` faux pour un simple repli (pas d'étape d'annulation). */
  changerDossier(id, f, memoriser = true){
    const d = (this.doc.dossiers || []).find(x => x.id === id);
    if(!d) return;
    if(memoriser) this.modifierDoc(() => { f(d); normaliserDossiers(this.doc); });
    else { f(d); this.marquerModifie(); this.majHistorique(); }
  }

  supprimerDossier(id){
    this.modifierDoc(() => { this.doc.dossiers = this.doc.dossiers.filter(d => d.id !== id); });
  }

  majNavigateur(){
    $("navNomPiece").textContent = this.doc.nom;
    $("navNbParametres").textContent = this.doc.parametres.length || "";
    const etats = this.resultat?.etats || {};
    const ligne = (op, oeil) => {
      const d = document.createElement("div");
      d.className = "nv";
      d.classList.toggle("sel", this.selOps.has(op.id));
      d.classList.toggle("erreur", !!etats[op.id]?.erreur);
      d.classList.toggle("suspendue", !!op.suspendue);
      d.title = etats[op.id]?.erreur ? `⚠ ${etats[op.id].erreur}` : `${nomHistorique(op)} — double-clic pour modifier`;
      d.innerHTML = '<span class="fl"></span>';
      if(oeil){
        const o = document.createElement("span");
        o.className = "oeil"; o.textContent = op.visible ? "◉" : "◌";
        o.title = op.visible ? "Masquer l'esquisse" : "Afficher l'esquisse dans la vue";
        o.onclick = (e) => { e.stopPropagation(); op.visible = !op.visible; this.marquerModifie(); this.majNavigateur(); this.dessinerEsquisses(); };
        d.appendChild(o);
      }
      d.append(Object.assign(document.createElement("span"), { className:"ic", textContent:TYPES[op.type]?.icone || "?" }),
               Object.assign(document.createElement("span"), { className:"lbl", textContent:oeil ? op.nom : nomHistorique(op) }));   // le dossier « Esquisses » dit déjà la fonction
      d.onclick = (e) => this.choisirOperation(op.id, e.shiftKey || e.ctrlKey || e.metaKey);
      d.ondblclick = () => this.editer(op);
      d.oncontextmenu = (e) => {
        e.preventDefault();
        const i = this.doc.operations.indexOf(op);
        this.choisirOperation(op.id, false);
        this.frise.menuOperation(op, i, e);
      };
      return d;
    };
    $("navVues").replaceChildren(...(this.doc.vues || []).map(v => {
      const d = document.createElement("div");
      d.className = "nv"; d.title = "Revenir à cette vue — clic droit : renommer, supprimer";
      d.innerHTML = '<span class="fl"></span><span class="ic">⌖</span>';
      d.appendChild(Object.assign(document.createElement("span"), { className:"lbl", textContent:v.nom }));
      d.onclick = () => this.allerVue(v);
      d.oncontextmenu = (e) => {
        e.preventDefault();
        const changer = (f) => { this.memoriser(); f(); this.marquerModifie(); this.majNavigateur(); };
        this.menu([
          { texte:"Renommer…", action:async () => { const n = await demanderTexte("Renommer la vue", "Nom", v.nom); if(n?.trim()) changer(() => { v.nom = n.trim(); }); } },
          { texte:"Remplacer par la vue courante", action:() => changer(() => {
            const c = this.vue.camera();
            Object.assign(v, { position:c.position.toArray(), cible:this.vue.cible.toArray(), haut:c.up.toArray() });
          }) },
          { texte:"Supprimer", action:() => changer(() => { this.doc.vues = this.doc.vues.filter(x => x !== v); }) },
        ], e.clientX, e.clientY);
      };
      return d;
    }));
    const esq = this.doc.operations.filter(o => o.type === "esquisse");
    const ops = this.doc.operations.filter(o => o.type !== "esquisse");
    $("navEsquisses").replaceChildren(...esq.map(o => ligne(o, true)));
    $("navOperations").replaceChildren(...ops.map(o => ligne(o, false)));
    if(!esq.length) $("navEsquisses").innerHTML = '<p class="vide-p">Aucune esquisse.</p>';
    if(!ops.length) $("navOperations").innerHTML = '<p class="vide-p">Aucune opération.</p>';
  }

  /** Le contour survolé dans le panneau, en jaune dans la vue. */
  surlignerContour(esq, poly){
    this.majMarques();
    const r = repere(esq.plan, this.v());
    const pts = [...poly, poly[0]].map(([x, y]) => new THREE.Vector3(...r.o)
      .addScaledVector(new THREE.Vector3(...r.x), x).addScaledVector(new THREE.Vector3(...r.y), y));
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color:0xf2c744, depthTest:false }));
    l.renderOrder = 12;
    this.marques.add(l);
    this.vue.invalider();
  }

  /** Les trois plans de l'origine, translucides, et les axes : cachés par défaut, comme dans solidcraft. */
  construireOrigine(){
    const g = new THREE.Group();
    g.name = "origine";
    g.visible = false;
    /* Chaque carré couvre [0, 1]² de son plan : XY à plat, XZ debout face à −Y, YZ debout face à +X. */
    const plan = (couleur, rot, pos) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
        color:couleur, transparent:true, opacity:0.12, side:THREE.DoubleSide, depthWrite:false }));
      m.rotation.set(...rot);
      m.position.set(...pos);
      m.raycast = () => {};
      return m;
    };
    g.add(plan(0x3fa0ea, [0, 0, 0], [0.5, 0.5, 0]),
          plan(0x4cc38a, [Math.PI / 2, 0, 0], [0.5, 0, 0.5]),
          plan(0xe8443a, [0, Math.PI / 2, 0], [0, 0.5, 0.5]));
    const axes = new THREE.AxesHelper(1.3);
    axes.raycast = () => {};
    g.add(axes);
    return g;
  }

  basculerOrigine(){
    const o = this.origine;
    o.visible = !o.visible;
    o.scale.setScalar(Math.max(10, (this.vue.rayonModele || 50) * 0.6));
    $("navOeilOrigine").textContent = o.visible ? "◉" : "◌";
    $("bOrigine").classList.toggle("on", o.visible);
    this.vue.invalider();
  }

  /** Les esquisses dont l'œil est ouvert, dessinées dans la vue (sauf celle qu'on édite). */
  dessinerEsquisses(){
    const g = this.esquissesVues;
    for(const o of [...g.children]){ o.geometry.dispose(); o.material.dispose(); g.remove(o); }
    const v = this.v();
    for(const op of this.doc.operations){
      if(op.type !== "esquisse" || !op.visible || op === this.editeur.esq) continue;
      let r;
      try{ r = repere(op.plan, v); }catch(_){ continue; }
      const M = new THREE.Matrix4().makeBasis(new THREE.Vector3(...r.x), new THREE.Vector3(...r.y), new THREE.Vector3(...r.n)).setPosition(...r.o);
      const idx = indexer(op);
      for(const e of op.elements){
        if(e.type === "point") continue;
        const pts = this.editeur.trace(idx, e).map(p => new THREE.Vector3(p.x, p.y, 0).applyMatrix4(M));
        const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
          new THREE.LineBasicMaterial({ color:e.constr ? 0x8b919c : 0x3fa0ea, transparent:true, opacity:e.constr ? 0.5 : 0.9 }));
        l.raycast = () => {};
        g.add(l);
      }
    }
    dessinerAides(this, g);
    /* Plans de construction : un carré translucide, à l'échelle de la pièce. */
    for(const op of this.doc.operations){
      if(op.type !== "plan" || op.suspendue || this.doc.operations.indexOf(op) >= (this.doc.curseur ?? Infinity)) continue;
      let p;
      try{ p = planConstruction(op, v, this.doc); }catch(_){ continue; }
      const n = new THREE.Vector3(...p.normale), x = new THREE.Vector3(...p.xdir);
      const M = new THREE.Matrix4().makeBasis(x, n.clone().cross(x), n).setPosition(...p.origine);
      const t = Math.max(10, (this.vue.rayonModele || 50) * 0.9);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(t, t), new THREE.MeshBasicMaterial({ color:0xf2c744, transparent:true, opacity:0.1, side:THREE.DoubleSide, depthWrite:false }));
      m.applyMatrix4(M);
      m.raycast = () => {};
      g.add(m);
    }
    /* Filetages cosmétiques : le cercle du diamètre nominal, à l'entrée et au fond du trou. Rien
       dans le volume ni dans le STEP, comme sur un plan. */
    const fin = this.doc.curseur ?? this.doc.operations.length;
    this.doc.operations.forEach((op, i) => {
      if(op.type !== "percage" || !op.filetage || op.suspendue || i >= fin) return;
      const esq = this.doc.operations.find(o => o.id === op.esquisse);
      if(!esq) return;
      let r;
      try{ r = repere(esq.plan, v); }catch(_){ return; }      // plan illisible : l'erreur est signalée par le noyau
      const R = parseFloat(op.filetage.slice(1)) / 2;
      let prof = 0;
      try{ prof = op.traversant ? 0 : v(op.profondeur); }catch(_){ /* cote illisible : signalée par le noyau */ }
      const P = (x, y, z) => new THREE.Vector3(...r.o).addScaledVector(new THREE.Vector3(...r.x), x)
        .addScaledVector(new THREE.Vector3(...r.y), y).addScaledVector(new THREE.Vector3(...r.n), z);
      for(const [x, y] of profils(esq).points){
        for(const z of prof ? [0, -prof] : [0]){
          const pts = Array.from({ length:49 }, (_, k) => P(x + R * Math.cos(k / 48 * Math.PI * 2), y + R * Math.sin(k / 48 * Math.PI * 2), z));
          const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
            new THREE.LineDashedMaterial({ color:0x4cc38a, dashSize:R * 0.3, gapSize:R * 0.2, depthTest:false, transparent:true }));
          l.computeLineDistances();
          l.raycast = () => {};
          g.add(l);
        }
      }
    });
    this.vue.invalider();
  }

  /** Un plan de l'origine cliqué dans le navigateur : une esquisse dessus, ouverte aussitôt. */
  creerEsquisseSur(base){
    if(this.edition || this.editeur.ouvert) return;
    this.creer("esquisse");
    this.edition.op.plan = { base, decalage:"0" };
    this.validerOperation();
  }

  /* ==========================================================================
     Créer et modifier une opération : le panneau
     ========================================================================== */
  /** Une opération de plus, au marqueur. */
  inserer(op){
    const fin = this.doc.curseur ?? this.doc.operations.length;
    this.doc.operations.splice(fin, 0, op);
    if(this.doc.curseur !== undefined) this.doc.curseur++;
  }

  creer(type){
    if(this.edition || this.editeur.ouvert) return;
    this.derniereCommande = type;
    const op = nouvelleOperation(type, this);
    const avant = JSON.stringify(this.doc);
    this.inserer(op);
    const face = this.faceChoisie;
    this.ouvrirPanneau(op, avant, true);
    if(type === "esquisse" && face?.type === "plan") this.poserSurFace(op, face);
  }

  editer(op){
    if(this.edition || this.editeur.ouvert) return;
    if(op.type === "esquisse"){ this.ouvrirEsquisse(op, JSON.stringify(this.doc)); return; }
    this.ouvrirPanneau(op, JSON.stringify(this.doc), false);
  }

  editerPlan(){
    if(this.edition) return;
    if(this.editeur.outil) this.editeur.choisirOutil(this.editeur.outil);   // un clic doit désigner la face, pas tracer
    const op = this.editeur.esq;
    this.edition = { op, avant:JSON.stringify(this.doc), nouvelle:false, plan:true };
    this.construirePanneau();
  }

  ouvrirPanneau(op, avant, nouvelle){
    this.edition = { op, avant, nouvelle };
    this.selOp = op.id;
    this.construirePanneau();
    this.majHistorique();
    this.majRuban();
    if(op.type !== "esquisse") this.reconstruire();
  }

  construirePanneau(){
    const { op } = this.edition;
    $("titreOperation").textContent = `${TYPES[op.type].icone} ${nomHistorique(op)}`;
    const hote = $("champsOperation");
    hote.replaceChildren();
    for(const ch of CHAMPS[op.type] || []){
      if(ch.si && !ch.si(op)) continue;
      hote.appendChild(this.champ(ch, op));
    }
    $("fenetreOperation").hidden = false;
    this.majMessageOperation();
    this.majMarques();
  }

  /** Un champ du panneau ; tout changement refait l'aperçu (et le panneau, si des champs en dépendent). */
  champ(ch, op){
    const lire = () => ch.get ? ch.get(op) : op[ch.cle];
    const ecrire = (v) => { if(ch.set) ch.set(op, v); else op[ch.cle] = v; this.apercu(); };
    const ligne = document.createElement("label");
    ligne.className = "fm-ligne";
    const cle = document.createElement("span"); cle.className = "fm-cle"; cle.textContent = ch.nom;
    const val = document.createElement("span"); val.className = "fm-valeur";
    ligne.append(cle, val);
    const select = (options, valeur) => {
      const s = document.createElement("select");
      for(const [v, t] of options){ const o = document.createElement("option"); o.value = v; o.textContent = t; s.appendChild(o); }
      s.value = valeur ?? "";
      return s;
    };
    const esquissesAvant = () => {
      const i = this.doc.operations.indexOf(op);
      return this.doc.operations.slice(0, i < 0 ? undefined : i).filter(o => o.type === "esquisse");
    };
    switch(ch.type){
      case "texte": {
        const t = document.createElement("input"); t.type = "text"; t.value = lire() || "";
        t.onchange = () => { ecrire(t.value.trim() || op.nom); $("titreOperation").textContent = `${TYPES[op.type].icone} ${nomHistorique(op)}`; this.majHistorique(); };
        val.appendChild(t);
        break;
      }
      case "expr": {
        const t = document.createElement("input"); t.type = "text"; t.value = lire() ?? "";
        const sortie = document.createElement("span"); sortie.className = "val";
        const verifier = () => {
          if(ch.vide && !t.value.trim()){ t.classList.remove("faux"); t.title = ""; sortie.textContent = ""; return true; }
          try{ const x = evaluer(t.value, (n) => { const v = this.valeurs(); if(!v.has(n)) throw new Error(`paramètre inconnu « ${n} »`); return v.get(n); });
               t.classList.remove("faux"); t.title = ""; sortie.textContent = estNombre(t.value) ? "" : "= " + +x.toFixed(4); return true; }
          catch(e){ t.classList.add("faux"); t.title = e.message; sortie.textContent = ""; return false; }
        };
        verifier();
        t.oninput = t.onchange = () => { if(verifier()) ecrire(t.value.trim()); };
        val.append(t, sortie);
        break;
      }
      case "choix": {
        const s = select(Object.entries(typeof ch.options === "function" ? ch.options(this, op) : ch.options), lire());
        s.onchange = () => {
          ecrire(s.value);
          this.construirePanneau();
          if(ch.cle === "plan"){ this.montrerFace(null); if(s.value === "face") this.designer("facePlan"); }
        };
        val.appendChild(s);
        break;
      }
      case "case": {
        const c = document.createElement("input"); c.type = "checkbox"; c.checked = !!lire();
        c.onchange = () => { ecrire(c.checked); this.construirePanneau(); };
        val.style.textAlign = "right";
        val.appendChild(c);
        break;
      }
      case "esquisse": {
        const s = select([["", "— choisir —"], ...esquissesAvant().map(e => [e.id, e.nom])], lire());
        s.onchange = () => { if(ch.cle === "esquisse") delete op.contours; ecrire(s.value); this.construirePanneau(); };
        val.appendChild(s);
        break;
      }
      case "axe": {
        const esq = this.doc.operations.find(o => o.id === op.esquisse);
        const lignes = esq ? esq.elements.filter(e => e.type === "ligne") : [];
        const s = select([["x", "Axe X de l'esquisse"], ["y", "Axe Y de l'esquisse"],
          ...lignes.map(l => [l.id, `Ligne ${l.id.slice(1)}${l.constr ? " (construction)" : ""}`]), ...Object.entries(axesConstruits(this, op))], lire());
        s.onchange = () => ecrire(s.value);
        val.appendChild(s);
        break;
      }
      case "esquisses": case "corpsMulti": {
        const liste = ch.type === "esquisses" ? esquissesAvant().map(e => [e.id, e.nom])
          : this.nomsCorps.filter(n => n !== op.cible && n !== op.corps).map(n => [n, n]);
        const boite = document.createElement("div"); boite.className = "liste-choix";
        const choisis = lire() || [];
        for(const [v, t] of liste){
          const l = document.createElement("label");
          const c = document.createElement("input"); c.type = "checkbox"; c.checked = choisis.includes(v);
          c.onchange = () => {
            const actuels = (lire() || []).filter(x => x !== v);
            ecrire(c.checked ? [...actuels, v] : actuels);
            this.construirePanneau();
          };
          const rang = choisis.indexOf(v);
          l.append(c, document.createTextNode(`${t}${rang >= 0 && ch.type === "esquisses" ? `  (${rang + 1})` : ""}`));
          boite.appendChild(l);
        }
        if(!liste.length) boite.textContent = ch.type === "esquisses" ? "Aucune esquisse avant cette opération." : "Aucun autre corps.";
        ligne.classList.add("fm-note");
        val.appendChild(boite);
        break;
      }
      case "contours": {
        const esq = this.doc.operations.find(o => o.id === op.esquisse);
        const faces = esq ? profils(esq).faces : [];
        const boite = document.createElement("div"); boite.className = "liste-choix";
        const choisis = lire() || [];
        faces.forEach((f, i) => {
          const l = document.createElement("label");
          const c = document.createElement("input"); c.type = "checkbox"; c.checked = choisis.includes(f.cle);
          /* Seules les clés encore présentes : un contour disparu de l'esquisse ne reste pas coché en fantôme. */
          c.onchange = () => { const a = (lire() || []).filter(x => x !== f.cle && faces.some(g => g.cle === x)); ecrire(c.checked ? [...a, f.cle] : a); };
          l.append(c, document.createTextNode(`Contour ${i + 1} · ${Math.round(f.aire)} mm²${f.profondeur % 2 ? " (intérieur)" : ""}`));
          l.onmouseenter = () => this.surlignerContour(esq, f.poly);
          l.onmouseleave = () => this.majMarques();
          boite.appendChild(l);
        });
        if(faces.length){
          const cl = document.createElement("button"); cl.type = "button"; cl.className = "tb mini" + (this.designation === "contourClic" ? " on" : "");
          cl.textContent = this.designation === "contourClic" ? "Clic dans la vue… (Échap)" : "Cliquer dans la vue";
          cl.onclick = (e) => { e.preventDefault(); this.designer(this.designation === "contourClic" ? null : "contourClic"); };
          boite.appendChild(cl);
        }else boite.textContent = esq?.elements.some(e => e.type === "texte") ? "Le texte de l'esquisse sera utilisé." : "Aucun contour fermé dans cette esquisse.";
        ligne.classList.add("fm-note");
        val.appendChild(boite);
        break;
      }
      case "corps": {
        const noms = this.nomsCorps;
        const s = select([["", ch.cle === "cible" || ch.choisir ? "— choisir —" : "Dernier corps"], ...noms.map(n => [n, n])], lire());
        s.onchange = () => { ecrire(s.value); this.construirePanneau(); };
        val.appendChild(s);
        break;
      }
      case "designer": {
        const d = document.createElement("span"); d.className = "designer";
        const unique = ["facePlan", "faceLimite", "faceTiree", ...DESIGNATIONS_UNIQUES].includes(ch.quoi);
        const n = ch.quoi === "sommets" ? 0 : ch.quoi === "facePlan" ? (op.plan.origine ? 1 : 0) : unique ? (op[ch.cle] ? 1 : 0) : (op[ch.cle] || []).length;
        const b = document.createElement("button"); b.type = "button"; b.className = "tb mini" + (this.designation === ch.quoi ? " on" : "");
        b.textContent = this.designation === ch.quoi ? "Désignation… (Échap)" : "Désigner";
        b.title = ch.quoi === "aretes" ? "Cliquez les arêtes dans la vue (un second clic retire)" :
          ch.quoi === "faces" ? "Cliquez les faces à retirer dans la vue" : "Cliquez une face plane du modèle";
        b.onclick = (e) => { e.preventDefault(); this.designer(this.designation === ch.quoi ? null : ch.quoi); };
        const compte = document.createElement("span");
        compte.textContent = ch.quoi === "sommets" ? `${ch.nb} à cliquer` : ch.quoi === "arete" ? (n ? "arête choisie" : "aucune")
          : unique ? (n ? "face choisie" : "aucune") : `${n} désignée${n > 1 ? "s" : ""}`;
        d.append(b, compte);
        if(!unique && ch.quoi !== "sommets" && n){
          const raz = document.createElement("button"); raz.type = "button"; raz.className = "tb mini"; raz.textContent = "✕";
          raz.title = "Tout retirer";
          raz.onclick = (e) => { e.preventDefault(); op[ch.cle] = []; this.construirePanneau(); this.apercu(); };
          d.appendChild(raz);
        }
        ligne.classList.add("fm-note");
        val.appendChild(d);
        break;
      }
    }
    return ligne;
  }

  apercu(){
    this.majMarques();
    clearTimeout(this._tApercu);
    if(this.edition?.op.type === "esquisse") return;
    /* « Aperçu à jour » ne se dira qu'une fois la pièce reconstruite. */
    if(this.edition && !this.designation){ $("msgOperation").classList.add("ok"); $("msgOperation").textContent = "Aperçu en cours…"; }
    this._tApercu = setTimeout(() => this.reconstruire(), 250);
  }

  majMessageOperation(){
    const m = $("msgOperation");
    if(!this.edition){ m.textContent = ""; return; }
    /* On désigne sur la pièce d'avant l'opération : son dernier résultat ne vaut plus, elle sera recalculée à la fin. */
    if(this.designation){ m.classList.add("ok"); m.textContent = "Désignation en cours : cliquez dans la vue, Échap pour finir."; return; }
    const err = this.resultat?.etats?.[this.edition.op.id]?.erreur;
    const erreursP = Object.entries(this.resultat?.erreursParametres || {});
    m.classList.toggle("ok", !err && !erreursP.length);
    m.textContent = err ? "⚠ " + err : erreursP.length ? `⚠ paramètre ${erreursP[0][0]} : ${erreursP[0][1]}`
      : this.edition.op.type === "esquisse" ? "OK ouvre l'esquisse." : "Aperçu à jour.";
  }

  validerOperation(){
    if(!this.edition) return;
    const { op, avant, nouvelle, plan } = this.edition;
    this.resoudrePlans();
    if(op.type === "esquisse" && !op.plan.base && !op.plan.origine){
      $("msgOperation").classList.remove("ok");
      $("msgOperation").textContent = "⚠ Désignez la face plane, ou choisissez un plan XY, XZ ou YZ.";
      return;
    }
    this.designer(null);
    this.fermerPanneau();
    if(plan){                                   // plan de l'esquisse ouverte
      this.memoriser(avant);
      this.editeur.majRepere();
      this.editeur.redessiner();
      this.nav.allerVersDirection(new THREE.Vector3(...this.editeur.r.n));
      this.marquerModifie();
      return;
    }
    if(op.type === "esquisse" && nouvelle){ this.ouvrirEsquisse(op, avant, true); return; }
    this.memoriser(avant);
    this.marquerModifie();
    this.majHistorique();
    this.majRuban();
    this.reconstruire();
  }

  annulerOperation(){
    if(!this.edition) return;
    const { avant, plan } = this.edition;
    this.designer(null);
    this.fermerPanneau();
    if(plan){
      Object.assign(this.editeur.esq, JSON.parse(avant).operations.find(o => o.id === this.editeur.esq.id));
      this.editeur.majRepere(); this.editeur.redessiner();
      return;
    }
    this.doc = JSON.parse(avant);
    this.majHistorique();
    this.majRuban();
    this.reconstruire();
  }

  fermerPanneau(){
    this.edition = null;
    this.traits.clear();
    this.montrerFace(null);
    $("fenetreOperation").hidden = true;
    this.majMarques();
    this.majRuban();
  }

  /* ==========================================================================
     Désignation dans la vue : arêtes, faces, face plane d'une esquisse
     ========================================================================== */
  designer(quoi){
    /* En éclaté, faces et sommets seraient lus à une place décalée : on désigne sur la pièce assemblée. */
    if(quoi && this.eclate){
      this.eclate = 0;
      $("bEclate").classList.remove("on");
      appliquerEclate(this);
    }
    this.designation = quoi;
    this.rangSommet = 0;
    this.montrerSurvol(null);
    this.vue.canvas.classList.toggle("mesure", !!quoi);
    $("etatSel").textContent = quoi === "aretes" ? "Cliquez les arêtes (un second clic retire), Échap pour finir."
      : quoi === "faces" ? "Cliquez les faces à retirer, Échap pour finir."
      : quoi === "projeter" ? "Cliquez les arêtes du modèle à projeter dans l'esquisse, Échap pour finir."
      : AIDES_DESIGNATION[quoi] ? AIDES_DESIGNATION[quoi]
      : quoi === "facePlan" ? "Cliquez une face plane : l'esquisse s'y posera."
      : quoi ? "Cliquez une face plane du modèle." : "";
    if(this.edition){ this.construirePanneau(); this.apercu(); }  // la pièce montrée dépend de la désignation
  }

  /** Un clic pendant la désignation. Rend vrai s'il a été pris. */
  clicDesignation(ev){
    if(this.designation === "projeter"){ this.projeterArete(ev); return true; }
    if(clicAtelier(this, ev)){
      if(this.edition){ this.construirePanneau(); this.apercu(); }
      return true;
    }
    const op = this.edition?.op;
    /* Le panneau d'une esquisse ouvert : une face plane cliquée devient son plan, sans passer par la liste. */
    if(!this.designation && op?.type === "esquisse"){
      const touche = this.vue.lancerRayon(ev, this.selectionnables())[0];
      if(!touche) return false;
      const f = faceSous(this.vue, touche);
      if(f?.type === "plan") this.poserSurFace(op, f);
      else $("etatSel").textContent = "Cette face n'est pas plane : choisissez-en une autre.";
      return true;
    }
    if(!this.designation || !op) return false;
    if(this.designation === "aretes"){
      const t = this.toucherArete(ev), p = this.areteSous(ev);
      if(!p) return true;
      if("corps" in op && !op.corps) op.corps = t.objet.parent.name;       // la pièce a plusieurs corps : celui de l'arête cliquée
      const liste = op.aretes || (op.aretes = []);
      const i = liste.findIndex(q => Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) < 1e-3);
      if(i >= 0) liste.splice(i, 1); else{ liste.push(p); this.traits.set(String(p), this.traitDe(t)); }
    }else{
      const touche = this.vue.lancerRayon(ev, this.selectionnables())[0];
      if(!touche) return true;
      if(this.designation === "faces"){
        const pf = touche.point.toArray().map(c => +c.toFixed(5));
        (op.faces || (op.faces = [])).push(pf);
        this.traits.set(String(pf), this.traitFace(touche));
        if("corps" in op && !op.corps) op.corps = touche.object.name;
      }else{
        const f = faceSous(this.vue, touche);
        if(!f || f.type !== "plan"){ $("etatSel").textContent = "Cette face n'est pas plane : choisissez-en une autre."; return true; }
        const n = f.normale.toArray().map(c => +c.toFixed(6));
        if(this.designation === "facePlan"){
          this.designation = null;
          this.poserSurFace(op, f);
        }else{
          const pf = touche.point.toArray().map(c => +c.toFixed(5));
          op[this.designation === "faceLimite" ? "faceLimite" : "face"] = { point:pf, normale:n };
          this.traits.set(String(pf), this.traitFace(touche));
          if(this.designation === "faceTiree") op.corps = touche.object.name;   // sinon « dernier corps » viserait un autre corps
        }
        this.designer(null);
      }
    }
    this.construirePanneau();
    this.apercu();
    return true;
  }

  /** L'esquisse posée sur cette face plane, qui reste teintée tant que le panneau est ouvert. */
  poserSurFace(op, f){
    const n = f.normale.toArray().map(c => +c.toFixed(6));
    op.plan = { origine:f.centre.toArray().map(c => +c.toFixed(5)), normale:n, xdir:axePerpendiculaire(n), suivre:true };
    this.construirePanneau();
    this.montrerFace(f);
    $("etatSel").textContent = "Esquisse sur cette face : OK pour l'ouvrir.";
  }

  /** Un clic dans la vue, sans outil : la face sous la souris, ou le corps si le filtre ne prend pas les faces. */
  clicVue(ev){
    const touche = this.vue.lancerRayon(ev, this.selectionnables())[0];
    const f = touche && this.filtre.faces ? faceSous(this.vue, touche) : null;
    this.arbre.selectionner(null);
    if(!f){ this.arbre.selectionner(touche?.object || null); return; }
    this.arbre.selectionner(touche.object, { discret:true });
    this.montrerFace(f);
    this.ficheFace(f);
    $("etatSel").textContent = `Sélection : une face de ${touche.object.name}`;
  }

  /** La face choisie : teintée, avec son contour. */
  montrerFace(f){
    for(const o of [...this.faceVue.children]){ o.geometry.dispose(); o.material.dispose(); this.faceVue.remove(o); }
    this.faceChoisie = f;
    if(f){
      const nappe = new THREE.Mesh(geometrieFace(f), new THREE.MeshBasicMaterial({ color:0x3fa0ea, transparent:true, opacity:0.4, side:THREE.DoubleSide,
        depthWrite:false, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2 }));
      nappe.renderOrder = 11;
      nappe.raycast = () => {};
      this.faceVue.add(nappe, traitEpais(Array.from(contourFace(f).attributes.position.array), 0x3fa0ea));
    }
    this.vue.invalider();
  }

  /** Ce qu'on sait de la face choisie, en tête des propriétés. L'aire vient du maillage : approchée dès qu'un bord est courbe. */
  ficheFace(f){
    const u = this.doc.unite || "mm", k = UNITES[u] ?? 1;
    const n = (v, d = 3) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits:d }).format(v);
    const lignes = [["Aire", `≈ ${n(f.aire * k ** 2, 1)} ${u}²`]];
    if(f.type === "plan") lignes.push(["Normale", f.normale.toArray().map(c => n(c)).join(" · ")]);
    if(f.type === "cylindre") lignes.push(["Diamètre", `${n(2 * f.rayon * k)} ${u}`], ["Hauteur", `${n(f.hauteur * k)} ${u}`]);
    const bloc = document.createElement("div");
    bloc.className = "fiche-face";
    const noms = { plan:"Face plane", cylindre:"Face cylindrique" };
    bloc.innerHTML = `<h4>${noms[f.type] || "Face courbe"}</h4><table>${lignes.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join("")}</table>`;
    $("props").prepend(bloc);
  }

  /** L'arête exacte sous la souris : son objet et ses segments ; null si rien. */
  toucherArete(ev){
    const rc = new THREE.Raycaster();
    rc.setFromCamera(this.vue.ndc(ev), this.vue.camera());
    const lignes = [];
    for(const m of this.selectionnables()) if(m.visible && m.userData.arete) lignes.push(m.userData.arete);
    const a = this.vue.versEcran(this.vue.cible), b = this.vue.versEcran(this.vue.cible.clone().add(
      new THREE.Vector3().setFromMatrixColumn(this.vue.camera().matrixWorld, 0)));
    const mmParPx = 1 / Math.max(1e-6, Math.hypot(b.x - a.x, b.y - a.y));
    rc.params.Line.threshold = 3 * RAYON_PRISE * mmParPx;    // large : la perspective change l'échelle, le tri ci-dessous décide
    /* La plus proche du curseur, pas de la caméra : sinon une arête voisine passant devant prend le clic.
       Une arête cachée par la matière ne se prend pas : on ne voit pas ce qu'on désignerait. */
    const ecran = (p) => this.vue.versEcran(p), r = this.vue.canvas.getBoundingClientRect();
    const candidats = rc.intersectObjects(lignes, false)
      .map(c => { const e = ecran(c.point); return { c, d:Math.hypot(e.x - (ev.clientX - r.left), e.y - (ev.clientY - r.top)) }; })
      .filter(x => x.d <= RAYON_PRISE).sort((x, y) => x.d - y.d);
    const t = candidats.find(x => !this.cachee(x.c.point, mmParPx))?.c;
    if(!t) return null;
    const idx = t.object.userData.areteIndex, seg = Math.floor(t.index / 2), arete = idx[seg];
    const segs = [];
    for(let i = 0; i < idx.length; i++) if(idx[i] === arete) segs.push(i);
    return { pos:t.object.geometry.attributes.position, segs, objet:t.object };
  }

  /** Ce point est-il derrière la matière, vu de la caméra ? (Sans objet en filaire ou en transparence.) */
  cachee(p, mmParPx){
    if(this.vue.modeFilaire || this.vue.modeTransparent) return false;
    const rc = new THREE.Raycaster();
    rc.setFromCamera(new THREE.Vector2().copy(p.clone().project(this.vue.camera())), this.vue.camera());
    const devant = rc.intersectObjects(this.selectionnables().filter(m => m.visible), false)[0];
    return !!devant && devant.distance < rc.ray.origin.distanceTo(p) - Math.max(2 * mmParPx, 0.006 * (this.vue.rayonModele || 1));
  }

  /** Le point désigné d'une arête, posé sur la courbe exacte. */
  areteSous(ev){
    const t = this.toucherArete(ev);
    return t && this.pointArete(t);
  }

  pointArete({ pos, segs }){
    const s = segs[Math.floor(segs.length / 2)];
    /* Courbe : le début du segment central est un sommet intérieur, posé sur l'arête exacte.
       Droite (un seul segment) : son milieu, exact lui aussi, et loin des arêtes voisines. */
    const p = segs.length > 1 ? new THREE.Vector3().fromBufferAttribute(pos, 2 * s)
      : new THREE.Vector3().fromBufferAttribute(pos, 2 * s).add(new THREE.Vector3().fromBufferAttribute(pos, 2 * s + 1)).multiplyScalar(0.5);
    return p.toArray().map(c => +c.toFixed(5));
  }

  /** Une arête du modèle, ramenée dans le plan de l'esquisse ouverte et fixée à sa place :
      droite, cercle ou arc quand elle en a la forme, sinon une suite de segments. */
  projeterArete(ev){
    const t = this.toucherArete(ev);
    if(!t){ $("etatSel").textContent = "Aucune arête ici."; return; }
    const ed = this.editeur;
    const local = (i) => { const p = new THREE.Vector3().fromBufferAttribute(t.pos, i).applyMatrix4(ed.Minv); return [p.x, p.y]; };
    const pts = [...t.segs.map(s => local(2 * s)), local(2 * t.segs[t.segs.length - 1] + 1)];
    const O = (p) => ({ x:p[0], y:p[1] });
    const a = pts[0], z = pts[pts.length - 1], m = pts[Math.floor(pts.length / 2)];
    let prims = null;
    if(pts.length === 2) prims = [{ type:"ligne", a, b:z }];
    else{
      const ferme = Math.hypot(a[0] - z[0], a[1] - z[1]) < 1e-6;
      const k = cercle3Points(O(a), O(pts[Math.floor(pts.length / 3)]), O(ferme ? pts[Math.floor(2 * pts.length / 3)] : z));
      if(k && pts.every(p => Math.abs(Math.hypot(p[0] - k.c.x, p[1] - k.c.y) - k.r) < 0.02)){
        prims = ferme ? [{ type:"cercle", c:[k.c.x, k.c.y], r:k.r }] : [{ type:"arc", a, m, b:z }];
      }else prims = pts.slice(1).map((p, i) => ({ type:"ligne", a:pts[i], b:p }));
    }
    this.memoriser();
    const avant = new Set(ed.esq.elements.map(e => e.id));
    ajouterPrimitives(ed.esq, prims);
    for(const e of ed.esq.elements){
      if(e.type === "point" && !avant.has(e.id)) ed.esq.contraintes.push({ id:nouvelIdEsquisse(ed.esq, "k"), type:"fixe", a:e.id, x:e.x, y:e.y, projete:true });
    }
    ed.resoudre();
    ed.redessiner();
    this.marquerModifie();
  }

  /** Les segments d'une arête touchée, tels qu'à l'écran. */
  traitDe({ pos, segs }){
    const sortie = [];
    for(const s of segs) for(const i of [2 * s, 2 * s + 1]) sortie.push(pos.getX(i), pos.getY(i), pos.getZ(i));
    return sortie;
  }

  /** Le contour de la face sous un rayon. */
  traitFace(touche){
    const f = faceSous(this.vue, touche);
    return f ? Array.from(contourFace(f).attributes.position.array) : null;
  }

  /** L'arête affichée qui passe par ce point désigné ; null si la pièce montrée ne l'a plus (déjà arrondie). */
  traitAuPoint(p){
    for(const m of this.selectionnables()){
      const l = m.userData.arete;
      if(!l) continue;
      const pos = l.geometry.attributes.position, idx = l.userData.areteIndex;
      const proche = (x, y, z) => Math.hypot(x - p[0], y - p[1], z - p[2]) < 1e-3;
      for(let s = 0; s < idx.length; s++){
        const [a, b] = [2 * s, 2 * s + 1];
        const ax = pos.getX(a), ay = pos.getY(a), az = pos.getZ(a);
        if(proche(ax, ay, az) || proche((ax + pos.getX(b)) / 2, (ay + pos.getY(b)) / 2, (az + pos.getZ(b)) / 2)){
          const segs = [];
          for(let i = 0; i < idx.length; i++) if(idx[i] === idx[s]) segs.push(i);
          return this.traitDe({ pos, segs });
        }
      }
    }
    return null;
  }

  /** Ce qu'un clic prendrait, surligné avant de cliquer. Rend vrai pendant une désignation. */
  survolDesignation(ev){
    const q = this.designation;
    if(!q) return false;
    if(q === "aretes" || q === "projeter" || q === "arete"){
      const t = this.toucherArete(ev);
      this.montrerSurvol(t && this.traitDe(t));
    }else if(q !== "sommets" && q !== "contourClic"){
      const touche = this.vue.lancerRayon(ev, this.selectionnables())[0];
      this.montrerSurvol(touche ? this.traitFace(touche) : null);
    }
    return true;
  }

  montrerSurvol(trait){
    for(const o of [...this.survol.children]){ o.geometry.dispose(); o.material.dispose(); this.survol.remove(o); }
    if(trait?.length) this.survol.add(traitEpais(trait, 0x3fa0ea));
    this.vue.invalider();
  }

  /** Les arêtes et faces désignées, tracées en entier, tant que le panneau est ouvert. */
  majMarques(){
    for(const o of [...this.marques.children]){ o.geometry.dispose(); o.material.dispose(); this.marques.remove(o); }
    const op = this.edition?.op;
    const pts = [];
    const tracer = (p, garderPoint) => {
      let t = this.traits.get(String(p));
      if(!t && !garderPoint && (t = this.traitAuPoint(p))) this.traits.set(String(p), t);
      if(t) this.marques.add(traitEpais(t, 0xf2c744));
      if(!t || garderPoint) pts.push(p);
    };
    if(op){
      if(!op.toutes) for(const p of op.aretes || []) tracer(p, false);
      if(op.arete) tracer(op.arete, false);
      for(const p of [...(op.faces || []), ...(op.faceLimite ? [op.faceLimite.point] : []), ...(op.face ? [op.face.point] : [])]) tracer(p, true);
    }
    if(pts.length){
      const p = new THREE.Points(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(pts.flat(), 3)),
        new THREE.PointsMaterial({ color:0xf2c744, size:10, sizeAttenuation:false, depthTest:false }));
      p.renderOrder = 12;
      this.marques.add(p);
    }
    marquesAteliers(this, op);
    this.vue.invalider();
  }

  /* ==========================================================================
     Esquisse
     ========================================================================== */
  ouvrirEsquisse(op, avant, nouvelle = false){
    this.memoriser(avant);
    this.avantEsquisse = avant;
    const cam = this.vue.camera();
    this.vueAvantEsquisse = { position:cam.position.toArray(), cible:this.vue.cible.toArray(), haut:cam.up.toArray() };
    this.selOp = op.id;
    this.editeur.ouvrir(op, this.v());
    this.ongletRuban("esquisse");
    this.majRuban();
    this.majHistorique();
    $("titreProps").textContent = "Esquisse";
    this.editeur.remplirListe($("props"));
    this.editeur.statut();
    if(nouvelle) this.marquerModifie();
    this.reconstruire();
  }

  terminerEsquisse(){
    if(!this.editeur.ouvert) return;
    if(this.edition) this.annulerOperation();
    this.designer(null);                       // la projection d'arêtes s'arrête avec l'esquisse
    /* Esquisse ouverte puis refermée sans changement : pas d'étape d'annulation pour rien. */
    if(JSON.stringify(this.doc) === this.avantEsquisse && this.pileAnnuler.at(-1) === this.avantEsquisse) this.pileAnnuler.pop();
    this.editeur.fermer();
    if(this.vueAvantEsquisse) this.allerVue(this.vueAvantEsquisse);      // retour à la vue d'où l'on venait
    this.vueAvantEsquisse = null;
    this.dessinerEsquisses();
    this.ongletRuban("modele");
    this.majRuban();
    $("etatSel").textContent = "";
    this.majHistorique();
    this.reconstruire();
  }

  /* ==========================================================================
     Propriétés : masse et matériau
     ========================================================================== */
  afficherProprietes(objet){
    if(this.editeur.ouvert) return;
    $("titreProps").textContent = "Propriétés";
    const hote = $("props");
    /* Un corps : sa masse ; la pièce entière (ou rien de sélectionné) : le total des corps. */
    const corps = CORPS.has(objet) ? [CORPS.get(objet)]
      : (this.resultat?.maillages || []).filter(m => !m.reference && !m.erreur);
    if(!objet || CORPS.has(objet)) hote.innerHTML = "";     // un corps : les valeurs exactes du noyau, pas celles du maillage
    const masse = corps.reduce((s, c) => s + (c.proprietes?.volume || 0) / 1000 * this.densite(matiereDe(this.doc, c.nom)), 0);
    const vol = corps.reduce((s, c) => s + (c.proprietes?.volume || 0), 0);
    const aire = corps.reduce((s, c) => s + (c.proprietes?.aire || 0), 0);
    const f = (v, d = 1) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits:d }).format(v);
    const u = this.doc.unite || "mm", k = UNITES[u] ?? 1;
    hote.querySelector(".fiche-masse")?.remove();
    const bloc = document.createElement("div");
    bloc.className = "fiche-masse";
    const titre = CORPS.has(objet) ? echapper(objet.name) : `Pièce « ${echapper(this.doc.nom)} »`;
    let lignes = `<tr><td>Corps</td><td>${corps.length}</td></tr>
      <tr><td>Volume</td><td>${f(vol * k ** 3, 3)} ${u}³</td></tr>
      <tr><td>Surface</td><td>${f(aire * k ** 2, 3)} ${u}²</td></tr>
      <tr><td>Masse</td><td>${f(masse, 2)} g</td></tr>`;
    if(corps.length === 1 && corps[0].proprietes){
      const c = corps[0].proprietes.centre, bb = corps[0].proprietes.boite;
      lignes += `<tr><td>Centre de gravité</td><td>${c.map(x => f(x * k, 3)).join(" · ")} ${u}</td></tr>
        <tr><td>Encombrement</td><td>${[0, 1, 2].map(i => f((bb[1][i] - bb[0][i]) * k, 3)).join(" × ")} ${u}</td></tr>`;
    }
    bloc.innerHTML = `<h4>${titre}</h4><table>${lignes}<tr><td>Matériau</td><td><select id="selMateriau"></select></td></tr></table>`;
    const s = bloc.querySelector("select");
    for(const nom of this.materiaux()){
      const o = document.createElement("option"); o.value = nom; o.textContent = `${nom} (${this.densite(nom)} g/cm³)`; s.appendChild(o);
    }
    s.value = this.doc.materiau;
    s.onchange = () => { this.memoriser(); this.doc.materiau = s.value; this.marquerModifie(); this.afficherProprietes(this.arbre.selection); };
    if(objet) hote.appendChild(bloc); else hote.replaceChildren(bloc);
    if(!corps.length && !objet) hote.innerHTML = '<p class="vide-p">Aucun corps pour l\'instant.</p>';
  }

  /* ==========================================================================
     Paramètres
     ========================================================================== */
  ouvrirParametres(){
    this.avantParametres = JSON.stringify(this.doc);
    this.remplirParametres();
    const dlg = $("dlgParametres");
    dlg.onclose = () => {
      if(JSON.stringify(this.doc) === this.avantParametres) return;
      this.memoriser(this.avantParametres);
      this.marquerModifie();
      this.reconstruire();
    };
    dlg.showModal();
  }

  remplirParametres(){
    const t = $("tabParametres");
    const { valeurs, erreurs } = evaluerParametres(this.doc.parametres);
    t.innerHTML = "<tr><th></th><th>Nom</th><th>Expression</th><th>Valeur</th><th>Commentaire</th><th>Sert à</th><th></th></tr>";
    /* Les favoris d'abord ; le rang dans le document ne change pas, l'ordre des expressions lui est égal. */
    const ordre = this.doc.parametres.map((p, i) => [p, i]).sort((a, b) => (b[0].favori ? 1 : 0) - (a[0].favori ? 1 : 0));
    for(const [p, i] of ordre){
      const tr = t.insertRow();
      const nom = document.createElement("input"); nom.value = p.nom;
      const expr = document.createElement("input"); expr.value = p.expr;
      const v = tr.insertCell(); tr.insertCell(0).appendChild(nom); tr.insertCell(1).appendChild(expr);
      const fav = document.createElement("button"); fav.type = "button"; fav.className = "tb mini" + (p.favori ? " on" : ""); fav.textContent = p.favori ? "★" : "☆";
      fav.title = "Favori : en tête de liste";
      fav.onclick = () => { p.favori = !p.favori; if(!p.favori) delete p.favori; this.remplirParametres(); };
      tr.insertCell(0).appendChild(fav);
      const com = document.createElement("input"); com.value = p.commentaire || ""; com.placeholder = "Rôle du paramètre";
      com.onchange = () => { const x = com.value.trim(); if(x) p.commentaire = x; else delete p.commentaire; };
      tr.insertCell().appendChild(com);
      const usages = this.usagesParametre(p.nom), us = tr.insertCell();
      us.textContent = usages.length ? String(usages.length) : "—";
      us.title = usages.length ? usages.join("\n") : "Aucune cote ni opération ne le cite";
      v.className = "v";
      v.textContent = erreurs[p.nom] ? "⚠" : +valeurs.get(p.nom)?.toFixed(4);
      v.title = erreurs[p.nom] || "";
      nom.classList.toggle("faux", !!erreurs[p.nom] && !NOM_PARAMETRE.test(p.nom));
      expr.classList.toggle("faux", !!erreurs[p.nom]);
      nom.onchange = () => { this.renommerParametre(p.nom, nom.value.trim()); this.remplirParametres(); };
      expr.onchange = () => { p.expr = expr.value.trim(); this.remplirParametres(); };
      const sup = document.createElement("button"); sup.type = "button"; sup.className = "tb mini"; sup.textContent = "✕";
      sup.onclick = async () => {
        const u = this.usagesParametre(p.nom);
        if(u.length && !await confirmer(`« ${p.nom} » sert à : ${u.join(", ")}. Le supprimer quand même ? (Ces cotes seront en erreur.)`, "Supprimer")) return;
        this.doc.parametres.splice(this.doc.parametres.indexOf(p), 1);
        this.remplirParametres();
      };
      tr.insertCell().appendChild(sup);
    }
  }

  /** Ce qui cite un paramètre : autres paramètres, opérations, cotes d'esquisse. */
  usagesParametre(nom){
    const re = new RegExp(`(^|[^\\wÀ-ÿ])${nom}(?![\\wÀ-ÿ(])`);
    const cite = (x) => typeof x === "string" && re.test(x);
    const sortie = this.doc.parametres.filter(p => p.nom !== nom && cite(p.expr)).map(p => `paramètre ${p.nom}`);
    for(const op of this.doc.operations){
      const champs = (CHAMPS[op.type] || []).filter(ch => ch.type === "expr" && !ch.get);
      const dansCotes = op.type === "esquisse" && op.contraintes.some(k => cite(k.expr) || cite(k.x) || cite(k.y));
      if(dansCotes || champs.some(ch => cite(op[ch.cle]))) sortie.push(op.nom);
    }
    return [...new Set(sortie)];
  }

  ajouterParametre(){
    let n = this.doc.parametres.length + 1;
    while(this.doc.parametres.some(p => p.nom === "p" + n)) n++;
    this.doc.parametres.push({ nom:"p" + n, expr:"10" });
    this.remplirParametres();
  }

  /** Renommer un paramètre réécrit les expressions qui le citent (cotes, opérations, paramètres). */
  renommerParametre(ancien, nouveau){
    if(!nouveau || nouveau === ancien) return;
    if(!NOM_PARAMETRE.test(nouveau) || this.doc.parametres.some(p => p.nom === nouveau)){ avertir(`Nom refusé : « ${nouveau} »`); return; }
    const re = new RegExp(`(^|[^\\wÀ-ÿ])${ancien}(?![\\wÀ-ÿ(])`, "g");      // NOM_PARAMETRE : aucun caractère spécial
    const remplace = (s) => typeof s === "string" ? s.replace(re, `$1${nouveau}`) : s;
    for(const p of this.doc.parametres){ if(p.nom === ancien) p.nom = nouveau; p.expr = remplace(p.expr); }
    for(const c of this.doc.configurations || []){
      c.valeurs = Object.fromEntries(Object.entries(c.valeurs).map(([k, v]) => [k === ancien ? nouveau : k, remplace(v)]));
    }
    for(const op of this.doc.operations){
      /* Seuls les champs d'expression : renommer « y » ne doit toucher ni un axe, ni le base64 d'un STEP. */
      for(const ch of CHAMPS[op.type] || []) if(ch.type === "expr" && !ch.get && typeof op[ch.cle] === "string") op[ch.cle] = remplace(op[ch.cle]);
      if(op.type === "esquisse"){
        for(const c of op.contraintes){
          if(c.expr !== undefined) c.expr = remplace(c.expr);
          if(c.type === "fixe"){ c.x = remplace(c.x); c.y = remplace(c.y); }
        }
        if(op.plan.decalage !== undefined) op.plan.decalage = remplace(op.plan.decalage);
      }
    }
  }

  /* ==========================================================================
     Fichiers
     ========================================================================== */
  /** `intention` : ce que le fichier choisi deviendra (« composant ») ; oublié si on annule ou qu'on ouvre autre chose. */
  choisirFichier(accept, intention = null){
    const f = $("fichier");
    this.intention = intention;
    f.oncancel = () => { this.intention = null; };
    f.accept = accept;
    f.click();
  }

  async ouvrirFichiers(fichiers){
    for(const f of fichiers){
      const ext = f.name.split(".").pop().toLowerCase();
      try{
        if(await fichierAtelier(this, f, ext)) continue;
        if(ext === "json") await this.ouvrirDocument(JSON.parse(await f.text()), null);
        else if(ext === "csv") this.importerParametres(await f.text());
        else if(ext === "stp" || ext === "step") await this.insererStep(f);
        else if(ext === "dxf" || ext === "svg") await this.importerEsquisse(f, ext);
        else throw new Error(`format non pris en charge ici : .${ext} (la visionneuse ouvre les autres)`);
      }catch(e){
        avertir(`Impossible d'ouvrir ${f.name} : ${e.message}`);
      }
    }
    this.intention = null;
  }

  /** Un document lu sur disque : on vérifie sa forme avant de s'en servir. */
  async ouvrirDocument(doc, chemin, { brouillon = false } = {}){
    verifierPiece(doc);
    /* Le nom d'une pièce enregistrée est celui de son fichier : « Enregistrer sous » l'a peut-être changé. */
    const propre = { ...this.docVide(), ...doc, ...(chemin ? { nom:chemin.split("/").pop().replace(/\.json$/i, "") } : {}), parametres:doc.parametres || [], dossiers:Array.isArray(doc.dossiers) ? doc.dossiers : [],
      vues:Array.isArray(doc.vues) ? doc.vues : [], configurations:Array.isArray(doc.configurations) ? doc.configurations : [] };
    normaliserDossiers(propre);
    $("accueil").hidden = true;
    /* Une pièce vide et intacte cède sa place ; sinon, on ouvre à côté : rien n'est perdu. */
    if(this.doc.operations.length || this.modifie){ await this.ouvrirOnglet(propre, chemin, brouillon); return; }
    this.finirEditions();
    this.sauverOnglet();
    Object.assign(this.onglets[this.ongletActif], { doc:propre, chemin, modifie:brouillon, pileAnnuler:[], pileRefaire:[], selOps:new Set() });
    await this.chargerOnglet(this.ongletActif);
  }

  nouveau(){
    $("accueil").hidden = true;
    return this.ouvrirOnglet(this.docVide(), null, false);
  }

  /** Paramètres d'un CSV : ceux de même nom sont mis à jour, les autres ajoutés. */
  importerParametres(texte){
    if(this.edition || this.editeur.ouvert) throw new Error("terminez d'abord l'opération ou l'esquisse en cours");
    const lus = lireParametresCsv(texte);
    if(!lus.length) throw new Error("aucune ligne « nom;expression » reconnue");
    this.modifierDoc(() => {
      for(const l of lus){
        const p = this.doc.parametres.find(x => x.nom === l.nom);
        if(p) p.expr = l.expr; else this.doc.parametres.push(l);
      }
    });
    if($("dlgParametres").open) this.remplirParametres();
    $("etatSel").textContent = `${lus.length} paramètre${lus.length > 1 ? "s" : ""} importé${lus.length > 1 ? "s" : ""}.`;
  }

  async insererStep(f, lien = {}){
    if(this.edition || this.editeur.ouvert) throw new Error("terminez d'abord l'opération ou l'esquisse en cours");
    if(f.size > 60e6) throw new Error("STEP trop gros pour être inséré (60 Mo au plus) : ouvrez-le dans la visionneuse");
    const url = await new Promise((ok, ko) => {
      const r = new FileReader();
      r.onload = () => ok(r.result); r.onerror = () => ko(r.error);
      r.readAsDataURL(f);
    });
    const op = { id:this.nouvelId(), type:"step", nom:f.name, fichier:f.name, reference:true, donnees:String(url).split(",")[1], ...lien };
    const avant = JSON.stringify(this.doc);
    const fin = this.doc.curseur ?? this.doc.operations.length;
    this.doc.operations.splice(fin, 0, op);
    if(this.doc.curseur !== undefined) this.doc.curseur++;
    this.ouvrirPanneau(op, avant, true);
  }

  async importerEsquisse(f, ext){
    if(this.edition || this.editeur.ouvert) return;
    const texte = await f.text();
    const prims = ext === "dxf" ? lireDxf(texte) : lireSvg(new DOMParser().parseFromString(texte, "image/svg+xml"));
    if(!prims.length) throw new Error("aucune ligne, aucun arc ni cercle reconnu");
    const avant = JSON.stringify(this.doc);
    const op = nouvelleOperation("esquisse", this);
    op.nom = f.name;
    ajouterPrimitives(op, prims);
    const fin = this.doc.curseur ?? this.doc.operations.length;
    this.doc.operations.splice(fin, 0, op);
    if(this.doc.curseur !== undefined) this.doc.curseur++;
    this.ouvrirEsquisse(op, avant, true);
  }

  /** `nom` : celui de la pièce sans le demander (pour un script). */
  async enregistrer(sous, nom = null){
    const texte = JSON.stringify(this.doc);
    if(!this.projetsDispo){
      telechargerFichier(texte, nomProjet(this.doc.nom + ".json"), "application/json");
      this.modifie = false; this.majTitre();
      this.sauverBrouillon();
      return;
    }
    let chemin = this.cheminProjet, remplacer = !sous && !!chemin;
    if(!remplacer){
      nom ??= await demanderTexte("Enregistrer la pièce", "Nom (dossier des projets)", this.doc.nom || "piece");
      if(!nom) return;
      chemin = nomProjet(nom.replace(/\.json$/i, "") + ".json");
    }
    try{
      const r = await fetch(`api/projets?nom=${encodeURIComponent(chemin)}${remplacer ? "&remplacer=1" : ""}`, {
        method:"POST", headers:{ "X-Web3D":"1", "Content-Type":"application/json" }, body:texte,
      });
      const j = await r.json().catch(() => ({}));
      if(!r.ok) throw new Error(j.detail || r.status);
      this.cheminProjet = j.chemin;
      this.doc.nom = j.chemin.split("/").pop().replace(/\.json$/i, "");
      this.modifie = false;
      this.majTitre();
      this.majNavigateur();
      if(!this.editeur.ouvert) this.afficherProprietes(this.arbre.selection);
      $("etatSel").textContent = `Enregistré : ${j.chemin}` + (!remplacer && j.chemin !== chemin ? " (nom déjà pris, renommé)" : "");
      this.sauverBrouillon();
    }catch(e){
      avertir(`Enregistrement impossible : ${e.message}`);
    }
  }

  async brancherProjets(){
    try{
      const r = await fetch("api/projets", { cache:"no-store" });
      this.projetsDispo = r.ok && (await r.json()).dispo;
    }catch(_){ this.projetsDispo = false; }
    $("bProjets").hidden = !this.projetsDispo;
    $("bProjets").onclick = () => this.ouvrirProjets();
  }

  async ouvrirProjets(){
    const t = $("tabProjets");
    t.replaceChildren();
    $("projetsEtat").textContent = "";
    try{
      const j = await (await fetch("api/projets", { cache:"no-store" })).json();
      const pieces = j.fichiers.filter(f => /\.json$/i.test(f.chemin));
      $("projetsDossier").textContent = pieces.length ? "Cliquez une pièce pour l'ouvrir." : "Aucune pièce enregistrée pour l'instant.";
      for(const f of pieces){
        const tr = t.insertRow();
        tr.insertCell().textContent = f.chemin;
        tr.insertCell().textContent = new Date(f.date * 1000).toLocaleDateString("fr-FR");
        tr.onclick = async () => {
          $("dlgProjets").close();
          try{ await this.ouvrirProjet(f.chemin); }catch(e){ avertir(`Impossible d'ouvrir : ${e.message}`); }
        };
      }
    }catch(e){ $("projetsEtat").textContent = e.message; }
    $("dlgProjets").showModal();
  }

  /* ==========================================================================
     Pour écrire une pièce par script (voir le README)
     ========================================================================== */

  /** Ce qu'il faut savoir pour écrire une opération : ses champs et ses valeurs par défaut. */
  /** Les règles vérifiables (c10-regles.js) : ce que montre la fenêtre et ce que lit le MCP. */
  controlerRegles(procede = "fdm"){
    if(this.enCours || this.relancer || this.editeur.ouvert) throw new Error("Contrôle impossible pendant une reconstruction ou dans une esquisse : termine-la d'abord.");
    return controlerRegles(this.doc, { gcs:this.gcs, maillages:this.resultat?.maillages || [], procede });
  }

  montrerControle(){
    const hote = $("listeControle");
    hote.textContent = "";
    let r;
    try{ r = this.controlerRegles($("selProcede").value); }
    catch(e){ hote.textContent = e.message; return; }
    for(const c of r.controles){
      const titre = document.createElement("h4");
      titre.textContent = `${c.ok ? "✓" : "✗"} Règle ${c.regle} : ${c.nom}`;
      const ul = document.createElement("ul");
      for(const e of c.ecarts){ const li = document.createElement("li"); li.textContent = e; ul.appendChild(li); }
      hote.append(titre, ul);
    }
  }

  schema(type){
    const compteur = this.doc.compteur;     // nouvelleOperation consomme un identifiant : ici, ce n'est qu'un exemple
    const exemple = nouvelleOperation(type, this);
    this.doc.compteur = compteur;
    return { nom:TYPES[type].nom, exemple, champs:(CHAMPS[type] || []).map(ch => ({
      cle:ch.cle, nom:ch.nom, type:ch.type, quoi:ch.quoi, conditionnel:!!ch.si,
      options:typeof ch.options === "function" ? ch.options(this, exemple) : ch.options })) };
  }

  /** Pose une opération fabriquée par un script, en une étape d'annulation, et la construit. Rend son erreur éventuelle. */
  async poserPourScript(op, avant){
    this.inserer(op);
    this.memoriser(avant);
    this.marquerModifie();
    this.majHistorique();
    this.majRuban();
    await this.reconstruire();
    while(this.enCours || this.relancer) await new Promise(r => setTimeout(r, 30));
    return this.resultat?.etats?.[op.id]?.erreur ?? null;
  }

  /** Une opération créée comme par le ruban : mêmes valeurs par défaut, et les champs passent par les mêmes réglages. */
  async ajouterOperation(type, champs = {}){
    if(!TYPES[type]) throw new Error(`opération inconnue : ${type} (voir schema)`);
    if(type === "esquisse") throw new Error("une esquisse se crée par ajouterEsquisse");
    if(this.edition || this.editeur.ouvert) throw new Error("une opération ou une esquisse est ouverte");
    const avant = JSON.stringify(this.doc), compteur = this.doc.compteur;
    const op = nouvelleOperation(type, this), definitions = CHAMPS[type] || [];
    const connus = new Set([...Object.keys(op), ...definitions.map(c => c.cle), "suspendue"]);
    const inconnus = Object.keys(champs).filter(k => !connus.has(k));
    if(inconnus.length){ this.doc.compteur = compteur; throw new Error(`champs inconnus pour ${type} : ${inconnus.join(", ")}`); }
    for(const [k, v] of Object.entries(structuredClone(champs))){
      const ch = definitions.find(c => c.cle === k);
      if(ch?.set) ch.set(op, v); else op[k] = v;
    }
    return { op, erreur:await this.poserPourScript(op, avant) };
  }

  /** Une esquisse avec ses primitives ; `contraintes` : une liste, ou une fonction qui reçoit les éléments créés et la rend. */
  async ajouterEsquisse({ nom, plan, primitives = [], contraintes = [] } = {}){
    if(this.edition || this.editeur.ouvert) throw new Error("une opération ou une esquisse est ouverte");
    const avant = JSON.stringify(this.doc);
    const op = nouvelleOperation("esquisse", this);
    if(nom) op.nom = nom;
    if(plan) op.plan = structuredClone(plan);
    const elements = ajouterPrimitives(op, primitives);
    for(const k of typeof contraintes === "function" ? contraintes(elements) : contraintes){
      if(!NOMS_CONTRAINTES[k.type]) throw new Error(`contrainte inconnue : ${k.type}`);
      op.contraintes.push({ ...k, id:nouvelIdEsquisse(op, "k") });
    }
    const { ok, conflits, erreurs } = resoudre(this.gcs, op, this.v());
    const erreur = await this.poserPourScript(op, avant);
    return { op, elements, ok, conflits, erreurs, erreur };
  }

  /** Les arêtes de la pièce montrée ; `point` est ce qu'on met dans op.aretes. */
  aretes(){
    const sortie = [];
    for(const m of this.vue.modele.children){
      const l = m.userData.arete;
      if(!l) continue;
      const pos = l.geometry.attributes.position, parArete = new Map();
      l.userData.areteIndex.forEach((a, s) => { if(parArete.has(a)) parArete.get(a).push(s); else parArete.set(a, [s]); });
      for(const segs of parArete.values()){
        const P = (i) => new THREE.Vector3().fromBufferAttribute(pos, i);
        sortie.push({ corps:m.name, point:this.pointArete({ pos, segs }), debut:P(2 * segs[0]).toArray(), fin:P(2 * segs[segs.length - 1] + 1).toArray(),
          longueur:segs.reduce((n, s) => n + P(2 * s).distanceTo(P(2 * s + 1)), 0) });
      }
    }
    return sortie;
  }

  /** Les faces de la pièce montrée ; `point` (sur la face) est ce qu'on met dans op.faces. */
  faces(){
    const sortie = [];
    for(const m of this.vue.modele.children){
      const src = CORPS.get(m);
      for(const f of src?.faces || []){
        const s = (src.surfaces || []).find(g => g.premier === f.premier);
        const point = [0, 1, 2].map(c => [0, 1, 2].reduce((n, k) => n + src.position[3 * src.index[3 * f.premier + k] + c] / 3, 0));
        const { premier:_a, dernier:_b, ...surface } = s || { type:"autre" };
        sortie.push({ corps:m.name, point:point.map(c => +c.toFixed(5)), ...surface });
      }
    }
    return sortie;
  }

  async ouvrirProjet(chemin){
    const r = await fetch("projets/" + chemin.split("/").map(encodeURIComponent).join("/"), { cache:"no-store" });
    if(!r.ok) throw new Error(`${chemin} : ${r.status}`);
    await this.ouvrirDocument(await r.json(), chemin);
  }

  async exporter(format){
    const noms = [];
    this.vue.modele.traverse(o => { if(o.userData.estPiece && o.visible && !CORPS.get(o)?.reference) noms.push(o.name); });
    if(!noms.length){ avertir("Aucun corps visible à exporter (les références STEP ne sont pas exportées)."); return; }
    this.ui.attendre(true, `Export ${format.toUpperCase()}…`, "Le noyau écrit la géométrie exacte.");
    try{
      const r = await this.envoyer({ type:"exporter", doc:this.docPourNoyau(), format, corps:noms });
      telechargerFichier(await r.blob.arrayBuffer(), `${nomProjet(this.doc.nom)}.${format === "stl" ? "stl" : "stp"}`);
    }catch(e){
      if(e.fatale) this.relancerNoyau("Le noyau s'est planté pendant l'export : il a été relancé.");
      else if(!e.abandon) avertir(`Export impossible : ${e.message}`);
    }finally{
      this.ui.attendre(false);
    }
  }
}

/** Une pièce lue ou reçue : de la bonne forme, et transmissible au noyau (ni fonction, ni objet vivant). */
function verifierPiece(doc){
  if(!doc || doc.format !== FORMAT || !Array.isArray(doc.operations) || !Array.isArray(doc.parametres || [])){
    throw new Error("ce fichier n'est pas une pièce du mode conception");
  }
  try{ structuredClone(doc); }
  catch(e){ throw new Error(`cette pièce ne peut pas être transmise au noyau : ${e.message}`); }
}

const RAYON_PRISE = 8;       // pixels autour du curseur pour prendre une arête

const TRAIT_SOMMETS = `uniform vec2 ecran; uniform float large; attribute vec3 b; attribute vec2 c;
void main(){
  vec4 A = projectionMatrix * modelViewMatrix * vec4(position, 1.), B = projectionMatrix * modelViewMatrix * vec4(b, 1.);
  vec2 d = (B.xy / B.w - A.xy / A.w) * ecran;
  vec2 n = length(d) > 1e-6 ? normalize(vec2(-d.y, d.x)) : vec2(0., 1.);
  vec4 P = c.x < .5 ? A : B;
  P.xy += n * c.y * large / ecran * P.w;
  gl_Position = P;
}`;

/**
 * Un trait épais (les lignes WebGL n'ont qu'un pixel) : `segments` à plat, [x, y, z, x, y, z…] par paires.
 * shortcut: un segment qui passe derrière la caméra est mal tracé, gênant seulement de très près en perspective.
 */
function traitEpais(segments, couleur, largeur = 3){
  const a = [], b = [], c = [];
  for(let i = 0; i + 5 < segments.length; i += 6){
    const A = segments.slice(i, i + 3), B = segments.slice(i + 3, i + 6);
    for(const [t, s] of [[0, -1], [0, 1], [1, 1], [0, -1], [1, 1], [1, -1]]){ a.push(...A); b.push(...B); c.push(t, s); }
  }
  const geo = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(a, 3))
    .setAttribute("b", new THREE.Float32BufferAttribute(b, 3)).setAttribute("c", new THREE.Float32BufferAttribute(c, 2));
  const mat = new THREE.ShaderMaterial({ vertexShader:TRAIT_SOMMETS, fragmentShader:`uniform vec3 teinte; void main(){ gl_FragColor = vec4(teinte, 1.);
#include <colorspace_fragment>
}`,
    uniforms:{ ecran:{ value:new THREE.Vector2(1, 1) }, large:{ value:largeur }, teinte:{ value:new THREE.Color(couleur) } }, depthTest:false, transparent:true, side:THREE.DoubleSide });
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  m.renderOrder = 12;
  m.raycast = () => {};
  m.onBeforeRender = (r) => { r.getDrawingBufferSize(mat.uniforms.ecran.value); mat.uniforms.large.value = largeur * r.getPixelRatio(); };
  return m;
}

/** Un panneau flottant suit sa poignée ; sa place est gardée dans ce navigateur. */
function deplacable(poignee, panneau, cle){
  const CLE = "web3d.conception.panneau." + cle;
  const poser = (x, y) => {
    const hote = panneau.parentElement.getBoundingClientRect();
    panneau.style.left = Math.max(0, Math.min(x, hote.width - 80)) + "px";
    const haut = Math.max(0, Math.min(y, hote.height - 40));
    panneau.style.top = haut + "px";
    panneau.style.right = "auto";
    panneau.style.maxHeight = Math.max(80, hote.height - haut - 36) + "px";    // OK et Annuler restent atteignables
  };
  addEventListener("resize", () => {
    if(panneau.style.left) poser(parseFloat(panneau.style.left), parseFloat(panneau.style.top));
  });
  try{
    const g = JSON.parse(localStorage.getItem(CLE) || "null");
    if(g) requestAnimationFrame(() => poser(g.x, g.y));
  }catch(_){ /* place illisible : le panneau reste à sa place d'origine */ }
  poignee.addEventListener("pointerdown", (e) => {
    if(e.button !== 0 || e.target.closest("button")) return;
    e.preventDefault();
    const r = panneau.getBoundingClientRect(), hote = panneau.parentElement.getBoundingClientRect();
    const dx = e.clientX - r.left, dy = e.clientY - r.top;
    const bouger = (ev) => poser(ev.clientX - hote.left - dx, ev.clientY - hote.top - dy);
    const lacher = () => {
      removeEventListener("pointermove", bouger);
      removeEventListener("pointerup", lacher);
      localStorage.setItem(CLE, JSON.stringify({ x:parseFloat(panneau.style.left) || 0, y:parseFloat(panneau.style.top) || 0 }));
    };
    addEventListener("pointermove", bouger);
    addEventListener("pointerup", lacher);
  });
}

/** Le libellé d'un bouton du ruban : son texte sans l'icône <i>, sinon le début de son titre. */
const nomBouton = (b) => {
  const t = [...b.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join("").trim();
  return t.length > 2 ? t : b.title.split(" — ")[0].split(" (")[0];      // galerie : un symbole seul ne dit rien
};
const estNombre = (t) => /^\s*-?\d+(?:[.,]\d+)?\s*$/.test(String(t));

/* =============================================================================
   Démarrage — même ordre que 09-demarrage.js
   ============================================================================= */

/** La boîte « Souris & vue » vient d'index.html : une seule source pour les deux pages. */
async function chargerReglages(){
  const html = await (await fetch("index.html", { cache:"no-store" })).text();
  const doc = new DOMParser().parseFromString(html, "text/html");
  document.body.appendChild(document.adoptNode(doc.getElementById("dlgPrefs")));
}

async function demarrer(){
  chargerPrefs();
  await chargerReglages();

  const vue = new Vue3D($("vue3d"));
  vue.rayonModele = 100;
  let coupe, mesure, arbre, conception;
  const nav = new Navigation(vue, {
    surPointeurBasAvant:(ev) => coupe?.testerClicGizmo(ev) || (conception && poigneeBas(conception, ev)) || (conception?.editeur.ouvert && !conception.designation && conception.editeur.pointeurBas(ev)),
    surSelection:(ev) => {
      if(conception?.clicDesignation(ev)) return;
      if(conception?.editeur.ouvert){ conception.editeur.selectionner(ev); return; }
      if(coupe?.actif && coupe.enChoixFace && coupe.cliquer(ev)) return;
      if(mesure.actif && mesure.cliquer(ev)) return;
      /* Le filtre de sélection décide de ce qui réagit au clic ; sans contrôleur, tout réagit. */
      if(conception) conception.clicVue(ev);
      else arbre.selectionner(pieceSous(vue, ev) || null);
    },
    surSurvol:(ev) => {
      if(conception?.survolDesignation(ev)) return;
      if(conception?.editeur.ouvert){ conception.editeur.survoler(ev); return; }
      if(coupe?.actif && coupe.enChoixFace) coupe.survoler(ev);
      else mesure.survoler(ev);
    },
  });
  nav.allerVersVue("iso", false);
  vue.perspective.position.setLength(320);
  vue.ortho.position.copy(vue.perspective.position);
  vue.regarder();
  vue.majPlansCamera();

  const cube = new CubeVue($("cubeVue"), vue, nav);
  vue.apresRendu.add(() => cube.rendre());
  $("coinCube").hidden = !prefs.cubeVisible;

  arbre = new Arbre(vue, { arbre:$("arbre"), props:$("props"), cpt:$("cptPieces"),
    rech:$("rechArbre"), zoomSel:$("bZoomSel"), isoler:$("bIsoler") });
  mesure = new Mesure(vue, nav, { conteneur:$("ctr"), etat:$("etatMesure") });
  coupe = new CoupeManager(vue, nav, $("ctr"));
  const ui = new InterfaceConception({ vue, nav, cube, arbre, mesure, coupe });

  surPrefs(() => { $("coinCube").hidden = !prefs.cubeVisible; ui.majBarreEtat(); });
  new ResizeObserver(() => { vue.redimensionner(); cube.redimensionner(); }).observe($("ctr"));

  ui.attendre(true, "Conception 3D", "Chargement du solveur d'esquisse…");
  const mod = await init_planegcs_module({ locateFile:() => new URL("../vendor/planegcs/planegcs_dist/planegcs.wasm", import.meta.url).href });
  const gcs = new GcsWrapper(new mod.GcsSystem(), mod);
  gcs.debug_mode = 0;

  conception = new Conception({ vue, nav, arbre, ui, gcs });
  ui.conception = conception;
  arbre.surSelection = (objet) => {
    $("etatSel").textContent = objet ? `Sélection : ${objet.name}` : "";
    conception.montrerFace(null);
    conception.afficherProprietes(objet);
  };
  await conception.brancherProjets();
  window.W3D = { THREE, vue, nav, arbre, mesure, coupe, ui, conception, prefs };
  /* Canal de pilotage du MCP de web_suite (js/pilote.js) : ici, les gestes de l'interface et la capture de la vue. */
  if(window.Pilote){
    window.Pilote.declarer({ page:"conception", projet:() => document.title }).capture(() => { vue.rendre(); return vue.canvas; });
    window.Pilote.commande("web3d_regles", { executer:a => conception.controlerRegles(a.procede) });
  }

  /* ?projet=chemin.json (depuis les projets de la visionneuse), sinon le brouillon de ce navigateur. */
  const projet = new URLSearchParams(location.search).get("projet");
  try{
    if(projet) await conception.ouvrirProjet(projet);
    else{
      const b = JSON.parse(localStorage.getItem(CLE_BROUILLON) || "null");
      for(const p of b?.onglets || []) await conception.ouvrirDocument(p.doc, p.chemin, { brouillon:true });
      if(!b?.onglets?.length){
        await conception.reconstruire();          // charge le noyau d'avance
        conception.montrerAccueil();
      }
    }
  }catch(e){
    conception.statutErreur(e.message);
  }
  ui.attendre(false);
  conception.afficherProprietes(null);
  vue.invalider();
}

demarrer().catch((e) => {
  console.error(e);
  document.getElementById("etatStats").textContent = "⚠ Démarrage impossible : " + e.message;
});
