/* =============================================================================
   Visionneuse 3D — 13-deplacement.js
   Placer un fichier par rapport aux autres : deux cartes exportées chacune
   dans son repère arrivent l'une sur l'autre à l'origine ; on les écarte ici
   avant de chercher les collisions. Trois façons, de la plus libre à la plus
   exacte :

   · à la souris : panneau ouvert, glisser une pièce emporte son fichier dans
     le plan horizontal — avec Maj, le long de la verticale seulement ;
   · au clavier : position en millimètres, rotation en degrés ;
   · par contrainte : une face de la carte à déplacer, puis une face de
     l'autre. Deux plans se plaquent l'un contre l'autre (avec un décalage —
     la hauteur d'une entretoise), deux cylindres se mettent sur le même axe
     (trou sur trou, broche dans son trou).

   On déplace le groupe du fichier entier, jamais une pièce : c'est la carte
   qu'on assemble, ses composants restent où la CAO les a mis. La rotation se
   fait autour du centre de la carte — autour de l'origine du fichier, un
   demi-tour l'enverrait à l'autre bout du repère.
   ============================================================================= */
"use strict";

import * as THREE from "three";
import { faceSous, geometrieFace } from "./06-topologie.js";

const $ = (id) => document.getElementById(id);
const DEG = Math.PI / 180;
const AXES = ["x", "y", "z"];

/* -----------------------------------------------------------------------------
   Contraintes — sans interface, pour pouvoir être vérifiées hors navigateur
   --------------------------------------------------------------------------- */

/** Tourne un fichier autour d'un point du monde (le parent est le modèle, sans transformation). */
function pivoter(g, q, pivot){
  g.position.sub(pivot).applyQuaternion(q).add(pivot);
  g.quaternion.premultiply(q);
  g.updateMatrixWorld(true);
}

/**
 * Amène la face `A` (portée par le fichier `g`) sur la face `B` d'un autre
 * fichier. A et B sont des faces reconnues par 06-topologie, en coordonnées
 * du monde : { type:"plan", centre, normale } ou { type:"cylindre", axe, point }.
 * Rend un message d'erreur, ou null si la contrainte est appliquée.
 */
export function contraindre(g, A, B, decalage = 0){
  if(A.type === "plan" && B.type === "plan"){
    /* Les normales sont orientées vers l'extérieur de la matière : deux faces
       en contact se regardent, normales opposées. */
    const nB = B.normale.clone().normalize();
    pivoter(g, new THREE.Quaternion().setFromUnitVectors(A.normale.clone().normalize(), nB.clone().negate()), A.centre);
    const d = B.centre.clone().sub(A.centre).dot(nB) + decalage;
    g.position.addScaledVector(nB, d);
    g.updateMatrixWorld(true);
    return null;
  }
  if(A.type === "cylindre" && B.type === "cylindre"){
    /* Le sens d'un axe ne dit rien : on prend celui qui tourne le moins. */
    const axA = A.axe.clone().normalize(), axB = B.axe.clone().normalize();
    if(axA.dot(axB) < 0) axB.negate();
    pivoter(g, new THREE.Quaternion().setFromUnitVectors(axA, axB), A.point);
    const w = B.point.clone().sub(A.point);
    g.position.add(w.addScaledVector(axB, -w.dot(axB)));
    g.updateMatrixWorld(true);
    return null;
  }
  return "Contrainte possible entre deux faces planes (plaquer) ou deux faces cylindriques (même axe).";
}

/* -----------------------------------------------------------------------------
   Panneau et souris
   --------------------------------------------------------------------------- */
