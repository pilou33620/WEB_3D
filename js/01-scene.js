/* =============================================================================
   Visionneuse 3D — 01-scene.js
   La scène, les caméras, l'éclairage, le sol, les modes d'affichage.

   Deux partis pris structurent tout le fichier :

   1. La caméra est décrite par un point visé et une position ; la perspective
      et l'orthographique ne sont que deux façons de regarder ce même couple.
      Basculer de l'une à l'autre ne doit donc rien déplacer à l'écran — c'est
      le zoom de la caméra orthographique qui est recalculé, pas le cadrage.

   2. Rien n'est dessiné tant que rien n'a changé. Chaque action appelle
      `invalider()` ; la boucle ne fait un rendu que si un drapeau est levé.
      Une visionneuse reste ouverte des heures : elle n'a pas à chauffer.
   ============================================================================= */
"use strict";

import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { prefs } from "./00-config.js";

const DEG = Math.PI / 180;

export class Vue3D {
  constructor(canvas){
    this.canvas = canvas;
    this.sale = true;          // un rendu est nécessaire
    this.horloge = new THREE.Clock();
    this.aFaireAvantRendu = new Set();   // navigation, animations…
    this.apresRendu = new Set();         // cube de vues, cotes affichées

    /* ---------------- moteur de rendu ---------------- */
    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias:true, alpha:false, preserveDrawingBuffer:true,
      powerPreference:"high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = false;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.localClippingEnabled = true;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    /* ---------------- scène ---------------- */
    this.scene = new THREE.Scene();
    this.modele = new THREE.Group();          // tout ce qui vient des fichiers
    this.modele.name = "modele";
    this.decor = new THREE.Group();           // sol, grille, ombres
    this.annotations = new THREE.Group();     // mesures, repères
    this.scene.add(this.modele, this.decor, this.annotations);

    /* ---------------- caméras ---------------- */
    /* Le point visé est la seule donnée partagée : la navigation le déplace,
       les deux caméras le suivent. */
    this.cible = new THREE.Vector3(0, 0, 0);
    this.perspective = new THREE.PerspectiveCamera(45, 1, 0.1, 10000);
    this.ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, -10000, 10000);
    this.perspective.position.set(1, -1, 1);
    this.ortho.position.copy(this.perspective.position);
    this.projection = prefs.projection;
    this.definirAxeVertical(prefs.axeVertical, false);

    /* ---------------- lumières ---------------- */
    this.eclairage = new THREE.Group();
    this.ambiante = new THREE.HemisphereLight(0xdfe7f2, 0x3a3a3a, 1.1);
    this.cle = new THREE.DirectionalLight(0xffffff, 1.5);
    this.cle.position.set(1, -1.4, 2);
    this.remplissage = new THREE.DirectionalLight(0xbcd2ff, 0.55);
    this.remplissage.position.set(-1.4, 1, 0.6);
    this.contre = new THREE.DirectionalLight(0xffffff, 0.35);
    this.contre.position.set(0.2, 1.4, -1);
    this.cle.castShadow = true;
    this.cle.shadow.mapSize.set(2048, 2048);
    this.cle.shadow.bias = -0.0008;
    this.eclairage.add(this.ambiante, this.cle, this.cle.target, this.remplissage, this.contre);
    this.scene.add(this.eclairage);

    /* Une sonde d'environnement donne aux surfaces métalliques ce reflet
       d'atelier qu'aucune lumière ponctuelle ne sait imiter. */
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envMap;
    this.scene.environmentIntensity = 0.55;
    pmrem.dispose();

    /* ---------------- décor ---------------- */
    this.grille = null;
    this.solOmbre = null;
    this.construireDecor(100);

    /* ---------------- état d'affichage ---------------- */
    this.modeFilaire = false;
    this.modeTransparent = false;
    this.aretesVisibles = prefs.aretes;
    this.materiaux = new Set();       // matériaux du modèle courant
    this.plansCoupe = [];             // plans de clipping actifs

