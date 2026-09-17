/* =============================================================================
   Visionneuse 3D — 08-interface.js
   Les commandes : barre d'outils, ouverture de fichiers, réglages, clavier.

   Ce module ne calcule rien. Il traduit des gestes d'interface en appels aux
   modules qui, eux, savent : la scène, la navigation, l'arbre, la mesure.
   Tout ce qui ressemble à une règle métier (comment cadrer, comment orbiter,
   comment trianguler) est ailleurs, et c'est voulu : c'est le fichier qui
   bouge le plus souvent.
   ============================================================================= */
"use strict";

import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { prefs, prefsModifiees, reinitialiserPrefs, resumeGestes,
         PRESETS_SOURIS, ACTIONS, EMPLACEMENTS, gestesActifs } from "./00-config.js";
import { ouvrirFichiers, liberer, calculerAretes, formatDe, estAnnexe,
         LISTE_FORMATS } from "./02-import.js";
import { MODES as MODES_MESURE } from "./07-mesure.js";

const $ = (id) => document.getElementById(id);

export class Interface {
  constructor({ vue, nav, cube, arbre, mesure }){
    Object.assign(this, { vue, nav, cube, arbre, mesure });
    this.coupe = { actif:false, axe:"x", ratio:0.5, inverse:false };

    arbre.surSelection = (piece) => {
      mesure.majPieceSelectionnee(piece);
    };
    mesure.surMesureChange = () => {
      this.majPanneauMesure();
    };

    this.brancherBarre();
    this.brancherFichiers();
    this.brancherClavier();
    this.brancherReglages();
    this.brancherVues();
    this.majEtatBoutons();
    this.majBarreEtat();

    addEventListener("resize", () => { vue.redimensionner(); cube.redimensionner(); });
  }

  /* ==========================================================================
     Barre d'outils
     ========================================================================== */
  brancherBarre(){
    const { vue, nav, arbre } = this;

    $("bOuvrir").onclick = () => $("fichier").click();
    $("bParcourir").onclick = () => $("fichier").click();
    $("bFermer").onclick = () => this.fermer();
    $("bAjuster").onclick = () => vue.ajusterVue(arbre.selection || vue.modele);
    $("bProjection").onclick = () => this.basculerProjection();

    $("bAretes").onclick = () => { this.definirAretes(!vue.aretesVisibles); };
    $("bFilaire").onclick = () => {
      vue.definirFilaire(!vue.modeFilaire);
      $("bFilaire").classList.toggle("on", vue.modeFilaire);
    };
    $("bTransparence").onclick = () => {
      vue.definirTransparence(!vue.modeTransparent);
      $("bTransparence").classList.toggle("on", vue.modeTransparent);
    };
    $("bGrille").onclick = () => {
      prefs.grille = !prefs.grille;
      vue.definirGrille(prefs.grille);
      $("bGrille").classList.toggle("on", prefs.grille);
      $("cbGrille").checked = prefs.grille;
      prefsModifiees("grille");
    };
    $("bCoupe").onclick = () => this.basculerCoupe();
    $("bMesure").onclick = () => this.basculerMesure();
    $("bIsoler").onclick = () => arbre.isoler();
    $("bPng").onclick = () => this.exporterPng();
    $("bGlb").onclick = () => this.exporterGlb();
    $("bPrefs").onclick = () => { this.majReglages(); $("dlgPrefs").showModal(); };
    $("bAide").onclick = () => $("dlgAide").showModal();

    $("bToutVoir").onclick = () => { arbre.toutAfficher(); this.majEtatBoutons(); };
    $("bToutReplier").onclick = () => arbre.replierTout();
    $("bZoomSel").onclick = () => arbre.selection && vue.ajusterVue(arbre.selection);
    $("bMaison").onclick = () => { nav.allerVersVue("iso"); vue.ajusterVue(vue.modele); };
    $("bOrbiteType").onclick = () => {
      prefs.orbite = prefs.orbite === "libre" ? "contrainte" : "libre";
      if(prefs.orbite === "contrainte") nav.redresser();
      prefsModifiees("orbite");
      this.majBarreEtat();
    };
  }

