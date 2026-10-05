/* =============================================================================
   Visionneuse 3D — 12-collisions.js
   Deux cartes s'assemblent-elles sans se rentrer dedans ?

   On ne dispose que des maillages d'affichage : la question devient « des
   triangles de l'une traversent-ils des triangles de l'autre ? ». Seules les
   traversées franches comptent — chaque triangle doit passer de part et
   d'autre du plan de l'autre. Un contact (une carte posée sur une entretoise,
   deux faces qui coïncident, une arête qui frôle une face) n'est donc pas une
   collision : c'est un assemblage qui tient.

   Deux filtres évitent la comparaison de tout contre tout : les boîtes
   englobantes des pièces d'abord, puis une grille de cases dans la zone où
   deux boîtes se recouvrent.
   ============================================================================= */
"use strict";

import * as THREE from "three";

const ROUGE = 0xff2d2d;
const CASES_MAX = 64;          // par axe : au-delà, la grille coûte plus qu'elle n'épargne

/**
 * Les pièces qui se pénètrent. `racine` est le groupe du modèle : si plusieurs
 * fichiers y sont ouverts, on ne compare que des pièces de fichiers différents
 * (une carte contre l'autre) ; avec un seul fichier, toutes ses pièces entre elles.
 * `tol` : en dessous de cette distance (unités du modèle), on parle de contact.
 * Rend [{ a, b, segments, longueur }] : les segments de la courbe où leurs
 * surfaces se croisent (6 coordonnées monde chacun), et sa longueur totale.
 */
export async function chercherCollisions(racine, { tol = 0.1, surProgres, visible = () => true } = {}){
  const pieces = [];
  const parFichier = racine.children.length > 1;
  for(const fichier of racine.children){
    fichier.traverse(o => {
      if(o.isMesh && o.userData.estPiece && visible(o)){
        o.updateWorldMatrix(true, false);
        pieces.push({ m:o, cle:parFichier ? fichier : o, boite:boiteMonde(o) });
      }
    });
  }

  const paires = [];
  for(let i = 0; i < pieces.length; i++){
    for(let j = i + 1; j < pieces.length; j++){
      const A = pieces[i], B = pieces[j];
      if(A.cle === B.cle) continue;
      const zone = A.boite.clone().expandByScalar(tol).intersect(B.boite.clone().expandByScalar(tol));
      if(!zone.isEmpty()) paires.push([A.m, B.m, zone]);
    }
  }

  const monde = new Map();     // maillage -> sommets en coordonnées monde, 9 par triangle
  const sommets = (m) => { if(!monde.has(m)) monde.set(m, trianglesMonde(m)); return monde.get(m); };
  const resultats = [];
  let t = performance.now();
  for(let k = 0; k < paires.length; k++){
    const [a, b, zone] = paires[k];
    const segments = croiser(sommets(a), sommets(b), zone, tol);
    if(segments) resultats.push({ a, b, segments, longueur:longueur(segments) });
    /* Rendre la main de temps en temps : le voile d'attente doit vivre. */
    if(performance.now() - t > 40){
      surProgres?.(`${k + 1} / ${paires.length} couples de pièces`);
      await new Promise(r => setTimeout(r));
      t = performance.now();
    }
  }
  return resultats;
}

function longueur(s){
  let l = 0;
  for(let i = 0; i < s.length; i += 6) l += Math.hypot(s[i+3] - s[i], s[i+4] - s[i+1], s[i+5] - s[i+2]);
  return l;
}

/** Les courbes où les pièces se traversent, en rouge par-dessus tout le reste. */
export function maillageCollisions(resultats){
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(resultats.flatMap(r => r.segments)), 3));
  const lignes = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color:ROUGE, depthTest:false }));
  /* Dessinées sans test de profondeur : une interférence cachée au cœur de
     l'assemblage est justement celle qu'on cherche. */
  lignes.renderOrder = 10;
  lignes.raycast = () => {};
  lignes.name = "collisions";
  return lignes;
}

/* -----------------------------------------------------------------------------
   Géométrie
   --------------------------------------------------------------------------- */
function boiteMonde(m){
  if(!m.geometry.boundingBox) m.geometry.computeBoundingBox();
  return m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld);
}

function trianglesMonde(m){
  const g = m.geometry, p = g.attributes.position, idx = g.index;
  const n = idx ? idx.count / 3 : p.count / 3;
  const s = new Float32Array(n * 9), v = new THREE.Vector3();
  for(let t = 0; t < n; t++){
    for(let k = 0; k < 3; k++){
      v.fromBufferAttribute(p, idx ? idx.getX(t * 3 + k) : t * 3 + k).applyMatrix4(m.matrixWorld);
      s[t * 9 + k * 3] = v.x; s[t * 9 + k * 3 + 1] = v.y; s[t * 9 + k * 3 + 2] = v.z;
    }
  }
  return s;
}

/** Les triangles de `s` dont la boîte touche `zone`, avec leurs boîtes. */
function dansZone(s, zone){
  const ids = [], boites = [];
  for(let t = 0; t < s.length / 9; t++){
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for(let k = t * 9; k < t * 9 + 9; k += 3){
      x0 = Math.min(x0, s[k]); x1 = Math.max(x1, s[k]);
      y0 = Math.min(y0, s[k+1]); y1 = Math.max(y1, s[k+1]);
      z0 = Math.min(z0, s[k+2]); z1 = Math.max(z1, s[k+2]);
    }
    if(x1 < zone.min.x || x0 > zone.max.x || y1 < zone.min.y || y0 > zone.max.y ||
       z1 < zone.min.z || z0 > zone.max.z) continue;
    ids.push(t); boites.push(x0, y0, z0, x1, y1, z1);
  }
  return { ids, boites };
}

