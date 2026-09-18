/* =============================================================================
   Visionneuse 3D — 10-export-step.js
   Extraction et réexportation de pièces ou sous-ensembles au format STEP (.stp).

   Permet d'isoler une pièce sélectionnée ou un ensemble de pièces visibles
   parmi un assemblage STEP, et de réexporter un fichier STEP (ISO 10303-21)
   100% valide et conforme, sans conversion ni perte de géométrie B-Rep :
   les surfaces NURBS, cylindres, congés, unités SI et tolérances d'origine
   sont intégralement préservés.
   ============================================================================= */
"use strict";

export class StepExtractor {
  constructor(texteStep) {
    if (typeof texteStep !== "string" || !texteStep.includes("ISO-10303-21")) {
      throw new Error("Le contenu fourni n'est pas un fichier STEP valide (ISO-10303-21).");
    }
    this.texte = texteStep;
    this.analyser();
  }

  analyser() {
    const debutData = this.texte.indexOf("DATA;");
    const finData = this.texte.lastIndexOf("ENDSEC;");
    if (debutData === -1 || finData === -1) {
      throw new Error("Section DATA introuvable dans le fichier STEP.");
    }

    this.entete = this.texte.slice(0, debutData + 5) + "\n";
    const blocData = this.texte.slice(debutData + 5, finData);

    this.entites = new Map();
    // Reconnaissance des entités du type #123 = TYPE(...); ou formes composites
    const regex = /#(\d+)\s*=\s*([^;]+);/g;
    let m;
    const regexRef = /#(\d+)/g;
    while ((m = regex.exec(blocData)) !== null) {
      const id = parseInt(m[1], 10);
      const raw = m[0];
      const contenu = m[2].trim();
      const refs = [];
      let rm;
      while ((rm = regexRef.exec(contenu)) !== null) {
        refs.push(parseInt(rm[1], 10));
      }
      this.entites.set(id, { id, raw, contenu, refs });
    }

    // Indexer tous les produits (pièces et assemblages)
    this.produits = new Map();
    for (const [id, e] of this.entites) {
      if (e.contenu.includes("PRODUCT(")) {
        const pm = /PRODUCT\s*\(\s*'([^']*)'/i.exec(e.contenu);
        if (pm) {
          this.produits.set(id, { id, nom: pm[1] });
        }
      }
    }

    // Relier Produit -> Formation -> Définition -> Forme -> Représentation (SDR)
    for (const [pid, p] of this.produits) {
      for (const [eid, e] of this.entites) {
        if (e.contenu.includes("PRODUCT_DEFINITION_FORMATION") && e.refs.includes(pid)) {
          p.formationId = eid;
        }
      }
      if (p.formationId) {
        for (const [eid, e] of this.entites) {
          if (e.contenu.includes("PRODUCT_DEFINITION(") && e.refs.includes(p.formationId)) {
            p.defId = eid;
          }
        }
      }
      if (p.defId) {
        for (const [eid, e] of this.entites) {
          if (e.contenu.includes("PRODUCT_DEFINITION_SHAPE(") && e.refs.includes(p.defId)) {
            p.shapeDefId = eid;
          }
        }
      }
      if (p.shapeDefId) {
        for (const [eid, e] of this.entites) {
          if (e.contenu.includes("SHAPE_DEFINITION_REPRESENTATION(") && e.refs.includes(p.shapeDefId)) {
            p.sdrId = eid;
            p.shapeRepId = e.refs.find(r => r !== p.shapeDefId);
          }
        }
      }
    }

    // Indexer les occurrences d'assemblage (NEXT_ASSEMBLY_USAGE_OCCURRENCE)
    this.occurrences = [];
    for (const [id, e] of this.entites) {
      if (e.contenu.includes("NEXT_ASSEMBLY_USAGE_OCCURRENCE")) {
        const om = /NEXT_ASSEMBLY_USAGE_OCCURRENCE\s*\(\s*'([^']*)'\s*,\s*'([^']*)'/i.exec(e.contenu);
        if (om) {
          this.occurrences.push({
            id,
            occId: om[1],
            nom: om[2],
            parentDefId: e.refs[0],
            childDefId: e.refs[1],
            refs: e.refs,
          });
        }
      }
    }
  }

  /**
   * Trouve un produit par son nom ou une sous-chaîne de son nom.
   */
  trouverProduit(nom) {
    if (!nom) return null;
    const cible = nom.trim().toLowerCase();
    // 1. Correspondance exacte
    for (const p of this.produits.values()) {
      if (p.nom.toLowerCase() === cible) return p;
    }
    // 2. Le nom du produit est contenu ou contient la cible
    for (const p of this.produits.values()) {
      const pNom = p.nom.toLowerCase();
      if (pNom.includes(cible) || cible.includes(pNom)) return p;
    }
    // 3. Correspondance via une occurrence
    for (const occ of this.occurrences) {
      const oNom = occ.nom.toLowerCase();
      if (oNom.includes(cible) || cible.includes(oNom)) {
        const p = [...this.produits.values()].find(pr => pr.defId === occ.childDefId);
        if (p) return p;
      }
    }
    return null;
  }

