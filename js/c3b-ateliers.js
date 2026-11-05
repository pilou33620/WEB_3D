/* =============================================================================
   Conception 3D — c3b-ateliers.js
   Les opérations des ateliers Surface, Assemblage, Tôlerie et Soudures, plus la
   visserie et les maillages insérés. Même contrat que c3-operations.js : chaque
   opération lit l'état et en rend un nouveau, sans modifier les formes (clone()
   avant translate, rotate, mirror). `H` apporte les aides de c3-operations.js.
   ============================================================================= */
"use strict";

import { repere, versMonde, vec, profils, axePerpendiculaire } from "./c2-esquisse.js";
import { dansMatiere } from "./c3c-references.js";
import { evaluer } from "./c1-expressions.js";

export const TYPES_ATELIERS = {
  surfExtrusion:{ nom:"Surface extrudée", icone:"⬆" }, surfRevolution:{ nom:"Surface de révolution", icone:"⟳" },
  surfBalayage:{ nom:"Surface balayée", icone:"≈" }, surfLissage:{ nom:"Surface lissée", icone:"⧖" },
  surfRemplissage:{ nom:"Remplissage", icone:"◫" }, surfAjuster:{ nom:"Ajustement de surface", icone:"✂" },
  surfProlonger:{ nom:"Prolongement", icone:"⇥" }, surfCoudre:{ nom:"Couture", icone:"⧉" },
  surfDecaler:{ nom:"Surface décalée", icone:"⫶" }, surfEpaissir:{ nom:"Épaississement", icone:"▤" },
  composant:{ nom:"Composant", icone:"⧈" }, liaison:{ nom:"Liaison", icone:"⚭" }, ancrer:{ nom:"Ancrage", icone:"⚓" },
  tole:{ nom:"Tôle", icone:"▬" }, bride:{ nom:"Bord tombé", icone:"⌐" }, ourlet:{ nom:"Ourlet", icone:"⊏" }, pli:{ nom:"Pli", icone:"⌒" },
  profile:{ nom:"Profilé", icone:"▥" }, vis:{ nom:"Visserie", icone:"⊗" }, maillage:{ nom:"Maillage inséré", icone:"△" },
  occurrence:{ nom:"Occurrence", icone:"⧉" }, filetage:{ nom:"Filetage", icone:"⧙" }, axe:{ nom:"Axe", icone:"╱" }, point:{ nom:"Point", icone:"•" }, image:{ nom:"Image", icone:"▨" },
};

/* Visserie métrique, en mm. CHC ISO 4762 (dk tête, k hauteur, s six-pans creux) ; H ISO 4014 (s, k) ;
   écrou ISO 4032 (s, m) ; rondelle ISO 7089 (d1, d2, h). */
export const VISSERIE = {
  M2:{ p:0.4, d:2, dk:3.8, k:2, s:1.5, sh:4, kh:1.4, m:1.6, d1:2.2, d2:5, h:0.3 },
  "M2.5":{ p:0.45, d:2.5, dk:4.5, k:2.5, s:2, sh:5, kh:1.7, m:2, d1:2.7, d2:6, h:0.5 },
  M3:{ p:0.5, d:3, dk:5.5, k:3, s:2.5, sh:5.5, kh:2, m:2.4, d1:3.2, d2:7, h:0.5 },
  M4:{ p:0.7, d:4, dk:7, k:4, s:3, sh:7, kh:2.8, m:3.2, d1:4.3, d2:9, h:0.8 },
  M5:{ p:0.8, d:5, dk:8.5, k:5, s:4, sh:8, kh:3.5, m:4.7, d1:5.3, d2:10, h:1 },
  M6:{ p:1, d:6, dk:10, k:6, s:5, sh:10, kh:4, m:5.2, d1:6.4, d2:12, h:1.6 },
  M8:{ p:1.25, d:8, dk:13, k:8, s:6, sh:13, kh:5.3, m:6.8, d1:8.4, d2:16, h:1.6 },
  M10:{ p:1.5, d:10, dk:16, k:10, s:8, sh:16, kh:6.4, m:8.4, d1:10.5, d2:20, h:2 },
  M12:{ p:1.75, d:12, dk:18, k:12, s:10, sh:18, kh:7.5, m:10.8, d1:13, d2:24, h:2.5 },
};

/* Poutres IPE (EN 10365), en mm : hauteur, largeur, âme, aile. */
export const PROFILS_IPE = {
  IPE80:{ h:80, b:46, tw:3.8, tf:5.2 }, IPE100:{ h:100, b:55, tw:4.1, tf:5.7 }, IPE120:{ h:120, b:64, tw:4.4, tf:6.3 }, IPE140:{ h:140, b:73, tw:4.7, tf:6.9 },
  IPE160:{ h:160, b:82, tw:5, tf:7.4 }, IPE180:{ h:180, b:91, tw:5.3, tf:8 }, IPE200:{ h:200, b:100, tw:5.6, tf:8.5 },
};

const pt = (p) => [p.x, p.y, p.z];
const moins = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const DEG = Math.PI / 180;

/**
 * La valeur d'une liaison : la sienne, ou la loi de sa liaison pilote (x : la valeur du pilote), qui dit un
 * engrenage (`x * -0.5`), une crémaillère, une vis ou une came (`5 * sin(x)`). Les limites la bornent.
 */
