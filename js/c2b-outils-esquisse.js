/* =============================================================================
   Conception 3D — c2b-outils-esquisse.js
   Les outils qui transforment une esquisse : ajuster, décaler, congé et
   chanfrein de coin, miroir, répétitions. Sans écran : le banc les vérifie
   sous Node. Tous modifient l'esquisse sur place ; c'est l'appelant qui
   mémorise l'état d'avant et relance le solveur.
   ============================================================================= */
"use strict";

import { rayonDe, indexer, nouvelId, profils, ajouterPrimitives, cercle3Points } from "./c2-esquisse.js";

const TAU = Math.PI * 2;
const norm2 = (x, y) => Math.hypot(x, y) || 1;
const point = (esq, x, y, extra = {}) => {
  const id = nouvelId(esq, "p");
  esq.elements.push({ id, type:"point", x, y, ...extra });
  return id;
};
const angleDe = (c, p) => Math.atan2(p.y - c.y, p.x - c.x);
const pos = (a) => { a %= TAU; return a < 0 ? a + TAU : a; };

/* -----------------------------------------------------------------------------
   Intersections
   --------------------------------------------------------------------------- */
/** Les courbes, en forme géométrique : { ligne:[a, b] } ou { c, r, a1, bal } (cercle : bal = 2π). */
function forme(idx, e){
  if(e.type === "ligne") return { a:idx.get(e.p1), b:idx.get(e.p2) };
  const c = idx.get(e.c);
  if(e.type === "cercle") return { c, r:e.r, a1:0, bal:TAU };
  if(e.type === "arc"){
    const a1 = angleDe(c, idx.get(e.p1));
    return { c, r:rayonDe(idx, e), a1, bal:pos(angleDe(c, idx.get(e.p2)) - a1) || TAU };
  }
  return null;
}

/** Position d'un point sur une courbe : t ∈ [0, 1] pour une ligne, angle depuis a1 pour un arc ; null si hors de la courbe. */
function surCourbe(f, p){
  if(f.a){
    const dx = f.b.x - f.a.x, dy = f.b.y - f.a.y;
    const t = ((p.x - f.a.x) * dx + (p.y - f.a.y) * dy) / (dx * dx + dy * dy || 1);
    return t > -1e-9 && t < 1 + 1e-9 ? t : null;
  }
  const u = pos(angleDe(f.c, p) - f.a1);
  return u <= f.bal + 1e-9 ? u : null;
}

function intersections(f, g){
  const res = [];
  if(f.a && g.a){
    const d1x = f.b.x - f.a.x, d1y = f.b.y - f.a.y, d2x = g.b.x - g.a.x, d2y = g.b.y - g.a.y;
    const det = d1x * d2y - d1y * d2x;
    if(Math.abs(det) < 1e-12) return res;
    const t = ((g.a.x - f.a.x) * d2y - (g.a.y - f.a.y) * d2x) / det;
    res.push({ x:f.a.x + t * d1x, y:f.a.y + t * d1y });
  }else if(f.a || g.a){
    const l = f.a ? f : g, k = f.a ? g : f;
    const dx = l.b.x - l.a.x, dy = l.b.y - l.a.y, fx = l.a.x - k.c.x, fy = l.a.y - k.c.y;
    const A = dx * dx + dy * dy, B = 2 * (fx * dx + fy * dy), C = fx * fx + fy * fy - k.r * k.r;
    const D = B * B - 4 * A * C;
    if(D < 0) return res;
    for(const s of D < 1e-12 ? [1] : [1, -1]){
      const t = (-B + s * Math.sqrt(Math.max(D, 0))) / (2 * A);
      res.push({ x:l.a.x + t * dx, y:l.a.y + t * dy });
    }
  }else{
    const dx = g.c.x - f.c.x, dy = g.c.y - f.c.y, d = Math.hypot(dx, dy);
    if(d < 1e-12 || d > f.r + g.r + 1e-9 || d < Math.abs(f.r - g.r) - 1e-9) return res;
    const a = (f.r * f.r - g.r * g.r + d * d) / (2 * d), h = Math.sqrt(Math.max(f.r * f.r - a * a, 0));
    const mx = f.c.x + a * dx / d, my = f.c.y + a * dy / d;
    for(const s of h < 1e-9 ? [1] : [1, -1]) res.push({ x:mx - s * h * dy / d, y:my + s * h * dx / d });
  }
  return res.filter(p => surCourbe(f, p) !== null && surCourbe(g, p) !== null);
}

