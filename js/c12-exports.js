/* =============================================================================
   Conception 3D — c12-exports.js
   Les fichiers qu'on écrit sans le noyau : OBJ, 3MF, URDF, DXF par calques, DXF
   d'une esquisse, nomenclature, script. Sans écran : le travailleur, la page et
   le banc s'en servent. Un corps est { nom, vertices, triangles }, en mm.
   ============================================================================= */
"use strict";

import { zipSync, strToU8 } from "../vendor/three/addons/libs/fflate.module.js";
import { indexer, rayonDe } from "./c2-esquisse.js";

export const echapperXml = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&apos;" })[c]);
const nombre = (x) => String(+x.toFixed(6));

/** OBJ : un objet par corps, les sommets numérotés à la suite. */
export function ecrireObj(corps){
  const l = ["# WEB_3D, unités : mm"];
  let dec = 1;
  for(const c of corps){
    l.push(`o ${c.nom.replace(/\s+/g, "_")}`);
    for(let i = 0; i + 2 < c.vertices.length; i += 3) l.push(`v ${nombre(c.vertices[i])} ${nombre(c.vertices[i + 1])} ${nombre(c.vertices[i + 2])}`);
    for(let i = 0; i + 2 < c.triangles.length; i += 3) l.push(`f ${c.triangles[i] + dec} ${c.triangles[i + 1] + dec} ${c.triangles[i + 2] + dec}`);
    dec += c.vertices.length / 3;
  }
  return l.join("\n") + "\n";
}