export function valeurLiaison(op, ctx, vus = new Set()){
  const { v, doc } = ctx;
  if(vus.has(op.id)) throw new Error("liaisons pilotées en boucle");
  vus.add(op.id);
  let x = v(op.valeur ?? 0);
  if(op.pilote){
    const p = doc.operations.find(o => o.id === op.pilote && o.type === "liaison");
    if(!p) throw new Error("la liaison pilote n'existe plus");
    const base = valeurLiaison(p, ctx, vus);
    x = evaluer(op.loi || "x", (n) => n === "x" ? base : v(n));
  }
  const borne = (t) => t !== undefined && t !== null && String(t).trim() !== "" ? v(t) : null;
  const mi = borne(op.min), ma = borne(op.max);
  if(mi !== null && ma !== null && mi > ma) throw new Error("limite basse plus grande que la limite haute");
  if(mi !== null) x = Math.max(mi, x);
  if(ma !== null) x = Math.min(ma, x);
  return x;
}

/** Rend le DXF d'un développé : segments [[x, y], [x, y]] du contour, et lignes de pli sur leur calque. */
export function ecrireDxf(contour, plis = []){
  const ligne = (c, a, b) => ["0", "LINE", "8", c, "10", a[0], "20", a[1], "30", 0, "11", b[0], "21", b[1], "31", 0].join("\n");
  return ["0\nSECTION\n2\nENTITIES", ...contour.map(([a, b]) => ligne("CONTOUR", a, b)), ...plis.map(([a, b]) => ligne("PLIS", a, b)), "0\nENDSEC\n0\nEOF\n"].join("\n");
}