  brancherVues(){
    for(const b of document.querySelectorAll("#vuesRapides button")){
      b.onclick = () => this.nav.allerVersVue(b.dataset.vue);
    }
  }

  basculerProjection(){
    const mode = this.vue.projection === "ortho" ? "perspective" : "ortho";
    this.vue.definirProjection(mode);
    prefs.projection = mode;
    prefsModifiees("projection");
    this.majEtatBoutons();
  }

  definirAretes(actif){
    prefs.aretes = actif;
    /* Les arêtes d'un modèle ouvert avant que l'option ne soit cochée n'ont
       jamais été calculées : on les fabrique à la demande, une seule fois. */
    if(actif){
      this.vue.modele.traverse(o => { if(o.isMesh && !o.userData.arete) calculerAretes(o); });
    }
    this.vue.definirAretes(actif);
    $("bAretes").classList.toggle("on", actif);
    $("cbAretes").checked = actif;
    prefsModifiees("aretes");
  }

  /* ==========================================================================
     Plan de coupe
     ========================================================================== */
  basculerCoupe(){
    this.coupe.actif = !this.coupe.actif;
    $("bCoupe").classList.toggle("on", this.coupe.actif);
    if(!this.panneauCoupe) this.construirePanneauCoupe();
    this.panneauCoupe.hidden = !this.coupe.actif;
    this.appliquerCoupe();
  }

  construirePanneauCoupe(){
    const p = document.createElement("div");
    p.id = "panneauCoupe";
    p.innerHTML = `<span class="etiq">Coupe</span>
      <span class="axes" id="coupeAxes">
        <button class="tb mini on" data-axe="x">X</button>
        <button class="tb mini" data-axe="y">Y</button>
        <button class="tb mini" data-axe="z">Z</button>
      </span>
      <input type="range" id="coupePos" min="0" max="1" step="0.005" value="0.5">
      <button class="tb mini" id="coupeInv" title="Garder l'autre moitié">⇄</button>`;
    $("ctr").appendChild(p);
    this.panneauCoupe = p;

    p.querySelector("#coupeAxes").onclick = (e) => {
      const b = e.target.closest("button[data-axe]");
      if(!b) return;
      this.coupe.axe = b.dataset.axe;
      for(const x of p.querySelectorAll("button[data-axe]")) x.classList.toggle("on", x === b);
      this.appliquerCoupe();
    };
    p.querySelector("#coupePos").oninput = (e) => {
      this.coupe.ratio = parseFloat(e.target.value);
      this.appliquerCoupe();
    };
    p.querySelector("#coupeInv").onclick = () => {
      this.coupe.inverse = !this.coupe.inverse;
      p.querySelector("#coupeInv").classList.toggle("on", this.coupe.inverse);
      this.appliquerCoupe();
    };
  }

  appliquerCoupe(){
    const c = this.coupe;
    this.vue.definirCoupe(c.actif, c.axe, c.ratio, c.inverse);
    /* Les surlignages de mesure sont des objets à part, avec leurs propres
       matériaux : sans cet appel, une face désignée continuerait de flotter
       dans la partie coupée. */
    this.mesure.majCoupe();
  }

  /* ==========================================================================
     Mesure
     ========================================================================== */
  basculerMesure(actif){
    const on = this.mesure.basculer(actif);
    $("bMesure").classList.toggle("on", on);
    if(!this.panneauMesure) this.construirePanneauMesure();
    this.panneauMesure.hidden = !on;
    this.majPanneauMesure();
    return on;
  }

