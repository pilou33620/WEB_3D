/* =============================================================================
   Conception 3D — c7-frise.js
   La frise d'historique, comme celle de Fusion ou de solidcraft : une icône
   par opération dans l'ordre de construction, un marqueur qu'on fait glisser
   pour revenir en arrière, des boutons pour rejouer pas à pas, le glisser-
   déposer pour réordonner, des dossiers repliables, un menu au clic droit.

   Le marqueur est le « curseur » du document (doc.curseur : nombre
   d'opérations construites, absent = toutes). Les dossiers sont une liste
   { id, nom, ops:[ids], replie } d'opérations contiguës (doc.dossiers).
   Les règles — qui peut passer avant qui, ce que devient un dossier après un
   déplacement — sont des fonctions pures, vérifiées par le banc sous Node.
   ============================================================================= */
"use strict";

import { TYPES, nomHistorique } from "./c3-operations.js";
import { demanderTexte, avertir } from "./c0-dialogues.js";

const TYPE_GLISSE = "application/x-web3d-operation";      // un fichier glissé sur la frise n'est pas une opération

/** Les esquisses dont une opération a besoin : elles doivent la précéder. */
export function dependances(op, ops = []){
  /* Les corps visés par leur nom : c'est l'opération qui les a créés (op.corpsNom) qui doit précéder. */
  const noms = [op.corps, op.cible, op.corpsA, op.corpsB, op.outil, op.reference, ...(op.outils || []), ...(op.suiveurs || [])].filter(Boolean).map(n => n.split(" · ")[0]);
  const createurs = ops.filter(o => o !== op && noms.includes(o.corpsNom)).map(o => o.id);
  const axe = typeof op.axe === "string" && op.axe.startsWith("ref:") ? op.axe.slice(4) : null;
  const planVise = op.type === "diviser" && op.mode === "plan" ? op.plan : null;
  return [op.esquisse, op.chemin, op.plan?.ref, axe, op.pilote, planVise, ...(op.esquisses || []), ...createurs].filter(Boolean);
}

/** L'ordre des opérations après avoir déplacé celle d'indice `de` à l'indice `vers`. */
function ordre(ops, de, vers){
  const r = ops.slice();
  const [op] = r.splice(de, 1);
  r.splice(vers, 0, op);
  return r;
}

/** null si le déplacement est permis, sinon la raison. */
export function deplacementRefuse(ops, de, vers){
  const r = ordre(ops, de, vers);
  const rang = new Map(r.map((o, i) => [o.id, i]));
  for(const o of r){
    for(const d of dependances(o, r)){
      if(rang.has(d) && rang.get(d) > rang.get(o.id)){
        const dep = r[rang.get(d)];
        return `« ${o.nom} » utilise « ${dep.nom} » : elle doit rester après.`;
      }
    }
  }
  return null;
}

/** Un dossier garde des opérations contiguës : celles qui s'en sont écartées en sortent. */
export function normaliserDossiers(doc){
  const rang = new Map(doc.operations.map((o, i) => [o.id, i]));
  doc.dossiers = (doc.dossiers || []).map(d => {
    const idx = d.ops.filter(id => rang.has(id)).map(id => rang.get(id)).sort((a, b) => a - b);
    const suite = idx.length ? [idx[0]] : [];
    for(let i = 1; i < idx.length && idx[i] === suite[suite.length - 1] + 1; i++) suite.push(idx[i]);
    return { ...d, ops:suite.map(i => doc.operations[i].id) };
  }).filter(d => d.ops.length);
}

/** Déplace une opération ; le marqueur reste au même nombre d'opérations construites.
    Déposée entre deux membres d'un dossier, elle y entre ; sortie de son dossier, elle le quitte. */
