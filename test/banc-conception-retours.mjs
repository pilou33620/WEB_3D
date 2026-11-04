/* Banc des retours d'usage du mode conception : désigner une arête, mesurer juste, les boîtes de question,
   les champs qui ne bougent pas, le cube de vue, le maillage, l'échec de construction, l'écriture par script.
   node --experimental-websocket test/banc-conception-retours.mjs — n'affiche que les échecs et un bilan.
   CAPTURES=dossier y dépose des captures. Long sur un Raspberry Pi : à lancer en arrière-plan. */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { ouvrirConception, pause } from "./harnais-page.mjs";

let ok = 0, ko = 0;
const verifier = (nom, obtenu, attendu) => {
  if(JSON.stringify(obtenu) === JSON.stringify(attendu)) ok++;
  else { ko++; console.log(`ÉCHEC ${nom} : obtenu ${JSON.stringify(obtenu)}, attendu ${JSON.stringify(attendu)}`); }
};

const { cdp, page, erreurs, portWeb, fermer, souris, cliquer, etape } = await ouvrirConception();
const capture = async (nom) => {
  if(!process.env.CAPTURES) return;
  const { data } = await cdp("Page.captureScreenshot", { format:"png" });
  writeFileSync(join(process.env.CAPTURES, nom + ".png"), Buffer.from(data, "base64"));
};

