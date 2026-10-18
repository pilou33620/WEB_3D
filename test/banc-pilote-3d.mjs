/* Banc des commandes du canal de pilotage (js/14-pilote-3d.js), sans navigateur.
     node test/banc-pilote-3d.mjs            (Node 20.6 ou plus, aucun paquet)
   La scène est construite comme dans la page : OpenCascade lit l'assemblage
   d'exemple, puis construireNoeud / recenser / replier (js/02-import.js) en font
   l'arbre réel — groupes repliés, noms en double compris. Seule la mise à plat
   de la réponse d'OpenCascade, que fait le Worker (js/travailleur-occt.js,
   compacter), est refaite ici. Spec : web_suite/lanceur/docs/SPEC-mcp-registre-3d.md. */
import { register, createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const VENDOR = pathToFileURL(path.join(RACINE, "vendor", "three") + "/").href;
register("data:text/javascript," + encodeURIComponent(`
  export async function resolve(s, ctx, suite){
    if(s === "three") return { url: ${JSON.stringify(VENDOR)} + "three.module.js", shortCircuit: true };
    if(s.startsWith("three/addons/")) return { url: ${JSON.stringify(VENDOR)} + "addons/" + s.slice(13), shortCircuit: true };
    return suite(s, ctx);
  }`));
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };

const THREE = await import("three");
const { construireNoeud, recenser, replier, fabriqueMateriaux } = await import("../js/02-import.js");
const P3 = await import("../js/14-pilote-3d.js");

let essais = 0;
const verifier = async (nom, fn) => { await fn(); essais++; console.log("  ok  " + nom); };

/* --- la scène de l'exemple, construite comme dans la page ------------------- */
const occtimportjs = createRequire(import.meta.url)(path.join(RACINE, "vendor", "occt", "occt-import-js.js"));
const occt = await occtimportjs({ locateFile: (f) => path.join(RACINE, "vendor", "occt", f) });

function compacter(resultat){        // ce que fait le Worker (js/travailleur-occt.js)
  return (resultat.meshes || []).map(m => ({
    nom: m.name || "", couleur: m.color || null,
    position: Float32Array.from(m.attributes?.position?.array || []),
    normale: m.attributes?.normal?.array ? Float32Array.from(m.attributes.normal.array) : null,
    index: Uint32Array.from(m.index?.array || []),
    faces: (m.brep_faces || []).map(f => ({ premier: f.first, dernier: f.last, couleur: f.color || null })),
  }));
}

function lireExemple(nom){
  const texte = readFileSync(path.join(RACINE, "exemples", nom));
  const r = occt.ReadStepFile(new Uint8Array(texte), { linearUnit: "millimeter" });
  assert.ok(r.success, "OpenCascade n'a pas lu " + nom);
  const maillages = compacter(r);
  const racine = r.root || { name: nom, meshes: maillages.map((_, i) => i), children: [] };
  const groupe = construireNoeud(racine, maillages, fabriqueMateriaux());
  recenser(groupe, { compteur: 0, triangles: 0, pieces: 0 });
  groupe.name = groupe.name || nom;
  Object.assign(groupe.userData, { fichier: nom, taille: texte.length, format: "step", stepTexte: texte.toString("latin1") });
  replier(groupe);
  return groupe;
}

const modele = new THREE.Group();
modele.name = "modele";
modele.add(lireExemple("assemblage-as1.stp"));
modele.updateMatrixWorld(true);

/* --- T2 : la scène décrite, les pièces retrouvées --------------------------- */
const scene = P3.decrireScene(modele, { nombre: 500 });

await verifier("la scène décrit le fichier et ses 18 pièces", () => {
  assert.equal(scene.fichiers.length, 1);
  const f = scene.fichiers[0];
  assert.equal(f.pieces, 18);
  assert.deepEqual([f.index, f.fichier, f.format], [0, "assemblage-as1.stp", "step"]);
  assert.deepEqual([f.position, f.rotation_deg], [[0, 0, 0], [0, 0, 0]]);
  assert.equal(scene.pieces_total, 18);
  assert.equal(scene.pieces.length, 18);
  for(const p of scene.pieces){
    assert.ok(/^[0-9A-Fa-f-]{36}$/.test(p.uuid), "uuid : " + p.uuid);
    assert.ok(/^\d+(\/\d+)+$/.test(p.chemin), "chemin : " + p.chemin);
    assert.equal(typeof p.nom, "string");
    assert.equal(p.fichier, 0);
    assert.equal(p.visible, true);
    assert.ok(p.triangles > 0);
  }
});

await verifier("la description est du JSON pur", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(scene)), scene);
});

await verifier("chemin et uuid désignent la même pièce", () => {
  for(const p of scene.pieces){
    const parChemin = P3.trouverPiece(modele, p.chemin);
    assert.equal(parChemin, P3.trouverPiece(modele, p.uuid));
    assert.equal(parChemin.name, p.nom);
  }
});

