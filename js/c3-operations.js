/* =============================================================================
   Conception 3D — c3-operations.js
   La reconstruction : la liste des opérations, rejouée sur le noyau.

   Chaque opération lit l'état (les corps déjà construits) et en rend un
   nouveau. Les formes ne sont jamais modifiées sur place : replicad détruit
   la forme d'origine sur un déplacement, une rotation ou une symétrie, donc on
   clone toujours avant (règle « clone() avant translate/rotate/mirror »).
   C'est ce qui permet de garder en cache l'état après chaque opération et de
   ne refaire que la fin de l'historique quand on modifie la dernière cote.

   Une opération en échec est signalée et sautée : la suite se construit avec
   l'état d'avant, comme dans les modeleurs paramétriques.

   Indépendant du navigateur : le travailleur (c4-travailleur.js) et le banc
   d'essai sous Node l'utilisent avec le même module replicad `R`.
   ============================================================================= */
"use strict";

import { evaluateur, evaluerParametres, NOM_PARAMETRE } from "./c1-expressions.js";
import { repere, versMonde, vec, profils, indexer, controlesSpline, axeConstruction, axePerpendiculaire, pointsChemin3d, cercle3Points } from "./c2-esquisse.js";
import { ateliers, TYPES_ATELIERS } from "./c3b-ateliers.js";
import { operationsPlus, TYPES_PLUS } from "./c3d-operations-plus.js";
import { retrouver } from "./c3c-references.js";

/* Les opérations, leur nom affiché et leur icône : l'historique et le ruban les lisent. */
export const TYPES = {
  esquisse:{ nom:"Esquisse", icone:"✏️" },
  extrusion:{ nom:"Extrusion", icone:"⬆" },
  revolution:{ nom:"Révolution", icone:"⟳" },
  balayage:{ nom:"Balayage", icone:"≈" },
  lissage:{ nom:"Lissage", icone:"⧖" },
  percage:{ nom:"Perçage", icone:"⊙" },
  boite:{ nom:"Boîte", icone:"▣" },
  cylindre:{ nom:"Cylindre", icone:"⌭" },
  sphere:{ nom:"Sphère", icone:"●" },
  cone:{ nom:"Cône", icone:"▲" },
  tore:{ nom:"Tore", icone:"◎" },
  tirer:{ nom:"Tirer une face", icone:"⇪" },
  plan:{ nom:"Plan", icone:"▱" },
  depouille:{ nom:"Dépouille", icone:"⟋" },
  nervure:{ nom:"Nervure", icone:"╫" },
  tuyau:{ nom:"Tuyau", icone:"⌇" },
  ressort:{ nom:"Ressort", icone:"⌬" },
  gravure:{ nom:"Gravure", icone:"✎" },
  decouper:{ nom:"Découpe", icone:"⫽" },
  echelle:{ nom:"Échelle", icone:"⤢" },
  conge:{ nom:"Congé", icone:"◜" },
  chanfrein:{ nom:"Chanfrein", icone:"◸" },
  chemin3d:{ nom:"Chemin 3D", icone:"⟿" },
  coque:{ nom:"Coque", icone:"▢" },
  combiner:{ nom:"Combiner", icone:"⊕" },
  deplacer:{ nom:"Déplacer", icone:"✥" },
  miroir:{ nom:"Miroir", icone:"⇋" },
  repetition:{ nom:"Répétition", icone:"⁂" },
  step:{ nom:"STEP inséré", icone:"⬚" },
};

const AXES = { X:[1, 0, 0], Y:[0, 1, 0], Z:[0, 0, 1] };

/* Trous métriques ISO : taraudage (pas gros), passage moyen (ISO 273), puis valeurs d'atelier
   usuelles pour le lamage d'une vis CHC (ISO 4762) et la fraisure d'une vis FHC (ISO 10642). */
const sansAccent = (t) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Le nom montré dans l'historique : la fonction, puis le nom donné (« Boîte-Cabine »). Un nom qui la dit déjà (« Boîte 1 ») reste tel quel. */
export function nomHistorique(op){
  const f = TYPES[op.type]?.nom;
  return !f || sansAccent(op.nom).startsWith(sansAccent(f)) ? op.nom : `${f}-${op.nom}`;
}

export const TROUS = {
  M2:{ taraude:1.6, passage:2.4, lamageD:4.3, lamageP:2.2, fraisureD:4.4 },
  "M2.5":{ taraude:2.05, passage:2.9, lamageD:5, lamageP:2.7, fraisureD:5.5 },
  M3:{ taraude:2.5, passage:3.4, lamageD:6.5, lamageP:3.4, fraisureD:6.5 },
  M4:{ taraude:3.3, passage:4.5, lamageD:8, lamageP:4.6, fraisureD:9 },
  M5:{ taraude:4.2, passage:5.5, lamageD:10, lamageP:5.7, fraisureD:11 },
  M6:{ taraude:5, passage:6.6, lamageD:11, lamageP:6.8, fraisureD:13.5 },
  M8:{ taraude:6.8, passage:9, lamageD:15, lamageP:9, fraisureD:17.5 },
  M10:{ taraude:8.5, passage:11, lamageD:18, lamageP:11, fraisureD:22 },
  M12:{ taraude:10.2, passage:13.5, lamageD:20, lamageP:13, fraisureD:26 },
};

/** Le message d'une exception du noyau (WebAssembly.Exception) ou d'une erreur ordinaire. */
export function messageErreur(e, oc){
  if(e && typeof e === "object" && oc?.getExceptionMessage && !(e instanceof Error)){
    try{
      const [type, msg] = oc.getExceptionMessage(e);
      return `le noyau a refusé l'opération (${type}${msg ? " : " + msg : ""})`;
    }catch(_){ /* message illisible : on tombe sur le cas général */ }
  }
  return e?.message || String(e);
}

/** Hachage FNV-1a : la clé de cache d'un préfixe d'historique. */
function hacher(s){
  let h = 0x811c9dc5;
  for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}

/* -----------------------------------------------------------------------------
   Esquisses → formes planes du noyau
   --------------------------------------------------------------------------- */
