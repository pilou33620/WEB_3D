/* =============================================================================
   Conception 3D — c8-analyses.js
   Les analyses de surface de l'onglet Inspecter : zébrures (continuité des
   reflets), dépouille (démoulage selon Z), courbure. Un seul matériau à nuanceur
   qui remplace ceux des corps tant que l'analyse est active ; tout se calcule à
   l'affichage, à partir des normales que le noyau a déjà données.
   ============================================================================= */
"use strict";

import * as THREE from "three";

export const ANALYSES = {
  zebra:{ mode:1, nom:"Zébrures", aide:"Zébrures : une bande brisée à la jonction de deux faces trahit une rupture de tangence." },
  depouille:{ mode:2, nom:"Dépouille", aide:"Dépouille selon Z : vert et rouge démoulent vers le haut et vers le bas ; jaune : moins de 3°, à revoir." },
  courbure:{ mode:3, nom:"Courbure", aide:"Courbure : bleu plat, vert R ≈ 10 mm, rouge R ≤ 5 mm." },
  reflets:{ mode:4, nom:"Reflets", aide:"Reflets : un métal poli sous un ciel ; un reflet brisé trahit une rupture de surface." },
  isocourbes:{ mode:5, nom:"Isocourbes", aide:"Isocourbes : une ligne tous les 5 mm de hauteur (Z), comme les courbes de niveau d'une carte." },
  acces:{ mode:6, nom:"Accessibilité", aide:"Accessibilité depuis +Z : vert face à l'outil, jaune de profil, rouge en contre-dépouille." },
};

const VERTEX = `
varying vec3 vN; varying vec3 vNm; varying vec3 vP; varying vec3 vPm;
#include <clipping_planes_pars_vertex>
void main(){
  vN = normalize(normalMatrix * normal);
  vNm = normalize(mat3(modelMatrix) * normal);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vP = mvPosition.xyz;
  vPm = (modelMatrix * vec4(position, 1.0)).xyz;
  #include <clipping_planes_vertex>
  gl_Position = projectionMatrix * mvPosition;
}`;

const FRAGMENT = `
uniform int mode;
varying vec3 vN; varying vec3 vNm; varying vec3 vP; varying vec3 vPm;
#include <clipping_planes_pars_fragment>
vec3 rampe(float t){ return t < 0.5 ? mix(vec3(0.2, 0.4, 0.9), vec3(0.3, 0.8, 0.5), t * 2.0) : mix(vec3(0.3, 0.8, 0.5), vec3(0.9, 0.25, 0.2), t * 2.0 - 1.0); }
void main(){
  #include <clipping_planes_fragment>
  vec3 n = normalize(vN);
  vec3 c;
  if(mode == 1){
    vec3 r = reflect(normalize(vP), n);
    c = vec3(smoothstep(-0.12, 0.12, sin(r.y * 42.0 + r.x * 10.0)));
  }else if(mode == 2){
    float a = asin(clamp(normalize(vNm).z, -1.0, 1.0)) * 57.29578;
    c = abs(a) < 3.0 ? vec3(0.95, 0.78, 0.27) : a > 0.0 ? vec3(0.3, 0.76, 0.54) : vec3(0.91, 0.27, 0.23);
  }else if(mode == 4){
    vec3 r = reflect(normalize(vP), n);
    float h = 0.5 + 0.5 * r.y;
    c = mix(vec3(0.12, 0.13, 0.16), vec3(0.85, 0.9, 1.0), smoothstep(0.42, 0.58, h)) + vec3(0.25) * pow(max(r.z, 0.0), 24.0);
  }else if(mode == 5){
    float z = vPm.z / 5.0, d = abs(fract(z - 0.5) - 0.5) / max(fwidth(z), 1e-5);
    c = mix(vec3(0.95, 0.78, 0.27), vec3(0.34, 0.37, 0.42) + 0.25 * max(n.z, 0.0), smoothstep(0.5, 1.5, d));
  }else if(mode == 6){
    float z = normalize(vNm).z;
    c = z > 0.02 ? mix(vec3(0.95, 0.78, 0.27), vec3(0.3, 0.76, 0.54), smoothstep(0.02, 0.3, z)) : z > -0.02 ? vec3(0.95, 0.78, 0.27) : vec3(0.91, 0.27, 0.23);
  }else{
    float k = length(fwidth(n)) / max(length(fwidth(vP)), 1e-5);
    c = rampe(clamp(k * 5.0, 0.0, 1.0));
  }
  gl_FragColor = vec4(c, 1.0);
}`;

/** Pose (ou retire, mode = null) l'analyse sur tous les corps de la scène. */
export function appliquerAnalyse(vue, nom){
  const a = nom && ANALYSES[nom];
  vue.modele.traverse(o => {
    if(!o.isMesh) return;
    if(o.userData.matAnalyse){
      o.material.dispose();
      o.material = o.userData.matAnalyse;
      delete o.userData.matAnalyse;
    }
    if(a){
      o.userData.matAnalyse = o.material;
      o.material = new THREE.ShaderMaterial({ uniforms:{ mode:{ value:a.mode } }, vertexShader:VERTEX, fragmentShader:FRAGMENT,
        clipping:true, toneMapped:false, polygonOffset:true, polygonOffsetFactor:1, polygonOffsetUnits:1 });
    }
  });
  vue.recenserMateriaux();
  vue.invalider();
}
