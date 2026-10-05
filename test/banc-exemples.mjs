/* Banc des exemples : les fichiers d'exemples/ se lisent, et la mesure tombe juste.

     node test/banc-exemples.mjs            (Node 20.6 ou plus, aucun paquet)

   Sans navigateur : les STEP passent par le vrai noyau OpenCascade de vendor/occt/,
   l'OBJ et le STL par les lecteurs three.js de vendor/three/, et la cote que le
   README suppose : l'équerre d'essai-mesure.obj, tournée de 30° puis 12° et
   rotation figée dans les sommets, retrouve par repereDePiece (js/06-topologie.js)
   des axes où son encombrement redevient 40 × 30 × 30 — c'est dans ce repère que
   ΔXYZ donne les 40 × 30 × 6 d'une aile. Les 3MF demandent DOMParser,
   que Node n'a pas : ils ne sont pas lus ici.

   Les dimensions attendues sont celles relevées à la création du banc ; une
   mise à jour de vendor/ ou d'un exemple qui les change doit se voir. */
import { register, createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const VENDOR = pathToFileURL(path.join(RACINE, "vendor", "three") + "/").href;

/* La carte d'imports d'index.html, rejouée pour Node : « three » et « three/addons/ ». */
register("data:text/javascript," + encodeURIComponent(`
  export async function resolve(s, ctx, suite){
    if(s === "three") return { url: ${JSON.stringify(VENDOR)} + "three.module.js", shortCircuit: true };
    if(s.startsWith("three/addons/")) return { url: ${JSON.stringify(VENDOR)} + "addons/" + s.slice(13), shortCircuit: true };
    return suite(s, ctx);
  }`));
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };

const THREE = await import("three");
const { OBJLoader } = await import("three/addons/loaders/OBJLoader.js");
const { STLLoader } = await import("three/addons/loaders/STLLoader.js");
const { repereDePiece } = await import(pathToFileURL(path.join(RACINE, "js", "06-topologie.js")).href);

const lire = (nom) => readFileSync(path.join(RACINE, "exemples", nom));
const tailles = (boite) => boite.getSize(new THREE.Vector3()).toArray().map((v) => +v.toFixed(1));
let essais = 0;
const verifier = (nom, fn) => { fn(); essais++; console.log("  ok  " + nom); };

/* --- STEP, par OpenCascade -------------------------------------------------- */
const occtimportjs = createRequire(import.meta.url)(path.join(RACINE, "vendor", "occt", "occt-import-js.js"));
const occt = await occtimportjs({ locateFile: (f) => path.join(RACINE, "vendor", "occt", f) });
const STEP = {
  "assemblage-as1.stp": { maillages: 18, tailles: [200, 150, 84] },
  "cube-conges.step": { maillages: 1, tailles: [10, 10, 10] },
  "surface-conique.step": { maillages: 1, tailles: [7, 27, 27] },
};
for(const [nom, attendu] of Object.entries(STEP)){
  verifier(nom, () => {
    const r = occt.ReadStepFile(new Uint8Array(lire(nom)), null);
    assert.ok(r.success, "OpenCascade n'a pas lu " + nom);
    const boite = new THREE.Box3();
    for(const m of r.meshes){
      const p = m.attributes.position.array;
      for(let i = 0; i < p.length; i += 3) boite.expandByPoint(new THREE.Vector3(p[i], p[i+1], p[i+2]));
    }
    assert.equal(r.meshes.length, attendu.maillages, nom + " : nombre de maillages");
    assert.deepEqual(tailles(boite), attendu.tailles, nom + " : dimensions");
  });
}

/* --- OBJ et STL, par three.js ---------------------------------------------- */
verifier("equerre.obj", () => {
  const g = new OBJLoader().parse(lire("equerre.obj").toString("utf8"));
  assert.deepEqual(tailles(new THREE.Box3().setFromObject(g)), [40, 40, 50]);
});
verifier("tetraedre.stl", () => {
  const geo = new STLLoader().parse(new Uint8Array(lire("tetraedre.stl")).buffer);
  assert.equal(geo.attributes.position.count, 12);
  geo.computeBoundingBox();
  assert.deepEqual(tailles(geo.boundingBox), [40, 35, 30]);
});

