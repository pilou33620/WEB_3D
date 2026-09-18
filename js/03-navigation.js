/* =============================================================================
   Visionneuse 3D — 03-navigation.js
   Orbite, panoramique, zoom — et surtout : qui déclenche quoi.

   Aucun bouton n'est écrit en dur dans ce fichier. À chaque appui, on demande
   à 00-config.js l'action associée au bouton et aux modificateurs enfoncés,
   puis on l'exécute. Changer de préréglage — Onshape, SolidWorks, Tinkercad —
   ne touche donc pas une ligne de ce module.

   Deux orbites cohabitent, parce que les deux écoles existent :
     · l'orbite contrainte garde l'axe vertical droit (le modèle « tourne sur
       son plateau ») : on ne se perd jamais, mais on ne passe pas par-dessus ;
     · l'orbite libre fait rouler le modèle dans tous les sens, sans haut ni
       bas — plus directe pour inspecter une pièce isolée.
   ============================================================================= */
"use strict";

import * as THREE from "three";
import { prefs, actionPourGeste, nomBouton } from "./00-config.js";

const EPS = 1e-6;

export class Navigation {
  constructor(vue, { surSelection, surSurvol, surClic, surPointeurBasAvant } = {}){
    this.vue = vue;
    this.surSelection = surSelection;
    this.surSurvol = surSurvol;
    this.surClic = surClic;
    this.surPointeurBasAvant = surPointeurBasAvant;

    this.pointeurs = new Map();      // pointerId -> {x, y, bouton}
    this.geste = null;               // 'orbite' | 'panoramique' | 'zoom'
    this.gestePince = null;          // état du pincement à deux doigts
    this.depart = null;              // pour distinguer un clic d'un glissé

    /* Vitesses résiduelles, pour l'inertie. */
    this.vOrbite = new THREE.Vector2();
    this.vPano = new THREE.Vector2();

    this.animation = null;
    this.actif = true;

    const c = vue.canvas;
    c.addEventListener("pointerdown", this.surPointeurBas = (e) => this.pointeurBas(e));
    c.addEventListener("pointermove", this.surPointeurBouge = (e) => this.pointeurBouge(e));
    c.addEventListener("pointerup", this.surPointeurHaut = (e) => this.pointeurHaut(e));
    c.addEventListener("pointercancel", this.surPointeurHaut);
    c.addEventListener("wheel", this.surMolette = (e) => this.molette(e), { passive:false });
    c.addEventListener("contextmenu", (e) => e.preventDefault());
    c.addEventListener("dblclick", (e) => this.doubleClic(e));

    vue.aFaireAvantRendu.add(this.pas = (dt) => this.avancer(dt));
  }

  /* ==========================================================================
     Application des mouvements aux deux caméras
     ========================================================================== */

  /** Position et verticale sont partagées : sinon la bascule perspective /
      orthographique ferait sauter la vue. */
  poser(position, haut){
    const v = this.vue;
    v.perspective.position.copy(position);
    v.ortho.position.copy(position);
    if(haut){ v.perspective.up.copy(haut); v.ortho.up.copy(haut); }
    v.perspective.lookAt(v.cible);
    v.ortho.lookAt(v.cible);
    v.majOrtho();
    v.majPlansCamera();
    v.invalider();
  }

  camera(){ return this.vue.camera(); }