export function ateliers(H){
  const { corpsCible, remplacer, nouveauCorps, appliquer, chercherEsquisse, plusProches, planNoyau, tracer, dessinRegions, designes } = H;

  /* ---------------- surfaces ---------------- */
  /** Les fils d'une esquisse : chaînes ouvertes et contours fermés. */
  const filsEsquisse = (R, esq, v) => {
    const { ouverts, faces } = profils(esq);
    const surPlan = (d) => d.sketchOnPlane(planNoyau(R, esq, v).plan).wire;
    const fils = ouverts.map(o => surPlan(tracer(R, o.segments).done()));
    for(const f of faces){
      const e = f.exterieur;
      fils.push(surPlan(e.cercle ? R.drawCircle(e.cercle.r).translate(e.cercle.c[0], e.cercle.c[1]) : tracer(R, e.segments).close()));
    }
    if(!fils.length) throw new Error(`« ${esq.nom} » ne contient ni chemin ni contour`);
    return fils;
  };
  const regrouper = (R, formes) => formes.length === 1 ? formes[0] : R.makeCompound(formes);
  const surface = (etat, forme) => nouveauCorps(etat, forme, { surface:true });
  /** Une face seule n'a ni cut ni fuse : un composé d'une face, si. */
  const enCoquille = (R, f) => f.constructor.name === "Face" ? R.makeCompound([f]) : f;
  const construitPar = (R, b) => R.cast(R.downcast(b.Shape()));

  /** Le solide d'un maillage insérable ou l'erreur : triangles → faces → coquille → solide si elle est fermée. */
  const polyedre = (R, tris) => {
    const faces = [];
    for(let i = 0; i + 9 <= tris.length; i += 9){
      const [a, b, c] = [[tris[i], tris[i + 1], tris[i + 2]], [tris[i + 3], tris[i + 4], tris[i + 5]], [tris[i + 6], tris[i + 7], tris[i + 8]]];
      const croix = vec.vect(moins(b, a), moins(c, a));
      if(Math.hypot(...croix) < 1e-9) continue;              // triangle plat : OpenCascade le refuserait
      faces.push(R.makeFace(R.assembleWire([R.makeLine(a, b), R.makeLine(b, c), R.makeLine(c, a)])));
    }
    if(!faces.length) throw new Error("ce maillage ne contient aucun triangle");
    const coque = R.weldShellsAndFaces(faces);
    /* makeSolid ne refuse pas une coquille ouverte : le maillage n'est un volume que si chaque arête sert deux fois. */
    const cle = (i) => [tris[i], tris[i + 1], tris[i + 2]].map(c => c.toFixed(4)).join();
    const compte = new Map();
    for(let i = 0; i + 9 <= tris.length; i += 9){
      const s = [cle(i), cle(i + 3), cle(i + 6)];
      s.forEach((a, k) => { const e = [a, s[(k + 1) % 3]].sort().join("|"); compte.set(e, (compte.get(e) || 0) + 1); });
    }
    if([...compte.values()].some(n => n !== 2)) return { forme:coque, solide:false };
    try{ return { forme:R.makeSolid(coque.faces), solide:true }; }catch(_){ return { forme:coque, solide:false }; }
  };

  /* ---------------- assemblage ---------------- */
  /** La rotation qui amène `de` sur `vers` : axe et angle (degrés), ou null si déjà alignés. */
  const rotationEntre = (de, vers) => {
    const c = Math.max(-1, Math.min(1, vec.scal(de, vers)));
    if(c > 0.9999999) return null;
    const axe = c < -0.9999999 ? vec.vect(de, Math.abs(de[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]) : vec.vect(de, vers);
    return { axe:vec.norm(axe), angle:Math.acos(c) / DEG };
  };
  const pose = (forme, op, v) => {
    let f = forme.clone();
    const c = f.boundingBox.center;
    for(const [axe, cle] of [[[1, 0, 0], "rx"], [[0, 1, 0], "ry"], [[0, 0, 1], "rz"]]){
      const a = v(op[cle] ?? 0);
      if(a) f = f.rotate(a, c, axe);
    }
    return f.translate([v(op.tx ?? 0), v(op.ty ?? 0), v(op.tz ?? 0)]);
  };

  /* ---------------- tôlerie ---------------- */
  const tolDe = (c) => { if(!c.tole) throw new Error(`« ${c.nom} » n'est pas une tôle (commencez par l'opération Tôle)`); return c.tole; };
  const noterPli = (etat, cible, forme, tole, plis) => ({ ...etat, corps:etat.corps.map(c => c === cible ? { ...c, shape:forme, tole:{ ...tole, plis:[...tole.plis, ...[].concat(plis)] } } : c) });
  /** Le profil d'un pli, dans le plan (o, n) : couronne de `theta`, plus un bord droit de longueur h. */
  const dessinPli = (R, e, r, theta, h) => {
    const P = (rr, phi) => [rr * Math.cos(phi), e + r + rr * Math.sin(phi)];
    const f0 = -Math.PI / 2, f1 = f0 + theta, fm = (f0 + f1) / 2;
    const O1 = P(r + e, f1), I1 = P(r, f1), t = [-Math.sin(f1), Math.cos(f1)];
    let pen = R.draw(P(r + e, f0)).threePointsArcTo(O1, P(r + e, fm));
    if(h > 0) pen = pen.lineTo([O1[0] + t[0] * h, O1[1] + t[1] * h]).lineTo([I1[0] + t[0] * h, I1[1] + t[1] * h]);
    return pen.lineTo(I1).threePointsArcTo(P(r, f0), P(r, fm)).close();
  };
  /** Un dessin (x vers o, y vers n) extrudé le long de la droite (A → A + u·L). */
  const extrudeSurDroite = (R, dessin, A, o, n, u, L) => {
    const normale = vec.vect(o, n);
    const sens = vec.scal(normale, u) >= 0;
    const origine = sens ? A : vec.ajout(A, u, L);
    return dessin.sketchOnPlane(new R.Plane(origine, o, normale)).extrude(L);
  };
  const bride = (R, etat, op, ctx, thetaDefaut) => {
    const { v } = ctx;
    const cible = corpsCible(etat, op.corps), t = tolDe(cible);
    if(!op.arete) throw new Error("arête à désigner");
    const a = designes(R, cible.shape, "aretes", [op.arete], op, ctx)[0];
    if(a.geomType !== "LINE") throw new Error("un bord tombé part d'une arête droite");
    const A0 = pt(a.startPoint), A1 = pt(a.endPoint), L = Math.hypot(...moins(A1, A0)), u = vec.norm(moins(A1, A0));
    if(Math.abs(vec.scal(u, t.n)) > 1e-6) throw new Error("désignez une arête du contour de la tôle, pas de son épaisseur");
    const e = t.ep, r = op.rayon ? v(op.rayon) : t.r, h = v(op.hauteur), theta = (thetaDefaut ?? v(op.angle)) * DEG;
    /* Une arête hors des deux peaux de la tôle plane (bord d'une aile, tôle déplacée) donnerait une aile détachée. */
    const z = vec.scal(A0, t.n);
    if(Math.abs(z - t.z0) > 1e-5 && Math.abs(z - t.z0 - e) > 1e-5) throw new Error("un bord tombé part d'une arête de la tôle plane, pas d'une aile déjà pliée");
    if(!(r > 0 && h > 0 && theta > 0 && theta < Math.PI + 1e-6)) throw new Error("rayon et hauteur positifs, angle entre 0 et 180°");
    /* o : vers l'extérieur de la tôle. n : le côté où l'on plie. A : sur la peau opposée à ce côté. */
    let o = vec.norm(vec.vect(u, t.n));
    /* L'extérieur se sonde : juste à côté de l'arête, à mi-épaisseur, dans la matière ou non (encoches, tôles en L). */
    const milieu = [(A0[0] + A1[0]) / 2, (A0[1] + A1[1]) / 2, (A0[2] + A1[2]) / 2];
    const sonde = vec.ajout(vec.ajout(milieu, t.n, t.z0 + e / 2 - z), o, Math.min(0.01, e / 10));
    if(dansMatiere(R, cible.shape, sonde)) o = o.map(c => -c);
    const bas = op.vers === "bas", n = bas ? t.n.map(c => -c) : t.n;
    const zPeau = bas ? t.z0 + e : t.z0;
    const A = vec.ajout(A0, t.n, zPeau - vec.scal(A0, t.n));
    const ba = theta * (r + t.k * e);
    const pli = { type:op.type, angle:theta / DEG, rayon:r, ba, longueur:L, A, o, u, n };
    ctx.note.pli = { angle:pli.angle, rayon:r, ba, longueur:L };
    if(ctx.plat){      // développé : une languette de la longueur dépliée, dans le plan de la tôle
      const dev = R.draw([0, 0]).lineTo([ba + h, 0]).lineTo([ba + h, e]).lineTo([0, e]).close();
      return noterPli(etat, cible, cible.shape.fuse(extrudeSurDroite(R, dev, A, o, n, u, L)), t, pli);
    }
    return noterPli(etat, cible, cible.shape.fuse(extrudeSurDroite(R, dessinPli(R, e, r, theta, h), A, o, n, u, L)), t, pli);
  };

  return {
    surfExtrusion(R, etat, op, ctx){
      const { v } = ctx, esq = chercherEsquisse(ctx, op.esquisse), oc = R.getOC();
      const r = repere(esq.plan, v), d = v(op.distance) * (op.inverse ? -1 : 1);
      if(!d) throw new Error("distance non nulle");
      return surface(etat, regrouper(R, filsEsquisse(R, esq, v).map(f =>
        construitPar(R, new oc.BRepPrimAPI_MakePrism(f.wrapped, new R.Vector(r.n.map(c => c * d)).wrapped, false, true)))));
    },
    surfRevolution(R, etat, op, ctx){
      const { v } = ctx, esq = chercherEsquisse(ctx, op.esquisse), oc = R.getOC();
      const r = repere(esq.plan, v), ax = R.makeAx1(r.o, op.axe === "x" ? r.x : r.y);
      return surface(etat, regrouper(R, filsEsquisse(R, esq, v).map(f =>
        construitPar(R, new oc.BRepPrimAPI_MakeRevol(f.wrapped, ax, v(op.angle ?? 360) * DEG, false)))));
    },
    surfBalayage(R, etat, op, ctx){
      const { v } = ctx, esq = chercherEsquisse(ctx, op.esquisse), chem = chercherEsquisse(ctx, op.chemin);
      const chemin = filsEsquisse(R, chem, v)[0];
      return surface(etat, regrouper(R, filsEsquisse(R, esq, v).map(f => R.genericSweep(f, chemin, { frenet:true }, true)[0])));
    },
    surfLissage(R, etat, op, ctx){
      const { v } = ctx, esqs = (op.esquisses || []).map(id => chercherEsquisse(ctx, id));
      if(esqs.length < 2) throw new Error("au moins deux esquisses, dans l'ordre du lissage");
      return surface(etat, R.loft(esqs.map(e => filsEsquisse(R, e, v)[0]), { ruled:!!op.regle }, true));
    },
    surfRemplissage(R, etat, op, ctx){
      const { v } = ctx;
      if(op.aretes?.length){       // un contour d'arêtes du modèle, plan ou non
        const toutes = etat.corps.flatMap(c => c.shape.edges);
        return surface(etat, enCoquille(R, R.makeNonPlanarFace(R.assembleWire(plusProches(R, toutes, op.aretes)))));
      }
      const esq = chercherEsquisse(ctx, op.esquisse);
      const s = dessinRegions(R, esq, op.contours).sketchOnPlane(planNoyau(R, esq, v).plan);
      if(!s.face) throw new Error("un remplissage d'esquisse prend un seul contour");
      return surface(etat, enCoquille(R, s.face()));
    },
    surfAjuster(R, etat, op){
      const cible = corpsCible(etat, op.corps), outil = etat.corps.find(c => c.nom === op.outil && c !== cible);
      if(!outil) throw new Error("corps qui coupe à choisir");
      if(outil.surface) throw new Error("l'outil doit être un volume : épaississez d'abord la surface qui coupe");
      return remplacer(etat, cible, op.garder === "dedans" ? cible.shape.intersect(outil.shape) : cible.shape.cut(outil.shape));
    },
    surfProlonger(R, etat, op, ctx){
      const { v } = ctx;
      const cible = corpsCible(etat, op.corps), d = v(op.distance), oc = R.getOC();
      if(!(d > 0)) throw new Error("distance positive");
      const faces = cible.shape.faces, ajouts = [];
      for(const a of designes(R, cible.shape, "aretes", op.aretes, op, ctx)){
        /* La face qui porte l'arête donne la direction : dans son plan tangent, à l'opposé de son centre. */
        const m = a.pointAt(0.5), mv = R.makeVertex(pt(m));
        const f = faces.reduce((p, q) => R.measureDistanceBetween(mv, q) < R.measureDistanceBetween(mv, p) ? q : p);
        const t = pt(a.tangentAt(0.5)), n = pt(f.normalAt(m));
        let dehors = vec.norm(vec.vect(t, n));
        if(vec.scal(dehors, moins(pt(m), pt(f.center))) < 0) dehors = dehors.map(c => -c);
        ajouts.push(construitPar(R, new oc.BRepPrimAPI_MakePrism(a.wrapped, new R.Vector(dehors.map(c => c * d)).wrapped, false, true)));
      }
      const morceaux = ajouts.flatMap(s => s.faces);
      return remplacer(etat, cible, R.weldShellsAndFaces([...faces, ...morceaux]));
    },
    surfCoudre(R, etat, op){
      const cible = corpsCible(etat, op.corps);
      const autres = (op.outils || []).map(n => etat.corps.find(c => c.nom === n && c !== cible));
      if(autres.some(c => !c)) throw new Error("une surface à coudre n'existe plus");
      const faces = [cible, ...autres].flatMap(c => c.shape.faces);
      let forme = R.weldShellsAndFaces(faces), solide = false;
      if(op.solide){ forme = R.makeSolid(faces); solide = true; }
      const suite = { ...etat, corps:etat.corps.filter(c => !autres.includes(c)).map(c => c === cible ? { ...c, shape:forme, surface:!solide } : c) };
      return suite;
    },
    surfDecaler(R, etat, op, { v }){
      const cible = corpsCible(etat, op.corps), oc = R.getOC(), m = new oc.BRepOffsetAPI_MakeOffsetShape();
      m.PerformBySimple(cible.shape.wrapped, v(op.distance));
      return surface(etat, construitPar(R, m));
    },
    surfEpaissir(R, etat, op, { v }){
      const cible = corpsCible(etat, op.corps), ep = v(op.epaisseur), oc = R.getOC();
      if(!(ep > 0)) throw new Error("épaisseur positive");
      const m = new oc.BRepOffsetAPI_MakeThickSolid();
      /* Un composé d'une seule face n'est pas accepté : on lui donne la face. */
      const f0 = cible.shape.faces;
      m.MakeThickSolidBySimple(f0.length === 1 ? f0[0].wrapped : cible.shape.wrapped, op.inverse ? -ep : ep);
      m.Build(new oc.Message_ProgressRange());
      let s = construitPar(R, m);
      /* Le noyau rend parfois un solide retourné, de volume négatif : les booléens suivants le refuseraient. */
      if(R.measureVolume(s) < 0) s = R.cast(s.wrapped.Reversed());
      return { ...etat, corps:etat.corps.map(c => c === cible ? { ...c, shape:s, surface:false } : c) };
    },

    async composant(R, etat, op, ctx){
      if(!op.donnees) throw new Error("pièce à insérer absente");
      const d = JSON.parse(op.donnees);
      if(!Array.isArray(d?.operations)) throw new Error("ce n'est pas une pièce du mode conception");
      const sous = await H.construire(R, d, [], ctx.oc);
      const corps = sous.corps.filter(c => !c.reference);
      const ko = d.operations.filter(o => sous.etats[o.id]?.erreur);
      if(!corps.length) throw new Error("cette pièce ne contient aucun corps" + (ko.length ? ` : « ${ko[0].nom} » ${sous.etats[ko[0].id].erreur}` : ""));
      /* Corps gardé, mais incomplet : on le dit (la suite de l'historique peut continuer). */
      if(ko.length) ctx.note.erreur = `pièce insérée incomplète : « ${ko[0].nom} » ${sous.etats[ko[0].id].erreur}`;
      return nouveauCorps(etat, pose(regrouper(R, corps.map(c => c.shape)), op, ctx.v), { composant:true });
    },
    ancrer(R, etat, op){
      const cible = corpsCible(etat, op.corps);
      return { ...etat, corps:etat.corps.map(c => c === cible ? { ...c, ancre:true } : c) };
    },
    liaison(R, etat, op, ctx){
      const { v } = ctx;
      const A = etat.corps.find(c => c.nom === op.corpsA), B = etat.corps.find(c => c.nom === op.corpsB);
      if(!A || !B || A === B) throw new Error("deux corps à relier : le fixe et le mobile");
      if(B.ancre) throw new Error(`« ${B.nom} » est ancré : c'est l'autre corps qui doit bouger`);
      const a = op.repereA;
      if(!a) throw new Error("une face à désigner sur chaque corps");
      const b = op.telleQuelle ? a : op.repereB;      // telle quelle : le corps reste où il est, seul son mouvement est décrit
      if(!b) throw new Error("une face à désigner sur chaque corps");
      const dA = vec.norm(a.axe || a.normale), dB = vec.norm(b.axe || b.normale);
      /* Deux plans se font face ; deux axes se superposent, au plus court. */
      const vers = a.axe && b.axe ? (vec.scal(dA, dB) < 0 ? dA.map(c => -c) : dA) : dA.map(c => -c);
      const spherique = op.mode === "spherique";     // une rotule : seuls les points se rejoignent, l'orientation reste libre
      const rot = op.telleQuelle || spherique ? null : rotationEntre(dB, vers);
      const dec = op.telleQuelle ? 0 : v(op.decalage ?? 0);
      const val = op.mode === "rigide" ? 0 : valeurLiaison(op, ctx);
      const val2 = v(op.valeur2 ?? 0), val3 = v(op.valeur3 ?? 0);
      let t = op.telleQuelle ? [0, 0, 0] : moins(a.point, b.point);
      t = vec.ajout(t, dA, dec);
      if(op.mode === "glissiere") t = vec.ajout(t, dA, val);
      if(op.mode === "cylindrique") t = vec.ajout(t, dA, val2);
      if(op.mode === "plan"){      // val et val2 glissent dans le plan ; val3 tourne autour de sa normale
        const u = axePerpendiculaire(dA), w = vec.vect(dA, u);
        t = vec.ajout(vec.ajout(t, u, val), w, val2);
      }
      const pivot = vec.ajout(a.point, dA, dec);
      const placer = (forme) => {
        let f = forme.clone();
        if(rot) f = f.rotate(rot.angle, b.point, rot.axe);
        f = f.translate(t);
        if((op.mode === "pivot" || op.mode === "cylindrique") && val) f = f.rotate(val, vec.ajout(pivot, dA, op.mode === "cylindrique" ? val2 : 0), dA);
        if(spherique) [[1, 0, 0], [0, 1, 0], [0, 0, 1]].forEach((ax, i) => { const a3 = [val, val2, val3][i]; if(a3) f = f.rotate(a3, pivot, ax); });
        if(op.mode === "plan" && val3) f = f.rotate(val3, vec.ajout(vec.ajout(pivot, axePerpendiculaire(dA), val), vec.vect(dA, axePerpendiculaire(dA)), val2), dA);
        return f;
      };
      /* Un groupe rigide : les corps suiveurs font exactement le même mouvement. */
      const suiveurs = new Set(op.suiveurs || []);
      if(suiveurs.has(A.nom)) throw new Error("le corps fixe ne peut pas suivre le mobile");
      return { ...etat, corps:etat.corps.map(c => c === B ? { ...c, shape:placer(c.shape) } : suiveurs.has(c.nom) ? { ...c, shape:placer(c.shape) } : c) };
    },

    tole(R, etat, op, ctx){
      const { v } = ctx, esq = chercherEsquisse(ctx, op.esquisse), r = repere(esq.plan, v);
      const ep = v(op.epaisseur);
      if(!(ep > 0)) throw new Error("épaisseur positive");
      const o = op.inverse ? vec.ajout(r.o, r.n, -ep) : r.o;
      const forme = dessinRegions(R, esq, op.contours).sketchOnPlane(new R.Plane(o, r.x, r.n)).extrude(ep);
      return nouveauCorps(etat, forme, { tole:{ ep, r:v(op.rayon), k:v(op.k), n:r.n, x:r.x, z0:vec.scal(o, r.n), plis:[] } });
    },
    /* Le chemin de bords tombés : le même pli sur chaque arête désignée, dans l'ordre. */
    brideChaine(R, etat, op, ctx){
      if(!op.aretes?.length) throw new Error("arêtes à désigner");
      const notes = [];
      let suite = etat;
      for(const arete of op.aretes){
        const une = { ...op, arete, refs:undefined };
        suite = bride(R, suite, une, ctx);
        notes.push(ctx.note.pli);
      }
      ctx.note.pli = { ...notes[0], longueur:notes.reduce((s, n) => s + n.longueur, 0) };
      return suite;
    },
    bride:(R, etat, op, ctx) => bride(R, etat, op, ctx),
    ourlet:(R, etat, op, ctx) => bride(R, etat, op, ctx, 180),
    pli(R, etat, op, ctx){
      const { v } = ctx, esq = chercherEsquisse(ctx, op.esquisse);
      const cible = corpsCible(etat, op.corps), t = tolDe(cible);
      const seg = profils(esq).ouverts[0]?.segments[0];
      if(seg?.type !== "ligne") throw new Error(`« ${esq.nom} » : une ligne ouverte marque le pli`);
      const re = repere(esq.plan, v), a = versMonde(re, ...seg.a), b = versMonde(re, ...seg.b);
      const u = vec.norm(moins(b, a));
      if(Math.abs(vec.scal(u, t.n)) > 1e-6) throw new Error("la ligne de pli doit être dans le plan de la tôle");
      const e = t.ep, r = op.rayon ? v(op.rayon) : t.r, theta = v(op.angle) * DEG;
      if(!(r > 0 && theta > 0 && theta < Math.PI + 1e-6)) throw new Error("rayon positif, angle entre 0 et 180°");
      let o = vec.norm(vec.vect(u, t.n));
      if(op.inverse) o = o.map(c => -c);
      const bas = op.vers === "bas", n = bas ? t.n.map(c => -c) : t.n;
      const P0 = vec.ajout(a, t.n, (bas ? t.z0 + e : t.z0) - vec.scal(a, t.n));
      const ba = theta * (r + t.k * e);
      const [mi, ma] = cible.shape.boundingBox.bounds, D = 2 * Math.hypot(ma[0] - mi[0], ma[1] - mi[1], ma[2] - mi[2]) + 10;
      /* Un demi-espace vrai (hauteur 2D) : limité à la tôle plane, il tronquerait les ailes déjà pliées. */
      const N = vec.vect(o, u);
      const dem = (x0, x1) => R.draw([x0, -D]).lineTo([x1, -D]).lineTo([x1, D]).lineTo([x0, D]).close()
        .sketchOnPlane(new R.Plane(vec.ajout(P0, N, -D), o, N)).extrude(2 * D);
      /* La bande à plier : son étendue réelle le long de la ligne, morceau par morceau (tôle en U, en L). */
      const bande = cible.shape.intersect(dem(-ba / 2, ba / 2));
      if(!bande.faces.length) throw new Error("la ligne de pli ne traverse pas la tôle");
      for(const f of bande.edges) for(const q of [f.startPoint, f.endPoint]){
        const dz = vec.scal(pt(q), t.n) - t.z0;
        if(dz < -1e-5 || dz > e + 1e-5) throw new Error("la ligne de pli doit être sur la partie plate de la tôle");
      }
      const morceaux = (bande.solids?.length ? bande.solids : [bande]).map(m => {
        const ts = m.edges.flatMap(f => [f.startPoint, f.endPoint]).map(q => vec.scal(moins(pt(q), P0), u));
        return { debut:Math.min(...ts), L:Math.max(...ts) - Math.min(...ts) };
      });
      const total = morceaux.reduce((x, m) => x + m.L, 0);
      ctx.note.pli = { angle:theta / DEG, rayon:r, ba, longueur:total };
      const traces = morceaux.map(m => ({ type:"pli", angle:theta / DEG, rayon:r, ba, A:vec.ajout(vec.ajout(P0, o, -ba / 2), u, m.debut), o, u, n, longueur:m.L }));
      if(ctx.plat) return noterPli(etat, cible, cible.shape, t, traces);
      const fixe = cible.shape.intersect(dem(-D, -ba / 2));
      const mobile = cible.shape.intersect(dem(ba / 2, D));
      if(!fixe.faces.length || !mobile.faces.length) throw new Error("la ligne de pli doit laisser de la tôle des deux côtés");
      /* Le morceau mobile recule de ba, puis tourne autour de l'axe du pli. */
      const C = vec.ajout(vec.ajout(P0, o, -ba / 2), n, e + r);
      const axe = vec.vect(o, n);
      const tourne = mobile.clone().translate(o.map(c => -c * ba)).rotate(theta / DEG, C, axe);
      /* shortcut: une ligne non perpendiculaire aux bords (coin diagonal) garde une couronne à bouts droits ;
         couper la couronne selon le bord demanderait de replier ce bord dans le noyau */
      let forme = fixe;
      for(const m of morceaux) forme = forme.fuse(extrudeSurDroite(R, dessinPli(R, e, r, theta, 0), vec.ajout(vec.ajout(P0, o, -ba / 2), u, m.debut), o, n, u, m.L));
      return noterPli(etat, cible, forme.fuse(tourne), t, traces);
    },

    profile(R, etat, op, ctx){
      const { v } = ctx, esq = chercherEsquisse(ctx, op.esquisse), re = repere(esq.plan, v);
      const { ouverts, faces } = profils(esq);
      const chaines = [...ouverts.map(o => ({ s:o.segments, ferme:false })), ...faces.filter(f => f.exterieur.segments).map(f => ({ s:f.exterieur.segments, ferme:true }))];
      if(!chaines.length) throw new Error(`« ${esq.nom} » : des lignes tracent l'ossature`);
      const ipe = op.section === "ipe" ? PROFILS_IPE[op.norme] : null;
      if(op.section === "ipe" && !ipe) throw new Error("taille de poutre à choisir");
      const a = ipe ? ipe.h : v(op.a), b = ipe ? ipe.b : v(op.b ?? op.a), ep = ipe ? 0 : v(op.ep ?? 0);
      if(!(a > 0 && b > 0)) throw new Error("dimensions positives");
      if(ep < 0 || (op.section !== "plat" && op.section !== "corniere" && 2 * ep >= (op.section === "rond" ? a : Math.min(a, b)))) throw new Error("paroi trop épaisse pour cette section");
      const section = () => {
        if(ipe){      // a : hauteur, hors du plan de l'esquisse ; b : largeur des ailes. Les rayons de raccord sont omis.
          const [h, l, tw, tf] = [ipe.h / 2, ipe.b / 2, ipe.tw / 2, ipe.tf];
          return R.draw([-h, -l]).lineTo([-h, l]).lineTo([-h + tf, l]).lineTo([-h + tf, tw]).lineTo([h - tf, tw]).lineTo([h - tf, l]).lineTo([h, l]).lineTo([h, -l])
            .lineTo([h - tf, -l]).lineTo([h - tf, -tw]).lineTo([-h + tf, -tw]).lineTo([-h + tf, -l]).close();
        }
        if(op.section === "rond"){
          const d = R.drawCircle(a / 2);
          return ep > 0 ? d.cut(R.drawCircle(a / 2 - ep)) : d;
        }
        if(op.section === "corniere"){
          if(!(ep > 0 && ep < a && ep < b)) throw new Error("une cornière a une épaisseur plus petite que ses ailes");
          return R.draw([-a / 2, -b / 2]).lineTo([a / 2, -b / 2]).lineTo([a / 2, -b / 2 + ep]).lineTo([-a / 2 + ep, -b / 2 + ep]).lineTo([-a / 2 + ep, b / 2]).lineTo([-a / 2, b / 2]).close();
        }
        const d = R.drawRectangle(a, b);
        return op.section !== "plat" && ep > 0 ? d.cut(R.drawRectangle(a - 2 * ep, b - 2 * ep)) : d;
      };
      const D = 4 * Math.max(a, b);
      let suite = etat, joint = null;
      const debit = [];
      for(const { s, ferme } of chaines){
        if(s.some(x => x.type !== "ligne")) throw new Error("un profilé suit des lignes droites");
        const W = s.map(x => ({ a:versMonde(re, ...x.a), b:versMonde(re, ...x.b) }));
        W.forEach((w, i) => { w.d = vec.norm(moins(w.b, w.a)); w.L = Math.hypot(...moins(w.b, w.a)); });
        W.forEach((w, i) => {
          const avant = i > 0 ? W[i - 1] : ferme ? W[W.length - 1] : null, apres = i < W.length - 1 ? W[i + 1] : ferme ? W[0] : null;
          const onglet = op.joint !== "droit";
          const prol0 = avant && onglet ? D : 0, prol1 = apres && onglet ? D : 0;
          const depart = vec.ajout(w.a, w.d, -prol0);
          let f = section().sketchOnPlane(new R.Plane(depart, re.n, w.d)).extrude(w.L + prol0 + prol1);
          /* Onglet : chaque barre s'arrête sur le plan bissecteur de son coin. */
          const couper = (P, nb) => R.drawRectangle(4 * D, 4 * D).sketchOnPlane(new R.Plane(P, vec.vect(nb, re.n), nb)).extrude(4 * D);
          if(apres && onglet) f = f.cut(couper(w.b, vec.norm(vec.ajout(w.d, apres.d))));
          if(avant && onglet) f = f.cut(couper(w.a, vec.norm(vec.ajout(w.d, avant.d)).map(c => -c)));
          debit.push({ section:op.section, longueur:w.L });
          if(op.fusion) joint = joint ? joint.fuse(f) : f;
          else suite = nouveauCorps(suite, f);
        });
      }
      ctx.note.debit = debit;
      return op.fusion ? nouveauCorps(suite, joint) : suite;
    },

    vis(R, etat, op, { v }){
      const t = VISSERIE[op.norme];
      if(!t) throw new Error("taille à choisir");
      const L = v(op.longueur ?? 0), o = [v(op.x ?? 0), v(op.y ?? 0), v(op.z ?? 0)];
      const tour = (pts) => H.revolutionProfil(R, pts);
      const prisme = (s, h, z = 0) => R.drawPolysides(s / Math.sqrt(3), 6).sketchOnPlane("XY", z).extrude(h);
      let f;
      if(op.modele === "ecrou") f = prisme(t.sh, t.m).cut(R.makeCylinder(t.d / 2 * 0.85, t.m));
      else if(op.modele === "rondelle") f = tour([[t.d1 / 2, 0], [t.d2 / 2, 0], [t.d2 / 2, t.h], [t.d1 / 2, t.h]]);
      else{
        if(!(L > 0)) throw new Error("longueur positive");
        const tige = R.makeCylinder(t.d / 2, L, [0, 0, -L]);
        if(op.modele === "hexa") f = prisme(t.sh, t.kh).fuse(tige);
        else f = R.makeCylinder(t.dk / 2, t.k).fuse(tige).cut(prisme(t.s, t.k / 2 + 0.01, t.k / 2));
      }
      return nouveauCorps(etat, f.translate(o));
    },

    /* Une occurrence : les corps d'un composant, recopiés et posés ; elle suit le composant. */
    occurrence(R, etat, op, ctx){
      const corps = etat.corps.filter(c => c.composant === op.source && !c.occurrence);
      if(!corps.length) throw new Error("ce composant n'a encore aucun corps");
      return corps.reduce((s, c) => nouveauCorps(s, pose(c.shape, op, ctx.v), { composant:op.composant, occurrence:op.source }), etat);
    },

    maillage(R, etat, op){
      if(!op.donnees) throw new Error("maillage absent");
      const octets = Uint8Array.from(atob(op.donnees), c => c.charCodeAt(0));
      const tris = new Float32Array(octets.buffer);
      const n = tris.length / 9;
      if(n > 5000) throw new Error(`maillage de ${n} triangles : 5000 au plus pour en faire un corps ; ouvrez-le dans la visionneuse`);
      const { forme, solide } = polyedre(R, [...tris]);
      /* Convertir : les triangles d'une même face plane n'en font plus qu'une. */
      const finale = op.fusionner && solide ? forme.simplify() : forme;
      return nouveauCorps(etat, finale, { reference:!!op.reference, surface:!solide });
    },

    /**
     * Le filetage modélisé (pour imprimer) : le sillon hélicoïdal enlevé du cylindre. Un balayage sur toute la
     * longueur fait échouer le booléen du noyau : on calcule une seule tranche d'un pas, et on l'empile par copies.
     * Sans `modele`, il reste cosmétique : dessiné par la page, rien dans le volume.
     */
    filetage(R, etat, op, ctx){
      if(!op.modele) return etat;
      if(!op.cylindre?.surf) throw new Error("face cylindrique à désigner");
      const cible = corpsCible(etat, op.corps);
      const f = designes(R, cible.shape, "faces", [op.cylindre.surf], op, ctx)[0];
      if(f.geomType !== "CYLINDRE") throw new Error("le filetage se pose sur une face cylindrique entière");
      /* Le cylindre lui-même : le centre d'une face n'est sur l'axe que si elle est entière et symétrique
         (un cercle extrudé donne deux demi-cylindres, un méplat décentre tout), et l'axe suit la pièce. */
      const surf = new (R.getOC().BRepAdaptor_Surface)(f.wrapped, false), cyl = surf.Cylinder(), ax = cyl.Axis();
      const lieu = ax.Location(), dir = ax.Direction();
      const c = [lieu.X(), lieu.Y(), lieu.Z()], axe = vec.norm([dir.X(), dir.Y(), dir.Z()]), r = cyl.Radius();
      const ts = f.edges.flatMap(e => [e.startPoint, e.endPoint]).map(q => vec.scal(moins(pt(q), c), axe));
      const t0 = Math.min(...ts), L = Math.max(...ts) - t0;
      if(!(L > 0)) throw new Error("face cylindrique sans hauteur");
      const s0 = pt(f.pointOnSurface(0.5, 0.5)), m = moins(s0, c), z = vec.scal(m, axe);
      const rad = vec.ajout(m, axe, -z), radial = vec.norm(rad), s = s0;
      const interne = dansMatiere(R, cible.shape, vec.ajout(s, radial, 0.05));
      const tailles = Object.entries(VISSERIE);
      const taille = op.taille ? VISSERIE[op.taille]
        : tailles.reduce((a, b) => Math.abs((interne ? b[1].d - b[1].p : b[1].d) - 2 * r) < Math.abs((interne ? a[1].d - a[1].p : a[1].d) - 2 * r) ? b : a)[1];
      if(Math.abs((interne ? taille.d - taille.p : taille.d) - 2 * r) > 0.5) throw new Error(`ce cylindre de ⌀${(2 * r).toFixed(2)} ne convient pas à un M${taille.d}`);
      const P = taille.p, h = 0.6134 * P, jeu = ctx.v(op.jeu ?? 0);
      const prof = h + jeu + 0.05, sens = interne ? 1 : -1, rBase = r - sens * 0.05;
      const ri = interne ? r - 0.1 : r - prof - 0.05, re = interne ? r + prof + 0.1 : r + 0.2;
      const helice = R.assembleWire([R.makeHelix(P, 3 * P, rBase, [0, 0, -P], [0, 0, 1])]);
      const dent = R.draw([rBase, -P - P * 0.45]).lineTo([rBase, -P + P * 0.45]).lineTo([rBase + sens * prof, -P]).close()
        .sketchOnPlane(new R.Plane([0, 0, 0], [1, 0, 0], [0, -1, 0]));
      const anneau = R.makeCylinder(re, P).cut(R.makeCylinder(ri, P));
      const tranche = anneau.intersect(R.genericSweep(dent.wire, helice, { frenet:true }));
      const n = Math.ceil(L / P - 1e-6), copies = [];
      for(let i = 0; i < n; i++){
        /* La dernière tranche s'arrête au bout du cylindre : un trou borgne ne se creuse pas plus loin que son fond. */
        const reste = L - i * P;
        const t = reste < P - 1e-6 ? tranche.intersect(R.makeCylinder(re + 1, reste)) : tranche.clone();
        copies.push(H.orienter(t.translate([0, 0, i * P]), axe, vec.ajout(c, axe, t0)));
      }
      return remplacer(etat, cible, cible.shape.cut(R.makeCompound(copies)));
    },
    /* Rien dans le volume : axes, points et images sont dessinés par la page. */
    axe:(R, etat) => etat, point:(R, etat) => etat, image:(R, etat) => etat,
  };
}