export { forme as formeCourbe, intersections as intersectionsCourbes };

/* -----------------------------------------------------------------------------
   Ajuster : retire le morceau de courbe compris entre deux intersections
   --------------------------------------------------------------------------- */
export function ajuster(esq, id, m){
  const idx = indexer(esq);
  const e = idx.get(id);
  const f = e && forme(idx, e);
  if(!f) return "Ajuster s'applique à une ligne, un cercle ou un arc.";
  const coupes = [];
  for(const o of esq.elements){
    if(o === e || o.constr) continue;
    const g = forme(idx, o);
    if(g) for(const p of intersections(f, g)) coupes.push(surCourbe(f, p));
  }
  const tm = surCourbe(f, m) ?? 0;
  const fin = f.a ? 1 : f.bal;
  /* Un cercle n'a pas de bouts : l'angle 0 y est une coupe comme une autre, et il lui en faut deux
     pour retirer un morceau. */
  const plein = e.type === "cercle";
  const ts = [...new Set(coupes.map(t => +t.toFixed(9)))].filter(t => (plein || t > 1e-7) && t < fin - 1e-7).sort((a, b) => a - b);
  if(!ts.length || (plein && ts.length < 2)) return supprimerCourbe(esq, e);
  let t0, t1;
  if(plein){
    const k = ts.findIndex(t => t > tm);
    t0 = k <= 0 ? ts[ts.length - 1] : ts[k - 1];
    t1 = k < 0 ? ts[0] : ts[k];
  }else{
    t0 = [...ts].reverse().find(t => t <= tm) ?? 0;
    t1 = ts.find(t => t > tm) ?? fin;
    if(t0 === 0 && t1 === fin) return supprimerCourbe(esq, e);
  }
  const lieu = (t) => f.a ? { x:f.a.x + t * (f.b.x - f.a.x), y:f.a.y + t * (f.b.y - f.a.y) }
    : { x:f.c.x + f.r * Math.cos(f.a1 + t), y:f.c.y + f.r * Math.sin(f.a1 + t) };
  /* Les cotes de longueur et les égalités ne valent plus pour une courbe coupée. */
  esq.contraintes = esq.contraintes.filter(k => !((k.a === id || k.b === id) && ["longueur", "egal", "tangente"].includes(k.type)));
  if(e.type === "ligne"){
    const ancienP2 = e.p2;
    if(t0 > 0 && t1 < fin){
      const q1 = point(esq, lieu(t0).x, lieu(t0).y), q2 = point(esq, lieu(t1).x, lieu(t1).y);
      e.p2 = q1;
      const suite = nouvelId(esq, "l");
      esq.elements.push({ id:suite, type:"ligne", p1:q2, p2:ancienP2, ...(e.constr ? { constr:true } : {}) });
      for(const k of esq.contraintes.filter(k => k.a === id && (k.type === "horizontal" || k.type === "vertical"))){
        esq.contraintes.push({ id:nouvelId(esq, "k"), type:k.type, a:suite });
      }
    }else if(t0 > 0){ e.p2 = point(esq, lieu(t0).x, lieu(t0).y); }
    else { e.p1 = point(esq, lieu(t1).x, lieu(t1).y); }
  }else if(plein){
    const q1 = point(esq, lieu(t1).x, lieu(t1).y), q2 = point(esq, lieu(t0).x, lieu(t0).y);
    Object.assign(e, { type:"arc", p1:q1, p2:q2 });     // reste le complément du morceau retiré
    esq.contraintes = esq.contraintes.filter(k => !((k.a === id || k.b === id) && k.type === "diametre"));
  }else{
    const ancienP2 = e.p2;
    if(t0 > 0 && t1 < fin){
      const q1 = point(esq, lieu(t0).x, lieu(t0).y), q2 = point(esq, lieu(t1).x, lieu(t1).y);
      e.p2 = q1;
      esq.elements.push({ id:nouvelId(esq, "a"), type:"arc", c:e.c, p1:q2, p2:ancienP2, ...(e.constr ? { constr:true } : {}) });
    }else if(t0 > 0){ e.p2 = point(esq, lieu(t0).x, lieu(t0).y); }
    else { e.p1 = point(esq, lieu(t1).x, lieu(t1).y); }
  }
  nettoyer(esq);
  return null;
}

