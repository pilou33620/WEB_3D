/* =============================================================================
   Conception 3D — c10-regles.js
   Le contrôle des règles de conception (regles-conception.md) qu'un programme peut
   vérifier sur le document : esquisses entièrement contraintes, noms des paramètres,
   grille d'impression. Sans écran (banc-conception) ; la fenêtre de la page et le MCP
   montrent le même résultat. Le reste des règles ne se vérifie pas ici.
   ============================================================================= */
"use strict";

import { evaluerParametres, evaluateur } from "./c1-expressions.js";
import { resoudre, repere } from "./c2-esquisse.js";

export const PROCEDES = { fdm:"Impression FDM", injection:"Injection plastique", tolerie:"Tôlerie" };

const SNAKE_CASE = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;
// Règle 6 : les familles partagées, sans préfixe de pièce, et les références
const PARTAGES = /^(?:jeu|avant_trou_|passage_|lamage_|diam_insert_|diam_fut_|prof_vissage|ref_)|^(?:degagement_vis|marge_pcb|fond_fut|paroi_sous_tete|paroi_fond_lamage|paroi_bord_lamage|chanfrein_45|angle_chanfrein)$/;
// shortcut: le rôle d'un paramètre se déduit de son nom, un nom sans ces mots n'est pas contrôlé ; à revoir si des paramètres passent au travers
const NOM_PAROI = /paroi|epaisseur/, NOM_HAUTEUR = /hauteur|fond|prof/;

/* Les noms viennent du fichier : sans caractères de contrôle ni de sens d'écriture, bornés. */
const sur = (s) => String(s ?? "").replace(/[\u0000-\u001f\u007f‪-‮⁦-⁩]/g, "").slice(0, 120);
const multiple = (x, pas) => Math.abs(x - Math.round(x / pas) * pas) < 1e-3;
const mm = (x) => String(+x.toFixed(3)).replace(".", ",") + " mm";

/** « BoitierBas » ou « boîtier bas » → « boitier_bas_ ». */
export function prefixePiece(nom){
  return String(nom).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "").toLowerCase() + "_";
}

function esquisses(ops, gcs, v){
  const ecarts = [];
  for(const op of ops){
    if(op.type !== "esquisse") continue;
    const nom = `« ${sur(op.nom)} »`;
    const r = resoudre(gcs, structuredClone(op), v);     // le solveur écrit dans l'esquisse : un contrôle ne change rien
    if(Object.keys(r.erreurs).length) ecarts.push(`${nom} : cote illisible.`);
    else if(!r.ok) ecarts.push(`${nom} : contraintes en conflit.`);
    else if(r.dof > 0) ecarts.push(`${nom} : ${r.dof} degré(s) de liberté restant(s).`);
    // L'origine et les points projetés sont fixés par la page : seul un Fixe posé à la main est interdit
    const fixes = op.contraintes.filter(k => k.type === "fixe" && k.id !== "ko" && !k.projete).length;
    if(fixes) ecarts.push(`${nom} : ${fixes} contrainte(s) Fixe, interdites pour verrouiller (ou projection d'un ancien fichier).`);
  }
  return ecarts;
}

function parametres(doc){
  const prefixe = prefixePiece(doc.nom), ecarts = [];
  for(const { nom } of doc.parametres){
    if(!SNAKE_CASE.test(nom)) ecarts.push(`« ${sur(nom)} » : pas en snake_case.`);
    else if(!nom.startsWith(prefixe) && !PARTAGES.test(nom)) ecarts.push(`« ${nom} » : sans le préfixe « ${prefixe} » ni famille partagée.`);
  }
  return ecarts;
}

function grille(doc, ops, v, valeurs, erreurs, maillages){
  const ecarts = [];
  for(const nom of Object.keys(erreurs)) ecarts.push(`« ${sur(nom)} » : valeur illisible, non contrôlée.`);
  for(const [nom, x] of valeurs){
    if(NOM_PAROI.test(nom)){ if(!multiple(x, 0.5)) ecarts.push(`« ${sur(nom)} » = ${mm(x)} : paroi hors du pas de 0,5 mm.`); }
    else if(NOM_HAUTEUR.test(nom) && !multiple(x, 0.2)) ecarts.push(`« ${sur(nom)} » = ${mm(x)} : hauteur hors du pas de 0,2 mm.`);
  }
  for(const op of ops){
    const nom = `« ${sur(op.nom)} »`;
    try{
      if(op.type === "coque" && !multiple(v(op.epaisseur), 1))
        ecarts.push(`${nom} : épaisseur uniforme de ${mm(v(op.epaisseur))}, ni 1, 2 ou 3 mm (exception à justifier).`);
      if(op.type !== "extrusion" || op.sens === "jusqua") continue;
      const esq = doc.operations.find(o => o.id === op.esquisse);
      if(!esq || Math.abs(repere(esq.plan, v).n[2]) < 0.999) continue;   // une extrusion dans le plan XY : dimension libre
      for(const d of op.sens === "deux" ? [op.distance, op.distance2] : [op.distance])
        if(!multiple(v(d), 0.2)) ecarts.push(`${nom} : hauteur de ${mm(v(d))} hors du pas de 0,2 mm.`);
    }catch(_){ ecarts.push(`${nom} : valeur illisible, non contrôlée.`); }
  }
  for(const m of maillages){
    const b = m.proprietes?.boite;
    if(b && !multiple(b[1][2] - b[0][2], 0.2)) ecarts.push(`Corps « ${sur(m.nom)} » : hauteur hors-tout de ${mm(b[1][2] - b[0][2])} hors du pas de 0,2 mm.`);
  }
  return ecarts;
}

/**
 * Rend { procede, ok, controles:[{ regle, nom, ok, ecarts }] }, sans toucher au document. La grille
 * se lit dans le repère de la pièce (Z = hauteur d'impression) et ne vaut qu'en FDM.
 */
export function controlerRegles(doc, { gcs, maillages = [], procede = "fdm" }){
  if(!Object.hasOwn(PROCEDES, procede)) throw new Error(`Procédé inconnu : ${procede} (${Object.keys(PROCEDES).join(", ")}).`);
  const { valeurs, erreurs } = evaluerParametres(doc.parametres), v = evaluateur(valeurs);
  const ops = doc.operations.filter(o => !o.suspendue);
  const lignes = [[5, "Esquisses entièrement contraintes, sans Fixe", esquisses(ops, gcs, v)],
                  [6, "Paramètres en snake_case et préfixés", parametres(doc)]];
  if(procede === "fdm") lignes.push([15, "Grille : hauteurs × 0,2 mm, parois × 0,5 mm", grille(doc, ops, v, valeurs, erreurs, maillages)]);
  const controles = lignes.map(([regle, nom, ecarts]) => ({ regle, nom, ok:!ecarts.length, ecarts }));
  return { procede, ok:controles.every(c => c.ok), controles };
}
