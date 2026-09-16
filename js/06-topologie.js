/* =============================================================================
   Visionneuse 3D — 06-topologie.js
   Retrouver les arêtes et les faces sous le tas de triangles.

   Une carte graphique ne connaît que des triangles. Le mécanicien, lui, mesure
   des entraxes entre deux perçages, une épaisseur entre deux plans, un jeu
   entre deux alésages : des arêtes et des faces, jamais des facettes. Ce
   module fait le chemin inverse de la triangulation.

   Deux sources, par ordre de préférence :

   · Les fichiers de CAO passés par OpenCascade portent leurs faces B-Rep —
     pour chaque face du modèle d'origine, l'intervalle de triangles qui en est
     sorti. C'est la vérité topologique, et elle sait ce que la géométrie seule
     ignore : qu'un cylindre coupé en deux par sa couture reste un cylindre,
     qu'un congé tangent à un plan est bien une face à part entière.

   · Les formats de maillage — STL, OBJ, 3MF — n'ont rien de tel. On reconstruit
     alors les faces par propagation : on part d'un triangle et on s'étend tant
     que le pli avec le voisin reste doux — exactement le critère qui dessine
     les arêtes vives à l'écran. Ce n'est pas la topologie d'origine, mais c'est
     ce que l'œil appelle une face, et c'est tout ce qu'on peut honnêtement
     tirer d'un fichier qui ne la porte pas.

   Les arêtes viennent ensuite, et presque gratuitement : une arête, c'est la
   frontière entre deux faces. On regroupe les segments qui séparent le même
   couple de faces, on les enchaîne, puis on demande à la géométrie ce qu'elle
   est — un segment de droite, un cercle, ou rien qui porte un nom.

   Rien n'est calculé à l'ouverture du fichier : l'analyse d'une pièce se fait
   au premier clic qui la vise, et se garde sur sa géométrie.
   ============================================================================= */
"use strict";

import * as THREE from "three";
import { prefs } from "./00-config.js";

/* Au-delà, l'analyse coûterait plus qu'un clic ne peut prendre : on le dit
   plutôt que de figer la page une demi-minute. */
export const PLAFOND_TRIANGLES = 400_000;

/* Tolérances relatives à la diagonale de la pièce : une cote juste sur une
   équerre de 20 mm et sur un châssis de 4 m ne se juge pas au même micron. */
const TOL_FORME = 2e-3;      // écart admis pour reconnaître une forme
const TOL_SOUDURE = 1e-6;    // en deçà, deux sommets sont le même

/* =============================================================================
   Algèbre : ajuster une droite, un cercle, un plan, un cylindre
   ========================================================================== */

/**
 * Valeurs et vecteurs propres d'une matrice 3×3 symétrique, par rotations de
 * Jacobi. Trente lignes qui servent partout ici : la normale d'un plan, le
 * plan porteur d'un cercle et l'axe d'un cylindre sont tous le vecteur propre
 * de plus petite valeur d'une matrice de covariance — celle des points pour
 * les deux premiers, celle des normales pour le troisième.
 *
 * Renvoie les trois couples triés par valeur propre croissante.
 */
export function proprer(m){
  const a = [m[0].slice(), m[1].slice(), m[2].slice()];
  const v = [[1,0,0],[0,1,0],[0,0,1]];

  for(let tour = 0; tour < 24; tour++){
    /* On annule à chaque tour le plus gros terme hors diagonale : c'est ce qui
       fait converger Jacobi en quelques passes sur une matrice 3×3. */
    let p = 0, q = 1, max = Math.abs(a[0][1]);
    if(Math.abs(a[0][2]) > max){ max = Math.abs(a[0][2]); p = 0; q = 2; }
    if(Math.abs(a[1][2]) > max){ max = Math.abs(a[1][2]); p = 1; q = 2; }
    if(max < 1e-20) break;

    const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
    const t = (theta >= 0 ? 1 : -1) / (Math.abs(theta) + Math.sqrt(theta*theta + 1));
    const c = 1 / Math.sqrt(t*t + 1), s = t * c;
    const app = a[p][p], aqq = a[q][q], apq = a[p][q];

    a[p][p] = c*c*app - 2*s*c*apq + s*s*aqq;
    a[q][q] = s*s*app + 2*s*c*apq + c*c*aqq;
    a[p][q] = a[q][p] = 0;

    for(let r = 0; r < 3; r++){
      if(r !== p && r !== q){
        const arp = a[r][p], arq = a[r][q];
        a[r][p] = a[p][r] = c*arp - s*arq;
        a[r][q] = a[q][r] = s*arp + c*arq;
      }
      const vrp = v[r][p], vrq = v[r][q];
      v[r][p] = c*vrp - s*vrq;
      v[r][q] = s*vrp + c*vrq;
    }
  }

  return [0,1,2]
    .map(i => ({ valeur:a[i][i], vecteur:new THREE.Vector3(v[0][i], v[1][i], v[2][i]).normalize() }))
    .sort((x, y) => x.valeur - y.valeur);
}

/** Covariance d'un nuage de points, éventuellement pondérée. */
function covariance(points, centre, poids = null){
  const m = [[0,0,0],[0,0,0],[0,0,0]];
  for(let i = 0; i < points.length; i++){
    const w = poids ? poids[i] : 1;
    const x = points[i].x - centre.x, y = points[i].y - centre.y, z = points[i].z - centre.z;
    m[0][0] += w*x*x; m[0][1] += w*x*y; m[0][2] += w*x*z;
    m[1][1] += w*y*y; m[1][2] += w*y*z; m[2][2] += w*z*z;
  }
  m[1][0] = m[0][1]; m[2][0] = m[0][2]; m[2][1] = m[1][2];
  return m;
}