/** Les triangles qui se traversent entre deux pièces, ou null. */
function croiser(sA, sB, zone, tol){
  const A = dansZone(sA, zone), B = dansZone(sB, zone);
  if(!A.ids.length || !B.ids.length) return null;

  /* La grille : des cases de la taille moyenne d'un triangle de B, sans
     dépasser CASES_MAX par axe. */
  const taille = zone.getSize(new THREE.Vector3());
  let moyenne = 0;
  for(let i = 0; i < B.ids.length; i++){
    const o = i * 6;
    moyenne += Math.max(B.boites[o+3] - B.boites[o], B.boites[o+4] - B.boites[o+1], B.boites[o+5] - B.boites[o+2]);
  }
  const cote = Math.max(moyenne / B.ids.length, taille.x / CASES_MAX, taille.y / CASES_MAX, taille.z / CASES_MAX, 1e-9);
  const n = [taille.x, taille.y, taille.z].map(l => Math.max(1, Math.ceil(l / cote)));
  const caseDe = (v, axe) => Math.min(n[axe] - 1, Math.max(0, Math.floor((v - zone.min.getComponent(axe)) / cote)));
  const parcourir = (boites, i, f) => {
    const o = i * 6;
    const [ix0, iy0, iz0] = [0, 1, 2].map(a => caseDe(boites[o + a], a));
    const [ix1, iy1, iz1] = [0, 1, 2].map(a => caseDe(boites[o + 3 + a], a));
    for(let x = ix0; x <= ix1; x++) for(let y = iy0; y <= iy1; y++) for(let z = iz0; z <= iz1; z++)
      f(x + n[0] * (y + n[1] * z));
  };

  const grille = new Map();
  for(let i = 0; i < B.ids.length; i++){
    parcourir(B.boites, i, c => { let l = grille.get(c); if(!l) grille.set(c, l = []); l.push(i); });
  }

  const segments = [];
  const vu = new Int32Array(B.ids.length).fill(-1);
  const p = new Float64Array(9), q = new Float64Array(9);
  for(let i = 0; i < A.ids.length; i++){
    const ta = A.ids[i];
    for(let k = 0; k < 9; k++) p[k] = sA[ta * 9 + k];
    parcourir(A.boites, i, c => {
      for(const j of grille.get(c) || []){
        if(vu[j] === i) continue;
        vu[j] = i;
        const tb = B.ids[j];
        for(let k = 0; k < 9; k++) q[k] = sB[tb * 9 + k];
        const s = seTraversent(p, q, tol);
        if(s) segments.push(...s);
      }
    });
  }
  return segments.length ? segments : null;
}

/* -----------------------------------------------------------------------------
   Deux triangles se traversent-ils ? (d'après Möller, 1997)
   Chacun doit franchir le plan de l'autre, à plus de `tol` des deux côtés ;
   puis leurs traces sur la droite commune aux deux plans doivent se recouvrir.
   --------------------------------------------------------------------------- */
const sub = (a, i, j) => [a[j*3] - a[i*3], a[j*3+1] - a[i*3+1], a[j*3+2] - a[i*3+2]];
const vect = (u, v) => [u[1]*v[2] - u[2]*v[1], u[2]*v[0] - u[0]*v[2], u[0]*v[1] - u[1]*v[0]];
const scal = (u, a, i) => u[0]*a[i*3] + u[1]*a[i*3+1] + u[2]*a[i*3+2];

/** Distances signées des sommets de `a` au plan de `b`, ou null si `a` ne le franchit pas. */
function distances(a, b, tol){
  const nrm = vect(sub(b, 0, 1), sub(b, 0, 2));
  const l = Math.hypot(...nrm);
  if(l < 1e-12) return null;                        // triangle dégénéré
  const d0 = scal(nrm, b, 0);
  const d = [0, 1, 2].map(i => (scal(nrm, a, i) - d0) / l).map(x => Math.abs(x) < tol ? 0 : x);
  return d.some(x => x > 0) && d.some(x => x < 0) ? { d, nrm } : null;
}

/** Où le triangle `a` (distances `d` à l'autre plan) coupe ce plan : les deux
    extrémités de sa trace, chacune avec sa position `t` le long de l'axe `D`. */
function trace(a, d, D){
  let min = null, max = null;
  const garder = (x, y, z) => {
    const t = D[0]*x + D[1]*y + D[2]*z, pt = { t, xyz:[x, y, z] };
    if(!min || t < min.t) min = pt;
    if(!max || t > max.t) max = pt;
  };
  for(let i = 0; i < 3; i++){
    const j = (i + 1) % 3;
    if(d[i] === 0) garder(a[i*3], a[i*3+1], a[i*3+2]);
    if(d[i] * d[j] < 0){
      const s = d[i] / (d[i] - d[j]);
      garder(...[0, 1, 2].map(k => a[i*3+k] + (a[j*3+k] - a[i*3+k]) * s));
    }
  }
  return [min, max];
}

/** Le segment où les deux triangles se traversent, [x0,y0,z0,x1,y1,z1], ou null. */
function seTraversent(p, q, tol){
  const P = distances(p, q, tol); if(!P) return null;
  const Q = distances(q, p, tol); if(!Q) return null;
  const D = vect(Q.nrm, P.nrm);
  const l = Math.hypot(...D);
  if(l < 1e-12) return null;
  const u = D.map(x => x / l);
  const [a0, a1] = trace(p, P.d, u), [b0, b1] = trace(q, Q.d, u);
  /* Les quatre points sont sur la même droite : le recouvrement va du plus
     haut des débuts au plus bas des fins. */
  const debut = a0.t > b0.t ? a0 : b0, fin = a1.t < b1.t ? a1 : b1;
  return fin.t - debut.t > tol ? [...debut.xyz, ...fin.xyz] : null;
}
