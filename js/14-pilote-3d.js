/* =============================================================================
   Commandes du canal de pilotage (MCP de web_suite) pour la visionneuse 3D.

   Deux étages :
   - des FONCTIONS PURES sur une scène three.js (identifier une pièce, décrire la
     scène, mesurer, chercher les collisions, déplacer, extraire un STEP), qui
     rendent des nombres et des chaînes, jamais un Vector3 ni un maillage —
     éprouvées sous Node par test/banc-pilote-3d.mjs ;
   - brancherPilote3d, qui les déclare au canal (js/pilote.js) et fait le lien
     avec l'interface.
   Spec : web_suite/lanceur/docs/SPEC-mcp-registre-3d.md.
   ========================================================================== */

/* Arrondi au µm (ou au millième de degré) : des nombres lisibles, et -0 n'existe pas. */
function arrondir(x){ return Math.round(x * 1000) / 1000 + 0; }
const DEG = 180 / Math.PI;

/** Les pièces de la scène, dans l'ordre de l'arbre. */
export function pieces(modele){
  const liste = [];
  modele.traverse(o => { if(o.isMesh && o.userData.estPiece) liste.push(o); });
  return liste;
}

/** Chemin d'indices sous la scène : « 0/3/1 ». Calculé à la volée : il change si l'on ferme
    ou ajoute un fichier, l'uuid non. */
export function cheminDe(modele, objet){
  const indices = [];
  for(let o = objet; o && o !== modele; o = o.parent){
    if(!o.parent) return null;
    indices.unshift(o.parent.children.indexOf(o));
  }
  return indices.join("/");
}

function visibleEnTout(objet, modele){
  for(let o = objet; o && o !== modele; o = o.parent) if(!o.visible) return false;
  return true;
}

function fichierDe(modele, objet){
  let o = objet;
  while(o.parent && o.parent !== modele) o = o.parent;
  return modele.children.indexOf(o);
}

/* La sélection remplace le matériau par un clone surligné : la vraie couleur est dans matSauve. */
function couleurDe(piece){
  const m = piece.userData.matSauve || piece.material;
  return (m && m.userData && m.userData.couleurHex) || null;
}

/**
 * Une pièce par uuid ou par chemin d'indices. Un nom n'est accepté que s'il est unique :
 * les noms se répètent (8 « nut » dans l'assemblage d'exemple).
 */
export function trouverPiece(modele, ref){
  if(typeof ref !== "string" || !ref.trim()) throw new Error("Référence de pièce invalide.");
  let objet;
  if(/^\d+(\/\d+)+$/.test(ref)){
    objet = modele;
    for(const i of ref.split("/").map(Number)){
      objet = objet.children[i];
      if(!objet) throw new Error(`Pièce « ${ref} » introuvable : chemin hors de l'arbre.`);
    }
  }else if(/^[0-9A-Fa-f-]{36}$/.test(ref)){
    objet = modele.getObjectByProperty("uuid", ref);
    if(!objet) throw new Error(`Pièce « ${ref} » inconnue (uuid d'une autre session ?).`);
  }else{
    const memes = pieces(modele).filter(p => p.name === ref);
    if(!memes.length) throw new Error(`Pièce « ${ref} » inconnue.`);
    if(memes.length > 1){
      const liste = memes.map(p => `${cheminDe(modele, p)} (${p.uuid})`).join(", ");
      throw new Error(`« ${ref} » désigne ${memes.length} pièces : ${liste}. Désigne-la par son chemin ou son uuid.`);
    }
    objet = memes[0];
  }
  if(!objet.isMesh || !objet.userData.estPiece) throw new Error(`« ${ref} » n'est pas une pièce.`);
  return objet;
}

/** Les fichiers ouverts et leurs pièces, sérialisés ; filtre (sur le nom) et pagination. */
export function decrireScene(modele, { filtre = "", debut = 0, nombre = 200 } = {}){
  const fichiers = modele.children.map((g, index) => ({
    index, nom: g.name, fichier: g.userData.fichier || g.name, format: g.userData.format || "",
    pieces: pieces(g).length, visible: g.visible,
    position: g.position.toArray().map(arrondir),
    rotation_deg: [g.rotation.x, g.rotation.y, g.rotation.z].map(r => arrondir(r * DEG)),
  }));
  const toutes = pieces(modele);
  const f = String(filtre).toLowerCase();
  const trouvees = f ? toutes.filter(p => p.name.toLowerCase().includes(f)) : toutes;
  const page = trouvees.slice(Math.max(0, debut), Math.max(0, debut) + Math.max(0, Math.min(nombre, 1000)));
  return {
    fichiers, pieces_total: toutes.length, trouvees: trouvees.length, debut,
    pieces: page.map(p => ({
      uuid: p.uuid, chemin: cheminDe(modele, p), nom: p.name,
      parent: p.parent && p.parent !== modele ? p.parent.name : "",
      fichier: fichierDe(modele, p), visible: visibleEnTout(p, modele),
      triangles: p.userData.triangles || 0, couleur: couleurDe(p),
    })),
  };
}
