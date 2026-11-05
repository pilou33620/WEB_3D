/* =============================================================================
   Conception 3D — c2-esquisse.js
   L'esquisse sans écran : son modèle, le solveur de contraintes, les profils.

   Une esquisse vit dans un plan, en coordonnées locales (x, y) en mm. Elle
   tient des éléments — points, lignes, cercles, arcs — et des contraintes
   géométriques ou cotées. Les lignes et les arcs ne portent pas leurs
   extrémités : ils désignent des points, et c'est ce partage qui fait qu'un
   contour reste fermé quand une cote change.

   Le solveur est celui de FreeCAD (planegcs, WebAssembly). Il ne connaît que
   ses propres primitives : on lui traduit l'esquisse, il déplace les points,
   on relit les positions. Les cotes s'écrivent avec les paramètres de la pièce
   (c1-expressions.js).

   Les profils, enfin : on cherche les contours fermés, puis lesquels sont dans
   lesquels — un cercle dans un rectangle est un trou, un rectangle dans ce
   cercle redevient de la matière. Rien ici ne dépend du navigateur : le banc
   d'essai le fait tourner sous Node.
   ============================================================================= */
"use strict";

const TAU = Math.PI * 2;

/* -----------------------------------------------------------------------------
   Plans
   --------------------------------------------------------------------------- */

/* Les plans nommés suivent la convention de replicad (et donc celle du noyau) :
   un même plan donne les mêmes axes à l'écran et dans le volume construit. */
const PLANS = {
  XY:{ x:[1, 0, 0], n:[0, 0, 1] },
  XZ:{ x:[1, 0, 0], n:[0, -1, 0] },
  YZ:{ x:[0, 1, 0], n:[1, 0, 0] },
};