  construirePanneauMesure(){
    const p = document.createElement("div");
    p.id = "panneauMesure";
    p.innerHTML = `<span class="etiq">Mesurer</span>
      <span class="modes" id="mesureModes">${
        Object.entries(MODES_MESURE)
          .map(([cle, m]) => `<button class="tb mini" data-mode="${cle}" title="${m.aide}">${m.nom}</button>`)
          .join("")
      }</span>
      <kbd>M</kbd>
      <button class="tb mini" id="mesureDelta" title="Afficher la décomposition orthogonale ΔX, ΔY, ΔZ (style CAO)">ΔXYZ</button>
      <span class="modes" id="mesureRef">
        <button class="tb mini" data-ref="projet" title="Référentiel global du projet">Projet</button>
        <button class="tb mini" data-ref="piece" title="Référentiel local de la pièce (style Fusion 360)">Pièce</button>
      </span>
      <span class="modes" id="mesureChoixPiece" style="display:none">
        <button class="tb mini" data-piece="1" title="Référence : Pièce 1 (premier élément cliqué)">P1</button>
        <button class="tb mini on" data-piece="2" title="Référence : Pièce 2 (second élément cliqué - référence par défaut Fusion 360)">P2</button>
      </span>
      <button class="tb mini" id="mesureRaz" title="Effacer la mesure en cours (Échap)">✕</button>`;
    $("ctr").appendChild(p);
    this.panneauMesure = p;

    p.querySelector("#mesureModes").onclick = (e) => {
      const b = e.target.closest("button[data-mode]");
      if(b) this.mesure.definirMode(b.dataset.mode);
      this.majPanneauMesure();
    };
    p.querySelector("#mesureDelta").onclick = () => {
      this.mesure.afficherDeltas = !this.mesure.afficherDeltas;
      prefs.mesureDelta = this.mesure.afficherDeltas;
      prefsModifiees("mesureDelta");
      this.majPanneauMesure();
      this.mesure.rafraichir();
    };
    p.querySelector("#mesureRef").onclick = (e) => {
      const b = e.target.closest("button[data-ref]");
      if(b){
        this.mesure.definirReferentiel(b.dataset.ref);
        prefs.mesureReferentiel = b.dataset.ref;
        prefsModifiees("mesureReferentiel");
        this.majPanneauMesure();
      }
    };
    p.querySelector("#mesureChoixPiece").onclick = (e) => {
      const b = e.target.closest("button[data-piece]");
      if(b){
        const idx = parseInt(b.dataset.piece, 10);
        this.mesure.definirChoixPieceRef(idx);
        this.majPanneauMesure();
      }
    };
    p.querySelector("#mesureRaz").onclick = () => this.mesure.annuler();
  }

  majPanneauMesure(){
    if(!this.panneauMesure) return;
    for(const b of this.panneauMesure.querySelectorAll("button[data-mode]")){
      b.classList.toggle("on", b.dataset.mode === this.mesure.mode);
    }
    const bDelta = this.panneauMesure.querySelector("#mesureDelta");
    if(bDelta) bDelta.classList.toggle("on", !!this.mesure.afficherDeltas);

    for(const b of this.panneauMesure.querySelectorAll("button[data-ref]")){
      b.classList.toggle("on", b.dataset.ref === this.mesure.referentiel);
    }

    const blocChoix = this.panneauMesure.querySelector("#mesureChoixPiece");
    if(blocChoix){
      const { mA, mB, deuxPiecesDistinctes } = this.mesure.piecesMesurees();
      const visible = this.mesure.referentiel === "piece" && deuxPiecesDistinctes;
      blocChoix.style.display = visible ? "inline-flex" : "none";
      if(visible){
        const b1 = blocChoix.querySelector("button[data-piece='1']");
        const b2 = blocChoix.querySelector("button[data-piece='2']");
        const n1 = mA?.name ? (mA.name.length > 10 ? mA.name.slice(0, 9) + "…" : mA.name) : "1";
        const n2 = mB?.name ? (mB.name.length > 10 ? mB.name.slice(0, 9) + "…" : mB.name) : "2";
        if(b1){
          b1.textContent = `P1 : ${n1}`;
          b1.title = `Référentiel : Pièce 1 (${mA?.name || "Pièce 1"})`;
          b1.classList.toggle("on", this.mesure.choixPieceRef === 1);
        }
        if(b2){
          b2.textContent = `P2 : ${n2}`;
          b2.title = `Référentiel : Pièce 2 (${mB?.name || "Pièce 2"}) — Référence par défaut (style Fusion 360)`;
          b2.classList.toggle("on", this.mesure.choixPieceRef === 2);
        }
      }
    }
  }

