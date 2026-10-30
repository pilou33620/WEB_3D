# Graph Report - WEB_3D  (2026-10-30)

## Corpus Check
- 39 files · ~430,496 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 14 file(s) not represented in the graph (top: .css 3, .step 2, .obj 2)

## Summary
- 4351 nodes · 9615 edges · 204 communities (118 shown, 86 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 258 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e533a53d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- three.core.js
- three.module.js
- .push
- .subVectors
- get
- .normalize
- update
- .parse
- WebGLRenderer
- Object3D
- Sphere
- formeChaine
- push
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
- .render
- AnimationAction
- Box3
- Matrix4
- EventDispatcher
- .parseObject
- Vue3D
- Light
- PropertyBinding
- Color
- 14-pilote-3d.js
- 07-mesure.js
- BatchedMesh
- CoupeManager
- Ray
- 05-arbre.js
- .processTextureAsync
- AnimationMixer
- .copy
- BufferAttribute
- Matrix3
- WebGLProgram
- Frustum
- travailleur-occt.js
- Navigation
- .dispatchEvent
- WebGLMaterials
- appairage.py
- RenderTarget
- KeyframeTrack
- LineSegments
- WebGLState
- Euler
- WebGLBindingStates
- GLTFWriter
- .dispose
- Audio
- Texture
- MaterialCreator
- InterleavedBuffer
- brancherDeplacement
- web_3D.py
- BufferGeometryUtils.js
- fflate.module.js
- .getDataURL
- arraysEqual
- banc-exemples.mjs
- CubicBezierCurve
- .fromArray
- .constructor
- QuadraticBezierCurve
- DataTexture
- Interpolant
- creer
- GLTFExporter.js
- Curve
- PolyhedronGeometry
- .clamp
- has
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
- BufferGeometry
- 06-topologie.js
- addToRenderList
- Path
- .constructor
- parseUniform
- deflate
- .parse
- PropertyMixer
- Plane
- makeClipAdditive
- .multiplyScalar
- VideoTexture
- Appairage
- warn
- Line
- Timer
- 02-import.js
- .mmap
- AudioListener
- Controls
- index.html structure de la page
- Pilote
- CompressedArrayTexture
- TextureSource
- 11-projets.js
- abort
- OrthographicCamera
- .distanceTo
- À faire — fonctionnalités et bugs
- SplineCurve
- SkinnedMesh
- .constructor
- DataArrayTexture
- postRun
- .processImage
- .writeAsync
- gzip
- Clock
- WebXRManager
- Cylindrical
- Data3DTexture
- GLBufferAttribute
- RoomEnvironment.js
- 12-collisions.js
- flatten
- repereDePiece
- AnimationClip
- PerspectiveCamera
- .getAttribute
- ThreeMFLoader
- cloneUniforms
- H
- ouvrir.py
- pilote.py
- craftInvokerFunction
- getCallstack
- ___syscall_ioctl
- telephone.js
- StepExtractor
- addEventListener
- UniformsGroup
- CurvePath
- removeEventListener
- addShape
- .toShapes
- write
- registerType
- syncfs
- syscallGetVarargI
- .bind
- decompress
- ZipPassThrough
- FenetreResultats
- .toJSON
- Uniform
- _points
- EllipseCurve
- LineCurve
- close
- CubicPoly
- .lerp
- euclideanModulo
- getKeyframeOrder
- probeAsync
- MultiDrawRenderList
- LineCurve3
- compacter
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
- Fog
- FogExp2
- Sprite

## God Nodes (most connected - your core abstractions)
1. `Vector3` - 113 edges
2. `Vector2` - 90 edges
3. `get()` - 87 edges
4. `warn()` - 73 edges
5. `Object3D` - 72 edges
6. `BufferGeometry` - 71 edges
7. `Vector4` - 65 edges
8. `creer()` - 58 edges
9. `BufferAttribute` - 55 edges
10. `Mesure` - 53 edges

## Surprising Connections (you probably didn't know these)
- `LGPL-2.1 (occt-import-js)` --references--> `OpenCascade / occt-import-js (WebAssembly)`  [EXTRACTED]
  vendor/occt/license.occt-import-js.txt → README.md
- `LGPL-2.1 (OpenCascade)` --references--> `OpenCascade / occt-import-js (WebAssembly)`  [EXTRACTED]
  vendor/occt/license.occt.txt → README.md
- `Conformité LGPL-2.1 : wasm remplaçable, non modifié` --references--> `LGPL-2.1 (occt-import-js)`  [INFERRED]
  README.md → vendor/occt/license.occt-import-js.txt
- `construire()` --indirect_call--> `liste()`  [INFERRED]
  js/pilote.js → js/11-projets.js
- `update()` --calls--> `error()`  [EXTRACTED]
  vendor/three/three.module.js → vendor/three/three.core.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Chaîne de mesure** — js_06_topologie, js_07_mesure, readme_measure [INFERRED 0.85]
- **Chaîne de lecture STEP** — js_02_import, js_travailleur_occt, readme_opencascade [INFERRED 0.85]

## Communities (204 total, 86 thin omitted)

### Community 0 - "three.core.js"
Cohesion: 0.01
Nodes (227): RFC-3987, _addedEvent, _alignedPosition, arrayNeedsUint32(), _axis, _baseVector, _batchIntersects, _boneMatrix (+219 more)

### Community 1 - "three.module.js"
Cohesion: 0.01
Nodes (38): Compatibility, arrayCacheF32, arrayCacheI32, _clearColor, _cubeDirections, _cubeUps, DATA, _direction (+30 more)

### Community 3 - ".push"
Cohesion: 0.14
Nodes (6): buildPlane(), generateCap(), generateTorso(), Float32BufferAttribute, LineBasicMaterial, addShape()

### Community 4 - ".subVectors"
Cohesion: 0.11
Nodes (3): checkGeometryIntersection(), satForAxes(), Triangle

### Community 5 - "get"
Cohesion: 0.09
Nodes (64): error(), getByteLength(), getTextureTypeByteLength(), setValueT1(), setValueT2DArray1(), setValueT3D1(), setValueT6(), get() (+56 more)

### Community 6 - ".normalize"
Cohesion: 0.08
Nodes (5): copyAttributeData(), DataUtils, denormalize(), Float16BufferAttribute, InterleavedBufferAttribute

### Community 7 - "update"
Cohesion: 0.07
Nodes (44): WebGLAttributes(), createBuffer(), get(), remove(), update(), updateBuffer(), releaseStatesOfGeometry(), WebGLBufferRenderer() (+36 more)

### Community 8 - ".parse"
Cohesion: 0.11
Nodes (37): analyzeObject(), applyExtensions(), build(), buildBasematerial(), buildBasematerialsMeshes(), buildComposite(), buildDefaultMesh(), buildGroup() (+29 more)

### Community 9 - "WebGLRenderer"
Cohesion: 0.06
Nodes (12): CubeDepthTexture, DepthTexture, WebGLRenderTarget, _createRenderTarget(), WebGLRenderer, renderObject(), renderObjects(), renderTransmissionPass() (+4 more)

### Community 11 - "Sphere"
Cohesion: 0.07
Nodes (4): ascSort(), Box2, Raycaster, Sphere

### Community 12 - "formeChaine"
Cohesion: 0.39
Nodes (8): barycentre(), cerclePlan(), covariance(), formeChaine(), formeNappe(), proprer(), repere(), resoudre3()

### Community 13 - "push"
Cohesion: 0.10
Nodes (28): shadowCastingAndTexturingLightsFirst(), ShadowUniformsCache(), UniformsCache(), WebGLLights(), setup(), setupView(), WebGLPrograms(), acquireProgram() (+20 more)

### Community 15 - "08-interface.js"
Cohesion: 0.08
Nodes (33): abonnes, actionPourGeste(), ACTIONS, BOUTONS, chargerPrefs(), EMPLACEMENTS, enregistrerPrefs(), gestesActifs() (+25 more)

### Community 17 - ".equals"
Cohesion: 0.07
Nodes (34): addContour(), compareXYSlope(), createNode(), cureLocalIntersections(), earcut(), earcutLinked(), eliminateHole(), eliminateHoles() (+26 more)

### Community 18 - "Material"
Cohesion: 0.05
Nodes (12): LineDashedMaterial, Material, MeshDepthMaterial, MeshDistanceMaterial, MeshLambertMaterial, MeshMatcapMaterial, MeshNormalMaterial, MeshPhongMaterial (+4 more)

### Community 19 - "Interface"
Cohesion: 0.15
Nodes (4): prefsModifiees(), reinitialiserPrefs(), calculerAretes(), Interface

### Community 22 - "Mesh"
Cohesion: 0.09
Nodes (7): HemisphereLightHelper, Mesh, MeshBasicMaterial, PlaneGeometry, PointLightHelper, SphereGeometry, _createPlanes()

### Community 23 - ".constructor"
Cohesion: 0.10
Nodes (29): object(), createCanvasElement(), createElementNS(), WebGLIndexedBufferRenderer(), render(), renderInstances(), renderMultiDraw(), setIndex() (+21 more)

### Community 25 - ".load"
Cohesion: 0.21
Nodes (4): handleError(), loadTexture(), loadTexture(), FileLoader

### Community 26 - ".render"
Cohesion: 0.09
Nodes (16): RawShaderMaterial, ShaderMaterial, _getBlurShader(), _getCommonVertexShader(), _getCubemapMaterial(), _getEquirectMaterial(), _getGGXShader(), PMREMGenerator (+8 more)

### Community 29 - "Matrix4"
Cohesion: 0.05
Nodes (3): flattenJSON(), Matrix4, Skeleton

### Community 30 - "EventDispatcher"
Cohesion: 0.12
Nodes (7): EventDispatcher, readData(), HttpError, onImageError(), onImageLoad(), removeEventListeners(), LoadingManager

### Community 31 - ".parseObject"
Cohesion: 0.17
Nodes (3): LineLoop, MaterialLoader, ObjectLoader

### Community 33 - "Light"
Cohesion: 0.07
Nodes (7): AmbientLight, DirectionalLight, HemisphereLight, Light, LightProbe, RectAreaLight, SpotLight

### Community 35 - "Color"
Cohesion: 0.09
Nodes (4): Color, handleAlpha(), hue2rgb(), LinearToSRGB()

### Community 36 - "14-pilote-3d.js"
Cohesion: 0.14
Nodes (39): liberer(), sanitiserNomFichier(), maillageCollisions(), apresDeplacement(), AXES, contraindre(), perimerCaches(), pivoter() (+31 more)

### Community 37 - "07-mesure.js"
Cohesion: 0.09
Nodes (27): analyser(), areteSous(), centreDeFace(), contourFace(), echelleDe(), enchainer(), entiteArete(), entiteFace() (+19 more)

### Community 38 - "BatchedMesh"
Cohesion: 0.08
Nodes (4): ascIdSort(), BatchedMesh, InstancedBufferAttribute, TextureUtils

### Community 40 - "Ray"
Cohesion: 0.11
Nodes (3): checkIntersection$1(), FrustumArray, Ray

### Community 41 - "05-arbre.js"
Cohesion: 0.15
Nodes (13): Arbre, couleurDe(), echapper(), estDansBranche(), fmt, formaterAire(), formaterNombre(), formaterVolume() (+5 more)

### Community 42 - ".processTextureAsync"
Cohesion: 0.09
Nodes (8): GLTFMaterialsAnisotropyExtension, GLTFMaterialsBumpExtension, GLTFMaterialsClearcoatExtension, GLTFMaterialsIridescenceExtension, GLTFMaterialsSheenExtension, GLTFMaterialsSpecularExtension, GLTFMaterialsTransmissionExtension, GLTFMaterialsVolumeExtension

### Community 44 - ".copy"
Cohesion: 0.09
Nodes (5): Camera, checkIntersection(), createColorManagement(), testPoint(), transformVertex()

### Community 45 - "BufferAttribute"
Cohesion: 0.06
Nodes (8): BufferAttribute, Int16BufferAttribute, Int32BufferAttribute, Int8BufferAttribute, Uint16BufferAttribute, Uint32BufferAttribute, Uint8BufferAttribute, Uint8ClampedBufferAttribute

### Community 46 - "Matrix3"
Cohesion: 0.08
Nodes (5): Matrix3, Source, warnOnce(), WebGLExtensions(), getExtension()

### Community 47 - "WebGLProgram"
Cohesion: 0.08
Nodes (25): fetchAttributeLocations(), filterEmptyLine(), generateCubeUVSize(), generateDefines(), generateEnvMapBlendingDefine(), generateEnvMapModeDefine(), generateEnvMapTypeDefine(), generatePrecision() (+17 more)

### Community 49 - "travailleur-occt.js"
Cohesion: 0.11
Nodes (13): Workflow CI bancs d'essai, Banc des exemples (test/banc-exemples.mjs), Banc du serveur (test/banc-serveur.py), Fichiers d'exemples (as1, essai-mesure.obj...), OpenCascade / occt-import-js (WebAssembly), Appairage par code à 6 chiffres (appairage.py), Sécurité serveur : liste blanche, contrôle Host (DNS rebinding), Visionneuse 3D (WEB_3D) (+5 more)

### Community 51 - ".dispatchEvent"
Cohesion: 0.14
Nodes (3): Group, Scene, WebXRController

### Community 52 - "WebGLMaterials"
Cohesion: 0.33
Nodes (14): WebGLMaterials(), refreshMaterialUniforms(), refreshTransformUniform(), refreshUniformsCommon(), refreshUniformsDash(), refreshUniformsDistance(), refreshUniformsLine(), refreshUniformsMatcap() (+6 more)

### Community 53 - "appairage.py"
Cohesion: 0.07
Nodes (23): _a_refaire(), adresses_poste(), appairer(), C, _ca_a_refaire(), _cnf(), contexte_tls(), CS (+15 more)

### Community 55 - "KeyframeTrack"
Cohesion: 0.10
Nodes (8): BooleanKeyframeTrack, ColorKeyframeTrack, KeyframeTrack, QuaternionKeyframeTrack, scaleTangentTimes(), StringKeyframeTrack, subclip(), VectorKeyframeTrack

### Community 56 - "LineSegments"
Cohesion: 0.11
Nodes (8): AxesHelper, Box3Helper, BoxHelper, getBoneList(), GridHelper, LineSegments, PolarGridHelper, SkeletonHelper

### Community 57 - "WebGLState"
Cohesion: 0.19
Nodes (19): renderScene(), WebGLState(), ColorBuffer(), DepthBuffer(), disable(), enable(), reset(), scissor() (+11 more)

### Community 58 - "Euler"
Cohesion: 0.13
Nodes (3): Euler, onQuaternionChange(), onRotationChange()

### Community 59 - "WebGLBindingStates"
Cohesion: 0.17
Nodes (21): WebGLBindingStates(), bindVertexArrayObject(), createBindingState(), createVertexArrayObject(), deleteVertexArrayObject(), disableUnusedAttributes(), dispose(), enableAttribute() (+13 more)

### Community 60 - "GLTFWriter"
Cohesion: 0.23
Nodes (4): equalArray(), getMinMax(), GLTFWriter, isIdentityMatrix()

### Community 61 - ".dispose"
Cohesion: 0.11
Nodes (21): log(), dispose(), WebGLCubeRenderTarget, WebGLEnvironments(), dispose(), get(), getCube(), getPMREM() (+13 more)

### Community 63 - "Texture"
Cohesion: 0.07
Nodes (5): CanvasTexture, CubeTexture, FramebufferTexture, HTMLTexture, Texture

### Community 64 - "MaterialCreator"
Cohesion: 0.16
Nodes (4): MaterialCreator, resolveURL(), setMapForType(), MTLLoader

### Community 65 - "InterleavedBuffer"
Cohesion: 0.10
Nodes (5): getArrayBuffer(), getInterleavedBuffer(), generateUUID(), InstancedInterleavedBuffer, InterleavedBuffer

### Community 66 - "brancherDeplacement"
Cohesion: 0.44
Nodes (12): geometrieFace(), brancherDeplacement(), annulerContrainte(), apres(), basculer(), choisirFace(), construire(), demarrerContrainte() (+4 more)

### Community 67 - "web_3D.py"
Cohesion: 0.10
Nodes (11): adresse_locale(), attendre(), ipv4_libre(), lance_par_double_clic(), main(), ouvrir_serveur(), processus_de_la_console(), redemarrer_application() (+3 more)

### Community 68 - "BufferGeometryUtils.js"
Cohesion: 0.13
Nodes (9): unzipSync(), buildLatticeMesh(), computeMikkTSpaceTangents(), computeMorphedAttributes(), deepCloneAttribute(), deinterleaveAttribute(), deinterleaveGeometry(), mergeAttributes() (+1 more)

### Community 69 - "fflate.module.js"
Cohesion: 0.09
Nodes (17): RFC-1951, AsyncDecompress(), AsyncGunzip(), AsyncInflate(), AsyncUnzipInflate(), AsyncUnzlib(), DecodeUTF8(), decompressSync() (+9 more)

### Community 70 - ".getDataURL"
Cohesion: 0.18
Nodes (4): AudioContext, ImageUtils, serializeImage(), SRGBToLinear()

### Community 71 - "arraysEqual"
Cohesion: 0.21
Nodes (19): allocTexUnits(), arraysEqual(), copyArray(), setValueM2(), setValueM3(), setValueM4(), setValueT1Array(), setValueT2DArrayArray() (+11 more)

### Community 72 - "banc-exemples.mjs"
Cohesion: 0.11
Nodes (3): occtimportjs, RACINE, STEP

### Community 73 - "CubicBezierCurve"
Cohesion: 0.11
Nodes (7): CubicBezier(), CubicBezierCurve, CubicBezierCurve3, CubicBezierP0(), CubicBezierP1(), CubicBezierP2(), CubicBezierP3()

### Community 74 - ".fromArray"
Cohesion: 0.11
Nodes (3): CatmullRomCurve3, InstancedMesh, Matrix2

### Community 75 - ".constructor"
Cohesion: 0.13
Nodes (4): GLTFExporter, GLTFLightExtension, GLTFMaterialsIorExtension, GLTFMeshGpuInstancing

### Community 76 - "QuadraticBezierCurve"
Cohesion: 0.12
Nodes (6): QuadraticBezier(), QuadraticBezierCurve, QuadraticBezierCurve3, QuadraticBezierP0(), QuadraticBezierP1(), QuadraticBezierP2()

### Community 77 - "DataTexture"
Cohesion: 0.25
Nodes (3): DataTexture, DataTextureLoader, getDFGLUT()

### Community 78 - "Interpolant"
Cohesion: 0.11
Nodes (8): BezierInterpolant, cubicBezierSlope(), CubicInterpolant, DiscreteInterpolant, Interpolant, LinearInterpolant, QuaternionLinearInterpolant, solveBezierParameter()

### Community 79 - "creer"
Cohesion: 0.08
Nodes (58): creer(), afficher(), ajouter(), annoncer(), annuler(), appliquer(), base64(), battre() (+50 more)

### Community 80 - "GLTFExporter.js"
Cohesion: 0.13
Nodes (8): DEFAULT_SPECULAR_COLOR, GLTFMaterialsDispersionExtension, GLTFMaterialsEmissiveStrengthExtension, GLTFMaterialsUnlitExtension, KHR_mesh_quantization_ExtraAttrTypes, PATH_PROPERTIES, THREE_TO_WEBGL, WEBGL_CONSTANTS

### Community 82 - "PolyhedronGeometry"
Cohesion: 0.13
Nodes (5): DodecahedronGeometry, IcosahedronGeometry, OctahedronGeometry, PolyhedronGeometry, TetrahedronGeometry

### Community 84 - "has"
Cohesion: 0.14
Nodes (13): isPackedRGFormat(), WebGLCapabilities(), getMaxAnisotropy(), getMaxPrecision(), textureFormatReadable(), textureTypeReadable(), getChannel(), getParameters() (+5 more)

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
Cohesion: 0.08
Nodes (8): AnimationLoader, AudioLoader, BufferGeometryLoader, CompressedTextureLoader, CubeTextureLoader, ImageBitmapLoader, Loader, TextureLoader

### Community 92 - "createWasm"
Cohesion: 0.20
Nodes (12): addOnInit(), addRunDependency(), createWasm(), receiveInstance(), receiveInstantiationResult(), findWasmBinary(), getWasmImports(), locateFile() (+4 more)

### Community 93 - "zip"
Cohesion: 0.27
Nodes (6): deflateSync(), EncodeUTF8(), strFromU8(), strToU8(), zip, zipSync()

### Community 94 - "banc-pilote-3d.mjs"
Cohesion: 0.05
Nodes (19): arbre, compte, coupe, declare, desc3, deux, disponibles, ecritsLS (+11 more)

### Community 95 - "BufferGeometry"
Cohesion: 0.06
Nodes (9): BufferGeometry, CapsuleGeometry, CircleGeometry, InstancedBufferGeometry, LatheGeometry, RingGeometry, TorusGeometry, TorusKnotGeometry (+1 more)

### Community 96 - "06-topologie.js"
Cohesion: 0.11
Nodes (48): aplatir(), arcEntre(), AXES_MONDE, constructionAngle(), constructionAretePlan(), constructionPlans(), coordonnees(), COS_ALIGNE_MONDE (+40 more)

### Community 98 - "addToRenderList"
Cohesion: 0.29
Nodes (7): BoxGeometry, getUnlitUniformColorSpace(), WebGLBackground(), addToRenderList(), getBackground(), render(), setClear()

### Community 100 - ".constructor"
Cohesion: 0.30
Nodes (11): applyRadius(), azimuth(), correctSeam(), correctUV(), correctUVs(), generateUVs(), getVertexByIndex(), inclination() (+3 more)

### Community 101 - "parseUniform"
Cohesion: 0.17
Nodes (7): addUniform(), getPureArraySetter(), getSingularSetter(), parseUniform(), PureArrayUniform, SingleUniform, StructuredUniform

### Community 102 - "deflate"
Cohesion: 0.22
Nodes (4): AsyncDeflate(), AsyncZipDeflate(), deflate, ZipDeflate()

### Community 103 - ".parse"
Cohesion: 0.22
Nodes (3): STLLoader, isBinary(), matchDataViewAt()

### Community 107 - ".multiplyScalar"
Cohesion: 0.08
Nodes (5): handleTriangle(), handleVertex(), scalePt2(), Line3, SphericalHarmonics3

### Community 110 - "warn"
Cohesion: 0.17
Nodes (7): enhanceLogMessage(), getGeometry(), getMaterial(), getTexture(), parseConstant(), setQuaternionFromProperEuler(), warn()

### Community 111 - "Line"
Cohesion: 0.06
Nodes (10): ArrowHelper, convertBufferAttribute(), ConeGeometry, copyArrayContents(), CylinderGeometry, DirectionalLightHelper, Line, PlaneHelper (+2 more)

### Community 113 - "02-import.js"
Cohesion: 0.14
Nodes (26): ANNEXES, appliquerCouleursFaces(), construireNoeud(), creerGeometrie(), creerMaillage(), estAnnexe(), extension(), fabriqueMateriaux() (+18 more)

### Community 114 - ".mmap"
Cohesion: 0.31
Nodes (7): createLazyFile(), stream_ops, writeChunks(), get_char(), mmap(), position(), read()

### Community 117 - "index.html structure de la page"
Cohesion: 0.14
Nodes (13): Dialogues : aide, préférences, projets, export de pièce, Import map (three), index.html structure de la page, Barre d'outils (ouvrir, mesure, coupe, collisions, déplacer, export), Export PNG, glTF/GLB, STEP, fflate, Formats : STEP, IGES, BREP, 3MF, OBJ, STL, STPZ, Préréglages de souris (Onshape, SolidWorks, Fusion...) (+5 more)

### Community 118 - "Pilote"
Cohesion: 0.14
Nodes (4): _pieces(), Pilote, Refus, _texte()

### Community 119 - "CompressedArrayTexture"
Cohesion: 0.22
Nodes (3): CompressedArrayTexture, CompressedCubeTexture, CompressedTexture

### Community 120 - "TextureSource"
Cohesion: 0.16
Nodes (8): getTypedArray(), ImageLoader, intersect(), LoaderUtils, deserializeImage(), loadImage(), deserializeImage(), TextureSource

### Community 121 - "11-projets.js"
Cohesion: 0.38
Nodes (10): brancherProjets(), compagnons(), jour(), lireFichiersProjets(), liste(), nomProjet(), ouvrir(), ranger() (+2 more)

### Community 122 - "abort"
Cohesion: 0.25
Nodes (8): abort(), assert(), getBinaryPromise(), getBinarySync(), instantiateArrayBuffer(), instantiateAsync(), lookup_name(), ___syscall_unlinkat()

### Community 123 - "OrthographicCamera"
Cohesion: 0.15
Nodes (3): DirectionalLightShadow, OrthographicCamera, SpotLightShadow

### Community 126 - "À faire — fonctionnalités et bugs"
Cohesion: 0.50
Nodes (3): Bugs, Fonctionnalités, À faire — fonctionnalités et bugs

### Community 129 - ".constructor"
Cohesion: 0.31
Nodes (5): TubeGeometry, generateBufferData(), generateIndices(), generateSegment(), generateUVs()

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
Cohesion: 0.06
Nodes (10): ExternalTexture, WebGLAnimation(), onAnimationFrame(), onAnimationFrame(), WebXRDepthSensing, WebXRManager, onAnimationFrame(), setProjectionFromUnion() (+2 more)

### Community 142 - "12-collisions.js"
Cohesion: 0.26
Nodes (14): boiteMonde(), chercherCollisions(), contenue(), croiser(), dansZone(), distances(), longueur(), scal() (+6 more)

### Community 143 - "flatten"
Cohesion: 0.29
Nodes (7): flatten(), setValueM2Array(), setValueM3Array(), setValueM4Array(), setValueV2fArray(), setValueV3fArray(), setValueV4fArray()

### Community 144 - "repereDePiece"
Cohesion: 0.50
Nodes (4): directionsPlanes(), nommerAxes(), recaler(), repereDePiece()

### Community 145 - "AnimationClip"
Cohesion: 0.11
Nodes (5): AnimationClip, AnimationUtils, getTrackTypeForValueTypeName(), NumberKeyframeTrack, parseKeyframeTrack()

### Community 146 - "PerspectiveCamera"
Cohesion: 0.07
Nodes (6): ArrayCamera, Layers, PerspectiveCamera, PointLight, PointLightShadow, StereoCamera

### Community 147 - ".getAttribute"
Cohesion: 0.17
Nodes (5): CameraHelper, addLine(), addPoint(), EdgesGeometry, setPoint()

### Community 149 - "cloneUniforms"
Cohesion: 0.40
Nodes (4): cloneUniforms(), cloneUniformsGroups(), isThreeObject(), mergeUniforms()

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

### Community 163 - "addShape"
Cohesion: 0.31
Nodes (10): addShape(), addUV(), addVertex(), buildLidFaces(), buildSideFaces(), f3(), f4(), getBevelVec() (+2 more)

### Community 164 - ".toShapes"
Cohesion: 0.29
Nodes (3): Shape, getInteriorPoint(), pointInPolygon()

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

### Community 174 - ".toJSON"
Cohesion: 0.12
Nodes (6): ExtrudeGeometry, extractFromCache(), extractFromCache(), serialize(), ShapeGeometry, toJSON$1()

## Knowledge Gaps
- **20 isolated node(s):** `RFC-1951`, `RFC-3987`, `FlateErrorCode`, `OBJ + MTL : réécriture des chemins de matériaux`, `Unités ramenées au millimètre` (+15 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1533 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **86 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `GLTFWriter` connect `GLTFWriter` to `.processImage`, `.writeAsync`, `.processTextureAsync`, `.constructor`, `GLTFExporter.js`?**
  _High betweenness centrality (0.137) - this node is a cross-community bridge._
- **Are the 6 inferred relationships involving `get()` (e.g. with `WebGLAttributes()` and `WebGLEnvironments()`) actually correct?**
  _`get()` has 6 INFERRED edges - model-reasoned connections that need verification._
- **What connects `RFC-1951`, `RFC-3987`, `FlateErrorCode` to the rest of the system?**
  _20 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `three.core.js` be split into smaller, more focused modules?**
  _Cohesion score 0.007633587786259542 - nodes in this community are weakly interconnected._
- **Why does `object()` connect `.constructor` to `occt-import-js.js`?**
  _High betweenness centrality (0.116) - this node is a cross-community bridge._
- **Should `three.module.js` be split into smaller, more focused modules?**
  _Cohesion score 0.007782101167315175 - nodes in this community are weakly interconnected._
- **Why does `createElementNS()` connect `.constructor` to `three.core.js`, `three.module.js`, `get`, `.getDataURL`, `EventDispatcher`?**
  _High betweenness centrality (0.092) - this node is a cross-community bridge._