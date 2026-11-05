/* =============================================================================
   Conception 3D — c2c-esquisse-plus.js
   Les tracés et les outils d'esquisse ajoutés : ellipse, conique, courbe par
   équation, cercles et rectangles par points, polygones, prolonger, couper,
   échelle, déplacer ou copier, auto-contraindre, bouts libres, copier-coller.
   Sans écran : le banc les vérifie sous Node. Modifient l'esquisse sur place ;
   l'appelant mémorise et relance le solveur, comme c2b-outils-esquisse.js.
   ============================================================================= */
"use strict";

import { indexer, nouvelId, cercle3Points, rayonDe, ajouterPrimitives } from "./c2-esquisse.js";
import { evaluer } from "./c1-expressions.js";
import { nettoyer, intersectionsCourbes, formeCourbe } from "./c2b-outils-esquisse.js";

const TAU = Math.PI * 2;
const pointNeuf = (esq, x, y, extra = {}) => {
  const id = nouvelId(esq, "p");
  esq.elements.push({ id, type:"point", x, y, ...extra });
  return id;
};
const pointDe = (esq, m, extra = {}) => m.id || pointNeuf(esq, m.x, m.y, extra);
const ligneNeuve = (esq, p1, p2, extra = {}) => {
  const id = nouvelId(esq, "l");
  esq.elements.push({ id, type:"ligne", p1, p2, ...extra });
  return id;
};
const contrainte = (esq, k) => esq.contraintes.push({ id:nouvelId(esq, "k"), ...k });

/** Une spline fermée par des points : le premier et le dernier sont un seul point. */
function splineFermee(esq, points){
  const ids = points.map(([x, y]) => pointNeuf(esq, x, y));
  const pts = [...ids, ids[0]];
  const id = nouvelId(esq, "s");
  esq.elements.push({ id, type:"spline", pts, p1:ids[0], p2:ids[0] });
  return id;
}

/** shortcut: l'ellipse est une spline fermée de 48 points (écart d'aire sous 0,1 %) ; ses demi-axes ne se cotent pas, il faudrait un élément ellipse dans le solveur. */
export function ajouterEllipse(esq, c, sommet, b){
  const a = Math.hypot(sommet.x - c.x, sommet.y - c.y), t0 = Math.atan2(sommet.y - c.y, sommet.x - c.x);
  if(!(a > 1e-6 && b > 1e-6)) return null;
  const pts = Array.from({ length:48 }, (_, i) => {
    const u = i / 48 * TAU, x = a * Math.cos(u), y = b * Math.sin(u);
    return [c.x + x * Math.cos(t0) - y * Math.sin(t0), c.y + x * Math.sin(t0) + y * Math.cos(t0)];
  });
  return splineFermee(esq, pts);
}

/** Une courbe (x(t), y(t)) : expressions des paramètres de la page, jamais du code. Rend le nombre de points. */
export function ajouterCourbeEquation(esq, { x, y, de, a, pas, ferme = false }, valeur = () => { throw new Error("paramètre inconnu"); }){
  if(!(pas >= 2 && pas <= 500)) throw new Error("entre 2 et 500 pas");
  const lire = (t) => (n) => n === "t" ? t : valeur(n);
  const pts = [];
  for(let i = 0; i <= pas; i++){
    const t = de + (a - de) * i / pas, q = [evaluer(x, lire(t)), evaluer(y, lire(t))];
    if(!q.every(Number.isFinite)) throw new Error(`t = ${+t.toFixed(4)} : valeur non finie`);
    pts.push(q);
  }
  if(ferme){ splineFermee(esq, pts.slice(0, -1)); return pts.length - 1; }
  const ids = pts.map(([u, w]) => pointNeuf(esq, u, w));
  esq.elements.push({ id:nouvelId(esq, "s"), type:"spline", pts:ids, p1:ids[0], p2:ids[ids.length - 1] });
  return pts.length;
}

