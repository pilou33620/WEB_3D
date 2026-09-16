/* =============================================================================
   Visionneuse 3D — 00-config.js
   Les réglages, et surtout la table des gestes de la souris.

   Personne n'apprend une nouvelle souris pour regarder un fichier : chacun
   arrive avec les réflexes de son modeleur. On ne choisit donc pas « la bonne »
   convention, on les fournit toutes, et la navigation lit cette table plutôt
   que de coder en dur un bouton.

   Un geste est une clé « [modificateurs+]bouton », modificateurs triés dans
   l'ordre ctrl, shift, alt : « droit », « ctrl+milieu », « ctrl+shift+gauche ».
   La recherche se fait du plus spécifique au plus général, si bien qu'un
   préréglage n'a besoin de déclarer que ce qui le distingue.
   ============================================================================= */
"use strict";

export const ACTIONS = {
  orbite:      "Orbite",
  panoramique: "Panoramique",
  zoom:        "Zoom (glisser)",
  selection:   "Sélection",
  rien:        "— aucun —",
};

export const BOUTONS = ["gauche", "milieu", "droit"];

/* Les emplacements présentés dans le tableau des gestes : au-delà, la table
   accepte n'importe quelle combinaison, mais l'écran deviendrait illisible. */
export const EMPLACEMENTS = [
  "gauche", "shift+gauche", "ctrl+gauche", "alt+gauche",
  "milieu", "shift+milieu", "ctrl+milieu",
  "droit", "shift+droit", "ctrl+droit",
];

/* -----------------------------------------------------------------------------
   Préréglages. Les commentaires disent d'où vient chaque convention : c'est ce
   qui permet de la corriger plus tard sans la deviner.
   --------------------------------------------------------------------------- */
export const PRESETS_SOURIS = {
  onshape: {
    nom: "Onshape",
    note: "Clic droit pour tourner, molette pour zoomer. Le bouton du milieu déplace.",
    gestes: { "gauche":"selection", "droit":"orbite", "ctrl+droit":"panoramique",
              "milieu":"panoramique", "shift+droit":"zoom" },
    moletteInversee:false,
  },
  solidworks: {
    nom: "SolidWorks",
    note: "Tout passe par le bouton du milieu : seul, il tourne ; avec Ctrl il déplace ; avec Maj il zoome.",
    gestes: { "gauche":"selection", "milieu":"orbite", "ctrl+milieu":"panoramique",
              "shift+milieu":"zoom", "droit":"rien" },
    moletteInversee:true,
  },
  fusion360: {
    nom: "Fusion 360 / Autodesk",
    note: "Le bouton du milieu déplace ; Maj + milieu fait tourner. Molette inversée, comme chez Autodesk.",
    gestes: { "gauche":"selection", "milieu":"panoramique", "shift+milieu":"orbite",
              "ctrl+milieu":"zoom", "droit":"rien" },
    moletteInversee:true,
  },
  inventor: {
    nom: "Inventor",
    note: "Identique à Fusion : milieu pour déplacer, Maj + milieu pour tourner.",
    gestes: { "gauche":"selection", "milieu":"panoramique", "shift+milieu":"orbite",
              "ctrl+milieu":"zoom", "droit":"rien" },
    moletteInversee:true,
  },
  tinkercad: {
    nom: "Tinkercad",
    note: "Clic droit pour tourner, bouton du milieu pour déplacer, molette pour zoomer.",
    gestes: { "gauche":"selection", "droit":"orbite", "milieu":"panoramique",
              "shift+droit":"panoramique", "ctrl+droit":"zoom" },
    moletteInversee:false,
  },
  catia: {
    nom: "CATIA",
    note: "Le bouton du milieu déplace ; maintenu avec Ctrl, il fait tourner.",
    gestes: { "gauche":"selection", "milieu":"panoramique", "ctrl+milieu":"orbite",
              "shift+milieu":"zoom", "droit":"rien" },
    moletteInversee:false,
  },
  creo: {
    nom: "Creo / Pro-E",
    note: "Bouton du milieu pour tourner, Maj pour déplacer, Ctrl pour zoomer.",
    gestes: { "gauche":"selection", "milieu":"orbite", "shift+milieu":"panoramique",
              "ctrl+milieu":"zoom", "droit":"rien" },
    moletteInversee:false,
  },
  nx: {
    nom: "Siemens NX",
    note: "Bouton du milieu pour tourner ; avec Maj il déplace, avec Ctrl il zoome.",
    gestes: { "gauche":"selection", "milieu":"orbite", "shift+milieu":"panoramique",
              "ctrl+milieu":"zoom", "droit":"rien" },
    moletteInversee:false,
  },
  solidedge: {
    nom: "Solid Edge",
    note: "Bouton du milieu pour tourner, Ctrl + milieu pour déplacer.",
    gestes: { "gauche":"selection", "milieu":"orbite", "ctrl+milieu":"panoramique",
              "shift+milieu":"zoom", "droit":"rien" },
    moletteInversee:false,
  },
  blender: {
    nom: "Blender",
    note: "Bouton du milieu pour tourner, Maj pour déplacer, Ctrl pour zoomer.",
    gestes: { "gauche":"selection", "milieu":"orbite", "shift+milieu":"panoramique",
              "ctrl+milieu":"zoom", "droit":"rien" },
    moletteInversee:false,
  },
  portable: {
    nom: "Portable / pavé tactile",
    note: "Sans molette ni bouton du milieu : le bouton gauche tourne, Maj déplace, Ctrl zoome.",
    gestes: { "gauche":"orbite", "shift+gauche":"panoramique", "ctrl+gauche":"zoom",
              "alt+gauche":"selection", "droit":"panoramique", "milieu":"panoramique" },
    moletteInversee:false,
  },
  perso: {
    nom: "Personnalisé",
    note: "À vous : chaque ligne du tableau ci-dessous est modifiable.",
    gestes: { "gauche":"selection", "droit":"orbite", "milieu":"panoramique",
              "ctrl+droit":"panoramique", "shift+droit":"zoom" },
    moletteInversee:false,
  },
};

