/* Banc des pièces de référence : de vraies pièces construites par recette, comparées à leur volume
   calculé à la main, d'abord telles quelles, puis après un changement de paramètre — c'est ce second
   passage qui éprouve les références d'arêtes et de faces.
   node test/banc-pieces-reference.mjs — n'affiche que les écarts et un bilan. */
import { fileURLToPath } from "node:url";
const ici = (c) => fileURLToPath(new URL(c, import.meta.url));
const R = await import("../vendor/replicad/replicad.js");
const opencascade = (await import("../vendor/replicad/replicad_single.js")).default;
const oc = await opencascade({ locateFile:() => ici("../vendor/replicad/replicad_single.wasm") });
R.setOC(oc);
const { construire } = await import("../js/c3-operations.js");
const { dansMatiere } = await import("../js/c3c-references.js");
const { init_planegcs_module, GcsWrapper } = await import("../vendor/planegcs/index.js");
const { resoudre } = await import("../js/c2-esquisse.js");
const { evaluerParametres, evaluateur } = await import("../js/c1-expressions.js");
const mod = await init_planegcs_module({ locateFile:() => ici("../vendor/planegcs/planegcs_dist/planegcs.wasm") });
const gcs = new GcsWrapper(new mod.GcsSystem(), mod);
gcs.debug_mode = 0;
const log = console.log; console.log = () => {};
const PI = Math.PI;

/* Une esquisse cotée : un rectangle L × l, à l'origine ou centré, piloté par des expressions. */
const rectCote = (id, Lx, Ly, plan = { base:"XY" }, extra = []) => ({ id, type:"esquisse", nom:id, plan, compteur:100, elements:[
  { id:"p1", type:"point", x:0, y:0 }, { id:"p2", type:"point", x:10, y:0 }, { id:"p3", type:"point", x:10, y:10 }, { id:"p4", type:"point", x:0, y:10 },
  { id:"l1", type:"ligne", p1:"p1", p2:"p2" }, { id:"l2", type:"ligne", p1:"p2", p2:"p3" }, { id:"l3", type:"ligne", p1:"p3", p2:"p4" }, { id:"l4", type:"ligne", p1:"p4", p2:"p1" }, ...extra],
  contraintes:[{ id:"f", type:"fixe", a:"p1", x:0, y:0 }, { id:"h1", type:"horizontal", a:"l1" }, { id:"h2", type:"horizontal", a:"l3" }, { id:"v1", type:"vertical", a:"l2" }, { id:"v2", type:"vertical", a:"l4" },
    { id:"d1", type:"longueur", a:"l1", expr:Lx }, { id:"d2", type:"longueur", a:"l2", expr:Ly }] });
const cercle = (id, x, y, d) => ({ id, type:"esquisse", nom:id, plan:{ base:"XY" }, compteur:9, contraintes:[{ id:"dd", type:"diametre", a:"c", expr:d }],
  elements:[{ id:"o", type:"point", x:typeof x === "number" ? x : 0, y:typeof y === "number" ? y : 0 }, { id:"c", type:"cercle", c:"o", r:5 }] });
const points = (id, plan, pts) => ({ id, type:"esquisse", nom:id, plan, contraintes:[], elements:pts.map(([x, y], i) => ({ id:"t" + i, type:"point", x, y, seul:true })) });

