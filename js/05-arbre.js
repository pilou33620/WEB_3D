/* =============================================================================
   Visionneuse 3D — 05-arbre.js
   L'arbre d'assemblage, la sélection et la fiche de propriétés.

   Un fichier STEP n'est pas un tas de triangles : il porte un assemblage, avec
   ses sous-ensembles et ses noms de pièces. Les afficher, c'est ce qui sépare
   une visionneuse d'un simple afficheur de maillage — on y retrouve la pièce
   qu'on cherche par son repère, on l'isole, on lit sa masse de triangles et
   son volume.

   La sélection est unique : dans une visionneuse on regarde une pièce à la
   fois, et la sélection multiple demanderait une fiche de propriétés qui ne
   sait plus quoi dire.
   ============================================================================= */
"use strict";

import * as THREE from "three";
import { visibleEnLignee } from "./01-scene.js";

const COULEUR_SEL = 0x2b7fbf;

export class Arbre {
  constructor(vue, elements){
    this.vue = vue;
    this.el = elements;               // { arbre, props, cpt, rech, zoomSel, isoler }
    this.selection = null;
    this.isole = null;
    this.replie = new Set();
    this.index = new Map();           // objet 3D -> ligne du DOM, remplie par reconstruire()
    this.cadre = new THREE.BoxHelper(new THREE.Object3D(), 0xf2c744);
    this.cadre.visible = false;
    this.cadre.material.depthTest = false;
    this.cadre.renderOrder = 5;
    vue.annotations.add(this.cadre);

    this.el.rech?.addEventListener("input", () => this.filtrer(this.el.rech.value));
  }

  /* ==========================================================================
     Construction
     ========================================================================== */
  reconstruire(){
    const hote = this.el.arbre;
    hote.textContent = "";
    this.index = new Map();           // objet -> ligne du DOM

    if(!this.vue.modele.children.length){
      hote.innerHTML = '<p class="vide-p">Aucun modèle chargé.</p>';
      this.el.cpt.textContent = "—";
      return;
    }
    let pieces = 0;
    for(const enfant of this.vue.modele.children){
      hote.appendChild(this.ligne(enfant, 0));
      enfant.traverse(o => { if(o.isMesh) pieces++; });
    }
    this.el.cpt.textContent = `${pieces} pièce${pieces > 1 ? "s" : ""}`;
    this.majFiche(null);
  }

