/* =============================================================================
   Visionneuse 3D — 02-import.js
   De l'octet au maillage affichable.

   Deux familles de formats arrivent ici, et elles ne demandent pas le même
   travail.

   · Les formats de CAO — STEP, IGES, BREP — décrivent des surfaces exactes
     (B-Rep) : des cylindres, des congés, des surfaces réglées. Une carte
     graphique ne sait dessiner que des triangles, et c'est OpenCascade qui
     fait la traduction, dans un fil d'exécution séparé.

   · Les formats de maillage — 3MF, OBJ, STL — apportent déjà des triangles.
     Le travail y est ailleurs : retrouver une hiérarchie et des noms quand le
     format en porte (3MF, OBJ), remettre les matériaux dans la forme attendue
     par le reste de la visionneuse, et ramener les cotes en millimètres.

   Dans les deux cas la sortie est la même : un groupe three.js par fichier,
   avec des maillages nommés, comptés, et des matériaux que les modes
   d'affichage (filaire, rayons X, coupe) savent manipuler.
   ============================================================================= */
"use strict";

import * as THREE from "three";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { ThreeMFLoader } from "three/addons/loaders/3MFLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { MTLLoader } from "three/addons/loaders/MTLLoader.js";
import { unzipSync, strFromU8 } from "three/addons/libs/fflate.module.js";
import { prefs } from "./00-config.js";

/* Au-delà de ce nombre de triangles, le calcul des arêtes vives coûte plus
   longtemps que la lecture du fichier elle-même : on s'abstient, sauf demande
   explicite dans les réglages. */
const SEUIL_ARETES = 2_000_000;

const COULEUR_DEFAUT = 0xa9b1bb;   // le gris-bleu des pièces sans couleur

export const FORMATS = {
  stp:"step", step:"step", stpz:"step",
  igs:"iges", iges:"iges",
  brep:"brep", brp:"brep",
  "3mf":"3mf",
  obj:"obj",
  stl:"stl",
};

/* Fichiers qui accompagnent un modèle sans en être un : la bibliothèque de
   matériaux d'un OBJ et les images qu'elle référence. Déposés avec le `.obj`,
   ils sont utilisés ; déposés seuls, ils ne sont pas une erreur de format,
   simplement rien à afficher. */
const ANNEXES = ["mtl", "png", "jpg", "jpeg", "webp", "bmp", "gif"];

export const LISTE_FORMATS = ".stp, .step, .igs, .iges, .brep, .3mf, .obj, .stl";

function extension(nomFichier){
  return (nomFichier.split(".").pop() || "").toLowerCase();
}

export function formatDe(nomFichier){
  return FORMATS[extension(nomFichier)] || null;
}

export function estAnnexe(nomFichier){
  return ANNEXES.includes(extension(nomFichier));
}

/* -----------------------------------------------------------------------------
   Le travailleur, partagé et réutilisé : recharger le noyau WebAssembly à
   chaque fichier coûterait une seconde pleine à chaque ouverture.
   --------------------------------------------------------------------------- */
let travailleur = null;
let fileAttente = Promise.resolve();

function obtenirTravailleur(){
  if(!travailleur){
    travailleur = new Worker(new URL("./travailleur-occt.js", import.meta.url));
  }
  return travailleur;
}

function lireAvecOcct(format, tampon, nom, params, surProgres){
  /* Le noyau ne traite qu'un fichier à la fois ; la file évite d'avoir à
     gérer une correspondance requête/réponse pour un gain nul. */
  const tache = fileAttente.then(() => new Promise((resoudre, rejeter) => {
    const w = obtenirTravailleur();
    const ecouter = (ev) => {
      const d = ev.data;
      if(d.type === "progres"){ surProgres?.(d.etape); return; }
      w.removeEventListener("message", ecouter);
      if(d.type === "erreur") rejeter(new Error(d.message));
      else resoudre(d);
    };
    w.addEventListener("message", ecouter);
    w.addEventListener("error", (e) => rejeter(new Error("Le lecteur CAO s'est interrompu : " + e.message)), { once:true });
    w.postMessage({ format, tampon, nom, params }, [tampon]);
  }));
  fileAttente = tache.catch(() => {});   // une erreur ne doit pas bloquer la file
  return tache;
}

