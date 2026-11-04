/* =============================================================================
   Conception 3D — c1-expressions.js
   Les cotes s'écrivent comme dans un logiciel de CAO paramétrique :
   « 40 », « L/2 », « 2*e + 1 », « sqrt(L^2 + l^2) ». Un paramètre nommé change,
   toute la pièce suit.

   Un analyseur maison plutôt qu'`eval` : un fichier .json de conception peut
   venir d'ailleurs, il ne doit jamais pouvoir exécuter de code. On ne connaît
   que des nombres, des noms de paramètres, + − × ÷ ^ % et quelques fonctions.
   Les fonctions trigonométriques comptent en degrés, comme les cotes d'angle.
   ============================================================================= */
"use strict";

const DEG = Math.PI / 180;

const FONCTIONS = {
  sin:(a) => Math.sin(a * DEG), cos:(a) => Math.cos(a * DEG), tan:(a) => Math.tan(a * DEG),
  asin:(a) => Math.asin(a) / DEG, acos:(a) => Math.acos(a) / DEG, atan:(a) => Math.atan(a) / DEG,
  sqrt:Math.sqrt, abs:Math.abs, round:Math.round, floor:Math.floor, ceil:Math.ceil,
  min:Math.min, max:Math.max,
};
const CONSTANTES = { pi:Math.PI };
/* Les cotes se calculent en mm et en degrés : un suffixe convertit le nombre qu'il suit. */
const UNITES = { mm:1, cm:10, m:1000, in:25.4, "°":1, deg:1 };

/** Découpe en jetons. « 2,5 » seul est lu comme 2.5 : la virgule décimale des Français. */
function jetons(texte){
  let s = String(texte ?? "").trim();
  if(/^-?\d+,\d+$/.test(s)) s = s.replace(",", ".");
  const sortie = [];
  const re = /\s*(?:(\d+(?:\.\d*)?(?:e[+-]?\d+)?|\.\d+)\s*(mm|cm|deg|in|m(?![\wÀ-ÿ])|°)?(?![\wÀ-ÿ])|([A-Za-z_À-ÿ][\wÀ-ÿ]*)|(\*\*|[-+*/^%(),]))/gy;
  let m;
  while(re.lastIndex < s.length){
    const debut = re.lastIndex;
    m = re.exec(s);
    if(!m || m.index !== debut){
      if(/^\s*$/.test(s.slice(debut))) break;
      throw new Error(`caractère inattendu « ${s.slice(debut).trim()[0]} »`);
    }
    if(m[1] !== undefined) sortie.push({ t:"n", v:parseFloat(m[1]) * (UNITES[m[2]] ?? 1) });
    else if(m[3] !== undefined) sortie.push({ t:"id", v:m[3] });
    else sortie.push({ t:m[4] === "**" ? "^" : m[4] });
  }
  return sortie;
}

/** Évalue `texte` ; `valeur(nom)` rend la valeur d'un paramètre (ou lève une erreur). */
export function evaluer(texte, valeur = () => { throw new Error("aucun paramètre"); }){
  if(typeof texte === "number") return texte;
  const j = jetons(texte);
  if(!j.length) throw new Error("expression vide");
  let i = 0;
  const voir = () => j[i]?.t;
  const prendre = (t) => { if(voir() !== t) throw new Error(`« ${t} » attendu`); i++; };

  function somme(){
    let v = produit();
    while(voir() === "+" || voir() === "-") v = j[i++].t === "+" ? v + produit() : v - produit();
    return v;
  }
  function produit(){
    let v = unaire();
    while(voir() === "*" || voir() === "/" || voir() === "%"){
      const op = j[i++].t, d = unaire();
      v = op === "*" ? v * d : op === "/" ? v / d : v % d;
    }
    return v;
  }
  function unaire(){
    if(voir() === "-"){ i++; return -unaire(); }
    if(voir() === "+"){ i++; return unaire(); }
    return puissance();
  }
  function puissance(){
    const b = atome();
    if(voir() === "^"){ i++; return b ** unaire(); }   // à droite : 2^3^2 = 2^9
    return b;
  }
  function atome(){
    const jt = j[i++];
    if(!jt) throw new Error("expression incomplète");
    if(jt.t === "n") return jt.v;
    if(jt.t === "(") { const v = somme(); prendre(")"); return v; }
    if(jt.t === "id"){
      const nom = jt.v;
      if(voir() === "("){
        const f = FONCTIONS[nom.toLowerCase()];
        if(!f) throw new Error(`fonction inconnue « ${nom} »`);
        i++;
        const args = [somme()];
        while(voir() === ","){ i++; args.push(somme()); }
        prendre(")");
        return f(...args);
      }
      if(nom.toLowerCase() in CONSTANTES) return CONSTANTES[nom.toLowerCase()];
      return valeur(nom);
    }
    throw new Error(`« ${jt.t} » inattendu`);
  }

  const v = somme();
  if(i < j.length) throw new Error(`« ${j[i].v ?? j[i].t} » inattendu`);
  if(!Number.isFinite(v)) throw new Error("résultat non fini (division par zéro ?)");
  return v;
}

