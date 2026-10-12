# Libraries, code and assets we can use

Checked 12 Oct 2026 by research agents (HTTP status of every CDN URL confirmed). Rule: no
Node, no bundler; libraries only as browser-ready ES modules from jsDelivr, pinned, at least two
weeks old, precached by the service worker. Images and models public domain or CC BY only.

## Three.js 0.170.0 (MIT), already our pinned version

Import map: `three` -> `https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js`,
`three/addons/` -> `https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/`.

| Need | Use | Verified path under examples/jsm/ or core |
|---|---|---|
| Tap-to-place on a grid | copy the snapping maths from the voxel painter example | github.com/mrdoob/three.js/blob/r170/examples/webgl_interactive_voxelpainter.html |
| Model view camera | OrbitControls | controls/OrbitControls.js |
| Plan view pan and zoom | MapControls | controls/MapControls.js |
| Sea and pool | Water2 (flow map water) | objects/Water2.js. Its normal textures are not on jsDelivr and are over 300 KB, so we generate our own tileable normal map with Pillow |
| Sky and sun | Sky | objects/Sky.js (example webgl_shaders_sky) |
| Speech bubbles, labels | CSS2DRenderer, CSS2DObject | renderers/CSS2DRenderer.js |
| Characters, trees, furniture | GLTFLoader (plain .glb, no decoders needed for Kenney) | loaders/GLTFLoader.js |
| Section cut | renderer.localClippingEnabled plus material.clippingPlanes | example webgl_clipping |
| Hundreds of blocks | InstancedMesh (setColorAt) or BatchedMesh (mixed shapes) | core |
| Slides | TubeGeometry along CatmullRomCurve3 | core |
| Arches | ExtrudeGeometry with holes | core (example webgl_geometry_shapes) |
| Domes | LatheGeometry | core |
| Stylised look | MeshToonMaterial with gradientMap (optional) | core (example webgl_materials_toon) |

Not usable: PointerLockControls is mouse-only (no touch). Walking needs a joystick.

## Small libraries (all MIT)

| Library | Version, date | Verified ES module URL | Size | For |
|---|---|---|---|---|
| nipplejs | 1.0.4, 26 May 2026 | https://cdn.jsdelivr.net/npm/nipplejs@1.0.4/+esm | small | touch joystick in Walk view |
| SortableJS | 1.15.7, 11 Feb 2026 | https://cdn.jsdelivr.net/npm/sortablejs@1.15.7/modular/sortable.esm.js | 119 KB raw, 29 KB gzip | reordering code tiles by finger (use forceFallback and delayOnTouchOnly on Samsung) |
| lz-string | 1.5.0, 4 Mar 2023 | https://cdn.jsdelivr.net/npm/lz-string@1.5.0/+esm | 1.7 KB | share a design as a URL |

Considered and skipped: PathFinding.js 0.4.18 (UMD only, 2016; a 60-line A* of our own is
simpler), EasyStar.js (callback API, unmaintained), Yuka 0.7.8 (85 KB game-AI library, overkill
for ten pupils), three-pathfinding (navmesh, our world is a grid), Blockly 13.3.0 (640 KB,
icon-only horizontal blocks unproven), ScratchJr (BSD but archived native-app code).

## Patterns to copy, not code

- **dgreenheck/simcity-threejs-clone** (MIT): `tiles[x][y]` each holding one building made of
  modules; citizens as a small state machine advanced once per tick; all tunables in one file.
- **furnishup/blueprint3d** (MIT, 2016): rooms are faces of a wall graph. On a grid this
  becomes: draw a wall wherever two neighbouring cells have different room labels.
- **Townscaper**: one finger orbits, a tap places, no mode switch (tap versus drag decided by a
  10 px threshold); the engine auto-completes roofs and details so every build looks finished.
- **The Sims**: rooms advertise what need they satisfy; a pupil picks the best-scoring room for
  its current needs.
- **Islanders**: a ghost preview shows the effect of a placement before you commit.
- Nothing ready-made exists: no permissive, maintained kids' school or dollhouse builder was
  found on GitHub.

## Our own code (Astra Finn and sister apps)

- Mission engine in `js/app.js`: step types story, guess, play (dynamic import of a module),
  question (Big Question), video, athome, finish; debrief and patch.
- `js/core/speak.js` (Read aloud), `js/core/patch.js`, `js/core/store.js`, `js/core/icons.js`.
- `tools/build_sw.py`, `tools/sw.template.js`, `tools/shot.sh`, `dev/harness.html`,
  `dev/test-sw.html`.
- Astra Bleeps: Web Audio chimes and bleeps.

## 3D models (CC0, copy the .glb files into assets/models/, credit anyway)

| Pack | URL | What we take |
|---|---|---|
| Kenney Mini Characters | https://kenney.nl/assets/mini-characters | 12 .glb figures, 237 to 267 KB each, 32 animation clips embedded (idle, walk, sprint, jump, sit). Pupils and teachers. |
| Kenney Nature Kit | https://kenney.nl/assets/nature-kit | about 60 trees and 60 rocks and cliff pieces as .glb. Forest and shore. |
| Kenney Furniture Kit | https://kenney.nl/assets/furniture-kit | desk, chairDesk, chair, bookcaseOpen, bench, table. Interiors. |
| Kenney Fish Pack | kenney.nl | 2D only (PNG and SVG). Aquarium fish as sprites. |

Downloading the zips needs Phil's go-ahead. Pin anything served from GitHub to a tag, never
`@master`. No CC0 slide or climbing frame exists; those are our own geometry.

Credits lines: "Characters, nature and furniture models: Kenney (www.kenney.nl), CC0 1.0".

## Icons for picture tiles

Twemoji 14.0.2, CC BY 4.0 for graphics, served per emoji:
`https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/<codepoint>.svg`
(verified for 1f600, 1f3ca swimmer, 1f6d1 stop sign; about 0.5 to 1.5 KB each). Each icon URL
used must be in the precache list. Credit line: "Emoji graphics: Twemoji (Twitter, Inc and
contributors), CC BY 4.0, github.com/twitter/twemoji".

Not used: OpenMoji (CC BY-SA, share-alike), Noto Emoji (Apache, not CC), Phosphor (MIT code
icons; fine for UI chrome if we want them, not for content pictures).