/** Une conique par ses deux bouts, le sommet du triangle et rho (0,5 : parabole). Échantillonnée en spline. */
export function ajouterConique(esq, a, b, s, rho){
  if(!(rho > 0 && rho < 1)) throw new Error("rho entre 0 et 1, sans les atteindre");
  const w = rho / (1 - rho), ids = [];
  for(let i = 0; i <= 24; i++){
    const t = i / 24, u = 1 - t, d = u * u + 2 * u * t * w + t * t;
    ids.push(pointNeuf(esq, (u * u * a.x + 2 * u * t * w * s.x + t * t * b.x) / d, (u * u * a.y + 2 * u * t * w * s.y + t * t * b.y) / d));
  }
  esq.elements.push({ id:nouvelId(esq, "s"), type:"spline", pts:ids, p1:ids[0], p2:ids[ids.length - 1] });
  return ids;
}

/** Un rectangle d'équerre, posé par un côté (a, b) et un point de la hauteur. */
export function ajouterRectangle3Points(esq, a, b, m){
  const L = Math.hypot(b.x - a.x, b.y - a.y);
  if(L < 1e-6) return null;
  const nx = -(b.y - a.y) / L, ny = (b.x - a.x) / L, h = (m.x - a.x) * nx + (m.y - a.y) * ny;
  if(Math.abs(h) < 1e-6) return null;
  const ids = [pointDe(esq, a), pointDe(esq, b), pointNeuf(esq, b.x + nx * h, b.y + ny * h), pointNeuf(esq, a.x + nx * h, a.y + ny * h)];
  const l = ids.map((p, i) => ligneNeuve(esq, p, ids[(i + 1) % 4]));
  contrainte(esq, { type:"perpendiculaire", a:l[0], b:l[1] });
  contrainte(esq, { type:"perpendiculaire", a:l[1], b:l[2] });
  contrainte(esq, { type:"perpendiculaire", a:l[2], b:l[3] });
  return l;
}

/** Un rectangle par deux coins, ses quatre coins arrondis et tangents. */
export function ajouterRectangleArrondi(esq, a, b, r){
  const [x0, x1] = [Math.min(a.x, b.x), Math.max(a.x, b.x)], [y0, y1] = [Math.min(a.y, b.y), Math.max(a.y, b.y)];
  if(!(r > 0) || 2 * r >= Math.min(x1 - x0, y1 - y0)) return "Le rayon doit être plus petit que la moitié du petit côté.";
  const P = (x, y) => pointNeuf(esq, x, y);
  const coin = [
    [x1 - r, y0 + r, [x1 - r, y0], [x1, y0 + r]], [x1 - r, y1 - r, [x1, y1 - r], [x1 - r, y1]],
    [x0 + r, y1 - r, [x0 + r, y1], [x0, y1 - r]], [x0 + r, y0 + r, [x0, y0 + r], [x0 + r, y0]],
  ].map(([cx, cy, d, f]) => ({ c:P(cx, cy, { constr:true }), d:P(...d), f:P(...f) }));
  for(const k of coin) esq.elements.find(e => e.id === k.c).constr = true;
  const arcs = coin.map(k => { const id = nouvelId(esq, "a"); esq.elements.push({ id, type:"arc", c:k.c, p1:k.d, p2:k.f }); return id; });
  const lignes = coin.map((k, i) => ligneNeuve(esq, k.f, coin[(i + 1) % 4].d));
  lignes.forEach((l, i) => {
    contrainte(esq, { type:"tangente", a:l, b:arcs[i] });
    contrainte(esq, { type:"tangente", a:l, b:arcs[(i + 1) % 4] });
  });
  for(let i = 1; i < 4; i++) contrainte(esq, { type:"egal", a:arcs[0], b:arcs[i] });
  contrainte(esq, { type:"horizontal", a:lignes[1] });
  contrainte(esq, { type:"vertical", a:lignes[0] });
  return null;
}

