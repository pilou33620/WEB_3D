# Graph Report - WEB_3D  (2026-11-04)

## Corpus Check
- 71 files · ~594,563 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 18 file(s) not represented in the graph (top: .css 4, .wasm 3, .step 2)

## Summary
- 6200 nodes · 14174 edges · 227 communities (133 shown, 94 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 385 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d59b02f1`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- three.core.js
- three.module.js
- occt-import-js.js
- .push
- replicad.js
- warn
- BufferAttribute
- update
- .parse
- WebGLRenderer
- Object3D
- Sphere
- formeChaine
- .render
- Vector2
- 08-interface.js
- Mesure
- .equals
- Material
- Interface
- Quaternion
- Vector4
- Mesh
- .constructor
- Vector3
- .load
- PMREMGenerator
- AnimationAction
- Box3
- Matrix4
- LoadingManager
- .parseObject
- Vue3D
- Light
- PropertyBinding
- Color
- 14-pilote-3d.js
- 07-mesure.js
- BatchedMesh
- CoupeManager
- casting-c4FpthHM.js
- 05-arbre.js
- .processTextureAsync
- AnimationMixer
- .clone
- Int16BufferAttribute
- Matrix3
- WebGLProgram
- LightShadow
- travailleur-occt.js
- Navigation
- .dispatchEvent
- WebGLMaterials
- appairage.py
- RenderTarget
- KeyframeTrack
- LineSegments
- GcsSystemMock
- Euler
- WebGLBindingStates
- GLTFWriter
- .push
- Audio
- Texture
- MaterialCreator
- InterleavedBuffer
- faceSous
- web_3D.py
- BufferGeometryUtils.js
- fflate.module.js
- createElementNS
- arraysEqual
- banc-exemples.mjs
- CubicBezierCurve
- Parser
- .constructor
- QuadraticBezierCurve
- DataTexture
- Interpolant
- creer
- Conception
- Curve
- PolyhedronGeometry
- Spherical
- getParameters
- Gestionnaire
- Garde
- CubeVue
- OBJLoader.js
- Loader
- MeshPhysicalMaterial
- PositionalAudio
- createWasm
- zip
- banc-pilote-3d.mjs
- InstancedBufferGeometry
- 06-topologie.js
- banc-conception.mjs
- .get
- Path
- .lineTo
- parseUniform
- deflate
- .parse
- PropertyMixer
- c3-operations.js
- delete
- .copy
- VideoTexture
- Appairage
- EditeurEsquisse
- CylinderGeometry
- EventDispatcher
- 02-import.js
- .mmap
- AudioListener
- Controls
- c6-conception.js
- Pilote
- CompressedArrayTexture
- find
- 11-projets.js
- abort
- Camera
- get
- Table
- À faire — fonctionnalités et bugs
- SplineCurve
- c2-esquisse.js
- ContextParams
- DataArrayTexture
- postRun
- .buildMetalRoughTextureAsync
- GLTFExporter.js
- gzip
- Clock
- WebXRManager
- Cylindrical
- parseCFFTable
- GLBufferAttribute
- GcsWrapper
- 12-collisions.js
- flatten
- Font
- AnimationClip
- PerspectiveCamera
- Module
- ThreeMFLoader
- Tokenizer
- H
- ouvrir.py
- pilote.py
- craftInvokerFunction
- getCallstack
- ___syscall_ioctl
- telephone.js
- StepExtractor
- index.js
- UniformsGroup
- CurvePath
- .applyMatrix4
- Module
- a
- write
- registerType
- syncfs
- syscallGetVarargI
- SketchIndex
- decompress
- ZipPassThrough
- FenetreResultats
- extend
- c7-frise.js
- Uniform
- _points
- EllipseCurve
- banc-conception-page.mjs
- close
- CubicPoly
- .lerp
- euclideanModulo
- banc-conception-perf.mjs
- getKeyframeOrder
- probeAsync
- MultiDrawRenderList
- LineCurve3
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
- AnimationUtils
- Layers
- .push_constraint
- InstancedBufferAttribute
- boundingBox
- PointLight
- Fog
- FogExp2
- BezierInterpolant
- InstancedInterleavedBuffer
- MeshLambertMaterial
- MeshPhongMaterial
- AudioContext
- getByteLength
- Int32BufferAttribute
- Int8BufferAttribute
- Uint16BufferAttribute
- Uint32BufferAttribute
- Uint8BufferAttribute
- Uint8ClampedBufferAttribute
- WebGLShaderStage

## God Nodes (most connected - your core abstractions)
1. `GcsSystemMock` - 119 edges
2. `Vector3` - 113 edges
3. `Conception` - 99 edges
4. `Vector2` - 90 edges
5. `get()` - 87 edges
6. `pop()` - 85 edges
7. `Parser()` - 82 edges
8. `warn()` - 73 edges
9. `Object3D` - 72 edges
10. `BufferGeometry` - 71 edges

## Surprising Connections (you probably didn't know these)
- `rectangle()` --calls--> `nouvelId()`  [EXTRACTED]
  test/banc-conception.mjs → js/c2-esquisse.js
- `yMorceaux` --calls--> `indexer()`  [EXTRACTED]
  test/banc-conception.mjs → js/c2-esquisse.js
- `volExt()` --indirect_call--> `oc()`  [INFERRED]
  test/banc-conception.mjs → vendor/replicad/replicad_single.js
- `tire()` --indirect_call--> `oc()`  [INFERRED]
  test/banc-conception.mjs → vendor/replicad/replicad_single.js
- `volume()` --indirect_call--> `oc()`  [INFERRED]
  test/banc-conception.mjs → vendor/replicad/replicad_single.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Chaîne de mesure** — js_06_topologie, js_07_mesure, readme_measure [INFERRED 0.85]
- **Chaîne de lecture STEP** — js_02_import, js_travailleur_occt, readme_opencascade [INFERRED 0.85]

## Communities (227 total, 94 thin omitted)

### Community 0 - "three.core.js"
Cohesion: 0.01
Nodes (227): RFC-3987, _addedEvent, _alignedPosition, arrayNeedsUint32(), _axis, _baseVector, _batchIntersects, _boneMatrix (+219 more)

### Community 1 - "three.module.js"
Cohesion: 0.01
Nodes (40): TimestampQuery, arrayCacheF32, arrayCacheI32, _clearColor, _cubeDirections, _cubeUps, DATA, _direction (+32 more)

### Community 3 - ".push"
Cohesion: 0.04
Nodes (39): addContour(), buildPlane(), BufferGeometry, addLine(), addPoint(), CapsuleGeometry, CircleGeometry, generateCap() (+31 more)

### Community 4 - "replicad.js"
Cohesion: 0.01
Nodes (101): deserializeTopoShape(), serializeShape(), triangulateFace(), applyArabicRequireLigatures(), applyLatinLigatures(), applyThaiFeatures(), atDistance(), atPoint() (+93 more)

### Community 5 - "warn"
Cohesion: 0.09
Nodes (53): enhanceLogMessage(), error(), warn(), includeReplacer(), setValueT1(), setValueT2DArray1(), setValueT3D1(), setValueT6() (+45 more)

### Community 6 - "BufferAttribute"
Cohesion: 0.05
Nodes (9): BufferAttribute, copyAttributeData(), createColorManagement(), DataUtils, denormalize(), Float16BufferAttribute, InterleavedBufferAttribute, isUniqueEdge() (+1 more)

### Community 7 - "update"
Cohesion: 0.07
Nodes (43): WebGLAttributes(), createBuffer(), get(), remove(), update(), updateBuffer(), WebGLBufferRenderer(), render() (+35 more)

### Community 8 - ".parse"
Cohesion: 0.11
Nodes (37): analyzeObject(), applyExtensions(), build(), buildBasematerial(), buildBasematerialsMeshes(), buildComposite(), buildDefaultMesh(), buildGroup() (+29 more)

### Community 9 - "WebGLRenderer"
Cohesion: 0.07
Nodes (13): WebGLRenderTarget, _createRenderTarget(), WebGLRenderer, renderObject(), renderObjects(), renderTransmissionPass(), VSMPass(), ColorBuffer() (+5 more)

### Community 11 - "Sphere"
Cohesion: 0.07
Nodes (4): ascSort(), Box2, Raycaster, Sphere

### Community 12 - "formeChaine"
Cohesion: 0.39
Nodes (8): barycentre(), cerclePlan(), covariance(), formeChaine(), formeNappe(), proprer(), repere(), resoudre3()

### Community 13 - ".render"
Cohesion: 0.07
Nodes (32): ExternalTexture, RawShaderMaterial, ShadowUniformsCache(), UniformsCache(), WebGLClipping(), projectPlanes(), resetGlobalState(), WebGLLights() (+24 more)

### Community 15 - "08-interface.js"
Cohesion: 0.08
Nodes (31): abonnes, actionPourGeste(), ACTIONS, BOUTONS, chargerPrefs(), EMPLACEMENTS, enregistrerPrefs(), nomBouton() (+23 more)

### Community 17 - ".equals"
Cohesion: 0.08
Nodes (33): compareXYSlope(), createNode(), cureLocalIntersections(), earcut(), earcutLinked(), eliminateHole(), eliminateHoles(), filterPoints() (+25 more)

### Community 18 - "Material"
Cohesion: 0.06
Nodes (10): LineDashedMaterial, Material, MeshDepthMaterial, MeshDistanceMaterial, MeshMatcapMaterial, MeshNormalMaterial, MeshToonMaterial, PointsMaterial (+2 more)

### Community 19 - "Interface"
Cohesion: 0.13
Nodes (6): gestesActifs(), prefsModifiees(), reinitialiserPrefs(), resumeGestes(), calculerAretes(), Interface

### Community 22 - "Mesh"
Cohesion: 0.06
Nodes (8): ArrowHelper, FrustumArray, Line, Mesh, MeshBasicMaterial, PointLightHelper, SphereGeometry, Sprite

### Community 23 - ".constructor"
Cohesion: 0.09
Nodes (30): log(), dispose(), WebGLMorphtargets(), update(), disposeTexture(), dispose(), getUniforms(), releaseShaderCache() (+22 more)

### Community 24 - "Vector3"
Cohesion: 0.03
Nodes (13): applyRadius(), azimuth(), correctSeam(), correctUV(), correctUVs(), generateUVs(), getVertexByIndex(), inclination() (+5 more)

### Community 25 - ".load"
Cohesion: 0.21
Nodes (4): handleError(), loadTexture(), loadTexture(), FileLoader

### Community 26 - "PMREMGenerator"
Cohesion: 0.11
Nodes (19): BoxGeometry, ShaderMaterial, _getBlurShader(), _getCommonVertexShader(), _getCubemapMaterial(), _getEquirectMaterial(), _getGGXShader(), PMREMGenerator (+11 more)

### Community 27 - "AnimationAction"
Cohesion: 0.08
Nodes (3): AnimationAction, handleVisibilityChange(), LinearInterpolant

### Community 29 - "Matrix4"
Cohesion: 0.04
Nodes (6): Bone, CatmullRomCurve3, flattenJSON(), Matrix2, Matrix4, Skeleton

### Community 30 - "LoadingManager"
Cohesion: 0.10
Nodes (13): readData(), getTypedArray(), HttpError, ImageLoader, onImageError(), onImageLoad(), removeEventListeners(), intersect() (+5 more)

### Community 31 - ".parseObject"
Cohesion: 0.13
Nodes (7): LineLoop, MaterialLoader, ObjectLoader, getGeometry(), getMaterial(), getTexture(), parseConstant()

### Community 32 - "Vue3D"
Cohesion: 0.10
Nodes (4): Vue3D, demarrer(), InterfaceConception, appliquerAnalyse()

### Community 33 - "Light"
Cohesion: 0.07
Nodes (7): AmbientLight, DirectionalLight, HemisphereLight, Light, LightProbe, RectAreaLight, SpotLight

### Community 34 - "PropertyBinding"
Cohesion: 0.06
Nodes (3): AnimationObjectGroup, Composite, PropertyBinding

### Community 35 - "Color"
Cohesion: 0.08
Nodes (5): Color, handleAlpha(), hue2rgb(), LinearToSRGB(), SRGBToLinear()

### Community 36 - "14-pilote-3d.js"
Cohesion: 0.14
Nodes (36): encombrement(), mesurerSolide(), maillageCollisions(), apresDeplacement(), AXES, contraindre(), perimerCaches(), pivoter() (+28 more)

### Community 37 - "07-mesure.js"
Cohesion: 0.10
Nodes (23): analyser(), areteSous(), centreDeFace(), echelleDe(), enchainer(), entiteArete(), entiteFace(), milieuCurviligne() (+15 more)

### Community 38 - "BatchedMesh"
Cohesion: 0.07
Nodes (8): ascIdSort(), BatchedMesh, convertBufferAttribute(), copyArrayContents(), DirectionalLightHelper, setPoint(), sortedArray(), SpotLightHelper

### Community 40 - "casting-c4FpthHM.js"
Cohesion: 0.03
Nodes (105): asDir(), asPnt(), bounds(), _calcTransforms(), center(), chamferShape(), clone(), constructor() (+97 more)

### Community 41 - "05-arbre.js"
Cohesion: 0.15
Nodes (13): Arbre, couleurDe(), echapper(), estDansBranche(), fmt, formaterAire(), formaterNombre(), formaterVolume() (+5 more)

### Community 42 - ".processTextureAsync"
Cohesion: 0.09
Nodes (8): GLTFMaterialsAnisotropyExtension, GLTFMaterialsBumpExtension, GLTFMaterialsClearcoatExtension, GLTFMaterialsIridescenceExtension, GLTFMaterialsSheenExtension, GLTFMaterialsSpecularExtension, GLTFMaterialsTransmissionExtension, GLTFMaterialsVolumeExtension

### Community 44 - ".clone"
Cohesion: 0.04
Nodes (10): checkIntersection(), checkIntersection$1(), cloneUniformsGroups(), scalePt2(), Frustum, InstancedMesh, LOD, SkinnedMesh (+2 more)

### Community 46 - "Matrix3"
Cohesion: 0.08
Nodes (5): Matrix3, Source, warnOnce(), WebGLExtensions(), getExtension()

### Community 47 - "WebGLProgram"
Cohesion: 0.08
Nodes (24): fetchAttributeLocations(), filterEmptyLine(), generateCubeUVSize(), generateDefines(), generateEnvMapBlendingDefine(), generateEnvMapModeDefine(), generateEnvMapTypeDefine(), generatePrecision() (+16 more)

### Community 49 - "travailleur-occt.js"
Cohesion: 0.06
Nodes (26): Workflow CI bancs d'essai, Dialogues : aide, préférences, projets, export de pièce, Import map (three), index.html structure de la page, Barre d'outils (ouvrir, mesure, coupe, collisions, déplacer, export), Banc des exemples (test/banc-exemples.mjs), Banc du serveur (test/banc-serveur.py), Fichiers d'exemples (as1, essai-mesure.obj...) (+18 more)

### Community 51 - ".dispatchEvent"
Cohesion: 0.10
Nodes (3): Group, Scene, WebXRController

### Community 52 - "WebGLMaterials"
Cohesion: 0.15
Nodes (24): cloneUniforms(), getUnlitUniformColorSpace(), isThreeObject(), mergeUniforms(), WebGLBackground(), addToRenderList(), getBackground(), render() (+16 more)

### Community 53 - "appairage.py"
Cohesion: 0.07
Nodes (23): _a_refaire(), adresses_poste(), appairer(), C, _ca_a_refaire(), _cnf(), contexte_tls(), CS (+15 more)

### Community 54 - "RenderTarget"
Cohesion: 0.18
Nodes (4): Data3DTexture, RenderTarget, RenderTarget3D, WebGL3DRenderTarget

### Community 55 - "KeyframeTrack"
Cohesion: 0.12
Nodes (6): BooleanKeyframeTrack, ColorKeyframeTrack, KeyframeTrack, QuaternionKeyframeTrack, StringKeyframeTrack, VectorKeyframeTrack

### Community 56 - "LineSegments"
Cohesion: 0.10
Nodes (8): AxesHelper, Box3Helper, BoxHelper, CameraHelper, GridHelper, LineSegments, PolarGridHelper, SkeletonHelper

### Community 58 - "Euler"
Cohesion: 0.13
Nodes (3): Euler, onQuaternionChange(), onRotationChange()

### Community 59 - "WebGLBindingStates"
Cohesion: 0.12
Nodes (23): WebGLBindingStates(), bindVertexArrayObject(), createBindingState(), createVertexArrayObject(), deleteVertexArrayObject(), disableUnusedAttributes(), dispose(), enableAttribute() (+15 more)

### Community 60 - "GLTFWriter"
Cohesion: 0.24
Nodes (3): equalArray(), GLTFWriter, isIdentityMatrix()

### Community 61 - ".push"
Cohesion: 0.03
Nodes (113): ABS(), addSegment(), addStringToPool(), addTerminatorSegment(), ALIGNRP(), allPairs(), and(), blobSTL() (+105 more)

### Community 63 - "Texture"
Cohesion: 0.06
Nodes (8): CanvasTexture, CubeDepthTexture, CubeTexture, DepthTexture, FramebufferTexture, HTMLTexture, Texture, TextureSource

### Community 64 - "MaterialCreator"
Cohesion: 0.16
Nodes (4): MaterialCreator, resolveURL(), setMapForType(), MTLLoader

### Community 65 - "InterleavedBuffer"
Cohesion: 0.15
Nodes (4): getArrayBuffer(), getInterleavedBuffer(), generateUUID(), InterleavedBuffer

### Community 66 - "faceSous"
Cohesion: 0.25
Nodes (16): contourFace(), faceSous(), geometrieArete(), geometrieFace(), brancherDeplacement(), annulerContrainte(), apres(), basculer() (+8 more)

### Community 67 - "web_3D.py"
Cohesion: 0.11
Nodes (11): adresse_locale(), attendre(), ipv4_libre(), lance_par_double_clic(), main(), ouvrir_serveur(), processus_de_la_console(), redemarrer_application() (+3 more)

### Community 68 - "BufferGeometryUtils.js"
Cohesion: 0.13
Nodes (9): unzipSync(), buildLatticeMesh(), computeMikkTSpaceTangents(), computeMorphedAttributes(), deepCloneAttribute(), deinterleaveAttribute(), deinterleaveGeometry(), mergeAttributes() (+1 more)

### Community 69 - "fflate.module.js"
Cohesion: 0.09
Nodes (17): RFC-1951, AsyncDecompress(), AsyncGunzip(), AsyncInflate(), AsyncUnzipInflate(), AsyncUnzlib(), DecodeUTF8(), decompressSync() (+9 more)

### Community 70 - "createElementNS"
Cohesion: 0.24
Nodes (5): createCanvasElement(), createElementNS(), ImageUtils, serializeImage(), createCanvas()

### Community 71 - "arraysEqual"
Cohesion: 0.21
Nodes (19): allocTexUnits(), arraysEqual(), copyArray(), setValueM2(), setValueM3(), setValueM4(), setValueT1Array(), setValueT2DArrayArray() (+11 more)

### Community 72 - "banc-exemples.mjs"
Cohesion: 0.13
Nodes (3): occtimportjs, RACINE, STEP

### Community 73 - "CubicBezierCurve"
Cohesion: 0.11
Nodes (7): CubicBezier(), CubicBezierCurve, CubicBezierCurve3, CubicBezierP0(), CubicBezierP1(), CubicBezierP2(), CubicBezierP3()

### Community 74 - "Parser"
Cohesion: 0.06
Nodes (53): argument(), ELSE(), fail(), getEncoding(), getFixed(), getLanguageCode(), getLong(), getNameByID() (+45 more)

### Community 75 - ".constructor"
Cohesion: 0.09
Nodes (6): GLTFExporter, GLTFMaterialsDispersionExtension, GLTFMaterialsEmissiveStrengthExtension, GLTFMaterialsIorExtension, GLTFMaterialsUnlitExtension, GLTFMeshGpuInstancing

### Community 76 - "QuadraticBezierCurve"
Cohesion: 0.12
Nodes (6): QuadraticBezier(), QuadraticBezierCurve, QuadraticBezierCurve3, QuadraticBezierP0(), QuadraticBezierP1(), QuadraticBezierP2()

### Community 77 - "DataTexture"
Cohesion: 0.29
Nodes (3): DataTexture, DataTextureLoader, getDFGLUT()

### Community 78 - "Interpolant"
Cohesion: 0.17
Nodes (4): CubicInterpolant, DiscreteInterpolant, Interpolant, QuaternionLinearInterpolant

### Community 79 - "creer"
Cohesion: 0.08
Nodes (58): creer(), afficher(), ajouter(), annoncer(), annuler(), appliquer(), base64(), battre() (+50 more)

### Community 80 - "Conception"
Cohesion: 0.08
Nodes (7): telechargerFichier(), nomProjet(), appliquerConfiguration(), axesConstruits(), Conception, estNombre(), nouvelleOperation()

### Community 82 - "PolyhedronGeometry"
Cohesion: 0.13
Nodes (5): DodecahedronGeometry, IcosahedronGeometry, OctahedronGeometry, PolyhedronGeometry, TetrahedronGeometry

### Community 84 - "getParameters"
Cohesion: 0.23
Nodes (4): getMaxPrecision(), getChannel(), getParameters(), WebGLShaderCache

### Community 85 - "Gestionnaire"
Cohesion: 0.20
Nodes (3): chemin_projet(), Gestionnaire, lister_projets()

### Community 86 - "Garde"
Cohesion: 0.13
Nodes (5): brancher_tls(), en_https(), filtrer_tls(), Garde, _html()

### Community 88 - "OBJLoader.js"
Cohesion: 0.18
Nodes (8): _ab, _cb, _color, OBJLoader, ParserState(), _vA, _vB, _vC

### Community 89 - "Loader"
Cohesion: 0.09
Nodes (8): AnimationLoader, AudioLoader, BufferGeometryLoader, CompressedTextureLoader, CubeTextureLoader, ImageBitmapLoader, Loader, TextureLoader

### Community 92 - "createWasm"
Cohesion: 0.20
Nodes (12): addOnInit(), addRunDependency(), createWasm(), receiveInstance(), receiveInstantiationResult(), findWasmBinary(), getWasmImports(), locateFile() (+4 more)

### Community 93 - "zip"
Cohesion: 0.27
Nodes (6): deflateSync(), EncodeUTF8(), strFromU8(), strToU8(), zip, zipSync()

### Community 94 - "banc-pilote-3d.mjs"
Cohesion: 0.04
Nodes (24): addEventListener(), arbre, compacter(), compte, coupe, declare, desc3, deux (+16 more)

### Community 96 - "06-topologie.js"
Cohesion: 0.10
Nodes (52): aplatir(), arcEntre(), AXES_MONDE, constructionAngle(), constructionAretePlan(), constructionPlans(), coordonnees(), COS_ALIGNE_MONDE (+44 more)

### Community 97 - "banc-conception.mjs"
Cohesion: 0.03
Nodes (69): CONSTANTES, evaluer(), atome(), produit(), puissance(), somme(), unaire(), evaluerParametres() (+61 more)

### Community 98 - ".get"
Cohesion: 0.04
Nodes (59): activateDefaultVariation(), addGlyphNamesAll(), applyPaintType(), applyTupleVariationStore(), arabicSentenceEndCheck(), arabicSentenceStartCheck(), arabicWordEndCheck(), arabicWordStartCheck() (+51 more)

### Community 99 - "Path"
Cohesion: 0.10
Nodes (5): Path, Shape, ShapePath, getInteriorPoint(), pointInPolygon()

### Community 100 - ".lineTo"
Cohesion: 0.05
Nodes (52): x(), y(), bezierCurveTo(), close(), closeWithMirror(), _convertFromUV(), convertSvgEllipseParams(), _convertToUV() (+44 more)

### Community 101 - "parseUniform"
Cohesion: 0.17
Nodes (7): addUniform(), getPureArraySetter(), getSingularSetter(), parseUniform(), PureArrayUniform, SingleUniform, StructuredUniform

### Community 102 - "deflate"
Cohesion: 0.22
Nodes (4): AsyncDeflate(), AsyncZipDeflate(), deflate, ZipDeflate()

### Community 103 - ".parse"
Cohesion: 0.22
Nodes (3): STLLoader, isBinary(), matchDataViewAt()

### Community 105 - "c3-operations.js"
Cohesion: 0.06
Nodes (52): evaluateur(), axePerpendiculaire(), cheminsEnPolylignes(), vec, versMonde(), appliquer(), AXES, construire() (+44 more)

### Community 106 - "delete"
Cohesion: 0.05
Nodes (60): downcast(), makeCaster(), topologyKind(), _adaptSurface(), asShape3D(), asTuple(), baseFace(), buildWire() (+52 more)

### Community 107 - ".copy"
Cohesion: 0.04
Nodes (9): handleTriangle(), handleVertex(), checkGeometryIntersection(), Line3, Plane, Ray, SphericalHarmonics3, transformVertex() (+1 more)

### Community 110 - "EditeurEsquisse"
Cohesion: 0.11
Nodes (3): EditeurEsquisse, estNombre(), fmt()

### Community 113 - "02-import.js"
Cohesion: 0.13
Nodes (27): ANNEXES, appliquerCouleursFaces(), construireNoeud(), creerGeometrie(), creerMaillage(), estAnnexe(), extension(), fabriqueMateriaux() (+19 more)

### Community 114 - ".mmap"
Cohesion: 0.31
Nodes (7): createLazyFile(), stream_ops, writeChunks(), get_char(), mmap(), position(), read()

### Community 117 - "c6-conception.js"
Cohesion: 0.07
Nodes (48): axeConstruction(), lireSvg(), planConstruction(), repere(), CHAMPS, chargerReglages(), CIBLE, CORPS (+40 more)

### Community 118 - "Pilote"
Cohesion: 0.14
Nodes (4): _pieces(), Pilote, Refus, _texte()

### Community 119 - "CompressedArrayTexture"
Cohesion: 0.22
Nodes (3): CompressedArrayTexture, CompressedCubeTexture, CompressedTexture

### Community 120 - "find"
Cohesion: 0.05
Nodes (52): adaptor(), approximate(), approximateAsSvgCompatibleCurve(), approximateForSVG(), blueprintsIntersectionSegments(), booleanOperation(), chamfer2D(), chamferCurves() (+44 more)

### Community 121 - "11-projets.js"
Cohesion: 0.31
Nodes (12): sanitiserNomFichier(), brancherProjets(), compagnons(), jour(), lireFichiersProjets(), liste(), nomRangeStep(), ouvrir() (+4 more)

### Community 122 - "abort"
Cohesion: 0.25
Nodes (8): abort(), assert(), getBinaryPromise(), getBinarySync(), instantiateArrayBuffer(), instantiateAsync(), lookup_name(), ___syscall_unlinkat()

### Community 123 - "Camera"
Cohesion: 0.15
Nodes (3): Camera, DirectionalLightShadow, OrthographicCamera

### Community 124 - "get"
Cohesion: 0.11
Nodes (45): WebGLCapabilities(), getMaxAnisotropy(), textureFormatReadable(), textureTypeReadable(), WebGLGeometries(), get(), getWireframeAttribute(), onGeometryDispose() (+37 more)

### Community 125 - "Table"
Cohesion: 0.06
Nodes (47): average(), ClassDef(), computeCheckSum(), Coverage(), encodeString(), FeatureList(), fontToSfntTable(), getUnicodeRange() (+39 more)

### Community 126 - "À faire — fonctionnalités et bugs"
Cohesion: 0.50
Nodes (3): Bugs, Fonctionnalités, À faire — fonctionnalités et bugs

### Community 128 - "c2-esquisse.js"
Cohesion: 0.13
Nodes (41): aire(), ajouterPrimitives(), angle(), balayage(), cercle3Points(), controlesSpline(), COTES, courbe() (+33 more)

### Community 129 - "ContextParams"
Cohesion: 0.08
Nodes (30): arabicPresentationForms(), arabicRequiredLigatures(), ccmpReplacementLigatures(), chainingSubstitutionFormat3(), ContextParams(), contextSubstitutionFormat1(), contextSubstitutionFormat3(), decompositionSubstitutionFormat1() (+22 more)

### Community 131 - "postRun"
Cohesion: 0.29
Nodes (7): addOnPostRun(), addOnPreRun(), initRuntime(), postRun(), preRun(), run(), doRun()

### Community 133 - "GLTFExporter.js"
Cohesion: 0.13
Nodes (11): DEFAULT_SPECULAR_COLOR, getMinMax(), getPaddedArrayBuffer(), getPaddedBufferSize(), getToBlobPromise(), GLTFLightExtension, KHR_mesh_quantization_ExtraAttrTypes, PATH_PROPERTIES (+3 more)

### Community 134 - "gzip"
Cohesion: 0.18
Nodes (6): AsyncGzip(), AsyncZlib(), gzip, gzipSync(), zlib, zlibSync()

### Community 136 - "WebXRManager"
Cohesion: 0.08
Nodes (8): PlaneGeometry, WebGLAnimation(), onAnimationFrame(), onAnimationFrame(), WebXRManager, setProjectionFromUnion(), updateCamera(), updateUserCamera()

### Community 138 - "parseCFFTable"
Cohesion: 0.07
Nodes (34): addGlyphNames(), addGlyphNamesToUnicodeMap(), calcCFFSubroutineBias(), CffEncoding(), cffGlyphLoader(), CmapEncoding(), edgeToCurveOnPlane(), entriesToObject() (+26 more)

### Community 142 - "12-collisions.js"
Cohesion: 0.17
Nodes (16): boiteMonde(), chercherCollisions(), contenue(), croiser(), dansZone(), distances(), longueur(), scal() (+8 more)

### Community 143 - "flatten"
Cohesion: 0.29
Nodes (7): flatten(), setValueM2Array(), setValueM3Array(), setValueM4Array(), setValueV2fArray(), setValueV3fArray(), setValueV4fArray()

### Community 144 - "Font"
Cohesion: 0.10
Nodes (3): Bidi(), createDefaultNamesInfo(), Font()

### Community 147 - "Module"
Cohesion: 0.11
Nodes (24): Module(), Ac(), Ba(), Ca(), Cb(), Db(), eb(), Fb() (+16 more)

### Community 149 - "Tokenizer"
Cohesion: 0.14
Nodes (5): ContextChecker(), ContextRange(), Event(), initializeCoreEvents(), Tokenizer()

### Community 152 - "ouvrir.py"
Cohesion: 0.13
Nodes (12): masquer(), associer(), attendre(), copier(), demarrer(), dire(), lire(), main() (+4 more)

### Community 153 - "pilote.py"
Cohesion: 0.10
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

### Community 162 - ".applyMatrix4"
Cohesion: 0.10
Nodes (3): CubeCamera, HemisphereLightHelper, PlaneHelper

### Community 163 - "Module"
Cohesion: 0.14
Nodes (16): make_gcs_wrapper(), Module(), $a(), b(), c(), d(), Fa(), N() (+8 more)

### Community 164 - "a"
Cohesion: 0.16
Nodes (18): g(), x(), $a(), ab(), b(), c(), d(), I (+10 more)

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

### Community 173 - "extend"
Cohesion: 0.22
Nodes (19): add(), bgraToRaw(), cpal(), deleteColor(), ensureCPAL(), extend(), fillPalette(), formatColor() (+11 more)

### Community 174 - "c7-frise.js"
Cohesion: 0.20
Nodes (9): TYPES, creerDossier(), dependances(), deplacementRefuse(), deplacer(), Frise, normaliserDossiers(), ordre() (+1 more)

### Community 178 - "banc-conception-page.mjs"
Cohesion: 0.13
Nodes (10): attendreHttp(), attentes, cdp(), erreurs, page(), pause(), profil, projets (+2 more)

### Community 183 - "banc-conception-perf.mjs"
Cohesion: 0.13
Nodes (12): cache, d, d2, debut, doc(), erreurs, finMo, lignes (+4 more)

### Community 188 - "Substitution"
Cohesion: 0.26
Nodes (4): arraysEqual(), binSearch(), getSubstFormat(), Substitution()

### Community 203 - "AnimationUtils"
Cohesion: 0.20
Nodes (4): AnimationUtils, getTrackTypeForValueTypeName(), parseKeyframeTrack(), scaleTangentTimes()

### Community 212 - "BezierInterpolant"
Cohesion: 0.50
Nodes (3): BezierInterpolant, cubicBezierSlope(), solveBezierParameter()

## Knowledge Gaps
- **20 isolated node(s):** `RFC-1951`, `RFC-3987`, `FlateErrorCode`, `OBJ + MTL : réécriture des chemins de matériaux`, `Unités ramenées au millimètre` (+15 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1991 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **94 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `a()` connect `a` to `.copy`, `banc-conception.mjs`, `Module`, `Module`?**
  _High betweenness centrality (0.229) - this node is a cross-community bridge._
- **Are the 6 inferred relationships involving `get()` (e.g. with `WebGLAttributes()` and `WebGLEnvironments()`) actually correct?**
  _`get()` has 6 INFERRED edges - model-reasoned connections that need verification._
- **What connects `RFC-1951`, `RFC-3987`, `FlateErrorCode` to the rest of the system?**
  _20 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `three.core.js` be split into smaller, more focused modules?**
  _Cohesion score 0.007633587786259542 - nodes in this community are weakly interconnected._
- **Why does `Vector2` connect `Vector2` to `three.core.js`, `three.module.js`, `.push`, `BufferAttribute`, `update`, `WebXRManager`, `.render`, `Material`, `.constructor`, `Vector3`, `.parseObject`, `Color`, `LightShadow`, `Texture`, `CubicBezierCurve`, `QuadraticBezierCurve`, `MeshLambertMaterial`, `MeshPhongMaterial`, `MeshPhysicalMaterial`, `Path`, `delete`, `.copy`, `get`, `SplineCurve`?**
  _High betweenness centrality (0.206) - this node is a cross-community bridge._
- **Should `three.module.js` be split into smaller, more focused modules?**
  _Cohesion score 0.007722007722007722 - nodes in this community are weakly interconnected._
- **Why does `revolve()` connect `delete` to `replicad.js`?**
  _High betweenness centrality (0.170) - this node is a cross-community bridge._