function barycentre(points, poids = null){
  const c = new THREE.Vector3();
  let total = 0;
  for(let i = 0; i < points.length; i++){
    const w = poids ? poids[i] : 1;
    c.addScaledVector(points[i], w);
    total += w;
  }
  return total > 1e-20 ? c.divideScalar(total) : c;
}

/** Résolution d'un système 3×3 par pivot de Gauss. `null` si la matrice est plate. */
function resoudre3(A, b){
  const m = [[A[0][0],A[0][1],A[0][2],b[0]],
             [A[1][0],A[1][1],A[1][2],b[1]],
             [A[2][0],A[2][1],A[2][2],b[2]]];
  for(let col = 0; col < 3; col++){
    let pivot = col;
    for(let r = col + 1; r < 3; r++) if(Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
    if(Math.abs(m[pivot][col]) < 1e-14) return null;
    const echange = m[col]; m[col] = m[pivot]; m[pivot] = echange;
    for(let r = 0; r < 3; r++){
      if(r === col) continue;
      const f = m[r][col] / m[col][col];
      for(let k = col; k < 4; k++) m[r][k] -= f * m[col][k];
    }
  }
  return [m[0][3]/m[0][0], m[1][3]/m[1][1], m[2][3]/m[2][2]];
}

/**
 * Cercle des moindres carrés dans un plan donné (méthode de Kåsa : on ajuste
 * x² + y² + Dx + Ey + F = 0, qui a le bon goût d'être linéaire en D, E, F).
 * L'astuce coûte un léger biais vers les grands rayons sur un arc très court ;
 * sur une arête de perçage, qui fait le tour complet ou la moitié, il ne se
 * voit pas.
 */
function cerclePlan(points, origine, u, w){
  const n = points.length;
  let Sx=0, Sy=0, Sxx=0, Syy=0, Sxy=0, Sxz=0, Syz=0, Sz=0;
  const xs = new Float64Array(n), ys = new Float64Array(n);
  const d = new THREE.Vector3();

  for(let i = 0; i < n; i++){
    d.subVectors(points[i], origine);
    const x = d.dot(u), y = d.dot(w), z = x*x + y*y;
    xs[i] = x; ys[i] = y;
    Sx += x; Sy += y; Sz += z;
    Sxx += x*x; Syy += y*y; Sxy += x*y;
    Sxz += x*z; Syz += y*z;
  }
  const sol = resoudre3([[Sxx,Sxy,Sx],[Sxy,Syy,Sy],[Sx,Sy,n]], [-Sxz,-Syz,-Sz]);
  if(!sol) return null;
  const cx = -sol[0]/2, cy = -sol[1]/2;
  const r2 = cx*cx + cy*cy - sol[2];
  if(!(r2 > 0)) return null;
  const rayon = Math.sqrt(r2);

  let ecart = 0;
  for(let i = 0; i < n; i++) ecart = Math.max(ecart, Math.abs(Math.hypot(xs[i] - cx, ys[i] - cy) - rayon));

  return { centre:origine.clone().addScaledVector(u, cx).addScaledVector(w, cy),
           rayon, ecart, xs, ys, cx, cy };
}

/** Un repère orthonormé quelconque dont `n` est le troisième axe. */
function repere(n){
  const u = Math.abs(n.x) < 0.9 ? new THREE.Vector3(1,0,0) : new THREE.Vector3(0,1,0);
  u.crossVectors(n, u).normalize();
  return { u, w:new THREE.Vector3().crossVectors(n, u).normalize() };
}

/* =============================================================================
   Reconnaissance des formes
   ========================================================================== */

/**
 * Que raconte cette suite de points ? Une droite si elle ne s'écarte pas de sa
 * corde, un cercle si elle tient sur un cercle ajusté, sinon rien de nommable.
 * L'ordre compte : une polyligne parfaitement droite passerait aussi le test
 * du cercle, avec un rayon absurde.
 */
export function formeChaine(pts, tol){
  const n = pts.length;
  const ferme = n > 2 && pts[0].distanceTo(pts[n-1]) < tol;
  let longueur = 0;
  for(let i = 1; i < n; i++) longueur += pts[i].distanceTo(pts[i-1]);

  if(n >= 2 && !ferme){
    const a = pts[0], b = pts[n-1];
    const dir = new THREE.Vector3().subVectors(b, a);
    const corde = dir.length();
    if(corde > tol){
      dir.divideScalar(corde);
      let ecart = 0;
      const v = new THREE.Vector3(), proj = new THREE.Vector3();
      for(const p of pts){
        v.subVectors(p, a);
        proj.copy(dir).multiplyScalar(v.dot(dir));
        ecart = Math.max(ecart, v.sub(proj).length());
      }
      if(ecart < tol){
        return { type:"droite", a:a.clone(), b:b.clone(), dir,
                 longueur:corde, milieu:a.clone().lerp(b, 0.5) };
      }
    }
  }

  if(n >= 4){
    const centre0 = barycentre(pts);
    const axes = proprer(covariance(pts, centre0));
    const normale = axes[0].vecteur;                 // normale du plan porteur
    /* Un cercle est plat : si le nuage s'épaissit dans sa troisième direction,
       inutile d'aller plus loin. */
    if(Math.sqrt(axes[0].valeur / n) < tol){
      const { u, w } = repere(normale);
      const c = cerclePlan(pts, centre0, u, w);
      if(c && c.ecart < tol && c.rayon > tol){
        /* Angle balayé : c'est ce qui distingue un perçage d'un simple arc. */
        let mini = Infinity, maxi = -Infinity;
        for(let i = 0; i < n; i++){
          const t = Math.atan2(c.ys[i] - c.cy, c.xs[i] - c.cx);
          mini = Math.min(mini, t); maxi = Math.max(maxi, t);
        }
        return { type:"cercle", centre:c.centre, normale, rayon:c.rayon, ferme,
                 balaye: ferme ? 2*Math.PI : Math.min(2*Math.PI, maxi - mini),
                 longueur, milieu:pts[Math.floor(n/2)].clone() };
      }
    }
  }

  return { type:"polyligne", longueur, milieu:pts[Math.floor(n/2)].clone() };
}

/**
 * Et cette nappe de triangles ? Un plan si tous ses sommets y tiennent ; un
 * cylindre si toutes ses normales sont perpendiculaires à un même axe — ce qui
 * se lit directement sur la covariance des normales, dont le vecteur propre de
 * plus petite valeur donne l'axe. Sinon : une surface qu'on ne saura pas
 * nommer — sphère, tore, carreau gauche — et qu'on mesurera de proche en
 * proche, sur le maillage.
 */
export function formeNappe(sommets, normales, aires, tol){
  const centre = barycentre(sommets);

  /* ---- plan ---- */
  const axes = proprer(covariance(sommets, centre));
  const normale = axes[0].vecteur;
  let ecartPlan = 0;
  const v = new THREE.Vector3();
  for(const p of sommets) ecartPlan = Math.max(ecartPlan, Math.abs(v.subVectors(p, centre).dot(normale)));
  if(ecartPlan < tol){
    /* On oriente la normale comme la matière, c'est-à-dire comme les triangles,
       dont le sens vient du fichier : une épaisseur mesurée à l'envers change
       de signe, et le texte annoncerait un décalage là où il y a de la tôle. */
    if(barycentre(normales, aires).dot(normale) < 0) normale.negate();
    return { type:"plan", centre, normale };
  }

  /* ---- cylindre ---- */
  if(normales.length >= 6){
    const axe = proprer(covariance(normales, new THREE.Vector3(0,0,0), aires))[0].vecteur;
    const { u, w } = repere(axe);
    const c = cerclePlan(sommets, centre, u, w);
    if(c && c.ecart < tol && c.rayon > tol){
      let mini = Infinity, maxi = -Infinity;
      for(const p of sommets){
        const t = v.subVectors(p, c.centre).dot(axe);
        mini = Math.min(mini, t); maxi = Math.max(maxi, t);
      }
      return { type:"cylindre", axe, rayon:c.rayon, hauteur:maxi - mini,
               point:c.centre, centre:c.centre.clone().addScaledVector(axe, (mini + maxi) / 2) };
    }
  }

  return { type:"quelconque", centre };
}

/* =============================================================================
   Analyse d'un maillage
   ========================================================================== */

/**
 * Soudure des sommets confondus. Indispensable : OpenCascade triangule chaque
 * face séparément, si bien que les deux côtés d'une arête ne partagent aucun
 * indice. Sans soudure, un modèle n'est qu'une poussière de triangles isolés —
 * ni voisinage, ni face, ni arête.
 *
 * On range les sommets dans une grille au pas de la tolérance, en n'allant
 * voir la case voisine que lorsqu'on en frôle le bord : c'est ce qui évite à
 * deux sommets confondus de se manquer parce qu'ils sont tombés de part et
 * d'autre d'une frontière de case.
 */
function souder(pos, pas){
  const cases = new Map();
  const vers = new Int32Array(pos.count);
  const xs = [], ys = [], zs = [];
  const tol2 = (pas * 0.5) ** 2;
  const hacher = (i, j, k) => ((i * 73856093) ^ (j * 19349663) ^ (k * 83492791)) >>> 0;
  const zero = [0];

  for(let n = 0; n < pos.count; n++){
    const x = pos.getX(n), y = pos.getY(n), z = pos.getZ(n);
    const gx = x/pas, gy = y/pas, gz = z/pas;
    const i = Math.floor(gx), j = Math.floor(gy), k = Math.floor(gz);
    const di = gx - i < 0.25 ? -1 : gx - i > 0.75 ? 1 : 0;
    const dj = gy - j < 0.25 ? -1 : gy - j > 0.75 ? 1 : 0;
    const dk = gz - k < 0.25 ? -1 : gz - k > 0.75 ? 1 : 0;

    let trouve = -1;
    boucle:
    for(const a of (di ? [0, di] : zero)){
      for(const b of (dj ? [0, dj] : zero)){
        for(const c of (dk ? [0, dk] : zero)){
          const seau = cases.get(hacher(i + a, j + b, k + c));
          if(!seau) continue;
          for(const s of seau){
            if((xs[s]-x)**2 + (ys[s]-y)**2 + (zs[s]-z)**2 <= tol2){ trouve = s; break boucle; }
          }
        }
      }
    }

    if(trouve < 0){
      trouve = xs.length;
      xs.push(x); ys.push(y); zs.push(z);
      const cle = hacher(i, j, k);
      const seau = cases.get(cle);
      if(seau) seau.push(trouve); else cases.set(cle, [trouve]);
    }
    vers[n] = trouve;
  }
  return { vers, xs:Float64Array.from(xs), ys:Float64Array.from(ys), zs:Float64Array.from(zs) };
}

/** Régions issues des faces B-Rep, si OpenCascade nous les a laissées. */
function regionsBrep(geo, nbTri){
  const plages = geo.userData.facesBrep;
  if(!plages || !plages.length) return null;
  const region = new Int32Array(nbTri).fill(-1);
  for(let f = 0; f < plages.length; f++){
    const premier = plages[f][0], dernier = Math.min(plages[f][1], nbTri - 1);
    for(let t = premier; t <= dernier; t++) region[t] = f;
  }
  /* Une couverture partielle voudrait dire que la correspondance triangles ↔
     faces n'est pas celle qu'on croit. Mieux vaut la propagation, dont on
     connaît exactement le comportement, qu'une topologie à moitié juste. */
  for(let t = 0; t < nbTri; t++) if(region[t] < 0) return null;
  return { region, nb:plages.length };
}

/** Régions par propagation, arrêtée sur les plis vifs. */
function regionsPropagees(nbTri, voisins, normales, cosSeuil){
  const region = new Int32Array(nbTri).fill(-1);
  const pile = [];
  let nb = 0;
  for(let depart = 0; depart < nbTri; depart++){
    if(region[depart] >= 0) continue;
    region[depart] = nb;
    pile.push(depart);
    while(pile.length){
      const t = pile.pop();
      for(let c = 0; c < 3; c++){
        const u = voisins[t*3 + c];
        if(u < 0 || region[u] >= 0) continue;
        const cos = normales[t*3]*normales[u*3] + normales[t*3+1]*normales[u*3+1]
                  + normales[t*3+2]*normales[u*3+2];
        if(cos < cosSeuil) continue;
        region[u] = nb;
        pile.push(u);
      }
    }
    nb++;
  }
  return { region, nb };
}

/**
 * Enchaîne un paquet de segments en polylignes. Les segments d'une même arête
 * arrivent dans le désordre : on les recoud par leurs extrémités, en partant
 * d'un bout libre quand il y en a un, de n'importe où quand l'arête est un
 * contour fermé.
 */
function enchainer(segments, pointDe){
  const voisinage = new Map();
  const relier = (v, s) => { const l = voisinage.get(v); if(l) l.push(s); else voisinage.set(v, [s]); };
  segments.forEach((s, i) => { relier(s[0], i); relier(s[1], i); });

  const vus = new Uint8Array(segments.length);
  const chaines = [];

  const parcourir = (depart) => {
    const pts = [depart];
    let courant = depart;
    for(;;){
      const suite = (voisinage.get(courant) || []).find(i => !vus[i]);
      if(suite === undefined) break;
      vus[suite] = 1;
      const s = segments[suite];
      courant = s[0] === courant ? s[1] : s[0];
      pts.push(courant);
    }
    if(pts.length >= 2) chaines.push(pts.map(pointDe));
  };

  /* Les bouts libres d'abord : ils disent où commencent les chaînes ouvertes.
     Partir du milieu d'une arête la livrerait coupée en deux morceaux. Ce qui
     reste ensuite ne peut plus être que des boucles. */
  for(const [v, l] of voisinage) if(l.length === 1 && !vus[l[0]]) parcourir(v);
  for(let i = 0; i < segments.length; i++) if(!vus[i]) parcourir(segments[i][0]);

  return chaines;
}

/**
 * L'analyse complète d'une pièce, gardée sur sa géométrie : sommets soudés,
 * voisinage des triangles, régions, chaînes d'arêtes. `null` si la pièce est
 * trop lourde pour qu'on s'y risque sur un clic.
 */
export function analyser(maillage){
  const geo = maillage?.geometry;
  if(!geo) return null;
  if(geo.userData.topo !== undefined) return geo.userData.topo;

  const pos = geo.attributes.position;
  const idx = geo.index;
  const nbTri = Math.floor((idx ? idx.count : pos.count) / 3);
  if(!nbTri || nbTri > PLAFOND_TRIANGLES){
    geo.userData.topo = null;
    return null;
  }
  const sommetsTri = idx ? (t, k) => idx.getX(t*3 + k) : (t, k) => t*3 + k;

  if(!geo.boundingBox) geo.computeBoundingBox();
  const diagonale = geo.boundingBox.getSize(new THREE.Vector3()).length() || 1;

  /* ---------------- soudure et voisinage ---------------- */
  const { vers, xs, ys, zs } = souder(pos, Math.max(diagonale * TOL_SOUDURE, 1e-9));
  const nbSommets = xs.length;
  const pointDe = (i) => new THREE.Vector3(xs[i], ys[i], zs[i]);

  /* Chaque arête du maillage, sous la clé du couple de sommets soudés qu'elle
     joint. Deux triangles au plus dans les cas sains ; on garde la liste telle
     quelle pour les maillages non manifolds, qui existent aussi. */
  const aretes = new Map();
  const cleArete = (a, b) => (a < b ? a * nbSommets + b : b * nbSommets + a);
  const trio = [0, 0, 0];
  for(let t = 0; t < nbTri; t++){
    trio[0] = vers[sommetsTri(t,0)]; trio[1] = vers[sommetsTri(t,1)]; trio[2] = vers[sommetsTri(t,2)];
    for(let c = 0; c < 3; c++){
      const cle = cleArete(trio[c], trio[(c+1) % 3]);
      const l = aretes.get(cle);
      if(l) l.push(t); else aretes.set(cle, [t]);
    }
  }

  const voisins = new Int32Array(nbTri * 3).fill(-1);
  for(let t = 0; t < nbTri; t++){
    trio[0] = vers[sommetsTri(t,0)]; trio[1] = vers[sommetsTri(t,1)]; trio[2] = vers[sommetsTri(t,2)];
    for(let c = 0; c < 3; c++){
      const l = aretes.get(cleArete(trio[c], trio[(c+1) % 3]));
      if(l.length === 2) voisins[t*3 + c] = l[0] === t ? l[1] : l[0];
    }
  }

  /* ---------------- normales et aires des triangles ---------------- */
  const normales = new Float64Array(nbTri * 3);
  const aires = new Float64Array(nbTri);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c3 = new THREE.Vector3();
  const ab = new THREE.Vector3(), ac = new THREE.Vector3(), n = new THREE.Vector3();
  for(let t = 0; t < nbTri; t++){
    a.fromBufferAttribute(pos, sommetsTri(t,0));
    b.fromBufferAttribute(pos, sommetsTri(t,1));
    c3.fromBufferAttribute(pos, sommetsTri(t,2));
    ab.subVectors(b, a); ac.subVectors(c3, a);
    n.crossVectors(ab, ac);
    const l = n.length();
    aires[t] = l / 2;
    if(l > 1e-20) n.divideScalar(l);
    normales[t*3] = n.x; normales[t*3+1] = n.y; normales[t*3+2] = n.z;
  }

  /* ---------------- régions ---------------- */
  const brep = regionsBrep(geo, nbTri);
  const { region, nb } = brep ||
    regionsPropagees(nbTri, voisins, normales, Math.cos(prefs.angleAretes * Math.PI / 180));

  const trisParRegion = Array.from({ length:nb }, () => []);
  for(let t = 0; t < nbTri; t++) trisParRegion[region[t]].push(t);

  /* ---------------- arêtes : les frontières entre régions ---------------- */
  const paquets = new Map();
  for(const [cle, tris] of aretes){
    const rA = region[tris[0]];
    const rB = tris.length === 2 ? region[tris[1]] : -1;
    if(rA === rB) continue;                      // en plein milieu d'une face
    const bas = Math.min(rA, rB), haut = Math.max(rA, rB);
    const p = bas * (nb + 1) + haut;
    const seg = [Math.floor(cle / nbSommets), cle % nbSommets];
    const paquet = paquets.get(p);
    if(paquet) paquet.segments.push(seg);
    else paquets.set(p, { regions:[bas, haut], segments:[seg] });
  }

  const chaines = [];
  for(const paquet of paquets.values()){
    /* Deux faces peuvent se toucher par plusieurs arêtes disjointes — une
       lumière traversant une plaque en donne deux. `enchainer` les sépare de
       lui-même, puisqu'aucun segment ne relie les deux contours. */
    for(const pts of enchainer(paquet.segments, pointDe)){
      /* Les deux faces bordées sont retenues : c'est ce qui permet de tracer
         le contour d'une face sans le rechercher. */
      chaines.push({ pts, regions:paquet.regions, boite:new THREE.Box3().setFromPoints(pts) });
    }
  }

  const topo = {
    nbTri, diagonale, tol:diagonale * TOL_FORME,
    source: brep ? "brep" : "propagation",
    region, trisParRegion, normales, aires, sommetsTri, chaines,
    cacheAretes: new Map(),
    cacheFaces: new Map(),
  };
  geo.userData.topo = topo;
  return topo;
}

/* =============================================================================
   Désignation à la souris
   ========================================================================== */

/** Taille d'un pixel écran, en unités du monde, à la profondeur d'un point. */
export function tailleParPixel(vue, point){
  const h = vue.canvas.clientHeight || 1;
  if(vue.projection === "ortho") return (vue.ortho.top - vue.ortho.bottom) / h;
  const d = vue.camera().position.distanceTo(point);
  return 2 * Math.tan(vue.perspective.fov * Math.PI / 360) * d / h;
}

/** Facteur d'échelle du repère local d'une pièce vers celui du monde. */
function echelleDe(maillage){
  const s = new THREE.Vector3().setFromMatrixScale(maillage.matrixWorld);
  return (Math.abs(s.x) + Math.abs(s.y) + Math.abs(s.z)) / 3 || 1;
}

/** Distance d'un point à une polyligne. */
function versPolyligne(p, pts){
  let dmin = Infinity;
  const v = new THREE.Vector3(), w = new THREE.Vector3();
  for(let i = 1; i < pts.length; i++){
    v.subVectors(pts[i], pts[i-1]);
    w.subVectors(p, pts[i-1]);
    const l2 = v.lengthSq();
    const t = l2 > 1e-20 ? Math.max(0, Math.min(1, w.dot(v) / l2)) : 0;
    dmin = Math.min(dmin, w.sub(v.multiplyScalar(t)).length());
  }
  return dmin;
}

/** L'arête visée, ou `null` si le curseur n'en approche aucune. */
export function areteSous(vue, toucher, seuilPx = 16){
  const maillage = toucher.object;
  const topo = analyser(maillage);
  if(!topo) return null;

  maillage.updateWorldMatrix(true, false);
  const local = maillage.worldToLocal(toucher.point.clone());
  const rayon = tailleParPixel(vue, toucher.point) * seuilPx / echelleDe(maillage);

  let meilleure = -1, dmin = rayon;
  for(let i = 0; i < topo.chaines.length; i++){
    const ch = topo.chaines[i];
    if(ch.boite.distanceToPoint(local) > dmin) continue;
    const d = versPolyligne(local, ch.pts);
    if(d < dmin){ dmin = d; meilleure = i; }
  }
  return meilleure < 0 ? null : entiteArete(maillage, topo, meilleure);
}

/** La face visée. Immédiat : le triangle touché appartient déjà à une région. */
export function faceSous(vue, toucher){
  const maillage = toucher.object;
  const topo = analyser(maillage);
  if(!topo || toucher.faceIndex == null) return null;
  const r = topo.region[toucher.faceIndex];
  return r === undefined ? null : entiteFace(maillage, topo, r);
}

function entiteArete(maillage, topo, i){
  /* Les entités sont décrites dans le repère du monde ; deux instances qui
     partageraient la même géométrie n'y sont pas au même endroit. La clé porte
     donc la pièce, pas seulement le numéro de la chaîne. */
  const cle = maillage.uuid + "/a" + i;
  const garde = topo.cacheAretes.get(cle);
  if(garde) return garde;

  maillage.updateWorldMatrix(true, false);
  const pts = topo.chaines[i].pts.map(p => p.clone().applyMatrix4(maillage.matrixWorld));
  const tol = topo.tol * echelleDe(maillage);
  const e = { genre:"arete", maillage, cle, pts, tol, ...formeChaine(pts, tol) };
  topo.cacheAretes.set(cle, e);
  return e;
}

function entiteFace(maillage, topo, r){
  const cle = maillage.uuid + "/f" + r;
  const garde = topo.cacheFaces.get(cle);
  if(garde) return garde;

  maillage.updateWorldMatrix(true, false);
  const M = maillage.matrixWorld;
  const N = new THREE.Matrix3().getNormalMatrix(M);
  const tris = topo.trisParRegion[r];
  const pos = maillage.geometry.attributes.position;

  /* Une face peut porter des milliers de triangles ; reconnaître un plan ou un
     cylindre n'a pas besoin de tous les voir. On garde tout pour le tracé, on
     échantillonne pour l'ajustement. */
  const pas = Math.max(1, Math.floor(tris.length / 3000));
  const sommets = [], normales = [], aires = [];
  const p = new THREE.Vector3(), nrm = new THREE.Vector3();
  for(let k = 0; k < tris.length; k += pas){
    const t = tris[k];
    for(let c = 0; c < 3; c++){
      p.fromBufferAttribute(pos, topo.sommetsTri(t, c));
      sommets.push(p.clone().applyMatrix4(M));
    }
    nrm.set(topo.normales[t*3], topo.normales[t*3+1], topo.normales[t*3+2]).applyMatrix3(N).normalize();
    normales.push(nrm.clone());
    aires.push(topo.aires[t]);
  }

  const echelle = echelleDe(maillage);
  let aire = 0;
  for(const t of tris) aire += topo.aires[t];

  const e = { genre:"face", maillage, region:r, cle, tris,
              tol:topo.tol * echelle, aire:aire * echelle * echelle,
              boite:new THREE.Box3().setFromPoints(sommets),
              ...formeNappe(sommets, normales, aires, topo.tol * echelle) };
  topo.cacheFaces.set(cle, e);
  return e;
}

/** Géométrie d'affichage d'une face, en coordonnées du monde. */
export function geometrieFace(entite){
  const { maillage, tris } = entite;
  const pos = maillage.geometry.attributes.position;
  const topo = maillage.geometry.userData.topo;
  const M = maillage.matrixWorld;
  const tampon = new Float32Array(tris.length * 9);
  const p = new THREE.Vector3();
  let n = 0;
  for(const t of tris){
    for(let c = 0; c < 3; c++){
      p.fromBufferAttribute(pos, topo.sommetsTri(t, c)).applyMatrix4(M);
      tampon[n++] = p.x; tampon[n++] = p.y; tampon[n++] = p.z;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(tampon, 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

/** Géométrie d'affichage d'une arête, en coordonnées du monde. */
export function geometrieArete(entite){
  return new THREE.BufferGeometry().setFromPoints(entite.pts);
}

/**
 * Le contour d'une face : toutes les arêtes qui la bordent. Une nappe teintée
 * ne se voit pas sur une pièce claire — c'est le trait qui dit où la face
 * commence et où elle s'arrête.
 */
export function contourFace(entite){
  const topo = entite.maillage.geometry.userData.topo;
  const M = entite.maillage.matrixWorld;
  const pts = [];
  for(const ch of topo.chaines){
    if(ch.regions[0] !== entite.region && ch.regions[1] !== entite.region) continue;
    for(let i = 1; i < ch.pts.length; i++){
      pts.push(ch.pts[i-1].clone().applyMatrix4(M), ch.pts[i].clone().applyMatrix4(M));
    }
  }
  return new THREE.BufferGeometry().setFromPoints(pts);
}

/* =============================================================================
   Mesures
   ========================================================================== */

const nf = new Intl.NumberFormat("fr-FR");
/** Une cote s'écrit à la française : virgule décimale. */
export function cote(v, dec = 3){ return (Math.abs(v) < 5e-9 ? 0 : v).toFixed(dec).replace(".", ","); }
export function degres(rad){ return cote(rad * 180 / Math.PI, 2) + "°"; }
export function mm(v){ return cote(v) + " mm"; }
export function diam(r){ return "⌀" + cote(2*r, 2); }
export function nombre(v){ return nf.format(Math.round(v)); }

/** Le plus court chemin entre deux segments, bouts compris. */
function segmentSegment(p1, q1, p2, q2){
  const d1 = new THREE.Vector3().subVectors(q1, p1);
  const d2 = new THREE.Vector3().subVectors(q2, p2);
  const r = new THREE.Vector3().subVectors(p1, p2);
  const a = d1.dot(d1), e = d2.dot(d2), f = d2.dot(r);
  let s = 0, t = 0;

  if(a < 1e-20 && e < 1e-20){
    return { d:r.length(), c1:p1.clone(), c2:p2.clone() };
  }
  if(a < 1e-20){
    t = Math.max(0, Math.min(1, f / e));
  }else{
    const c = d1.dot(r);
    if(e < 1e-20){
      s = Math.max(0, Math.min(1, -c / a));
    }else{
      const b = d1.dot(d2), den = a*e - b*b;
      s = den > 1e-20 ? Math.max(0, Math.min(1, (b*f - c*e) / den)) : 0;
      t = (b*s + f) / e;
      if(t < 0){ t = 0; s = Math.max(0, Math.min(1, -c / a)); }
      else if(t > 1){ t = 1; s = Math.max(0, Math.min(1, (b - c) / a)); }
    }
  }
  const c1 = p1.clone().addScaledVector(d1, s);
  const c2 = p2.clone().addScaledVector(d2, t);
  return { d:c1.distanceTo(c2), c1, c2 };
}

/** Le plus court chemin entre deux polylignes. */
function polyPoly(A, B){
  let meilleur = { d:Infinity, c1:A[0].clone(), c2:B[0].clone() };
  for(let i = 1; i < A.length; i++){
    for(let j = 1; j < B.length; j++){
      const r = segmentSegment(A[i-1], A[i], B[j-1], B[j]);
      if(r.d < meilleur.d) meilleur = r;
    }
  }
  return meilleur;
}

/**
 * Deux droites infinies : distance et pieds de la perpendiculaire commune.
 * Quand les directions sont confondues, cette perpendiculaire n'est plus
 * unique — on la prend alors au milieu de la seconde arête, là où l'utilisateur
 * s'attend à voir la cote se poser.
 */
function droiteDroite(pA, dA, pB, dB, milieuB){
  const sinus = new THREE.Vector3().crossVectors(dA, dB).length();
  const angle = Math.acos(Math.min(1, Math.abs(dA.dot(dB))));

  if(sinus < 1e-7){
    const m = (milieuB || pB).clone();
    const w = new THREE.Vector3().subVectors(m, pA);
    const pied = pA.clone().addScaledVector(dA, w.dot(dA));
    return { parallele:true, angle:0, d:pied.distanceTo(m), c1:pied, c2:m };
  }
  const w0 = new THREE.Vector3().subVectors(pA, pB);
  const b = dA.dot(dB), d = dA.dot(w0), e = dB.dot(w0);
  const den = 1 - b*b;
  const c1 = pA.clone().addScaledVector(dA, (b*e - d) / den);
  const c2 = pB.clone().addScaledVector(dB, (e - b*d) / den);
  return { parallele:false, angle, d:c1.distanceTo(c2), c1, c2 };
}

/** Les écarts en X, Y, Z, qu'un mécanicien lit aussi souvent que la distance. */
function deltas(p1, p2){
  return `ΔX ${cote(Math.abs(p2.x - p1.x))}  ΔY ${cote(Math.abs(p2.y - p1.y))}  ` +
         `ΔZ ${cote(Math.abs(p2.z - p1.z))} mm`;
}

/* ---------------------------------------------------------------------------
   Arête ↔ arête
   ------------------------------------------------------------------------- */
export function mesurerAretes(A, B){
  /* Deux perçages : ce qu'on veut, c'est l'entraxe — la distance entre les
     centres. C'est la cote la plus demandée d'un plan de perçage, et la seule
     que le plus court chemin entre les deux cercles ne donne pas. */
  if(A.type === "cercle" && B.type === "cercle"){
    const d = A.centre.distanceTo(B.centre);
    const angle = Math.acos(Math.min(1, Math.abs(A.normale.dot(B.normale))));
    return {
      p1:A.centre.clone(), p2:B.centre.clone(), etiquette:mm(d),
      titre:`Entraxe ${mm(d)}  ·  ${diam(A.rayon)} / ${diam(B.rayon)}  ·  ` +
            (angle < 1e-3 ? "axes parallèles" : `axes à ${degres(angle)}`) +
            `  ·  ${deltas(A.centre, B.centre)}`,
    };
  }

  if(A.type === "droite" && B.type === "droite"){
    const r = droiteDroite(A.a, A.dir, B.a, B.dir, B.milieu);
    const mini = polyPoly(A.pts, B.pts);

    if(r.parallele){
      return {
        p1:r.c1, p2:r.c2, etiquette:mm(r.d),
        titre:`Arêtes parallèles  ·  entraxe ${mm(r.d)}  ·  longueurs ` +
              `${cote(A.longueur,2)} / ${cote(B.longueur,2)} mm` +
              (mini.d > r.d + A.tol ? `  ·  plus court chemin ${mm(mini.d)}` : ""),
      };
    }
    if(r.d < Math.max(A.tol, B.tol)){
      return {
        p1:r.c1, p2:r.c2, etiquette:degres(r.angle),
        titre:`Arêtes sécantes  ·  angle ${degres(r.angle)}  ·  point ` +
              `${cote(r.c1.x,2)} ; ${cote(r.c1.y,2)} ; ${cote(r.c1.z,2)}`,
      };
    }
    return {
      p1:r.c1, p2:r.c2, etiquette:mm(r.d),
      titre:`Arêtes gauches  ·  perpendiculaire commune ${mm(r.d)}  ·  ` +
            `angle ${degres(r.angle)}  ·  plus court chemin ${mm(mini.d)}`,
    };
  }

  /* Un perçage et une arête droite : la distance du centre au bord, c'est-à-dire
     la cote de pose d'un trou sur une tôle. */
  const cercle = A.type === "cercle" ? A : B.type === "cercle" ? B : null;
  const droite = A.type === "droite" ? A : B.type === "droite" ? B : null;
  if(cercle && droite){
    const w = new THREE.Vector3().subVectors(cercle.centre, droite.a);
    const pied = droite.a.clone().addScaledVector(droite.dir, w.dot(droite.dir));
    const d = pied.distanceTo(cercle.centre);
    return {
      p1:pied, p2:cercle.centre.clone(), etiquette:mm(d),
      titre:`Centre → arête ${mm(d)}  ·  ${diam(cercle.rayon)}  ·  ` +
            `bord du perçage ${mm(Math.max(0, d - cercle.rayon))}`,
    };
  }

  const mini = polyPoly(A.pts, B.pts);
  return {
    p1:mini.c1, p2:mini.c2, etiquette:mm(mini.d),
    titre:`Plus court chemin ${mm(mini.d)}  ·  ${deltas(mini.c1, mini.c2)}`,
  };
}

/* ---------------------------------------------------------------------------
   Face ↔ face
   ------------------------------------------------------------------------- */

/**
 * Plus court chemin entre deux nappes. Il n'y a pas de formule : on
 * échantillonne les deux, dans les deux sens, et on prend le minimum. La cote
 * est donc celle du maillage d'affichage, pas de la surface exacte — on le dit
 * dans le texte plutôt que de laisser croire à une précision qu'on n'a pas.
 */
function nappeNappe(A, B){
  const sommetsDe = (e, max) => {
    const pos = e.maillage.geometry.attributes.position;
    const topo = e.maillage.geometry.userData.topo;
    const M = e.maillage.matrixWorld;
    const pas = Math.max(1, Math.ceil(e.tris.length / max));
    const out = [];
    for(let k = 0; k < e.tris.length; k += pas){
      for(let c = 0; c < 3; c++){
        out.push(new THREE.Vector3().fromBufferAttribute(pos, topo.sommetsTri(e.tris[k], c)).applyMatrix4(M));
      }
    }
    return out;
  };

  let meilleur = { d:Infinity, c1:A.centre.clone(), c2:B.centre.clone() };
  const tri = new THREE.Triangle(), proche = new THREE.Vector3();

  for(const versA of [true, false]){
    const points = sommetsDe(versA ? A : B, 150);
    const nappe = sommetsDe(versA ? B : A, 1200);
    for(const p of points){
      for(let i = 0; i + 2 < nappe.length; i += 3){
        tri.set(nappe[i], nappe[i+1], nappe[i+2]).closestPointToPoint(p, proche);
        const d = proche.distanceTo(p);
        if(d < meilleur.d){
          meilleur = versA ? { d, c1:p.clone(), c2:proche.clone() }
                           : { d, c1:proche.clone(), c2:p.clone() };
        }
      }
    }
  }
  return meilleur;
}

export function mesurerFaces(A, B){
  /* ---- deux plans : une épaisseur, ou un angle ---- */
  if(A.type === "plan" && B.type === "plan"){
    const angle = Math.acos(Math.min(1, Math.abs(A.normale.dot(B.normale))));
    if(angle < 1e-3){
      const w = new THREE.Vector3().subVectors(B.centre, A.centre);
      const ecart = w.dot(A.normale);
      return {
        p1:B.centre.clone().addScaledVector(A.normale, -ecart), p2:B.centre.clone(),
        etiquette:mm(Math.abs(ecart)),
        titre:`Plans parallèles  ·  écart ${mm(Math.abs(ecart))}  ·  ` +
              (A.normale.dot(B.normale) < 0 ? "normales opposées (épaisseur de matière)"
                                            : "normales de même sens (décalage)") +
              `  ·  surfaces ${nombre(A.aire)} / ${nombre(B.aire)} mm²`,
      };
    }
    const mini = nappeNappe(A, B);
    return {
      p1:mini.c1, p2:mini.c2, etiquette:degres(angle),
      titre:`Plans sécants  ·  angle ${degres(angle)}  ·  ` +
            `plus court chemin ${mm(mini.d)} (sur le maillage)`,
    };
  }

  /* ---- deux cylindres : l'entraxe, et le jeu s'ils sont parallèles ---- */
  if(A.type === "cylindre" && B.type === "cylindre"){
    const r = droiteDroite(A.point, A.axe, B.point, B.axe, B.centre);
    const jeu = r.d - A.rayon - B.rayon;
    return {
      p1:r.c1, p2:r.c2, etiquette:mm(r.d),
      titre:`Entraxe ${mm(r.d)}  ·  ${diam(A.rayon)} / ${diam(B.rayon)}  ·  ` +
            (r.parallele ? `axes parallèles  ·  ${jeu >= 0 ? "jeu" : "recouvrement"} ${mm(Math.abs(jeu))}`
                         : `axes à ${degres(r.angle)}`),
    };
  }

  /* ---- un cylindre et un plan : la hauteur d'axe, et le jeu sous la matière ---- */
  const cyl = A.type === "cylindre" ? A : B.type === "cylindre" ? B : null;
  const plan = A.type === "plan" ? A : B.type === "plan" ? B : null;
  if(cyl && plan){
    const sinus = Math.abs(cyl.axe.dot(plan.normale));
    const w = new THREE.Vector3().subVectors(cyl.centre, plan.centre);
    const ecart = w.dot(plan.normale);
    const d = Math.abs(ecart);
    const commun = { p1:cyl.centre.clone().addScaledVector(plan.normale, -ecart),
                     p2:cyl.centre.clone(), etiquette:mm(d) };
    if(sinus < 1e-3){
      return { ...commun,
        titre:`Axe → plan ${mm(d)}  ·  ${diam(cyl.rayon)}  ·  axe parallèle au plan  ·  ` +
              `${d - cyl.rayon >= 0 ? "jeu" : "recouvrement"} ${mm(Math.abs(d - cyl.rayon))}` };
    }
    return { ...commun,
      titre:`Axe → plan ${mm(d)}  ·  ${diam(cyl.rayon)}  ·  ` +
            `axe à ${degres(Math.asin(Math.min(1, sinus)))} du plan` };
  }

  const mini = nappeNappe(A, B);
  return {
    p1:mini.c1, p2:mini.c2, etiquette:mm(mini.d),
    titre:`Plus court chemin ${mm(mini.d)}  ·  ${deltas(mini.c1, mini.c2)}  ·  sur le maillage`,
  };
}

/* ---------------------------------------------------------------------------
   Ce qu'on vient de désigner, en une ligne
   ------------------------------------------------------------------------- */
export function resumer(e){
  if(!e) return "";
  const nom = e.maillage?.name ? `  (${e.maillage.name})` : "";
  if(e.genre === "arete"){
    if(e.type === "droite") return `Arête droite ${mm(e.longueur)}${nom}`;
    if(e.type === "cercle") return (e.ferme ? `Cercle ${diam(e.rayon)}`
                                            : `Arc ${diam(e.rayon)} sur ${degres(e.balaye)}`) + nom;
    return `Arête ${mm(e.longueur)}${nom}`;
  }
  if(e.type === "plan")     return `Face plane ${nombre(e.aire)} mm²${nom}`;
  if(e.type === "cylindre") return `Face cylindrique ${diam(e.rayon)} · hauteur ${cote(e.hauteur, 2)} mm${nom}`;
  return `Face ${nombre(e.aire)} mm²${nom}`;
}