  ligne(objet, profondeur){
    const bloc = document.createElement("div");
    const nd = document.createElement("div");
    nd.className = "nd";
    nd.style.paddingLeft = (4 + profondeur * 13) + "px";

    const enfants = objet.children.filter(o => o.isMesh || o.isGroup);
    const fl = document.createElement("span");
    fl.className = "fl" + (enfants.length ? "" : " vide");
    fl.textContent = "▼";
    nd.appendChild(fl);

    const oeil = document.createElement("span");
    oeil.className = "oeil";
    oeil.textContent = objet.visible ? "👁" : "◻";
    oeil.title = "Afficher / masquer";
    nd.appendChild(oeil);

    if(objet.isMesh){
      const puce = document.createElement("span");
      puce.className = "puce";
      puce.style.background = couleurDe(objet) || "#888888";
      nd.appendChild(puce);
    }

    const lbl = document.createElement("span");
    lbl.className = "lbl";
    lbl.textContent = objet.name || (objet.isMesh ? "Pièce" : "Groupe");
    lbl.title = lbl.textContent;
    nd.appendChild(lbl);

    if(objet.isMesh){
      const tri = document.createElement("span");
      tri.className = "tri";
      tri.textContent = formaterNombre(objet.userData.triangles || 0) + " △";
      nd.appendChild(tri);
    }

    bloc.appendChild(nd);
    this.index.set(objet, nd);
    nd.__objet = objet;

    let sousBloc = null;
    if(enfants.length){
      sousBloc = document.createElement("div");
      for(const e of enfants) sousBloc.appendChild(this.ligne(e, profondeur + 1));
      bloc.appendChild(sousBloc);
      fl.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const ferme = sousBloc.hidden = !sousBloc.hidden;
        fl.textContent = ferme ? "▶" : "▼";
        if(ferme) this.replie.add(objet); else this.replie.delete(objet);
      });
      if(this.replie.has(objet)){ sousBloc.hidden = true; fl.textContent = "▶"; }
    }

    oeil.addEventListener("click", (ev) => { ev.stopPropagation(); this.basculerVisible(objet); });
    lbl.addEventListener("click", () => this.selectionner(objet));
    lbl.addEventListener("dblclick", () => { this.selectionner(objet); this.vue.ajusterVue(objet); });
    return bloc;
  }

  replierTout(){
    for(const [objet, nd] of this.index){
      if(objet.isGroup && objet.children.length) this.replie.add(objet);
      void nd;
    }
    this.reconstruire();
  }

  /* ==========================================================================
     Sélection
     ========================================================================== */
  selectionner(objet, { defiler = true } = {}){
    if(this.selection === objet) return;
    if(this.selection) this.peindre(this.selection, false);
    this.selection = objet || null;

    for(const [, nd] of this.index) nd.classList.remove("sel");
    if(objet){
      this.peindre(objet, true);
      const nd = this.index.get(objet);
      if(nd){
        nd.classList.add("sel");
        if(defiler) nd.scrollIntoView({ block:"nearest" });
      }
      this.cadre.setFromObject(objet);
      this.cadre.visible = true;
    }else{
      this.cadre.visible = false;
    }
    this.el.zoomSel.disabled = !objet;
    this.el.isoler.disabled = !objet;
    this.majFiche(objet);
    this.surSelection?.(objet);
    this.vue.invalider();
  }

  /**
   * Surbrillance : le matériau est partagé entre toutes les pièces de même
   * couleur, on ne peut donc pas le teinter sur place. On en pose un clone
   * le temps de la sélection — clone déclaré à la scène, pour qu'il suive les
   * modes d'affichage (filaire, rayons X, coupe) comme les autres.
   */
  peindre(objet, actif){
    objet.traverse(o => {
      if(!o.isMesh) return;
      if(actif){
        if(o.userData.matSauve) return;
        o.userData.matSauve = o.material;
        const teinter = (m) => {
          const c = m.clone();
          c.emissive = new THREE.Color(COULEUR_SEL);
          /* Assez pour désigner la pièce, pas assez pour effacer sa couleur :
             au-delà de 0,4 une pièce claire vire au blanc et on ne sait plus
             ce qu'on regarde. */
          c.emissiveIntensity = 0.35;
          c.clippingPlanes = m.clippingPlanes;
          this.vue.materiaux.add(c);
          return c;
        };
        o.material = Array.isArray(o.material) ? o.material.map(teinter) : teinter(o.material);
      }else if(o.userData.matSauve){
        const jeter = (m) => { this.vue.materiaux.delete(m); m.dispose(); };
        if(Array.isArray(o.material)) o.material.forEach(jeter); else jeter(o.material);
        o.material = o.userData.matSauve;
        delete o.userData.matSauve;
      }
    });
  }

  /* ==========================================================================
     Visibilité
     ========================================================================== */
  basculerVisible(objet, force, { heritage = true } = {}){
    const visible = force !== undefined ? force : !objet.visible;
    objet.visible = visible;
    const nd = this.index.get(objet);
    if(nd){
      nd.classList.toggle("masque", !visible);
      const oeil = nd.querySelector(".oeil");
      if(oeil) oeil.textContent = visible ? "👁" : "◻";
    }
    /* Les arêtes sont des enfants du maillage : elles suivent, sauf si
       l'affichage des arêtes est globalement coupé. */
    objet.traverse(o => {
      if(o.isLineSegments && o.userData.estArete) o.visible = visible && this.vue.aretesVisibles;
    });
    /* Masquer un ensemble masque tout ce qu'il contient, sans toucher au
       drapeau de ses pièces : l'arbre doit donc le dire, faute de quoi une
       pièce absente de l'écran s'y afficherait comme visible. */
    if(heritage) this.majHeritage(objet);
    this.vue.invalider();
  }

  /** Grise les lignes dont une pièce est masquée par un ensemble au-dessus. */
  majHeritage(racine = this.vue.modele){
    racine.traverse(o => {
      const nd = this.index.get(o);
      if(!nd || !o.parent) return;
      const bloque = !visibleEnLignee(o.parent);
      nd.classList.toggle("herite-masque", bloque);
      const oeil = nd.querySelector(".oeil");
      if(oeil) oeil.title = bloque
        ? "Masqué par un ensemble parent — réaffichez celui-ci pour la revoir"
        : "Afficher / masquer";
    });
  }

  isoler(objet = this.selection){
    if(!objet) return;
    if(this.isole){ this.toutAfficher(); if(this.isole === objet){ this.isole = null; return; } }
    this.vue.modele.traverse(o => {
      if(o.isMesh) this.basculerVisible(o, estDansBranche(o, objet), { heritage:false });
    });
    this.majHeritage();
    this.isole = objet;
    this.vue.ajusterVue(objet);
  }

  toutAfficher(){
    this.vue.modele.traverse(o => {
      if(o.isMesh || o.isGroup) this.basculerVisible(o, true, { heritage:false });
    });
    this.majHeritage();
    this.isole = null;
  }

  masquerSelection(){
    if(this.selection) this.basculerVisible(this.selection, false);
  }

  filtrer(texte){
    const q = (texte || "").trim().toLowerCase();
    for(const [objet, nd] of this.index){
      if(!q){ nd.classList.remove("filtre-off"); continue; }
      /* Un groupe reste visible si l'un de ses descendants correspond :
         sinon le filtre couperait la branche qui mène au résultat. */
      let ok = (objet.name || "").toLowerCase().includes(q);
      if(!ok) objet.traverse(o => { if((o.name || "").toLowerCase().includes(q)) ok = true; });
      nd.classList.toggle("filtre-off", !ok);
    }
  }

  /* ==========================================================================
     Fiche de propriétés
     ========================================================================== */
  majFiche(objet){
    const hote = this.el.props;
    if(!objet){
      hote.innerHTML = '<p class="vide-p">Sélectionnez une pièce dans l\'arbre ou dans la vue.</p>';
      return;
    }
    const b = new THREE.Box3().setFromObject(objet);
    const t = b.getSize(new THREE.Vector3());
    let triangles = 0, maillages = 0;
    objet.traverse(o => { if(o.isMesh){ triangles += o.userData.triangles || 0; maillages++; } });

    const racine = racineFichier(objet, this.vue.modele);
    const couleur = couleurDe(objet);

    const lignes = [
      ["Nom", echapper(objet.name || "—")],
      ["Type", objet.isMesh ? "Pièce" : `Ensemble (${maillages} pièce${maillages > 1 ? "s" : ""})`],
      ["Triangles", formaterNombre(triangles)],
    ];
    if(couleur) lignes.push(["Couleur", `<span class="coul" style="background:${couleur}"></span>${couleur}`]);
    if(racine?.userData?.fichier) lignes.push(["Fichier", echapper(racine.userData.fichier)]);

    const dim = [
      ["Encombrement X", mm(t.x)],
      ["Encombrement Y", mm(t.y)],
      ["Encombrement Z", mm(t.z)],
      ["Diagonale", mm(t.length())],
      ["Centre", `${nb(b.min.x + t.x/2)} ; ${nb(b.min.y + t.y/2)} ; ${nb(b.min.z + t.z/2)}`],
    ];

    /* Volume et surface sont des sommes sur les triangles : sur un gros
       ensemble, le calcul se voit. On le réserve à ce qui reste instantané. */
    let masse = "";
    if(triangles <= 800_000){
      const { volume, aire } = mesurerSolide(objet);
      masse = `<h4>Matière (maillage)</h4><table>
        <tr><td>Volume</td><td>${formaterVolume(volume)}</td></tr>
        <tr><td>Surface</td><td>${formaterAire(aire)}</td></tr></table>
        <p class="aide" style="margin-top:6px">Valeurs calculées sur le maillage
           d'affichage, pas sur la géométrie exacte : comptez quelques dixièmes
           de pourcent d'écart sur les pièces très courbes.</p>`;
    }

    hote.innerHTML =
      `<h4>Identité</h4><table>${lignes.map(([a, v]) => `<tr><td>${a}</td><td>${v}</td></tr>`).join("")}</table>
       <h4>Géométrie</h4><table>${dim.map(([a, v]) => `<tr><td>${a}</td><td>${v}</td></tr>`).join("")}</table>
       ${masse}`;
  }
}