/** 3MF : une archive avec le modèle, en mm ; un objet par corps, tous posés sur le plateau. */
export function ecrire3mf(corps){
  const objets = corps.map((c, k) => {
    const s = [], t = [];
    for(let i = 0; i + 2 < c.vertices.length; i += 3) s.push(`<vertex x="${nombre(c.vertices[i])}" y="${nombre(c.vertices[i + 1])}" z="${nombre(c.vertices[i + 2])}"/>`);
    for(let i = 0; i + 2 < c.triangles.length; i += 3) t.push(`<triangle v1="${c.triangles[i]}" v2="${c.triangles[i + 1]}" v3="${c.triangles[i + 2]}"/>`);
    return `<object id="${k + 1}" type="model" name="${echapperXml(c.nom)}"><mesh><vertices>${s.join("")}</vertices><triangles>${t.join("")}</triangles></mesh></object>`;
  });
  const modele = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="fr" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
<resources>${objets.join("")}</resources>
<build>${corps.map((_, k) => `<item objectid="${k + 1}"/>`).join("")}</build>
</model>`;
  return zipSync({
    "[Content_Types].xml":strToU8('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>'),
    "_rels/.rels":strToU8('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>'),
    "3D/3dmodel.model":strToU8(modele),
  });
}

/* Le type URDF d'une liaison de la page. */
const TYPE_URDF = { rigide:"fixed", pivot:"revolute", glissiere:"prismatic" };

/**
 * Le texte URDF : un lien par corps, un joint par liaison ; les maillages (mm dans le monde) sont ramenés au
 * repère du lien. `corps` : { nom, masse (kg), centre (mm), boite }. Une liaison que l'URDF ne sait pas dire
 * (cylindrique, plan) est refusée plutôt que simplifiée sans le dire.
 */
export function ecrireUrdf(nom, corps, liaisons, v = Number){
  const noms = new Set(corps.map(c => c.nom));
  const parent = new Map();
  for(const l of liaisons){
    if(!TYPE_URDF[l.mode]) throw new Error(`« ${l.nom} » : l'URDF ne connaît pas une liaison ${l.mode}`);
    if(!noms.has(l.corpsA) || !noms.has(l.corpsB)) throw new Error(`« ${l.nom} » relie un corps absent de l'export`);
    if(parent.has(l.corpsB)) throw new Error(`« ${l.corpsB} » a deux liaisons : l'URDF demande un arbre`);
    parent.set(l.corpsB, l);
  }
  const lien = new Map();
  const repereDe = (n, vus = new Set()) => {
    if(vus.has(n)) throw new Error(`boucle de liaisons autour de « ${n} » : l'URDF demande un arbre`);
    vus.add(n);
    const l = parent.get(n);
    if(l) repereDe(l.corpsA, vus);
    return lien.get(n) || lien.set(n, l ? l.repereA.point : [0, 0, 0]).get(n);
  };
  for(const c of corps) repereDe(c.nom);
  const ident = (t) => String(t).replace(/[^\w.-]+/g, "_");
  const m = (mm) => nombre(mm / 1000);
  const liens = corps.map(c => {
    const P = lien.get(c.nom), dims = [0, 1, 2].map(i => (c.boite[1][i] - c.boite[0][i]) / 1000), M = Math.max(c.masse, 1e-6);
    const I = [M * (dims[1] ** 2 + dims[2] ** 2) / 12, M * (dims[0] ** 2 + dims[2] ** 2) / 12, M * (dims[0] ** 2 + dims[1] ** 2) / 12];
    const G = c.centre.map((x, i) => m(x - P[i])).join(" "), O = P.map(x => m(-x)).join(" ");
    const geo = `<geometry><mesh filename="meshes/${ident(c.nom)}.stl" scale="0.001 0.001 0.001"/></geometry>`;
    return `  <link name="${echapperXml(ident(c.nom))}">
    <inertial><origin xyz="${G}"/><mass value="${nombre(M)}"/><inertia ixx="${nombre(I[0])}" ixy="0" ixz="0" iyy="${nombre(I[1])}" iyz="0" izz="${nombre(I[2])}"/></inertial>
    <visual><origin xyz="${O}"/>${geo}</visual>
    <collision><origin xyz="${O}"/>${geo}</collision>
  </link>`;
  });
  const joints = liaisons.map(l => {
    const a = lien.get(l.corpsA), b = lien.get(l.corpsB), type = TYPE_URDF[l.mode];
    const axe = (l.repereA.axe || l.repereA.normale).map(nombre).join(" ");
    const pivot = l.mode === "pivot", bas = l.min !== undefined && l.min !== "" ? v(l.min) : null, haut = l.max !== undefined && l.max !== "" ? v(l.max) : null;
    const k = pivot ? Math.PI / 180 : 0.001;
    const borne = bas !== null && haut !== null ? `<limit lower="${nombre(bas * k)}" upper="${nombre(haut * k)}" effort="10" velocity="1"/>` : "";
    const genre = pivot && !borne ? "continuous" : type;
    if(type === "prismatic" && !borne) throw new Error(`« ${l.nom} » : une glissière demande ses limites en URDF`);
    return `  <joint name="${echapperXml(ident(l.nom))}" type="${genre}">
    <parent link="${echapperXml(ident(l.corpsA))}"/><child link="${echapperXml(ident(l.corpsB))}"/>
    <origin xyz="${b.map((x, i) => m(x - a[i])).join(" ")}"/>${type === "fixed" ? "" : `<axis xyz="${axe}"/>`}${borne}
  </joint>`;
  });
  /* Plusieurs corps sans parent : un lien de base les tient ensemble. */
  const racines = corps.filter(c => !parent.has(c.nom));
  const base = racines.length > 1 ? [`  <link name="base"/>`, ...racines.map(c => `  <joint name="base_${echapperXml(ident(c.nom))}" type="fixed"><parent link="base"/><child link="${echapperXml(ident(c.nom))}"/></joint>`)] : [];
  return `<?xml version="1.0"?>\n<robot name="${echapperXml(ident(nom))}">\n${[...base, ...liens, ...joints].join("\n")}\n</robot>\n`;
}

/** Une archive de fichiers { chemin:Uint8Array | texte }. */
export const archive = (fichiers) => zipSync(Object.fromEntries(Object.entries(fichiers).map(([k, x]) => [k, typeof x === "string" ? strToU8(x) : x])));

/** DXF de segments rangés par calque : { calque:[[[x, y], [x, y]], …] }. */
export function dxfCalques(calques){
  const ligne = (c, a, b) => ["0", "LINE", "8", c, "10", a[0], "20", a[1], "30", 0, "11", b[0], "21", b[1], "31", 0].join("\n");
  return ["0\nSECTION\n2\nENTITIES", ...Object.entries(calques).flatMap(([c, segs]) => segs.map(([a, b]) => ligne(c, a, b))), "0\nENDSEC\n0\nEOF\n"].join("\n");
}

