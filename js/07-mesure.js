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

   Le travail de reconnaissance est dans 06-topologie.js ; ce fichier-ci ne
   fait que désigner, surligner, et poser la cote à l'écran.

   L'étiquette est un élément HTML posé au-dessus du canevas plutôt qu'un objet
   3D : le texte reste net à toute échelle et suit la feuille de style du reste
   de l'interface.
   ============================================================================= */
"use strict";

import * as THREE from "three";
import { prefs } from "./00-config.js";
import { analyser, areteSous, faceSous, geometrieArete, geometrieFace, contourFace,
         mesurerAretes, mesurerFaces, mesurerEntites, mesurerEntiteSeule, resumer, cote,
         PLAFOND_TRIANGLES, nombre, repereDePiece } from "./06-topologie.js";

export function formaterCoteCAD(v){
  if(Math.abs(v) < 1e-6) return "0mm";
  const r = Math.round(v * 1000) / 1000;
  return `${r}mm`;
}

const SEUIL_ACCROCHE = 14;      // pixels
const SEUIL_ARETE = 16;         // pixels
const JAUNE = 0xf2c744;
const CYAN = 0x8af0ff;

export const MODES = {
  auto:  { nom:"Auto",   aide:"Mesure automatique : approche d'un bord → arête, surface → face (distance ou angle)." },
  point: { nom:"Point",  aide:"Mesure point à point : cliquez le premier point (accrochage sur les sommets)." },
  arete: { nom:"Arête",  aide:"Mesure d'arête à arête : approchez le curseur d'une arête, puis cliquez." },
  face:  { nom:"Face",   aide:"Mesure de face à face : cliquez une face de la pièce." },
};