/** Un polygone régulier. mode : "inscrit" (par un sommet), "circonscrit" (par le milieu d'un côté), "arete" (par un côté, a et b). */
export function ajouterPolygone(esq, a, b, n, mode){
  if(!(n >= 3 && n <= 64)) return null;
  const d = Math.hypot(b.x - a.x, b.y - a.y), t = Math.atan2(b.y - a.y, b.x - a.x);
  if(d < 1e-6) return null;
  let c = a, r = d, t0 = t;
  if(mode === "circonscrit"){ r = d / Math.cos(Math.PI / n); t0 = t + Math.PI / n; }
  if(mode === "arete"){
    r = d / (2 * Math.sin(Math.PI / n));
    const h = d / (2 * Math.tan(Math.PI / n));
    c = { x:(a.x + b.x) / 2 - Math.sin(t) * h, y:(a.y + b.y) / 2 + Math.cos(t) * h };
    t0 = Math.atan2(a.y - c.y, a.x - c.x);
  }
  const centre = mode === "arete" ? pointNeuf(esq, c.x, c.y, { constr:true }) : pointDe(esq, c, { constr:true });
  const k = nouvelId(esq, "c");
  esq.elements.push({ id:k, type:"cercle", c:centre, r, constr:true });
  const ids = Array.from({ length:n }, (_, i) => pointNeuf(esq, c.x + r * Math.cos(t0 + i * TAU / n), c.y + r * Math.sin(t0 + i * TAU / n)));
  const l = ids.map((p, i) => ligneNeuve(esq, p, ids[(i + 1) % n]));
  for(const p of ids) contrainte(esq, { type:"sur", a:p, b:k });
  for(let i = 1; i < n; i++) contrainte(esq, { type:"egal", a:l[0], b:l[i] });
  return l;
}

export function ajouterCercle3Points(esq, a, m, b){
  const k = cercle3Points(a, m, b);
  if(!k) return null;
  const c = pointNeuf(esq, k.c.x, k.c.y), id = nouvelId(esq, "c");
  esq.elements.push({ id, type:"cercle", c, r:k.r });
  return { id, c, r:k.r };
}

export function ajouterCercle2Points(esq, a, b){
  const r = Math.hypot(b.x - a.x, b.y - a.y) / 2;
  if(r < 1e-6) return null;
  const c = pointNeuf(esq, (a.x + b.x) / 2, (a.y + b.y) / 2), id = nouvelId(esq, "c");
  esq.elements.push({ id, type:"cercle", c, r });
  return { id, c, r };
}

/** Une ligne par son milieu et un de ses bouts. */
export function ajouterLigneMilieu(esq, c, b, extra = {}){
  if(Math.hypot(b.x - c.x, b.y - c.y) < 1e-6) return null;
  const p1 = pointNeuf(esq, 2 * c.x - b.x, 2 * c.y - b.y), p2 = pointDe(esq, b), id = ligneNeuve(esq, p1, p2, extra);
  const m = pointDe(esq, c, { constr:true });
  contrainte(esq, { type:"milieu", a:m, b:id });
  return { id, p1, p2 };
}

/** Un arc qui part d'un bout de ligne ou d'arc, tangent, et finit au point donné. */
export function ajouterArcTangent(esq, depart, m){
  const idx = indexer(esq), P = idx.get(depart);
  const courbe = esq.elements.find(e => (e.type === "ligne" || e.type === "arc") && !e.constr && (e.p1 === depart || e.p2 === depart));
  if(!P || !courbe) return null;
  let t;
  if(courbe.type === "ligne"){
    const o = idx.get(courbe.p1 === depart ? courbe.p2 : courbe.p1);
    t = [P.x - o.x, P.y - o.y];
  }else{
    const c = idx.get(courbe.c), r = [P.x - c.x, P.y - c.y];
    t = courbe.p2 === depart ? [-r[1], r[0]] : [r[1], -r[0]];     // nos arcs tournent dans le sens trigonométrique
  }
  const L = Math.hypot(...t) || 1, u = [t[0] / L, t[1] / L], n = [-u[1], u[0]];
  const dx = m.x - P.x, dy = m.y - P.y, h = dx * n[0] + dy * n[1];
  if(Math.abs(h) < 1e-6) return null;
  const R = (dx * dx + dy * dy) / (2 * h);
  const c = pointNeuf(esq, P.x + n[0] * R, P.y + n[1] * R, { constr:true }), f = pointDe(esq, m);
  const id = nouvelId(esq, "a");
  esq.elements.push({ id, type:"arc", c, p1:R > 0 ? depart : f, p2:R > 0 ? f : depart });
  contrainte(esq, { type:"tangente", a:courbe.id, b:id });
  return id;
}

/* -----------------------------------------------------------------------------
   Modifier
   --------------------------------------------------------------------------- */
