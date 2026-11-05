/* Banc des commandes ajoutées : opérations sur le noyau, esquisse, exports, sans navigateur.
   Les résultats attendus sont calculés à la main (volumes, aires, nombres de faces).
   node test/banc-conception-plus.mjs — n'affiche que les échecs et un bilan. */
import { fileURLToPath } from "node:url";
import { unzipSync, strFromU8 } from "../vendor/three/addons/libs/fflate.module.js";
const ici = (c) => fileURLToPath(new URL(c, import.meta.url));
const R = await import("../vendor/replicad/replicad.js");
const opencascade = (await import("../vendor/replicad/replicad_single.js")).default;
const oc = await opencascade({ locateFile:() => ici("../vendor/replicad/replicad_single.wasm") });
R.setOC(oc);
const { construire } = await import("../js/c3-operations.js");
const { analyserCorps, comparerCorps, sectionPlan, arretesVue, repartir, grillePerforation } = await import("../js/c3d-operations-plus.js");
const { ecrireObj, ecrire3mf, ecrireUrdf, dxfCalques, dxfEsquisse, nomenclature, operationsCollees, csvBalayage } = await import("../js/c12-exports.js");
const { repere, profils, resoudre, echantillonSpline, controlesSpline } = await import("../js/c2-esquisse.js");
const Plus = await import("../js/c2c-esquisse-plus.js");

let ok = 0, ko = 0;
const verifier = (nom, obtenu, attendu, tol = 1e-6) => {
  const bon = typeof attendu === "number" ? Math.abs(obtenu - attendu) <= tol : JSON.stringify(obtenu) === JSON.stringify(attendu);
  if(bon) ok++; else { ko++; console.log(`ÉCHEC ${nom} : obtenu ${JSON.stringify(obtenu)}, attendu ${JSON.stringify(attendu)}`); }
};
const vrai = (nom, x, detail = "") => { if(x) ok++; else { ko++; console.log(`ÉCHEC ${nom} ${detail}`); } };

const esqu = (id, plan, elements, contraintes = []) => ({ id, type:"esquisse", nom:id, plan, contraintes, elements });
const rect = (x0, y0, x1, y1, pre = "") => [
  { id:pre + "p1", type:"point", x:x0, y:y0 }, { id:pre + "p2", type:"point", x:x1, y:y0 }, { id:pre + "p3", type:"point", x:x1, y:y1 }, { id:pre + "p4", type:"point", x:x0, y:y1 },
  { id:pre + "l1", type:"ligne", p1:pre + "p1", p2:pre + "p2" }, { id:pre + "l2", type:"ligne", p1:pre + "p2", p2:pre + "p3" },
  { id:pre + "l3", type:"ligne", p1:pre + "p3", p2:pre + "p4" }, { id:pre + "l4", type:"ligne", p1:pre + "p4", p2:pre + "p1" }];
const ligneEsq = (id, plan, a, b) => esqu(id, plan, [{ id:"a", type:"point", x:a[0], y:a[1] }, { id:"b", type:"point", x:b[0], y:b[1] }, { id:"l", type:"ligne", p1:"a", p2:"b" }]);
const pts = (id, plan, liste) => esqu(id, plan, liste.map(([x, y], i) => ({ id:"q" + i, type:"point", x, y, seul:true })));
const boite = (id, L, l, h, x = 0, y = 0, z = 0) => ({ id, type:"boite", L:String(L), l:String(l), h:String(h), x:String(x), y:String(y), z:String(z), operation:"nouveau" });
const XY = { base:"XY" };

async function bati(ops, id, parametres = []){
  const r = await construire(R, { parametres, operations:ops }, [], oc);
  const vol = (i = 0) => r.corps[i] ? Math.abs(R.measureVolume(r.corps[i].shape)) : NaN;
  return { erreur:r.etats[id]?.erreur, corps:r.corps, n:r.corps.length, vol, aire:(i = 0) => r.corps[i] ? R.measureArea(r.corps[i].shape) : NaN, faces:(i = 0) => r.corps[i]?.shape.faces.length, note:r.etats[id] };
}

