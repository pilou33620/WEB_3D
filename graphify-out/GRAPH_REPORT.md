# Graph Report - WEB_3D  (2026-11-05)

## Corpus Check
- 96 files · ~683,125 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 18 file(s) not represented in the graph (top: .css 4, .wasm 3, .step 2)

## Summary
- 6676 nodes · 15576 edges · 226 communities (143 shown, 83 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 412 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c4cfeb75`
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
- .clone
- mm
- .render
- Vector2
- 08-interface.js
- Mesure
- earcutLinked
- Mesh
- Interface
- Quaternion
- Vector4
- .setFromMatrixPosition
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
- WebGLMaterials
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
- MeshPhysicalMaterial
- getMaterialExtension
- makeCFFTable
- Interpolant
- creer
- Conception
- addShape
- PolyhedronGeometry
- .clamp
- has
- Gestionnaire
- Garde
- CubeVue
- OBJLoader.js
- Loader
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
- WebGLState
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
- OrthographicCamera
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
- WebGLOutput
- deflate
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
- Line
- harnais-page.mjs
- close
- gzip
- .bind
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
- ShapePath
- GLTFCubicSplineInterpolant
- GLTFLightsExtension
- flatten
- allocateTextureUnit
- FenetreResultats
- Fog
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

## Communities (226 total, 83 thin omitted)

### Community 0 - "three.core.js"
Cohesion: 0.01
Nodes (229): RFC-3987, _addedEvent, _alignedPosition, _axis, _baseVector, _batchIntersects, _boneMatrix, _box (+221 more)

### Community 1 - "three.module.js"
Cohesion: 0.01
Nodes (37): arrayCacheF32, arrayCacheI32, _clearColor, _cubeDirections, _cubeUps, DATA, _direction, empty3dTexture (+29 more)

### Community 3 - ".push"
Cohesion: 0.03
Nodes (42): arrayNeedsUint32(), AxesHelper, Box3Helper, buildPlane(), BoxHelper, BufferGeometry, CameraHelper, addLine() (+34 more)

### Community 4 - "replicad.js"
Cohesion: 0.01
Nodes (104): deserializeTopoShape(), serializeShape(), triangulateFace(), activateDefaultVariation(), applyArabicRequireLigatures(), applyLatinLigatures(), applyThaiFeatures(), atDistance() (+96 more)

### Community 5 - "get"
Cohesion: 0.10
Nodes (61): createElementNS(), error(), remove(), getReadableState(), get(), activeTexture(), bindFramebuffer(), bindTexture() (+53 more)

### Community 6 - "BufferAttribute"
Cohesion: 0.03
Nodes (16): BufferAttribute, convertBufferAttribute(), copyAttributeData(), createColorManagement(), DataUtils, denormalize(), Float16BufferAttribute, Int16BufferAttribute (+8 more)

### Community 7 - "update"
Cohesion: 0.06
Nodes (51): object(), WebGLAttributes(), createBuffer(), get(), remove(), update(), updateBuffer(), WebGLBufferRenderer() (+43 more)

### Community 8 - ".parse"
Cohesion: 0.11
Nodes (37): analyzeObject(), applyExtensions(), build(), buildBasematerial(), buildBasematerialsMeshes(), buildComposite(), buildDefaultMesh(), buildGroup() (+29 more)

### Community 9 - "WebGLRenderer"
Cohesion: 0.05
Nodes (13): WebGLCubeRenderTarget, WebGLRenderer, renderObject(), renderObjects(), renderTransmissionPass(), WebXRManager, onAnimationFrame(), onInputSourcesChange() (+5 more)

### Community 11 - ".clone"
Cohesion: 0.04
Nodes (10): Box2, checkIntersection(), checkIntersection$1(), Frustum, InstancedMesh, Line3, getInteriorPoint(), pointInPolygon() (+2 more)

### Community 12 - "mm"
Cohesion: 0.16
Nodes (31): arcEntre(), constructionAngle(), constructionPlans(), coordonnees(), cote(), degres(), diam(), dimCercle() (+23 more)

### Community 13 - ".render"
Cohesion: 0.08
Nodes (33): ExternalTexture, shadowCastingAndTexturingLightsFirst(), ShadowUniformsCache(), UniformsCache(), WebGLClipping(), projectPlanes(), resetGlobalState(), WebGLLights() (+25 more)

### Community 15 - "08-interface.js"
Cohesion: 0.07
Nodes (43): abonnes, actionPourGeste(), ACTIONS, BOUTONS, chargerPrefs(), EMPLACEMENTS, gestesActifs(), nomBouton() (+35 more)

### Community 17 - "earcutLinked"
Cohesion: 0.09
Nodes (34): addContour(), compareXYSlope(), createNode(), cureLocalIntersections(), earcut(), earcutLinked(), eliminateHole(), eliminateHoles() (+26 more)

### Community 18 - "Mesh"
Cohesion: 0.06
Nodes (6): Camera, FrustumArray, Mesh, SkinnedMesh, SpotLightHelper, Sprite

### Community 19 - "Interface"
Cohesion: 0.14
Nodes (4): prefsModifiees(), reinitialiserPrefs(), calculerAretes(), Interface

### Community 22 - ".setFromMatrixPosition"
Cohesion: 0.07
Nodes (6): ascSort(), CubeCamera, LOD, Matrix2, Raycaster, UniformsGroup

### Community 23 - ".constructor"
Cohesion: 0.06
Nodes (44): BoxGeometry, createCanvasElement(), log(), WebGLAnimation(), onAnimationFrame(), dispose(), WebGLEnvironments(), dispose() (+36 more)

### Community 24 - "Vector3"
Cohesion: 0.04
Nodes (12): applyRadius(), azimuth(), correctSeam(), correctUV(), correctUVs(), generateUVs(), getVertexByIndex(), inclination() (+4 more)

### Community 25 - ".load"
Cohesion: 0.15
Nodes (10): handleError(), loadTexture(), loadTexture(), FileLoader, readData(), HttpError, onImageError(), onImageLoad() (+2 more)

### Community 26 - "PMREMGenerator"
Cohesion: 0.18
Nodes (8): ShaderMaterial, _getBlurShader(), _getCommonVertexShader(), _getCubemapMaterial(), _getEquirectMaterial(), _getGGXShader(), PMREMGenerator, _setViewport()

### Community 29 - "Matrix4"
Cohesion: 0.04
Nodes (4): Bone, HemisphereLightHelper, Matrix4, Skeleton

### Community 30 - "LoadingManager"
Cohesion: 0.08
Nodes (7): AudioContext, AudioListener, ImageUtils, intersect(), LoadingManager, deserializeImage(), SRGBToLinear()

### Community 31 - "ObjectLoader"
Cohesion: 0.10
Nodes (7): CubeTexture, DataTexture, ImageLoader, MaterialLoader, ObjectLoader, deserializeImage(), getDFGLUT()

### Community 32 - "Vue3D"
Cohesion: 0.08
Nodes (5): Vue3D, demarrer(), InterfaceConception, traitEpais(), appliquerAnalyse()

### Community 33 - "Light"
Cohesion: 0.06
Nodes (8): AmbientLight, HemisphereLight, Light, LightProbe, PointLight, PointLightShadow, RectAreaLight, SpotLight

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
Nodes (97): asDir(), asPnt(), bounds(), _calcTransforms(), center(), chamferShape(), clone(), constructor() (+89 more)

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
Cohesion: 0.12
Nodes (3): DirectionalLight, DirectionalLightShadow, LightShadow

### Community 49 - "travailleur-occt.js"
Cohesion: 0.06
Nodes (26): Workflow CI bancs d'essai, Dialogues : aide, préférences, projets, export de pièce, Import map (three), index.html structure de la page, Barre d'outils (ouvrir, mesure, coupe, collisions, déplacer, export), Banc des exemples (test/banc-exemples.mjs), Banc du serveur (test/banc-serveur.py), Fichiers d'exemples (as1, essai-mesure.obj...) (+18 more)

### Community 51 - ".dispatchEvent"
Cohesion: 0.11
Nodes (3): Group, Scene, WebXRController

### Community 52 - "WebGLMaterials"
Cohesion: 0.12
Nodes (23): getUnlitUniformColorSpace(), PlaneGeometry, WebGLBackground(), addToRenderList(), getBackground(), render(), setClear(), WebGLMaterials() (+15 more)

### Community 53 - "appairage.py"
Cohesion: 0.09
Nodes (19): _a_refaire(), appairer(), _ca_a_refaire(), _cnf(), contexte_tls(), dossier_tls(), empreinte_ca(), en_https() (+11 more)

### Community 54 - "RenderTarget"
Cohesion: 0.20
Nodes (4): Data3DTexture, RenderTarget, RenderTarget3D, WebGL3DRenderTarget

### Community 55 - "KeyframeTrack"
Cohesion: 0.06
Nodes (13): AnimationClip, AnimationUtils, BooleanKeyframeTrack, ColorKeyframeTrack, getTrackTypeForValueTypeName(), KeyframeTrack, NumberKeyframeTrack, parseKeyframeTrack() (+5 more)

### Community 56 - "BatchedMesh"
Cohesion: 0.05
Nodes (7): ascIdSort(), BatchedMesh, CatmullRomCurve3, copyArrayContents(), flattenJSON(), PlaneHelper, SplineCurve

### Community 58 - "Euler"
Cohesion: 0.13
Nodes (3): Euler, onQuaternionChange(), onRotationChange()

### Community 59 - "WebGLBindingStates"
Cohesion: 0.14
Nodes (24): WebGLBindingStates(), bindVertexArrayObject(), createBindingState(), createVertexArrayObject(), deleteVertexArrayObject(), disableUnusedAttributes(), dispose(), enableAttribute() (+16 more)

### Community 60 - "GLTFWriter"
Cohesion: 0.23
Nodes (4): equalArray(), getMinMax(), GLTFWriter, isIdentityMatrix()

### Community 61 - ".push"
Cohesion: 0.03
Nodes (116): ABS(), addSegment(), addStringToPool(), addTerminatorSegment(), ALIGNRP(), allPairs(), and(), blobSTL() (+108 more)

### Community 62 - "warn"
Cohesion: 0.07
Nodes (10): Audio, enhanceLogMessage(), FogExp2, LineLoop, getGeometry(), getMaterial(), getTexture(), parseConstant() (+2 more)

### Community 63 - "Texture"
Cohesion: 0.06
Nodes (8): CanvasTexture, CubeDepthTexture, DepthTexture, FramebufferTexture, HTMLTexture, serializeImage(), Texture, TextureSource

### Community 64 - "MaterialCreator"
Cohesion: 0.16
Nodes (4): MaterialCreator, resolveURL(), setMapForType(), MTLLoader

### Community 65 - "InterleavedBuffer"
Cohesion: 0.11
Nodes (6): getArrayBuffer(), getInterleavedBuffer(), generateUUID(), getTypedArray(), InstancedBufferGeometry, InterleavedBuffer

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

### Community 73 - "Curve"
Cohesion: 0.09
Nodes (3): Curve, LineCurve, LineCurve3

### Community 74 - "Parser"
Cohesion: 0.06
Nodes (53): argument(), ELSE(), fail(), getEncoding(), getFixed(), getLanguageCode(), getLong(), getNameByID() (+45 more)

### Community 76 - "getMaterialExtension"
Cohesion: 0.05
Nodes (14): getMaterialExtension(), GLTFLoader, GLTFMaterialsAnisotropyExtension, GLTFMaterialsBumpExtension, GLTFMaterialsClearcoatExtension, GLTFMaterialsDispersionExtension, GLTFMaterialsEmissiveStrengthExtension, GLTFMaterialsIorExtension (+6 more)

### Community 77 - "makeCFFTable"
Cohesion: 0.11
Nodes (20): applyFilter(), atAngleWith(), either(), encodeString(), equals(), inDirection(), inPlane(), makeCFFTable() (+12 more)

### Community 78 - "Interpolant"
Cohesion: 0.13
Nodes (7): BezierInterpolant, cubicBezierSlope(), CubicInterpolant, DiscreteInterpolant, Interpolant, LinearInterpolant, solveBezierParameter()

### Community 79 - "creer"
Cohesion: 0.08
Nodes (58): creer(), afficher(), ajouter(), annoncer(), annuler(), appliquer(), base64(), battre() (+50 more)

### Community 80 - "Conception"
Cohesion: 0.07
Nodes (5): lireParametresCsv(), axesConstruits(), Conception, estNombre(), verifierPiece()

### Community 81 - "addShape"
Cohesion: 0.08
Nodes (13): CurvePath, addShape(), addUV(), addVertex(), buildLidFaces(), buildSideFaces(), f3(), f4() (+5 more)

### Community 82 - "PolyhedronGeometry"
Cohesion: 0.13
Nodes (5): DodecahedronGeometry, IcosahedronGeometry, OctahedronGeometry, PolyhedronGeometry, TetrahedronGeometry

### Community 84 - "has"
Cohesion: 0.17
Nodes (11): isPackedRGFormat(), WebGLCapabilities(), getMaxAnisotropy(), getMaxPrecision(), textureFormatReadable(), textureTypeReadable(), getChannel(), getParameters() (+3 more)

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
Cohesion: 0.08
Nodes (9): AnimationLoader, AudioLoader, BufferGeometryLoader, CompressedTextureLoader, CubeTextureLoader, DataTextureLoader, ImageBitmapLoader, Loader (+1 more)

### Community 90 - "GLTFLoader.js"
Cohesion: 0.07
Nodes (25): addMorphTargets(), addPrimitiveAttributes(), assignAttributeAccessor(), ALPHA_MODES, ATTRIBUTES, BINARY_EXTENSION_CHUNK_TYPES, createAttributesKey(), createPrimitiveKey() (+17 more)

### Community 91 - "PositionalAudio"
Cohesion: 0.10
Nodes (3): AudioAnalyser, Controls, PositionalAudio

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
Cohesion: 0.04
Nodes (58): addGlyphNamesAll(), applyPaintType(), applyTupleVariationStore(), arabicSentenceEndCheck(), arabicSentenceStartCheck(), arabicWordEndCheck(), arabicWordStartCheck(), avar() (+50 more)

### Community 100 - ".lineTo"
Cohesion: 0.05
Nodes (51): x(), y(), bezierCurveTo(), boundingBox(), close(), closeWithMirror(), _convertFromUV(), convertSvgEllipseParams() (+43 more)

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
Nodes (58): _adaptSurface(), asShape3D(), asTuple(), baseFace(), buildWire(), clone(), complexExtrude(), curvesAsEdgesOnFace() (+50 more)

### Community 107 - ".copy"
Cohesion: 0.04
Nodes (11): a(), handleTriangle(), handleVertex(), checkGeometryIntersection(), DirectionalLightHelper, isUniqueEdge(), Plane, Ray (+3 more)

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
Cohesion: 0.06
Nodes (50): adaptor(), approximate(), approximateAsSvgCompatibleCurve(), approximateForSVG(), blueprintsIntersectionSegments(), booleanOperation(), chamfer2D(), chamferCurves() (+42 more)

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
Nodes (36): average(), ClassDef(), computeCheckSum(), Coverage(), FeatureList(), fontToSfntTable(), getUnicodeRange(), log2() (+28 more)

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

### Community 130 - "WebGLState"
Cohesion: 0.23
Nodes (16): WebGLState(), ColorBuffer(), DepthBuffer(), disable(), enable(), reset(), scissor(), setBlending() (+8 more)

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
Cohesion: 0.11
Nodes (3): Bidi(), createDefaultNamesInfo(), Font()

### Community 145 - "EffectComposer.js"
Cohesion: 0.29
Nodes (3): ClearMaskPass, MaskPass, CopyShader

### Community 146 - "PerspectiveCamera"
Cohesion: 0.10
Nodes (4): ArrayCamera, Layers, PerspectiveCamera, StereoCamera

### Community 147 - "Module"
Cohesion: 0.10
Nodes (27): qb(), Module(), Ac(), Ba(), Ca(), Cb(), Db(), eb() (+19 more)

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

### Community 160 - "WebGLOutput"
Cohesion: 0.18
Nodes (4): RawShaderMaterial, WebGLRenderTarget, _createRenderTarget(), WebGLOutput()

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
Cohesion: 0.08
Nodes (7): ArrowHelper, ConeGeometry, CylinderGeometry, Line, MeshBasicMaterial, PointLightHelper, SphereGeometry

### Community 178 - "harnais-page.mjs"
Cohesion: 0.18
Nodes (5): attendreHttp(), ouvrirConception(), pause(), portLibre(), RACINE

### Community 180 - "gzip"
Cohesion: 0.18
Nodes (6): AsyncGzip(), AsyncZlib(), gzip, gzipSync(), zlib, zlibSync()

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

### Community 208 - "allocateTextureUnit"
Cohesion: 0.33
Nodes (5): setValueT1(), setValueT2DArray1(), setValueT3D1(), setValueT6(), allocateTextureUnit()

### Community 215 - "Material"
Cohesion: 0.06
Nodes (12): LineDashedMaterial, Material, MeshDepthMaterial, MeshDistanceMaterial, MeshLambertMaterial, MeshMatcapMaterial, MeshNormalMaterial, MeshPhongMaterial (+4 more)

## Knowledge Gaps
- **20 isolated node(s):** `RFC-1951`, `RFC-3987`, `FlateErrorCode`, `Modes d'affichage (arêtes, filaire, rayons X, grille, ortho)`, `Qualité du maillage (tolérances)` (+15 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 2078 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **83 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

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
- **Why does `Triangle` connect `.copy` to `three.core.js`, `addShape`, `Box3`, `three.module.js`?**
  _High betweenness centrality (0.156) - this node is a cross-community bridge._
- **Should `three.module.js` be split into smaller, more focused modules?**
  _Cohesion score 0.0078125 - nodes in this community are weakly interconnected._
- **Why does `Vector2` connect `Vector2` to `three.core.js`, `three.module.js`, `.push`, `get`, `BufferAttribute`, `update`, `WebGLRenderer`, `.clone`, `.render`, `.constructor`, `Vector3`, `ObjectLoader`, `Color`, `LightShadow`, `BatchedMesh`, `Texture`, `Curve`, `MeshPhysicalMaterial`, `addShape`, `.clamp`, `Material`, `CubicBezierCurve`, `Path`, `delete`, `.copy`, `QuadraticBezierCurve`?**
  _High betweenness centrality (0.139) - this node is a cross-community bridge._