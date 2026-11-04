/* Banc du mode conception : expressions, esquisse et solveur, opérations OpenCascade.
   node test/banc-conception.mjs — n'affiche que les échecs et un bilan. */
import { fileURLToPath } from "node:url";
import { evaluer, evaluerParametres, appliquerConfiguration, lireParametresCsv } from "../js/c1-expressions.js";
import { nouvelleEsquisse, nouvelId, resoudre, profils, lireDxf, ajouterPrimitives, repere, indexer, milieuArc, rayonDe } from "../js/c2-esquisse.js";

const ici = (c) => fileURLToPath(new URL(c, import.meta.url));
let ok = 0, ko = 0;
const verifier = (nom, obtenu, attendu, tol = 1e-6) => {
  const bon = typeof attendu === "number" ? Math.abs(obtenu - attendu) <= tol : JSON.stringify(obtenu) === JSON.stringify(attendu);
  if(bon) ok++; else { ko++; console.log(`ÉCHEC ${nom} : obtenu ${JSON.stringify(obtenu)}, attendu ${JSON.stringify(attendu)}`); }
};
const leve = (nom, f) => { try{ f(); ko++; console.log(`ÉCHEC ${nom} : pas d'erreur`); }catch(e){ ok++; } };

/* ---------------- expressions ---------------- */
verifier("priorités", evaluer("2 + 3*4^2"), 50);
verifier("unaire et parenthèses", evaluer("-(2+3)*2"), -10);
verifier("virgule décimale", evaluer("2,5"), 2.5);
verifier("fonctions en degrés", evaluer("sin(30)*2"), 1);
verifier("min, max, pi", evaluer("max(1, min(4, 3)) + pi"), 3 + Math.PI);
verifier("unité tolérée", evaluer("10mm + 5"), 15);
leve("pas de code", () => evaluer("constructor.constructor('x')()"));
leve("division par zéro", () => evaluer("1/0"));
leve("parenthèse manquante", () => evaluer("(1+2"));
verifier("unités : pouces et centimètres", [evaluer("1in"), evaluer("2 cm + 1"), evaluer("0.5m")], [25.4, 21, 500]);
verifier("unité : un nom de paramètre après un nombre reste une erreur", (() => { try{ evaluer("2min", () => 1); return false; }catch(_){ return true; } })(), true);
verifier("paramètre commençant par m lu comme un nom", evaluer("m1 + 2", () => 3), 5);
const dc = { parametres:[{ nom:"L", expr:"40" }, { nom:"e", expr:"2" }], configurations:[{ nom:"Grand", valeurs:{ L:"80" } }] };
verifier("configuration : les valeurs connues remplacent", [appliquerConfiguration(dc, "Grand"), dc.parametres.map(p => p.expr), dc.configActive], [true, ["80", "2"], "Grand"]);
verifier("configuration inconnue refusée", appliquerConfiguration(dc, "Absent"), false);
verifier("CSV de paramètres", lireParametresCsv('nom;expression\nL;40\n"l";L/2\n\n1x;3\ne,2.5'), [{ nom:"L", expr:"40" }, { nom:"l", expr:"L/2" }, { nom:"e", expr:"2.5" }]);
const { valeurs, erreurs } = evaluerParametres([{ nom:"l", expr:"L/2" }, { nom:"L", expr:"40" }, { nom:"a", expr:"b" }, { nom:"b", expr:"a" }]);
verifier("ordre libre", valeurs.get("l"), 20);
verifier("cycle signalé", Object.keys(erreurs).sort(), ["a", "b"]);

/* ---------------- esquisse et solveur ---------------- */
const { init_planegcs_module, GcsWrapper } = await import("../vendor/planegcs/index.js");
const mod = await init_planegcs_module({ locateFile:() => ici("../vendor/planegcs/planegcs_dist/planegcs.wasm") });
const gcs = new GcsWrapper(new mod.GcsSystem(), mod);
gcs.debug_mode = 0;     // le solveur bavarde sinon à chaque résolution

function rectangle(esq, x0, y0, x1, y1){
  const p = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => { const id = nouvelId(esq, "p"); esq.elements.push({ id, type:"point", x, y }); return id; });
  const l = p.map((a, i) => { const id = nouvelId(esq, "l"); esq.elements.push({ id, type:"ligne", p1:a, p2:p[(i + 1) % 4] }); return id; });
  esq.contraintes.push({ id:nouvelId(esq, "k"), type:"horizontal", a:l[0] }, { id:nouvelId(esq, "k"), type:"horizontal", a:l[2] },
                       { id:nouvelId(esq, "k"), type:"vertical", a:l[1] }, { id:nouvelId(esq, "k"), type:"vertical", a:l[3] });
  return { p, l };
}
const esq = nouvelleEsquisse("e1", "Esquisse", { base:"XY", decalage:"0" });
const r = rectangle(esq, 0, 0, 30, 18);
esq.contraintes.push({ id:"k90", type:"fixe", a:r.p[0], x:0, y:0 });
esq.contraintes.push({ id:"d1", type:"longueur", a:r.l[0], expr:"L" });
esq.contraintes.push({ id:"d2", type:"longueur", a:r.l[1], expr:"l" });
const c = nouvelId(esq, "p");
esq.elements.push({ id:c, type:"point", x:12, y:9 }, { id:"c1", type:"cercle", c, r:3 });
esq.contraintes.push({ id:"d3", type:"diametre", a:"c1", expr:"5" });
const v = (e) => evaluer(e, (n) => valeurs.get(n));
const res = resoudre(gcs, esq, v);
const P = (id) => esq.elements.find(e => e.id === id);
verifier("solveur : succès", res.ok, true);
verifier("cote L pilotée", P(r.p[1]).x, 40, 1e-6);
verifier("cote l pilotée", P(r.p[2]).y, 20, 1e-6);
verifier("diamètre", P("c1").r, 2.5, 1e-6);
/* Point fixé par une expression : il suit le paramètre. Rayon d'arc : déduit des points, même contredit par le fichier. */
{
  const e = nouvelleEsquisse("e9", "E", { base:"XY", decalage:"0" });
  const [q] = ajouterPrimitives(e, [{ type:"point", a:[1, 1] }]);
  e.contraintes.push({ id:"f", type:"fixe", a:q.id, x:"L/2", y:"l + 1" });
  verifier("fixe : expressions", [resoudre(gcs, e, v).ok, e.elements[0].x, e.elements[0].y], [true, 20, 21]);
  e.contraintes[0].x = "inconnu";
  const avecFaute = resoudre(gcs, e, (t) => evaluer(t, (n) => { if(!valeurs.has(n)) throw new Error("paramètre inconnu"); return valeurs.get(n); }));
  verifier("fixe : expression fausse signalée", Object.keys(avecFaute.erreurs), ["f"]);

  const a = nouvelleEsquisse("e8", "A", { base:"XY", decalage:"0" });
  const [arc] = ajouterPrimitives(a, [{ type:"arc", a:[5, 0], m:[0, 5], b:[-5, 0] }]);
  verifier("arc : pas de rayon enregistré", "r" in arc, false);
  arc.r = 999;              // un fichier d'avant, contredit par ses points
  verifier("arc : le rayon vient des points", [resoudre(gcs, a, v).ok, "r" in arc, rayonDe(indexer(a), arc)], [true, false, 5]);
  a.contraintes.push({ id:"r", type:"rayon", a:arc.id, expr:"8" });
  verifier("arc : la cote de rayon pilote les points", [resoudre(gcs, a, v).ok, +rayonDe(indexer(a), arc).toFixed(6)], [true, 8]);
  const [sp, tx] = ajouterPrimitives(a, [{ type:"spline", pts:[[0, 0], [5, 5], [10, 0]] }, { type:"texte", p:[1, 2], contenu:"T", h:3 }]);
  verifier("primitives : spline et texte", [sp.pts.length, sp.p2 === sp.pts[2], tx.contenu], [3, true, "T"]);
  leve("primitive inconnue refusée", () => ajouterPrimitives(a, [{ type:"carré" }]));
}
const pr = profils(esq);
verifier("une région avec un trou", [pr.regions.length, pr.regions[0].trous.length], [1, 1]);
verifier("contour de 4 segments", pr.regions[0].exterieur.segments.length, 4);