const vec = {
  ajout:(a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k],
  vect:(a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  norm:(a) => { const l = Math.hypot(...a) || 1; return a.map(c => c / l); },
  scal:(a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
};
export { vec };

/** Le repère du plan : origine, axes locaux x et y, normale. `v` évalue le décalage. */
export function repere(plan, v = Number){
  if(plan.base){
    const p = PLANS[plan.base];
    if(!p) throw new Error(`plan inconnu « ${plan.base} »`);
    const o = vec.ajout([0, 0, 0], p.n, v(plan.decalage ?? 0));
    return { o, x:p.x, y:vec.vect(p.n, p.x), n:p.n };
  }
  const n = vec.norm(plan.normale);
  let x = vec.norm(plan.xdir);
  x = vec.norm(vec.ajout(x, n, -vec.scal(x, n)));     // un xdir pas tout à fait dans le plan
  return { o:plan.origine.slice(), x, y:vec.vect(n, x), n };
}

/** L'axe d'une opération « axe de construction » : deux points, ou l'axe d'un cylindre désigné. */
export function axeConstruction(op, v = Number){
  if(!op) throw new Error("axe de construction introuvable");
  if(op.mode === "cylindre"){
    if(!op.cylindre) throw new Error("face cylindrique à désigner");
    return { point:op.cylindre.point, dir:vec.norm(op.cylindre.axe) };
  }
  if(op.mode === "normale"){
    if(!op.face) throw new Error("face plane à désigner");
    return { point:op.face.point, dir:vec.norm(op.face.normale) };
  }
  const a = ["x1", "y1", "z1"].map(c => v(op[c] ?? 0)), b = ["x2", "y2", "z2"].map(c => v(op[c] ?? 0));
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  if(Math.hypot(...d) < 1e-9) throw new Error("les deux points de l'axe sont confondus");
  return { point:a, dir:vec.norm(d) };
}

/** Le plan d'une opération « plan de construction » : décalé puis incliné, médian entre deux décalages, ou par trois points. */
export function planConstruction(op, v = Number, doc = null){
  if(op.mode === "tangent"){
    if(!op.cylindre?.surf) throw new Error("face cylindrique à désigner");
    const a = vec.norm(op.cylindre.axe), d = [0, 1, 2].map(i => op.cylindre.surf[i] - op.cylindre.point[i]);
    const n = vec.norm(vec.ajout(d, a, -vec.scal(d, a)));
    return { origine:op.cylindre.surf, normale:n, xdir:a };
  }
  if(op.mode === "chemin"){
    const esq = doc?.operations.find(o => o.id === op.chemin && o.type === "esquisse");
    if(!esq) throw new Error("chemin à choisir");
    const suite = profils(esq).ouverts[0]?.segments ?? profils(esq).regions[0]?.exterieur?.segments;
    if(!suite) throw new Error("ce chemin n'a pas de ligne");
    const t = Math.max(0, Math.min(1, v(op.position ?? 0))), r = repere(esq.plan, v);
    const longs = suite.map(s => Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1])), total = longs.reduce((x, y) => x + y, 0);
    let reste = t * total, k = 0;
    while(k < suite.length - 1 && reste > longs[k]){ reste -= longs[k]; k++; }
    const s = suite[k], u = (reste / (longs[k] || 1));
    /* shortcut: la tangente d'un arc ou d'une spline est prise sur sa corde, juste pour poser une section. */
    const p = [s.a[0] + (s.b[0] - s.a[0]) * u, s.a[1] + (s.b[1] - s.a[1]) * u];
    const dir = vec.norm(vec.ajout(vec.ajout([0, 0, 0], r.x, s.b[0] - s.a[0]), r.y, s.b[1] - s.a[1]));
    return { origine:versMonde(r, p[0], p[1]), normale:dir, xdir:r.n };
  }
  if(op.mode === "trois"){
    const P = (s) => ["x", "y", "z"].map(c => v(op[c + s] ?? 0));
    const [a, b, c] = [P("1"), P("2"), P("3")];
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = vec.vect(u, w);
    if(Math.hypot(...n) < 1e-9) throw new Error("les trois points sont alignés");
    return { origine:a, normale:vec.norm(n), xdir:vec.norm(u) };
  }
  if(op.mode === "median"){
    const r = repere({ base:op.base || "XY", decalage:0 }, v);
    const m = (v(op.decalage ?? 0) + v(op.decalage2 ?? 0)) / 2;
    return { origine:vec.ajout(r.o, r.n, m), normale:r.n, xdir:r.x };
  }
  const r = repere({ base:op.base || "XY", decalage:op.decalage ?? 0 }, v);
  const a = v(op.angle ?? 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  /* Rotation autour de l'axe local choisi : la normale et l'autre axe tournent ensemble. */
  const autour = op.axe === "y" ? r.y : r.x;
  const tourne = (w) => {
    const k = vec.vect(autour, w), d = vec.scal(autour, w);
    return [0, 1, 2].map(i => w[i] * c + k[i] * s + autour[i] * d * (1 - c));
  };
  return { origine:r.o, normale:vec.norm(tourne(r.n)), xdir:vec.norm(tourne(r.x)) };
}

/** Un point local (x, y) du plan, en coordonnées du monde. */
export function versMonde(r, x, y){
  return vec.ajout(vec.ajout(r.o, r.x, x), r.y, y);
}

/** Un axe de direction quelconque perpendiculaire à `n` : l'axe x d'un plan pris sur une face. */
export function axePerpendiculaire(n){
  const ref = Math.abs(n[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  return vec.norm(vec.vect(ref, n));
}

/* -----------------------------------------------------------------------------
   Modèle
   --------------------------------------------------------------------------- */
export function nouvelleEsquisse(id, nom, plan){
  return { id, type:"esquisse", nom, plan, elements:[], contraintes:[], compteur:0 };
}

export function nouvelId(esq, prefixe){
  esq.compteur = (esq.compteur || 0) + 1;
  return prefixe + esq.compteur;
}

export function indexer(esq){
  return new Map(esq.elements.map(e => [e.id, e]));
}

/** Angle d'un point autour d'un centre. */
const angle = (c, p) => Math.atan2(p.y - c.y, p.x - c.x);
/** Écart angulaire de a1 à a2 en tournant dans le sens trigonométrique, dans ]0, 2π]. */
const balayage = (a1, a2) => { let d = (a2 - a1) % TAU; if(d <= 1e-12) d += TAU; return d; };

/** Le point au milieu d'un arc (sens trigonométrique de p1 vers p2). */
/** Le rayon d'un cercle, ou d'un arc : celui-là se déduit de ses points, pour ne jamais les contredire. */
export function rayonDe(idx, e){
  if(e.type !== "arc") return e.r;
  const c = idx.get(e.c), p = idx.get(e.p1);
  return Math.hypot(p.x - c.x, p.y - c.y);
}

export function milieuArc(idx, a){
  const c = idx.get(a.c), p1 = idx.get(a.p1), p2 = idx.get(a.p2);
  const a1 = angle(c, p1), m = a1 + balayage(a1, angle(c, p2)) / 2;
  const r = Math.hypot(p1.x - c.x, p1.y - c.y);
  return { x:c.x + r * Math.cos(m), y:c.y + r * Math.sin(m) };
}

/** Cercle passant par trois points : centre, rayon, et sens de parcours a → m → b. */
export function cercle3Points(a, m, b){
  const d = 2 * (a.x * (m.y - b.y) + m.x * (b.y - a.y) + b.x * (a.y - m.y));
  if(Math.abs(d) < 1e-12) return null;                       // alignés
  const a2 = a.x * a.x + a.y * a.y, m2 = m.x * m.x + m.y * m.y, b2 = b.x * b.x + b.y * b.y;
  const c = { x:(a2 * (m.y - b.y) + m2 * (b.y - a.y) + b2 * (a.y - m.y)) / d,
              y:(a2 * (b.x - m.x) + m2 * (a.x - b.x) + b2 * (m.x - a.x)) / d };
  return { c, r:Math.hypot(a.x - c.x, a.y - c.y), trigo:d > 0 };
}

/** Les chemins SVG absolus de replicad (M, L, H, V, Q, C, Z) en polylignes ; y retourné, le SVG compte vers le bas. */
export function cheminsEnPolylignes(chemins, parCourbe = 6){
  const sortie = [];
  for(const d of chemins){
    const t = d.match(/[MLHVQCZ]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || [];
    let i = 0, x = 0, y = 0, cmd = "", cur = [];
    const n = () => parseFloat(t[i++]);
    const fin = () => { if(cur.length > 1) sortie.push(cur); cur = []; };
    while(i < t.length){
      if(/[a-z]/i.test(t[i])) cmd = t[i++].toUpperCase();
      if(cmd === "M"){ fin(); x = n(); y = n(); cur.push([x, -y]); cmd = "L"; }
      else if(cmd === "L"){ x = n(); y = n(); cur.push([x, -y]); }
      else if(cmd === "H"){ x = n(); cur.push([x, -y]); }
      else if(cmd === "V"){ y = n(); cur.push([x, -y]); }
      else if(cmd === "Q" || cmd === "C"){
        const c = cmd === "C" ? [[n(), n()], [n(), n()]] : [[n(), n()]];
        const f = [n(), n()], ctrl = [[x, y], ...c, f];
        for(let k = 1; k <= parCourbe; k++){
          let q = ctrl;
          while(q.length > 1) q = q.slice(1).map((p, j) => [q[j][0] + (p[0] - q[j][0]) * k / parCourbe, q[j][1] + (p[1] - q[j][1]) * k / parCourbe]);
          cur.push([q[0][0], -q[0][1]]);
        }
        [x, y] = f;
      }else if(cmd === "Z"){ if(cur.length) cur.push(cur[0]); fin(); cmd = ""; }
      else i++;
    }
    fin();
  }
  return sortie;
}

/** Spline par points (Catmull-Rom) : les deux points de contrôle de Bézier de chaque travée. */
export function controlesSpline(pts){
  const n = pts.length, ferme = n > 3 && pts[0][0] === pts[n - 1][0] && pts[0][1] === pts[n - 1][1];
  return pts.slice(0, -1).map((p, i) => {
    /* Fermée, elle tourne sans point anguleux : le voisin du bout est l'autre bout. */
    const a = ferme && i === 0 ? pts[n - 2] : pts[Math.max(i - 1, 0)], b = pts[i + 1], c = ferme && i === n - 2 ? pts[1] : pts[Math.min(i + 2, n - 1)];
    return { c1:[p[0] + (b[0] - a[0]) / 6, p[1] + (b[1] - a[1]) / 6], c2:[b[0] - (c[0] - p[0]) / 6, b[1] - (c[1] - p[1]) / 6], fin:b };
  });
}

/** La spline échantillonnée, pour le dessin et les inclusions. */
export function echantillonSpline(pts, parTravee = 12){
  const sortie = [pts[0]];
  controlesSpline(pts).forEach((t, i) => {
    const p = pts[i];
    for(let k = 1; k <= parTravee; k++){
      const u = k / parTravee, v = 1 - u;
      sortie.push([0, 1].map(j => v * v * v * p[j] + 3 * v * v * u * t.c1[j] + 3 * v * u * u * t.c2[j] + u * u * u * t.fin[j]));
    }
  });
  return sortie;
}

/* -----------------------------------------------------------------------------
   Contraintes : ce que l'interface propose, et leur traduction pour planegcs
   --------------------------------------------------------------------------- */

/** Les contraintes qui portent une valeur (une cote). */
export const COTES = new Set(["longueur", "distance", "distanceX", "distanceY", "rayon", "diametre", "angle"]);

export const NOMS_CONTRAINTES = {
  coincident:"Coïncidence", horizontal:"Horizontale", vertical:"Verticale",
  parallele:"Parallèles", perpendiculaire:"Perpendiculaires", tangente:"Tangence",
  egal:"Égalité", concentrique:"Concentriques", milieu:"Milieu", symetrie:"Symétrie",
  fixe:"Fixe", sur:"Point sur l'objet", colineaire:"Colinéaires",
  longueur:"Longueur", distance:"Distance", distanceX:"Distance horizontale",
  distanceY:"Distance verticale", rayon:"Rayon", diametre:"Diamètre", angle:"Angle",
};

const courbe = (e) => e.type === "cercle" ? "c" : e.type === "arc" ? "a" : e.type === "ligne" ? "l" : "p";

/** Une contrainte de l'esquisse en primitives planegcs (souvent une, parfois deux). */
function traduire(k, idx, v){
  const E = (id) => { const e = idx.get(id); if(!e) throw new Error(`élément ${id} absent`); return e; };
  const val = () => v(k.expr);
  switch(k.type){
    case "coincident": return [{ type:"p2p_coincident", p1_id:k.a, p2_id:k.b }];
    case "horizontal": {
      const e = E(k.a);
      return [e.type === "ligne" ? { type:"horizontal_l", l_id:k.a } : { type:"horizontal_pp", p1_id:k.a, p2_id:k.b }];
    }
    case "vertical": {
      const e = E(k.a);
      return [e.type === "ligne" ? { type:"vertical_l", l_id:k.a } : { type:"vertical_pp", p1_id:k.a, p2_id:k.b }];
    }
    case "colineaire": { const b = E(k.b); return [{ type:"point_on_line_pl", p_id:b.p1, l_id:k.a }, { type:"point_on_line_pl", p_id:b.p2, l_id:k.a }]; }
    case "parallele": return [{ type:"parallel", l1_id:k.a, l2_id:k.b }];
    case "perpendiculaire": return [{ type:"perpendicular_ll", l1_id:k.a, l2_id:k.b }];
    case "tangente": {
      let a = E(k.a), b = E(k.b);
      if(courbe(a) !== "l" && courbe(b) === "l") [a, b] = [b, a];
      const t = courbe(a) + courbe(b);
      if(t === "lc") return [{ type:"tangent_lc", l_id:a.id, c_id:b.id }];
      if(t === "la") return [{ type:"tangent_la", l_id:a.id, a_id:b.id }];
      if(t === "cc") return [{ type:"tangent_cc", c1_id:a.id, c2_id:b.id }];
      if(t === "aa") return [{ type:"tangent_aa", a1_id:a.id, a2_id:b.id }];
      if(t === "ca") return [{ type:"tangent_ca", c_id:a.id, a_id:b.id }];
      if(t === "ac") return [{ type:"tangent_ca", c_id:b.id, a_id:a.id }];
      throw new Error("tangence entre une ligne et un cercle ou un arc, ou entre deux courbes");
    }
    case "egal": {
      const a = E(k.a), b = E(k.b), t = courbe(a) + courbe(b);
      if(t === "ll") return [{ type:"equal_length", l1_id:k.a, l2_id:k.b }];
      if(t === "cc") return [{ type:"equal_radius_cc", c1_id:k.a, c2_id:k.b }];
      if(t === "aa") return [{ type:"equal_radius_aa", a1_id:k.a, a2_id:k.b }];
      if(t === "ca") return [{ type:"equal_radius_ca", c1_id:k.a, a2_id:k.b }];
      if(t === "ac") return [{ type:"equal_radius_ca", c1_id:k.b, a2_id:k.a }];
      throw new Error("égalité entre deux lignes, ou entre deux cercles ou arcs");
    }
    case "concentrique": return [{ type:"p2p_coincident", p1_id:E(k.a).c, p2_id:E(k.b).c }];
    case "milieu": { const l = E(k.b); return [{ type:"p2p_symmetric_ppp", p1_id:l.p1, p2_id:l.p2, p_id:k.a }]; }
    case "symetrie": return [{ type:"p2p_symmetric_ppl", p1_id:k.a, p2_id:k.b, l_id:k.l }];
    case "fixe": {       // des nombres, ou des expressions pour suivre un paramètre
      const x = v(k.x), y = v(k.y);
      if(!Number.isFinite(x) || !Number.isFinite(y)) throw new Error("coordonnées illisibles");
      return [{ type:"coordinate_x", p_id:k.a, x }, { type:"coordinate_y", p_id:k.a, y }];
    }
    case "sur": {
      const e = E(k.b);
      if(e.type === "ligne") return [{ type:"point_on_line_pl", p_id:k.a, l_id:k.b }];
      if(e.type === "cercle") return [{ type:"point_on_circle", p_id:k.a, c_id:k.b }];
      if(e.type === "arc") return [{ type:"point_on_arc", p_id:k.a, a_id:k.b }];
      throw new Error("un point se pose sur une ligne, un cercle ou un arc");
    }
    case "longueur": { const l = E(k.a); return [{ type:"p2p_distance", p1_id:l.p1, p2_id:l.p2, distance:val() }]; }
    case "distance": {
      const b = E(k.b);
      return [b.type === "ligne" ? { type:"p2l_distance", p_id:k.a, l_id:k.b, distance:val() }
                                 : { type:"p2p_distance", p1_id:k.a, p2_id:k.b, distance:val() }];
    }
    /* Une distance horizontale garde son sens : b reste du côté où il était. */
    case "distanceX": return [{ type:"difference", param1:{ o_id:k.a, prop:"x" }, param2:{ o_id:k.b, prop:"x" }, difference:val() * (k.signe || 1) }];
    case "distanceY": return [{ type:"difference", param1:{ o_id:k.a, prop:"y" }, param2:{ o_id:k.b, prop:"y" }, difference:val() * (k.signe || 1) }];
    case "rayon": {
      const e = E(k.a);
      return [e.type === "arc" ? { type:"arc_radius", a_id:k.a, radius:val() } : { type:"circle_radius", c_id:k.a, radius:val() }];
    }
    case "diametre": {
      const e = E(k.a);
      return [e.type === "arc" ? { type:"arc_diameter", a_id:k.a, diameter:val() } : { type:"circle_diameter", c_id:k.a, diameter:val() }];
    }
    case "angle": return [{ type:"l2l_angle_ll", l1_id:k.a, l2_id:k.b, angle:val() * Math.PI / 180 * (k.signe || 1) }];
  }
  throw new Error(`contrainte inconnue « ${k.type} »`);
}

/**
 * Résout l'esquisse en place. `glisse` = { id, x, y } tient un point sous la
 * souris pendant qu'on le fait glisser. Rend { ok, conflits, erreurs, dof } :
 * conflits = ids des contraintes que le solveur juge contradictoires,
 * erreurs = { idContrainte: message } pour une cote illisible,
 * dof = degrés de liberté restants (0 : entièrement contrainte).
 */
export function resoudre(gcs, esq, v = Number, glisse = null){
  const idx = indexer(esq);
  const prims = [];
  const erreurs = {};
  for(const e of esq.elements){
    if(e.type === "point"){
      const tenu = glisse && glisse.id === e.id;
      prims.push({ id:e.id, type:"point", x:tenu ? glisse.x : e.x, y:tenu ? glisse.y : e.y, fixed:!!tenu });
    }
  }
  for(const e of esq.elements){
    if(e.type === "ligne") prims.push({ id:e.id, type:"line", p1_id:e.p1, p2_id:e.p2 });
    else if(e.type === "cercle") prims.push({ id:e.id, type:"circle", c_id:e.c, radius:e.r });
    else if(e.type === "arc"){
      const c = idx.get(e.c), p1 = idx.get(e.p1), p2 = idx.get(e.p2);
      const a1 = angle(c, p1);
      prims.push({ id:e.id, type:"arc", c_id:e.c, start_id:e.p1, end_id:e.p2, radius:rayonDe(idx, e),
                   start_angle:a1, end_angle:a1 + balayage(a1, angle(c, p2)) });
      prims.push({ id:e.id + "~r", type:"arc_rules", a_id:e.id });
    }
  }
  for(const k of esq.contraintes){
    if(k.pilotee) continue;      // une cote pilotée se lit sur la géométrie, elle ne la commande pas
    try{
      traduire(k, idx, v).forEach((p, i) => prims.push({ ...p, id:k.id + "~" + i }));
    }catch(err){ erreurs[k.id] = err.message; }
  }

  gcs.clear_data();
  gcs.push_primitives_and_params(prims);
  const statut = gcs.solve();
  const conflits = [...new Set(gcs.get_gcs_conflicting_constraints().map(id => id.split("~")[0]))];
  const ok = (statut === 0 || statut === 1) && !conflits.length;
  const dof = gcs.gcs.dof();
  /* Un échec ne touche pas à l'esquisse : une solution contradictoire écraserait des points
     les uns sur les autres, et le solveur ne saurait plus en repartir. */
  if(!ok) return { ok, conflits, erreurs, dof };
  gcs.apply_solution();
  for(const e of esq.elements){
    const p = gcs.sketch_index.get_primitive(e.id);
    if(!p) continue;
    if(e.type === "point"){ e.x = p.x; e.y = p.y; }
    else if(e.type === "cercle") e.r = p.radius;
    else if(e.type === "arc") delete e.r;      // les fichiers d'avant le portaient
  }
  return { ok, conflits, erreurs, dof };
}

/* -----------------------------------------------------------------------------
   Profils
   --------------------------------------------------------------------------- */

/** Union-find des points confondus : par contrainte de coïncidence ou par position. */
function unifierPoints(esq, idx){
  const parent = new Map();
  const racine = (id) => { while(parent.has(id) && parent.get(id) !== id) id = parent.get(id); return id; };
  const unir = (a, b) => { const ra = racine(a), rb = racine(b); if(ra !== rb) parent.set(ra, rb); };
  for(const k of esq.contraintes) if(k.type === "coincident") unir(k.a, k.b);
  const parPosition = new Map();
  for(const e of esq.elements){
    if(e.type !== "point") continue;
    const cle = `${e.x.toFixed(4)},${e.y.toFixed(4)}`;
    if(parPosition.has(cle)) unir(e.id, parPosition.get(cle));
    else parPosition.set(cle, e.id);
  }
  return racine;
}

/** Polygone d'approximation d'un contour, pour l'aire et les inclusions. */
function polygone(boucle){
  if(boucle.cercle){
    const { c, r } = boucle.cercle;
    return Array.from({ length:48 }, (_, i) => [c[0] + r * Math.cos(i / 48 * TAU), c[1] + r * Math.sin(i / 48 * TAU)]);
  }
  const pts = [];
  for(const s of boucle.segments){
    pts.push(s.a);
    if(s.type === "spline"){ pts.push(...echantillonSpline(s.pts).slice(1, -1)); continue; }
    if(s.type === "arc"){
      const k = cercle3Points({ x:s.a[0], y:s.a[1] }, { x:s.m[0], y:s.m[1] }, { x:s.b[0], y:s.b[1] });
      if(!k) continue;
      const a1 = Math.atan2(s.a[1] - k.c.y, s.a[0] - k.c.x), a2 = Math.atan2(s.b[1] - k.c.y, s.b[0] - k.c.x);
      const d = k.trigo ? balayage(a1, a2) : -balayage(a2, a1);
      for(let i = 1; i < 12; i++){
        const t = a1 + d * i / 12;
        pts.push([k.c.x + k.r * Math.cos(t), k.c.y + k.r * Math.sin(t)]);
      }
    }
  }
  return pts;
}

function aire(poly){
  let s = 0;
  for(let i = 0; i < poly.length; i++){
    const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length];
    s += x1 * y2 - x2 * y1;
  }
  return s / 2;
}

export function dedans(pt, poly){
  let d = false;
  for(let i = 0, j = poly.length - 1; i < poly.length; j = i++){
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) d = !d;
  }
  return d;
}

/**
 * Les régions de matière de l'esquisse : [{ exterieur, trous:[…] }], plus les
 * chaînes ouvertes (chemins de balayage) et les points isolés (centres de
 * perçage). Les éléments de construction sont ignorés.
 * Un contour est { segments:[{type:"ligne",a,b} | {type:"arc",a,m,b}] } ou { cercle:{c,r} }.
 */
export function profils(esq){
  const idx = indexer(esq);
  const racine = unifierPoints(esq, idx);
  const P = (id) => { const p = idx.get(id); return [p.x, p.y]; };
  const boucles = [], ouverts = [];

  const aretes = [];
  for(const e of esq.elements){
    if(e.constr) continue;
    if(e.type === "cercle") boucles.push({ cercle:{ c:P(e.c), r:e.r }, ids:[e.id] });
    else if(e.type === "ligne" || e.type === "arc" || e.type === "spline") aretes.push(e);
  }
  /* Le graphe : chaque point (unifié) connaît les arêtes qui y aboutissent. */
  const incidentes = new Map();
  const ajouter = (pt, e) => { const r = racine(pt); if(!incidentes.has(r)) incidentes.set(r, []); incidentes.get(r).push(e); };
  for(const e of aretes){ ajouter(e.p1, e); ajouter(e.p2, e); }

  const segment = (e, depuis) => {
    const inverse = racine(e.p1) !== depuis;
    const a = inverse ? e.p2 : e.p1, b = inverse ? e.p1 : e.p2;
    if(e.type === "ligne") return { type:"ligne", a:P(a), b:P(b), id:e.id };
    if(e.type === "spline"){
      const q = (inverse ? [...e.pts].reverse() : e.pts).map(P);
      return { type:"spline", a:q[0], b:q[q.length - 1], pts:q, id:e.id };
    }
    const m = milieuArc(idx, e);
    return { type:"arc", a:P(a), m:[m.x, m.y], b:P(b), id:e.id };
  };

  const vues = new Set();
  /* Une chaîne qui n'a pas de bout (degré 1) est parcourue depuis un bout : sinon on
     commencerait au milieu d'un chemin ouvert. */
  const departs = [...aretes].sort((a, b) => {
    const bout = (e) => (incidentes.get(racine(e.p1)).length === 1 || incidentes.get(racine(e.p2)).length === 1) ? 0 : 1;
    return bout(a) - bout(b);
  });
  for(const e0 of departs){
    if(vues.has(e0)) continue;
    let depuis = incidentes.get(racine(e0.p1)).length === 1 || incidentes.get(racine(e0.p2)).length !== 1
      ? racine(e0.p1) : racine(e0.p2);
    const debut = depuis;
    const segs = [];
    let e = e0, ferme = false;
    while(e){
      vues.add(e);
      const s = segment(e, depuis);
      segs.push(s);
      depuis = racine(racine(e.p1) === depuis ? e.p2 : e.p1);
      if(depuis === debut){ ferme = true; break; }
      const suivantes = (incidentes.get(depuis) || []).filter(x => !vues.has(x));
      /* shortcut: à un embranchement (plus de deux arêtes en un point), on prend la première ;
         découper les profils qui se croisent demanderait un vrai calcul de régions */
      e = suivantes[0] || null;
    }
    (ferme ? boucles : ouverts).push({ segments:segs, ids:segs.map(s => s.id) });
  }

  /* Inclusions : la profondeur d'un contour est le nombre de contours qui le contiennent.
     Pair : de la matière ; impair : un trou dans le plus petit contour qui le contient. */
  const infos = boucles.map(b => {
    const poly = polygone(b);
    return { b, poly, aire:Math.abs(aire(poly)) };
  });
  for(const i of infos){
    i.parents = infos.filter(j => j !== i && j.aire > i.aire && dedans(i.poly[0], j.poly));
  }
  const regions = [];
  for(const i of infos){
    if(i.parents.length % 2 === 0) regions.push({ exterieur:i.b, trous:[], info:i });
  }
  for(const i of infos){
    if(i.parents.length % 2 === 1){
      const parent = i.parents.reduce((p, q) => q.aire < p.aire ? q : p);
      regions.find(r => r.info === parent)?.trous.push(i.b);
    }
  }
  /* Seuls les points posés avec l'outil Point (seul) comptent : une extrémité restée seule
     après la suppression d'une ligne ne doit pas devenir un trou. */
  const points = esq.elements.filter(e => e.type === "point" && e.seul && !e.constr).map(e => [e.x, e.y]);
  /* Toutes les faces planes délimitées, de matière ou non : ce qu'on peut choisir d'extruder.
     cle : les éléments du contour, stable tant que le contour n'est pas redessiné. */
  const faces = infos.map(i => ({
    cle:[...i.b.ids].sort().join("+"), exterieur:i.b, poly:i.poly, aire:i.aire, profondeur:i.parents.length,
    trous:infos.filter(j => j.parents.length === i.parents.length + 1 && j.parents.includes(i)).map(j => j.b),
  }));
  return { regions:regions.map(({ exterieur, trous }) => ({ exterieur, trous })), ouverts, points, faces };
}

/* -----------------------------------------------------------------------------
   Import DXF / SVG : des primitives, puis des éléments d'esquisse
   --------------------------------------------------------------------------- */

/** Primitives { type:"ligne", a, b } | { type:"arc", a, m, b } | { type:"cercle", c, r } | { type:"point", a }
 *  | { type:"spline", pts } | { type:"texte", p, contenu, h }. Rend pour chacune les identifiants créés (null si elle est dégénérée).
    ajoutées à l'esquisse, les extrémités communes partagées. */
export function ajouterPrimitives(esq, prims){
  const parCle = new Map();
  const point = ([x, y]) => {
    const cle = `${x.toFixed(4)},${y.toFixed(4)}`;
    if(parCle.has(cle)) return parCle.get(cle);
    const id = nouvelId(esq, "p");
    esq.elements.push({ id, type:"point", x, y });
    parCle.set(cle, id);
    return id;
  };
  const ajouter = (e) => { esq.elements.push(e); return e; };
  return prims.map((p) => {
    if(p.type === "ligne"){
      if(Math.hypot(p.b[0] - p.a[0], p.b[1] - p.a[1]) < 1e-6) return null;
      return ajouter({ id:nouvelId(esq, "l"), type:"ligne", p1:point(p.a), p2:point(p.b) });
    }
    if(p.type === "point") return { id:point(p.a) };
    if(p.type === "cercle"){
      const c = nouvelId(esq, "p");
      esq.elements.push({ id:c, type:"point", x:p.c[0], y:p.c[1] });
      return ajouter({ id:nouvelId(esq, "c"), type:"cercle", c, r:p.r });
    }
    if(p.type === "arc"){
      const k = cercle3Points({ x:p.a[0], y:p.a[1] }, { x:p.m[0], y:p.m[1] }, { x:p.b[0], y:p.b[1] });
      if(!k) return ajouter({ id:nouvelId(esq, "l"), type:"ligne", p1:point(p.a), p2:point(p.b) });
      const c = nouvelId(esq, "p");
      esq.elements.push({ id:c, type:"point", x:k.c.x, y:k.c.y });
      const [d, f] = k.trigo ? [p.a, p.b] : [p.b, p.a];        // nos arcs tournent dans le sens trigonométrique
      return ajouter({ id:nouvelId(esq, "a"), type:"arc", c, p1:point(d), p2:point(f) });
    }
    if(p.type === "spline"){
      const pts = p.pts.map(point);
      return ajouter({ id:nouvelId(esq, "s"), type:"spline", pts, p1:pts[0], p2:pts[pts.length - 1] });
    }
    if(p.type === "texte") return ajouter({ id:nouvelId(esq, "x"), type:"texte", p:point(p.p), contenu:p.contenu, h:p.h });
    throw new Error(`primitive inconnue : ${p.type}`);
  });
}

/** Arc DXF d'un segment de polyligne à renflement (bulge) : milieu de l'arc. */
function milieuBulge(a, b, bulge){
  const dx = b[0] - a[0], dy = b[1] - a[1], c = Math.hypot(dx, dy);
  const s = bulge * c / 2;                                    // flèche, signée
  return [(a[0] + b[0]) / 2 + dy / c * s, (a[1] + b[1]) / 2 - dx / c * s];
}

/** LINE, CIRCLE, ARC, LWPOLYLINE de la section ENTITIES. Les unités sont prises en mm.
    shortcut: ni blocs (INSERT), ni SPLINE, ni INSUNITS ; à ajouter si des fichiers réels en ont besoin */
export function lireDxf(texte){
  const l = texte.split(/\r?\n/);
  const paires = [];
  for(let i = 0; i + 1 < l.length; i += 2) paires.push([parseInt(l[i], 10), l[i + 1].trim()]);
  const prims = [];
  let ent = null;
  const finir = () => {
    if(!ent) return;
    const g = (code, defaut = 0) => { const v = ent.codes.find(c => c[0] === code); return v ? parseFloat(v[1]) : defaut; };
    if(ent.type === "LINE") prims.push({ type:"ligne", a:[g(10), g(20)], b:[g(11), g(21)] });
    else if(ent.type === "CIRCLE") prims.push({ type:"cercle", c:[g(10), g(20)], r:g(40) });
    else if(ent.type === "ARC"){
      const c = [g(10), g(20)], r = g(40), a1 = g(50) * Math.PI / 180, a2 = g(51) * Math.PI / 180;
      const m = a1 + balayage(a1, a2) / 2;
      prims.push({ type:"arc", a:[c[0] + r * Math.cos(a1), c[1] + r * Math.sin(a1)],
                   m:[c[0] + r * Math.cos(m), c[1] + r * Math.sin(m)],
                   b:[c[0] + r * Math.cos(a2), c[1] + r * Math.sin(a2)] });
    }else if(ent.type === "LWPOLYLINE"){
      const sommets = [];
      for(const [code, v] of ent.codes){
        if(code === 10) sommets.push({ x:parseFloat(v), y:0, bulge:0 });
        else if(code === 20 && sommets.length) sommets[sommets.length - 1].y = parseFloat(v);
        else if(code === 42 && sommets.length) sommets[sommets.length - 1].bulge = parseFloat(v);
      }
      const ferme = (g(70) & 1) === 1;
      const n = ferme ? sommets.length : sommets.length - 1;
      for(let i = 0; i < n; i++){
        const s = sommets[i], t = sommets[(i + 1) % sommets.length];
        const a = [s.x, s.y], b = [t.x, t.y];
        prims.push(Math.abs(s.bulge) > 1e-9 ? { type:"arc", a, m:milieuBulge(a, b, s.bulge), b } : { type:"ligne", a, b });
      }
    }
    ent = null;
  };
  let dansEntites = false;
  for(let i = 0; i < paires.length; i++){
    const [code, v] = paires[i];
    if(code === 2 && paires[i - 1]?.[1] === "SECTION") dansEntites = v === "ENTITIES";
    if(!dansEntites) continue;
    if(code === 0){ finir(); ent = { type:v, codes:[] }; }
    else if(ent) ent.codes.push([code, v]);
  }
  finir();
  return prims;
}

/** Les formes simples d'un SVG, y retourné (le SVG compte vers le bas). Une unité SVG = 1 mm.
    shortcut: transformations ignorées, courbes de Bézier et arcs de chemin découpés en segments */
export function lireSvg(doc){
  const prims = [];
  const n = (el, a) => parseFloat(el.getAttribute(a) || "0");
  const P = (x, y) => [x, -y];
  const poly = (pts, ferme) => {
    for(let i = 0; i < pts.length - (ferme ? 0 : 1); i++) prims.push({ type:"ligne", a:pts[i], b:pts[(i + 1) % pts.length] });
  };
  for(const el of doc.querySelectorAll("line")) prims.push({ type:"ligne", a:P(n(el, "x1"), n(el, "y1")), b:P(n(el, "x2"), n(el, "y2")) });
  for(const el of doc.querySelectorAll("rect")){
    const x = n(el, "x"), y = n(el, "y"), w = n(el, "width"), h = n(el, "height");
    poly([P(x, y), P(x + w, y), P(x + w, y + h), P(x, y + h)], true);
  }
  for(const el of doc.querySelectorAll("circle")) prims.push({ type:"cercle", c:P(n(el, "cx"), n(el, "cy")), r:n(el, "r") });
  for(const el of doc.querySelectorAll("polyline, polygon")){
    const v = (el.getAttribute("points") || "").trim().split(/[\s,]+/).map(parseFloat);
    const pts = [];
    for(let i = 0; i + 1 < v.length; i += 2) pts.push(P(v[i], v[i + 1]));
    poly(pts, el.tagName.toLowerCase() === "polygon");
  }
  for(const el of doc.querySelectorAll("path")){
    const d = el.getAttribute("d") || "";
    const morceaux = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) || [];
    let i = 0, cmd = "", x = 0, y = 0, x0 = 0, y0 = 0, pts = [];
    const fin = (ferme) => { if(pts.length > 1) poly(pts, ferme); pts = []; };
    const num = () => parseFloat(morceaux[i++]);
    while(i < morceaux.length){
      if(/[a-zA-Z]/.test(morceaux[i])) cmd = morceaux[i++];
      const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase();
      const ox = rel ? x : 0, oy = rel ? y : 0;
      if(C === "M"){ fin(false); x = ox + num(); y = oy + num(); x0 = x; y0 = y; pts.push(P(x, y)); cmd = rel ? "l" : "L"; }
      else if(C === "L"){ x = ox + num(); y = oy + num(); pts.push(P(x, y)); }
      else if(C === "H"){ x = (rel ? x : 0) + num(); pts.push(P(x, y)); }
      else if(C === "V"){ y = (rel ? y : 0) + num(); pts.push(P(x, y)); }
      else if(C === "C" || C === "Q"){
        const c = C === "C" ? [ox + num(), oy + num(), ox + num(), oy + num()] : [ox + num(), oy + num()];
        const fx = ox + num(), fy = oy + num();
        const ctrl = C === "C" ? [[x, y], [c[0], c[1]], [c[2], c[3]], [fx, fy]] : [[x, y], [c[0], c[1]], [fx, fy]];
        for(let k = 1; k <= 8; k++){
          let q = ctrl.map(p => p.slice());
          while(q.length > 1) q = q.slice(1).map((p, j) => [q[j][0] + (p[0] - q[j][0]) * k / 8, q[j][1] + (p[1] - q[j][1]) * k / 8]);
          pts.push(P(q[0][0], q[0][1]));
        }
        x = fx; y = fy;
      }else if(C === "A"){ i += 5; x = ox + num(); y = oy + num(); pts.push(P(x, y)); }
      else if(C === "Z"){ x = x0; y = y0; fin(true); }
      else i++;                                                // commande inconnue : on avance
    }
    fin(false);
  }
  return prims;
}
