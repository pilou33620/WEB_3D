/* Banc de la page de conception, dans un Chromium sans écran piloté par le protocole DevTools.
   Le serveur est lancé sur un port libre avec un dossier de projets temporaire ; le scénario passe
   par window.W3D.conception (boîte, esquisse cotée, enlèvement, congé, annuler, enregistrer,
   remplacer, export STEP), puis la visionneuse est ouverte pour vérifier qu'elle n'a pas bougé.
   node --experimental-websocket test/banc-conception-page.mjs — n'affiche que les échecs et un bilan.
   Long sur un Raspberry Pi (noyau WebAssembly + rendu logiciel) : à lancer en arrière-plan. */
import { spawn } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import net from "node:net";

const RACINE = fileURLToPath(new URL("..", import.meta.url));
const CHROMIUM = process.env.CHROMIUM || "/usr/bin/chromium";
let ok = 0, ko = 0;
const verifier = (nom, obtenu, attendu) => {
  if(JSON.stringify(obtenu) === JSON.stringify(attendu)) ok++;
  else { ko++; console.log(`ÉCHEC ${nom} : obtenu ${JSON.stringify(obtenu)}, attendu ${JSON.stringify(attendu)}`); }
};
const portLibre = () => new Promise(r => { const s = net.createServer().listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => r(p)); }); });
const pause = (ms) => new Promise(r => setTimeout(r, ms));
async function attendreHttp(url, essais = 100){
  for(let i = 0; i < essais; i++){ try{ const r = await fetch(url); if(r.ok) return r; }catch(_){} await pause(200); }
  throw new Error("pas de réponse de " + url);
}

const projets = mkdtempSync(join(tmpdir(), "banc-conception-"));
const profil = mkdtempSync(join(tmpdir(), "banc-chromium-"));
const portWeb = await portLibre(), portCdp = await portLibre();
const serveur = spawn("python3", ["web_3D.py", "--port", portWeb, "--local", "--sans-navigateur", "--sans-pause", "--sans-maj", "--projets", projets],
  { cwd:RACINE, stdio:"ignore", env:{ ...process.env, WEB_TOOLS_HTTP:"1" } });
let navigateur = null;
/* Interrompu (Ctrl+C, délai de la CI) : on ne laisse ni processus ni profil de 100 Mo dans /tmp. */
const nettoyer = () => {
  navigateur?.kill(); serveur.kill();
  rmSync(projets, { recursive:true, force:true }); rmSync(profil, { recursive:true, force:true });
};
for(const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { nettoyer(); process.exit(130); });

