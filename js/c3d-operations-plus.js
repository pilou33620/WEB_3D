/* =============================================================================
   Conception 3D — c3d-operations-plus.js
   Les opérations ajoutées pour rejoindre les commandes de solidcraft : solides
   (englobant, retrait, alignement, face décalée ou supprimée, frontière, division,
   répétition sur chemin, voile), surfaces (réglée, raccord, inversion, découture,
   détourage), plastique (bossage, lèvre, repos, clip), tôlerie (conversion,
   perforation), nuage de points. Même contrat que c3-operations.js.
   Sans écran : les analyses du bas servent aussi au banc, sous Node.
   ============================================================================= */
"use strict";

import { repere, versMonde, vec, profils, dedans, cercle3Points, echantillonSpline, planConstruction, axePerpendiculaire } from "./c2-esquisse.js";
import { dansMatiere } from "./c3c-references.js";

export const TYPES_PLUS = {
  englobant:{ nom:"Solide englobant", icone:"⬚" }, retirerCorps:{ nom:"Retrait de corps", icone:"⌫" }, aligner:{ nom:"Alignement", icone:"⊟" },
  decalerFace:{ nom:"Face décalée", icone:"⇉" }, supprimerFace:{ nom:"Face supprimée", icone:"⊠" }, remplacerFace:{ nom:"Face remplacée", icone:"⇄" },
  cellule:{ nom:"Remplissage de frontière", icone:"▦" }, diviser:{ nom:"Division de corps", icone:"⫿" }, diviserFace:{ nom:"Division de face", icone:"⫾" },
  repChemin:{ nom:"Répétition sur chemin", icone:"⋰" }, voile:{ nom:"Voile", icone:"╪" },
  surfReglee:{ nom:"Surface réglée", icone:"⫼" }, surfRaccord:{ nom:"Raccord de surfaces", icone:"⌓" }, surfInverser:{ nom:"Normale inversée", icone:"⇅" },
  surfDecoudre:{ nom:"Découture", icone:"⧈" }, surfDetourer:{ nom:"Détourage", icone:"⊡" },
  bossage:{ nom:"Bossage", icone:"⊚" }, levre:{ nom:"Lèvre", icone:"⊓" }, repos:{ nom:"Repos", icone:"⊔" }, clip:{ nom:"Clip", icone:"⌐" },
  toleConvertie:{ nom:"Conversion en tôle", icone:"▭" }, brideChaine:{ nom:"Bord tombé en chaîne", icone:"⌈" }, perforation:{ nom:"Perforation", icone:"⁙" },
  nuage:{ nom:"Nuage de points", icone:"⁖" }, gravureCylindre:{ nom:"Gravure sur cylindre", icone:"✎" },
};

const DEG = Math.PI / 180;
const pt = (p) => [p.x, p.y, p.z];
const moins = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

/** Les points d'un chemin d'esquisse, bout à bout, pour le répartir à longueur égale. */
export function echantillonnerChemin(segments){
  const pts = [segments[0].a];
  for(const s of segments){
    if(s.type === "ligne") pts.push(s.b);
    else if(s.type === "spline") pts.push(...echantillonSpline(s.pts).slice(1));
    else{
      const k = cercle3Points({ x:s.a[0], y:s.a[1] }, { x:s.m[0], y:s.m[1] }, { x:s.b[0], y:s.b[1] });
      if(!k){ pts.push(s.b); continue; }
      const a1 = Math.atan2(s.a[1] - k.c.y, s.a[0] - k.c.x), a2 = Math.atan2(s.b[1] - k.c.y, s.b[0] - k.c.x);
      let d = a2 - a1;
      if(k.trigo){ if(d <= 0) d += 2 * Math.PI; }else if(d >= 0) d -= 2 * Math.PI;
      for(let i = 1; i <= 32; i++) pts.push([k.c.x + k.r * Math.cos(a1 + d * i / 32), k.c.y + k.r * Math.sin(a1 + d * i / 32)]);
    }
  }
  return pts;
}

/** n positions et tangentes réparties sur la polyligne, bouts compris (ferme : le bout n'est pas répété). */
export function repartir(pts, n, ferme = false){
  const cumul = [0];
  for(let i = 1; i < pts.length; i++) cumul.push(cumul[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = cumul[cumul.length - 1], sortie = [];
  for(let k = 0; k < n; k++){
    const s = L * k / (ferme ? n : n - 1);
    let i = 1;
    while(i < pts.length - 1 && cumul[i] < s) i++;
    const u = (s - cumul[i - 1]) / ((cumul[i] - cumul[i - 1]) || 1);
    const [a, b] = [pts[i - 1], pts[i]];
    sortie.push({ p:[a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u], angle:Math.atan2(b[1] - a[1], b[0] - a[0]) / DEG });
  }
  return sortie;
}

/** Les trous d'une perforation : grille carrée ou en quinconce dans un contour, à `marge` de son bord. */
export function grillePerforation(poly, pas, disposition, marge){
  const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const dBord = ([x, y]) => {
    let m = Infinity;
    poly.forEach((a, i) => {
      const b = poly[(i + 1) % poly.length], dx = b[0] - a[0], dy = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1)));
      m = Math.min(m, Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy));
    });
    return m;
  };
  const sortie = [], quinconce = disposition === "quinconce", py = quinconce ? pas * Math.sqrt(3) / 2 : pas;
  const nl = Math.floor((y1 - y0) / py), yc = (y0 + y1) / 2;
  for(let j = -nl; j <= nl; j++){
    const dec = quinconce && j % 2 ? pas / 2 : 0, nc = Math.floor((x1 - x0) / pas) + 1, xc = (x0 + x1) / 2;
    for(let i = -nc; i <= nc; i++){
      const q = [xc + i * pas + dec, yc + j * py];
      if(dedans(q, poly) && dBord(q) >= marge) sortie.push(q);
    }
  }
  return sortie;
}

