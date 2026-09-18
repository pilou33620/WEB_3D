/* =============================================================================
   Visionneuse 3D — 07b-coupe.js
   Coupe interactive : axes X/Y/Z ou face sélectionnée sur le modèle (style CAO).

   Permet d'ouvrir une vue en coupe selon n'importe quelle face du modèle ou axe :
   - Sélection interactive d'une face avec surbrillance B-Rep (06-topologie.js).
   - Plan visuel translucide ambré avec liseré contrasté ajusté à la boîte englobante.
   - Manipulateur 3D (flèche normale et anneau) avec déplacement direct à la souris.
   - Réglage de décalage en millimètres (curseur + saisie numérique directe).
   - Inversion du côté coupé (⇄) et alignement de vue normale (👁 Face).
   ============================================================================= */
"use strict";

import * as THREE from "three";
import { faceSous, geometrieFace, contourFace, cote } from "./06-topologie.js";

const COULEUR_PLAN = 0xf5d26e;
const COULEUR_BORDURE = 0x8a7035;
const COULEUR_GIZMO = 0x1976d2;
const CYAN = 0x8af0ff;

export class CoupeManager {
  constructor(vue, nav, conteneur){
    this.vue = vue;
    this.nav = nav;
    this.conteneur = conteneur;

    // État de la coupe
    this.actif = false;
    this.mode = "x";                // "x" | "y" | "z" | "face"
    this.inverse = false;
    this.afficherPlan = true;
    this.enChoixFace = false;

    // Repère de coupe
    this.normale = new THREE.Vector3(1, 0, 0);
    this.pointRef = new THREE.Vector3(0, 0, 0);
    this.offsetMm = 0;
    this.minMm = -50;
    this.maxMm = 50;
    this.dernierCentre = new THREE.Vector3(0, 0, 0);
    this.descriptionFace = "";

    // 3D Objects
    this.groupe3D = new THREE.Group();
    this.groupe3D.name = "coupeVisualisation";
    this.vue.annotations.add(this.groupe3D);

    // Plan visuel (quad translucide)
    this.planMesh = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({
        color: COULEUR_PLAN,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    this.planMesh.renderOrder = 3;

    // Bordure du plan
    this.planBordure = new THREE.LineLoop(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        color: COULEUR_BORDURE,
        transparent: true,
        opacity: 0.85,
        depthTest: false,
      })
    );
    this.planBordure.renderOrder = 4;

    // Manipulateur 3D (Gizmo flèche + anneau)
    this.gizmoGroupe = new THREE.Group();
    this.gizmoGroupe.name = "gizmoCoupe";
    this.gizmoGroupe.renderOrder = 10;
    this.creerManipulateur3D();

    // Surbrillance de sélection de face
    this.surbrillanceFace = new THREE.Group();
    this.surbrillanceFace.renderOrder = 8;
    this.groupe3D.add(this.surbrillanceFace);

    this.groupe3D.add(this.planMesh, this.planBordure, this.gizmoGroupe);
    this.groupe3D.visible = false;

    // Étiquette HTML de cote en millimètres
    this.etiquette = document.createElement("div");
    this.etiquette.className = "cote-coupe";
    this.etiquette.hidden = true;
    this.conteneur.appendChild(this.etiquette);

    this.etiquette.onclick = (e) => {
      e.stopPropagation();
      const input = this.panneau?.querySelector("#coupeDist");
      if(input){ input.focus(); input.select(); }
    };

    // Glissement 3D à la souris
    this.glissement = null;

    // Mise à jour de l'étiquette après rendu de la caméra
    this.vue.apresRendu.add(() => this.majPositionEtiquette());
  }

  creerManipulateur3D(){
    const matGizmo = new THREE.MeshBasicMaterial({
      color: COULEUR_GIZMO,
      depthTest: false,
      transparent: true,
      opacity: 0.92,
    });

    // Corps de flèche (cylindre le long de Y)
    const shaftGeo = new THREE.CylinderGeometry(0.8, 0.8, 20, 16);
    shaftGeo.translate(0, 10, 0);
    this.flecheShaft = new THREE.Mesh(shaftGeo, matGizmo);

    // Cône de flèche
    const coneGeo = new THREE.ConeGeometry(2.6, 7, 16);
    coneGeo.translate(0, 23.5, 0);
    this.flecheCone = new THREE.Mesh(coneGeo, matGizmo);

    // Anneau de base dans le plan XZ (perpendiculaire à Y)
    const ringGeo = new THREE.TorusGeometry(8, 0.6, 8, 32);
    ringGeo.rotateX(Math.PI / 2);
    this.anneau = new THREE.Mesh(ringGeo, matGizmo);

    // Disque invisible pour faciliter la sélection et le glisser-déposer à la souris
    const grabGeo = new THREE.CylinderGeometry(8.5, 8.5, 2.5, 16);
    const grabMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    this.grabZone = new THREE.Mesh(grabGeo, grabMat);

    this.gizmoGroupe.add(this.flecheShaft, this.flecheCone, this.anneau, this.grabZone);
  }