esq.contraintes.push({ id:"k99", type:"vertical", a:r.l[0] });     // contradictoire avec horizontal
verifier("conflit détecté", resoudre(gcs, esq, v).ok, false);
esq.contraintes.pop();
verifier("cote illisible signalée", Object.keys(resoudre(gcs, { ...esq, contraintes:[...esq.contraintes, { id:"dx", type:"longueur", a:r.l[0], expr:"inconnu" }] }, v).erreurs), ["dx"]);

const dxf = ["0", "SECTION", "2", "ENTITIES", "0", "LWPOLYLINE", "90", "4", "70", "1",
  "10", "0", "20", "0", "42", "0", "10", "10", "20", "0", "42", "1", "10", "10", "20", "10", "10", "0", "20", "10",
  "0", "CIRCLE", "10", "5", "20", "5", "40", "2", "0", "ENDSEC", "0", "EOF"].join("\n");
const ed = nouvelleEsquisse("e2", "DXF", { base:"XY" });
ajouterPrimitives(ed, lireDxf(dxf));
const pd = profils(ed);
verifier("DXF : polyligne fermée à renflement + cercle", [pd.regions.length, pd.regions[0].trous.length, ed.elements.filter(e => e.type === "arc").length], [1, 1, 1]);
verifier("plan XZ : y local = Z monde", repere({ base:"XZ" }).y, [0, 0, 1]);

/* ---------------- opérations sur le noyau ---------------- */
const { construire } = await import("../js/c3-operations.js");
const R = await import("../vendor/replicad/replicad.js");
const opencascade = (await import("../vendor/replicad/replicad_single.js")).default;
const oc = await opencascade({ locateFile:() => ici("../vendor/replicad/replicad_single.wasm") });
R.setOC(oc);
const silence = console.log;          // le noyau bavarde à l'export STEP
const doc = {
  parametres:[{ nom:"L", expr:"40" }, { nom:"l", expr:"20" }],
  operations:[
    esq,
    { id:"x1", type:"extrusion", esquisse:"e1", distance:"10", operation:"nouveau" },
    { id:"f1", type:"conge", corps:"", rayon:"2", aretes:[[20, 0, 10]] },   // > épaisseur de coque : un congé de 1 creusé de 1 dégénère
    { id:"s1", type:"coque", corps:"", epaisseur:"1", faces:[[30, 10, 0]] },
    { id:"m1", type:"miroir", corps:"", plan:"YZ", decalage:"0" },
    { id:"b1", type:"boite", L:"5", l:"5", h:"5", x:"100", y:"0", z:"0", operation:"nouveau" },
    { id:"r1", type:"repetition", corps:"Corps 2", mode:"lineaire", axe:"X", nombre:"3", pas:"10" },
    { id:"c1", type:"combiner", cible:"Corps 1", outils:["Corps 2"], operation:"joindre" },
    { id:"z1", type:"conge", corps:"", rayon:"1", aretes:[[500, 500, 500]] },
  ],
};
const cache = [];
let t = performance.now();
const res1 = await construire(R, doc, cache, oc);
const duree1 = performance.now() - t;
const erreursOps = Object.entries(res1.etats).filter(([, n]) => n.erreur).map(([id]) => id);
verifier("seule l'arête inexistante échoue", erreursOps, ["z1"]);
verifier("combiner : un seul corps", res1.corps.map(c => c.nom), ["Corps 1"]);
/* Plaque 40×20×10 creusée par le dessous (coque 1 mm), percée Ø5, symétrisée en X : deux fois le volume
   d'une plaque, plus trois cubes de 125 mm³. On vérifie l'ordre de grandeur, puis le cache. */
const vol = R.measureVolume(res1.corps[0].shape);
verifier("volume plausible", vol > 2 * (40 * 20 * 10 - 38 * 18 * 9) && vol < 2 * 40 * 20 * 10 + 375, true);
doc.operations[8] = { id:"z1", type:"deplacer", corps:"", tz:"5", rz:"90" };
t = performance.now();
const res2 = await construire(R, doc, cache, oc);
verifier("cache : la fin seule est refaite (plus rapide)", performance.now() - t < duree1, true);
verifier("déplacement et rotation", res2.etats.z1.erreur, undefined);
doc.parametres[0].expr = "50";
resoudre(gcs, esq, (e) => evaluer(e, (n) => evaluerParametres(doc.parametres).valeurs.get(n)));
const res3 = await construire(R, doc, cache, oc);
verifier("paramètre changé : reconstruit sans erreur", Object.values(res3.etats).filter(n => n.erreur).length, 0);
const bb = res3.corps[0].shape.boundingBox.bounds;
verifier("L = 50 : la plaque symétrisée (tournée de 90°) fait 100 mm de long", Math.max(bb[1][0] - bb[0][0], bb[1][1] - bb[0][1]) >= 100 - 1e-3, true);

const rev = await construire(R, { operations:[
  { id:"e", type:"esquisse", nom:"profil", plan:{ base:"XZ" }, compteur:0, contraintes:[],
    elements:[{ id:"p1", type:"point", x:10, y:0 }, { id:"p2", type:"point", x:15, y:0 }, { id:"p3", type:"point", x:15, y:4 }, { id:"p4", type:"point", x:10, y:4 },
              { id:"l1", type:"ligne", p1:"p1", p2:"p2" }, { id:"l2", type:"ligne", p1:"p2", p2:"p3" }, { id:"l3", type:"ligne", p1:"p3", p2:"p4" }, { id:"l4", type:"ligne", p1:"p4", p2:"p1" },
              { id:"q", type:"point", x:0, y:0 }, { id:"q2", type:"point", x:0, y:1, constr:true }, { id:"ax", type:"ligne", p1:"q", p2:"q2", constr:true }] },
  { id:"r", type:"revolution", esquisse:"e", axe:"ax", angle:"360" },
  { id:"e2", type:"esquisse", nom:"trous", plan:{ base:"XY", decalage:"4" }, compteur:0, contraintes:[], elements:[{ id:"t1", type:"point", x:12.5, y:0, seul:true }] },
  { id:"h", type:"percage", esquisse:"e2", diametre:"2", traversant:true, corps:"" },
] }, [], oc);
verifier("révolution autour d'une ligne de construction puis perçage", Object.values(rev.etats).filter(n => n.erreur).length, 0);
verifier("volume de l'anneau percé", R.measureVolume(rev.corps[0].shape), Math.PI * (15 ** 2 - 10 ** 2) * 4 - Math.PI * 1 * 4, 0.5);
console.log = () => {};
const step = R.exportSTEP([{ shape:rev.corps[0].shape, name:"anneau" }]);
console.log = silence;
verifier("export STEP", step.size > 1000, true);

