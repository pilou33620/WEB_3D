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

   · Arête à arête, ce n'est presque jamais la distance la plus courte qu'on
     cherche. Entre deux perçages, c'est l'entraxe — de centre à centre. Entre
     deux arêtes parallèles, c'est leur écartement, pas la distance entre leurs
     bouts. Le module reconnaît donc ce qu'il a sous la main avant de choisir
     la cote à donner.

   · Face à face, même chose : deux plans parallèles donnent une épaisseur,
     deux cylindres un entraxe, un cylindre et un plan une hauteur d'axe.

   Le travail de reconnaissance est dans 06-topologie.js ; ce fichier-ci ne
   fait que désigner, surligner, et poser la cote à l'écran.

   L'étiquette est un élément HTML posé au-dessus du canevas plutôt qu'un objet
   3D : le texte reste net à toute échelle et suit la feuille de style du reste
   de l'interface.
   ============================================================================= */
"use strict";

import * as THREE from "three";
import { analyser, areteSous, faceSous, geometrieArete, geometrieFace, contourFace,
         mesurerAretes, mesurerFaces, resumer, cote,
         PLAFOND_TRIANGLES, nombre } from "./06-topologie.js";

const SEUIL_ACCROCHE = 14;      // pixels
const SEUIL_ARETE = 16;         // pixels
const JAUNE = 0xf2c744;
const CYAN = 0x8af0ff;

export const MODES = {
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
    this.mode = "point";
    this.points = [];            // mode point
    this.entites = [];           // modes arête et face
    this.etiquettes = [];
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

    this.reperes = [this.repere(), this.repere()];
    this.apercu = this.repere(CYAN);

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
    this.entites = [];
    this.ligne.visible = false;
    for(const r of this.reperes) r.visible = false;
    this.apercu.visible = false;
    for(const e of this.etiquettes) e.remove();
    this.etiquettes = [];
    this.viderSurlignages();
    this.annoncer(this.actif ? MODES[this.mode].aide : null);
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

    if(!this.topoPrete(t.object)){
      if(!analyse){
        this.raison = `Cliquez pour analyser « ${t.object.name || "cette pièce"} » ` +
                      `(${nombre(t.object.userData.triangles || 0)} triangles).`;
        return null;
      }
      if(!analyser(t.object)){
        this.raison = `« ${t.object.name || "Cette pièce" } » est trop lourde pour l'analyse ` +
                      `(${nombre(t.object.userData.triangles || 0)} triangles, plafond ` +
                      `${nombre(PLAFOND_TRIANGLES)}). Mesurez-la point à point.`;
        return null;
      }
    }else if(!analyser(t.object)){
      this.raison = "Pièce trop lourde pour l'analyse : mesurez-la point à point.";
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
    return meilleur ? { point:meilleur, accroche:true } : { point:impact, accroche:false };
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
    const attendu = this.mode === "arete" ? "arête" : "face";
    const base = this.entites.length === 1
      ? `Première ${attendu} : ${resumer(this.entites[0])}  ·  choisissez la seconde`
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
    const r = this.reperes[this.points.length - 1];
    r.position.copy(vise.point);
    r.scale.setScalar(this.tailleRepere());
    r.visible = true;

    if(this.points.length === 1){
      this.annoncer("Second point…");
    }else{
      const [a, b] = this.points;
      this.tracer(a, b, false);
      const d = a.distanceTo(b);
      this.poserEtiquette(a.clone().lerp(b, 0.5), `${cote(d)} mm`);
      this.annoncer(`Distance ${cote(d)} mm  ·  ΔX ${cote(Math.abs(b.x-a.x))}  ` +
                    `ΔY ${cote(Math.abs(b.y-a.y))}  ΔZ ${cote(Math.abs(b.z-a.z))} mm`);
    }
    this.vue.invalider();
    return true;
  }

  cliquerEntite(ev){
    if(this.entites.length >= 2) this.annuler();

    const e = this.entiteSous(ev);
    if(!e){ this.annoncer(this.messageEnCours(this.raison)); this.vue.invalider(); return true; }

    /* Mesurer une arête avec elle-même ne donnerait que zéro : on garde la
       première et on attend la seconde plutôt que d'afficher un résultat vide. */
    if(this.entites.length === 1 && this.entites[0].cle === e.cle){
      this.annoncer(this.messageEnCours(`déjà retenue — choisissez-en une autre`));
      return true;
    }

    this.jeter(this.survole); this.survole = null; this.cleSurvol = null;
    this.entites.push(e);
    this.retenir(e, this.entites.length - 1);

    if(this.entites.length === 1){
      this.annoncer(this.messageEnCours(null));
    }else{
      const r = this.mode === "arete"
        ? mesurerAretes(this.entites[0], this.entites[1])
        : mesurerFaces(this.entites[0], this.entites[1]);
      this.poserResultat(r);
    }
    this.vue.invalider();
    return true;
  }

  /** Trace la cote entre les deux points retenus par la mesure, et l'annonce. */
  poserResultat(r){
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
    this.poserEtiquette(r.p1.clone().lerp(r.p2, 0.5), r.etiquette);
    this.annoncer(r.titre);
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

  poserEtiquette(ancre, texte){
    for(const e of this.etiquettes) e.remove();
    const et = document.createElement("div");
    et.className = "cote";
    et.textContent = texte;
    et.__ancre = ancre;
    this.el.conteneur.appendChild(et);
    this.etiquettes = [et];
    this.replacerEtiquettes();
  }

  replacerEtiquettes(){
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