/* -----------------------------------------------------------------------------
   Préférences
   --------------------------------------------------------------------------- */
export const PREFS_DEFAUT = {
  /* souris */
  preset:"onshape",
  gestesPerso:{ ...PRESETS_SOURIS.perso.gestes },
  moletteInversee:false,
  zoomVersCurseur:true,
  inertie:true,
  paveTactile:false,
  sensOrbite:1, sensPano:1, sensZoom:1,

  /* vue */
  orbite:"libre",          // libre | contrainte
  axeVertical:"z",         // z (CAO) | y (temps réel)
  projection:"perspective",// perspective | ortho
  cubeVisible:true,
  grille:true,
  ombres:false,
  aretes:true,
  angleAretes:25,
  fond:"degrade",          // degrade | sombre | clair

  /* qualité du maillage demandé à OpenCascade */
  tolLineaire:0.002,       // fraction de la diagonale de l'encombrement
  tolAngulaire:15,         // degrés
  unite:"millimeter",
  aretesSurGrosModeles:false,
};

const CLE = "web3d.prefs";

export const prefs = { ...PREFS_DEFAUT, gestesPerso:{ ...PREFS_DEFAUT.gestesPerso } };

const abonnes = new Set();

/** S'abonner aux changements de préférences. Renvoie la fonction de désabonnement. */
export function surPrefs(cb){ abonnes.add(cb); return () => abonnes.delete(cb); }

/** Prévenir les abonnés — appelé après toute modification. */
export function prefsModifiees(quoi){
  enregistrerPrefs();
  for(const cb of abonnes){ try{ cb(prefs, quoi); }catch(e){ console.error(e); } }
}