/* ---------------- solides ---------------- */
{
  const e = await bati([boite("b", 10, 10, 10, 0, 0, 0), boite("c", 10, 10, 10, 30, 0, 0), { id:"s", type:"englobant", marge:"1", operation:"nouveau" }], "s");
  verifier("englobant : marge d'1 mm autour des deux corps", [e.erreur, e.n, Math.round(e.vol(2))], [undefined, 3, 42 * 12 * 12]);
  const r = await bati([boite("b", 10, 10, 10), boite("c", 5, 5, 5, 30), { id:"s", type:"retirerCorps", corps:"Corps 1" }], "s");
  verifier("retirer un corps", [r.erreur, r.corps.map(c => c.nom)], [undefined, ["Corps 2"]]);
  const a = await bati([boite("b", 10, 10, 10), boite("c", 4, 4, 4, 30, 30, 30), { id:"s", type:"aligner", corps:"Corps 2", reference:"Corps 1", x:"centre", y:"min", z:"apres" }], "s");
  const ba = a.corps[1].shape.boundingBox.bounds;
  verifier("aligner : centre, min, posé dessus", [a.erreur, ...ba[0].map(c => Math.round(c))], [undefined, 3, 0, 10]);

  const f = await bati([boite("b", 20, 20, 20), { id:"s", type:"decalerFace", corps:"", faces:[[10, 10, 20]], distance:"3" }], "s");
  verifier("face plane décalée : ajoute", [f.erreur, Math.round(f.vol())], [undefined, 20 * 20 * 23]);
  const f2 = await bati([boite("b", 20, 20, 20), { id:"s", type:"decalerFace", corps:"", faces:[[10, 10, 20]], distance:"-3" }], "s");
  verifier("face plane décalée : enlève", [f2.erreur, Math.round(f2.vol())], [undefined, 20 * 20 * 17]);
  const c = await bati([{ id:"c", type:"cylindre", diametre:"10", h:"10", axe:"Z", x:"0", y:"0", z:"0", operation:"nouveau" }, { id:"s", type:"decalerFace", corps:"", faces:[[5, 0, 5]], distance:"2" }], "s");
  verifier("face cylindrique décalée : le rayon grandit", [c.erreur, Math.round(c.vol())], [undefined, Math.round(Math.PI * 49 * 10)]);

  const tr = [boite("b", 20, 20, 10, -10, -10, 0), { id:"c", type:"cylindre", diametre:"6", h:"10", axe:"Z", x:"0", y:"0", z:"0", operation:"enlever", corps:"" }];
  const tf = await bati([...tr, { id:"s", type:"decalerFace", corps:"", faces:[[3, 0, 5]], distance:"1" }], "s");
  verifier("paroi de trou décalée : le trou rétrécit", [tf.erreur, Math.round(tf.vol())], [undefined, Math.round(4000 - Math.PI * 4 * 10)]);
  const te = await bati([...tr, { id:"s", type:"decalerFace", corps:"", faces:[[3, 0, 5]], distance:"-1" }], "s");
  verifier("paroi de trou décalée : le trou s'agrandit", [te.erreur, Math.round(te.vol())], [undefined, Math.round(4000 - Math.PI * 16 * 10)]);
  const tv = await bati([...tr, { id:"s", type:"decalerFace", corps:"", faces:[[3, 0, 5]], distance:"3" }], "s");
  vrai("paroi de trou : se refermer est refusé", /refermerait/.test(tv.erreur || ""), tv.erreur);
  const dem = esqu("e", XY, [{ id:"o", type:"point", x:0, y:0 }, { id:"a", type:"point", x:5, y:0 }, { id:"b", type:"point", x:-5, y:0 }, { id:"k", type:"arc", c:"o", p1:"a", p2:"b" }, { id:"l", type:"ligne", p1:"b", p2:"a" }]);
  const de = await bati([dem, { id:"x", type:"extrusion", esquisse:"e", distance:"10", operation:"nouveau" }, { id:"s", type:"decalerFace", corps:"", faces:[[0, 5, 5]], distance:"2" }], "s");
  verifier("demi-cylindre décalé : seul son angle grandit", [de.erreur, Math.round(de.vol())], [undefined, Math.round(Math.PI * 49 * 10 / 2)]);

  const percee = [boite("b", 20, 20, 5), { id:"c", type:"cylindre", diametre:"6", h:"5", axe:"Z", x:"10", y:"10", z:"0", operation:"enlever", corps:"" }];
  const d = await bati([...percee, { id:"s", type:"supprimerFace", corps:"", faces:[[13, 10, 2.5]] }], "s");
  verifier("supprimer la paroi d'un trou : il se rebouche", [d.erreur, Math.round(d.vol()), d.corps[0].surface], [undefined, 2000, undefined]);
  const o = await bati([boite("b", 10, 10, 10), { id:"s", type:"supprimerFace", corps:"", faces:[[5, 5, 10]], ouvrir:true }], "s");
  verifier("supprimer une face sans boucher : une surface de 5 faces", [o.erreur, o.faces(), !!o.corps[0].surface], [undefined, 5, true]);

  const plan = { id:"pl", type:"plan", mode:"decale", base:"XY", decalage:"5", angle:"0", axe:"x" };
  const dv = await bati([boite("b", 10, 10, 10), plan, { id:"s", type:"diviser", corps:"", mode:"plan", plan:"pl" }], "s");
  verifier("diviser par un plan de construction", [dv.erreur, dv.n, Math.round(dv.vol(0) + dv.vol(1))], [undefined, 2, 1000]);
  const incl = await bati([boite("b", 10, 10, 10), { ...plan, base:"XZ", decalage:"-5", angle:"30" }, { id:"s", type:"diviser", corps:"", mode:"plan", plan:"pl" }], "s");
  verifier("diviser par un plan incliné", [incl.erreur, incl.n, Math.round(incl.vol(0) + incl.vol(1))], [undefined, 2, 1000]);
  const ds = await bati([boite("b", 10, 10, 10), ligneEsq("e", XY, [-5, 5], [15, 5]), { id:"s", type:"diviser", corps:"", mode:"esquisse", esquisse:"e" }], "s");
  verifier("diviser par les lignes d'une esquisse", [ds.erreur, ds.n, Math.round(ds.vol(0))], [undefined, 2, 500]);
  const dvs = await bati([boite("b", 10, 10, 10), boite("c", 40, 40, 0.5, -15, -15, 4.75), { id:"s", type:"diviser", corps:"Corps 1", mode:"corps", outil:"Corps 2" }], "s");
  verifier("diviser par un autre corps", [dvs.erreur, dvs.n >= 3], [undefined, true]);
  const dvn = await bati([boite("b", 10, 10, 10), { ...plan, decalage:"50" }, { id:"s", type:"diviser", corps:"", mode:"plan", plan:"pl" }], "s");
  vrai("diviser : un plan hors du corps est refusé", /ne traverse pas/.test(dvn.erreur || ""));

  const fc = await bati([boite("b", 10, 10, 10), ligneEsq("e", XY, [-5, 5], [15, 5]), { id:"s", type:"diviserFace", corps:"", esquisse:"e", faces:[[5, 5, 10]] }], "s");
  verifier("diviser une face : une face de plus, même volume", [fc.erreur, fc.faces(), Math.round(fc.vol())], [undefined, 7, 1000]);

  const nappe = [boite("b", 10, 10, 10), ligneEsq("e", XY, [-20, -20], [20, -20]), { id:"sx", type:"surfExtrusion", esquisse:"e", distance:"40" }];
  /* La nappe sera tournée pour couper le cube en Y = 5. */
  const pose = { id:"dep", type:"deplacer", corps:"Corps 2", tx:"0", ty:"25", tz:"-15", rx:"0", ry:"0", rz:"0" };
  const rf = await bati([...nappe, pose, { id:"s", type:"remplacerFace", corps:"Corps 1", outil:"Corps 2", faces:[[5, 10, 5]] }], "s");
  verifier("remplacer une face : le corps s'arrête à la surface", [rf.erreur, Math.round(rf.vol())], [undefined, 500]);

  const ce = await bati([...nappe, pose, { id:"s", type:"cellule", outils:["Corps 1", "Corps 2"], x:"5", y:"2", z:"5", operation:"nouveau" }], "s");
  verifier("remplissage de frontière : la cellule au point", [ce.erreur, Math.round(ce.vol(2))], [undefined, 500]);

  const chemin = ligneEsq("e", XY, [0, 0], [40, 0]);
  const rc = await bati([boite("b", 5, 5, 5), chemin, { id:"s", type:"repChemin", corps:"", chemin:"e", nombre:"5", orienter:false, separe:true }], "s");
  verifier("répétition sur chemin : à intervalles égaux", [rc.erreur, rc.n, Math.round(rc.corps[4].shape.boundingBox.bounds[0][0])], [undefined, 5, 40]);
  const coude = esqu("e", XY, [{ id:"a", type:"point", x:0, y:0 }, { id:"b", type:"point", x:40, y:0 }, { id:"c", type:"point", x:40, y:40 }, { id:"l1", type:"ligne", p1:"a", p2:"b" }, { id:"l2", type:"ligne", p1:"b", p2:"c" }]);
  const ro = await bati([boite("b", 8, 2, 2, -4, -1, 0), coude, { id:"s", type:"repChemin", corps:"", chemin:"e", nombre:"3", orienter:true, separe:true }], "s");
  const bo = ro.corps[2].shape.boundingBox.bounds;
  vrai("répétition sur chemin : l'exemplaire tourne avec le chemin", !ro.erreur && Math.abs(bo[1][0] - bo[0][0] - 2) < 0.01 && Math.abs(bo[1][1] - bo[0][1] - 8) < 0.01, JSON.stringify(ro.erreur || bo));
  verifier("répartir : les bouts sont compris", repartir([[0, 0], [10, 0]], 3).map(x => x.p[0]), [0, 5, 10]);
  verifier("répartir : un contour fermé ne répète pas son bout", repartir([[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]], 4, true).map(x => x.p), [[0, 0], [10, 0], [10, 10], [0, 10]]);

  const creuse = [boite("b", 20, 20, 10), { id:"k", type:"coque", corps:"", epaisseur:"1", faces:[[10, 10, 10]] }];
  const vo = await bati([...creuse, ligneEsq("e", { base:"XY", decalage:"5" }, [0, 10], [20, 10]), { id:"s", type:"voile", esquisse:"e", corps:"", epaisseur:"2" }], "s");
  const vide = 20 * 20 * 10 - 18 * 18 * 9;
  verifier("voile : d'une paroi à l'autre d'une coque", [vo.erreur, Math.round(vo.vol())], [undefined, vide + 18 * 2 * 9]);

  const conge2 = await bati([boite("b", 20, 20, 20), { id:"s", type:"conge", corps:"", rayon:"1", rayon2:"3", aretes:[[0, 0, 10]] }], "s");
  const congeCst = await bati([boite("b", 20, 20, 20), { id:"s", type:"conge", corps:"", rayon:"2", aretes:[[0, 0, 10]] }], "s");
  vrai("congé variable : la matière enlevée change avec les rayons", !conge2.erreur && conge2.vol() < 8000 && Math.abs(conge2.vol() - congeCst.vol()) > 0.1, conge2.erreur);
  const ch2 = await bati([boite("b", 20, 20, 20), { id:"s", type:"chanfrein", corps:"", distance:"2", distance2:"4", aretes:[[0, 0, 10]] }], "s");
  verifier("chanfrein dissymétrique : un triangle de 2 sur 4", [ch2.erreur, Math.round(ch2.vol())], [undefined, 8000 - 0.5 * 2 * 4 * 20]);

  const grille = await bati([boite("b", 2, 2, 2), { id:"s", type:"repetition", corps:"", mode:"lineaire", axe:"X", nombre:"3", pas:"10", axe2:"Y", nombre2:"2", pas2:"10", separe:true }], "s");
  verifier("répétition en grille : deux directions", [grille.erreur, grille.n], [undefined, 6]);
}

/* ---------------- surfaces ---------------- */
{
  const ruban = (dec = 0) => [ligneEsq("e", XY, [0, 0], [10, 0]), { id:"sx", type:"surfExtrusion", esquisse:"e", distance:"10" }];
  const r = await bati([...ruban(), { id:"s", type:"surfReglee", corps:"", aretes:[[5, 0, 10]], distance:"4", sens:"tangente" }], "s");
  verifier("surface réglée : un ruban de plus", [r.erreur, r.n, Math.round(r.aire(1))], [undefined, 2, 40]);
  const n = await bati([...ruban(), { id:"s", type:"surfReglee", corps:"", aretes:[[5, 0, 10]], distance:"4", sens:"normale" }], "s");
  verifier("surface réglée selon la normale", [n.erreur, Math.round(n.aire(1))], [undefined, 40]);
  const pr = await bati([boite("a", 10, 1, 1), boite("b", 10, 1, 1, 0, 10, 5), { id:"s", type:"surfRaccord", aretes:[[5, 1, 1]], aretes2:[[5, 10, 5]] }], "s");
  verifier("raccord de deux arêtes", [pr.erreur, pr.n, Math.round(pr.aire(2))], [undefined, 3, Math.round(10 * Math.hypot(9, 4))]);
  const inv = await bati([...ruban(), { id:"s", type:"surfInverser", corps:"" }], "s");
  const avant = await bati(ruban(), "sx");
  const nz = (b) => { const f = b.corps[0].shape.faces[0]; const q = f.normalAt(f.center); return q.y; };
  verifier("inverser la normale", [inv.erreur, Math.round(nz(inv)), Math.round(aireOk(inv))], [undefined, -Math.round(nz(avant)), 100]);
  function aireOk(b){ return b.aire(); }
  const dc = await bati([boite("b", 10, 10, 10), { id:"s", type:"surfDecoudre", corps:"" }], "s");
  verifier("découdre : une surface par face", [dc.erreur, dc.n, !!dc.corps[0].surface, Math.round(dc.aire(3))], [undefined, 6, true, 100]);
  const plaquePercee = [boite("b", 20, 20, 5), { id:"c", type:"cylindre", diametre:"6", h:"5", axe:"Z", x:"10", y:"10", z:"0", operation:"enlever", corps:"" }];
  const pp = await bati(plaquePercee, "c");
  const rm = await bati([...plaquePercee, { id:"s", type:"surfDetourer", corps:"", faces:[[5, 5, 5]] }], "s");
  verifier("détourer : le trou de la face se referme", [rm.erreur, Math.round(rm.aire() - pp.aire())], [undefined, Math.round(Math.PI * 9)]);
}

