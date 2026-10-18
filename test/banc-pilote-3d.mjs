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

/* --- T4 : collisions ---------------------------------------------------------- */
const { chercherCollisions } = await import("../js/12-collisions.js");
await verifier("collisions de l'exemple : celles de chercherCollisions, sérialisées", async () => {
  const r = await P3.collisions(modele, { tolerance: 0.1 });
  const brut = await chercherCollisions(modele, { tol: 0.1 });
  assert.equal(r.nombre, brut.length);
  assert.deepEqual(r.collisions.map(c => c.a.uuid + c.b.uuid), brut.map(c => c.a.uuid + c.b.uuid));
  assert.ok(r.nombre > 0, "l'exemple a des pièces qui se pénètrent");
  for(const c of r.collisions) assert.ok(c.longueur > 0 && c.a.uuid && c.b.chemin);
  assert.equal(r.tolerance, 0.1);
  assert.deepEqual(JSON.parse(JSON.stringify(r)), r);
  const compte = {};
  for(const c of r.collisions){ const k = [c.a.nom, c.b.nom].sort().join("↔"); compte[k] = (compte[k] || 0) + 1; }
  console.log("       " + r.nombre + " collisions en " + r.duree_s + " s : " + JSON.stringify(compte));
});

await verifier("une pièce masquée n'entre pas dans les collisions", async () => {
  const r = await P3.collisions(modele);
  const cachee = P3.trouverPiece(modele, r.collisions[0].a.uuid);
  cachee.visible = false;
  try{
    const r2 = await P3.collisions(modele);
    assert.equal(r2.nombre, r.nombre - r.collisions.filter(c => c.a.uuid === cachee.uuid || c.b.uuid === cachee.uuid).length);
  }finally{ cachee.visible = true; }
});

/* --- T5 : déplacement, contrainte, matrices ---------------------------------- */
const deux = new THREE.Group();          // l'exemple ouvert deux fois : deux fichiers à assembler
deux.add(lireExemple("assemblage-as1.stp"), lireExemple("assemblage-as1.stp"));
deux.updateMatrixWorld(true);
const [f0, f1] = deux.children;
const centreDe = g => new THREE.Box3().setFromObject(g, true).getCenter(new THREE.Vector3());
const pres = (a, b, tol = 1e-6) => a.every((x, i) => Math.abs(x - b[i]) <= tol);

await verifier("translation, position absolue, origine", () => {
  P3.deplacer(f1, { translation: [25, 0, 0] });
  assert.ok(pres(f1.position.toArray(), [25, 0, 0]));
  P3.deplacer(f1, { translation: [0, -5, 2] });
  assert.ok(pres(f1.position.toArray(), [25, -5, 2]));
  P3.deplacer(f1, { position: [10, 20, 30] });
  assert.ok(pres(f1.position.toArray(), [10, 20, 30]));
  P3.deplacer(f1, { origine: true });
  assert.ok(pres(f1.position.toArray(), [0, 0, 0]) && pres([f1.rotation.x, f1.rotation.y, f1.rotation.z], [0, 0, 0]));
});

await verifier("une rotation garde le centre de la boîte (comme le panneau Déplacer)", () => {
  const c0 = centreDe(f1);
  P3.deplacer(f1, { rotation_deg: [0, 0, 90] });
  assert.ok(pres(centreDe(f1).toArray(), c0.toArray(), 1e-3), "centre déplacé");
  assert.ok(Math.abs(f1.rotation.z - Math.PI / 2) < 1e-9);
  P3.deplacer(f1, { origine: true });
});

await verifier("état des matrices : déplacer puis remettre redonne l'état au bit près", () => {
  const e0 = P3.etatMatrices(deux);
  assert.deepEqual(JSON.parse(JSON.stringify(e0)), e0);
  P3.deplacer(f1, { translation: [3.3, 1.1, 0], rotation_deg: [10, 20, 30] });
  assert.notDeepEqual(P3.etatMatrices(deux), e0);
  P3.remettreMatrices(deux, e0);
  assert.deepEqual(P3.etatMatrices(deux), e0);
  assert.throws(() => P3.remettreMatrices(deux, e0.slice(1)), /fichiers/);
});