  /* ==========================================================================
     Orbite
     ========================================================================== */
  orbiter(dx, dy){
    const v = this.vue;
    const c = this.camera();
    const vitesse = 0.005 * prefs.sensOrbite;
    const offset = new THREE.Vector3().subVectors(c.position, v.cible);

    if(prefs.orbite === "contrainte"){
      /* Coordonnées sphériques autour de la verticale de la scène. Le pôle
         est interdit d'un cheveu : à l'aplomb exact, la vue se retournerait. */
      const haut = v.haut;
      const versHaut = new THREE.Quaternion().setFromUnitVectors(haut, new THREE.Vector3(0,1,0));
      const versMonde = versHaut.clone().invert();
      const o = offset.clone().applyQuaternion(versHaut);
      const sph = new THREE.Spherical().setFromVector3(o);
      sph.theta -= dx * vitesse;
      sph.phi   -= dy * vitesse;
      sph.phi = Math.max(EPS, Math.min(Math.PI - EPS, sph.phi));
      o.setFromSpherical(sph).applyQuaternion(versMonde);
      this.poser(new THREE.Vector3().addVectors(v.cible, o), haut);
    }else{
      /* Orbite libre : on fait tourner l'écart caméra-cible autour des axes
         de l'écran. La verticale suit le mouvement, d'où l'absence de butée. */
      const droite = new THREE.Vector3().setFromMatrixColumn(c.matrix, 0).normalize();
      const hautCam = new THREE.Vector3().setFromMatrixColumn(c.matrix, 1).normalize();
      const q = new THREE.Quaternion()
        .setFromAxisAngle(hautCam, -dx * vitesse)
        .multiply(new THREE.Quaternion().setFromAxisAngle(droite, -dy * vitesse));
      offset.applyQuaternion(q);
      const nouveauHaut = hautCam.clone().applyQuaternion(q).normalize();
      this.poser(new THREE.Vector3().addVectors(v.cible, offset), nouveauHaut);
    }
  }

  /* ==========================================================================
     Panoramique
     ========================================================================== */
  deplacer(dx, dy){
    const v = this.vue;
    const c = this.camera();
    const h = v.canvas.clientHeight || 1;

    /* Un pixel de souris doit valoir un pixel de modèle : la conversion passe
       par la hauteur visible à la distance du point visé. */
    let hauteurVisible;
    if(v.projection === "ortho") hauteurVisible = v.ortho.top - v.ortho.bottom;
    else hauteurVisible = 2 * Math.tan(c.fov * Math.PI / 360) * v.distance();
    const k = hauteurVisible / h * prefs.sensPano;

    const droite = new THREE.Vector3().setFromMatrixColumn(c.matrix, 0).normalize();
    const haut = new THREE.Vector3().setFromMatrixColumn(c.matrix, 1).normalize();
    const d = new THREE.Vector3()
      .addScaledVector(droite, -dx * k)
      .addScaledVector(haut, dy * k);

    v.cible.add(d);
    this.poser(c.position.clone().add(d), null);
  }

  /* ==========================================================================
     Zoom
     ========================================================================== */

  /**
   * `facteur` < 1 rapproche. Avec « zoomer vers le curseur », le point visé
   * glisse vers ce qui se trouve sous la souris : c'est ce qui permet de
   * plonger dans un détail sans recadrer à la main.
   */
  zoomer(facteur, ev = null){
    const v = this.vue;
    const c = this.camera();
    const rayon = v.rayonModele || 1;
    const offset = new THREE.Vector3().subVectors(c.position, v.cible);
    const dNouveau = THREE.MathUtils.clamp(offset.length() * facteur, rayon * 1e-3, rayon * 200);
    const reel = dNouveau / Math.max(offset.length(), EPS);

    if(prefs.zoomVersCurseur && ev){
      const sousCurseur = this.pointSousCurseur(ev);
      if(sousCurseur){
        const glissement = new THREE.Vector3().subVectors(sousCurseur, v.cible).multiplyScalar(1 - reel);
        v.cible.add(glissement);
      }
    }
    this.poser(new THREE.Vector3().addVectors(v.cible, offset.multiplyScalar(reel)), null);
  }

  /**
   * Point du monde sous le curseur : la pièce touchée si le rayon en trouve
   * une, sinon le plan parallèle à l'écran passant par le point visé.
   */
  pointSousCurseur(ev){
    const v = this.vue;
    const touches = v.lancerRayon(ev);
    if(touches.length) return touches[0].point.clone();

    const c = this.camera();
    const normale = new THREE.Vector3();
    c.getWorldDirection(normale);
    const plan = new THREE.Plane().setFromNormalAndCoplanarPoint(normale, v.cible);
    if(!this._rc) this._rc = new THREE.Raycaster();
    this._rc.setFromCamera(v.ndc(ev), c);
    const p = new THREE.Vector3();
    return this._rc.ray.intersectPlane(plan, p) ? p : null;
  }