/** Prolonge le bout de ligne le plus proche du clic jusqu'à la première courbe rencontrée. Rend un refus ou null. */
export function prolonger(esq, id, m){
  const idx = indexer(esq), e = idx.get(id);
  if(e?.type !== "ligne") return "Prolonger s'applique à une ligne.";
  const a = idx.get(e.p1), b = idx.get(e.p2);
  const finB = Math.hypot(m.x - b.x, m.y - b.y) <= Math.hypot(m.x - a.x, m.y - a.y);
  const [fixe, bout] = finB ? [a, b] : [b, a];
  const L = Math.hypot(bout.x - fixe.x, bout.y - fixe.y);
  const ux = (bout.x - fixe.x) / L, uy = (bout.y - fixe.y) / L;
  const rayon = { a:bout, b:{ x:bout.x + ux * 1e6, y:bout.y + uy * 1e6 } };
  let mieux = null, dMin = Infinity;
  for(const o of esq.elements){
    if(o === e || o.constr) continue;
    const g = formeCourbe(idx, o);
    if(!g) continue;
    for(const q of intersectionsCourbes(rayon, g)){
      const d = (q.x - bout.x) * ux + (q.y - bout.y) * uy;
      if(d > 1e-7 && d < dMin){ dMin = d; mieux = q; }
    }
  }
  if(!mieux) return "Il n'y a rien à rejoindre dans cette direction.";
  bout.x = mieux.x; bout.y = mieux.y;
  esq.contraintes = esq.contraintes.filter(k => !(k.a === id && k.type === "longueur"));
  return null;
}

/** Coupe une courbe à ses intersections, sans rien retirer. Rend un refus ou null. */
export function couper(esq, id){
  const idx = indexer(esq), e = idx.get(id), f = e && formeCourbe(idx, e);
  if(!f) return "Couper s'applique à une ligne, un cercle ou un arc.";
  const coupes = [];
  for(const o of esq.elements){
    if(o === e || o.constr) continue;
    const g = formeCourbe(idx, o);
    if(g) coupes.push(...intersectionsCourbes(f, g));
  }
  const rang = (q) => f.a ? (q.x - f.a.x) * (f.b.x - f.a.x) + (q.y - f.a.y) * (f.b.y - f.a.y) : ((Math.atan2(q.y - f.c.y, q.x - f.c.x) - f.a1) % TAU + TAU) % TAU;
  const fin = f.a ? (f.b.x - f.a.x) ** 2 + (f.b.y - f.a.y) ** 2 : f.bal;
  const plein = e.type === "cercle";
  const vus = [], ts = coupes.map(q => ({ q, t:rang(q) })).filter(x => (plein || x.t > 1e-7) && x.t < fin - 1e-7).sort((a, b) => a.t - b.t)
    .filter(x => !vus.some(t => Math.abs(t - x.t) < 1e-7) && vus.push(x.t));
  if(!ts.length || (plein && ts.length < 2)) return "Cette courbe ne croise rien : rien à couper.";
  esq.contraintes = esq.contraintes.filter(k => !((k.a === id || k.b === id) && ["longueur", "egal", "tangente", "diametre", "rayon"].includes(k.type)));
  const extra = e.constr ? { constr:true } : {};
  if(e.type === "ligne"){
    const dernier = e.p2;
    let q0 = pointNeuf(esq, ts[0].q.x, ts[0].q.y);
    e.p2 = q0;
    ts.slice(1).forEach(({ q }) => { const n = pointNeuf(esq, q.x, q.y); ligneNeuve(esq, q0, n, extra); q0 = n; });
    ligneNeuve(esq, q0, dernier, extra);
  }else{
    const arc = (c, p1, p2) => esq.elements.push({ id:nouvelId(esq, "a"), type:"arc", c, p1, p2, ...extra });
    const ids = ts.map(({ q }) => pointNeuf(esq, q.x, q.y));
    if(plein){
      ids.forEach((p, i) => arc(e.c, p, ids[(i + 1) % ids.length]));
      esq.elements = esq.elements.filter(x => x !== e);
    }else{
      const dernier = e.p2;
      e.p2 = ids[0];
      ids.forEach((p, i) => arc(e.c, p, ids[i + 1] ?? dernier));
    }
  }
  nettoyer(esq);
  return null;
}