export const NOM_PARAMETRE = /^[A-Za-z_À-ÿ][\wÀ-ÿ]*$/;

/**
 * Les valeurs de tous les paramètres, dans n'importe quel ordre de déclaration :
 * « l = L/2 » peut précéder « L = 40 ». Un cycle ou une erreur est rendu par nom,
 * sans arrêter les autres.
 */
export function evaluerParametres(parametres){
  const parNom = new Map(parametres.map(p => [p.nom, p]));
  const valeurs = new Map(), erreurs = {}, enCours = new Set();
  const calculer = (nom) => {
    if(valeurs.has(nom)) return valeurs.get(nom);
    const p = parNom.get(nom);
    if(!p) throw new Error(`paramètre inconnu « ${nom} »`);
    if(enCours.has(nom)) throw new Error(`« ${nom} » dépend de lui-même`);
    enCours.add(nom);
    try{
      const v = evaluer(p.expr, calculer);
      valeurs.set(nom, v);
      return v;
    }finally{ enCours.delete(nom); }
  };
  for(const p of parametres){
    if(!NOM_PARAMETRE.test(p.nom)){ erreurs[p.nom] = "nom invalide"; continue; }
    if(p.nom.toLowerCase() in CONSTANTES || p.nom.toLowerCase() in FONCTIONS){ erreurs[p.nom] = "nom réservé"; continue; }
    try{ calculer(p.nom); }catch(e){ erreurs[p.nom] = e.message; }
  }
  return { valeurs, erreurs };
}

/** Active une configuration : ses valeurs remplacent les expressions des paramètres qu'elle connaît. */
export function appliquerConfiguration(doc, nom){
  const c = (doc.configurations || []).find(x => x.nom === nom);
  if(!c) return false;
  for(const p of doc.parametres) if(c.valeurs[p.nom] !== undefined) p.expr = c.valeurs[p.nom];
  doc.configActive = nom;
  return true;
}

/** Lit un CSV « nom;expression » (ou « nom,expression ») ; rend les paramètres, ignore l'en-tête. */
export function lireParametresCsv(texte){
  const sortie = [];
  for(const l of texte.split(/\r?\n/)){
    const m = l.match(/^\s*"?([^";,]+)"?\s*[;,]\s*"?(.*?)"?\s*$/);
    if(m && NOM_PARAMETRE.test(m[1].trim())) sortie.push({ nom:m[1].trim(), expr:m[2].trim() });
  }
  return sortie.filter(p => !(p.nom.toLowerCase() === "nom" && /^expr/i.test(p.expr)));
}

/** Une fonction `v(expr)` liée aux paramètres, pour les opérations et les cotes. */
export function evaluateur(valeurs){
  return (expr) => evaluer(expr, (nom) => {
    if(!valeurs.has(nom)) throw new Error(`paramètre inconnu « ${nom} »`);
    return valeurs.get(nom);
  });
}