export function brancherDeplacement(ui){
  const { vue } = ui;
  let f = null, choix = null, note = null;
  let contrainte = null;          // null, ou { A, g, surlignage } pendant le choix des faces

  const fichiers = () => vue.modele.children;
  const courant = () => fichiers()[+choix.value];
  const centre = (g) => vue.boite(g)?.getCenter(new THREE.Vector3());
  const fichierDe = (o) => { while(o && o.parent !== vue.modele) o = o.parent; return o; };
  const ouvert = () => f && !f.hidden;

  function construire(){
    f = document.createElement("div");
    f.id = "fenetreDeplacer";
    f.className = "fenetre-mesure";
    const ligne = (cle, attr, axe) =>
      `<label class="fm-ligne fm-d${axe}"><span class="fm-cle">${cle}</span>
         <input class="fm-valeur" type="number" step="${attr === "p" ? 1 : 15}" data-${attr}="${axe}"></label>`;
    f.innerHTML = `<div class="fm-tete"><span>Déplacer un fichier</span><button class="fm-plier" title="Fermer (D)">✕</button></div>
      <div class="fm-corps">
        <label class="fm-ligne"><span class="fm-cle">Fichier</span><select class="fm-valeur"></select></label>
        ${AXES.map(a => ligne(`${a.toUpperCase()} (mm)`, "p", a)).join("")}
        ${AXES.map(a => ligne(`Rotation ${a.toUpperCase()} (°)`, "r", a)).join("")}
        <div class="fm-ligne fm-note"><button class="tb mini" data-raz>Remettre à l'origine du fichier</button></div>
        <div class="fm-ligne fm-note fm-sep"><button class="tb mini" data-contrainte
          title="Une face de la carte à déplacer, puis une face de l'autre carte. Plans : plaqués l'un contre l'autre, au décalage près. Cylindres : mis sur le même axe.">🔗 Contrainte…</button></div>
        <label class="fm-ligne" title="Écart laissé entre deux faces planes plaquées (hauteur d'entretoise, épaisseur de joint)">
          <span class="fm-cle">Décalage (mm)</span><input class="fm-valeur" type="number" step="0.5" value="0" data-decalage></label>
        <div class="fm-ligne fm-note"><span class="fm-valeur" data-note></span></div>
      </div>`;
    $("ctr").appendChild(f);
    choix = f.querySelector("select");
    note = f.querySelector("[data-note]");
    choix.onchange = lire;
    f.querySelector(".fm-plier").onclick = () => basculer(false);
    f.querySelector("[data-raz]").onclick = () => {
      const g = courant(); if(!g) return;
      g.position.set(0, 0, 0); g.rotation.set(0, 0, 0);
      apres(g);
    };
    f.querySelector("[data-contrainte]").onclick = () => contrainte ? annulerContrainte() : demarrerContrainte();
    for(const e of f.querySelectorAll("input[data-p], input[data-r]")) e.onchange = () => modifier(e);
    aide();
  }

  const aide = () => {
    note.textContent = "Souris : glisser une pièce déplace son fichier (Maj : à la verticale).";
  };

  /** La liste des fichiers ouverts ; celui de la sélection est proposé d'office. */
  function remplir(){
    if(!ouvert()) return;
    if(!fichiers().length){ basculer(false); return; }
    const o = fichierDe(ui.arbre.selection);
    const prefere = o ? fichiers().indexOf(o) : Math.max(0, Math.min(+choix.value || 0, fichiers().length - 1));
    choix.replaceChildren(...fichiers().map((g, i) => new Option(g.name || `Fichier ${i + 1}`, i)));
    choix.value = prefere;
    lire();
  }

  function lire(){
    const g = courant(); if(!g) return;
    for(const a of AXES){
      f.querySelector(`[data-p="${a}"]`).value = +g.position[a].toFixed(3);
      f.querySelector(`[data-r="${a}"]`).value = +(g.rotation[a] / DEG).toFixed(3);
    }
  }

  function modifier(e){
    const g = courant(), v = parseFloat(e.value);
    if(!g || !Number.isFinite(v)){ lire(); return; }
    if(e.dataset.p){
      g.position[e.dataset.p] = v;
    }else{
      const avant = centre(g);
      g.rotation[e.dataset.r] = v * DEG;
      g.updateMatrixWorld(true);
      const apresRot = centre(g);
      if(avant && apresRot) g.position.add(avant.sub(apresRot));
    }
    apres(g);
  }

  /** Tout ce qui a été calculé en coordonnées monde sur ce fichier est périmé. */
  function apres(g){
    g.updateMatrixWorld(true);
    g.traverse(o => {
      const topo = o.geometry?.userData.topo;
      if(topo){ topo.cacheAretes.clear(); topo.cacheFaces.clear(); }
    });
    ui.mesure.annuler();
    vue.adapterAuModele();
    ui.appliquerCoupe();
    if(ui.collisions) ui.lancerCollisions();
    lire();
    vue.invalider();
  }

  /* ---------------- contrainte : deux faces à désigner ---------------- */
  function demarrerContrainte(){
    contrainte = { A:null };
    f.querySelector("[data-contrainte]").classList.add("on");
    note.textContent = "① Cliquez une face de la carte à déplacer.";
  }

  function annulerContrainte(){
    if(!contrainte) return false;
    if(contrainte.surlignage){
      vue.annotations.remove(contrainte.surlignage);
      contrainte.surlignage.geometry.dispose();
      contrainte.surlignage.material.dispose();
    }
    contrainte = null;
    f.querySelector("[data-contrainte]").classList.remove("on");
    aide();
    vue.invalider();
    return true;
  }

  function choisirFace(touche){
    const face = faceSous(vue, touche);
    const g = fichierDe(touche.object);
    if(!face){ note.textContent = "Face non reconnue sur cette pièce (trop lourde ?)."; return; }
    if(!contrainte.A){
      contrainte.A = face; contrainte.g = g;
      choix.value = fichiers().indexOf(g); lire();
      contrainte.surlignage = new THREE.Mesh(geometrieFace(face), new THREE.MeshBasicMaterial({
        color:0x2f8cff, transparent:true, opacity:0.5, side:THREE.DoubleSide, depthWrite:false,
        polygonOffset:true, polygonOffsetFactor:-3, polygonOffsetUnits:-3,
      }));
      contrainte.surlignage.raycast = () => {};
      vue.annotations.add(contrainte.surlignage);
      vue.invalider();
      note.textContent = `② Face ${face.type === "plan" ? "plane" : face.type === "cylindre" ? "cylindrique" : "quelconque"} retenue. Cliquez la face de l'autre carte.`;
      return;
    }
    if(g === contrainte.g){ note.textContent = "Cette face est sur la carte à déplacer : choisissez-en une sur l'autre carte."; return; }
    const decalage = parseFloat(f.querySelector("[data-decalage]").value) || 0;
    const g0 = contrainte.g, A = contrainte.A;
    annulerContrainte();
    const erreur = contraindre(g0, A, face, decalage);
    if(erreur){ note.textContent = erreur; return; }
    apres(g0);
    note.textContent = A.type === "plan" ? `Faces plaquées${decalage ? `, à ${decalage} mm` : ""}.` : "Axes alignés.";
  }

  /* ---------------- souris : glisser une pièce ---------------- */
  function pointeurBas(ev){
    if(!ouvert() || ev.button !== 0) return false;
    const touche = vue.lancerRayon(ev)[0];
    if(!touche) return false;
    if(contrainte){ choisirFace(touche); return true; }

    const g = fichierDe(touche.object);
    choix.value = fichiers().indexOf(g); lire();
    const haut = vue.haut.clone();
    const vertical = ev.shiftKey;
    /* À la verticale, le plan de glisse contient l'axe vertical et fait face à
       la caméra ; sinon c'est le plan horizontal passant par le point saisi. */
    let n = haut;
    if(vertical){
      n = vue.camera().getWorldDirection(new THREE.Vector3());
      n.addScaledVector(haut, -n.dot(haut));
      if(n.lengthSq() < 1e-6) return false;     // vue de dessus : pas de verticale à tirer
      n.normalize();
    }
    const plan = new THREE.Plane().setFromNormalAndCoplanarPoint(n, touche.point);
    const depart = touche.point.clone(), pos0 = g.position.clone();
    const rc = new THREE.Raycaster(), p = new THREE.Vector3();
    let bouge = false;

    const surBouge = (e) => {
      rc.setFromCamera(vue.ndc(e), vue.camera());
      if(!rc.ray.intersectPlane(plan, p)) return;
      const delta = p.clone().sub(depart);
      if(vertical){ const h = delta.dot(haut); delta.copy(haut).multiplyScalar(h); }
      g.position.copy(pos0).add(delta);
      g.updateMatrixWorld(true);
      bouge = true;
      lire();
      vue.invalider();
    };
    const surHaut = () => {
      removeEventListener("pointermove", surBouge);
      removeEventListener("pointerup", surHaut);
      vue.canvas.classList.remove("pano");
      if(bouge) apres(g);
    };
    addEventListener("pointermove", surBouge);
    addEventListener("pointerup", surHaut);
    vue.canvas.classList.add("pano");          // le curseur « main » de la navigation
    return true;
  }

  function basculer(actif = !ouvert()){
    if(actif && !fichiers().length) return;
    if(!f) construire();
    if(!actif) annulerContrainte();
    f.hidden = !actif;
    $("bDeplacer").classList.toggle("on", actif);
    remplir();
  }

  $("bDeplacer").onclick = () => basculer();
  ui.basculerDeplacement = basculer;
  ui.surModeleChange = () => { annulerContrainte(); remplir(); };
  ui.deplacement = { pointeurBas, annulerContrainte };
}