  /* ==========================================================================
     Ouverture de fichiers
     ========================================================================== */
  brancherFichiers(){
    const entree = $("fichier");
    entree.onchange = () => {
      if(entree.files?.length) this.charger([...entree.files]);
      entree.value = "";
    };

    /* Le dépôt fonctionne partout dans la fenêtre : viser la zone en
       pointillés n'a d'intérêt que tant qu'elle est visible. */
    const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
    for(const type of ["dragenter", "dragover"]){
      addEventListener(type, (e) => { stop(e); $("depot")?.classList.add("survol"); });
    }
    for(const type of ["dragleave", "drop"]){
      addEventListener(type, (e) => { stop(e); $("depot")?.classList.remove("survol"); });
    }
    addEventListener("drop", (e) => {
      const f = [...(e.dataTransfer?.files || [])];
      if(f.length) this.charger(f);
    });
  }

  async charger(fichiers){
    /* Un .mtl ou une image n'est pas un modèle, mais ce n'est pas une erreur
       non plus : c'est ce qui accompagne un .obj. */
    const inconnus = fichiers.filter(f => !formatDe(f.name) && !estAnnexe(f.name));
    if(inconnus.length){
      this.erreur(`Format non reconnu : ${inconnus.map(f => f.name).join(", ")}\n` +
                  `Formats acceptés : ${LISTE_FORMATS}`);
      return;
    }
    this.erreur(null);
    this.attendre(true, "Lecture du fichier…", "");
    const t0 = performance.now();

    try{
      const { groupes, stats } = await ouvrirFichiers(fichiers, {
        surProgres:(txt) => this.attendre(true, "Lecture du fichier…", txt),
      });
      if(!groupes.some(g => g.children.length)){
        throw new Error("Le fichier a été lu, mais ne contient aucune géométrie affichable.");
      }

      this.fermer(false);
      for(const g of groupes) this.vue.modele.add(g);
      this.vue.recenserMateriaux();
      this.vue.adapterAuModele();
      this.vue.definirAretes(prefs.aretes);
      this.vue.definirOmbres(prefs.ombres);
      if(this.vue.modeFilaire) this.vue.definirFilaire(true);
      if(this.vue.modeTransparent) this.vue.definirTransparence(true);
      this.appliquerCoupe();

      this.nav.allerVersVue("iso", false);
      this.vue.ajusterVue(this.vue.modele);
      this.arbre.reconstruire();

      /* Le titre nomme les modèles, pas leurs annexes : « equerre.obj » et
         non « equerre.obj + equerre.mtl ». */
      const nom = fichiers.filter(f => formatDe(f.name)).map(f => f.name).join(" + ");
      $("nomFichier").textContent = nom.length > 46 ? nom.slice(0, 44) + "…" : nom;
      $("nomFichier").hidden = false;
      $("nomFichier").title = nom;
      document.title = `${nom} — Visionneuse 3D`;
      $("accueil").hidden = true;

      const secondes = ((performance.now() - t0) / 1000).toFixed(1).replace(".", ",");
      $("etatStats").textContent =
        `${fmt(stats.pieces)} pièce${stats.pieces > 1 ? "s" : ""} · ` +
        `${fmt(stats.triangles)} triangles · ouvert en ${secondes} s`;
      if(stats.aretesIgnorees){
        $("etatStats").textContent += " · arêtes non calculées (modèle trop lourd)";
      }
      this.majEtatBoutons();
    }catch(e){
      console.error(e);
      this.erreur(e.message || String(e));
      /* Une ouverture ratée ne doit pas effacer ce qui était déjà affiché :
         l'écran d'accueil ne revient que si la scène est vide. */
      $("accueil").hidden = this.vue.modele.children.length > 0;
    }finally{
      this.attendre(false);
    }
  }