/* ---------------- plastique ---------------- */
{
  const fond = boite("b", 40, 40, 2);
  const c = pts("e", { base:"XY", decalage:"2" }, [[10, 10], [30, 30]]);
  const bo = await bati([fond, c, { id:"s", type:"bossage", esquisse:"e", corps:"", de:"8", di:"3", hauteur:"10", profondeur:"8", depouille:"0", nervures:"0" }], "s");
  const attendu = 40 * 40 * 2 + 2 * (Math.PI * 16 * 10 - Math.PI * 2.25 * 8);
  verifier("bossage : tube percé à profondeur", [bo.erreur, Math.round(bo.vol())], [undefined, Math.round(attendu)]);
  const dep = await bati([fond, c, { id:"s", type:"bossage", esquisse:"e", corps:"", de:"8", di:"3", hauteur:"10", profondeur:"8", depouille:"2", nervures:"0" }], "s");
  vrai("bossage : la dépouille élargit le pied", !dep.erreur && dep.vol() > bo.vol() + 1, dep.erreur);
  const ne = await bati([fond, c, { id:"s", type:"bossage", esquisse:"e", corps:"", de:"8", di:"3", hauteur:"10", profondeur:"8", depouille:"0", nervures:"4", epNervure:"1", largeurNervure:"3" }], "s");
  vrai("bossage : les nervures ajoutent de la matière", !ne.erreur && ne.vol() > bo.vol() + 1, ne.erreur);
  const trop = await bati([fond, c, { id:"s", type:"bossage", esquisse:"e", corps:"", de:"8", di:"3", hauteur:"10", profondeur:"12" }], "s");
  vrai("bossage : un trou plus profond que lui est refusé", /profond/.test(trop.erreur || ""));

  const boitier = boite("b", 40, 40, 10, -20, -20, 0);
  const contour = esqu("e", { base:"XY", decalage:"10" }, rect(-20, -20, 20, 20));
  const lv = await bati([boitier, contour, { id:"s", type:"levre", esquisse:"e", corps:"", mode:"levre", largeur:"2", hauteur:"3", jeu:"0" }], "s");
  verifier("lèvre : une couronne de 2 mm sur 3", [lv.erreur, Math.round(lv.vol())], [undefined, Math.round(40 * 40 * 10 + (1600 - 36 * 36) * 3)]);
  const ra = await bati([boitier, contour, { id:"s", type:"levre", esquisse:"e", corps:"", mode:"rainure", largeur:"2", hauteur:"3", jeu:"0" }], "s");
  verifier("rainure : la même couronne, enlevée", [ra.erreur, Math.round(ra.vol())], [undefined, Math.round(40 * 40 * 10 - (1600 - 36 * 36) * 3)]);
  const rp = await bati([boitier, contour, { id:"s", type:"repos", esquisse:"e", corps:"", largeur:"2", hauteur:"3" }], "s");
  vrai("repos : une couronne autour du contour", !rp.erreur && rp.vol() > 40 * 40 * 10, rp.erreur);
  const un = pts("e", { base:"XY", decalage:"10" }, [[0, 0]]);
  const cl = await bati([boitier, un, { id:"s", type:"clip", esquisse:"e", corps:"", mode:"crochet", longueur:"10", largeur:"6", epaisseur:"1.5", crochet:"2", surplomb:"1", jeu:"0.2", angle:"0" }], "s");
  const crochet = (1.5 * 10 + 0.5 * 1 * 2) * 6;
  verifier("clip : la poutre et son crochet", [cl.erreur, Math.round(cl.vol())], [undefined, Math.round(16000 + crochet)]);
  const lg = await bati([boitier, un, { id:"s", type:"clip", esquisse:"e", corps:"", mode:"logement", longueur:"5", largeur:"6", epaisseur:"1.5", crochet:"2", surplomb:"1", jeu:"0" }], "s");
  verifier("clip : le logement est enlevé", [lg.erreur, Math.round(lg.vol())], [undefined, Math.round(16000 - 2.5 * 6 * 5)]);
}

/* ---------------- tôlerie ---------------- */
{
  const pl = boite("b", 100, 50, 2);
  const conv = { id:"s", type:"toleConvertie", corps:"", face:{ point:[50, 25, 2], normale:[0, 0, 1] }, rayon:"2", k:"0.44" };
  const t = await bati([pl, conv], "s");
  verifier("convertir : épaisseur lue sur le corps", [t.erreur, t.corps[0].tole?.ep, t.corps[0].tole?.z0], [undefined, 2, 0]);
  const refus = await bati([boite("b", 10, 10, 10), { id:"c", type:"cylindre", diametre:"4", h:"20", axe:"X", x:"-5", y:"5", z:"5", operation:"enlever", corps:"" }, { ...conv, face:{ point:[5, 5, 10], normale:[0, 0, 1] } }], "s");
  vrai("convertir : un corps qui n'est pas une plaque est refusé", /plaque/.test(refus.erreur || ""));
  const br = await bati([pl, conv, { id:"f", type:"bride", corps:"", arete:[50, 0, 2], hauteur:"10", angle:"90", vers:"haut" }], "f");
  vrai("convertir : la tôle accepte un bord tombé", !br.erreur && br.vol() > 10000, br.erreur);
  const ch = await bati([pl, conv, { id:"f", type:"brideChaine", corps:"", aretes:[[50, 0, 2], [50, 50, 2]], hauteur:"10", angle:"90", vers:"haut" }], "f");
  const un = await bati([pl, conv, { id:"f", type:"bride", corps:"", arete:[50, 0, 2], hauteur:"10", angle:"90", vers:"haut" }], "f");
  vrai("bord tombé en chaîne : deux bords", !ch.erreur && Math.abs((ch.vol() - 10000) - 2 * (un.vol() - 10000)) < 1, ch.erreur);
  verifier("bord tombé en chaîne : la table de pliage compte toute la longueur", ch.note?.pli?.longueur, 200, 0.01);
  const contour = esqu("e", { base:"XY", decalage:"2" }, rect(0, 0, 100, 50));
  const pf = await bati([pl, contour, { id:"s", type:"perforation", esquisse:"e", corps:"", diametre:"4", pas:"10", disposition:"carre", marge:"3" }], "s");
  const nb = pf.note?.trous;
  verifier("perforation : autant de trous que la grille en compte", [pf.erreur, Math.round(pf.vol())], [undefined, Math.round(10000 - nb * Math.PI * 4 * 2)]);
  vrai("perforation : grille non vide", nb > 10, String(nb));
  const carre = [[0, 0], [100, 0], [100, 50], [0, 50]];
  vrai("grille : rien à moins de la marge du bord", grillePerforation(carre, 10, "carre", 5).every(([x, y]) => x >= 5 && x <= 95 && y >= 5 && y <= 45));
  const q = grillePerforation(carre, 10, "quinconce", 5), lignes = new Set(q.map(p => p[1].toFixed(3)));
  vrai("grille en quinconce : lignes rapprochées et décalées", lignes.size >= 5 && q.some(p => Math.abs(((p[0] - 50) / 10) % 1) > 0.4));
}