function planNoyau(R, esq, v){
  const r = repere(esq.plan, v);
  return { r, plan:new R.Plane(r.o, r.x, r.n) };
}

/** Le crayon de replicad le long de segments d'esquisse. */
function tracer(R, segments){
  let pen = R.draw(segments[0].a);
  for(const s of segments){
    if(s.type === "ligne") pen = pen.lineTo(s.b);
    else if(s.type === "arc") pen = pen.threePointsArcTo(s.b, s.m);
    else for(const t of controlesSpline(s.pts)) pen = pen.cubicBezierCurveTo(t.fin, t.c1, t.c2);
  }
  return pen;
}

function dessinContour(R, b){
  if(b.cercle) return R.drawCircle(b.cercle.r).translate(b.cercle.c[0], b.cercle.c[1]);
  return tracer(R, b.segments).close();
}

/** Les régions d'une esquisse, trous compris, en un seul dessin replicad.
    `contours` (clés de profils().faces) : celles à prendre ; vide, toutes les régions de matière. */
function dessinRegions(R, esq, contours = null){
  const { regions, faces } = profils(esq);
  const textes = contours?.length ? [] : esq.elements.filter(e => e.type === "texte" && !e.constr);
  if(!regions.length && !textes.length) throw new Error(`« ${esq.nom} » n'a aucun contour fermé`);
  const choix = contours?.length ? contours.map(c => {
    const f = faces.find(x => x.cle === c);
    if(!f) throw new Error(`un contour choisi n'existe plus dans « ${esq.nom} » : choisissez-le de nouveau`);
    return f;
  }) : regions;
  let tout = null;
  for(const reg of choix){
    let d = dessinContour(R, reg.exterieur);
    for(const t of reg.trous) d = d.cut(dessinContour(R, t));
    tout = tout ? tout.fuse(d) : d;
  }
  const idx = indexer(esq);
  for(const t of textes){
    const p = idx.get(t.p);
    const d = R.drawText(t.contenu, { fontSize:t.h }).translate(p.x, p.y);     // startX de drawText compte à l'envers
    tout = tout ? tout.fuse(d) : d;
  }
  return tout;
}

function chercherEsquisse(ctx, id){
  const esq = ctx.doc.operations.find(o => o.id === id && o.type === "esquisse");
  if(!esq) throw new Error("esquisse à choisir");
  if(ctx.ignorees.has(id)) throw new Error(`« ${esq.nom} » est suspendue ou après le curseur`);
  return esq;
}

/* -----------------------------------------------------------------------------
   Corps : l'état est une liste { nom, shape, reference }
   --------------------------------------------------------------------------- */
function corpsCible(etat, nom){
  const liste = etat.corps.filter(c => !c.reference);
  const c = nom ? liste.find(x => x.nom === nom) : liste[liste.length - 1];
  if(!c) throw new Error(nom ? `corps « ${nom} » introuvable` : "aucun corps à modifier");
  return c;
}

function remplacer(etat, ancien, shape){
  return { ...etat, corps:etat.corps.map(c => c === ancien ? { ...c, shape } : c) };
}

/* L'opération en cours : le nom d'un corps est stocké sur celle qui le crée (op.corpsNom), pour qu'une
   opération qui le vise continue de le trouver quand on en supprime ou déplace une autre. */
let opCourante = null, docCourant = null, noteCourante = null;

function nomCorps(etat){
  const pris = new Set([...etat.corps.map(c => c.nom), ...(docCourant?.operations || []).map(o => o.corpsNom).filter(Boolean)]);
  const op = opCourante;
  if(op?.corpsNom){
    if(!etat.corps.some(c => c.nom === op.corpsNom)) return op.corpsNom;
    let k = 2;                                  // une même opération crée plusieurs corps (répétition, découpe)
    while(pris.has(`${op.corpsNom} · ${k}`)) k++;
    return `${op.corpsNom} · ${k}`;
  }
  let n = 1;
  while(pris.has(`Corps ${n}`)) n++;
  if(op){ op.corpsNom = `Corps ${n}`; if(noteCourante) noteCourante.corpsNom = op.corpsNom; }
  return `Corps ${n}`;
}

function nouveauCorps(etat, shape, extra = {}){
  return { corps:[...etat.corps, { nom:nomCorps(etat), shape, ...extra }], compteur:etat.compteur + 1 };
}

/** Le volume créé, appliqué selon le mode : nouveau corps, joindre, enlever, intersection. */
function appliquer(etat, outil, op){
  const mode = op.operation || "nouveau";
  const sansCorps = !etat.corps.some(c => !c.reference);
  if(mode === "nouveau" || (sansCorps && mode === "joindre")) return nouveauCorps(etat, outil);
  const cible = corpsCible(etat, op.corps);
  if(mode === "joindre") return remplacer(etat, cible, cible.shape.fuse(outil));
  if(mode === "enlever") return remplacer(etat, cible, cible.shape.cut(outil));
  if(mode === "intersection") return remplacer(etat, cible, cible.shape.intersect(outil));
  throw new Error(`mode « ${mode} » inconnu`);
}

/** Les arêtes ou faces désignées : retrouvées par leur description, et celle-ci remise à jour dans la note de l'opération. */
function designes(R, forme, genre, points, op, ctx){
  const { elements, refs } = retrouver(R, forme, genre, points, op.refs || {});
  ctx.note.refs = { ...(ctx.note.refs || {}), ...refs };
  op.refs = { ...(op.refs || {}), ...refs };
  return elements;
}

/** Une panne du noyau (mémoire, plantage) : l'opération n'a pas échoué, c'est le noyau qui est mort. */
function estFatale(e, oc){
  if(typeof WebAssembly !== "undefined" && e instanceof WebAssembly.RuntimeError) return true;
  if(e && typeof e === "object" && !(e instanceof Error) && oc?.getExceptionMessage){
    try{ return /bad_alloc|Standard_OutOfMemory/.test(oc.getExceptionMessage(e).join(" ")); }catch(_){ return false; }
  }
  return false;
}

