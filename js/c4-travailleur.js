/* =============================================================================
   Conception 3D — c4-travailleur.js
   Le fil d'exécution du noyau : OpenCascade (replicad) reconstruit la pièce
   ici, la page ne se fige jamais pendant un congé ou un booléen.

   Les maillages repartent au format du lecteur STEP de la visionneuse
   (travailleur-occt.js : position, normale, index, faces) : la construction
   des objets three.js, la mesure, la coupe et l'arbre servent sans changement.
   S'y ajoutent les arêtes exactes du B-Rep, que l'on dessine au lieu de les
   deviner sur les triangles, et que l'on désigne pour un congé.

   Messages reçus : { id, type:"construire", doc, tolerance }
                    { id, type:"exporter", doc, format:"step"|"stl", corps:[noms] }
   ============================================================================= */
"use strict";

import opencascade from "../vendor/replicad/replicad_single.js";
import * as R from "../vendor/replicad/replicad.js";
import { construire, messageErreur } from "./c3-operations.js";
import { ecrireDxf } from "./c3b-ateliers.js";
import { cheminsEnPolylignes, vec, axePerpendiculaire } from "./c2-esquisse.js";

let oc = null;
let policeChargee = false;
const cache = [], cachePlat = [];     // la tôle dépliée se construit à part : les deux restent prêtes

async function noyau(){
  if(oc) return oc;
  postMessage({ type:"progres", etape:"Chargement du noyau OpenCascade…" });
  oc = await opencascade({ locateFile:(f) => new URL("../vendor/replicad/" + f, import.meta.url).href });
  R.setOC(oc);
  return oc;
}

/** Les polylignes des arêtes en segments (paires de points), avec l'arête de chaque segment. */
function segmentsAretes(m){
  const seg = [], arete = [];
  m.edgeGroups.forEach((g, k) => {
    for(let i = g.start; i < g.start + g.count - 1; i++){
      seg.push(...m.lines.slice(i * 3, i * 3 + 6));
      arete.push(k);
    }
  });
  return { position:Float32Array.from(seg), arete:Uint32Array.from(arete) };
}

function mailler(c, tol, transferts){
  const m = c.shape.mesh({ tolerance:tol, angularTolerance:15 });
  const e = segmentsAretes(c.shape.meshEdges({ tolerance:tol, angularTolerance:15 }));
  const position = Float32Array.from(m.vertices), normale = Float32Array.from(m.normals), index = Uint32Array.from(m.triangles);
  transferts.push(position.buffer, normale.buffer, index.buffer, e.position.buffer, e.arete.buffer);
  let proprietes = null;
  try{
    const p = R.measureShapeVolumeProperties(c.shape);
    const bb = c.shape.boundingBox.bounds;
    /* Une surface n'a pas de volume ; un solide retourné compte quand même sa matière. */
    proprietes = { volume:c.surface ? 0 : Math.abs(p.volume), centre:p.centerOfMass, aire:R.measureArea(c.shape), boite:bb };
  }catch(_){ /* une forme sans volume (STEP de surfaces) : pas de propriétés de masse */ }
  return {
    nom:c.nom, reference:!!c.reference, surface:!!c.surface, couleur:null, position, normale, index,
    /* start/count comptent des indices de sommets ; la visionneuse attend des triangles */
    faces:m.faceGroups.map(f => ({ premier:f.start / 3, dernier:(f.start + f.count) / 3 - 1, couleur:null })),
    aretes:e, proprietes,
  };
}

/* Un message à la fois : `construire` attend (import STEP), et deux reconstructions
   entrelacées se partageraient le même cache. */
let file = Promise.resolve();
onmessage = (ev) => { file = file.then(() => traiter(ev)); };

/** Le développé en DXF : le contour de la peau supérieure des tôles, et les lignes de pli. */
function developpe(res){
  const contour = [], plis = [];
  for(const c of res.corps){
    const t = c.tole;
    if(!t) continue;
    const x = t.x || axePerpendiculaire(t.n), y = vec.vect(t.n, x), z = t.z0 + t.ep;
    const P = (p) => [vec.scal(p, x), vec.scal(p, y)];
    const m = c.shape.meshEdges({ tolerance:0.02, angularTolerance:5 });
    for(const g of m.edgeGroups){
      const pts = [];
      for(let i = g.start; i < g.start + g.count; i++) pts.push(m.lines.slice(i * 3, i * 3 + 3));
      if(pts.every(p => Math.abs(vec.scal(p, t.n) - z) < 1e-4)) pts.slice(1).forEach((p, i) => contour.push([P(pts[i]), P(p)]));
    }
    for(const pl of t.plis){
      for(const d of [0, pl.ba]){
        const a = vec.ajout(pl.A, pl.o, d);
        plis.push([P(a), P(vec.ajout(a, pl.u, pl.longueur))]);
      }
    }
  }
  if(!contour.length) throw new Error("aucune tôle dans cette pièce");
  return ecrireDxf(contour, plis);
}