/* ---------------- contours choisis, face suivie, jusqu'à une face, tirer ---------------- */
const esqLot1 = (id, plan, elements) => ({ id, type:"esquisse", nom:id, plan, contraintes:[], elements });
const rectEls = (x0, y0, x1, y1, pre = "") => [
  { id:pre + "p1", type:"point", x:x0, y:y0 }, { id:pre + "p2", type:"point", x:x1, y:y0 }, { id:pre + "p3", type:"point", x:x1, y:y1 }, { id:pre + "p4", type:"point", x:x0, y:y1 },
  { id:pre + "l1", type:"ligne", p1:pre + "p1", p2:pre + "p2" }, { id:pre + "l2", type:"ligne", p1:pre + "p2", p2:pre + "p3" }, { id:pre + "l3", type:"ligne", p1:pre + "p3", p2:pre + "p4" }, { id:pre + "l4", type:"ligne", p1:pre + "p4", p2:pre + "p1" }];
const anneau = esqLot1("a", { base:"XY" }, [...rectEls(-10, -10, 10, 10), { id:"cc", type:"point", x:0, y:0 }, { id:"c1", type:"cercle", c:"cc", r:5 }]);
const fa = profils(anneau).faces;
verifier("deux faces choisissables : plaque percée et disque", fa.map(f => f.profondeur).sort(), [0, 1]);
const disque = fa.find(f => f.profondeur === 1).cle, plaque = fa.find(f => f.profondeur === 0).cle;
const volExt = async (contours) => R.measureVolume((await construire(R, { operations:[anneau, { id:"x", type:"extrusion", esquisse:"a", distance:"10", contours }] }, [], oc)).corps[0].shape);
verifier("contours : par défaut la plaque percée", await volExt(undefined), (400 - Math.PI * 25) * 10, 0.5);
verifier("contours : le disque seul", await volExt([disque]), Math.PI * 25 * 10, 0.5);
verifier("contours : les deux, plaque pleine", await volExt([disque, plaque]), 4000, 0.5);
verifier("contour disparu signalé", (await construire(R, { operations:[anneau, { id:"x", type:"extrusion", esquisse:"a", distance:"10", contours:["zz"] }] }, [], oc)).etats.x.erreur?.includes("n'existe plus"), true);

const suivi = { parametres:[{ nom:"h", expr:"20" }], operations:[
  { id:"b", type:"boite", L:"40", l:"40", h:"h", centre:true },
  esqLot1("s", { origine:[5, 0, 20], normale:[0, 0, 1], xdir:[1, 0, 0], suivre:true }, rectEls(0, 0, 4, 4)),
  { id:"x", type:"extrusion", esquisse:"s", distance:"5", operation:"joindre", corps:"" },
] };
await construire(R, suivi, [], oc);
suivi.parametres[0].expr = "30";
const rs = await construire(R, suivi, [], oc);
verifier("l'esquisse suit sa face quand la hauteur change", [rs.etats.s.plan?.origine, Object.values(rs.etats).filter(n => n.erreur).length], [[5, 0, 30], 0]);
verifier("le bossage est monté avec la face", R.measureVolume(rs.corps[0].shape), 40 * 40 * 30 + 16 * 5, 0.5);

const jusqua = await construire(R, { operations:[
  { id:"b", type:"boite", L:"40", l:"40", h:"10", z:"20", centre:true },
  esqLot1("s", { base:"XY" }, rectEls(0, 0, 4, 4)),
  { id:"x", type:"extrusion", esquisse:"s", sens:"jusqua", distance:"1", faceLimite:{ point:[0, 0, 20], normale:[0, 0, -1] }, operation:"nouveau" },
] }, [], oc);
verifier("extrusion jusqu'à une face", [jusqua.etats.x.erreur, Math.round(R.measureVolume(jusqua.corps[1].shape))], [undefined, 16 * 20]);

const tire = async (d) => (await construire(R, { operations:[{ id:"b", type:"boite", L:"10", l:"10", h:"10" },
  { id:"t", type:"tirer", corps:"", distance:String(d), face:{ point:[5, 5, 10], normale:[0, 0, 1] } }] }, [], oc));
const t1 = await tire(5), t2 = await tire(-4);
verifier("tirer une face : ajoute", [t1.etats.t.erreur, Math.round(R.measureVolume(t1.corps[0].shape))], [undefined, 1500]);
verifier("tirer une face : enlève", [t2.etats.t.erreur, Math.round(R.measureVolume(t2.corps[0].shape))], [undefined, 600]);

/* ---------------- outils d'esquisse ---------------- */
const O = await import("../js/c2b-outils-esquisse.js");
const nouv = (id) => nouvelleEsquisse(id, id, { base:"XY" });
const croix = nouv("t");
ajouterPrimitives(croix, [{ type:"ligne", a:[0, 0], b:[10, 0] }, { type:"ligne", a:[4, -5], b:[4, 5] }, { type:"ligne", a:[7, -5], b:[7, 5] }]);
const hor = croix.elements.find(e => e.type === "ligne");
O.ajuster(croix, hor.id, { x:5.5, y:0 });     // le morceau entre les deux verticales
verifier("ajuster : la ligne coupée en deux morceaux", croix.elements.filter(e => e.type === "ligne").length, 4);
const yMorceaux = croix.elements.filter(e => e.type === "ligne").map(l => { const I = indexer(croix); return [I.get(l.p1).x, I.get(l.p2).x]; }).filter(([a, b]) => Math.abs(b - a) > 1 && Math.abs(a) + Math.abs(b) > 0 && a !== 4 && a !== 7 || a === 7 && b === 10 || a === 0 && b === 4);
verifier("ajuster : gardés 0→4 et 7→10", yMorceaux.map(m => m.map(x => +x.toFixed(6))).sort(), [[0, 4], [7, 10]]);
const rond = nouv("r");
ajouterPrimitives(rond, [{ type:"cercle", c:[0, 0], r:5 }, { type:"ligne", a:[-8, 0], b:[8, 0] }]);
O.ajuster(rond, rond.elements.find(e => e.type === "cercle").id, { x:0, y:5 });
verifier("ajuster : le cercle devient le demi-cercle du bas", rond.elements.some(e => e.type === "arc" && Math.abs(milieuArc(indexer(rond), e).y + 5) < 1e-6), true);