function supprimerCourbe(esq, e){
  esq.elements = esq.elements.filter(x => x !== e);
  nettoyer(esq);
  return null;
}

/** Retire les points devenus inutiles et les contraintes orphelines. */
export function nettoyer(esq){
  const ids = new Set(esq.elements.map(e => e.id));
  esq.contraintes = esq.contraintes.filter(k => [k.a, k.b, k.l].every(x => x === undefined || ids.has(x)));
  const utilises = new Set();
  for(const e of esq.elements){
    for(const c of ["p1", "p2", "c", "p"]) if(e[c]) utilises.add(e[c]);
    for(const q of e.pts || []) utilises.add(q);
  }
  for(const k of esq.contraintes) for(const x of [k.a, k.b, k.l]) if(x) utilises.add(x);
  esq.elements = esq.elements.filter(e => e.type !== "point" || e.seul || e.id === "o" || utilises.has(e.id));
}

/* -----------------------------------------------------------------------------
   Décaler : une copie à distance constante des courbes choisies
   --------------------------------------------------------------------------- */
/** d > 0 : vers l'extérieur d'un contour fermé, à gauche du sens de parcours d'une chaîne ouverte. */
export function decaler(esq, ids, d){
  const choisis = new Set(ids);
  const courbes = esq.elements.filter(e => choisis.has(e.id) && ["ligne", "arc", "cercle"].includes(e.type));
  if(!courbes.length) return "Sélectionnez les lignes, arcs ou cercles à décaler.";
  const pts = new Set(courbes.flatMap(e => [e.p1, e.p2, e.c].filter(Boolean)));
  const { faces, ouverts } = profils({ elements:[...esq.elements.filter(e => pts.has(e.id)), ...courbes.map(e => ({ ...e, constr:false }))], contraintes:[] });
  const prims = [];
  const chaine = (segs, ferme, signe) => {
    /* Chaque segment décalé, puis les raccords : deux droites se rejoignent à leur intersection. */
    const dec = segs.map(s => {
      if(s.type === "ligne"){
        const L = norm2(s.b[0] - s.a[0], s.b[1] - s.a[1]), nx = -(s.b[1] - s.a[1]) / L * signe * d, ny = (s.b[0] - s.a[0]) / L * signe * d;
        return { type:"ligne", a:[s.a[0] + nx, s.a[1] + ny], b:[s.b[0] + nx, s.b[1] + ny] };
      }
      const k = cercle3Points({ x:s.a[0], y:s.a[1] }, { x:s.m[0], y:s.m[1] }, { x:s.b[0], y:s.b[1] });
      const r = k.r + (k.trigo ? -signe : signe) * d;
      if(r <= 0) throw new Error("le décalage est plus grand que le rayon d'un arc");
      const sur = (p) => [k.c.x + (p[0] - k.c.x) * r / k.r, k.c.y + (p[1] - k.c.y) * r / k.r];
      return { type:"arc", a:sur(s.a), m:sur(s.m), b:sur(s.b) };
    });
    const n = dec.length;
    for(let i = 0; i < (ferme ? n : n - 1); i++){
      const A = dec[i], B = dec[(i + 1) % n];
      let j = [(A.b[0] + B.a[0]) / 2, (A.b[1] + B.a[1]) / 2];
      if(A.type === "ligne" && B.type === "ligne"){
        const p = intersections2(A, B);
        if(p) j = p;
      }
      A.b = j; B.a = j;
    }
    prims.push(...dec);
  };
  try{
    for(const f of faces){
      if(f.exterieur.cercle){
        const r = f.exterieur.cercle.r + d;
        if(r <= 0) return "Le décalage est plus grand que le rayon du cercle.";
        prims.push({ type:"cercle", c:f.exterieur.cercle.c, r });
      }else{
        /* Sens du contour : aire signée ; on décale à droite d'un contour trigonométrique (l'extérieur). */
        let aire = 0;
        for(let i = 0; i < f.poly.length; i++){ const [x1, y1] = f.poly[i], [x2, y2] = f.poly[(i + 1) % f.poly.length]; aire += x1 * y2 - x2 * y1; }
        chaine(f.exterieur.segments, true, aire > 0 ? -1 : 1);
      }
    }
    for(const o of ouverts) chaine(o.segments, false, 1);
  }catch(e){ return e.message; }
  ajouterPrimitives(esq, prims);
  return null;
}