/* -----------------------------------------------------------------------------
   Matériaux
   --------------------------------------------------------------------------- */

/** Un matériau par couleur : deux cents pièces grises ne font qu'un état GPU. */
function fabriqueMateriaux(){
  const cache = new Map();
  return (rvb) => {
    const couleur = rvb
      ? new THREE.Color(rvb[0], rvb[1], rvb[2]).convertSRGBToLinear()
      : new THREE.Color(COULEUR_DEFAUT).convertSRGBToLinear();
    const cle = couleur.getHexString();
    if(cache.has(cle)) return cache.get(cle);
    const m = new THREE.MeshStandardMaterial({
      color:couleur,
      metalness:0.25,
      roughness:0.52,
      side:THREE.FrontSide,
      /* Les arêtes sont dessinées sur la peau du maillage : sans ce décalage,
         elles clignotent face au tampon de profondeur. */
      polygonOffset:true, polygonOffsetFactor:1, polygonOffsetUnits:1,
    });
    marquerMateriau(m);
    cache.set(cle, m);
    return m;
  };
}

/** Les repères dont le reste de la visionneuse a besoin sur un matériau. */
function marquerMateriau(m){
  m.userData.opaciteDorigine = m.opacity ?? 1;
  /* Une couleur de three.js ne survit pas à `Material.clone()` : le clone
     sérialise userData en JSON et n'en rapporte qu'un objet nu. On garde donc
     la teinte d'origine sous forme de chaîne, lisible partout.
     `getHexString()` fait déjà la conversion de l'espace de travail vers sRGB :
     la convertir à la main en plus éclaircirait la pastille de l'arbre. */
  m.userData.couleurHex = "#" + (m.color ? m.color.getHexString() : "888888");
  return m;
}

/**
 * Les lecteurs de maillage livrent leurs propres matériaux — Phong pour l'OBJ
 * et la plupart des 3MF. On les convertit en matériaux physiques, pour que
 * toutes les pièces à l'écran réagissent à la lumière de la même façon, quel
 * que soit le format d'où elles viennent. La correspondance est faite une fois
 * par matériau source : un OBJ qui partage un matériau entre dix objets le
 * partage encore après conversion.
 */
function normaliserMateriaux(racine){
  const vus = new Map();

  const convertir = (m) => {
    if(vus.has(m.uuid)) return vus.get(m.uuid);
    let n;
    if(m.isMeshStandardMaterial || m.isMeshPhysicalMaterial){
      n = m;
    }else{
      n = new THREE.MeshStandardMaterial({
        name:m.name || "",
        color:m.color ? m.color.clone() : new THREE.Color(COULEUR_DEFAUT).convertSRGBToLinear(),
        map:m.map || null,
        vertexColors:m.vertexColors === true,
        flatShading:m.flatShading === true,
        transparent:m.transparent === true,
        opacity:m.opacity ?? 1,
        side:m.side ?? THREE.FrontSide,
        metalness:0.15,
        roughness:0.62,
      });
      m.dispose();
    }
    n.polygonOffset = true; n.polygonOffsetFactor = 1; n.polygonOffsetUnits = 1;
    marquerMateriau(n);
    vus.set(m.uuid, n);
    return n;
  };

  racine.traverse(o => {
    if(!o.isMesh || !o.material) return;
    o.material = Array.isArray(o.material) ? o.material.map(convertir) : convertir(o.material);

    /* Sans normales, un maillage est noir. Plutôt que de les calculer en les
       lissant — ce qui arrondirait les arêtes d'une pièce mécanique — on
       laisse le nuanceur les déduire face par face. */
    if(o.geometry && !o.geometry.attributes.normal){
      for(const m of [].concat(o.material)) m.flatShading = true;
    }
  });
}

/* -----------------------------------------------------------------------------
   Construction des maillages (voie OpenCascade)
   --------------------------------------------------------------------------- */