  /* ==========================================================================
     Évènements pointeur
     ========================================================================== */
  pointeurBas(ev){
    if(!this.actif) return;
    if(this.surPointeurBasAvant && this.surPointeurBasAvant(ev)) return;
    this.vue.canvas.focus?.();
    this.pointeurs.set(ev.pointerId, { x:ev.clientX, y:ev.clientY });

    /* Deux doigts : pincement pour le zoom, déplacement conjoint pour le
       panoramique — la convention de toutes les visionneuses tactiles. */
    if(ev.pointerType === "touch" && this.pointeurs.size === 2){
      this.geste = null;
      this.gestePince = this.etatPince();
      return;
    }
    if(ev.pointerType === "touch"){
      this.geste = "orbite";
      this.depart = { x:ev.clientX, y:ev.clientY, t:performance.now(), action:"orbite", ev };
      this.vue.canvas.setPointerCapture(ev.pointerId);
      return;
    }

    const bouton = nomBouton(ev.button);
    if(!bouton) return;
    const action = actionPourGeste(bouton, ev);
    this.depart = { x:ev.clientX, y:ev.clientY, t:performance.now(), action, bouton, ev, bouge:false };

    if(action === "orbite" || action === "panoramique" || action === "zoom"){
      /* Sans cela, le bouton du milieu déclenche le défilement automatique
         du navigateur, et le droit ouvre le menu contextuel. */
      ev.preventDefault();
      this.geste = action;
      this.vOrbite.set(0,0); this.vPano.set(0,0);
      this.vue.canvas.setPointerCapture(ev.pointerId);
      this.vue.canvas.classList.add(action === "panoramique" ? "pano" : "orbite");
    }
  }

  pointeurBouge(ev){
    const suivi = this.pointeurs.get(ev.pointerId);
    if(suivi){ suivi.x = ev.clientX; suivi.y = ev.clientY; }

    if(this.gestePince && this.pointeurs.size === 2){ this.pincer(); return; }
    if(!this.geste){ this.survoler(ev); return; }
    if(!suivi) return;

    const dx = ev.movementX ?? (ev.clientX - (this.dernierX ?? ev.clientX));
    const dy = ev.movementY ?? (ev.clientY - (this.dernierY ?? ev.clientY));
    this.dernierX = ev.clientX; this.dernierY = ev.clientY;
    if(this.depart && (Math.abs(ev.clientX - this.depart.x) > 3 || Math.abs(ev.clientY - this.depart.y) > 3))
      this.depart.bouge = true;

    if(this.geste === "orbite"){
      this.orbiter(dx, dy);
      if(prefs.inertie) this.vOrbite.set(dx, dy);
    }else if(this.geste === "panoramique"){
      this.deplacer(dx, dy);
      if(prefs.inertie) this.vPano.set(dx, dy);
    }else if(this.geste === "zoom"){
      this.zoomer(Math.pow(1.005, dy * prefs.sensZoom), null);
    }
  }

  pointeurHaut(ev){
    this.pointeurs.delete(ev.pointerId);
    if(this.pointeurs.size < 2) this.gestePince = null;
    try{ this.vue.canvas.releasePointerCapture(ev.pointerId); }catch(e){}
    this.vue.canvas.classList.remove("orbite", "pano");
    this.dernierX = this.dernierY = null;

    const d = this.depart;
    this.geste = null;
    this.depart = null;
    if(!d) return;

    /* Un clic, c'est un appui qui n'a pas bougé : au-delà de trois pixels ou
       d'une demi-seconde, l'utilisateur a voulu manipuler la vue. */
    const court = performance.now() - d.t < 500;
    const immobile = Math.abs(ev.clientX - d.x) < 4 && Math.abs(ev.clientY - d.y) < 4;
    /* Un clic gauche sélectionne toujours, même dans les préréglages où le
       bouton gauche sert à orbiter (portable, pavé tactile) : ce qui distingue
       les deux gestes, c'est le déplacement, pas le bouton. */
    if(court && immobile && !d.bouge){
      if(d.bouton === "gauche" || d.action === "selection" || ev.pointerType === "touch")
        this.surSelection?.(ev);
      this.surClic?.(ev, d.action);
    }
  }