/** Les points que touche une liste d'éléments. */
function pointsDe(esq, ids){
  const idx = indexer(esq), sortie = new Set();
  for(const id of ids){
    const e = idx.get(id);
    if(!e) continue;
    if(e.type === "point") sortie.add(id);
    for(const c of ["p1", "p2", "c", "p"]) if(e[c]) sortie.add(e[c]);
    for(const q of e.pts || []) sortie.add(q);
  }
  return sortie;
}

/** Met la sélection à l'échelle, depuis un point : cercles et cotes numériques suivent. */
export function echelleEsquisse(esq, ids, f, o){
  if(!(f > 0)) return "Le facteur doit être positif.";
  const idx = indexer(esq), choisis = new Set(ids);
  for(const id of pointsDe(esq, ids)){
    const p = idx.get(id);
    if(id === "o") continue;
    p.x = o.x + (p.x - o.x) * f; p.y = o.y + (p.y - o.y) * f;
  }
  for(const id of ids){
    const e = idx.get(id);
    if(e?.type === "cercle") e.r *= f;
    if(e?.type === "texte") e.h *= f;
  }
  for(const k of esq.contraintes){
    if(!["longueur", "distance", "distanceX", "distanceY", "rayon", "diametre"].includes(k.type)) continue;
    if(![k.a, k.b].filter(Boolean).every(x => choisis.has(x))) continue;
    /* Une cote qui cite un paramètre reste sa formule : à l'auteur de la changer. */
    if(/^\s*-?\d+(\.\d+)?\s*$/.test(String(k.expr))) k.expr = String(+(parseFloat(k.expr) * f).toFixed(6));
  }
  return null;
}

/** Déplace, tourne ou copie la sélection. */
export function transformerEsquisse(esq, ids, { dx = 0, dy = 0, angle = 0, cx = 0, cy = 0, copie = false }){
  const t = angle * Math.PI / 180, c = Math.cos(t), s = Math.sin(t);
  const f = (x, y) => [cx + (x - cx) * c - (y - cy) * s + dx, cy + (x - cx) * s + (y - cy) * c + dy];
  if(copie){
    const copies = copierEntites(esq, ids);
    for(const p of copies.points) [p.x, p.y] = f(p.x, p.y);
    return collerEntites(esq, copies, { dx:0, dy:0 });
  }
  const idx = indexer(esq);
  for(const id of pointsDe(esq, ids)){
    if(id === "o") continue;
    const p = idx.get(id);
    [p.x, p.y] = f(p.x, p.y);
  }
  return null;
}

/** Une copie autonome d'entités : ses points et ses courbes, sans leurs contraintes. */
export function copierEntites(esq, ids){
  const idx = indexer(esq), points = [...pointsDe(esq, ids)].map(id => ({ ...idx.get(id) }));
  const courbes = ids.map(id => idx.get(id)).filter(e => e && e.type !== "point").map(e => JSON.parse(JSON.stringify(e)));
  return { points, courbes };
}

/** Colle une copie : de nouveaux identifiants, décalés. Rend les identifiants créés. */
export function collerEntites(esq, { points, courbes }, { dx = 0, dy = 0 }){
  const table = new Map(), crees = [];
  for(const p of points){
    const id = pointNeuf(esq, p.x + dx, p.y + dy, { ...(p.constr ? { constr:true } : {}), ...(p.seul ? { seul:true } : {}) });
    table.set(p.id, id);
    crees.push(id);
  }
  const prefixe = { ligne:"l", cercle:"c", arc:"a", spline:"s", texte:"x" };
  for(const e of courbes){
    const n = { ...e, id:nouvelId(esq, prefixe[e.type] || "e") };
    for(const c of ["p1", "p2", "c", "p"]) if(n[c]) n[c] = table.get(n[c]);
    if(n.pts) n.pts = n.pts.map(q => table.get(q));
    esq.elements.push(n);
    crees.push(n.id);
  }
  return crees;
}

/* -----------------------------------------------------------------------------
   Inspecter et contraindre d'un coup
   --------------------------------------------------------------------------- */
/**
 * Pose ce que le dessin montre déjà : points confondus, lignes presque horizontales ou verticales.
 * Rend le nombre de contraintes ajoutées. L'appelant vérifie que le solveur les accepte.
 */