function creerGeometrie(m){
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(m.position, 3));
  if(m.normale && m.normale.length === m.position.length)
    g.setAttribute("normal", new THREE.BufferAttribute(m.normale, 3));
  if(m.index && m.index.length) g.setIndex(new THREE.BufferAttribute(m.index, 1));
  if(!g.attributes.normal) g.computeVertexNormals();
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

/**
 * Couleurs par face. Une pièce peut porter une couleur globale et, en plus,
 * des couleurs posées sur certaines faces du B-Rep. OpenCascade nous donne
 * pour chaque face l'intervalle de triangles correspondant : on en fait des
 * groupes de géométrie, ce que three.js sait rendre en un seul maillage.
 */
function appliquerCouleursFaces(geo, m, materiau){
  const faces = m.faces || [];
  const aDesCouleurs = faces.some(f => f.couleur);
  if(!aDesCouleurs) return materiau(m.couleur);

  const mats = [];
  const index = new Map();          // clé couleur -> position dans mats
  for(const f of faces){
    const mat = materiau(f.couleur || m.couleur);
    let i = index.get(mat.uuid);
    if(i === undefined){ i = mats.length; mats.push(mat); index.set(mat.uuid, i); }
    /* first/last comptent des triangles ; les groupes comptent des indices. */
    geo.addGroup(f.premier * 3, (f.dernier - f.premier + 1) * 3, i);
  }
  return mats;
}

function creerMaillage(m, materiau){
  const geo = creerGeometrie(m);
  /* Les intervalles de triangles par face B-Rep servent aux couleurs — mais
     pas seulement. C'est la topologie du modèle d'origine, la seule chose qui
     dise qu'un cylindre coupé par sa couture reste une face unique. On la
     garde même sans couleur : 06-topologie.js s'en sert pour mesurer. */
  const faces = m.faces || [];
  if(faces.length) geo.userData.facesBrep = faces.map(f => [f.premier, f.dernier]);
  const maillage = new THREE.Mesh(geo, appliquerCouleursFaces(geo, m, materiau));
  maillage.name = m.nom || "";
  return maillage;
}

function construireNoeud(noeud, maillages, materiau){
  const groupe = new THREE.Group();
  groupe.name = noeud.name || "";
  for(const i of noeud.meshes || []){
    const m = maillages[i];
    if(m) groupe.add(creerMaillage(m, materiau));
  }
  for(const enfant of noeud.children || []){
    groupe.add(construireNoeud(enfant, maillages, materiau));
  }
  return groupe;
}

/** Arêtes vives : c'est ce qui donne à un rendu 3D son allure de plan coté. */
export function calculerAretes(maillage, angle = prefs.angleAretes){
  if(maillage.userData.arete) return maillage.userData.arete;
  const geo = new THREE.EdgesGeometry(maillage.geometry, angle);
  const ligne = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
    color:0x141a20, transparent:true, opacity:0.65, depthWrite:false,
  }));
  ligne.userData.estArete = true;
  ligne.name = "arêtes";
  ligne.raycast = () => {};          // les arêtes ne sont jamais sélectionnables
  maillage.add(ligne);
  maillage.userData.arete = ligne;
  return ligne;
}

/**
 * Les fichiers exportés pièce à pièce donnent souvent une cascade de groupes
 * anonymes à un seul enfant. On la replie : l'arbre affiché doit montrer
 * l'assemblage, pas la plomberie de l'exportateur.
 */
function replier(objet){
  for(const enfant of [...objet.children]) replier(enfant);
  if(objet.isGroup && objet.children.length === 1 && !objet.name){
    const seul = objet.children[0];
    objet.parent?.add(seul);
    objet.parent?.remove(objet);
  }
}

/** Nomme, marque et compte les pièces d'un groupe fraîchement construit. */
function recenser(groupe, etat){
  groupe.traverse(o => {
    if(!o.isMesh || !o.geometry) return;
    if(!o.name) o.name = `Pièce ${etat.compteur + 1}`;
    etat.compteur++;
    o.userData.estPiece = true;
    const g = o.geometry;
    o.userData.triangles = g.index ? g.index.count / 3 : g.attributes.position.count / 3;
    etat.triangles += o.userData.triangles;
    etat.pieces++;
    if(!g.boundingBox) g.computeBoundingBox();
    if(!g.boundingSphere) g.computeBoundingSphere();
  });
}