/** DXF d'une esquisse : lignes, arcs et cercles exacts ; une spline en petits segments ; la construction sur son calque. */
export function dxfEsquisse(esq, echantillon){
  const idx = indexer(esq), sortie = [];
  const champs = (...x) => x.join("\n");
  for(const e of esq.elements){
    const calque = e.constr ? "CONSTRUCTION" : "ESQUISSE";
    if(e.type === "ligne"){
      const a = idx.get(e.p1), b = idx.get(e.p2);
      sortie.push(champs("0", "LINE", "8", calque, "10", a.x, "20", a.y, "30", 0, "11", b.x, "21", b.y, "31", 0));
    }else if(e.type === "cercle"){
      const c = idx.get(e.c);
      sortie.push(champs("0", "CIRCLE", "8", calque, "10", c.x, "20", c.y, "30", 0, "40", e.r));
    }else if(e.type === "arc"){
      const c = idx.get(e.c), a = idx.get(e.p1), b = idx.get(e.p2), deg = (p) => Math.atan2(p.y - c.y, p.x - c.x) * 180 / Math.PI;
      sortie.push(champs("0", "ARC", "8", calque, "10", c.x, "20", c.y, "30", 0, "40", rayonDe(idx, e), "50", deg(a), "51", deg(b)));
    }else if(e.type === "spline"){
      const q = echantillon(e.pts.map(id => { const p = idx.get(id); return [p.x, p.y]; }));
      q.slice(1).forEach((p, i) => sortie.push(champs("0", "LINE", "8", calque, "10", q[i][0], "20", q[i][1], "30", 0, "11", p[0], "21", p[1], "31", 0)));
    }
  }
  if(!sortie.length) throw new Error("cette esquisse n'a rien à exporter");
  return ["0\nSECTION\n2\nENTITIES", ...sortie, "0\nENDSEC\n0\nEOF\n"].join("\n");
}

/** Nomenclature en CSV ; des corps de même volume, aire et encombrement comptent pour un repère, en quantité. */
export function nomenclature(corps, { matiereDe, densiteDe }){
  const f = (x, d = 3) => String(+x.toFixed(d)).replace(".", ",");
  const groupes = new Map();
  for(const c of corps){
    const p = c.proprietes;
    if(!p) continue;
    const dims = [0, 1, 2].map(i => p.boite[1][i] - p.boite[0][i]).sort((a, b) => b - a);
    const cle = [matiereDe(c.nom), p.volume.toFixed(2), p.aire.toFixed(2), ...dims.map(d => d.toFixed(2))].join("|");
    if(!groupes.has(cle)) groupes.set(cle, { noms:[], p, dims, mat:matiereDe(c.nom) });
    groupes.get(cle).noms.push(c.nom);
  }
  const lignes = ["repère;désignation;quantité;matière;volume (mm3);masse unitaire (g);masse totale (g);encombrement (mm)"];
  let r = 0;
  for(const g of groupes.values()){
    const masse = g.p.volume / 1000 * densiteDe(g.mat);
    lignes.push([++r, g.noms.join(" + "), g.noms.length, g.mat, f(g.p.volume, 1), f(masse, 2), f(masse * g.noms.length, 2), g.dims.map(d => f(d, 2)).join(" x ")].join(";"));
  }
  return lignes.join("\n");
}

/* -----------------------------------------------------------------------------
   Copier et coller des opérations : de nouveaux identifiants, les renvois suivis
   --------------------------------------------------------------------------- */
/** Les opérations à coller dans `doc` : ce qui renvoie à une opération copiée vise sa copie, le reste ne bouge pas. */
export function operationsCollees(doc, copiees){
  const table = new Map();
  const ids = (o) => { const n = "op" + (doc.compteur = (doc.compteur || 0) + 1); table.set(o.id, n); return n; };
  const sorties = copiees.map(o => { const c = structuredClone(o); c.id = ids(o); delete c.corpsNom; delete c.refs; return c; });
  const renvoi = (x) => table.get(x) ?? x;
  for(const c of sorties){
    for(const k of ["esquisse", "chemin", "pilote"]) if(c[k]) c[k] = renvoi(c[k]);
    if(c.esquisses) c.esquisses = c.esquisses.map(renvoi);
    if(c.plan?.ref) c.plan.ref = renvoi(c.plan.ref);
    if(typeof c.plan === "string") c.plan = renvoi(c.plan);
    if(typeof c.axe === "string" && c.axe.startsWith("ref:")) c.axe = "ref:" + renvoi(c.axe.slice(4));
    if(c.nom) c.nom = `${c.nom} (copie)`;
  }
  return sorties;
}

/**
 * Le contour d'une image en polylignes : marche sur la grille des pixels plus sombres que `seuil`, le long des bords.
 * `lum(x, y)` rend la luminosité de 0 à 255. Rend des polylignes fermées en pixels, simplifiées à `tol` pixel près.
 */
