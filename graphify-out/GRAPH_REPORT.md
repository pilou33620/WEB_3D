# Graph Report - WEB_3D  (2026-11-05)

## Corpus Check
- 96 files · ~678,763 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 18 file(s) not represented in the graph (top: .css 4, .wasm 3, .step 2)

## Summary
- 6667 nodes · 15531 edges · 217 communities (140 shown, 77 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 412 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7d5c3158`
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
- 06-topologie.js
- .render
- Vector2
- 11-projets.js
- Mesure
- earcutLinked
- Mesh
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
- 07-mesure.js
- .applyMatrix4
- CoupeManager
- casting-c4FpthHM.js
- 05-arbre.js
- .processTextureAsync
- AnimationMixer
- InstancedMesh
- c11-plus-ui.js
- Matrix3
- c3-operations.js
- LightShadow
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
- Pass
- fflate.module.js
- GTAOPass
- arraysEqual
- banc-exemples.mjs
- Curve
- Parser
- MeshPhysicalMaterial
- getMaterialExtension
- DataTexture
- Interpolant
- creer
- Conception
- .clone
- PolyhedronGeometry
- Spherical
- has
- Gestionnaire
- Garde
- CubeVue
- OBJLoader.js
- Loader
- GLTFLoader.js
- PositionalAudio
- createWasm
- CubicBezierCurve3
- banc-pilote-3d.mjs
- .parse
- GLTFParser
- banc-conception.mjs
- .get
- Path
- .lineTo
- parseUniform
- EffectComposer
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
- 08-interface.js
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
- QuadraticBezierCurve3
- c2-esquisse.js
- ContextParams
- WebGLState
- postRun
- .processImage
- .parse
- .push_constraint
- Clock
- WebXRManager
- Cylindrical
- parseCFFTable
- GLBufferAttribute
- GcsWrapper
- L
- 12-collisions.js
- SimplexNoise
- Font
- EffectComposer.js
- PerspectiveCamera
- Module
- Tokenizer
- .load
- H
- ouvrir.py
- pilote.py
- craftInvokerFunction
- getCallstack
- ___syscall_ioctl
- telephone.js
- EllipseCurve
- index.js
- EventDispatcher
- c3c-references.js
- UniformsGroup
- Module
- GLTFMaterialsUnlitExtension
- write
- registerType
- syncfs
- syscallGetVarargI
- SketchIndex
- ShaderPass.js
- DataArrayTexture
- C
- extend
- ._createAnimationTracks
- Uniform
- _points
- CylinderGeometry
- harnais-page.mjs
- close
- c10-regles.js
- CubicBezierCurve
- Int16BufferAttribute
- banc-conception-perf.mjs
- SkeletonUtils.js
- probeAsync
- MultiDrawRenderList
- Uint32BufferAttribute
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
- GLTFCubicSplineInterpolant
- GLTFLightsExtension
- TextureUtils
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
8. `EditeurEsquisse` - 78 edges
9. `warn()` - 73 edges
10. `Object3D` - 72 edges

## Surprising Connections (you probably didn't know these)
- `rectangle()` --calls--> `nouvelId()`  [EXTRACTED]
  test/banc-conception.mjs → js/c2-esquisse.js
- `yMorceaux` --calls--> `indexer()`  [EXTRACTED]
  test/banc-conception.mjs → js/c2-esquisse.js
- `traiter()` --indirect_call--> `oc()`  [INFERRED]
  js/c4-travailleur.js → vendor/replicad/replicad_single.js
- `bati()` --indirect_call--> `oc()`  [INFERRED]
  test/banc-conception-plus.mjs → vendor/replicad/replicad_single.js
- `volExt()` --indirect_call--> `oc()`  [INFERRED]
  test/banc-conception.mjs → vendor/replicad/replicad_single.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Chaîne de mesure** — js_06_topologie, js_07_mesure, readme_measure [INFERRED 0.85]
- **Chaîne de lecture STEP** — js_02_import, js_travailleur_occt, readme_opencascade [INFERRED 0.85]

## Communities (217 total, 77 thin omitted)

### Community 0 - "three.core.js"
Cohesion: 0.01
Nodes (233): RFC-3987, _addedEvent, _alignedPosition, arrayNeedsUint32(), _axis, _baseVector, _batchIntersects, _boneMatrix (+225 more)

### Community 1 - "three.module.js"
Cohesion: 0.01
Nodes (72): Compatibility, InterpolationSamplingMode, arrayCacheF32, arrayCacheI32, _clearColor, _cubeDirections, _cubeUps, DATA (+64 more)

### Community 3 - ".push"
Cohesion: 0.03
Nodes (38): AxesHelper, Box3Helper, buildPlane(), BoxHelper, BufferGeometry, CameraHelper, addLine(), addPoint() (+30 more)

### Community 4 - "replicad.js"
Cohesion: 0.01
Nodes (134): deserializeTopoShape(), serializeShape(), triangulateFace(), activateDefaultVariation(), adaptor(), _adaptSurface(), applyFilter(), approximate() (+126 more)

### Community 5 - "get"
Cohesion: 0.09
Nodes (65): createElementNS(), error(), setValueT1(), setValueT2DArray1(), setValueT3D1(), setValueT6(), getContext(), getReadableState() (+57 more)

### Community 6 - "BufferAttribute"
Cohesion: 0.04
Nodes (11): BufferAttribute, convertBufferAttribute(), copyAttributeData(), createColorManagement(), DataUtils, denormalize(), Float16BufferAttribute, InterleavedBufferAttribute (+3 more)

### Community 7 - "update"
Cohesion: 0.06
Nodes (50): object(), WebGLAttributes(), createBuffer(), get(), remove(), update(), updateBuffer(), WebGLBufferRenderer() (+42 more)

### Community 8 - ".parse"
Cohesion: 0.06
Nodes (48): unzipSync(), ThreeMFLoader, analyzeObject(), applyExtensions(), build(), buildBasematerial(), buildBasematerialsMeshes(), buildComposite() (+40 more)

### Community 9 - "WebGLRenderer"
Cohesion: 0.08
Nodes (12): WebGLRenderTarget, _createRenderTarget(), WebGLCubeRenderTarget, WebGLRenderer, renderObject(), renderObjects(), renderTransmissionPass(), VSMPass() (+4 more)

### Community 11 - "Sphere"
Cohesion: 0.07
Nodes (6): ascSort(), Box2, Raycaster, getInteriorPoint(), pointInPolygon(), Sphere

### Community 12 - "06-topologie.js"
Cohesion: 0.08
Nodes (66): aplatir(), arcEntre(), AXES_MONDE, barycentre(), cerclePlan(), constructionAngle(), constructionAretePlan(), constructionPlans() (+58 more)

### Community 13 - ".render"
Cohesion: 0.06
Nodes (36): ExternalTexture, ShadowUniformsCache(), UniformsCache(), WebGLClipping(), projectPlanes(), resetGlobalState(), WebGLLights(), setup() (+28 more)

### Community 15 - "11-projets.js"
Cohesion: 0.17
Nodes (15): extraireStepPiece(), sanitiserNomFichier(), StepExtractor, brancherProjets(), compagnons(), jour(), lireFichiersProjets(), liste() (+7 more)

### Community 17 - "earcutLinked"
Cohesion: 0.09
Nodes (32): compareXYSlope(), createNode(), cureLocalIntersections(), earcut(), earcutLinked(), eliminateHole(), eliminateHoles(), filterPoints() (+24 more)

### Community 18 - "Mesh"
Cohesion: 0.06
Nodes (8): ArrowHelper, FrustumArray, Mesh, MeshBasicMaterial, PointLightHelper, SkinnedMesh, SphereGeometry, _createPlanes()

### Community 19 - "Interface"
Cohesion: 0.13
Nodes (5): prefsModifiees(), reinitialiserPrefs(), visibleEnLignee(), calculerAretes(), Interface

### Community 22 - ".parseObject"
Cohesion: 0.07
Nodes (9): BoxGeometry, CubeCamera, DirectionalLightHelper, Line, LineLoop, LOD, getMaterial(), PlaneHelper (+1 more)

### Community 23 - ".constructor"
Cohesion: 0.10
Nodes (21): createCanvasElement(), log(), dispose(), dispose(), checkMaterialsReady(), deallocateMaterial(), getProgram(), materialNeedsLights() (+13 more)

### Community 24 - "Vector3"
Cohesion: 0.03
Nodes (13): applyRadius(), azimuth(), correctSeam(), correctUV(), correctUVs(), generateUVs(), getVertexByIndex(), inclination() (+5 more)

### Community 25 - ".load"
Cohesion: 0.27
Nodes (4): handleError(), loadTexture(), loadTexture(), FileLoader

### Community 26 - "PMREMGenerator"
Cohesion: 0.11
Nodes (18): RawShaderMaterial, ShaderMaterial, _getBlurShader(), _getCommonVertexShader(), _getCubemapMaterial(), _getEquirectMaterial(), _getGGXShader(), PMREMGenerator (+10 more)

### Community 29 - "Matrix4"
Cohesion: 0.03
Nodes (7): Bone, CatmullRomCurve3, flattenJSON(), Matrix2, Matrix4, Skeleton, SplineCurve

### Community 30 - "LoadingManager"
Cohesion: 0.10
Nodes (11): readData(), HttpError, ImageBitmapLoader, onImageError(), onImageLoad(), removeEventListeners(), intersect(), LoadingManager (+3 more)

### Community 32 - "Vue3D"
Cohesion: 0.08
Nodes (6): Vue3D, demarrer(), InterfaceConception, traitEpais(), appliquerAnalyse(), appliquerEclate()

### Community 33 - "Light"
Cohesion: 0.06
Nodes (9): AmbientLight, DirectionalLight, HemisphereLight, Light, LightProbe, PointLight, PointLightShadow, RectAreaLight (+1 more)

### Community 34 - "PropertyBinding"
Cohesion: 0.06
Nodes (3): AnimationObjectGroup, Composite, PropertyBinding

### Community 35 - "Color"
Cohesion: 0.08
Nodes (5): Color, handleAlpha(), hue2rgb(), LinearToSRGB(), SRGBToLinear()

### Community 36 - "14-pilote-3d.js"
Cohesion: 0.13
Nodes (38): formatDe(), analyser(), enchainer(), faceSous(), regionsBrep(), regionsPropagees(), souder(), maillageCollisions() (+30 more)

### Community 37 - "07-mesure.js"
Cohesion: 0.12
Nodes (14): areteSous(), centreDeFace(), geometrieArete(), numeroArete(), PLAFOND_TRIANGLES, pointSurArete(), tailleParPixel(), FenetreResultats (+6 more)

### Community 38 - ".applyMatrix4"
Cohesion: 0.07
Nodes (4): Camera, checkIntersection(), Frustum, SpotLightHelper

### Community 40 - "casting-c4FpthHM.js"
Cohesion: 0.03
Nodes (101): asDir(), asPnt(), bounds(), _calcTransforms(), center(), chamferShape(), clone(), constructor() (+93 more)

### Community 41 - "05-arbre.js"
Cohesion: 0.12
Nodes (19): Arbre, couleurDe(), echapper(), encombrement(), estDansBranche(), fmt, formaterAire(), formaterNombre() (+11 more)

### Community 42 - ".processTextureAsync"
Cohesion: 0.09
Nodes (8): GLTFMaterialsAnisotropyExtension, GLTFMaterialsBumpExtension, GLTFMaterialsClearcoatExtension, GLTFMaterialsIridescenceExtension, GLTFMaterialsSheenExtension, GLTFMaterialsSpecularExtension, GLTFMaterialsTransmissionExtension, GLTFMaterialsVolumeExtension

### Community 45 - "c11-plus-ui.js"
Cohesion: 0.10
Nodes (47): telechargerFichier(), demander(), actionsEsquisse(), activerComposant(), APPARENCES, appliquerDisposition(), apresAffichage(), AXE_ALIGNE (+39 more)

### Community 46 - "Matrix3"
Cohesion: 0.08
Nodes (5): Matrix3, Source, warnOnce(), WebGLExtensions(), getExtension()

### Community 47 - "c3-operations.js"
Cohesion: 0.10
Nodes (22): axeConstruction(), plansDe(), pointConstruction(), pointDeTroisPlans(), pointsChemin3d(), AIDES_OPERATIONS, appliquer(), AXES (+14 more)

### Community 48 - "LightShadow"
Cohesion: 0.09
Nodes (4): DirectionalLightShadow, LightShadow, OrthographicCamera, SpotLightShadow

### Community 49 - "travailleur-occt.js"
Cohesion: 0.06
Nodes (26): Workflow CI bancs d'essai, Dialogues : aide, préférences, projets, export de pièce, Import map (three), index.html structure de la page, Barre d'outils (ouvrir, mesure, coupe, collisions, déplacer, export), Banc des exemples (test/banc-exemples.mjs), Banc du serveur (test/banc-serveur.py), Fichiers d'exemples (as1, essai-mesure.obj...) (+18 more)

### Community 51 - ".dispatchEvent"
Cohesion: 0.11
Nodes (3): Group, Scene, WebXRController

### Community 52 - "setProgram"
Cohesion: 0.12
Nodes (27): WebGLMaterials(), refreshFogUniforms(), refreshMaterialUniforms(), refreshTransformUniform(), refreshUniformsCommon(), refreshUniformsDash(), refreshUniformsDistance(), refreshUniformsLine() (+19 more)

### Community 53 - "appairage.py"
Cohesion: 0.09
Nodes (19): _a_refaire(), appairer(), _ca_a_refaire(), _cnf(), contexte_tls(), dossier_tls(), empreinte_ca(), en_https() (+11 more)

### Community 54 - "RenderTarget"
Cohesion: 0.18
Nodes (4): Data3DTexture, RenderTarget, RenderTarget3D, WebGL3DRenderTarget

### Community 55 - "KeyframeTrack"
Cohesion: 0.06
Nodes (12): AnimationClip, AnimationUtils, BooleanKeyframeTrack, ColorKeyframeTrack, getTrackTypeForValueTypeName(), KeyframeTrack, NumberKeyframeTrack, parseKeyframeTrack() (+4 more)

### Community 56 - "BatchedMesh"
Cohesion: 0.07
Nodes (3): ascIdSort(), BatchedMesh, copyArrayContents()

### Community 58 - "Euler"
Cohesion: 0.13
Nodes (3): Euler, onQuaternionChange(), onRotationChange()

### Community 59 - "WebGLBindingStates"
Cohesion: 0.14
Nodes (22): WebGLBindingStates(), bindVertexArrayObject(), createBindingState(), createVertexArrayObject(), deleteVertexArrayObject(), disableUnusedAttributes(), dispose(), enableAttribute() (+14 more)

### Community 60 - "GLTFWriter"
Cohesion: 0.23
Nodes (4): equalArray(), getMinMax(), GLTFWriter, isIdentityMatrix()

### Community 61 - ".push"
Cohesion: 0.03
Nodes (117): ABS(), addSegment(), addStringToPool(), addTerminatorSegment(), ALIGNRP(), allPairs(), and(), blobSTL() (+109 more)

### Community 62 - "warn"
Cohesion: 0.07
Nodes (9): Audio, enhanceLogMessage(), ImageUtils, getGeometry(), getTexture(), parseConstant(), serializeImage(), setQuaternionFromProperEuler() (+1 more)

### Community 63 - "Texture"
Cohesion: 0.06
Nodes (7): CanvasTexture, CubeDepthTexture, DepthTexture, FramebufferTexture, HTMLTexture, Texture, TextureSource

### Community 64 - "MaterialCreator"
Cohesion: 0.16
Nodes (4): MaterialCreator, resolveURL(), setMapForType(), MTLLoader

### Community 65 - "InterleavedBuffer"
Cohesion: 0.14
Nodes (3): generateUUID(), InstancedInterleavedBuffer, InterleavedBuffer

### Community 66 - "13-deplacement.js"
Cohesion: 0.30
Nodes (15): geometrieFace(), AXES, brancherDeplacement(), annulerContrainte(), apres(), basculer(), choisirFace(), construire() (+7 more)

### Community 67 - "web_3D.py"
Cohesion: 0.06
Nodes (14): adresses_poste(), hote_permis(), ip_tailscale(), adresse_locale(), attendre(), ipv4_libre(), lance_par_double_clic(), main() (+6 more)

### Community 68 - "Pass"
Cohesion: 0.15
Nodes (5): _camera, FullscreenTriangleGeometry, _geometry, Pass, RenderPass

### Community 69 - "fflate.module.js"
Cohesion: 0.05
Nodes (31): RFC-1951, AsyncDecompress(), AsyncDeflate(), AsyncGunzip(), AsyncGzip(), AsyncInflate(), AsyncUnzipInflate(), AsyncUnzlib() (+23 more)

### Community 71 - "arraysEqual"
Cohesion: 0.21
Nodes (19): allocTexUnits(), arraysEqual(), copyArray(), setValueM2(), setValueM3(), setValueM4(), setValueT1Array(), setValueT2DArrayArray() (+11 more)

### Community 72 - "banc-exemples.mjs"
Cohesion: 0.14
Nodes (3): occtimportjs, RACINE, STEP

### Community 73 - "Curve"
Cohesion: 0.09
Nodes (3): Curve, LineCurve, LineCurve3

### Community 74 - "Parser"
Cohesion: 0.06
Nodes (51): argument(), ELSE(), fail(), getEncoding(), getFixed(), getLanguageCode(), getLong(), getNameByID() (+43 more)

### Community 76 - "getMaterialExtension"
Cohesion: 0.05
Nodes (14): getMaterialExtension(), GLTFLoader, GLTFMaterialsAnisotropyExtension, GLTFMaterialsBumpExtension, GLTFMaterialsClearcoatExtension, GLTFMaterialsDispersionExtension, GLTFMaterialsEmissiveStrengthExtension, GLTFMaterialsIorExtension (+6 more)

### Community 77 - "DataTexture"
Cohesion: 0.29
Nodes (3): DataTexture, DataTextureLoader, getDFGLUT()

### Community 78 - "Interpolant"
Cohesion: 0.13
Nodes (7): BezierInterpolant, cubicBezierSlope(), CubicInterpolant, DiscreteInterpolant, Interpolant, LinearInterpolant, solveBezierParameter()

### Community 79 - "creer"
Cohesion: 0.08
Nodes (58): creer(), afficher(), ajouter(), annoncer(), annuler(), appliquer(), base64(), battre() (+50 more)

### Community 80 - "Conception"
Cohesion: 0.06
Nodes (6): appliquerConfiguration(), ajouterPrimitives(), axesConstruits(), Conception, estNombre(), verifierPiece()

### Community 81 - ".clone"
Cohesion: 0.06
Nodes (17): addContour(), cloneUniformsGroups(), CurvePath, addShape(), addUV(), addVertex(), buildLidFaces(), buildSideFaces() (+9 more)

### Community 82 - "PolyhedronGeometry"
Cohesion: 0.13
Nodes (5): DodecahedronGeometry, IcosahedronGeometry, OctahedronGeometry, PolyhedronGeometry, TetrahedronGeometry

### Community 84 - "has"
Cohesion: 0.15
Nodes (12): isPackedRGFormat(), WebGLCapabilities(), getMaxAnisotropy(), getMaxPrecision(), textureFormatReadable(), textureTypeReadable(), getChannel(), getParameters() (+4 more)

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
Cohesion: 0.09
Nodes (9): AnimationLoader, AudioLoader, BufferGeometryLoader, CompressedTextureLoader, CubeTexture, CubeTextureLoader, ImageLoader, Loader (+1 more)

### Community 90 - "GLTFLoader.js"
Cohesion: 0.07
Nodes (25): addMorphTargets(), addPrimitiveAttributes(), assignAttributeAccessor(), ALPHA_MODES, ATTRIBUTES, BINARY_EXTENSION_CHUNK_TYPES, createAttributesKey(), createPrimitiveKey() (+17 more)

### Community 92 - "createWasm"
Cohesion: 0.20
Nodes (12): addOnInit(), addRunDependency(), createWasm(), receiveInstance(), receiveInstantiationResult(), findWasmBinary(), getWasmImports(), locateFile() (+4 more)

### Community 93 - "CubicBezierCurve3"
Cohesion: 0.17
Nodes (6): CubicBezier(), CubicBezierCurve3, CubicBezierP0(), CubicBezierP1(), CubicBezierP2(), CubicBezierP3()

### Community 94 - "banc-pilote-3d.mjs"
Cohesion: 0.04
Nodes (24): addEventListener(), arbre, compacter(), compte, coupe, declare, desc3, deux (+16 more)

### Community 95 - ".parse"
Cohesion: 0.31
Nodes (4): getArrayBuffer(), getInterleavedBuffer(), getTypedArray(), InstancedBufferGeometry

### Community 96 - "GLTFParser"
Cohesion: 0.17
Nodes (5): addUnknownExtensionsToUserData(), assignExtrasToUserData(), createDefaultMaterial(), GLTFParser, updateMorphTargets()

### Community 97 - "banc-conception.mjs"
Cohesion: 0.03
Nodes (57): nouvelleEsquisse(), noyau(), anneau, boite20, buf, c, c1, cache (+49 more)

### Community 98 - ".get"
Cohesion: 0.05
Nodes (49): applyPaintType(), applyTupleVariationStore(), arabicSentenceEndCheck(), arabicSentenceStartCheck(), arabicWordEndCheck(), arabicWordStartCheck(), avar(), CALL() (+41 more)

### Community 99 - "Path"
Cohesion: 0.10
Nodes (3): Path, QuadraticBezierCurve, ShapePath

### Community 100 - ".lineTo"
Cohesion: 0.05
Nodes (55): x(), y(), bezierCurveTo(), boundingBox(), bulgeArcTo(), close(), _closeSketch(), closeWithCustomCorner() (+47 more)

### Community 101 - "parseUniform"
Cohesion: 0.17
Nodes (7): addUniform(), getPureArraySetter(), getSingularSetter(), parseUniform(), PureArrayUniform, SingleUniform, StructuredUniform

### Community 103 - ".parse"
Cohesion: 0.22
Nodes (3): STLLoader, isBinary(), matchDataViewAt()

### Community 105 - "c1-expressions.js"
Cohesion: 0.19
Nodes (14): CONSTANTES, evaluer(), atome(), produit(), puissance(), somme(), unaire(), FONCTIONS (+6 more)

### Community 106 - "delete"
Cohesion: 0.07
Nodes (34): asTuple(), complexExtrude(), curvesAsEdgesOnFace(), curvesAsEdgesOnPlane(), cutPlane(), delete(), extrude(), face() (+26 more)

### Community 107 - ".copy"
Cohesion: 0.04
Nodes (10): handleTriangle(), handleVertex(), checkGeometryIntersection(), checkIntersection$1(), Plane, Ray, SphericalHarmonics3, testPoint() (+2 more)

### Community 110 - "EditeurEsquisse"
Cohesion: 0.05
Nodes (57): dxfEsquisse(), indexer(), nouvelId(), rayonDe(), ajuster(), angleDe(), casserCoin(), copier() (+49 more)

### Community 111 - "c4-travailleur.js"
Cohesion: 0.13
Nodes (32): archive(), contoursImage(), dxfCalques(), echapperXml(), ecrire3mf(), ecrireObj(), ecrireUrdf(), nombre() (+24 more)

### Community 112 - "Timer"
Cohesion: 0.11
Nodes (3): AudioContext, AudioListener, Timer

### Community 113 - "08-interface.js"
Cohesion: 0.05
Nodes (63): abonnes, actionPourGeste(), ACTIONS, BOUTONS, chargerPrefs(), EMPLACEMENTS, enregistrerPrefs(), gestesActifs() (+55 more)

### Community 114 - ".read"
Cohesion: 0.31
Nodes (7): createLazyFile(), stream_ops, writeChunks(), get_char(), mmap(), position(), read()

### Community 115 - ".loadTextureImage"
Cohesion: 0.18
Nodes (3): GLTFTextureAVIFExtension, GLTFTextureBasisUExtension, GLTFTextureWebPExtension

### Community 116 - "GLTFExporter.js"
Cohesion: 0.09
Nodes (12): DEFAULT_SPECULAR_COLOR, GLTFExporter, GLTFLightExtension, GLTFMaterialsDispersionExtension, GLTFMaterialsEmissiveStrengthExtension, GLTFMaterialsIorExtension, GLTFMaterialsUnlitExtension, GLTFMeshGpuInstancing (+4 more)

### Community 117 - "c6-conception.js"
Cohesion: 0.05
Nodes (60): avertir(), boite(), confirmer(), demanderTexte(), defautsPlus(), lireNuage(), axePerpendiculaire(), nomHistorique() (+52 more)

### Community 118 - "Pilote"
Cohesion: 0.14
Nodes (4): _pieces(), Pilote, Refus, _texte()

### Community 119 - "CompressedArrayTexture"
Cohesion: 0.22
Nodes (3): CompressedArrayTexture, CompressedCubeTexture, CompressedTexture

### Community 120 - "find"
Cohesion: 0.07
Nodes (42): shellShape(), blueprintsIntersectionSegments(), booleanOperation(), chamfer2D(), chamferCurves(), createSegmentOnPoints(), crossProduct2d(), distanceFrom() (+34 more)

### Community 121 - "banc-conception-plus.mjs"
Cohesion: 0.15
Nodes (6): esqu(), ligneEsq(), pts(), XY, strFromU8(), zip

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

### Community 127 - "QuadraticBezierCurve3"
Cohesion: 0.18
Nodes (5): QuadraticBezier(), QuadraticBezierCurve3, QuadraticBezierP0(), QuadraticBezierP1(), QuadraticBezierP2()

### Community 128 - "c2-esquisse.js"
Cohesion: 0.10
Nodes (40): aire(), angle(), balayage(), cercle3Points(), controlesSpline(), COTES, courbe(), dedans() (+32 more)

### Community 129 - "ContextParams"
Cohesion: 0.08
Nodes (30): arabicPresentationForms(), arabicRequiredLigatures(), ccmpReplacementLigatures(), chainingSubstitutionFormat3(), ContextParams(), contextSubstitutionFormat1(), contextSubstitutionFormat3(), decompositionSubstitutionFormat1() (+22 more)

### Community 130 - "WebGLState"
Cohesion: 0.24
Nodes (15): WebGLState(), ColorBuffer(), DepthBuffer(), disable(), enable(), reset(), scissor(), setBlending() (+7 more)

### Community 131 - "postRun"
Cohesion: 0.29
Nodes (7): addOnPostRun(), addOnPreRun(), initRuntime(), postRun(), preRun(), run(), doRun()

### Community 133 - ".parse"
Cohesion: 0.20
Nodes (3): getPaddedArrayBuffer(), getPaddedBufferSize(), stringToArrayBuffer()

### Community 136 - "WebXRManager"
Cohesion: 0.06
Nodes (18): cloneUniforms(), getUnlitUniformColorSpace(), isThreeObject(), mergeUniforms(), PlaneGeometry, WebGLAnimation(), onAnimationFrame(), WebGLBackground() (+10 more)

### Community 138 - "parseCFFTable"
Cohesion: 0.07
Nodes (36): addGlyphNames(), addGlyphNamesToUnicodeMap(), calcCFFSubroutineBias(), CffEncoding(), cffGlyphLoader(), CmapEncoding(), edgeToCurveOnPlane(), entriesToObject() (+28 more)

### Community 141 - "L"
Cohesion: 0.33
Nodes (10): Db(), eb(), K(), L(), mb(), ob(), pb(), qb() (+2 more)

### Community 142 - "12-collisions.js"
Cohesion: 0.26
Nodes (14): boiteMonde(), chercherCollisions(), contenue(), croiser(), dansZone(), distances(), longueur(), scal() (+6 more)

### Community 144 - "Font"
Cohesion: 0.05
Nodes (23): addGlyphNamesAll(), applyArabicRequireLigatures(), applyLatinLigatures(), applyThaiFeatures(), average(), Bidi(), buildPath(), computeCheckSum() (+15 more)

### Community 145 - "EffectComposer.js"
Cohesion: 0.29
Nodes (3): ClearMaskPass, MaskPass, CopyShader

### Community 146 - "PerspectiveCamera"
Cohesion: 0.10
Nodes (4): ArrayCamera, Layers, PerspectiveCamera, StereoCamera

### Community 147 - "Module"
Cohesion: 0.09
Nodes (32): g(), x(), Module(), $a(), ab(), Ac(), b(), Ba() (+24 more)

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

### Community 161 - "c3c-references.js"
Cohesion: 0.33
Nodes (12): designes(), decrire(), dist(), ecartRapide(), lire(), plansDe(), plusProche(), pt() (+4 more)

### Community 163 - "Module"
Cohesion: 0.14
Nodes (16): make_gcs_wrapper(), Module(), $a(), b(), c(), d(), Fa(), N() (+8 more)

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

### Community 178 - "harnais-page.mjs"
Cohesion: 0.17
Nodes (5): attendreHttp(), ouvrirConception(), pause(), portLibre(), RACINE

### Community 180 - "c10-regles.js"
Cohesion: 0.40
Nodes (10): controlerRegles(), esquisses(), grille(), mm(), multiple(), parametres(), plastique(), prefixePiece() (+2 more)

### Community 183 - "banc-conception-perf.mjs"
Cohesion: 0.07
Nodes (16): P(), cache, d, d2, debut, doc(), erreurs, finMo (+8 more)

### Community 184 - "SkeletonUtils.js"
Cohesion: 0.56
Nodes (8): clone(), getBoneByName(), getBoneName(), getBones(), getHelperFromSkeleton(), parallelTraverse(), retarget(), retargetClip()

### Community 188 - "Substitution"
Cohesion: 0.26
Nodes (4): arraysEqual(), binSearch(), getSubstFormat(), Substitution()

### Community 215 - "Material"
Cohesion: 0.05
Nodes (12): LineDashedMaterial, Material, MeshDepthMaterial, MeshDistanceMaterial, MeshLambertMaterial, MeshMatcapMaterial, MeshNormalMaterial, MeshPhongMaterial (+4 more)

## Knowledge Gaps
- **20 isolated node(s):** `RFC-1951`, `RFC-3987`, `FlateErrorCode`, `OBJ + MTL : réécriture des chemins de matériaux`, `Unités ramenées au millimètre` (+15 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 2078 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **77 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `a()` connect `Module` to `.copy`, `banc-conception.mjs`, `Module`?**
  _High betweenness centrality (0.183) - this node is a cross-community bridge._
- **Are the 6 inferred relationships involving `get()` (e.g. with `WebGLAttributes()` and `WebGLEnvironments()`) actually correct?**
  _`get()` has 6 INFERRED edges - model-reasoned connections that need verification._
- **What connects `RFC-1951`, `RFC-3987`, `FlateErrorCode` to the rest of the system?**
  _20 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `three.core.js` be split into smaller, more focused modules?**
  _Cohesion score 0.007434339049272846 - nodes in this community are weakly interconnected._
- **Why does `Triangle` connect `.copy` to `three.core.js`, `.clone`, `Box3`, `three.module.js`?**
  _High betweenness centrality (0.158) - this node is a cross-community bridge._
- **Should `three.module.js` be split into smaller, more focused modules?**
  _Cohesion score 0.007578967189191734 - nodes in this community are weakly interconnected._
- **Why does `Vector2` connect `Vector2` to `three.core.js`, `three.module.js`, `.push`, `get`, `BufferAttribute`, `WebXRManager`, `Sphere`, `.render`, `.constructor`, `Vector3`, `Matrix4`, `ObjectLoader`, `LightShadow`, `setProgram`, `CubicBezierCurve`, `Texture`, `MeshPhysicalMaterial`, `Material`, `Path`, `delete`, `.copy`?**
  _High betweenness centrality (0.138) - this node is a cross-community bridge._