export function deplacer(doc, de, vers){
  const id = doc.operations[de].id;
  doc.operations = ordre(doc.operations, de, vers);
  const rang = new Map(doc.operations.map((o, i) => [o.id, i]));
  doc.dossiers = (doc.dossiers || []).map(d => {
    const autres = d.ops.filter(x => x !== id && rang.has(x)).map(x => rang.get(x));
    if(!autres.length) return d;
    const [min, max] = [Math.min(...autres), Math.max(...autres)];
    const dedans = vers > min && vers < max || vers === min - 1 && d.ops.includes(id) || vers === max + 1 && d.ops.includes(id);
    return { ...d, ops:dedans ? [...d.ops.filter(x => x !== id), id] : d.ops.filter(x => x !== id) };
  });
  normaliserDossiers(doc);
}

/** Retire une opération de son dossier ; prise au milieu, elle coupe le dossier en deux. */
export function retirerDuDossier(doc, dossierId, opId){
  const d = (doc.dossiers || []).find(x => x.id === dossierId);
  if(!d) return;
  const k = d.ops.indexOf(opId);
  if(k < 0) return;
  const avant = d.ops.slice(0, k), apres = d.ops.slice(k + 1);
  d.ops = avant.length ? avant : apres;
  if(avant.length && apres.length){
    doc.compteur = (doc.compteur || 0) + 1;
    doc.dossiers.splice(doc.dossiers.indexOf(d) + 1, 0, { id:"d" + doc.compteur, nom:d.nom + " (suite)", ops:apres, replie:d.replie });
  }
  normaliserDossiers(doc);
}

/** Un dossier sur des opérations contiguës (prises dans l'ordre de l'historique). */
export function creerDossier(doc, ids, nom){
  const rang = new Map(doc.operations.map((o, i) => [o.id, i]));
  const idx = ids.filter(id => rang.has(id)).map(id => rang.get(id)).sort((a, b) => a - b);
  if(!idx.length) return "aucune opération choisie";
  if(idx[idx.length - 1] - idx[0] !== idx.length - 1) return "un dossier regroupe des opérations qui se suivent dans l'historique";
  const membres = idx.map(i => doc.operations[i].id);
  doc.dossiers = (doc.dossiers || []).map(d => ({ ...d, ops:d.ops.filter(id => !membres.includes(id)) }));
  doc.compteur = (doc.compteur || 0) + 1;
  doc.dossiers.push({ id:"d" + doc.compteur, nom, ops:membres, replie:false });
  normaliserDossiers(doc);
  return null;
}

/* =============================================================================
   L'affichage
   ============================================================================= */
export class Frise {
  /** ctrl : le contrôleur de c6-conception.js (doc, resultat, selOps, editer, menu…). */
  constructor(ctrl, piste){
    this.ctrl = ctrl;
    this.piste = piste;
  }

  rendre(){
    const { ctrl, piste } = this;
    const ops = ctrl.doc.operations;
    const fin = Math.min(ctrl.doc.curseur ?? ops.length, ops.length);
    const etats = ctrl.resultat?.etats || {};
    const dossierDe = new Map();
    for(const d of ctrl.doc.dossiers || []) for(const id of d.ops) dossierDe.set(id, d);
    piste.replaceChildren();
    if(!ops.length){
      piste.appendChild(Object.assign(document.createElement("span"), { className:"frise-vide",
        textContent:"Les opérations s'aligneront ici, dans l'ordre de construction." }));
    }

    let parent = piste, marquePose = false;
    const marqueur = () => { marquePose = true; return this.marqueur(); };
    for(let i = 0; i < ops.length; i++){
      const op = ops[i];
      const d = dossierDe.get(op.id);
      if(d && d.ops[0] === op.id){
        const boite = document.createElement("div");
        boite.className = "dossier-frise";
        boite.appendChild(this.teteDossier(d, i));
        piste.appendChild(boite);
        if(d.replie){
          /* Dossier replié : le marqueur qui tombe dedans se pose après lui. */
          const dernier = i + d.ops.length - 1;
          if(fin === i) boite.before(marqueur());
          else if(fin > i && fin <= dernier) piste.appendChild(marqueur());
          i = dernier;
          continue;
        }
        parent = boite;
      }
      if(i === fin) parent.appendChild(marqueur());
      parent.appendChild(this.puce(op, i, i >= fin, etats[op.id]?.erreur));
      if(d && d.ops[d.ops.length - 1] === op.id) parent = piste;
    }
    if(!marquePose) piste.appendChild(this.marqueur());
  }

