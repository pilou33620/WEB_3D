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
import { visibleEnLignee } from "./01-scene.js";
import { prefs, prefsModifiees, reinitialiserPrefs, resumeGestes,
         PRESETS_SOURIS, ACTIONS, EMPLACEMENTS, gestesActifs } from "./00-config.js";
import { ouvrirFichiers, liberer, calculerAretes, formatDe, estAnnexe,
         LISTE_FORMATS } from "./02-import.js";
import { MODES as MODES_MESURE } from "./07-mesure.js";
import { StepExtractor, telechargerFichier, sanitiserNomFichier } from "./10-export-step.js";

const $ = (id) => document.getElementById(id);

export class Interface {
  constructor({ vue, nav, cube, arbre, mesure, coupe }){
    Object.assign(this, { vue, nav, cube, arbre, mesure, coupe });
    if(coupe) coupe.bOutil = $("bCoupe");

    arbre.surSelection = (piece) => {
      mesure.majPieceSelectionnee(piece);
    };
    arbre.surDemandeExportPiece = (piece) => {
      this.ouvrirModalExport(piece);
    };
    mesure.surMesureChange = () => {
      this.majPanneauMesure();
    };

    this.brancherBarre();
    this.brancherFichiers();
    this.brancherClavier();
    this.brancherReglages();
    this.brancherVues();
    this.brancherExportPiece();
    this.definirTheme(prefs.theme, false);
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
    $("bExportPiece").onclick = () => this.ouvrirModalExport();
    $("bTheme").onclick = () => this.basculerTheme();
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
    this.coupe.basculer();
    this.mesure.majCoupe();
  }