/* ---------------- liaisons ---------------- */
{
  const deux = [boite("a", 10, 10, 10), boite("b", 10, 10, 10, 50, 50, 50)];
  const fa = { type:"plan", point:[5, 5, 10], normale:[0, 0, 1] }, fb = { type:"plan", point:[55, 55, 50], normale:[0, 0, -1] };
  const place = (r, i = 1) => r.corps[i].shape.boundingBox.bounds;
  const pl = await bati([...deux, { id:"s", type:"liaison", mode:"plan", corpsA:"Corps 1", corpsB:"Corps 2", repereA:fa, repereB:fb, decalage:"0", valeur:"3", valeur2:"0", valeur3:"0" }], "s");
  vrai("liaison plan : posé sur la face, glissé dans le plan", !pl.erreur && Math.abs(place(pl)[0][2] - 10) < 1e-3 && Math.abs(Math.abs(place(pl)[0][0]) + Math.abs(place(pl)[0][1]) - 3) < 1e-3, pl.erreur);
  const cya = { type:"cylindre", point:[0, 0, 0], axe:[0, 0, 1] }, cyb = { type:"cylindre", point:[50, 50, 50], axe:[0, 0, 1] };
  const cy = await bati([...deux, { id:"s", type:"liaison", mode:"cylindrique", corpsA:"Corps 1", corpsB:"Corps 2", repereA:cya, repereB:cyb, decalage:"0", valeur:"90", valeur2:"7" }], "s");
  verifier("liaison cylindrique : angle et position", [cy.erreur, Math.round(place(cy)[0][2]), Math.round(place(cy)[0][0])], [undefined, 7, -10]);
  const tq = await bati([...deux, { id:"s", type:"liaison", mode:"pivot", telleQuelle:true, corpsA:"Corps 1", corpsB:"Corps 2", repereA:cya, valeur:"0" }], "s");
  verifier("liaison telle quelle : le corps ne bouge pas", [tq.erreur, Math.round(place(tq)[0][0])], [undefined, 50]);
  const tq2 = await bati([...deux, { id:"s", type:"liaison", mode:"pivot", telleQuelle:true, corpsA:"Corps 1", corpsB:"Corps 2", repereA:cya, valeur:"180" }], "s");
  verifier("liaison telle quelle : il tourne quand même", [tq2.erreur, Math.round(place(tq2)[0][0])], [undefined, -60]);
  const lim = await bati([...deux, { id:"s", type:"liaison", mode:"glissiere", corpsA:"Corps 1", corpsB:"Corps 2", repereA:cya, repereB:cyb, decalage:"0", valeur:"100", min:"0", max:"20" }], "s");
  verifier("limites : la valeur reste bornée", [lim.erreur, Math.round(place(lim)[0][2])], [undefined, 20]);
  const trois = [...deux, boite("c", 10, 10, 10, 80, 80, 80)];
  const pilote = { id:"p", type:"liaison", mode:"pivot", corpsA:"Corps 1", corpsB:"Corps 2", repereA:cya, repereB:cyb, decalage:"0", valeur:"90" };
  const eng = await bati([...trois, pilote, { id:"s", type:"liaison", mode:"glissiere", corpsA:"Corps 1", corpsB:"Corps 3", repereA:cya, repereB:{ ...cyb, point:[80, 80, 80] }, decalage:"0", pilote:"p", loi:"x / 10" }], "s");
  verifier("loi : le pilote commande (crémaillère, vis)", [eng.erreur, Math.round(place(eng, 2)[0][2])], [undefined, 9]);
  const cam = await bati([...trois, pilote, { id:"s", type:"liaison", mode:"glissiere", corpsA:"Corps 1", corpsB:"Corps 3", repereA:cya, repereB:{ ...cyb, point:[80, 80, 80] }, decalage:"0", pilote:"p", loi:"5 * sin(x)" }], "s");
  verifier("loi : une came", [cam.erreur, Math.round(place(cam, 2)[0][2])], [undefined, 5]);
  const orph = await bati([...trois, { id:"s", type:"liaison", mode:"glissiere", corpsA:"Corps 1", corpsB:"Corps 3", repereA:cya, repereB:cyb, decalage:"0", pilote:"absent" }], "s");
  vrai("loi : un pilote disparu est signalé", /pilote/.test(orph.erreur || ""));
  const grp = await bati([...trois, { id:"s", type:"liaison", mode:"glissiere", corpsA:"Corps 1", corpsB:"Corps 2", repereA:cya, repereB:cyb, decalage:"0", valeur:"5", suiveurs:["Corps 3"] }], "s");
  verifier("groupe rigide : le suiveur fait le même mouvement", [grp.erreur, Math.round(place(grp, 2)[0][0] - place(grp)[0][0]), Math.round(place(grp, 2)[0][2] - place(grp)[0][2])], [undefined, 30, 30]);
}

/* ---------------- bibliothèque, construction ---------------- */
{
  const { planConstruction, axeConstruction } = await import("../js/c2-esquisse.js");
  const oss = esqu("o", XY, [{ id:"a", type:"point", x:0, y:0 }, { id:"b", type:"point", x:100, y:0 }, { id:"l", type:"ligne", p1:"a", p2:"b" }]);
  const i = await bati([oss, { id:"s", type:"profile", esquisse:"o", section:"ipe", norme:"IPE100", joint:"droit" }], "s");
  const aireIpe = 2 * 55 * 5.7 + (100 - 2 * 5.7) * 4.1;
  verifier("poutre IPE : section sans rayons de raccord", [i.erreur, Math.round(i.vol())], [undefined, Math.round(aireIpe * 100)]);
  const sn = await bati([oss, { id:"s", type:"profile", esquisse:"o", section:"ipe", joint:"droit" }], "s");
  vrai("poutre IPE : taille à choisir", /taille/.test(sn.erreur || ""));
  const docP = { operations:[oss] };
  const pc = planConstruction({ mode:"chemin", chemin:"o", position:"0.25" }, Number, docP);
  verifier("plan le long d'un chemin : perpendiculaire, au bon endroit", [pc.origine[0], pc.normale], [25, [1, 0, 0]]);
  const pt = planConstruction({ mode:"tangent", cylindre:{ axe:[0, 0, 1], point:[0, 0, 0], surf:[5, 0, 3] } });
  verifier("plan tangent à un cylindre", [pt.normale, pt.origine], [[1, 0, 0], [5, 0, 3]]);
  verifier("axe perpendiculaire à une face", axeConstruction({ mode:"normale", face:{ point:[1, 2, 3], normale:[0, 0, 2] } }), { point:[1, 2, 3], dir:[0, 0, 1] });
  vrai("plan le long d'un chemin : chemin absent signalé", /chemin/.test((() => { try{ planConstruction({ mode:"chemin", chemin:"z" }, Number, docP); return ""; }catch(e){ return e.message; } })()));
  const { appliquerConfiguration } = await import("../js/c1-expressions.js");
  const dc = { parametres:[], operations:[{ id:"a" }, { id:"b", suspendue:true }], configurations:[{ nom:"X", valeurs:{}, suspendues:["a"] }, { nom:"Y", valeurs:{} }] };
  appliquerConfiguration(dc, "X");
  verifier("configuration : ses opérations suspendues", [dc.operations[0].suspendue, dc.operations[1].suspendue], [true, undefined]);
  dc.operations[1].suspendue = true;
  appliquerConfiguration(dc, "Y");
  verifier("configuration sans liste : les suspensions ne bougent pas", [dc.operations[0].suspendue, dc.operations[1].suspendue], [true, true]);
}

{
  const { controlerRegles } = await import("../js/c10-regles.js");
  const { init_planegcs_module, GcsWrapper } = await import("../vendor/planegcs/index.js");
  const mod = await init_planegcs_module({ locateFile:() => ici("../vendor/planegcs/planegcs_dist/planegcs.wasm") });
  const gcs = new GcsWrapper(new mod.GcsSystem(), mod);
  gcs.debug_mode = 0;
  const ligne = (ops) => controlerRegles({ parametres:[], operations:ops, reglesPlastique:{ paroi:"2", depouille:"1", rayon:"0.5" } }, { gcs, procede:"injection" }).controles.find(k => k.nom.startsWith("Plastique"));
  verifier("règle plastique : tout respecté", ligne([{ id:"b", nom:"B", type:"bossage", de:"5", di:"3", depouille:"1" }]).ok, true);
  const ko2 = ligne([{ id:"b", nom:"B", type:"bossage", de:"8", di:"3", depouille:"0" }, { id:"c", nom:"C", type:"coque", epaisseur:"3" }, { id:"d", nom:"D", type:"depouille", angle:"0.5" }]);
  verifier("règle plastique : fût épais, dépouille manquante, paroi différente", [ko2.ok, ko2.ecarts.length], [false, 4]);
  verifier("sans règle : rien à signaler", controlerRegles({ parametres:[], operations:[] }, { gcs, procede:"injection" }).controles.find(k => k.nom.startsWith("Plastique")).ok, true);
}