function intersections2(A, B){
  const d1x = A.b[0] - A.a[0], d1y = A.b[1] - A.a[1], d2x = B.b[0] - B.a[0], d2y = B.b[1] - B.a[1];
  const det = d1x * d2y - d1y * d2x;
  if(Math.abs(det) < 1e-12) return null;
  const t = ((B.a[0] - A.a[0]) * d2y - (B.a[1] - A.a[1]) * d2x) / det;
  return [A.a[0] + t * d1x, A.a[1] + t * d1y];
}

/* -----------------------------------------------------------------------------
   Congé et chanfrein d'un coin : un point partagé par exactement deux lignes
   --------------------------------------------------------------------------- */
export function casserCoin(esq, idPoint, valeur, mode){
  const idx = indexer(esq);
  const lignes = esq.elements.filter(e => e.type === "ligne" && !e.constr && (e.p1 === idPoint || e.p2 === idPoint));
  if(lignes.length !== 2) return "Sélectionnez le point d'un coin, partagé par exactement deux lignes.";
  const P = idx.get(idPoint);
  const dir = (l) => { const q = idx.get(l.p1 === idPoint ? l.p2 : l.p1); const L = norm2(q.x - P.x, q.y - P.y); return { x:(q.x - P.x) / L, y:(q.y - P.y) / L, L }; };
  const u = dir(lignes[0]), w = dir(lignes[1]);
  const theta = Math.acos(Math.max(-1, Math.min(1, u.x * w.x + u.y * w.y)));
  if(theta < 1e-3 || Math.PI - theta < 1e-3) return "Les deux lignes sont alignées : pas de coin à casser.";
  const recul = mode === "conge" ? valeur / Math.tan(theta / 2) : valeur;
  if(recul >= u.L || recul >= w.L) return "Le coin est trop petit pour cette valeur.";
  const Q = (d) => point(esq, P.x + d.x * recul, P.y + d.y * recul);
  const q1 = Q(u), q2 = Q(w);
  for(const [l, q] of [[lignes[0], q1], [lignes[1], q2]]){
    if(l.p1 === idPoint) l.p1 = q; else l.p2 = q;
    /* Une ligne raccourcie n'a plus sa longueur ni l'égalité d'origine. */
    esq.contraintes = esq.contraintes.filter(k => !((k.a === l.id || k.b === l.id) && (k.type === "longueur" || k.type === "egal")));
  }
  esq.contraintes = esq.contraintes.filter(k => k.a !== idPoint && k.b !== idPoint);   // le coin disparaît
  if(mode === "conge"){
    /* Le centre est sur la bissectrice, à r / sin(θ/2) du coin. */
    const bx = u.x + w.x, by = u.y + w.y, B = norm2(bx, by), dc = valeur / Math.sin(theta / 2);
    const c = point(esq, P.x + bx / B * dc, P.y + by / B * dc, { constr:true });
    const C = idx.get(c) || esq.elements.find(e => e.id === c);
    const a = esq.elements.find(e => e.id === q1), b = esq.elements.find(e => e.id === q2);
    /* Nos arcs tournent dans le sens trigonométrique. */
    const trigo = pos(angleDe(C, b) - angleDe(C, a)) < Math.PI;
    const arc = nouvelId(esq, "a");
    esq.elements.push({ id:arc, type:"arc", c, p1:trigo ? q1 : q2, p2:trigo ? q2 : q1, r:valeur });
    esq.contraintes.push({ id:nouvelId(esq, "k"), type:"tangente", a:lignes[0].id, b:arc },
                         { id:nouvelId(esq, "k"), type:"tangente", a:lignes[1].id, b:arc },
                         { id:nouvelId(esq, "k"), type:"rayon", a:arc, expr:String(valeur) });
  }else{
    esq.elements.push({ id:nouvelId(esq, "l"), type:"ligne", p1:q1, p2:q2 });
  }
  nettoyer(esq);
  return null;
}

