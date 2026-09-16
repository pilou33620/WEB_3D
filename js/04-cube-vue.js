/* =============================================================================
   Visionneuse 3D — 04-cube-vue.js
   Le cube de vues, dans le coin de l'écran, comme dans tout modeleur.

   Il répond à deux questions qu'on se pose sans arrêt en 3D : « d'où
   est-ce que je regarde ? » et « comment revenir à une vue franche ? ».
   D'où les 26 zones cliquables : 6 faces, 12 arêtes, 8 coins — une face
   donne une vue normalisée, une arête une vue à 45°, un coin une isométrique.

   Le cube a son propre moteur de rendu et son propre canevas. C'est un peu
   de mémoire graphique en plus, contre la garantie qu'il reste net et
   qu'aucun réglage de la scène principale (coupe, transparence, fond clair)
   ne vienne le déformer.

   Repère : ici comme dans la scène, X va à droite, Y vers le fond, Z en haut.
   ============================================================================= */
"use strict";

import * as THREE from "three";

/* Fraction du demi-côté au-delà de laquelle un clic appartient au bord.
   0,35 donne des faces larges et des coins encore attrapables à la souris. */
const BORD = 0.35;

/**
 * Les six faces, dans la convention de la scène. En CAO la verticale est Z et
 * l'avant est −Y ; en 3D temps réel la verticale est Y et l'avant est +Z. Les
 * deux tables sont écrites ici plutôt que déduites, parce que l'orientation du
 * texte sur chaque face en dépend aussi : une étiquette « DESSUS » se lit
 * l'avant vers le bas, ce qu'aucune règle générale ne donne.
 */
const FACES = {
  z: [
    { n:[ 0, 0, 1], haut:[0, 1, 0], texte:"DESSUS"  },
    { n:[ 0, 0,-1], haut:[0,-1, 0], texte:"DESSOUS" },
    { n:[ 0,-1, 0], haut:[0, 0, 1], texte:"AVANT"   },
    { n:[ 0, 1, 0], haut:[0, 0, 1], texte:"ARRIÈRE" },
    { n:[ 1, 0, 0], haut:[0, 0, 1], texte:"DROITE"  },
    { n:[-1, 0, 0], haut:[0, 0, 1], texte:"GAUCHE"  },
  ],
  y: [
    { n:[ 0, 1, 0], haut:[0, 0,-1], texte:"DESSUS"  },
    { n:[ 0,-1, 0], haut:[0, 0, 1], texte:"DESSOUS" },
    { n:[ 0, 0, 1], haut:[0, 1, 0], texte:"AVANT"   },
    { n:[ 0, 0,-1], haut:[0, 1, 0], texte:"ARRIÈRE" },
    { n:[ 1, 0, 0], haut:[0, 1, 0], texte:"DROITE"  },
    { n:[-1, 0, 0], haut:[0, 1, 0], texte:"GAUCHE"  },
  ],
};

