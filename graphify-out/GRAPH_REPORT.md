# Graph Report - WEB_3D  (2026-11-04)

## Corpus Check
- 75 files · ~609,931 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 18 file(s) not represented in the graph (top: .css 4, .wasm 3, .step 2)

## Summary
- 6238 nodes · 14355 edges · 223 communities (139 shown, 84 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 392 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `97663f59`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- three.core.js
- three.module.js
- .push
- replicad.js
- error
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
- Material
- Interface
- Quaternion
- Vector4
- Mesh
- .constructor
- Vector3
- .load
- .setRenderTarget
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
- BatchedMesh
- CoupeManager
- casting-c4FpthHM.js
- 05-arbre.js
- .processTextureAsync
- AnimationMixer
- .parseObject
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
- .getAttribute
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
- WebGLEnvironments
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
- .clone
- PolyhedronGeometry
- Spherical
- push
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
- mm
- banc-conception.mjs
- Glyph
- Path
- parse
- PureArrayUniform
- deflate
- .parse
- PropertyMixer
- c3-operations.js
- delete
- .copy
- VideoTexture
- Appairage
- EditeurEsquisse
- c4-travailleur.js
- Timer
- 02-import.js
- .read
- AudioListener
- GLTFExporter.js
- c6-conception.js
- Pilote
- CompressedArrayTexture
- find
- 11-projets.js
- abort
- .invert
- get
- Table
- À faire — fonctionnalités et bugs
- Skeleton
- c2-esquisse.js
- .get
- Bidi
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
- .fromArray
- 12-collisions.js
- flatten
- Font
- AnimationClip
- PerspectiveCamera
- Module
- ThreeMFLoader
- Tokenizer
- .parseImages
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
- .bind
- .lookAt
- Module
- a
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
- EllipseCurve
- harnais-page.mjs
- close
- CubicPoly
- .lerp
- RoomEnvironment.js
- banc-conception-perf.mjs
- getKeyframeOrder
- probeAsync
- MultiDrawRenderList
- .subVectors
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
- WebGLLights
- Layers
- .push_constraint
- TextureUtils
- MeshDistanceMaterial
- MeshToonMaterial
- SingleUniform
- Fog
- FogExp2
- MeshLambertMaterial
- .setValues
- Int32BufferAttribute
- Int8BufferAttribute
- Uint16BufferAttribute
- Uint32BufferAttribute
- Uint8BufferAttribute
- Uint8ClampedBufferAttribute

## God Nodes (most connected - your core abstractions)
1. `GcsSystemMock` - 119 edges
2. `Conception` - 118 edges
3. `Vector3` - 113 edges
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

## Communities (223 total, 84 thin omitted)

### Community 0 - "three.core.js"
Cohesion: 0.01
Nodes (231): RFC-3987, _addedEvent, _alignedPosition, arrayNeedsUint32(), _axis, _baseVector, _batchIntersects, _boneMatrix (+223 more)

### Community 1 - "three.module.js"
Cohesion: 0.01
Nodes (37): arrayCacheF32, arrayCacheI32, _clearColor, _cubeDirections, _cubeUps, DATA, _direction, empty3dTexture (+29 more)

### Community 3 - ".push"
Cohesion: 0.04
Nodes (29): buildPlane(), BufferGeometry, addLine(), addPoint(), CapsuleGeometry, CircleGeometry, generateCap(), generateTorso() (+21 more)

### Community 4 - "replicad.js"
Cohesion: 0.01
Nodes (108): deserializeTopoShape(), serializeShape(), triangulateFace(), activateDefaultVariation(), applyArabicRequireLigatures(), applyLatinLigatures(), applyThaiFeatures(), atDistance() (+100 more)

### Community 5 - "error"
Cohesion: 0.11
Nodes (45): error(), setValueT1(), setValueT2DArray1(), setValueT3D1(), setValueT6(), WebGLState(), activeTexture(), bindTexture() (+37 more)

### Community 6 - "BufferAttribute"
Cohesion: 0.04
Nodes (8): BufferAttribute, convertBufferAttribute(), copyAttributeData(), DataUtils, denormalize(), Float16BufferAttribute, InterleavedBufferAttribute, sortedArray()

### Community 7 - "update"
Cohesion: 0.07
Nodes (40): WebGLAttributes(), createBuffer(), get(), remove(), update(), updateBuffer(), WebGLBufferRenderer(), render() (+32 more)

### Community 8 - ".parse"
Cohesion: 0.11
Nodes (37): analyzeObject(), applyExtensions(), build(), buildBasematerial(), buildBasematerialsMeshes(), buildComposite(), buildDefaultMesh(), buildGroup() (+29 more)

### Community 9 - "WebGLRenderer"
Cohesion: 0.06
Nodes (12): CubeDepthTexture, DepthTexture, WebGLRenderTarget, _createRenderTarget(), WebGLRenderer, renderTransmissionPass(), VSMPass(), ColorBuffer() (+4 more)

### Community 11 - "Sphere"
Cohesion: 0.08
Nodes (3): ascSort(), Box2, Sphere

### Community 12 - "06-topologie.js"
Cohesion: 0.08
Nodes (45): analyser(), aplatir(), areteSous(), AXES_MONDE, barycentre(), cerclePlan(), constructionAretePlan(), COS_ALIGNE_MONDE (+37 more)

### Community 13 - ".render"
Cohesion: 0.07
Nodes (23): PlaneGeometry, RawShaderMaterial, shadowCastingAndTexturingLightsFirst(), WebGLClipping(), projectPlanes(), resetGlobalState(), setup(), WebGLOutput() (+15 more)

### Community 15 - "08-interface.js"
Cohesion: 0.08
Nodes (34): abonnes, actionPourGeste(), ACTIONS, BOUTONS, chargerPrefs(), EMPLACEMENTS, enregistrerPrefs(), gestesActifs() (+26 more)

### Community 17 - ".equals"
Cohesion: 0.07
Nodes (34): addContour(), compareXYSlope(), createNode(), cureLocalIntersections(), earcut(), earcutLinked(), eliminateHole(), eliminateHoles() (+26 more)

### Community 18 - "Material"
Cohesion: 0.12
Nodes (4): Material, MeshNormalMaterial, PointsMaterial, ShadowMaterial

### Community 19 - "Interface"
Cohesion: 0.14
Nodes (3): prefsModifiees(), reinitialiserPrefs(), Interface

### Community 22 - "Mesh"
Cohesion: 0.06
Nodes (12): ArrowHelper, ConeGeometry, CylinderGeometry, DirectionalLightHelper, Line, LineLoop, Mesh, MeshBasicMaterial (+4 more)

### Community 23 - ".constructor"
Cohesion: 0.07
Nodes (40): object(), log(), dispose(), WebGLIndexedBufferRenderer(), render(), renderInstances(), renderMultiDraw(), setIndex() (+32 more)

### Community 24 - "Vector3"
Cohesion: 0.03
Nodes (13): applyRadius(), azimuth(), correctSeam(), correctUV(), correctUVs(), generateUVs(), getVertexByIndex(), inclination() (+5 more)

### Community 25 - ".load"
Cohesion: 0.25
Nodes (4): handleError(), loadTexture(), loadTexture(), FileLoader

### Community 26 - ".setRenderTarget"
Cohesion: 0.17
Nodes (9): ShaderMaterial, _getBlurShader(), _getCommonVertexShader(), _getCubemapMaterial(), _getEquirectMaterial(), _getGGXShader(), PMREMGenerator, _setViewport() (+1 more)

### Community 27 - "AnimationAction"
Cohesion: 0.08
Nodes (3): AnimationAction, handleVisibilityChange(), LinearInterpolant

### Community 30 - "LoadingManager"
Cohesion: 0.16
Nodes (6): readData(), HttpError, onImageError(), onImageLoad(), removeEventListeners(), LoadingManager

### Community 31 - "ObjectLoader"
Cohesion: 0.18
Nodes (3): MaterialLoader, ObjectLoader, parseConstant()

### Community 32 - "Vue3D"
Cohesion: 0.07
Nodes (8): Vue3D, nomHistorique(), axesConstruits(), demarrer(), estNombre(), InterfaceConception, traitEpais(), appliquerAnalyse()

### Community 33 - "Light"
Cohesion: 0.07
Nodes (7): AmbientLight, DirectionalLight, HemisphereLight, Light, LightProbe, RectAreaLight, SpotLight

### Community 35 - "Color"
Cohesion: 0.08
Nodes (6): Color, handleAlpha(), createColorManagement(), hue2rgb(), LinearToSRGB(), SRGBToLinear()

### Community 36 - "14-pilote-3d.js"
Cohesion: 0.15
Nodes (34): encombrement(), mesurerSolide(), faceSous(), maillageCollisions(), apresDeplacement(), perimerCaches(), arrondir(), AXES (+26 more)

### Community 37 - "07-mesure.js"
Cohesion: 0.09
Nodes (17): centreDeFace(), contourFace(), geometrieArete(), geometrieFace(), numeroArete(), PLAFOND_TRIANGLES, pointPolyProcheRayon(), pointSurArete() (+9 more)

### Community 38 - "BatchedMesh"
Cohesion: 0.07
Nodes (6): ascIdSort(), BatchedMesh, copyArrayContents(), flattenJSON(), InstancedBufferAttribute, InstancedMesh

### Community 40 - "casting-c4FpthHM.js"
Cohesion: 0.03
Nodes (90): asDir(), asPnt(), bounds(), _calcTransforms(), center(), chamferShape(), clone(), constructor() (+82 more)

### Community 41 - "05-arbre.js"
Cohesion: 0.15
Nodes (13): Arbre, couleurDe(), echapper(), estDansBranche(), fmt, formaterAire(), formaterNombre(), formaterVolume() (+5 more)

### Community 42 - ".processTextureAsync"
Cohesion: 0.09
Nodes (8): GLTFMaterialsAnisotropyExtension, GLTFMaterialsBumpExtension, GLTFMaterialsClearcoatExtension, GLTFMaterialsIridescenceExtension, GLTFMaterialsSheenExtension, GLTFMaterialsSpecularExtension, GLTFMaterialsTransmissionExtension, GLTFMaterialsVolumeExtension

### Community 44 - ".parseObject"
Cohesion: 0.07
Nodes (7): LOD, getGeometry(), getMaterial(), getTexture(), Raycaster, SphericalHarmonics3, Sprite

### Community 46 - "Matrix3"
Cohesion: 0.08
Nodes (5): Matrix3, Source, warnOnce(), WebGLExtensions(), getExtension()

### Community 47 - "WebGLProgram"
Cohesion: 0.08
Nodes (25): fetchAttributeLocations(), filterEmptyLine(), generateCubeUVSize(), generateEnvMapBlendingDefine(), generateEnvMapModeDefine(), generateEnvMapTypeDefine(), generatePrecision(), generateShadowMapTypeDefine() (+17 more)

### Community 48 - "LightShadow"
Cohesion: 0.09
Nodes (4): DirectionalLightShadow, LightShadow, OrthographicCamera, SpotLightShadow

### Community 49 - "travailleur-occt.js"
Cohesion: 0.06
Nodes (26): Workflow CI bancs d'essai, Dialogues : aide, préférences, projets, export de pièce, Import map (three), index.html structure de la page, Barre d'outils (ouvrir, mesure, coupe, collisions, déplacer, export), Banc des exemples (test/banc-exemples.mjs), Banc du serveur (test/banc-serveur.py), Fichiers d'exemples (as1, essai-mesure.obj...) (+18 more)

### Community 51 - ".dispatchEvent"
Cohesion: 0.11
Nodes (3): Group, Scene, WebXRController

### Community 52 - "WebGLMaterials"
Cohesion: 0.33
Nodes (14): WebGLMaterials(), refreshMaterialUniforms(), refreshTransformUniform(), refreshUniformsCommon(), refreshUniformsDash(), refreshUniformsDistance(), refreshUniformsLine(), refreshUniformsMatcap() (+6 more)

### Community 53 - "appairage.py"
Cohesion: 0.09
Nodes (19): _a_refaire(), appairer(), _ca_a_refaire(), _cnf(), contexte_tls(), dossier_tls(), empreinte_ca(), en_https() (+11 more)

### Community 54 - "RenderTarget"
Cohesion: 0.10
Nodes (7): Data3DTexture, DataArrayTexture, RenderTarget, RenderTarget3D, TextureSource, WebGL3DRenderTarget, WebGLArrayRenderTarget

### Community 55 - "KeyframeTrack"
Cohesion: 0.08
Nodes (11): BezierInterpolant, BooleanKeyframeTrack, ColorKeyframeTrack, cubicBezierSlope(), KeyframeTrack, QuaternionKeyframeTrack, scaleTangentTimes(), solveBezierParameter() (+3 more)

### Community 56 - ".getAttribute"
Cohesion: 0.06
Nodes (12): AxesHelper, Box3Helper, BoxHelper, CameraHelper, EdgesGeometry, GridHelper, HemisphereLightHelper, LineSegments (+4 more)

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
Nodes (114): ABS(), addSegment(), addStringToPool(), addTerminatorSegment(), ALIGNRP(), allPairs(), and(), blobSTL() (+106 more)

### Community 62 - "warn"
Cohesion: 0.10
Nodes (4): Audio, enhanceLogMessage(), setQuaternionFromProperEuler(), warn()

### Community 63 - "Texture"
Cohesion: 0.08
Nodes (5): CanvasTexture, ExternalTexture, FramebufferTexture, HTMLTexture, Texture

### Community 64 - "MaterialCreator"
Cohesion: 0.16
Nodes (4): MaterialCreator, resolveURL(), setMapForType(), MTLLoader

### Community 65 - "InterleavedBuffer"
Cohesion: 0.11
Nodes (5): getArrayBuffer(), getInterleavedBuffer(), generateUUID(), InstancedInterleavedBuffer, InterleavedBuffer

### Community 66 - "13-deplacement.js"
Cohesion: 0.31
Nodes (14): AXES, brancherDeplacement(), annulerContrainte(), apres(), basculer(), choisirFace(), construire(), demarrerContrainte() (+6 more)

### Community 67 - "web_3D.py"
Cohesion: 0.06
Nodes (14): adresses_poste(), hote_permis(), ip_tailscale(), adresse_locale(), attendre(), ipv4_libre(), lance_par_double_clic(), main() (+6 more)

### Community 68 - "BufferGeometryUtils.js"
Cohesion: 0.13
Nodes (9): unzipSync(), buildLatticeMesh(), computeMikkTSpaceTangents(), computeMorphedAttributes(), deepCloneAttribute(), deinterleaveAttribute(), deinterleaveGeometry(), mergeAttributes() (+1 more)

### Community 69 - "fflate.module.js"
Cohesion: 0.09
Nodes (17): RFC-1951, AsyncDecompress(), AsyncGunzip(), AsyncInflate(), AsyncUnzipInflate(), AsyncUnzlib(), DecodeUTF8(), decompressSync() (+9 more)

### Community 70 - "WebGLEnvironments"
Cohesion: 0.12
Nodes (21): BoxGeometry, cloneUniforms(), cloneUniformsGroups(), getUnlitUniformColorSpace(), isThreeObject(), mergeUniforms(), WebGLBackground(), addToRenderList() (+13 more)

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
Cohesion: 0.13
Nodes (4): GLTFExporter, GLTFLightExtension, GLTFMaterialsIorExtension, GLTFMeshGpuInstancing

### Community 76 - "QuadraticBezierCurve"
Cohesion: 0.12
Nodes (6): QuadraticBezier(), QuadraticBezierCurve, QuadraticBezierCurve3, QuadraticBezierP0(), QuadraticBezierP1(), QuadraticBezierP2()

### Community 77 - "DataTexture"
Cohesion: 0.29
Nodes (3): DataTexture, DataTextureLoader, getDFGLUT()

### Community 78 - "Interpolant"
Cohesion: 0.18
Nodes (4): CubicInterpolant, DiscreteInterpolant, Interpolant, QuaternionLinearInterpolant

### Community 79 - "creer"
Cohesion: 0.08
Nodes (58): creer(), afficher(), ajouter(), annoncer(), annuler(), appliquer(), base64(), battre() (+50 more)

### Community 80 - "Conception"
Cohesion: 0.07
Nodes (7): telechargerFichier(), nomProjet(), lireParametresCsv(), Conception, nouvelleOperation(), verifierPiece(), defautsAteliers()

### Community 81 - ".clone"
Cohesion: 0.06
Nodes (15): CatmullRom(), CatmullRomCurve3, Curve, addShape(), addUV(), addVertex(), buildLidFaces(), buildSideFaces() (+7 more)

### Community 82 - "PolyhedronGeometry"
Cohesion: 0.13
Nodes (5): DodecahedronGeometry, IcosahedronGeometry, OctahedronGeometry, PolyhedronGeometry, TetrahedronGeometry

### Community 84 - "push"
Cohesion: 0.08
Nodes (23): addUniform(), generateDefines(), isPackedRGFormat(), parseUniform(), StructuredUniform, getMaxPrecision(), WebGLPrograms(), acquireProgram() (+15 more)

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
Nodes (10): AnimationLoader, AudioLoader, BufferGeometryLoader, CompressedTextureLoader, CubeTexture, CubeTextureLoader, ImageBitmapLoader, ImageLoader (+2 more)

### Community 91 - "PositionalAudio"
Cohesion: 0.10
Nodes (3): AudioAnalyser, Controls, PositionalAudio

### Community 92 - "createWasm"
Cohesion: 0.20
Nodes (12): addOnInit(), addRunDependency(), createWasm(), receiveInstance(), receiveInstantiationResult(), findWasmBinary(), getWasmImports(), locateFile() (+4 more)

### Community 93 - "zip"
Cohesion: 0.27
Nodes (6): deflateSync(), EncodeUTF8(), strFromU8(), strToU8(), zip, zipSync()

### Community 94 - "banc-pilote-3d.mjs"
Cohesion: 0.04
Nodes (24): addEventListener(), arbre, compacter(), compte, coupe, declare, desc3, deux (+16 more)

### Community 96 - "mm"
Cohesion: 0.16
Nodes (30): arcEntre(), constructionAngle(), constructionPlans(), coordonnees(), cote(), degres(), diam(), dimCercle() (+22 more)

### Community 97 - "banc-conception.mjs"
Cohesion: 0.04
Nodes (51): nouvelleEsquisse(), anneau, boite20, buf, c, c1, cache, carre (+43 more)

### Community 98 - "Glyph"
Cohesion: 0.05
Nodes (31): applyTupleVariationStore(), CALL(), copyComponent(), copyPoint(), createSVGOutputOptions(), cvar(), getContours(), getCvarTransform() (+23 more)

### Community 99 - "Path"
Cohesion: 0.08
Nodes (6): CurvePath, Path, Shape, ShapePath, getInteriorPoint(), pointInPolygon()

### Community 100 - "parse"
Cohesion: 0.07
Nodes (43): x(), y(), applyPaintType(), bezierCurveTo(), bulgeArcTo(), close(), closeWithMirror(), _convertFromUV() (+35 more)

### Community 102 - "deflate"
Cohesion: 0.22
Nodes (4): AsyncDeflate(), AsyncZipDeflate(), deflate, ZipDeflate()

### Community 103 - ".parse"
Cohesion: 0.22
Nodes (3): STLLoader, isBinary(), matchDataViewAt()

### Community 105 - "c3-operations.js"
Cohesion: 0.05
Nodes (48): appliquerConfiguration(), CONSTANTES, evaluateur(), evaluer(), atome(), produit(), puissance(), somme() (+40 more)

### Community 106 - "delete"
Cohesion: 0.04
Nodes (69): downcast(), faceNormalAt(), faceUVBounds(), makeCaster(), pointOnFace(), topologyKind(), _adaptSurface(), applyFilter() (+61 more)

### Community 107 - ".copy"
Cohesion: 0.04
Nodes (13): handleTriangle(), handleVertex(), checkGeometryIntersection(), checkIntersection(), checkIntersection$1(), Frustum, FrustumArray, Line3 (+5 more)

### Community 110 - "EditeurEsquisse"
Cohesion: 0.10
Nodes (4): EditeurEsquisse, estNombre(), fmt(), simplify()

### Community 111 - "c4-travailleur.js"
Cohesion: 0.16
Nodes (17): axePerpendiculaire(), cheminsEnPolylignes(), messageErreur(), ecrireDxf(), cache, cachePlat, developpe(), file (+9 more)

### Community 112 - "Timer"
Cohesion: 0.12
Nodes (4): AudioContext, ImageUtils, serializeImage(), Timer

### Community 113 - "02-import.js"
Cohesion: 0.13
Nodes (27): ANNEXES, appliquerCouleursFaces(), calculerAretes(), construireNoeud(), creerGeometrie(), creerMaillage(), estAnnexe(), extension() (+19 more)

### Community 114 - ".read"
Cohesion: 0.27
Nodes (8): createLazyFile(), stream_ops, writeChunks(), get_char(), mmap(), position(), read(), offset()

### Community 116 - "GLTFExporter.js"
Cohesion: 0.13
Nodes (8): DEFAULT_SPECULAR_COLOR, GLTFMaterialsDispersionExtension, GLTFMaterialsEmissiveStrengthExtension, GLTFMaterialsUnlitExtension, KHR_mesh_quantization_ExtraAttrTypes, PATH_PROPERTIES, THREE_TO_WEBGL, WEBGL_CONSTANTS

### Community 117 - "c6-conception.js"
Cohesion: 0.05
Nodes (58): avertir(), boite(), confirmer(), demander(), demanderTexte(), axeConstruction(), NOMS_CONTRAINTES, TYPES (+50 more)

### Community 118 - "Pilote"
Cohesion: 0.14
Nodes (4): _pieces(), Pilote, Refus, _texte()

### Community 119 - "CompressedArrayTexture"
Cohesion: 0.22
Nodes (3): CompressedArrayTexture, CompressedCubeTexture, CompressedTexture

### Community 120 - "find"
Cohesion: 0.06
Nodes (50): adaptor(), approximate(), approximateAsSvgCompatibleCurve(), approximateForSVG(), blueprintsIntersectionSegments(), booleanOperation(), chamfer2D(), chamferCurves() (+42 more)

### Community 121 - "11-projets.js"
Cohesion: 0.31
Nodes (12): sanitiserNomFichier(), brancherProjets(), compagnons(), jour(), lireFichiersProjets(), liste(), nomRangeStep(), ouvrir() (+4 more)

### Community 122 - "abort"
Cohesion: 0.25
Nodes (8): abort(), assert(), getBinaryPromise(), getBinarySync(), instantiateArrayBuffer(), instantiateAsync(), lookup_name(), ___syscall_unlinkat()

### Community 124 - "get"
Cohesion: 0.13
Nodes (42): createCanvasElement(), createElementNS(), WebGLCapabilities(), getMaxAnisotropy(), textureFormatReadable(), textureTypeReadable(), WebGLProperties(), get() (+34 more)

### Community 125 - "Table"
Cohesion: 0.06
Nodes (44): atAngleWith(), ClassDef(), Coverage(), encodeString(), equals(), FeatureList(), inDirection(), inPlane() (+36 more)

### Community 126 - "À faire — fonctionnalités et bugs"
Cohesion: 0.50
Nodes (3): Bugs, Fonctionnalités, À faire — fonctionnalités et bugs

### Community 128 - "c2-esquisse.js"
Cohesion: 0.10
Nodes (51): aire(), ajouterPrimitives(), angle(), balayage(), cercle3Points(), controlesSpline(), COTES, courbe() (+43 more)

### Community 129 - ".get"
Cohesion: 0.05
Nodes (50): arabicPresentationForms(), arabicRequiredLigatures(), arabicSentenceEndCheck(), arabicSentenceStartCheck(), arabicWordEndCheck(), arabicWordStartCheck(), avar(), ccmpReplacementLigatures() (+42 more)

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
Cohesion: 0.10
Nodes (7): WebGLAnimation(), onAnimationFrame(), onAnimationFrame(), WebXRManager, setProjectionFromUnion(), updateCamera(), updateUserCamera()

### Community 138 - "parseCFFTable"
Cohesion: 0.07
Nodes (34): addGlyphNames(), addGlyphNamesToUnicodeMap(), calcCFFSubroutineBias(), CffEncoding(), cffGlyphLoader(), CmapEncoding(), edgeToCurveOnPlane(), entriesToObject() (+26 more)

### Community 142 - "12-collisions.js"
Cohesion: 0.26
Nodes (14): boiteMonde(), chercherCollisions(), contenue(), croiser(), dansZone(), distances(), longueur(), scal() (+6 more)

### Community 143 - "flatten"
Cohesion: 0.29
Nodes (7): flatten(), setValueM2Array(), setValueM3Array(), setValueM4Array(), setValueV2fArray(), setValueV3fArray(), setValueV4fArray()

### Community 144 - "Font"
Cohesion: 0.07
Nodes (20): addGlyphNamesAll(), average(), buildPath(), computeCheckSum(), createDefaultNamesInfo(), DefaultEncoding(), defineDependentProperty(), Font() (+12 more)

### Community 145 - "AnimationClip"
Cohesion: 0.11
Nodes (5): AnimationClip, AnimationUtils, getTrackTypeForValueTypeName(), NumberKeyframeTrack, parseKeyframeTrack()

### Community 146 - "PerspectiveCamera"
Cohesion: 0.12
Nodes (4): ArrayCamera, PerspectiveCamera, PointLight, PointLightShadow

### Community 147 - "Module"
Cohesion: 0.10
Nodes (26): qb(), Module(), Aa(), Ac(), Ba(), Ca(), Cb(), Db() (+18 more)

### Community 149 - "Tokenizer"
Cohesion: 0.14
Nodes (5): ContextChecker(), ContextRange(), Event(), initializeCoreEvents(), Tokenizer()

### Community 150 - ".parseImages"
Cohesion: 0.29
Nodes (6): getTypedArray(), intersect(), LoaderUtils, deserializeImage(), loadImage(), deserializeImage()

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

### Community 163 - "Module"
Cohesion: 0.18
Nodes (14): make_gcs_wrapper(), Module(), $a(), b(), c(), d(), Fa(), N() (+6 more)

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

### Community 172 - "C"
Cohesion: 0.40
Nodes (3): C, CS, S

### Community 173 - "extend"
Cohesion: 0.22
Nodes (19): add(), bgraToRaw(), cpal(), deleteColor(), ensureCPAL(), extend(), fillPalette(), formatColor() (+11 more)

### Community 178 - "harnais-page.mjs"
Cohesion: 0.19
Nodes (5): attendreHttp(), ouvrirConception(), pause(), portLibre(), RACINE

### Community 183 - "banc-conception-perf.mjs"
Cohesion: 0.11
Nodes (12): cache, d, d2, debut, doc(), erreurs, finMo, lignes (+4 more)

### Community 187 - ".subVectors"
Cohesion: 0.07
Nodes (4): LineCurve, LineCurve3, satForAxes(), Triangle

### Community 188 - "Substitution"
Cohesion: 0.16
Nodes (6): arraysEqual(), binSearch(), boundingBox(), derive(), getSubstFormat(), Substitution()

### Community 203 - "WebGLLights"
Cohesion: 0.50
Nodes (4): ShadowUniformsCache(), UniformsCache(), WebGLLights(), setupView()

### Community 215 - ".setValues"
Cohesion: 0.11
Nodes (5): LineDashedMaterial, MeshDepthMaterial, MeshMatcapMaterial, MeshPhongMaterial, SpriteMaterial

## Knowledge Gaps
- **20 isolated node(s):** `RFC-1951`, `RFC-3987`, `FlateErrorCode`, `OBJ + MTL : réécriture des chemins de matériaux`, `Unités ramenées au millimètre` (+15 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1991 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **84 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `a()` connect `a` to `banc-conception.mjs`, `.subVectors`, `Module`, `Module`?**
  _High betweenness centrality (0.234) - this node is a cross-community bridge._
- **Are the 6 inferred relationships involving `get()` (e.g. with `WebGLAttributes()` and `WebGLEnvironments()`) actually correct?**
  _`get()` has 6 INFERRED edges - model-reasoned connections that need verification._
- **What connects `RFC-1951`, `RFC-3987`, `FlateErrorCode` to the rest of the system?**
  _20 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `three.core.js` be split into smaller, more focused modules?**
  _Cohesion score 0.007575542630160306 - nodes in this community are weakly interconnected._
- **Why does `Vector2` connect `Vector2` to `three.core.js`, `three.module.js`, `.push`, `BufferAttribute`, `WebXRManager`, `.fromArray`, `Material`, `.constructor`, `Vector3`, `ObjectLoader`, `.clampLength`, `LightShadow`, `Texture`, `CubicBezierCurve`, `WebGLLights`, `QuadraticBezierCurve`, `MeshToonMaterial`, `.clone`, `MeshLambertMaterial`, `.setValues`, `MeshPhysicalMaterial`, `Path`, `delete`, `.copy`, `get`?**
  _High betweenness centrality (0.179) - this node is a cross-community bridge._
- **Should `three.module.js` be split into smaller, more focused modules?**
  _Cohesion score 0.0078125 - nodes in this community are weakly interconnected._
- **Why does `revolve()` connect `delete` to `replicad.js`?**
  _High betweenness centrality (0.165) - this node is a cross-community bridge._