# Graph Report - WEB_3D  (2026-11-06)

## Corpus Check
- 96 files · ~683,977 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 18 file(s) not represented in the graph (top: .css 4, .wasm 3, .step 2)

## Summary
- 6676 nodes · 15577 edges · 221 communities (144 shown, 77 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 412 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b13a0845`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- three.core.js
- three.module.js
- .push
- replicad.js
- get
- BufferAttribute
- update
- .parse
- WebGLRenderer
- Object3D
- Sphere
- mm
- .render
- Vector2
- 08-interface.js
- Mesure
- .equals
- .applyMatrix4
- Interface
- Quaternion
- Vector4
- .setFromMatrixPosition
- .dispose
- Vector3
- Loader
- .setRenderTarget
- AnimationAction
- Box3
- Matrix4
- TextureSource
- ObjectLoader
- Vue3D
- .parseObject
- PropertyBinding
- Color
- 14-pilote-3d.js
- 07-mesure.js
- 06-topologie.js
- CoupeManager
- casting-c4FpthHM.js
- 05-arbre.js
- .processTextureAsync
- AnimationMixer
- InstancedBufferAttribute
- c11-plus-ui.js
- Matrix3
- WebGLProgram
- LightShadow
- travailleur-occt.js
- Navigation
- .dispatchEvent
- addToRenderList
- appairage.py
- RenderTarget
- KeyframeTrack
- BatchedMesh
- GcsSystemMock
- Euler
- WebGLBindingStates
- GLTFWriter
- .push
- warn
- Texture
- MaterialCreator
- InterleavedBuffer
- brancherDeplacement
- web_3D.py
- Pass
- fflate.module.js
- GTAOPass
- arraysEqual
- banc-exemples.mjs
- Curve
- Parser
- .constructor
- getMaterialExtension
- AnimationClip
- Interpolant
- creer
- Conception
- .clone
- PolyhedronGeometry
- Spherical
- getParameters
- Gestionnaire
- Garde
- CubeVue
- OBJLoader.js
- LoadingManager
- GLTFLoader.js
- PositionalAudio
- createWasm
- CubicBezierCurve
- banc-pilote-3d.mjs
- .constructor
- GLTFParser
- banc-conception.mjs
- .get
- Path
- .lineTo
- parseUniform
- EffectComposer
- .parse
- PropertyMixer
- BufferGeometryUtils.js
- delete
- .copy
- VideoTexture
- Appairage
- EditeurEsquisse
- c4-travailleur.js
- EventDispatcher
- 02-import.js
- .read
- .loadTextureImage
- GLTFExporter.js
- c6-conception.js
- Pilote
- CompressedArrayTexture
- find
- banc-conception-plus.mjs
- abort
- GTAOPass.js
- FullScreenQuad
- Table
- À faire — fonctionnalités et bugs
- QuadraticBezierCurve
- c3-operations.js
- ContextParams
- error
- postRun
- .processImage
- .writeAsync
- .push_constraint
- Clock
- cloneUniforms
- Cylindrical
- parseCFFTable
- GLBufferAttribute
- GcsWrapper
- b
- 12-collisions.js
- SimplexNoise
- Font
- EffectComposer.js
- PerspectiveCamera
- Module
- WebGLMaterials
- Tokenizer
- .load
- H
- ouvrir.py
- pilote.py
- craftInvokerFunction
- getCallstack
- ___syscall_ioctl
- telephone.js
- Layers
- index.js
- boundingBox
- deflate
- UniformsGroup
- Module
- GLTFMaterialsUnlitExtension
- write
- registerType
- syncfs
- syscallGetVarargI
- SketchIndex
- ShaderPass.js
- CylinderGeometry
- C
- extend
- ._createAnimationTracks
- Uniform
- _points
- Line
- harnais-page.mjs
- close
- gzip
- BezierInterpolant
- StepExtractor
- banc-conception-perf.mjs
- SkeletonUtils.js
- probeAsync
- MultiDrawRenderList
- zip
- Substitution
- allocate
- ioctl
- llseek
- lookup
- mknod
- mount
- readdir
- readlink
- rename
- rmdir
- symlink
- unlink
- FlateErrorCode
- Sprite
- GLTFCubicSplineInterpolant
- GLTFLightsExtension
- flatten
- FenetreResultats
- ThreeMFLoader
- AsyncDecompress
- Material
- decompress
- ZipPassThrough
- CatmullRom
- CubicPoly
- .lerp
- getKeyframeOrder
- WebGLShaderStage

## God Nodes (most connected - your core abstractions)
1. `Conception` - 126 edges
2. `GcsSystemMock` - 119 edges
3. `Vector3` - 113 edges
4. `Vector2` - 90 edges
5. `get()` - 87 edges
6. `pop()` - 85 edges
7. `Parser()` - 82 edges
8. `EditeurEsquisse` - 79 edges
9. `warn()` - 73 edges
10. `Object3D` - 72 edges

## Surprising Connections (you probably didn't know these)
- `nouv()` --calls--> `nouvelleEsquisse()`  [EXTRACTED]
  test/banc-conception.mjs → js/c2-esquisse.js
- `rectangle()` --calls--> `nouvelId()`  [EXTRACTED]
  test/banc-conception.mjs → js/c2-esquisse.js
- `yMorceaux` --calls--> `indexer()`  [EXTRACTED]
  test/banc-conception.mjs → js/c2-esquisse.js
- `noyau()` --indirect_call--> `oc()`  [INFERRED]
  js/c4-travailleur.js → vendor/replicad/replicad_single.js
- `traiter()` --indirect_call--> `oc()`  [INFERRED]
  js/c4-travailleur.js → vendor/replicad/replicad_single.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Chaîne de mesure** — js_06_topologie, js_07_mesure, readme_measure [INFERRED 0.85]
- **Chaîne de lecture STEP** — js_02_import, js_travailleur_occt, readme_opencascade [INFERRED 0.85]

## Communities (221 total, 77 thin omitted)

### Community 0 - "three.core.js"
Cohesion: 0.01
Nodes (229): RFC-3987, _addedEvent, _alignedPosition, _axis, _baseVector, _batchIntersects, _boneMatrix, _box (+221 more)

### Community 1 - "three.module.js"
Cohesion: 0.01
Nodes (37): arrayCacheF32, arrayCacheI32, _clearColor, _cubeDirections, _cubeUps, DATA, _direction, empty3dTexture (+29 more)

### Community 3 - ".push"
Cohesion: 0.04
Nodes (31): arrayNeedsUint32(), buildPlane(), BufferGeometry, addLine(), addPoint(), CapsuleGeometry, CircleGeometry, generateCap() (+23 more)

### Community 4 - "replicad.js"
Cohesion: 0.01
Nodes (97): deserializeTopoShape(), serializeShape(), triangulateFace(), atDistance(), atPoint(), binarySearch(), binarySearchIndex(), binarySearchInsert() (+89 more)

### Community 5 - "get"
Cohesion: 0.09
Nodes (49): createCanvasElement(), createElementNS(), setValueT1(), WebGLCapabilities(), getMaxAnisotropy(), textureFormatReadable(), textureTypeReadable(), WebGLGeometries() (+41 more)

### Community 6 - "BufferAttribute"
Cohesion: 0.03
Nodes (17): BufferAttribute, convertBufferAttribute(), createColorManagement(), DataUtils, denormalize(), Float16BufferAttribute, Int16BufferAttribute, Int32BufferAttribute (+9 more)

### Community 7 - "update"
Cohesion: 0.08
Nodes (33): WebGLAttributes(), createBuffer(), get(), remove(), update(), updateBuffer(), releaseStatesOfObject(), WebGLBufferRenderer() (+25 more)

### Community 8 - ".parse"
Cohesion: 0.11
Nodes (37): analyzeObject(), applyExtensions(), build(), buildBasematerial(), buildBasematerialsMeshes(), buildComposite(), buildDefaultMesh(), buildGroup() (+29 more)

### Community 9 - "WebGLRenderer"
Cohesion: 0.04
Nodes (16): CubeDepthTexture, DepthTexture, ExternalTexture, WebGLRenderTarget, _createRenderTarget(), WebGLRenderer, renderTransmissionPass(), VSMPass() (+8 more)

### Community 11 - "Sphere"
Cohesion: 0.06
Nodes (6): ascSort(), Box2, Raycaster, getInteriorPoint(), pointInPolygon(), Sphere

### Community 12 - "mm"
Cohesion: 0.16
Nodes (31): arcEntre(), constructionAngle(), constructionPlans(), coordonnees(), cote(), degres(), diam(), dimCercle() (+23 more)

### Community 13 - ".render"
Cohesion: 0.07
Nodes (35): shadowCastingAndTexturingLightsFirst(), ShadowUniformsCache(), UniformsCache(), WebGLClipping(), projectPlanes(), resetGlobalState(), WebGLLights(), setup() (+27 more)

### Community 15 - "08-interface.js"
Cohesion: 0.07
Nodes (43): abonnes, actionPourGeste(), ACTIONS, BOUTONS, chargerPrefs(), EMPLACEMENTS, gestesActifs(), nomBouton() (+35 more)

### Community 17 - ".equals"
Cohesion: 0.07
Nodes (34): addContour(), compareXYSlope(), createNode(), cureLocalIntersections(), earcut(), earcutLinked(), eliminateHole(), eliminateHoles() (+26 more)

### Community 18 - ".applyMatrix4"
Cohesion: 0.05
Nodes (9): checkIntersection(), checkIntersection$1(), Frustum, FrustumArray, InstancedMesh, Mesh, SkinnedMesh, SpotLightHelper (+1 more)

### Community 19 - "Interface"
Cohesion: 0.14
Nodes (4): prefsModifiees(), reinitialiserPrefs(), calculerAretes(), Interface

### Community 22 - ".setFromMatrixPosition"
Cohesion: 0.13
Nodes (3): DirectionalLightHelper, LOD, Matrix2

### Community 23 - ".dispose"
Cohesion: 0.11
Nodes (21): log(), dispose(), WebGLCubeRenderTarget, WebGLEnvironments(), dispose(), get(), getCube(), getPMREM() (+13 more)

### Community 24 - "Vector3"
Cohesion: 0.03
Nodes (13): applyRadius(), azimuth(), correctSeam(), correctUV(), correctUVs(), generateUVs(), getVertexByIndex(), inclination() (+5 more)

### Community 25 - "Loader"
Cohesion: 0.11
Nodes (11): AnimationLoader, AudioLoader, handleError(), BufferGeometryLoader, CompressedTextureLoader, loadTexture(), loadTexture(), DataTextureLoader (+3 more)

### Community 26 - ".setRenderTarget"
Cohesion: 0.15
Nodes (10): RawShaderMaterial, ShaderMaterial, _getBlurShader(), _getCommonVertexShader(), _getCubemapMaterial(), _getEquirectMaterial(), _getGGXShader(), PMREMGenerator (+2 more)

### Community 27 - "AnimationAction"
Cohesion: 0.08
Nodes (3): AnimationAction, handleVisibilityChange(), LinearInterpolant

### Community 29 - "Matrix4"
Cohesion: 0.04
Nodes (4): Bone, Camera, Matrix4, Skeleton

### Community 30 - "TextureSource"
Cohesion: 0.08
Nodes (8): AudioContext, AudioListener, ImageUtils, intersect(), deserializeImage(), serializeImage(), SRGBToLinear(), TextureSource

### Community 31 - "ObjectLoader"
Cohesion: 0.10
Nodes (8): CubeTextureLoader, DataTexture, ImageLoader, MaterialLoader, ObjectLoader, deserializeImage(), TextureLoader, getDFGLUT()

### Community 32 - "Vue3D"
Cohesion: 0.08
Nodes (5): Vue3D, demarrer(), InterfaceConception, traitEpais(), appliquerAnalyse()

### Community 33 - ".parseObject"
Cohesion: 0.04
Nodes (15): AmbientLight, DirectionalLight, Fog, FogExp2, HemisphereLight, Light, LightProbe, LineLoop (+7 more)

### Community 34 - "PropertyBinding"
Cohesion: 0.06
Nodes (3): AnimationObjectGroup, Composite, PropertyBinding

### Community 35 - "Color"
Cohesion: 0.08
Nodes (4): Color, handleAlpha(), hue2rgb(), LinearToSRGB()

### Community 36 - "14-pilote-3d.js"
Cohesion: 0.14
Nodes (36): liberer(), faceSous(), maillageCollisions(), apresDeplacement(), AXES, contraindre(), perimerCaches(), pivoter() (+28 more)

### Community 37 - "07-mesure.js"
Cohesion: 0.13
Nodes (18): areteSous(), centreDeFace(), contourFace(), echelleDe(), entiteArete(), geometrieArete(), geometrieFace(), milieuCurviligne() (+10 more)

### Community 38 - "06-topologie.js"
Cohesion: 0.08
Nodes (42): analyser(), aplatir(), AXES_MONDE, barycentre(), cerclePlan(), constructionAretePlan(), COS_ALIGNE_MONDE, COS_MEME_PLAN (+34 more)

### Community 40 - "casting-c4FpthHM.js"
Cohesion: 0.03
Nodes (107): asDir(), asPnt(), bounds(), _calcTransforms(), center(), chamferShape(), clone(), constructor() (+99 more)

### Community 41 - "05-arbre.js"
Cohesion: 0.14
Nodes (15): Arbre, couleurDe(), echapper(), encombrement(), estDansBranche(), fmt, formaterAire(), formaterNombre() (+7 more)

### Community 42 - ".processTextureAsync"
Cohesion: 0.09
Nodes (8): GLTFMaterialsAnisotropyExtension, GLTFMaterialsBumpExtension, GLTFMaterialsClearcoatExtension, GLTFMaterialsIridescenceExtension, GLTFMaterialsSheenExtension, GLTFMaterialsSpecularExtension, GLTFMaterialsTransmissionExtension, GLTFMaterialsVolumeExtension

### Community 45 - "c11-plus-ui.js"
Cohesion: 0.08
Nodes (56): enregistrerPrefs(), telechargerFichier(), nomProjet(), demander(), actionsEsquisse(), activerComposant(), APPARENCES, appliquerDisposition() (+48 more)

### Community 46 - "Matrix3"
Cohesion: 0.08
Nodes (5): Matrix3, Source, warnOnce(), WebGLExtensions(), getExtension()

### Community 47 - "WebGLProgram"
Cohesion: 0.08
Nodes (26): fetchAttributeLocations(), filterEmptyLine(), generateCubeUVSize(), generateDefines(), generateEnvMapBlendingDefine(), generateEnvMapModeDefine(), generateEnvMapTypeDefine(), generatePrecision() (+18 more)

### Community 48 - "LightShadow"
Cohesion: 0.09
Nodes (4): DirectionalLightShadow, LightShadow, OrthographicCamera, SpotLightShadow

### Community 49 - "travailleur-occt.js"
Cohesion: 0.06
Nodes (26): Workflow CI bancs d'essai, Dialogues : aide, préférences, projets, export de pièce, Import map (three), index.html structure de la page, Barre d'outils (ouvrir, mesure, coupe, collisions, déplacer, export), Banc des exemples (test/banc-exemples.mjs), Banc du serveur (test/banc-serveur.py), Fichiers d'exemples (as1, essai-mesure.obj...) (+18 more)

### Community 51 - ".dispatchEvent"
Cohesion: 0.11
Nodes (3): Group, Scene, WebXRController

### Community 52 - "addToRenderList"
Cohesion: 0.14
Nodes (9): BoxGeometry, getUnlitUniformColorSpace(), PlaneGeometry, WebGLBackground(), addToRenderList(), getBackground(), render(), setClear() (+1 more)

### Community 53 - "appairage.py"
Cohesion: 0.09
Nodes (19): _a_refaire(), appairer(), _ca_a_refaire(), _cnf(), contexte_tls(), dossier_tls(), empreinte_ca(), en_https() (+11 more)

### Community 54 - "RenderTarget"
Cohesion: 0.12
Nodes (6): Data3DTexture, DataArrayTexture, RenderTarget, RenderTarget3D, WebGL3DRenderTarget, WebGLArrayRenderTarget

### Community 55 - "KeyframeTrack"
Cohesion: 0.10
Nodes (8): BooleanKeyframeTrack, ColorKeyframeTrack, KeyframeTrack, QuaternionKeyframeTrack, scaleTangentTimes(), StringKeyframeTrack, subclip(), VectorKeyframeTrack

### Community 56 - "BatchedMesh"
Cohesion: 0.05
Nodes (10): ascIdSort(), BatchedMesh, CatmullRomCurve3, copyArrayContents(), copyAttributeData(), EdgesGeometry, flattenJSON(), HemisphereLightHelper (+2 more)

### Community 58 - "Euler"
Cohesion: 0.13
Nodes (3): Euler, onQuaternionChange(), onRotationChange()

### Community 59 - "WebGLBindingStates"
Cohesion: 0.15
Nodes (21): WebGLBindingStates(), bindVertexArrayObject(), createBindingState(), createVertexArrayObject(), deleteVertexArrayObject(), disableUnusedAttributes(), dispose(), enableAttribute() (+13 more)

### Community 60 - "GLTFWriter"
Cohesion: 0.23
Nodes (4): equalArray(), getMinMax(), GLTFWriter, isIdentityMatrix()

### Community 61 - ".push"
Cohesion: 0.03
Nodes (113): ABS(), addSegment(), addStringToPool(), addTerminatorSegment(), ALIGNRP(), allPairs(), and(), blobSTL() (+105 more)

### Community 62 - "warn"
Cohesion: 0.08
Nodes (6): Audio, Controls, enhanceLogMessage(), parseConstant(), setQuaternionFromProperEuler(), warn()

### Community 63 - "Texture"
Cohesion: 0.08
Nodes (5): CanvasTexture, CubeTexture, FramebufferTexture, HTMLTexture, Texture

### Community 64 - "MaterialCreator"
Cohesion: 0.16
Nodes (4): MaterialCreator, resolveURL(), setMapForType(), MTLLoader

### Community 65 - "InterleavedBuffer"
Cohesion: 0.09
Nodes (7): getArrayBuffer(), getInterleavedBuffer(), generateUUID(), getTypedArray(), InstancedBufferGeometry, InstancedInterleavedBuffer, InterleavedBuffer

### Community 66 - "brancherDeplacement"
Cohesion: 0.49
Nodes (11): brancherDeplacement(), annulerContrainte(), apres(), basculer(), choisirFace(), construire(), demarrerContrainte(), lire() (+3 more)

### Community 67 - "web_3D.py"
Cohesion: 0.06
Nodes (14): adresses_poste(), hote_permis(), ip_tailscale(), adresse_locale(), attendre(), ipv4_libre(), lance_par_double_clic(), main() (+6 more)

### Community 68 - "Pass"
Cohesion: 0.15
Nodes (5): _camera, FullscreenTriangleGeometry, _geometry, Pass, RenderPass

### Community 69 - "fflate.module.js"
Cohesion: 0.09
Nodes (18): RFC-1951, AsyncGunzip(), AsyncInflate(), AsyncUnzipInflate(), AsyncUnzlib(), DecodeUTF8(), decompressSync(), EncodeUTF8() (+10 more)

### Community 71 - "arraysEqual"
Cohesion: 0.21
Nodes (19): allocTexUnits(), arraysEqual(), copyArray(), setValueM2(), setValueM3(), setValueM4(), setValueT1Array(), setValueT2DArrayArray() (+11 more)

### Community 72 - "banc-exemples.mjs"
Cohesion: 0.13
Nodes (3): occtimportjs, RACINE, STEP

### Community 74 - "Parser"
Cohesion: 0.06
Nodes (53): argument(), ELSE(), fail(), getEncoding(), getFixed(), getLanguageCode(), getLong(), getNameByID() (+45 more)

### Community 75 - ".constructor"
Cohesion: 0.09
Nodes (33): object(), WebGLAnimation(), onAnimationFrame(), WebGLIndexedBufferRenderer(), render(), renderInstances(), renderMultiDraw(), setIndex() (+25 more)

### Community 76 - "getMaterialExtension"
Cohesion: 0.05
Nodes (14): getMaterialExtension(), GLTFLoader, GLTFMaterialsAnisotropyExtension, GLTFMaterialsBumpExtension, GLTFMaterialsClearcoatExtension, GLTFMaterialsDispersionExtension, GLTFMaterialsEmissiveStrengthExtension, GLTFMaterialsIorExtension (+6 more)

### Community 77 - "AnimationClip"
Cohesion: 0.11
Nodes (5): AnimationClip, AnimationUtils, getTrackTypeForValueTypeName(), NumberKeyframeTrack, parseKeyframeTrack()

### Community 78 - "Interpolant"
Cohesion: 0.17
Nodes (4): CubicInterpolant, DiscreteInterpolant, Interpolant, QuaternionLinearInterpolant

### Community 79 - "creer"
Cohesion: 0.08
Nodes (58): creer(), afficher(), ajouter(), annoncer(), annuler(), appliquer(), base64(), battre() (+50 more)

### Community 80 - "Conception"
Cohesion: 0.07
Nodes (5): lireParametresCsv(), axesConstruits(), Conception, estNombre(), verifierPiece()

### Community 81 - ".clone"
Cohesion: 0.06
Nodes (15): CurvePath, addShape(), addUV(), addVertex(), buildLidFaces(), buildSideFaces(), f3(), f4() (+7 more)

### Community 82 - "PolyhedronGeometry"
Cohesion: 0.13
Nodes (5): DodecahedronGeometry, IcosahedronGeometry, OctahedronGeometry, PolyhedronGeometry, TetrahedronGeometry

### Community 84 - "getParameters"
Cohesion: 0.21
Nodes (5): isPackedRGFormat(), getMaxPrecision(), getChannel(), getParameters(), WebGLShaderCache

### Community 85 - "Gestionnaire"
Cohesion: 0.20
Nodes (3): chemin_projet(), Gestionnaire, lister_projets()

### Community 86 - "Garde"
Cohesion: 0.11
Nodes (4): brancher_tls(), Garde, _html(), Visites

### Community 88 - "OBJLoader.js"
Cohesion: 0.18
Nodes (8): _ab, _cb, _color, OBJLoader, ParserState(), _vA, _vB, _vC

### Community 89 - "LoadingManager"
Cohesion: 0.13
Nodes (7): readData(), HttpError, ImageBitmapLoader, onImageError(), onImageLoad(), removeEventListeners(), LoadingManager

### Community 90 - "GLTFLoader.js"
Cohesion: 0.07
Nodes (25): addMorphTargets(), addPrimitiveAttributes(), assignAttributeAccessor(), ALPHA_MODES, ATTRIBUTES, BINARY_EXTENSION_CHUNK_TYPES, createAttributesKey(), createPrimitiveKey() (+17 more)

### Community 92 - "createWasm"
Cohesion: 0.20
Nodes (12): addOnInit(), addRunDependency(), createWasm(), receiveInstance(), receiveInstantiationResult(), findWasmBinary(), getWasmImports(), locateFile() (+4 more)

### Community 93 - "CubicBezierCurve"
Cohesion: 0.11
Nodes (7): CubicBezier(), CubicBezierCurve, CubicBezierCurve3, CubicBezierP0(), CubicBezierP1(), CubicBezierP2(), CubicBezierP3()

### Community 94 - "banc-pilote-3d.mjs"
Cohesion: 0.04
Nodes (24): addEventListener(), arbre, compacter(), compte, coupe, declare, desc3, deux (+16 more)

### Community 95 - ".constructor"
Cohesion: 0.13
Nodes (4): GLTFExporter, GLTFLightExtension, GLTFMaterialsIorExtension, GLTFMeshGpuInstancing

### Community 96 - "GLTFParser"
Cohesion: 0.17
Nodes (5): addUnknownExtensionsToUserData(), assignExtrasToUserData(), createDefaultMaterial(), GLTFParser, updateMorphTargets()

### Community 97 - "banc-conception.mjs"
Cohesion: 0.03
Nodes (73): appliquerConfiguration(), CONSTANTES, evaluer(), atome(), produit(), puissance(), somme(), unaire() (+65 more)

### Community 98 - ".get"
Cohesion: 0.05
Nodes (49): activateDefaultVariation(), applyPaintType(), applyTupleVariationStore(), arabicSentenceEndCheck(), arabicSentenceStartCheck(), arabicWordEndCheck(), arabicWordStartCheck(), avar() (+41 more)

### Community 99 - "Path"
Cohesion: 0.09
Nodes (4): ArcCurve, EllipseCurve, Path, ShapePath

### Community 100 - ".lineTo"
Cohesion: 0.05
Nodes (53): x(), y(), bezierCurveTo(), bulgeArcTo(), close(), closeWithMirror(), _convertFromUV(), convertSvgEllipseParams() (+45 more)

### Community 101 - "parseUniform"
Cohesion: 0.17
Nodes (7): addUniform(), getPureArraySetter(), getSingularSetter(), parseUniform(), PureArrayUniform, SingleUniform, StructuredUniform

### Community 103 - ".parse"
Cohesion: 0.22
Nodes (3): STLLoader, isBinary(), matchDataViewAt()

### Community 105 - "BufferGeometryUtils.js"
Cohesion: 0.15
Nodes (8): computeMikkTSpaceTangents(), computeMorphedAttributes(), deepCloneAttribute(), deinterleaveAttribute(), deinterleaveGeometry(), mergeAttributes(), mergeGeometries(), toTrianglesDrawMode()

### Community 106 - "delete"
Cohesion: 0.05
Nodes (55): _adaptSurface(), asShape3D(), asTuple(), baseFace(), buildWire(), clone(), complexExtrude(), curvesAsEdgesOnFace() (+47 more)

### Community 107 - ".copy"
Cohesion: 0.04
Nodes (9): a(), handleTriangle(), handleVertex(), checkGeometryIntersection(), Plane, Ray, SphericalHarmonics3, transformVertex() (+1 more)

### Community 110 - "EditeurEsquisse"
Cohesion: 0.05
Nodes (57): COTES, indexer(), nouvelId(), rayonDe(), ajuster(), angleDe(), casserCoin(), copier() (+49 more)

### Community 111 - "c4-travailleur.js"
Cohesion: 0.13
Nodes (33): archive(), contoursImage(), dxfCalques(), echapperXml(), ecrire3mf(), ecrireObj(), ecrireUrdf(), nombre() (+25 more)

### Community 113 - "02-import.js"
Cohesion: 0.09
Nodes (31): ANNEXES, appliquerCouleursFaces(), construireNoeud(), creerGeometrie(), creerMaillage(), extension(), fabriqueMateriaux(), fileAttente (+23 more)

### Community 114 - ".read"
Cohesion: 0.27
Nodes (8): createLazyFile(), stream_ops, writeChunks(), get_char(), mmap(), position(), read(), offset()

### Community 115 - ".loadTextureImage"
Cohesion: 0.18
Nodes (3): GLTFTextureAVIFExtension, GLTFTextureBasisUExtension, GLTFTextureWebPExtension

### Community 116 - "GLTFExporter.js"
Cohesion: 0.13
Nodes (8): DEFAULT_SPECULAR_COLOR, GLTFMaterialsDispersionExtension, GLTFMaterialsEmissiveStrengthExtension, GLTFMaterialsUnlitExtension, KHR_mesh_quantization_ExtraAttrTypes, PATH_PROPERTIES, THREE_TO_WEBGL, WEBGL_CONSTANTS

### Community 117 - "c6-conception.js"
Cohesion: 0.05
Nodes (58): avertir(), boite(), confirmer(), demanderTexte(), defautsPlus(), lireNuage(), nomHistorique(), sansAccent() (+50 more)

### Community 118 - "Pilote"
Cohesion: 0.14
Nodes (4): _pieces(), Pilote, Refus, _texte()

### Community 119 - "CompressedArrayTexture"
Cohesion: 0.22
Nodes (3): CompressedArrayTexture, CompressedCubeTexture, CompressedTexture

### Community 120 - "find"
Cohesion: 0.05
Nodes (54): adaptor(), applyFilter(), approximate(), approximateAsSvgCompatibleCurve(), approximateForSVG(), blueprintsIntersectionSegments(), booleanOperation(), chamfer2D() (+46 more)

### Community 121 - "banc-conception-plus.mjs"
Cohesion: 0.15
Nodes (14): controlerRegles(), esquisses(), grille(), mm(), multiple(), parametres(), plastique(), prefixePiece() (+6 more)

### Community 122 - "abort"
Cohesion: 0.25
Nodes (8): abort(), assert(), getBinaryPromise(), getBinarySync(), instantiateArrayBuffer(), instantiateAsync(), lookup_name(), ___syscall_unlinkat()

### Community 123 - "GTAOPass.js"
Cohesion: 0.33
Nodes (8): generateMagicSquare(), generateMagicSquareNoise(), GTAOBlendShader, GTAODepthShader, GTAOShader, generateDenoiseSamples(), generatePdSamplePointInitializer(), PoissonDenoiseShader

### Community 124 - "FullScreenQuad"
Cohesion: 0.22
Nodes (3): OutputPass, FullScreenQuad, OutputShader

### Community 125 - "Table"
Cohesion: 0.07
Nodes (39): ClassDef(), Coverage(), encodeString(), FeatureList(), LookupList(), makeCFFTable(), makeCharsets(), makeColrTable() (+31 more)

### Community 126 - "À faire — fonctionnalités et bugs"
Cohesion: 0.40
Nodes (4): Bugs, Fonctionnalités, À faire — fonctionnalités et bugs, Écart restant avec solidcraft (relevé du 05/11/2026)

### Community 127 - "QuadraticBezierCurve"
Cohesion: 0.12
Nodes (6): QuadraticBezier(), QuadraticBezierCurve, QuadraticBezierCurve3, QuadraticBezierP0(), QuadraticBezierP1(), QuadraticBezierP2()

### Community 128 - "c3-operations.js"
Cohesion: 0.05
Nodes (79): ajusterBoucle(), reconnaitrePrisme(), aire(), angle(), axeConstruction(), axePerpendiculaire(), balayage(), cercle3Points() (+71 more)

### Community 129 - "ContextParams"
Cohesion: 0.08
Nodes (30): arabicPresentationForms(), arabicRequiredLigatures(), ccmpReplacementLigatures(), chainingSubstitutionFormat3(), ContextParams(), contextSubstitutionFormat1(), contextSubstitutionFormat3(), decompositionSubstitutionFormat1() (+22 more)

### Community 130 - "error"
Cohesion: 0.10
Nodes (49): error(), setValueT2DArray1(), setValueT3D1(), setValueT6(), WebGLState(), activeTexture(), bindTexture(), ColorBuffer() (+41 more)

### Community 131 - "postRun"
Cohesion: 0.29
Nodes (7): addOnPostRun(), addOnPreRun(), initRuntime(), postRun(), preRun(), run(), doRun()

### Community 133 - ".writeAsync"
Cohesion: 0.33
Nodes (3): getPaddedArrayBuffer(), getPaddedBufferSize(), stringToArrayBuffer()

### Community 136 - "cloneUniforms"
Cohesion: 0.40
Nodes (4): cloneUniforms(), cloneUniformsGroups(), isThreeObject(), mergeUniforms()

### Community 138 - "parseCFFTable"
Cohesion: 0.07
Nodes (34): addGlyphNames(), addGlyphNamesToUnicodeMap(), calcCFFSubroutineBias(), CffEncoding(), cffGlyphLoader(), CmapEncoding(), edgeToCurveOnPlane(), entriesToObject() (+26 more)

### Community 141 - "b"
Cohesion: 0.20
Nodes (14): x(), $a(), ab(), b(), c(), d(), I, ic() (+6 more)

### Community 142 - "12-collisions.js"
Cohesion: 0.26
Nodes (14): boiteMonde(), chercherCollisions(), contenue(), croiser(), dansZone(), distances(), longueur(), scal() (+6 more)

### Community 144 - "Font"
Cohesion: 0.05
Nodes (24): addGlyphNamesAll(), applyArabicRequireLigatures(), applyLatinLigatures(), applyThaiFeatures(), average(), Bidi(), buildPath(), computeCheckSum() (+16 more)

### Community 145 - "EffectComposer.js"
Cohesion: 0.29
Nodes (3): ClearMaskPass, MaskPass, CopyShader

### Community 147 - "Module"
Cohesion: 0.10
Nodes (27): qb(), Module(), Ac(), Ba(), Ca(), Cb(), Db(), eb() (+19 more)

### Community 148 - "WebGLMaterials"
Cohesion: 0.33
Nodes (14): WebGLMaterials(), refreshMaterialUniforms(), refreshTransformUniform(), refreshUniformsCommon(), refreshUniformsDash(), refreshUniformsDistance(), refreshUniformsLine(), refreshUniformsMatcap() (+6 more)

### Community 149 - "Tokenizer"
Cohesion: 0.14
Nodes (5): ContextChecker(), ContextRange(), Event(), initializeCoreEvents(), Tokenizer()

### Community 152 - "ouvrir.py"
Cohesion: 0.14
Nodes (12): masquer(), associer(), attendre(), copier(), demarrer(), dire(), lire(), main() (+4 more)

### Community 153 - "pilote.py"
Cohesion: 0.15
Nodes (4): battement(), commander(), H, req()

### Community 154 - "craftInvokerFunction"
Cohesion: 0.67
Nodes (4): craftInvokerFunction(), createJsInvoker(), newFunc(), usesDestructorStack()

### Community 155 - "getCallstack"
Cohesion: 0.50
Nodes (3): _emscripten_get_callstack(), getCallstack(), jsStackTrace()

### Community 156 - "___syscall_ioctl"
Cohesion: 0.50
Nodes (4): ioctl_tcgets(), ioctl_tcsets(), ioctl_tiocgwinsz(), ___syscall_ioctl()

### Community 157 - "telephone.js"
Cohesion: 0.38
Nodes (9): appliquer(), construire(), mesurer(), ouvrir(), panneaux(), redimensionner(), remplir(), rendre() (+1 more)

### Community 159 - "index.js"
Cohesion: 0.16
Nodes (18): adopt(), fulfilled(), rejected(), step(), constraint_param_index, Algorithm, Constraint_Alignment, DebugMode (+10 more)

### Community 161 - "deflate"
Cohesion: 0.20
Nodes (5): AsyncDeflate(), AsyncZipDeflate(), deflate, deflateSync(), ZipDeflate()

### Community 163 - "Module"
Cohesion: 0.15
Nodes (16): make_gcs_wrapper(), Module(), $a(), b(), c(), d(), Fa(), g() (+8 more)

### Community 165 - "write"
Cohesion: 0.67
Nodes (3): msync(), put_char(), write()

### Community 166 - "registerType"
Cohesion: 0.67
Nodes (3): onComplete(), registerType(), sharedRegisterType()

### Community 167 - "syncfs"
Cohesion: 1.00
Nodes (3): syncfs(), doCallback(), done()

### Community 168 - "syscallGetVarargI"
Cohesion: 0.67
Nodes (3): ___syscall_fcntl64(), ___syscall_openat(), syscallGetVarargI()

### Community 172 - "C"
Cohesion: 0.40
Nodes (3): C, CS, S

### Community 173 - "extend"
Cohesion: 0.22
Nodes (19): add(), bgraToRaw(), cpal(), deleteColor(), ensureCPAL(), extend(), fillPalette(), formatColor() (+11 more)

### Community 177 - "Line"
Cohesion: 0.06
Nodes (13): ArrowHelper, AxesHelper, Box3Helper, BoxHelper, CameraHelper, GridHelper, Line, LineSegments (+5 more)

### Community 178 - "harnais-page.mjs"
Cohesion: 0.18
Nodes (5): attendreHttp(), ouvrirConception(), pause(), portLibre(), RACINE

### Community 180 - "gzip"
Cohesion: 0.18
Nodes (6): AsyncGzip(), AsyncZlib(), gzip, gzipSync(), zlib, zlibSync()

### Community 181 - "BezierInterpolant"
Cohesion: 0.50
Nodes (3): BezierInterpolant, cubicBezierSlope(), solveBezierParameter()

### Community 183 - "banc-conception-perf.mjs"
Cohesion: 0.12
Nodes (12): cache, d, d2, debut, doc(), erreurs, finMo, lignes (+4 more)

### Community 184 - "SkeletonUtils.js"
Cohesion: 0.56
Nodes (8): clone(), getBoneByName(), getBoneName(), getBones(), getHelperFromSkeleton(), parallelTraverse(), retarget(), retargetClip()

### Community 188 - "Substitution"
Cohesion: 0.26
Nodes (4): arraysEqual(), binSearch(), getSubstFormat(), Substitution()

### Community 206 - "flatten"
Cohesion: 0.29
Nodes (7): flatten(), setValueM2Array(), setValueM3Array(), setValueM4Array(), setValueV2fArray(), setValueV3fArray(), setValueV4fArray()

### Community 215 - "Material"
Cohesion: 0.04
Nodes (14): LineDashedMaterial, Material, MeshDepthMaterial, MeshDistanceMaterial, MeshLambertMaterial, MeshMatcapMaterial, MeshNormalMaterial, MeshPhongMaterial (+6 more)

## Knowledge Gaps
- **20 isolated node(s):** `RFC-1951`, `RFC-3987`, `FlateErrorCode`, `OBJ + MTL : réécriture des chemins de matériaux`, `Unités ramenées au millimètre` (+15 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 2078 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **77 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `a()` connect `.copy` to `banc-conception.mjs`, `Module`, `Module`, `b`?**
  _High betweenness centrality (0.184) - this node is a cross-community bridge._
- **Are the 6 inferred relationships involving `get()` (e.g. with `WebGLAttributes()` and `WebGLEnvironments()`) actually correct?**
  _`get()` has 6 INFERRED edges - model-reasoned connections that need verification._
- **What connects `RFC-1951`, `RFC-3987`, `FlateErrorCode` to the rest of the system?**
  _20 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `three.core.js` be split into smaller, more focused modules?**
  _Cohesion score 0.007633367899527595 - nodes in this community are weakly interconnected._
- **Why does `Triangle` connect `.copy` to `three.core.js`, `.equals`, `Box3`, `three.module.js`?**
  _High betweenness centrality (0.156) - this node is a cross-community bridge._
- **Should `three.module.js` be split into smaller, more focused modules?**
  _Cohesion score 0.0078125 - nodes in this community are weakly interconnected._
- **Why does `Vector2` connect `Vector2` to `three.core.js`, `three.module.js`, `.push`, `get`, `BufferAttribute`, `WebGLRenderer`, `Sphere`, `.render`, `.dispose`, `Vector3`, `ObjectLoader`, `Color`, `LightShadow`, `BatchedMesh`, `Texture`, `Curve`, `.constructor`, `.clone`, `Material`, `CubicBezierCurve`, `Path`, `delete`, `.copy`, `QuadraticBezierCurve`?**
  _High betweenness centrality (0.139) - this node is a cross-community bridge._