/* =============================================================================
   Conception 3D — c5-esquisse-ui.js
   L'édition d'une esquisse, dans la vue 3D, sur son plan.

   La caméra se place face au plan ; les clics sont ramenés en coordonnées
   locales par l'intersection du rayon de la souris avec le plan. Tout le
   reste — solveur, profils — est dans c2-esquisse.js.

   Trois façons d'agir, comme dans un modeleur :
   · un outil actif (ligne, rectangle, cercle…) : chaque clic pose un point,
     avec accrochage aux points existants — qui sont alors partagés, ce qui
     ferme les contours sans contrainte de coïncidence à poser ;
   · sans outil : clic = sélection (Maj pour ajouter), glisser un point le
     déplace et le solveur fait suivre le reste ;
   · le ruban applique une contrainte ou une cote à la sélection.

   Les cotes sont des étiquettes HTML au-dessus du canevas : double-clic pour
   saisir une valeur ou une expression (« L/2 »).
   ============================================================================= */
"use strict";

import * as THREE from "three";
import { repere, indexer, nouvelId, resoudre, milieuArc, cercle3Points, echantillonSpline, COTES, NOMS_CONTRAINTES } from "./c2-esquisse.js";
import { ajuster, decaler, casserCoin, miroir, repetitionRect, repetitionCirc } from "./c2b-outils-esquisse.js";
import { echapper } from "./05-arbre.js";
import { demander, demanderTexte } from "./c0-dialogues.js";

const COULEURS = { normal:0x3fa0ea, construction:0x8b919c, sel:0xf2c744, survol:0x8af0ff, conflit:0xe8443a, apercu:0xf2c744 };
const PX = 9;            // tolérance de désignation, en pixels
const TAU = Math.PI * 2;

const fmt = (v) => String(+v.toFixed(3)).replace(".", ",");
const estNombre = (expr) => /^\s*-?\d+(?:[.,]\d+)?\s*$/.test(String(expr));
const arrondi = (v) => String(Math.round(v * 100) / 100);

export class EditeurEsquisse {
  /**
   * ctx = { vue, nav, gcs, ctr, memoriser(), surModif(), surStatut(texte), surFin(), surListe() }
   */
  constructor(ctx){
    this.ctx = ctx;
    this.esq = null;
    this.selection = new Set();
    this.outil = null;
    this.clics = [];
    this.cotes = new Map();          // id de cote → étiquette
    this.cotesSaisie = null;
    this.nbCotes = 6;
    this.rc = new THREE.Raycaster();
    this.groupe = new THREE.Group();
    this.groupe.name = "esquisse";
    this.groupe.renderOrder = 10;
    this.apercu = new THREE.Group();
    this.surRendu = () => this.placerCotes();
  }

  get ouvert(){ return !!this.esq; }

  /* ==========================================================================
     Ouverture, fermeture, repère
     ========================================================================== */
  ouvrir(esq, v){
    const { vue, nav } = this.ctx;
    this.esq = esq;
    this.v = v;
    this.selection.clear();
    this.outil = null; this.clics = [];
    this.majRepere();
    vue.annotations.add(this.groupe, this.apercu);
    vue.apresRendu.add(this.surRendu);
    vue.canvas.classList.add("esquisse");
    nav.allerVersDirection(new THREE.Vector3(...this.r.n));
    this.resoudre();
    this.redessiner();
  }

  fermer(){
    const { vue } = this.ctx;
    this.annulerSaisie();
    this.vider(this.groupe); this.vider(this.apercu);
    vue.annotations.remove(this.groupe, this.apercu);
    vue.apresRendu.delete(this.surRendu);
    vue.canvas.classList.remove("esquisse");
    for(const et of this.cotes.values()) et.remove();
    this.cotes.clear();
    this.esq = null;
    vue.invalider();
  }