await verifier("contrainte plan contre plan : faces plaquées à 5 mm, normales opposées", () => {
  const plaque = g => P3.pieces(g).find(p => p.name === "plate");
  const A = plaque(f1), B = plaque(f0);
  const fA = P3.faces(A).faces.find(f => f.type === "plan" && f.normale[2] < -0.99);   // dessous de la plaque mobile
  const fB = P3.faces(B).faces.find(f => f.type === "plan" && f.normale[2] > 0.99);    // dessus de la plaque fixe
  assert.ok(fA && fB, "faces dessous et dessus de la plaque");
  P3.deplacer(f1, { translation: [7, 9, -40] });
  P3.contrainte(deux, f1, { mobile: { piece: A.uuid, face: fA.index }, fixe: { piece: B.uuid, face: fB.index }, decalage: 5 });
  const apresA = P3.faces(A).faces[fA.index], apresB = P3.faces(B).faces[fB.index];
  assert.ok(pres(apresA.normale, apresB.normale.map(x => -x), 1e-6), "normales opposées");
  const ecart = [0, 1, 2].reduce((s, k) => s + (apresA.centre[k] - apresB.centre[k]) * apresB.normale[k], 0);
  assert.ok(Math.abs(ecart - 5) < 1e-3, "écart le long de la normale : " + ecart);
  P3.deplacer(f1, { origine: true });
});

await verifier("contrainte axe contre axe : deux vis sur le même axe", () => {
  const vis = g => P3.pieces(g).find(p => p.name === "bolt");
  const A = vis(f1), B = vis(f0);
  const fA = P3.faces(A).faces.find(f => f.type === "cylindre"), fB = P3.faces(B).faces.find(f => f.type === "cylindre");
  P3.deplacer(f1, { translation: [30, -12, 4], rotation_deg: [20, 0, 35] });
  P3.contrainte(deux, f1, { mobile: { piece: A.uuid, face: fA.index }, fixe: { piece: B.uuid, face: fB.index } });
  const a = P3.faces(A).faces[fA.index], b = P3.faces(B).faces[fB.index];
  // Axes rendus arrondis au millième, et ajustés sur le maillage d'affichage : on normalise, et
  // l'écart entre axes se juge à la précision du maillage (0,1 mm)
  const ax = new THREE.Vector3(...a.axe).normalize(), bx = new THREE.Vector3(...b.axe).normalize();
  assert.ok(Math.abs(Math.abs(ax.dot(bx)) - 1) < 1e-3, "axes parallèles");
  const w = new THREE.Vector3(...a.centre).sub(new THREE.Vector3(...b.centre));
  assert.ok(w.sub(bx.clone().multiplyScalar(w.dot(bx))).length() < 0.1, "axes confondus");
  P3.deplacer(f1, { origine: true });
});

await verifier("contraintes refusées : faces incompatibles, face fixe sur le même fichier, index hors limites", () => {
  const A = P3.pieces(f1).find(p => p.name === "bolt"), B = P3.pieces(f0).find(p => p.name === "plate");
  const cyl = P3.faces(A).faces.find(f => f.type === "cylindre"), plan = P3.faces(B).faces.find(f => f.type === "plan");
  assert.throws(() => P3.contrainte(deux, f1, { mobile: { piece: A.uuid, face: cyl.index }, fixe: { piece: B.uuid, face: plan.index } }),
                /deux faces planes|cylindriques/);
  const memeFichier = P3.pieces(f1).find(p => p.name === "plate");
  assert.throws(() => P3.contrainte(deux, f1, { mobile: { piece: A.uuid, face: cyl.index }, fixe: { piece: memeFichier.uuid, face: 0 } }),
                /autre fichier/);
  assert.throws(() => P3.contrainte(deux, f1, { mobile: { piece: A.uuid, face: 9999 }, fixe: { piece: B.uuid, face: 0 } }),
                /hors limites/);
  assert.ok(pres(f1.position.toArray(), [0, 0, 0]), "rien n'a bougé");
});