export function chargerPrefs(){
  try{
    const brut = localStorage.getItem(CLE);
    if(!brut) return prefs;
    const lu = JSON.parse(brut);
    /* Fusion prudente : une préférence inconnue (ancienne version, clé
       supprimée) ne doit pas écraser la valeur par défaut. */
    for(const k of Object.keys(PREFS_DEFAUT)){
      if(lu[k] !== undefined && typeof lu[k] === typeof PREFS_DEFAUT[k]) prefs[k] = lu[k];
    }
    if(lu.gestesPerso && typeof lu.gestesPerso === "object")
      prefs.gestesPerso = { ...PREFS_DEFAUT.gestesPerso, ...lu.gestesPerso };
    if(!PRESETS_SOURIS[prefs.preset]) prefs.preset = PREFS_DEFAUT.preset;
  }catch(e){ console.warn("Préférences illisibles, retour aux valeurs d'origine.", e); }
  return prefs;
}

export function enregistrerPrefs(){
  try{ localStorage.setItem(CLE, JSON.stringify(prefs)); }
  catch(e){ /* navigation privée, quota : ce n'est pas une raison d'échouer */ }
}

export function reinitialiserPrefs(){
  Object.assign(prefs, PREFS_DEFAUT, { gestesPerso:{ ...PREFS_DEFAUT.gestesPerso } });
  prefsModifiees("tout");
}

/* -----------------------------------------------------------------------------
   Lecture des gestes
   --------------------------------------------------------------------------- */

/** La table de gestes active : celle du préréglage, ou la table personnelle. */
export function gestesActifs(){
  return prefs.preset === "perso" ? prefs.gestesPerso : PRESETS_SOURIS[prefs.preset].gestes;
}

/** Nom du bouton d'un évènement pointeur (0 gauche, 1 milieu, 2 droit). */
export function nomBouton(numero){
  return numero === 0 ? "gauche" : numero === 1 ? "milieu" : numero === 2 ? "droit" : null;
}

export function cleGeste(bouton, ev){
  let cle = "";
  if(ev.ctrlKey || ev.metaKey) cle += "ctrl+";
  if(ev.shiftKey) cle += "shift+";
  if(ev.altKey) cle += "alt+";
  return cle + bouton;
}

/**
 * Action associée à un bouton et à l'état des modificateurs.
 * On essaie la combinaison complète, puis on retire les modificateurs un à un :
 * Ctrl+Maj+droit retombe sur Ctrl+droit, puis sur droit. C'est ce qui permet
 * aux préréglages de ne décrire que leurs gestes propres.
 */
export function actionPourGeste(bouton, ev){
  const table = gestesActifs();
  const mods = [];
  if(ev.ctrlKey || ev.metaKey) mods.push("ctrl");
  if(ev.shiftKey) mods.push("shift");
  if(ev.altKey) mods.push("alt");

  for(let n = mods.length; n >= 0; n--){
    const cle = (mods.slice(0, n).join("+") + (n ? "+" : "")) + bouton;
    if(table[cle]) return table[cle];
  }
  return "rien";
}

/** Résumé lisible, pour la barre d'état : « Orbite : clic droit · … ». */
export function resumeGestes(){
  const table = gestesActifs();
  const libelle = { gauche:"clic gauche", milieu:"clic milieu", droit:"clic droit" };
  const joli = (cle) => cle.split("+").map(p => libelle[p] || p.replace("ctrl","Ctrl").replace("shift","Maj").replace("alt","Alt")).join("+");
  const trouve = (action) => Object.keys(table).filter(k => table[k] === action).map(joli);

  const bouts = [];
  for(const [action, nom] of [["orbite","Orbite"],["panoramique","Panoramique"],["zoom","Zoom"]]){
    const g = trouve(action);
    if(g.length) bouts.push(`${nom} : ${g.slice(0,2).join(" ou ")}`);
  }
  bouts.push(`Molette : zoom${prefs.moletteInversee ? " (inversé)" : ""}`);
  return bouts.join("  ·  ");
}
