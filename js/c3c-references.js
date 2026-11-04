/* =============================================================================
   Conception 3D — c3c-references.js
   Retrouver une arête ou une face désignée quand la pièce a changé.

   Le noyau ne donne pas de noms stables aux éléments d'une forme : après un
   changement de cote, tout est renuméroté. On garde donc, pour chaque élément
   désigné, sa description : sa nature (droite, cercle, plan…), sa direction, ses
   faces voisines, sa longueur, sa place absolue et relative dans la pièce. À la
   reconstruction, on prend le candidat le plus ressemblant, ou l'erreur s'il n'y
   en a aucun d'assez proche — une référence perdue doit se voir, pas viser une
   autre arête.

   shortcut: ce n'est pas un nommage topologique par l'historique du noyau : deux
   éléments identiques et symétriques peuvent s'échanger si la pièce change beaucoup.
   ============================================================================= */
"use strict";

const pt = (p) => [p.x, p.y, p.z];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Ce point est-il dans la matière ? La distance à un Solid y vaut 0 ; à un Compound (après un fuse), elle
    mesure jusqu'à la peau : il faut donc interroger les solides du corps un par un. */
export function dansMatiere(R, shape, p){
  const v = R.makeVertex(p);
  const dedans = (shape.solids?.length ? shape.solids : [shape]).some(s => R.measureDistanceBetween(v, s) < 1e-9);
  v.delete();
  return dedans;
}

/** Points de la description en coordonnées relatives à l'encombrement (0 à 1 par axe). */
function relatif(p, [mi, ma]){
  return p.map((c, i) => ma[i] - mi[i] > 1e-9 ? (c - mi[i]) / (ma[i] - mi[i]) : 0.5);
}

/** Lit un vecteur du noyau et le rend tout de suite : à force, ils pèsent sur son tas. */
const lire = (q) => { const a = pt(q); q.delete?.(); return a; };

/** Le plus proche d'un point : la désignation d'origine, sur la forme telle qu'elle était. */
function plusProche(R, liste, p){
  const v = R.makeVertex(p);
  let meilleur = null, dMin = Infinity;
  for(const el of liste){
    const d = R.measureDistanceBetween(v, el);
    if(d < dMin){ dMin = d; meilleur = el; }
  }
  v.delete();
  return { el:meilleur, d:dMin };
}

/** La nature d'un élément, sans ses voisins : ce qui se compare vite. */
function trait(R, el, estFace){
  if(estFace){
    const plan = el.geomType === "PLANE";
    return { g:el.geomType, m:lire(el.center), d:plan ? lire(el.normalAt()) : null, L:Math.sqrt(R.measureArea(el)) || 1 };
  }
  const droite = el.geomType === "LINE";
  return { g:el.geomType, m:lire(el.pointAt(0.5)), d:droite ? lire(el.tangentAt(0.5)) : null, L:el.length || 1 };
}

/** Les faces planes d'une forme, une fois pour toutes : normale et centre, pour un test d'équation de plan. */
const plansDe = (shape) => shape.faces.filter(f => f.geomType === "PLANE").map(f => ({ f, n:lire(f.normalAt()), c:lire(f.center) }));

/** Les faces planes qui touchent cet élément : leurs normales, et si l'angle qu'elles font est rentrant.
    Le fond d'une entaille et le bord du dessus ont les mêmes normales ; seul ce signe les distingue.
    L'équation du plan écarte presque toutes les faces : mesurer la distance à chacune coûterait des secondes. */