  fermer(vraiment = true){
    /* La sélection tient un matériau cloné sur une pièce qui va disparaître :
       on la relâche avant de libérer quoi que ce soit. */
    this.arbre.selectionner(null);
    for(const g of [...this.vue.modele.children]){ liberer(g); this.vue.modele.remove(g); }
    this.vue.viderModele();
    this.mesure.annuler();
    if(vraiment){
      this.arbre.reconstruire();
      $("accueil").hidden = false;
      $("nomFichier").hidden = true;
      $("etatStats").textContent = "";
      document.title = "Visionneuse 3D — STEP / IGES / BREP / 3MF / OBJ / STL";
      this.majEtatBoutons();
    }
  }

  attendre(actif, titre, detail){
    $("attente").hidden = !actif;
    if(titre) $("attenteTitre").textContent = titre;
    if(detail !== undefined) $("attenteDetail").textContent = detail || "";
  }

  erreur(message){
    const e = $("errDepot");
    e.hidden = !message;
    e.textContent = message || "";
  }

  majEtatBoutons(){
    const plein = this.vue.modele.children.length > 0;
    for(const id of ["bFermer", "bGlb"]) $(id).disabled = !plein;
    $("bProjection").firstChild.nodeValue =
      this.vue.projection === "ortho" ? "Orthographique " : "Perspective ";
    $("bProjection").classList.toggle("on", this.vue.projection === "ortho");
    $("bGrille").classList.toggle("on", prefs.grille);
    $("bAretes").classList.toggle("on", prefs.aretes);
  }

  majBarreEtat(){
    $("etatNav").textContent = resumeGestes() +
      `  ·  Orbite ${prefs.orbite === "libre" ? "libre" : "contrainte"}`;
    $("bOrbiteType").classList.toggle("on", prefs.orbite === "contrainte");
  }

  /* ==========================================================================
     Exports
     ========================================================================== */
  exporterPng(){
    const a = document.createElement("a");
    a.href = this.vue.capture();
    a.download = (this.nomCourt() || "vue") + ".png";
    a.click();
  }

  exporterGlb(){
    if(!this.vue.modele.children.length) return;
    this.attendre(true, "Export glTF…", "Conversion de la scène triangulée.");
    /* Les arêtes sont un artifice d'affichage : on ne les exporte pas, elles
       feraient double emploi dans un fichier destiné à une autre visionneuse. */
    const aretes = [];
    this.vue.modele.traverse(o => { if(o.userData.estArete && o.visible){ o.visible = false; aretes.push(o); } });

    new GLTFExporter().parse(this.vue.modele, (glb) => {
      for(const a of aretes) a.visible = true;
      this.attendre(false);
      const lien = document.createElement("a");
      lien.href = URL.createObjectURL(new Blob([glb], { type:"model/gltf-binary" }));
      lien.download = (this.nomCourt() || "modele") + ".glb";
      lien.click();
      setTimeout(() => URL.revokeObjectURL(lien.href), 10_000);
    }, (e) => {
      for(const a of aretes) a.visible = true;
      this.attendre(false);
      this.erreur("Export glTF impossible : " + (e?.message || e));
    }, { binary:true });
  }

  nomCourt(){
    const g = this.vue.modele.children[0];
    return (g?.userData?.fichier || "").replace(/\.[^.]+$/, "");
  }