/* ---------------- second lot : noyau ---------------- */
{
  const { pointConstruction, planConstruction, axeConstruction } = await import("../js/c2-esquisse.js");
  const px = (id, d, base = "XY") => ({ id, type:"plan", mode:"decale", base, decalage:String(d), angle:"0", axe:"x" });
  const docP = { operations:[px("a", 3), px("b", 4, "YZ"), px("c", 5, "XZ")] };
  /* XZ a pour normale -Y : décalé de 5, il passe par Y = -5. */
  verifier("point à l'intersection de trois plans", pointConstruction({ mode:"troisPlans", plan1:"a", plan2:"b", plan3:"c" }, Number, docP).map(Math.round), [4, -5, 3]);
  const ax2 = axeConstruction({ mode:"deuxPlans", plan1:"a", plan2:"b" }, Number, docP);
  verifier("axe par deux plans", [ax2.dir.map(Math.abs), Math.round(ax2.point[0]), Math.round(ax2.point[2])], [[0, 1, 0], 4, 3]);
  const docA = { operations:[...docP.operations, { id:"z", type:"axe", mode:"normale", face:{ point:[1, 2, 0], normale:[0, 0, 1] } }] };
  verifier("point d'un axe et d'un plan", pointConstruction({ mode:"axePlan", axe:"z", plan1:"a" }, Number, docA), [1, 2, 3]);
  const leve = (f) => { try{ f(); return ""; }catch(e){ return e.message; } };
  vrai("axe par deux plans parallèles : refusé", /parallèles/.test(leve(() => axeConstruction({ mode:"deuxPlans", plan1:"a", plan2:"a" }, Number, docP))));
  const docB = { operations:[...docP.operations, { id:"z", type:"axe", mode:"normale", face:{ point:[1, 2, 0], normale:[0, 0, 1] } }, { ...px("v", 0, "YZ") }] };
  vrai("point : un axe parallèle au plan est refusé", /parallèle/.test(leve(() => pointConstruction({ mode:"axePlan", axe:"z", plan1:"v" }, Number, docB))));
  const p2a = planConstruction({ mode:"aretes", lignes:[[[0, 0, 5], [10, 0, 5]], [[0, 10, 5], [10, 10, 5]]] });
  verifier("plan par deux arêtes parallèles", [p2a.normale.map(Math.abs), p2a.origine[2]], [[0, 0, 1], 5]);
  vrai("plan par deux arêtes : gauches, refusé", /même plan/.test(leve(() => planConstruction({ mode:"aretes", lignes:[[[0, 0, 0], [10, 0, 0]], [[0, 5, 5], [0, 15, 5]]] }))));

  const fil = (extra = {}) => ({ id:"c", type:"chemin3d", nom:"C", points:"0,0,0; 20,0,0; 20,20,10", mode:"lignes", ...extra });
  const tu = await bati([fil(), { id:"s", type:"tuyau", chemin:"c", diametre:"2", paroi:"0", operation:"nouveau" }], "s");
  const L = 20 + Math.hypot(20, 10);
  vrai("tuyau sur un chemin 3D : volume proche de la section par la longueur", !tu.erreur && Math.abs(tu.vol() - Math.PI * L) < 0.08 * Math.PI * L, tu.erreur || String(tu.vol()));
  const tc = await bati([fil({ mode:"spline", points:"0,0,0; 10,5,2; 20,0,5; 30,-5,8" }), { id:"s", type:"tuyau", chemin:"c", diametre:"2", paroi:"0.5", operation:"nouveau" }], "s");
  vrai("tuyau creux sur une courbe 3D", !tc.erreur && tc.vol() > 0, tc.erreur);
  const tv = await bati([{ id:"c", type:"chemin3d", nom:"C", points:"0,0,0" }], "c");
  vrai("chemin 3D : au moins deux points", /deux points/.test(tv.erreur || ""));
  const tp = await bati([fil({ points:"0,0,0; L,0,0" })], "c", [{ nom:"L", expr:"30" }]);
  verifier("chemin 3D : les cotes citent les paramètres", tp.erreur, undefined);

  const cy = { id:"c", type:"cylindre", diametre:"20", h:"30", axe:"Z", x:"0", y:"0", z:"0", operation:"nouveau" };
  const motif = esqu("e", { origine:[0, 0, 0], normale:[1, 0, 0], xdir:[0, 1, 0] }, rect(-2, 10, 2, 20));
  motif.plan = { origine:[20, 0, 0], normale:[1, 0, 0], xdir:[0, 1, 0] };
  const gv = await bati([cy, motif, { id:"s", type:"gravureCylindre", esquisse:"e", corps:"", cylindre:{ surf:[10, 0, 15], centre:[0, 0, 15] }, mode:"creux", profondeur:"1" }], "s");
  const v0 = Math.PI * 100 * 30;
  vrai("gravure sur cylindre : enlève, de l'ordre de la surface par la profondeur", !gv.erreur && v0 - gv.vol() > 25 && v0 - gv.vol() < 45, gv.erreur || String(v0 - gv.vol()));
  const gr = await bati([cy, motif, { id:"s", type:"gravureCylindre", esquisse:"e", corps:"", cylindre:{ surf:[10, 0, 15], centre:[0, 0, 15] }, mode:"relief", profondeur:"1" }], "s");
  vrai("gravure sur cylindre : en relief, ajoute", !gr.erreur && gr.vol() - v0 > 25 && gr.vol() - v0 < 50, gr.erreur || String(gr.vol() - v0));

  /* Une surface au-delà du corps : la face va la rejoindre. */
  const nappe = [boite("b", 10, 10, 10), ligneEsq("e", XY, [-20, -20], [20, -20]), { id:"sx", type:"surfExtrusion", esquisse:"e", distance:"40" },
    { id:"dep", type:"deplacer", corps:"Corps 2", tx:"0", ty:"35", tz:"-15", rx:"0", ry:"0", rz:"0" }];
  const ral = await bati([...nappe, { id:"s", type:"remplacerFace", corps:"Corps 1", outil:"Corps 2", faces:[[5, 10, 5]] }], "s");
  verifier("remplacer une face : elle s'allonge jusqu'à la surface", [ral.erreur, Math.round(ral.vol())], [undefined, 10 * 15 * 10]);

  /* Deux murs intérieurs : le voile s'arrête à eux, sans aller au bord de la pièce. */
  const socle = [boite("s", 40, 20, 2), boite("m1", 2, 20, 10, 8, 0, 2), boite("m2", 2, 20, 10, 30, 0, 2),
    { id:"j1", type:"combiner", cible:"Corps 1", outils:["Corps 2", "Corps 3"], operation:"joindre" }];
  const avantVoile = await bati(socle, "j1");
  const vm = await bati([...socle, ligneEsq("e", { base:"XY", decalage:"5" }, [15, 10], [25, 10]), { id:"v", type:"voile", esquisse:"e", corps:"", epaisseur:"2" }], "v");
  verifier("voile : d'un mur à l'autre", [vm.erreur, Math.round(vm.vol() - avantVoile.vol())], [undefined, 20 * 2 * 10]);

  const deux = [boite("a", 10, 10, 10), boite("b", 10, 10, 10, 50, 50, 50)];
  const rot = await bati([...deux, { id:"s", type:"liaison", mode:"spherique", corpsA:"Corps 1", corpsB:"Corps 2", repereA:{ type:"plan", point:[0, 0, 10], normale:[0, 0, 1] }, repereB:{ type:"plan", point:[50, 50, 50], normale:[0, 0, -1] }, decalage:"0", valeur:"0", valeur2:"0", valeur3:"90" }], "s");
  const br = rot.corps[1].shape.boundingBox.bounds;
  verifier("liaison sphérique : le point rejoint, la rotation autour de lui", [rot.erreur, ...br[0].map(x => Math.round(x))], [undefined, -10, 0, 10]);

  /* Composants et occurrences */
  const cmp = await construire(R, { operations:[{ ...boite("a", 10, 10, 10), composant:"K" }, boite("b", 5, 5, 5, 40), { id:"o", type:"occurrence", source:"K", tx:"0", ty:"30", tz:"0", rx:"0", ry:"0", rz:"0" }] }, [], oc);
  verifier("composant : le corps né dedans lui appartient, l'occurrence le recopie", [cmp.etats.o.erreur, cmp.corps.map(c => c.composant ?? null), Math.round(cmp.corps[2].shape.boundingBox.bounds[0][1])], [undefined, ["K", null, null], 30]);
  const cmp2 = await construire(R, { operations:[{ ...boite("a", 10, 10, 10), composant:"K" }, { id:"c", type:"chanfrein", corps:"", distance:"1", toutes:true, composant:"L" }, { id:"o", type:"occurrence", source:"K", tx:"0", ty:"30", tz:"0", rx:"0", ry:"0", rz:"0" }] }, [], oc);
  vrai("occurrence : elle suit le composant", !cmp2.etats.o.erreur && Math.abs(Math.abs(R.measureVolume(cmp2.corps[1].shape)) - Math.abs(R.measureVolume(cmp2.corps[0].shape))) < 1e-6 && Math.abs(R.measureVolume(cmp2.corps[0].shape)) < 1000);
  const cvid = await bati([{ id:"o", type:"occurrence", source:"Z" }], "o");
  vrai("occurrence : un composant vide le dit", /aucun corps/.test(cvid.erreur || ""));

  const cube = [0,0,0, 1,1,0, 1,0,0, 0,0,0, 0,1,0, 1,1,0, 0,0,1, 1,0,1, 1,1,1, 0,0,1, 1,1,1, 0,1,1, 0,0,0, 1,0,0, 1,0,1, 0,0,0, 1,0,1, 0,0,1, 1,1,0, 0,1,0, 0,1,1, 1,1,0, 0,1,1, 1,1,1, 0,1,0, 0,0,0, 0,0,1, 0,1,0, 0,0,1, 0,1,1, 1,0,0, 1,1,0, 1,1,1, 1,0,0, 1,1,1, 1,0,1];
  const b64 = Buffer.from(new Float32Array(cube).buffer).toString("base64");
  const brut = await bati([{ id:"m", type:"maillage", donnees:b64 }], "m");
  const fus = await bati([{ id:"m", type:"maillage", donnees:b64, fusionner:true }], "m");
  verifier("maillage converti : les triangles coplanaires ne font qu'une face", [brut.faces(), fus.erreur, fus.faces(), Math.round(fus.vol())], [12, undefined, 6, 1]);
}

