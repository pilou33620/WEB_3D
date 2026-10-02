/* =============================================================================
   Visionneuse 3D — 11-projets.js
   Le dossier des projets : lancée par WEB_SUITE, la visionneuse reçoit
   --projets PROJETS/3D, un dossier synchronisé avec GitHub comme ceux des
   autres outils. On y ouvre un modèle d'un clic, et on y range celui qu'on
   vient d'ouvrir : à l'arrêt de l'outil, WEB_SUITE l'envoie, et l'autre poste
   le trouve au lancement suivant.

   Le serveur ne fait que lister, lire et ranger (web_3D.py : /api/projets,
   /projets/<chemin>). Sans --projets, le bouton reste caché.
   ============================================================================= */
"use strict";

const $ = (id) => document.getElementById(id);

const taille = (o) => o < 1e6 ? `${Math.max(1, Math.round(o / 1e3))} ko` : `${(o / 1e6).toFixed(1).replace(".", ",")} Mo`;
const jour = (s) => new Date(s * 1000).toLocaleDateString("fr-FR", { day:"2-digit", month:"2-digit", year:"numeric" });

async function liste(){
  const r = await fetch("api/projets", { cache:"no-store" });
  if(!r.ok) throw new Error(`liste des projets : ${r.status}`);
  return r.json();
}

/** Un .obj s'ouvre avec ses matériaux : le .mtl de même nom, s'il est rangé à côté. */
function compagnons(chemin, fichiers){
  if(!/\.obj$/i.test(chemin)) return [chemin];
  const mtl = chemin.replace(/\.obj$/i, ".mtl").toLowerCase();
  return [chemin, ...fichiers.map(f => f.chemin).filter(c => c.toLowerCase() === mtl)];
}

async function ouvrir(ui, chemins){
  $("dlgProjets").close();
  try{
    const fichiers = await Promise.all(chemins.map(async (c) => {
      const r = await fetch("projets/" + c.split("/").map(encodeURIComponent).join("/"));
      if(!r.ok) throw new Error(`${c} : ${r.status}`);
      return new File([await r.blob()], c.split("/").pop());
    }));
    await ui.charger(fichiers);
  }catch(e){
    ui.erreur(`Impossible d'ouvrir : ${e.message}`);
  }
}

async function remplir(ui){
  const etat = $("projetsEtat");
  const table = $("tabProjets");
  table.replaceChildren();
  let donnees;
  try{ donnees = await liste(); }
  catch(e){ etat.textContent = e.message; return; }
  $("projetsDossier").textContent = donnees.fichiers.length
    ? "Cliquez un modèle pour l'ouvrir. Le dossier est envoyé sur GitHub par WEB·SUITE à l'arrêt de l'outil."
    : "Aucun modèle rangé pour l'instant : ouvrez-en un, puis « Ranger le modèle ouvert ici ».";
  for(const f of donnees.fichiers){
    if(/\.(mtl|png|jpe?g)$/i.test(f.chemin)) continue;      // annexes : elles suivent leur .obj
    const tr = table.insertRow();
    tr.insertCell().textContent = f.chemin;                 // textContent : le nom vient du disque
    tr.insertCell().textContent = taille(f.taille);
    tr.insertCell().textContent = jour(f.date);
    tr.onclick = () => ouvrir(ui, compagnons(f.chemin, donnees.fichiers));
  }
  $("bRanger").disabled = !(ui.derniersFichiers && ui.derniersFichiers.length);
}

async function ranger(ui){
  const etat = $("projetsEtat");
  const ranges = [];
  try{
    for(const f of ui.derniersFichiers || []){
      const r = await fetch("api/projets?nom=" + encodeURIComponent(f.name), {
        method:"POST", headers:{ "X-Web3D":"1", "Content-Type":"application/octet-stream" }, body:f,
      });
      const j = await r.json().catch(() => ({}));
      if(!r.ok) throw new Error(`${f.name} : ${j.detail || r.status}`);
      ranges.push(j.chemin);
    }
    await remplir(ui);
    etat.textContent = `Rangé : ${ranges.join(", ")}.`;
  }catch(e){
    await remplir(ui);
    etat.textContent = `Échec — ${e.message}` + (ranges.length ? ` (déjà rangé : ${ranges.join(", ")})` : "");
  }
}

export async function brancherProjets(ui){
  let donnees;
  try{ donnees = await liste(); }catch(e){ return; }        // serveur sans la route : pas de projets
  if(!donnees.dispo) return;
  $("bProjets").hidden = false;
  $("bProjets").onclick = async () => {
    $("projetsEtat").textContent = "";
    await remplir(ui);
    $("dlgProjets").showModal();
  };
  $("bRanger").onclick = () => ranger(ui);
}
