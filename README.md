# Meridian — Sea level, ice & borders

Interactive 3D Earth for sea-level rise, polar ice loss, and country territory
under IPCC-shaped pathways. Built to run smoothly on a phone: pick a warming
pathway, press **Play**, and watch seas rise, ice retreat, and every country
warm through 2300.

## Run (development)

```bash
npm install
npm run dev
```

Open http://127.0.0.1:5173/

- **Play / pause** animates the year 2020 → 2300 for the selected pathway.
- Drag the **year** slider to scrub to any point (this pauses playback).
- Switch **pathways** at any time — the timeline keeps its year so you can
  compare outcomes.
- Toggle the map between **temperature** and **land loss**; tap a country (or a
  row in the table) to focus it.

## Performance notes

The globe is the expensive part, so on phones the app:

- lazy-loads Three.js in a separate chunk (initial JS is ~70 kB gzipped);
- caps the device pixel ratio and disables antialiasing on small screens;
- thins the on-globe labels while playing and re-shows them when paused;
- commits the timeline ~14×/s (not every frame) and pauses rendering entirely
  when the tab is hidden.

## Build & deploy

```bash
npm run build   # → static bundle in dist/
npm start       # serves dist/ on $PORT (default 3000)
```

`server.js` is a zero-dependency static server (gzip, long-lived caching for
hashed assets, SPA fallback). See **Deploy on Railway** below.

## Pathways

| Path | ~2100 warming | What it takes (short) |
| --- | --- | --- |
| No change | 1.15°C held | Near-zero new emissions immediately (counterfactual) |
| Mitigation | ~1.8°C | Fast cuts, mid-century net-zero |
| Current trend | ~2.7°C | Policies continue, incomplete fossil phase-out |
| Pessimistic | ~4.4°C | Fossil-heavy growth, little mitigation |
| Very hot 6°C | ~6°C | High emissions + high climate sensitivity |
| Catastrophic 8°C | ~8°C | Warning envelope — “burn everything” + feedbacks |

Each pathway shows a **What it takes** list in the UI. Year range: **2020–2300**.

## Ice

Polar ice is shown as **bars** (Arctic summer sea ice, Greenland, Antarctica). Arctic summer ice is near-linear with warming (no classical tip). Ice sheets can tip into multi-century–millennial committed loss.

## Water: rain & rivers

The **Rain** map shows each country's projected change in annual precipitation
(baseline from World Bank climatology where available). Seventeen major river
basins are drawn on the globe in that view, coloured blue where flow rises and
rust where it falls, and listed in the **Rivers & freshwater** panel with
today's discharge → projected discharge.

River flow is modelled from three competing mechanisms:

- **Glacier melt — "peak water".** Retreating glaciers *release* stored ice, so
  flow rises first, peaks, then collapses once the ice is gone. The Indus and
  Amu Darya are the clearest cases.
- **Snowpack.** Snow turning to rain mostly shifts *timing*, but in warm basins
  earlier melt plus a longer growing season evaporate a real share of the
  annual volume (the Colorado loses roughly 9% of its flow per °C). Cold
  high-latitude basins keep nearly all of it — which is why Arctic rivers like
  the Lena gain water, matching observations.
- **Rain and evaporation.** Basin rainfall shifts (wet-get-wetter,
  dry-get-drier) while hotter air evaporates more before it reaches the
  channel, so a basin can get the same rain and still lose river flow.

## Deploy on Railway

The repo ships a multi-stage `Dockerfile` and `railway.json`, so Railway builds
and runs it with no extra configuration.

1. Push this repo to GitHub.
2. In Railway: **New Project → Deploy from GitHub repo** (or `railway up` with
   the CLI).
3. Railway detects `railway.json`, builds the `Dockerfile`, and starts
   `node server.js`. It injects `$PORT`, which the server binds automatically —
   nothing to set.
4. Open the generated domain (add a custom domain under the service's
   **Settings → Networking** if you want one).

The build stage compiles the static bundle; the run stage carries only `dist/`
and `server.js` (no `node_modules`), so the runtime image stays small.

## Limits

Illustrative first-pass model — not a local flood map, not a full CMIP downscaling.