  /* ==========================================================================
     Clavier
     ========================================================================== */
  brancherClavier(){
    addEventListener("keydown", (e) => {
      const cible = e.target;
      if(cible && (cible.tagName === "INPUT" || cible.tagName === "SELECT" || cible.tagName === "TEXTAREA")) return;
      if(document.querySelector("dialog[open]") && e.key !== "Escape") return;

      const k = e.key.toLowerCase();
      if((e.ctrlKey || e.metaKey) && k === "o"){ e.preventDefault(); $("fichier").click(); return; }
      if(e.ctrlKey || e.metaKey || e.altKey) return;

      const vues = { "1":"avant", "2":"arriere", "3":"gauche", "4":"droite",
                     "5":"dessus", "6":"dessous", "7":"iso" };
      if(vues[e.key]){ this.nav.allerVersVue(vues[e.key]); return; }

      switch(k){
        case "f": this.vue.ajusterVue(this.arbre.selection || this.vue.modele); break;
        case "o": this.basculerProjection(); break;
        case "a": this.definirAretes(!this.vue.aretesVisibles); break;
        case "w": $("bFilaire").click(); break;
        case "x": $("bTransparence").click(); break;
        case "g": $("bGrille").click(); break;
        case "c": this.basculerCoupe(); break;
        case "k": this.basculerMesure(); break;
        /* M ouvre la mesure s'il le faut, puis fait tourner les modes :
           point → arête → face. Un seul doigt suffit pour tout le cycle. */
        case "m":
          if(!this.mesure.actif) this.basculerMesure(true);
          else { this.mesure.modeSuivant(); this.majPanneauMesure(); }
          break;
        case "i": this.arbre.isoler(); break;
        case "h": this.arbre.toutAfficher(); break;
        case "delete": case "backspace": this.arbre.masquerSelection(); break;
        case "escape":
          /* Échap efface d'abord la mesure en cours : on se trompe plus souvent
             de point que d'outil, et refermer l'outil pour recommencer serait
             une manipulation de trop. */
          if(this.mesure.actif && this.mesure.enCours()) this.mesure.annuler();
          else if(this.mesure.actif) this.basculerMesure(false);
          else if(this.arbre.isole) this.arbre.toutAfficher();
          else this.arbre.selectionner(null);
          break;
      }
    });
  }

  /* ==========================================================================
     Réglages
     ========================================================================== */
  brancherReglages(){
    /* Onglets */
    $("ongletsPrefs").onclick = (e) => {
      const b = e.target.closest(".ong");
      if(!b) return;
      for(const x of document.querySelectorAll(".ong")) x.classList.toggle("on", x === b);
      for(const v of document.querySelectorAll(".volet")) v.hidden = v.dataset.volet !== b.dataset.onglet;
    };

    /* Liste des préréglages */
    const sel = $("selSouris");
    sel.innerHTML = Object.entries(PRESETS_SOURIS)
      .map(([cle, p]) => `<option value="${cle}">${p.nom}</option>`).join("");
    sel.onchange = () => {
      /* Passer en « Personnalisé » part de ce qui était actif : on modifie
         une configuration connue plutôt qu'une page blanche. */
      if(sel.value === "perso") prefs.gestesPerso = { ...gestesActifs() };
      prefs.preset = sel.value;
      prefs.moletteInversee = PRESETS_SOURIS[sel.value].moletteInversee ?? prefs.moletteInversee;
      prefsModifiees("preset");
      this.majReglages();
      this.majBarreEtat();
    };

    const lier = (id, cle, transforme = (v) => v, apres = null) => {
      const el = $(id);
      if(!el) return;
      const ev = el.type === "range" ? "input" : "change";
      el.addEventListener(ev, () => {
        prefs[cle] = transforme(el.type === "checkbox" ? el.checked : el.value);
        prefsModifiees(cle);
        this.majSorties();
        apres?.();
      });
    };

    lier("selOrbite", "orbite", (v) => v, () => {
      if(prefs.orbite === "contrainte") this.nav.redresser();
      this.majBarreEtat();
      $("aideOrbite").textContent = this.texteOrbite();
    });
    lier("cbMoletteInv", "moletteInversee", Boolean, () => this.majBarreEtat());
    lier("cbZoomCurseur", "zoomVersCurseur", Boolean);
    lier("cbInertie", "inertie", Boolean);
    lier("cbPave", "paveTactile", Boolean);
    lier("rgOrbite", "sensOrbite", parseFloat);
    lier("rgPano", "sensPano", parseFloat);
    lier("rgZoom", "sensZoom", parseFloat);

    lier("selAxe", "axeVertical", (v) => v, () => {
      this.vue.definirAxeVertical(prefs.axeVertical);
      this.cube.poserEtiquettes(prefs.axeVertical);
      this.vue.adapterAuModele();
      this.nav.allerVersVue("iso", false);
      this.vue.ajusterVue(this.vue.modele);
    });
    lier("selProjection", "projection", (v) => v, () => {
      this.vue.definirProjection(prefs.projection);
      this.majEtatBoutons();
    });
    lier("cbCube", "cubeVisible", Boolean, () => { $("coinCube").hidden = !prefs.cubeVisible; });
    lier("cbGrille", "grille", Boolean, () => {
      this.vue.definirGrille(prefs.grille); this.majEtatBoutons();
    });
    lier("cbOmbres", "ombres", Boolean, () => this.vue.definirOmbres(prefs.ombres));
    lier("cbAretes", "aretes", Boolean, () => this.definirAretes(prefs.aretes));
    lier("rgAretes", "angleAretes", parseFloat, () => this.recalculerAretes());
    lier("selFond", "fond", (v) => v, () => this.vue.appliquerFond(prefs.fond));

    lier("rgLin", "tolLineaire", parseFloat);
    lier("rgAng", "tolAngulaire", parseFloat);
    lier("selUnite", "unite", (v) => v);
    lier("cbAretesLourd", "aretesSurGrosModeles", Boolean);

    $("bResetPrefs").onclick = () => {
      reinitialiserPrefs();
      this.appliquerToutesPrefs();
      this.majReglages();
    };
  }