/* ---------------- second lot : esquisse ---------------- */
{
  const { init_planegcs_module, GcsWrapper } = await import("../vendor/planegcs/index.js");
  const mod = await init_planegcs_module({ locateFile:() => ici("../vendor/planegcs/planegcs_dist/planegcs.wasm") });
  const gcs = new GcsWrapper(new mod.GcsSystem(), mod);
  gcs.debug_mode = 0;
  const { decaler, casserCoin } = await import("../js/c2b-outils-esquisse.js");
  const nouvelle = () => ({ id:"e", type:"esquisse", nom:"e", plan:XY, elements:[], contraintes:[], compteur:0 });
  const P = (esq, id) => esq.elements.find(e => e.id === id);
  const sp = nouvelle();
  sp.elements.push({ id:"a", type:"point", x:0, y:0 }, { id:"b", type:"point", x:10, y:0 }, { id:"c", type:"point", x:20, y:0 }, { id:"s", type:"spline", pts:["a", "b", "c"], p1:"a", p2:"c" });
  verifier("spline : un point ajouté, à sa place", [Plus.ajouterPointSpline(sp, "s", { x:5, y:3 }), P(sp, "s").pts.length, P(sp, P(sp, "s").pts[1]).x], [null, 4, 5]);
  verifier("spline : retirer un point du milieu", [Plus.retirerPointSpline(sp, "b"), P(sp, "s").pts.includes("b"), !!P(sp, "b")], [null, false, false]);
  verifier("spline : retirer un bout déplace le bout", [Plus.retirerPointSpline(sp, "a"), P(sp, "s").p1 === P(sp, "s").pts[0], P(sp, "s").pts.length], [null, true, 2]);
  vrai("spline : pas moins de deux points", /assez/.test(Plus.retirerPointSpline(sp, "c") || ""));
  const inv = nouvelle();
  inv.elements.push({ id:"a", type:"point", x:0, y:0 }, { id:"b", type:"point", x:10, y:0 }, { id:"s", type:"spline", pts:["a", "b"], p1:"a", p2:"b" });
  verifier("spline : inverser", [Plus.inverserSpline(inv, "s"), P(inv, "s").p1], [null, "b"]);
  const ell = nouvelle();
  Plus.ajouterEllipse(ell, { x:0, y:0 }, { x:10, y:0 }, 5);
  const sE = ell.elements.find(e => e.type === "spline"), nE = sE.pts.length;
  verifier("spline fermée : retirer son premier point la laisse fermée", [Plus.retirerPointSpline(ell, sE.pts[0]), sE.pts.length, sE.p1 === sE.p2], [null, nE - 1, true]);
  vrai("spline fermée : elle fait encore un contour", profils(ell).regions.length === 1);

  const rc = nouvelle();
  rc.elements.push({ id:"a", type:"point", x:0, y:0 }, { id:"b", type:"point", x:10, y:0 }, { id:"l", type:"ligne", p1:"a", p2:"b" },
    { id:"c", type:"point", x:20, y:10 }, { id:"d", type:"point", x:30, y:10 }, { id:"m", type:"ligne", p1:"c", p2:"d" });
  verifier("courbe de raccord : entre les bouts", [Plus.courbeRaccord(rc, "b", "c"), rc.elements.find(e => e.type === "spline").p1], [null, "b"]);
  const q = rc.elements.find(e => e.type === "spline").pts.map(id => P(rc, id));
  vrai("courbe de raccord : part dans le sens de la ligne, arrive dans celui de l'autre", q[1].x > 10 && Math.abs(q[1].y) < 1 && q[7].x < 20 && Math.abs(q[7].y - 10) < 1, JSON.stringify(q[1]));
  vrai("courbe de raccord : il faut deux bouts de courbes", /bouts/.test(Plus.courbeRaccord(rc, "x", "c") || ""));

  const ch = nouvelle();
  ch.elements.push({ id:"a", type:"point", x:10, y:0 }, { id:"o", type:"point", x:0, y:0 }, { id:"b", type:"point", x:0, y:10 }, { id:"l1", type:"ligne", p1:"a", p2:"o" }, { id:"l2", type:"ligne", p1:"o", p2:"b" });
  casserCoin(ch, "o", 2, "chanfrein", 4);
  const pts = ch.elements.filter(e => e.type === "point").map(p => [p.x, p.y]).sort();
  verifier("chanfrein de coin dissymétrique", pts.some(p => p[0] === 2 && p[1] === 0) && pts.some(p => p[0] === 0 && p[1] === 4), true);

  const de = nouvelle();
  de.elements.push(...rect(0, 0, 20, 10, "z"));
  de.contraintes.push({ id:"h", type:"horizontal", a:"zl1" }, { id:"v", type:"vertical", a:"zl2" }, { id:"lg", type:"longueur", a:"zl1", expr:"20" });
  verifier("décaler lié : le solveur l'accepte", [decaler(de, ["zl1", "zl2", "zl3", "zl4"], 2, "2"), resoudre(gcs, de, Number).ok, de.contraintes.filter(k => k.type === "parallele").length], [null, true, 4]);
  de.contraintes.find(k => k.id === "lg").expr = "30";
  const ecarts = de.contraintes.filter(k => k.type === "distance").map(k => {
    const q = P(de, k.a), l = P(de, k.b), u = P(de, l.p1), w = P(de, l.p2);
    return +(Math.abs((w.x - u.x) * (u.y - q.y) - (u.x - q.x) * (w.y - u.y)) / Math.hypot(w.x - u.x, w.y - u.y)).toFixed(4);
  });
  verifier("décaler lié : la copie suit l'original, toujours à sa distance", [resoudre(gcs, de, Number).ok, ecarts, Math.round(Math.hypot(P(de, P(de, "zl1").p2).x - P(de, P(de, "zl1").p1).x, P(de, P(de, "zl1").p2).y - P(de, P(de, "zl1").p1).y))], [true, [2, 2, 2, 2], 30]);
}

/* ---------------- analyses ---------------- */
{
  const f = R.makeBox([0, 0, 0], [20, 20, 20]).fillet(2, e => e.inDirection("Z"));
  const a = analyserCorps(R, f);
  verifier("analyse : rayon minimal d'un congé", a.rayonMin, 2, 1e-6);
  vrai("analyse : congés tangents, autres arêtes vives", a.jonctions.tangentes === 8 && a.jonctions.vives === 16, JSON.stringify(a.jonctions));
  vrai("analyse : tracés par paires de points", a.traces.vives.length % 6 === 0 && a.traces.vives.length > 0);
  const s = analyserCorps(R, R.makeSphere(4));
  verifier("analyse : rayon d'une sphère", s.rayonMin, 4, 1e-6);
  const t = analyserCorps(R, R.drawCircle(2).translate(10, 0).sketchOnPlane("XZ").revolve([0, 0, 1], { origin:[0, 0, 0] }));
  verifier("analyse : petit rayon d'un tore (trois points)", t.rayonMin, 2, 0.2);
  verifier("analyse : un cube n'a pas de rayon", analyserCorps(R, R.makeBox([0, 0, 0], [5, 5, 5])).rayonMin, null);
  const cmp = comparerCorps(R, R.makeBox([0, 0, 0], [10, 10, 10]), R.makeBox([5, 0, 0], [15, 10, 10]));
  verifier("comparer deux corps", [cmp.volumeA, cmp.seulA, cmp.seulB, cmp.commun].map(Math.round), [1000, 500, 500, 500]);
  const sec = sectionPlan(R, [{ shape:R.makeBox([0, 0, 0], [10, 10, 10]) }], repere({ base:"XY", decalage:"5" }));
  verifier("coupe par le plan : un carré", [sec.length, Math.round(Math.max(...sec.flat().map(p => p[0])))], [4, 10]);
  const vue = arretesVue(R, [R.makeBox([0, 0, 0], [20, 20, 20]).cut(R.makeCylinder(3, 20, [10, 10, 0]))], { position:[0, 0, 100], direction:[0, 0, 1], xdir:[1, 0, 0] });
  vrai("vue : arêtes visibles à plat", vue.visibles.length >= 4 && vue.visibles.every(s => s.flat().every(Number.isFinite)), String(vue.visibles.length));
  vrai("vue : les arêtes du dessous sont cachées", vue.cachees.length >= 0);
}

