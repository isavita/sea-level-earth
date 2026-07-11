# Meridian — Sea level, ice & borders

Interactive Earth model for sea-level rise, polar ice loss, and country territory under IPCC-shaped pathways.

## Run

```bash
npm install
npm run dev
```

Open http://127.0.0.1:5173/

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

## Limits

Illustrative first-pass model — not a local flood map, not a full CMIP downscaling.