  puce(op, i, apres, erreur){
    const { ctrl } = this;
    const b = document.createElement("div");
    b.className = "puce";
    b.classList.toggle("sel", ctrl.selOps.has(op.id));
    b.classList.toggle("apres", apres);
    b.classList.toggle("suspendue", !!op.suspendue);
    b.classList.toggle("erreur", !!erreur);
    b.textContent = TYPES[op.type]?.icone || "?";
    const ms = ctrl.resultat?.etats?.[op.id]?.ms;
    b.title = `${nomHistorique(op)}${ms >= 100 ? `\n${(ms / 1000).toFixed(1).replace(".", ",")} s de calcul` : ""}${erreur ? `\n⚠ ${erreur}` : ""}${op.suspendue ? "\n(suspendue)" : ""}${apres ? "\n(après le marqueur : non construite)" : ""}\nDouble-clic : modifier · clic droit : menu · glisser : réordonner`;
    b.dataset.index = i;
    b.onclick = (e) => ctrl.choisirOperation(op.id, e.shiftKey || e.ctrlKey || e.metaKey);
    b.ondblclick = () => ctrl.editer(op);
    b.oncontextmenu = (e) => {
      e.preventDefault();
      if(!ctrl.selOps.has(op.id)) ctrl.choisirOperation(op.id, false);   // sur une sélection multiple, on la garde
      this.menuOperation(op, i, e);
    };
    /* Réordonner : glisser-déposer natif, la barre jaune dit où l'icône tombera. */
    b.draggable = true;
    b.ondragstart = (e) => { e.dataTransfer.setData(TYPE_GLISSE, String(i)); e.dataTransfer.effectAllowed = "move"; b.classList.add("trainee"); };
    b.ondragend = () => b.classList.remove("trainee");
    b.ondragover = (e) => {
      if(!e.dataTransfer.types.includes(TYPE_GLISSE)) return;      // un fichier déposé : laissé à l'ouverture
      e.preventDefault();
      const apresMoitie = e.offsetX > b.offsetWidth / 2;
      b.classList.toggle("depot-apres", apresMoitie);
      b.classList.toggle("depot-avant", !apresMoitie);
    };
    b.ondragleave = () => b.classList.remove("depot-avant", "depot-apres");
    b.ondrop = (e) => {
      if(!e.dataTransfer.types.includes(TYPE_GLISSE)) return;
      e.preventDefault();
      e.stopPropagation();
      const apresMoitie = b.classList.contains("depot-apres");
      b.classList.remove("depot-avant", "depot-apres");
      const de = +e.dataTransfer.getData(TYPE_GLISSE);
      let vers = i + (apresMoitie ? 1 : 0);
      if(de < vers) vers--;
      if(Number.isInteger(de) && de !== vers) ctrl.reordonner(de, vers);
    };
    return b;
  }

  teteDossier(d, i){
    const { ctrl } = this;
    const t = document.createElement("div");
    t.className = "puce tete";
    t.dataset.index = i;                  // le marqueur posé devant le dossier : avant son premier membre
    t.textContent = `${d.replie ? "▸" : "▾"} ▤ ${d.nom}`;
    t.title = `Dossier « ${d.nom} » (${d.ops.length} opération${d.ops.length > 1 ? "s" : ""}) — clic : replier / déplier · clic droit : menu`;
    t.onclick = () => ctrl.changerDossier(d.id, (x) => { x.replie = !x.replie; }, false);
    t.oncontextmenu = (e) => {
      e.preventDefault();
      ctrl.menu([
        { texte:d.replie ? "Déplier" : "Replier", action:() => ctrl.changerDossier(d.id, (x) => { x.replie = !x.replie; }, false) },
        { texte:"Renommer le dossier…", action:async () => {
          const nom = await demanderTexte("Renommer le dossier", "Nom", d.nom);
          if(nom?.trim()) ctrl.changerDossier(d.id, (x) => { x.nom = nom.trim(); });
        } },
        { texte:"Supprimer le dossier (garder les opérations)", action:() => ctrl.supprimerDossier(d.id) },
      ], e.clientX, e.clientY);
    };
    return t;
  }