  /* ==========================================================================
     Activation / Désactivation
     ========================================================================== */
  basculer(){
    this.definirActif(!this.actif);
  }

  definirActif(actif){
    this.actif = !!actif;
    if(this.bOutil) this.bOutil.classList.toggle("on", this.actif);

    if(!this.panneau) this.construirePanneau();
    this.panneau.hidden = !this.actif;

    if(!this.actif){
      this.enChoixFace = false;
      this.groupe3D.visible = false;
      this.etiquette.hidden = true;
      this.viderSurbrillanceFace();
      this.vue.definirCoupe(false);
      this.vue.invalider();
      return;
    }

    if(this.mode === "face" && !this.faceSelectionnee){
      this.activerChoixFace();
    }else{
      this.appliquer();
    }
  }

  /* ==========================================================================
     Configuration de l'axe ou de la face
     ========================================================================== */
  definirAxe(axe){
    if(axe === "face"){
      this.mode = "face";
      this.majPanneauAxes();
      if(!this.faceSelectionnee){
        this.activerChoixFace();
      }else{
        this.appliquer();
      }
      return;
    }

    this.mode = axe;
    this.enChoixFace = false;
    this.viderSurbrillanceFace();
    this.descriptionFace = "";

    const b = this.vue.boite() || new THREE.Box3(new THREE.Vector3(-1,-1,-1), new THREE.Vector3(1,1,1));
    const centre = b.getCenter(new THREE.Vector3());

    if(axe === "x") this.normale.set(1, 0, 0);
    else if(axe === "y") this.normale.set(0, 1, 0);
    else if(axe === "z") this.normale.set(0, 0, 1);

    this.pointRef.copy(centre);
    this.offsetMm = 0;
    this.majBornes();
    this.majPanneauAxes();
    this.appliquer();
  }

  /* ==========================================================================
     Sélection interactive de face
     ========================================================================== */
  activerChoixFace(){
    this.mode = "face";
    this.enChoixFace = true;
    this.majPanneauAxes();
    const invite = this.panneau?.querySelector("#coupeInvite");
    if(invite) invite.hidden = false;
    this.vue.canvas.style.cursor = "crosshair";
    this.vue.invalider();
  }

  desactiverChoixFace(){
    this.enChoixFace = false;
    const invite = this.panneau?.querySelector("#coupeInvite");
    if(invite) invite.hidden = true;
    this.vue.canvas.style.cursor = "";
    this.viderSurbrillanceFace();
    this.vue.invalider();
  }

  survoler(ev){
    if(!this.actif || !this.enChoixFace) return;
    const touches = this.vue.lancerRayon(ev);
    if(!touches.length){
      this.viderSurbrillanceFace();
      this.vue.invalider();
      return;
    }

    const t = touches[0];
    const entite = faceSous(this.vue, t);
    this.afficherSurbrillanceFace(entite, t);
    this.vue.invalider();
  }

  cliquer(ev){
    if(!this.actif || !this.enChoixFace) return false;
    const touches = this.vue.lancerRayon(ev);
    if(!touches.length) return false;

    const t = touches[0];
    const entite = faceSous(this.vue, t);

    let norm, ptRef, nom;
    if(entite && entite.type === "plan"){
      norm = entite.normale.clone().normalize();
      ptRef = entite.centre.clone();
      nom = "Face plane";
    }else{
      // Fallback pour STL / OBJ / surface quelconque
      const normalMatrix = new THREE.Matrix3().getNormalMatrix(t.object.matrixWorld);
      norm = (t.face?.normal ? t.face.normal.clone().applyMatrix3(normalMatrix) : new THREE.Vector3(0,0,1)).normalize();
      ptRef = t.point.clone();
      nom = entite?.type ? `Surface (${entite.type})` : "Face";
    }

    this.poserFace(norm, ptRef, nom);
    this.desactiverChoixFace();
    return true;
  }