await verifier("un nom en double est refusé avec la liste des candidates", () => {
  const nuts = scene.pieces.filter(p => p.nom === "nut");
  assert.ok(nuts.length > 1, "l'exemple a plusieurs « nut »");
  assert.throws(() => P3.trouverPiece(modele, "nut"), e => {
    assert.match(e.message, new RegExp(nuts.length + " pièces"));
    for(const n of nuts) assert.ok(e.message.includes(n.chemin), "candidate absente : " + n.chemin);
    return true;
  });
});

await verifier("un nom unique est accepté ; une référence inconnue, refusée", () => {
  const compte = {};
  for(const p of scene.pieces) compte[p.nom] = (compte[p.nom] || 0) + 1;
  const unique = scene.pieces.find(p => compte[p.nom] === 1);
  assert.ok(unique, "l'exemple devrait avoir au moins un nom unique");
  assert.equal(P3.trouverPiece(modele, unique.nom).uuid, unique.uuid);
  for(const ref of ["inconnue", "9/9", "0/99", "", "../0"])
    assert.throws(() => P3.trouverPiece(modele, ref), /inconnue|introuvable|invalide/, ref);
});

await verifier("filtre et pagination", () => {
  const bolts = P3.decrireScene(modele, { filtre: "BOLT" });
  assert.ok(bolts.pieces.length > 0 && bolts.pieces.every(p => /bolt/i.test(p.nom)));
  assert.equal(bolts.trouvees, scene.pieces.filter(p => /bolt/i.test(p.nom)).length);
  const page = P3.decrireScene(modele, { debut: 5, nombre: 4 });
  assert.deepEqual(page.pieces.map(p => p.uuid), scene.pieces.slice(5, 9).map(p => p.uuid));
  assert.equal(page.pieces_total, 18);
});

/* --- T3 : mesures et cote --------------------------------------------------- */
const { mesurerEntites } = await import("../js/06-topologie.js");
const parNom = n => scene.pieces.filter(p => p.nom === n).map(p => P3.trouverPiece(modele, p.uuid));
const proche = (a, b, tol = 0.01) => Math.abs(a - b) <= tol;

await verifier("dimensions de l'assemblage : 200 × 150 × 84, 18 pièces, volume et surface", () => {
  const d = P3.dimensions(modele);
  assert.ok(proche(d.taille[0], 200) && proche(d.taille[1], 150) && proche(d.taille[2], 84), JSON.stringify(d.taille));
  assert.equal(d.pieces, 18);
  assert.ok(d.volume > 0 && d.surface > 0);
  assert.equal(d.min.length, 3); assert.equal(d.max.length, 3);
  assert.deepEqual(JSON.parse(JSON.stringify(d)), d);
});

await verifier("dimensions d'une pièce : volume et surface positifs, une seule pièce", () => {
  const d = P3.dimensions(parNom("bolt")[0]);
  assert.ok(d.volume > 0 && d.surface > 0);
  assert.equal(d.pieces, 1);
});

await verifier("distance entre pièces : celle de mesurerEntites, contact quand elles s'interpénètrent", () => {
  const bolts = parNom("bolt"), equerres = parNom("l-bracket");
  assert.ok(bolts.length && equerres.length, "bolt et l-bracket dans l'exemple");
  let contacts = 0, ecarts = 0;
  for(const b of bolts) for(const e of equerres){
    const d = P3.distance(b, e);
    const r = mesurerEntites({ genre: "piece", maillage: b }, { genre: "piece", maillage: e });
    assert.ok(proche(d.distance, r.p1.distanceTo(r.p2), 0.001));
    assert.equal(d.p1.length, 3);
    if(d.contact){ contacts++; assert.equal(d.distance, 0); } else ecarts++;
  }
  assert.ok(contacts >= 1, "au moins un boulon touche une équerre");
  assert.ok(ecarts >= 1, "et au moins un couple est séparé");
});

await verifier("faces d'un boulon : un cylindre au moins, avec son rayon ; index stables", () => {
  const b = parNom("bolt")[0];
  const f1 = P3.faces(b), f2 = P3.faces(b);
  assert.deepEqual(f1, f2);
  assert.deepEqual(JSON.parse(JSON.stringify(f1)), f1);
  const cyl = f1.faces.filter(f => f.type === "cylindre");
  assert.ok(cyl.length >= 1 && cyl.every(f => f.rayon > 0 && f.axe.length === 3));
  assert.ok(f1.faces.every((f, i) => f.index === i && f.aire > 0));
  assert.ok(f1.faces.some(f => f.type === "plan" && f.normale.length === 3));
});

await verifier("la cote de Claude : une ligne entre les deux points, nommée, remplaçable", () => {
  const c = P3.coteClaude([0, 0, 0], [10, 0, 0], "10 mm");
  assert.equal(c.name, "cote-claude");
  assert.equal(c.userData.texte, "10 mm");
  const ligne = c.children.find(o => o.isLine);
  const pos = ligne.geometry.attributes.position.array;
  assert.deepEqual(Array.from(pos), [0, 0, 0, 10, 0, 0]);
});

console.log(`${essais}/${essais} ok`);
