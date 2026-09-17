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

/**
 * Calcule ou récupère le repère propre (local) d'une pièce :
 * - Si le maillage porte une transformation non alignée (matrixWorld),
 *   on utilise les axes directeurs issus de sa rotation.
 * - Sinon (géométrie tessellée dans le repère global), on calcule les axes
 *   principaux d'inertie (ACP / PCA) des sommets via la matrice de covariance.
 * Renvoie { nom, maillage, uX, uY, uZ, centre } avec (uX, uY, uZ) base orthonormée directe.
 */
export function repereDePiece(maillage){
  if(!maillage) return null;
  if(maillage.userData.reperePropre) return maillage.userData.reperePropre;

  const nom = maillage.name || "Pièce";
  maillage.updateWorldMatrix(true, false);

  const M = maillage.matrixWorld;
  const rot = new THREE.Matrix4().extractRotation(M);
  const e = rot.elements;
  const estIdentite = Math.abs(e[0] - 1) < 1e-4 && Math.abs(e[5] - 1) < 1e-4 && Math.abs(e[10] - 1) < 1e-4 &&
                      Math.abs(e[1]) < 1e-4 && Math.abs(e[2]) < 1e-4 && Math.abs(e[4]) < 1e-4 &&
                      Math.abs(e[6]) < 1e-4 && Math.abs(e[8]) < 1e-4 && Math.abs(e[9]) < 1e-4;

  const uX = new THREE.Vector3();
  const uY = new THREE.Vector3();
  const uZ = new THREE.Vector3();
  let centre = new THREE.Vector3();

  const geo = maillage.geometry;
  if(geo){
    if(!geo.boundingBox) geo.computeBoundingBox();
    centre = geo.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(M);
  }

  if(!estIdentite){
    uX.set(e[0], e[1], e[2]).normalize();
    uY.set(e[4], e[5], e[6]).normalize();
    uZ.set(e[8], e[9], e[10]).normalize();
  }else if(geo && geo.attributes?.position){
    const pos = geo.attributes.position;
    const nbSommets = pos.count;
    const pas = Math.max(1, Math.floor(nbSommets / 2000));
    const echantillon = [];
    const p = new THREE.Vector3();
    for(let i = 0; i < nbSommets; i += pas){
      p.fromBufferAttribute(pos, i).applyMatrix4(M);
      echantillon.push(p.clone());
    }

    if(echantillon.length >= 4){
      const c = barycentre(echantillon);
      centre.copy(c);
      const cov = covariance(echantillon, c);
      const vp = proprer(cov);

      uX.copy(vp[2].vecteur).normalize();
      uY.copy(vp[1].vecteur).normalize();
      uZ.crossVectors(uX, uY).normalize();
      uY.crossVectors(uZ, uX).normalize();
    }else{
      uX.set(1, 0, 0); uY.set(0, 1, 0); uZ.set(0, 0, 1);
    }
  }else{
    uX.set(1, 0, 0); uY.set(0, 1, 0); uZ.set(0, 0, 1);
  }

  if(uX.dot(new THREE.Vector3(1, 0, 0)) < -0.1) uX.negate();
  if(uY.dot(new THREE.Vector3(0, 1, 0)) < -0.1) uY.negate();
  uZ.crossVectors(uX, uY).normalize();

  const repere = { nom, maillage, uX, uY, uZ, centre };
  maillage.userData.reperePropre = repere;
  return repere;
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
        /* Angle balayé : somme des incréments angulaires déroulés le long de la chaîne */
        let balaye = 0;
        let tPrec = Math.atan2(c.ys[0] - c.cy, c.xs[0] - c.cx);
        for(let i = 1; i < n; i++){
          const t = Math.atan2(c.ys[i] - c.cy, c.xs[i] - c.cx);
          let dt = t - tPrec;
          while(dt > Math.PI) dt -= 2 * Math.PI;
          while(dt < -Math.PI) dt += 2 * Math.PI;
          balaye += Math.abs(dt);
          tPrec = t;
        }
        const estComplet = ferme || balaye >= 2 * Math.PI - 0.15;
        return { type:"cercle", centre:c.centre, normale, rayon:c.rayon,
                 ferme:estComplet,
                 balaye:estComplet ? 2*Math.PI : balaye,
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
      /* Couverture angulaire des normales autour de l'axe : cylindre fermé vs congé */
      const angles = [];
      const nbN = Math.floor(normales.length / 3);
      for(let k = 0; k < nbN; k++){
        const nx = normales[k*3], ny = normales[k*3+1], nz = normales[k*3+2];
        const x = nx * u.x + ny * u.y + nz * u.z;
        const y = nx * w.x + ny * w.y + nz * w.z;
        if(x*x + y*y > 0.01) angles.push(Math.atan2(y, x));
      }
      let fermeCyl = true;
      if(angles.length >= 8){
        angles.sort((a, b) => a - b);
        let maxGap = 0;
        for(let i = 0; i < angles.length; i++){
          const next = i + 1 < angles.length ? angles[i+1] : angles[0] + 2 * Math.PI;
          maxGap = Math.max(maxGap, next - angles[i]);
        }
        fermeCyl = maxGap < Math.PI * 0.75;
      }
      return { type:"cylindre", axe, rayon:c.rayon, hauteur:maxi - mini, ferme:fermeCyl,
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
export function rayon(r){ return "R" + cote(r, 2); }
export function dimCercle(c){ return (c && c.ferme === false) ? rayon(c.rayon) : diam(c.rayon); }
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

/** Le plus long chemin (distance maximale) entre deux polylignes. */
function polyPolyMax(A, B){
  let meilleur = { d:-1, c1:A[0].clone(), c2:B[0].clone() };
  for(let i = 0; i < A.length; i++){
    for(let j = 0; j < B.length; j++){
      const d = A[i].distanceTo(B[j]);
      if(d > meilleur.d){
        meilleur = { d, c1:A[i].clone(), c2:B[j].clone() };
      }
    }
  }
  return meilleur;
}

/** Point d'une polyligne le plus proche d'un rayon 3D. */
function pointPolyProcheRayon(pts, ray){
  let meilleur = { dSq:Infinity, p:pts[0].clone() };
  const pSurRay = new THREE.Vector3(), pSurSeg = new THREE.Vector3();
  for(let i = 1; i < pts.length; i++){
    const dSq = ray.distanceSqToSegment(pts[i-1], pts[i], pSurRay, pSurSeg);
    if(dSq < meilleur.dSq){
      meilleur = { dSq, p:pSurSeg.clone() };
    }
  }
  return meilleur;
}

/** Point d'une polyligne le plus proche d'un point 3D cible. */
function pointPolyProchePoint(pts, cible){
  let meilleur = { d:Infinity, p:pts[0].clone() };
  const seg = new THREE.Line3();
  const proche = new THREE.Vector3();
  for(let i = 1; i < pts.length; i++){
    seg.set(pts[i-1], pts[i]).closestPointToPoint(cible, true, proche);
    const d = proche.distanceTo(cible);
    if(d < meilleur.d){
      meilleur = { d, p:proche.clone() };
    }
  }
  return meilleur;
}

/** Glissement d'une mesure le long de deux arêtes guidé par le rayon du curseur. */
function glisserAretes(A, B, ray){
  const rA = pointPolyProcheRayon(A.pts, ray);
  const rB = pointPolyProcheRayon(B.pts, ray);
  let p1, p2;
  if(rA.dSq <= rB.dSq){
    p1 = rA.p;
    p2 = pointPolyProchePoint(B.pts, p1).p;
  }else{
    p2 = rB.p;
    p1 = pointPolyProchePoint(A.pts, p2).p;
  }
  const d = p1.distanceTo(p2);
  let infoAxe = "";
  if(A.type === "cercle" && B.type === "cercle"){
    const dCentres = A.centre.distanceTo(B.centre);
    if(dCentres >= 1e-3) infoAxe = ` (entraxe ${mm(dCentres)})`;
  }else if(A.type === "cercle" || B.type === "cercle"){
    const c = A.type === "cercle" ? A : B;
    const pAutre = A.type === "cercle" ? p2 : p1;
    const dAxe = c.centre.distanceTo(pAutre);
    infoAxe = ` (axe ${mm(dAxe)})`;
  }
  return {
    p1, p2, d,
    etiquette:`${mm(d)}${infoAxe}`,
    titre:`Mesure le long de la zone : ${mm(d)}${infoAxe}  ·  ${deltas(p1, p2)}`,
  };
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
export function deltas(p1, p2, repere = null){
  if(repere && repere.uX){
    const d = new THREE.Vector3().subVectors(p2, p1);
    const dx = Math.abs(d.dot(repere.uX));
    const dy = Math.abs(d.dot(repere.uY));
    const dz = Math.abs(d.dot(repere.uZ));
    const sfx = repere.nom ? ` [${repere.nom}]` : "";
    return `ΔX ${cote(dx)}  ΔY ${cote(dy)}  ΔZ ${cote(dz)} mm${sfx}`;
  }
  return `ΔX ${cote(Math.abs(p2.x - p1.x))}  ΔY ${cote(Math.abs(p2.y - p1.y))}  ` +
         `ΔZ ${cote(Math.abs(p2.z - p1.z))} mm`;
}

/* ---------------------------------------------------------------------------
   Arête ↔ arête
   ------------------------------------------------------------------------- */
export function mesurerAretes(A, B){
  const maxi = polyPolyMax(A.pts, B.pts);
  const glisser = (ray) => glisserAretes(A, B, ray);

  /* Deux cercles ou arcs : on ancre sur le bord le plus proche (le passage
     physique de matière, ce que l'œil vise) tout en donnant l'entraxe entre
     les centres. */
  if(A.type === "cercle" && B.type === "cercle"){
    const dCentres = A.centre.distanceTo(B.centre);
    const angle = Math.acos(Math.min(1, Math.abs(A.normale.dot(B.normale))));
    const mini = polyPoly(A.pts, B.pts);
    const concentrique = dCentres < 1e-3;
    const texteAxe = concentrique ? "cercles concentriques" : (angle < 1e-3 ? "axes parallèles" : `axes à ${degres(angle)}`);
    const etMin = concentrique ? mm(mini.d) : `${mm(mini.d)} (entraxe ${mm(dCentres)})`;
    const titMin = `Bord à bord (Min) ${mm(mini.d)}` + (concentrique ? "" : `  ·  entraxe ${mm(dCentres)}`) +
                   `  ·  ${dimCercle(A)} / ${dimCercle(B)}  ·  ${texteAxe}  ·  ${deltas(mini.c1, mini.c2)}`;
    const etMax = `${mm(maxi.d)} (Max)`;
    const titMax = `Bord à bord (Max) ${mm(maxi.d)}` + (concentrique ? "" : `  ·  entraxe ${mm(dCentres)}`) +
                   `  ·  ${dimCercle(A)} / ${dimCercle(B)}  ·  ${texteAxe}  ·  ${deltas(maxi.c1, maxi.c2)}`;
    return {
      p1:mini.c1, p2:mini.c2, etiquette:etMin, titre:titMin,
      extensible:true, positionActuelle:"min",
      min:{ p1:mini.c1, p2:mini.c2, d:mini.d, etiquette:etMin, titre:titMin },
      max:{ p1:maxi.c1, p2:maxi.c2, d:maxi.d, etiquette:etMax, titre:titMax },
      glisser,
    };
  }

  if(A.type === "droite" && B.type === "droite"){
    const angle = Math.acos(Math.min(1, Math.abs(A.dir.dot(B.dir))));
    const sinus = Math.abs(Math.sin(angle));
    const mini = polyPoly(A.pts, B.pts);

    /* 1. Sécantes (se touchent ou presque) : angle et point de contact */
    if(mini.d < Math.max(A.tol, B.tol, 1e-3)){
      return {
        p1:mini.c1, p2:mini.c2, etiquette:degres(angle),
        titre:`Arêtes sécantes  ·  angle ${degres(angle)}  ·  point ` +
              `${cote(mini.c1.x,2)} ; ${cote(mini.c1.y,2)} ; ${cote(mini.c1.z,2)}`,
        extensible:false,
      };
    }

    /* 2. Parallèles : distance perpendiculaire dans la zone de chevauchement */
    if(sinus < 1e-3){
      const u = A.dir;
      const tB0 = new THREE.Vector3().subVectors(B.pts[0], A.a).dot(u);
      const tB1 = new THREE.Vector3().subVectors(B.pts[B.pts.length - 1], A.a).dot(u);
      const minB = Math.min(tB0, tB1), maxB = Math.max(tB0, tB1);
      const chevaucheMin = Math.max(0, minB);
      const chevaucheMax = Math.min(A.longueur, maxB);

      if(chevaucheMin <= chevaucheMax){
        const tMid = (chevaucheMin + chevaucheMax) / 2;
        const p1 = A.a.clone().addScaledVector(u, tMid);
        const w = new THREE.Vector3().subVectors(p1, B.a);
        const tOnB = Math.max(0, Math.min(B.longueur, w.dot(B.dir)));
        const p2 = B.a.clone().addScaledVector(B.dir, tOnB);
        const d = p1.distanceTo(p2);
        const et = mm(d);
        const tit = `Arêtes parallèles  ·  écartement ${mm(d)}  ·  longueurs ` +
                    `${cote(A.longueur,2)} / ${cote(B.longueur,2)} mm  ·  ${deltas(p1, p2)}`;
        return {
          p1, p2, etiquette:et, titre:tit,
          extensible:true, positionActuelle:"min",
          min:{ p1, p2, d, etiquette:et, titre:tit },
          max:{ p1:maxi.c1, p2:maxi.c2, d:maxi.d, etiquette:`${mm(maxi.d)} (Max)`, titre:`Écartement max ${mm(maxi.d)}  ·  ${deltas(maxi.c1, maxi.c2)}` },
          glisser,
        };
      }
      const et = mm(mini.d);
      const tit = `Arêtes parallèles décalées  ·  plus court chemin ${mm(mini.d)}  ·  longueurs ` +
                  `${cote(A.longueur,2)} / ${cote(B.longueur,2)} mm  ·  ${deltas(mini.c1, mini.c2)}`;
      return {
        p1:mini.c1, p2:mini.c2, etiquette:et, titre:tit,
        extensible:true, positionActuelle:"min",
        min:{ p1:mini.c1, p2:mini.c2, d:mini.d, etiquette:et, titre:tit },
        max:{ p1:maxi.c1, p2:maxi.c2, d:maxi.d, etiquette:`${mm(maxi.d)} (Max)`, titre:`Plus long chemin ${mm(maxi.d)}  ·  ${deltas(maxi.c1, maxi.c2)}` },
        glisser,
      };
    }

    /* 3. Arêtes gauches / non coplanaires avec un angle : toujours bornées sur les arêtes réelles */
    const etMin = `${mm(mini.d)} · ${degres(angle)}`;
    const titMin = `Arêtes gauches (Min)  ·  plus court chemin ${mm(mini.d)}  ·  angle ${degres(angle)}  ·  ${deltas(mini.c1, mini.c2)}`;
    const etMax = `${mm(maxi.d)} (Max)`;
    const titMax = `Arêtes gauches (Max)  ·  distance ${mm(maxi.d)}  ·  angle ${degres(angle)}  ·  ${deltas(maxi.c1, maxi.c2)}`;
    return {
      p1:mini.c1, p2:mini.c2, etiquette:etMin, titre:titMin,
      extensible:true, positionActuelle:"min",
      min:{ p1:mini.c1, p2:mini.c2, d:mini.d, etiquette:etMin, titre:titMin },
      max:{ p1:maxi.c1, p2:maxi.c2, d:maxi.d, etiquette:etMax, titre:titMax },
      glisser,
    };
  }

  /* Un perçage et une arête droite : ancre au bord le plus proche de la matière, avec cote au centre */
  const cercle = A.type === "cercle" ? A : B.type === "cercle" ? B : null;
  const droite = A.type === "droite" ? A : B.type === "droite" ? B : null;
  if(cercle && droite){
    const w = new THREE.Vector3().subVectors(cercle.centre, droite.a);
    const t = Math.max(0, Math.min(droite.longueur, w.dot(droite.dir)));
    const pied = droite.a.clone().addScaledVector(droite.dir, t);
    const dAxe = pied.distanceTo(cercle.centre);
    const mini = polyPoly(cercle.pts, droite.pts);
    const etMin = `${mm(mini.d)} (axe ${mm(dAxe)})`;
    const titMin = `Bord à bord (Min) ${mm(mini.d)}  ·  centre → arête ${mm(dAxe)}  ·  ${dimCercle(cercle)}  ·  ${deltas(mini.c2, mini.c1)}`;
    const etMax = `${mm(maxi.d)} (Max)`;
    const titMax = `Bord à bord (Max) ${mm(maxi.d)}  ·  centre → arête ${mm(dAxe)}  ·  ${dimCercle(cercle)}  ·  ${deltas(maxi.c2, maxi.c1)}`;
    return {
      p1:mini.c2, p2:mini.c1, etiquette:etMin, titre:titMin,
      extensible:true, positionActuelle:"min",
      min:{ p1:mini.c2, p2:mini.c1, d:mini.d, etiquette:etMin, titre:titMin },
      max:{ p1:maxi.c2, p2:maxi.c1, d:maxi.d, etiquette:etMax, titre:titMax },
      glisser,
    };
  }

  const mini = polyPoly(A.pts, B.pts);
  const etMin = mm(mini.d);
  const titMin = `Plus court chemin (Min) ${mm(mini.d)}  ·  ${deltas(mini.c1, mini.c2)}`;
  const etMax = `${mm(maxi.d)} (Max)`;
  const titMax = `Plus long chemin (Max) ${mm(maxi.d)}  ·  ${deltas(maxi.c1, maxi.c2)}`;
  return {
    p1:mini.c1, p2:mini.c2, etiquette:etMin, titre:titMin,
    extensible:true, positionActuelle:"min",
    min:{ p1:mini.c1, p2:mini.c2, d:mini.d, etiquette:etMin, titre:titMin },
    max:{ p1:maxi.c1, p2:maxi.c2, d:maxi.d, etiquette:etMax, titre:titMax },
    glisser,
  };
}

/* ---------------------------------------------------------------------------
   Face ↔ face
   ------------------------------------------------------------------------- */

function sommetsDeFace(e, max){
  if(!e || !e.maillage) return [e?.centre ? e.centre.clone() : new THREE.Vector3()];
  const pos = e.maillage.geometry?.attributes?.position;
  if(!pos) return [e.centre ? e.centre.clone() : new THREE.Vector3()];
  const topo = e.maillage.geometry.userData?.topo;
  const M = e.maillage.matrixWorld;
  const nbTris = e.tris ? e.tris.length : 0;
  if(!nbTris || !topo) return [e.centre ? e.centre.clone() : new THREE.Vector3()];
  const pas = Math.max(1, Math.ceil(nbTris / max));
  const out = [];
  for(let k = 0; k < nbTris; k += pas){
    for(let c = 0; c < 3; c++){
      out.push(new THREE.Vector3().fromBufferAttribute(pos, topo.sommetsTri(e.tris[k], c)).applyMatrix4(M));
    }
  }
  return out.length ? out : [e.centre ? e.centre.clone() : new THREE.Vector3()];
}

/**
 * Plus court chemin entre deux nappes. Il n'y a pas de formule : on
 * échantillonne les deux, dans les deux sens, et on prend le minimum. La cote
 * est donc celle du maillage d'affichage, pas de la surface exacte — on le dit
 * dans le texte plutôt que de laisser croire à une précision qu'on n'a pas.
 */
function nappeNappe(A, B){
  let meilleur = { d:Infinity, c1:A.centre.clone(), c2:B.centre.clone() };
  const tri = new THREE.Triangle(), proche = new THREE.Vector3();

  for(const versA of [true, false]){
    const points = sommetsDeFace(versA ? A : B, 150);
    const nappe = sommetsDeFace(versA ? B : A, 1200);
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

/** Plus grande distance entre deux nappes de triangles (échantillonnées). */
function nappeNappeMax(A, B){
  let meilleur = { d:-1, c1:A.centre.clone(), c2:B.centre.clone() };
  const ptsA = sommetsDeFace(A, 150);
  const ptsB = sommetsDeFace(B, 150);
  for(const p of ptsA){
    for(const q of ptsB){
      const d = p.distanceTo(q);
      if(d > meilleur.d){
        meilleur = { d, c1:p.clone(), c2:q.clone() };
      }
    }
  }
  return meilleur;
}

/** Glissement d'une mesure le long de deux faces guidé par le rayon du curseur. */
function glisserFaces(A, B, ray){
  const ptsA = sommetsDeFace(A, 120);
  const ptsB = sommetsDeFace(B, 120);
  let minSqA = Infinity, pA = ptsA[0].clone();
  for(const p of ptsA){
    const dSq = ray.distanceSqToPoint(p);
    if(dSq < minSqA){ minSqA = dSq; pA = p.clone(); }
  }
  let minSqB = Infinity, pB = ptsB[0].clone();
  for(const p of ptsB){
    const dSq = ray.distanceSqToPoint(p);
    if(dSq < minSqB){ minSqB = dSq; pB = p.clone(); }
  }

  let p1, p2;
  const tri = new THREE.Triangle(), proche = new THREE.Vector3();
  if(minSqA <= minSqB){
    p1 = pA;
    let minD = Infinity;
    const nappeB = sommetsDeFace(B, 600);
    p2 = nappeB[0].clone();
    for(let i = 0; i + 2 < nappeB.length; i += 3){
      tri.set(nappeB[i], nappeB[i+1], nappeB[i+2]).closestPointToPoint(p1, proche);
      const d = proche.distanceTo(p1);
      if(d < minD){ minD = d; p2 = proche.clone(); }
    }
  }else{
    p2 = pB;
    let minD = Infinity;
    const nappeA = sommetsDeFace(A, 600);
    p1 = nappeA[0].clone();
    for(let i = 0; i + 2 < nappeA.length; i += 3){
      tri.set(nappeA[i], nappeA[i+1], nappeA[i+2]).closestPointToPoint(p2, proche);
      const d = proche.distanceTo(p2);
      if(d < minD){ minD = d; p1 = proche.clone(); }
    }
  }
  const d = p1.distanceTo(p2);
  let infoAxe = "";
  if(A.type === "cylindre" && B.type === "cylindre"){
    const r = droiteDroite(A.point, A.axe, B.point, B.axe, B.centre);
    if(r.d >= 1e-3) infoAxe = ` (entraxe ${mm(r.d)})`;
  }
  return {
    p1, p2, d,
    etiquette:`${mm(d)}${infoAxe}`,
    titre:`Mesure le long de la zone : ${mm(d)}${infoAxe}  ·  ${deltas(p1, p2)}`,
  };
}

/** Glissement d'une mesure entre une arête et une face. */
function glisserAreteFace(A, B, ray){
  const arete = A.genre === "arete" ? A : B;
  const face = A.genre === "face" ? A : B;
  const pArete = pointPolyProcheRayon(arete.pts, ray).p;
  const nappeFace = sommetsDeFace(face, 600);
  const tri = new THREE.Triangle(), proche = new THREE.Vector3();
  let minD = Infinity, pFace = nappeFace[0].clone();
  for(let i = 0; i + 2 < nappeFace.length; i += 3){
    tri.set(nappeFace[i], nappeFace[i+1], nappeFace[i+2]).closestPointToPoint(pArete, proche);
    const d = proche.distanceTo(pArete);
    if(d < minD){ minD = d; pFace = proche.clone(); }
  }
  const d = pArete.distanceTo(pFace);
  const p1 = A.genre === "arete" ? pArete : pFace;
  const p2 = A.genre === "arete" ? pFace : pArete;
  return {
    p1, p2, d,
    etiquette:mm(d),
    titre:`Mesure le long de la zone : ${mm(d)}  ·  ${deltas(p1, p2)}`,
  };
}

export function mesurerFaces(A, B){
  const maxi = nappeNappeMax(A, B);
  const glisser = (ray) => glisserFaces(A, B, ray);

  /* ---- deux plans : une épaisseur, ou un angle ---- */
  if(A.type === "plan" && B.type === "plan"){
    const angle = Math.acos(Math.min(1, Math.abs(A.normale.dot(B.normale))));
    if(angle < 1e-3){
      const w = new THREE.Vector3().subVectors(B.centre, A.centre);
      const ecart = w.dot(A.normale);
      const p1 = B.centre.clone().addScaledVector(A.normale, -ecart);
      const p2 = B.centre.clone();
      const d = Math.abs(ecart);
      const et = mm(d);
      const tit = `Plans parallèles  ·  écart ${mm(d)}  ·  ` +
                  (A.normale.dot(B.normale) < 0 ? "normales opposées (épaisseur de matière)"
                                                : "normales de même sens (décalage)") +
                  `  ·  surfaces ${nombre(A.aire)} / ${nombre(B.aire)} mm²`;
      return {
        p1, p2, etiquette:et, titre:tit,
        extensible:true, positionActuelle:"min",
        min:{ p1, p2, d, etiquette:et, titre:tit },
        max:{ p1, p2, d, etiquette:et, titre:tit },
        glisser,
      };
    }
    const mini = nappeNappe(A, B);
    const etMin = degres(angle);
    const titMin = `Plans sécants  ·  angle ${degres(angle)}  ·  plus court chemin ${mm(mini.d)} (sur le maillage)`;
    const etMax = `${mm(maxi.d)} (Max)`;
    const titMax = `Plans sécants  ·  angle ${degres(angle)}  ·  plus long chemin ${mm(maxi.d)} (sur le maillage)`;
    return {
      p1:mini.c1, p2:mini.c2, etiquette:etMin, titre:titMin,
      extensible:true, positionActuelle:"min",
      min:{ p1:mini.c1, p2:mini.c2, d:mini.d, etiquette:etMin, titre:titMin },
      max:{ p1:maxi.c1, p2:maxi.c2, d:maxi.d, etiquette:etMax, titre:titMax },
      glisser,
    };
  }

  /* ---- deux cylindres : bord à bord sur les surfaces et entraxe des axes ---- */
  if(A.type === "cylindre" && B.type === "cylindre"){
    const r = droiteDroite(A.point, A.axe, B.point, B.axe, B.centre);
    const mini = nappeNappe(A, B);
    const dAxes = r.d;
    const concentrique = dAxes < 1e-3;
    const texteAxes = concentrique ? "cylindres coaxiaux" : (r.parallele ? "axes parallèles" : `axes à ${degres(r.angle)}`);
    const etMin = concentrique ? mm(mini.d) : `${mm(mini.d)} (entraxe ${mm(dAxes)})`;
    const titMin = `Bord à bord (Min) ${mm(mini.d)}` + (concentrique ? "" : `  ·  entraxe ${mm(dAxes)}`) +
                   `  ·  ${diam(A.rayon)} / ${diam(B.rayon)}  ·  ${texteAxes}  ·  ${deltas(mini.c1, mini.c2)}`;
    const etMax = `${mm(maxi.d)} (Max)`;
    const titMax = `Bord à bord (Max) ${mm(maxi.d)}` + (concentrique ? "" : `  ·  entraxe ${mm(dAxes)}`) +
                   `  ·  ${diam(A.rayon)} / ${diam(B.rayon)}  ·  ${texteAxes}  ·  ${deltas(maxi.c1, maxi.c2)}`;
    return {
      p1:mini.c1, p2:mini.c2, etiquette:etMin, titre:titMin,
      extensible:true, positionActuelle:"min",
      min:{ p1:mini.c1, p2:mini.c2, d:mini.d, etiquette:etMin, titre:titMin },
      max:{ p1:maxi.c1, p2:maxi.c2, d:maxi.d, etiquette:etMax, titre:titMax },
      glisser,
    };
  }

  /* ---- un cylindre et un plan : distance surface-plan et hauteur d'axe ---- */
  const cyl = A.type === "cylindre" ? A : B.type === "cylindre" ? B : null;
  const plan = A.type === "plan" ? A : B.type === "plan" ? B : null;
  if(cyl && plan){
    const sinus = Math.abs(cyl.axe.dot(plan.normale));
    const w = new THREE.Vector3().subVectors(cyl.centre, plan.centre);
    const ecart = w.dot(plan.normale);
    const dAxe = Math.abs(ecart);
    const mini = nappeNappe(cyl, plan);
    const angleAxe = Math.asin(Math.min(1, sinus));
    const texteAxe = sinus < 1e-3 ? "axe parallèle au plan" : `axe à ${degres(angleAxe)} du plan`;
    const etMin = `${mm(mini.d)} (axe ${mm(dAxe)})`;
    const titMin = `Surface → plan (Min) ${mm(mini.d)}  ·  axe → plan ${mm(dAxe)}  ·  ` +
                   `${diam(cyl.rayon)}  ·  ${texteAxe}  ·  ${deltas(mini.c2, mini.c1)}`;
    const etMax = `${mm(maxi.d)} (Max)`;
    const titMax = `Surface → plan (Max) ${mm(maxi.d)}  ·  axe → plan ${mm(dAxe)}  ·  ` +
                   `${diam(cyl.rayon)}  ·  ${texteAxe}  ·  ${deltas(maxi.c2, maxi.c1)}`;
    return {
      p1:mini.c2, p2:mini.c1, etiquette:etMin, titre:titMin,
      extensible:true, positionActuelle:"min",
      min:{ p1:mini.c2, p2:mini.c1, d:mini.d, etiquette:etMin, titre:titMin },
      max:{ p1:maxi.c2, p2:maxi.c1, d:maxi.d, etiquette:etMax, titre:titMax },
      glisser,
    };
  }

  const mini = nappeNappe(A, B);
  const etMin = mm(mini.d);
  const titMin = `Plus court chemin (Min) ${mm(mini.d)}  ·  ${deltas(mini.c1, mini.c2)}  ·  sur le maillage`;
  const etMax = `${mm(maxi.d)} (Max)`;
  const titMax = `Plus long chemin (Max) ${mm(maxi.d)}  ·  ${deltas(maxi.c1, maxi.c2)}  ·  sur le maillage`;
  return {
    p1:mini.c1, p2:mini.c2, etiquette:etMin, titre:titMin,
    extensible:true, positionActuelle:"min",
    min:{ p1:mini.c1, p2:mini.c2, d:mini.d, etiquette:etMin, titre:titMin },
    max:{ p1:maxi.c1, p2:maxi.c2, d:maxi.d, etiquette:etMax, titre:titMax },
    glisser,
  };
}

/* ---------------------------------------------------------------------------
   Arête ↔ face
   ------------------------------------------------------------------------- */
export function mesurerAreteFace(A, B){
  const arete = A.genre === "arete" ? A : B;
  const face = A.genre === "face" ? A : B;
  const maxi = polyPolyMax(arete.pts, sommetsDeFace(face, 120));
  const glisser = (ray) => glisserAreteFace(A, B, ray);

  /* ---- Arête droite et face plane ---- */
  if(arete.type === "droite" && face.type === "plan"){
    const sinus = Math.abs(arete.dir.dot(face.normale));
    const angle = Math.asin(Math.min(1, sinus));

    if(sinus < 1e-3){
      /* Arête parallèle au plan : distance perpendiculaire */
      const m = arete.milieu;
      const w = new THREE.Vector3().subVectors(m, face.centre);
      const ecart = w.dot(face.normale);
      const d = Math.abs(ecart);
      const p1 = m.clone();
      const p2 = m.clone().addScaledVector(face.normale, -ecart);
      const et = mm(d);
      const tit = `Arête parallèle au plan  ·  distance ${mm(d)}  ·  ${deltas(p1, p2)}`;
      return {
        p1, p2, etiquette:et, titre:tit,
        extensible:true, positionActuelle:"min",
        min:{ p1, p2, d, etiquette:et, titre:tit },
        max:{ p1, p2, d, etiquette:et, titre:tit },
        glisser,
      };
    }

    /* Arête sécante ou inclinée par rapport au plan */
    const den = arete.dir.dot(face.normale);
    const w0 = new THREE.Vector3().subVectors(face.centre, arete.a);
    const t = den !== 0 ? w0.dot(face.normale) / den : 0;

    if(t >= 0 && t <= arete.longueur){
      const inter = arete.a.clone().addScaledVector(arete.dir, t);
      return {
        p1:inter, p2:inter, etiquette:degres(angle),
        titre:`Arête coupant le plan  ·  angle ${degres(angle)}  ·  point ` +
              `${cote(inter.x,2)} ; ${cote(inter.y,2)} ; ${cote(inter.z,2)}`,
        extensible:false,
      };
    }

    const tClamped = Math.max(0, Math.min(arete.longueur, t));
    const p1 = arete.a.clone().addScaledVector(arete.dir, tClamped);
    const w = new THREE.Vector3().subVectors(p1, face.centre);
    const ecart = w.dot(face.normale);
    const p2 = p1.clone().addScaledVector(face.normale, -ecart);
    const d = p1.distanceTo(p2);
    const etMin = `${mm(d)} · ${degres(angle)}`;
    const titMin = `Arête inclinée par rapport au plan (Min)  ·  distance ${mm(d)}  ·  angle ${degres(angle)}  ·  ${deltas(p1, p2)}`;
    const etMax = `${mm(maxi.d)} (Max)`;
    const titMax = `Arête inclinée par rapport au plan (Max)  ·  distance ${mm(maxi.d)}  ·  angle ${degres(angle)}  ·  ${deltas(maxi.c1, maxi.c2)}`;
    return {
      p1, p2, etiquette:etMin, titre:titMin,
      extensible:true, positionActuelle:"min",
      min:{ p1, p2, d, etiquette:etMin, titre:titMin },
      max:{ p1:maxi.c1, p2:maxi.c2, d:maxi.d, etiquette:etMax, titre:titMax },
      glisser,
    };
  }

  /* ---- Cercle (perçage) et face plane : bord et hauteur d'axe ---- */
  if(arete.type === "cercle" && face.type === "plan"){
    const w = new THREE.Vector3().subVectors(arete.centre, face.centre);
    const ecart = w.dot(face.normale);
    const dAxe = Math.abs(ecart);
    const angle = Math.acos(Math.min(1, Math.abs(arete.normale.dot(face.normale))));

    let minD = Infinity, pProche = arete.pts[0];
    for(const p of arete.pts){
      const dist = Math.abs(new THREE.Vector3().subVectors(p, face.centre).dot(face.normale));
      if(dist < minD){ minD = dist; pProche = p; }
    }
    const distP = new THREE.Vector3().subVectors(pProche, face.centre).dot(face.normale);
    const pPlan = pProche.clone().addScaledVector(face.normale, -distP);
    const dMin = pProche.distanceTo(pPlan);
    const etMin = `${mm(dMin)} (centre ${mm(dAxe)})`;
    const titMin = `Bord ${arete.ferme ? "perçage" : "arc"} → plan (Min) ${mm(dMin)}  ·  centre → plan ${mm(dAxe)}  ·  ${dimCercle(arete)}  ·  ` +
                   (angle < 1e-3 ? "plan du perçage parallèle" : `axe à ${degres(Math.abs(Math.PI/2 - angle))}`) +
                   `  ·  ${deltas(pProche, pPlan)}`;
    const etMax = `${mm(maxi.d)} (Max)`;
    const titMax = `Bord ${arete.ferme ? "perçage" : "arc"} → plan (Max) ${mm(maxi.d)}  ·  centre → plan ${mm(dAxe)}  ·  ${dimCercle(arete)}  ·  ${deltas(maxi.c1, maxi.c2)}`;

    return {
      p1:pProche, p2:pPlan, etiquette:etMin, titre:titMin,
      extensible:true, positionActuelle:"min",
      min:{ p1:pProche, p2:pPlan, d:dMin, etiquette:etMin, titre:titMin },
      max:{ p1:maxi.c1, p2:maxi.c2, d:maxi.d, etiquette:etMax, titre:titMax },
      glisser,
    };
  }

  /* ---- Cercle et face cylindrique ---- */
  if(arete.type === "cercle" && face.type === "cylindre"){
    const sommetsFace = sommetsDeFace(face, 1200);
    let meilleur = { d:Infinity, c1:arete.pts[0].clone(), c2:face.centre.clone() };
    const tri = new THREE.Triangle(), proche = new THREE.Vector3();
    for(const p of arete.pts){
      for(let i = 0; i + 2 < sommetsFace.length; i += 3){
        tri.set(sommetsFace[i], sommetsFace[i+1], sommetsFace[i+2]).closestPointToPoint(p, proche);
        const d = proche.distanceTo(p);
        if(d < meilleur.d) meilleur = { d, c1:p.clone(), c2:proche.clone() };
      }
    }
    const w = new THREE.Vector3().subVectors(arete.centre, face.point);
    const tAxe = w.dot(face.axe);
    const pAxe = face.point.clone().addScaledVector(face.axe, tAxe);
    const dAxe = arete.centre.distanceTo(pAxe);
    const concentrique = dAxe < 1e-3;
    const dimFace = face.ferme === false ? rayon(face.rayon) : diam(face.rayon);
    const etMin = concentrique ? mm(meilleur.d) : `${mm(meilleur.d)} (axe ${mm(dAxe)})`;
    const titMin = `Bord à bord (Min) ${mm(meilleur.d)}` + (concentrique ? "" : `  ·  entraxe ${mm(dAxe)}`) +
                   `  ·  ${dimCercle(arete)} / ${dimFace}  ·  ${deltas(meilleur.c1, meilleur.c2)}`;
    const etMax = `${mm(maxi.d)} (Max)`;
    const titMax = `Bord à bord (Max) ${mm(maxi.d)}` + (concentrique ? "" : `  ·  entraxe ${mm(dAxe)}`) +
                   `  ·  ${dimCercle(arete)} / ${dimFace}  ·  ${deltas(maxi.c1, maxi.c2)}`;
    return {
      p1:meilleur.c1, p2:meilleur.c2, etiquette:etMin, titre:titMin,
      extensible:true, positionActuelle:"min",
      min:{ p1:meilleur.c1, p2:meilleur.c2, d:meilleur.d, etiquette:etMin, titre:titMin },
      max:{ p1:maxi.c1, p2:maxi.c2, d:maxi.d, etiquette:etMax, titre:titMax },
      glisser,
    };
  }

  /* ---- Arête droite et cylindre ---- */
  if(arete.type === "droite" && face.type === "cylindre"){
    const w = new THREE.Vector3().subVectors(face.centre, arete.a);
    const t = Math.max(0, Math.min(arete.longueur, w.dot(arete.dir)));
    const p1 = arete.a.clone().addScaledVector(arete.dir, t);
    const wAxe = new THREE.Vector3().subVectors(p1, face.point);
    const tAxe = wAxe.dot(face.axe);
    const pAxe = face.point.clone().addScaledVector(face.axe, tAxe);
    const vRayon = new THREE.Vector3().subVectors(p1, pAxe);
    const distAxe = vRayon.length();
    const p2 = distAxe > 1e-12 ? pAxe.clone().addScaledVector(vRayon.normalize(), face.rayon) : pAxe;
    const d = p1.distanceTo(p2);
    const angle = Math.acos(Math.min(1, Math.abs(arete.dir.dot(face.axe))));
    const jeu = distAxe - face.rayon;
    const etMin = mm(Math.abs(jeu));
    const titMin = `Arête et cylindre (Min)  ·  distance axe ${mm(distAxe)}  ·  ${diam(face.rayon)}  ·  ` +
                   `${jeu >= 0 ? "jeu" : "recouvrement"} ${mm(Math.abs(jeu))}  ·  angle ${degres(angle)}`;
    const etMax = `${mm(maxi.d)} (Max)`;
    const titMax = `Arête et cylindre (Max)  ·  distance axe ${mm(distAxe)}  ·  ${diam(face.rayon)}  ·  ${deltas(maxi.c1, maxi.c2)}`;
    return {
      p1, p2, etiquette:etMin, titre:titMin,
      extensible:true, positionActuelle:"min",
      min:{ p1, p2, d:Math.abs(jeu), etiquette:etMin, titre:titMin },
      max:{ p1:maxi.c1, p2:maxi.c2, d:maxi.d, etiquette:etMax, titre:titMax },
      glisser,
    };
  }

  /* ---- Fallback : plus court chemin entre la polyligne et le maillage de la face ---- */
  const sommetsFace = sommetsDeFace(face, 1200);
  let meilleur = { d:Infinity, c1:arete.pts[0].clone(), c2:face.centre.clone() };
  const tri = new THREE.Triangle(), proche = new THREE.Vector3();

  for(const p of arete.pts){
    for(let i = 0; i + 2 < sommetsFace.length; i += 3){
      tri.set(sommetsFace[i], sommetsFace[i+1], sommetsFace[i+2]).closestPointToPoint(p, proche);
      const d = proche.distanceTo(p);
      if(d < meilleur.d){
        meilleur = { d, c1:p.clone(), c2:proche.clone() };
      }
    }
  }

  const etMin = mm(meilleur.d);
  const titMin = `Plus court chemin (Min) ${mm(meilleur.d)}  ·  ${deltas(meilleur.c1, meilleur.c2)}  ·  sur le maillage`;
  const etMax = `${mm(maxi.d)} (Max)`;
  const titMax = `Plus long chemin (Max) ${mm(maxi.d)}  ·  ${deltas(maxi.c1, maxi.c2)}  ·  sur le maillage`;

  return {
    p1:meilleur.c1, p2:meilleur.c2, etiquette:etMin, titre:titMin,
    extensible:true, positionActuelle:"min",
    min:{ p1:meilleur.c1, p2:meilleur.c2, d:meilleur.d, etiquette:etMin, titre:titMin },
    max:{ p1:maxi.c1, p2:maxi.c2, d:maxi.d, etiquette:etMax, titre:titMax },
    glisser,
  };
}

/* ---------------------------------------------------------------------------
   Aiguillage universel de mesure
   ------------------------------------------------------------------------- */
export function mesurerEntites(A, B){
  if(A.genre === "arete" && B.genre === "arete") return mesurerAretes(A, B);
  if(A.genre === "face" && B.genre === "face") return mesurerFaces(A, B);
  return mesurerAreteFace(A, B);
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
                                            : `Arc ${rayon(e.rayon)} sur ${degres(e.balaye)}`) + nom;
    return `Arête ${mm(e.longueur)}${nom}`;
  }
  if(e.type === "plan")     return `Face plane ${nombre(e.aire)} mm²${nom}`;
  if(e.type === "cylindre") return (e.ferme === false ? `Face cylindrique (congé) ${rayon(e.rayon)}` : `Face cylindrique ${diam(e.rayon)}`) + ` · hauteur ${cote(e.hauteur, 2)} mm${nom}`;
  return `Face ${nombre(e.aire)} mm²${nom}`;
}

/* ---------------------------------------------------------------------------
   Mesure d'une entité individuelle (au premier clic)
   Cercle complet → Diamètre ⌀
   Arc de cercle  → Rayon R
   Arête droite   → Longueur
   Face cylindrique → Diamètre ⌀ (complet) ou Rayon R (congé)
   Face plane     → Aire
   ------------------------------------------------------------------------- */
export function mesurerEntiteSeule(e){
  if(!e) return null;
  if(e.genre === "arete"){
    if(e.type === "cercle"){
      if(e.ferme){
        // Cercle complet -> Diamètre
        const pRef = (e.pts && e.pts.length) ? e.pts[0] : e.milieu;
        const dir = new THREE.Vector3().subVectors(pRef, e.centre);
        if(dir.lengthSq() < 1e-12){
          const rep = repere(e.normale || new THREE.Vector3(0,0,1));
          dir.copy(rep.u);
        }
        dir.normalize().multiplyScalar(e.rayon);
        const p1 = e.centre.clone().add(dir);
        const p2 = e.centre.clone().sub(dir);
        const et = `${diam(e.rayon)} mm`;
        const tit = `Cercle complet  ·  diamètre ${diam(e.rayon)} mm  (rayon ${rayon(e.rayon)} mm)` +
                    `  ·  centre (${cote(e.centre.x, 1)}, ${cote(e.centre.y, 1)}, ${cote(e.centre.z, 1)})` +
                    `  ·  choisissez un second élément`;
        return {
          genre: "cercle",
          p1, p2, ancre: e.centre.clone(),
          etiquette: et,
          titre: tit,
          d: 2 * e.rayon,
        };
      }else{
        // Arc de cercle -> Rayon
        const p1 = e.centre.clone();
        const p2 = (e.milieu || (e.pts && e.pts[Math.floor(e.pts.length/2)]))?.clone() || p1;
        const et = `${rayon(e.rayon)} mm`;
        const tit = `Arc de cercle  ·  rayon ${rayon(e.rayon)} mm  (diamètre ${diam(e.rayon)} mm)` +
                    `  ·  angle ${degres(e.balaye)}  ·  longueur ${mm(e.longueur)}` +
                    `  ·  choisissez un second élément`;
        return {
          genre: "arc",
          p1, p2, ancre: p1.clone().lerp(p2, 0.5),
          etiquette: et,
          titre: tit,
          d: e.rayon,
        };
      }
    }
    if(e.type === "droite"){
      return {
        genre: "droite",
        p1: e.a.clone(),
        p2: e.b.clone(),
        ancre: e.milieu.clone(),
        etiquette: mm(e.longueur),
        titre: `Arête droite  ·  longueur ${mm(e.longueur)}  ·  choisissez un second élément`,
        d: e.longueur,
      };
    }
    const p1 = e.pts[0].clone(), p2 = e.pts[e.pts.length - 1].clone();
    return {
      genre: "polyligne",
      p1, p2,
      ancre: (e.milieu || p1).clone(),
      etiquette: mm(e.longueur),
      titre: `Arête  ·  longueur ${mm(e.longueur)}  ·  choisissez un second élément`,
      d: e.longueur,
    };
  }

  if(e.genre === "face"){
    if(e.type === "cylindre"){
      const { u } = repere(e.axe);
      const estComplet = e.ferme !== false;
      if(estComplet){
        const p1 = e.centre.clone().addScaledVector(u, e.rayon);
        const p2 = e.centre.clone().addScaledVector(u, -e.rayon);
        return {
          genre: "cylindre",
          p1, p2, ancre: e.centre.clone(),
          etiquette: `${diam(e.rayon)} mm`,
          titre: `Face cylindrique  ·  diamètre ${diam(e.rayon)} mm  (rayon ${rayon(e.rayon)} mm)  ·  hauteur ${cote(e.hauteur, 2)} mm  ·  choisissez un second élément`,
          d: 2 * e.rayon,
        };
      }else{
        const p1 = e.centre.clone();
        const p2 = e.centre.clone().addScaledVector(u, e.rayon);
        return {
          genre: "arc_cylindre",
          p1, p2, ancre: p1.clone().lerp(p2, 0.5),
          etiquette: `${rayon(e.rayon)} mm`,
          titre: `Face cylindrique (congé)  ·  rayon ${rayon(e.rayon)} mm  (diamètre ${diam(e.rayon)} mm)  ·  hauteur ${cote(e.hauteur, 2)} mm  ·  choisissez un second élément`,
          d: e.rayon,
        };
      }
    }
    if(e.type === "plan"){
      return {
        genre: "plan",
        p1: e.centre.clone(),
        p2: e.centre.clone(),
        ancre: e.centre.clone(),
        etiquette: `${nombre(e.aire)} mm²`,
        titre: `Face plane  ·  aire ${nombre(e.aire)} mm²  ·  choisissez un second élément`,
        d: 0,
      };
    }
    return {
      genre: "face",
      p1: e.centre.clone(),
      p2: e.centre.clone(),
      ancre: e.centre.clone(),
      etiquette: `${nombre(e.aire)} mm²`,
      titre: `Face  ·  aire ${nombre(e.aire)} mm²  ·  choisissez un second élément`,
      d: 0,
    };
  }
  return null;
}