const carre = nouv("c");
ajouterPrimitives(carre, [{ type:"ligne", a:[0, 0], b:[10, 0] }, { type:"ligne", a:[10, 0], b:[10, 10] }, { type:"ligne", a:[10, 10], b:[0, 10] }, { type:"ligne", a:[0, 10], b:[0, 0] }]);
const nLignes = carre.elements.filter(e => e.type === "ligne").map(e => e.id);
O.decaler(carre, nLignes, 2);
verifier("décaler : un carré de 14 autour du carré de 10", profils(carre).faces.map(f => Math.round(f.aire)).sort((a, b) => a - b), [100, 196]);
const coin = nouv("k");
ajouterPrimitives(coin, [{ type:"ligne", a:[0, 0], b:[10, 0] }, { type:"ligne", a:[10, 0], b:[10, 10] }, { type:"ligne", a:[10, 10], b:[0, 10] }, { type:"ligne", a:[0, 10], b:[0, 0] }]);
const p00 = coin.elements.find(e => e.type === "point" && e.x === 0 && e.y === 0).id;
verifier("congé de coin accepté", O.casserCoin(coin, p00, 2, "conge"), null);
verifier("congé de coin : le solveur accepte", resoudre(gcs, coin, Number).ok, true);
verifier("congé de coin : aire réduite", profils(coin).faces[0].aire, 100 - (4 - Math.PI), 0.1);
const cham = nouv("h");
ajouterPrimitives(cham, [{ type:"ligne", a:[0, 0], b:[10, 0] }, { type:"ligne", a:[0, 10], b:[0, 0] }, { type:"ligne", a:[10, 0], b:[0, 10] }]);
O.casserCoin(cham, cham.elements.find(e => e.type === "point" && e.x === 0 && e.y === 0).id, 2, "chanfrein");
verifier("chanfrein de coin : aire réduite de 2", profils(cham).faces[0].aire, 50 - 2, 1e-6);
const mi = nouv("m");
ajouterPrimitives(mi, [{ type:"ligne", a:[0, -5], b:[0, 5] }, { type:"ligne", a:[0, 5], b:[5, 0] }, { type:"ligne", a:[5, 0], b:[0, -5] }]);
const ls = mi.elements.filter(e => e.type === "ligne").map(e => e.id);
const hexa = nouv("hx");
const pts6 = Array.from({ length:6 }, (_, i) => [10 * Math.cos(i * Math.PI / 3), 10 * Math.sin(i * Math.PI / 3)]);
ajouterPrimitives(hexa, pts6.map((a, i) => ({ type:"ligne", a, b:pts6[(i + 1) % 6] })));
const lh = hexa.elements.filter(e => e.type === "ligne");
for(let i = 1; i < 6; i++) hexa.contraintes.push({ id:nouvelId(hexa, "k"), type:"egal", a:lh[0].id, b:lh[i].id });
O.casserCoin(hexa, lh[0].p2, 2, "conge");
verifier("congé dans un polygone à côtés égaux : le solveur accepte", resoudre(gcs, hexa, Number).ok, true);
verifier("miroir accepté", O.miroir(mi, ls.slice(1), ls[0]), null);
verifier("miroir : solveur et points partagés", [resoudre(gcs, mi, Number).ok, mi.elements.filter(e => e.type === "point").length], [true, 4]);
const rp = nouv("rp");
ajouterPrimitives(rp, [{ type:"cercle", c:[0, 0], r:1 }]);
const idsRp = rp.elements.map(e => e.id);
O.repetitionRect(rp, idsRp, 3, 2, 10, 10);
verifier("répétition rectangulaire : 6 cercles", rp.elements.filter(e => e.type === "cercle").length, 6);
const rc = nouv("rc");
ajouterPrimitives(rc, [{ type:"cercle", c:[10, 0], r:1 }]);
O.repetitionCirc(rc, rc.elements.map(e => e.id), 4, 360, 0, 0);
const cc = rc.elements.filter(e => e.type === "point").map(p => [Math.round(p.x), Math.round(p.y)]).sort();
verifier("répétition circulaire : 4 centres à 90°", cc.map(String), ["-10,0", "0,-10", "0,10", "10,0"]);

const spl = nouv("sp");
spl.elements.push({ id:"a", type:"point", x:0, y:0 }, { id:"b", type:"point", x:10, y:5 }, { id:"z", type:"point", x:20, y:0 },
  { id:"s1", type:"spline", pts:["a", "b", "z"], p1:"a", p2:"z" }, { id:"l", type:"ligne", p1:"z", p2:"a" });