  menuOperation(op, i, e){
    const { ctrl } = this;
    const dossier = (ctrl.doc.dossiers || []).find(d => d.ops.includes(op.id));
    const choisis = ctrl.selOps.size > 1 ? [...ctrl.selOps] : [op.id];
    ctrl.menu([
      { texte:"Modifier", action:() => ctrl.editer(op) },
      { texte:"Renommer…", action:async () => {
        const nom = await demanderTexte("Renommer l'opération", "Nom", op.nom);
        if(nom?.trim()) ctrl.modifierDoc(() => { op.nom = nom.trim(); });
      } },
      { texte:op.suspendue ? "Réactiver" : "Suspendre", action:() => ctrl.modifierDoc(() => { op.suspendue = !op.suspendue; }) },
      { texte:"Inspecter : ce qu'elle cite, ce qui s'appuie sur elle", action:() => {
        const ops = ctrl.doc.operations, nom = (id) => ops.find(o => o.id === id)?.nom;
        const cite = dependances(op, ops).map(nom).filter(Boolean), appuis = ops.filter(o => o !== op && dependances(o, ops).includes(op.id)).map(o => o.nom);
        const note = ctrl.resultat?.etats?.[op.id];
        avertir(`« ${op.nom} »\nCite : ${cite.join(", ") || "rien"}\nSert à : ${appuis.join(", ") || "rien"}${note?.ms !== undefined ? `\nCalcul : ${note.ms} ms` : ""}${note?.erreur ? `\n⚠ ${note.erreur}` : ""}`);
      } },
      { texte:choisis.length > 1 ? `Copier les ${choisis.length} opérations (Ctrl+C)` : "Copier (Ctrl+C)", action:() => ctrl.copierOps() },
      { texte:"Placer le marqueur après", action:() => ctrl.placerCurseur(i + 1) },
      { texte:"Supprimer", action:() => ctrl.supprimerOperation(op) },
      "-",
      { texte:choisis.length > 1 ? `Nouveau dossier avec les ${choisis.length} opérations` : "Nouveau dossier avec cette opération",
        action:() => ctrl.nouveauDossier(choisis) },
      ...(dossier ? [
        { texte:`Retirer du dossier « ${dossier.nom} »`, action:() => ctrl.modifierDoc(() => retirerDuDossier(ctrl.doc, dossier.id, op.id)) },
      ] : []),
    ], e.clientX, e.clientY);
  }

  /** Le marqueur bleu : on le glisse entre les icônes, la pièce se reconstruit au lâcher. */
  marqueur(){
    const { ctrl, piste } = this;
    const m = document.createElement("div");
    m.className = "marqueur";
    m.title = "Marqueur d'historique : glissez-le pour revenir en arrière (les opérations après lui ne sont pas construites)";
    m.onpointerdown = (e) => {
      if(e.button !== 0) return;
      e.preventDefault();
      m.classList.add("glisse");
      let n = null;
      /* Sur la fenêtre et non par capture : on déplace le marqueur dans le DOM pendant le glissé,
         et Chromium perd la capture d'un élément qu'on déplace. */
      const bouger = (ev) => {
        /* Position = indice de la première icône (ou tête de dossier) dont le milieu est à droite du pointeur. */
        const puces = [...piste.querySelectorAll(".puce")];
        const suivante = puces.find(p => { const r = p.getBoundingClientRect(); return r.left + r.width / 2 > ev.clientX; });
        n = suivante ? +suivante.dataset.index : ctrl.doc.operations.length;
        if(suivante) (suivante.classList.contains("tete") ? suivante.parentElement : suivante).before(m);
        else piste.appendChild(m);
      };
      const lacher = () => {
        removeEventListener("pointermove", bouger);
        removeEventListener("pointerup", lacher);
        m.classList.remove("glisse");
        if(n !== null) ctrl.placerCurseur(n);
      };
      addEventListener("pointermove", bouger);
      addEventListener("pointerup", lacher);
    };
    return m;
  }
}