export function operationsPlus(H){
  const { corpsCible, remplacer, nouveauCorps, appliquer, chercherEsquisse, planNoyau, tracer, dessinRegions, revolutionProfil, orienter, designes, plusProches, faceSuivie } = H;
  const enCoquille = (R, f) => f.constructor.name === "Face" ? R.makeCompound([f]) : f;
  const construitPar = (R, b) => R.cast(R.downcast(b.Shape()));
  const positif = (R, s) => R.measureVolume(s) < 0 ? R.cast(s.wrapped.Reversed()) : s;

  /** Le morceau de corps entre une face et sa copie décalée : solide, de volume positif. */
  const epaisseurDeFace = (R, f, d) => {
    const oc = R.getOC(), m = new oc.BRepOffsetAPI_MakeThickSolid();
    m.MakeThickSolidBySimple(f.wrapped, d);
    m.Build(new oc.Message_ProgressRange());
    return positif(R, construitPar(R, m));
  };

  /**
   * La matière à ajouter sur une face cylindrique, entière ou non : une couronne de son angle, qui mord un peu dans
   * le corps. Deux cylindres exactement coïncidents font échouer la fusion du noyau, d'où ce recouvrement.
   */
  const couronneCylindre = (R, corps, f, d, enlever = false) => {
    const oc = R.getOC(), s = new oc.BRepAdaptor_Surface(f.wrapped, false), cyl = s.Cylinder(), ax = cyl.Axis();
    const lieu = ax.Location(), dir = ax.Direction(), r = cyl.Radius();
    const c = [lieu.X(), lieu.Y(), lieu.Z()], axe = vec.norm([dir.X(), dir.Y(), dir.Z()]);
    const rad = (u) => { const m = moins(pt(f.pointOnSurface(u, 0.5)), c); return vec.norm(vec.ajout(m, axe, -vec.scal(m, axe))); };
    const ts = f.edges.flatMap(e => [e.startPoint, e.endPoint]).map(q => vec.scal(moins(pt(q), c), axe));
    const t0 = Math.min(...ts), h = Math.max(...ts) - t0;
    const pas = [0, 0.25, 0.5, 0.75, 1].map(rad);
    const signe = vec.scal(vec.vect(pas[0], pas[1]), axe) >= 0 ? 1 : -1;
    const span = pas.slice(1).reduce((a, q, i) => a + Math.acos(Math.max(-1, Math.min(1, vec.scal(pas[i], q)))), 0) / DEG;
    const depart = signe > 0 ? pas[0] : pas[4];
    const sonde = vec.ajout(pt(f.pointOnSurface(0.5, 0.5)), rad(0.5), 0.05);
    const trou = dansMatiere(R, corps, sonde), e = 0.05;
    if(trou && !enlever && d >= r) throw new Error("le trou se refermerait : supprimez plutôt sa face");
    if(enlever && !trou && d >= r) throw new Error("plus profond que le rayon du cylindre");
    /* Ajouter : du côté vide, en mordant dans le corps. Enlever : du côté de la matière, en dépassant dans le vide. */
    const [ri, re] = enlever === trou ? [r - e, r + d] : [r - d, r + e];
    const entier = span > 359.9;
    const o = vec.ajout(c, axe, t0);
    const plan = new R.Plane(o, depart, vec.vect(depart, axe));
    return R.draw([ri, 0]).lineTo([re, 0]).lineTo([re, h]).lineTo([ri, h]).close().sketchOnPlane(plan)
      .revolve(axe, { origin:o, angle:entier ? 360 : span });
  };

  /** Le découpage général du noyau : `forme` fendue par `outils`. */
  const fendre = (R, forme, outils) => {
    const oc = R.getOC(), a = new oc.NCollection_List_TopoDS_Shape(), t = new oc.NCollection_List_TopoDS_Shape();
    a.Append(forme.wrapped);
    for(const o of outils) t.Append(o.wrapped);
    const s = new oc.BRepAlgoAPI_Splitter();
    s.SetArguments(a); s.SetTools(t);
    s.Build(new oc.Message_ProgressRange());
    if(!s.IsDone()) throw new Error("le noyau n'a pas pu fendre cette forme");
    return R.cast(R.downcast(s.Shape()));
  };

  const diagonale = (bb) => Math.hypot(bb[1][0] - bb[0][0], bb[1][1] - bb[0][1], bb[1][2] - bb[0][2]);
  const plaqueSurPlan = (R, o, x, n, D) => R.drawRectangle(D, D).sketchOnPlane(new R.Plane(o, x, n)).face();

  /** Les lignes d'une esquisse en coques verticales, de part et d'autre du plan. */
  const voilesEsquisse = (R, esq, v, D) => {
    const oc = R.getOC(), r = repere(esq.plan, v), { plan } = planNoyau(R, esq, v);
    const sorties = profils(esq).ouverts.map(o => {
      const w = tracer(R, o.segments).done().sketchOnPlane(plan).wire.clone().translate(r.n.map(c => -c * D));
      return construitPar(R, new oc.BRepPrimAPI_MakePrism(w.wrapped, new R.Vector(r.n.map(c => c * 2 * D)).wrapped, false, true));
    });
    if(!sorties.length) throw new Error(`« ${esq.nom} » : une ligne ouverte indique où couper`);
    return sorties;
  };

  /** Les arêtes qu'une seule des faces restantes emploie, en boucles : elles bordent ce qu'il faut boucher. */
  const bouclesLibres = (faces) => {
    const parArete = new Map();
    for(const f of faces) for(const e of f.edges){
      const k = e.hashCode;
      if(!parArete.has(k)) parArete.set(k, { e, n:0 });
      parArete.get(k).n++;
    }
    const libres = [...parArete.values()].filter(x => x.n === 1).map(x => x.e);
    const cle = (p) => [p.x, p.y, p.z].map(c => c.toFixed(5)).join();
    const groupes = [];
    for(const e of libres){
      const bouts = new Set([cle(e.startPoint), cle(e.endPoint)]);
      const lies = groupes.filter(g => [...bouts].some(b => g.bouts.has(b)));
      const g = { aretes:[e, ...lies.flatMap(x => x.aretes)], bouts:new Set([...bouts, ...lies.flatMap(x => [...x.bouts])]) };
      for(const l of lies) groupes.splice(groupes.indexOf(l), 1);
      groupes.push(g);
    }
    return groupes.map(g => g.aretes);
  };

  /* Lèvre, rainure et repos : une couronne de l'esquisse, ajoutée ou enlevée. */
  const couronne = (R, etat, op, ctx, ext, int, hauteur, enlever) => {
    const { v } = ctx, esq = chercherEsquisse(ctx, op.esquisse), cible = corpsCible(etat, op.corps), r = repere(esq.plan, v);
    const d = (o) => { const x = dessinRegions(R, esq, op.contours); return o ? x.offset(o) : x; };
    const dessin = d(ext).cut(d(int));
    const n = op.inverse ? r.n.map(c => -c) : r.n, base = enlever ? vec.ajout(r.o, n, -hauteur) : r.o;
    const outil = dessin.sketchOnPlane(new R.Plane(base, r.x, n)).extrude(hauteur + (enlever ? 0.01 : 0));
    return remplacer(etat, cible, enlever ? cible.shape.cut(outil) : cible.shape.fuse(outil));
  };

  return {
    englobant(R, etat, op, { v }){
      const liste = op.outils?.length ? etat.corps.filter(c => op.outils.includes(c.nom)) : etat.corps.filter(c => !c.reference);
      if(!liste.length) throw new Error("aucun corps à englober");
      const m = v(op.marge ?? 0);
      if(m < 0) throw new Error("marge positive");
      const bornes = liste.map(c => c.shape.boundingBox.bounds);
      const mi = [0, 1, 2].map(i => Math.min(...bornes.map(b => b[0][i])) - m), ma = [0, 1, 2].map(i => Math.max(...bornes.map(b => b[1][i])) + m);
      return appliquer(etat, R.makeBox(mi, ma), op);
    },
    retirerCorps(R, etat, op){
      const cible = corpsCible(etat, op.corps);
      return { ...etat, corps:etat.corps.filter(c => c !== cible) };
    },
    aligner(R, etat, op){
      const cible = corpsCible(etat, op.corps), ref = etat.corps.find(c => c.nom === op.reference && c !== cible);
      if(!ref) throw new Error("corps de référence à choisir");
      const [a0, a1] = cible.shape.boundingBox.bounds, [b0, b1] = ref.shape.boundingBox.bounds;
      const t = ["x", "y", "z"].map((k, i) => ({ min:b0[i] - a0[i], max:b1[i] - a1[i], centre:(b0[i] + b1[i] - a0[i] - a1[i]) / 2, apres:b1[i] - a0[i], avant:b0[i] - a1[i] })[op[k]] ?? 0);
      return remplacer(etat, cible, cible.shape.clone().translate(t));
    },

    decalerFace(R, etat, op, ctx){
      const cible = corpsCible(etat, op.corps), d = ctx.v(op.distance);
      if(!d) throw new Error("distance non nulle : positive pour ajouter, négative pour enlever");
      let forme = cible.shape;
      for(const f of designes(R, forme, "faces", op.faces, op, ctx)){
        const avant = Math.abs(R.measureVolume(forme));
        const ajout = d > 0 && f.geomType === "CYLINDRE";
        const outil = ajout ? couronneCylindre(R, cible.shape, f, d) : epaisseurDeFace(R, f, d);
        const attendu = ajout ? null : Math.abs(R.measureVolume(outil));
        forme = d > 0 ? forme.fuse(outil, { simplify:true }) : forme.cut(outil, { simplify:true });
        /* Le noyau rend parfois un volume nul sans erreur sur des faces courbes coïncidentes : on ne le laisse pas passer. */
        const apres = Math.abs(R.measureVolume(forme));
        const incoherent = d > 0 ? apres <= avant : apres >= avant;
        if(incoherent || (attendu && Math.abs(Math.abs(apres - avant) - attendu) > 0.05 * attendu)) throw new Error("le noyau ne sait pas décaler cette face : essayez une face plane ou cylindrique");
      }
      return remplacer(etat, cible, forme);
    },

    /** shortcut: bouche le trou laissé par une face au lieu de prolonger ses voisines ; un vrai retrait de congé demanderait BRepAlgoAPI_Defeaturing, absent de ce noyau. */
    supprimerFace(R, etat, op, ctx){
      const cible = corpsCible(etat, op.corps);
      const retirees = new Set(designes(R, cible.shape, "faces", op.faces, op, ctx).map(f => f.hashCode));
      const reste = cible.shape.faces.filter(f => !retirees.has(f.hashCode));
      if(!reste.length) throw new Error("il ne resterait rien de ce corps");
      if(op.ouvrir) return { ...etat, corps:etat.corps.map(c => c === cible ? { ...c, shape:R.weldShellsAndFaces(reste), surface:true } : c) };
      const bouchons = bouclesLibres(reste).map(a => {
        const w = R.assembleWire(a);
        try{ return R.makeFace(w); }catch(_){ return R.makeNonPlanarFace(w); }
      });
      return remplacer(etat, cible, positif(R, R.makeSolid([...reste, ...bouchons])));
    },

    remplacerFace(R, etat, op, ctx){
      const cible = corpsCible(etat, op.corps), outil = etat.corps.find(c => c.nom === op.outil && c !== cible);
      if(!outil) throw new Error("surface de remplacement à choisir");
      const f = designes(R, cible.shape, "faces", op.faces?.slice(0, 1), op, ctx)[0];
      const m = R.makeVertex(pt(f.center));
      const pieces = fendre(R, cible.shape, outil.shape.faces).solids;
      if(pieces.length < 2){
        /* La surface est au-delà du corps : la face plane va la rejoindre. */
        if(f.geomType !== "PLANE") throw new Error("pour prolonger jusqu'à la surface, la face doit être plane");
        const n = pt(f.normalAt()), D = 2 * diagonale(cible.shape.boundingBox.bounds) + 2 * diagonale(outil.shape.boundingBox.bounds);
        const morceaux = fendre(R, R.basicFaceExtrusion(f, new R.Vector(n.map(c => c * D))), outil.shape.faces).solids;
        const lien = morceaux.find(s => R.measureDistanceBetween(m, s) < 1e-6);
        if(morceaux.length < 2 || !lien) throw new Error("la surface ne barre pas le chemin de cette face");
        return remplacer(etat, cible, cible.shape.fuse(lien, { simplify:true }));
      }
      const garde = pieces.filter(s => R.measureDistanceBetween(m, s) > 1e-6);
      if(!garde.length || garde.length === pieces.length) throw new Error("impossible de dire quel côté de la surface garder");
      return remplacer(etat, cible, garde.reduce((a, b) => a.fuse(b)));
    },

    cellule(R, etat, op, { v }){
      const outils = (op.outils || []).map(n => etat.corps.find(c => c.nom === n));
      if(outils.length < 1 || outils.some(c => !c)) throw new Error("corps et surfaces qui bornent la cellule à choisir");
      const bornes = outils.map(c => c.shape.boundingBox.bounds);
      const mi = [0, 1, 2].map(i => Math.min(...bornes.map(b => b[0][i])) - 1), ma = [0, 1, 2].map(i => Math.max(...bornes.map(b => b[1][i])) + 1);
      const p = [v(op.x), v(op.y), v(op.z)];
      const cellules = fendre(R, R.makeBox(mi, ma), outils.flatMap(c => c.surface ? c.shape.faces : [c.shape])).solids;
      const prise = cellules.find(s => dansMatiere(R, s, p));
      if(!prise) throw new Error("le point choisi n'est dans aucune cellule fermée");
      return appliquer(etat, prise, op);
    },

    diviser(R, etat, op, ctx){
      const { v } = ctx, cible = corpsCible(etat, op.corps), D = 2 * diagonale(cible.shape.boundingBox.bounds) + 10;
      let outils;
      if(op.mode === "plan"){
        const pl = ctx.doc.operations.find(o => o.id === op.plan && o.type === "plan");
        if(!pl) throw new Error("plan de construction à choisir");
        const q = planConstruction(pl, v, ctx.doc);
        outils = [plaqueSurPlan(R, q.origine, q.xdir, q.normale, D)];
      }else if(op.mode === "esquisse"){
        outils = voilesEsquisse(R, chercherEsquisse(ctx, op.esquisse), v, D);
      }else{
        const s = etat.corps.find(c => c.nom === op.outil && c !== cible);
        if(!s) throw new Error("surface qui coupe à choisir");
        outils = s.surface ? s.shape.faces : [s.shape];
      }
      const pieces = fendre(R, cible.shape, outils).solids;
      if(pieces.length < 2) throw new Error("cet outil ne traverse pas le corps");
      let suite = remplacer(etat, cible, pieces[0]);
      for(const p of pieces.slice(1)) suite = nouveauCorps(suite, p);
      return suite;
    },

    diviserFace(R, etat, op, ctx){
      const { v } = ctx, cible = corpsCible(etat, op.corps), esq = chercherEsquisse(ctx, op.esquisse);
      const D = 2 * diagonale(cible.shape.boundingBox.bounds) + 10;
      const visees = designes(R, cible.shape, "faces", op.faces, op, ctx), ids = new Set(visees.map(f => f.hashCode));
      const outils = voilesEsquisse(R, esq, v, D);
      const nouvelles = visees.flatMap(f => fendre(R, f, outils).faces);
      if(nouvelles.length <= visees.length) throw new Error("les lignes de l'esquisse ne coupent pas ces faces");
      return remplacer(etat, cible, positif(R, R.makeSolid([...cible.shape.faces.filter(f => !ids.has(f.hashCode)), ...nouvelles])));
    },

    repChemin(R, etat, op, ctx){
      const { v } = ctx, cible = corpsCible(etat, op.corps), chem = chercherEsquisse(ctx, op.chemin), n = Math.round(v(op.nombre));
      if(!(n >= 2 && n <= 500)) throw new Error("nombre d'exemplaires entre 2 et 500");
      const { ouverts, regions } = profils(chem), suite = ouverts[0] || regions[0]?.exterieur;
      if(!suite?.segments) throw new Error(`« ${chem.nom} » n'a pas de chemin`);
      const re = repere(chem.plan, v), pose = repartir(echantillonnerChemin(suite.segments), n, !ouverts[0]);
      const P0 = versMonde(re, ...pose[0].p);
      const copies = pose.slice(1).map(q => {
        let f = cible.shape.clone();
        if(op.orienter && q.angle !== pose[0].angle) f = f.rotate(q.angle - pose[0].angle, P0, re.n);
        return f.translate(moins(versMonde(re, ...q.p), P0));
      });
      if(op.separe) return copies.reduce((s, c) => nouveauCorps(s, c), etat);
      return remplacer(etat, cible, copies.reduce((f, c) => f.fuse(c), cible.shape));
    },

    /** Le voile s'arrête aux parois : seuls comptent les morceaux qui contiennent le milieu d'une ligne de l'esquisse. */
    voile(R, etat, op, ctx){
      const v = ctx.v, esq = chercherEsquisse(ctx, op.esquisse), cible = corpsCible(etat, op.corps), ep = v(op.epaisseur);
      if(!(ep > 0)) throw new Error("épaisseur positive");
      const lignes = profils(esq).ouverts.flatMap(o => o.segments);
      if(!lignes.length || lignes.some(s => s.type !== "ligne")) throw new Error(`« ${esq.nom} » : un voile suit des lignes droites ouvertes`);
      const bb = cible.shape.boundingBox.bounds, D = diagonale(bb) + 10;
      let dessin = null;
      for(const s of lignes){
        const L = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]) || 1, ux = (s.b[0] - s.a[0]) / L, uy = (s.b[1] - s.a[1]) / L, nx = -uy * ep / 2, ny = ux * ep / 2;
        const a = [s.a[0] - ux * D, s.a[1] - uy * D], b = [s.b[0] + ux * D, s.b[1] + uy * D];
        const d = R.draw([a[0] + nx, a[1] + ny]).lineTo([b[0] + nx, b[1] + ny]).lineTo([b[0] - nx, b[1] - ny]).lineTo([a[0] - nx, a[1] - ny]).close();
        dessin = dessin ? dessin.fuse(d) : d;
      }
      const r = repere(esq.plan, v);
      const brut = dessin.sketchOnPlane(new R.Plane(vec.ajout(r.o, r.n, -D), r.x, r.n)).extrude(2 * D).intersect(R.makeBox(bb[0], bb[1]));
      const milieux = lignes.map(s => versMonde(r, (s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2));
      const morceaux = brut.cut(cible.shape).solids.filter(s => milieux.some(m => dansMatiere(R, s, m)));
      if(!morceaux.length) throw new Error("le milieu des lignes doit être dans le vide du corps, là où le voile passera");
      return remplacer(etat, cible, morceaux.reduce((f, s) => f.fuse(s), cible.shape));
    },

    /* ---------------- surfaces ---------------- */
    surfReglee(R, etat, op, ctx){
      const cible = corpsCible(etat, op.corps), d = ctx.v(op.distance), oc = R.getOC();
      if(!d) throw new Error("distance non nulle");
      const faces = cible.shape.faces, sorties = [];
      for(const a of designes(R, cible.shape, "aretes", op.aretes, op, ctx)){
        const m = a.pointAt(0.5), mv = R.makeVertex(pt(m));
        const f = faces.reduce((p, q) => R.measureDistanceBetween(mv, q) < R.measureDistanceBetween(mv, p) ? q : p);
        const n = pt(f.normalAt(m));
        let dir = n;
        if(op.sens === "tangente"){
          dir = vec.norm(vec.vect(pt(a.tangentAt(0.5)), n));
          if(vec.scal(dir, moins(pt(m), pt(f.center))) < 0) dir = dir.map(c => -c);
        }
        sorties.push(construitPar(R, new oc.BRepPrimAPI_MakePrism(a.wrapped, new R.Vector(dir.map(c => c * d)).wrapped, false, true)));
      }
      return nouveauCorps(etat, sorties.length === 1 ? sorties[0] : R.makeCompound(sorties), { surface:true });
    },
    surfRaccord(R, etat, op){
      const toutes = etat.corps.flatMap(c => c.shape.edges);
      if(!op.aretes?.length || !op.aretes2?.length) throw new Error("une arête au moins de chaque côté du raccord");
      const fil = (pts) => R.assembleWire(plusProches(R, toutes, pts));
      return nouveauCorps(etat, R.loft([fil(op.aretes), fil(op.aretes2)], { ruled:!!op.regle }, true), { surface:true });
    },
    surfInverser(R, etat, op){
      const cible = corpsCible(etat, op.corps);
      return remplacer(etat, cible, R.cast(cible.shape.wrapped.Reversed()));
    },
    surfDecoudre(R, etat, op){
      const cible = corpsCible(etat, op.corps), faces = cible.shape.faces;
      if(faces.length < 2) throw new Error("une seule face : rien à découdre");
      const reste = { ...etat, corps:etat.corps.filter(c => c !== cible) };
      return faces.reduce((s, f) => nouveauCorps(s, enCoquille(R, f), { surface:true }), reste);
    },
    /** Rend à des faces leur contour extérieur : les trous tombent. */
    surfDetourer(R, etat, op, ctx){
      const cible = corpsCible(etat, op.corps);
      const visees = designes(R, cible.shape, "faces", op.faces, op, ctx), ids = new Set(visees.map(f => f.hashCode));
      const refaites = visees.map(f => {
        const w = f.clone().outerWire();
        return f.geomType === "PLANE" ? R.makeFace(w) : R.makeNonPlanarFace(w);
      });
      const faces = [...cible.shape.faces.filter(f => !ids.has(f.hashCode)), ...refaites];
      return remplacer(etat, cible, faces.length === 1 ? enCoquille(R, faces[0]) : R.weldShellsAndFaces(faces));
    },

    /* ---------------- plastique ---------------- */
    bossage(R, etat, op, ctx){
      const { v } = ctx, esq = chercherEsquisse(ctx, op.esquisse), { points } = profils(esq);
      if(!points.length) throw new Error(`« ${esq.nom} » n'a aucun point isolé pour placer les bossages`);
      const De = v(op.de), Di = v(op.di), h = v(op.hauteur), p = v(op.profondeur), a = v(op.depouille ?? 0);
      if(!(De > Di && Di >= 0 && h > 0 && p >= 0)) throw new Error("diamètre extérieur plus grand que le trou, hauteur positive");
      if(p > h) throw new Error("le trou ne peut pas être plus profond que le bossage");
      const rb = De / 2 + h * Math.tan(a * DEG), n0 = repere(esq.plan, v), n = op.inverse ? n0.n.map(c => -c) : n0.n;
      let f = revolutionProfil(R, [[0, 0], [rb, 0], [De / 2, h], [0, h]]);
      const nb = Math.round(v(op.nervures ?? 0)), te = v(op.epNervure ?? 1);
      if(nb > 0){
        if(!(te > 0)) throw new Error("épaisseur de nervure positive");
        for(let i = 0; i < nb; i++){
          const g = R.draw([De / 2 - 0.2, 0]).lineTo([De / 2 + v(op.largeurNervure ?? 3), 0]).lineTo([De / 2 - 0.2, h * 0.8]).close()
            .sketchOnPlane(new R.Plane([0, te / 2, 0], [1, 0, 0], [0, -1, 0])).extrude(te);
          f = f.fuse(g.rotate(i * 360 / nb, [0, 0, 0], [0, 0, 1]));
        }
      }
      const modele = orienter(f, n, [0, 0, 0]);
      const copies = points.map(([x, y]) => modele.clone().translate(versMonde(n0, x, y)));
      const cible = etat.corps.some(c => !c.reference) && op.corps !== "nouveau" ? corpsCible(etat, op.corps) : null;
      const plein = copies.length === 1 ? copies[0] : R.makeCompound(copies);
      let forme = cible ? cible.shape.fuse(plein) : plein;
      if(Di > 0 && p > 0){
        const trou = orienter(revolutionProfil(R, [[0, h - p], [Di / 2, h - p], [Di / 2, h + 1], [0, h + 1]]), n, [0, 0, 0]);
        const trous = points.map(([x, y]) => trou.clone().translate(versMonde(n0, x, y)));
        forme = forme.cut(trous.length === 1 ? trous[0] : R.makeCompound(trous));
      }
      return cible ? remplacer(etat, cible, forme) : nouveauCorps(etat, forme);
    },
    levre(R, etat, op, ctx){
      const { v } = ctx, l = v(op.largeur), h = v(op.hauteur), j = v(op.jeu ?? 0);
      if(!(l > 0 && h > 0 && j >= 0)) throw new Error("largeur et hauteur positives");
      return op.mode === "rainure" ? couronne(R, etat, op, ctx, -j || 0, -l - j, h + j, true) : couronne(R, etat, op, ctx, 0, -l, h, false);
    },
    repos(R, etat, op, ctx){
      const { v } = ctx, l = v(op.largeur), h = v(op.hauteur);
      if(!(l > 0 && h > 0)) throw new Error("largeur et hauteur positives");
      return couronne(R, etat, op, ctx, l, 0, h, false);
    },
    clip(R, etat, op, ctx){
      const { v } = ctx, esq = chercherEsquisse(ctx, op.esquisse), { points } = profils(esq);
      if(!points.length) throw new Error(`« ${esq.nom} » n'a aucun point isolé pour placer les clips`);
      const L = v(op.longueur), w = v(op.largeur), e = v(op.epaisseur), hc = v(op.crochet), s = v(op.surplomb), j = v(op.jeu ?? 0);
      if(!(L > hc && hc > 0 && w > 0 && e > 0 && s > 0 && j >= 0)) throw new Error("longueur plus grande que le crochet, cotes positives");
      const cible = corpsCible(etat, op.corps), rp = repere(esq.plan, v), n = op.inverse ? rp.n.map(c => -c) : rp.n, a = v(op.angle ?? 0);
      let f;
      if(op.mode === "logement"){
        f = R.makeBox([-j, -w / 2 - j, -L], [e + s + j, w / 2 + j, 0.01]);
      }else{
        f = R.draw([0, 0]).lineTo([e, 0]).lineTo([e, L - hc]).lineTo([e + s, L - hc]).lineTo([e, L]).lineTo([0, L]).close()
          .sketchOnPlane(new R.Plane([0, w / 2, 0], [1, 0, 0], [0, -1, 0])).extrude(w);
      }
      if(a) f = f.rotate(a, [0, 0, 0], [0, 0, 1]);
      const modele = orienter(f, n, [0, 0, 0]);
      const copies = points.map(([x, y]) => modele.clone().translate(versMonde(rp, x, y)));
      const outil = copies.length === 1 ? copies[0] : R.makeCompound(copies);
      return remplacer(etat, cible, op.mode === "logement" ? cible.shape.cut(outil) : cible.shape.fuse(outil));
    },

    /* ---------------- tôlerie ---------------- */
    toleConvertie(R, etat, op, { v }){
      const cible = corpsCible(etat, op.corps);
      if(!op.face) throw new Error("face à désigner : celle de la tôle");
      const f = faceSuivie(R, [cible], op.face);
      if(!f) throw new Error("la face n'existe plus : désignez-la de nouveau");
      const n = vec.norm(op.face.normale);
      const zs = cible.shape.edges.flatMap(e => [e.startPoint, e.endPoint]).map(q => vec.scal(pt(q), n));
      const z0 = Math.min(...zs), ep = Math.max(...zs) - z0;
      if(!(ep > 0)) throw new Error("ce corps n'a pas d'épaisseur le long de la normale");
      /* Une plaque : le volume vaut l'aire de sa face par son épaisseur. */
      if(Math.abs(R.measureArea(f) * ep - Math.abs(R.measureVolume(cible.shape))) > 0.02 * Math.abs(R.measureVolume(cible.shape))) throw new Error("ce corps n'est pas une plaque d'épaisseur constante");
      return { ...etat, corps:etat.corps.map(c => c === cible ? { ...c, tole:{ ep, r:v(op.rayon), k:v(op.k), n, x:axePerpendiculaire(n), z0, plis:[] } } : c) };
    },
    perforation(R, etat, op, ctx){
      const { v } = ctx, esq = chercherEsquisse(ctx, op.esquisse), cible = corpsCible(etat, op.corps), d = v(op.diametre), pas = v(op.pas);
      if(!(d > 0 && pas > d)) throw new Error("le pas doit dépasser le diamètre");
      const poly = profils(esq).faces[0]?.poly;
      if(!poly) throw new Error(`« ${esq.nom} » : un contour fermé limite la perforation`);
      const trous = grillePerforation(poly, pas, op.disposition, v(op.marge ?? 0) + d / 2);
      if(!trous.length) throw new Error("aucun trou ne tient dans ce contour");
      if(trous.length > 5000) throw new Error(`${trous.length} trous : 5000 au plus`);
      ctx.note.trous = trous.length;
      const r = repere(esq.plan, v), D = 2 * diagonale(cible.shape.boundingBox.bounds) + 10;
      const modele = orienter(R.makeCylinder(d / 2, 2 * D, [0, 0, -D]), r.n, [0, 0, 0]);
      const copies = trous.map(([x, y]) => modele.clone().translate(versMonde(r, x, y)));
      return remplacer(etat, cible, cible.shape.cut(copies.length === 1 ? copies[0] : R.makeCompound(copies)));
    },

    /** Le dessin d'une esquisse posé sur un cylindre : la profondeur suit la surface, sur le côté tourné vers l'esquisse. */
    gravureCylindre(R, etat, op, ctx){
      const { v } = ctx, esq = chercherEsquisse(ctx, op.esquisse), cible = corpsCible(etat, op.corps), p = v(op.profondeur);
      if(!(p > 0)) throw new Error("profondeur positive");
      if(!op.cylindre?.surf) throw new Error("face cylindrique à désigner");
      const f = designes(R, cible.shape, "faces", [op.cylindre.surf], op, ctx)[0];
      if(f.geomType !== "CYLINDRE") throw new Error("cette face n'est pas un cylindre");
      const relief = op.mode === "relief", r = repere(esq.plan, v);
      const n = op.inverse ? r.n.map(c => -c) : r.n;
      /* Le prisme part du plan et s'arrête à l'axe : l'autre côté du cylindre n'est pas touché. */
      const c = op.cylindre.centre, D = vec.scal(moins(r.o, c), n);
      if(D <= 0) throw new Error("le plan de l'esquisse doit être devant le cylindre, côté normale (ou cochez Inverser)");
      const prisme = dessinRegions(R, esq, op.contours).sketchOnPlane(new R.Plane(vec.ajout(r.o, n, -D), r.x, r.n)).extrude(op.inverse ? -D : D);
      const motif = prisme.intersect(couronneCylindre(R, cible.shape, f, p, !relief));
      if(!motif.solids.length) throw new Error("le dessin de l'esquisse ne tombe pas sur ce cylindre");
      return remplacer(etat, cible, relief ? cible.shape.fuse(motif) : cible.shape.cut(motif));
    },

    /* Rien dans le volume : le nuage est dessiné par la page. */
    nuage:(R, etat) => etat,
  };
}