async function traiter(ev){
  const { id, type, doc } = ev.data;
  try{
    await noyau();
    if(type === "contourTexte"){
      if(!policeChargee){ await R.loadFont(new URL("../vendor/polices/DejaVuSans.ttf", import.meta.url).href); policeChargee = true; }
      postMessage({ id, type:"ok", lignes:cheminsEnPolylignes(R.drawText(ev.data.contenu, { fontSize:ev.data.h }).toSVGPaths().flat()) });
      return;
    }
    /* La police n'est chargée que si une esquisse écrit du texte. */
    if(!policeChargee && doc?.operations.some(o => o.elements?.some(e => e.type === "texte") || (o.type === "composant" && o.donnees?.includes('"texte"')))){
      await R.loadFont(new URL("../vendor/polices/DejaVuSans.ttf", import.meta.url).href);
      policeChargee = true;
    }
    const debut = performance.now();
    if(type === "developpe"){
      const plat = await construire(R, doc, [], oc, { plat:true });
      /* Le développé rejoue l'historique à plat : ce qui suit un pli ne s'y reporte pas toujours. */
      const PLIS = ["tole", "bride", "ourlet", "pli", "esquisse", "plan", "axe", "point", "image", "filetage"];
      const premier = doc.operations.findIndex(o => ["bride", "ourlet", "pli"].includes(o.type));
      const apres = premier < 0 ? [] : doc.operations.slice(premier).filter(o => !PLIS.includes(o.type) && !o.suspendue).map(o => o.nom);
      const enErreur = doc.operations.filter(o => plat.etats[o.id]?.erreur).map(o => o.nom);
      postMessage({ id, type:"ok", dxf:developpe(plat), enErreur, apres });
      return;
    }
    if(type === "planter") throw new WebAssembly.RuntimeError("panne simulée");     // pour le banc de la page
    const res = await construire(R, doc, ev.data.plat ? cachePlat : cache, oc, { plat:!!ev.data.plat,
      surOperation:(opId) => postMessage({ type:"etape", opId }) });
    if(type === "exporter"){
      const choisis = res.corps.filter(c => ev.data.corps.includes(c.nom));
      if(!choisis.length) throw new Error("aucun corps à exporter");
      /* makeCompound détruit ce qu'il reçoit : jamais les formes du cache. */
      const forme = choisis.length === 1 ? choisis[0].shape : R.makeCompound(choisis.map(c => c.shape.clone()));
      const blob = ev.data.format === "stl" ? forme.blobSTL({ tolerance:0.02, angularTolerance:5, binary:true })
        : R.exportSTEP(choisis.map(c => ({ shape:c.shape, name:c.nom })), { unit:{ mm:"MM", cm:"CM", m:"M", in:"INCH" }[doc.unite] || "MM", modelUnit:"MM" });
      postMessage({ id, type:"fichier", blob });
      return;
    }
    const transferts = [];
    const maillages = [];
    postMessage({ type:"etape", opId:null });       // le maillage n'est la faute d'aucune opération
    for(const c of res.corps){
      try{ maillages.push(mailler(c, ev.data.tolerance || 0.05, transferts)); }
      catch(e){
        if(e instanceof WebAssembly.RuntimeError) throw e;        // le noyau est mort : la page en relance un
        maillages.push({ nom:c.nom, erreur:messageErreur(e, oc) });
      }
    }
    postMessage({ id, type:"ok", maillages, etats:res.etats, erreursParametres:res.erreursParametres,
                  duree:Math.round(performance.now() - debut), tas:oc.wasmMemory?.buffer.byteLength ?? 0 }, transferts);
  }catch(e){
    /* Une panne du noyau : son tas est abîmé, seule la page peut en relancer un neuf. */
    const fatale = e instanceof WebAssembly.RuntimeError || e?.opId !== undefined;
    postMessage({ id, type:"erreur", message:messageErreur(e, oc), fatale, opId:e?.opId });
  }
}
