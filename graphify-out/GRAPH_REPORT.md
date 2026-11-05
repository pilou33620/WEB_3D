# Graph Report - WEB_3D  (2026-11-05)

## Corpus Check
- 84 files · ~657,273 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 18 file(s) not represented in the graph (top: .css 4, .wasm 3, .step 2)

## Summary
- 6551 nodes · 15260 edges · 221 communities (139 shown, 82 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 409 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1597242c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- three.core.js
- three.module.js
- .push
- replicad.js
- WebGLTextures
- BufferAttribute
- update
- .parse
- WebGLRenderer
- Object3D
- Sphere
- 06-topologie.js
- .render
- Vector2
- 08-interface.js
- Mesure
- .equals
- c5-esquisse-ui.js
- Interface
- Quaternion
- Vector4
- .parseObject
- .constructor
- Vector3
- .load
- PMREMGenerator
- AnimationAction
- Box3
- Matrix4
- LoadingManager
- ObjectLoader
- Vue3D
- Light
- PropertyBinding
- Color
- 14-pilote-3d.js
- FenetreResultats
- .applyMatrix4
- CoupeManager
- casting-c4FpthHM.js
- 05-arbre.js
- .processTextureAsync
- AnimationMixer
- .clone
- c11-plus-ui.js
- Matrix3
- Conception
- OrthographicCamera
- travailleur-occt.js
- Navigation
- .dispatchEvent
- setProgram
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
- 13-deplacement.js
- web_3D.py
- BufferGeometryUtils.js
- fflate.module.js
- ShaderMaterial
- arraysEqual
- banc-exemples.mjs
- Curve
- Parser
- .constructor
- getMaterialExtension
- DataTextureLoader
- Interpolant
- creer
- .brancher
- addShape
- PolyhedronGeometry
- Spherical
- getParameters
- Gestionnaire
- Garde
- CubeVue
- OBJLoader.js
- Loader
- GLTFLoader.js
- PositionalAudio
- createWasm
- zip
- banc-pilote-3d.mjs
- InstancedBufferGeometry
- GLTFParser
- banc-conception.mjs
- .get
- Path
- .lineTo
- parseUniform
- deflate
- .parse
- PropertyMixer
- c1-expressions.js
- delete
- .copy
- VideoTexture
- Appairage
- EditeurEsquisse
- c4-travailleur.js
- Timer
- 02-import.js
- .read
- .constructor
- GLTFExporter.js
- c6-conception.js
- Pilote
- CompressedArrayTexture
- find
- banc-conception-plus.mjs
- abort
- Camera
- get
- Table
- À faire — fonctionnalités et bugs
- c7-frise.js
- c3-operations.js
- ContextParams
- WebGLState
- postRun
- .processImage
- .writeAsync
- gzip
- Clock
- WebXRManager
- Cylindrical
- parseCFFTable
- GLBufferAttribute
- GcsWrapper
- .setStyle
- 12-collisions.js
- .brancherDisposition
- Font
- AnimationClip
- PerspectiveCamera
- Module
- ThreeMFLoader
- Tokenizer
- .load
- H
- ouvrir.py
- pilote.py
- craftInvokerFunction
- getCallstack
- ___syscall_ioctl
- telephone.js
- StepExtractor
- index.js
- EventDispatcher
- c3c-references.js
- Module
- .parse
- write
- registerType
- syncfs
- syscallGetVarargI
- SketchIndex
- decompress
- ZipPassThrough
- C
- extend
- Uniform
- _points
- AnimationUtils
- harnais-page.mjs
- close
- c10-regles.js
- .ouvrirDocument
- boundingBox
- banc-conception-perf.mjs
- SkeletonUtils.js
- probeAsync
- MultiDrawRenderList
- LineCurve
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
- InterfaceConception
- GLTFCubicSplineInterpolant
- GLTFLightsExtension
- TextureUtils
- AsyncDecompress
- .copyLinearToSRGB
- Fog
- FogExp2
- Material
- Int32BufferAttribute
- Int8BufferAttribute
- Uint16BufferAttribute
- Uint8BufferAttribute
- Uint8ClampedBufferAttribute

## God Nodes (most connected - your core abstractions)
1. `Conception` - 125 edges
2. `GcsSystemMock` - 119 edges
3. `Vector3` - 113 edges
4. `Vector2` - 90 edges
5. `get()` - 87 edges
6. `pop()` - 85 edges
7. `Parser()` - 82 edges
8. `EditeurEsquisse` - 75 edges
9. `warn()` - 73 edges
10. `Object3D` - 72 edges

## Surprising Connections (you probably didn't know these)
- `rectangle()` --calls--> `nouvelId()`  [EXTRACTED]
  test/banc-conception.mjs → js/c2-esquisse.js
- `yMorceaux` --calls--> `indexer()`  [EXTRACTED]
  test/banc-conception.mjs → js/c2-esquisse.js
- `noyau()` --indirect_call--> `oc()`  [INFERRED]
  js/c4-travailleur.js → vendor/replicad/replicad_single.js
- `traiter()` --indirect_call--> `oc()`  [INFERRED]
  js/c4-travailleur.js → vendor/replicad/replicad_single.js
- `bati()` --indirect_call--> `oc()`  [INFERRED]
  test/banc-conception-plus.mjs → vendor/replicad/replicad_single.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Chaîne de mesure** — js_06_topologie, js_07_mesure, readme_measure [INFERRED 0.85]
- **Chaîne de lecture STEP** — js_02_import, js_travailleur_occt, readme_opencascade [INFERRED 0.85]

## Communities (221 total, 82 thin omitted)

### Community 0 - "three.core.js"
Cohesion: 0.01
Nodes (237): RFC-3987, _addedEvent, _alignedPosition, arrayNeedsUint32(), _axis, _baseVector, _batchIntersects, BezierInterpolant (+229 more)

### Community 1 - "three.module.js"
Cohesion: 0.01
Nodes (69): arrayCacheF32, arrayCacheI32, _clearColor, _cubeDirections, _cubeUps, DATA, _direction, empty3dTexture (+61 more)

### Community 3 - ".push"
Cohesion: 0.04
Nodes (30): BoxGeometry, buildPlane(), BufferGeometry, addLine(), addPoint(), CapsuleGeometry, CircleGeometry, generateCap() (+22 more)

### Community 4 - "replicad.js"
Cohesion: 0.01
Nodes (97): deserializeTopoShape(), serializeShape(), triangulateFace(), atDistance(), atPoint(), binarySearch(), binarySearchIndex(), binarySearchInsert() (+89 more)

### Community 5 - "WebGLTextures"
Cohesion: 0.14
Nodes (37): createElementNS(), error(), getByteLength(), getTextureTypeByteLength(), getContext(), activeTexture(), bindTexture(), compressedTexImage2D() (+29 more)

### Community 6 - "BufferAttribute"
Cohesion: 0.04
Nodes (10): BufferAttribute, convertBufferAttribute(), createColorManagement(), DataUtils, denormalize(), Float16BufferAttribute, InterleavedBufferAttribute, isUniqueEdge() (+2 more)

### Community 7 - "update"
Cohesion: 0.06
Nodes (51): object(), WebGLAttributes(), createBuffer(), get(), remove(), update(), updateBuffer(), WebGLBufferRenderer() (+43 more)

### Community 8 - ".parse"
Cohesion: 0.11
Nodes (37): analyzeObject(), applyExtensions(), build(), buildBasematerial(), buildBasematerialsMeshes(), buildComposite(), buildDefaultMesh(), buildGroup() (+29 more)

### Community 9 - "WebGLRenderer"
Cohesion: 0.07
Nodes (15): WebGLRenderTarget, WebGLCubeRenderTarget, WebGLRenderer, renderObject(), renderObjects(), renderScene(), renderTransmissionPass(), setupLightsView() (+7 more)

### Community 11 - "Sphere"
Cohesion: 0.06
Nodes (7): ascSort(), Box2, BoxHelper, Raycaster, getInteriorPoint(), pointInPolygon(), Sphere

### Community 12 - "06-topologie.js"
Cohesion: 0.06
Nodes (86): analyser(), aplatir(), arcEntre(), areteSous(), AXES_MONDE, barycentre(), centreDeFace(), cerclePlan() (+78 more)

### Community 13 - ".render"
Cohesion: 0.07
Nodes (33): ExternalTexture, shadowCastingAndTexturingLightsFirst(), ShadowUniformsCache(), UniformsCache(), WebGLClipping(), projectPlanes(), resetGlobalState(), WebGLLights() (+25 more)

### Community 15 - "08-interface.js"
Cohesion: 0.06
Nodes (53): Dialogues : aide, préférences, projets, export de pièce, Import map (three), index.html structure de la page, Barre d'outils (ouvrir, mesure, coupe, collisions, déplacer, export), abonnes, actionPourGeste(), ACTIONS, BOUTONS (+45 more)

### Community 17 - ".equals"
Cohesion: 0.07
Nodes (34): addContour(), compareXYSlope(), createNode(), cureLocalIntersections(), earcut(), earcutLinked(), eliminateHole(), eliminateHoles() (+26 more)

### Community 18 - "c5-esquisse-ui.js"
Cohesion: 0.12
Nodes (47): ajouterPrimitives(), indexer(), nouvelId(), ajuster(), angleDe(), casserCoin(), copier(), decaler() (+39 more)

### Community 19 - "Interface"
Cohesion: 0.14
Nodes (5): prefsModifiees(), reinitialiserPrefs(), visibleEnLignee(), calculerAretes(), Interface

### Community 22 - ".parseObject"
Cohesion: 0.04
Nodes (15): ArrowHelper, ConeGeometry, CubeCamera, CylinderGeometry, DirectionalLightHelper, HemisphereLightHelper, Line, LineLoop (+7 more)

### Community 23 - ".constructor"
Cohesion: 0.11
Nodes (22): createCanvasElement(), log(), WebGLAnimation(), onAnimationFrame(), dispose(), dispose(), deallocateMaterial(), getProgram() (+14 more)

### Community 24 - "Vector3"
Cohesion: 0.03
Nodes (13): applyRadius(), azimuth(), correctSeam(), correctUV(), correctUVs(), generateUVs(), getVertexByIndex(), inclination() (+5 more)

### Community 25 - ".load"
Cohesion: 0.15
Nodes (10): handleError(), loadTexture(), loadTexture(), FileLoader, readData(), HttpError, onImageError(), onImageLoad() (+2 more)

### Community 26 - "PMREMGenerator"
Cohesion: 0.14
Nodes (12): _createRenderTarget(), PMREMGenerator, _setViewport(), WebGLEnvironments(), dispose(), get(), getCube(), getPMREM() (+4 more)

### Community 29 - "Matrix4"
Cohesion: 0.04
Nodes (5): Bone, flattenJSON(), Matrix2, Matrix4, Skeleton

### Community 30 - "LoadingManager"
Cohesion: 0.09
Nodes (5): AudioContext, AudioListener, ImageUtils, intersect(), LoadingManager

### Community 31 - "ObjectLoader"
Cohesion: 0.12
Nodes (8): CubeTexture, DataTexture, getTypedArray(), ImageLoader, ObjectLoader, deserializeImage(), deserializeImage(), getDFGLUT()

### Community 32 - "Vue3D"
Cohesion: 0.14
Nodes (3): Vue3D, demarrer(), appliquerAnalyse()

### Community 33 - "Light"
Cohesion: 0.06
Nodes (8): AmbientLight, HemisphereLight, Light, LightProbe, PointLight, PointLightShadow, RectAreaLight, SpotLight

### Community 34 - "PropertyBinding"
Cohesion: 0.07
Nodes (3): AnimationObjectGroup, Composite, PropertyBinding

### Community 35 - "Color"
Cohesion: 0.09
Nodes (3): Color, hue2rgb(), SRGBToLinear()

### Community 36 - "14-pilote-3d.js"
Cohesion: 0.15
Nodes (36): formatDe(), liberer(), encombrement(), mesurerSolide(), faceSous(), maillageCollisions(), apresDeplacement(), perimerCaches() (+28 more)

### Community 38 - ".applyMatrix4"
Cohesion: 0.05
Nodes (8): checkIntersection(), Frustum, FrustumArray, InstancedBufferAttribute, InstancedMesh, SkinnedMesh, SpotLightHelper, testPoint()

### Community 40 - "casting-c4FpthHM.js"
Cohesion: 0.03
Nodes (107): asDir(), asPnt(), bounds(), _calcTransforms(), center(), chamferShape(), clone(), constructor() (+99 more)

### Community 41 - "05-arbre.js"
Cohesion: 0.12
Nodes (17): Arbre, couleurDe(), echapper(), estDansBranche(), fmt, formaterAire(), formaterNombre(), formaterVolume() (+9 more)

### Community 42 - ".processTextureAsync"
Cohesion: 0.09
Nodes (8): GLTFMaterialsAnisotropyExtension, GLTFMaterialsBumpExtension, GLTFMaterialsClearcoatExtension, GLTFMaterialsIridescenceExtension, GLTFMaterialsSheenExtension, GLTFMaterialsSpecularExtension, GLTFMaterialsTransmissionExtension, GLTFMaterialsVolumeExtension

### Community 44 - ".clone"
Cohesion: 0.07
Nodes (5): CatmullRomCurve3, cloneUniformsGroups(), LightShadow, LOD, subclip()

### Community 45 - "c11-plus-ui.js"
Cohesion: 0.10
Nodes (41): enregistrerPrefs(), telechargerFichier(), nomProjet(), boite(), confirmer(), demander(), actionsEsquisse(), APPARENCES (+33 more)

### Community 46 - "Matrix3"
Cohesion: 0.08
Nodes (5): Matrix3, Source, warnOnce(), WebGLExtensions(), getExtension()

### Community 48 - "OrthographicCamera"
Cohesion: 0.12
Nodes (4): DirectionalLight, DirectionalLightShadow, OrthographicCamera, SpotLightShadow

### Community 49 - "travailleur-occt.js"
Cohesion: 0.11
Nodes (13): Workflow CI bancs d'essai, Banc des exemples (test/banc-exemples.mjs), Banc du serveur (test/banc-serveur.py), Fichiers d'exemples (as1, essai-mesure.obj...), OpenCascade / occt-import-js (WebAssembly), Appairage par code à 6 chiffres (appairage.py), Sécurité serveur : liste blanche, contrôle Host (DNS rebinding), Visionneuse 3D (WEB_3D) (+5 more)

### Community 51 - ".dispatchEvent"
Cohesion: 0.11
Nodes (3): Group, Scene, WebXRController

### Community 52 - "setProgram"
Cohesion: 0.13
Nodes (25): WebGLMaterials(), refreshFogUniforms(), refreshMaterialUniforms(), refreshTransformUniform(), refreshUniformsCommon(), refreshUniformsDash(), refreshUniformsDistance(), refreshUniformsLine() (+17 more)

### Community 53 - "appairage.py"
Cohesion: 0.09
Nodes (19): _a_refaire(), appairer(), _ca_a_refaire(), _cnf(), contexte_tls(), dossier_tls(), empreinte_ca(), en_https() (+11 more)

### Community 54 - "RenderTarget"
Cohesion: 0.12
Nodes (6): Data3DTexture, DataArrayTexture, RenderTarget, RenderTarget3D, WebGL3DRenderTarget, WebGLArrayRenderTarget

### Community 55 - "KeyframeTrack"
Cohesion: 0.12
Nodes (6): BooleanKeyframeTrack, ColorKeyframeTrack, KeyframeTrack, QuaternionKeyframeTrack, StringKeyframeTrack, VectorKeyframeTrack

### Community 56 - "BatchedMesh"
Cohesion: 0.05
Nodes (12): ascIdSort(), AxesHelper, BatchedMesh, Box3Helper, CameraHelper, copyArrayContents(), copyAttributeData(), GridHelper (+4 more)

### Community 58 - "Euler"
Cohesion: 0.13
Nodes (3): Euler, onQuaternionChange(), onRotationChange()

### Community 59 - "WebGLBindingStates"
Cohesion: 0.14
Nodes (23): WebGLBindingStates(), bindVertexArrayObject(), createBindingState(), createVertexArrayObject(), deleteVertexArrayObject(), disableUnusedAttributes(), dispose(), enableAttribute() (+15 more)

### Community 60 - "GLTFWriter"
Cohesion: 0.23
Nodes (4): equalArray(), getMinMax(), GLTFWriter, isIdentityMatrix()

### Community 61 - ".push"
Cohesion: 0.03
Nodes (113): ABS(), addSegment(), addStringToPool(), addTerminatorSegment(), ALIGNRP(), allPairs(), and(), blobSTL() (+105 more)

### Community 62 - "warn"
Cohesion: 0.08
Nodes (7): Audio, enhanceLogMessage(), getGeometry(), getTexture(), parseConstant(), setQuaternionFromProperEuler(), warn()

### Community 63 - "Texture"
Cohesion: 0.06
Nodes (8): CanvasTexture, CubeDepthTexture, DepthTexture, FramebufferTexture, HTMLTexture, serializeImage(), Texture, TextureSource

### Community 64 - "MaterialCreator"
Cohesion: 0.16
Nodes (4): MaterialCreator, resolveURL(), setMapForType(), MTLLoader

### Community 65 - "InterleavedBuffer"
Cohesion: 0.12
Nodes (5): getArrayBuffer(), getInterleavedBuffer(), generateUUID(), InstancedInterleavedBuffer, InterleavedBuffer

### Community 66 - "13-deplacement.js"
Cohesion: 0.23
Nodes (17): contourFace(), geometrieFace(), AXES, brancherDeplacement(), annulerContrainte(), apres(), basculer(), choisirFace() (+9 more)

### Community 67 - "web_3D.py"
Cohesion: 0.06
Nodes (14): adresses_poste(), hote_permis(), ip_tailscale(), adresse_locale(), attendre(), ipv4_libre(), lance_par_double_clic(), main() (+6 more)

### Community 68 - "BufferGeometryUtils.js"
Cohesion: 0.16
Nodes (7): computeMikkTSpaceTangents(), computeMorphedAttributes(), deepCloneAttribute(), deinterleaveAttribute(), deinterleaveGeometry(), mergeAttributes(), mergeGeometries()

### Community 69 - "fflate.module.js"
Cohesion: 0.09
Nodes (18): RFC-1951, AsyncGunzip(), AsyncInflate(), AsyncUnzipInflate(), AsyncUnzlib(), DecodeUTF8(), decompressSync(), EncodeUTF8() (+10 more)

### Community 70 - "ShaderMaterial"
Cohesion: 0.21
Nodes (10): cloneUniforms(), isThreeObject(), mergeUniforms(), RawShaderMaterial, ShaderMaterial, _getBlurShader(), _getCommonVertexShader(), _getCubemapMaterial() (+2 more)

### Community 71 - "arraysEqual"
Cohesion: 0.14
Nodes (24): allocTexUnits(), arraysEqual(), copyArray(), setValueM2(), setValueM3(), setValueM4(), setValueT1(), setValueT1Array() (+16 more)

### Community 72 - "banc-exemples.mjs"
Cohesion: 0.14
Nodes (3): occtimportjs, RACINE, STEP

### Community 73 - "Curve"
Cohesion: 0.04
Nodes (15): CubicBezier(), CubicBezierCurve, CubicBezierCurve3, CubicBezierP0(), CubicBezierP1(), CubicBezierP2(), CubicBezierP3(), Curve (+7 more)

### Community 74 - "Parser"
Cohesion: 0.06
Nodes (53): argument(), ELSE(), fail(), getEncoding(), getFixed(), getLanguageCode(), getLong(), getNameByID() (+45 more)

### Community 75 - ".constructor"
Cohesion: 0.13
Nodes (4): GLTFExporter, GLTFLightExtension, GLTFMaterialsIorExtension, GLTFMeshGpuInstancing

### Community 76 - "getMaterialExtension"
Cohesion: 0.07
Nodes (10): getMaterialExtension(), GLTFMaterialsAnisotropyExtension, GLTFMaterialsBumpExtension, GLTFMaterialsClearcoatExtension, GLTFMaterialsIorExtension, GLTFMaterialsIridescenceExtension, GLTFMaterialsSheenExtension, GLTFMaterialsSpecularExtension (+2 more)

### Community 78 - "Interpolant"
Cohesion: 0.13
Nodes (5): CubicInterpolant, DiscreteInterpolant, Interpolant, LinearInterpolant, QuaternionLinearInterpolant

### Community 79 - "creer"
Cohesion: 0.08
Nodes (58): creer(), afficher(), ajouter(), annoncer(), annuler(), appliquer(), base64(), battre() (+50 more)

### Community 81 - "addShape"
Cohesion: 0.15
Nodes (12): addShape(), addUV(), addVertex(), buildLidFaces(), buildSideFaces(), f3(), f4(), getBevelVec() (+4 more)

### Community 82 - "PolyhedronGeometry"
Cohesion: 0.13
Nodes (5): DodecahedronGeometry, IcosahedronGeometry, OctahedronGeometry, PolyhedronGeometry, TetrahedronGeometry

### Community 84 - "getParameters"
Cohesion: 0.17
Nodes (6): isPackedRGFormat(), getMaxPrecision(), getChannel(), getParameters(), WebGLShaderCache, WebGLShaderStage

### Community 85 - "Gestionnaire"
Cohesion: 0.20
Nodes (3): chemin_projet(), Gestionnaire, lister_projets()

### Community 86 - "Garde"
Cohesion: 0.11
Nodes (4): brancher_tls(), Garde, _html(), Visites

### Community 88 - "OBJLoader.js"
Cohesion: 0.18
Nodes (8): _ab, _cb, _color, OBJLoader, ParserState(), _vA, _vB, _vC

### Community 89 - "Loader"
Cohesion: 0.07
Nodes (9): AnimationLoader, AudioLoader, BufferGeometryLoader, CompressedTextureLoader, CubeTextureLoader, ImageBitmapLoader, Loader, MaterialLoader (+1 more)

### Community 90 - "GLTFLoader.js"
Cohesion: 0.08
Nodes (27): addMorphTargets(), addPrimitiveAttributes(), assignAttributeAccessor(), ALPHA_MODES, ATTRIBUTES, BINARY_EXTENSION_CHUNK_TYPES, computeBounds(), createAttributesKey() (+19 more)

### Community 92 - "createWasm"
Cohesion: 0.20
Nodes (12): addOnInit(), addRunDependency(), createWasm(), receiveInstance(), receiveInstantiationResult(), findWasmBinary(), getWasmImports(), locateFile() (+4 more)

### Community 94 - "banc-pilote-3d.mjs"
Cohesion: 0.04
Nodes (24): addEventListener(), arbre, compacter(), compte, coupe, declare, desc3, deux (+16 more)

### Community 96 - "GLTFParser"
Cohesion: 0.16
Nodes (3): addUnknownExtensionsToUserData(), assignExtrasToUserData(), GLTFParser

### Community 97 - "banc-conception.mjs"
Cohesion: 0.03
Nodes (56): nouvelleEsquisse(), anneau, boite20, buf, c, c1, cache, carre (+48 more)

### Community 98 - ".get"
Cohesion: 0.05
Nodes (49): activateDefaultVariation(), applyPaintType(), applyTupleVariationStore(), arabicSentenceEndCheck(), arabicSentenceStartCheck(), arabicWordEndCheck(), arabicWordStartCheck(), avar() (+41 more)

### Community 99 - "Path"
Cohesion: 0.05
Nodes (7): ArcCurve, CatmullRom(), CurvePath, EllipseCurve, Path, ShapePath, SplineCurve

### Community 100 - ".lineTo"
Cohesion: 0.05
Nodes (53): x(), y(), bezierCurveTo(), bulgeArcTo(), close(), closeWithMirror(), _convertFromUV(), convertSvgEllipseParams() (+45 more)

### Community 101 - "parseUniform"
Cohesion: 0.17
Nodes (7): addUniform(), getPureArraySetter(), getSingularSetter(), parseUniform(), PureArrayUniform, SingleUniform, StructuredUniform

### Community 102 - "deflate"
Cohesion: 0.20
Nodes (5): AsyncDeflate(), AsyncZipDeflate(), deflate, deflateSync(), ZipDeflate()

### Community 103 - ".parse"
Cohesion: 0.22
Nodes (3): STLLoader, isBinary(), matchDataViewAt()

### Community 105 - "c1-expressions.js"
Cohesion: 0.19
Nodes (14): CONSTANTES, evaluer(), atome(), produit(), puissance(), somme(), unaire(), FONCTIONS (+6 more)

### Community 106 - "delete"
Cohesion: 0.05
Nodes (55): _adaptSurface(), asShape3D(), asTuple(), baseFace(), buildWire(), clone(), complexExtrude(), curvesAsEdgesOnFace() (+47 more)

### Community 107 - ".copy"
Cohesion: 0.04
Nodes (10): handleTriangle(), handleVertex(), checkGeometryIntersection(), checkIntersection$1(), Line3, Plane, Ray, SphericalHarmonics3 (+2 more)

### Community 110 - "EditeurEsquisse"
Cohesion: 0.09
Nodes (5): rayonDe(), arrondi(), EditeurEsquisse, estNombre(), fmt()

### Community 111 - "c4-travailleur.js"
Cohesion: 0.12
Nodes (33): archive(), dxfCalques(), echapperXml(), ecrire3mf(), ecrireObj(), ecrireUrdf(), nombre(), TYPE_URDF (+25 more)

### Community 113 - "02-import.js"
Cohesion: 0.09
Nodes (30): ANNEXES, appliquerCouleursFaces(), construireNoeud(), creerGeometrie(), creerMaillage(), extension(), fabriqueMateriaux(), fileAttente (+22 more)

### Community 114 - ".read"
Cohesion: 0.27
Nodes (8): createLazyFile(), stream_ops, writeChunks(), get_char(), mmap(), position(), read(), offset()

### Community 115 - ".constructor"
Cohesion: 0.07
Nodes (8): GLTFLoader, GLTFMaterialsDispersionExtension, GLTFMaterialsEmissiveStrengthExtension, GLTFMeshGpuInstancing, GLTFMeshoptCompression, GLTFTextureAVIFExtension, GLTFTextureBasisUExtension, GLTFTextureWebPExtension

### Community 116 - "GLTFExporter.js"
Cohesion: 0.13
Nodes (8): DEFAULT_SPECULAR_COLOR, GLTFMaterialsDispersionExtension, GLTFMaterialsEmissiveStrengthExtension, GLTFMaterialsUnlitExtension, KHR_mesh_quantization_ExtraAttrTypes, PATH_PROPERTIES, THREE_TO_WEBGL, WEBGL_CONSTANTS

### Community 117 - "c6-conception.js"
Cohesion: 0.05
Nodes (52): avertir(), completerChamps(), defautsPlus(), lireNuage(), axeConstruction(), lireSvg(), VISSERIE, axesConstruits() (+44 more)

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
Cohesion: 0.09
Nodes (8): P(), esqu(), ligneEsq(), pts(), XY, ecarts, gcs, PIECES

### Community 122 - "abort"
Cohesion: 0.25
Nodes (8): abort(), assert(), getBinaryPromise(), getBinarySync(), instantiateArrayBuffer(), instantiateAsync(), lookup_name(), ___syscall_unlinkat()

### Community 124 - "get"
Cohesion: 0.13
Nodes (35): WebGLCapabilities(), getMaxAnisotropy(), textureFormatReadable(), textureTypeReadable(), WebGLProperties(), get(), has(), update() (+27 more)

### Community 125 - "Table"
Cohesion: 0.07
Nodes (39): ClassDef(), Coverage(), encodeString(), FeatureList(), LookupList(), makeCFFTable(), makeCharsets(), makeColrTable() (+31 more)

### Community 126 - "À faire — fonctionnalités et bugs"
Cohesion: 0.40
Nodes (4): Bugs, Fonctionnalités, À faire — fonctionnalités et bugs, Écart restant avec solidcraft (relevé du 05/11/2026)

### Community 127 - "c7-frise.js"
Cohesion: 0.15
Nodes (11): nomHistorique(), sansAccent(), TYPES, creerDossier(), dependances(), deplacementRefuse(), deplacer(), Frise (+3 more)

### Community 128 - "c3-operations.js"
Cohesion: 0.08
Nodes (50): aire(), angle(), axePerpendiculaire(), balayage(), cercle3Points(), controlesSpline(), COTES, courbe() (+42 more)

### Community 129 - "ContextParams"
Cohesion: 0.08
Nodes (30): arabicPresentationForms(), arabicRequiredLigatures(), ccmpReplacementLigatures(), chainingSubstitutionFormat3(), ContextParams(), contextSubstitutionFormat1(), contextSubstitutionFormat3(), decompositionSubstitutionFormat1() (+22 more)

### Community 130 - "WebGLState"
Cohesion: 0.25
Nodes (16): WebGLState(), DepthBuffer(), disable(), enable(), reset(), scissor(), setBlending(), setCullFace() (+8 more)

### Community 131 - "postRun"
Cohesion: 0.29
Nodes (7): addOnPostRun(), addOnPreRun(), initRuntime(), postRun(), preRun(), run(), doRun()

### Community 133 - ".writeAsync"
Cohesion: 0.33
Nodes (3): getPaddedArrayBuffer(), getPaddedBufferSize(), stringToArrayBuffer()

### Community 134 - "gzip"
Cohesion: 0.18
Nodes (6): AsyncGzip(), AsyncZlib(), gzip, gzipSync(), zlib, zlibSync()

### Community 136 - "WebXRManager"
Cohesion: 0.08
Nodes (9): getUnlitUniformColorSpace(), PlaneGeometry, WebGLBackground(), addToRenderList(), getBackground(), render(), setClear(), WebXRDepthSensing (+1 more)

### Community 138 - "parseCFFTable"
Cohesion: 0.07
Nodes (34): addGlyphNames(), addGlyphNamesToUnicodeMap(), calcCFFSubroutineBias(), CffEncoding(), cffGlyphLoader(), CmapEncoding(), edgeToCurveOnPlane(), entriesToObject() (+26 more)

### Community 142 - "12-collisions.js"
Cohesion: 0.26
Nodes (14): boiteMonde(), chercherCollisions(), contenue(), croiser(), dansZone(), distances(), longueur(), scal() (+6 more)

### Community 144 - "Font"
Cohesion: 0.05
Nodes (24): addGlyphNamesAll(), applyArabicRequireLigatures(), applyLatinLigatures(), applyThaiFeatures(), average(), Bidi(), buildPath(), computeCheckSum() (+16 more)

### Community 146 - "PerspectiveCamera"
Cohesion: 0.10
Nodes (4): ArrayCamera, Layers, PerspectiveCamera, StereoCamera

### Community 147 - "Module"
Cohesion: 0.08
Nodes (43): qb(), x(), Module(), $a(), Aa(), ab(), Ac(), b() (+35 more)

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
Cohesion: 0.13
Nodes (20): adopt(), fulfilled(), make_gcs_wrapper(), rejected(), step(), constraint_param_index, Algorithm, Constraint_Alignment (+12 more)

### Community 160 - "EventDispatcher"
Cohesion: 0.16
Nodes (3): Controls, EventDispatcher, UniformsGroup

### Community 161 - "c3c-references.js"
Cohesion: 0.33
Nodes (12): designes(), decrire(), dist(), ecartRapide(), lire(), plansDe(), plusProche(), pt() (+4 more)

### Community 163 - "Module"
Cohesion: 0.18
Nodes (14): Module(), $a(), b(), c(), d(), Fa(), g(), N() (+6 more)

### Community 164 - ".parse"
Cohesion: 0.15
Nodes (4): GLTFBinaryExtension, GLTFMaterialsUnlitExtension, GLTFMeshQuantizationExtension, GLTFTextureTransformExtension

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

### Community 177 - "AnimationUtils"
Cohesion: 0.17
Nodes (4): AnimationUtils, getTrackTypeForValueTypeName(), parseKeyframeTrack(), scaleTangentTimes()

### Community 178 - "harnais-page.mjs"
Cohesion: 0.19
Nodes (5): attendreHttp(), ouvrirConception(), pause(), portLibre(), RACINE

### Community 180 - "c10-regles.js"
Cohesion: 0.36
Nodes (11): controlerRegles(), esquisses(), grille(), mm(), multiple(), parametres(), plastique(), prefixePiece() (+3 more)

### Community 183 - "banc-conception-perf.mjs"
Cohesion: 0.13
Nodes (12): cache, d, d2, debut, doc(), erreurs, finMo, lignes (+4 more)

### Community 184 - "SkeletonUtils.js"
Cohesion: 0.56
Nodes (8): clone(), getBoneByName(), getBoneName(), getBones(), getHelperFromSkeleton(), parallelTraverse(), retarget(), retargetClip()

### Community 188 - "Substitution"
Cohesion: 0.26
Nodes (4): arraysEqual(), binSearch(), getSubstFormat(), Substitution()

### Community 215 - "Material"
Cohesion: 0.04
Nodes (14): LineDashedMaterial, Material, MeshDepthMaterial, MeshDistanceMaterial, MeshLambertMaterial, MeshMatcapMaterial, MeshNormalMaterial, MeshPhongMaterial (+6 more)

## Knowledge Gaps
- **20 isolated node(s):** `RFC-1951`, `RFC-3987`, `FlateErrorCode`, `OBJ + MTL : réécriture des chemins de matériaux`, `Unités ramenées au millimètre` (+15 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 2054 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **82 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `a()` connect `Module` to `.copy`, `banc-conception.mjs`, `Module`?**
  _High betweenness centrality (0.203) - this node is a cross-community bridge._
- **Are the 6 inferred relationships involving `get()` (e.g. with `WebGLAttributes()` and `WebGLEnvironments()`) actually correct?**
  _`get()` has 6 INFERRED edges - model-reasoned connections that need verification._
- **What connects `RFC-1951`, `RFC-3987`, `FlateErrorCode` to the rest of the system?**
  _20 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `three.core.js` be split into smaller, more focused modules?**
  _Cohesion score 0.007298132613043139 - nodes in this community are weakly interconnected._
- **Why does `Vector2` connect `Vector2` to `three.core.js`, `three.module.js`, `.push`, `WebGLTextures`, `BufferAttribute`, `update`, `Sphere`, `.setStyle`, `.render`, `.constructor`, `Vector3`, `.clone`, `.clampLength`, `setProgram`, `Texture`, `Curve`, `addShape`, `Material`, `Path`, `delete`, `.copy`?**
  _High betweenness centrality (0.171) - this node is a cross-community bridge._
- **Should `three.module.js` be split into smaller, more focused modules?**
  _Cohesion score 0.0076653210303729334 - nodes in this community are weakly interconnected._
- **Why does `Triangle` connect `.copy` to `three.core.js`, `.equals`, `Box3`, `three.module.js`?**
  _High betweenness centrality (0.163) - this node is a cross-community bridge._