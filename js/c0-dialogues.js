/* =============================================================================
   Conception 3D — c0-dialogues.js
   Les questions de la page, à la place de prompt(), confirm() et alert() du
   navigateur : des <dialog> du thème, qui ne figent pas la page et se remplissent
   comme le reste du DOM.
   ============================================================================= */
"use strict";

/** Une boîte. Rend les valeurs des champs (ou [] sans champ) après OK, null après Annuler ou Échap. */
function boite(titre, { texte = "", champs = [], oui = "OK", non = "Annuler", valider = null }){
  return new Promise((rendre) => {
    const dlg = document.createElement("dialog");
    dlg.className = "dlg-question";
    const form = document.createElement("form");
    form.method = "dialog";
    form.appendChild(Object.assign(document.createElement("h2"), { textContent:titre }));
    if(texte) form.appendChild(Object.assign(document.createElement("p"), { className:"aide", textContent:texte }));
    const entrees = champs.map((c) => {
      const l = document.createElement("label");
      /* `options` : une liste de choix ; `type` : un autre genre de champ (couleur…). */
      let e;
      if(c.options){
        e = document.createElement("select");
        for(const [v, t] of Object.entries(c.options)) e.add(new Option(t, v));
        e.value = c.valeur ?? "";
      }else e = Object.assign(document.createElement("input"), { type:c.type || "text", value:c.valeur ?? "" });
      l.append(Object.assign(document.createElement("span"), { textContent:c.nom }), e);
      form.appendChild(l);
      return e;
    });
    const msg = Object.assign(document.createElement("p"), { className:"fo-msg" });
    const menu = document.createElement("menu");
    menu.append(msg, Object.assign(document.createElement("span"), { className:"grow" }));
    /* Annuler n'est pas un bouton d'envoi : Entrée dans un champ vaut OK. */
    if(non) menu.appendChild(Object.assign(document.createElement("button"), { type:"button", className:"tb", textContent:non, onclick:() => dlg.close() }));
    menu.appendChild(Object.assign(document.createElement("button"), { className:"tb on", value:"ok", textContent:oui }));
    form.append(menu);
    const valeurs = () => entrees.map(e => e.value.trim());
    form.onsubmit = (ev) => {
      const refus = valider?.(valeurs());
      if(refus){ ev.preventDefault(); msg.textContent = refus; }
    };
    dlg.onclose = () => { dlg.remove(); rendre(dlg.returnValue === "ok" ? valeurs() : null); };
    dlg.appendChild(form);
    document.body.appendChild(dlg);
    dlg.showModal();
    entrees[0]?.select?.();
  });
}

/** Plusieurs champs [{ nom, valeur }] ; `valider(valeurs)` rend un motif de refus, ou rien. */
export const demander = (titre, champs, valider = null) => boite(titre, { champs, valider });

/** Un seul texte ; null si annulé. */
export const demanderTexte = async (titre, nom, valeur = "") => (await boite(titre, { champs:[{ nom, valeur }] }))?.[0] ?? null;

export const confirmer = async (texte, oui = "OK") => (await boite("Confirmer", { texte, oui })) !== null;

export const avertir = (texte) => boite("Attention", { texte, non:null });