export class Mesure {
  constructor(vue, navigation, elements){
    this.vue = vue;
    this.nav = navigation;
    this.el = elements;          // { conteneur, etat }
    this.actif = false;
    this.mode = "auto";
    this.referentiel = prefs.mesureReferentiel || "projet"; // "projet" | "piece"
    this.pieceSelectionnee = null; // pièce sélectionnée dans l'arbre
    this.points = [];            // mode point
    this.pointsMaillages = [];   // maillages correspondant aux points
    this.entites = [];           // modes auto, arête et face
    this.etiquettes = [];
    this.etiquettesDelta = [];
    this.afficherDeltas = prefs.mesureDelta !== false;
    this.donneesDelta = null;
    this.raison = null;          // pourquoi le dernier survol n'a rien désigné

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
    this.entites = [];
    this.ligne.visible = false;
    this.annulerDelta();
    for(const r of this.reperes) r.visible = false;
    this.apercu.visible = false;
    for(const e of this.etiquettes) e.remove();
    this.etiquettes = [];
    this.viderSurlignages();
    this.dernierResultat = null;
    this.annoncer(this.actif ? MODES[this.mode].aide : null);
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

  definirReferentiel(ref){
    if(ref !== "projet" && ref !== "piece") return this.referentiel;
    this.referentiel = ref;
    prefs.mesureReferentiel = ref;
    this.rafraichir();
    return this.referentiel;
  }

  majPieceSelectionnee(piece){
    this.pieceSelectionnee = (piece && piece.isMesh) ? piece : null;
    if(this.actif && this.referentiel === "piece"){
      this.rafraichir();
    }
  }

  /** Détermine le référentiel orthonormé (projet ou pièce) à appliquer pour la mesure. */
  obtenirRepereActif(p1 = null, p2 = null, r = null){
    if(this.referentiel !== "piece"){
      return {
        mode: "projet",
        nom: "Projet",
        uX: new THREE.Vector3(1, 0, 0),
        uY: new THREE.Vector3(0, 1, 0),
        uZ: new THREE.Vector3(0, 0, 1),
      };
    }

    let cible = null;

    // 1. Pièce sélectionnée dans l'arbre si c'est un maillage
    if(this.pieceSelectionnee && this.pieceSelectionnee.isMesh){
      cible = this.pieceSelectionnee;
    }

    // 2. Si non définie ou groupe, vérifier les entités mesurées (modes auto, arête, face)
    if(!cible && this.entites.length > 0){
      const mA = this.entites[0]?.maillage;
      const mB = this.entites[1]?.maillage;
      if(mA && mB && mA === mB) cible = mA;
      else if(mA) cible = mA;
      else if(mB) cible = mB;
    }

    // 3. Mode point : maillages mémorisés
    if(!cible && this.pointsMaillages.length > 0){
      const mA = this.pointsMaillages[0];
      const mB = this.pointsMaillages[1];
      if(mA && mB && mA === mB) cible = mA;
      else if(mA) cible = mA;
      else if(mB) cible = mB;
    }

    if(cible){
      const rep = repereDePiece(cible);
      if(rep){
        return {
          mode: "piece",
          nom: rep.nom || "Pièce",
          uX: rep.uX,
          uY: rep.uY,
          uZ: rep.uZ,
          centre: rep.centre,
          maillage: cible,
        };
      }
    }

    // Repli si aucune pièce n'est identifiable
    return {
      mode: "projet",
      nom: "Projet",
      uX: new THREE.Vector3(1, 0, 0),
      uY: new THREE.Vector3(0, 1, 0),
      uZ: new THREE.Vector3(0, 0, 1),
    };
  }

  /** Rafraîchit le rendu de la mesure courante (ex: après bascule du mode ΔXYZ ou du référentiel) */
  rafraichir(){
    if(!this.actif) return;
    if(this.points.length === 2){
      const [a, b] = this.points;
      const d = a.distanceTo(b);
      if(this.afficherDeltas && d > 1e-4){
        this.afficherMesureDelta(a, b, `${cote(d)} mm`);
      }else{
        this.annulerDelta();
        this.tracer(a, b, false);
        for(let i = 0; i < 2; i++){
          const rep = this.reperes[i];
          rep.position.copy(i ? b : a);
          rep.scale.setScalar(this.tailleRepere());
          rep.visible = true;
        }
        this.poserEtiquette(a.clone().lerp(b, 0.5), `${cote(d)} mm`);
      }
      const repActif = this.obtenirRepereActif(a, b);
      const vecD = new THREE.Vector3().subVectors(b, a);
      const dX = Math.abs(vecD.dot(repActif.uX));
      const dY = Math.abs(vecD.dot(repActif.uY));
      const dZ = Math.abs(vecD.dot(repActif.uZ));
      const infoRep = repActif.mode === "piece" ? `  ·  [Repère : Pièce « ${repActif.nom} »]` : "";
      this.annoncer(`Distance ${cote(d)} mm  ·  ΔX ${cote(dX)}  ` +
                    `ΔY ${cote(dY)}  ΔZ ${cote(dZ)} mm${infoRep}`);
      this.vue.invalider();
    }else if(this.dernierResultat){
      this.poserResultat(this.dernierResultat);
      this.vue.invalider();
    }
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
   * Point retenu pour un évènement : le sommet le plus proche du triangle
   * touché s'il est à portée, sinon le point d'impact lui-même.
   */
  pointVise(ev){
    const touches = this.vue.lancerRayon(ev);
    if(!touches.length) return null;
    const t = touches[0];
    const impact = t.point.clone();
    if(!t.face) return { point:impact, accroche:false };

    const geo = t.object.geometry;
    const pos = geo.attributes.position;
    const ecran = this.vue.versEcran(impact);
    let meilleur = null, distMin = SEUIL_ACCROCHE;

    for(const i of [t.face.a, t.face.b, t.face.c]){
      const sommet = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(t.object.matrixWorld);
      const s = this.vue.versEcran(sommet);
      const d = Math.hypot(s.x - ecran.x, s.y - ecran.y);
      if(d < distMin){ distMin = d; meilleur = sommet; }
    }
    return meilleur ? { point:meilleur, accroche:true, maillage:t.object } : { point:impact, accroche:false, maillage:t.object };
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
      if(this.entites.length === 1 && this.dernierResultat?.titre){
        this.annoncer(this.dernierResultat.titre);
      }else{
        this.annoncer(this.messageEnCours(this.raison));
      }
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
    const vise = this.pointVise(ev);
    const r = this.apercu;
    if(!vise){ if(r.visible){ r.visible = false; this.vue.invalider(); } return; }
    r.position.copy(vise.point);
    r.scale.setScalar(this.tailleRepere() * (vise.accroche ? 1.4 : 0.9));
    r.visible = true;
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
    const r = this.reperes[this.points.length - 1];
    r.position.copy(vise.point);
    r.scale.setScalar(this.tailleRepere());
    r.visible = true;

    if(this.points.length === 1){
      this.annoncer("Second point…");
    }else{
      const [a, b] = this.points;
      const d = a.distanceTo(b);
      const repActif = this.obtenirRepereActif(a, b);
      const vecD = new THREE.Vector3().subVectors(b, a);
      const dX = Math.abs(vecD.dot(repActif.uX));
      const dY = Math.abs(vecD.dot(repActif.uY));
      const dZ = Math.abs(vecD.dot(repActif.uZ));

      if(this.afficherDeltas && d > 1e-4){
        this.afficherMesureDelta(a, b, `${cote(d)} mm`);
      }else{
        this.annulerDelta();
        this.tracer(a, b, false);
        for(let i = 0; i < 2; i++){
          const rep = this.reperes[i];
          rep.position.copy(i ? b : a);
          rep.scale.setScalar(this.tailleRepere());
          rep.visible = true;
        }
        this.poserEtiquette(a.clone().lerp(b, 0.5), `${cote(d)} mm`);
      }
      const infoRep = repActif.mode === "piece" ? `  ·  [Repère : Pièce « ${repActif.nom} »]` : "";
      this.annoncer(`Distance ${cote(d)} mm  ·  ΔX ${cote(dX)}  ` +
                    `ΔY ${cote(dY)}  ΔZ ${cote(dZ)} mm${infoRep}`);
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
    const ecart = (r.p1 && r.p2) ? r.p1.distanceTo(r.p2) : 0;
    const repActif = this.obtenirRepereActif(r.p1, r.p2, r);
    if(this.afficherDeltas && ecart > 1e-4){
      this.afficherMesureDelta(r.p1, r.p2, r.etiquette, r);
    }else{
      this.annulerDelta();
      this.actualiserRenduMesure(r);
      this.poserEtiquette(r.ancre || r.p1.clone().lerp(r.p2, 0.5), r.etiquette, r);
    }
    const infoRep = repActif.mode === "piece" ? `  ·  [Repère : Pièce « ${repActif.nom} »]` : "";
    this.annoncer(`${r.titre}${infoRep}`);
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
    for(const rep of this.reperes) rep.visible = false;

    const repActif = this.obtenirRepereActif(p1, p2, r);
    const vecD = new THREE.Vector3().subVectors(p2, p1);
    const valX = vecD.dot(repActif.uX);
    const valY = vecD.dot(repActif.uY);
    const valZ = vecD.dot(repActif.uZ);

    const dX = Math.abs(valX);
    const dY = Math.abs(valY);
    const dZ = Math.abs(valZ);
    const dist = p1.distanceTo(p2);

    // Escalier orthogonal orienté selon les axes du repère actif :
    const ptA = p1.clone();
    const ptB = ptA.clone().addScaledVector(repActif.uX, valX);
    const ptC = ptB.clone().addScaledVector(repActif.uY, valY);
    const ptD = ptC.clone().addScaledVector(repActif.uZ, valZ);

    // 1. Tracer les segments 3D
    this.tracerSegment(this.ligneDist, ptA, ptD);

    const aX = dX > 1e-4;
    const aY = dY > 1e-4;
    const aZ = dZ > 1e-4;

    if(aX) this.tracerSegment(this.ligneX, ptA, ptB);
    else this.ligneX.visible = false;

    if(aY) this.tracerSegment(this.ligneY, ptB, ptC);
    else this.ligneY.visible = false;

    if(aZ) this.tracerSegment(this.ligneZ, ptC, ptD);
    else this.ligneZ.visible = false;

    // 2. Repères aux sommets
    const taille = this.tailleRepere();
    this.reperesDelta[0].position.copy(ptA);
    this.reperesDelta[0].scale.setScalar(taille);
    this.reperesDelta[0].visible = true;

    this.reperesDelta[1].position.copy(ptB);
    this.reperesDelta[1].scale.setScalar(taille * 0.85);
    this.reperesDelta[1].visible = aX && (aY || aZ);

    this.reperesDelta[2].position.copy(ptC);
    this.reperesDelta[2].scale.setScalar(taille * 0.85);
    this.reperesDelta[2].visible = aY && aZ;

    this.reperesDelta[3].position.copy(ptD);
    this.reperesDelta[3].scale.setScalar(taille);
    this.reperesDelta[3].visible = true;

    // 3. Définition des composantes
    let valDist = formaterCoteCAD(dist);
    if(distTexte && !r?.extensible){
      valDist = distTexte.replace(/\s*mm$/, "mm");
    }

    const badgeDist = repActif.mode === "piece" ? "Dist (P):" : "Dist:";
    const composantes = [
      { cle:"dist", badge:badgeDist, valeur:valDist, ancre:ptA.clone().lerp(ptD, 0.5), defautOffset:{ x:50, y:25 }, visible:true, titre:repActif.mode === "piece" ? `Référentiel pièce : ${repActif.nom}` : "Référentiel projet (global)" },
      { cle:"dx", badge:"dX:", valeur:formaterCoteCAD(dX), ancre:ptA.clone().lerp(ptB, 0.5), defautOffset:{ x:-20, y:-45 }, visible:aX },
      { cle:"dy", badge:"dY:", valeur:formaterCoteCAD(dY), ancre:ptB.clone().lerp(ptC, 0.5), defautOffset:{ x:-95, y:-15 }, visible:aY },
      { cle:"dz", badge:"dZ:", valeur:formaterCoteCAD(dZ), ancre:ptC.clone().lerp(ptD, 0.5), defautOffset:{ x:-95, y:25 }, visible:aZ },
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
    r.p1.copy(source.p1);
    r.p2.copy(source.p2);
    r.etiquette = source.etiquette;
    r.titre = source.titre;
    r.positionActuelle = mode;

    this.actualiserRenduMesure(r);
    const ancre = r.p1.clone().lerp(r.p2, 0.5);
    const et = this.etiquettes[0];
    if(et){
      et.__ancre = ancre;
      if(et._spTexte) et._spTexte.textContent = r.etiquette;
      else et.textContent = r.etiquette;
      const bMin = et.querySelector(".cote-min");
      const bMax = et.querySelector(".cote-max");
      if(bMin) bMin.classList.toggle("actif", mode === "min");
      if(bMax) bMax.classList.toggle("actif", mode === "max");
    }
    this.replacerEtiquettes();
    this.annoncer(r.titre);
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
        r.p1.copy(g.p1);
        r.p2.copy(g.p2);
        r.etiquette = g.etiquette;
        r.titre = g.titre;
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
        this.annoncer(r.titre);
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