const erreurs = [];
let ws, n = 0;
const attentes = new Map();
const cdp = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++n;
  attentes.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
  setTimeout(() => attentes.delete(id) && reject(new Error(`${method} : pas de réponse en 5 min`)), 300000);
});
/** Évalue `code` (corps de fonction async) dans la page ; rend sa valeur JSON. */
let etape = "démarrage";
async function page(code, delai = 240000){
  etape = code.trim().split("\n")[0].slice(0, 70);
  const r = await Promise.race([
    cdp("Runtime.evaluate", { expression:`(async () => { ${code} })()`, awaitPromise:true, returnByValue:true }),
    pause(delai).then(() => ({ exceptionDetails:{ text:"délai dépassé" } })),
  ]);
  if(r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}

try{
  await attendreHttp(`http://127.0.0.1:${portWeb}/conception.html`);
  /* Chromium démarre sur la page : depuis about:blank, Page.navigate restait sans réponse sur le Pi. */
  navigateur = spawn(CHROMIUM, ["--headless=new", `--remote-debugging-port=${portCdp}`, `--user-data-dir=${profil}`,
    "--password-store=basic", "--use-mock-keychain",     // sinon le réseau de Chromium attend un trousseau, sans fin
    "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-first-run", "--window-size=1500,950",
    `http://127.0.0.1:${portWeb}/conception.html`], { stdio:"ignore" });
  const cibles = await (await attendreHttp(`http://127.0.0.1:${portCdp}/json/list`)).json();
  ws = new WebSocket(cibles.find(c => c.type === "page").webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if(m.id && attentes.has(m.id)){ const a = attentes.get(m.id); attentes.delete(m.id); m.error ? a.reject(new Error(m.error.message)) : a.resolve(m.result); return; }
    if(m.method === "Runtime.exceptionThrown") erreurs.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if(m.method === "Runtime.consoleAPICalled" && m.params.type === "error") erreurs.push(m.params.args.map(a => a.value ?? a.description).join(" "));
    if(m.method === "Log.entryAdded" && m.params.entry.level === "error" && !/favicon/.test(m.params.entry.url || "")) erreurs.push(m.params.entry.text + " " + (m.params.entry.url || ""));
  };
  await cdp("Runtime.enable"); await cdp("Log.enable");

  /* Fonctions d'aide dans la page */
  await page(`
    for(let i = 0; i < 1200 && !window.W3D?.conception; i++) await new Promise(r => setTimeout(r, 100));
    if(!window.W3D?.conception) throw new Error("la page de conception n'a pas démarré");
    const c = W3D.conception;
    window.fini = async () => { await new Promise(r => setTimeout(r, 50)); while(c.enCours || c.relancer) await new Promise(r => setTimeout(r, 50)); };
    window.prompt = () => "essai";
    window.confirm = () => true;
    await fini();
  `);
  verifier("réglages repris de la visionneuse", await page(`return document.getElementById("selSouris").options.length > 3`), true);
  verifier("noyau prêt, pièce vide", await page(`return W3D.conception.nomsCorps.length`), 0);

  const r1 = await page(`
    const c = W3D.conception;
    c.creer("boite"); Object.assign(c.edition.op, { L:"20", l:"20", h:"20", centre:true });
    c.validerOperation(); await fini();
    return { corps:c.nomsCorps, vol:Math.round(c.resultat.maillages[0].proprietes.volume), arbre:document.querySelectorAll("#arbre .nd").length > 0 };
  `);
  verifier("boîte 20 mm : un corps, 8000 mm³, listé dans l'arbre", r1, { corps:["Corps 1"], vol:8000, arbre:true });

  const r2 = await page(`
    const c = W3D.conception, ed = c.editeur;
    c.creer("esquisse"); c.edition.op.plan.decalage = "20";
    c.validerOperation();
    if(!ed.ouvert) throw new Error("l'éditeur d'esquisse ne s'est pas ouvert");
    ed.choisirOutil("cercle"); ed.clic({ x:0, y:0, id:"o" }); ed.clic({ x:3, y:0, id:null });
    const cercle = ed.esq.elements.find(e => e.type === "cercle");
    ed.choisirOutil("cercle");
    ed.selection.add(cercle.id); ed.coter();
    await new Promise(r => requestAnimationFrame(r));
    const saisie = document.querySelector(".saisie-cote");
    saisie.value = "D";
    W3D.conception.doc.parametres.push({ nom:"D", expr:"8" }); ed.v = c.v();
    saisie.dispatchEvent(new KeyboardEvent("keydown", { key:"Enter" }));
    const r = cercle.r;
    c.terminerEsquisse(); await fini();
    return { r, ouvert:ed.ouvert, cotes:document.querySelectorAll(".cote-esquisse").length };
  `);
  verifier("esquisse : cercle coté par un paramètre (D = 8), éditeur refermé", r2, { r:4, ouvert:false, cotes:0 });

  const r3 = await page(`
    const c = W3D.conception;
    c.creer("extrusion"); Object.assign(c.edition.op, { distance:"20", inverse:true, operation:"enlever" });
    c.validerOperation(); await fini();
    const vol = c.resultat.maillages[0].proprietes.volume;
    c.creer("conge"); Object.assign(c.edition.op, { toutes:true, rayon:"1" });
    c.validerOperation(); await fini();
    const erreurs = Object.values(c.resultat.etats).filter(n => n.erreur).length;
    return { trou:Math.abs(vol - (8000 - Math.PI * 16 * 20)) < 1, erreurs, historique:document.querySelectorAll("#frisePiste .puce:not(.tete)").length };
  `);
  verifier("enlèvement du trou Ø8 traversant, puis congé sur toutes les arêtes", r3, { trou:true, erreurs:0, historique:4 });

  const r4 = await page(`
    const c = W3D.conception;
    c.annuler(); await fini();
    const apres = c.doc.operations.length;
    c.refaire(); await fini();
    c.doc.parametres[0].expr = "10"; c.marquerModifie(); await c.reconstruire(); await fini();
    const vol = c.resultat.maillages[0].proprietes.volume;
    return { annule:apres, refait:c.doc.operations.length, d10:vol < 8000 - Math.PI * 25 * 20 + 1 };
  `);
  verifier("annuler / refaire, paramètre D = 10 reconstruit", r4, { annule:3, refait:4, d10:true });

  const r4b = await page(`
    const c = W3D.conception;
    c.placerCurseur(1); await fini();
    const avant = c.nomsCorps.length, vol = c.resultat.maillages[0].proprietes.volume;
    c.placerCurseur(4); await fini();
    c.nouveauDossier = c.nouveauDossier.bind(c); window.prompt = () => "Trou";
    c.nouveauDossier(["op2", "op3"]);
    const dossier = c.doc.dossiers.map(d => d.ops);
    window.prompt = () => "essai";
    return { marqueur:[avant, Math.round(vol)], dossier, nav:document.querySelectorAll("#navEsquisses .nv").length };
  `);
  verifier("frise : marqueur après la boîte, puis dossier sur l'esquisse et l'enlèvement", r4b,
    { marqueur:[1, 8000], dossier:[["op2", "op3"]], nav:1 });

  await page(`await W3D.conception.enregistrer(true);`);
  const r5 = await page(`
    const c = W3D.conception;
    c.doc.parametres[0].expr = "6"; c.marquerModifie();
    await c.enregistrer(false);
    return { chemin:c.cheminProjet, modifie:c.modifie };
  `);
  verifier("enregistrer sous, puis enregistrer remplace le même fichier", r5, { chemin:"essai.json", modifie:false });
  verifier("PROJETS : un seul fichier, à jour", [readdirSync(projets), JSON.parse(readFileSync(join(projets, "essai.json"), "utf8")).parametres[0].expr], [["essai.json"], "6"]);

  const r6 = await page(`
    const c = W3D.conception;
    const r = await c.envoyer({ type:"exporter", doc:c.docPourNoyau(), format:"step", corps:c.nomsCorps });
    const texte = await r.blob.text();
    return texte.startsWith("ISO-10303-21") && texte.length > 2000;
  `);
  verifier("export STEP", r6, true);

  const r7 = await page(`
    const c = W3D.conception, pause = (ms) => new Promise(r => setTimeout(r, ms));
    c.basculerAnalyse("zebra"); await pause(800);
    const shader = W3D.vue.modele.children[0].material.isShaderMaterial;
    c.basculerAnalyse("courbure"); await pause(800);
    c.basculerAnalyse("courbure"); await pause(200);
    const rendu = !W3D.vue.modele.children[0].material.isShaderMaterial;
    c.creer("plan"); c.validerOperation(); await fini();
    c.creer("esquisse"); const id = c.doc.operations.find(o => o.type === "plan").id;
    c.edition.op.plan = { ref:id }; c.validerOperation();
    const surPlan = c.editeur.ouvert && c.editeur.r.o[2] === 10;
    c.editeur.choisirOutil("spline"); c.editeur.clic({ x:0, y:0, id:null }); c.editeur.clic({ x:5, y:5, id:null }); c.editeur.clic({ x:10, y:0, id:null });
    c.editeur.finirSpline(); c.editeur.choisirOutil("spline");
    const spline = c.editeur.esq.elements.filter(e => e.type === "spline").length;
    c.terminerEsquisse(); await fini();
    await c.nouveau(); await fini();
    const deux = [c.onglets.length, c.doc.operations.length, c.nomsCorps.length];
    c.activerOnglet(0); await fini();
    return { shader, rendu, surPlan, spline, deux, retour:c.nomsCorps.length, onglets:document.querySelectorAll("#ongletsDocs .onglet-doc").length };
  `);
  verifier("analyses, plan de construction, spline, onglets", r7, { shader:true, rendu:true, surPlan:true, spline:1, deux:[2, 0, 0], retour:1, onglets:2 });
  await page(`W3D.conception.modifie = false; W3D.conception.sauverOnglet(); for(const o of W3D.conception.onglets) o.modifie = false;`);

  /* Vrais gestes : clics du ruban, tracé à la souris, glissé du marqueur, menus. */
  const souris = async (type, x, y, extra = {}) => cdp("Input.dispatchMouseEvent", { type, x, y, button:"left", buttons:type === "mouseReleased" ? 0 : 1, clickCount:1, ...extra });
  const cliquer = async (x, y) => { await souris("mouseMoved", x, y, { buttons:0, button:"none" }); await souris("mousePressed", x, y); await souris("mouseReleased", x, y); await pause(60); };
  const glisser = async (x0, y0, x1, y1) => {
    await souris("mouseMoved", x0, y0, { buttons:0, button:"none" }); await souris("mousePressed", x0, y0);
    for(let i = 1; i <= 6; i++){ await souris("mouseMoved", x0 + (x1 - x0) * i / 6, y0 + (y1 - y0) * i / 6); await pause(40); }
    await souris("mouseReleased", x1, y1); await pause(80);
  };
  const centre = (sel) => page(`const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2];`);
  const cliquerSur = async (sel) => cliquer(...await centre(sel));
  const capture = async (nom) => {
    if(!process.env.CAPTURES) return;
    const { data } = await cdp("Page.captureScreenshot", { format:"png" });
    writeFileSync(join(process.env.CAPTURES, nom + ".png"), Buffer.from(data, "base64"));
  };
  await page(`await W3D.conception.nouveau(); await fini(); document.getElementById("accueil").hidden = true;`);
  await capture("1-vide");
  await cliquerSur('#ruban [data-op="esquisse"]');
  await cliquerSur("#bValiderOperation");
  verifier("gestes : le ruban ouvre une esquisse", await page(`return [W3D.conception.editeur.ouvert, !document.querySelector('.ong-ruban[data-onglet="esquisse"]').hidden];`), [true, true]);
  await pause(800);
  await cliquerSur('#ruban [data-outil="rectangle"]');
  const v = await centre("#vue3d");
  await cliquer(v[0] - 120, v[1] - 80);
  await souris("mouseMoved", v[0] + 40, v[1] + 30, { buttons:0, button:"none" });
  await cliquer(v[0] + 120, v[1] + 80);
  verifier("gestes : un rectangle tracé à la souris", await page(`const e = W3D.conception.editeur.esq.elements; return e.filter(x => x.type === "ligne").length;`), 4);
  await capture("2-esquisse");
  await cliquerSur('#ruban [data-action="terminer"]');
  await page(`await fini();`);
  await cliquerSur('.ong-ruban[data-onglet="modele"]');
  await cliquerSur('#ruban [data-op="extrusion"]');
  await page(`await new Promise(r => setTimeout(r, 400)); await fini();`);
  await capture("3-extrusion");
  await cliquerSur("#bValiderOperation");
  await page(`await fini();`);
  await cliquerSur('#ruban [data-op="boite"]');
  await cliquerSur("#bValiderOperation");
  await page(`await fini();`);
  verifier("gestes : extrusion puis boîte, deux opérations de plus", await page(`return document.querySelectorAll("#frisePiste .puce:not(.tete)").length;`), 3);
  await capture("4-piece");
  /* Le marqueur, glissé à gauche de la dernière icône */
  const puces = await page(`return [...document.querySelectorAll("#frisePiste .puce")].map(p => { const r = p.getBoundingClientRect(); return [r.left, r.top + r.height / 2]; });`);
  const m = await centre("#frisePiste .marqueur");
  await glisser(m[0], m[1], puces[2][0] - 4, m[1]);
  await page(`await new Promise(r => setTimeout(r, 200)); await fini();`);
  verifier("gestes : le marqueur glissé revient d'une opération", await page(`return W3D.conception.doc.curseur;`), 2);
  await cliquerSur("#bFriseFin");
  await page(`await fini();`);
  verifier("gestes : ⏭ revient à la fin", await page(`return W3D.conception.doc.curseur ?? null;`), null);
  await cliquerSur("#bMenuFichier");
  verifier("gestes : le menu Fichier s'ouvre", await page(`return !document.getElementById("menuFichier").hidden;`), true);
  await cliquerSur("#vue3d");
  verifier("gestes : un clic ailleurs le ferme", await page(`return document.getElementById("menuFichier").hidden;`), true);
  await cliquerSur("#bVues");
  verifier("gestes : le menu des vues s'ouvre", await page(`return !document.getElementById("vuesRapides").hidden;`), true);
  await capture("5-menu-vues");
  await cliquerSur('#vuesRapides [data-vue="dessus"]');
  await page(`W3D.conception.sauverOnglet(); for(const o of W3D.conception.onglets) o.modifie = false; W3D.conception.modifie = false;`);

  /* Les ateliers, onglet par onglet : opérations construites, désignations à la souris, développé. */
  for(const o of ["surface", "assemblage", "inserer", "inspecter", "gerer", "affichage", "tolerie", "soudures"]){
    await cliquerSur(`.ong-ruban[data-onglet="${o}"]`);
    await capture("onglet-" + o);
  }
  await cliquerSur('.ong-ruban[data-onglet="modele"]');
  const r8 = await page(`
    const c = W3D.conception;
    await c.nouveau(); await fini();
    const rect = (id, x0, y0, x1, y1) => [["p1", x0, y0], ["p2", x1, y0], ["p3", x1, y1], ["p4", x0, y1]].map(([i, x, y]) => ({ id:i, type:"point", x, y }))
      .concat(["1", "2", "3", "4"].map((n, k) => ({ id:"l" + n, type:"ligne", p1:"p" + n, p2:"p" + (k === 3 ? 1 : k + 2) })));
    /* Une tôle de 100 × 50 */
    c.creer("esquisse"); c.validerOperation();
    c.editeur.esq.elements.push(...rect("t", 0, 0, 100, 50));
    c.editeur.resoudre(); c.terminerEsquisse(); await fini();
    c.creer("tole"); c.validerOperation(); await fini();
    W3D.nav.allerVersVue("iso", false); W3D.vue.ajusterVue(W3D.vue.modele);
    await new Promise(r => setTimeout(r, 300));
    c.creer("bride");
    return { tole:c.nomsCorps, erreurs:Object.values(c.resultat.etats).filter(n => n.erreur).length };
  `);
  verifier("tôle construite", r8, { tole:["Corps 1"], erreurs:0 });
  await page(`W3D.conception.designer("arete"); await new Promise(r => setTimeout(r, 200)); await fini();`);
  const bord = await page(`
    const V = W3D.THREE.Vector3, p = W3D.vue.versEcran(new V(100, 25, 2)), r = W3D.vue.canvas.getBoundingClientRect();
    return [p.x + r.left, p.y + r.top];`);
  await cliquer(bord[0], bord[1]);
  await page(`await new Promise(r => setTimeout(r, 500)); await fini();`);
  const r9 = await page(`const c = W3D.conception, a = c.edition.op.arete; return a && [a[0], a[2]];`);
  verifier("désignation à la souris : l'arête du bord de la tôle", r9, [100, 2]);
  await capture("tole-bride");
  const r10 = await page(`
    const c = W3D.conception;
    c.validerOperation(); await fini();
    const vol = c.resultat.maillages[0].proprietes.volume;
    document.getElementById("bDeplier").click(); await new Promise(r => setTimeout(r, 100)); await fini();
    const plat = c.resultat.maillages[0].proprietes.boite[1][2];
    document.getElementById("bDeplier").click(); await new Promise(r => setTimeout(r, 100)); await fini();
    const d = await c.envoyer({ type:"developpe", doc:c.docPourNoyau() });
    return { vol:Math.round(vol), plat:Math.round(plat), dxf:d.dxf.includes("PLIS") && d.dxf.includes("CONTOUR"), err:c.resultat.etats[c.doc.operations.at(-1).id].erreur ?? null };
  `);
  verifier("bord tombé, dépliage et DXF", r10, { vol:10000 + 20 * 2 * 50 + Math.round(Math.PI / 4 * (4 * 4 - 2 * 2) * 50), plat:2, dxf:true, err:null });
  /* La poignée d'une extrusion, tirée à la souris */
  const r11 = await page(`
    const c = W3D.conception;
    await c.nouveau(); await fini();
    c.creer("esquisse"); c.validerOperation();
    const e = c.editeur.esq;
    e.elements.push({ id:"a", type:"point", x:-10, y:-10 }, { id:"b", type:"point", x:10, y:-10 }, { id:"d", type:"point", x:10, y:10 }, { id:"f", type:"point", x:-10, y:10 },
      { id:"l1", type:"ligne", p1:"a", p2:"b" }, { id:"l2", type:"ligne", p1:"b", p2:"d" }, { id:"l3", type:"ligne", p1:"d", p2:"f" }, { id:"l4", type:"ligne", p1:"f", p2:"a" });
    c.editeur.resoudre(); c.terminerEsquisse(); await fini();
    c.creer("extrusion"); await new Promise(r => setTimeout(r, 350)); await fini();
    W3D.nav.allerVersVue("avant", false); W3D.vue.ajusterVue(W3D.vue.modele); W3D.vue.rendre();
    await new Promise(r => setTimeout(r, 200));
    const V = W3D.THREE.Vector3, r = W3D.vue.canvas.getBoundingClientRect();
    const a = W3D.vue.versEcran(new V(0, 0, 10)), b = W3D.vue.versEcran(new V(0, 0, 18));
    return [a.x + r.left, a.y + r.top, b.y + r.top];`);
  await glisser(r11[0], r11[1], r11[0], r11[2]);
  await page(`await new Promise(r => setTimeout(r, 400)); await fini();`);
  const d11 = await page(`return parseFloat(W3D.conception.edition.op.distance);`);
  verifier("poignée : tirée de 10 à environ 18 mm", d11 > 15 && d11 < 21, true);
  await capture("poignee");
  const r12 = await page(`
    const c = W3D.conception;
    c.validerOperation(); await fini();
    /* Un texte dans une esquisse : son contour vient du noyau */
    c.creer("esquisse"); c.validerOperation();
    c.editeur.esq.elements.push({ id:"p", type:"point", x:-8, y:-3, constr:true }, { id:"x", type:"texte", p:"p", contenu:"Pi", h:8 });
    c.editeur.redessiner();
    for(let i = 0; i < 100 && !c.contours?.get("8|Pi"); i++) await new Promise(r => setTimeout(r, 100));
    const contour = c.contours?.get("8|Pi")?.length > 0;
    c.editeur.redessiner();
    c.terminerEsquisse(); await fini();
    /* Visserie, axe, filetage de construction, liaison */
    c.creer("vis"); Object.assign(c.edition.op, { norme:"M6", modele:"chc", longueur:"20", x:"50" }); c.validerOperation(); await fini();
    c.creer("axe"); c.validerOperation(); await fini();
    c.creer("point"); c.validerOperation(); await fini();
    const noms = c.nomsCorps.length;
    const err = Object.entries(c.resultat.etats).filter(([, n]) => n.erreur).map(([i]) => i);
    return { contour, noms, err };
  `);
  verifier("texte exact, visserie, axe, point", r12, { contour:true, noms:2, err:[] });
  await capture("aides");
  /* Assemblage et insertions, à la vraie souris pour ce qui se désigne */
  const ecran = (x, y, z) => page(`const r = W3D.vue.canvas.getBoundingClientRect(), p = W3D.vue.versEcran(new W3D.THREE.Vector3(${x}, ${y}, ${z})); return [p.x + r.left, p.y + r.top];`);
  await page(`
    const c = W3D.conception;
    await c.nouveau(); await fini();
    c.creer("cylindre"); Object.assign(c.edition.op, { diametre:"20", h:"30", operation:"nouveau" }); c.validerOperation(); await fini();
    c.creer("boite"); Object.assign(c.edition.op, { L:"40", l:"10", h:"10", centre:false, x:"60", y:"0", z:"0", operation:"nouveau" }); c.validerOperation(); await fini();
    c.creer("filetage");
    W3D.nav.animation = null; W3D.nav.allerVersVue("avant", false); W3D.vue.ajusterVue(W3D.vue.modele); W3D.vue.rendre();
    c.designer("cylindreAxe");
    await new Promise(r => setTimeout(r, 400)); await fini();
    W3D.vue.ajusterVue(W3D.vue.modele); W3D.vue.rendre();
    await new Promise(r => setTimeout(r, 150));`);
  await cliquer(...await ecran(0, -10, 15));
  await page(`await new Promise(r => setTimeout(r, 400)); await fini();`);
  const r13 = await page(`
    const c = W3D.conception, o = c.edition.op, cyl = o.cylindre;
    const res = cyl && { rayon:Math.round(cyl.rayon), axeZ:Math.round(Math.abs(cyl.axe[2])) };
    c.validerOperation(); await fini();
    c.creer("liaison"); c.edition.op.mode = "glissiere"; c.edition.op.valeur = "5";
    c.designer("repereA");
    await new Promise(r => setTimeout(r, 400)); await fini();
    W3D.vue.rendre(); await new Promise(r => setTimeout(r, 150));
    return res;`);
  verifier("filetage : la face cylindrique cliquée", r13, { rayon:10, axeZ:1 });
  await cliquer(...await ecran(0, -10, 15));          // le cylindre : corps fixe, axe Z
  await page(`W3D.conception.designer("repereB"); await new Promise(r => setTimeout(r, 400)); await fini(); W3D.vue.rendre(); await new Promise(r => setTimeout(r, 150));`);
  await cliquer(...await ecran(80, 0, 5));             // la face avant de la boîte : corps mobile
  await page(`await new Promise(r => setTimeout(r, 400)); await fini();`);
  const r14 = await page(`
    const c = W3D.conception, o = c.edition.op;
    const r = { a:o.corpsA, b:o.corpsB, ta:o.repereA?.type, tb:o.repereB?.type };
    c.validerOperation(); await fini();
    r.err = c.resultat.etats[o.id].erreur ?? null;
    return r;`);
  verifier("liaison : les corps viennent des faces cliquées", r14, { a:"Corps 1", b:"Corps 2", ta:"cylindre", tb:"plan", err:null });
  const r15 = await page(`
    const c = W3D.conception, lie = c.doc.operations.find(o => o.type === "liaison");
    /* Animer : l'aller-retour ne change pas la pièce */
    const avant = lie.valeur;
    document.getElementById("bAnimer"); c.animation = false;
    const bb = () => c.resultat.maillages[1].proprietes.boite[1][2];
    const h0 = bb();
    lie.valeur = "12"; await c.reconstruire(); await fini();
    const h1 = bb();
    lie.valeur = avant; await c.reconstruire(); await fini();
    /* Animer par le vrai bouton : la pièce n'est pas modifiée */
    window.prompt = () => "0, 5, 2";
    document.getElementById("bAnimer").click();
    document.querySelector("#menuContexte button").click();
    for(let i = 0; i < 600 && (c.animation || c.enCours); i++) await new Promise(r => setTimeout(r, 100));
    window.prompt = () => "essai";
    if(lie.valeur !== avant || c.valeurAnimee) throw new Error("l'animation a modifié la pièce");
    /* Éclaté */
    c.eclate = 1; (await import("/js/c9-ateliers-ui.js")).appliquerEclate(c);
    const bouge = W3D.vue.modele.children.some(m => m.position.length() > 1);
    c.eclate = 0; (await import("/js/c9-ateliers-ui.js")).appliquerEclate(c);
    const revenu = W3D.vue.modele.children.every(m => m.position.length() === 0);
    /* Fichiers : un composant, un maillage, une image */
    const F = (await import("/js/c9-ateliers-ui.js")).fichierAtelier;
    c.intention = "composant";
    const sous = JSON.stringify({ format:"web3d-conception", operations:[{ id:"b", type:"boite", L:"5", l:"5", h:"5" }], parametres:[] });
    await F(c, new File([sous], "sous.json"), "json");
    c.validerOperation(); await fini();
    const stl = "solid t\\n" + [[[0,0,0],[0,9,0],[9,0,0]],[[0,0,0],[9,0,0],[0,0,9]],[[9,0,0],[0,9,0],[0,0,9]],[[0,0,0],[0,0,9],[0,9,0]]]
      .map(t => "facet normal 0 0 0\\nouter loop\\n" + t.map(v => "vertex " + v.join(" ")).join("\\n") + "\\nendloop\\nendfacet").join("\\n") + "\\nendsolid t\\n";
    await F(c, new File([stl], "tetra.stl"), "stl");
    c.edition.op.reference = false; c.validerOperation(); await fini();
    const png = await (await fetch("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==")).blob();
    await F(c, new File([png], "ref.png"), "png");
    c.validerOperation(); await fini();
    const err = Object.entries(c.resultat.etats).filter(([, n]) => n.erreur).map(([i, n]) => n.erreur);
    return { monte:h1 - h0, bouge, revenu, corps:c.nomsCorps.length, err };`);
  verifier("glissière, éclaté, composant, maillage, image", r15, { monte:7, bouge:true, revenu:true, corps:4, err:[] });
  await capture("assemblage");
  /* Un contour choisi d'un clic : le disque au milieu de la plaque */
  await page(`
    const c = W3D.conception;
    await c.nouveau(); await fini();
    c.creer("esquisse"); c.validerOperation();
    c.editeur.esq.elements.push(
      { id:"a", type:"point", x:-20, y:-20 }, { id:"b", type:"point", x:20, y:-20 }, { id:"d", type:"point", x:20, y:20 }, { id:"f", type:"point", x:-20, y:20 },
      { id:"l1", type:"ligne", p1:"a", p2:"b" }, { id:"l2", type:"ligne", p1:"b", p2:"d" }, { id:"l3", type:"ligne", p1:"d", p2:"f" }, { id:"l4", type:"ligne", p1:"f", p2:"a" },
      { id:"cc", type:"point", x:0, y:0 }, { id:"k", type:"cercle", c:"cc", r:8 });
    c.editeur.resoudre(); c.terminerEsquisse(); await fini();
    await new Promise(r => setTimeout(r, 700));
    c.creer("extrusion"); c.designer("contourClic");
    W3D.nav.animation = null; W3D.nav.allerVersVue("dessus", false);
    W3D.vue.rendre(); await new Promise(r => setTimeout(r, 300)); await fini();`);
  await cliquer(...await ecran(0, 0, 0));
  const r16 = await page(`
    const c = W3D.conception;
    const n = (c.edition.op.contours || []).length;
    c.designer(null); await new Promise(r => setTimeout(r, 400)); await fini();
    c.validerOperation(); await fini();
    return { n, vol:Math.round(c.resultat.maillages[0].proprietes.volume) };`);
  verifier("contour cliqué : seul le disque est extrudé", r16, { n:1, vol:Math.round(Math.PI * 64 * 10) });

  /* Composant lié à son fichier : il se met à jour quand le fichier change */
  const r17 = await page(`
    const c = W3D.conception;
    await c.nouveau(); await fini();
    const sous = (L) => JSON.stringify({ format:"web3d-conception", parametres:[], operations:[{ id:"b", type:"boite", L:String(L), l:"10", h:"10" }] });
    const ecrire = (L, rem) => fetch("api/projets?nom=lie.json" + (rem ? "&remplacer=1" : ""), { method:"POST", headers:{ "X-Web3D":"1" }, body:sous(L) });
    await ecrire(10);
    const lire = async () => (await (await fetch("api/projets", { cache:"no-store" })).json()).fichiers.find(f => f.chemin === "lie.json");
    const F = await import("/js/c9-ateliers-ui.js");
    c.intention = "composant";
    const f0 = await lire();
    await F.fichierAtelier(c, new File([sous(10)], "lie.json"), "json", { source:"lie.json", sourceDate:f0.date, sourceTaille:f0.taille });
    c.validerOperation(); await fini();
    const v0 = Math.round(c.resultat.maillages[0].proprietes.volume);
    await ecrire(25, true);     // la taille du fichier change aussi : détecté même dans la même seconde
    await ecrire(250, true);
    const avant = await F.verifierLiens(c);
    const alerte = document.getElementById("bMajComposants").classList.contains("alerte");
    const n = await F.majLiens(c); await fini();
    const v1 = Math.round(c.resultat.maillages[0].proprietes.volume);
    const apres = await F.verifierLiens(c);
    return { v0, change:avant.changees.length, alerte, n, v1, reste:apres.changees.length };`);
  verifier("composant lié : signalé, puis mis à jour d'un geste", r17, { v0:1000, change:1, alerte:true, n:1, v1:25000, reste:0 });
  /* Export de deux corps : le STL ne doit pas abîmer les formes gardées par le noyau */
  const r17b = await page(`
    const c = W3D.conception;
    c.creer("boite"); Object.assign(c.edition.op, { L:"5", l:"5", h:"5", x:"50", operation:"nouveau" }); c.validerOperation(); await fini();
    const stl = await c.envoyer({ type:"exporter", doc:c.docPourNoyau(), format:"stl", corps:c.nomsCorps });
    const step = await c.envoyer({ type:"exporter", doc:c.docPourNoyau(), format:"step", corps:c.nomsCorps });
    c.doc.parametres.push({ nom:"zz", expr:"1" }); await c.reconstruire(); await fini();
    const bons = c.resultat.maillages.filter(m => !m.erreur).length;
    c.doc.parametres.pop(); c.doc.operations.pop(); c.marquerModifie(); await c.reconstruire(); await fini();
    return { stl:stl.blob.size > 100, step:step.blob.size > 1000, bons };`);
  verifier("export de deux corps en STL et STEP, corps intacts ensuite", r17b, { stl:true, step:true, bons:2 });
  /* Panne du noyau : un travailleur neuf, le document intact, l'opération en cause suspendue */
  const r18 = await page(`
    const c = W3D.conception;
    c.creer("boite"); Object.assign(c.edition.op, { L:"5", l:"5", h:"5", x:"50", operation:"nouveau" }); c.validerOperation(); await fini();
    const coupable = c.doc.operations.at(-1).id;
    let fatale = false;
    try{ await c.envoyer({ type:"planter" }); }catch(e){ fatale = !!e.fatale; }
    const ancien = c.travailleur;
    c.relancerNoyau("Panne simulée.", coupable);
    await new Promise(r => setTimeout(r, 100)); await fini();
    const r = { fatale, neuf:c.travailleur !== ancien, suspendue:c.doc.operations.at(-1).suspendue, corps:c.nomsCorps.length };
    c.annuler(); await fini();
    r.annule = !c.doc.operations.at(-1).suspendue;
    r.apres = c.nomsCorps.length;
    /* Recyclage au repos : le seuil abaissé, le noyau repart seul, la pièce reste */
    c.seuilTas = 1;
    const av = c.travailleur;
    await c.reconstruire(); await fini();
    for(let i = 0; i < 80 && c.travailleur === av; i++) await new Promise(res => setTimeout(res, 100));
    c.seuilTas = undefined;
    await new Promise(res => setTimeout(res, 200)); await fini();
    r.recycle = c.travailleur !== av;
    r.corpsRecycle = c.nomsCorps.length;
    return r;`);
  verifier("panne du noyau et recyclage de la mémoire", r18, { fatale:true, neuf:true, suspendue:true, corps:1, annule:true, apres:2, recycle:true, corpsRecycle:2 });

  /* Téléphone */
  await cdp("Emulation.setDeviceMetricsOverride", { width:400, height:800, deviceScaleFactor:1, mobile:false });
  await pause(800);
  await capture("telephone");
  verifier("téléphone : le ruban et la frise restent dans l'écran", await page(`
    const f = document.getElementById("frise").getBoundingClientRect(), r = document.getElementById("ruban").getBoundingClientRect();
    return [f.right <= innerWidth + 1, r.right <= innerWidth + 1, f.bottom <= innerHeight + 1];`), [true, true, true]);
  await cdp("Emulation.clearDeviceMetricsOverride");
  await pause(300);
  await page(`W3D.conception.sauverOnglet(); for(const o of W3D.conception.onglets) o.modifie = false; W3D.conception.modifie = false;`);

  /* La panne simulée s'annonce dans la console, c'est voulu ; tout le reste est un vrai défaut. */
  verifier("aucune erreur dans la page de conception", erreurs.splice(0).filter(e => !String(e).includes("Panne simulée")), []);
  await page(`location.href = "index.html";`).catch(() => {});     // même origine : la session suit
  await pause(15000);
  verifier("visionneuse : lien vers la conception, sans erreur", [await page(`return !!document.querySelector('a[href="conception.html"]')`), erreurs], [true, []]);
}catch(e){
  ko++;
  console.log(`ÉCHEC du banc à l'étape « ${etape} » : ${e.message}`);
  if(erreurs.length) console.log("Erreurs de la page :\n  " + erreurs.slice(0, 8).join("\n  "));
}finally{
  ws?.close();
  navigateur?.kill();
  await pause(300);
  nettoyer();
}
console.log(ko ? `banc-conception-page : ${ko} échec(s), ${ok} OK` : `banc-conception-page : OK (${ok} vérifications)`);
process.exit(ko ? 1 : 0);