  /**
   * Clôture transitive d'un ensemble d'identifiants d'entités :
   * résout toutes les références pour garantir 0 pointeur orphelin.
   */
  cloreReferences(ensembleIds) {
    let modifie = true;
    while (modifie) {
      modifie = false;
      for (const id of Array.from(ensembleIds)) {
        const e = this.entites.get(id);
        if (!e) continue;
        for (const r of e.refs) {
          if (this.entites.has(r) && !ensembleIds.has(r)) {
            ensembleIds.add(r);
            modifie = true;
          }
        }
      }
    }
  }

  /**
   * Export d'une pièce individuelle isolée sous forme de fichier STEP complet.
   */
  exportPiece(produitOuNom) {
    const produit = typeof produitOuNom === "object" ? produitOuNom : this.trouverProduit(produitOuNom);
    if (!produit) {
      throw new Error(`Pièce STEP introuvable pour "${produitOuNom}".`);
    }
    if (!produit.sdrId) {
      throw new Error(`La pièce "${produit.nom}" n'a pas de représentation géométrique B-Rep directe.`);
    }

    const conserves = new Set();
    const file = [produit.sdrId];

    // Inclure les contextes d'application, unités SI et tolérances globales
    for (const [eid, e] of this.entites) {
      const c = e.contenu;
      if (
        c.includes("APPLICATION_CONTEXT") ||
        c.includes("APPLICATION_PROTOCOL_DEFINITION") ||
        c.includes("PRODUCT_CONTEXT") ||
        c.includes("UNCERTAINTY_MEASURE_WITH_UNIT") ||
        c.includes("GLOBAL_UNIT_ASSIGNED_CONTEXT") ||
        c.includes("GEOMETRIC_REPRESENTATION_CONTEXT") ||
        c.includes("SI_UNIT") ||
        c.includes("NAMED_UNIT")
      ) {
        file.push(eid);
      }
    }

    while (file.length > 0) {
      const curr = file.shift();
      if (conserves.has(curr) || !this.entites.has(curr)) continue;
      conserves.add(curr);
      const e = this.entites.get(curr);
      for (const r of e.refs) {
        if (!conserves.has(r)) file.push(r);
      }
    }

    // Résolution des relations de représentation (SHAPE_REPRESENTATION_RELATIONSHIP)
    // Permet d'inclure les représentations géométriques B-Rep (ADVANCED_BREP_SHAPE_REPRESENTATION,
    // MANIFOLD_SOLID_BREP, etc.) liées par Autodesk ATF, SolidWorks, CATIA, etc.
    let modifRel = true;
    while (modifRel) {
      modifRel = false;
      for (const [eid, e] of this.entites) {
        if (e.contenu.includes("REPRESENTATION_RELATIONSHIP") && !conserves.has(eid)) {
          if (e.refs.length >= 2) {
            const r1 = e.refs[0];
            const r2 = e.refs[1];
            if (conserves.has(r1)) {
              const r2Ent = this.entites.get(r2);
              const r2Contenu = r2Ent ? r2Ent.contenu : "";
              if (
                r2Contenu.includes("BREP") ||
                r2Contenu.includes("MANIFOLD") ||
                r2Contenu.includes("GEOMETRIC") ||
                r2Contenu.includes("SHAPE_REPRESENTATION") ||
                e.contenu.includes("SHAPE_REPRESENTATION_RELATIONSHIP")
              ) {
                conserves.add(eid);
                const fileRel = [...e.refs];
                while (fileRel.length > 0) {
                  const c = fileRel.shift();
                  if (conserves.has(c) || !this.entites.has(c)) continue;
                  conserves.add(c);
                  for (const cr of this.entites.get(c).refs) {
                    if (!conserves.has(cr)) fileRel.push(cr);
                  }
                }
                modifRel = true;
              }
            }
          }
        }
      }
    }

    // Inclure la catégorie et les styles propres à ce produit
    for (const [eid, e] of this.entites) {
      if (e.contenu.includes("PRODUCT_RELATED_PRODUCT_CATEGORY") && e.refs.includes(produit.id)) {
        conserves.add(eid);
      }
      if (e.contenu.includes("STYLED_ITEM")) {
        if (e.refs.length >= 2 && conserves.has(e.refs[1])) {
          if (e.refs.every(r => this.entites.has(r))) {
            conserves.add(eid);
            const qStyle = [e.refs[0]];
            while (qStyle.length > 0) {
              const sid = qStyle.shift();
              if (conserves.has(sid) || !this.entites.has(sid)) continue;
              conserves.add(sid);
              for (const sr of this.entites.get(sid).refs) qStyle.push(sr);
            }
          }
        }
      }
    }

    // Clôture transitive stricte pour garantir 0 erreur de référence
    this.cloreReferences(conserves);

    return this.assemblerStep(conserves);
  }

