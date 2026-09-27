/* =============================================================================
   Visionneuse 3D — 07-mesure.js
   Mesurer : d'un point à un autre, d'une arête à une autre, d'une face à une
   autre.

   Une visionneuse sert d'abord à vérifier : un entraxe, une épaisseur, un jeu.
   Encore faut-il désigner ce qu'on mesure, et c'est là que les trois modes se
   séparent — parce que trois choses différentes sont attendues :

   · Point à point, c'est la distance brute entre deux endroits du modèle. La
     mesure doit tomber juste, et « juste » veut dire sur un sommet du maillage,
     pas à l'endroit approximatif où le curseur a touché la surface. D'où
     l'accrochage : si un sommet du triangle visé est à quelques pixels, c'est
     lui qu'on prend.

   · Arête à arête : entre deux cercles/arcs, la cote s'ancre sur les bords
     les plus proches (passage de matière, dégagement) tout en indiquant l'entraxe.
     Entre deux arêtes parallèles, c'est leur écartement dans la zone commune.

   · Face à face : deux plans parallèles donnent une épaisseur, deux cylindres
     donnent le passage bord à bord ainsi que l'entraxe, un cylindre et un plan
     donnent le jeu matière et la hauteur d'axe.

   La décomposition ΔXYZ suit Fusion 360 : quatre réglages (aucune, repère de
   la pièce de la sélection 1, de la sélection 2, repère global). Les écarts
   sont signés, de la sélection 1 vers la sélection 2, et l'escalier coloré
   part du point de référence : depuis la sélection 2, il se déroule à
   rebours, X d'abord en partant d'elle.

   Le travail de reconnaissance est dans 06-topologie.js ; ce fichier-ci ne
   fait que désigner, surligner, et poser la cote à l'écran.

   L'étiquette est un élément HTML posé au-dessus du canevas plutôt qu'un objet
   3D : le texte reste net à toute échelle et suit la feuille de style du reste
   de l'interface.

   Le détail chiffré va dans une fenêtre à part, comme le panneau MEASURE de
   Fusion 360 : les résultats, puis ce qu'on sait de chaque sélection. La
   barre d'état ne garde que la consigne du moment.
   ============================================================================= */
"use strict";

import * as THREE from "three";
import { prefs } from "./00-config.js";
import { analyser, areteSous, faceSous, tailleParPixel, geometrieArete, geometrieFace, contourFace,
         mesurerAretes, mesurerFaces, mesurerEntites, mesurerEntiteSeule, resumer, cote, mm, degres,
         PLAFOND_TRIANGLES, nombre, repereDePiece, pointsAccroche, numeroArete,
         centreDeFace, pointSurArete } from "./06-topologie.js";

const SEUIL_ACCROCHE = 14;      // pixels
const PLAFOND_ANALYSE_SURVOL = 100_000; // triangles : au-delà, l'analyse attend le clic

/** Ce que l'accroche a trouvé, tel qu'on le nomme à l'utilisateur. */
const NOMS_ACCROCHE = {
  sommet:"Sommet", milieu:"Milieu d'arête", centreCercle:"Centre du cercle", centreArc:"Centre de l'arc",
  centreFace:"Centre de face", arete:"Sur l'arête", sommetMaillage:"Sommet du maillage",
  surface:"Sur la surface", libre:"Point libre (Maj)",
};
const SEUIL_ARETE = 16;         // pixels
const JAUNE = 0xf2c744;
const CYAN = 0x8af0ff;

export const MODES = {
  auto:  { nom:"Auto",   aide:"Mesure automatique : approche d'un bord → arête, surface → face (distance ou angle)." },
  point: { nom:"Point",  aide:"Mesure point à point : cliquez le premier point (accroche sommets, milieux, centres · Maj : point libre)." },
  arete: { nom:"Arête",  aide:"Mesure d'arête à arête : approchez le curseur d'une arête, puis cliquez." },
  face:  { nom:"Face",   aide:"Mesure de face à face : cliquez une face de la pièce." },
};

/** Les réglages ΔXYZ, dans l'ordre des boutons de Fusion 360. */
export const MODES_DELTA = {
  off:    { nom:"⊘",      aide:"Pas de décomposition : la distance seule." },
  sel1:   { nom:"1",      aide:"ΔXYZ dans le repère de la pièce de la sélection 1 — l'escalier part du point 1." },
  sel2:   { nom:"2",      aide:"ΔXYZ dans le repère de la pièce de la sélection 2 — l'escalier part du point 2." },
  global: { nom:"Global", aide:"ΔXYZ dans le repère global du projet." },
};

/**
 * La fenêtre des valeurs. Posée en bas à droite au-dessus de la barre de
 * mesure, déplaçable par sa barre de titre, chaque section repliable. Tout le
 * texte passe par textContent : les noms de pièces viennent des fichiers.
 */
class FenetreResultats {
  constructor(conteneur){
    this.conteneur = conteneur;
    this.replies = new Set();         // titres des sections repliées

    const f = this.el = document.createElement("div");
    f.className = "fenetre-mesure";
    f.hidden = true;
    const tete = document.createElement("div");
    tete.className = "fm-tete";
    tete.title = "Glisser pour déplacer · double-clic pour remettre en place";
    this.titre = document.createElement("span");
    tete.appendChild(this.titre);
    const plier = document.createElement("button");
    plier.type = "button";
    plier.className = "fm-plier";
    plier.textContent = "−";
    plier.title = "Replier / déplier la fenêtre";
    plier.onclick = () => {
      f.classList.toggle("repliee");
      plier.textContent = f.classList.contains("repliee") ? "+" : "−";
    };
    tete.appendChild(plier);
    this.corps = document.createElement("div");
    this.corps.className = "fm-corps";
    f.append(tete, this.corps);

    /* La vue ne doit pas tourner ni zoomer quand on agit dans la fenêtre. */
    for(const t of ["pointerdown", "wheel", "dblclick", "contextmenu"]){
      f.addEventListener(t, (ev) => ev.stopPropagation());
    }
    this.brancherDeplacement(tete, plier);
    conteneur.appendChild(f);
  }

  brancherDeplacement(tete, plier){
    let depart = null;
    tete.addEventListener("pointerdown", (ev) => {
      if(ev.target === plier) return;
      const r = this.el.getBoundingClientRect(), c = this.conteneur.getBoundingClientRect();
      depart = { x:ev.clientX, y:ev.clientY, l:r.left - c.left, t:r.top - c.top };
      tete.setPointerCapture(ev.pointerId);
    });
    tete.addEventListener("pointermove", (ev) => {
      if(!depart) return;
      const c = this.conteneur.getBoundingClientRect();
      const l = Math.max(0, Math.min(c.width - this.el.offsetWidth, depart.l + ev.clientX - depart.x));
      const t = Math.max(0, Math.min(c.height - 30, depart.t + ev.clientY - depart.y));
      Object.assign(this.el.style, { left:`${l}px`, top:`${t}px`, right:"auto", bottom:"auto" });
    });
    const fin = () => { depart = null; };
    tete.addEventListener("pointerup", fin);
    tete.addEventListener("pointercancel", fin);
    tete.addEventListener("dblclick", () => {
      Object.assign(this.el.style, { left:"", top:"", right:"", bottom:"" });
    });
  }

  masquer(){ this.el.hidden = true; }