/* Chaque pièce : ses paramètres, sa recette (avec valeurs), et son volume attendu v(valeurs). `change` : le second passage. */
const PIECES = {
  "plaque percée":{ p:{ L:80, l:50, e:6 }, change:{ L:120, l:70, e:8 },
    ops:() => [rectCote("s", "L", "l"), { id:"x", type:"extrusion", esquisse:"s", distance:"e" },
      points("t", { base:"XY", decalage:"e" }, [[10, 10], [30, 10]]), { id:"h", type:"percage", esquisse:"t", corps:"", diametre:"5", traversant:true }],
    vol:(q) => q.L * q.l * q.e - 2 * PI * 6.25 * q.e },
  "boîtier creux":{ p:{ L:100, l:60, h:30, ep:2 }, change:{ L:150, l:80, h:45, ep:3 },
    ops:(q) => [rectCote("s", "L", "l"), { id:"x", type:"extrusion", esquisse:"s", distance:"h" },
      { id:"c", type:"coque", corps:"", epaisseur:"ep", faces:[[q.L / 2, q.l / 2, q.h]] }],
    vol:(q) => q.L * q.l * q.h - (q.L - 2 * q.ep) * (q.l - 2 * q.ep) * (q.h - q.ep),
    vide:(q) => [[q.L / 2, q.l / 2, q.h - 0.1]], plein:(q) => [[q.L / 2, q.l / 2, q.ep / 2]] },
  "bloc chanfreiné":{ p:{ L:40, l:30, h:20, c:2 }, change:{ L:70, l:30, h:35, c:2 },
    ops:(q) => [rectCote("s", "L", "l"), { id:"x", type:"extrusion", esquisse:"s", distance:"h" },
      { id:"f", type:"chanfrein", corps:"", distance:"c", aretes:[[q.L / 2, 0, q.h]] }],
    vol:(q) => q.L * q.l * q.h - q.c * q.c / 2 * q.L,
    vide:(q) => [[q.L / 2, 0.2, q.h - 0.2]], plein:(q) => [[q.L / 2, q.l - 0.2, q.h - 0.2], [q.L / 2, 0.2, 0.2]] },
  "bloc à congé":{ p:{ L:40, l:30, h:20, r:3 }, change:{ L:90, l:45, h:12, r:3 },
    ops:(q) => [rectCote("s", "L", "l"), { id:"x", type:"extrusion", esquisse:"s", distance:"h" },
      { id:"f", type:"conge", corps:"", rayon:"r", aretes:[[q.L, q.l / 2, q.h]] }],
    vol:(q) => q.L * q.l * q.h - (1 - PI / 4) * q.r * q.r * q.l,
    vide:(q) => [[q.L - 0.1, q.l / 2, q.h - 0.1]], plein:(q) => [[0.1, q.l / 2, q.h - 0.1], [q.L - 0.1, q.l / 2, 0.1]] },
  "congé puis coque":{ p:{ L:60, l:40, h:25, r:5, ep:2 }, change:{ L:90, l:60, h:35, r:5, ep:2 },
    ops:(q) => [rectCote("s", "L", "l"), { id:"x", type:"extrusion", esquisse:"s", distance:"h" },
      { id:"f", type:"conge", corps:"", rayon:"r", aretes:[[0, 0, q.h / 2], [q.L, 0, q.h / 2], [q.L, q.l, q.h / 2], [0, q.l, q.h / 2]] },
      { id:"c", type:"coque", corps:"", epaisseur:"ep", faces:[[q.L / 2, q.l / 2, q.h]] }],
    vol:(q) => { const A = (a, b, r) => a * b - (4 - PI) * r * r; return A(q.L, q.l, q.r) * q.h - A(q.L - 2 * q.ep, q.l - 2 * q.ep, q.r - q.ep) * (q.h - q.ep); } },
  "bride à trous":{ p:{ D:100, e:10, n:6 }, change:{ D:140, e:12, n:8 },
    ops:() => [{ id:"c", type:"cylindre", diametre:"D", h:"e" }, { id:"h", type:"cylindre", diametre:"8", h:"e", x:"D/2 - 12", operation:"nouveau" },
      { id:"r", type:"repetition", corps:"Corps 2", mode:"circulaire", axe:"Z", nombre:"n", angle:"360" }, { id:"k", type:"combiner", cible:"Corps 1", outils:["Corps 2"], operation:"enlever" }],
    vol:(q) => (PI * q.D * q.D / 4 - q.n * PI * 16) * q.e },
  "arbre étagé":{ p:{ a:30, b:20, c:40 }, change:{ a:45, b:25, c:60 },
    ops:() => [{ id:"c1", type:"cylindre", diametre:"a", h:"b" }, { id:"c2", type:"cylindre", diametre:"a/2", h:"c", z:"b", operation:"joindre", corps:"" }],
    vol:(q) => PI * q.a * q.a / 4 * q.b + PI * q.a * q.a / 16 * q.c },
  "tube fileté d'un perçage lamé":{ p:{ L:50, e:20 }, change:{ L:70, e:30 },
    ops:() => [rectCote("s", "L", "L"), { id:"x", type:"extrusion", esquisse:"s", distance:"e" },
      points("t", { base:"XY", decalage:"e" }, [[25, 25]]), { id:"h", type:"percage", esquisse:"t", corps:"", forme:"lamage", diametre:"6.6", traversant:true, diamTete:"11", profTete:"6.8" }],
    vol:(q) => q.L * q.L * q.e - PI * 3.3 * 3.3 * (q.e - 6.8) - PI * 5.5 * 5.5 * 6.8 },
  "équerre":{ p:{ L:80, l:40, e:5, h:50 }, change:{ L:110, l:50, e:6, h:70 },
    ops:() => [rectCote("s", "L", "l"), { id:"x", type:"extrusion", esquisse:"s", distance:"e" },
      { id:"b", type:"boite", L:"e", l:"l", h:"h", operation:"joindre", corps:"" }],
    vol:(q) => q.L * q.l * q.e + q.e * q.l * (q.h - q.e) },
  "tôle en U":{ p:{ L:100, l:50, e:2, h:20 }, change:{ L:160, l:80, e:2, h:30 },
    ops:(q) => [rectCote("s", "L", "l"), { id:"t", type:"tole", esquisse:"s", epaisseur:"e", rayon:"3", k:"0.4" },
      { id:"b1", type:"bride", corps:"", arete:[q.L, q.l / 2, q.e], angle:"90", hauteur:"h" },
      { id:"b2", type:"bride", corps:"", arete:[0, q.l / 2, q.e], angle:"90", hauteur:"h" }],
    vol:(q) => q.L * q.l * q.e + 2 * ((PI / 4) * ((3 + q.e) ** 2 - 9) * q.l + q.h * q.e * q.l),
    plein:(q) => [[q.L + 3 + q.e / 2, q.l / 2, q.e + 3 + q.h - 0.1], [-3 - q.e / 2, q.l / 2, q.e + 3 + q.h - 0.1]] },
  "cadre en profilés":{ p:{ L:200, l:100 }, change:{ L:300, l:150 },
    ops:() => [rectCote("s", "L", "l"), { id:"f", type:"profile", esquisse:"s", section:"carre", a:"20", b:"20", ep:"2", joint:"onglet", fusion:true }],
    /* Tube 20×20×2 : section 144 mm², fibre neutre le long du contour médian ; coins en onglet exacts. */
    vol:(q) => 144 * (2 * q.L + 2 * q.l) },
  "bossage sur face suivie":{ p:{ L:50, h:20 }, change:{ L:80, h:35 },
    ops:(q) => [rectCote("s", "L", "L"), { id:"x", type:"extrusion", esquisse:"s", distance:"h" },
      { ...rectCote("b", "10", "10", { origine:[5, 5, q.h], normale:[0, 0, 1], xdir:[1, 0, 0], suivre:true }) }, { id:"y", type:"extrusion", esquisse:"b", distance:"5", operation:"joindre", corps:"" }],
    vol:(q) => q.L * q.L * q.h + 500, plein:(q) => [[10, 10, q.h + 4.9]] },
  "tirer une face":{ p:{ L:40, h:10 }, change:{ L:60, h:18 },
    ops:(q) => [rectCote("s", "L", "L"), { id:"x", type:"extrusion", esquisse:"s", distance:"h" },
      { id:"t", type:"tirer", corps:"", distance:"5", face:{ point:[q.L / 2, q.L / 2, q.h], normale:[0, 0, 1] } }],
    vol:(q) => q.L * q.L * (q.h + 5), plein:(q) => [[q.L / 2, q.L / 2, q.h + 4.9]] },
  "écrou et rondelle":{ p:{ }, change:null,
    ops:() => [{ id:"r", type:"vis", norme:"M8", modele:"rondelle" }],
    vol:() => PI * (64 - 4.2 * 4.2) * 1.6 },
  "révolution":{ p:{ r:20, ep:4, h:30 }, change:{ r:30, ep:5, h:50 },
    ops:() => [{ ...rectCote("s", "ep", "h", { base:"XZ" }), elements:rectCote("s", "ep", "h").elements.map(e => e.type === "point" ? { ...e, x:e.x + 20 } : e),
      contraintes:[{ id:"f", type:"coordinate", a:"p1" }, ...rectCote("s", "ep", "h").contraintes.filter(k => k.type !== "fixe")].filter(k => k.type !== "coordinate").concat([{ id:"dx", type:"distanceX", a:"o", b:"p1", expr:"r", signe:1 }]),
    }, { id:"x", type:"revolution", esquisse:"s", axe:"y", angle:"360" }],
    vol:(q) => PI * ((q.r + q.ep) ** 2 - q.r ** 2) * q.h, prep:(ops) => { ops[0].elements.push({ id:"o", type:"point", x:0, y:0 }); ops[0].contraintes.push({ id:"fo", type:"fixe", a:"o", x:0, y:0 }); } },
};