/** Les arêtes (ou faces) d'une forme les plus proches des points désignés à l'écran. */
function plusProches(R, liste, points){
  if(!points?.length) throw new Error("aucune arête ou face désignée");
  return points.map(p => {
    const v = R.makeVertex(p);
    let meilleur = null, dMin = Infinity;
    for(const el of liste){
      const d = R.measureDistanceBetween(v, el);
      if(d < dMin){ dMin = d; meilleur = el; }
    }
    v.delete();
    if(dMin > 1.5) throw new Error("une arête ou une face désignée n'existe plus (la forme a changé : désignez-la de nouveau)");
    return meilleur;
  });
}

/**
 * La face plane désignée { point, normale } : parmi les faces planes de même normale, la plus proche
 * du point. Quand une cote change, la face s'est déplacée mais garde son orientation : c'est ce qui
 * permet de la retrouver sans nom de face stable.
 * shortcut: deux faces parallèles voisines peuvent s'échanger après un grand changement ; les vrais
 * noms topologiques demanderaient de suivre l'historique du noyau.
 */
function faceSuivie(R, corps, { point, normale }){
  const v = R.makeVertex(point);
  let meilleure = null, dMin = Infinity;
  for(const c of corps){
    for(const f of c.shape.faces){
      if(f.geomType !== "PLANE") continue;
      const n = f.normalAt();
      if(n.x * normale[0] + n.y * normale[1] + n.z * normale[2] < 0.9999) continue;
      const d = R.measureDistanceBetween(v, f);
      if(d < dMin){ dMin = d; meilleure = f; }
    }
  }
  return meilleure;
}

/** Une forme construite le long de +Z, tournée pour que +Z devienne `n`, puis posée en `p`. */
function orienter(forme, n, p){
  const z = [0, 0, 1], c = vec.scal(z, n);
  if(c < -0.999999) forme = forme.rotate(180, [0, 0, 0], [1, 0, 0]);
  else if(c < 0.999999) forme = forme.rotate(Math.acos(c) * 180 / Math.PI, [0, 0, 0], vec.vect(z, n));
  return forme.translate(p);
}

/** Un profil (r, z) tourné autour de Z : outils de perçage, cône. */
function revolutionProfil(R, pts){
  let pen = R.draw(pts[0]);
  for(const q of pts.slice(1)) pen = pen.lineTo(q);
  return pen.close().sketchOnPlane("XZ").revolve([0, 0, 1], { origin:[0, 0, 0] });
}

/**
 * Où sont passées les arêtes projetées dans une esquisse : retrouvées comme toute arête désignée, puis ramenées dans le
 * plan. Le noyau ne sait pas résoudre l'esquisse : il rend les positions, la page les pose et relance la construction.
 */
function projectionsSuivies(R, etat, op, ctx){
  const r = repere(op.plan, ctx.v), idx = indexer(op), sortie = [];
  const local = (q) => { const d = [q.x - r.o[0], q.y - r.o[1], q.z - r.o[2]]; return [vec.scal(d, r.x), vec.scal(d, r.y)]; };
  for(const lien of op.projections){
    if(!lien.points.every(id => idx.has(id))) continue;       // la géométrie projetée a été effacée : plus rien à suivre
    const corps = etat.corps.find(c => c.nom === lien.corps);
    if(!corps) throw new Error(`« ${lien.corps} », dont vient une arête projetée, n'existe plus`);
    const arete = designes(R, corps.shape, "aretes", [lien.arete], op, ctx)[0];
    const pas = lien.points.length - 1;
    if(lien.genre === "cercle" || lien.genre === "arc"){
      const [a, m, b] = [0, 1 / 3, 2 / 3].map(t => local(arete.pointAt(t)));
      const k = cercle3Points({ x:a[0], y:a[1] }, { x:m[0], y:m[1] }, { x:b[0], y:b[1] });
      if(!k) throw new Error("une arête projetée n'est plus un cercle");
      if(lien.genre === "cercle"){ sortie.push({ point:lien.points[0], x:k.c.x, y:k.c.y, rayon:k.r, element:lien.element }); continue; }
      const [q0, q1] = [local(arete.pointAt(0)), local(arete.pointAt(1))];
      const [c, u, w] = lien.points, U = idx.get(u), inverse = Math.hypot(q0[0] - U.x, q0[1] - U.y) > Math.hypot(q1[0] - U.x, q1[1] - U.y);
      sortie.push({ point:c, x:k.c.x, y:k.c.y }, { point:u, x:(inverse ? q1 : q0)[0], y:(inverse ? q1 : q0)[1] }, { point:w, x:(inverse ? q0 : q1)[0], y:(inverse ? q0 : q1)[1] });
      continue;
    }
    /* Une arête n'a pas de sens stable : on garde celui qui change le moins les points déjà posés. */
    const pts = lien.points.map((_, i) => local(arete.pointAt(i / pas)));
    const ecart = (l) => l.reduce((s, q, i) => { const P = idx.get(lien.points[i]); return s + Math.hypot(q[0] - P.x, q[1] - P.y); }, 0);
    const bons = ecart(pts) <= ecart([...pts].reverse()) ? pts : [...pts].reverse();
    bons.forEach((q, i) => sortie.push({ point:lien.points[i], x:q[0], y:q[1] }));
  }
  return sortie;
}

/** Le fil d'un chemin 3D : des droites entre ses points, ou une courbe qui les approche. */
function fil3d(R, op, v){
  const p = pointsChemin3d(op, v);
  const bords = op.mode === "spline" ? [R.makeBSplineApproximation(p)] : p.slice(1).map((q, i) => R.makeLine(p[i], q));
  const d = p[1].map((c, i) => c - p[0][i]);
  return { fil:R.assembleWire(bords), depart:p[0], tangente:vec.norm(d) };
}

/* -----------------------------------------------------------------------------
   Les opérations
   --------------------------------------------------------------------------- */
