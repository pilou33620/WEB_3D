# Graph Report - WEB_3D  (2026-10-23)

## Corpus Check
- 37 files · ~424,671 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 13 file(s) not represented in the graph (top: .css 2, .step 2, .obj 2)

## Summary
- 4297 nodes · 9476 edges · 193 communities (109 shown, 84 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 254 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b130ae85`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- three.core.js
- three.module.js
- Float32BufferAttribute
- .subVectors
- warn
- .fromBufferAttribute
- get
- .parse
- WebGLRenderer
- Object3D
- Sphere
- 06-topologie.js
- .render
- Vector2
- 09-demarrage.js
- Mesure
- .equals
- Material
- Interface
- Quaternion
- Vector4
- Plane
- .constructor
- Vector3
- .load
- PerspectiveCamera
- AnimationAction
- Box3
- Matrix4
- EventDispatcher
- ObjectLoader
- Vue3D
- .parseObject
- PropertyBinding
- Color
- 14-pilote-3d.js
- 07-mesure.js
- BatchedMesh
- CoupeManager
- .invert
- 05-arbre.js
- .processTextureAsync
- AnimationMixer
- .clone
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
- LineBasicMaterial
- .setStyle
- Euler
- WebGLBindingStates
- GLTFWriter
- .dispose
- Audio
- Texture
- MaterialCreator
- InterleavedBuffer
- faceSous
- Ray
- BufferGeometryUtils.js
- fflate.module.js
- createColorManagement
- arraysEqual
- banc-exemples.mjs
- CubicBezierCurve
- TextureSource
- .constructor
- QuadraticBezierCurve
- index.html structure de la page
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
- DirectionalLight
- mm
- addToRenderList
- Path
- .constructor
- parseUniform
- deflate
- .parse
- PropertyMixer
- C
- makeClipAdditive
- .copy
- VideoTexture
- Appairage
- error
- Mesh
- Timer
- 02-import.js
- .mmap
- AudioListener
- Controls
- Raycaster
- Pilote
- CompressedArrayTexture
- DataTexture
- 11-projets.js
- abort
- OrthographicCamera
- Camera
- À faire — fonctionnalités et bugs
- .fromArray
- Scene
- DataArrayTexture
- postRun
- .processImage
- .writeAsync
- gzip
- Clock
- CatmullRom
- Cylindrical
- GLBufferAttribute
- RoomEnvironment.js
- 08-interface.js
- flatten
- CylinderGeometry
- AnimationClip
- BufferGeometry
- ThreeMFLoader
- cloneUniforms
- AnimationUtils
- H
- adresses_poste
- web_3D.py
- craftInvokerFunction
- getCallstack
- ___syscall_ioctl
- StepExtractor
- BezierInterpolant
- LightShadow
- InstancedBufferAttribute
- write
- registerType
- syncfs
- syscallGetVarargI
- decompress
- ZipPassThrough
- FenetreResultats
- .push
- Uniform
- _points
- close
- CubicPoly
- .lerp
- euclideanModulo
- getByteLength
- getKeyframeOrder
- probeAsync
- MultiDrawRenderList
- WebGLLights
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

## God Nodes (most connected - your core abstractions)
1. `Vector3` - 113 edges
2. `Vector2` - 90 edges
3. `get()` - 87 edges
4. `warn()` - 73 edges
5. `Object3D` - 72 edges
6. `BufferGeometry` - 71 edges
7. `Vector4` - 65 edges
8. `BufferAttribute` - 55 edges
9. `Mesure` - 53 edges
10. `WebGLTextures()` - 52 edges

## Surprising Connections (you probably didn't know these)
- `LGPL-2.1 (occt-import-js)` --references--> `OpenCascade / occt-import-js (WebAssembly)`  [EXTRACTED]
  vendor/occt/license.occt-import-js.txt → README.md
- `LGPL-2.1 (OpenCascade)` --references--> `OpenCascade / occt-import-js (WebAssembly)`  [EXTRACTED]
  vendor/occt/license.occt.txt → README.md
- `Conformité LGPL-2.1 : wasm remplaçable, non modifié` --references--> `LGPL-2.1 (occt-import-js)`  [INFERRED]
  README.md → vendor/occt/license.occt-import-js.txt
- `construire()` --indirect_call--> `liste()`  [INFERRED]
  js/pilote.js → js/11-projets.js
- `Barre d'outils (ouvrir, mesure, coupe, collisions, déplacer, export)` --references--> `Outil de mesure (Auto, Point, Arête, Pièce, Face)`  [INFERRED]
  index.html → README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Chaîne de mesure** — js_06_topologie, js_07_mesure, readme_measure [INFERRED 0.85]
- **Chaîne de lecture STEP** — js_02_import, js_travailleur_occt, readme_opencascade [INFERRED 0.85]

## Communities (193 total, 84 thin omitted)

### Community 0 - "three.core.js"
Cohesion: 0.01
Nodes (225): RFC-3987, _addedEvent, _alignedPosition, _axis, _baseVector, _batchIntersects, _boneMatrix, _box (+217 more)

### Community 1 - "three.module.js"
Cohesion: 0.01
Nodes (38): TOUCH, arrayCacheF32, arrayCacheI32, _clearColor, _cubeDirections, _cubeUps, DATA, _direction (+30 more)

### Community 3 - "Float32BufferAttribute"
Cohesion: 0.06
Nodes (10): arrayNeedsUint32(), CapsuleGeometry, CircleGeometry, Float32BufferAttribute, LatheGeometry, PlaneGeometry, RingGeometry, SphereGeometry (+2 more)

### Community 5 - "warn"
Cohesion: 0.11
Nodes (54): createCanvasElement(), createElementNS(), warn(), setValueT1(), setValueT2DArray1(), setValueT3D1(), setValueT6(), getContext() (+46 more)

### Community 6 - ".fromBufferAttribute"
Cohesion: 0.09
Nodes (4): copyAttributeData(), InterleavedBufferAttribute, isUniqueEdge(), WireframeGeometry

### Community 7 - "get"
Cohesion: 0.07
Nodes (47): includeReplacer(), WebGLAttributes(), createBuffer(), get(), remove(), update(), updateBuffer(), releaseStatesOfGeometry() (+39 more)

### Community 8 - ".parse"
Cohesion: 0.11
Nodes (37): analyzeObject(), applyExtensions(), build(), buildBasematerial(), buildBasematerialsMeshes(), buildComposite(), buildDefaultMesh(), buildGroup() (+29 more)

### Community 9 - "WebGLRenderer"
Cohesion: 0.04
Nodes (20): WebGLRenderTarget, _createRenderTarget(), WebGLRenderer, renderObject(), renderObjects(), renderTransmissionPass(), VSMPass(), bindFramebuffer() (+12 more)

### Community 12 - "06-topologie.js"
Cohesion: 0.09
Nodes (42): analyser(), aplatir(), areteSous(), AXES_MONDE, barycentre(), cerclePlan(), COS_ALIGNE_MONDE, COS_MEME_PLAN (+34 more)

### Community 13 - ".render"
Cohesion: 0.07
Nodes (29): ExternalTexture, shadowCastingAndTexturingLightsFirst(), WebGLClipping(), projectPlanes(), resetGlobalState(), setup(), WebGLOutput(), WebGLPrograms() (+21 more)

### Community 15 - "09-demarrage.js"
Cohesion: 0.10
Nodes (22): abonnes, actionPourGeste(), BOUTONS, chargerPrefs(), enregistrerPrefs(), nomBouton(), prefs, PREFS_DEFAUT (+14 more)

### Community 17 - ".equals"
Cohesion: 0.07
Nodes (34): addContour(), compareXYSlope(), createNode(), cureLocalIntersections(), earcut(), earcutLinked(), eliminateHole(), eliminateHoles() (+26 more)

### Community 18 - "Material"
Cohesion: 0.06
Nodes (12): LineDashedMaterial, Material, MeshDepthMaterial, MeshDistanceMaterial, MeshLambertMaterial, MeshMatcapMaterial, MeshNormalMaterial, MeshPhongMaterial (+4 more)

### Community 19 - "Interface"
Cohesion: 0.13
Nodes (8): gestesActifs(), prefsModifiees(), reinitialiserPrefs(), resumeGestes(), visibleEnLignee(), calculerAretes(), liberer(), Interface

### Community 23 - ".constructor"
Cohesion: 0.09
Nodes (32): object(), getDFGLUT(), WebGLAnimation(), onAnimationFrame(), WebGLIndexedBufferRenderer(), render(), renderInstances(), renderMultiDraw() (+24 more)

### Community 25 - ".load"
Cohesion: 0.28
Nodes (3): loadTexture(), loadTexture(), FileLoader

### Community 26 - "PerspectiveCamera"
Cohesion: 0.07
Nodes (12): ArrayCamera, Layers, PerspectiveCamera, RawShaderMaterial, ShaderMaterial, _getBlurShader(), _getCommonVertexShader(), _getCubemapMaterial() (+4 more)

### Community 29 - "Matrix4"
Cohesion: 0.06
Nodes (3): Bone, Matrix4, Skeleton

### Community 30 - "EventDispatcher"
Cohesion: 0.11
Nodes (9): handleError(), EventDispatcher, readData(), HttpError, onImageError(), onImageLoad(), removeEventListeners(), LoadingManager (+1 more)

### Community 31 - "ObjectLoader"
Cohesion: 0.18
Nodes (3): MaterialLoader, ObjectLoader, parseConstant()

### Community 33 - ".parseObject"
Cohesion: 0.05
Nodes (13): AmbientLight, Fog, FogExp2, HemisphereLight, Light, LightProbe, LineLoop, getGeometry() (+5 more)

### Community 34 - "PropertyBinding"
Cohesion: 0.06
Nodes (3): AnimationObjectGroup, Composite, PropertyBinding

### Community 36 - "14-pilote-3d.js"
Cohesion: 0.16
Nodes (35): formatDe(), sanitiserNomFichier(), apresDeplacement(), perimerCaches(), arrondir(), AXES, brancherPilote3d(), calculerCollisions() (+27 more)

### Community 37 - "07-mesure.js"
Cohesion: 0.13
Nodes (14): centreDeFace(), contourFace(), geometrieArete(), geometrieFace(), numeroArete(), PLAFOND_TRIANGLES, pointSurArete(), tailleParPixel() (+6 more)

### Community 41 - "05-arbre.js"
Cohesion: 0.15
Nodes (13): Arbre, couleurDe(), echapper(), estDansBranche(), fmt, formaterAire(), formaterNombre(), formaterVolume() (+5 more)

### Community 42 - ".processTextureAsync"
Cohesion: 0.09
Nodes (8): GLTFMaterialsAnisotropyExtension, GLTFMaterialsBumpExtension, GLTFMaterialsClearcoatExtension, GLTFMaterialsIridescenceExtension, GLTFMaterialsSheenExtension, GLTFMaterialsSpecularExtension, GLTFMaterialsTransmissionExtension, GLTFMaterialsVolumeExtension

### Community 44 - ".clone"
Cohesion: 0.09
Nodes (7): checkIntersection(), checkIntersection$1(), scalePt2(), InstancedMesh, LOD, testPoint(), transformVertex()

### Community 45 - "BufferAttribute"
Cohesion: 0.05
Nodes (11): BufferAttribute, DataUtils, denormalize(), Float16BufferAttribute, Int16BufferAttribute, Int32BufferAttribute, Int8BufferAttribute, Uint16BufferAttribute (+3 more)

### Community 46 - "Matrix3"
Cohesion: 0.07
Nodes (5): Matrix3, Source, warnOnce(), WebGLExtensions(), getExtension()

### Community 47 - "WebGLProgram"
Cohesion: 0.09
Nodes (24): fetchAttributeLocations(), filterEmptyLine(), generateCubeUVSize(), generateDefines(), generateEnvMapBlendingDefine(), generateEnvMapModeDefine(), generateEnvMapTypeDefine(), generatePrecision() (+16 more)

### Community 49 - "travailleur-occt.js"
Cohesion: 0.11
Nodes (13): Workflow CI bancs d'essai, Banc des exemples (test/banc-exemples.mjs), Banc du serveur (test/banc-serveur.py), Fichiers d'exemples (as1, essai-mesure.obj...), OpenCascade / occt-import-js (WebAssembly), Appairage par code à 6 chiffres (appairage.py), Sécurité serveur : liste blanche, contrôle Host (DNS rebinding), Visionneuse 3D (WEB_3D) (+5 more)

### Community 52 - "WebGLMaterials"
Cohesion: 0.33
Nodes (14): WebGLMaterials(), refreshMaterialUniforms(), refreshTransformUniform(), refreshUniformsCommon(), refreshUniformsDash(), refreshUniformsDistance(), refreshUniformsLine(), refreshUniformsMatcap() (+6 more)

### Community 53 - "appairage.py"
Cohesion: 0.11
Nodes (16): _a_refaire(), appairer(), _ca_a_refaire(), _cnf(), contexte_tls(), dossier_tls(), empreinte_ca(), en_https() (+8 more)

### Community 54 - "RenderTarget"
Cohesion: 0.20
Nodes (4): Data3DTexture, RenderTarget, RenderTarget3D, WebGL3DRenderTarget

### Community 55 - "KeyframeTrack"
Cohesion: 0.12
Nodes (7): BooleanKeyframeTrack, ColorKeyframeTrack, KeyframeTrack, QuaternionKeyframeTrack, StringKeyframeTrack, subclip(), VectorKeyframeTrack

### Community 56 - "LineBasicMaterial"
Cohesion: 0.08
Nodes (10): AxesHelper, Box3Helper, BoxHelper, getBoneList(), GridHelper, LineBasicMaterial, LineSegments, PolarGridHelper (+2 more)

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
Cohesion: 0.10
Nodes (21): log(), dispose(), WebGLCubeRenderTarget, WebGLEnvironments(), dispose(), get(), getCube(), getPMREM() (+13 more)

### Community 63 - "Texture"
Cohesion: 0.08
Nodes (5): CanvasTexture, CubeTexture, FramebufferTexture, HTMLTexture, Texture

### Community 64 - "MaterialCreator"
Cohesion: 0.16
Nodes (4): MaterialCreator, resolveURL(), setMapForType(), MTLLoader

### Community 65 - "InterleavedBuffer"
Cohesion: 0.09
Nodes (7): getArrayBuffer(), getInterleavedBuffer(), generateUUID(), getTypedArray(), InstancedBufferGeometry, InterleavedBuffer, Sprite

### Community 66 - "faceSous"
Cohesion: 0.30
Nodes (15): faceSous(), AXES, brancherDeplacement(), annulerContrainte(), apres(), basculer(), choisirFace(), construire() (+7 more)

### Community 68 - "BufferGeometryUtils.js"
Cohesion: 0.13
Nodes (9): unzipSync(), buildLatticeMesh(), computeMikkTSpaceTangents(), computeMorphedAttributes(), deepCloneAttribute(), deinterleaveAttribute(), deinterleaveGeometry(), mergeAttributes() (+1 more)

### Community 69 - "fflate.module.js"
Cohesion: 0.09
Nodes (17): RFC-1951, AsyncDecompress(), AsyncGunzip(), AsyncInflate(), AsyncUnzipInflate(), AsyncUnzlib(), DecodeUTF8(), decompressSync() (+9 more)

### Community 70 - "createColorManagement"
Cohesion: 0.29
Nodes (3): createColorManagement(), LinearToSRGB(), SRGBToLinear()

### Community 71 - "arraysEqual"
Cohesion: 0.21
Nodes (19): allocTexUnits(), arraysEqual(), copyArray(), setValueM2(), setValueM3(), setValueM4(), setValueT1Array(), setValueT2DArrayArray() (+11 more)

### Community 72 - "banc-exemples.mjs"
Cohesion: 0.11
Nodes (3): occtimportjs, RACINE, STEP

### Community 73 - "CubicBezierCurve"
Cohesion: 0.11
Nodes (7): CubicBezier(), CubicBezierCurve, CubicBezierCurve3, CubicBezierP0(), CubicBezierP1(), CubicBezierP2(), CubicBezierP3()

### Community 74 - "TextureSource"
Cohesion: 0.12
Nodes (5): CubeDepthTexture, DepthTexture, ImageUtils, serializeImage(), TextureSource

### Community 75 - ".constructor"
Cohesion: 0.13
Nodes (4): GLTFExporter, GLTFLightExtension, GLTFMaterialsIorExtension, GLTFMeshGpuInstancing

### Community 76 - "QuadraticBezierCurve"
Cohesion: 0.12
Nodes (6): QuadraticBezier(), QuadraticBezierCurve, QuadraticBezierCurve3, QuadraticBezierP0(), QuadraticBezierP1(), QuadraticBezierP2()

### Community 77 - "index.html structure de la page"
Cohesion: 0.14
Nodes (13): Dialogues : aide, préférences, projets, export de pièce, Import map (three), index.html structure de la page, Barre d'outils (ouvrir, mesure, coupe, collisions, déplacer, export), Export PNG, glTF/GLB, STEP, fflate, Formats : STEP, IGES, BREP, 3MF, OBJ, STL, STPZ, Préréglages de souris (Onshape, SolidWorks, Fusion...) (+5 more)

### Community 78 - "Interpolant"
Cohesion: 0.14
Nodes (5): CubicInterpolant, DiscreteInterpolant, Interpolant, LinearInterpolant, QuaternionLinearInterpolant

### Community 79 - "creer"
Cohesion: 0.11
Nodes (44): creer(), afficher(), ajouter(), annoncer(), annuler(), appliquer(), base64(), battre() (+36 more)

### Community 80 - "GLTFExporter.js"
Cohesion: 0.13
Nodes (8): DEFAULT_SPECULAR_COLOR, GLTFMaterialsDispersionExtension, GLTFMaterialsEmissiveStrengthExtension, GLTFMaterialsUnlitExtension, KHR_mesh_quantization_ExtraAttrTypes, PATH_PROPERTIES, THREE_TO_WEBGL, WEBGL_CONSTANTS

### Community 81 - "Curve"
Cohesion: 0.07
Nodes (5): ArcCurve, Curve, EllipseCurve, LineCurve, LineCurve3

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
Cohesion: 0.09
Nodes (9): brancher_tls(), Garde, hote_url(), _html(), ligne_https(), attendre(), main(), redemarrer_application() (+1 more)

### Community 88 - "OBJLoader.js"
Cohesion: 0.18
Nodes (8): _ab, _cb, _color, OBJLoader, ParserState(), _vA, _vB, _vC

### Community 89 - "Loader"
Cohesion: 0.08
Nodes (9): AnimationLoader, AudioLoader, BufferGeometryLoader, CompressedTextureLoader, CubeTextureLoader, ImageBitmapLoader, ImageLoader, Loader (+1 more)

### Community 92 - "createWasm"
Cohesion: 0.20
Nodes (12): addOnInit(), addRunDependency(), createWasm(), receiveInstance(), receiveInstantiationResult(), findWasmBinary(), getWasmImports(), locateFile() (+4 more)

### Community 93 - "zip"
Cohesion: 0.27
Nodes (6): deflateSync(), EncodeUTF8(), strFromU8(), strToU8(), zip, zipSync()

### Community 94 - "banc-pilote-3d.mjs"
Cohesion: 0.05
Nodes (19): arbre, compte, coupe, declare, desc3, deux, disponibles, ecritsLS (+11 more)

### Community 96 - "mm"
Cohesion: 0.16
Nodes (30): arcEntre(), constructionAngle(), constructionAretePlan(), constructionPlans(), coordonnees(), cote(), degres(), diam() (+22 more)

### Community 98 - "addToRenderList"
Cohesion: 0.48
Nodes (6): getUnlitUniformColorSpace(), WebGLBackground(), addToRenderList(), getBackground(), render(), setClear()

### Community 99 - "Path"
Cohesion: 0.07
Nodes (6): CurvePath, Path, Shape, ShapePath, getInteriorPoint(), pointInPolygon()

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

### Community 105 - "C"
Cohesion: 0.40
Nodes (3): C, CS, S

### Community 107 - ".copy"
Cohesion: 0.10
Nodes (4): handleTriangle(), handleVertex(), Line3, SphericalHarmonics3

### Community 110 - "error"
Cohesion: 0.13
Nodes (27): enhanceLogMessage(), error(), WebGLInfo(), update(), renderScene(), WebGLState(), ColorBuffer(), compressedTexImage2D() (+19 more)

### Community 111 - "Mesh"
Cohesion: 0.08
Nodes (8): ArrowHelper, DirectionalLightHelper, Line, Mesh, MeshBasicMaterial, PlaneHelper, PointLightHelper, _createPlanes()

### Community 113 - "02-import.js"
Cohesion: 0.13
Nodes (26): ANNEXES, appliquerCouleursFaces(), construireNoeud(), creerGeometrie(), creerMaillage(), estAnnexe(), extension(), fabriqueMateriaux() (+18 more)

### Community 114 - ".mmap"
Cohesion: 0.31
Nodes (7): createLazyFile(), stream_ops, writeChunks(), get_char(), mmap(), position(), read()

### Community 117 - "Raycaster"
Cohesion: 0.15
Nodes (3): ascSort(), Matrix2, Raycaster

### Community 118 - "Pilote"
Cohesion: 0.15
Nodes (4): _pieces(), Pilote, Refus, _texte()

### Community 119 - "CompressedArrayTexture"
Cohesion: 0.22
Nodes (3): CompressedArrayTexture, CompressedCubeTexture, CompressedTexture

### Community 120 - "DataTexture"
Cohesion: 0.16
Nodes (6): DataTexture, DataTextureLoader, intersect(), LoaderUtils, deserializeImage(), deserializeImage()

### Community 121 - "11-projets.js"
Cohesion: 0.42
Nodes (9): brancherProjets(), compagnons(), jour(), lireFichiersProjets(), liste(), ouvrir(), ranger(), remplir() (+1 more)

### Community 122 - "abort"
Cohesion: 0.25
Nodes (8): abort(), assert(), getBinaryPromise(), getBinarySync(), instantiateArrayBuffer(), instantiateAsync(), lookup_name(), ___syscall_unlinkat()

### Community 126 - "À faire — fonctionnalités et bugs"
Cohesion: 0.50
Nodes (3): Bugs, Fonctionnalités, À faire — fonctionnalités et bugs

### Community 127 - ".fromArray"
Cohesion: 0.11
Nodes (3): CatmullRomCurve3, flattenJSON(), SplineCurve

### Community 131 - "postRun"
Cohesion: 0.29
Nodes (7): addOnPostRun(), addOnPreRun(), initRuntime(), postRun(), preRun(), run(), doRun()

### Community 133 - ".writeAsync"
Cohesion: 0.33
Nodes (3): getPaddedArrayBuffer(), getPaddedBufferSize(), stringToArrayBuffer()

### Community 134 - "gzip"
Cohesion: 0.18
Nodes (6): AsyncGzip(), AsyncZlib(), gzip, gzipSync(), zlib, zlibSync()

### Community 142 - "08-interface.js"
Cohesion: 0.13
Nodes (22): ACTIONS, EMPLACEMENTS, PRESETS_SOURIS, MODES, MODES_DELTA, fmt(), nf, boiteMonde() (+14 more)

### Community 143 - "flatten"
Cohesion: 0.29
Nodes (7): flatten(), setValueM2Array(), setValueM3Array(), setValueM4Array(), setValueV2fArray(), setValueV3fArray(), setValueV4fArray()

### Community 147 - "BufferGeometry"
Cohesion: 0.09
Nodes (10): BufferGeometry, convertBufferAttribute(), CameraHelper, addLine(), addPoint(), copyArrayContents(), EdgesGeometry, HemisphereLightHelper (+2 more)

### Community 149 - "cloneUniforms"
Cohesion: 0.40
Nodes (4): cloneUniforms(), cloneUniformsGroups(), isThreeObject(), mergeUniforms()

### Community 150 - "AnimationUtils"
Cohesion: 0.17
Nodes (4): AnimationUtils, getTrackTypeForValueTypeName(), parseKeyframeTrack(), scaleTangentTimes()

### Community 152 - "adresses_poste"
Cohesion: 0.21
Nodes (5): adresses_poste(), hote_permis(), ip_tailscale(), masquer(), _nom_local()

### Community 153 - "web_3D.py"
Cohesion: 0.06
Nodes (11): battement(), commander(), H, req(), adresse_locale(), ipv4_libre(), lance_par_double_clic(), ouvrir_serveur() (+3 more)

### Community 154 - "craftInvokerFunction"
Cohesion: 0.67
Nodes (4): craftInvokerFunction(), createJsInvoker(), newFunc(), usesDestructorStack()

### Community 155 - "getCallstack"
Cohesion: 0.50
Nodes (3): _emscripten_get_callstack(), getCallstack(), jsStackTrace()

### Community 156 - "___syscall_ioctl"
Cohesion: 0.50
Nodes (4): ioctl_tcgets(), ioctl_tcsets(), ioctl_tiocgwinsz(), ___syscall_ioctl()

### Community 159 - "BezierInterpolant"
Cohesion: 0.50
Nodes (3): BezierInterpolant, cubicBezierSlope(), solveBezierParameter()

### Community 160 - "LightShadow"
Cohesion: 0.10
Nodes (3): CubeCamera, LightShadow, UniformsGroup

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

### Community 174 - ".push"
Cohesion: 0.06
Nodes (29): BoxGeometry, buildPlane(), generateCap(), generateTorso(), ExtrudeGeometry, addShape(), addUV(), addVertex() (+21 more)

### Community 188 - "WebGLLights"
Cohesion: 0.50
Nodes (4): ShadowUniformsCache(), UniformsCache(), WebGLLights(), setupView()

## Knowledge Gaps
- **20 isolated node(s):** `RFC-1951`, `RFC-3987`, `FlateErrorCode`, `OBJ + MTL : réécriture des chemins de matériaux`, `Unités ramenées au millimètre` (+15 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1523 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **84 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `GLTFWriter` connect `GLTFWriter` to `.processImage`, `.writeAsync`, `.processTextureAsync`, `.constructor`, `GLTFExporter.js`?**
  _High betweenness centrality (0.144) - this node is a cross-community bridge._
- **Are the 6 inferred relationships involving `get()` (e.g. with `WebGLAttributes()` and `WebGLEnvironments()`) actually correct?**
  _`get()` has 6 INFERRED edges - model-reasoned connections that need verification._
- **What connects `RFC-1951`, `RFC-3987`, `FlateErrorCode` to the rest of the system?**
  _20 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `three.core.js` be split into smaller, more focused modules?**
  _Cohesion score 0.007692307692307693 - nodes in this community are weakly interconnected._
- **Why does `object()` connect `.constructor` to `occt-import-js.js`?**
  _High betweenness centrality (0.116) - this node is a cross-community bridge._
- **Should `three.module.js` be split into smaller, more focused modules?**
  _Cohesion score 0.007782101167315175 - nodes in this community are weakly interconnected._
- **Why does `createElementNS()` connect `warn` to `three.core.js`, `three.module.js`, `TextureSource`, `EventDispatcher`?**
  _High betweenness centrality (0.091) - this node is a cross-community bridge._