  poserFace(normale, pointRef, description = "Face plane"){
    this.mode = "face";
    this.faceSelectionnee = true;
    this.normale.copy(normale).normalize();
    this.pointRef.copy(pointRef);
    this.offsetMm = 0;
    this.descriptionFace = description;

    this.majBornes();
    this.majPanneauAxes();
    this.majPanneauValeurs();
    this.appliquer();
  }

  afficherSurbrillanceFace(entite, touche){
    this.viderSurbrillanceFace();
    if(!entite && !touche) return;

    if(entite){
      try{
        const gFace = geometrieFace(entite);
        const gBord = contourFace(entite);
        const nappe = new THREE.Mesh(gFace, new THREE.MeshBasicMaterial({
          color: CYAN,
          transparent: true,
          opacity: 0.35,
          side: THREE.DoubleSide,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -3,
          polygonOffsetUnits: -3,
        }));
        const bord = new THREE.LineSegments(gBord, new THREE.LineBasicMaterial({
          color: CYAN,
          depthTest: false,
          transparent: true,
          opacity: 0.95,
        }));
        this.surbrillanceFace.add(nappe, bord);
      }catch(err){}
    }else if(touche && touche.face){
      // Triangle simple
      const pos = touche.object.geometry.attributes.position;
      const M = touche.object.matrixWorld;
      const pts = [
        new THREE.Vector3().fromBufferAttribute(pos, touche.face.a).applyMatrix4(M),
        new THREE.Vector3().fromBufferAttribute(pos, touche.face.b).applyMatrix4(M),
        new THREE.Vector3().fromBufferAttribute(pos, touche.face.c).applyMatrix4(M),
      ];
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      geo.computeVertexNormals();
      const nappe = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        color: CYAN, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false,
      }));
      this.surbrillanceFace.add(nappe);
    }
  }

  viderSurbrillanceFace(){
    while(this.surbrillanceFace.children.length){
      const c = this.surbrillanceFace.children.pop();
      c.geometry?.dispose();
      c.material?.dispose();
    }
  }

  /* ==========================================================================
     Calcul des bornes du modèle le long de la normale
     ========================================================================== */
  majBornes(){
    const b = this.vue.boite() || new THREE.Box3(new THREE.Vector3(-10,-10,-10), new THREE.Vector3(10,10,10));
    const coins = [
      new THREE.Vector3(b.min.x, b.min.y, b.min.z),
      new THREE.Vector3(b.min.x, b.min.y, b.max.z),
      new THREE.Vector3(b.min.x, b.max.y, b.min.z),
      new THREE.Vector3(b.min.x, b.max.y, b.max.z),
      new THREE.Vector3(b.max.x, b.min.y, b.min.z),
      new THREE.Vector3(b.max.x, b.min.y, b.max.z),
      new THREE.Vector3(b.max.x, b.max.y, b.min.z),
      new THREE.Vector3(b.max.x, b.max.y, b.max.z),
    ];

    let minProj = Infinity, maxProj = -Infinity;
    for(const c of coins){
      const p = c.clone().sub(this.pointRef).dot(this.normale);
      minProj = Math.min(minProj, p);
      maxProj = Math.max(maxProj, p);
    }

    const marge = Math.max(2, (maxProj - minProj) * 0.05);
    this.minMm = Math.floor(minProj - marge);
    this.maxMm = Math.ceil(maxProj + marge);

    // Ajuster le pas du curseur selon la taille de la pièce
    const etendue = this.maxMm - this.minMm;
    this.pasCurseur = etendue > 500 ? 1 : (etendue > 50 ? 0.5 : 0.1);

    if(this.panneau){
      const posSlider = this.panneau.querySelector("#coupePos");
      if(posSlider){
        posSlider.min = this.minMm;
        posSlider.max = this.maxMm;
        posSlider.step = this.pasCurseur;
        posSlider.value = this.offsetMm;
      }
    }
  }

  /* ==========================================================================
     Application de la coupe
     ========================================================================== */
  definirOffset(valMm){
    this.offsetMm = THREE.MathUtils.clamp(valMm, this.minMm, this.maxMm);
    this.majPanneauValeurs();
    this.appliquer();
  }

  basculerInverse(){
    this.inverse = !this.inverse;
    if(this.panneau){
      this.panneau.querySelector("#coupeInv")?.classList.toggle("on", this.inverse);
    }
    this.appliquer();
  }

  basculerPlanVisible(){
    this.afficherPlan = !this.afficherPlan;
    this.groupe3D.visible = this.actif && this.afficherPlan;
    this.etiquette.hidden = !this.actif || !this.afficherPlan;
    if(this.panneau){
      this.panneau.querySelector("#coupePlanVis")?.classList.toggle("on", this.afficherPlan);
    }
    this.vue.invalider();
  }

  alignerVueNormale(){
    if(!this.actif) return;
    const dir = this.inverse ? this.normale.clone().negate() : this.normale.clone();
    if(this.dernierCentre && this.vue.cible) this.vue.cible.copy(this.dernierCentre);
    this.nav.allerVersDirection(dir, true);
  }

  appliquer(){
    if(!this.actif) return;

    // Point de passage de la coupe
    const pCoupe = this.pointRef.clone().addScaledVector(this.normale, this.offsetMm);

    // Normale Three.js du plan de coupe : pointe vers la matière conservée
    const nKept = this.inverse ? this.normale.clone() : this.normale.clone().negate();
    const plan = new THREE.Plane().setFromNormalAndCoplanarPoint(nKept, pCoupe);

    this.vue.definirCoupe(true, plan);

    // Mise à jour de la visualisation 3D
    this.majGeometriePlan3D(pCoupe);
    this.groupe3D.visible = this.afficherPlan;
    this.etiquette.hidden = !this.afficherPlan;
    this.majPositionEtiquette();

    this.vue.invalider();
  }

  /* ==========================================================================
     Construction géométrique du plan visuel et du manipulateur 3D
     ========================================================================== */
  majGeometriePlan3D(pCoupe){
    const b = this.vue.boite() || new THREE.Box3(new THREE.Vector3(-10,-10,-10), new THREE.Vector3(10,10,10));
    const cBox = b.getCenter(new THREE.Vector3());
    const rDiag = b.getSize(new THREE.Vector3()).length() / 2;

    const n = this.normale.clone().normalize();
    const cProj = cBox.clone().sub(n.clone().multiplyScalar(cBox.clone().sub(pCoupe).dot(n)));

    // Repère orthonormé tangent au plan de coupe
    const refUp = Math.abs(n.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
    const u = new THREE.Vector3().crossVectors(refUp, n).normalize();
    const v = new THREE.Vector3().crossVectors(n, u).normalize();

    // Projection de la boîte englobante pour cadrer parfaitement le quad
    const coins = [
      new THREE.Vector3(b.min.x, b.min.y, b.min.z),
      new THREE.Vector3(b.min.x, b.min.y, b.max.z),
      new THREE.Vector3(b.min.x, b.max.y, b.min.z),
      new THREE.Vector3(b.min.x, b.max.y, b.max.z),
      new THREE.Vector3(b.max.x, b.min.y, b.min.z),
      new THREE.Vector3(b.max.x, b.min.y, b.max.z),
      new THREE.Vector3(b.max.x, b.max.y, b.min.z),
      new THREE.Vector3(b.max.x, b.max.y, b.max.z),
    ];

    let uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity;
    for(const c of coins){
      const d = c.clone().sub(cProj);
      const du = d.dot(u), dv = d.dot(v);
      uMin = Math.min(uMin, du); uMax = Math.max(uMax, du);
      vMin = Math.min(vMin, dv); vMax = Math.max(vMax, dv);
    }

    const marge = Math.max(8, (uMax - uMin) * 0.15, (vMax - vMin) * 0.15);
    uMin -= marge; uMax += marge;
    vMin -= marge; vMax += marge;

    const uMid = (uMin + uMax) / 2;
    const vMid = (vMin + vMax) / 2;
    const pCenter = cProj.clone().addScaledVector(u, uMid).addScaledVector(v, vMid);
    this.dernierCentre.copy(pCenter);

    const wHalf = (uMax - uMin) / 2;
    const hHalf = (vMax - vMin) / 2;

    const K0 = pCenter.clone().addScaledVector(u, -wHalf).addScaledVector(v, -hHalf);
    const K1 = pCenter.clone().addScaledVector(u,  wHalf).addScaledVector(v, -hHalf);
    const K2 = pCenter.clone().addScaledVector(u,  wHalf).addScaledVector(v,  hHalf);
    const K3 = pCenter.clone().addScaledVector(u, -wHalf).addScaledVector(v,  hHalf);

    // Quad (2 triangles double-face)
    const sommetsQuad = new Float32Array([
      K0.x, K0.y, K0.z,  K1.x, K1.y, K1.z,  K2.x, K2.y, K2.z,
      K0.x, K0.y, K0.z,  K2.x, K2.y, K2.z,  K3.x, K3.y, K3.z,
    ]);
    this.planMesh.geometry.dispose();
    this.planMesh.geometry = new THREE.BufferGeometry();
    this.planMesh.geometry.setAttribute("position", new THREE.BufferAttribute(sommetsQuad, 3));
    this.planMesh.geometry.computeVertexNormals();

    // Ligne de contour
    const sommetsBord = new Float32Array([
      K0.x, K0.y, K0.z,  K1.x, K1.y, K1.z,  K2.x, K2.y, K2.z,  K3.x, K3.y, K3.z,
    ]);
    this.planBordure.geometry.dispose();
    this.planBordure.geometry = new THREE.BufferGeometry();
    this.planBordure.geometry.setAttribute("position", new THREE.BufferAttribute(sommetsBord, 3));

    // Manipulateur (Gizmo)
    const echelleGizmo = Math.min(Math.max(rDiag * 0.22, 10), Math.max(wHalf, hHalf) * 0.7);
    this.tailleGizmo = echelleGizmo;
    this.gizmoGroupe.position.copy(pCenter);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
    this.gizmoGroupe.quaternion.copy(q);

    const fact = echelleGizmo / 20;
    this.gizmoGroupe.scale.set(fact, fact, fact);

    // Ancre pour l'étiquette de cote en millimètres
    this.ancreEtiquette = pCenter.clone().addScaledVector(n, echelleGizmo * 1.05);
  }

  majPositionEtiquette(){
    if(!this.actif || !this.afficherPlan || !this.ancreEtiquette || this.enChoixFace){
      this.etiquette.hidden = true;
      return;
    }

    const p = this.vue.versEcran(this.ancreEtiquette);
    if(p.z >= 1){
      this.etiquette.hidden = true;
      return;
    }

    this.etiquette.hidden = false;
    this.etiquette.style.left = `${p.x}px`;
    this.etiquette.style.top = `${p.y - 12}px`;

    const signe = this.offsetMm > 0 ? "+" : "";
    const txtMm = `${signe}${cote(this.offsetMm, 2)} mm`;
    this.etiquette.textContent = txtMm;
  }

  /* ==========================================================================
     Glissement 3D du manipulateur
     ========================================================================== */
  testerClicGizmo(ev){
    if(!this.actif || !this.afficherPlan || this.enChoixFace) return false;

    const rc = new THREE.Raycaster();
    rc.setFromCamera(this.vue.ndc(ev), this.vue.camera());
    const touches = rc.intersectObjects(this.gizmoGroupe.children, true);

    if(touches.length > 0){
      this.demarrerGlissement3D(ev);
      return true;
    }
    return false;
  }

  demarrerGlissement3D(ev){
    this.glissement = {
      startX: ev.clientX,
      startY: ev.clientY,
      offsetInitial: this.offsetMm,
      normale: this.normale.clone(),
      pointRef: this.pointRef.clone(),
    };

    const canvas = this.vue.canvas;
    const surMove = (e) => this.bougerGlissement3D(e);
    const surUp = (e) => {
      window.removeEventListener("pointermove", surMove);
      window.removeEventListener("pointerup", surUp);
      window.removeEventListener("pointercancel", surUp);
      this.glissement = null;
      try{ canvas.releasePointerCapture(ev.pointerId); }catch(_){}
      this.vue.canvas.style.cursor = "";
    };

    window.addEventListener("pointermove", surMove);
    window.addEventListener("pointerup", surUp);
    window.addEventListener("pointercancel", surUp);
    try{ canvas.setPointerCapture(ev.pointerId); }catch(_){}
    this.vue.canvas.style.cursor = "grabbing";
  }

  bougerGlissement3D(ev){
    if(!this.glissement) return;

    // Calcul analytique de la distance le long de la droite de normale
    const rc = new THREE.Raycaster();
    rc.setFromCamera(this.vue.ndc(ev), this.vue.camera());
    const ray = rc.ray;

    const O = ray.origin;
    const d = ray.direction;
    const P0 = this.glissement.pointRef;
    const n = this.glissement.normale;
    const w0 = O.clone().sub(P0);

    const b = d.dot(n);
    const e = n.dot(w0);
    const denom = 1 - b * b;

    if(denom > 0.005){
      const dd = d.dot(w0);
      const s = (b * dd - e) / denom;
      this.definirOffset(s);
    }else{
      // Vue presque parallèle à la normale : delta écran
      const dy = ev.clientY - this.glissement.startY;
      const sensibilite = (this.maxMm - this.minMm) * 0.0025;
      this.definirOffset(this.glissement.offsetInitial - dy * sensibilite);
    }
  }

  /* ==========================================================================
     Interface utilisateur (Panneau flottant)
     ========================================================================== */
  construirePanneau(){
    const p = document.createElement("div");
    p.id = "panneauCoupe";
    p.innerHTML = `
      <span class="etiq">Coupe</span>
      <span class="axes" id="coupeAxes">
        <button class="tb mini ${this.mode === 'x' ? 'on' : ''}" data-axe="x" title="Coupe selon l'axe X">X</button>
        <button class="tb mini ${this.mode === 'y' ? 'on' : ''}" data-axe="y" title="Coupe selon l'axe Y">Y</button>
        <button class="tb mini ${this.mode === 'z' ? 'on' : ''}" data-axe="z" title="Coupe selon l'axe Z">Z</button>
        <button class="tb mini ${this.mode === 'face' ? 'on' : ''}" data-axe="face" id="coupeBtnFace" title="Couper selon une face sélectionnée sur le modèle">📐 Face</button>
      </span>

      <div class="coupe-reglage" id="coupeReglage">
        <input type="range" id="coupePos" min="${this.minMm}" max="${this.maxMm}" step="${this.pasCurseur || 0.5}" value="${this.offsetMm}">
        <div class="coupe-val-box">
          <input type="number" id="coupeDist" class="coupe-input-num" step="0.5" value="${this.offsetMm.toFixed(2)}">
          <span class="coupe-unite">mm</span>
        </div>
        <button class="tb mini" id="coupeZero" title="Remettre le décalage à 0 mm">0</button>
      </div>

      <span class="coupe-actions">
        <button class="tb mini ${this.inverse ? 'on' : ''}" id="coupeInv" title="Inverser le côté coupé (garder l'autre moitié)">⇄</button>
        <button class="tb mini" id="coupeVueNormale" title="Aligner la vue perpendiculaire au plan de coupe">👁 Face</button>
        <button class="tb mini ${this.afficherPlan ? 'on' : ''}" id="coupePlanVis" title="Afficher/Masquer le plan jaune et le manipulateur">⛶ Plan</button>
        <button class="tb mini" id="coupeFermer" title="Fermer le plan de coupe">✕</button>
      </span>

      <span class="coupe-invite" id="coupeInvite" hidden>👆 Cliquez une face du modèle…</span>
    `;

    this.conteneur.appendChild(p);
    this.panneau = p;
    this.brancherPanneau();
  }

  brancherPanneau(){
    const p = this.panneau;

    // Choix des axes / face
    p.querySelector("#coupeAxes").onclick = (e) => {
      const b = e.target.closest("button[data-axe]");
      if(!b) return;
      this.definirAxe(b.dataset.axe);
    };

    // Curseur de position
    const pos = p.querySelector("#coupePos");
    pos.oninput = (e) => {
      this.definirOffset(parseFloat(e.target.value) || 0);
    };

    // Saisie numérique directe
    const dist = p.querySelector("#coupeDist");
    dist.onchange = (e) => {
      this.definirOffset(parseFloat(e.target.value) || 0);
    };

    // Remise à zéro
    p.querySelector("#coupeZero").onclick = () => {
      this.definirOffset(0);
    };

    // Inverser
    p.querySelector("#coupeInv").onclick = () => {
      this.basculerInverse();
    };

    // Vue normale
    p.querySelector("#coupeVueNormale").onclick = () => {
      this.alignerVueNormale();
    };

    // Visibilité du plan
    p.querySelector("#coupePlanVis").onclick = () => {
      this.basculerPlanVisible();
    };

    // Fermer
    p.querySelector("#coupeFermer").onclick = () => {
      this.definirActif(false);
    };
  }

  majPanneauAxes(){
    if(!this.panneau) return;
    const btns = this.panneau.querySelectorAll("#coupeAxes button[data-axe]");
    for(const b of btns){
      b.classList.toggle("on", b.dataset.axe === this.mode);
    }
  }

  majPanneauValeurs(){
    if(!this.panneau) return;
    const pos = this.panneau.querySelector("#coupePos");
    const dist = this.panneau.querySelector("#coupeDist");
    if(pos) pos.value = this.offsetMm;
    if(dist && document.activeElement !== dist){
      dist.value = (Math.round(this.offsetMm * 100) / 100).toFixed(2);
    }
  }
}