const OPERATIONS = {
  esquisse(R, etat, op, ctx){
    OPERATIONS.suivrePlan(R, etat, op, ctx);
    if(op.projections?.length) ctx.note.projections = projectionsSuivies(R, etat, op, ctx);
    return etat;
  },

  suivrePlan(R, etat, op, ctx){
    const p = op.plan;
    if(!p.suivre || p.base) return etat;
    const f = faceSuivie(R, etat.corps.filter(c => !c.reference), { point:p.origine, normale:p.normale });
    if(!f) throw new Error("la face de l'esquisse n'existe plus : le plan reste où il était");
    /* Le plan suit la face le long de sa normale ; l'origine garde sa place dans le plan. */
    const c = f.center;
    const d = (c.x - p.origine[0]) * p.normale[0] + (c.y - p.origine[1]) * p.normale[1] + (c.z - p.origine[2]) * p.normale[2];
    if(Math.abs(d) > 1e-7){
      op.plan = { ...p, origine:vec.ajout(p.origine, p.normale, d) };
      ctx.note.plan = op.plan;                  // la page s'en sert pour dessiner l'esquisse au bon endroit
    }
    return etat;
  },

  extrusion(R, etat, op, ctx){
    const v = ctx.v, esq = chercherEsquisse(ctx, op.esquisse);
    const d = op.sens === "jusqua" ? 0 : v(op.distance);
    if(op.sens !== "jusqua" && !(d > 0)) throw new Error("la distance doit être positive");
    const sens = op.sens || "un";
    if(sens === "jusqua"){
      if(!op.faceLimite) throw new Error("face limite à désigner");
      const lim = faceSuivie(R, etat.corps, op.faceLimite);
      if(!lim) throw new Error("la face limite n'existe plus : désignez-la de nouveau");
      const r = repere(esq.plan, v);
      const dir = op.inverse ? r.n.map(c => -c) : r.n;
      return appliquer(etat, dessinRegions(R, esq, op.contours).sketchOnPlane(new R.Plane(r.o, r.x, r.n)).extrudeUntil(lim, { extrusionDirection:dir }), op);
    }
    const d2 = sens === "deux" ? v(op.distance2) : 0;
    /* départ et longueur le long de la normale du plan */
    const [depart, longueur] = sens === "sym" ? [-d / 2, d] : sens === "deux" ? [-d2, d + d2] : op.inverse ? [-d, d] : [0, d];
    const { r } = planNoyau(R, esq, v);
    const plan = new R.Plane(vec.ajout(r.o, r.n, depart), r.x, r.n);
    return appliquer(etat, dessinRegions(R, esq, op.contours).sketchOnPlane(plan).extrude(longueur), op);
  },

  revolution(R, etat, op, ctx){
    const v = ctx.v, esq = chercherEsquisse(ctx, op.esquisse);
    const { r, plan } = planNoyau(R, esq, v);
    let origine = r.o, dir = r.x;
    if(op.axe === "y") dir = r.y;
    else if(op.axe?.startsWith("ref:")){
      const a = axeConstruction(ctx.doc.operations.find(o => o.id === op.axe.slice(4)), v, ctx.doc);
      origine = a.point; dir = a.dir;
    }else if(op.axe && op.axe !== "x"){
      const l = indexer(esq).get(op.axe), idx = indexer(esq);
      if(!l || l.type !== "ligne") throw new Error("l'axe doit être une ligne de l'esquisse");
      const a = idx.get(l.p1), b = idx.get(l.p2);
      origine = versMonde(r, a.x, a.y);
      dir = vec.norm(vec.ajout(versMonde(r, b.x, b.y), origine, -1));
    }
    const angle = v(op.angle ?? 360);
    return appliquer(etat, dessinRegions(R, esq, op.contours).sketchOnPlane(plan).revolve(dir, { origin:origine, angle }), op);
  },

  balayage(R, etat, op, ctx){
    const v = ctx.v, esq = chercherEsquisse(ctx, op.esquisse);
    const profil = dessinRegions(R, esq).sketchOnPlane(planNoyau(R, esq, v).plan);
    if(!profil.wire) throw new Error("le profil d'un balayage doit être un seul contour, sans trou");
    const c3 = ctx.doc.operations.find(o => o.id === op.chemin && o.type === "chemin3d");
    if(c3) return appliquer(etat, R.genericSweep(profil.wire, fil3d(R, c3, v).fil, { frenet:true }), op);
    const chem = chercherEsquisse(ctx, op.chemin);
    const { ouverts, regions } = profils(chem);
    const suite = ouverts[0] || regions[0]?.exterieur;
    if(!suite?.segments) throw new Error(`« ${chem.nom} » n'a pas de chemin (lignes et arcs bout à bout)`);
    const pen = tracer(R, suite.segments);
    const chemin = (ouverts[0] ? pen.done() : pen.close()).sketchOnPlane(planNoyau(R, chem, v).plan);
    return appliquer(etat, R.genericSweep(profil.wire, chemin.wire, { frenet:true }), op);
  },

  lissage(R, etat, op, ctx){
    const v = ctx.v;
    const esqs = (op.esquisses || []).map(id => chercherEsquisse(ctx, id));
    if(esqs.length < 2) throw new Error("au moins deux esquisses, dans l'ordre du lissage");
    const sections = esqs.map(e => {
      const s = dessinRegions(R, e).sketchOnPlane(planNoyau(R, e, v).plan);
      if(!s.wire) throw new Error(`« ${e.nom} » : une section de lissage est un seul contour, sans trou`);
      return s;
    });
    return appliquer(etat, sections[0].loftWith(sections.slice(1), { ruled:!!op.regle }), op);
  },

  percage(R, etat, op, ctx){
    const v = ctx.v, esq = chercherEsquisse(ctx, op.esquisse);
    const { points } = profils(esq);
    if(!points.length) throw new Error(`« ${esq.nom} » n'a aucun point isolé (outil Point) pour placer les trous`);
    const cible = corpsCible(etat, op.corps);
    const r = v(op.diametre) / 2;
    if(!(r > 0)) throw new Error("diamètre à donner");
    const bb = cible.shape.boundingBox;
    const prof = op.traversant ? 2 * Math.hypot(bb.width, bb.height, bb.depth) + 2 : v(op.profondeur);
    if(!(prof > 0)) throw new Error("profondeur à donner");
    /* Profil en (rayon, hauteur), +Z sortant de la matière ; 1 mm au-dessus de la face. */
    let pts;
    if(op.forme === "lamage"){
      const rt = v(op.diamTete) / 2, pt = v(op.profTete);
      if(!(rt > r && pt > 0 && pt < prof)) throw new Error("lamage : diamètre de tête > diamètre du trou, profondeur de tête < profondeur");
      pts = [[0, 1], [rt, 1], [rt, -pt], [r, -pt], [r, -prof], [0, -prof]];
    }else if(op.forme === "fraisure"){
      const rt = v(op.diamTete) / 2, a = v(op.angleTete ?? 90) * Math.PI / 360;
      const h = (rt - r) / Math.tan(a);
      if(!(rt > r && h < prof)) throw new Error("fraisure : diamètre de tête > diamètre du trou, et pas plus profonde que le trou");
      pts = [[0, 1], [rt, 1], [rt, 0], [r, -h], [r, -prof], [0, -prof]];
    }else pts = [[0, 1], [r, 1], [r, -prof], [0, -prof]];
    const rp = repere(esq.plan, v);
    /* Tous les outils d'un coup : un booléen par trou repart à chaque fois d'une forme plus lourde. */
    const modele = orienter(revolutionProfil(R, pts), rp.n, [0, 0, 0]);    // un seul outil, déplacé : tourner 120 profils coûte cher
    const outils = points.map(([x, y]) => modele.clone().translate(versMonde(rp, x, y)));
    return remplacer(etat, cible, cible.shape.cut(outils.length === 1 ? outils[0] : R.makeCompound(outils)));
  },

  boite(R, etat, op, { v }){
    const L = v(op.L), l = v(op.l), h = v(op.h);
    if(!(L > 0 && l > 0 && h > 0)) throw new Error("les trois dimensions doivent être positives");
    const o = [v(op.x ?? 0), v(op.y ?? 0), v(op.z ?? 0)];
    const d = op.centre ? [o[0] - L / 2, o[1] - l / 2, o[2]] : o;
    return appliquer(etat, R.makeBox(d, [d[0] + L, d[1] + l, d[2] + h]), op);
  },
  cylindre(R, etat, op, { v }){
    const r = v(op.diametre) / 2, h = v(op.h);
    if(!(r > 0 && h > 0)) throw new Error("diamètre et hauteur positifs");
    return appliquer(etat, R.makeCylinder(r, h, [v(op.x ?? 0), v(op.y ?? 0), v(op.z ?? 0)], AXES[op.axe || "Z"]), op);
  },
  sphere(R, etat, op, { v }){
    const r = v(op.diametre) / 2;
    if(!(r > 0)) throw new Error("diamètre positif");
    return appliquer(etat, R.makeSphere(r).translate([v(op.x ?? 0), v(op.y ?? 0), v(op.z ?? 0)]), op);
  },
  cone(R, etat, op, { v }){
    const r1 = v(op.d1) / 2, r2 = v(op.d2) / 2, h = v(op.h);
    if(!(r1 >= 0 && r2 >= 0 && r1 + r2 > 0 && h > 0)) throw new Error("diamètres positifs (l'un peut être nul) et hauteur positive");
    const pts = r2 > 0 ? [[0, 0], [r1, 0], [r2, h], [0, h]] : [[0, 0], [r1, 0], [0, h]];
    const p = r1 > 0 ? pts : [[0, 0], [r2, h], [0, h]];
    return appliquer(etat, revolutionProfil(R, p).translate([v(op.x ?? 0), v(op.y ?? 0), v(op.z ?? 0)]), op);
  },
  tore(R, etat, op, { v }){
    const Rg = v(op.D) / 2, r = v(op.d) / 2;
    if(!(r > 0 && Rg > r)) throw new Error("le diamètre du tore doit dépasser celui du tube");
    const t = R.drawCircle(r).translate(Rg, 0).sketchOnPlane("XZ").revolve([0, 0, 1], { origin:[0, 0, 0] });
    return appliquer(etat, t.translate([v(op.x ?? 0), v(op.y ?? 0), v(op.z ?? 0)]), op);
  },

  /* Un plan de construction ne construit rien : la page en déduit le plan des esquisses qui le citent. */
  plan:(R, etat) => etat,

  depouille(R, etat, op, ctx){
    const { v } = ctx;
    const cible = corpsCible(etat, op.corps), angle = v(op.angle);
    if(!angle) throw new Error("angle de dépouille à donner");
    const faces = designes(R, cible.shape, "faces", op.faces, op, ctx);
    const neutre = new R.Plane(vec.ajout([0, 0, 0], AXES[{ XY:"Z", XZ:"Y", YZ:"X" }[op.plan || "XY"]], v(op.decalage ?? 0)),
      op.plan === "YZ" ? [0, 1, 0] : [1, 0, 0], AXES[{ XY:"Z", XZ:"Y", YZ:"X" }[op.plan || "XY"]]);
    return remplacer(etat, cible, cible.shape.draft(angle, (f) => f.inList(faces), neutre));
  },

  nervure(R, etat, op, ctx){
    const v = ctx.v, esq = chercherEsquisse(ctx, op.esquisse);
    const ep = v(op.epaisseur), h = v(op.distance);
    if(!(ep > 0 && h > 0)) throw new Error("épaisseur et hauteur positives");
    const lignes = profils(esq).ouverts.flatMap(o => o.segments);
    if(!lignes.length || lignes.some(s => s.type !== "ligne")) throw new Error(`« ${esq.nom} » : une nervure suit des lignes droites ouvertes`);
    /* Chaque ligne, épaissie des deux côtés et prolongée d'une demi-épaisseur pour que les coins se recouvrent. */
    let dessin = null;
    for(const s of lignes){
      const L = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]) || 1;
      const ux = (s.b[0] - s.a[0]) / L, uy = (s.b[1] - s.a[1]) / L, nx = -uy * ep / 2, ny = ux * ep / 2;
      const a = [s.a[0] - ux * ep / 2, s.a[1] - uy * ep / 2], b = [s.b[0] + ux * ep / 2, s.b[1] + uy * ep / 2];
      const d = R.draw([a[0] + nx, a[1] + ny]).lineTo([b[0] + nx, b[1] + ny]).lineTo([b[0] - nx, b[1] - ny]).lineTo([a[0] - nx, a[1] - ny]).close();
      dessin = dessin ? dessin.fuse(d) : d;
    }
    const r = repere(esq.plan, v);
    const plan = new R.Plane(op.inverse ? vec.ajout(r.o, r.n, -h) : r.o, r.x, r.n);
    return appliquer(etat, dessin.sketchOnPlane(plan).extrude(h), { operation:"joindre", corps:op.corps });
  },

  /* Rien dans le volume : le fil sert aux balayages et aux tuyaux, la page le dessine. */
  chemin3d:(R, etat, op, { v }) => { pointsChemin3d(op, v); return etat; },

  tuyau(R, etat, op, ctx){
    const v = ctx.v;
    const de = v(op.diametre), ep = v(op.paroi ?? 0);
    if(!(de > 0 && ep >= 0 && ep * 2 < de)) throw new Error("diamètre positif, et paroi plus petite que le rayon");
    const c3 = ctx.doc.operations.find(o => o.id === op.chemin && o.type === "chemin3d");
    if(c3){
      if(ctx.ignorees.has(c3.id)) throw new Error(`« ${c3.nom} » est suspendu ou après le curseur`);
      const { fil, depart, tangente } = fil3d(R, c3, v);
      const x = axePerpendiculaire(tangente);
      const balayer3d = (d) => R.genericSweep(R.drawCircle(d / 2).sketchOnPlane(new R.Plane(depart, x, tangente)).wire, fil, { frenet:true });
      const plein3d = balayer3d(de);
      return appliquer(etat, ep > 0 ? plein3d.cut(balayer3d(de - 2 * ep)) : plein3d, op);
    }
    const chem = chercherEsquisse(ctx, op.chemin);
    const { ouverts, regions } = profils(chem);
    const suite = ouverts[0] || regions[0]?.exterieur;
    if(!suite?.segments) throw new Error(`« ${chem.nom} » n'a pas de chemin (lignes et arcs bout à bout)`);
    const balayer = (d) => {
      const pen = tracer(R, suite.segments);
      return (ouverts[0] ? pen.done() : pen.close()).sketchOnPlane(planNoyau(R, chem, v).plan)
        .sweepSketch((plan, origine) => R.drawCircle(d / 2).sketchOnPlane(plan, origine), { frenet:true });
    };
    const plein = balayer(de);
    return appliquer(etat, ep > 0 ? plein.cut(balayer(de - 2 * ep)) : plein, op);
  },

  ressort(R, etat, op, { v }){
    const D = v(op.diametre), fil = v(op.fil), pas = v(op.pas), tours = v(op.tours);
    if(!(D > fil && fil > 0 && pas > fil && tours > 0)) throw new Error("diamètre > fil, et pas > fil : les spires ne doivent pas se toucher");
    const o = [v(op.x ?? 0), v(op.y ?? 0), v(op.z ?? 0)];
    const helice = R.assembleWire([R.makeHelix(pas, pas * tours, D / 2, o, AXES.Z)]);
    /* Le fil part du début de l'hélice, à plat dans le plan contenant l'axe : presque perpendiculaire à la tangente. */
    const profil = R.drawCircle(fil / 2).sketchOnPlane(new R.Plane([o[0] + D / 2, o[1], o[2]], [1, 0, 0], [0, 1, 0]));
    return appliquer(etat, R.genericSweep(profil.wire, helice, { frenet:true }), op);
  },

  gravure(R, etat, op, ctx){
    const v = ctx.v, esq = chercherEsquisse(ctx, op.esquisse), p = v(op.profondeur);
    if(!(p > 0)) throw new Error("profondeur positive");
    const cible = corpsCible(etat, op.corps), r = repere(esq.plan, v), relief = op.mode === "relief";
    /* En creux, l'outil dépasse un peu de la surface pour ne pas laisser de face commune. */
    const plan = new R.Plane(relief ? r.o : vec.ajout(r.o, r.n, -p), r.x, r.n);
    const outil = dessinRegions(R, esq, op.contours).sketchOnPlane(plan).extrude(relief ? p : p + 0.01);
    return remplacer(etat, cible, relief ? cible.shape.fuse(outil) : cible.shape.cut(outil));
  },

  decouper(R, etat, op, { v }){
    const cible = corpsCible(etat, op.corps);
    const axe = { XY:2, XZ:1, YZ:0 }[op.plan || "XY"], d = v(op.decalage ?? 0);
    const [mi, ma] = cible.shape.boundingBox.bounds;
    if(d <= mi[axe] || d >= ma[axe]) throw new Error("le plan de découpe ne traverse pas ce corps");
    const boite = (de, a) => {
      const A = mi.map(c => c - 1), B = ma.map(c => c + 1);
      A[axe] = de; B[axe] = a;
      return R.makeBox(A, B);
    };
    const bas = cible.shape.intersect(boite(mi[axe] - 1, d)), haut = cible.shape.intersect(boite(d, ma[axe] + 1));
    return nouveauCorps(remplacer(etat, cible, bas), haut);
  },

  echelle(R, etat, op, { v }){
    const cible = corpsCible(etat, op.corps), f = v(op.facteur);
    if(!(f > 0)) throw new Error("facteur positif");
    const copie = cible.shape.clone();
    const forme = copie.scale(f, op.origine ? [0, 0, 0] : copie.boundingBox.center);
    return op.copie ? nouveauCorps(etat, forme) : remplacer(etat, cible, forme);
  },

  tirer(R, etat, op, { v }){
    const cible = corpsCible(etat, op.corps), d = v(op.distance);
    if(!op.face) throw new Error("face à désigner");
    if(!d) throw new Error("distance non nulle : positive pour ajouter, négative pour enlever");
    const f = faceSuivie(R, [cible], op.face);
    if(!f) throw new Error("la face n'existe plus : désignez-la de nouveau");
    const n = f.normalAt();
    const outil = R.basicFaceExtrusion(f, new R.Vector([n.x * d, n.y * d, n.z * d]));
    return remplacer(etat, cible, d > 0 ? cible.shape.fuse(outil, { simplify:true }) : cible.shape.cut(outil, { simplify:true }));
  },

  conge(R, etat, op, ctx){
    const { v } = ctx;
    const cible = corpsCible(etat, op.corps), r1 = v(op.rayon);
    if(!(r1 > 0)) throw new Error("rayon positif");
    /* Un second rayon : le congé évolue de l'un à l'autre le long de l'arête. */
    const r2 = op.rayon2 !== undefined && String(op.rayon2).trim() !== "" ? v(op.rayon2) : null;
    if(r2 !== null && !(r2 > 0)) throw new Error("second rayon positif");
    const rayon = r2 === null ? r1 : [r1, r2];
    const forme = op.toutes ? cible.shape.fillet(rayon)
      : cible.shape.fillet(rayon, (e) => e.inList(designes(R, cible.shape, "aretes", op.aretes, op, ctx)));
    return remplacer(etat, cible, forme);
  },
  chanfrein(R, etat, op, ctx){
    const { v } = ctx;
    const cible = corpsCible(etat, op.corps), d1 = v(op.distance);
    if(!(d1 > 0)) throw new Error("distance positive");
    /* Une seconde distance : un chanfrein dissymétrique ; le noyau compte la première depuis une face que toutes les arêtes bordent. */
    const d2 = op.distance2 !== undefined && String(op.distance2).trim() !== "" ? v(op.distance2) : null;
    if(d2 !== null && !(d2 > 0)) throw new Error("seconde distance positive");
    let forme;
    if(d2 !== null){
      if(op.toutes) throw new Error("un chanfrein dissymétrique vise des arêtes désignées");
      const aretes = designes(R, cible.shape, "aretes", op.aretes, op, ctx);
      const porte = cible.shape.faces.find(f => { const bords = f.edges.map(e => e.hashCode); return aretes.every(a => bords.includes(a.hashCode)); });
      if(!porte) throw new Error("les arêtes d'un chanfrein dissymétrique doivent border une même face");
      forme = cible.shape.chamfer({ radius:{ distances:[d1, d2], selectedFace:(f) => f.inList([porte]) }, filter:new R.EdgeFinder().inList(aretes) });
    }else forme = op.toutes ? cible.shape.chamfer(d1)
      : cible.shape.chamfer(d1, (e) => e.inList(designes(R, cible.shape, "aretes", op.aretes, op, ctx)));
    return remplacer(etat, cible, forme);
  },
  coque(R, etat, op, ctx){
    const { v } = ctx;
    const cible = corpsCible(etat, op.corps), ep = v(op.epaisseur);
    if(!(ep > 0)) throw new Error("épaisseur positive");
    const faces = designes(R, cible.shape, "faces", op.faces, op, ctx);
    /* Épaisseur positive : vers l'intérieur (l'encombrement ne change pas) ; négative pour replicad : vers l'extérieur. */
    return remplacer(etat, cible, cible.shape.shell(op.exterieur ? -ep : ep, (f) => f.inList(faces)));
  },

  combiner(R, etat, op){
    const cible = corpsCible(etat, op.cible);
    const outils = (op.outils || []).map(n => etat.corps.find(c => c.nom === n && c !== cible));
    if(!outils.length || outils.some(o => !o)) throw new Error("corps outils à choisir (autres que la cible)");
    let forme = cible.shape;
    for(const o of outils){
      forme = op.operation === "enlever" ? forme.cut(o.shape) : op.operation === "intersection" ? forme.intersect(o.shape) : forme.fuse(o.shape);
    }
    const suite = remplacer(etat, cible, forme);
    return op.garder ? suite : { ...suite, corps:suite.corps.filter(c => !outils.includes(c)) };
  },

  deplacer(R, etat, op, { v }){
    const cible = corpsCible(etat, op.corps);
    let forme = cible.shape.clone();
    const c = forme.boundingBox.center;
    for(const [axe, cle] of [["X", "rx"], ["Y", "ry"], ["Z", "rz"]]){
      const a = v(op[cle] ?? 0);
      if(a) forme = forme.rotate(a, c, AXES[axe]);
    }
    forme = forme.translate([v(op.tx ?? 0), v(op.ty ?? 0), v(op.tz ?? 0)]);
    return op.copie ? nouveauCorps(etat, forme) : remplacer(etat, cible, forme);
  },
  miroir(R, etat, op, { v }){
    const cible = corpsCible(etat, op.corps);
    const nom = op.plan || "YZ", n = { XY:[0, 0, 1], XZ:[0, 1, 0], YZ:[1, 0, 0] }[nom];
    const image = cible.shape.clone().mirror(nom, vec.ajout([0, 0, 0], n, v(op.decalage ?? 0)));
    return op.separe ? nouveauCorps(etat, image) : remplacer(etat, cible, cible.shape.fuse(image));
  },
  repetition(R, etat, op, ctx){
    const { v } = ctx;
    const cible = corpsCible(etat, op.corps), n = Math.round(v(op.nombre));
    if(!(n >= 2 && n <= 500)) throw new Error("nombre d'exemplaires entre 2 et 500");
    const ref = op.axe?.startsWith("ref:") ? axeConstruction(ctx.doc.operations.find(o => o.id === op.axe.slice(4)), v, ctx.doc) : null;
    const axe = ref ? ref.dir : AXES[op.axe || "X"];
    const pivot = ref ? ref.point : [0, 0, 0];
    let pas;
    if(op.mode === "circulaire"){
      const total = v(op.angle ?? 360);
      pas = Math.abs(total % 360) < 1e-9 ? total / n : total / (n - 1);
    }else pas = v(op.pas);
    const copies = [];
    let suite = etat;
    /* Une seconde direction : une grille, ou plusieurs tours autour de l'axe décalés le long d'un autre. */
    const n2 = op.axe2 ? Math.round(v(op.nombre2 ?? 1)) : 1;
    if(!(n2 >= 1 && n * n2 <= 500)) throw new Error("500 exemplaires au plus, deux directions comprises");
    const axe2 = op.axe2 ? AXES[op.axe2] : null, pas2 = op.axe2 ? v(op.pas2 ?? 0) : 0;
    for(let j = 0; j < n2; j++) for(let i = 0; i < n; i++){
      if(!i && !j) continue;
      let copie = op.mode === "circulaire" ? cible.shape.clone().rotate(pas * i, pivot, axe)
                                           : cible.shape.clone().translate(axe.map(c => c * pas * i));
      if(j) copie = copie.translate(axe2.map(c => c * pas2 * j));
      if(op.separe) suite = nouveauCorps(suite, copie);
      else copies.push(copie);
    }
    if(op.separe) return suite;
    /* Les exemplaires qui ne se touchent pas se réunissent d'un coup ; sinon, un par un. */
    const espaces = op.mode !== "circulaire" && copies.length > 1;
    return remplacer(etat, cible, espaces ? cible.shape.fuse(R.makeCompound(copies)) : copies.reduce((f, c) => f.fuse(c), cible.shape));
  },

  async step(R, etat, op){
    if(!op.donnees) throw new Error("fichier STEP absent");
    const octets = Uint8Array.from(atob(op.donnees), c => c.charCodeAt(0));
    const forme = await R.importSTEP(new Blob([octets]));
    return nouveauCorps(etat, forme, { reference:!!op.reference, nomFichier:op.fichier });
  },
};