  /**
   * `donnees` : { titre, sections:[{ titre, sousTitre?, lignes:[[libellé, valeur, classe?]] }] }.
   * Une ligne sans libellé est une remarque sur toute la largeur.
   */
  afficher(donnees){
    this.titre.textContent = donnees.titre;
    this.corps.replaceChildren(...donnees.sections.map(sec => {
      const bloc = document.createElement("section");
      bloc.className = "fm-section" + (this.replies.has(sec.titre) ? " repliee" : "");
      const h = document.createElement("button");
      h.type = "button";
      h.className = "fm-section-titre";
      h.textContent = sec.titre;
      h.onclick = () => {
        bloc.classList.toggle("repliee");
        if(bloc.classList.contains("repliee")) this.replies.add(sec.titre);
        else this.replies.delete(sec.titre);
      };
      bloc.appendChild(h);
      if(sec.sousTitre){
        const st = document.createElement("div");
        st.className = "fm-sous-titre";
        st.textContent = sec.sousTitre;
        bloc.appendChild(st);
      }
      for(const [cle, valeur, classe] of sec.lignes){
        const l = document.createElement("div");
        l.className = "fm-ligne" + (cle ? "" : " fm-note") + (classe ? " " + classe : "");
        if(cle){
          const k = document.createElement("span");
          k.className = "fm-cle";
          k.textContent = cle;
          l.appendChild(k);
        }
        const v = document.createElement("span");
        v.className = "fm-valeur";
        v.textContent = valeur;
        l.appendChild(v);
        bloc.appendChild(l);
      }
      return bloc;
    }));
    this.el.hidden = false;
  }
}

const REPERE_GLOBAL = Object.freeze({
  mode:"global", nom:"Global", depuis:1,
  uX:new THREE.Vector3(1, 0, 0), uY:new THREE.Vector3(0, 1, 0), uZ:new THREE.Vector3(0, 0, 1),
});

export class Mesure {
  constructor(vue, navigation, elements){
    this.vue = vue;
    this.nav = navigation;
    this.el = elements;          // { conteneur, etat }
    this.actif = false;
    this.mode = "auto";
    this.modeDelta = MODES_DELTA[prefs.mesureDeltaMode] ? prefs.mesureDeltaMode : "global";
    this.points = [];            // mode point
    this.pointsMaillages = [];   // maillages correspondant aux points
    this.pointsTypes = [];       // ce sur quoi chaque point s'est accroché
    this.maillageSurvole = null; // dernière pièce survolée en mode point
    this.accrocheMontree = [];   // points d'accroche dessinés autour du curseur
    this.entites = [];           // modes auto, arête et face
    this.etiquettes = [];
    this.etiquettesDelta = [];
    this.donneesDelta = null;
    this.raison = null;          // pourquoi le dernier survol n'a rien désigné
    this.surMesureChange = null; // notification interface pour màj des boutons P1/P2

    this.groupe = new THREE.Group();
    this.groupe.name = "cotes";
    vue.annotations.add(this.groupe);

    this.ligne = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.LineBasicMaterial({ color:JAUNE, depthTest:false, transparent:true }),
    );
    this.ligne.renderOrder = 6;
    this.ligne.visible = false;
    this.groupe.add(this.ligne);