/* --- T6 : ouvrir depuis PROJETS/3D (partie pure : chemins et compagnons) ------ */
const disponibles = [{ chemin: "carte/boitier.stp" }, { chemin: "pieces/equerre.obj" }, { chemin: "pieces/EQUERRE.MTL" },
                     { chemin: "pieces/vis.stl" }];

await verifier("ouvrir : un .obj emmène son .mtl, les autres vont seuls", () => {
  assert.deepEqual(P3.preparerOuverture(["pieces/equerre.obj"], disponibles), ["pieces/equerre.obj", "pieces/EQUERRE.MTL"]);
  assert.deepEqual(P3.preparerOuverture(["carte/boitier.stp", "pieces/vis.stl"], disponibles),
                   ["carte/boitier.stp", "pieces/vis.stl"]);
});

await verifier("ouvrir : chemins refusés avant tout fetch", () => {
  for(const [chemins, motif] of [
    [[], /au moins un/], [["../web_3D.py"], /invalide/], [["/etc/passwd"], /invalide/], [["a\\b.stp"], /invalide/],
    [["C:/x.stp"], /invalide/], [["carte/notes.txt"], /format/], [["carte/absent.stp"], /absent/],
    [Array(21).fill("carte/boitier.stp"), /20 fichiers/], [[42], /invalide/],
  ]) assert.throws(() => P3.preparerOuverture(chemins, disponibles), motif, JSON.stringify(chemins));
});

/* --- T7 : extraction STEP, relue par OpenCascade ------------------------------- */
const relire = texte => occt.ReadStepFile(new TextEncoder().encode(texte), { linearUnit: "millimeter" });
const tailleTriee = arr => [...arr].map(x => +x.toFixed(2)).sort((x, y) => y - x);

await verifier("STEP d'une pièce : relu par OpenCascade, même encombrement que la pièce", () => {
  const nut = parNom("nut")[3];                       // une occurrence parmi 8 : c'est le même produit
  const r = P3.extraireStep(modele, [nut.uuid]);
  assert.deepEqual(r.produits, ["nut"]);
  assert.ok(r.octets > 100 && r.texte.startsWith("ISO-10303-21"));
  const lu = relire(r.texte);
  assert.ok(lu.success, "STEP relu");
  assert.equal(lu.meshes.length, 1);
  const boite = new THREE.Box3();
  const p = lu.meshes[0].attributes.position.array;
  for(let i = 0; i < p.length; i += 3) boite.expandByPoint(new THREE.Vector3(p[i], p[i+1], p[i+2]));
  nut.geometry.computeBoundingBox();
  assert.deepEqual(tailleTriee(boite.getSize(new THREE.Vector3()).toArray()),
                   tailleTriee(nut.geometry.boundingBox.getSize(new THREE.Vector3()).toArray()));
});

/* Un sous-ensemble choisi pièce par pièce n'est pas fiable : exportAssemblageFiltre remonte au
   sous-ensemble parent puis redescend vers tous ses enfants (un écrou demandé emporte toutes les
   vis et tous les écrous de « nut-bolt-assembly »). Une pièce à la fois. */
await verifier("STEP de deux pièces : refusé, une pièce à la fois", () => {
  assert.throws(() => P3.extraireStep(modele, [parNom("nut")[0].uuid, parNom("bolt")[0].uuid]), /une pièce à la fois/i);
  assert.throws(() => P3.extraireStep(modele, []), /une pièce/);
});

await verifier("STEP refusé : pièce absente du STEP, fichier qui n'est pas un STEP", () => {
  const plaque = parNom("plate")[0];
  const vrai = plaque.name;
  plaque.name = "plaque-renommee";
  try{ assert.throws(() => P3.extraireStep(modele, [plaque.uuid]), /introuvable/); }
  finally{ plaque.name = vrai; }
  const texte = modele.children[0].userData.stepTexte;
  delete modele.children[0].userData.stepTexte;
  try{ assert.throws(() => P3.extraireStep(modele, [plaque.uuid]), /STEP/); }
  finally{ modele.children[0].userData.stepTexte = texte; }
});

console.log(`${essais}/${essais} ok`);
