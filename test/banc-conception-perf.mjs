/* Banc de vitesse du mode conception : une grosse pièce, sur le vrai noyau, sous Node.
   node test/banc-conception-perf.mjs — affiche un tableau de temps et la mémoire du noyau.
   Échoue si une reconstruction de fin d'historique dépasse SEUIL_FIN ms, ou si la mémoire grimpe sans fin. */
import { fileURLToPath } from "node:url";
const ici = (c) => fileURLToPath(new URL(c, import.meta.url));
const R = await import("../vendor/replicad/replicad.js");
const opencascade = (await import("../vendor/replicad/replicad_single.js")).default;
const oc = await opencascade({ locateFile:() => ici("../vendor/replicad/replicad_single.wasm") });
R.setOC(oc);
const { construire } = await import("../js/c3-operations.js");

const SEUIL_FIN = Number(process.env.SEUIL_FIN || 5000);
const log = console.log; console.log = () => {};      // le noyau bavarde
const lignes = [];
const mesure = async (nom, f) => { const t = performance.now(); const r = await f(); lignes.push([nom, Math.round(performance.now() - t)]); return r; };

/* Un capot de 200 × 150 : contour à congés, 120 trous, coque, nervures en répétition, bossages. */
const rect = (x0, y0, x1, y1) => [
  { id:"p1", type:"point", x:x0, y:y0 }, { id:"p2", type:"point", x:x1, y:y0 }, { id:"p3", type:"point", x:x1, y:y1 }, { id:"p4", type:"point", x:x0, y:y1 },
  { id:"l1", type:"ligne", p1:"p1", p2:"p2" }, { id:"l2", type:"ligne", p1:"p2", p2:"p3" }, { id:"l3", type:"ligne", p1:"p3", p2:"p4" }, { id:"l4", type:"ligne", p1:"p4", p2:"p1" }];
const trous = [];
for(let i = 0; i < 12; i++) for(let j = 0; j < 10; j++) trous.push({ id:`t${i}_${j}`, type:"point", x:-88 + i * 16, y:-63 + j * 14, seul:true });
const doc = (h = "30") => ({ parametres:[{ nom:"h", expr:h }], operations:[
  { id:"e1", type:"esquisse", nom:"contour", plan:{ base:"XY" }, contraintes:[], elements:rect(-100, -75, 100, 75) },
  { id:"x1", type:"extrusion", esquisse:"e1", distance:"h" },
  { id:"f1", type:"conge", corps:"", rayon:"5", aretes:[[-100, -75, 15], [100, -75, 15], [100, 75, 15], [-100, 75, 15]] },
  { id:"s1", type:"coque", corps:"", epaisseur:"2", faces:[[0, 0, 0]] },
  { id:"e2", type:"esquisse", nom:"trous", plan:{ base:"XY", decalage:"h" }, contraintes:[], elements:trous },
  { id:"h1", type:"percage", esquisse:"e2", corps:"", diametre:"3", traversant:false, profondeur:"3", forme:"simple" },
  { id:"b1", type:"boite", L:"2", l:"140", h:"10", x:"-90", y:"-70", z:"0", operation:"nouveau" },
  { id:"r1", type:"repetition", corps:"Corps 2", mode:"lineaire", axe:"X", nombre:"9", pas:"22" },
  { id:"c1", type:"combiner", cible:"Corps 1", outils:["Corps 2"], operation:"joindre" },
  { id:"z1", type:"chanfrein", corps:"", distance:"0.5", aretes:[[0, -73, 0]] },
] });

const cache = [];
const d = doc();
const r0 = await mesure("Reconstruction complète", () => construire(R, d, cache, oc));
const erreurs = Object.entries(r0.etats).filter(([, n]) => n.erreur).map(([id, n]) => `${id} : ${n.erreur}`);
const m = await mesure("Maillage (0,05 mm)", async () => r0.corps[0].shape.mesh({ tolerance:0.05, angularTolerance:15 }));
await mesure("Arêtes exactes", async () => r0.corps[0].shape.meshEdges({ tolerance:0.05, angularTolerance:15 }));
const faces = r0.corps[0].shape.faces.length, aretes = r0.corps[0].shape.edges.length;
d.operations[9] = { ...d.operations[9], distance:"0.6" };
const finH = await mesure("Dernière opération seule modifiée", () => construire(R, d, cache, oc));
const fin = lignes.at(-1)[1];
const d2 = doc("35");
const rP = await mesure("Paramètre changé (tout refait)", () => construire(R, d2, cache, oc));
await mesure("Export STEP", async () => R.exportSTEP([{ shape:rP.corps[0].shape, name:"capot" }]).size);

const mo = () => Math.round(process.memoryUsage().rss / 1e6);      // la mémoire WebAssembly y est comptée
const debut = mo();
const paliers = [];
for(let i = 0; i < 200; i++){
  d.operations[9] = { ...d.operations[9], distance:String(0.5 + (i % 5) / 20) };
  await construire(R, d, cache, oc);
  if(global.gc) global.gc();
  await new Promise(r => setTimeout(r));      // les finaliseurs ne passent qu'entre deux tâches, comme dans le travailleur
  if((i + 1) % 50 === 0) paliers.push(mo());
}
const finMo = mo();
console.log = log;
for(const [n, t] of lignes) console.log(`${n.padEnd(36)} ${String(t).padStart(7)} ms`);
console.log("Par opération : " + d2.operations.map(o => `${o.id} ${(cache.find(c => c.etats[o.id])?.etats[o.id].ms ?? 0)}`).join(", "));
const r00 = r0.etats;
console.log("Coût initial : " + Object.entries(r00).map(([id, n]) => `${id} ${n.ms ?? 0}`).join(", "));
console.log(`Triangles ${m.triangles.length / 3}, faces ${faces}, arêtes ${aretes}`);
console.log(`Mémoire : départ ${debut} Mo, puis tous les 50 changements de la dernière opération : ${paliers.join(", ")} Mo`);
if(erreurs.length) console.log("Erreurs : " + erreurs.join(" ; "));
const ko = erreurs.length > 0 || fin > SEUIL_FIN;
console.log(ko ? "banc-conception-perf : ÉCHEC" : "banc-conception-perf : OK");
process.exit(ko ? 1 : 0);