/* -----------------------------------------------------------------------------
   Miroir et répétitions : des copies, reliées par contrainte quand c'est possible
   --------------------------------------------------------------------------- */
/** Copie les courbes et points choisis par `f(x, y)`. `partage(id)` : garder ce point d'origine. Rend la table ancien → nouveau. */
function copier(esq, ids, f, partage = () => false){
  const idx = indexer(esq);
  const choisis = esq.elements.filter(e => ids.includes(e.id));
  const table = new Map();
  const pointDe = (id) => {
    if(partage(id)) return id;
    if(table.has(id)) return table.get(id);
    const p = idx.get(id), [x, y] = f(p.x, p.y);
    const q = point(esq, x, y, { ...(p.constr ? { constr:true } : {}), ...(p.seul ? { seul:true } : {}) });
    table.set(id, q);
    return q;
  };
  for(const e of choisis){
    if(e.type === "point") pointDe(e.id);
    else if(e.type === "ligne") esq.elements.push({ id:nouvelId(esq, "l"), type:"ligne", p1:pointDe(e.p1), p2:pointDe(e.p2), ...(e.constr ? { constr:true } : {}) });
    else if(e.type === "cercle") esq.elements.push({ id:nouvelId(esq, "c"), type:"cercle", c:pointDe(e.c), r:e.r, ...(e.constr ? { constr:true } : {}) });
    else if(e.type === "arc"){
      const [a, b] = f.miroir ? [e.p2, e.p1] : [e.p1, e.p2];    // un miroir inverse le sens de l'arc
      esq.elements.push({ id:nouvelId(esq, "a"), type:"arc", c:pointDe(e.c), p1:pointDe(a), p2:pointDe(b), ...(e.constr ? { constr:true } : {}) });
    }else if(e.type === "texte"){      // shortcut: le miroir déplace le texte sans retourner ses lettres
      esq.elements.push({ id:nouvelId(esq, "x"), type:"texte", p:pointDe(e.p), contenu:e.contenu, h:e.h, ...(e.constr ? { constr:true } : {}) });
    }else if(e.type === "spline"){
      const pts = e.pts.map(pointDe);
      esq.elements.push({ id:nouvelId(esq, "s"), type:"spline", pts, p1:pts[0], p2:pts[pts.length - 1], ...(e.constr ? { constr:true } : {}) });
    }
  }
  return table;
}

/** Miroir par une ligne : les points sur l'axe sont partagés, les autres reliés par une symétrie. */
export function miroir(esq, ids, idAxe){
  const idx = indexer(esq);
  const axe = idx.get(idAxe);
  if(!axe || axe.type !== "ligne") return "L'axe du miroir doit être une ligne.";
  const a = idx.get(axe.p1), b = idx.get(axe.p2);
  const L = norm2(b.x - a.x, b.y - a.y), ux = (b.x - a.x) / L, uy = (b.y - a.y) / L;
  const f = (x, y) => { const t = (x - a.x) * ux + (y - a.y) * uy, px = a.x + t * ux, py = a.y + t * uy; return [2 * px - x, 2 * py - y]; };
  f.miroir = true;
  const surAxe = (id) => { const p = idx.get(id); return Math.abs((p.x - a.x) * uy - (p.y - a.y) * ux) < 1e-7; };
  const table = copier(esq, ids.filter(i => i !== idAxe), f, surAxe);
  for(const [de, vers] of table) esq.contraintes.push({ id:nouvelId(esq, "k"), type:"symetrie", a:de, b:vers, l:idAxe });
  return null;
}

export function repetitionRect(esq, ids, nx, ny, dx, dy){
  for(let i = 0; i < nx; i++) for(let j = 0; j < ny; j++){
    if(i || j) copier(esq, ids, (x, y) => [x + i * dx, y + j * dy]);
  }
  return null;
}

export function repetitionCirc(esq, ids, n, angle, cx, cy){
  const pas = Math.abs(angle % 360) < 1e-9 ? angle / n : angle / (n - 1);
  for(let i = 1; i < n; i++){
    const t = pas * i * Math.PI / 180, c = Math.cos(t), s = Math.sin(t);
    copier(esq, ids, (x, y) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]);
  }
  return null;
}
