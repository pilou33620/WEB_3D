/* =============================================================================
   Visionneuse 3D — 09-demarrage.js
   L'assemblage : on crée les modules, on les relie, et on n'en parle plus.

   L'ordre compte. Les préférences d'abord — la scène lit la projection, le
   fond et l'axe vertical dès son constructeur. La navigation ensuite, parce
   que le cube de vues lui délègue ses clics. L'interface en dernier : elle
   suppose que tout le reste existe.
   ============================================================================= */
"use strict";

import * as THREE from "three";
import { chargerPrefs, prefs, surPrefs } from "./00-config.js";
import { Vue3D } from "./01-scene.js";
import { Navigation } from "./03-navigation.js";
import { CubeVue } from "./04-cube-vue.js";
import { Arbre } from "./05-arbre.js";
import { Mesure } from "./07-mesure.js";
import { Interface, pieceSous } from "./08-interface.js";

const $ = (id) => document.getElementById(id);

chargerPrefs();

/* ---------------- la scène ---------------- */
const vue = new Vue3D($("vue3d"));

/* Une scène vide n'a pas d'échelle : sans ce rayon de départ, la grille, le
   zoom et les plans de caméra n'auraient aucune référence avant le premier
   fichier ouvert. */
vue.rayonModele = 100;
vue.cible.set(0, 0, 0);

/* ---------------- navigation ---------------- */
const nav = new Navigation(vue, {
  surSelection:(ev) => {
    /* En mode mesure, le clic gauche pose un point : il ne sélectionne pas. */
    if(mesure.actif && mesure.cliquer(ev)) return;
    const piece = pieceSous(vue, ev);
    arbre.selectionner(piece || null);
  },
  surSurvol:(ev) => mesure.survoler(ev),
});
nav.allerVersVue("iso", false);
vue.perspective.position.setLength(320);
vue.ortho.position.copy(vue.perspective.position);
vue.regarder();
vue.majPlansCamera();

/* ---------------- cube de vues ---------------- */
const cube = new CubeVue($("cubeVue"), vue, nav);
vue.apresRendu.add(() => cube.rendre());
$("coinCube").hidden = !prefs.cubeVisible;

/* ---------------- arbre, mesure, interface ---------------- */
const arbre = new Arbre(vue, {
  arbre:$("arbre"), props:$("props"), cpt:$("cptPieces"),
  rech:$("rechArbre"), zoomSel:$("bZoomSel"), isoler:$("bIsoler"),
});
const mesure = new Mesure(vue, nav, { conteneur:$("ctr"), etat:$("etatMesure") });

arbre.surSelection = (objet) => {
  $("etatSel").textContent = objet ? `Sélection : ${objet.name || "sans nom"}` : "";
};

const ui = new Interface({ vue, nav, cube, arbre, mesure });

/* Le cube et la barre d'état suivent les préférences quelle que soit la
   manière dont elles ont changé — dialogue, clavier ou bouton du coin. */
surPrefs(() => {
  $("coinCube").hidden = !prefs.cubeVisible;
  ui.majBarreEtat();
});

/* La taille du canevas ne dépend pas que de la fenêtre : un panneau replié
   ou une barre d'outils qui passe à la ligne la change aussi. */
new ResizeObserver(() => { vue.redimensionner(); cube.redimensionner(); }).observe($("ctr"));

vue.invalider();

/* Ouverture directe depuis l'URL : ?modele=chemin/piece.stp — pratique pour
   partager un lien vers un fichier posé à côté de la visionneuse. Plusieurs
   chemins séparés par une virgule s'ouvrent ensemble, ce qui permet de joindre
   à un .obj sa bibliothèque de matériaux : ?modele=piece.obj,piece.mtl */
const depuisUrl = new URLSearchParams(location.search).get("modele");
if(depuisUrl){
  const chemins = depuisUrl.split(",").map(c => c.trim()).filter(Boolean);
  Promise.all(chemins.map(async (chemin) => {
    const r = await fetch(chemin);
    if(!r.ok) throw new Error(`${chemin} : ${r.status} ${r.statusText}`);
    return new File([await r.blob()], chemin.split("/").pop());
  }))
    .then(fichiers => ui.charger(fichiers))
    .catch(e => ui.erreur(`Impossible d'ouvrir : ${e.message}`));
}

/* De quoi inspecter la scène depuis la console du navigateur, sans outil. */
window.W3D = { THREE, vue, nav, cube, arbre, mesure, ui, prefs };