export function contoursImage(lum, l, h, seuil = 128, tol = 1){
  const plein = (x, y) => x >= 0 && y >= 0 && x < l && y < h && lum(x, y) < seuil;
  /* Chaque bord entre un pixel plein et un vide, orienté : la matière à gauche. */
  const suivants = new Map(), pose = (a, b) => { const k = a.join(); if(!suivants.has(k)) suivants.set(k, []); suivants.get(k).push(b); };
  for(let y = 0; y < h; y++) for(let x = 0; x < l; x++){
    if(!plein(x, y)) continue;
    if(!plein(x, y - 1)) pose([x, y], [x + 1, y]);
    if(!plein(x + 1, y)) pose([x + 1, y], [x + 1, y + 1]);
    if(!plein(x, y + 1)) pose([x + 1, y + 1], [x, y + 1]);
    if(!plein(x - 1, y)) pose([x, y + 1], [x, y]);
  }
  const sortie = [];
  while(suivants.size){
    const debut = suivants.keys().next().value, boucle = [];
    let k = debut;
    while(suivants.has(k)){
      const liste = suivants.get(k), p = liste.pop();
      if(!liste.length) suivants.delete(k);
      boucle.push(k.split(",").map(Number));
      k = p.join();
      if(k === debut) break;
    }
    if(boucle.length >= 4) sortie.push(simplifierContour(boucle, tol));
  }
  return sortie.filter(b => b.length >= 3);
}

/** Douglas-Peucker sur un contour fermé : coupé en deux au point le plus loin du premier. */
function simplifierContour(pts, tol){
  const loin = pts.reduce((m, p, i) => Math.hypot(p[0] - pts[0][0], p[1] - pts[0][1]) > Math.hypot(pts[m][0] - pts[0][0], pts[m][1] - pts[0][1]) ? i : m, 0);
  const moitie = (a) => {
    if(a.length < 3) return a;
    const [x0, y0] = a[0], [x1, y1] = a[a.length - 1], L = Math.hypot(x1 - x0, y1 - y0) || 1;
    let iMax = 0, dMax = 0;
    for(let i = 1; i < a.length - 1; i++){ const d = Math.abs((x1 - x0) * (y0 - a[i][1]) - (x0 - a[i][0]) * (y1 - y0)) / L; if(d > dMax){ dMax = d; iMax = i; } }
    return dMax <= tol ? [a[0], a[a.length - 1]] : [...moitie(a.slice(0, iMax + 1)).slice(0, -1), ...moitie(a.slice(iMax))];
  };
  return [...moitie(pts.slice(0, loin + 1)).slice(0, -1), ...moitie([...pts.slice(loin), pts[0]]).slice(0, -1)];
}

/** Une table de valeurs d'un paramètre : ce que chaque valeur donne. En CSV. */
export function csvBalayage(nom, lignes){
  const f = (x) => x === null || x === undefined ? "" : String(+(+x).toFixed(4)).replace(".", ",");
  return [`${nom};corps;volume (mm3);aire (mm2);X (mm);Y (mm);Z (mm);erreurs`,
    ...lignes.map(l => [f(l.valeur), l.corps, f(l.volume), f(l.aire), ...(l.dims || ["", "", ""]).map(f), l.erreurs].join(";"))].join("\n");
}

/** Un nuage de points en texte : XYZ, CSV, PTS, PLY ascii. Un point sur k au-delà de `plafond`, pour que la pièce reste légère. */
export function lireNuage(texte, plafond = 200000){
  let lignes = texte.split(/\r?\n/);
  if(/^ply\b/.test(lignes[0] || "")){
    if(!/format ascii/.test(lignes.slice(0, 5).join("\n"))) throw new Error("seul le PLY en texte (ascii) se lit ici");
    const fin = lignes.findIndex(l => l.trim() === "end_header");
    const m = lignes.slice(0, fin).join("\n").match(/element vertex (\d+)/);
    if(fin < 0 || !m) throw new Error("en-tête PLY illisible");
    lignes = lignes.slice(fin + 1, fin + 1 + +m[1]);
  }
  const pts = [];
  for(const l of lignes){
    const n = l.trim().split(/[\s,;]+/).slice(0, 3).map(Number);
    if(n.length === 3 && n.every(Number.isFinite)) pts.push(n);
  }
  if(!pts.length) throw new Error("aucun point lisible : trois nombres par ligne");
  const k = Math.ceil(pts.length / plafond), garde = k > 1 ? pts.filter((_, i) => i % k === 0) : pts;
  return { points:Float32Array.from(garde.flat()), total:pts.length, reduit:k > 1 ? k : 0 };
}