function voisines(R, plans, t){
  const v = R.makeVertex(t.m), sortie = [], centres = [];
  for(const p of plans){
    const h = (t.m[0] - p.c[0]) * p.n[0] + (t.m[1] - p.c[1]) * p.n[1] + (t.m[2] - p.c[2]) * p.n[2];
    if(Math.abs(h) < 1e-5 && R.measureDistanceBetween(v, p.f) < 1e-5){ sortie.push(p.n); centres.push(p.c); }
  }
  v.delete();
  let rentrant = null;
  if(sortie.length === 2){
    const d = [0, 1, 2].map(i => centres[0][i] - t.m[i]);
    rentrant = d[0] * sortie[1][0] + d[1] * sortie[1][1] + d[2] * sortie[1][2] > 1e-6;
  }
  return { normales:sortie, rentrant };
}

function decrire(R, shape, plans, el, estFace){
  const t = trait(R, el, estFace), bb = shape.boundingBox.bounds;
  const vo = estFace ? { normales:[], rentrant:null } : voisines(R, plans, t);
  return { ...t, r:relatif(t.m, bb), adj:vo.normales, rentrant:vo.rentrant };
}

/** Écart entre une description et un candidat. Direction opposée permise pour une arête, pas pour une face. */
function ecartRapide(ref, t, bb){
  if(t.g !== ref.g) return Infinity;
  const diag = Math.max(1e-6, dist(bb[0], bb[1]));
  let e = 4 * Math.min(dist(relatif(t.m, bb), ref.r), dist(t.m, ref.m) / diag);
  if(ref.d && t.d){
    const s = ref.d[0] * t.d[0] + ref.d[1] * t.d[1] + ref.d[2] * t.d[2];
    e += 6 * (1 - (t.face ? s : Math.abs(s)));
  }
  return e + 0.2 * Math.abs(Math.log(t.L / ref.L));
}

const LIMITE = 1.2;                    // au-delà, aucun candidat ne lui ressemble assez : elle est perdue

/**
 * Les éléments désignés par `points` sur la forme. `refs` : descriptions gardées (op.refs), clés `genre:point`.
 * Rend { elements, refs } ; lève une erreur si un élément a disparu.
 */
export function retrouver(R, shape, genre, points, refs = {}){
  const estFace = genre === "faces";
  const liste = estFace ? shape.faces : shape.edges;
  if(!points?.length) throw new Error("aucune arête ou face désignée");
  const bb = shape.boundingBox.bounds;
  const plans = estFace ? [] : plansDe(shape);
  const nouvelles = {}, elements = [];
  let traits = null;
  for(const p of points){
    const cle = `${genre}:${p}`, ref = refs[cle];
    let el;
    if(!ref){
      const r = plusProche(R, liste, p);
      if(r.d > 1.5) throw new Error("une arête ou une face désignée n'existe plus (la forme a changé : désignez-la de nouveau)");
      el = r.el;
    }else{
      traits ||= liste.map(x => ({ el:x, t:{ ...trait(R, x, estFace), face:estFace } }));
      const candidats = traits.map(c => ({ ...c, e:ecartRapide(ref, c.t, bb) })).filter(c => c.e < Infinity).sort((a, b) => a.e - b.e).slice(0, 4);
      let meilleur = null;
      for(const c of candidats){
        let e = c.e;
        if(!estFace && ref.adj?.length){
          /* Une voisine de la description sans équivalent chez le candidat : ce n'est sans doute pas la même arête. */
          const vo = voisines(R, plans, c.t);
          for(const n of ref.adj) if(!vo.normales.some(a => a[0] * n[0] + a[1] * n[1] + a[2] * n[2] > 0.999)) e += 0.8;
          if(ref.rentrant !== null && vo.rentrant !== null && ref.rentrant !== vo.rentrant) e += 1.2;
        }
        if(!meilleur || e < meilleur.e) meilleur = { el:c.el, e };
      }
      if(!meilleur || meilleur.e > LIMITE) throw new Error("une arête ou une face désignée n'existe plus (la forme a changé : désignez-la de nouveau)");
      el = meilleur.el;
    }
    elements.push(el);
    nouvelles[cle] = decrire(R, shape, plans, el, estFace);
  }
  return { elements, refs:nouvelles };
}