/* -----------------------------------------------------------------------------
   Formats de maillage
   --------------------------------------------------------------------------- */

/** Le STL n'a ni hiérarchie, ni couleur, ni nom : un maillage, rien de plus. */
function lireStl(tampon, nomFichier, materiau){
  const geo = new STLLoader().parse(tampon);
  if(!geo.attributes.normal) geo.computeVertexNormals();
  const maillage = new THREE.Mesh(geo, materiau(null));
  maillage.name = nomFichier.replace(/\.[^.]+$/, "");
  const groupe = new THREE.Group();
  groupe.add(maillage);
  return groupe;
}

/* Le 3MF déclare son unité dans le fichier modèle ; le lecteur de three.js la
   laisse de côté. On la lit nous-mêmes pour ramener tout le monde au
   millimètre, faute de quoi une pièce en pouces s'afficherait 25 fois trop
   petite — et les cotes mesurées seraient fausses d'autant. */
const UNITES_3MF = { micron:0.001, millimeter:1, centimeter:10, inch:25.4, foot:304.8, meter:1000 };

function unite3mf(tampon){
  try{
    const zip = unzipSync(new Uint8Array(tampon));
    const nom = Object.keys(zip).find(n => n.toLowerCase().endsWith(".model"));
    if(!nom) return "millimeter";
    const entete = strFromU8(zip[nom].slice(0, 4096), true);
    const m = /<model[^>]*\bunit\s*=\s*"([a-z]+)"/i.exec(entete);
    return m ? m[1].toLowerCase() : "millimeter";
  }catch(e){
    /* Archive illisible ici : le lecteur dira mieux que nous ce qui cloche. */
    return "millimeter";
  }
}

function lire3mf(tampon){
  const groupe = new ThreeMFLoader().parse(tampon);
  const facteur = UNITES_3MF[unite3mf(tampon)] ?? 1;
  if(facteur !== 1) groupe.scale.setScalar(facteur);
  groupe.userData.unite3mf = unite3mf(tampon);
  return groupe;
}

/**
 * OBJ. Le format sépare la géométrie (.obj) des matériaux (.mtl) et des
 * images de texture : déposés ensemble, les trois sont recollés ici. Comme
 * aucun de ces fichiers n'a d'adresse — ils viennent du disque, pas du
 * serveur — les chemins écrits dans le .mtl sont réécrits à la volée vers les
 * fichiers effectivement déposés.
 */
async function lireObj(fichier, annexes){
  const texte = await fichier.text();
  const lecteur = new OBJLoader();
  const aLiberer = [];

  const mtl = trouverMtl(texte, annexes);
  if(mtl){
    const gestionnaire = new THREE.LoadingManager();
    const images = new Map();
    for(const [nom, f] of annexes){
      if(/\.(png|jpe?g|webp|bmp|gif)$/i.test(nom)){
        const url = URL.createObjectURL(f);
        images.set(nom, url);
        aLiberer.push(url);
      }
    }
    gestionnaire.setURLModifier((url) => {
      const cle = decodeURIComponent(url.split(/[\\/]/).pop() || "").toLowerCase();
      return images.get(cle) || url;
    });
    const materiaux = new MTLLoader(gestionnaire).parse(await mtl.text(), "");
    materiaux.preload();
    lecteur.setMaterials(materiaux);
  }

  const groupe = lecteur.parse(texte);
  /* Les images sont décodées de façon asynchrone : on ne relâche les adresses
     temporaires qu'une fois le chargement largement terminé. */
  if(aLiberer.length) setTimeout(() => aLiberer.forEach(URL.revokeObjectURL), 60_000);
  return groupe;
}