    /* Lignes 3D pour la décomposition orthogonale style CAO (Dist, dX, dY, dZ) */
    this.ligneDist = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.LineBasicMaterial({ color:0x111111, depthTest:false, transparent:true, opacity:0.95 }),
    );
    this.ligneDist.renderOrder = 6;
    this.ligneDist.visible = false;

    this.ligneX = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.LineBasicMaterial({ color:0xe53935, depthTest:false, transparent:true }),
    );
    this.ligneX.renderOrder = 6;
    this.ligneX.visible = false;

    this.ligneY = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.LineBasicMaterial({ color:0x2e7d32, depthTest:false, transparent:true }),
    );
    this.ligneY.renderOrder = 6;
    this.ligneY.visible = false;

    this.ligneZ = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.LineBasicMaterial({ color:0x1565c0, depthTest:false, transparent:true }),
    );
    this.ligneZ.renderOrder = 6;
    this.ligneZ.visible = false;

    this.groupe.add(this.ligneDist, this.ligneX, this.ligneY, this.ligneZ);

    /* Tracé de construction d'un angle : prolongements des arêtes et arc. */
    this.construction = new THREE.Group();
    this.construction.name = "construction";
    this.groupe.add(this.construction);
    this.etiquettesConstruction = [];

    this.reperes = [this.repere(), this.repere()];
    /* Sommets de l'escalier delta : P1 (rouge), Coin1 (noir), Coin2 (noir), P2 (bleu) */
    this.reperesDelta = [
      this.repere(0xe53935),
      this.repere(0x111111),
      this.repere(0x111111),
      this.repere(0x1565c0),
    ];
    this.apercu = this.repere(CYAN);

    /* Calque SVG superposé pour les lignes de rappel et points d'ancrage */
    this.calqueSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.calqueSvg.setAttribute("class", "mesure-calque-svg");
    this.el.conteneur.appendChild(this.calqueSvg);

    /* Les surlignages de ce qui est désigné : deux retenus, un survolé. Ils se
       reconstruisent à chaque changement, d'où le groupe dédié qu'on vide. */
    this.surlignages = new THREE.Group();
    this.groupe.add(this.surlignages);
    this.retenus = [null, null];
    this.survole = null;
    this.cleSurvol = null;

    this.fenetre = new FenetreResultats(this.el.conteneur);

    /* L'accroche se voit : les points proposés par l'arête ou la face sous le
       curseur, et une étiquette qui dit sur quoi le clic va tomber. */
    this.calqueAccroche = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.calqueAccroche.setAttribute("class", "mesure-calque-svg calque-accroche");
    this.el.conteneur.appendChild(this.calqueAccroche);
    this.infoAccroche = document.createElement("div");
    this.infoAccroche.className = "info-accroche";
    this.infoAccroche.hidden = true;
    this.el.conteneur.appendChild(this.infoAccroche);
    vue.apresRendu.add(() => this.dessinerAccroche());

    vue.apresRendu.add(() => this.replacerEtiquettes());
  }

  repere(couleur = JAUNE){
    const r = new THREE.Mesh(
      new THREE.SphereGeometry(1, 16, 12),
      new THREE.MeshBasicMaterial({ color:couleur, depthTest:false }),
    );
    r.renderOrder = 7;
    r.visible = false;
    this.groupe.add(r);
    return r;
  }

  /** Les repères sont dimensionnés en pixels : un point de mesure doit rester
      visible qu'on soit à 2 mm ou à 2 m de la pièce. */
  tailleRepere(){
    return Math.max(this.vue.distance() * 0.006, (this.vue.rayonModele || 1) * 1e-4);
  }

  /* ==========================================================================
     Mise en marche et modes
     ========================================================================== */
  basculer(actif){
    this.actif = actif !== undefined ? actif : !this.actif;
    this.vue.canvas.classList.toggle("mesure", this.actif);
    this.annuler();                       // remet aussi la consigne du mode
    return this.actif;
  }

  definirMode(mode){
    if(!MODES[mode] || mode === this.mode) return this.mode;
    this.mode = mode;
    this.masquerAccroche();
    /* Une mesure entamée ne survit pas au changement de mode : deux arêtes ne
       se comparent pas à une face, et garder la première prise ne ferait que
       tromper sur ce qui va être mesuré. */
    this.annuler();
    return mode;
  }

  /** L'ordre du panneau et du clavier : point → arête → face → point. */
  modeSuivant(){
    const cles = Object.keys(MODES);
    return this.definirMode(cles[(cles.indexOf(this.mode) + 1) % cles.length]);
  }

  /** Une mesure est commencée dès qu'un premier élément est retenu. */
  enCours(){
    return this.points.length > 0 || this.entites.length > 0;
  }

  /** Les surlignages suivent le plan de coupe comme le reste du modèle. */
  majCoupe(){
    const coupe = this.vue.plansCoupe.length ? this.vue.plansCoupe : null;
    this.surlignages.traverse(o => {
      if(!o.material) return;
      o.material.clippingPlanes = coupe;
      o.material.needsUpdate = true;
    });
    this.vue.invalider();
  }

  annuler(){
    this.points = [];
    this.pointsMaillages = [];
    this.pointsTypes = [];
    this.entites = [];
    this.masquerAccroche();
    this.poserConstruction(null);
    this.ligne.visible = false;
    this.annulerDelta();
    for(const r of this.reperes) r.visible = false;
    this.apercu.visible = false;
    for(const e of this.etiquettes) e.remove();
    this.etiquettes = [];
    this.viderSurlignages();
    this.dernierResultat = null;
    this.fenetre.masquer();
    this.annoncer(this.actif ? MODES[this.mode].aide : null);
    this.surMesureChange?.();
    this.vue.invalider();
  }

  annulerDelta(){
    if(this.ligneDist) this.ligneDist.visible = false;
    if(this.ligneX) this.ligneX.visible = false;
    if(this.ligneY) this.ligneY.visible = false;
    if(this.ligneZ) this.ligneZ.visible = false;
    if(this.reperesDelta){
      for(const r of this.reperesDelta) r.visible = false;
    }
    if(this.etiquettesDelta){
      for(const e of this.etiquettesDelta) e.remove();
      this.etiquettesDelta = [];
    }
    if(this.calqueSvg) this.calqueSvg.innerHTML = "";
    this.donneesDelta = null;
  }

  definirModeDelta(mode){
    if(!MODES_DELTA[mode]) return this.modeDelta;
    this.modeDelta = mode;
    prefs.mesureDeltaMode = mode;
    this.rafraichir();
    this.surMesureChange?.();
    return mode;
  }

  /** Renvoie les maillages des 2 éléments mesurés et indique s'ils sont distincts. */
  piecesMesurees(){
    let mA = null, mB = null;
    if(this.entites.length > 0){
      mA = this.entites[0]?.maillage || null;
      mB = this.entites[1]?.maillage || null;
    }else if(this.pointsMaillages.length > 0){
      mA = this.pointsMaillages[0] || null;
      mB = this.pointsMaillages[1] || null;
    }
    return { mA, mB, deuxPiecesDistinctes: !!(mA && mB && mA !== mB) };
  }

  /**
   * Le repère des ΔXYZ et le point d'où part l'escalier (`depuis` : 1 ou 2).
   * En « sélection 2 » avec un seul élément retenu, c'est sa pièce qui sert.
   */
  obtenirRepereActif(){
    if(this.modeDelta !== "sel1" && this.modeDelta !== "sel2") return REPERE_GLOBAL;
    const depuis = this.modeDelta === "sel1" ? 1 : 2;
    const { mA, mB } = this.piecesMesurees();
    const cible = depuis === 1 ? mA : (mB || mA);
    const rep = cible && repereDePiece(cible);
    if(!rep) return { ...REPERE_GLOBAL, depuis };
    return { mode:"piece", nom:rep.nom || "Pièce", uX:rep.uX, uY:rep.uY, uZ:rep.uZ, depuis };
  }

  /** Les écarts signés de p1 vers p2 dans le repère donné. */
  ecarts(p1, p2, rep = this.obtenirRepereActif()){
    const v = new THREE.Vector3().subVectors(p2, p1);
    return { x:v.dot(rep.uX), y:v.dot(rep.uY), z:v.dot(rep.uZ) };
  }

  /** Cote et annonce des deux points retenus en mode point. */
  poserPoints(){
    const [a, b] = this.points;
    const d = a.distanceTo(b);
    if(this.modeDelta !== "off" && d > 1e-4){
      this.afficherMesureDelta(a, b, mm(d));
    }else{
      this.annulerDelta();
      this.tracer(a, b, false);
      for(let i = 0; i < 2; i++){
        const rep = this.reperes[i];
        rep.position.copy(i ? b : a);
        rep.scale.setScalar(this.tailleRepere());
        rep.visible = true;
      }
      this.poserEtiquette(a.clone().lerp(b, 0.5), mm(d));
    }
    this.annoncer(null);
    this.majFenetre();
    this.surMesureChange?.();
  }

  /** Rafraîchit le rendu de la mesure courante (ex: après changement du réglage ΔXYZ). */
  rafraichir(){
    if(!this.actif) return;
    if(this.points.length === 2){
      this.poserPoints();
      this.vue.invalider();
    }else if(this.dernierResultat){
      this.poserResultat(this.dernierResultat);
      this.vue.invalider();
    }
  }

  /**
   * Refait la mesure depuis les éléments retenus : les textes des résultats
   * sont figés au calcul, un changement de précision doit donc repasser par là.
   */
  remesurer(){
    if(!this.actif) return;
    if(this.entites.length === 2){
      this.poserResultat(mesurerEntites(this.entites[0], this.entites[1]));
    }else if(this.entites.length === 1){
      const r = mesurerEntiteSeule(this.entites[0]);
      if(r) this.poserResultat(r);
    }else if(this.points.length === 2){
      this.poserPoints();
    }
    this.vue.invalider();
  }

  annoncer(texte){
    const e = this.el.etat;
    if(!e) return;
    e.hidden = !texte;
    e.textContent = texte || "";
  }

  /* ==========================================================================
     Surlignage de ce qui est désigné
     ========================================================================== */

  /**
   * Un objet d'affichage pour une arête ou une face, aux couleurs voulues.
   *
   * Une face reçoit deux objets : la nappe teintée, et le trait de son
   * contour. La teinte seule ne suffit pas — sur une pièce claire ou vive,
   * elle se confond avec la couleur d'origine et l'on ne sait plus quelle face
   * on a désignée. Le contour, lui, se lit sur n'importe quel fond.
   */
  fabriquerSurlignage(entite, couleur, retenu){
    const coupe = this.vue.plansCoupe.length ? this.vue.plansCoupe : null;

    if(entite.genre === "arete"){
      const l = new THREE.Line(geometrieArete(entite), new THREE.LineBasicMaterial({
        color:couleur, depthTest:false, transparent:true, opacity:retenu ? 1 : 0.85,
        clippingPlanes:coupe,
      }));
      l.renderOrder = 8;
      this.surlignages.add(l);
      return l;
    }

    const g = new THREE.Group();
    const nappe = new THREE.Mesh(geometrieFace(entite), new THREE.MeshBasicMaterial({
      color:couleur, transparent:true, opacity:retenu ? 0.45 : 0.25,
      side:THREE.DoubleSide, depthWrite:false, clippingPlanes:coupe,
      /* La nappe est posée exactement sur la peau de la pièce : sans ce
         décalage vers l'œil, elle clignoterait avec elle. */
      polygonOffset:true, polygonOffsetFactor:-3, polygonOffsetUnits:-3,
    }));
    nappe.renderOrder = 4;
    const trait = new THREE.LineSegments(contourFace(entite), new THREE.LineBasicMaterial({
      color:couleur, depthTest:false, transparent:true, opacity:retenu ? 1 : 0.8,
      clippingPlanes:coupe,
    }));
    trait.renderOrder = 8;
    g.add(nappe, trait);
    this.surlignages.add(g);
    return g;
  }

  jeter(objet){
    if(!objet) return;
    this.surlignages.remove(objet);
    objet.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
  }

  viderSurlignages(){
    for(let i = 0; i < 2; i++){ this.jeter(this.retenus[i]); this.retenus[i] = null; }
    this.jeter(this.survole); this.survole = null;
    this.cleSurvol = null;
  }

  retenir(entite, rang){
    this.jeter(this.retenus[rang]);
    this.retenus[rang] = this.fabriquerSurlignage(entite, JAUNE, true);
  }

  /* ==========================================================================
     Désignation
     ========================================================================== */

  /**
   * Analyser une pièce coûte le temps d'un parcours complet de ses triangles.
   * Sur un survol, ce serait un à-coup à chaque passage de la souris : on ne
   * le fait donc qu'au clic, et le survol se contente des pièces déjà connues.
   */
  topoPrete(maillage){
    return maillage?.geometry?.userData?.topo !== undefined;
  }

  /**
   * L'arête ou la face visée, selon le mode. `this.raison` porte, en cas
   * d'échec, ce qu'il faut en dire à l'utilisateur.
   */
  entiteSous(ev, { analyse = true } = {}){
    this.raison = null;
    const touches = this.vue.lancerRayon(ev);
    if(!touches.length){ this.raison = "Visez une pièce."; return null; }
    const t = touches[0];

    const nbTri = t.object.userData?.triangles || 0;
    const autoPret = analyse || (this.mode === "auto" && nbTri <= 100_000);

    if(!this.topoPrete(t.object)){
      if(!autoPret){
        this.raison = `Cliquez pour analyser « ${t.object.name || "cette pièce"} » ` +
                      `(${nombre(nbTri)} triangles).`;
        return null;
      }
      if(!analyser(t.object)){
        this.raison = `« ${t.object.name || "Cette pièce" } » est trop lourde pour l'analyse ` +
                      `(${nombre(nbTri)} triangles, plafond ` +
                      `${nombre(PLAFOND_TRIANGLES)}). Mesurez-la point à point.`;
        return null;
      }
    }else if(!analyser(t.object)){
      this.raison = "Pièce trop lourde pour l'analyse : mesurez-la point à point.";
      return null;
    }

    if(this.mode === "auto"){
      const a = areteSous(this.vue, t, SEUIL_ARETE);
      if(a) return a;
      const f = faceSous(this.vue, t);
      if(f) return f;
      this.raison = "Aucun élément reconnu à cet endroit.";
      return null;
    }

    const e = this.mode === "arete" ? areteSous(this.vue, t, SEUIL_ARETE) : faceSous(this.vue, t);
    if(!e) this.raison = this.mode === "arete"
      ? "Aucune arête à portée : approchez le curseur d'un bord."
      : "Aucune face reconnue à cet endroit.";
    return e;
  }

  /* ==========================================================================
     Accrochage sur les sommets — mode point
     ========================================================================== */

  /**
   * Le point retenu pour un évènement, et ce sur quoi il s'est accroché :
   *
   *  1. un point remarquable à moins de SEUIL_ACCROCHE pixels et visible —
   *     sommet, milieu d'arête, centre de cercle ou d'arc, centre de la face
   *     plane survolée. Le plus proche du curseur l'emporte. Les centres
   *     restent accrochables le curseur dans le trou, là où le rayon ne
   *     touche plus la pièce : on garde la dernière pièce survolée ;
   *  2. sinon, le point de l'arête la plus proche, si elle est à portée ;
   *  3. sinon, le point d'impact sur la surface.
   *
   * Maj enfoncée, pas d'accroche : le point est posé où le rayon touche.
   * Sans topologie (pièce trop lourde), on retombe sur l'ancien comportement,
   * le sommet du triangle touché.
   *
   * `montrer` reçoit les points d'accroche à dessiner autour du curseur.
   */
  pointVise(ev, { analyse = true } = {}){
    const touches = this.vue.lancerRayon(ev);
    const ray = this.vue._rc.ray.clone();
    const t = touches[0] || null;
    if(ev.shiftKey){
      this.accrocheMontree = [];
      return t ? { point:t.point.clone(), type:"libre", maillage:t.object } : null;
    }

    const m = t?.object || this.maillageSurvole;
    if(t) this.maillageSurvole = t.object;
    const nbTri = m?.userData?.triangles || 0;
    const topoPossible = m && (this.topoPrete(m) || analyse || nbTri <= PLAFOND_ANALYSE_SURVOL);
    const accroches = topoPossible ? pointsAccroche(m) : null;
    if(!accroches){
      this.accrocheMontree = [];
      return t ? this.sommetDuTriangle(t) : null;
    }

    const rect = this.vue.canvas.getBoundingClientRect();
    const cx = ev.clientX - rect.left, cy = ev.clientY - rect.top;
    const arete = t ? areteSous(this.vue, t, SEUIL_ARETE) : null;
    const face = t ? faceSous(this.vue, t) : null;
    const centreFace = face?.type === "plan" ? centreDeFace(face) : null;

    /* Ce qu'on montre : les points de l'arête sous le curseur, sinon ceux des
       arêtes de la face survolée, et le centre de cette face. */
    const na = numeroArete(arete);
    this.accrocheMontree = accroches.filter(a => na >= 0 ? a.aretes.includes(na) : false).map(a => a.p);
    if(centreFace) this.accrocheMontree.push(centreFace);

    // 1. Les points remarquables, du plus proche au plus lointain à l'écran
    const candidats = [];
    const pousser = (p, type) => {
      const e = this.vue.versEcran(p);
      if(e.z >= 1) return;
      const d = Math.hypot(e.x - cx, e.y - cy);
      if(d <= SEUIL_ACCROCHE) candidats.push({ p, type, d, e });
    };
    for(const a of accroches) pousser(a.p, a.type);
    if(centreFace) pousser(centreFace, "centreFace");
    /* À égalité à l'écran (le haut et le bas d'un trou vus dans l'axe), le
       plus proche de l'œil passe devant. */
    candidats.sort((x, y) => Math.abs(x.d - y.d) > 1.5 ? x.d - y.d : x.e.z - y.e.z);
    for(const c of candidats.slice(0, 6)){
      if(this.estVisible(c.p, c.e, rect)) return { point:c.p.clone(), type:c.type, maillage:m };
    }

    // 2. Sur l'arête
    if(arete) return { point:pointSurArete(arete, ray), type:"arete", maillage:m };

    // 3. Sur la surface
    return t ? { point:t.point.clone(), type:"surface", maillage:t.object } : null;
  }

  /**
   * Un point est visible si rien ne se trouve entre l'œil et lui : un sommet
   * au dos de la pièce se projette peut-être sous le curseur, il ne doit pas
   * pour autant l'attraper. Le centre d'un trou traversant, lui, ne rencontre
   * rien ou le fond : il reste visible.
   */
  estVisible(p, ecran, rect){
    const touches = this.vue.lancerRayon({ clientX:rect.left + ecran.x, clientY:rect.top + ecran.y });
    if(!touches.length) return true;
    const dist = this.vue._rc.ray.origin.distanceTo(p);
    const marge = Math.max(tailleParPixel(this.vue, p) * 2, (this.vue.rayonModele || 1) * 1e-5);
    return touches[0].distance >= dist - marge;
  }

  /** L'accroche d'avant la topologie : le sommet du triangle touché, s'il est à portée. */
  sommetDuTriangle(t){
    const impact = t.point.clone();
    if(!t.face) return { point:impact, type:"surface", maillage:t.object };
    const pos = t.object.geometry.attributes.position;
    const ecran = this.vue.versEcran(impact);
    let meilleur = null, distMin = SEUIL_ACCROCHE;
    for(const i of [t.face.a, t.face.b, t.face.c]){
      const sommet = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(t.object.matrixWorld);
      const s = this.vue.versEcran(sommet);
      const d = Math.hypot(s.x - ecran.x, s.y - ecran.y);
      if(d < distMin){ distMin = d; meilleur = sommet; }
    }
    return meilleur ? { point:meilleur, type:"sommetMaillage", maillage:t.object }
                    : { point:impact, type:"surface", maillage:t.object };
  }

  /** Les points d'accroche proposés et l'étiquette du curseur, redessinés à chaque rendu. */
  dessinerAccroche(){
    if(!this.actif || this.mode !== "point" || !this.accrocheMontree.length){
      if(this.calqueAccroche.childElementCount) this.calqueAccroche.replaceChildren();
    }else{
      const ns = "http://www.w3.org/2000/svg";
      this.calqueAccroche.replaceChildren(...this.accrocheMontree.map(p => {
        const e = this.vue.versEcran(p);
        const r = document.createElementNS(ns, "rect");
        r.setAttribute("x", (e.x - 3.5).toFixed(1));
        r.setAttribute("y", (e.y - 3.5).toFixed(1));
        r.setAttribute("width", "7");
        r.setAttribute("height", "7");
        return r;
      }));
    }
    if(this.apercu.visible && this.typeApercu){
      const e = this.vue.versEcran(this.apercu.position);
      this.infoAccroche.textContent = NOMS_ACCROCHE[this.typeApercu] || "";
      this.infoAccroche.style.left = `${e.x + 14}px`;
      this.infoAccroche.style.top = `${e.y + 14}px`;
      this.infoAccroche.dataset.type = this.typeApercu;
      this.infoAccroche.hidden = false;
    }else{
      this.infoAccroche.hidden = true;
    }
  }

  masquerAccroche(){
    this.accrocheMontree = [];
    this.typeApercu = null;
    if(this.apercu) this.apercu.visible = false;
    if(this.calqueAccroche) this.calqueAccroche.replaceChildren();
    if(this.infoAccroche) this.infoAccroche.hidden = true;
  }

  /* ==========================================================================
     Survol
     ========================================================================== */
  survoler(ev){
    if(!this.actif) return;
    if(this.mode === "point") return this.survolerPoint(ev);
    /* Mesure terminée : le résultat reste à l'écran jusqu'au clic suivant.
       Le survol ne doit pas l'effacer sous prétexte qu'on a bougé la souris. */
    if(this.entites.length >= 2) return;

    const e = this.entiteSous(ev, { analyse:false });
    const cle = e ? e.cle : null;
    if(cle === this.cleSurvol){
      if(!e && this.raison && !this.entites.length) this.annoncer(this.raison);
      return;
    }
    this.cleSurvol = cle;
    this.jeter(this.survole);
    this.survole = null;

    if(e && !this.entites.some(x => x.cle === e.cle)){
      this.survole = this.fabriquerSurlignage(e, CYAN, false);
      this.annoncer(this.messageEnCours(resumer(e)));
    }else if(!e){
      this.annoncer(this.messageEnCours(this.raison));
    }
    this.vue.invalider();
  }

  /** Ce qu'affiche la barre d'état pendant qu'on choisit : la consigne, et ce
      que le curseur propose à l'instant. */
  messageEnCours(complement){
    const attendu = this.mode === "auto" ? "élément" : (this.mode === "arete" ? "arête" : "face");
    const base = this.entites.length === 1
      ? `Premier ${attendu} : ${resumer(this.entites[0])}  ·  choisissez le second`
      : MODES[this.mode].aide.replace(/\.$/, "");
    return complement ? `${base}  ▸  ${complement}` : base + ".";
  }

  survolerPoint(ev){
    const vise = this.pointVise(ev, { analyse:false });
    const r = this.apercu;
    if(!vise){
      this.typeApercu = null;
      if(r.visible || this.accrocheMontree.length){ r.visible = false; this.vue.invalider(); }
      return;
    }
    const accroche = !["surface", "libre"].includes(vise.type);
    r.position.copy(vise.point);
    r.scale.setScalar(this.tailleRepere() * (accroche ? 1.4 : 0.9));
    r.material.color.setHex(accroche ? CYAN : 0xffffff);
    r.visible = true;
    this.typeApercu = vise.type;
    if(this.points.length === 1) this.tracer(this.points[0], vise.point, true);
    this.vue.invalider();
  }

  /* ==========================================================================
     Clic
     ========================================================================== */
  cliquer(ev){
    if(!this.actif) return false;
    return this.mode === "point" ? this.cliquerPoint(ev) : this.cliquerEntite(ev);
  }

  cliquerPoint(ev){
    const vise = this.pointVise(ev);
    if(!vise){ this.annoncer("Cliquez sur une pièce : le point doit être posé sur une surface."); return true; }

    if(this.points.length >= 2) this.annuler();
    this.points.push(vise.point.clone());
    this.pointsMaillages.push(vise.maillage || null);
    this.pointsTypes.push(vise.type);
    const r = this.reperes[this.points.length - 1];
    r.position.copy(vise.point);
    r.scale.setScalar(this.tailleRepere());
    r.visible = true;

    if(this.points.length === 1){
      this.annoncer("Second point…");
      this.majFenetre();
    }else{
      this.poserPoints();
    }
    this.vue.invalider();
    return true;
  }

  cliquerEntite(ev){
    if(this.entites.length >= 2) this.annuler();

    const e = this.entiteSous(ev);
    if(!e){ this.annoncer(this.messageEnCours(this.raison)); this.vue.invalider(); return true; }

    /* Mesurer une entité avec elle-même ne donnerait que zéro : on garde la
       première et on attend la seconde plutôt que d'afficher un résultat vide. */
    if(this.entites.length === 1 && this.entites[0].cle === e.cle){
      this.annoncer(this.messageEnCours(`déjà retenu — choisissez-en un autre`));
      return true;
    }

    this.jeter(this.survole); this.survole = null; this.cleSurvol = null;
    this.entites.push(e);
    this.retenir(e, this.entites.length - 1);

    if(this.entites.length === 1){
      const r = mesurerEntiteSeule(e);
      if(r){
        this.poserResultat(r);
      }else{
        this.annoncer(this.messageEnCours(null));
        this.majFenetre();
      }
    }else{
      const r = mesurerEntites(this.entites[0], this.entites[1]);
      this.poserResultat(r);
    }
    this.vue.invalider();
    return true;
  }

  rayonDepuisEvenement(ev){
    if(!this._raycaster) this._raycaster = new THREE.Raycaster();
    this._raycaster.setFromCamera(this.vue.ndc(ev), this.vue.camera());
    return this._raycaster.ray;
  }

  /** Trace la cote entre les deux points retenus par la mesure, et l'annonce. */
  poserResultat(r){
    this.dernierResultat = r;
    this.poserConstruction(r.construction);
    const ecart = (r.p1 && r.p2) ? r.p1.distanceTo(r.p2) : 0;
    if(this.modeDelta !== "off" && ecart > 1e-4){
      this.afficherMesureDelta(r.p1, r.p2, r.etiquette, r);
    }else{
      this.annulerDelta();
      this.actualiserRenduMesure(r);
      this.poserEtiquette(r.ancre || r.p1.clone().lerp(r.p2, 0.5), r.etiquette, r);
    }
    this.annoncer(this.entites.length === 1 ? this.messageEnCours(null) : null);
    this.majFenetre();
    this.surMesureChange?.();
  }

  /* ==========================================================================
     Fenêtre des résultats
     ========================================================================== */
  majFenetre(){
    if(!this.actif || (!this.points.length && !this.entites.length)) return this.fenetre.masquer();
    const sections = [];
    let titre = MODES[this.mode].nom;
    let p1 = null, p2 = null, lignes = null;

    if(this.points.length === 2){
      [p1, p2] = this.points;
      titre = "Point à point";
      lignes = [["Distance", mm(p1.distanceTo(p2))]];
    }else if(this.dernierResultat && this.entites.length === 2){
      const r = this.dernierResultat;
      titre = r.fiche?.nature || titre;
      lignes = [...(r.fiche?.lignes || [])];
      if(r.extensible){
        const pos = { min:"Min", max:"Max", libre:"Libre (glissée)" }[r.positionActuelle];
        if(pos) lignes.push(["Position", pos]);
      }
      p1 = r.p1; p2 = r.p2;
    }

    if(lignes){
      if(p1 && p2 && this.modeDelta !== "off" && p1.distanceTo(p2) > 1e-9){
        const rep = this.obtenirRepereActif();
        const e = this.ecarts(p1, p2, rep);
        lignes.push(["ΔX", mm(e.x), "fm-dx"], ["ΔY", mm(e.y), "fm-dy"], ["ΔZ", mm(e.z), "fm-dz"],
                    ["Repère", rep.mode === "piece" ? `Sél. ${rep.depuis} « ${rep.nom} »` : "Global"]);
      }
      if(lignes.length) sections.push({ titre:"Résultats", lignes });
    }

    const selections = this.points.length
      ? this.points.map((p, i) => this.decrirePoint(p, this.pointsMaillages[i], this.pointsTypes[i]))
      : this.entites.map(e => this.decrireEntite(e));
    selections.forEach((d, i) => sections.push({ titre:`Sélection ${i + 1}`, ...d }));
    /* Un seul élément retenu : ses propriétés sont le résultat, comme dans Fusion. */
    if(!lignes && selections.length === 1) titre = selections[0].sousTitre;
    this.fenetre.afficher({ titre, sections });
  }

  decrirePoint(p, maillage, type){
    return {
      sousTitre:NOMS_ACCROCHE[type] || "Point",
      lignes:[["Position X", mm(p.x)], ["Position Y", mm(p.y)], ["Position Z", mm(p.z)],
              ...(maillage?.name ? [["Pièce", maillage.name]] : [])],
    };
  }

  decrireEntite(e){
    const l = [];
    const centre = (c, nom = "Centre") => l.push([`${nom} X`, mm(c.x)], [`${nom} Y`, mm(c.y)], [`${nom} Z`, mm(c.z)]);
    const dir = (v) => `${cote(v.x)} ; ${cote(v.y)} ; ${cote(v.z)}`;
    let sousTitre;
    if(e.genre === "arete"){
      if(e.type === "droite"){
        sousTitre = "Arête droite";
        l.push(["Longueur", mm(e.longueur)], ["Direction", dir(e.dir)]);
      }else if(e.type === "cercle"){
        sousTitre = e.ferme ? "Cercle" : "Arc de cercle";
        l.push(["Longueur", mm(e.longueur)], ["Rayon", mm(e.rayon)], ["Diamètre", mm(2 * e.rayon)]);
        if(!e.ferme) l.push(["Angle", degres(e.balaye)]);
        centre(e.centre);
      }else{
        sousTitre = "Arête";
        l.push(["Longueur", mm(e.longueur)]);
      }
    }else{
      if(e.type === "plan"){
        sousTitre = "Face plane";
        l.push(["Aire", `${cote(e.aire)} mm²`], ["Normale", dir(e.normale)]);
      }else if(e.type === "cylindre"){
        sousTitre = e.ferme === false ? "Face cylindrique (congé)" : "Face cylindrique";
        l.push(["Rayon", mm(e.rayon)], ["Diamètre", mm(2 * e.rayon)], ["Hauteur", mm(e.hauteur)],
               ["Axe", dir(e.axe)]);
        centre(e.centre);
      }else{
        sousTitre = "Face";
        l.push(["Aire", `${cote(e.aire)} mm²`]);
      }
    }
    if(e.maillage?.name) l.push(["Pièce", e.maillage.name]);
    return { sousTitre, lignes:l };
  }

  /**
   * Prolongements en tirets fins, arc dans la couleur des cotes, et l'angle
   * en étiquette au milieu de l'arc. `null` efface le tracé précédent.
   */
  poserConstruction(c){
    for(const o of [...this.construction.children]){
      this.construction.remove(o);
      o.geometry.dispose(); o.material.dispose();
    }
    for(const e of this.etiquettesConstruction) e.remove();
    this.etiquettesConstruction = [];
    if(!c) return;

    const tiret = (this.vue.rayonModele || 1) * 0.012;
    for(const [a, b] of c.prolongements){
      const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]),
        new THREE.LineDashedMaterial({ color:0xa8b0ba, dashSize:tiret, gapSize:tiret * 0.7,
                                       depthTest:false, transparent:true, opacity:0.9 }));
      l.computeLineDistances();
      l.renderOrder = 6;
      this.construction.add(l);
    }
    const arc = new THREE.Line(new THREE.BufferGeometry().setFromPoints(c.arc),
      new THREE.LineBasicMaterial({ color:JAUNE, depthTest:false, transparent:true }));
    arc.renderOrder = 6;
    this.construction.add(arc);

    if(c.etiquette){
      const et = document.createElement("div");
      et.className = "cote cote-angle";
      et.textContent = c.etiquette;
      et.title = "Angle entre les arêtes, lu au croisement de leurs prolongements";
      et.__ancre = c.ancre;
      this.el.conteneur.appendChild(et);
      this.etiquettesConstruction.push(et);
    }
    this.replacerEtiquettes();
  }

  tracerSegment(ligne, a, b){
    const p = ligne.geometry.attributes.position;
    p.setXYZ(0, a.x, a.y, a.z);
    p.setXYZ(1, b.x, b.y, b.z);
    p.needsUpdate = true;
    ligne.geometry.computeBoundingSphere();
    ligne.visible = true;
  }

  afficherMesureDelta(p1, p2, distTexte, r = null){
    for(const e of this.etiquettes) e.remove();
    this.etiquettes = [];
    if(this.etiquettesDelta){
      for(const e of this.etiquettesDelta) e.remove();
    }
    this.etiquettesDelta = [];

    this.ligne.visible = false;
    for(const m of this.reperes) m.visible = false;

    const rep = this.obtenirRepereActif();
    const e = this.ecarts(p1, p2, rep);
    const dist = p1.distanceTo(p2);
    const presents = [Math.abs(e.x) > 1e-4, Math.abs(e.y) > 1e-4, Math.abs(e.z) > 1e-4];
    const [aX, aY, aZ] = presents;

    /* L'escalier X → Y → Z part du point de référence : de P1 vers P2 en
       repère global ou sélection 1, de P2 vers P1 en sélection 2, comme dans
       Fusion 360. Les valeurs, elles, restent comptées de P1 vers P2. */
    const depuisP2 = rep.depuis === 2;
    const sens = depuisP2 ? -1 : 1;
    const coins = [depuisP2 ? p2.clone() : p1.clone()];
    [[rep.uX, e.x], [rep.uY, e.y], [rep.uZ, e.z]].forEach(([u, v], i) => {
      coins.push(coins[i].clone().addScaledVector(u, sens * v));
    });

    // 1. Tracer les segments 3D
    this.tracerSegment(this.ligneDist, p1, p2);
    [this.ligneX, this.ligneY, this.ligneZ].forEach((ligne, i) => {
      if(presents[i]) this.tracerSegment(ligne, coins[i], coins[i + 1]);
      else ligne.visible = false;
    });

    // 2. Repères : P1 en rouge, les deux coins de l'escalier, P2 en bleu
    const taille = this.tailleRepere();
    const places = [
      [p1, taille, true],
      [coins[1], taille * 0.85, aX && (aY || aZ)],
      [coins[2], taille * 0.85, aY && aZ],
      [p2, taille, true],
    ];
    places.forEach(([pos, t, vis], i) => {
      const m = this.reperesDelta[i];
      m.position.copy(pos);
      m.scale.setScalar(t);
      m.visible = vis;
    });

    // 3. Définition des composantes
    const valDist = (distTexte && !r?.extensible) ? distTexte : mm(dist);
    const badgeDist = rep.mode === "piece" ? `Dist (sél. ${rep.depuis}):` : "Dist:";
    const titreDist = rep.mode === "piece"
      ? `Repère de la pièce de la sélection ${rep.depuis} : « ${rep.nom} »`
      : "Repère global du projet";
    const milieu = (i) => coins[i].clone().lerp(coins[i + 1], 0.5);

    const composantes = [
      { cle:"dist", badge:badgeDist, valeur:valDist, ancre:p1.clone().lerp(p2, 0.5), defautOffset:{ x:50, y:25 }, visible:true, titre:titreDist },
      { cle:"dx", badge:"dX:", valeur:mm(e.x), ancre:milieu(0), defautOffset:{ x:-20, y:-45 }, visible:aX },
      { cle:"dy", badge:"dY:", valeur:mm(e.y), ancre:milieu(1), defautOffset:{ x:-95, y:-15 }, visible:aY },
      { cle:"dz", badge:"dZ:", valeur:mm(e.z), ancre:milieu(2), defautOffset:{ x:-95, y:25 }, visible:aZ },
    ];

    for(const c of composantes){
      if(!c.visible) continue;
      const et = document.createElement("div");
      et.className = `cote-cad cote-cad-${c.cle}`;
      if(c.titre) et.title = c.titre;

      const spBadge = document.createElement("span");
      spBadge.className = "cote-cad-badge";
      spBadge.textContent = c.badge;
      et.appendChild(spBadge);

      const spVal = document.createElement("span");
      spVal.className = "cote-cad-valeur";
      spVal.textContent = c.valeur;
      et.appendChild(spVal);
      et._spVal = spVal;

      if(c.cle === "dist" && r && r.extensible){
        const actions = document.createElement("span");
        actions.className = "cote-actions";

        const bMin = document.createElement("button");
        bMin.type = "button";
        bMin.className = "cote-btn cote-min" + (r.positionActuelle === "min" ? " actif" : "");
        bMin.textContent = "Min";
        bMin.title = `Plus courte distance (${cote(r.min.d)} mm)`;
        bMin.onpointerdown = (e) => e.stopPropagation();
        bMin.onclick = (e) => {
          e.stopPropagation();
          this.appliquerPositionCote(r, "min");
        };
        actions.appendChild(bMin);

        const bMax = document.createElement("button");
        bMax.type = "button";
        bMax.className = "cote-btn cote-max" + (r.positionActuelle === "max" ? " actif" : "");
        bMax.textContent = "Max";
        bMax.title = `Plus longue distance (${cote(r.max.d)} mm)`;
        bMax.onpointerdown = (e) => e.stopPropagation();
        bMax.onclick = (e) => {
          e.stopPropagation();
          this.appliquerPositionCote(r, "max");
        };
        actions.appendChild(bMax);

        et.appendChild(actions);
      }

      this.activerGlissementEtiquetteCAD(et, c);
      this.el.conteneur.appendChild(et);
      this.etiquettesDelta.push(et);
      c.el = et;
    }

    this.donneesDelta = { p1, p2, distTexte, r, composantes };
    this.replacerEtiquettes();
  }

  activerGlissementEtiquetteCAD(et, comp){
    et.__offset = { ...comp.defautOffset };
    let startPointer = null;
    let startOffset = null;

    const surBouge = (ev) => {
      if(!startPointer) return;
      ev.preventDefault();
      ev.stopPropagation();
      const dx = ev.clientX - startPointer.x;
      const dy = ev.clientY - startPointer.y;
      et.__offset.x = startOffset.x + dx;
      et.__offset.y = startOffset.y + dy;
      this.replacerEtiquettes();
      this.vue.invalider();
    };

    const surHaut = (ev) => {
      if(!startPointer) return;
      startPointer = null;
      startOffset = null;
      et.classList.remove("glissement");
      try { et.releasePointerCapture(ev.pointerId); } catch(err) {}
      window.removeEventListener("pointermove", surBouge, { capture:true });
      window.removeEventListener("pointerup", surHaut, { capture:true });
      window.removeEventListener("pointercancel", surHaut, { capture:true });
      this.vue.invalider();
    };

    et.addEventListener("pointerdown", (ev) => {
      if(ev.target.closest("button")) return;
      ev.preventDefault();
      ev.stopPropagation();
      startPointer = { x:ev.clientX, y:ev.clientY };
      startOffset = { x:et.__offset.x, y:et.__offset.y };
      et.classList.add("glissement");
      try { et.setPointerCapture(ev.pointerId); } catch(err) {}
      window.addEventListener("pointermove", surBouge, { capture:true });
      window.addEventListener("pointerup", surHaut, { capture:true });
      window.addEventListener("pointercancel", surHaut, { capture:true });
    });

    et.addEventListener("dblclick", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      et.__offset = { ...comp.defautOffset };
      this.replacerEtiquettes();
      this.vue.invalider();
    });
  }

  actualiserRenduMesure(r){
    const ecart = r.p1.distanceTo(r.p2);
    if(ecart > 1e-9){
      this.tracer(r.p1, r.p2, false);
      for(let i = 0; i < 2; i++){
        const rep = this.reperes[i];
        rep.position.copy(i ? r.p2 : r.p1);
        rep.scale.setScalar(this.tailleRepere());
        rep.visible = true;
      }
    }else{
      /* Deux arêtes sécantes : il n'y a pas de segment à tracer, seulement le
         point de croisement et l'angle. */
      this.ligne.visible = false;
      this.reperes[0].position.copy(r.p1);
      this.reperes[0].scale.setScalar(this.tailleRepere());
      this.reperes[0].visible = true;
      this.reperes[1].visible = false;
    }
  }

  appliquerPositionCote(r, mode){
    const source = mode === "min" ? r.min : r.max;
    if(!source) return;
    /* Des copies, jamais les vecteurs de `source` : r.p1 et r.min.p1 sont
       souvent le même objet au sortir du calcul, et le glissement écrit dans
       r.p1 — la position Min finissait par pointer sur la dernière cote vue. */
    r.p1 = source.p1.clone();
    r.p2 = source.p2.clone();
    r.etiquette = source.etiquette;
    r.fiche = source.fiche;
    r.positionActuelle = mode;
    this.poserResultat(r);
    this.vue.invalider();
  }

  activerGlissementEtiquette(et, r){
    let enGlisse = false;

    const surBouge = (ev) => {
      if(!enGlisse) return;
      ev.preventDefault();
      ev.stopPropagation();

      const ray = this.rayonDepuisEvenement(ev);
      if(!ray || !r.glisser) return;

      const g = r.glisser(ray);
      if(g){
        r.p1 = g.p1.clone();
        r.p2 = g.p2.clone();
        r.etiquette = g.etiquette;
        r.fiche = g.fiche;
        r.positionActuelle = "libre";

        this.actualiserRenduMesure(r);
        const ancre = r.p1.clone().lerp(r.p2, 0.5);
        et.__ancre = ancre;
        if(et._spTexte) et._spTexte.textContent = r.etiquette;
        const bMin = et.querySelector(".cote-min");
        const bMax = et.querySelector(".cote-max");
        if(bMin) bMin.classList.remove("actif");
        if(bMax) bMax.classList.remove("actif");
        this.replacerEtiquettes();
        this.majFenetre();
        this.vue.invalider();
      }
    };

    const surHaut = (ev) => {
      if(!enGlisse) return;
      enGlisse = false;
      et.classList.remove("glissement");
      try { et.releasePointerCapture(ev.pointerId); } catch(err) {}
      window.removeEventListener("pointermove", surBouge, { capture:true });
      window.removeEventListener("pointerup", surHaut, { capture:true });
      window.removeEventListener("pointercancel", surHaut, { capture:true });
      this.vue.invalider();
    };

    et.addEventListener("pointerdown", (ev) => {
      if(ev.target.closest("button")) return;
      ev.preventDefault();
      ev.stopPropagation();
      enGlisse = true;
      et.classList.add("glissement");
      try { et.setPointerCapture(ev.pointerId); } catch(err) {}
      window.addEventListener("pointermove", surBouge, { capture:true });
      window.addEventListener("pointerup", surHaut, { capture:true });
      window.addEventListener("pointercancel", surHaut, { capture:true });
    });
  }

  tracer(a, b, provisoire){
    const p = this.ligne.geometry.attributes.position;
    p.setXYZ(0, a.x, a.y, a.z);
    p.setXYZ(1, b.x, b.y, b.z);
    p.needsUpdate = true;
    this.ligne.geometry.computeBoundingSphere();
    this.ligne.material.opacity = provisoire ? 0.5 : 1;
    this.ligne.visible = true;
  }

  poserEtiquette(ancre, texte, r = null){
    for(const e of this.etiquettes) e.remove();
    const et = document.createElement("div");
    et.className = "cote";
    et.__ancre = ancre;

    if(r && r.extensible){
      const spTexte = document.createElement("span");
      spTexte.className = "cote-texte";
      spTexte.textContent = texte;
      et.appendChild(spTexte);
      et._spTexte = spTexte;

      const actions = document.createElement("span");
      actions.className = "cote-actions";

      // Bouton Min
      const bMin = document.createElement("button");
      bMin.type = "button";
      bMin.className = "cote-btn cote-min" + (r.positionActuelle === "min" ? " actif" : "");
      bMin.textContent = "Min";
      bMin.title = `Plus courte distance (${cote(r.min.d)} mm)`;
      bMin.onpointerdown = (e) => e.stopPropagation();
      bMin.onclick = (e) => {
        e.stopPropagation();
        this.appliquerPositionCote(r, "min");
      };
      actions.appendChild(bMin);

      // Bouton Max
      const bMax = document.createElement("button");
      bMax.type = "button";
      bMax.className = "cote-btn cote-max" + (r.positionActuelle === "max" ? " actif" : "");
      bMax.textContent = "Max";
      bMax.title = `Plus longue distance (${cote(r.max.d)} mm)`;
      bMax.onpointerdown = (e) => e.stopPropagation();
      bMax.onclick = (e) => {
        e.stopPropagation();
        this.appliquerPositionCote(r, "max");
      };
      actions.appendChild(bMax);

      // Poignée de glissement
      const poignee = document.createElement("span");
      poignee.className = "cote-poignee";
      poignee.textContent = "⇹";
      poignee.title = "Maintenir le clic et glisser le long de la zone";
      actions.appendChild(poignee);

      et.appendChild(actions);

      // Brancher le glisser-déposer
      this.activerGlissementEtiquette(et, r);
    }else{
      et.textContent = texte;
    }

    this.el.conteneur.appendChild(et);
    this.etiquettes = [et];
    this.replacerEtiquettes();
  }

  replacerEtiquettes(){
    for(const et of this.etiquettesConstruction){
      const p = this.vue.versEcran(et.__ancre);
      et.style.display = p.z < 1 ? "" : "none";
      et.style.left = p.x + "px";
      et.style.top = p.y + "px";
    }
    if(this.donneesDelta){
      let svgContent = "";
      const s = this.tailleRepere();
      if(this.reperesDelta){
        for(const m of this.reperesDelta){
          if(m.visible) m.scale.setScalar(s);
        }
      }

      for(const c of this.donneesDelta.composantes){
        if(!c.visible || !c.el) continue;
        const p = this.vue.versEcran(c.ancre);
        if(p.z >= 1){
          c.el.style.display = "none";
          continue;
        }
        c.el.style.display = "";
        const lx = p.x + (c.el.__offset?.x ?? c.defautOffset.x);
        const ly = p.y + (c.el.__offset?.y ?? c.defautOffset.y);
        c.el.style.left = `${lx}px`;
        c.el.style.top = `${ly}px`;

        const w = c.el.offsetWidth || 70;
        const h = c.el.offsetHeight || 22;
        const bx = Math.max(lx - w / 2, Math.min(lx + w / 2, p.x));
        const by = Math.max(ly - h / 2, Math.min(ly + h / 2, p.y));

        svgContent += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.5" />`;
        svgContent += `<line x1="${p.x.toFixed(1)}" y1="${p.y.toFixed(1)}" x2="${bx.toFixed(1)}" y2="${by.toFixed(1)}" />`;
      }

      if(this.calqueSvg) this.calqueSvg.innerHTML = svgContent;
      return;
    }

    if(this.calqueSvg) this.calqueSvg.innerHTML = "";
    for(const et of this.etiquettes){
      const p = this.vue.versEcran(et.__ancre);
      /* Derrière la caméra, la projection se retourne : mieux vaut cacher
         l'étiquette que l'afficher à un endroit qui ne veut rien dire. */
      et.style.display = p.z < 1 ? "" : "none";
      et.style.left = p.x + "px";
      et.style.top = (p.y - 14) + "px";
    }
  }
}