  survoler(ev){
    if(this.surSurvol) this.surSurvol(ev);
  }

  doubleClic(ev){
    /* Double-clic sur une pièce : elle devient le centre de rotation. C'est
       le geste qui évite de « perdre » le modèle en tournant autour du vide. */
    const touches = this.vue.lancerRayon(ev);
    if(!touches.length) return;
    this.animerVersCible(touches[0].point.clone());
  }

  /* ---------------- pincement ---------------- */
  etatPince(){
    const [a, b] = [...this.pointeurs.values()];
    return {
      dist: Math.hypot(a.x - b.x, a.y - b.y),
      cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2,
    };
  }

  pincer(){
    const p = this.etatPince();
    const ancien = this.gestePince;
    if(ancien.dist > 1 && p.dist > 1){
      const f = ancien.dist / p.dist;
      if(Math.abs(1 - f) > 0.002) this.zoomer(Math.pow(f, prefs.sensZoom));
    }
    this.deplacer(p.cx - ancien.cx, p.cy - ancien.cy);
    this.gestePince = p;
  }

  /* ---------------- molette ---------------- */
  molette(ev){
    if(!this.actif) return;
    ev.preventDefault();

    /* Sur pavé tactile, le pincement arrive sous forme de molette + Ctrl :
       c'est la seule façon de le distinguer d'un défilement à deux doigts. */
    const pincement = ev.ctrlKey && ev.deltaMode === 0 && Math.abs(ev.deltaY) < 50;
    if(prefs.paveTactile && !pincement){
      this.deplacer(-ev.deltaX, -ev.deltaY);
      return;
    }
    let delta = ev.deltaY;
    if(ev.deltaMode === 1) delta *= 16;        // lignes
    else if(ev.deltaMode === 2) delta *= 100;  // pages
    if(prefs.moletteInversee) delta = -delta;
    const facteur = Math.pow(0.9988, -delta * prefs.sensZoom * (pincement ? 2.2 : 1));
    this.zoomer(facteur, ev);
  }

  /* ==========================================================================
     Inertie
     ========================================================================== */
  avancer(dt){
    if(this.animation) this.avancerAnimation(dt);
    if(!prefs.inertie || this.geste) return;
    const frein = Math.pow(0.0025, dt);   // ~amorti en 0,4 s
    if(this.vOrbite.lengthSq() > 0.02){
      this.vOrbite.multiplyScalar(frein);
      this.orbiter(this.vOrbite.x * dt * 60 * 0.2, this.vOrbite.y * dt * 60 * 0.2);
    }else this.vOrbite.set(0,0);
    if(this.vPano.lengthSq() > 0.02){
      this.vPano.multiplyScalar(frein);
      this.deplacer(this.vPano.x * dt * 60 * 0.2, this.vPano.y * dt * 60 * 0.2);
    }else this.vPano.set(0,0);
  }

  /* ==========================================================================
     Vues normalisées et animations
     ========================================================================== */

  /** Direction depuis laquelle on regarde, en coordonnées du monde. */
  directionCourante(){
    return new THREE.Vector3().subVectors(this.camera().position, this.vue.cible).normalize();
  }

  directionVue(nom){
    const z = this.vue.haut.z === 1;
    const d = {
      avant:   z ? [0,-1,0] : [0,0,1],
      arriere: z ? [0,1,0]  : [0,0,-1],
      gauche:  [-1,0,0],
      droite:  [1,0,0],
      dessus:  z ? [0,0,1]  : [0,1,0],
      dessous: z ? [0,0,-1] : [0,-1,0],
      iso:     z ? [1,-1,0.8] : [1,0.8,1],
    }[nom];
    return d ? new THREE.Vector3(...d).normalize() : null;
  }