  /** Après un changement de plan ou d'esquisse (annuler / refaire). */
  majRepere(){
    this.r = repere(this.esq.plan, this.v);
    const { o, x, y, n } = this.r;
    this.M = new THREE.Matrix4().makeBasis(new THREE.Vector3(...x), new THREE.Vector3(...y), new THREE.Vector3(...n))
      .setPosition(...o);
    this.Minv = this.M.clone().invert();
    this.plan = new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(...n), new THREE.Vector3(...o));
    this.groupe.matrixAutoUpdate = this.apercu.matrixAutoUpdate = false;
    this.groupe.matrix.copy(this.M); this.apercu.matrix.copy(this.M);
    this.groupe.matrixWorldNeedsUpdate = this.apercu.matrixWorldNeedsUpdate = true;
  }

  /** Remplace l'esquisse éditée par sa nouvelle version (annuler / refaire rend un nouvel objet). */
  remplacer(esq){
    this.esq = esq;
    this.clics = [];                 // un tracé en cours citerait des points qui n'existent plus
    this.vider(this.apercu);
    for(const id of [...this.selection]) if(!this.existe(id)) this.selection.delete(id);
    this.majRepere();
    this.redessiner();
  }

  existe(id){ return this.esq.elements.some(e => e.id === id) || this.esq.contraintes.some(k => k.id === id); }

  /** Point local (x, y) sous la souris, ou null si le rayon longe le plan. */
  local(ev){
    const { vue } = this.ctx;
    this.rc.setFromCamera(vue.ndc(ev), vue.camera());
    const p = this.rc.ray.intersectPlane(this.plan, new THREE.Vector3());
    if(!p) return null;
    p.applyMatrix4(this.Minv);
    return { x:p.x, y:p.y };
  }

  /** La tolérance de désignation en mm, à l'endroit de la souris. */
  tolerance(ev){
    const a = this.local(ev), b = this.local({ clientX:ev.clientX + PX, clientY:ev.clientY });
    return a && b ? Math.hypot(b.x - a.x, b.y - a.y) : 1;
  }

  ecran(x, y){ return this.ctx.vue.versEcran(new THREE.Vector3(x, y, 0).applyMatrix4(this.M)); }

  /* ==========================================================================
     Désignation
     ========================================================================== */
  /** L'élément le plus proche : les points d'abord, puis les courbes. */
  designer(ev, { pointsSeuls = false, sauf = null } = {}){
    const m = this.local(ev);
    if(!m) return null;
    const tol = this.tolerance(ev);
    const idx = indexer(this.esq);
    let meilleur = null, dMin = tol;
    for(const e of this.esq.elements){
      if(e.type !== "point" || e.id === sauf) continue;
      const d = Math.hypot(e.x - m.x, e.y - m.y);
      if(d < dMin){ dMin = d; meilleur = e; }
    }
    if(meilleur || pointsSeuls) return meilleur;
    dMin = tol;
    for(const e of this.esq.elements){
      let d = Infinity;
      if(e.type === "ligne"){
        const a = idx.get(e.p1), b = idx.get(e.p2);
        const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1;
        const t = Math.max(0, Math.min(1, ((m.x - a.x) * dx + (m.y - a.y) * dy) / l2));
        d = Math.hypot(a.x + t * dx - m.x, a.y + t * dy - m.y);
      }else if(e.type === "cercle" || e.type === "arc"){
        const c = idx.get(e.c);
        d = Math.abs(Math.hypot(m.x - c.x, m.y - c.y) - e.r);
        if(e.type === "arc" && !this.dansArc(idx, e, Math.atan2(m.y - c.y, m.x - c.x))) d = Infinity;
      }else if(e.type === "spline" || e.type === "texte"){
        const t = this.trace(idx, e);
        for(let i = 0; i + 1 < t.length; i++){
          const dx = t[i + 1].x - t[i].x, dy = t[i + 1].y - t[i].y, l2 = dx * dx + dy * dy || 1;
          const u = Math.max(0, Math.min(1, ((m.x - t[i].x) * dx + (m.y - t[i].y) * dy) / l2));
          d = Math.min(d, Math.hypot(t[i].x + u * dx - m.x, t[i].y + u * dy - m.y));
        }
      }
      if(d < dMin){ dMin = d; meilleur = e; }
    }
    return meilleur;
  }

  dansArc(idx, a, t){
    const c = idx.get(a.c), p1 = idx.get(a.p1), p2 = idx.get(a.p2);
    const a1 = Math.atan2(p1.y - c.y, p1.x - c.x);
    const bal = (u) => { let d = (u - a1) % TAU; if(d < 0) d += TAU; return d; };
    return bal(t) <= bal(Math.atan2(p2.y - c.y, p2.x - c.x)) + 1e-9;
  }

  /** Point de la souris, accroché à un point existant s'il y en a un sous le curseur. */
  accroche(ev){
    const p = this.designer(ev, { pointsSeuls:true });
    if(p) return { x:p.x, y:p.y, id:p.id };
    const m = this.local(ev);
    return m && { ...m, id:null };
  }

  /* ==========================================================================
     Souris (branchée par c6-conception.js sur les rappels de la navigation)
     ========================================================================== */
  pointeurBas(ev){
    if(ev.button !== 0 || ev.ctrlKey || ev.altKey) return false;
    if(this.outil){
      const m = this.accroche(ev);
      if(m) this.clic(m, ev);
      return true;
    }
    const p = this.designer(ev, { pointsSeuls:true });
    if(!p) return false;                    // la navigation garde le clic : sélection ou orbite
    this.glisser(p, ev);
    return true;
  }

  /** Clic sans outil : sélection. */
  selectionner(ev){
    const e = this.designer(ev);
    if(!ev.shiftKey) this.selection.clear();
    if(e){ if(this.selection.has(e.id) && ev.shiftKey) this.selection.delete(e.id); else this.selection.add(e.id); }
    this.redessiner();
  }

  survoler(ev){
    const avant = this.survol;
    this.survol = this.outil ? null : this.designer(ev)?.id;
    if(this.outil && this.clics.length){ this.dessinerApercu(this.accroche(ev)); }
    else if(avant !== this.survol) this.redessiner();
    this.ctx.vue.invalider();
  }

  glisser(point, ev0){
    const { vue } = this.ctx;
    const avant = JSON.stringify(this.esq);
    let bouge = false, attente = false, dernier = ev0;
    const bouger = (ev) => {
      dernier = ev;
      if(attente) return;
      attente = true;
      requestAnimationFrame(() => {
        attente = false;
        const m = this.local(dernier);
        if(!m) return;
        bouge = true;
        resoudre(this.ctx.gcs, this.esq, this.v, { id:point.id, x:m.x, y:m.y });
        this.redessiner();
      });
    };
    const lacher = (ev) => {
      removeEventListener("pointermove", bouger);
      removeEventListener("pointerup", lacher);
      if(!bouge){ this.selectionner(ev); return; }          // un clic sans glisser : sélection du point
      this.ctx.memoriser(avant);           // l'état d'avant le glissé : une seule étape d'annulation
      this.resoudre();
      this.redessiner();
      this.ctx.surModif();
    };
    addEventListener("pointermove", bouger);
    addEventListener("pointerup", lacher);
    vue.invalider();
  }

  /* ==========================================================================
     Outils de tracé
     ========================================================================== */
  choisirOutil(outil){
    if(this.outil === "spline") this.finirSpline();
    this.outil = this.outil === outil ? null : outil;
    this.clics = [];
    this.selection.clear();
    this.vider(this.apercu);
    this.redessiner();
    this.statut();
  }

  /** Un point de l'esquisse : l'existant accroché, ou un nouveau. */
  point(m, extra = {}){
    if(m.id) return m.id;
    const id = nouvelId(this.esq, "p");
    this.esq.elements.push({ id, type:"point", x:m.x, y:m.y, ...extra });
    return id;
  }
  ligne(a, b, extra = {}){
    const id = nouvelId(this.esq, "l");
    this.esq.elements.push({ id, type:"ligne", p1:a, p2:b, ...extra });
    return id;
  }
  contrainte(k){ this.esq.contraintes.push({ id:nouvelId(this.esq, "k"), ...k }); }

  clic(m, ev){
    const c = this.clics;
    const fini = () => { this.clics = []; this.vider(this.apercu); };
    const modifier = (f) => { this.ctx.memoriser(); f(); this.resoudre(); this.redessiner(); this.ctx.surModif(); };
    switch(this.outil){
      case "ajuster": {
        const e = this.designer(ev);
        if(!e || e.type === "point"){ this.statut("Cliquez le morceau de ligne, de cercle ou d'arc à retirer."); return; }
        let refus = null;
        modifier(() => { refus = ajuster(this.esq, e.id, m); });
        if(refus) this.statut(refus);
        return;
      }
      case "spline":
        c.push(m);
        this.dessinerApercu(m);
        return;
      case "texte":
        this.demanderLeTexte("", "10").then((t) => {
          if(t) modifier(() => this.esq.elements.push({ id:nouvelId(this.esq, "x"), type:"texte", p:this.point(m, m.id ? {} : { constr:true }), ...t }));
        });
        return;
      case "point":
        modifier(() => this.point({ ...m, id:null }, { seul:true }));
        return;
      case "ligne": {
        if(!c.length){ c.push(m); return; }
        const a = c[0];
        if(Math.hypot(m.x - a.x, m.y - a.y) < 1e-9) return;
        modifier(() => {
          if(!a.id) a.id = this.point(a);
          const b = this.point(m);
          const l = this.ligne(a.id, b);
          /* Presque horizontale ou verticale : on le dit au solveur, comme les modeleurs. */
          const ang = Math.abs(Math.atan2(m.y - a.y, m.x - a.x) * 180 / Math.PI) % 180;
          if(ang < 3 || ang > 177 || Math.abs(ang - 90) < 3){
            this.contrainte({ type:Math.abs(ang - 90) < 3 ? "vertical" : "horizontal", a:l });
            /* refusée par le solveur (les extrémités sont déjà tenues) : on la retire */
            if(!resoudre(this.ctx.gcs, this.esq, this.v).ok) this.esq.contraintes.pop();
          }
          const debutChaine = c.debut;
          if(m.id && m.id === debutChaine) fini();
          else { this.clics = [{ x:m.x, y:m.y, id:b }]; this.clics.debut = debutChaine || a.id; }
        });
        return;
      }
      case "rectangle": case "rectangleCentre": {
        if(!c.length){ c.push(m); return; }
        modifier(() => this.rectangle(c[0], m, this.outil === "rectangleCentre"));
        fini();
        return;
      }
      case "cercle": {
        if(!c.length){ c.push(m); return; }
        const r = Math.hypot(m.x - c[0].x, m.y - c[0].y);
        if(r < 1e-6) return;
        modifier(() => {
          const ce = this.point(c[0]);
          this.esq.elements.push({ id:nouvelId(this.esq, "c"), type:"cercle", c:ce, r });
        });
        fini();
        return;
      }
      case "arc3": {
        if(c.length < 2){ c.push(m); return; }
        const k = cercle3Points(c[0], m, c[1]);
        if(!k) return;
        modifier(() => {
          const [d, f] = k.trigo ? [c[0], c[1]] : [c[1], c[0]];
          this.arc(this.point({ ...k.c, id:null }, { constr:true }), this.point(d), this.point(f), k.r);
        });
        fini();
        return;
      }
      case "arcCentre": {
        if(c.length < 2){ c.push(m); return; }
        const r = Math.hypot(c[1].x - c[0].x, c[1].y - c[0].y);
        const t = Math.atan2(m.y - c[0].y, m.x - c[0].x);
        const fin = { x:c[0].x + r * Math.cos(t), y:c[0].y + r * Math.sin(t), id:null };
        modifier(() => {
          const ce = this.point(c[0]), p1 = this.point(c[1]);
          this.arc(ce, p1, this.point(fin), r);
        });
        fini();
        return;
      }
      case "polygone": {
        if(!c.length){ c.push(m); return; }
        modifier(() => this.polygone(c[0], m, this.nbCotes));
        fini();
        return;
      }
      case "oblong": {
        if(c.length < 2){ c.push(m); return; }
        modifier(() => this.oblong(c[0], c[1], m));
        fini();
        return;
      }
    }
  }

  /** Termine la spline en cours (Entrée, Échap ou changement d'outil). */
  finirSpline(){
    const c = this.clics;
    this.clics = [];
    this.vider(this.apercu);
    if(this.outil !== "spline" || c.length < 2) return;
    this.ctx.memoriser();
    const pts = c.map(m => this.point(m));
    this.esq.elements.push({ id:nouvelId(this.esq, "s"), type:"spline", pts, p1:pts[0], p2:pts[pts.length - 1] });
    this.resoudre(); this.redessiner(); this.ctx.surModif();
  }

  /** Le texte et sa hauteur : les mêmes champs à la pose et au double-clic. */
  async demanderLeTexte(contenu, h){
    const hauteur = (x) => { try{ return this.v(x); }catch(_){ return NaN; } };
    const r = await demander("Texte de l'esquisse", [{ nom:"Texte", valeur:contenu }, { nom:"Hauteur (mm)", valeur:h }],
      ([t, x]) => !t ? "Écrivez un texte." : hauteur(x) > 0 ? null : "La hauteur doit être un nombre positif.");
    return r && { contenu:r[0], h:hauteur(r[1]) };
  }

  /** `n` valeurs séparées par des virgules, évaluées avec les paramètres ; null si annulé ou illisible. */
  async nombres(question, defaut, n){
    const t = await demanderTexte("Esquisse", question, defaut);
    if(t === null) return null;
    try{
      const v = (n > 1 ? t.split(",") : [t]).map(x => this.v(x.trim()));    // seul, « 2,5 » est un nombre
      if(v.length === n) return v;
    }catch(_){ /* message ci-dessous */ }
    this.statut(`Valeur illisible : « ${t} ».`);
    return null;
  }

  /** Une transformation de la sélection, en une étape d'annulation ; `f` rend un message de refus ou null. */
  transformer(f){
    const avant = JSON.stringify(this.esq);
    let refus = null;
    try{ refus = f(); }catch(e){ refus = e.message; }
    if(refus){ Object.assign(this.esq, JSON.parse(avant)); this.statut(refus); this.redessiner(); return; }
    /* Le solveur doit accepter le résultat, sinon l'esquisse resterait en conflit. */
    if(!this.resoudre().ok){
      Object.assign(this.esq, JSON.parse(avant));
      this.resoudre();
      this.redessiner();
      this.statut("Refusé : le résultat contredit les contraintes de l'esquisse.");
      return;
    }
    this.ctx.memoriser(avant);
    this.selection.clear();
    this.redessiner();
    this.statut();
    this.ctx.surModif();
  }

  async decaler(){
    const d = await this.nombres("Distance du décalage (mm) — positive : vers l'extérieur d'un contour :", "2", 1);
    if(d) this.transformer(() => decaler(this.esq, [...this.selection], d[0]));
  }

  async casserCoin(mode){
    const { points, els } = this.choisis();
    if(points.length !== 1 || els.length !== 1){ this.statut("Sélectionnez le point du coin."); return; }
    const d = await this.nombres(mode === "conge" ? "Rayon du congé (mm) :" : "Distance du chanfrein (mm) :", "2", 1);
    if(d) this.transformer(() => casserCoin(this.esq, points[0].id, d[0], mode));
  }

  miroir(){
    const { lignes } = this.choisis();
    const axes = lignes.filter(l => l.constr);
    if(axes.length !== 1){ this.statut("Sélectionnez les éléments à copier et une seule ligne de construction : l'axe du miroir."); return; }
    this.transformer(() => miroir(this.esq, [...this.selection], axes[0].id));
  }

  async repetition(mode){
    if(!this.selection.size){ this.statut("Sélectionnez les éléments à répéter."); return; }
    if(mode === "rect"){
      const v = await this.nombres("Nombre en X, nombre en Y, pas X (mm), pas Y (mm) :", "3, 1, 20, 20", 4);
      if(v) this.transformer(() => repetitionRect(this.esq, [...this.selection], Math.round(v[0]), Math.round(v[1]), v[2], v[3]));
      return;
    }
    const v = await this.nombres("Nombre d'exemplaires, angle total (°) :", "6, 360", 2);
    if(!v) return;
    /* Le centre : un point sélectionné seul avec des courbes, sinon l'origine du plan. */
    const { points, els } = this.choisis();
    const centre = points.length === 1 && els.length > 1 ? points[0] : { x:0, y:0, id:null };
    this.transformer(() => repetitionCirc(this.esq, [...this.selection].filter(i => i !== centre.id), Math.round(v[0]), v[1], centre.x, centre.y));
  }

  arc(c, p1, p2, r){
    const id = nouvelId(this.esq, "a");
    this.esq.elements.push({ id, type:"arc", c, p1, p2, r });
    return id;
  }

  rectangle(a, b, centre){
    const [x0, y0, x1, y1] = centre
      ? [2 * a.x - b.x, 2 * a.y - b.y, b.x, b.y]
      : [a.x, a.y, b.x, b.y];
    const ids = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y], i) =>
      this.point(!centre && i === 0 ? a : !centre && i === 2 ? b : centre && i === 2 ? b : { x, y, id:null }));
    const l = ids.map((p, i) => this.ligne(p, ids[(i + 1) % 4]));
    this.contrainte({ type:"horizontal", a:l[0] }); this.contrainte({ type:"horizontal", a:l[2] });
    this.contrainte({ type:"vertical", a:l[1] }); this.contrainte({ type:"vertical", a:l[3] });
    if(centre){
      const c = this.point(a, a.id ? {} : { constr:true });
      this.contrainte({ type:"milieu", a:c, b:this.ligne(ids[0], ids[2], { constr:true }) });
    }
  }

  polygone(c, s, n){
    const r = Math.hypot(s.x - c.x, s.y - c.y), t0 = Math.atan2(s.y - c.y, s.x - c.x);
    if(r < 1e-6) return;
    const ce = this.point(c);
    const cercle = nouvelId(this.esq, "c");
    this.esq.elements.push({ id:cercle, type:"cercle", c:ce, r, constr:true });
    const ids = Array.from({ length:n }, (_, i) => this.point(i === 0 ? s : { x:c.x + r * Math.cos(t0 + i * TAU / n), y:c.y + r * Math.sin(t0 + i * TAU / n), id:null }));
    const l = ids.map((p, i) => this.ligne(p, ids[(i + 1) % n]));
    for(const p of ids) this.contrainte({ type:"sur", a:p, b:cercle });
    for(let i = 1; i < n; i++) this.contrainte({ type:"egal", a:l[0], b:l[i] });
  }

  oblong(c1, c2, m){
    const dx = c2.x - c1.x, dy = c2.y - c1.y, L = Math.hypot(dx, dy);
    if(L < 1e-6) return;
    const nx = -dy / L, ny = dx / L;
    const w = Math.abs((m.x - c1.x) * nx + (m.y - c1.y) * ny);
    if(w < 1e-6) return;
    const A = this.point(c1, c1.id ? {} : { constr:true }), B = this.point(c2, c2.id ? {} : { constr:true });
    const P = (c, s) => this.point({ x:c.x + nx * w * s, y:c.y + ny * w * s, id:null });
    const a1 = P(c1, 1), b1 = P(c2, 1), b2 = P(c2, -1), a2 = P(c1, -1);
    const haut = this.ligne(a1, b1), bas = this.ligne(b2, a2);
    const arcB = this.arc(B, b2, b1, w), arcA = this.arc(A, a1, a2, w);
    for(const [l, a] of [[haut, arcA], [haut, arcB], [bas, arcA], [bas, arcB]]) this.contrainte({ type:"tangente", a:l, b:a });
    this.contrainte({ type:"egal", a:arcA, b:arcB });
  }

  /* ==========================================================================
     Contraintes, cotes, construction, suppression
     ========================================================================== */
  choisis(){
    const idx = indexer(this.esq);
    const els = [...this.selection].map(id => idx.get(id)).filter(Boolean);
    return {
      els,
      points:els.filter(e => e.type === "point"),
      lignes:els.filter(e => e.type === "ligne"),
      courbes:els.filter(e => e.type === "cercle" || e.type === "arc"),
      cotes:[...this.selection].filter(id => this.esq.contraintes.some(k => k.id === id)),
    };
  }

  /** Ajoute des contraintes et les retire si le solveur les refuse. Rend un message ou null. */
  ajouterContraintes(liste, message){
    if(!liste.length) return message;
    const avant = JSON.stringify(this.esq);
    for(const k of liste) this.contrainte(k);
    const res = resoudre(this.ctx.gcs, this.esq, this.v);
    const illisible = this.esq.contraintes.slice(-liste.length).map(k => res.erreurs[k.id]).find(Boolean);
    if(!res.ok || illisible){
      Object.assign(this.esq, JSON.parse(avant));
      this.redessiner();
      return illisible ? `Contrainte refusée : ${illisible}.` : "Contrainte refusée : elle contredit ou double les contraintes existantes.";
    }
    this.ctx.memoriser(avant);
    this.redessiner();
    this.ctx.surModif();
    return null;
  }

  contraindre(type){
    const { points:P, lignes:L, courbes:C, els } = this.choisis();
    const id = (e) => e.id;
    let k = [], aide = null;
    switch(type){
      case "horizontal": case "vertical":
        if(L.length) k = L.map(l => ({ type, a:l.id }));
        else if(P.length === 2) k = [{ type, a:P[0].id, b:P[1].id }];
        else aide = "Sélectionnez une ou plusieurs lignes, ou deux points.";
        break;
      case "coincident":
        if(P.length === 2) k = [{ type, a:P[0].id, b:P[1].id }]; else aide = "Sélectionnez deux points.";
        break;
      case "parallele": case "perpendiculaire":
        if(L.length === 2 && els.length === 2) k = [{ type, a:L[0].id, b:L[1].id }]; else aide = "Sélectionnez deux lignes.";
        break;
      case "tangente":
        if(els.length === 2 && C.length >= 1 && !P.length) k = [{ type, a:id(els[0]), b:id(els[1]) }];
        else aide = "Sélectionnez une ligne et un cercle ou un arc, ou deux courbes.";
        break;
      case "egal":
        if(L.length >= 2 && !C.length) k = L.slice(1).map(l => ({ type, a:L[0].id, b:l.id }));
        else if(C.length >= 2 && !L.length) k = C.slice(1).map(c => ({ type, a:C[0].id, b:c.id }));
        else aide = "Sélectionnez des lignes (même longueur) ou des cercles et arcs (même rayon).";
        break;
      case "concentrique":
        if(C.length === 2) k = [{ type, a:C[0].id, b:C[1].id }]; else aide = "Sélectionnez deux cercles ou arcs.";
        break;
      case "milieu":
        if(P.length === 1 && L.length === 1) k = [{ type, a:P[0].id, b:L[0].id }]; else aide = "Sélectionnez un point et une ligne.";
        break;
      case "symetrie":
        if(P.length === 2 && L.length === 1) k = [{ type, a:P[0].id, b:P[1].id, l:L[0].id }]; else aide = "Sélectionnez deux points et la ligne de symétrie.";
        break;
      case "sur":
        if(P.length === 1 && L.length + C.length === 1) k = [{ type, a:P[0].id, b:(L[0] || C[0]).id }];
        else aide = "Sélectionnez un point et une ligne, un cercle ou un arc.";
        break;
      case "fixe":
        if(P.length) k = P.map(p => ({ type, a:p.id, x:p.x, y:p.y })); else aide = "Sélectionnez les points à fixer.";
        break;
    }
    this.statut(this.ajouterContraintes(k, aide));
  }

  /** Une cote d'après la sélection ; `type` force distanceX / distanceY. */
  coter(type = null){
    const { points:P, lignes:L, courbes:C, els } = this.choisis();
    const idx = indexer(this.esq);
    let k = null;
    const bouts = (l) => [idx.get(l.p1), idx.get(l.p2)];
    if(type === "distanceX" || type === "distanceY"){
      const [a, b] = P.length === 2 ? P : L.length === 1 && els.length === 1 ? bouts(L[0]) : [];
      if(a){
        const d = type === "distanceX" ? b.x - a.x : b.y - a.y;
        k = { type, a:a.id, b:b.id, signe:d < 0 ? -1 : 1, expr:arrondi(Math.abs(d)) };
      }
    }else if(els.length === 1 && L.length === 1){
      const [a, b] = bouts(L[0]);
      k = { type:"longueur", a:L[0].id, expr:arrondi(Math.hypot(b.x - a.x, b.y - a.y)) };
    }else if(els.length === 2 && P.length === 2){
      k = { type:"distance", a:P[0].id, b:P[1].id, expr:arrondi(Math.hypot(P[1].x - P[0].x, P[1].y - P[0].y)) };
    }else if(els.length === 2 && P.length === 1 && L.length === 1){
      const [a, b] = bouts(L[0]), p = P[0];
      const d = Math.abs((b.x - a.x) * (a.y - p.y) - (a.x - p.x) * (b.y - a.y)) / Math.hypot(b.x - a.x, b.y - a.y);
      k = { type:"distance", a:p.id, b:L[0].id, expr:arrondi(d) };
    }else if(els.length === 1 && C.length === 1){
      const c = C[0];
      k = c.type === "cercle" ? { type:"diametre", a:c.id, expr:arrondi(2 * c.r) } : { type:"rayon", a:c.id, expr:arrondi(c.r) };
    }else if(els.length === 2 && L.length === 2){
      const [a1, b1] = bouts(L[0]), [a2, b2] = bouts(L[1]);
      const u = [b1.x - a1.x, b1.y - a1.y], w = [b2.x - a2.x, b2.y - a2.y];
      const ang = Math.atan2(u[0] * w[1] - u[1] * w[0], u[0] * w[0] + u[1] * w[1]) * 180 / Math.PI;
      k = { type:"angle", a:L[0].id, b:L[1].id, signe:ang < 0 ? -1 : 1, expr:arrondi(Math.abs(ang)) };
    }
    if(!k){
      this.statut("Cote : une ligne, deux points, un point et une ligne, un cercle ou un arc, ou deux lignes (angle).");
      return;
    }
    const msg = this.ajouterContraintes([k], null);
    if(msg){ this.statut(msg); return; }
    const cree = this.esq.contraintes[this.esq.contraintes.length - 1];
    this.selection.clear();
    this.redessiner();
    this.statut();
    requestAnimationFrame(() => this.saisir(cree.id));
  }

  basculerConstruction(){
    const { els } = this.choisis();
    const cibles = els;
    if(!cibles.length){ this.statut("Sélectionnez les éléments à passer en construction (ou à rétablir)."); return; }
    this.ctx.memoriser();
    const tous = cibles.every(e => e.constr);
    for(const e of cibles) e.constr = !tous;
    this.redessiner();
    this.ctx.surModif();
  }

  supprimer(){
    if(!this.selection.size) return;
    this.ctx.memoriser();
    const esq = this.esq;
    const parti = new Set(this.selection);
    /* Un point emporte les courbes qui s'y appuient ; une courbe laisse derrière elle les
       points qui ne servent plus à rien (sauf les points isolés voulus). */
    for(const e of esq.elements){
      if((e.type === "ligne" || e.type === "arc") && (parti.has(e.p1) || parti.has(e.p2) || parti.has(e.c))) parti.add(e.id);
      if(e.type === "cercle" && parti.has(e.c)) parti.add(e.id);
      if(e.type === "spline" && e.pts.some(q => parti.has(q))) parti.add(e.id);
      if(e.type === "texte" && parti.has(e.p)) parti.add(e.id);
    }
    esq.elements = esq.elements.filter(e => !parti.has(e.id));
    const utilises = new Set();
    for(const e of esq.elements){
      for(const c of ["p1", "p2", "c", "p"]) if(e[c]) utilises.add(e[c]);
      for(const q of e.pts || []) utilises.add(q);
    }
    for(const k of esq.contraintes) if(!parti.has(k.id)) for(const x of [k.a, k.b, k.l]) if(x) utilises.add(x);
    esq.elements = esq.elements.filter(e => e.type !== "point" || e.seul || e.id === "o" || utilises.has(e.id));
    const reste = new Set(esq.elements.map(e => e.id));
    esq.contraintes = esq.contraintes.filter(k => !parti.has(k.id) && [k.a, k.b, k.l].every(x => x === undefined || reste.has(x)));
    this.selection.clear();
    this.resoudre();
    this.redessiner();
    this.ctx.surModif();
  }

  supprimerContrainte(id){
    this.ctx.memoriser();
    this.esq.contraintes = this.esq.contraintes.filter(k => k.id !== id);
    this.selection.delete(id);
    this.resoudre();
    this.redessiner();
    this.ctx.surModif();
  }

  /** Échap : d'abord le tracé en cours, puis l'outil, puis la sélection. Rend vrai si quelque chose a été annulé. */
  echap(){
    if(this.cotesSaisie){ this.annulerSaisie(); return true; }
    if(this.outil === "spline" && this.clics.length){ this.finirSpline(); return true; }
    if(this.clics.length){ this.clics = []; this.vider(this.apercu); this.ctx.vue.invalider(); return true; }
    if(this.outil){ this.choisirOutil(this.outil); return true; }
    if(this.selection.size){ this.selection.clear(); this.redessiner(); return true; }
    return false;
  }

  resoudre(){
    this.dernier = resoudre(this.ctx.gcs, this.esq, this.v);
    return this.dernier;
  }

  /* ==========================================================================
     Saisie d'une cote
     ========================================================================== */
  saisir(id){
    this.annulerSaisie();
    const k = this.esq.contraintes.find(c => c.id === id);
    const et = this.cotes.get(id);
    if(!k || !et) return;
    const champ = document.createElement("input");
    champ.className = "saisie-cote";
    champ.value = k.expr;
    champ.style.left = et.style.left; champ.style.top = et.style.top;
    champ.title = "Valeur ou expression (L/2…) — Entrée pour valider, Échap pour annuler";
    this.ctx.ctr.appendChild(champ);
    this.cotesSaisie = champ;
    champ.focus(); champ.select();
    champ.onkeydown = (e) => {
      e.stopPropagation();
      if(e.key === "Escape") this.annulerSaisie();
      if(e.key !== "Enter") return;
      let val;
      try{ val = this.v(champ.value); }catch(err){ champ.title = err.message; champ.style.borderColor = "var(--red)"; return; }
      if(!(val > 0) && k.type !== "angle"){ champ.style.borderColor = "var(--red)"; champ.title = "valeur positive attendue"; return; }
      const avant = JSON.stringify(this.esq), ancienne = k.expr;
      k.expr = champ.value.trim();
      const res = resoudre(this.ctx.gcs, this.esq, this.v);
      if(!res.ok){
        k.expr = ancienne;
        champ.style.borderColor = "var(--red)";
        champ.title = "Le solveur ne trouve pas de solution avec cette valeur.";
        return;
      }
      this.ctx.memoriser(avant);
      this.annulerSaisie();
      this.redessiner();
      this.ctx.surModif();
    };
    champ.onblur = () => setTimeout(() => { if(this.cotesSaisie === champ) this.annulerSaisie(); }, 150);
  }

  annulerSaisie(){
    this.cotesSaisie?.remove();
    this.cotesSaisie = null;
  }

  /* ==========================================================================
     Dessin
     ========================================================================== */
  vider(g){
    for(const o of [...g.children]){ o.geometry?.dispose(); o.material?.dispose(); g.remove(o); }
  }

  ligne3(pts, couleur, { pointille = false, epais = false } = {}){
    const geo = new THREE.BufferGeometry().setFromPoints(pts.map(p => new THREE.Vector3(p.x, p.y, 0)));
    const mat = pointille
      ? new THREE.LineDashedMaterial({ color:couleur, dashSize:this.echelle * 0.012, gapSize:this.echelle * 0.008, depthTest:false, transparent:true })
      : new THREE.LineBasicMaterial({ color:couleur, depthTest:false, transparent:true, opacity:epais ? 1 : 0.95 });
    const l = new THREE.Line(geo, mat);
    if(pointille) l.computeLineDistances();
    l.renderOrder = 10;
    return l;
  }

  /** Les points d'une courbe d'esquisse, en coordonnées locales. */
  trace(idx, e){
    if(e.type === "ligne") return [idx.get(e.p1), idx.get(e.p2)];
    if(e.type === "spline") return echantillonSpline(e.pts.map(q => { const p = idx.get(q); return [p.x, p.y]; })).map(([x, y]) => ({ x, y }));
    if(e.type === "texte"){      // shortcut: un cadre approché ; le contour exact vient de la police, côté noyau
      const p = idx.get(e.p), l = e.contenu.length * e.h * 0.6;
      return [p, { x:p.x + l, y:p.y }, { x:p.x + l, y:p.y + e.h }, { x:p.x, y:p.y + e.h }, p];
    }
    const c = idx.get(e.c);
    let a1 = 0, bal = TAU;
    if(e.type === "arc"){
      const p1 = idx.get(e.p1), p2 = idx.get(e.p2);
      a1 = Math.atan2(p1.y - c.y, p1.x - c.x);
      bal = (Math.atan2(p2.y - c.y, p2.x - c.x) - a1) % TAU;
      if(bal <= 1e-9) bal += TAU;
    }
    const n = Math.max(8, Math.ceil(64 * bal / TAU));
    return Array.from({ length:n + 1 }, (_, i) => ({ x:c.x + e.r * Math.cos(a1 + bal * i / n), y:c.y + e.r * Math.sin(a1 + bal * i / n) }));
  }

  redessiner(){
    if(!this.esq) return;
    const { vue } = this.ctx;
    this.vider(this.groupe);
    this.echelle = vue.rayonModele || 100;
    const idx = indexer(this.esq);
    const conflits = new Set(this.dernier?.conflits || []);
    const enConflit = new Set();
    for(const k of this.esq.contraintes) if(conflits.has(k.id)) for(const x of [k.a, k.b, k.l]) if(x) enConflit.add(x);

    /* Les axes du plan, et une grille discrète pour donner l'échelle. */
    const L = this.echelle;
    this.groupe.add(this.ligne3([{ x:-L, y:0 }, { x:L, y:0 }], 0xef5350, { pointille:true }));
    this.groupe.add(this.ligne3([{ x:0, y:-L }, { x:0, y:L }], 0x43a047, { pointille:true }));
    const pas = 10 ** Math.floor(Math.log10(L / 5));
    const grille = [];
    for(let t = -Math.ceil(L / pas) * pas; t <= L; t += pas){
      grille.push(new THREE.Vector3(t, -L, 0), new THREE.Vector3(t, L, 0), new THREE.Vector3(-L, t, 0), new THREE.Vector3(L, t, 0));
    }
    const g = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(grille),
      new THREE.LineBasicMaterial({ color:0x8b919c, transparent:true, opacity:0.12, depthTest:false }));
    g.renderOrder = 9;
    this.groupe.add(g);

    const couleur = (e) => this.selection.has(e.id) ? COULEURS.sel : enConflit.has(e.id) ? COULEURS.conflit
      : this.survol === e.id ? COULEURS.survol : e.constr ? COULEURS.construction : COULEURS.normal;
    for(const e of this.esq.elements){
      if(e.type === "point") continue;
      if(e.type === "texte" && this.ctx.contourTexte?.(e.contenu, e.h)) continue;
      this.groupe.add(this.ligne3(this.trace(idx, e), couleur(e), { pointille:!!e.constr }));
    }
    /* Le texte : son contour exact, demandé au noyau ; le cadre en attendant. */
    for(const e of this.esq.elements){
      if(e.type !== "texte") continue;
      const p = idx.get(e.p), lignes = this.ctx.contourTexte?.(e.contenu, e.h);
      if(lignes) for(const l of lignes) this.groupe.add(this.ligne3(l.map(([x, y]) => ({ x:x + p.x, y:y + p.y })), couleur(e)));
    }
    const pos = [], col = [], c3 = new THREE.Color();
    for(const e of this.esq.elements){
      if(e.type !== "point") continue;
      pos.push(e.x, e.y, 0);
      c3.setHex(e.id === "o" ? 0xe6e8ec : couleur(e));
      col.push(c3.r, c3.g, c3.b);
    }
    const pts = new THREE.Points(new THREE.BufferGeometry()
      .setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
      .setAttribute("color", new THREE.Float32BufferAttribute(col, 3)),
      new THREE.PointsMaterial({ size:7, sizeAttenuation:false, vertexColors:true, depthTest:false }));
    pts.renderOrder = 11;
    this.groupe.add(pts);

    this.majCotes(idx, conflits);
    this.ctx.surListe?.();
    vue.invalider();
  }

  dessinerApercu(m){
    this.vider(this.apercu);
    if(!m) return;
    const c = this.clics, col = COULEURS.apercu, opt = { pointille:true };
    const A = (pts) => this.apercu.add(this.ligne3(pts, col, opt));
    const cercle = (ce, r, a1 = 0, bal = TAU) => Array.from({ length:49 }, (_, i) => ({ x:ce.x + r * Math.cos(a1 + bal * i / 48), y:ce.y + r * Math.sin(a1 + bal * i / 48) }));
    switch(this.outil){
      case "spline": A(echantillonSpline([...c, m].map(p => [p.x, p.y])).map(([x, y]) => ({ x, y }))); break;
      case "ligne": A([c[0], m]); break;
      case "rectangle": A([c[0], { x:m.x, y:c[0].y }, m, { x:c[0].x, y:m.y }, c[0]]); break;
      case "rectangleCentre": { const o = { x:2 * c[0].x - m.x, y:2 * c[0].y - m.y }; A([o, { x:m.x, y:o.y }, m, { x:o.x, y:m.y }, o]); break; }
      case "cercle": A(cercle(c[0], Math.hypot(m.x - c[0].x, m.y - c[0].y))); break;
      case "arc3": {
        if(c.length < 2){ A([c[0], m]); break; }
        const k = cercle3Points(c[0], m, c[1]);
        if(!k){ A([c[0], c[1]]); break; }
        const [d, f] = k.trigo ? [c[0], c[1]] : [c[1], c[0]];
        const a1 = Math.atan2(d.y - k.c.y, d.x - k.c.x);
        let bal = (Math.atan2(f.y - k.c.y, f.x - k.c.x) - a1) % TAU; if(bal <= 0) bal += TAU;
        A(cercle(k.c, k.r, a1, bal));
        break;
      }
      case "arcCentre": {
        const r = Math.hypot((c[1] || m).x - c[0].x, (c[1] || m).y - c[0].y);
        if(c.length < 2){ A([c[0], m]); A(cercle(c[0], r)); break; }
        const a1 = Math.atan2(c[1].y - c[0].y, c[1].x - c[0].x);
        let bal = (Math.atan2(m.y - c[0].y, m.x - c[0].x) - a1) % TAU; if(bal <= 0) bal += TAU;
        A(cercle(c[0], r, a1, bal));
        break;
      }
      case "polygone": {
        const r = Math.hypot(m.x - c[0].x, m.y - c[0].y), t0 = Math.atan2(m.y - c[0].y, m.x - c[0].x), n = this.nbCotes;
        A(Array.from({ length:n + 1 }, (_, i) => ({ x:c[0].x + r * Math.cos(t0 + i * TAU / n), y:c[0].y + r * Math.sin(t0 + i * TAU / n) })));
        break;
      }
      case "oblong": {
        if(c.length < 2){ A([c[0], m]); break; }
        const dx = c[1].x - c[0].x, dy = c[1].y - c[0].y, Lg = Math.hypot(dx, dy) || 1;
        const nx = -dy / Lg, ny = dx / Lg, w = Math.abs((m.x - c[0].x) * nx + (m.y - c[0].y) * ny);
        const t = Math.atan2(dy, dx);
        A([...cercle(c[1], w, t - Math.PI / 2, Math.PI), ...cercle(c[0], w, t + Math.PI / 2, Math.PI), { x:c[1].x - nx * w, y:c[1].y - ny * w }]);
        break;
      }
    }
    this.ctx.vue.invalider();
  }

  /* ==========================================================================
     Étiquettes des cotes
     ========================================================================== */
  majCotes(idx, conflits){
    const vues = new Set();
    for(const k of this.esq.contraintes){
      if(!COTES.has(k.type)) continue;
      vues.add(k.id);
      let et = this.cotes.get(k.id);
      if(!et){
        et = document.createElement("div");
        et.className = "cote-esquisse";
        et.onclick = (e) => {
          e.stopPropagation();
          if(!e.shiftKey) this.selection.clear();
          this.selection.add(k.id);
          this.redessiner();
        };
        et.ondblclick = (e) => { e.stopPropagation(); this.saisir(k.id); };
        et.onpointerdown = (e) => e.stopPropagation();
        this.ctx.ctr.appendChild(et);
        this.cotes.set(k.id, et);
      }
      let val = NaN;
      try{ val = this.v(k.expr); }catch(_){ /* affichée telle quelle, en rouge */ }
      const prefixe = { diametre:"⌀", rayon:"R", angle:"∠", distanceX:"↔ ", distanceY:"↕ " }[k.type] || "";
      const unite = k.type === "angle" ? "°" : "";
      et.textContent = prefixe + (estNombre(k.expr) ? fmt(val) : `${k.expr} = ${Number.isFinite(val) ? fmt(val) : "?"}`) + unite;
      et.title = `${NOMS_CONTRAINTES[k.type]} — double-clic pour modifier`;
      et.classList.toggle("sel", this.selection.has(k.id));
      et.classList.toggle("conflit", conflits.has(k.id) || !Number.isFinite(val));
      et.ancre = this.ancreCote(idx, k);
    }
    for(const e of this.esq.elements){
      if(e.type !== "texte") continue;
      vues.add(e.id);
      let et = this.cotes.get(e.id);
      if(!et){
        et = document.createElement("div");
        et.className = "cote-esquisse texte";
        et.onpointerdown = (ev) => ev.stopPropagation();
        et.onclick = (ev) => { ev.stopPropagation(); if(!ev.shiftKey) this.selection.clear(); this.selection.add(e.id); this.redessiner(); };
        et.ondblclick = async (ev) => {
          ev.stopPropagation();
          const actuel = indexer(this.esq).get(e.id);    // annuler a pu remplacer l'objet depuis la création de l'étiquette
          if(!actuel) return;
          const t = await this.demanderLeTexte(actuel.contenu, String(actuel.h));
          if(!t) return;
          this.ctx.memoriser();
          Object.assign(actuel, t);
          this.redessiner();
          this.ctx.surModif();
        };
        this.ctx.ctr.appendChild(et);
        this.cotes.set(e.id, et);
      }
      et.textContent = "T";          // sous le point d'ancrage : le texte lui-même reste lisible
      et.title = `Texte « ${e.contenu} » · ${e.h} mm — double-clic pour le modifier`;
      et.classList.toggle("sel", this.selection.has(e.id));
      et.ancre = idx.get(e.p);
    }
    for(const [id, et] of this.cotes) if(!vues.has(id)){ et.remove(); this.cotes.delete(id); }
    this.placerCotes();
  }

  ancreCote(idx, k){
    const P = (id) => idx.get(id);
    const milieu = (a, b) => ({ x:(a.x + b.x) / 2, y:(a.y + b.y) / 2 });
    try{
      if(k.type === "longueur"){ const l = P(k.a); return milieu(P(l.p1), P(l.p2)); }
      if(k.type === "rayon" || k.type === "diametre"){
        const e = P(k.a), c = P(e.c);
        const t = e.type === "arc" ? Math.atan2(milieuArc(idx, e).y - c.y, milieuArc(idx, e).x - c.x) : Math.PI / 4;
        return { x:c.x + e.r * Math.cos(t), y:c.y + e.r * Math.sin(t) };
      }
      if(k.type === "angle"){ const a = P(k.a), b = P(k.b); return milieu(milieu(P(a.p1), P(a.p2)), milieu(P(b.p1), P(b.p2))); }
      const b = P(k.b);
      if(b.type === "ligne"){ return milieu(P(k.a), milieu(P(b.p1), P(b.p2))); }
      return milieu(P(k.a), b);
    }catch(_){ return { x:0, y:0 }; }
  }

  placerCotes(){
    for(const et of this.cotes.values()){
      if(!et.ancre) continue;
      const p = this.ecran(et.ancre.x, et.ancre.y);
      et.style.left = p.x + "px";
      et.style.top = (p.y - 12) + "px";
    }
  }

  /* ==========================================================================
     Liste des contraintes (panneau Propriétés) et barre d'état
     ========================================================================== */
  remplirListe(hote){
    const idx = indexer(this.esq);
    const conflits = new Set(this.dernier?.conflits || []);
    const nomEl = (id) => {
      const e = idx.get(id);
      return !e ? "?" : e.id === "o" ? "origine" : ({ point:"point", ligne:"ligne", cercle:"cercle", arc:"arc", spline:"spline", texte:"texte" }[e.type] + " " + e.id.slice(1));
    };
    const n = this.esq.elements.filter(e => e.type !== "point").length;
    hote.innerHTML = `<h4>Esquisse « ${echapper(this.esq.nom)} »</h4>
      <table><tr><td>Plan</td><td>${this.esq.plan.base ? this.esq.plan.base + (this.esq.plan.decalage && this.esq.plan.decalage !== "0" ? " + " + echapper(this.esq.plan.decalage) : "") : this.esq.plan.ref ? "plan de construction" : "face"}</td></tr>
      <tr><td>Éléments</td><td>${n}</td></tr>
      <tr><td>Contraintes</td><td>${this.esq.contraintes.length}</td></tr>
      <tr><td>Solveur</td><td>${this.dernier?.ok === false ? '<span style="color:var(--red)">en conflit</span>' : "résolu"}</td></tr></table>
      <h4>Contraintes et cotes</h4><ul class="ctr-liste"></ul>`;
    const ul = hote.querySelector("ul");
    for(const k of this.esq.contraintes){
      const li = document.createElement("li");
      li.classList.toggle("conflit", conflits.has(k.id));
      const s = document.createElement("span");
      s.textContent = `${NOMS_CONTRAINTES[k.type] || k.type} : ${[k.a, k.b, k.l].filter(Boolean).map(nomEl).join(", ")}${k.expr !== undefined ? " = " + k.expr : ""}`;
      s.onclick = () => { this.selection.clear(); for(const x of [k.a, k.b, k.l]) if(x) this.selection.add(x); this.redessiner(); };
      const b = document.createElement("button");
      b.textContent = "✕"; b.title = "Supprimer cette contrainte";
      b.onclick = () => this.supprimerContrainte(k.id);
      li.append(s, b);
      ul.appendChild(li);
    }
  }

  statut(message){
    const aides = {
      ligne:"Ligne : cliquez les points successifs ; Échap termine la chaîne.",
      rectangle:"Rectangle : premier coin, puis coin opposé.",
      rectangleCentre:"Rectangle centré : centre, puis un coin.",
      cercle:"Cercle : centre, puis un point du cercle.",
      arc3:"Arc : début, fin, puis un point de passage.",
      arcCentre:"Arc : centre, début, puis fin (sens trigonométrique).",
      polygone:`Polygone à ${this.nbCotes} côtés (touches 3 à 9) : centre, puis un sommet.`,
      oblong:"Oblong : premier centre, second centre, puis la largeur.",
      point:"Point : chaque clic pose un point isolé (centre de perçage).",
      ajuster:"Ajuster : cliquez le morceau de courbe à retirer.",
      spline:"Spline : cliquez les points ; Entrée ou Échap pour finir.",
      texte:"Texte : cliquez le point d'ancrage (bas gauche).",
    };
    this.ctx.surStatut(message || aides[this.outil] || "Cliquez pour sélectionner (Maj pour ajouter), glissez un point pour le déplacer.");
  }
}