/**
 * Rejoue l'historique. `cache` (tableau gardé par l'appelant) évite de refaire
 * le début inchangé. Rend { corps, etats:{ idOp:{ erreur? } }, erreursParametres }.
 */
Object.assign(TYPES, TYPES_ATELIERS, TYPES_PLUS);
const AIDES_OPERATIONS = { corpsCible, remplacer, nouveauCorps, appliquer, chercherEsquisse, plusProches, planNoyau,
  tracer, dessinRegions, revolutionProfil, orienter, construire, designes, faceSuivie };
Object.assign(OPERATIONS, ateliers(AIDES_OPERATIONS), operationsPlus(AIDES_OPERATIONS));

/** options.plat : les plis de tôle restent à plat (développé). */
export async function construire(R, doc, cache = [], oc = null, options = {}){
  const { valeurs, erreurs:erreursParametres } = evaluerParametres(doc.parametres || []);
  const v = evaluateur(valeurs);
  const fin = Math.min(doc.curseur ?? doc.operations.length, doc.operations.length);
  const ignorees = new Set(doc.operations.filter((o, i) => o.suspendue || i >= fin).map(o => o.id));
  const ctx = { doc, v, ignorees, note:null, oc, plat:!!options.plat };
  /* Un composant reconstruit sa pièce ici même : l'opération en cours doit retrouver son contexte après. */
  const contexte = [opCourante, docCourant, noteCourante];
  const sortis = new Set();         // les formes des états remplacés : libérées à la fin, si plus rien ne les tient

  let etat = { corps:[], compteur:0 };
  let cle = "";
  /* Une opération ne dépend que des paramètres qu'elle cite (directement, ou par l'expression d'un autre) :
     changer une cote de la fin ne refait pas le début. */
  const noms = (doc.parametres || []).map(p => p.nom).filter(n => NOM_PARAMETRE.test(n));     // un nom invalide est signalé ailleurs
  const cites = (texte) => noms.filter(n => new RegExp(`(^|[^\\wÀ-ÿ])${n}(?![\\wÀ-ÿ])`).test(texte));
  const etats = {};
  for(let i = 0; i < fin; i++){
    const op = doc.operations[i];
    /* Le nom du corps n'entre pas dans la clé : le recevoir du noyau ne doit pas tout faire recalculer. */
    /* Le nom du corps et les descriptions viennent du noyau : les recevoir ne doit pas tout refaire. */
    const texteOp = JSON.stringify(op, (k, val) => k === "corpsNom" || k === "refs" ? undefined : val);
    /* Les clés ne citent rien : le champ « L » d'une boîte n'est pas le paramètre L. */
    cle = hacher(cle + texteOp + cites(texteOp.replace(/"[\w]+":/g, "")).map(n => `${n}=${valeurs.get(n)}`).join());
    if(cache[i]?.cle === cle){
      etat = cache[i].etat;
      Object.assign(etats, cache[i].etats);
      if(cache[i].etats[op.id]?.plan) op.plan = cache[i].etats[op.id].plan;      // plan déjà suivi : la suite le lit
      continue;
    }
    const note = {};
    ctx.note = note;
    opCourante = op; docCourant = doc; noteCourante = note;
    if(!op.suspendue){
      const f = OPERATIONS[op.type];
      const debut = performance.now();
      try{
        if(!f) throw new Error(`opération inconnue « ${op.type} »`);
        options.surOperation?.(op.id);
        const avant = op.composant ? new Set(etat.corps) : null;
        etat = await f(R, etat, op, ctx);
        /* Un corps né dans un composant lui appartient ; une opération ne change pas le composant d'un corps existant. */
        if(avant) etat = { ...etat, corps:etat.corps.map(c => c.composant || avant.has(c) || [...avant].some(a => a.nom === c.nom) ? c : { ...c, composant:op.composant }) };
      }catch(e){
        if(estFatale(e, oc)){ e.opId = op.id; throw e; }     // le noyau est mort : continuer sur son tas abîmé serait pire
        note.erreur = messageErreur(e, oc);
      }
      note.ms = Math.round(performance.now() - debut);
    }
    etats[op.id] = note;
    for(const c of cache[i]?.etat.corps || []) sortis.add(c.shape);
    cache[i] = { cle, etat, etats:{ [op.id]:note } };
  }
  for(let i = fin; i < cache.length; i++) for(const c of cache[i].etat.corps) sortis.add(c.shape);
  cache.length = fin;
  /* Le ramasse-miettes libère trop tard pour le tas du noyau, qui ne redescend jamais : on rend tout de suite. */
  for(const e of cache) for(const c of e.etat.corps) sortis.delete(c.shape);
  for(const c of etat.corps) sortis.delete(c.shape);
  for(const s of sortis) s.delete();
  [opCourante, docCourant, noteCourante] = contexte;
  return { corps:etat.corps, etats, erreursParametres };
}
