/* Banc de page des commandes ajoutées : le ruban est-il branché, le fil du noyau répond-il, les boîtes
   mènent-elles au bon fichier. Tout passe par les vrais boutons ; les téléchargements sont interceptés.
   node --experimental-websocket test/banc-conception-plus-page.mjs — n'affiche que les échecs et un bilan.
   Long sur un Raspberry Pi : à lancer en arrière-plan. */
import { ouvrirConception } from "./harnais-page.mjs";

let ok = 0, ko = 0;
const verifier = (nom, obtenu, attendu) => {
  if(JSON.stringify(obtenu) === JSON.stringify(attendu)) ok++;
  else { ko++; console.log(`ÉCHEC ${nom} : obtenu ${JSON.stringify(obtenu)}, attendu ${JSON.stringify(attendu)}`); }
};
const { page, erreurs, fermer, etape } = await ouvrirConception();

try{
  await page(`
    for(let i = 0; i < 1200 && !window.W3D?.conception; i++) await new Promise(r => setTimeout(r, 100));
    if(!window.W3D?.conception) throw new Error("la page de conception n'a pas démarré");
    const c = W3D.conception;
    window.$ = (id) => document.getElementById(id);
    window.attente = (ms) => new Promise(r => setTimeout(r, ms));
    window.fini = async () => { await attente(400); while(c.enCours || c.relancer) await attente(50); };
    /* Les fichiers : retenus ici au lieu de partir vers le navigateur. */
    window.fichiers = [];
    const creer = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (b) => { const u = creer(b); fichiers.dernier = { blob:b, url:u }; return u; };
    HTMLAnchorElement.prototype.click = function(){ fichiers.push({ nom:this.download, blob:fichiers.dernier?.blob, href:this.href }); };
    window.sortie = async () => { const f = fichiers.pop(); if(!f) return null; const o = new Uint8Array(await (f.blob || await (await fetch(f.href)).blob()).arrayBuffer());
      return { nom:f.nom, taille:o.length, debut:new TextDecoder().decode(o.subarray(0, 60)) }; };
    /* Une boîte de question : ses champs remplis, puis OK. */
    window.repondre = async (valeurs = []) => {
      for(let i = 0; i < 200 && !document.querySelector("dialog.dlg-question[open]"); i++) await attente(50);
      const d = document.querySelector("dialog.dlg-question[open]");
      if(!d) throw new Error("aucune boîte n'est ouverte");
      const champs = [...d.querySelectorAll("input, select")];
      valeurs.forEach((v, i) => { if(v !== null) champs[i].value = v; });
      const titre = d.querySelector("h2").textContent, texte = d.querySelector("p.aide")?.textContent || "";
      d.querySelector("button.tb.on").click();
      await attente(20);
      if(d.open) throw new Error("boîte refusée : " + d.querySelector(".fo-msg").textContent);
      /* L'évènement close arrive un peu après : la suite du code qui attend la réponse n'a pas encore tourné. */
      for(let i = 0; i < 1800 && d.isConnected; i++) await attente(100);
      await attente(30);
      return { titre, texte };
    };
    window.piece = async (ops, extra = {}) => {
      const doc = { ...c.docVide(), ...extra };
      doc.operations = ops.map((o, i) => ({ id:"op" + (i + 1), nom:o.type + " " + (i + 1), ...o }));
      doc.compteur = ops.length + 1;
      await c.ouvrirOnglet(doc, null, false); await fini();
      document.getElementById("accueil").hidden = true;
    };
    window.boite = (x = 0, n = {}) => ({ type:"boite", L:"20", l:"20", h:"10", x:String(x), y:"0", z:"0", operation:"nouveau", ...n });
    await fini();
  `);

  /* ---------------- le ruban ---------------- */
  verifier("tout bouton du ruban et du menu Fichier est branché", await page(`
    const muets = [...document.querySelectorAll("#ruban button:not(.ong-ruban), #menuFichier button")].filter(b => !b.onclick && !b.dataset.analyse).map(b => b.id || b.dataset.op || b.dataset.outil || b.dataset.action || b.textContent);
    return muets;
  `), []);
  verifier("chaque onglet du ruban tient dans 1500 pixels, Terminer reste visible", await page(`
    const trop = {};
    for(const g of document.querySelectorAll("#ruban .groupes")){
      const h = g.hidden; g.hidden = false;
      if(g.scrollWidth > g.clientWidth) trop[g.dataset.volet] = g.scrollWidth;
      g.hidden = h;
    }
    return trop;
  `), {});
  verifier("chaque bouton du ruban se voit, sur tous les onglets : aucun n'est hors de l'écran (les rangés .plus passent par la liste du groupe)", await page(`
    const hors = [];
    for(const g of document.querySelectorAll("#ruban .groupes")){
      const h = g.hidden; g.hidden = false;
      for(const b of g.querySelectorAll("button:not(.plus button)")){
        const r = b.getBoundingClientRect();
        if(!r.width || !r.height || r.right > innerWidth + 1 || r.left < 0) hors.push(b.dataset.op || b.dataset.outil || b.dataset.action || b.dataset.contrainte || b.id);
      }
      g.hidden = h;
    }
    return hors;
  `), []);
  verifier("une pile tient trois boutons, et la vue garde de la place", await page(`
    const trop = [...document.querySelectorAll("#ruban .pile")].filter(p => p.querySelectorAll("button").length > 3).length;
    const hauteurs = [];
    for(const g of document.querySelectorAll("#ruban .groupes")){
      const h = g.hidden; g.hidden = false;
      hauteurs.push(g.getBoundingClientRect().height);
      g.hidden = h;
    }
    /* Deux rangées au plus à 1500 pixels. */
    return [trop, Math.max(...hauteurs) < 230];
  `), [0, true]);
  verifier("chaque opération du ruban a ses champs et son nom", await page(`
    const c = W3D.conception, sortie = [];
    for(const b of document.querySelectorAll("#ruban [data-op]")){
      const s = c.schema(b.dataset.op);
      if(!s?.nom || (!s.champs.length && b.dataset.op !== "plan")) sortie.push(b.dataset.op);
    }
    return sortie;
  `), []);
  verifier("chaque outil d'esquisse a son aide et sait s'annuler", await page(`
    const c = W3D.conception;
    await piece([]);
    await c.ajouterEsquisse({ nom:"E", plan:{ base:"XY", decalage:"0" }, primitives:[] });
    c.ouvrirEsquisse(c.doc.operations[0], JSON.stringify(c.doc));
    const sortie = [];
    for(const b of document.querySelectorAll("#ruban [data-outil]")){
      c.editeur.choisirOutil(b.dataset.outil);
      if(!$("etatSel").textContent || /^Cliquez pour sélectionner/.test($("etatSel").textContent)) sortie.push(b.dataset.outil);
      c.editeur.choisirOutil(b.dataset.outil);
    }
    c.terminerEsquisse();
    await fini();
    return sortie;
  `), []);

  /* ---------------- les nouvelles opérations, depuis le script de la page ---------------- */
  verifier("les opérations passent par le panneau et le noyau du navigateur", await page(`
    const c = W3D.conception, sortie = {};
    await piece([boite(), boite(40)]);
    const essai = async (t, ch) => { const r = await c.ajouterOperation(t, ch); await fini(); sortie[t] = r.erreur || c.resultat.etats[r.op.id]?.erreur || "ok"; };
    await essai("decalerFace", { corps:"Corps 1", faces:[[0, 0, 10]], distance:"2" });
    await essai("englobant", { marge:"1" });
    await essai("retirerCorps", { corps:"Corps 3" });
    await essai("aligner", { corps:"Corps 2", reference:"Corps 1", x:"apres" });
    await essai("repetition", { corps:"Corps 2", axe:"Y", nombre:"2", pas:"30", axe2:"Z", nombre2:"2", pas2:"30", separe:true });
    return [sortie, c.nomsCorps.length];
  `), [{ decalerFace:"ok", englobant:"ok", retirerCorps:"ok", aligner:"ok", repetition:"ok" }, 5]);

  /* ---------------- esquisse ---------------- */
  verifier("tracés et outils de l'esquisse", await page(`
    const c = W3D.conception;
    await piece([]);
    await c.ajouterEsquisse({ nom:"E", plan:{ base:"XY", decalage:"0" }, primitives:[] });
    c.ouvrirEsquisse(c.doc.operations[0], JSON.stringify(c.doc));
    const ed = c.editeur, P = (x, y) => ({ x, y, id:null });
    const compte = (t) => ed.esq.elements.filter(e => e.type === t).length;
    const tracer = (outil, ...pts) => { ed.choisirOutil(outil); for(const p of pts) ed.clic(p, {}); ed.choisirOutil(outil); };
    const r = {};
    tracer("cercle3", P(10, 0), P(0, 10), P(-10, 0)); r.cercle3 = compte("cercle");
    tracer("cercle2", P(30, 0), P(40, 0)); r.cercle2 = compte("cercle");
    tracer("rectangle3", P(60, 0), P(70, 0), P(60, 5)); r.rect3 = compte("ligne");
    tracer("ellipse", P(100, 0), P(110, 0), P(100, 5)); r.ellipse = compte("spline");
    tracer("polygoneCirc", P(130, 0), P(140, 0)); r.polyC = compte("ligne");
    tracer("polygoneArete", P(160, 0), P(170, 0)); r.polyA = compte("ligne");
    tracer("ligneMilieu", P(190, 0), P(195, 0)); r.milieu = compte("ligne");
    tracer("ligneConstruction", P(200, 0), P(210, 0)); r.constr = ed.esq.elements.filter(e => e.type === "ligne" && e.constr).length;
    tracer("oblongCentre", P(230, 0), P(235, 0), P(230, 2)); r.oblongCentre = compte("arc");
    tracer("oblongHorsTout", P(250, 0), P(270, 0), P(260, 2)); r.oblongHors = compte("arc");
    /* Une boîte de question pour ceux qui demandent une valeur. */
    ed.choisirOutil("rectangleArrondi"); ed.clic(P(300, 0), {}); ed.clic(P(320, 10), {}); await repondre(["2"]); ed.choisirOutil("rectangleArrondi");
    r.arcsArrondi = compte("arc");
    ed.choisirOutil("conique"); ed.clic(P(350, 0), {}); ed.clic(P(360, 0), {}); ed.clic(P(355, 10), {}); await repondre(["0.5"]); ed.choisirOutil("conique");
    r.conique = compte("spline");
    const eq = ed.courbeEquation(); await repondre(["400 + t", "t", "0", "10", "5"]); await eq; r.equation = compte("spline");
    r.statutOk = ed.dernier?.ok !== false;
    r.dof = typeof ed.dernier?.dof;
    c.terminerEsquisse();
    await fini();
    return r;
  `), { cercle3:1, cercle2:2, rect3:4, ellipse:1, polyC:10, polyA:16, milieu:17, constr:1, oblongCentre:2, oblongHors:4, arcsArrondi:8, conique:2, equation:3, statutOk:true, dof:"number" });

  verifier("modifier la sélection, cote pilotée, copier-coller, bouts libres", await page(`
    const c = W3D.conception;
    await piece([]);
    await c.ajouterEsquisse({ nom:"E", plan:{ base:"XY", decalage:"0" }, primitives:[{ type:"ligne", a:[0, 0], b:[10, 0.01] }, { type:"ligne", a:[20, -5], b:[20, 5] }] });
    c.ouvrirEsquisse(c.doc.operations[0], JSON.stringify(c.doc));
    const ed = c.editeur, r = {};
    const lignes = () => ed.esq.elements.filter(e => e.type === "ligne");
    const [a] = lignes();
    /* Prolonger : la première ligne rejoint la seconde. */
    ed.outil = "prolonger"; ed.designer = () => a; ed.clic({ x:9, y:0, id:null }, {}); delete ed.designer; ed.outil = null;
    r.prolonge = lignes().length;
    ed.autoContraindre(); r.auto = ed.esq.contraintes.filter(k => k.type === "horizontal" || k.type === "vertical").length > 0;
    ed.selection = new Set([lignes()[1].id]);
    ed.coter();
    await attente(50);
    ed.annulerSaisie?.();
    const cote = ed.esq.contraintes.find(k => k.type === "longueur");
    ed.selection = new Set([cote.id]);
    ed.basculerPilotee();
    r.pilotee = ed.esq.contraintes.find(k => k.id === cote.id).pilotee === true;
    r.etiquette = /^\\(/.test(ed.cotes.get(cote.id)?.textContent || "");
    ed.selection = new Set([lignes()[0].id]);
    r.copie = ed.copier();
    r.colle = (ed.coller(), lignes().length);
    ed.boutsLibres(); r.libres = ed.selection.size > 0;
    const pgn = ed.basculerPeigne(); r.peigne = pgn; ed.basculerPeigne();
    r.branche = !!document.querySelector('[data-action="pilotee"]').onclick;
    $("bEsquisseDxf").click();
    r.dxf = /SECTION/.test((await sortie())?.debut || "");
    c.terminerEsquisse();
    await fini();
    return r;
  `), { prolonge:2, auto:true, pilotee:true, etiquette:true, copie:true, colle:3, libres:true, peigne:true, branche:true, dxf:true });

  verifier("intersection du modèle avec le plan de l'esquisse", await page(`
    const c = W3D.conception;
    await piece([boite()]);
    await c.ajouterEsquisse({ nom:"E", plan:{ base:"XY", decalage:"5" }, primitives:[] });
    c.ouvrirEsquisse(c.doc.operations[1], JSON.stringify(c.doc));
    await fini();
    document.querySelector('[data-action="intersection"]').click();
    await fini();
    await attente(200);
    const n = c.editeur.esq.elements.filter(e => e.type === "ligne" && e.constr).length;
    c.terminerEsquisse();
    await fini();
    return n;
  `), 4);

  /* ---------------- fichiers ---------------- */
  verifier("exports 3MF, OBJ, URDF, DXF de la vue, script", await page(`
    await piece([boite(), boite(40)]);
    await W3D.conception.ajouterOperation("liaison", { mode:"rigide", corpsA:"Corps 1", corpsB:"Corps 2", repereA:{ type:"plan", point:[0, 0, 10], normale:[0, 0, 1] }, repereB:{ type:"plan", point:[40, 0, 0], normale:[0, 0, -1] }, decalage:"0" });
    await fini();
    const r = {};
    $("bExport3mf").click(); await attente(100); await fini(); while(!fichiers.length) await attente(50);
    let f = await sortie(); r.mf = [f.nom, f.debut.slice(0, 2)];
    $("bExportObj").click(); while(!fichiers.length) await attente(50);
    f = await sortie(); r.obj = [f.nom, f.debut.startsWith("# WEB_3D")];
    $("bExportUrdf").click(); while(!fichiers.length) await attente(50);
    f = await sortie(); r.urdf = [f.nom, f.debut.slice(0, 2)];
    $("bExportVueDxf").click(); await repondre(["calque"]); while(!fichiers.length) await attente(50);
    f = await sortie(); r.dxf = [f.nom, /SECTION/.test(f.debut)];
    $("bExportScript").click(); f = await sortie(); r.script = [f.nom, /console/.test(f.debut)];
    return r;
  `), { mf:["piece.3mf", "PK"], obj:["piece.obj", true], urdf:["piece.zip", "PK"], dxf:["piece-vue.dxf", true], script:["piece-script.js", true] });

  verifier("nuage de points et glTF insérés", await page(`
    const c = W3D.conception;
    await piece([boite()]);
    await c.ouvrirFichiers([new File(["1 2 3\\n4 5 6\\n"], "nuage.xyz")]);
    await fini();
    c.validerOperation();
    await fini();
    const r = { nuage:c.doc.operations.at(-1).type };
    /* Un glb écrit par la page, relu par la page. */
    await piece([boite()]);
    $("bGlb").click(); while(!fichiers.length) await attente(50);
    const octets = fichiers.pop().blob;
    await c.ouvrirFichiers([new File([octets], "cube.glb")]);
    await fini();
    const op = c.doc.operations.at(-1);
    r.glb = [op.type, c.resultat.etats[op.id]?.erreur ?? "ok"];
    c.validerOperation();
    await fini();
    return r;
  `), { nuage:"nuage", glb:["maillage", "ok"] });

  /* ---------------- inspecter ---------------- */
  verifier("analyses, comparaison, balayage, centre de gravité, nomenclature", await page(`
    const c = W3D.conception;
    await piece([boite(), boite(10)], { parametres:[{ nom:"L", expr:"20" }] });
    const r = {};
    $("bAnalyseCorps").click();
    const a = await repondre();
    r.analyse = [a.titre, /jonctions tangentes/.test(a.texte)];
    r.traits = c.traceAnalyse.children.length > 0;
    $("bComparer").click(); await repondre(); const k = await repondre(); r.comparaison = /En commun : 2.000 mm³/.test(k.texte.replace(/\\u202f/g, ".").replace(/\\s(?=\\d{3})/g, "."));
    $("bBalayage").click(); await repondre(["L", "10", "30", "3"]); while(!fichiers.length) await attente(50);
    const f = await sortie(); r.balayage = [f.nom, /^L;corps/.test(f.debut)];
    $("bCentreGravite").click(); r.cg = /Centre de gravité/.test($("etatSel").textContent); $("bCentreGravite").click();
    $("bNomenclature").click(); const n = await sortie(); r.bom = [n.nom, /^repère/.test(n.debut)];
    for(const b of document.querySelectorAll("[data-analyse]")){ b.click(); await attente(20); b.click(); }
    return r;
  `), { analyse:["Attention", true], traits:true, comparaison:true, balayage:["piece-balayage-L.csv", true], cg:true, bom:["piece-nomenclature.csv", true] });

  /* ---------------- apparences et rendu ---------------- */
  verifier("apparence d'un corps, d'une face, masse par corps", await page(`
    const c = W3D.conception;
    await piece([boite()]);
    const m = W3D.vue.modele.children[0];
    W3D.arbre.selectionner(m);
    $("bApparence").click();
    await repondre(["Laiton", null, null, null, null, "Laiton"]);
    await fini();
    const a = c.doc.apparences["Corps 1"], mat = W3D.vue.modele.children[0].material;
    const r = { doc:[a.couleur, a.metal, a.materiau], metal:mat.metalness, teinte:"#" + mat.color.getHexString() };
    W3D.arbre.selectionner(null); c.afficherProprietes(null);
    r.masse = /34g/.test(document.querySelector(".fiche-masse")?.textContent.replace(/\\s/g, "") || "") || document.querySelector(".fiche-masse")?.textContent;
    /* Une face peinte : la pièce porte alors un matériau par couleur. */
    c.modifierDoc(() => { c.doc.apparences["Corps 1"] = { faces:[{ point:[0, 0, 10], couleur:"#ff0000" }] }; });
    await fini();
    r.faces = Array.isArray(W3D.vue.modele.children[0].material);
    return r;
  `), { doc:["#c9a84a", 1, "Laiton"], metal:1, teinte:"#c9a84a", masse:true, faces:true });

  verifier("rendu d'une image, la vue revient comme elle était", await page(`
    const c = W3D.conception;
    await piece([boite()]);
    const r0 = W3D.vue.renderer, avant = [r0.domElement.width, r0.domElement.height, W3D.vue.annotations.visible, W3D.vue.camera().aspect];
    $("bRendu").click();
    await repondre(["64", "32", "blanc", "non"]);
    while(!fichiers.length) await attente(50);
    const f = await sortie();
    const apres = [r0.domElement.width, r0.domElement.height, W3D.vue.annotations.visible, W3D.vue.camera().aspect];
    /* Occlusion : une autre image pour la même vue, et la vue revient encore. */
    $("bRendu").click();
    await repondre(["64", "32", "blanc", "non", "oui"]);
    while(!fichiers.length) await attente(50);
    const g = await sortie();
    const fin = [r0.domElement.width, r0.domElement.height, W3D.vue.annotations.visible, W3D.vue.camera().aspect];
    return [f.nom, f.debut.slice(1, 4), JSON.stringify(avant) === JSON.stringify(apres), g.debut.slice(1, 4), g.taille !== f.taille, JSON.stringify(avant) === JSON.stringify(fin)];
  `), ["piece-rendu.png", "PNG", true, "PNG", true, true]);

  /* ---------------- historique, paramètres, configurations ---------------- */
  verifier("copier-coller d'opérations, reprise, tout recalculer, répéter", await page(`
    const c = W3D.conception;
    await piece([boite()]);
    const r = {};
    c.selOp = "op1"; c.selOps = new Set(["op1"]);
    c.copierOps();
    dispatchEvent(new KeyboardEvent("keydown", { key:"v", ctrlKey:true, bubbles:true, cancelable:true }));
    await fini();
    r.colle = [c.doc.operations.length, c.doc.operations[1].nom, c.nomsCorps.length];
    $("bReprises").click(); [...document.querySelectorAll(".menu-flottant button")].find(b => /Créer/.test(b.textContent))?.click();
    r.reprise = c.reprises.length;
    c.modifierDoc(() => { c.doc.operations.pop(); });
    await fini();
    $("bReprises").click(); [...document.querySelectorAll(".menu-flottant button")].find(b => /↩/.test(b.textContent))?.click();
    await repondre();
    await fini();
    r.revenu = c.doc.operations.length;
    $("bRecalculer").click(); await attente(100); await fini();
    r.recalcul = c.nomsCorps.length;
    c.creer("boite"); c.annulerOperation(); await fini();
    dispatchEvent(new KeyboardEvent("keydown", { key:"R", shiftKey:true, bubbles:true, cancelable:true }));
    r.repete = c.edition?.op.type;
    c.annulerOperation(); await fini();
    return r;
  `), { colle:[2, "boite 1 (copie)", 2], reprise:1, revenu:2, recalcul:2, repete:"boite" });

  verifier("paramètres : favori, commentaire, usages ; configuration : suspensions", await page(`
    const c = W3D.conception;
    await piece([boite(0, { L:"L" })], { parametres:[{ nom:"a", expr:"1" }, { nom:"L", expr:"20" }] });
    c.ouvrirParametres();
    const t = $("tabParametres");
    const r = { tete:[...t.rows[0].cells].map(x => x.textContent).filter(Boolean) };
    /* L sert à la boîte ; a ne sert à rien. */
    const parNom = (n) => [...t.rows].find(x => x.cells[1]?.querySelector("input")?.value === n);
    r.usages = [parNom("L").cells[5].textContent, parNom("a").cells[5].textContent];
    parNom("L").cells[0].querySelector("button").click();
    r.premier = $("tabParametres").rows[1].cells[1].querySelector("input").value;
    $("dlgParametres").close();
    await attente(300);
    (c.doc.configurations ||= []).push({ nom:"X", valeurs:{}, suspendues:[] });
    c.ouvrirConfigurations();
    r.ligneSuspendues = [...$("tabConfigurations").rows].some(x => x.cells[0].textContent === "Opérations suspendues");
    $("dlgConfigurations").close();
    await attente(300);
    await fini();
    return r;
  `), { tete:["Nom", "Expression", "Valeur", "Commentaire", "Sert à"], usages:["1", "—"], premier:"L", ligneSuspendues:true });

  /* ---------------- mouvement ---------------- */
  verifier("étude de mouvement : liaison pilotée, trajectoire, table", await page(`
    const c = W3D.conception;
    await piece([boite(), boite(40), boite(80)]);
    const cyl = (p) => ({ type:"cylindre", point:p, axe:[0, 0, 1] });
    await c.ajouterOperation("liaison", { nom:"Vis", mode:"pivot", telleQuelle:true, corpsA:"Corps 1", corpsB:"Corps 2", repereA:cyl([40, 0, 0]), valeur:"0" });
    await c.ajouterOperation("liaison", { nom:"Écrou", mode:"glissiere", telleQuelle:true, corpsA:"Corps 1", corpsB:"Corps 3", repereA:cyl([80, 0, 0]), pilote:c.doc.operations[3].id, loi:"x / 360 * 2" });
    await fini();
    const r = { erreurs:Object.values(c.resultat.etats).filter(n => n.erreur).length };
    $("bEtude").click();
    [...document.querySelectorAll(".menu-flottant button")].find(b => /Nouvelle étude/.test(b.textContent)).click();
    await repondre(["E1", "0, 360", "3", "Corps 3", "non", "non", "non"]);
    for(let i = 0; i < 1200 && (c.animation || !c.derniereEtude); i++) await attente(100);
    await fini();
    const e = c.derniereEtude.tableau;
    r.pas = e.length;
    r.monte = [Math.round(e[0].centre[2]), Math.round(e.at(-1).centre[2])];
    r.piste = c.traceAnalyse.children.length > 0;
    $("bEtude").click();
    [...document.querySelectorAll(".menu-flottant button")].find(b => /CSV/.test(b.textContent)).click();
    const f = await sortie();
    r.csv = [f.nom, /^pas;Vis/.test(f.debut)];
    return r;
  `), { erreurs:0, pas:4, monte:[5, 7], piste:true, csv:["piece-etude.csv", true] });

  /* ---------------- second lot ---------------- */
  verifier("composants : créer, activer, y entrer, occurrence, extraire, dissoudre", await page(`
    const c = W3D.conception;
    await piece([]);
    $("bNouveauComposant").click(); await repondre(["Capot"]); await fini();
    const r = { actif:c.doc.composants[0].nom };
    await c.ajouterOperation("boite", { L:"10", l:"10", h:"10" });
    r.tag = c.doc.operations[0].composant === c.doc.composants[0].id;
    await fini();
    r.liste = $("navComposants").textContent;
    /* Sortir du composant : le reste de la pièce n'y entre plus. */
    $("navComposants").querySelector(".nv").click();
    await c.ajouterOperation("boite", { L:"5", l:"5", h:"5", x:"30", operation:"nouveau" });
    r.horsComposant = c.doc.operations[1].composant ?? null;
    await c.ajouterOperation("occurrence", { source:c.doc.composants[0].id, ty:"40" });
    await fini();
    r.corps = c.nomsCorps.length;
    r.erreur = c.resultat.etats[c.doc.operations[2].id]?.erreur ?? null;
    /* Masquer le composant cache son corps, pas l'occurrence qui est hors de lui. */
    $("navComposants").querySelector(".oeil").click();
    await attente(30);
    r.visibles = W3D.vue.modele.children.filter(m => m.visible).length;
    $("navComposants").querySelector(".oeil").click();
    /* Activer estompe le reste. */
    $("navComposants").querySelector(".nv").click();
    await attente(30);
    r.estompe = W3D.vue.modele.children.filter(m => (Array.isArray(m.material) ? m.material[0] : m.material).opacity < 0.5).length;
    $("navComposants").querySelector(".nv").click();
    await fini();
    $("navComposants").querySelector(".nv").dispatchEvent(new MouseEvent("contextmenu", { bubbles:true, clientX:50, clientY:50 }));
    [...document.querySelectorAll(".menu-flottant button")].find(b => /Dissoudre/.test(b.textContent)).click();
    await fini();
    r.dissous = [(c.doc.composants || []).length, c.doc.operations[0].composant ?? null];
    return r;
  `), { actif:"Capot", tag:true, liste:"◉⧈Capot (1)", horsComposant:null, corps:3, erreur:null, visibles:2, estompe:2, dissous:[0, null] });

  verifier("limites, contacts, chemin 3D, plan par deux arêtes, éclaté nommé", await page(`
    const c = W3D.conception;
    await piece([boite(0, { L:"10", l:"10", h:"10" }), boite(40, { L:"10", l:"6", h:"6", y:"2", z:"2" })]);
    const r = {};
    await c.ajouterOperation("liaison", { nom:"G", mode:"glissiere", telleQuelle:true, corpsA:"Corps 1", corpsB:"Corps 2", repereA:{ type:"cylindre", point:[0, 0, 0], axe:[-1, 0, 0] }, valeur:"0" });
    await fini();
    $("bContacts").click();
    [...document.querySelectorAll(".menu-flottant button")].find(b => /Nouveau jeu/.test(b.textContent)).click();
    await repondre(["J", "Corps 1, Corps 2"]);
    await fini();
    r.jeu = c.doc.contacts[0].corps.length;
    $("bLimites").click();
    /* Le corps 2 est à 30 mm : la butée doit tomber près de 30. */
    await repondre([null, "0", "0", "60", "10", "J"]);
    for(let i = 0; i < 1800 && !document.querySelector("dialog.dlg-question[open]"); i++) await attente(100);
    await repondre();
    await fini();
    const op = c.doc.operations.find(o => o.nom === "G");
    r.butee = Math.abs(+op.max - 30) < 0.5 || op.max;
    await c.ajouterOperation("chemin3d", { points:"0,0,0; 10,0,0; 10,10,5" });
    const tu = await c.ajouterOperation("tuyau", { chemin:c.doc.operations.at(-1).id, diametre:"2", operation:"nouveau" });
    r.tuyau = tu.erreur;
    await fini();
    await piece([boite()]);
    const p = await c.ajouterOperation("plan", { mode:"aretes", lignes:[[[0, 0, 10], [20, 0, 10]], [[0, 20, 10], [20, 20, 10]]] });
    r.plan = p.erreur;
    await c.ajouterEsquisse({ nom:"E", plan:{ ref:p.op.id }, primitives:[{ type:"cercle", c:[5, 5], r:2 }] });
    const e = await c.ajouterOperation("extrusion", { esquisse:c.doc.operations.at(-1).id, distance:"3", operation:"nouveau" });
    r.surPlan = e.erreur;
    await fini();
    await piece([boite(), boite(40)]);
    $("bEclate").click(); [...document.querySelectorAll(".menu-flottant button")].find(b => /×2/.test(b.textContent)).click();
    await attente(30);
    $("bEclate").click(); [...document.querySelectorAll(".menu-flottant button")].find(b => /Enregistrer cet/.test(b.textContent)).click();
    await repondre(["Écarté"]); await fini();
    r.eclate = c.doc.eclates[0];
    $("bEclate").click(); [...document.querySelectorAll(".menu-flottant button")].find(b => /Assemblé/.test(b.textContent)).click();
    return r;
  `), { jeu:2, butee:true, tuyau:null, plan:null, surPlan:null, eclate:{ nom:"Écarté", f:2 } });

  verifier("pinceau, image vers esquisse, bibliothèque, disposition, style", await page(`
    const c = W3D.conception;
    await piece([boite(), boite(40)]);
    const r = {};
    W3D.arbre.selectionner(W3D.vue.modele.children[0]);
    $("bApparence").click(); await repondre(["Laiton"]); await fini();
    W3D.arbre.selectionner(W3D.vue.modele.children[0]);
    $("bCopierLook").click();
    $("bPinceau").click();
    r.pinceau = c.pinceau;
    /* Un clic au centre du second corps, en coordonnées d'écran. */
    W3D.vue.ajusterVue(W3D.vue.modele); W3D.vue.rendre();
    const p = W3D.vue.versEcran(new W3D.THREE.Vector3(40, 0, 10)), b = W3D.vue.canvas.getBoundingClientRect();
    c.clicVue({ clientX:b.left + p.x, clientY:b.top + p.y });
    await fini();
    r.peint = c.doc.apparences["Corps 2"]?.couleur;
    $("bPinceau").click();
    /* Une image : un carré noir sur fond blanc. */
    await piece([]);
    const t = Object.assign(document.createElement("canvas"), { width:40, height:40 }), x = t.getContext("2d");
    x.fillStyle = "#fff"; x.fillRect(0, 0, 40, 40); x.fillStyle = "#000"; x.fillRect(10, 10, 20, 20);
    await c.ouvrirFichiers([new File([await new Promise(o => t.toBlob(o, "image/png"))], "carre.png")]);
    await fini();
    c.edition.op.largeur = "40";
    c.validerOperation(); await fini();
    $("bImageEsquisse").click(); await repondre(); await fini(); await attente(100);
    const es = c.doc.operations.at(-1);
    r.trace = [es.type, es.elements.filter(e => e.type === "ligne").length];
    await piece([boite()]);
    c.selOp = "op1"; c.selOps = new Set(["op1"]);
    $("bBibliotheque").click(); [...document.querySelectorAll(".menu-flottant button")].find(b => /Y ranger/.test(b.textContent)).click();
    await repondre(["Cube"]); await attente(50);
    $("bBibliotheque").click(); [...document.querySelectorAll(".menu-flottant button")].find(b => /⧉ Cube/.test(b.textContent)).click();
    await fini();
    r.bibliotheque = c.doc.operations.length;
    $("bBibliotheque").click(); [...document.querySelectorAll(".menu-flottant button")].find(b => /✕ Retirer/.test(b.textContent)).click();
    $("navigateur").style.left = "33px";
    $("bDisposition").click(); [...document.querySelectorAll(".menu-flottant button")].find(b => /Enregistrer la/.test(b.textContent)).click();
    $("navigateur").style.left = "99px";
    $("bDisposition").click(); [...document.querySelectorAll(".menu-flottant button")].find(b => /Reprendre/.test(b.textContent)).click();
    r.disposition = $("navigateur").style.left;
    $("bDisposition").click(); [...document.querySelectorAll(".menu-flottant button")].find(b => /origine/.test(b.textContent)).click();
    $("bStyle").click(); [...document.querySelectorAll(".menu-flottant button")].find(b => b.textContent === "Filaire").click();
    r.filaire = !!W3D.vue.modeFilaire;
    $("bStyle").click(); [...document.querySelectorAll(".menu-flottant button")].find(b => b.textContent === "Ombré avec arêtes").click();
    r.ombre = !W3D.vue.modeFilaire;
    return r;
  `), { pinceau:true, peint:"#c9a84a", trace:["esquisse", 4], bibliotheque:2, disposition:"33px", filaire:true, ombre:true });

  /* ---------------- troisième lot ---------------- */
  verifier("une arête projetée suit la pièce, et ce qui en dépend se refait", await page(`
    const c = W3D.conception;
    await piece([boite(0, { L:"L", l:"10", h:"10" })], { parametres:[{ nom:"L", expr:"10" }] });
    W3D.vue.ajusterVue(W3D.vue.modele);
    await c.ajouterEsquisse({ nom:"E", plan:{ base:"XY", decalage:"20" }, primitives:[] });
    const esq = c.doc.operations[1];
    /* Le lien, tel que le geste Projeter le pose : deux points fixés sur l'arête du bas. */
    esq.elements.push({ id:"pa", type:"point", x:0, y:0 }, { id:"pb", type:"point", x:10, y:0 }, { id:"pc", type:"point", x:0, y:5 }, { id:"l1", type:"ligne", p1:"pa", p2:"pb" }, { id:"l2", type:"ligne", p1:"pb", p2:"pc" }, { id:"l3", type:"ligne", p1:"pc", p2:"pa" });
    esq.contraintes.push({ id:"fa", type:"fixe", a:"pa", x:0, y:0, projete:true }, { id:"fb", type:"fixe", a:"pb", x:10, y:0, projete:true }, { id:"fc", type:"fixe", a:"pc", x:0, y:5 });
    esq.projections = [{ arete:[5, 0, 10], corps:"Corps 1", genre:"lignes", points:["pa", "pb"] }];
    await c.ajouterOperation("extrusion", { esquisse:esq.id, distance:"2", operation:"nouveau" });
    await fini();
    const r = { avant:Math.round(c.resultat.maillages[1].proprietes.volume) };
    c.modifierDoc(() => { c.doc.parametres[0].expr = "30"; });
    await fini(); await fini();
    r.apres = Math.round(c.resultat.maillages[1].proprietes.volume);
    r.point = Math.round(esq.elements.find(e => e.id === "pb").x);
    r.passes = c.passesProjection;
    /* Délier : le point garde sa place, la pièce ne le commande plus. */
    c.ouvrirEsquisse(esq, JSON.stringify(c.doc)); await fini();
    c.editeur.selection = new Set(["l1"]);
    document.querySelector('[data-action="delierProjection"]').click();
    r.delie = esq.projections.length;
    c.terminerEsquisse(); await fini();
    c.modifierDoc(() => { c.doc.parametres[0].expr = "50"; });
    await fini(); await fini();
    r.fige = Math.round(esq.elements.find(e => e.id === "pb").x);
    return r;
  `), { avant:50, apres:150, point:30, passes:0, delie:0, fige:30 });

  verifier("le geste Projeter pose le lien", await page(`
    const c = W3D.conception;
    await piece([boite()]);
    W3D.nav.allerVersDirection(new W3D.THREE.Vector3(0, 0, 1), false); W3D.vue.ajusterVue(W3D.vue.modele); W3D.vue.rendre();
    await c.ajouterEsquisse({ nom:"E", plan:{ base:"XY", decalage:"30" }, primitives:[] });
    c.ouvrirEsquisse(c.doc.operations[1], JSON.stringify(c.doc)); await fini();
    W3D.vue.rendre();
    const e = W3D.vue.versEcran(new W3D.THREE.Vector3(10, 0, 10)), b = W3D.vue.canvas.getBoundingClientRect();
    c.projeterArete({ clientX:b.left + e.x, clientY:b.top + e.y });
    const esq = c.editeur.esq, l = esq.projections?.[0];
    const r = l ? [l.genre, l.corps, l.points.length, esq.contraintes.filter(k => k.projete).length] : "aucun lien";
    c.terminerEsquisse(); await fini();
    return [r, c.resultat.etats[c.doc.operations[1].id]?.erreur ?? null];
  `), [["lignes", "Corps 1", 2, 2], null]);

  verifier("maillage converti : une esquisse, une extrusion, la hauteur en paramètre", await page(`
    const c = W3D.conception;
    await piece([{ type:"cylindre", diametre:"20", h:"10", axe:"Z", x:"0", y:"0", z:"0", operation:"nouveau" }]);
    $("bGlb").click(); while(!fichiers.length) await attente(50);
    const octets = fichiers.pop().blob;
    await piece([]);
    await c.ouvrirFichiers([new File([octets], "cyl.glb")]);
    await fini();
    c.edition.op.reference = false;
    c.validerOperation(); await fini();
    const tailleLue = c.resultat.maillages.find(q => !q.erreur).proprietes?.boite;
    const dimension = tailleLue ? Math.round(tailleLue[1][2] - tailleLue[0][2]) : null;
    $("bConvertirMaillage").click(); await repondre(); 
    for(let i = 0; i < 600 && !/Section :/.test($("etatSel").textContent); i++) await attente(100);
    await fini();
    const [m, s, x] = c.doc.operations;
    const r = { dimension, types:c.doc.operations.map(o => o.type), suspendu:m.suspendue, cercles:s.elements.filter(e => e.type === "cercle").length, parametre:c.doc.parametres[0].nom === x.distance };
    r.ecart = parseFloat(($("etatSel").textContent.match(/écart ([\\d,]+)/) || [])[1]?.replace(",", ".")) < 2 || $("etatSel").textContent;
    /* La hauteur commande maintenant la pièce. */
    const v0 = c.resultat.maillages.find(q => !q.erreur).proprietes.volume;
    c.modifierDoc(() => { c.doc.parametres[0].expr = String(2 * +c.doc.parametres[0].expr); });
    await fini();
    r.double = Math.abs(c.resultat.maillages.find(q => !q.erreur).proprietes.volume / v0 - 2) < 0.01;
    return r;
  `), { dimension:10, types:["maillage", "esquisse", "extrusion"], suspendu:true, cercles:1, parametre:true, ecart:true, double:true });

  verifier("tous les corps de même apparence", await page(`
    const c = W3D.conception;
    await piece([boite(), boite(40), boite(80)]);
    c.doc.apparences = { "Corps 1":{ couleur:"#112233", metal:0, rugosite:0.5, opacite:1 }, "Corps 2":{ couleur:"#112233", metal:0, rugosite:0.5, opacite:1 }, "Corps 3":{ couleur:"#ff0000", metal:0, rugosite:0.5, opacite:1 } };
    c.reconstruire(); await fini();
    W3D.arbre.selectionner(W3D.vue.modele.children[0]);
    $("bMemeLook").click();
    const r = { nb:c.groupeChoisi.size, surligne:W3D.vue.modele.children.filter(m => m.userData.matSauve).length };
    $("bApparence").click();
    await repondre(["Laiton"]);
    await fini();
    r.apres = ["Corps 1", "Corps 2", "Corps 3"].map(n => c.doc.apparences[n].couleur);
    r.oublie = c.groupeChoisi === null;
    r.residu = W3D.vue.modele.children.filter(m => m.userData.matSauve && m !== W3D.arbre.selection).length;
    return r;
  `), { nb:2, surligne:2, apres:["#c9a84a", "#c9a84a", "#ff0000"], oublie:true, residu:0 });

  verifier("aucune erreur dans la page", erreurs.filter(e => !/favicon|WebGL|GPU stall|swiftshader/i.test(e)), []);
}catch(e){
  ko++;
  console.log(`ÉCHEC du banc à l'étape « ${etape()} » : ${e.message}`);
  if(erreurs.length) console.log("Erreurs de la page :\n  " + erreurs.slice(0, 8).join("\n  "));
}finally{
  await fermer();
}
console.log(ko ? `banc-conception-plus-page : ${ko} échec(s), ${ok} OK` : `banc-conception-plus-page : OK (${ok} vérifications)`);
process.exit(ko ? 1 : 0);