/* --- La mesure : l'équerre tournée retrouve son repère propre ---------------- */
verifier("essai-mesure.obj : l'équerre tournée retrouve son repère (40 × 30 × 30)", () => {
  const g = new OBJLoader().parse(lire("essai-mesure.obj").toString("utf8"));
  const pieces = [];
  g.traverse((o) => { if(o.isMesh) pieces.push(o); });
  assert.equal(pieces.length, 2, "une plaque et une équerre");
  const equerre = pieces.find((m) => /equerre/i.test(m.name)) || pieces[1];
  const rep = repereDePiece(equerre);
  assert.equal(rep.source, "faces", "repère retrouvé par les faces planes");
  const p = equerre.geometry.attributes.position, v = new THREE.Vector3();
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for(let i = 0; i < p.count; i++){
    v.fromBufferAttribute(p, i);
    [rep.uX, rep.uY, rep.uZ].forEach((u, k) => { const d = v.dot(u); min[k] = Math.min(min[k], d); max[k] = Math.max(max[k], d); });
  }
  const dims = max.map((m, k) => +(m - min[k]).toFixed(2)).sort((a, b) => b - a);
  assert.deepEqual(dims, [40, 30, 30]);
  // et ce n'est pas l'encombrement dans les axes du projet, où elle est de biais
  assert.notDeepEqual(tailles(new THREE.Box3().setFromObject(equerre)).sort((a, b) => b - a), [40, 30, 30]);
});

/* --- Collisions : une pénétration se voit, un contact face à face non ------- */
const { chercherCollisions } = await import(pathToFileURL(path.join(RACINE, "js", "12-collisions.js")).href);
const cartes = async (...positions) => {
  const racine = new THREE.Group();
  for(const [nom, x, y, z] of positions){
    const fichier = new THREE.Group();
    const m = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10));
    m.name = nom; m.position.set(x, y, z); m.userData.estPiece = true;
    fichier.add(m); racine.add(fichier);
  }
  racine.updateMatrixWorld(true);
  return (await chercherCollisions(racine)).map(r => r.a.name + "/" + r.b.name).sort();
};
for(const [nom, positions, attendu] of [
  ["deux cubes posés face à face : contact, pas collision", [["A", 0, 0, 0], ["B", 10, 0, 0]], []],
  ["un cube qui rentre dans l'autre", [["A", 0, 0, 0], ["C", 6, 3, 2]], ["A/C"]],
  ["trois fichiers : seuls les couples qui se pénètrent", [["A", 0, 0, 0], ["B", 10, 0, 0], ["C", 30, 0, 0], ["D", 14, 4, -3]], ["B/D"]],
]){
  const obtenu = await cartes(...positions);
  verifier("collisions — " + nom, () => assert.deepEqual(obtenu, attendu));
}

/* --- Contraintes : plaquer deux plans, aligner deux axes -------------------- */
const { contraindre } = await import(pathToFileURL(path.join(RACINE, "js", "13-deplacement.js")).href);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const proche = (a, b) => assert.ok(a.distanceTo(b) < 1e-6, `${a.toArray()} ≠ ${b.toArray()}`);
verifier("contrainte — la face du dessous de B plaquée sur le dessus de A, à 10 mm", () => {
  const g = new THREE.Group(); g.position.set(30, -5, 2); g.rotation.set(0.3, 0, 0.2); g.updateMatrixWorld(true);
  /* une face plane de B, normale vers -X dans son repère : on la suit dans le monde */
  const local = { centre:V(0, 0, 0), normale:V(-1, 0, 0) };
  const monde = () => ({ type:"plan", centre:g.localToWorld(local.centre.clone()),
                         normale:local.normale.clone().transformDirection(g.matrixWorld) });
  assert.equal(contraindre(g, monde(), { type:"plan", centre:V(0, 0, 5), normale:V(0, 0, 1) }, 10), null);
  const apres = monde();
  proche(apres.normale, V(0, 0, -1));           // les faces se regardent
  assert.ok(Math.abs(apres.centre.z - 15) < 1e-6, "à 10 mm au-dessus du plan z = 5");
});
verifier("contrainte — deux trous mis sur le même axe", () => {
  const g = new THREE.Group(); g.position.set(7, 3, 0); g.rotation.set(0, 0.4, 0); g.updateMatrixWorld(true);
  const A = { type:"cylindre", point:g.localToWorld(V(2, 1, 0)), axe:V(0, 0, 1).transformDirection(g.matrixWorld) };
  assert.equal(contraindre(g, A, { type:"cylindre", point:V(-4, 6, 50), axe:V(0, 0, -1) }), null);
  const p = g.localToWorld(V(2, 1, 0)), axe = V(0, 0, 1).transformDirection(g.matrixWorld);
  proche(axe, V(0, 0, 1));
  proche(V(p.x, p.y, 0), V(-4, 6, 0));          // sur l'axe x = -4, y = 6
});
verifier("contrainte — plan contre cylindre refusé", () => {
  const g = new THREE.Group();
  assert.match(contraindre(g, { type:"plan", centre:V(0,0,0), normale:V(0,0,1) },
                              { type:"cylindre", point:V(0,0,0), axe:V(0,0,1) }), /plan|cylindr/);
});

console.log(`${essais}/${essais} ok`);