  /**
   * Verticale d'écran à adopter pour une direction donnée. Vu de dessus, la
   * verticale de la scène est dans l'axe du regard : il faut en choisir une
   * autre, et la convention des plans veut que ce soit l'axe de profondeur.
   */
  hautPour(direction){
    const haut = this.vue.haut.clone();
    if(Math.abs(direction.dot(haut)) > 0.999){
      const z = this.vue.haut.z === 1;
      const signe = direction.dot(haut) > 0 ? 1 : -1;
      return z ? new THREE.Vector3(0, signe, 0) : new THREE.Vector3(0, 0, -signe);
    }
    return haut;
  }

  allerVersVue(nom, animer = true){
    const d = this.directionVue(nom);
    if(d) this.allerVersDirection(d, animer);
  }

  /** Amène la caméra sur une direction, à distance inchangée. */
  allerVersDirection(direction, animer = true){
    const v = this.vue;
    const dist = Math.max(v.distance(), (v.rayonModele || 1) * 0.01);
    const arrivee = new THREE.Vector3().addVectors(v.cible, direction.clone().normalize().multiplyScalar(dist));
    const hautArrivee = this.hautPour(direction);
    if(!animer){ this.poser(arrivee, hautArrivee); return; }
    this.animation = {
      t:0, duree:0.42,
      posDepart:this.camera().position.clone(),
      posArrivee:arrivee,
      hautDepart:this.camera().up.clone(),
      hautArrivee,
      cibleDepart:v.cible.clone(),
      cibleArrivee:v.cible.clone(),
    };
    v.invalider();
  }

  /** Change de point visé sans bouger la caméra de place (double-clic). */
  animerVersCible(nouvelleCible){
    const v = this.vue;
    this.animation = {
      t:0, duree:0.35,
      posDepart:this.camera().position.clone(),
      posArrivee:this.camera().position.clone(),
      hautDepart:this.camera().up.clone(),
      hautArrivee:this.camera().up.clone(),
      cibleDepart:v.cible.clone(),
      cibleArrivee:nouvelleCible,
    };
    v.invalider();
  }

  avancerAnimation(dt){
    const a = this.animation;
    a.t = Math.min(1, a.t + dt / a.duree);
    /* Adoucissement aux deux bouts : un déplacement de caméra linéaire donne
       l'impression d'un saut, même à la bonne durée. */
    const k = a.t < 0.5 ? 4*a.t*a.t*a.t : 1 - Math.pow(-2*a.t + 2, 3) / 2;

    const v = this.vue;
    v.cible.copy(a.cibleDepart).lerp(a.cibleArrivee, k);

    /* La position suit un arc autour de la cible, pas une corde : sans cela
       la caméra traverserait le modèle en passant d'une face à l'autre. */
    const d0 = new THREE.Vector3().subVectors(a.posDepart, a.cibleDepart);
    const d1 = new THREE.Vector3().subVectors(a.posArrivee, a.cibleArrivee);
    const r0 = d0.length(), r1 = d1.length();
    const q = new THREE.Quaternion().setFromUnitVectors(d0.clone().normalize(), d1.clone().normalize());
    const qk = new THREE.Quaternion().slerpQuaternions(new THREE.Quaternion(), q, k);
    const dir = d0.clone().normalize().applyQuaternion(qk).multiplyScalar(r0 + (r1 - r0) * k);

    const haut = a.hautDepart.clone().lerp(a.hautArrivee, k).normalize();
    this.poser(new THREE.Vector3().addVectors(v.cible, dir), haut);

    if(a.t >= 1){ this.animation = null; this.poser(a.posArrivee, a.hautArrivee); }
  }

  /** Remet la verticale de la scène d'aplomb (sortie d'orbite libre). */
  redresser(){
    this.allerVersDirection(this.directionCourante(), true);
  }

  detruire(){
    const c = this.vue.canvas;
    c.removeEventListener("pointerdown", this.surPointeurBas);
    c.removeEventListener("pointermove", this.surPointeurBouge);
    c.removeEventListener("pointerup", this.surPointeurHaut);
    c.removeEventListener("pointercancel", this.surPointeurHaut);
    c.removeEventListener("wheel", this.surMolette);
    this.vue.aFaireAvantRendu.delete(this.pas);
  }
}