/** La bibliothèque citée par `mtllib`, ou à défaut le seul .mtl déposé. */
function trouverMtl(texteObj, annexes){
  const cite = /^\s*mtllib\s+(.+)$/im.exec(texteObj);
  if(cite){
    const nom = cite[1].trim().split(/[\\/]/).pop().toLowerCase();
    if(annexes.has(nom)) return annexes.get(nom);
  }
  const seuls = [...annexes.entries()].filter(([n]) => n.endsWith(".mtl"));
  return seuls.length === 1 ? seuls[0][1] : null;
}

/* -----------------------------------------------------------------------------
   Point d'entrée
   --------------------------------------------------------------------------- */

/**
 * Ouvre une liste de fichiers et renvoie un groupe par modèle, prêt à être
 * ajouté à la scène, accompagné de ce qu'il faut pour renseigner l'interface.
 * Les fichiers annexes (.mtl, images) accompagnent le modèle sans compter
 * comme un modèle de plus.
 */
export async function ouvrirFichiers(fichiers, { surProgres } = {}){
  const materiau = fabriqueMateriaux();
  const groupes = [];
  const etat = { compteur:0, triangles:0, pieces:0 };
  let duree = 0;

  const modeles = [], annexes = new Map();
  for(const f of fichiers){
    if(formatDe(f.name)) modeles.push(f);
    else if(estAnnexe(f.name)) annexes.set(f.name.toLowerCase(), f);
    else throw new Error(`Format non reconnu : ${f.name}\nFormats acceptés : ${LISTE_FORMATS}`);
  }
  if(!modeles.length){
    throw new Error("Aucun modèle dans ce qui a été déposé.\n" +
      "Un fichier .mtl ou une image accompagne un .obj, elle ne s'affiche pas seule.");
  }

  for(const fichier of modeles){
    const format = formatDe(fichier.name);
    surProgres?.(`Lecture de ${fichier.name}…`);
    let groupe;

    if(format === "obj"){
      groupe = await lireObj(fichier, annexes);
      normaliserMateriaux(groupe);
    }else{
      const tampon = await fichier.arrayBuffer();
      if(format === "stl"){
        groupe = lireStl(tampon, fichier.name, materiau);
      }else if(format === "3mf"){
        groupe = lire3mf(tampon);
        normaliserMateriaux(groupe);
      }else{
        let texteStep = null;
        if(format === "step"){
          try {
            texteStep = await fichier.text();
          } catch(e) {
            console.warn("Impossible de lire le texte STEP :", e);
          }
        }
        const reponse = await lireAvecOcct(format, tampon, fichier.name, {
          linearUnit: prefs.unite,
          linearDeflectionType: "bounding_box_ratio",
          linearDeflection: prefs.tolLineaire,
          angularDeflection: prefs.tolAngulaire * Math.PI / 180,
        }, surProgres);
        duree += reponse.duree || 0;
        groupe = construireNoeud(reponse.racine, reponse.maillages, materiau);
        if(texteStep) groupe.userData.stepTexte = texteStep;
      }
    }

    recenser(groupe, etat);
    groupe.name = groupe.name || fichier.name;
    groupe.userData.fichier = fichier.name;
    groupe.userData.taille = fichier.size;
    groupe.userData.format = format;
    replier(groupe);
    groupes.push(groupe);
  }

  /* Arêtes : une passe séparée, pour pouvoir y renoncer d'un coup si le
     modèle est trop lourd plutôt que de s'en apercevoir au milieu. */
  const aretesPossibles = prefs.aretesSurGrosModeles || etat.triangles <= SEUIL_ARETES;
  if(prefs.aretes && aretesPossibles){
    surProgres?.("Calcul des arêtes vives…");
    await new Promise(r => setTimeout(r));   // laisser le voile d'attente s'afficher
    for(const g of groupes) g.traverse(o => { if(o.isMesh) calculerAretes(o); });
  }

  return {
    groupes,
    stats:{
      pieces:etat.pieces,
      triangles:etat.triangles,
      duree,
      aretesIgnorees: prefs.aretes && !aretesPossibles,
    },
  };
}

/** Libère la mémoire GPU d'une branche entière. */
export function liberer(objet){
  objet.traverse(o => {
    o.geometry?.dispose?.();
    for(const m of [].concat(o.material || [])){
      m.map?.dispose?.();
      m.dispose?.();
    }
  });
}