/* -----------------------------------------------------------------------------
   Analyses : lues sur le B-Rep, sans rien changer
   --------------------------------------------------------------------------- */
/** Le plus petit rayon de courbure d'une face : exact pour un cylindre ou une sphère, par trois points voisins sinon. */
function rayonFace(R, f){
  const oc = R.getOC();
  if(f.geomType === "PLANE") return Infinity;
  if(f.geomType === "CYLINDRE" || f.geomType === "SPHERE"){
    const s = new oc.BRepAdaptor_Surface(f.wrapped, false);
    const r = f.geomType === "SPHERE" ? s.Sphere().Radius() : s.Cylinder().Radius();
    s.delete();
    return r;
  }
  let m = Infinity;
  for(const [a, b] of [[(t) => [t, 0.5], null], [(t) => [0.5, t], null]]){
    const q = [0.25, 0.5, 0.75].map(t => pt(f.pointOnSurface(...a(t))));
    const u = moins(q[1], q[0]), w = moins(q[2], q[1]), c = Math.hypot(...vec.vect(u, w));
    if(c < 1e-9) continue;              // droit dans cette direction (cône, surface réglée)
    m = Math.min(m, Math.hypot(...u) * Math.hypot(...w) * Math.hypot(...moins(q[2], q[0])) / (2 * c));
  }
  return m;
}