export class CubeVue {
  constructor(canvas, vue, navigation){
    this.canvas = canvas;
    this.vue = vue;
    this.nav = navigation;
    this.survol = null;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.renderer.setSize(canvas.clientWidth || 150, canvas.clientHeight || 150, false);

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1.5, 1.5, 1.5, -1.5, 0.1, 100);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8892a0, 2.2));
    const dir = new THREE.DirectionalLight(0xffffff, 1.1);
    dir.position.set(2, -3, 4);
    this.scene.add(dir);

    this.cube = new THREE.Group();
    this.scene.add(this.cube);
    this.etiquettes = [];
    this.construireCube();
    this.poserEtiquettes(vue.haut.z === 1 ? "z" : "y");
    this.construireTriade();

    this.rc = new THREE.Raycaster();
    this.souris = new THREE.Vector2();
    this.brancherEvenements();
  }

  /* ==========================================================================
     Géométrie du cube
     ========================================================================== */
  construireCube(){
    /* Le corps, légèrement en retrait des étiquettes : c'est lui qui reçoit
       les rayons, et lui seul, pour que la détection des zones soit franche. */
    this.corps = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color:0xdfe3e8, roughness:0.85, metalness:0.0 }),
    );
    this.cube.add(this.corps);

    const aretes = new THREE.LineSegments(
      new THREE.EdgesGeometry(this.corps.geometry),
      new THREE.LineBasicMaterial({ color:0x8b919c }),
    );
    aretes.raycast = () => {};
    this.cube.add(aretes);

    /* La zone survolée, dessinée par-dessus. Sa boîte est calculée à partir
       de la même règle que la détection : ce qu'on éclaire est exactement ce
       qu'on obtiendra en cliquant. */
    this.surbrillance = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color:0x3fa0ea, transparent:true, opacity:0.45, depthTest:false }),
    );
    this.surbrillance.visible = false;
    this.surbrillance.renderOrder = 2;
    this.surbrillance.raycast = () => {};
    this.cube.add(this.surbrillance);
  }

  /** (Re)pose les six étiquettes selon l'axe vertical courant. */
  poserEtiquettes(axe){
    for(const e of this.etiquettes){
      this.cube.remove(e);
      e.geometry.dispose();
      e.material.map?.dispose();
      e.material.dispose();
    }
    this.etiquettes = [];

    for(const f of (FACES[axe] || FACES.z)){
      const n = new THREE.Vector3(...f.n);
      const haut = new THREE.Vector3(...f.haut);
      /* Base directe : droite × haut = normale, sinon le texte est en miroir. */
      const droite = new THREE.Vector3().crossVectors(haut, n);

      const plan = new THREE.Mesh(
        new THREE.PlaneGeometry(0.98, 0.98),
        new THREE.MeshBasicMaterial({ map:this.textureEtiquette(f.texte), transparent:true }),
      );
      plan.applyMatrix4(new THREE.Matrix4().makeBasis(droite, haut, n));
      plan.position.copy(n).multiplyScalar(0.501);
      plan.raycast = () => {};       // le corps suffit à la détection
      this.cube.add(plan);
      this.etiquettes.push(plan);
    }
    this.rendre();
  }

  textureEtiquette(texte){
    const c = document.createElement("canvas");
    c.width = c.height = 160;
    const g = c.getContext("2d");
    g.clearRect(0, 0, 160, 160);
    g.fillStyle = "rgba(246,248,250,0.96)";
    g.fillRect(0, 0, 160, 160);
    g.strokeStyle = "#aeb5bf"; g.lineWidth = 3;
    g.strokeRect(1.5, 1.5, 157, 157);
    g.fillStyle = "#23272e";
    g.font = `600 ${texte.length > 6 ? 24 : 27}px "Segoe UI", system-ui, sans-serif`;
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(texte, 80, 82);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }

  /** La triade : trois traits depuis le coin avant-gauche-bas, et leurs lettres. */
  construireTriade(){
    const origine = new THREE.Vector3(-0.5, -0.5, -0.5);
    const axes = [
      { v:new THREE.Vector3(1,0,0), c:0xe8443a, l:"X" },
      { v:new THREE.Vector3(0,1,0), c:0x4cc38a, l:"Y" },
      { v:new THREE.Vector3(0,0,1), c:0x6d8cff, l:"Z" },
    ];
    this.triade = new THREE.Group();
    for(const a of axes){
      const bout = origine.clone().addScaledVector(a.v, 1.32);
      const g = new THREE.BufferGeometry().setFromPoints([origine, bout]);
      const ligne = new THREE.Line(g, new THREE.LineBasicMaterial({ color:a.c, transparent:true, opacity:0.9 }));
      ligne.raycast = () => {};
      this.triade.add(ligne);

      const c = document.createElement("canvas");
      c.width = c.height = 64;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#" + a.c.toString(16).padStart(6, "0");
      ctx.font = "700 44px \"Segoe UI\", system-ui, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(a.l, 32, 34);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      const lettre = new THREE.Sprite(new THREE.SpriteMaterial({ map:tex, transparent:true, depthTest:false }));
      lettre.position.copy(origine).addScaledVector(a.v, 1.52);
      lettre.scale.setScalar(0.34);
      lettre.renderOrder = 3;
      this.triade.add(lettre);
    }
    this.scene.add(this.triade);
  }

  /* ==========================================================================
     Zones : de l'impact au vecteur de vue
     ========================================================================== */

  /**
   * Un point sur la peau du cube donne trois composantes dans [−0,5 ; 0,5].
   * Chacune devient −1, 0 ou +1 selon qu'elle touche un bord : (0,0,1) est
   * une face, (1,0,1) une arête, (1,1,1) un coin. Le vecteur obtenu est
   * exactement la direction depuis laquelle regarder.
   */
  zoneDepuisPoint(p){
    const d = new THREE.Vector3();
    for(const axe of ["x", "y", "z"]){
      const c = p[axe];
      d[axe] = c > BORD ? 1 : c < -BORD ? -1 : 0;
    }
    if(d.lengthSq() === 0) d.z = 1;   // au centre d'une face rasante
    return d;
  }

  majSurbrillance(zone){
    if(!zone){ this.surbrillance.visible = false; return; }
    const taille = new THREE.Vector3(), centre = new THREE.Vector3();
    for(const axe of ["x", "y", "z"]){
      if(zone[axe] === 0){ taille[axe] = BORD * 2; centre[axe] = 0; }
      else { taille[axe] = 0.5 - BORD; centre[axe] = zone[axe] * (BORD + (0.5 - BORD) / 2); }
    }
    this.surbrillance.scale.copy(taille).multiplyScalar(1.02);
    this.surbrillance.position.copy(centre);
    this.surbrillance.visible = true;
  }

  /* ==========================================================================
     Évènements
     ========================================================================== */
  brancherEvenements(){
    const c = this.canvas;
    c.addEventListener("pointermove", (e) => {
      if(this.glisse){ this.glisser(e); return; }
      const z = this.zoneSous(e);
      if((z && this.survol && z.equals(this.survol)) || (!z && !this.survol)) return;
      this.survol = z;
      this.majSurbrillance(z);
      c.style.cursor = z ? "pointer" : "default";
      this.rendre();
    });
    c.addEventListener("pointerleave", () => {
      this.survol = null; this.majSurbrillance(null); this.rendre();
    });
    c.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      c.setPointerCapture(e.pointerId);
      this.depart = { x:e.clientX, y:e.clientY, zone:this.zoneSous(e) };
      this.glisse = false;
    });
    c.addEventListener("pointermove", (e) => {
      if(!this.depart) return;
      if(!this.glisse && Math.hypot(e.clientX - this.depart.x, e.clientY - this.depart.y) > 4)
        this.glisse = true;
    });
    c.addEventListener("pointerup", (e) => {
      try{ c.releasePointerCapture(e.pointerId); }catch(err){}
      const d = this.depart;
      this.depart = null;
      const glissait = this.glisse;
      this.glisse = false;
      if(!d || glissait) return;
      const zone = d.zone || this.zoneSous(e);
      /* On oriente la caméra dans le repère du monde : le cube n'est qu'une
         représentation, il ne porte aucune transformation propre. */
      if(zone) this.nav.allerVersDirection(zone.clone().normalize(), true);
    });
    c.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  /** Glisser sur le cube fait tourner la scène, comme dans un modeleur. */
  glisser(e){
    const dx = e.movementX || 0, dy = e.movementY || 0;
    if(dx || dy) this.nav.orbiter(dx * 1.6, dy * 1.6);
  }

  zoneSous(ev){
    const r = this.canvas.getBoundingClientRect();
    this.souris.set(((ev.clientX - r.left) / r.width) * 2 - 1,
                    -((ev.clientY - r.top) / r.height) * 2 + 1);
    this.rc.setFromCamera(this.souris, this.camera);
    const t = this.rc.intersectObject(this.corps, false);
    return t.length ? this.zoneDepuisPoint(t[0].point) : null;
  }

  /* ==========================================================================
     Rendu — calé sur la caméra principale
     ========================================================================== */
  rendre(){
    const principale = this.vue.camera();
    const dir = new THREE.Vector3().subVectors(principale.position, this.vue.cible);
    if(dir.lengthSq() < 1e-12) dir.set(0, -1, 0);
    dir.normalize();

    this.camera.position.copy(dir).multiplyScalar(4);
    this.camera.up.copy(principale.up);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
  }

  redimensionner(){
    const l = this.canvas.clientWidth || 150, h = this.canvas.clientHeight || 150;
    this.renderer.setSize(l, h, false);
    this.rendre();
  }
}