try{
  await page(`
    for(let i = 0; i < 1200 && !window.W3D?.conception; i++) await new Promise(r => setTimeout(r, 100));
    if(!window.W3D?.conception) throw new Error("la page de conception n'a pas démarré");
    const c = W3D.conception;
    window.fini = async () => { await new Promise(r => setTimeout(r, 400)); while(c.enCours || c.relancer) await new Promise(r => setTimeout(r, 50)); };
    window.nePasUtiliser = (n) => () => { throw new Error(n + " : fenêtre native du navigateur"); };
    window.prompt = nePasUtiliser("prompt"); window.confirm = nePasUtiliser("confirm"); window.alert = nePasUtiliser("alert");
    /* Écrit une pièce directement, sans passer par le ruban. */
    window.piece = async (ops) => {
      const doc = c.docVide();
      doc.operations = ops.map((o, i) => ({ id:"op" + (i + 1), nom:o.type + " " + (i + 1), x:"0", y:"0", z:"0", corps:"", ...o }));
      doc.compteur = ops.length + 1;
      await c.ouvrirOnglet(doc, null, false); await fini();
      document.getElementById("accueil").hidden = true;
      W3D.nav.allerVersDirection(new W3D.THREE.Vector3(1, -1.4, 0.8), false);
      W3D.vue.invalider();
    };
    /* L'écran d'un point de la pièce, en coordonnées de la fenêtre. */
    window.ecran = (x, y, z) => { const e = W3D.vue.versEcran(new W3D.THREE.Vector3(x, y, z)), r = W3D.vue.canvas.getBoundingClientRect(); return [r.left + e.x, r.top + e.y]; };
    await fini();
  `);

  /* ---------------- 1. désigner une arête ---------------- */
  /* Deux cercles voisins : le bord du chanfrein (z=28, r=20) et son haut (z=30, r=18). */
  const r1 = await page(`
    const c = W3D.conception;
    await piece([{ type:"cylindre", diametre:"40", h:"30", axe:"Z", operation:"nouveau" }, { type:"chanfrein", corps:"", distance:"2", toutes:false, aretes:[[20, 0, 30]] }]);
    if(Object.values(c.resultat.etats).some(e => e.erreur)) throw new Error("pièce d'essai en erreur");
    await c.editer(c.doc.operations[1]); await fini();
    c.edition.op.aretes = [];
    c.designer("aretes"); await fini();
    /* On s'éloigne jusqu'à ce que les deux cercles (avant la pièce : un cercle seul) soient à quelques pixels */
    return c.aretes().length;`);
  verifier("désignation : on désigne sur la pièce d'avant l'opération (2 cercles et une couture)", r1, 3);

  const r2 = await page(`
    const c = W3D.conception;
    c.annulerOperation(); await fini();
    /* Une bague : son bord et son pied, à quelques pixels l'un de l'autre, le bord passant devant */
    await piece([{ type:"cylindre", diametre:"40", h:"30", axe:"Z", operation:"nouveau" },
                 { type:"cylindre", diametre:"42", h:"10", axe:"Z", z:"18", operation:"joindre" },
                 { type:"conge", corps:"", rayon:"0.5", toutes:false, aretes:[] }]);
    await c.editer(c.doc.operations[2]); await fini();
    c.designer("aretes"); await fini();
    W3D.nav.allerVersDirection(new W3D.THREE.Vector3(0, -1, 1), false);
    const cam = W3D.vue.camera();
    let d = 0;
    for(let k = 0; k < 40; k++){
      const a = ecran(0, -20, 28), b = ecran(0, -21, 28);
      d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if(d < 7) break;
      cam.position.sub(W3D.vue.cible).multiplyScalar(1.25).add(W3D.vue.cible);
      W3D.vue.ortho.zoom = (W3D.vue.ortho.zoom || 1) / 1.25;
      cam.updateMatrixWorld(); cam.updateProjectionMatrix?.();
    }
    W3D.vue.invalider();
    await new Promise(r => setTimeout(r, 200));
    const prise = (x, y, z) => { const [clientX, clientY] = ecran(x, y, z); const p = c.areteSous({ clientX, clientY }); return p && [Math.round(Math.hypot(p[0], p[1])), Math.round(p[2])]; };
    return { assezPres:d < 7.5 && d > 2, pied:prise(0, -20, 28), bague:prise(0, -21, 28) };`);
  verifier("arêtes voisines : le clic prend celle sous le curseur, pas la plus proche de la caméra", r2, { assezPres:true, pied:[20, 28], bague:[21, 28] });

  /* Une arête cachée par la matière ne se prend pas ; survol et clic réels ; le cercle entier reste tracé */
  const r3 = await page(`
    const c = W3D.conception;
    await c.annulerOperation(); await fini();
    await piece([{ type:"boite", L:"60", l:"60", h:"10", centre:true, operation:"nouveau" },
                 { type:"cylindre", diametre:"30", h:"20", axe:"Z", z:"10", operation:"joindre" },
                 { type:"conge", corps:"", rayon:"1", toutes:false, aretes:[] }]);
    await c.editer(c.doc.operations[2]); await fini();
    c.designer("aretes"); await fini();
    W3D.vue.ajusterVue(W3D.vue.modele); W3D.vue.invalider();
    const [clientX, clientY] = ecran(-30, 30, 0);      // le coin opposé à la caméra, derrière la plaque
    const cache = c.areteSous({ clientX, clientY });
    const msg = document.getElementById("msgOperation").textContent;
    return { cache, msg, ecran:ecran(15, 0, 30) };`);
  verifier("arête cachée : pas prise, et pas de vieux message d'erreur pendant la désignation",
    [r3.cache, /aucune/.test(r3.msg), /Désignation en cours/.test(r3.msg)], [null, false, true]);

  await souris("mouseMoved", r3.ecran[0], r3.ecran[1], { buttons:0, button:"none" });
  await pause(200);
  verifier("survol : l'arête que le clic prendrait est surlignée", await page(`return W3D.conception.survol.children.length`), 1);
  await capture("survol");
  await cliquer(r3.ecran[0], r3.ecran[1]);
  await page(`await fini();`);
  const r4 = await page(`
    const c = W3D.conception;
    const nb = c.edition.op.aretes.length, traits = c.marques.children.filter(m => m.geometry.attributes.b);
    return { nb, traits:traits.length, segments:traits[0]?.geometry.attributes.b.count / 6 };`);
  verifier("clic : une arête, tracée en entier", [r4.nb, r4.traits, r4.segments > 20], [1, 1, true]);
  await capture("arete-tracee");
  const r5 = await page(`
    const c = W3D.conception;
    c.designer(null); await fini();
    const m = document.getElementById("msgOperation");
    const r = { msg:m.textContent, trait:c.marques.children.filter(o => o.geometry.attributes.b).length, survol:c.survol.children.length,
      err:c.resultat.etats[c.edition.op.id]?.erreur || null };
    c.validerOperation(); await fini();
    r.fini = c.marques.children.length;
    return r;`);
  verifier("fin de désignation : le congé se fait, l'arête reste tracée", r5, { msg:"Aperçu à jour.", trait:1, survol:0, err:null, fini:0 });

  /* ---------------- 2. mesure ---------------- */
  const r6 = await page(`
    const c = W3D.conception;
    const T = await import("/js/06-topologie.js");
    await piece([{ type:"cylindre", diametre:"40", h:"55.2", axe:"Z", operation:"nouveau" },
                 { type:"boite", L:"20", l:"20", h:"10", centre:true, x:"100", z:"-237", operation:"nouveau" }]);
    const [mc, mp] = W3D.vue.modele.children;
    const face = (m, garder) => {
      const s = c.resultat.maillages.find(x => x.nom === m.name).surfaces.find(garder);
      return T.faceSous(W3D.vue, { object:m, faceIndex:s.premier });
    };
    const cyl = face(mc, g => g.type === "cylindre"), plan = face(mp, g => g.type === "plan" && g.normale[2] > 0.9);
    const r = T.mesurerFaces(cyl, plan);
    const txt = JSON.stringify(r.fiche);
    return { type:[cyl.type, plan.type], axe:cyl.axe.toArray().map(x => Math.abs(+x.toFixed(9))), haut:+cyl.hauteur.toFixed(3), d:+r.min.d.toFixed(4), etiquette:r.etiquette,
      perp:txt.includes("perpendiculaire"), sansAxe:!txt.includes("Axe → plan"), plusCourt:txt.includes("Plus court") };`);
  verifier("cylindre debout et plan : le bout, exact", r6, { type:["cylindre", "plan"], axe:[0, 0, 1], haut:55.2, d:227, etiquette:"227,00 mm", perp:true, sansAxe:true, plusCourt:true });

  /* ---------------- 3 et 4. boîtes de question, hauteur du texte ---------------- */
  const r7 = await page(`
    const c = W3D.conception;
    await piece([{ type:"boite", L:"60", l:"60", h:"10", centre:true, operation:"nouveau" }]);
    const attendre = async (f) => { for(let i = 0; i < 100; i++){ const v = f(); if(v) return v; await new Promise(r => setTimeout(r, 50)); } throw new Error("attente trop longue : " + f); };
    const e = (await import("/js/c2-esquisse.js")).nouvelleEsquisse("op9", "Esq", { base:"XY", decalage:"0" });
    e.elements.push({ id:"o", type:"point", x:0, y:0, constr:true });
    e.contraintes.push({ id:"ko", type:"fixe", a:"o", x:0, y:0 });
    c.doc.operations.push(e);
    c.ouvrirEsquisse(e, JSON.stringify(c.doc)); await fini();
    const ed = c.editeur;
    ed.choisirOutil("texte");
    ed.clic({ x:5, y:5, id:null });
    const d = document.querySelector("dialog.dlg-question");
    const champs = [...d.querySelectorAll("input")];
    const defauts = champs.map(i => i.value);
    /* Une hauteur fausse est refusée, la boîte reste ouverte */
    champs[0].value = "abc"; champs[1].value = "-1";
    d.querySelector("button.on").click();
    const refus = d.open && d.querySelector(".fo-msg").textContent !== "";
    champs[1].value = "7,5";
    d.querySelector("button.on").click();
    const x = await attendre(() => ed.esq.elements.find(q => q.type === "texte"));
    const et = await attendre(() => [...ed.cotes.values()].find(q => q.classList.contains("texte")));
    /* Double-clic : les mêmes champs, pré-remplis */
    et.ondblclick({ stopPropagation(){} });
    const d2 = await attendre(() => document.querySelector("dialog.dlg-question"));
    const lus = [...d2.querySelectorAll("input")].map(i => i.value);
    d2.querySelectorAll("input")[1].value = "12";
    d2.querySelector("button.on").click();
    await attendre(() => x.h === 12);
    /* Annuler ne change rien */
    et.ondblclick({ stopPropagation(){} });
    const d3 = await attendre(() => document.querySelector("dialog.dlg-question"));
    d3.querySelectorAll("input")[0].value = "zzz";
    d3.querySelector("button.tb:not(.on)").click();
    await attendre(() => !document.querySelector("dialog.dlg-question"));
    ed.redessiner(); ed.placerCotes();
    const b = et.getBoundingClientRect(), a = ed.ecran(5, 5), cr = W3D.vue.canvas.getBoundingClientRect();
    const res = { defauts, refus, contenu:x.contenu, h:x.h, lus, h2:x.h, gardeContenu:x.contenu, etiquette:et.textContent, aGauche:b.right <= cr.left + a.x + 1,
      ouvertes:document.querySelectorAll("dialog.dlg-question").length };
    c.terminerEsquisse(); await fini();
    return res;`);
  verifier("texte : boîte du thème, hauteur réglable à la pose et au double-clic, étiquette à côté", r7,
    { defauts:["", "10"], refus:true, contenu:"abc", h:12, lus:["abc", "7.5"], h2:12, gardeContenu:"abc", etiquette:"T", aGauche:true, ouvertes:0 });

  await page(`W3D.conception.enregistrement = W3D.conception.enregistrer(true); await new Promise(r => setTimeout(r, 50));`);
  await capture("boite-question");
  const r8 = await page(`
    const c = W3D.conception;
    const p = c.enregistrement;
    const d = document.querySelector("dialog.dlg-question");
    d.querySelector("input").value = "ma-coque";
    d.querySelector("button.on").click();
    await p;
    const nav = document.getElementById("navNomPiece").textContent, props = document.getElementById("props").textContent.includes("ma-coque");
    await c.enregistrer(true, "par-script");
    const chemin = c.cheminProjet;
    await c.ouvrirProjet(chemin); await fini();
    return { nav, props, chemin, nomRelu:c.doc.nom, ouvertes:document.querySelectorAll("dialog.dlg-question").length };`);
  verifier("enregistrer sous : boîte du thème, nom à jour tout de suite et à la réouverture, nom donné par script", r8,
    { nav:"ma-coque", props:true, chemin:"par-script.json", nomRelu:"par-script", ouvertes:0 });

  /* ---------------- 5 et 6. aperçu, champs ---------------- */
  const r9 = await page(`
    const c = W3D.conception;
    await piece([{ type:"boite", L:"10", l:"10", h:"10", centre:true, operation:"nouveau" }]);
    document.querySelector('[data-op="cylindre"]').click(); await fini();
    const ligne = (re) => [...document.querySelectorAll("#champsOperation .fm-ligne")].find(l => re.test(l.querySelector(".fm-cle").textContent));
    const x = ligne(/Position X/).querySelector("input"), y = ligne(/Position Y/).querySelector("input"), msg = document.getElementById("msgOperation");
    const h = () => [y.getBoundingClientRect().top, x.getBoundingClientRect().height];
    const avant = h();
    const bb = () => +new W3D.THREE.Box3().setFromObject(W3D.vue.modele).max.x.toFixed(2);
    const x0 = bb();
    x.value = "10+25"; x.dispatchEvent(new Event("input", { bubbles:true }));
    const enCours = msg.textContent;
    const sansBouger = JSON.stringify(h()) === JSON.stringify(avant);
    const sortie = x.parentElement.querySelector(".val").textContent;
    await fini();
    const r = { enCours, sansBouger, sortie, bouge:bb() > x0, msg:msg.textContent };
    /* Un script qui n'envoie que « change » : l'aperçu suit aussi */
    x.value = "50"; x.dispatchEvent(new Event("change", { bubbles:true }));
    await fini();
    r.change = bb();
    c.annulerOperation(); await fini();
    return r;`);
  verifier("aperçu : « à jour » seulement quand c'est vrai, et la ligne « = valeur » ne décale rien", r9,
    { enCours:"Aperçu en cours…", sansBouger:true, sortie:"= 35", bouge:true, msg:"Aperçu à jour.", change:60 });

  /* ---------------- 8. barre de mesure ---------------- */
  const r10 = await page(`
    const { ui } = W3D;
    ui.basculerMesure(true);
    const f = document.querySelector(".ctr > .fenetre-mesure:not(#fenetreOperation)");
    const cache = f?.hidden;
    if(f) f.hidden = false;
    const a = f?.getBoundingClientRect(), b = document.getElementById("panneauMesure").getBoundingClientRect();
    const recouvre = !!f && a.bottom > b.top && a.top < b.bottom && a.right > b.left && a.left < b.right;
    if(f) f.hidden = cache;
    const x = document.getElementById("mesureFermer").getBoundingClientRect();
    return { recouvre, x:[x.left + x.width / 2, x.top + x.height / 2], dessus:document.elementFromPoint(x.left + x.width / 2, x.top + x.height / 2)?.id };`);
  verifier("mesure : la fenêtre ne recouvre pas la barre", [r10.recouvre, r10.dessus], [false, "mesureFermer"]);
  await cliquer(r10.x[0], r10.x[1]);
  verifier("mesure : le ✕ ferme la barre", await page(`return [W3D.ui.mesure.actif, document.getElementById("panneauMesure").hidden, document.getElementById("bMesure").classList.contains("on")]`), [false, true, false]);

  /* ---------------- 9. coins du cube ---------------- */
  for(const [nom, depart, coin] of [
    ["de face vers un coin", [0, -1, 0], [1, -1, 1]],
    ["d'un coin à un autre", [1, -1, 1], [-1, -1, 1]],
    ["de dessus vers un coin", [0, 0, 1], [1, 1, 1]],
  ]){
    /* On vise 8 px en dehors du coin : juste à côté du cube, là où la souris tombe souvent. */
    const p = await page(`
      const { nav, THREE, ui } = W3D, cube = ui.cube;
      nav.allerVersDirection(new THREE.Vector3(${depart}), false);
      cube.rendre();
      const v = new THREE.Vector3(${coin.map(k => k / 2)}).project(cube.camera), r = cube.canvas.getBoundingClientRect();
      const lg = Math.hypot(v.x, v.y) || 1;
      const x = r.left + (v.x + 1) / 2 * r.width + 8 * v.x / lg, y = r.top + (1 - v.y) / 2 * r.height - 8 * v.y / lg;
      return [x, y];`);
    await cliquer(p[0], p[1]);
    await pause(100);
    verifier(`cube : ${nom}`, await page(`for(let i = 0; i < 200 && W3D.nav.animation; i++) await new Promise(r => setTimeout(r, 50)); const d = W3D.vue.camera().position.clone().sub(W3D.vue.cible).normalize(); return [d.x, d.y, d.z].map(x => +x.toFixed(2));`),
      coin.map(k => +(k / Math.sqrt(3)).toFixed(2)));
  }

  /* ---------------- 11. maillage ---------------- */
  const r11 = await page(`
    const c = W3D.conception;
    await piece([{ type:"cylindre", diametre:"20", h:"20", axe:"Z", operation:"nouveau" }]);
    const compte = () => c.resultat.maillages[0].index.length / 3;
    const src = c.resultat.maillages[0], s = src.surfaces.find(g => g.type === "cylindre");
    const facettes = (s.dernier - s.premier + 1) / 2;
    const n0 = compte();
    /* La vue change d'échelle : même géométrie, même maillage */
    W3D.vue.rayonModele *= 5;
    await c.reconstruire(); await fini();
    const n1 = compte();
    const stl = await c.envoyer({ type:"exporter", doc:c.docPourNoyau(), format:"stl", corps:c.nomsCorps });
    const buf = await stl.blob.arrayBuffer();
    const triStl = new DataView(buf).getUint32(80, true);
    c.doc.parametres.push({ nom:"inutile", expr:"1" });
    await c.reconstruire(); await fini();
    return { facettes:facettes >= 24, stable:n0 === n1, apresExport:compte() === n0, stlPlusFin:triStl > n0 };`);
  verifier("maillage : 24 facettes au moins par tour, stable, et l'export STL plus fin", r11, { facettes:true, stable:true, apresExport:true, stlPlusFin:true });

  const r12 = await page(`
    const c = W3D.conception;
    c.afficherProprietes(null);
    const s = document.getElementById("selMateriau");
    const avant = c.doc.materiau, autre = [...s.options].map(o => o.value).find(v => v !== avant);
    s.value = autre; s.onchange();
    const bouton = !document.getElementById("bAnnuler").disabled;
    document.getElementById("bAnnuler").click(); await fini();
    return { bouton, retour:c.doc.materiau === avant, select:document.getElementById("selMateriau")?.value === avant };`);
  verifier("matériau : le bouton Annuler le rétablit", r12, { bouton:true, retour:true, select:true });

  const r13 = await page(`
    const c = W3D.conception;
    const e = (await import("/js/c2-esquisse.js")).nouvelleEsquisse("op5", "Esq", { base:"XY", decalage:"10" });
    e.elements.push({ id:"p", type:"point", x:-8, y:-3, constr:true }, { id:"x", type:"texte", p:"p", contenu:"Pi", h:8 });
    await piece([{ type:"boite", L:"60", l:"60", h:"10", centre:true, operation:"nouveau" }]);
    c.doc.operations.push(e);
    c.doc.operations.push({ id:"op6", nom:"Gravure", type:"gravure", esquisse:"op5", corps:"", mode:"creux", profondeur:"1" });
    await c.reconstruire(); await fini();
    await c.editer(c.doc.operations[2]); await fini();
    const t = document.getElementById("champsOperation").textContent;
    const err = c.resultat.etats.op6?.erreur || null;
    c.annulerOperation(); await fini();
    return { aucun:t.includes("Aucun contour"), dit:t.includes("Le texte de l'esquisse"), err };`);
  verifier("gravure d'un texte : le panneau ne dit plus « Aucun contour fermé »", r13, { aucun:false, dit:true, err:null });

  /* ---------------- échec de construction et contrôle à l'ouverture ---------------- */
  const r14 = await page(`
    const c = W3D.conception;
    await piece([{ type:"boite", L:"30", l:"30", h:"30", centre:true, operation:"nouveau" }]);
    const nb = c.onglets.length;
    const vide = c.docVide();
    let refuse = "";
    try{ await c.ouvrirOnglet({ ...vide, operations:[{ id:"op1", type:"boite", L:() => 1 }] }, null, false); }catch(e){ refuse = e.message; }
    const r = { refuse:refuse.includes("transmise au noyau"), memeNombre:c.onglets.length === nb };
    /* Le noyau refuse la pièce : la vue ne garde pas celle de l'onglet d'avant */
    const envoyer = c.envoyer;
    c.envoyer = () => Promise.reject(new Error("panne de banc"));
    await c.ouvrirOnglet({ ...vide, operations:[{ id:"op1", nom:"b", type:"boite", L:"5", l:"5", h:"5", centre:true, x:"0", y:"0", z:"0", operation:"nouveau", corps:"" }] }, null, false);
    await fini();
    const b = document.getElementById("vueErreur");
    r.vue = W3D.vue.modele.children.length;
    r.bandeau = !b.hidden && b.textContent.includes("panne de banc");
    r.stats = document.getElementById("etatStats").textContent.includes("panne de banc");
    c.envoyer = envoyer;
    await c.reconstruire(); await fini();
    r.apres = [W3D.vue.modele.children.length, b.hidden];
    return r;`);
  verifier("échec de construction : refus à l'ouverture, vue vidée, bandeau d'erreur, puis retour à la normale", r14,
    { refuse:true, memeNombre:true, vue:0, bandeau:true, stats:true, apres:[1, true] });

  /* ---------------- une seule face, d'un clic ---------------- */
  const p16 = await page(`
    const c = W3D.conception;
    await piece([{ type:"boite", L:"60", l:"60", h:"10", centre:true, operation:"nouveau" },
                 { type:"cylindre", diametre:"20", h:"30", axe:"Z", z:"10", operation:"joindre" }]);
    W3D.vue.ajusterVue(W3D.vue.modele); W3D.vue.invalider();
    await new Promise(r => setTimeout(r, 300));
    return { dessus:ecran(22, -22, 10), cote:ecran(10 * 0.8, -10 * 0.6, 25), vide:[W3D.vue.canvas.getBoundingClientRect().left + 320, W3D.vue.canvas.getBoundingClientRect().top + 30] };`);
  await cliquer(p16.dessus[0], p16.dessus[1]);
  await capture("face-choisie");
  const etat = `const c = W3D.conception, m = W3D.vue.modele.children[0];
    return { type:c.faceChoisie?.type ?? null, corps:W3D.arbre.selection?.name ?? null, cadre:W3D.arbre.cadre.visible, teinte:!!m.userData.matSauve,
      trace:c.faceVue.children.length, fiche:document.querySelector(".fiche-face h4")?.textContent ?? null };`;
  verifier("clic sur une face plane : la face seule, pas tout le corps", await page(etat),
    { type:"plan", corps:"Corps 1", cadre:false, teinte:false, trace:2, fiche:"Face plane" });
  await cliquer(p16.cote[0], p16.cote[1]);
  verifier("clic sur le cylindre : l'autre face, sa fiche", await page(etat),
    { type:"cylindre", corps:"Corps 1", cadre:false, teinte:false, trace:2, fiche:"Face cylindrique" });
  await cliquer(p16.vide[0], p16.vide[1]);
  verifier("clic dans le vide : plus rien", await page(etat), { type:null, corps:null, cadre:false, teinte:false, trace:0, fiche:null });
  await page(`document.getElementById("bFiltreFace").click();`);
  await cliquer(p16.dessus[0], p16.dessus[1]);
  verifier("filtre « Faces » décoché : le corps entier", await page(etat), { type:null, corps:"Corps 1", cadre:true, teinte:true, trace:0, fiche:null });
  await page(`document.getElementById("bFiltreFace").click(); W3D.arbre.selectionner(null);`);
  /* La face choisie porte l'esquisse, et le panneau d'une esquisse ouverte prend la face cliquée */
  await cliquer(p16.dessus[0], p16.dessus[1]);
  const r17 = await page(`
    const c = W3D.conception;
    c.creer("esquisse");
    const r = { plan:c.edition.op.plan.normale, surFace:document.querySelector("#champsOperation select")?.value, trace:c.faceVue.children.length };
    c.annulerOperation(); await fini();
    W3D.arbre.selectionner(null);
    c.creer("esquisse");
    r.neuve = c.edition.op.plan.base;
    return r;`);
  verifier("esquisse : posée sur la face choisie", r17, { plan:[0, 0, 1], surFace:"face", trace:2, neuve:"XY" });
  await cliquer(p16.cote[0], p16.cote[1]);
  verifier("panneau d'esquisse : une face courbe est refusée", await page(`return [W3D.conception.edition.op.plan.base, document.getElementById("etatSel").textContent.includes("pas plane")]`), ["XY", true]);
  await cliquer(p16.dessus[0], p16.dessus[1]);
  verifier("panneau d'esquisse : la face plane cliquée devient le plan", await page(`const c = W3D.conception, r = [c.edition.op.plan.normale, c.edition.op.plan.origine[2], c.faceVue.children.length]; c.annulerOperation(); await fini(); return [...r, c.faceVue.children.length];`), [[0, 0, 1], 10, 2, 0]);

  /* ---------------- noms de l'historique ---------------- */
  verifier("historique : Fonction-Nom", await page(`
    const { nomHistorique:n } = await import("/js/c3-operations.js");
    const c = W3D.conception;
    await piece([{ type:"boite", L:"10", l:"10", h:"10", centre:true, operation:"nouveau", nom:"Cabine" }]);
    c.doc.operations[0].nom = "Cabine"; c.majHistorique();
    const nav = document.querySelector("#navOperations .lbl").textContent;
    const puce = [...document.querySelectorAll("#frise [title]")].find(b => b.title.includes("Cabine"))?.title.split("\\n")[0];
    const titre = () => document.getElementById("titreOperation").textContent;
    await c.editer(c.doc.operations[0]); await fini();
    const panneau = titre(), champ = document.querySelector("#champsOperation input").value;
    c.annulerOperation(); await fini();
    return { nav, puce, panneau:panneau.includes("Boîte-Cabine"), champ, defaut:n({ type:"boite", nom:"Boîte 1" }), saisi:n({ type:"boite", nom:"Boite-Cabine" }), esq:n({ type:"esquisse", nom:"Hublot" }) };`),
    { nav:"Boîte-Cabine", puce:"Boîte-Cabine", panneau:true, champ:"Cabine", defaut:"Boîte 1", saisi:"Boite-Cabine", esq:"Esquisse-Hublot" });

  /* ================ Contre-vérification de la liste, par les vrais gestes ================ */

  /* Retour 1 : ce que le noyau arrondit est bien l'arête cliquée. Le bord de la bague est saillant (le congé enlève
     de la matière), son pied est rentrant (le congé en ajoute) : le signe dit laquelle il a prise. */
  for(const [nom, point, signe] of [["bord de la bague (saillant)", "0, -21, 28", -1], ["pied de la bague (rentrant)", "0, -20, 28", 1]]){
    const p = await page(`
      const c = W3D.conception;
      await piece([{ type:"cylindre", diametre:"40", h:"30", axe:"Z", operation:"nouveau" },
                   { type:"cylindre", diametre:"42", h:"10", axe:"Z", z:"18", operation:"joindre" },
                   { type:"conge", corps:"", rayon:"0.4", toutes:false, aretes:[] }]);
      window.volume0 = c.resultat.maillages[0].proprietes.volume;
      await c.editer(c.doc.operations[2]); await fini();
      c.designer("aretes"); await fini();
      W3D.nav.allerVersDirection(new W3D.THREE.Vector3(0, -1, 1), false);
      const cam = W3D.vue.camera();
      for(let k = 0; k < 40; k++){
        const a = ecran(0, -20, 28), b = ecran(0, -21, 28);
        if(Math.hypot(a[0] - b[0], a[1] - b[1]) < 7) break;
        cam.position.sub(W3D.vue.cible).multiplyScalar(1.25).add(W3D.vue.cible);
        W3D.vue.ortho.zoom = (W3D.vue.ortho.zoom || 1) / 1.25;
        cam.updateMatrixWorld(); cam.updateProjectionMatrix?.();
      }
      W3D.vue.invalider();
      await new Promise(r => setTimeout(r, 200));
      return ecran(${point});`);
    await cliquer(p[0], p[1]);
    const r = await page(`
      const c = W3D.conception;
      c.designer(null); await fini();
      const v = c.resultat.maillages[0].proprietes.volume;
      const res = { nb:c.edition.op.aretes.length, err:c.resultat.etats[c.edition.op.id]?.erreur || null, signe:Math.sign(v - volume0) };
      c.validerOperation(); await fini();
      return res;`);
    verifier(`le noyau arrondit l'arête cliquée : ${nom}`, r, { nb:1, err:null, signe });
  }

  /* Retour 1 : plusieurs arêtes, et un second clic en retire une */
  const p1b = await page(`
    const c = W3D.conception;
    await piece([{ type:"boite", L:"60", l:"60", h:"10", centre:true, operation:"nouveau" }, { type:"conge", corps:"", rayon:"1", toutes:false, aretes:[] }]);
    await c.editer(c.doc.operations[1]); await fini();
    c.designer("aretes"); await fini();
    W3D.vue.ajusterVue(W3D.vue.modele); W3D.vue.invalider();
    await new Promise(r => setTimeout(r, 200));
    return [ecran(30, 0, 10), ecran(0, -30, 10)];`);
  await cliquer(...p1b[0]); await cliquer(...p1b[1]);
  await page(`await fini();`);
  const deux = await page(`const c = W3D.conception; return [c.edition.op.aretes.length, c.marques.children.filter(m => m.geometry.attributes.b).length];`);
  await cliquer(...p1b[1]);
  await page(`await fini();`);
  verifier("deux arêtes tracées, le second clic en retire une", [deux, await page(`const c = W3D.conception; const r = [c.edition.op.aretes.length, c.marques.children.filter(m => m.geometry.attributes.b).length]; c.designer(null); c.annulerOperation(); await fini(); return r;`)], [[2, 2], [1, 1]]);

  /* Retour 1 : désigner une face (coque) montre son contour, pas un point seul */
  const p1c = await page(`
    const c = W3D.conception;
    await piece([{ type:"boite", L:"60", l:"60", h:"30", centre:true, operation:"nouveau" }, { type:"coque", corps:"", epaisseur:"2", faces:[], exterieur:false }]);
    await c.editer(c.doc.operations[1]); await fini();
    c.designer("faces"); await fini();
    W3D.vue.ajusterVue(W3D.vue.modele); W3D.vue.invalider();
    await new Promise(r => setTimeout(r, 200));
    return ecran(0, 0, 30);`);
  await cliquer(p1c[0], p1c[1]);
  verifier("coque : la face désignée est tracée", await page(`const c = W3D.conception; await fini(); const r = [c.edition.op.faces.length, c.marques.children.filter(m => m.geometry.attributes.b).length]; c.designer(null); await fini(); r.push(c.resultat.etats[c.edition.op.id]?.erreur || null); c.validerOperation(); await fini(); return r;`), [1, 1, null]);

  /* Retour 2 : la mesure avec le vrai outil, en mode Auto comme le testeur, et sa fenêtre */
  const p2 = await page(`
    const c = W3D.conception;
    await piece([{ type:"cylindre", diametre:"40", h:"55.2", axe:"Z", operation:"nouveau" },
                 { type:"boite", L:"60", l:"60", h:"10", centre:true, x:"100", z:"-237", operation:"nouveau" }]);
    W3D.vue.ajusterVue(W3D.vue.modele); W3D.vue.invalider();
    W3D.ui.basculerMesure(true);
    await new Promise(r => setTimeout(r, 300));
    return { mode:W3D.mesure.mode, cyl:ecran(14.14, -14.14, 27.6), plan:ecran(100, 0, -227) };`);
  await cliquer(p2.cyl[0], p2.cyl[1]);
  await pause(300);
  await cliquer(p2.plan[0], p2.plan[1]);
  await pause(500);
  const r2m = await page(`
    const f = [...document.querySelectorAll(".ctr > .fenetre-mesure:not(#fenetreOperation)")].find(x => !x.hidden), b = document.getElementById("panneauMesure").getBoundingClientRect();
    const a = f?.getBoundingClientRect(), txt = f?.textContent || "";
    const et = [...document.querySelectorAll(".cote-cad")].filter(x => x.style.display !== "none").map(x => x.getBoundingClientRect());
    const etiquettes = et.some((u, i) => et.some((w, j) => j > i && u.right > w.left && u.left < w.right && u.bottom > w.top && u.top < w.bottom));
    return { mode:W3D.mesure.mode, bout:/Bout → plan\s*227,00/.test(txt), perp:txt.includes("perpendiculaire"), sansAxe:!txt.includes("Axe → plan"),
      recouvre:!!a && a.bottom > b.top && a.top < b.bottom && a.right > b.left && a.left < b.right, nbEtiquettes:et.length >= 2, etiquettes, txt:txt.slice(0, 120) };`);
  await capture("mesure");
  verifier("mesure réelle, mode Auto : 227 mm, perpendiculaire, fenêtre à côté de la barre", { ...r2m, txt:undefined }, { mode:"auto", bout:true, perp:true, sansAxe:true, recouvre:false, nbEtiquettes:true, etiquettes:false });
  await page(`W3D.ui.basculerMesure(false);`);

  /* Retour 2 : cylindre couché : la distance de surface et l'angle exacts ; l'axe → plan y garde son sens */
  const r2b = await page(`
    const c = W3D.conception;
    const T = await import("/js/06-topologie.js");
    await piece([{ type:"cylindre", diametre:"20", h:"40", axe:"X", z:"50", operation:"nouveau" },
                 { type:"boite", L:"100", l:"100", h:"5", centre:true, x:"20", z:"-5", operation:"nouveau" }]);
    const [mc, mp] = W3D.vue.modele.children;
    const face = (m, garder) => T.faceSous(W3D.vue, { object:m, faceIndex:c.resultat.maillages.find(x => x.nom === m.name).surfaces.find(garder).premier });
    const r = T.mesurerFaces(face(mc, g => g.type === "cylindre"), face(mp, g => g.type === "plan" && g.normale[2] > 0.9));
    const txt = JSON.stringify(r.fiche);
    return { d:+r.min.d.toFixed(3), parallele:txt.includes("parallèle au plan"), axe:txt.includes("Axe → plan") };`);
  verifier("cylindre couché au-dessus d'un plan : 40 mm exactement, axe parallèle", r2b, { d:40, parallele:true, axe:true });

  /* Cylindres et arêtes : la distance sur la vraie forme, et le maillage là où la forme réelle s'arrête */
  const rE = await page(`
    const c = W3D.conception, T = await import("/js/06-topologie.js"), V = W3D.THREE.Vector3;
    const corps = (i) => W3D.vue.modele.children[i];
    const face = (i, garder) => T.faceSous(W3D.vue, { object:corps(i), faceIndex:c.resultat.maillages[i].surfaces.find(garder).premier });
    const cyl = (i) => face(i, g => g.type === "cylindre");
    const haut = (i) => face(i, g => g.type === "plan" && g.normale[2] > 0.9);
    const arete = (i, x, y, z) => T.areteSous(W3D.vue, { object:corps(i), point:new V(x, y, z) }, 16);
    const d = (A, B) => +T.mesurerEntites(A, B).min.d.toFixed(3);
    const cy = (diametre, h, x, y, z, axe = "Z") => ({ type:"cylindre", diametre:String(diametre), h:String(h), axe, x:String(x), y:String(y), z:String(z), operation:"nouveau" });
    const r = {};
    /* Parallèles, côte à côte */
    await piece([cy(20, 20, 0, 0, 0), cy(10, 20, 40, 0, 0)]);
    r.paralleles = d(cyl(0), cyl(1));
    /* Axes croisés, l'un au-dessus de l'autre */
    await piece([cy(20, 40, 0, 0, -10), cy(10, 60, -30, 40, 10, "X")]);
    r.croises = d(cyl(0), cyl(1));
    /* Dedans : une goupille décentrée dans un alésage */
    await piece([{ type:"boite", L:"60", l:"60", h:"20", centre:true, operation:"nouveau" },
                 { type:"cylindre", diametre:"30", h:"20", axe:"Z", operation:"enlever" }, cy(10, 20, 3, 0, 0)]);
    r.dedans = d(cyl(0), cyl(1));
    /* Cercles et arêtes */
    await piece([cy(20, 20, 0, 0, 0), cy(10, 20, 40, 0, 0), cy(10, 30, 0, 40, 0),
                 { type:"boite", L:"10", l:"40", h:"20", centre:true, x:"35", y:"-40", operation:"nouveau" }]);
    const rim = arete(0, -7.071, 7.071, 20);
    r.nature = rim?.type;
    r.cercleCercle = d(rim, arete(1, 40, 5, 20));
    r.cercleCercleHaut = d(rim, arete(2, 0, 45, 30));
    r.cercleCylindre = d(rim, cyl(1));
    r.cercleDroite = d(rim, arete(3, 30, -40, 20));         // jusqu'au bout de l'arête, en (30, -20)
    /* Le bord d'un cylindre au-dessus d'une plaque : le plan s'étend bien dessous */
    await piece([cy(20, 20, 0, 0, 10), { type:"boite", L:"60", l:"60", h:"5", centre:true, operation:"nouveau" }]);
    r.cerclePlan = d(arete(0, -7.071, 7.071, 30), haut(1));
    /* Le plan ne s'étend pas sous le cylindre : la vraie distance reste celle du bord du plan */
    await piece([cy(20, 40, 0, 0, 50, "X"), { type:"boite", L:"10", l:"10", h:"5", centre:true, x:"100", z:"-5", operation:"nouveau" }]);
    const k = T.mesurerEntites(cyl(0), haut(1));
    r.horsPlan = k.min.d > 55;
    return r;`);
  verifier("cylindres et arêtes : la vraie forme, et le bord du plan quand il s'arrête avant", rE, {
    paralleles:25, croises:25, dedans:7, nature:"cercle", cercleCercle:25, cercleCercleHaut:+Math.hypot(25, 10).toFixed(3),
    cercleCylindre:25, cercleDroite:+(Math.hypot(30, 20) - 10).toFixed(3), cerclePlan:25, horsPlan:true });

  /* Retours 3 et 4 : les vrais gestes dans les boîtes : Entrée, Échap, double-clic, touches qui ne fuient pas */
  await page(`
    const c = W3D.conception;
    await piece([{ type:"boite", L:"60", l:"60", h:"10", centre:true, operation:"nouveau" }]);
    const e = (await import("/js/c2-esquisse.js")).nouvelleEsquisse("op9", "Esq", { base:"XY", decalage:"0" });
    e.elements.push({ id:"o", type:"point", x:0, y:0, constr:true }, { id:"p", type:"point", x:5, y:5, constr:true }, { id:"x", type:"texte", p:"p", contenu:"abc", h:7 });
    e.contraintes.push({ id:"ko", type:"fixe", a:"o", x:0, y:0 });
    c.doc.operations.push(e);
    c.ouvrirEsquisse(e, JSON.stringify(c.doc)); await fini();
    for(let i = 0; i < 200 && W3D.nav.animation; i++) await new Promise(r => setTimeout(r, 50));
    c.editeur.redessiner(); c.editeur.placerCotes();
    await new Promise(r => setTimeout(r, 300));`);
  const et = await page(`const r = [...W3D.conception.editeur.cotes.values()].find(q => q.classList.contains("texte")).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2];`);
  const touche = async (key, code, texte) => {
    await cdp("Input.dispatchKeyEvent", { type:texte ? "keyDown" : "rawKeyDown", key, code, windowsVirtualKeyCode:code === "Enter" ? 13 : code === "Escape" ? 27 : 76, text:texte });
    await cdp("Input.dispatchKeyEvent", { type:"keyUp", key, code });
    await pause(120);
  };
  await souris("mouseMoved", et[0], et[1], { buttons:0, button:"none" });
  for(const clickCount of [1, 2]){ await souris("mousePressed", et[0], et[1], { clickCount }); await souris("mouseReleased", et[0], et[1], { clickCount }); }
  await pause(200);
  const vuBoite = await page(`const d = document.querySelector("dialog.dlg-question"); return d ? [...d.querySelectorAll("input")].map(i => i.value) : null;`);
  if(!vuBoite) throw new Error("le double-clic réel sur l'étiquette du texte n'ouvre pas la boîte");
  await touche("l", "KeyL", "l");
  const fuite = await page(`return W3D.conception.editeur.outil;`);
  await page(`document.querySelector("dialog.dlg-question input").value = "abc";`);
  await touche("Escape", "Escape");
  const fermee = `for(let i = 0; i < 100 && document.querySelector("dialog.dlg-question"); i++) await new Promise(r => setTimeout(r, 50));`;
  const apresEchap = await page(`${fermee} const x = W3D.conception.editeur.esq.elements.find(q => q.type === "texte"); return [!!document.querySelector("dialog.dlg-question"), x.h, W3D.conception.editeur.ouvert];`);
  await souris("mousePressed", et[0], et[1], { clickCount:1 }); await souris("mouseReleased", et[0], et[1], { clickCount:1 });
  await souris("mousePressed", et[0], et[1], { clickCount:2 }); await souris("mouseReleased", et[0], et[1], { clickCount:2 });
  await pause(200);
  await page(`document.querySelectorAll("dialog.dlg-question input")[1].value = "9"; document.querySelectorAll("dialog.dlg-question input")[1].focus();`);
  await touche("Enter", "Enter", "\r");
  verifier("texte : double-clic réel, la touche L ne fuit pas, Échap annule sans fermer l'esquisse, Entrée valide",
    [vuBoite, fuite, apresEchap, await page(`${fermee} const c = W3D.conception, x = c.editeur.esq.elements.find(q => q.type === "texte"), r = [!!document.querySelector("dialog.dlg-question"), x.h]; c.terminerEsquisse(); await fini(); return r;`)],
    [["abc", "7"], null, [false, 7, true], [false, 9]]);

  /* Retour 5 : le cylindre déjà posé, repris alors qu'une opération le suit : X seul change la pièce, à l'écran aussi */
  const r5b = await page(`
    const c = W3D.conception;
    await piece([{ type:"cylindre", diametre:"20", h:"20", axe:"Z", operation:"nouveau" },
                 { type:"boite", L:"10", l:"10", h:"10", centre:true, x:"-40", operation:"nouveau" }]);
    await c.editer(c.doc.operations[0]); await fini();
    const x = [...document.querySelectorAll("#champsOperation .fm-ligne")].find(l => /Position X/.test(l.querySelector(".fm-cle").textContent)).querySelector("input");
    const bb = () => { const m = W3D.vue.modele.children.find(o => o.name === c.resultat.maillages[0].nom); return +new W3D.THREE.Box3().setFromObject(m).max.x.toFixed(2); };
    const image = () => { W3D.vue.rendre(); return W3D.vue.canvas.toDataURL(); };
    const av = [bb(), image()];
    x.focus(); x.value = "33"; x.dispatchEvent(new Event("input", { bubbles:true }));
    await fini();
    const r = { bouge:[av[0], bb()], image:image() !== av[1], msg:document.getElementById("msgOperation").textContent };
    c.validerOperation(); await fini();
    r.apresOk = bb();
    return r;`);
  verifier("aperçu : X seul déplace le cylindre repris, l'image change, et OK donne le même résultat", r5b, { bouge:[10, 43], image:true, msg:"Aperçu à jour.", apresOk:43 });

  /* Retour 11 : « Fichier » après avoir fermé Paramètres : la boîte ne se rouvre pas */
  const pf = await page(`
    document.getElementById("bParametres").click();
    const d = document.getElementById("dlgParametres"), ouvert = d.open;
    d.querySelector('button[value="ok"]').click();
    await new Promise(r => setTimeout(r, 100));
    const b = document.getElementById("bMenuFichier").getBoundingClientRect();
    return { ouvert, ferme:!d.open, x:b.left + b.width / 2, y:b.top + b.height / 2 };`);
  await cliquer(pf.x, pf.y);
  await pause(200);
  verifier("Paramètres fermé, clic sur Fichier : le menu s'ouvre, Paramètres non", [pf.ouvert, pf.ferme, await page(`const r = [document.getElementById("dlgParametres").open, document.getElementById("menuFichier").hidden]; document.getElementById("menuFichier").hidden = true; return r;`)], [true, true, [false, false]]);

  /* Second retour 1 : un vrai document non transmissible en cours de route : la vraie erreur, et le noyau reste disponible */
  const rv = await page(`
    const c = W3D.conception;
    await piece([{ type:"boite", L:"30", l:"30", h:"30", centre:true, operation:"nouveau" }]);
    const n0 = c.attentes.size;
    c.doc.operations[0].piege = () => 1;
    await c.reconstruire(); await fini();
    const b = document.getElementById("vueErreur");
    const r = { bandeau:!b.hidden, attentes:c.attentes.size === n0 };
    delete c.doc.operations[0].piege;
    await c.reconstruire(); await fini();
    r.apres = [W3D.vue.modele.children.length, b.hidden];
    return r;`);
  verifier("échec réel (fonction dans la pièce) : bandeau, rien en attente, puis retour à la normale", rv, { bandeau:true, attentes:true, apres:[1, true] });

  /* Second retour 3 : le schéma répond pour toutes les opérations, et dit ce qui manquait au testeur */
  verifier("schéma : toutes les opérations, dont sens, centre et operation", await page(`
    const c = W3D.conception, { TYPES } = await import("/js/c3-operations.js");
    const manquent = [];
    for(const t of Object.keys(TYPES)){ try{ const s = c.schema(t); if(!s.nom || !s.exemple) manquent.push(t); }catch(e){ manquent.push(t + " : " + e.message); } }
    const a = (t) => c.schema(t).champs.map(x => x.cle);
    return { manquent, sens:a("extrusion").includes("sens"), centre:a("boite").includes("centre"), operation:a("boite").includes("operation") };`),
    { manquent:[], sens:true, centre:true, operation:true });

  /* Second retour 6 : les trous ne sont plus des polygones grossiers : écart à la vraie surface, à l'écran et en STL */
  const r6b = await page(`
    const c = W3D.conception;
    await piece([{ type:"cylindre", diametre:"10", h:"5", axe:"Z", operation:"nouveau" }]);
    const src = c.resultat.maillages[0], s = src.surfaces.find(g => g.type === "cylindre");
    const facettes = (s.dernier - s.premier + 1) / 2;
    const stl = await c.envoyer({ type:"exporter", doc:c.docPourNoyau(), format:"stl", corps:c.nomsCorps });
    const buf = await stl.blob.arrayBuffer(), vue = new DataView(buf), nb = vue.getUint32(80, true);
    /* Le milieu des cordes horizontales de la paroi : plus il rentre sous le rayon de 5, plus le polygone se voit. */
    let mini = Infinity;
    for(let i = 0; i < nb; i++){
      const o = 84 + 50 * i;
      if(Math.abs(vue.getFloat32(o + 8, true)) > 0.1) continue;      // la normale monte : ce n'est pas la paroi
      for(let k = 0; k < 3; k++){
        const p = (j) => [0, 4, 8].map(d => vue.getFloat32(o + 12 + 12 * ((k + j) % 3) + d, true)), A = p(0), B = p(1);
        if(Math.abs(A[2] - B[2]) < 1e-3) mini = Math.min(mini, Math.hypot((A[0] + B[0]) / 2, (A[1] + B[1]) / 2));
      }
    }
    return { ecran:facettes >= 24, flecheStl:mini < 5 && 5 - mini <= 0.011 };`);
  verifier("petit cylindre ⌀10 : 24 facettes au moins à l'écran, écart STL dans les 0,01 mm demandés", r6b, { ecran:true, flecheStl:true });

  /* ---------------- point fixé par une expression, création par script ---------------- */
  const rS = await page(`
    const c = W3D.conception;
    await piece([]);
    c.doc.parametres.push({ nom:"X0", expr:"12" });
    const carre = [[0, 0], [20, 0], [20, 10], [0, 10]].map((a, i, t) => ({ type:"ligne", a, b:t[(i + 1) % 4] }));
    const e = await c.ajouterEsquisse({ nom:"Profil", primitives:carre, contraintes:(el) => [
      { type:"fixe", a:el[0].p1, x:"X0", y:0 }, { type:"horizontal", a:el[0].id }, { type:"vertical", a:el[1].id },
      { type:"horizontal", a:el[2].id }, { type:"vertical", a:el[3].id }, { type:"longueur", a:el[0].id, expr:"20" }, { type:"longueur", a:el[1].id, expr:"10" }] });
    const x = await c.ajouterOperation("extrusion", { esquisse:e.op.id, distance:"5", nom:"Bloc" });
    const mini = () => +new W3D.THREE.Box3().setFromObject(W3D.vue.modele).min.x.toFixed(3);
    const r = { esquisse:[e.ok, e.conflits, e.op.nom], extrusion:x.erreur, x0:mini() };
    c.doc.parametres[0].expr = "30";
    await c.reconstruire(); await fini();
    r.suit = mini();
    c.renommerParametre("X0", "Origine");
    const k = c.doc.operations[0].contraintes.find(q => q.type === "fixe" && q.a !== "o");      // pas celui de l'origine
    r.renomme = [k.x, k.y];
    await c.reconstruire(); await fini();
    r.toujours = mini();
    /* Une étape d'annulation par création */
    const n = c.doc.operations.length;
    c.annuler(); await fini();
    r.annule = [n, c.doc.operations.length];
    c.refaire(); await fini();
    /* Le panneau d'une opération créée ainsi */
    await c.editer(c.doc.operations[1]); await fini();
    const champs = [...document.querySelectorAll("#champsOperation input[type=text]")].map(i => i.value);
    r.panneau = champs.includes("Bloc") && champs.includes("5");
    const d = [...document.querySelectorAll("#champsOperation .fm-ligne")].find(l => /Distance/.test(l.querySelector(".fm-cle").textContent)).querySelector("input");
    d.value = "9"; d.dispatchEvent(new Event("input", { bubbles:true }));
    await fini();
    r.apercu = +new W3D.THREE.Box3().setFromObject(W3D.vue.modele).max.z.toFixed(3);
    c.validerOperation(); await fini();
    /* Les refus */
    const refus = async (f) => { try{ await f(); return "accepté"; }catch(e){ return e.message.split(" :")[0]; } };
    r.refus = [await refus(() => c.ajouterOperation("nimporte")), await refus(() => c.ajouterOperation("boite", { largeur:"3" })),
               await refus(() => c.ajouterEsquisse({ contraintes:[{ type:"collee" }] }))];
    /* Un réglage de l'interface qui remplit d'autres champs : la norme d'un perçage */
    const p = await c.ajouterOperation("percage", { esquisse:e.op.id, norme:"M8" });      // un M6 se perce justement à 5, la valeur par défaut
    r.norme = String(p.op.diametre) !== "5";
    c.annuler(); await fini();
    return r;`);
  verifier("point fixé par une expression et création par script", rS, {
    esquisse:[true, [], "Profil"], extrusion:null, x0:12, suit:30, renomme:["Origine", 0], toujours:30, annule:[2, 1], panneau:true, apercu:9,
    refus:["opération inconnue", "champs inconnus pour boite", "contrainte inconnue"], norme:true });

  /* Le point fixé se règle aussi à la main, depuis la liste des contraintes */
  const rF = await page(`
    const c = W3D.conception, esq = c.doc.operations[0];
    c.ouvrirEsquisse(esq, JSON.stringify(c.doc)); await fini();
    const ed = c.editeur, k = esq.contraintes.find(q => q.type === "fixe" && q.a !== "o");
    const li = [...document.querySelectorAll(".ctr-liste li span")].find(s => /^Fixe.*Origine/.test(s.textContent));
    const texte = li.textContent;
    li.dispatchEvent(new MouseEvent("dblclick", { bubbles:true }));
    const attendre = async (f) => { for(let i = 0; i < 100; i++){ const v = f(); if(v) return v; await new Promise(r => setTimeout(r, 50)); } throw new Error("attente trop longue"); };
    const d = await attendre(() => document.querySelector("dialog.dlg-question"));
    const i = d.querySelectorAll("input");
    i[0].value = "pas un nom"; d.querySelector("button.on").click();
    const refuse = d.open;
    i[0].value = "Origine + 1"; i[1].value = "2,5"; d.querySelector("button.on").click();
    await attendre(() => !document.querySelector("dialog.dlg-question"));
    const pt = ed.esq.elements.find(q => q.id === k.a);
    const r = { texte:/Origine/.test(texte), refuse, k:[k.x, k.y], x:+pt.x.toFixed(4) };
    c.terminerEsquisse(); await fini();
    return r;`);
  verifier("point fixé : réglé à la main, en expression", rF, { texte:true, refuse:true, k:["Origine + 1", "2,5"], x:31 });

  /* Toutes les opérations : créées par script, elles ont les champs de l'interface, et leur panneau s'ouvre */
  verifier("toutes les opérations : mêmes champs que le ruban, panneau qui s'ouvre", await page(`
    const c = W3D.conception, { TYPES } = await import("/js/c3-operations.js");
    await piece([{ type:"boite", L:"30", l:"30", h:"30", centre:true, operation:"nouveau" }]);
    const ecarts = [];
    for(const t of Object.keys(TYPES)){
      if(t === "esquisse") continue;
      try{
        c.creer(t);
        const ruban = Object.keys(c.edition.op).sort().join();
        c.annulerOperation(); await fini();
        const { op } = await c.ajouterOperation(t);
        const script = Object.keys(op).filter(k => k !== "corpsNom" && k !== "refs" && k !== "plan" || k in JSON.parse(JSON.stringify(op))).sort().join();
        await c.editer(op);
        if(!c.edition || !document.querySelector("#titreOperation").textContent) ecarts.push(t + " : panneau");
        c.annulerOperation(); await fini();
        c.annuler(); await fini();
        for(const k of ruban.split(",")) if(!script.split(",").includes(k)) ecarts.push(t + " : " + k);
      }catch(e){ ecarts.push(t + " : " + e.message); }
    }
    return ecarts;`), []);

  /* Affichage : une grande pièce reste ronde */
  verifier("grand cylindre ⌀300 : 50 facettes au moins par tour à l'écran", await page(`
    const c = W3D.conception;
    await piece([{ type:"cylindre", diametre:"300", h:"300", axe:"Z", operation:"nouveau" }]);
    const s = c.resultat.maillages[0].surfaces.find(g => g.type === "cylindre");
    return (s.dernier - s.premier + 1) / 2 >= 50;`), true);

  /* ---------------- écriture par script ---------------- */
  const r15 = await page(`
    const c = W3D.conception;
    const cpt = c.doc.compteur, sch = c.schema("cylindre");
    c.schema("conge");
    const stableCompteur = c.doc.compteur === cpt;
    await piece([{ type:"boite", L:"30", l:"30", h:"30", centre:true, operation:"nouveau" }]);
    const aretes = c.aretes(), faces = c.faces();
    const vol0 = c.resultat.maillages[0].proprietes.volume;
    const dessus = aretes.find(a => Math.abs(a.point[2] - 30) < 1e-3);
    c.doc.operations.push({ id:"op2", nom:"c", type:"conge", corps:"", rayon:"2", toutes:false, aretes:[dessus.point] });
    await c.reconstruire(); await fini();
    const vol1 = c.resultat.maillages[0].proprietes.volume;
    c.doc.operations.pop();
    const haut = faces.find(f => f.type === "plan" && f.normale[2] > 0.9);
    c.doc.operations.push({ id:"op3", nom:"k", type:"coque", corps:"", epaisseur:"2", faces:[haut.point], exterieur:false });
    await c.reconstruire(); await fini();
    const vol2 = c.resultat.maillages[0].proprietes.volume, err = c.resultat.etats.op3?.erreur || null;
    return { champs:sch.champs.map(x => x.cle).includes("x"), axe:sch.exemple.axe, stableCompteur, nbAretes:aretes.length, nbFaces:faces.length,
      longueur:Math.round(dessus.longueur), congeRetire:vol1 < vol0, coqueCreuse:vol2 < vol0 / 2, err };`);
  verifier("script : schéma des opérations, arêtes et faces à désigner", r15,
    { champs:true, axe:"Z", stableCompteur:true, nbAretes:12, nbFaces:6, longueur:30, congeRetire:true, coqueCreuse:true, err:null });

  /* Le canal de pilotage, par la route même qu'appelle le MCP : lire, capturer, un geste qui attend sa carte. */
  const commande = async (nom, args, ecriture = false, attente) => (await fetch(`http://127.0.0.1:${portWeb}/api/pilote/commande`, { method:"POST",
    headers:{ "X-Web3D":"1", "Content-Type":"application/json" }, body:JSON.stringify({ page:["conception"], nom, args, ecriture, attente }) })).json();
  const lue = await commande("interface_lire", { filtre:"Extrusion" });
  verifier("pilote : la page lit son interface", [lue.etat, JSON.stringify(lue.resultat).includes("Extrusion")], ["finie", true]);
  const vue = await commande("capture", {});
  verifier("pilote : la page capture sa vue", [vue.etat, String(vue.resultat?.image).startsWith("data:image/png")], ["finie", true]);
  const geste = await commande("interface", { geste:"cliquer", cible:"#bAide" }, true, 1);
  const ouverte = () => page(`return document.getElementById("dlgAide").open;`);
  verifier("pilote : un geste attend le clic sur sa carte", [geste.etat !== "appliquee", await ouverte()], [true, false]);
  await page(`[...document.querySelectorAll("button")].find(b => b.textContent === "Appliquer").click();
    for(let i = 0; i < 50 && !document.getElementById("dlgAide").open; i++) await new Promise(r => setTimeout(r, 100));`);
  verifier("pilote : la carte appliquée fait le geste", await ouverte(), true);
  await page(`document.getElementById("dlgAide").close();`);
  const controle = await commande("web3d_regles", {});
  verifier("pilote : le contrôle des règles répond", [controle.etat, controle.resultat?.controles?.map(x => x.regle)], ["finie", [5, 6, 15]]);
  const fenetre = await page(`document.getElementById("bControleRegles").click(); const d = document.getElementById("dlgControle");
    const r = [d.open, document.getElementById("listeControle").textContent.includes("Règle 5")]; d.close(); return r;`);
  verifier("le bouton Règles montre le même contrôle", fenetre, [true, true]);
  const regles = await fetch(`http://127.0.0.1:${portWeb}/` + await page(`return document.getElementById("lienRegles").getAttribute("href");`));
  verifier("le lien Règles de la page mène au texte", [regles.status, (await regles.text()).includes("RÈGLES DE CONCEPTION")], [200, true]);

  await page(`W3D.conception.sauverOnglet(); for(const o of W3D.conception.onglets) o.modifie = false; W3D.conception.modifie = false;`);
  verifier("aucune erreur dans la page", erreurs.filter(e => !/panne de banc|could not be cloned/.test(String(e))), []);
}catch(e){
  ko++;
  console.log(`ÉCHEC du banc à l'étape « ${etape()} » : ${e.message}`);
  if(erreurs.length) console.log("Erreurs de la page :\n  " + erreurs.slice(0, 8).join("\n  "));
}finally{
  await fermer();
}
console.log(ko ? `banc-conception-retours : ${ko} échec(s), ${ok} OK` : `banc-conception-retours : OK (${ok} vérifications)`);
process.exit(ko ? 1 : 0);
