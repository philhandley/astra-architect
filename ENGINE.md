# Astra Architect engine contract

Shared vocabulary for code and content. Content files must use these ids exactly.

## The grid

- The site is 60 cells wide (x, west to east) and 42 cells deep (z, north to south).
  North (z = 0) is the mountains and waterfall; south (z = 41) and east are the beach and sea.
- One cell is one room-sized space. Levels: 0 is the ground floor, 1 the first floor, up to 4.
- A form on level 1 or above must sit on at least one form below it.
- `rot` is a quarter turn clockwise seen from above: 0, 1, 2 or 3. rot 1 turns +x into +z.

## Forms (shapes)

Footprints are given for rot 0, with (x, z) the form's origin cell.

| id | footprint at rot 0 | height | notes |
|---|---|---|---|
| cube | (x,z) | 1 level | a room |
| long | (x,z) (x+1,z) | 1 level | hall, corridor |
| tower | (x,z) | 2 levels | climbing wall, lookout |
| slab | (x,z) (x+1,z) | low | pool, deck, bridge, jetty; nothing stacks on it |
| arch | (x,z) (x+1,z) | 1 level | a tunnel runs through it along x |
| curve | (x+1,z) (x,z+1) (x+1,z+1) | 1 level | a quarter ring whose centre is the corner point (x,z). Four make a ring: around corner point (cx,cz) use rot 0 at (cx,cz), rot 1 at (cx-2,cz), rot 2 at (cx-2,cz-2), rot 3 at (cx,cz-2); the four cells around the centre stay empty as a courtyard |
| cylinder | (x,z) | 1 level | round room |
| dome | (x,z) (x+1,z) (x,z+1) (x+1,z+1) | 1 level | nothing stacks on it |
| wedge | (x,z) | 1 level | a ramp rising towards +x; a slide comes down it from the cell at x+1 one level up |
| roof | (x,z) | cap | pitched roof; nothing stacks on it |
| pad | (x,z) | flat | a tile on the ground or on a roof: track, garden, deck |
| steps | (x,z) | 1 level | stairs up to the level above |

## Rooms

| id | name | default form | allowed forms |
|---|---|---|---|
| classroom | Classroom | cube | cube long tower cylinder curve dome arch |
| hall | Hall | long | long cube dome curve cylinder arch |
| library | Library | cube | cube long cylinder tower curve |
| lunch | Lunch room | cube | cube long cylinder dome |
| aquarium | Aquarium | arch | arch curve dome tower cylinder |
| yoga | Chill-out room | cylinder | cylinder dome cube curve |
| pool | Swimming pool | slab | slab |
| climbing | Climbing wall | tower | tower |
| slide | Slide | wedge | wedge |
| stairs | Stairs | steps | steps |
| track | Running track | pad | pad |
| garden | Garden | pad | pad |
| lookout | Lookout | tower | tower cylinder |
| bridge | Bridge | slab | slab |
| changing | Changing room | cube | cube |
| toilets | Toilets | cube | cube |
| art | Art room | cube | cube long cylinder dome |
| music | Music room | cube | cube cylinder dome |

A design cell list entry: `{ "form": "arch", "room": "aquarium", "x": 3, "z": 1, "level": 0, "rot": 0 }`.

## Activities (for code tiles and the bell timetable)

learn, read, play, swim, run, climb, slide, yoga, eat, look, grow, art, music.

## Mission content files (`content/<id>.json`)

```json
{
  "id": "site",
  "title": "Site Visit",
  "tagline": "One short line.",
  "idea": "Site",
  "emoji": "🗺️",
  "accent": "green",
  "minutes": 10,
  "patch": { "name": "Site Surveyor", "icon": "map" },
  "grownUp": ["Two or three short notes for the grown-up."],
  "steps": [ ...step objects... ]
}
```

accent: one of orange, teal, green, plum, blue, red, yellow.
patch.icon: one of map, bubbles, ruler, arch, pencil, footsteps, star.

Step types:

- `story`: `{ "type": "story", "title", "text", "emoji", "wow"?, "ask"?, "source"? }`.
  text is one to three sentences. emoji is one to three emoji shown big as the picture.
  ask is a question for the grown-up to ask Finn. Any number needs a source URL.
- `guess`: `{ "type": "guess", "title", "prompt", "choices": [{ "label", "emoji" }], "answer": <index>, "reveal", "source"? }`.
  A fact with a right answer, three choices.
- `question` (the Big Question, no right answer): `{ "type": "question", "title", "scenario", "options": [{ "label", "emoji", "detail" }], "reveal", "followUp" }`.
  Three or four options. The reveal never says which option is correct.
- `play`: `{ "type": "play", "module", "title", "intro", "data" }`. Modules: `studio`, `sort`, `shapes`.
- `athome`: `{ "type": "athome", "title", "need": [], "steps": [], "why" }`.
- `finish`: `{ "type": "finish", "debrief": ["What was your favourite part?", "one more question"] }`.

`content/missions.json` is the ordered list of mission ids.

## Ideas book (`content/ideas.json`)

```json
[{ "id": "fuji", "name": "Fuji Kindergarten", "architect": "Tezuka Architects",
   "place": "Tokyo, Japan", "year": 2007, "idea": "A roof you run round",
   "text": "One or two sentences for a six-year-old.",
   "number": { "text": "One number with a comparison a six-year-old can picture.", "source": "https://..." },
   "link": "https://... the architect's or a reputable page",
   "emoji": "🏃",
   "cells": [ ...design cell entries, within an 8 by 8 area starting at x 0, z 0... ] }]
```
