/* =============================================================================
   Visionneuse 3D — travailleur-occt.js
   Le fil d'exécution qui lit les fichiers CAO.

   OpenCascade compilé en WebAssembly met de quelques dixièmes de seconde à
   plusieurs minutes pour trianguler un assemblage. Sur le fil principal, la
   page paraîtrait plantée : elle ne répondrait ni au défilement, ni au
   redimensionnement, et le voile d'attente lui-même ne s'afficherait pas.
   Tout se passe donc ici.

   Le résultat d'OpenCascade arrive en tableaux JavaScript ordinaires. On les
   convertit en tableaux typés avant de les renvoyer : la copie vers le fil
   principal devient un transfert de mémoire, sans duplication ni sérialisation.
   ============================================================================= */
"use strict";

importScripts("../vendor/occt/occt-import-js.js");

let occt = null;

async function noyau(){
  if(occt) return occt;
  postMessage({ type:"progres", etape:"Chargement du noyau OpenCascade…" });
  occt = await occtimportjs({
    locateFile: (chemin) => new URL("../vendor/occt/" + chemin, self.location.href).href,
  });
  return occt;
}

/** Les trois lecteurs, choisis sur l'extension par le fil principal. */
function lire(noyauOcct, format, octets, params){
  if(format === "iges") return noyauOcct.ReadIgesFile(octets, params);
  if(format === "brep") return noyauOcct.ReadBrepFile(octets, params);
  return noyauOcct.ReadStepFile(octets, params);
}

/**
 * Conversion en tableaux typés, en collectant les tampons à transférer.
 * On en profite pour vérifier ce qui manque : certains fichiers STEP donnent
 * des maillages sans normales, qui seront recalculées côté affichage.
 */
function compacter(resultat, transferts){
  const maillages = [];
  for(const m of resultat.meshes || []){
    const pos = Float32Array.from(m.attributes?.position?.array || []);
    const idx = Uint32Array.from(m.index?.array || []);
    const nor = m.attributes?.normal?.array ? Float32Array.from(m.attributes.normal.array) : null;
    transferts.push(pos.buffer, idx.buffer);
    if(nor) transferts.push(nor.buffer);
    maillages.push({
      nom: m.name || "",
      couleur: m.color || null,
      position: pos,
      normale: nor,
      index: idx,
      faces: (m.brep_faces || []).map(f => ({ premier:f.first, dernier:f.last, couleur:f.color || null })),
    });
  }
  return maillages;
}

onmessage = async (ev) => {
  const { format, tampon, params, nom } = ev.data;
  try{
    const noyauOcct = await noyau();
    postMessage({ type:"progres", etape:`Lecture de ${nom} — triangulation des surfaces…` });

    const debut = performance.now();
    const resultat = lire(noyauOcct, format, new Uint8Array(tampon), params);
    if(!resultat || !resultat.success){
      postMessage({ type:"erreur", message:
        "OpenCascade n'a pas pu lire ce fichier. Vérifiez qu'il s'agit bien " +
        "d'un fichier " + format.toUpperCase() + " non compressé et non tronqué." });
      return;
    }

    const transferts = [];
    const maillages = compacter(resultat, transferts);
    postMessage({
      type:"ok",
      racine: resultat.root || { name:nom, meshes:maillages.map((_, i) => i), children:[] },
      maillages,
      duree: Math.round(performance.now() - debut),
    }, transferts);
  }catch(e){
    postMessage({ type:"erreur", message: (e && e.message) ? e.message : String(e) });
  }
};