  /** Le réglage de l'angle change la définition même d'une arête vive : il
      faut jeter celles qui existent et les refaire. */
  recalculerAretes(){
    clearTimeout(this._tAretes);
    this._tAretes = setTimeout(() => {
      this.vue.modele.traverse(o => {
        if(o.isMesh && o.userData.arete){
          const a = o.userData.arete;
          o.remove(a); a.geometry.dispose(); a.material.dispose();
          delete o.userData.arete;
        }
        /* Sur un maillage sans topologie B-Rep, c'est ce même angle qui décide
           où s'arrête une face : l'analyse gardée n'est plus la bonne. */
        if(o.isMesh) delete o.geometry.userData.topo;
      });
      this.mesure.annuler();
      if(prefs.aretes){
        this.vue.modele.traverse(o => { if(o.isMesh) calculerAretes(o, prefs.angleAretes); });
        this.vue.definirAretes(true);
      }
      this.vue.invalider();
    }, 220);
  }

  texteOrbite(){
    return prefs.orbite === "libre"
      ? "Orbite libre : le modèle roule dans toutes les directions, sans verticale imposée. Pratique sur une pièce seule, déroutant sur un grand assemblage."
      : "Orbite contrainte : la verticale de la scène reste droite, comme un plateau tournant. On garde ses repères, au prix de ne pas pouvoir basculer par-dessus le pôle.";
  }