/** Bilan d'un corps : rayon minimal, nature des faces, jonctions tangentes ou vives, et leurs tracés. */
export function analyserCorps(R, forme){
  const faces = forme.faces, natures = {};
  let rayonMin = Infinity;
  for(const f of faces){
    natures[f.geomType] = (natures[f.geomType] || 0) + 1;
    rayonMin = Math.min(rayonMin, rayonFace(R, f));
  }
  const parArete = new Map();
  for(const f of faces) for(const e of f.edges){
    if(!parArete.has(e.hashCode)) parArete.set(e.hashCode, { e, faces:[] });
    const g = parArete.get(e.hashCode);
    if(!g.faces.includes(f) && !g.faces.some(x => x.hashCode === f.hashCode)) g.faces.push(f);
  }
  const tangentes = [], vives = [], libres = [];
  for(const { e, faces:fs } of parArete.values()){
    if(fs.length === 1){ if(e.startPoint) libres.push(e); continue; }
    if(fs.length !== 2) continue;
    const m = e.pointAt(0.5), a = fs[0].normalAt(m), b = fs[1].normalAt(m);
    const angle = Math.acos(Math.min(1, Math.abs(a.x * b.x + a.y * b.y + a.z * b.z))) / DEG;
    (angle < 0.5 ? tangentes : vives).push(e);
  }
  const trace = (liste) => liste.flatMap(e => {
    const pas = e.geomType === "LINE" ? 1 : 16, seg = [];
    for(let i = 0; i < pas; i++) seg.push(...pt(e.pointAt(i / pas)), ...pt(e.pointAt((i + 1) / pas)));
    return seg;
  });
  return { rayonMin:Number.isFinite(rayonMin) ? rayonMin : null, natures, jonctions:{ tangentes:tangentes.length, vives:vives.length, libres:libres.length },
    traces:{ tangentes:trace(tangentes), vives:trace(vives), libres:trace(libres) } };
}