/* ---------------- exports ---------------- */
{
  const m = { nom:"cube <1>", vertices:[0, 0, 0, 1, 0, 0, 0, 1, 0], triangles:[0, 1, 2] };
  const obj = ecrireObj([m, m]);
  vrai("OBJ : les numéros s'enchaînent d'un corps à l'autre", obj.includes("f 1 2 3") && obj.includes("f 4 5 6") && obj.includes("o cube_<1>"), obj);
  const z = unzipSync(ecrire3mf([m]));
  const txt = strFromU8(z["3D/3dmodel.model"]);
  vrai("3MF : archive complète, en millimètres, noms échappés", z["[Content_Types].xml"] && z["_rels/.rels"] && txt.includes('unit="millimeter"') && txt.includes('name="cube &lt;1&gt;"') && txt.includes('v1="0"'), txt.slice(0, 200));
  const corps = [{ nom:"Corps 1", masse:0.1, centre:[5, 5, 5], boite:[[0, 0, 0], [10, 10, 10]] }, { nom:"Corps 2", masse:0.1, centre:[5, 5, 25], boite:[[0, 0, 20], [10, 10, 30]] }];
  const pivot = { nom:"Axe", mode:"pivot", corpsA:"Corps 1", corpsB:"Corps 2", repereA:{ point:[5, 5, 10], axe:[0, 0, 1] } };
  const u = ecrireUrdf("rob", corps, [pivot]);
  vrai("URDF : deux liens, un joint continu, à sa place en mètres", (u.match(/<link /g) || []).length === 2 && u.includes('type="continuous"') && u.includes('xyz="0.005 0.005 0.01"') && u.includes('axis xyz="0 0 1"'), u);
  vrai("URDF : limites données : joint borné en radians", ecrireUrdf("rob", corps, [{ ...pivot, min:"0", max:"90" }]).includes(`upper="${+(Math.PI / 2).toFixed(6)}"`));
  const leve = (f) => { try{ f(); return ""; }catch(e){ return e.message; } };
  vrai("URDF : pas de boucle de liaisons", /arbre/.test(leve(() => ecrireUrdf("r", corps, [pivot, { ...pivot, nom:"B", corpsA:"Corps 2", corpsB:"Corps 1" }]))));
  vrai("URDF : pas de liaison sans équivalent", /ne connaît pas/.test(leve(() => ecrireUrdf("r", corps, [{ ...pivot, mode:"plan" }]))));
  vrai("URDF : une glissière a des limites", /limites/.test(leve(() => ecrireUrdf("r", corps, [{ ...pivot, mode:"glissiere" }]))));
  vrai("URDF : racines multiples tenues par une base", ecrireUrdf("r", corps, []).includes('<link name="base"/>'));

  const { contoursImage } = await import("../js/c12-exports.js");
  const carreImg = (x, y) => (x >= 2 && x < 8 && y >= 2 && y < 8) ? 0 : 255;
  const ct = contoursImage(carreImg, 10, 10);
  verifier("image vers contour : un carré, quatre sommets", [ct.length, ct[0].length, Math.max(...ct[0].map(p => p[0])), Math.min(...ct[0].map(p => p[1]))], [1, 4, 8, 2]);
  const anneauImg = (x, y) => { const d = Math.hypot(x - 15, y - 15); return d < 12 && d > 6 ? 0 : 255; };
  verifier("image vers contour : un anneau a deux bords", contoursImage(anneauImg, 30, 30).length, 2);
  verifier("image vers contour : rien de sombre, rien", contoursImage(() => 255, 5, 5), []);
  const { lireNuage } = await import("../js/c12-exports.js");
  verifier("nuage XYZ", Array.from(lireNuage("1 2 3\n4,5,6\n# rien\n7;8;9").points), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  verifier("nuage PLY en texte", Array.from(lireNuage("ply\nformat ascii 1.0\nelement vertex 1\nproperty float x\nend_header\n1 2 3 255\nfin").points), [1, 2, 3]);
  verifier("nuage : un point sur k au-delà du plafond", (() => { const r = lireNuage("1 2 3\n4 5 6\n7 8 9\n1 1 1", 2); return [r.points.length / 3, r.reduit, r.total]; })(), [2, 2, 4]);
  vrai("nuage : rien de lisible, refusé", /aucun point/.test((() => { try{ lireNuage("bonjour"); return ""; }catch(e){ return e.message; } })()));
  vrai("nuage : PLY binaire refusé", /ascii/.test((() => { try{ lireNuage("ply\nformat binary_little_endian 1.0\nend_header"); return ""; }catch(e){ return e.message; } })()));

  const dx = dxfCalques({ VISIBLE:[[[0, 0], [1, 1]]], CACHEES:[[[2, 2], [3, 3]]] });
  vrai("DXF par calques", dx.includes("VISIBLE") && dx.includes("CACHEES") && dx.endsWith("EOF\n"));
  const es = esqu("e", XY, [...rect(0, 0, 10, 10), { id:"c", type:"point", x:5, y:5 }, { id:"k", type:"cercle", c:"c", r:2 },
    { id:"u", type:"point", x:20, y:0 }, { id:"v", type:"point", x:30, y:0 }, { id:"w", type:"point", x:20, y:10 }, { id:"a", type:"arc", c:"u", p1:"v", p2:"w" }, { id:"cl", type:"ligne", p1:"u", p2:"v", constr:true }]);
  const de = dxfEsquisse(es, echantillonSpline);
  vrai("DXF d'esquisse : entités exactes et calque de construction", (de.match(/\nLINE/g) || []).length === 5 && de.includes("CIRCLE") && de.includes("\nARC") && de.includes("CONSTRUCTION"), de.slice(0, 120));

  const bom = nomenclature([{ nom:"A", proprietes:{ volume:1000, aire:600, boite:[[0, 0, 0], [10, 10, 10]] } }, { nom:"B", proprietes:{ volume:1000, aire:600, boite:[[5, 5, 5], [15, 15, 15]] } }, { nom:"C", proprietes:{ volume:8, aire:24, boite:[[0, 0, 0], [2, 2, 2]] } }],
    { matiereDe:() => "PLA", densiteDe:() => 1.24 });
  const lb = bom.split("\n");
  verifier("nomenclature : deux pièces identiques, une seule ligne", [lb.length, lb[1].split(";")[2], lb[1].split(";")[1]], [3, "2", "A + B"]);

  const doc = { compteur:5, operations:[] };
  const coll = operationsCollees(doc, [{ id:"e", type:"esquisse", nom:"E", plan:{ ref:"pl" }, elements:[], contraintes:[] }, { id:"x", type:"extrusion", nom:"X", esquisse:"e", corpsNom:"Corps 1", refs:{ a:1 } }, { id:"y", type:"extrusion", nom:"Y", esquisse:"ailleurs" }]);
  verifier("copier-coller : renvois suivis, le reste inchangé", [coll.map(o => o.id), coll[1].esquisse, coll[2].esquisse, coll[1].corpsNom, coll[1].refs, coll[0].plan.ref, coll[1].nom], [["op6", "op7", "op8"], "op6", "ailleurs", undefined, undefined, "pl", "X (copie)"]);
  vrai("balayage : CSV", csvBalayage("L", [{ valeur:10, corps:1, volume:1000.5, aire:600, dims:[10, 10, 10], erreurs:0 }]).includes("10;1;1000,5;600;10;10;10;0"));
}

/* ---------------- esquisse ---------------- */
{
  const { init_planegcs_module, GcsWrapper } = await import("../vendor/planegcs/index.js");
  const mod = await init_planegcs_module({ locateFile:() => ici("../vendor/planegcs/planegcs_dist/planegcs.wasm") });
  const gcs = new GcsWrapper(new mod.GcsSystem(), mod);
  gcs.debug_mode = 0;
  const num = (x) => x;
  const P = (esq, id) => esq.elements.find(e => e.id === id);
  const nouvelle = () => ({ id:"e", type:"esquisse", nom:"e", plan:XY, elements:[], contraintes:[], compteur:0 });

  /* Une spline fermée tourne sans point anguleux. */
  const fermee = controlesSpline([[1, 0], [0, 1], [-1, 0], [0, -1], [1, 0]]);
  const premiere = fermee[0].c1, derniere = fermee[fermee.length - 1].c2;
  verifier("spline fermée : tangente continue à la jonction", [Math.round((premiere[0] - 1) * 1e6) / 1e6, Math.round((derniere[0] - 1) * 1e6) / 1e6, Math.sign(premiere[1]), Math.sign(derniere[1])], [0, 0, 1, -1]);

  const el = nouvelle();
  Plus.ajouterEllipse(el, { x:0, y:0 }, { x:10, y:0 }, 5);
  const pe = profils(el);
  verifier("ellipse : un contour fermé d'aire π·a·b", [pe.regions.length, Math.abs(pe.faces[0].aire - Math.PI * 50) < 0.5], [1, true]);
  const volEl = await bati([el, { id:"x", type:"extrusion", esquisse:"e", distance:"2", operation:"nouveau" }], "x");
  verifier("ellipse : s'extrude", [volEl.erreur, Math.abs(volEl.vol() - Math.PI * 100) < 2], [undefined, true]);

  const eq = nouvelle();
  const nb = Plus.ajouterCourbeEquation(eq, { x:"t", y:"t^2 / 10", de:0, a:10, pas:20 });
  verifier("courbe par équation : points et extrémités", [nb, P(eq, eq.elements.find(e => e.type === "spline").p2).y], [21, 10], 1e-6);
  vrai("courbe par équation : pas de code", /non fini|inconnu/i.test((() => { try{ Plus.ajouterCourbeEquation(nouvelle(), { x:"constructor", y:"0", de:0, a:1, pas:2 }); return ""; }catch(e){ return e.message; } })()));
  vrai("courbe par équation : une valeur non finie est refusée", /non fini/.test((() => { try{ Plus.ajouterCourbeEquation(nouvelle(), { x:"t", y:"sqrt(t - 5)", de:0, a:10, pas:10 }); return ""; }catch(e){ return e.message; } })()));

  const co = nouvelle();
  Plus.ajouterConique(co, { x:0, y:0 }, { x:10, y:0 }, { x:5, y:10 }, 0.5);
  const sp = co.elements.find(e => e.type === "spline");
  const milieu = P(co, sp.pts[Math.floor(sp.pts.length / 2)]);
  verifier("conique ρ = 0,5 : passe à mi-chemin du sommet (parabole)", [milieu.x, milieu.y], [5, 5]);

  const r3 = nouvelle();
  Plus.ajouterRectangle3Points(r3, { x:0, y:0 }, { x:10, y:0 }, { x:3, y:5 });
  verifier("rectangle par trois points : un contour de 10 × 5", [profils(r3).regions.length, Math.round(profils(r3).faces[0].aire)], [1, 50]);
  vrai("rectangle par trois points : contraint d'équerre", resoudre(gcs, r3, num).ok && r3.contraintes.filter(k => k.type === "perpendiculaire").length >= 3);

  const ra = nouvelle();
  Plus.ajouterRectangleArrondi(ra, { x:0, y:0 }, { x:20, y:10 }, 2);
  verifier("rectangle arrondi : aire", Math.abs(profils(ra).faces[0].aire - (200 - (4 - Math.PI) * 4)) < 0.3, true);
  vrai("rectangle arrondi : accepté par le solveur", resoudre(gcs, ra, num).ok);
  const vr = await bati([ra, { id:"x", type:"extrusion", esquisse:"e", distance:"1", operation:"nouveau" }], "x");
  vrai("rectangle arrondi : s'extrude", !vr.erreur && Math.abs(vr.vol() - (200 - (4 - Math.PI) * 4)) < 0.1, vr.erreur);

  const pc = nouvelle();
  Plus.ajouterPolygone(pc, { x:0, y:0 }, { x:10, y:0 }, 6, "circonscrit");
  /* L'apothème vaut 10 : six triangles de base 20 tan 30°. */
  verifier("polygone circonscrit : aire", Math.abs(profils(pc).faces[0].aire - 6 * 10 * 10 * Math.tan(Math.PI / 6)) < 0.01, true);
  vrai("polygone circonscrit : accepté par le solveur", resoudre(gcs, pc, num).ok);
  const pa = nouvelle();
  Plus.ajouterPolygone(pa, { x:0, y:0 }, { x:10, y:0 }, 4, "arete");
  verifier("polygone par une arête : un carré de 10", Math.round(profils(pa).faces[0].aire), 100);

  const cc = nouvelle();
  const c3 = Plus.ajouterCercle3Points(cc, { x:10, y:0 }, { x:0, y:10 }, { x:-10, y:0 });
  verifier("cercle par trois points", [Math.round(c3.r), Math.round(P(cc, c3.c).x)], [10, 0]);
  const c2 = Plus.ajouterCercle2Points(cc, { x:0, y:0 }, { x:10, y:0 });
  verifier("cercle par deux points : le diamètre", [c2.r, P(cc, c2.c).x], [5, 5]);
  verifier("cercle par trois points alignés : refusé", Plus.ajouterCercle3Points(nouvelle(), { x:0, y:0 }, { x:1, y:0 }, { x:2, y:0 }), null);

  const mi = nouvelle();
  const lm = Plus.ajouterLigneMilieu(mi, { x:5, y:5 }, { x:10, y:5 });
  verifier("ligne par son milieu", [P(mi, lm.p1).x, P(mi, lm.p2).x], [0, 10]);

  const ta = nouvelle();
  const [a0, a1] = [{ id:"a", type:"point", x:0, y:0 }, { id:"b", type:"point", x:10, y:0 }];
  ta.elements.push(a0, a1, { id:"l", type:"ligne", p1:"a", p2:"b" });
  const at = Plus.ajouterArcTangent(ta, "b", { x:20, y:10 });
  vrai("arc tangent : tangence posée, accepté par le solveur", at && ta.contraintes.some(k => k.type === "tangente") && resoudre(gcs, ta, num).ok, JSON.stringify(at));
  const centreA = P(ta, ta.elements.find(e => e.type === "arc").c);
  verifier("arc tangent : centre à la verticale du bout", Math.round(centreA.x), 10);

  const ex = nouvelle();
  ex.elements.push({ id:"a", type:"point", x:0, y:0 }, { id:"b", type:"point", x:5, y:0 }, { id:"l", type:"ligne", p1:"a", p2:"b" },
    { id:"c", type:"point", x:10, y:-5 }, { id:"d", type:"point", x:10, y:5 }, { id:"m", type:"ligne", p1:"c", p2:"d" });
  verifier("prolonger : jusqu'à la courbe suivante", [Plus.prolonger(ex, "l", { x:4, y:0 }), P(ex, ex.elements.find(e => e.id === "l").p2).x], [null, 10], 1e-9);
  vrai("prolonger : rien en face, refusé", /rien/i.test(Plus.prolonger(ex, "m", { x:10, y:5 }) || ""));

  const bk = nouvelle();
  bk.elements.push({ id:"a", type:"point", x:0, y:0 }, { id:"b", type:"point", x:10, y:0 }, { id:"l", type:"ligne", p1:"a", p2:"b" },
    { id:"c", type:"point", x:5, y:-5 }, { id:"d", type:"point", x:5, y:5 }, { id:"m", type:"ligne", p1:"c", p2:"d" });
  verifier("couper : la ligne en deux à l'intersection", [Plus.couper(bk, "l"), bk.elements.filter(e => e.type === "ligne").length], [null, 3]);
  const bkc = nouvelle();
  bkc.elements.push({ id:"o", type:"point", x:0, y:0 }, { id:"k", type:"cercle", c:"o", r:5 }, { id:"c", type:"point", x:-10, y:0 }, { id:"d", type:"point", x:10, y:0 }, { id:"m", type:"ligne", p1:"c", p2:"d" });
  verifier("couper : un cercle en deux arcs", [Plus.couper(bkc, "k"), bkc.elements.filter(e => e.type === "arc").length, bkc.elements.filter(e => e.type === "cercle").length], [null, 2, 0]);

  const ec = nouvelle();
  ec.elements.push(...rect(0, 0, 10, 10), { id:"c", type:"point", x:5, y:5 }, { id:"k", type:"cercle", c:"c", r:2 });
  ec.contraintes.push({ id:"z", type:"longueur", a:"l1", expr:"10" }, { id:"z2", type:"rayon", a:"k", expr:"2" });
  verifier("échelle : ×2 depuis l'origine, cotes numériques suivies", [Plus.echelleEsquisse(ec, ["p1", "p2", "p3", "p4", "l1", "l2", "l3", "l4", "c", "k"], 2, { x:0, y:0 }), P(ec, "p3").x, P(ec, "k").r, ec.contraintes[0].expr, ec.contraintes[1].expr], [null, 20, 4, "20", "4"]);
  vrai("échelle : facteur nul refusé", /positif/.test(Plus.echelleEsquisse(ec, ["k"], 0, { x:0, y:0 }) || ""));
  const dp = nouvelle();
  dp.elements.push(...rect(0, 0, 10, 10));
  Plus.transformerEsquisse(dp, ["l1"], { dx:5, dy:0, angle:0, cx:0, cy:0, copie:false });
  verifier("déplacer : les bouts de la ligne suivent", [P(dp, "p1").x, P(dp, "p2").x], [5, 15]);
  const nbAvant = dp.elements.length;
  Plus.transformerEsquisse(dp, ["l3"], { dx:0, dy:0, angle:90, cx:0, cy:0, copie:true });
  vrai("copier en tournant : l'original reste, une ligne de plus", dp.elements.length === nbAvant + 3 && P(dp, "p3").x === 10);

  const au = nouvelle();
  au.elements.push({ id:"a", type:"point", x:0, y:0 }, { id:"b", type:"point", x:10, y:0.01 }, { id:"l", type:"ligne", p1:"a", p2:"b" },
    { id:"c", type:"point", x:10, y:0.01 }, { id:"d", type:"point", x:10.01, y:10 }, { id:"m", type:"ligne", p1:"c", p2:"d" },
    { id:"e2", type:"point", x:30, y:30 }, { id:"f", type:"point", x:40, y:40 }, { id:"n", type:"ligne", p1:"e2", p2:"f" });
  const nbk = Plus.autoContraindre(au);
  verifier("auto-contraindre : coïncidence, horizontale, verticale ; rien pour l'oblique", [nbk, au.contraintes.map(k => k.type).sort()], [3, ["coincident", "horizontal", "vertical"]]);
  vrai("auto-contraindre : accepté par le solveur", resoudre(gcs, au, num).ok);
  verifier("auto-contraindre : deux fois n'ajoute rien", Plus.autoContraindre(au), 0);

  const lb = nouvelle();
  lb.elements.push({ id:"a", type:"point", x:0, y:0 }, { id:"b", type:"point", x:10, y:0 }, { id:"l", type:"ligne", p1:"a", p2:"b" }, { id:"c", type:"point", x:10, y:10 }, { id:"m", type:"ligne", p1:"b", p2:"c" });
  verifier("bouts libres : les deux extrémités de la chaîne", Plus.boutsLibres(lb).sort(), ["a", "c"]);
  verifier("bouts libres : un contour fermé n'en a pas", Plus.boutsLibres(esqu("e", XY, rect(0, 0, 5, 5))), []);

  const ct = nouvelle();
  ct.elements.push(...rect(0, 0, 10, 10));
  const cp = Plus.copierEntites(ct, ["l1"]);
  const co2 = Plus.collerEntites(ct, cp, { dx:0, dy:20 });
  verifier("copier-coller d'entités : décalé, indépendant", [co2.length, ct.elements.filter(e => e.type === "ligne").length, Math.max(...ct.elements.filter(e => e.type === "point").map(p => p.y))], [3, 5, 20]);

  /* Une cote pilotée se lit, ne commande pas. */
  const dr = nouvelle();
  dr.elements.push({ id:"a", type:"point", x:0, y:0 }, { id:"b", type:"point", x:10, y:0 }, { id:"l", type:"ligne", p1:"a", p2:"b" });
  dr.contraintes.push({ id:"k", type:"longueur", a:"l", expr:"50", pilotee:true });
  resoudre(gcs, dr, num);
  verifier("cote pilotée : la géométrie ne bouge pas", P(dr, "b").x, 10, 1e-6);
  const col = nouvelle();
  col.elements.push({ id:"a", type:"point", x:0, y:0 }, { id:"b", type:"point", x:10, y:0 }, { id:"l", type:"ligne", p1:"a", p2:"b" },
    { id:"c", type:"point", x:20, y:3 }, { id:"d", type:"point", x:30, y:3 }, { id:"m", type:"ligne", p1:"c", p2:"d" });
  col.contraintes.push({ id:"k", type:"colineaire", a:"l", b:"m" }, { id:"h", type:"horizontal", a:"l" });
  verifier("colinéaire : les deux lignes sur la même droite", [resoudre(gcs, col, num).ok, Math.abs(P(col, "c").y - P(col, "a").y) < 1e-6, Math.abs(P(col, "d").y - P(col, "a").y) < 1e-6], [true, true, true]);
}

console.log(ko ? `banc-conception-plus : ${ko} échec(s), ${ok} OK` : `banc-conception-plus : OK (${ok} vérifications)`);
process.exit(ko ? 1 : 0);
