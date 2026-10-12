# Astra Architect: Finn's Dream School (plan v2)

## Build status (12 Oct 2026)

Built and live at https://philhandley.github.io/astra-architect/ :

- The site from the homework map on a wooden plinth, with water, the waterfall, a flat clearing by the falls, and Kenney trees that clear away round buildings.
- Twelve forms and eighteen rooms, tap-then-tap building with a ghost preview and mood faces, turn, change shape, paint materials, move, bin, undo.
- Blocks and Building modes (walls, doors, windows, parapets, pool water, slide rails, track lanes, fish, furniture), and a doll's-house cutaway during the school day.
- Views: Model, Plan (a 2D architect's drawing with door swings, windows and a bubble diagram), Section (slide the cut, four sides, solid earth) and Walk (joystick or tap a room).
- The Brief with live wish detectors, the school day simulation (bells, capacity, routes, stairs, slides, roof laps, report card) and a ScratchJr-style tile strip with predict-then-go.
- All seven missions with their play steps, the sorting game and the shape lab with the arch test, the Ideas book with Try it, the drawing sheet, patches, Crew Log and the grown-up's corner.
- Installable PWA that works offline after one visit (tested with headless Edge).

Not built yet (later phases): rule tiles (If, When), teachers, sound beyond simple effects, share links, mission cover pictures. Changed from the plan: Water2 was replaced by a light custom water shader (Water2 renders the scene three times, too heavy for a tablet), and the Co-pilot role was removed (the app is Finn's own).

A tablet app where Finn (the Architect) and a grown-up (the Client) design a school on the
painted site from his homework: mountains, a waterfall, a meadow, a beach and the sea. He
builds with simple forms, gives each form a job, sees the school as an architect does (plan,
section, elevation, model, walk-through), then "codes" a few pupils with picture tiles and
watches a school day play out. What goes wrong on the day sends him back to the design.

The teaching follows the Astra Nova pattern used in Astra Finn: short missions, a story card,
a guess, hands-on play, sometimes a Big Question with no right answer, a try-it-at-home, a
debrief and a patch. Research behind every choice is in `research/03-libraries-and-assets.md`
and `research/04-teaching.md`.

Version 2 changes from v1: colours are designed, not the wooden-block set; the app is built
round seven missions plus a free Studio; architecture ideas (programme, form, scale, light,
circulation, structure) are mechanics, not just words; controls follow the research on five to
seven year olds; verified libraries and CC0 models replace bespoke work where they fit.

---

## 1. Simple enough for six: the rules

1. One finger does everything. Tap to pick, tap to place, one-finger drag to turn the view
   (Townscaper's scheme; a 10 px threshold tells a tap from a drag). No pinch, no double tap,
   no long press, no two-finger anything. Zoom is two big buttons.
2. Tap-then-tap placement, never drag-to-place: pick a room tile, tap the ground.
3. A ghost preview before every placement shows where it lands and whether the neighbours are
   happy, so nothing is a surprise.
4. Undo is always one big tap. Nothing is ever lost without a bin animation.
5. Every tile is a picture with one word under it, at least 96 px. Trays sit on the left and
   right rails, never along the bottom edge where resting hands go.
6. Every card has Read aloud. Every prompt can be heard, not just read.
7. Camera presets, not free flight: Plan, Model, Walk, plus Section and Side in later
   missions. "Home" resets the view.
8. Ten-minute missions. The Studio (free build) is open from the start with every tool; the
   missions teach, they don't lock.
9. Nothing can go wrong: pupils never get hurt, buildings never collapse (except the arch demo,
   which is the point), the sea never floods.

## 2. Finn's brief

His five wishes form the first Brief checklist, ticked live from the model:

1. A chill-out / yoga room by the waterfall.
2. Classrooms facing the sea.
3. A swimming pool.
4. An arched, curved aquarium you walk through.
5. A running track on the roof.

The Client can add wishes from a list (somewhere to eat, a library, toilets, a lookout,
a slide). All ticked earns the Brief Complete patch.

## 3. Roles

- **Architect (Finn)**: designs, codes the pupils, walks round.
- **Client (grown-up)**: sets the brief, reads aloud, runs the Site Meetings, fills in the bell
  timetable with Finn.

No scores between people. Rewards: Architect patches, the Crew Log, Changed-Mind stars.

## 4. The seven missions

Each mission is about ten minutes and uses the Astra Finn step types: Look (story card), Guess,
Play (a builder or simulation module with one goal), Big Question (some missions), Try it at
home, debrief, patch. The hands-on home activities and sources are in `research/04-teaching.md`.

| # | Mission | Architecture idea | Play goal in the app | Big Question (no right answer) | Try it at home |
|---|---|---|---|---|---|
| 1 | Site Visit | site: sun, wind, views, slope | fly the site, drag the sun across the sky, mark the best view; place the yoga room | sunny meadow or the cool misty corner by the waterfall? | map sun, shade and wind in the garden |
| 2 | The Shopping List | programme and the bubble diagram | sort the room cards into noisy/quiet, wet/dry, inside/outside hoops; then place bubbles on the map and see happy or unhappy neighbours | pool next to the yoga room or far away? | draw bubbles for your house |
| 3 | How Big? | scale | measure a classroom in Finns lying down; choose room sizes; see the whole school from the gate with a Finn figure for size | big enough for everyone, or cosy like a den? | chalk a classroom and count bodies |
| 4 | Shapes That Work | form and structure | the shape lab: cube, tower, ring, arch, dome, wedge, what each is good for; the arch test (pull the keystone, it falls); build the aquarium | tunnel, dome or tower for the fish? | make a human arch |
| 5 | Drawings and Light | plan, section, elevation; windows | draw the school as three drawings; slide the sun and watch shadows; put sea windows in the classrooms | big windows for the waves or small ones to stop the glare? | torch through card windows |
| 6 | Getting Around | circulation, and coding | code one pupil from the gate to a classroom with Go, Do, Wait and Again tiles; find the crush point; add stairs or a slide; close the roof track loop | finish line, or round and round forever? | walk gate to classroom and mark where people hurry |
| 7 | Open Day | the whole thing, plus materials | run a full school day, read the report, fix one thing, run again; export the drawing sheet | wood, glass or stone for the aquarium arch? | load-test card, wood and clay with books |

Finn can replay any mission. The Studio sits beside them with everything unlocked.

## 5. The site

The painted map is the ground texture, draped over a low-poly terrain mesh, so Finn builds on
the exact picture his blocks sat on.

- Grid: 60 by 40 cells. One cell is one room-sized form.
- Zones from the map colours, hand-fixed: meadow (build), beach (build, sand), forest edge
  (build, a tree hops aside), water (pool decks, jetties and bridges only), cliff and mountain
  (no).
- Heights from a small Pillow-drawn heightmap: meadow flat, beach a step down, forest rising,
  mountains top-left, the waterfall pool on a ledge, the river to the cove.
- Life: Water2 for the sea, river and pools with our own generated normal map; Sky with a sun
  the child can drag (this is the light lesson); Kenney Nature Kit trees and rocks instanced
  on forest and shore cells; waterfall as scrolling translucent planes with a mist sprite.

## 6. Forms (what you build with)

Ten forms, each with a one-line "what it's good for" card in the shape lab:

| Form | Footprint | Good for |
|---|---|---|
| Cube | 1 by 1 | a room |
| Long | 1 by 2 | a hall, a corridor |
| Tower | 1 by 1, two or three high | looking out, a climbing wall |
| Slab | 1 by 3, low | a pool, a deck, a bridge, a jetty |
| Arch | 1 by 2 with an opening | a tunnel, a gateway; it stands up by pushing sideways |
| Curve | quarter ring on 2 by 2 | four make a ring (Fuji Kindergarten) or a courtyard |
| Cylinder | 1 by 1 round | a calm room with no corners |
| Dome | half sphere on 1 by 1 or 2 by 2 | a big roof with no columns |
| Wedge | 1 by 1 ramp | a slide, a ramp, a stepped roof |
| Pitched roof | cap | rain runs off |

Forms snap to the grid, turn in quarter turns and stack. Floors are explicit (Ground, 1st,
2nd, Roof) with up and down buttons; Plan view shows one floor at a time like real drawings.

**Blocks and Building.** A toggle shows the same cells two ways. Blocks is the massing model,
like the table. Building, Townscaper-style, grows walls wherever two neighbouring cells have
different rooms, merges same-room cells into one space, adds doors on outside ground walls,
windows away from neighbours and a roof on top. That switch is itself the lesson: forms become
buildings.

## 7. Rooms (what each form is for), colour and materials

Picking a room from the tray places its default form, so Finn never has to think about shapes
first. A plain form can be given a room later by tapping it. Each room has a fixed colour so
plans read like a key (these are designed colours, not the wooden set):

| Room | Default form | Colour | Pupils can | Wants next to | Doesn't want next to |
|---|---|---|---|---|---|
| Classroom | cube | warm orange | Learn | daylight, a view, other classrooms | the hall (noise) |
| Hall | long | red | Play, Sing, Eat | the entrance, the lunch room | the library |
| Aquarium tunnel | arch | deep teal glass | Look at fish | shade, the pool | |
| Chill-out / Yoga | cylinder | sage green | Yoga, Nap | the waterfall, trees | the hall, the track |
| Swimming pool | slab | sea blue | Swim | changing room, the beach | the library |
| Climbing wall | tower | yellow | Climb | the hall, outside | |
| Slide | wedge or curve | yellow | Slide | a high floor | |
| Stairs | cube with steps | grey | | | |
| Running track | roof paint on a loop | red stripe | Run | the roof | the yoga room |
| Lunch room | cube | tomato | Eat | the garden, the hall | |
| Library | cube | plum | Read | quiet, the classrooms | the hall, the pool |
| Garden | slab | leaf green | Grow, Pick | the lunch room, sun | |
| Changing room | cube | pale blue | | the pool | |
| Bridge / Jetty | slab | timber | Walk, Look | water | |
| Lookout | tower | white | Look | a view | |
| Toilets, Music, Art, Science | cube | | | | Phase 3 |

The "wants" are the programme. They drive the neighbour faces in the ghost preview (Mission 2)
and the Bubble view in Plan: rooms drawn as bubbles with lines between them, thick where pupils
walk most. The bubble diagram, an architect's first drawing, emerges from Finn's own school.

Materials are a second palette the Architect can paint on any form, each with one card:
timber, white render, brick, glass, stone, grass roof, copper, sunshine yellow. Painting never
changes the room; the room colour stays as a stripe in Plan view.

## 8. Views (the architect's drawings)

- **Plan**: top-down, one floor at a time, the map underneath. MapControls.
- **Section**: a clipping plane the child slides through the building, with a cut face.
- **Side** (elevation): orthographic from the sea, the mountains, the east or the west.
- **Model**: orbit round the table. Default.
- **Walk**: first person at child eye height with a nipplejs thumb joystick, or tap a room on
  a strip of pictures to walk there. Pupils walk past you. Inside, rooms show their interiors
  (Kenney desks and chairs, pool water, fish behind the aquarium glass, yoga mats).
- **Pupil cam** (Phase 2): follow one pupil through their day.

A Finn-sized figure (a Kenney Mini Character) stands at the gate in every view for scale.

## 9. Coding the pupils

Built bespoke to the research rules (picture-only, one colour per category, tap to add, drag
only to reorder with SortableJS, one Go button).

- **Pupils**: six to twelve Kenney Mini Characters with idle, walk and sprint clips. Finn
  names them and picks colours. Two teachers appear on their own.
- **Strip**: a fixed Start tile, then up to eight tiles growing to the right:
  - Go tiles (blue): one per room, plus Outside, Beach, Waterfall.
  - Do tiles (green): Learn, Play, Swim, Run, Climb, Slide, Yoga, Eat, Look, Nap.
  - Wait tiles (orange): Bell (wait for the next bell), and a pause.
  - Again (yellow): a bracket round the last tiles with two or three dots, never digits.
- Tap a tray tile to add it. Tap a strip tile to remove it. One Clear. Drag only to reorder.
- **Predict, then Go**: before running, the app asks "Where will Finn end up?" and he taps a
  room. Then Go. The run highlights the current tile, moves one tile at a time and bleeps.
- **Debug**: a stuck pupil's tile glows red and the speech bubble shows why (a "?" over a
  closed door, a gap in the track, a full room). Fix one tile or one block and run again.
- Pupils with no strip follow the **Bell timetable** the Client and Finn fill in (six bells:
  Reading, Swimming, Lunch, Yoga, Running, Fish), so the school works before anyone codes.
- Rule tiles (Phase 3, purple): When the bell rings, If I'm tired, If I'm hungry, Follow Finn.

## 10. The simulation

- Walkable graph over cells: ground, room floors, doors, stairs, climbing walls, bridges;
  slides as one-way edges; the roof track as its own loop. A 60-line A-star of our own.
- Each pupil is a small state machine (idle, walking, doing, waiting, stuck), advanced on a
  fixed tick so slow frames don't change the day.
- Needs shown as three faces, never numbers: energy, tummy, fun. Rooms advertise what they
  satisfy (Sims-style) so uncoded pupils pick sensibly.
- Events: lessons start when pupils with Learn are in a classroom at the bell; a full room
  makes latecomers wait outside; a closed track makes runners lap; pupils in the aquarium make
  the fish come to the glass.
- A day is six bells, about fifteen seconds each, with Pause and fast-forward.
- Report card: sentences, at most one count per line. "Everyone swam today." "Two pupils
  couldn't get up to the track. How could they get there?" Then the debrief question and a
  patch if earned.

## 11. Site Meetings and the Ideas book

Site Meetings are the Big Questions in the mission table, each with three or four picture
options, a reveal that never names a winner, and a Changed-Mind star.

The Ideas book holds ten real schools as block dioramas built in the app's own forms, each with
one sentence, one sourced number and a Try it button that drops the idea on the site: the six
on Phil's sheet (Evelyn Grace Academy, Frederiksbjerg School, YueCheng Courtyard Kindergarten,
Tiantai No. 2 Primary, Fuji Kindergarten, Farming Kindergarten) plus four from the research
(Cathedral Grammar Junior School's roof slide, School of Dancing Arches, Pitisuksa Chiang Rai's
canal, Gangjin Children's Centre's sea-view slide). Cards link out for the real photo; no
licensed photos are shipped.

## 12. Rewards

Patches: First Form, Two Floors, Happy Neighbours, Sea-view Classroom, Waterfall Yoga, Pool
Party, Fish Tunnel, Roof Runner, Slide-tastic, Arch Builder, Three Drawings, Everyone Learned
Today, Brief Complete, Open Day, Head Architect (ten days run). Changed-Mind stars. The Crew Log
keeps every drawing sheet.

## 13. Drawing sheet (the homework export)

One tap renders a 2048 by 1448 PNG: "Finn's Dream School", the ground-floor plan, the roof
plan, a section, a model view, a colour key of rooms, and a sentence generated from the model
("My school has four classrooms facing the sea, a pool, a fish tunnel and a running track on
the roof"). Saved with the Web Share API on the tablet, download on PC. Designs save to
localStorage (six slots), export as JSON, and share as a link via lz-string.

## 14. What we reuse (verified, see research/03)

| Piece | Source | Licence |
|---|---|---|
| Rendering, cameras, water, sky, labels, glTF, clipping, instancing, tube and extrude geometry | Three.js 0.170.0 addons and core, already pinned | MIT |
| Grid snapping maths | Three.js voxel painter example | MIT |
| Touch joystick | nipplejs 1.0.4 | MIT |
| Tile reordering | SortableJS 1.15.7 | MIT |
| Share links | lz-string 1.5.0 | MIT |
| Picture tiles | Twemoji 14.0.2 SVGs from jsDelivr | CC BY 4.0 |
| Pupils, teachers, scale figure | Kenney Mini Characters (.glb with 32 clips) | CC0 |
| Trees, rocks, cliffs | Kenney Nature Kit | CC0 |
| Desks, chairs, bookcases | Kenney Furniture Kit | CC0 |
| Fish | Kenney Fish Pack (2D sprites) | CC0 |
| Mission engine, Read aloud, patches, store, PWA tooling, screenshots | Astra Finn | ours |
| Chimes and bleeps | Astra Bleeps | ours |
| Tiles-plus-state-machine model; walls where cells differ; one-finger scheme; ghost preview | SimCity clone, blueprint3d, Townscaper, Islanders | patterns only |

Bespoke: forms geometry, the Building skin, the builder UI, the tile strip, pathfinding, the
day simulation, the Brief detectors, the drawing sheet, the site maps, the water normal map.

## 15. Technical shape

Plain HTML, CSS and ES modules; import map pinned to Three.js 0.170.0, nipplejs 1.0.4,
SortableJS 1.15.7, lz-string 1.5.0; every CDN file and Twemoji SVG in the precache list; relative
paths; own repo and address `/astra-architect/`; manifest `id` "/astra-architect/"; cache prefix
`astraarch-`.

```
index.html  manifest.webmanifest  sw.js  css/app.css
js/app.js              mission engine (from Astra Finn), Studio shell, read-aloud
js/core/store.js grid.js catalogue.js scene.js terrain.js forms.js rooms.js skin.js
        views.js builder.js brief.js sheet.js
js/sim/path.js pupils.js program.js day.js
js/missions/site.js programme.js scale.js shapes.js drawings.js circulation.js openday.js
js/ui/tray.js strip.js cards.js patches.js bubbles.js
content/missions.json rooms.json forms.json materials.json meetings.json ideas.json
        brief.json pupils.json
assets/site/map.jpg height.png zones.png water-normal.png
assets/models/characters/*.glb nature/*.glb furniture/*.glb   assets/img/fish/*.png
assets/img/CREDITS.md
research/01-precedents.md 02-numbers.md 03-libraries-and-assets.md 04-teaching.md
tools/build_sw.py sw.template.js shot.sh make_site_maps.py make_water_normal.py
dev/harness.html test-sw.html
```

Budget: terrain 20k triangles, 200 forms 16k, twelve characters 12k, trees 10k, water and fish
5k, under 60k. Lambert materials, hemisphere light plus the sun as one directional light with a
1024 shadow map (shadows are the Mission 5 lesson; a toggle turns them off on a slow tablet).
`devicePixelRatio` capped at 1.5, render loop paused when hidden, simulation on a fixed step.

Look: daylight, designed room colours, white UI with bold colour tiles, nothing cartoony.

## 16. Data model

```json
{
  "name": "Finn's Dream School",
  "cells": [
    { "id": 1, "form": "arch", "x": 22, "z": 14, "level": 0, "rot": 1,
      "room": "aquarium", "material": "glass" }
  ],
  "paint": [ { "x": 20, "z": 10, "level": 1, "kind": "track" } ],
  "sun": 0.35,
  "pupils": [
    { "name": "Finn", "model": "male-b", "colour": "blue",
      "strip": ["go:pool", "do:swim", "wait:bell", "go:track", "do:run", "again:3"] }
  ],
  "bells": ["learn", "swim", "eat", "yoga", "run", "look"],
  "brief": ["yoga-waterfall", "sea-classroom", "pool", "arch-aquarium", "roof-track"],
  "missions": { "site": "done", "programme": "done" }
}
```

## 17. Build phases

**Phase 1, Design it (first sitting)**: site, forms, rooms with neighbour faces, Plan / Model /
Walk, the Brief, save and load, the drawing sheet, Missions 1 (Site Visit), 2 (The Shopping
List) and 4 (Shapes That Work), the Studio, PWA install and offline. Enough for the homework.

**Phase 2, Bring it to life**: Kenney pupils, the tile strip, pathfinding, bells, the day,
report card, patches, Missions 6 (Getting Around) and 7 (Open Day), Pupil cam.

**Phase 3, Think like an architect**: Missions 3 (How Big?) and 5 (Drawings and Light) with
Section and Side views and the sun, the Building skin, materials, the Bubble view, the Ideas
book, rule tiles, interiors, fish, sound.

## 18. Delegation

Fable builds the engine port, terrain, forms, rooms, skin, views, builder, pathfinding and the
simulation. Haiku 5.5 agents in parallel, each writing only its own files:

1. `research/01-precedents.md`: verify the ten schools, one link and one number each.
2. `research/02-numbers.md`: the few numbers the cards use, with child-sized comparisons.
3. `content/missions.json`: the seven missions' story, guess, Big Question, at-home and debrief
   text in Astra Finn's step format, one to three sentences per card.
4. `content/rooms.json`, `forms.json`, `materials.json`, `brief.json`: names, wants, one-line
   cards, read-aloud text.
5. `content/meetings.json` and `ideas.json`: Site Meetings written to split a crew; Ideas cards
   with starter arrangements as cell lists.
6. `tools/make_site_maps.py` first pass: zones and heights from the map colours.
7. `assets/img/CREDITS.md` and the Twemoji codepoint list for every tile.

Downloading the three Kenney zips is a step Phil approves. Review all agent output before
shipping.

## 19. Testing and done

- `tools/shot.sh <name> "<path-and-hash>"` on port 8100; `?devdesign` loads a sample school;
  `?debugwalk=1` starts in Walk; `?debugday=1` runs a day at speed and prints the report.
- `dev/harness.html?module=path` runs the pathfinder on fixtures; `?module=brief` checks the
  five detectors against sample schools.
- `python tools/build_sw.py` before every commit; offline test with headless Edge and
  `dev/test-sw.html`.
- Done means: installed from the public link on the tablet, Missions 1, 2 and 4 finished end to
  end with no console errors, the five wishes ticked from a school Finn built, a drawing sheet
  saved to the tablet, and the app opening with Wi-Fi off after one online visit.

This app is Finn's own, for his homework: no other children's names appear in it. Pupils
are Finn plus made-up classmates he can rename.

## 20. Assumptions (confirmed 12 Oct 2026)

- Name: Astra Architect.
- The site map was made for this project and can ship inside the app.
- OK to download the Kenney Mini Characters, Nature Kit and Furniture Kit zips (CC0).
- The class list for `content/pupils.json`.
- The drawing sheet PNG is the homework format.