  appliquerCoupe(){
    if(this.coupe.actif){
      this.coupe.majBornes();
      this.coupe.appliquer();
    }else{
      this.vue.definirCoupe(false);
    }
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
    this.coupe?.definirActif(false);
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

  basculerTheme(){
    const suivant = prefs.theme === "clair" ? "sombre" : "clair";
    this.definirTheme(suivant, true);
  }

  definirTheme(theme, changerFond = false){
    prefs.theme = theme;
    document.documentElement.setAttribute("data-theme", theme);
    if(changerFond){
      if(theme === "clair" && (prefs.fond === "degrade" || prefs.fond === "sombre")){
        prefs.fond = "clair";
        this.vue.appliquerFond("clair");
      }else if(theme === "sombre" && prefs.fond === "clair"){
        prefs.fond = "degrade";
        this.vue.appliquerFond("degrade");
      }
      if($("selFond")) $("selFond").value = prefs.fond;
    }
    const selTheme = $("selTheme");
    if(selTheme) selTheme.value = theme;
    prefsModifiees("theme");
    this.majEtatBoutons();
  }

  majEtatBoutons(){
    const plein = this.vue.modele.children.length > 0;
    for(const id of ["bFermer", "bGlb", "bExportPiece"]) $(id).disabled = !plein;
    $("bProjection").firstChild.nodeValue =
      this.vue.projection === "ortho" ? "Orthographique " : "Perspective ";
    $("bProjection").classList.toggle("on", this.vue.projection === "ortho");
    $("bGrille").classList.toggle("on", prefs.grille);
    $("bAretes").classList.toggle("on", prefs.aretes);

    const bTheme = $("bTheme");
    if(bTheme){
      const estClair = prefs.theme === "clair";
      bTheme.innerHTML = estClair ? "🌙 Sombre <kbd>T</kbd>" : "☀️ Clair <kbd>T</kbd>";
      bTheme.title = estClair ? "Passer au thème sombre" : "Passer au thème clair";
      bTheme.classList.toggle("on", estClair);
    }
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
     Exportation de pièces (STEP / glTF)
     ========================================================================== */
  brancherExportPiece(){
    const dlg = $("dlgExportPiece");
    if(!dlg) return;

    // Changement de périmètre (visible, selection, manuel)
    for(const r of dlg.querySelectorAll("input[name='perimetreExport']")){
      r.addEventListener("change", () => {
        for(const carte of dlg.querySelectorAll(".carte-opt")){
          carte.classList.toggle("on", carte.querySelector("input") === r);
        }
        const manuel = r.value === "manuel";
        $("blocListePiecesExport").hidden = !manuel;
        this.majNomFichierExportSuggere();
      });
    }

    // Gestion des boutons de cochage de la liste
    $("bExportToutCocher")?.addEventListener("click", () => {
      dlg.querySelectorAll("#listePiecesExport input[type='checkbox']").forEach(cb => cb.checked = true);
      this.majCompteurPiecesExport();
      this.majNomFichierExportSuggere();
    });
    $("bExportToutDecocher")?.addEventListener("click", () => {
      dlg.querySelectorAll("#listePiecesExport input[type='checkbox']").forEach(cb => cb.checked = false);
      this.majCompteurPiecesExport();
      this.majNomFichierExportSuggere();
    });
    $("bExportVisiblesCocher")?.addEventListener("click", () => {
      dlg.querySelectorAll("#listePiecesExport .item-export").forEach(item => {
        const cb = item.querySelector("input[type='checkbox']");
        if(cb) cb.checked = item.dataset.visible === "true";
      });
      this.majCompteurPiecesExport();
      this.majNomFichierExportSuggere();
    });

    // Format
    $("selFormatExport")?.addEventListener("change", () => {
      const format = $("selFormatExport").value;
      const lgRep = $("lgRepereExport");
      if(lgRep) lgRep.style.display = format === "stp" ? "flex" : "none";
      $("bValiderExport").textContent = format === "stp" ? "💾 Exporter .stp" : "💾 Exporter .glb";
      this.majNomFichierExportSuggere();
    });

    // Boutons de validation / annulation
    $("bAnnulerExport")?.addEventListener("click", () => dlg.close());
    $("bValiderExport")?.addEventListener("click", () => this.executerExportPiece());
  }

  ouvrirModalExport(piecePreselectionnee = null){
    if(!this.vue.modele.children.length) return;
    const dlg = $("dlgExportPiece");
    if(!dlg) return;

    // Collecter les pièces maillées
    const pieces = [];
    this.vue.modele.traverse(o => {
      if(o.isMesh && o.userData.estPiece){
        const visible = o.visible && visibleEnLignee(o);
        pieces.push({ objet:o, visible });
      }
    });

    const nbVisibles = pieces.filter(p => p.visible).length;
    const nbTotal = pieces.length;
    const nbMasquees = nbTotal - nbVisibles;

    $("descExportVisible").textContent =
      `Conserver uniquement les pièces affichées à l'écran (${nbVisibles} visible${nbVisibles > 1 ? "s" : ""}, ${nbMasquees} masquée${nbMasquees > 1 ? "s" : ""}).`;

    // Pièce sélectionnée
    const sel = piecePreselectionnee || this.arbre.selection;
    let selMesh = null;
    if(sel){
      if(sel.isMesh) selMesh = sel;
      else sel.traverse(o => { if(o.isMesh && !selMesh) selMesh = o; });
    }

    const rSel = dlg.querySelector("input[name='perimetreExport'][value='selection']");
    const rVis = dlg.querySelector("input[name='perimetreExport'][value='visible']");
    const optSel = $("optExportSel");

    if(selMesh){
      $("nomExportSel").textContent = selMesh.name || "Pièce sélectionnée";
      optSel.classList.remove("desactive");
      if(rSel) rSel.disabled = false;
      if(piecePreselectionnee && rSel){
        rSel.checked = true;
      }
    }else{
      $("nomExportSel").textContent = "(aucune sélection)";
      optSel.classList.add("desactive");
      if(rSel){
        rSel.disabled = true;
        if(rSel.checked && rVis) rVis.checked = true;
      }
    }

    // Définir la classe "on" sur la carte active
    for(const carte of dlg.querySelectorAll(".carte-opt")){
      carte.classList.toggle("on", carte.querySelector("input")?.checked || false);
    }
    $("blocListePiecesExport").hidden = !dlg.querySelector("input[name='perimetreExport'][value='manuel']")?.checked;

    // Remplir la liste pour le choix personnalisé
    const contListe = $("listePiecesExport");
    contListe.innerHTML = "";
    pieces.forEach(({ objet, visible }, idx) => {
      const item = document.createElement("div");
      item.className = "item-export";
      item.dataset.visible = String(visible);
      const col = objet.userData?.matSauve?.color || objet.material?.color;
      const coulHex = col ? "#" + col.getHexString() : "#888888";
      item.innerHTML = `
        <input type="checkbox" id="cbExp_${idx}" ${visible ? "checked" : ""}>
        <span class="puce" style="background:${coulHex}"></span>
        <label for="cbExp_${idx}" class="nom" title="${objet.name || "Pièce"}">${objet.name || `Pièce ${idx+1}`}</label>
        <span class="badge-vis ${visible ? "ok" : "off"}">${visible ? "affichée" : "masquée"}</span>
        <span class="tri">${objet.userData.triangles ? Math.round(objet.userData.triangles) + " △" : ""}</span>
      `;
      item.__objet = objet;
      item.querySelector("input").addEventListener("change", () => {
        this.majCompteurPiecesExport();
        this.majNomFichierExportSuggere();
      });
      contListe.appendChild(item);
    });
    this.majCompteurPiecesExport();

    // Détecter si le modèle vient d'un fichier STEP
    let stepTexteTrouve = false;
    for(const g of this.vue.modele.children){
      if(g.userData.stepTexte || g.userData.format === "step"){
        stepTexteTrouve = true;
        break;
      }
    }

    const selFormat = $("selFormatExport");
    const optStep = selFormat.querySelector("option[value='stp']");

    if(!stepTexteTrouve){
      optStep.disabled = true;
      optStep.textContent = "STEP (.stp) — Non disponible (fichier source non-STEP)";
      selFormat.value = "glb";
      $("infoExportMsg").textContent = "ℹ Ce modèle est issu d'un format maillé. L'export se fera en maillage 3D (.glb).";
    }else{
      optStep.disabled = false;
      optStep.textContent = "STEP (.stp) — CAO exacte B-Rep d'origine (ISO 10303)";
      selFormat.value = "stp";
      $("infoExportMsg").textContent = "✨ Les géométries B-Rep exactes (courbes, cylindres, congés, tolérances) sont conservées sans aucune perte.";
    }

    const format = selFormat.value;
    const lgRep = $("lgRepereExport");
    if(lgRep) lgRep.style.display = format === "stp" ? "flex" : "none";
    $("bValiderExport").textContent = format === "stp" ? "💾 Exporter .stp" : "💾 Exporter .glb";

    this.majNomFichierExportSuggere();
    dlg.showModal();
  }

  majCompteurPiecesExport(){
    const coches = $("listePiecesExport")?.querySelectorAll("input[type='checkbox']:checked").length || 0;
    $("cptPiecesExport").textContent = `${coches} pièce${coches > 1 ? "s" : ""} sélectionnée${coches > 1 ? "s" : ""}`;
  }

  majNomFichierExportSuggere(){
    const perimetre = $("dlgExportPiece")?.querySelector("input[name='perimetreExport']:checked")?.value || "visible";
    const format = $("selFormatExport")?.value || "stp";
    const ext = "." + format;
    const nomBase = this.nomCourt() || "modele";

    let suggestion = nomBase;
    if(perimetre === "selection"){
      const sel = this.arbre.selection;
      let nomPiece = sel?.name || "";
      if(!nomPiece && sel && !sel.isMesh){
        sel.traverse(o => { if(o.isMesh && !nomPiece) nomPiece = o.name; });
      }
      suggestion = sanitiserNomFichier(nomPiece || "piece", ext);
    }else if(perimetre === "visible"){
      suggestion = sanitiserNomFichier(nomBase + "_visible", ext);
    }else{
      suggestion = sanitiserNomFichier(nomBase + "_selection", ext);
    }

    $("inputNomFichierExport").value = suggestion;
  }

  async executerExportPiece(){
    const dlg = $("dlgExportPiece");
    const perimetre = dlg.querySelector("input[name='perimetreExport']:checked")?.value || "visible";
    const format = $("selFormatExport").value;
    const repere = $("selRepereExport").value;
    let nomFichier = $("inputNomFichierExport").value.trim();
    if(!nomFichier.toLowerCase().endsWith("." + format)){
      nomFichier += "." + format;
    }

    let piecesCibles = [];
    if(perimetre === "selection"){
      const sel = this.arbre.selection;
      let m = (sel && sel.isMesh) ? sel : null;
      if(!m && sel) sel.traverse(o => { if(o.isMesh && !m) m = o; });
      if(!m){
        alert("Veuillez sélectionner une pièce à exporter.");
        return;
      }
      piecesCibles = [m];
    }else if(perimetre === "visible"){
      this.vue.modele.traverse(o => {
        if(o.isMesh && o.userData.estPiece && o.visible && visibleEnLignee(o)){
          piecesCibles.push(o);
        }
      });
      if(!piecesCibles.length){
        alert("Aucune pièce n'est actuellement visible à l'écran.");
        return;
      }
    }else{
      const items = dlg.querySelectorAll("#listePiecesExport .item-export");
      for(const it of items){
        const cb = it.querySelector("input[type='checkbox']");
        if(cb && cb.checked && it.__objet){
          piecesCibles.push(it.__objet);
        }
      }
      if(!piecesCibles.length){
        alert("Veuillez cocher au moins une pièce à exporter.");
        return;
      }
    }

    dlg.close();
    this.attendre(true, `Export ${format.toUpperCase()} en cours…`, "Préparation des données géométriques.");

    try{
      if(format === "stp"){
        let stepTexte = null;
        for(const g of this.vue.modele.children){
          if(g.userData.stepTexte){
            stepTexte = g.userData.stepTexte;
            break;
          }
        }
        if(!stepTexte){
          throw new Error("Le texte source STEP n'est pas disponible pour ce fichier.");
        }

        const extracteur = new StepExtractor(stepTexte);
        let contenuSortie = "";

        if(piecesCibles.length === 1 && repere === "local"){
          const nomPiece = piecesCibles[0].name;
          contenuSortie = extracteur.exportPiece(nomPiece);
        }else{
          const noms = piecesCibles.map(p => p.name);
          contenuSortie = extracteur.exportAssemblageFiltre(noms);
        }

        telechargerFichier(contenuSortie, nomFichier, "application/octet-stream");
      }else{
        const masquesTemp = [];
        this.vue.modele.traverse(o => {
          if(o.isMesh && !piecesCibles.includes(o)){
            if(o.visible){
              o.visible = false;
              masquesTemp.push(o);
            }
          }
          if(o.userData.estArete && o.visible){
            o.visible = false;
            masquesTemp.push(o);
          }
        });

        await new Promise((resoudre, rejeter) => {
          new GLTFExporter().parse(this.vue.modele, (glb) => {
            for(const o of masquesTemp) o.visible = true;
            telechargerFichier(glb, nomFichier, "model/gltf-binary");
            resoudre();
          }, (err) => {
            for(const o of masquesTemp) o.visible = true;
            rejeter(err);
          }, { binary:true });
        });
      }

      this.attendre(false);
      const msg = `Export de ${piecesCibles.length} pièce${piecesCibles.length > 1 ? "s" : ""} vers "${nomFichier}" réussi.`;
      $("etatStats").textContent = msg;
    }catch(e){
      this.attendre(false);
      console.error(e);
      this.erreur("Erreur lors de l'export : " + (e.message || String(e)));
    }
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
        case "t": this.basculerTheme(); break;
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
          /* Échap efface d'abord le choix de face de coupe ou la mesure en cours :
             on se trompe plus souvent de point que d'outil, et refermer l'outil pour
             recommencer serait une manipulation de trop. */
          if(this.coupe?.actif && this.coupe.enChoixFace) this.coupe.desactiverChoixFace();
          else if(this.mesure.actif && this.mesure.enCours()) this.mesure.annuler();
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
    lier("selTheme", "theme", (v) => v, (val) => this.definirTheme(val, true));

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
    if($("selTheme")) $("selTheme").value = prefs.theme;
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
    this.definirTheme(prefs.theme, false);
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