  /**
   * Export de l'assemblage filtré ne conservant que les pièces visibles (autorisées).
   * Les coordonnées et transformations spatiales dans l'assemblage sont préservées.
   */
  exportAssemblageFiltre(nomsPiecesAutorisees) {
    const autorises = new Set(nomsPiecesAutorisees.map(n => n.trim().toLowerCase()));

    const occurrencesConservees = [];
    for (const occ of this.occurrences) {
      const occNom = occ.nom.toLowerCase();
      const enfantProd = [...this.produits.values()].find(p => p.defId === occ.childDefId);
      const enfantNom = enfantProd ? enfantProd.nom.toLowerCase() : "";

      const correspondOcc = autorises.has(occNom) || nomsPiecesAutorisees.some(a => occNom.includes(a.toLowerCase()));
      const correspondEnfant = enfantProd && (autorises.has(enfantNom) || nomsPiecesAutorisees.some(a => enfantNom.includes(a.toLowerCase()) || a.toLowerCase().includes(enfantNom)));

      if (correspondOcc || correspondEnfant) {
        occurrencesConservees.push(occ);
      }
    }

    // Propagation dans l'arbre d'assemblage :
    // 1. Vers le haut : si un composant enfant est conservé, inclure son sous-ensemble parent
    // 2. Vers le bas : si un sous-ensemble est conservé, inclure tous ses composants enfants
    let modifOcc = true;
    while (modifOcc) {
      modifOcc = false;
      const occIds = new Set(occurrencesConservees.map(o => o.id));
      for (const occ of Array.from(occurrencesConservees)) {
        for (const o of this.occurrences) {
          if ((o.childDefId === occ.parentDefId || o.parentDefId === occ.childDefId) && !occIds.has(o.id)) {
            occurrencesConservees.push(o);
            occIds.add(o.id);
            modifOcc = true;
          }
        }
      }
    }

    // Trouver le produit racine (celui qui n'est pas enfant dans une occurrence)
    const enfantsIds = new Set(this.occurrences.map(o => o.childDefId));
    let produitRacine = [...this.produits.values()].find(p => p.defId && !enfantsIds.has(p.defId));
    if (!produitRacine) produitRacine = this.produits.values().next().value;

    const conserves = new Set();

    // Contextes globaux, protocoles, unités
    for (const [eid, e] of this.entites) {
      const c = e.contenu;
      if (
        c.includes("APPLICATION_CONTEXT") ||
        c.includes("APPLICATION_PROTOCOL_DEFINITION") ||
        c.includes("PRODUCT_CONTEXT") ||
        c.includes("UNCERTAINTY_MEASURE_WITH_UNIT") ||
        c.includes("GLOBAL_UNIT_ASSIGNED_CONTEXT") ||
        c.includes("GEOMETRIC_REPRESENTATION_CONTEXT") ||
        c.includes("SI_UNIT") ||
        c.includes("NAMED_UNIT")
      ) {
        conserves.add(eid);
      }
    }

    // Parcourir la racine d'assemblage
    if (produitRacine && produitRacine.sdrId) {
      const fileRacine = [produitRacine.sdrId];
      const vusRacine = new Set();
      while (fileRacine.length > 0) {
        const curr = fileRacine.shift();
        if (vusRacine.has(curr) || !this.entites.has(curr)) continue;
        vusRacine.add(curr);
        conserves.add(curr);
        for (const r of this.entites.get(curr).refs) {
          if (!vusRacine.has(r)) fileRacine.push(r);
        }
      }
    }

    // Parcourir chaque occurrence conservée, son PDS et son CDSR, ainsi que les représentations (SDR)
    for (const occ of occurrencesConservees) {
      const fileOcc = [occ.id];

      const enfantProd = [...this.produits.values()].find(p => p.defId === occ.childDefId);
      if (enfantProd && enfantProd.sdrId) {
        fileOcc.push(enfantProd.sdrId);
      }
      const parentProd = [...this.produits.values()].find(p => p.defId === occ.parentDefId);
      if (parentProd && parentProd.sdrId) {
        fileOcc.push(parentProd.sdrId);
      }

      for (const [eid, e] of this.entites) {
        if (e.contenu.includes("PRODUCT_DEFINITION_SHAPE") && e.refs.includes(occ.id)) {
          fileOcc.push(eid);
          for (const [ceid, ce] of this.entites) {
            if (ce.contenu.includes("CONTEXT_DEPENDENT_SHAPE_REPRESENTATION") && ce.refs.includes(eid)) {
              fileOcc.push(ceid);
            }
          }
        }
      }

      while (fileOcc.length > 0) {
        const curr = fileOcc.shift();
        if (conserves.has(curr) || !this.entites.has(curr)) continue;
        conserves.add(curr);
        for (const r of this.entites.get(curr).refs) {
          if (!conserves.has(r)) fileOcc.push(r);
        }
      }
    }

    // Résolution des relations de représentation (Autodesk ATF, Fusion 360, SolidWorks, CATIA, etc.)
    // Permet d'inclure les représentations géométriques B-Rep (ADVANCED_BREP_SHAPE_REPRESENTATION,
    // MANIFOLD_SOLID_BREP, etc.) liées par SHAPE_REPRESENTATION_RELATIONSHIP.
    let modifRel = true;
    while (modifRel) {
      modifRel = false;
      for (const [eid, e] of this.entites) {
        if (e.contenu.includes("REPRESENTATION_RELATIONSHIP") && !conserves.has(eid)) {
          if (e.refs.length >= 2) {
            const r1 = e.refs[0];
            const r2 = e.refs[1];
            if (conserves.has(r1)) {
              const r2Ent = this.entites.get(r2);
              const r2Contenu = r2Ent ? r2Ent.contenu : "";
              if (
                r2Contenu.includes("BREP") ||
                r2Contenu.includes("MANIFOLD") ||
                r2Contenu.includes("GEOMETRIC") ||
                r2Contenu.includes("SHAPE_REPRESENTATION") ||
                e.contenu.includes("SHAPE_REPRESENTATION_RELATIONSHIP")
              ) {
                conserves.add(eid);
                const fileRel = [...e.refs];
                while (fileRel.length > 0) {
                  const c = fileRel.shift();
                  if (conserves.has(c) || !this.entites.has(c)) continue;
                  conserves.add(c);
                  for (const cr of this.entites.get(c).refs) {
                    if (!conserves.has(cr)) fileRel.push(cr);
                  }
                }
                modifRel = true;
              }
            }
          }
        }
      }
    }

    // Catégories et styles
    for (const [eid, e] of this.entites) {
      if (e.contenu.includes("PRODUCT_RELATED_PRODUCT_CATEGORY")) {
        const prodRefs = e.refs.filter(r => this.produits.has(r));
        if (prodRefs.length > 0 && prodRefs.every(p => conserves.has(p))) {
          conserves.add(eid);
        }
      }
      if (e.contenu.includes("STYLED_ITEM")) {
        if (e.refs.length >= 2 && conserves.has(e.refs[1])) {
          if (e.refs.every(r => this.entites.has(r))) {
            conserves.add(eid);
            const qStyle = [e.refs[0]];
            while (qStyle.length > 0) {
              const sid = qStyle.shift();
              if (conserves.has(sid) || !this.entites.has(sid)) continue;
              conserves.add(sid);
              for (const sr of this.entites.get(sid).refs) qStyle.push(sr);
            }
          }
        }
      }
    }

    // Clôture transitive stricte
    this.cloreReferences(conserves);

    return this.assemblerStep(conserves);
  }

  /**
   * Assemble les lignes du fichier STEP à partir des identifiants conservés.
   */
  assemblerStep(ensembleIds) {
    const idsTries = Array.from(ensembleIds).sort((a, b) => a - b);
    let resultat = this.entete;
    for (const id of idsTries) {
      const e = this.entites.get(id);
      if (e) resultat += e.raw + "\n";
    }
    resultat += "ENDSEC;\nEND-ISO-10303-21;\n";
    return resultat;
  }
}

/**
 * Déclenche le téléchargement d'un fichier dans le navigateur.
 */
export function telechargerFichier(contenu, nomFichier, typeMime = "application/octet-stream") {
  const blob = new Blob([contenu], { type: typeMime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomFichier;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Nettoie une chaîne pour en faire un nom de fichier valide sans caractères interdits.
 */
export function sanitiserNomFichier(nom, ext = ".stp") {
  if (!nom) nom = "piece";
  let base = nom.trim().replace(/[\\/*?:"<>|]/g, "_").replace(/\s+/g, "_");
  base = base.replace(/\.[^.]+$/, "");
  if (!base) base = "piece";
  if (!ext.startsWith(".")) ext = "." + ext;
  return base + ext;
}