verifier("spline : contour fermé avec une ligne", profils(spl).regions.length, 1);
const rsp = await construire(R, { operations:[spl, { id:"x", type:"extrusion", esquisse:"sp", distance:"5" }] }, [], oc);
verifier("spline : le volume vaut l'aire du contour × 5", [rsp.etats.x.erreur, Math.abs(R.measureVolume(rsp.corps[0].shape) / (profils(spl).faces[0].aire * 5) - 1) < 0.01], [undefined, true]);
verifier("spline : le solveur l'ignore sans erreur", resoudre(gcs, spl, Number).ok, true);
const { readFileSync } = await import("node:fs");
const buf = readFileSync(ici("../vendor/polices/DejaVuSans.ttf"));
await R.loadFont(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const tx = nouv("tx");
tx.elements.push({ id:"p", type:"point", x:0, y:0 }, { id:"m", type:"texte", p:"p", contenu:"Pi", h:10 });
const rtx = await construire(R, { operations:[tx, { id:"x", type:"extrusion", esquisse:"tx", distance:"1" }] }, [], oc);
verifier("texte : extrusion", [rtx.etats.x.erreur, R.measureVolume(rtx.corps[0].shape) > 5], [undefined, true]);
tx.elements[0].x = 30; tx.elements[0].y = 40;
const btx = (await construire(R, { operations:[tx, { id:"x", type:"extrusion", esquisse:"tx", distance:"1" }] }, [], oc)).corps[0].shape.boundingBox.bounds;
verifier("texte : posé à son point d'ancrage", [btx[0][0] > 30 && btx[0][0] < 32, btx[0][1] > 39.9 && btx[0][1] < 41], [true, true]);

/* ---------------- opérations du lot modèle ---------------- */
const { planConstruction } = await import("../js/c2-esquisse.js");
const pc = planConstruction({ base:"XY", decalage:"10", angle:"90", axe:"x" }, Number);
verifier("plan incliné à 90° autour de x : la normale passe en -Y", [pc.origine, pc.normale.map(c => +c.toFixed(9) + 0)], [[0, 0, 10], [0, -1, 0]]);
const volume = async (ops, id) => {
  const r = await construire(R, { operations:ops }, [], oc);
  return { erreur:r.etats[id]?.erreur, corps:r.corps.length, vols:r.corps.map(c => R.measureVolume(c.shape)), bb:r.corps[0]?.shape.boundingBox.bounds };
};
const boite20 = { id:"b", type:"boite", L:"20", l:"20", h:"20" };
const dep = await volume([boite20, { id:"d", type:"depouille", corps:"", angle:"5", plan:"XY", decalage:"0", faces:[[0, 10, 10]] }], "d");
verifier("dépouille : le volume change", [dep.erreur, Math.abs(dep.vols[0] - 8000) > 50], [undefined, true]);
const ligne = (id, a, b) => esqLot1(id, { base:"XY" }, [{ id:"p1", type:"point", x:a[0], y:a[1] }, { id:"p2", type:"point", x:b[0], y:b[1] }, { id:"l", type:"ligne", p1:"p1", p2:"p2" }]);
const ner = await volume([boite20, ligne("n", [0, 10], [40, 10]), { id:"r", type:"nervure", esquisse:"n", epaisseur:"2", distance:"5", corps:"" }], "r");
/* x de −1 à 41 (une demi-épaisseur en plus à chaque bout) : 22 mm hors de la boîte, sur 2 × 5. */
verifier("nervure : un seul corps, volume de la partie hors de la boîte", [ner.erreur, ner.corps, Math.round(ner.vols[0])], [undefined, 1, 8000 + 22 * 2 * 5]);
const chem = esqLot1("c", { base:"XZ" }, [{ id:"p1", type:"point", x:0, y:0 }, { id:"p2", type:"point", x:0, y:30 }, { id:"l", type:"ligne", p1:"p1", p2:"p2" }]);
const tuy = await volume([chem, { id:"t", type:"tuyau", chemin:"c", diametre:"10", paroi:"2", operation:"nouveau" }], "t");
verifier("tuyau : tube droit creux", [tuy.erreur, Math.abs(tuy.vols[0] - Math.PI * (25 - 9) * 30) < 2], [undefined, true]);
const ress = await volume([{ id:"s", type:"ressort", diametre:"20", fil:"2", pas:"5", tours:"3", operation:"nouveau" }], "s");
verifier("ressort : volume proche de fil × longueur d'hélice", [ress.erreur, Math.abs(ress.vols[0] / (Math.PI * 1 * 3 * Math.hypot(Math.PI * 20, 5)) - 1) < 0.1], [undefined, true]);
const gr = await volume([boite20, esqLot1("e", { base:"XY", decalage:"20" }, rectEls(5, 5, 10, 10)), { id:"g", type:"gravure", esquisse:"e", profondeur:"1", mode:"creux", corps:"" }], "g");
verifier("gravure en creux", [gr.erreur, Math.round(gr.vols[0])], [undefined, 8000 - 25]);
const gr2 = await volume([boite20, esqLot1("e", { base:"XY", decalage:"20" }, rectEls(5, 5, 10, 10)), { id:"g", type:"gravure", esquisse:"e", profondeur:"1", mode:"relief", corps:"" }], "g");
verifier("gravure en relief", [gr2.erreur, Math.round(gr2.vols[0])], [undefined, 8000 + 25]);
const dec = await volume([boite20, { id:"k", type:"decouper", corps:"", plan:"XY", decalage:"5" }], "k");
verifier("découpe : deux corps de 2000 et 6000", [dec.erreur, dec.vols.map(Math.round)], [undefined, [2000, 6000]]);
const ech = await volume([boite20, { id:"e", type:"echelle", corps:"", facteur:"2" }], "e");
verifier("échelle ×2 : huit fois le volume", [ech.erreur, Math.round(ech.vols[0])], [undefined, 64000]);

/* ---------------- noms de corps stables ---------------- */
const nomsDoc = { operations:[{ id:"a", type:"boite", L:"5", l:"5", h:"5" }, { id:"b", type:"boite", L:"5", l:"5", h:"5", x:"20" }, { id:"c", type:"conge", corps:"Corps 2", rayon:"1", toutes:true }] };
const c1 = [];
const rn1 = await construire(R, nomsDoc, c1, oc);
verifier("corps : noms donnés à la création", [nomsDoc.operations[0].corpsNom, nomsDoc.operations[1].corpsNom, rn1.etats.b.corpsNom], ["Corps 1", "Corps 2", "Corps 2"]);
nomsDoc.operations.shift();
const rn2 = await construire(R, nomsDoc, [], oc);
verifier("corps : supprimer le premier ne fait pas viser un autre corps", [rn2.corps.map(c => c.nom), rn2.etats.c.erreur], [["Corps 2"], undefined]);
const repSep = await construire(R, { operations:[{ id:"a", type:"boite", L:"5", l:"5", h:"5" }, { id:"r", type:"repetition", corps:"", axe:"X", nombre:"3", pas:"10", separe:true }] }, [], oc);
verifier("corps : plusieurs corps créés par une opération", repSep.corps.map(c => c.nom), ["Corps 1", "Corps 2", "Corps 2 · 2"]);
const { deplacementRefuse:refus } = await import("../js/c7-frise.js");
verifier("frise : une opération ne passe pas avant le corps qu'elle vise", typeof refus([{ id:"a", nom:"A", corpsNom:"Corps 1" }, { id:"c", nom:"C", corps:"Corps 1" }], 1, 0), "string");

/* ---------------- ateliers : surface, assemblage, tôlerie, soudures, visserie ---------------- */
{
const { axeConstruction } = await import("../js/c2-esquisse.js");
const { ecrireDxf } = await import("../js/c3b-ateliers.js");
const aire = (c) => c ? R.measureArea(c.shape) : NaN;
const fil = (id, plan, a, b) => esqLot1(id, plan, [{ id:"p1", type:"point", x:a[0], y:a[1] }, { id:"p2", type:"point", x:b[0], y:b[1] }, { id:"l", type:"ligne", p1:"p1", p2:"p2" }]);
const oss0 = () => esqLot1("o", { base:"XY" }, [{ id:"a", type:"point", x:0, y:0 }, { id:"b", type:"point", x:100, y:0 }, { id:"l1", type:"ligne", p1:"a", p2:"b" }]);
const atel = async (ops, id) => {
  const r = await construire(R, { operations:ops }, [], oc);
  /* Corps absent : un faux corps vide, pour que l'échec sorte par verifier() et pas par un plantage du banc. */
  const vide = { shape:R.makeBox([0, 0, 0], [1e-3, 1e-3, 1e-3]) };
  return { erreur:r.etats[id]?.erreur, noms:r.corps.map(c => c.nom), c:[...r.corps, vide, vide], note:r.etats[id] };
};
const sx = await atel([fil("e", { base:"XY" }, [0, 0], [10, 0]), { id:"s", type:"surfExtrusion", esquisse:"e", distance:"5" }], "s");
verifier("surface extrudée : aire d'un ruban", [sx.erreur, Math.round(aire(sx.c[0])), !!sx.c[0].surface], [undefined, 50, true]);
const sr = await atel([fil("e", { base:"XY" }, [5, 0], [5, 10]), { id:"s", type:"surfRevolution", esquisse:"e", axe:"y", angle:"360" }], "s");
verifier("surface de révolution : un cylindre sans fonds", [sr.erreur, Math.abs(aire(sr.c[0]) - 2 * Math.PI * 5 * 10) < 0.5], [undefined, true]);
const sl = await atel([esqLot1("a", { base:"XY" }, rectEls(0, 0, 10, 10)), esqLot1("b", { base:"XY", decalage:"10" }, rectEls(0, 0, 10, 10)), { id:"s", type:"surfLissage", esquisses:["a", "b"], regle:true }], "s");
verifier("surface lissée : quatre côtés, sans volume", [sl.erreur, Math.round(aire(sl.c[0]))], [undefined, 400]);
const sf = await atel([esqLot1("a", { base:"XY" }, rectEls(0, 0, 10, 10)), { id:"s", type:"surfRemplissage", esquisse:"a" }], "s");
verifier("remplissage plan", [sf.erreur, Math.round(aire(sf.c[0]))], [undefined, 100]);
const se = await atel([esqLot1("a", { base:"XY" }, rectEls(0, 0, 10, 10)), { id:"s", type:"surfRemplissage", esquisse:"a" }, { id:"t", type:"surfEpaissir", corps:"", epaisseur:"2" }], "t");
verifier("épaissir : un volume, positif", [se.erreur, Math.round(R.measureVolume(se.c[0].shape)), se.c[0].surface], [undefined, 200, false]);
const sa = await atel([fil("e", { base:"XY" }, [0, 0], [10, 0]), { id:"s", type:"surfExtrusion", esquisse:"e", distance:"10" }, { id:"b", type:"boite", L:"5", l:"5", h:"20", x:"0", y:"-2", z:"-2" }, { id:"t", type:"surfAjuster", corps:"Corps 1", outil:"Corps 2" }], "t");
verifier("ajuster une surface par un volume", [sa.erreur, Math.round(aire(sa.c[0]))], [undefined, 50]);
const sp = await atel([fil("e", { base:"XY" }, [0, 0], [10, 0]), { id:"s", type:"surfExtrusion", esquisse:"e", distance:"10" }, { id:"t", type:"surfProlonger", corps:"", distance:"5", aretes:[[10, 0, 5]] }], "t");
verifier("prolonger une surface", [sp.erreur, Math.round(aire(sp.c[0]))], [undefined, 150]);
const fs5 = await atel([fil("e", { base:"XY" }, [5, 0], [5, 10]), { id:"r", type:"surfRevolution", esquisse:"e", axe:"y", angle:"360" }, { id:"d", type:"surfDecaler", corps:"", distance:"1" }], "d");
verifier("décaler une surface : un cylindre de rayon 4 ou 6", [fs5.erreur, fs5.noms.length, [Math.round(2 * Math.PI * 40), Math.round(2 * Math.PI * 60)].includes(Math.round(aire(fs5.c[1])))], [undefined, 2, true]);

const sous = JSON.stringify({ operations:[{ id:"b", type:"boite", L:"10", l:"10", h:"10" }] });
const co = await atel([{ id:"c", type:"composant", donnees:sous, tx:"100" }], "c");
verifier("composant : une pièce insérée et placée", [co.erreur, Math.round(R.measureVolume(co.c[0].shape)), Math.round(co.c[0].shape.boundingBox.bounds[0][0])], [undefined, 1000, 100]);
const axeZ = (p) => ({ type:"cylindre", point:p, axe:[0, 0, 1] });
const lie = (extra) => atel([{ id:"a", type:"cylindre", diametre:"10", h:"5" }, { id:"b", type:"boite", L:"10", l:"2", h:"2", x:"50", y:"50", z:"0", operation:"nouveau" },
  { id:"l", type:"liaison", corpsA:"Corps 1", corpsB:"Corps 2", repereA:axeZ([0, 0, 0]), repereB:axeZ([50, 50, 0]), ...extra }], "l");
const lg = await lie({ mode:"glissiere", valeur:"7" });
const bg = lg.c[1].shape.boundingBox.bounds;
verifier("glissière : le mobile rejoint l'axe et monte de 7", [lg.erreur, bg[0].map(Math.round)], [undefined, [0, 0, 7]]);
const lp = await lie({ mode:"pivot", valeur:"90" });
const bp = lp.c[1].shape.boundingBox.bounds;
verifier("pivot : le mobile tourne de 90° autour de l'axe", [lp.erreur, bp[1].map(Math.round)], [undefined, [0, 10, 2]]);
const lr = await atel([{ id:"a", type:"boite", L:"10", l:"10", h:"10" }, { id:"b", type:"boite", L:"4", l:"4", h:"4", x:"50", z:"50", operation:"nouveau" },
  { id:"l", type:"liaison", mode:"rigide", corpsA:"Corps 1", corpsB:"Corps 2", decalage:"1", repereA:{ type:"plan", point:[5, 5, 10], normale:[0, 0, 1] }, repereB:{ type:"plan", point:[52, 2, 50], normale:[0, 0, -1] } }], "l");
verifier("liaison plane : plaquée avec un jeu de 1", [lr.erreur, Math.round(lr.c[1].shape.boundingBox.bounds[0][2])], [undefined, 11]);
const la = await atel([{ id:"a", type:"cylindre", diametre:"10", h:"5" }, { id:"b", type:"boite", L:"2", l:"2", h:"2", x:"50", operation:"nouveau" }, { id:"n", type:"ancrer", corps:"Corps 2" },
  { id:"l", type:"liaison", corpsA:"Corps 1", corpsB:"Corps 2", repereA:axeZ([0, 0, 0]), repereB:axeZ([50, 0, 0]) }], "l");
verifier("un corps ancré ne bouge pas", la.erreur?.includes("ancré"), true);

const tole = (extra = []) => [esqLot1("t", { base:"XY" }, rectEls(0, 0, 100, 50)), { id:"tb", type:"tole", esquisse:"t", epaisseur:"2", rayon:"3", k:"0.4" }, ...extra];
const tb = await atel(tole(), "tb");
verifier("tôle : une plaque", [tb.erreur, Math.round(R.measureVolume(tb.c[0].shape))], [undefined, 10000]);
const brA = { id:"br", type:"bride", corps:"", arete:[100, 25, 2], angle:"90", hauteur:"20", rayon:"3" };
const br = await atel(tole([brA]), "br");
/* Volume : plaque + couronne (θ/2·(5²−3²)·50) + bord (20×2×50). */
verifier("bord tombé : volume exact", [br.erreur, Math.abs(R.measureVolume(br.c[0].shape) - (10000 + Math.PI / 4 * 16 * 50 + 2000)) < 2], [undefined, true]);
const bb0 = br.c[0].shape.boundingBox.bounds;
verifier("bord tombé : plié vers le haut, à l'extérieur", [Math.round(bb0[1][0]), Math.round(bb0[1][2])], [105, 25]);
const brPlat = await construire(R, { operations:tole([brA]) }, [], oc, { plat:true });
const baAtt = Math.PI / 2 * (3 + 0.4 * 2);
verifier("développé : longueur dépliée", [brPlat.etats.br.erreur, +(brPlat.corps[0].shape.boundingBox.bounds[1][0] - 100).toFixed(3)], [undefined, +(baAtt + 20).toFixed(3)]);
verifier("table de pliage : angle et déduction", [brPlat.etats.br.pli.angle, +brPlat.etats.br.pli.ba.toFixed(4)], [90, +baAtt.toFixed(4)]);
const ou = await atel(tole([{ ...brA, id:"ou", type:"ourlet", hauteur:"10" }]), "ou");
verifier("ourlet : replié à 180°", [ou.erreur, Math.round(ou.c[0].shape.boundingBox.bounds[1][2])], [undefined, 10]);
const pl0 = await atel([esqLot1("t", { base:"XY" }, rectEls(0, 0, 100, 50)), { id:"tb", type:"tole", esquisse:"t", epaisseur:"2", rayon:"3", k:"0.4" }, fil("lp", { base:"XY" }, [50, 0], [50, 50]),
  { id:"p", type:"pli", corps:"", esquisse:"lp", angle:"90" }], "p");
/* Le volume plié conserve la matière de la fibre neutre : plaque moins zone dépliée, plus couronne. */
const baP = Math.PI / 2 * 3.8;
verifier("pli : la tôle se plie à 90°", [pl0.erreur, Math.abs(R.measureVolume(pl0.c[0].shape) - ((100 - baP) * 50 * 2 + Math.PI / 4 * 16 * 50)) < 3], [undefined, true]);
verifier("DXF d'un développé", ecrireDxf([[[0, 0], [1, 0]]], [[[0, 1], [1, 1]]]).match(/LINE/g).length, 2);

/* Canal en U : deux plis, aucun ne doit tronquer l'aile de l'autre. Volume : plaque dépliée − 2 zones + 2 couronnes. */
const pliX = (x, inverse = false) => [fil("l" + x, { base:"XY" }, [x, 0], [x, 50]), { id:"p" + x, type:"pli", corps:"", esquisse:"l" + x, angle:"90", inverse }];
const canal = await atel([...tole().slice(0, 2), ...pliX(30, true), ...pliX(70)], "p70");
verifier("pli : canal en U, l'aile du premier pli reste entière", [canal.erreur, Math.abs(R.measureVolume(canal.c[0].shape) - ((100 - 2 * baP) * 100 + 2 * Math.PI / 4 * 16 * 50)) < 5], [undefined, true]);
const pl2 = await atel([...tole().slice(0, 2), fil("lp", { base:"XY" }, [50, 10], [50, 20]), { id:"p", type:"pli", corps:"", esquisse:"lp", angle:"90" }], "p");
verifier("pli : la longueur est celle de la tôle, pas de la ligne", pl2.note.pli.longueur, 50, 1e-6);
const hors = await atel([...tole().slice(0, 2), fil("lp", { base:"XY" }, [200, 0], [200, 50]), { id:"p", type:"pli", corps:"", esquisse:"lp", angle:"90" }], "p");
verifier("pli : une ligne hors de la tôle est refusée", typeof hors.erreur, "string");
const bordAile = await atel(tole([brA, { id:"b2", type:"bride", corps:"", arete:[105, 25, 25], angle:"90", hauteur:"10" }]), "b2");
verifier("bord tombé : refusé depuis une aile déjà pliée", typeof bordAile.erreur, "string");
/* Une encoche : l'arête est au flanc gauche, l'extérieur est vers la droite, donc vers le centre de la boîte. */
const enc = esqLot1("t", { base:"XY" }, [[0, 0], [100, 0], [100, 50], [70, 50], [70, 20], [40, 20], [40, 50], [0, 50]].map(([x, y], i) => ({ id:"p" + i, type:"point", x, y })).concat(
  [0, 1, 2, 3, 4, 5, 6, 7].map(i => ({ id:"l" + i, type:"ligne", p1:"p" + i, p2:"p" + ((i + 1) % 8) }))));
const brEnc = await atel([enc, { id:"tb", type:"tole", esquisse:"t", epaisseur:"2", rayon:"3", k:"0.4" }, { id:"br", type:"bride", corps:"", arete:[40, 35, 2], angle:"90", hauteur:"10" }], "br");
const plaqueEnc = (100 * 50 - 30 * 30) * 2;
verifier("bord tombé : dans une encoche, l'aile part hors de la matière", [brEnc.erreur, Math.abs(R.measureVolume(brEnc.c[0].shape) - (plaqueEnc + Math.PI / 4 * 16 * 30 + 10 * 2 * 30)) < 3], [undefined, true]);
/* Une seconde aile : le corps est alors un composé, la sonde de l'extérieur doit le voir aussi. */
const deuxBr = await atel(tole([brA, { id:"b2", type:"bride", corps:"", arete:[0, 25, 2], angle:"90", hauteur:"20" }]), "b2");
const bd = deuxBr.c[0].shape.boundingBox.bounds;
verifier("seconde aile : vers l'extérieur aussi", [deuxBr.erreur, Math.round(bd[0][0]), Math.round(bd[1][0])], [undefined, -5, 105]);
/* Filetage modélisé : un sillon réel, sur un petit M4 extérieur et un M4 intérieur (la tranche se calcule une fois). */
const fext = await atel([{ id:"c", type:"cylindre", diametre:"4", h:"7" },
  { id:"t", type:"filetage", corps:"", modele:true, jeu:"0", cylindre:{ axe:[0, 0, 1], surf:[2, 0, 3.5] } }], "t");
const ext0 = Math.PI * 4 * 7, extV = R.measureVolume(fext.c[0].shape), ext1 = 0.6134 * 0.7;
verifier("filetage M4 extérieur : un solide, sillon retiré", [fext.erreur, fext.c[0].shape.solids?.length, extV < ext0 - 2 && extV > Math.PI * (2 - ext1) ** 2 * 7], [undefined, 1, true]);
const fint = await atel([{ id:"b", type:"boite", L:"20", l:"20", h:"7", x:"-10", y:"-10" }, { id:"c", type:"cylindre", diametre:"3.3", h:"7", operation:"enlever", corps:"" },
  { id:"t", type:"filetage", corps:"", modele:true, jeu:"0.1", cylindre:{ axe:[0, 0, 1], surf:[1.65, 0, 3.5] } }], "t");
const int0 = 20 * 20 * 7 - Math.PI * 1.65 ** 2 * 7;
verifier("filetage M4 intérieur : le trou s'élargit dans la matière", [fint.erreur, fint.c[0].shape.solids?.length, R.measureVolume(fint.c[0].shape) < int0 - 2], [undefined, 1, true]);
/* Un cercle d'esquisse extrudé : deux demi-cylindres, dont le centre n'est pas sur l'axe. Le sillon doit rester autour de l'axe. */
const cx = esqLot1("c", { base:"XY" }, [{ id:"o", type:"point", x:30, y:0 }, { id:"k", type:"cercle", c:"o", r:2 }]);
const fDemi = await atel([cx, { id:"x", type:"extrusion", esquisse:"c", distance:"7" }, { id:"t", type:"filetage", corps:"", modele:true, jeu:"0", cylindre:{ axe:[0, 0, 1], surf:[32, 0, 3.5] } }], "t");
const bDemi = fDemi.c[0].shape.boundingBox.bounds;
verifier("filetage sur un cercle extrudé : centré, de ⌀4", [fDemi.erreur, Math.abs(bDemi[0][0] - 28) < 0.05, Math.abs(bDemi[1][0] - 32) < 0.05, R.measureVolume(fDemi.c[0].shape) < Math.PI * 4 * 7 - 2], [undefined, true, true, true]);
/* Une pièce tournée : le filet suit l'axe réel, pas celui de la désignation. */
const fTour = await atel([{ id:"c", type:"cylindre", diametre:"4", h:"7" }, { id:"d", type:"deplacer", corps:"", ry:"90", tx:"0", ty:"0", tz:"0" },
  { id:"t", type:"filetage", corps:"", modele:true, jeu:"0", taille:"M4", cylindre:{ axe:[0, 0, 1], surf:[0, 2, 3.5] } }], "t");
verifier("filetage : la pièce a tourné, le sillon la parcourt", [fTour.erreur, R.measureVolume(fTour.c[0].shape) < Math.PI * 4 * 7 - 2], [undefined, true]);
const fko = await atel([{ id:"c", type:"cylindre", diametre:"30", h:"7" }, { id:"t", type:"filetage", corps:"", modele:true, taille:"M4", cylindre:{ axe:[0, 0, 1], surf:[15, 0, 3.5] } }], "t");
verifier("filetage : refusé sur un cylindre d'un autre diamètre", fko.erreur?.includes("ne convient pas"), true);
const sousNom = JSON.stringify({ format:"web3d-conception", operations:[{ id:"b", type:"boite", L:"5", l:"5", h:"5", corpsNom:"Plaque" }] });
const cn = await atel([{ id:"c", type:"composant", donnees:sousNom }], "c");
verifier("composant : son corps ne prend pas le nom d'un corps de la sous-pièce", cn.noms, ["Corps 1"]);
const sousKo = JSON.stringify({ format:"web3d-conception", operations:[{ id:"b", type:"boite", L:"5", l:"5", h:"5" }, { id:"f", type:"conge", nom:"Congé", rayon:"50", toutes:true }] });
const ck = await atel([{ id:"c", type:"composant", donnees:sousKo }], "c");
verifier("composant : une sous-pièce incomplète est signalée", [ck.noms, ck.erreur?.includes("incomplète")], [["Corps 1"], true]);
const ouvert = new Float32Array([0, 0, 0, 0, 10, 0, 10, 0, 0, 0, 0, 0, 10, 0, 0, 0, 0, 10, 10, 0, 0, 0, 10, 0, 0, 0, 10]);
const mo = await atel([{ id:"m", type:"maillage", donnees:Buffer.from(ouvert.buffer).toString("base64") }], "m");
verifier("maillage ouvert : une surface, pas un volume", [mo.erreur, mo.c[0].surface], [undefined, true]);
const troppe = await atel([oss0(), { id:"f", type:"profile", esquisse:"o", section:"carre", a:"10", b:"10", ep:"6", joint:"droit" }], "f");
verifier("profilé : paroi trop épaisse refusée clairement", troppe.erreur?.includes("paroi"), true);

const oss = esqLot1("o", { base:"XY" }, [{ id:"a", type:"point", x:0, y:0 }, { id:"b", type:"point", x:100, y:0 }, { id:"c", type:"point", x:100, y:50 }, { id:"l1", type:"ligne", p1:"a", p2:"b" }, { id:"l2", type:"ligne", p1:"b", p2:"c" }]);
const prf = await atel([oss, { id:"f", type:"profile", esquisse:"o", section:"carre", a:"10", b:"10", ep:"0", joint:"droit" }], "f");
verifier("profilés : une barre par ligne, liste de débit", [prf.erreur, prf.noms.length, prf.note.debit.map(d => d.longueur)], [undefined, 2, [100, 50]]);
verifier("profilé plein : volume de la barre", Math.round(R.measureVolume(prf.c[0].shape)), 10000);
const po = await atel([oss, { id:"f", type:"profile", esquisse:"o", section:"carre", a:"10", b:"10", ep:"0", joint:"onglet", fusion:true }], "f");
verifier("profilés en onglet, joints", [po.erreur, po.noms.length, Math.abs(R.measureVolume(po.c[0].shape) - 15000) < 5], [undefined, 1, true]);
const pc = await atel([oss, { id:"f", type:"profile", esquisse:"o", section:"rond", a:"10", ep:"2", joint:"droit" }], "f");
verifier("tube rond creux", [pc.erreur, Math.abs(R.measureVolume(pc.c[0].shape) - Math.PI * (25 - 9) * 100) < 3], [undefined, true]);
const vm = await atel([{ id:"v", type:"vis", norme:"M6", modele:"chc", longueur:"20" }], "v");
const bvm = vm.c[0].shape.boundingBox.bounds;
verifier("vis CHC M6×20 : longueur sous tête et tête", [vm.erreur, Math.round(bvm[0][2]), Math.round(bvm[1][2]), Math.round(bvm[1][0] - bvm[0][0])], [undefined, -20, 6, 10]);
for(const modele of ["hexa", "ecrou", "rondelle"]){
  const x = await atel([{ id:"v", type:"vis", norme:"M4", modele, longueur:"10" }], "v");
  verifier("visserie " + modele, [x.erreur, R.measureVolume(x.c[0].shape) > 1], [undefined, true]);
}
const tetra = new Float32Array([0, 0, 0, 0, 10, 0, 10, 0, 0, 0, 0, 0, 10, 0, 0, 0, 0, 10, 10, 0, 0, 0, 10, 0, 0, 0, 10, 0, 0, 0, 0, 0, 10, 0, 10, 0]);
const b64 = Buffer.from(tetra.buffer).toString("base64");
const ma = await atel([{ id:"m", type:"maillage", donnees:b64 }], "m");
verifier("maillage fermé : un solide", [ma.erreur, Math.abs(Math.abs(R.measureVolume(ma.c[0].shape)) - 1000 / 6) < 1], [undefined, true]);
verifier("axe par deux points", axeConstruction({ x1:"0", y1:"0", z1:"0", x2:"0", y2:"0", z2:"5" }, Number).dir, [0, 0, 1]);
verifier("axe confondu refusé", (() => { try{ axeConstruction({}, Number); return false; }catch(_){ return true; } })(), true);
const p3 = planConstruction({ mode:"trois", x1:"0", y1:"0", z1:"5", x2:"1", y2:"0", z2:"5", x3:"0", y3:"1", z3:"5" }, Number);
verifier("plan par trois points", [p3.origine, p3.normale], [[0, 0, 5], [0, 0, 1]]);
verifier("plan médian", planConstruction({ mode:"median", base:"XY", decalage:"2", decalage2:"8" }, Number).origine, [0, 0, 5]);
const rvAxe = await atel([esqLot1("e", { base:"XZ" }, rectEls(10, 0, 15, 4)), { id:"ax", type:"axe", x1:"0", y1:"0", z1:"0", x2:"0", y2:"0", z2:"1" }, { id:"r", type:"revolution", esquisse:"e", axe:"ref:ax", angle:"360" }], "r");
verifier("révolution autour d'un axe de construction", [rvAxe.erreur, Math.abs(R.measureVolume(rvAxe.c[0].shape) - Math.PI * (225 - 100) * 4) < 1], [undefined, true]);

}

/* ---------------- frise : réordonner, dossiers ---------------- */
const { deplacementRefuse, deplacer, creerDossier, normaliserDossiers } = await import("../js/c7-frise.js");
const fr = { operations:[{ id:"e", nom:"E", type:"esquisse" }, { id:"x", nom:"X", type:"extrusion", esquisse:"e" },
  { id:"b", nom:"B", type:"boite" }, { id:"f", nom:"F", type:"conge" }], dossiers:[] };
verifier("frise : l'extrusion ne passe pas avant son esquisse", typeof deplacementRefuse(fr.operations, 1, 0), "string");
verifier("frise : l'esquisse ne passe pas après son extrusion", typeof deplacementRefuse(fr.operations, 0, 2), "string");
verifier("frise : une boîte peut passer devant", deplacementRefuse(fr.operations, 2, 0), null);
verifier("dossier : opérations non contiguës refusées", typeof creerDossier(fr, ["e", "b"], "D"), "string");
verifier("dossier : opérations contiguës acceptées", creerDossier(fr, ["b", "x"], "D"), null);
verifier("dossier : membres dans l'ordre de l'historique", fr.dossiers[0].ops, ["x", "b"]);
deplacer(fr, 2, 0);                                    // la boîte sort par la gauche : le dossier ne garde que X
verifier("dossier : un membre déplacé ailleurs en sort", [fr.operations.map(o => o.id), fr.dossiers[0].ops], [["b", "e", "x", "f"], ["x"]]);
const { retirerDuDossier } = await import("../js/c7-frise.js");
const fd = { operations:["a", "b", "c"].map(id => ({ id, nom:id, type:"boite" })), dossiers:[{ id:"d1", nom:"D", ops:["a", "b", "c"] }] };
retirerDuDossier(fd, "d1", "b");
verifier("dossier : retirer le membre du milieu coupe le dossier en deux", fd.dossiers.map(d => d.ops), [["a"], ["c"]]);
fr.operations = fr.operations.filter(o => o.id !== "x"); normaliserDossiers(fr);
verifier("dossier vide supprimé", fr.dossiers.length, 0);

export { verifier, ok, ko, gcs };
if(process.argv[1] === fileURLToPath(import.meta.url)){
  console.log(ko ? `banc-conception : ${ko} échec(s), ${ok} OK` : `banc-conception : OK (${ok} vérifications)`);
  process.exit(ko ? 1 : 0);
}