  /** Recopie l'état des préférences dans le dialogue. */
  majReglages(){
    $("selSouris").value = prefs.preset;
    $("selOrbite").value = prefs.orbite;
    $("aideOrbite").textContent = this.texteOrbite();
    $("cbMoletteInv").checked = prefs.moletteInversee;
    $("cbZoomCurseur").checked = prefs.zoomVersCurseur;
    $("cbInertie").checked = prefs.inertie;
    $("cbPave").checked = prefs.paveTactile;
    $("rgOrbite").value = prefs.sensOrbite;
    $("rgPano").value = prefs.sensPano;
    $("rgZoom").value = prefs.sensZoom;
    $("selAxe").value = prefs.axeVertical;
    $("selProjection").value = prefs.projection;
    $("cbCube").checked = prefs.cubeVisible;
    $("cbGrille").checked = prefs.grille;
    $("cbOmbres").checked = prefs.ombres;
    $("cbAretes").checked = prefs.aretes;
    $("rgAretes").value = prefs.angleAretes;
    $("selFond").value = prefs.fond;
    $("rgLin").value = prefs.tolLineaire;
    $("rgAng").value = prefs.tolAngulaire;
    $("selUnite").value = prefs.unite;
    $("cbAretesLourd").checked = prefs.aretesSurGrosModeles;
    this.majSorties();
    this.majTableGestes();
  }

  majSorties(){
    const met = (id, v) => { const o = $(id); if(o) o.value = v; };
    met("outOrbite", "×" + Number(prefs.sensOrbite).toFixed(1));
    met("outPano", "×" + Number(prefs.sensPano).toFixed(1));
    met("outZoom", "×" + Number(prefs.sensZoom).toFixed(1));
    met("outAretes", prefs.angleAretes + "°");
    met("outLin", Number(prefs.tolLineaire).toFixed(4).replace(".", ","));
    met("outAng", prefs.tolAngulaire + "°");
  }

  /** Le tableau des gestes : lecture seule sur un préréglage, éditable sinon. */
  majTableGestes(){
    const table = gestesActifs();
    const perso = prefs.preset === "perso";
    const nom = { gauche:"Clic gauche", milieu:"Clic milieu", droit:"Clic droit",
                  ctrl:"Ctrl", shift:"Maj", alt:"Alt" };
    const libelle = (cle) => cle.split("+").map(p => nom[p] || p).reverse().join(" + ");

    const lignes = EMPLACEMENTS.map(cle => {
      const valeur = table[cle] || "";
      const options = Object.entries(ACTIONS)
        .map(([v, t]) => `<option value="${v}"${v === valeur ? " selected" : ""}>${t}</option>`).join("");
      const vide = valeur ? "" : `<option value="" selected>— hérité —</option>`;
      return `<tr><td>${libelle(cle)}</td><td>
        <select data-geste="${cle}"${perso ? "" : " disabled"}>${vide}${options}</select></td></tr>`;
    }).join("");

    const t = $("tabGestes");
    t.innerHTML = `<tr><th>Geste</th><th>Action</th></tr>${lignes}`;
    t.onchange = (e) => {
      const s = e.target.closest("select[data-geste]");
      if(!s || !perso) return;
      if(s.value) prefs.gestesPerso[s.dataset.geste] = s.value;
      else delete prefs.gestesPerso[s.dataset.geste];
      prefsModifiees("gestes");
      this.majBarreEtat();
    };
    $("aideOrbite").textContent = this.texteOrbite();
  }

  /** Après un retour aux réglages d'origine : tout réappliquer d'un bloc. */
  appliquerToutesPrefs(){
    const v = this.vue;
    v.definirAxeVertical(prefs.axeVertical);
    v.definirProjection(prefs.projection);
    v.definirGrille(prefs.grille);
    v.definirOmbres(prefs.ombres);
    v.appliquerFond(prefs.fond);
    v.definirAretes(prefs.aretes);
    $("coinCube").hidden = !prefs.cubeVisible;
    this.majEtatBoutons();
    this.majBarreEtat();
    v.ajusterVue(v.modele);
  }
}

const nf = new Intl.NumberFormat("fr-FR");
function fmt(n){ return nf.format(Math.round(n || 0)); }

/* Petit utilitaire partagé avec le démarrage : retrouver la pièce cliquée. */
export function pieceSous(vue, ev){
  const touches = vue.lancerRayon(ev);
  if(!touches.length) return null;
  let o = touches[0].object;
  while(o && !o.userData.estPiece && o.parent) o = o.parent;
  return o?.userData?.estPiece ? o : touches[0].object;
}