export function autoContraindre(esq, tolDistance = 0.05, tolAngle = 1){
  let n = 0;
  const lignes = esq.elements.filter(e => e.type === "ligne");
  const points = esq.elements.filter(e => e.type === "point");
  const unis = new Map();
  const racine = (id) => { while(unis.has(id)) id = unis.get(id); return id; };
  for(const k of esq.contraintes) if(k.type === "coincident") unis.set(racine(k.a), racine(k.b));
  points.forEach((a, i) => {
    for(const b of points.slice(i + 1)){
      if(Math.hypot(a.x - b.x, a.y - b.y) > tolDistance || racine(a.id) === racine(b.id)) continue;
      contrainte(esq, { type:"coincident", a:a.id, b:b.id });
      unis.set(racine(a.id), racine(b.id));
      n++;
    }
  });
  const idx = indexer(esq);
  for(const l of lignes){
    if(esq.contraintes.some(k => k.a === l.id && (k.type === "horizontal" || k.type === "vertical"))) continue;
    const a = idx.get(l.p1), b = idx.get(l.p2);
    const ang = Math.abs(Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI) % 180;
    if(ang < tolAngle || ang > 180 - tolAngle){ contrainte(esq, { type:"horizontal", a:l.id }); n++; }
    else if(Math.abs(ang - 90) < tolAngle){ contrainte(esq, { type:"vertical", a:l.id }); n++; }
  }
  return n;
}

/** Les points où une chaîne s'arrête : ce qui empêche un contour de se fermer. */
export function boutsLibres(esq){
  const compte = new Map(), parPos = new Map(), idx = indexer(esq);
  const cle = (id) => { const p = idx.get(id); return `${p.x.toFixed(4)},${p.y.toFixed(4)}`; };
  for(const e of esq.elements){
    if(e.constr || !["ligne", "arc", "spline"].includes(e.type)) continue;
    for(const p of [e.p1, e.p2]){
      compte.set(cle(p), (compte.get(cle(p)) || 0) + 1);
      parPos.set(cle(p), p);
    }
  }
  return [...compte].filter(([, n]) => n === 1).map(([c]) => parPos.get(c));
}

/** Une droite de construction tangente à un cercle, depuis un point extérieur : les deux points de contact. */
export function pointsTangence(p, c, r){
  const d = Math.hypot(p.x - c.x, p.y - c.y);
  if(d <= r) return [];
  const a = Math.atan2(p.y - c.y, p.x - c.x), b = Math.acos(r / d);
  return [a + b, a - b].map(t => ({ x:c.x + r * Math.cos(t), y:c.y + r * Math.sin(t) }));
}

/** La bissectrice de deux lignes qui se rencontrent : son point de départ et sa direction. */
export function bissectrice(esq, idA, idB){
  const idx = indexer(esq), A = idx.get(idA), B = idx.get(idB);
  const [a1, a2, b1, b2] = [A.p1, A.p2, B.p1, B.p2].map(i => idx.get(i));
  const dA = [a2.x - a1.x, a2.y - a1.y], dB = [b2.x - b1.x, b2.y - b1.y], det = dA[0] * dB[1] - dA[1] * dB[0];
  if(Math.abs(det) < 1e-9) return null;
  const t = ((b1.x - a1.x) * dB[1] - (b1.y - a1.y) * dB[0]) / det;
  const O = { x:a1.x + t * dA[0], y:a1.y + t * dA[1] };
  const loin = (u, v) => Math.hypot(u.x - O.x, u.y - O.y) >= Math.hypot(v.x - O.x, v.y - O.y) ? u : v;
  const uA = loin(a1, a2), uB = loin(b1, b2);
  const la = Math.hypot(uA.x - O.x, uA.y - O.y), lb = Math.hypot(uB.x - O.x, uB.y - O.y);
  const dir = [(uA.x - O.x) / la + (uB.x - O.x) / lb, (uA.y - O.y) / la + (uB.y - O.y) / lb];
  const n = Math.hypot(...dir) || 1;
  return { o:O, fin:{ x:O.x + dir[0] / n * Math.max(la, lb), y:O.y + dir[1] / n * Math.max(la, lb) } };
}

export { rayonDe, ajouterPrimitives };