    this.appliquerFond(prefs.fond);
    this.redimensionner();
    this.boucler();
  }

  /* ==========================================================================
     Boucle de rendu
     ========================================================================== */
  invalider(){ this.sale = true; }

  boucler(){
    const pas = () => {
      this._raf = requestAnimationFrame(pas);
      const dt = Math.min(this.horloge.getDelta(), 0.1);
      for(const f of this.aFaireAvantRendu) f(dt);
      if(this.sale){ this.sale = false; this.rendre(); }
    };
    pas();
  }

  rendre(){
    this.renderer.render(this.scene, this.camera());
    /* Ce qui est posé « par-dessus » la vue — cube, étiquettes de cotes — se
       recale ici : c'est le seul instant où la caméra est certainement à jour. */
    for(const f of this.apresRendu) f();
  }

  camera(){ return this.projection === "ortho" ? this.ortho : this.perspective; }

  redimensionner(){
    const l = this.canvas.clientWidth || 1, h = this.canvas.clientHeight || 1;
    this.renderer.setSize(l, h, false);
    this.perspective.aspect = l / h;
    this.perspective.updateProjectionMatrix();
    this.majOrtho();
    this.invalider();
  }

  /* ==========================================================================
     Caméras
     ========================================================================== */

  /** Distance caméra → point visé : c'est elle qui porte le niveau de zoom. */
  distance(){ return this.camera().position.distanceTo(this.cible); }

  /**
   * La caméra orthographique n'a pas de champ de vision : on lui donne le
   * cadrage que la perspective aurait à la même distance, pour que la bascule
   * entre les deux ne fasse pas « sauter » le modèle.
   */
  majOrtho(){
    const l = this.canvas.clientWidth || 1, h = this.canvas.clientHeight || 1;
    const d = Math.max(this.ortho.position.distanceTo(this.cible), 1e-4);
    const demiH = Math.tan(this.perspective.fov * DEG / 2) * d;
    const demiL = demiH * (l / h);
    this.ortho.left = -demiL; this.ortho.right = demiL;
    this.ortho.top = demiH;   this.ortho.bottom = -demiH;
    this.ortho.near = -Math.max(d * 10, 1e4);
    this.ortho.far  =  Math.max(d * 10, 1e4);
    this.ortho.updateProjectionMatrix();
  }

  definirProjection(mode){
    if(mode === this.projection) return;
    const source = this.camera();
    this.projection = mode;
    const cible = this.camera();
    cible.position.copy(source.position);
    cible.up.copy(source.up);
    cible.lookAt(this.cible);
    this.majOrtho();
    this.majPlansCamera();
    this.invalider();
  }

  definirAxeVertical(axe, redessiner = true){
    const haut = axe === "y" ? new THREE.Vector3(0,1,0) : new THREE.Vector3(0,0,1);
    this.haut = haut;
    this.perspective.up.copy(haut);
    this.ortho.up.copy(haut);
    if(this.grille) this.orienterGrille();
    if(redessiner){ this.regarder(); this.invalider(); }
  }

  /**
   * Recale les deux caméras sur le point visé. La verticale courante est
   * conservée — en orbite libre elle est inclinée, et la redresser d'office
   * ferait basculer la vue à chaque « Ajuster ».
   */
  regarder(){
    const c = this.camera();
    const autre = c === this.perspective ? this.ortho : this.perspective;
    autre.position.copy(c.position);
    autre.up.copy(c.up);
    c.lookAt(this.cible);
    autre.lookAt(this.cible);
    this.majOrtho();
  }

  /**
   * Les plans de clipping proche et lointain suivent la taille de ce qu'on
   * regarde : trop serrés, les faces clignotent ; trop larges, le tampon de
   * profondeur perd sa précision et les surfaces coplanaires se mélangent.
   */
  majPlansCamera(){
    const d = Math.max(this.distance(), 1e-3);
    const r = Math.max(this.rayonModele || d, 1e-3);
    this.perspective.near = Math.max(d / 1000, r / 5000);
    this.perspective.far  = Math.max(d + r * 12, r * 20);
    this.perspective.updateProjectionMatrix();
    this.majOrtho();
  }

  /* ==========================================================================
     Cadrage
     ========================================================================== */

  /** Encombrement d'un objet (ou du modèle entier), en sautant l'invisible. */
  boite(objet = this.modele){
    const b = new THREE.Box3();
    let vide = true;
    objet.traverseVisible(o => {
      if(o.isMesh && o.geometry){
        o.updateWorldMatrix(true, false);
        if(!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        const bb = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
        b.union(bb); vide = false;
      }
    });
    return vide ? null : b;
  }

  /**
   * Cadre l'objet sans changer la direction du regard : on garde l'axe
   * caméra → cible et on ne recule que ce qu'il faut. Un « ajuster » qui
   * ramènerait la vue de face à chaque fois ferait perdre le fil.
   */
  ajusterVue(objet = this.modele, marge = 1.25){
    const b = this.boite(objet);
    if(!b) return;
    const centre = b.getCenter(new THREE.Vector3());
    const taille = b.getSize(new THREE.Vector3());
    const rayon  = Math.max(taille.length() / 2, 1e-3);

    const c = this.camera();
    let dir = new THREE.Vector3().subVectors(c.position, this.cible);
    if(dir.lengthSq() < 1e-9) dir.set(1, -1, 0.8);
    dir.normalize();

    const demiFov = this.perspective.fov * DEG / 2;
    const aspect = Math.max(this.perspective.aspect, 0.2);
    const demiFovH = Math.atan(Math.tan(demiFov) * aspect);
    const d = rayon * marge / Math.sin(Math.min(demiFov, demiFovH));

    this.cible.copy(centre);
    this.perspective.position.copy(centre).addScaledVector(dir, d);
    this.ortho.position.copy(this.perspective.position);
    this.rayonModele = Math.max(this.rayonModele || 0, rayon);
    this.regarder();
    this.majPlansCamera();
    this.invalider();
  }

  /* ==========================================================================
     Décor : grille, sol, ombres
     ========================================================================== */
  construireDecor(taille){
    for(const o of [...this.decor.children]){
      this.decor.remove(o);
      o.geometry?.dispose?.();
      o.material?.dispose?.();
    }
    /* Un pas « rond » : on cherche la puissance de dix la plus proche du
       dixième de la scène, puis on garde 10 divisions par carreau. */
    const pas = Math.pow(10, Math.round(Math.log10(taille / 10)));
    const etendue = Math.ceil(taille / pas) * pas * 2;
    const divisions = Math.max(2, Math.round(etendue / pas));

    this.grille = new THREE.GridHelper(etendue, divisions, 0x4a5058, 0x2a2e34);
    this.grille.material.transparent = true;
    this.grille.material.opacity = prefs.fond === "clair" ? 0.28 : 0.55;
    this.grille.material.depthWrite = false;
    this.grille.renderOrder = -1;

    const g = new THREE.PlaneGeometry(etendue, etendue);
    this.solOmbre = new THREE.Mesh(g, new THREE.ShadowMaterial({ opacity:0.28 }));
    this.solOmbre.receiveShadow = true;
    this.solOmbre.visible = prefs.ombres;
    this.solOmbre.renderOrder = -2;

    this.decor.add(this.grille, this.solOmbre);
    this.orienterGrille();
    this.grille.visible = prefs.grille;
    this.pasGrille = pas;
    this.invalider();
  }

  /** GridHelper est dessiné dans le plan XZ ; en CAO le sol est le plan XY. */
  orienterGrille(){
    const versZ = this.haut.z === 1;
    for(const o of [this.grille, this.solOmbre]){
      if(!o) continue;
      o.rotation.set(versZ ? Math.PI/2 : 0, 0, 0);
    }
    if(this.solOmbre && this.grille){
      this.solOmbre.rotation.copy(this.grille.rotation);
    }
  }

  /** Pose le décor et l'éclairage à l'échelle du modèle qui vient d'arriver. */
  adapterAuModele(){
    const b = this.boite();
    if(!b){ this.rayonModele = 0; return; }
    const taille = b.getSize(new THREE.Vector3());
    const centre = b.getCenter(new THREE.Vector3());
    const rayon = Math.max(taille.length() / 2, 1e-3);
    this.rayonModele = rayon;
    this.construireDecor(rayon * 2);

    /* Le sol se cale sous la pièce, pas à l'origine : un modèle STEP est
       rarement posé sur le zéro du repère. */
    const basse = this.haut.z === 1 ? b.min.z : b.min.y;
    const p = this.decor.position;
    p.set(centre.x, centre.y, centre.z);
    if(this.haut.z === 1) p.z = basse - rayon * 0.002; else p.y = basse - rayon * 0.002;

    /* Lumières et ombres à l'échelle, sinon la carte d'ombre est soit vide,
       soit grossière comme un damier. */
    const d = rayon * 4;
    this.cle.position.copy(centre).add(new THREE.Vector3(0.6, -0.9, 1.2).multiplyScalar(d));
    this.remplissage.position.copy(centre).add(new THREE.Vector3(-1, 0.7, 0.5).multiplyScalar(d));
    this.contre.position.copy(centre).add(new THREE.Vector3(0.1, 1, -0.8).multiplyScalar(d));
    this.cle.target.position.copy(centre);
    this.cle.target.updateMatrixWorld();
    const s = this.cle.shadow.camera;
    s.left = -rayon * 1.6; s.right = rayon * 1.6;
    s.top = rayon * 1.6; s.bottom = -rayon * 1.6;
    s.near = d * 0.2; s.far = d * 4;
    s.updateProjectionMatrix();
    this.invalider();
  }

  definirOmbres(actif){
    this.renderer.shadowMap.enabled = !!actif;
    if(this.solOmbre) this.solOmbre.visible = !!actif;
    this.modele.traverse(o => {
      if(!o.isMesh) return;
      o.castShadow = o.receiveShadow = !!actif;
      /* Activer la carte d'ombre change le programme des matériaux : sans ce
         drapeau, les pièces déjà à l'écran resteraient sans ombre. */
      if(o.material) o.material.needsUpdate = true;
    });
    this.invalider();
  }

  definirGrille(actif){ if(this.grille) this.grille.visible = !!actif; this.invalider(); }

  appliquerFond(mode){
    if(mode === "clair"){
      this.scene.background = new THREE.Color(0xeef1f4);
      this.scene.environmentIntensity = 0.75;
      if(this.grille?.material) this.grille.material.opacity = 0.28;
    }else if(mode === "sombre"){
      this.scene.background = new THREE.Color(0x0f1012);
      this.scene.environmentIntensity = 0.55;
      if(this.grille?.material) this.grille.material.opacity = 0.55;
    }else{
      this.scene.background = this.textureDegrade();
      this.scene.environmentIntensity = 0.55;
      if(this.grille?.material) this.grille.material.opacity = 0.55;
    }
    this.invalider();
  }

  /** Dégradé d'atelier : un simple canevas vertical, moins coûteux qu'un ciel. */
  textureDegrade(){
    if(this._degrade) return this._degrade;
    const c = document.createElement("canvas");
    c.width = 2; c.height = 256;
    const g = c.getContext("2d");
    const d = g.createLinearGradient(0, 0, 0, 256);
    d.addColorStop(0, "#2a3138");
    d.addColorStop(0.55, "#1a1e23");
    d.addColorStop(1, "#0d0f11");
    g.fillStyle = d; g.fillRect(0, 0, 2, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    this._degrade = t;
    return t;
  }

  /* ==========================================================================
     Modes d'affichage
     ========================================================================== */
  recenserMateriaux(){
    this.materiaux.clear();
    this.modele.traverse(o => { if(o.isMesh && o.material) this.materiaux.add(o.material); });
  }

  definirFilaire(actif){
    this.modeFilaire = !!actif;
    for(const m of this.materiaux){ m.wireframe = this.modeFilaire; m.needsUpdate = true; }
    this.invalider();
  }

  definirTransparence(actif){
    this.modeTransparent = !!actif;
    for(const m of this.materiaux){
      m.transparent = this.modeTransparent || m.userData?.transparentDorigine || false;
      m.opacity = this.modeTransparent ? 0.28 : (m.userData?.opaciteDorigine ?? 1);
      m.depthWrite = !this.modeTransparent;
      m.side = this.modeTransparent ? THREE.DoubleSide : THREE.FrontSide;
      m.needsUpdate = true;
    }
    this.invalider();
  }

  definirAretes(actif){
    this.aretesVisibles = !!actif;
    /* Une arête est fille de son maillage : si celui-ci est masqué, three.js
       ne descend pas dans la branche, rien d'autre n'est à vérifier. */
    this.modele.traverse(o => { if(o.isLineSegments && o.userData.estArete) o.visible = this.aretesVisibles; });
    this.invalider();
  }

  /* ==========================================================================
     Plan de coupe
     ========================================================================== */
  definirCoupe(actif, planOuAxe = "x", ratio = 0.5, inverse = false){
    /* Les arêtes vives sont des objets à part, avec leurs propres matériaux :
       sans cette seconde passe, le fil de fer des pièces coupées continuerait
       de flotter dans le vide. */
    const surAretes = (f) => this.modele.traverse(o => {
      if(o.isLineSegments && o.userData.estArete && o.material) f(o.material);
    });

    if(!actif){
      this.plansCoupe = [];
      for(const m of this.materiaux){
        m.clippingPlanes = null;
        m.side = this.modeTransparent ? THREE.DoubleSide : THREE.FrontSide;
        m.needsUpdate = true;
      }
      surAretes(m => { m.clippingPlanes = null; m.needsUpdate = true; });
      this.invalider();
      return;
    }

    let plan;
    if(planOuAxe && (planOuAxe.isPlane || planOuAxe instanceof THREE.Plane)){
      plan = planOuAxe;
    }else{
      const axe = planOuAxe;
      const b = this.boite() || new THREE.Box3(new THREE.Vector3(-1,-1,-1), new THREE.Vector3(1,1,1));
      const min = b.min, max = b.max;
      const n = new THREE.Vector3(axe === "x" ? 1 : 0, axe === "y" ? 1 : 0, axe === "z" ? 1 : 0);
      if(inverse) n.negate();
      const pos = new THREE.Vector3(
        min.x + (max.x - min.x) * ratio,
        min.y + (max.y - min.y) * ratio,
        min.z + (max.z - min.z) * ratio,
      );
      plan = new THREE.Plane().setFromNormalAndCoplanarPoint(n.clone().negate(), pos);
    }

    this.plansCoupe = [plan];
    for(const m of this.materiaux){
      m.clippingPlanes = this.plansCoupe;
      /* Une pièce coupée montre son intérieur : sans les faces arrières, on
         verrait à travers la matière. */
      m.side = THREE.DoubleSide;
      m.needsUpdate = true;
    }
    surAretes(m => { m.clippingPlanes = this.plansCoupe; m.needsUpdate = true; });
    this.invalider();
  }

  /* ==========================================================================
     Utilitaires
     ========================================================================== */

  /** Coordonnées normalisées (−1…1) d'un évènement, dans le canevas. */
  ndc(ev, cible = new THREE.Vector2()){
    const r = this.canvas.getBoundingClientRect();
    cible.set(((ev.clientX - r.left) / r.width) * 2 - 1,
              -((ev.clientY - r.top) / r.height) * 2 + 1);
    return cible;
  }

  /** Point écran (px, relatif au canevas) d'un point du monde. */
  versEcran(p){
    const v = p.clone().project(this.camera());
    const r = this.canvas.getBoundingClientRect();
    return { x:(v.x + 1) / 2 * r.width, y:(-v.y + 1) / 2 * r.height, z:v.z };
  }

  /**
   * Ce que le curseur touche, du plus proche au plus lointain.
   *
   * Le lanceur de rayons de three.js ne regarde jamais `visible` : il traverse
   * l'arbre entier, y compris les branches que le rendu saute. Filtrer sur le
   * seul maillage ne suffit donc pas — masquer un sous-ensemble laisserait ses
   * pièces attraper les clics et cacher ce qui se trouve derrière. On exige
   * que toute la lignée soit visible, exactement comme le rendu.
   */
  lancerRayon(ev, objets = this.modele.children){
    if(!this._rc) this._rc = new THREE.Raycaster();
    this._rc.setFromCamera(this.ndc(ev), this.camera());
    this._rc.params.Line.threshold = (this.rayonModele || 1) * 0.005;
    return this._rc.intersectObjects(objets, true)
      .filter(i => i.object.isMesh && visibleEnLignee(i.object));
  }

  /** Capture PNG de l'image affichée. */
  capture(){
    this.rendre();  // le tampon peut avoir été effacé depuis le dernier rendu
    return this.canvas.toDataURL("image/png");
  }

  viderModele(){
    for(const o of [...this.modele.children]) this.modele.remove(o);
    this.materiaux.clear();
    this.rayonModele = 0;
    this.invalider();
  }
}

/**
 * Un objet n'est à l'écran que si lui et tous ses ascendants le sont : c'est
 * la règle du rendu, et tout ce qui désigne une pièce à la souris — sélection,
 * mesure, zoom vers le curseur — doit suivre la même.
 */
export function visibleEnLignee(objet){
  for(let o = objet; o; o = o.parent) if(!o.visible) return false;
  return true;
}