/* -----------------------------------------------------------------------------
   Aides
   --------------------------------------------------------------------------- */
/** Teinte d'origine d'une pièce, telle qu'elle vient du fichier. */
function couleurDe(objet){
  if(!objet?.isMesh) return null;
  const m = Array.isArray(objet.material) ? objet.material[0] : objet.material;
  return m?.userData?.couleurHex || null;
}

function estDansBranche(objet, racine){
  let o = objet;
  while(o){ if(o === racine) return true; o = o.parent; }
  return false;
}

function racineFichier(objet, modele){
  let o = objet;
  while(o && o.parent && o.parent !== modele) o = o.parent;
  return o;
}

/** Volume signé et surface d'un maillage fermé, sommés sur les triangles. */
export function mesurerSolide(objet){
  let volume = 0, aire = 0;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const ab = new THREE.Vector3(), ac = new THREE.Vector3(), n = new THREE.Vector3();

  objet.traverse(o => {
    if(!o.isMesh || !o.geometry) return;
    o.updateWorldMatrix(true, false);
    const g = o.geometry;
    const pos = g.attributes.position;
    const idx = g.index;
    const nbTri = idx ? idx.count / 3 : pos.count / 3;
    for(let i = 0; i < nbTri; i++){
      const i0 = idx ? idx.getX(i*3) : i*3;
      const i1 = idx ? idx.getX(i*3+1) : i*3+1;
      const i2 = idx ? idx.getX(i*3+2) : i*3+2;
      a.fromBufferAttribute(pos, i0).applyMatrix4(o.matrixWorld);
      b.fromBufferAttribute(pos, i1).applyMatrix4(o.matrixWorld);
      c.fromBufferAttribute(pos, i2).applyMatrix4(o.matrixWorld);
      /* Volume : somme des tétraèdres signés formés avec l'origine — exact
         pour un maillage fermé et orienté, ce que produit OpenCascade. */
      volume += a.dot(n.crossVectors(b, c)) / 6;
      ab.subVectors(b, a); ac.subVectors(c, a);
      aire += n.crossVectors(ab, ac).length() / 2;
    }
  });
  return { volume:Math.abs(volume), aire };
}

const fmt = new Intl.NumberFormat("fr-FR");
function formaterNombre(n){ return fmt.format(Math.round(n)); }
/* Virgule décimale : le reste de l'interface est en français, les cotes aussi. */
function nb(v){ return (Math.abs(v) < 1e-9 ? 0 : v).toFixed(2).replace(".", ","); }
function mm(v){ return `${nb(v)} mm`; }
function formaterVolume(v){
  if(v > 1e6) return `${fmt.format(Math.round(v / 1000) / 1000)} dm³`;
  if(v > 1000) return `${fmt.format(Math.round(v / 100) / 10)} cm³`;
  return `${fmt.format(Math.round(v * 100) / 100)} mm³`;
}
function formaterAire(v){
  if(v > 1e4) return `${fmt.format(Math.round(v / 10) / 10)} cm²`;
  return `${fmt.format(Math.round(v * 10) / 10)} mm²`;
}
function echapper(s){
  return String(s).replace(/[&<>"]/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c]));
}