let ok = 0, ko = 0;
const ecarts = [];
const juger = (nom, passage, q, res, attendu, P) => {
  /* Le volume ne distingue pas une arête de sa symétrique : des points témoins disent où la matière est. */
  const dans = (p) => res.corps.some(c => dansMatiere(R, c.shape, p));
  for(const p of P.vide?.(q) || []) if(dans(p)){ ko++; ecarts.push(`ÉCHEC ${nom} (${passage}) : de la matière en ${p}, attendu vide`); }
  for(const p of P.plein?.(q) || []) if(!dans(p)){ ko++; ecarts.push(`ÉCHEC ${nom} (${passage}) : pas de matière en ${p}`); }
  const erreurs = Object.entries(res.etats).filter(([, n]) => n.erreur).map(([id, n]) => `${id} : ${n.erreur}`);
  const vol = res.corps.reduce((s, c) => s + Math.abs(R.measureVolume(c.shape)), 0);
  const e = Math.abs(vol / attendu - 1);
  if(erreurs.length || e > 0.002){ ko++; ecarts.push(`ÉCHEC ${nom} (${passage}) : ${erreurs.join(" ; ") || `volume ${vol.toFixed(1)} au lieu de ${attendu.toFixed(1)} (${(e * 100).toFixed(2)} %)`}`); }
  else ok++;
};
for(const [nom, P] of Object.entries(PIECES)){
  const params = (q) => Object.entries(q).map(([n, v]) => ({ nom:n, expr:String(v) }));
  const doc = { parametres:params(P.p), operations:P.ops(P.p) };
  P.prep?.(doc.operations);
  const solve = () => { const v = evaluateur(evaluerParametres(doc.parametres).valeurs); for(const o of doc.operations) if(o.type === "esquisse") resoudre(gcs, o, v); };
  solve();
  const cache = [];
  juger(nom, "tel quel", P.p, await construire(R, doc, cache, oc), P.vol(P.p), P);
  if(P.change){
    doc.parametres = params(P.change);
    solve();
    juger(nom, "paramètres changés", P.change, await construire(R, doc, cache, oc), P.vol(P.change), P);
  }
}
/* Une opération insérée avant le chanfrein change l'encombrement : le chanfrein garde son arête. */
{
  const ops = [rectCote("s", "40", "30"), { id:"x", type:"extrusion", esquisse:"s", distance:"20" },
    { id:"f", type:"chanfrein", corps:"", distance:"2", aretes:[[0, 15, 20]] }];
  const doc = { parametres:[], operations:ops };
  const v = evaluateur(new Map());
  for(const o of ops) if(o.type === "esquisse") resoudre(gcs, o, v);
  await construire(R, doc, [], oc);
  ops.splice(2, 0, { id:"b", type:"boite", L:"60", l:"30", h:"20", x:"40", operation:"joindre", corps:"" });
  const r = await construire(R, doc, [], oc);
  const pts = (x, y, z) => dansMatiere(R, r.corps[0].shape, [x, y, z]);
  if(r.etats.f.erreur || pts(0.2, 15, 19.8) || !pts(99.8, 15, 19.8)){ ko++; ecarts.push(`ÉCHEC insertion avant le chanfrein : ${r.etats.f.erreur || "mauvaise arête"}`); } else ok++;
  /* Le trou suit : un second corps n'attire pas l'arête du premier. */
  const deux = { parametres:[], operations:[rectCote("s", "40", "30"), { id:"x", type:"extrusion", esquisse:"s", distance:"20" },
    { id:"f", type:"chanfrein", corps:"Corps 1", distance:"2", aretes:[[20, 0, 20]] }] };
  for(const o of deux.operations) if(o.type === "esquisse") resoudre(gcs, o, v);
  const rd = await construire(R, deux, [], oc);
  if(rd.etats.f.erreur){ ko++; ecarts.push("ÉCHEC désignation simple : " + rd.etats.f.erreur); } else ok++;
  /* Une arête vraiment disparue : l'erreur doit se voir, pas viser une autre arête. */
  const perdu = { parametres:[{ nom:"D", expr:"10" }], operations:[{ id:"b", type:"boite", L:"40", l:"30", h:"20" },
    { id:"n", type:"boite", L:"40", l:"10", h:"D", y:"20", z:"20-D", operation:"enlever", corps:"" },
    { id:"f", type:"chanfrein", corps:"", distance:"1", aretes:[[20, 20, 10]] }] };   // le fond de l'entaille, côté paroi
  await construire(R, perdu, [], oc);
  perdu.parametres[0].expr = "20";       // l'entaille devient traversante : ce fond n'existe plus
  const rp = await construire(R, perdu, [], oc);
  if(!rp.etats.f.erreur && !rp.etats.n.erreur){ ko++; ecarts.push("ÉCHEC arête disparue : aucune erreur signalée"); } else ok++;
}
console.log = log;
for(const e of ecarts) console.log(e);
console.log(ko ? `banc-pieces-reference : ${ko} échec(s), ${ok} OK` : `banc-pieces-reference : OK (${ok} vérifications)`);
process.exit(ko ? 1 : 0);