/** Ce qui change entre deux corps : le volume de chacun, ce que seul l'un contient, ce qu'ils partagent. */
export function comparerCorps(R, a, b){
  const vol = (s) => { try{ return Math.abs(R.measureVolume(s)); }catch(_){ return 0; } };
  return { volumeA:vol(a), volumeB:vol(b), seulA:vol(a.cut(b)), seulB:vol(b.cut(a)), commun:vol(a.intersect(b)) };
}

/** Polylignes 2D de la coupe de corps par le plan d'une esquisse. */
export function sectionPlan(R, corps, r){
  const sortie = [];
  for(const c of corps){
    const bb = c.shape.boundingBox.bounds, D = 2 * diagonale3(bb) + 10;
    const plaque = R.makeCompound([R.drawRectangle(D, D).sketchOnPlane(new R.Plane(r.o, r.x, r.n)).face()]);
    let coupe;
    try{ coupe = c.shape.intersect(plaque); }catch(_){ continue; }
    const m = coupe.meshEdges({ tolerance:0.02, angularTolerance:0.2 });
    for(const g of m.edgeGroups){
      const l = [];
      for(let i = g.start; i < g.start + g.count; i++){
        const p = m.lines.slice(i * 3, i * 3 + 3), d = [p[0] - r.o[0], p[1] - r.o[1], p[2] - r.o[2]];
        l.push([vec.scal(d, r.x), vec.scal(d, r.y)]);
      }
      if(l.length > 1) sortie.push(l);
    }
  }
  return sortie;
}
const diagonale3 = (bb) => Math.hypot(bb[1][0] - bb[0][0], bb[1][1] - bb[0][1], bb[1][2] - bb[0][2]);

/** Les arêtes vues depuis une caméra, à plat : visibles et cachées, comme un dessin. */
export function arretesVue(R, formes, { position, direction, xdir }){
  const cam = new R.ProjectionCamera(position, direction, xdir);
  const visibles = [], cachees = [];
  const plat = (e, sortie) => {
    const pas = e.geomType === "LINE" ? 1 : 24;
    for(let i = 0; i < pas; i++){
      const a = e.pointAt(i / pas), b = e.pointAt((i + 1) / pas);
      sortie.push([[a.x, a.y], [b.x, b.y]]);
    }
  };
  for(const f of formes){
    const { visible, hidden } = R.makeProjectedEdges(f, cam, true);
    for(const e of visible) plat(e, visibles);
    for(const e of hidden) plat(e, cachees);
  }
  return { visibles, cachees };
}
