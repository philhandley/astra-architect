# Astra Architect: Finn's Dream School

A tablet app for Finn (six, Year 2) and a grown-up. Finn designs his dream school on the painted site from his homework, gives each block a job, sees it the way an architect does (plan, section, model, walk-through), codes the pupils with picture tiles and runs a school day.

Live: https://philhandley.github.io/astra-architect/ (install it from the browser menu: Add to Home screen).

- `PLAN.md` is the specification, `ENGINE.md` the shared vocabulary for code and content.
- `research/` holds the sources for every fact, library and teaching idea.
- `assets/CREDITS.md` lists every asset and licence.

## Run it locally

```bash
python tools/serve.py 8400
```

Then open http://localhost:8400/?devcrew . Testing helpers: `?devcrew` skips the names screen, `?devdesign` loads a sample school, `?debugwalk` starts the Studio in Walk view, `?debugday` runs a school day straight away. In the console, `__world.advance(5)` runs the 3D world forward five seconds (useful in a hidden tab).

## Update the live app

```bash
python tools/fetch_emoji.py
python tools/build_sw.py
git add -A && git commit -m "Describe the change"
git push
```

GitHub Pages redeploys in about two minutes. The service worker caches everything after one online visit, so the app works with Wi-Fi off.

## Tools
- `tools/make_site_maps.py` turns the painted map into the zone grid and heights (`assets/site/site.json`) and the 1600 px ground texture.
- `tools/make_icons.py` draws the app icons.
- `tools/fetch_emoji.py` downloads any Twemoji pictures the code or content uses.
- `tools/shot.sh` takes a headless Chrome screenshot of the local server.
- Offline check: start `python tools/slowserve.py 8401`, then run `bash tools/swtest.sh` (headless Edge loads `dev/test-sw.html` and lists what the service worker cached).
- `?reset` in the address wipes the saved state (testing only).
