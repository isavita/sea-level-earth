/**
 * Where the numbers come from, how this model works, and where to go next.
 *
 * Every external link here is a stable, canonical home page for a major
 * climate institution or tool — no deep links that rot.
 */

export interface ReadingLink {
  title: string
  href: string
  blurb: string
  /** Short tag shown on the card. */
  kind: 'Report' | 'Tool' | 'Tracker' | 'Data' | 'Explainer'
}

export interface ReadingGroup {
  heading: string
  intro: string
  links: ReadingLink[]
}

export const READING_GROUPS: ReadingGroup[] = [
  {
    heading: 'Model it yourself',
    intro:
      'This globe is a sketch. These let you turn the dials properly — and are the best next step if the scenarios here raised a question.',
    links: [
      {
        title: 'En-ROADS climate simulator',
        href: 'https://en-roads.climateinteractive.org/',
        kind: 'Tool',
        blurb:
          'Move sliders on energy, pricing, forests and methane and watch 2100 warming respond live. The single best way to feel why some levers matter more than others.',
      },
      {
        title: 'IPCC AR6 Sea Level Projection Tool',
        href: 'https://sealevel.nasa.gov/ipcc-ar6-sea-level-projection-tool',
        kind: 'Tool',
        blurb:
          'NASA’s official interface to the AR6 sea-level projections — by scenario, by year, and crucially by location, including the low-confidence ice-sheet branches.',
      },
      {
        title: 'Climate Central coastal risk screening',
        href: 'https://coastal.climatecentral.org/',
        kind: 'Tool',
        blurb:
          'Street-level maps of what actually floods at a given sea level. This is the local detail a country-scale globe cannot give you.',
      },
    ],
  },
  {
    heading: 'The science behind the pathways',
    intro:
      'The warming and sea-level numbers in this app are shaped by these assessments.',
    links: [
      {
        title: 'IPCC AR6 — The Physical Science Basis',
        href: 'https://www.ipcc.ch/report/ar6/wg1/',
        kind: 'Report',
        blurb:
          'The Working Group I report behind every range used here. The Summary for Policymakers is readable in an hour and is the reference for warming, sea level and ice.',
      },
      {
        title: 'How the SSP pathways work',
        href: 'https://www.carbonbrief.org/explainer-how-shared-socioeconomic-pathways-explore-future-climate-change/',
        kind: 'Explainer',
        blurb:
          'Carbon Brief’s plain-English guide to SSP1-2.6, SSP2-4.5 and SSP5-8.5 — what each socioeconomic story assumes, and why SSP5-8.5 is now treated as a high-end case.',
      },
      {
        title: 'Climate Action Tracker',
        href: 'https://climateactiontracker.org/',
        kind: 'Tracker',
        blurb:
          'Where current policies and pledges actually put 2100 warming. The reality check on the “Current trend” pathway in this app.',
      },
    ],
  },
  {
    heading: 'Where the models and the measurements disagree',
    intro:
      'The Earth-system pathways in this app come from here — places the last two decades of observation sit awkwardly against the projections.',
    links: [
      {
        title: 'NASA CERES — Earth’s radiation budget',
        href: 'https://ceres.larc.nasa.gov/',
        kind: 'Data',
        blurb:
          'The satellite record behind the albedo story: how much sunlight the planet reflects and how much heat it keeps, measured directly. The growing energy imbalance shows up here first.',
      },
      {
        title: 'Copernicus — Earth’s energy budget and albedo',
        href: 'https://climate.copernicus.eu/',
        kind: 'Data',
        blurb:
          'Monthly bulletins tracking the record-warm years and the cloud and sea-ice changes that accompanied them — the observational side of the “darkening Earth” pathway.',
      },
      {
        title: 'RAPID — Atlantic overturning observations',
        href: 'https://rapid.ac.uk/',
        kind: 'Data',
        blurb:
          'The mooring array that has measured the Atlantic overturning circulation continuously since 2004. The only direct check on whether the circulation behind the “Atlantic stalls” pathway is actually weakening.',
      },
      {
        title: 'Global Carbon Project — the annual carbon budget',
        href: 'https://globalcarbonproject.org/',
        kind: 'Report',
        blurb:
          'How much carbon land and ocean actually absorbed each year. The source for the sink weakening behind the “Sinks give way” pathway, including the anomalous 2023 land sink.',
      },
    ],
  },
  {
    heading: 'Watch it happen',
    intro: 'Monitoring programmes publishing what the planet is doing now.',
    links: [
      {
        title: 'NSIDC Arctic Sea Ice News & Analysis',
        href: 'https://nsidc.org/arcticseaicenews/',
        kind: 'Data',
        blurb:
          'Monthly Arctic sea-ice extent with expert commentary — the observational record behind the ice panel.',
      },
      {
        title: 'World Glacier Monitoring Service',
        href: 'https://wgms.ch/',
        kind: 'Data',
        blurb:
          'Global glacier mass-balance records. This is the evidence base for peak water in the Indus, Amu Darya and Andean basins.',
      },
      {
        title: 'Copernicus Climate Change Service',
        href: 'https://climate.copernicus.eu/',
        kind: 'Data',
        blurb:
          'Europe’s monthly global temperature and climate bulletins — how far along the pathway we currently are.',
      },
      {
        title: 'Our World in Data — CO₂ & greenhouse gases',
        href: 'https://ourworldindata.org/co2-and-greenhouse-gas-emissions',
        kind: 'Data',
        blurb:
          'Emissions by country, sector and person, with the historical cumulative totals that decide which pathway is still reachable.',
      },
    ],
  },
]

export interface ModelNote {
  title: string
  body: string
}

/**
 * A worked account of one layer of the model: what question it answers, the
 * chain of steps that produce the number, and where that chain stops being
 * trustworthy.
 *
 * The one-line `MODEL_NOTES` say *what* each layer does. These say *how*, in
 * enough detail that a reader can decide whether to believe a given figure —
 * which is the only honest way to present a model that looks this much like a
 * forecast without being one.
 */
export interface ModelExplainer {
  id: string
  title: string
  /** The question this layer exists to answer. */
  question: string
  /** Ordered steps, each a plain-language line of the calculation. */
  steps: string[]
  /** The key relationship, written out. */
  formula?: string
  /** What this layer cannot tell you. */
  limits: string
}

export const MODEL_EXPLAINERS: ModelExplainer[] = [
  {
    id: 'pathway',
    title: 'From a pathway to a year',
    question: 'What is the global temperature and sea level in the year on the slider?',
    steps: [
      'Each pathway stores six anchor years — 2020, 2030, 2050, 2100, 2150 and 2300 — for both global mean warming and global mean sea level.',
      'Anchors are shaped to IPCC AR6 central estimates. The 6°C and 8°C paths sit deliberately beyond the assessed ranges as stress tests.',
      'Any year between anchors is a straight-line interpolation; before the first or after the last anchor the value is held flat.',
      'Everything else in the app is driven from those two numbers, so the whole map is a function of a single point on a single curve.',
    ],
    formula:
      'value(year) = v₀ + (v₁ − v₀) × (year − y₀) ÷ (y₁ − y₀), between the surrounding anchors',
    limits:
      'Linear interpolation smooths over the real shape between anchors, and a single global curve cannot represent year-to-year variability, volcanoes or El Niño. The curve is the assumption, not a result.',
  },
  {
    id: 'temperature',
    title: 'Global warming to local warming',
    question: 'Why does one country warm faster than another under the same pathway?',
    steps: [
      'Start from the pathway\u2019s global mean warming for that year.',
      'Multiply by a zonal ratio read off the country\u2019s latitude. The profile is asymmetric: the Arctic runs 2–3× the global rate, while the Southern Ocean is the slowest-warming water on Earth and Antarctica sits near the global mean.',
      'Apply land–sea contrast. Continentality is estimated as area ÷ perimeter — how far a typical point sits from the coast — which sorts sensibly from the Bahamas at 5 km to Brazil at 374 km.',
      'Apply the North Atlantic warming hole, a local damping centred on the subpolar gyre south of Greenland.',
      'Earth-system pathways then add their own patterns on top: a stronger albedo feedback weighted to ice and snow, and aerosol unmasking weighted to the industrial northern hemisphere.',
      'Finally, subtract any Atlantic-circulation cooling. That term is absolute rather than a multiplier, because it is the one mechanism that can leave a region colder than it started.',
    ],
    formula:
      'local °C = global °C × (zonal × land–sea × warming-hole + albedo + aerosol) − AMOC cooling',
    limits:
      'A country-sized average of a field that varies enormously inside big countries, with no altitude, vegetation or urban effects. It is a sketch of the pattern, not a downscaled model run.',
  },
  {
    id: 'sealevel',
    title: 'Global sea level to a specific coast',
    question: 'Why does the same global rise flood one country and spare another?',
    steps: [
      'Split the global rise into four contributors — thermal expansion, mountain glaciers, Greenland and Antarctica — in proportions taken from AR6. Ice-sheet instability shifts that split toward Antarctica, which changes the pattern as well as the total.',
      'Give each mass contributor a gravitational fingerprint. A shrinking ice sheet\u2019s pull weakens, so relative sea level actually falls within roughly 2,000 km of it and overshoots by 10–30% in the far field.',
      'Add ocean dynamics: a slowing Atlantic circulation banks water against north-east North America. This one is measured to the nearest point of the country\u2019s coastline rather than its centroid, because the effect fades within about 1,300 km and most large countries have their middle far inland.',
      'Add vertical land motion, in mm/yr multiplied by the years since the 1995–2014 baseline. Post-glacial rebound lifts Scandinavia faster than the sea rises; groundwater extraction sinks deltas faster still.',
      'The result is a local rise in metres, which is what the land-loss calculation is then run against.',
    ],
    formula:
      'local rise = global × (fingerprints + dynamics) + land motion × years since 2005',
    limits:
      'One number per country for something that varies along every coastline, and Jakarta sinks an order of magnitude faster than Indonesia\u2019s average here. Not a flood map and not a planning number.',
  },
  {
    id: 'landloss',
    title: 'A local rise to land lost',
    question: 'How does a rise in metres become an area in km²?',
    steps: [
      'Each country carries a measured share of land below 5 m — the low-elevation coastal zone — from the World Bank\u2019s indicator, itself derived from CIESIN\u2019s elevation dataset.',
      'That single measured point is expanded into a small elevation curve at 1, 2, 3, 5, 7 and 10 m, using a fixed shape scaled to the country\u2019s own 5 m value.',
      'The local sea-level rise is looked up on that curve, interpolating between the bracketing heights, to give the fraction of land below the new sea level.',
      'Multiply that fraction by the country\u2019s land area.',
    ],
    formula: 'land lost = area × fractionBelow(local rise)',
    limits:
      'This is exposure by elevation and nothing else. It ignores flood defences, sediment supply, and the difference between land that floods once a decade and land that is permanently under water. Real losses depend on dikes and deltas as much as on elevation.',
  },
  {
    id: 'rain',
    title: 'Rainfall',
    question: 'Where does it get wetter, and where does it dry out?',
    steps: [
      'Start from a measured baseline: World Bank annual precipitation where it exists, otherwise a latitude climatology, and the panel marks which is in use.',
      'Apply a zonal sensitivity per °C of warming above the 2020s — wetter in the deep tropics and at high latitudes, drier through the subtropics.',
      'Apply regional corrections where latitude alone gets the sign wrong: the monsoons, the Mediterranean, southwest North America, southern Africa, Chile, southern Australia and eastern Amazonia.',
      'Damp the relative swing in very dry countries, where a small absolute change is a huge percentage.',
      'Under a stalled Atlantic circulation, add the southward shift of the tropical rain belt. That is a change in where rain falls rather than a response to temperature, so it is added on top rather than scaled by warming.',
    ],
    formula:
      'Δrain = sensitivity(lat, region) × warming above 2020s × dryness damping + circulation shift',
    limits:
      'Annual totals only. It says nothing about whether the rain arrives as useful soaking or as a flood, and the intensification of extreme rainfall is a bigger deal than the change in the annual mean.',
  },
  {
    id: 'fire',
    title: 'Fire weather',
    question: 'Where does warming actually make fire more likely?',
    steps: [
      'Fire needs three things at once: fuel to burn, dry fuel, and air thirsty enough to keep it dry. Modelling it as a straight function of temperature would rank the Sahara as the most flammable place on Earth.',
      'Estimate the warm-season temperature, not the annual mean. Fire is a summer event, and the annual mean hides it — Siberia averages about −5°C and still burns, because its summers reach the high teens. The seasonal swing comes from latitude and continentality.',
      'Convert that to vapour pressure deficit: how much more moisture the air could hold than it does. Saturation vapour pressure follows Clausius–Clapeyron and rises about 7% per °C, so drying power accelerates with warming even where rainfall is unchanged.',
      'Estimate fuel from annual rainfall. It rises steeply out of true desert and saturates once there is a closed canopy.',
      'Damp permanently wet forest, which carries huge fuel loads but rarely burns — unless the pathway is drying it, which is the Amazon dieback route.',
      'Weight by the share of the year warm enough to burn, so a short but ferocious boreal season still counts.',
    ],
    formula:
      'index = drying power (VPD) × fuel available × √(season length) × wet-forest damping',
    limits:
      'This is fire weather, not fire itself. It has no ignition source, no wind, no fuel management, and no people — and most fires are started by people. A high index means the conditions are there, not that the land will burn.',
  },
  {
    id: 'rivers',
    title: 'River flow',
    question: 'Why do some rivers rise before they fall?',
    steps: [
      'Combine three competing sources: glacier melt, snowpack, and rainfall net of evaporation.',
      'Glacier melt follows a peak-water curve — more ice melts each year until so little ice is left that the melt contribution collapses.',
      'Snowpack loss scales with how warm the basin is getting, since more precipitation falls as rain and melts sooner.',
      'Rainfall net of evaporation uses the rainfall model, minus the extra evaporative demand that warming creates.',
      'The sum is why a glacier-fed river can gain flow for decades and then lose most of it, and why a basin can keep its rainfall and still lose its river.',
    ],
    limits:
      'Basin-scale and annual. It does not model reservoirs, abstraction for irrigation, or the seasonal timing that actually determines whether a crop survives.',
  },
  {
    id: 'ice',
    title: 'Ice',
    question: 'How fast do the sea ice and the ice sheets go?',
    steps: [
      'Arctic September sea ice is treated as near-linear in global warming, which is what AR6 finds — there is no classical tipping point in the observations or the models.',
      'The Greenland and Antarctic ice sheets move on century-to-millennial clocks, so their bars change slowly even under extreme forcing.',
      'The first ice-free September is looked up per pathway. Earth-system pathways cluster earlier, because the mechanisms that define them act on the Arctic first — with one exception: a stalled Atlantic circulation slows the northward heat transport eroding the ice from below, and buys it a couple of decades.',
    ],
    limits:
      'The committed loss is far larger than the loss shown by 2300. The bars answer "how much has gone by then", not "how much is already unavoidable", and for the ice sheets those are very different numbers.',
  },
]

/** How each layer of this app is actually computed. */
export const MODEL_NOTES: ModelNote[] = [
  {
    title: 'Warming pathways',
    body: 'Each pathway is a curve of global mean temperature and sea level through anchor years (2020, 2030, 2050, 2100, 2150, 2300), interpolated in between. The values are shaped to IPCC AR6 central estimates; the 6°C and 8°C paths sit deliberately beyond the assessed ranges as stress tests.',
  },
  {
    title: 'Earth-system pathways',
    body: 'A second family that holds emissions near the current-policy trend and varies how the planet responds instead. Each one is built on a place where the last two decades of observation sit awkwardly against the models: a planet reflecting less sunlight, reflective pollution being cleaned up faster than the CO₂ beneath it decays, carbon sinks weakening, and an Atlantic circulation that models hold more stable than the evidence supports. They change where the warming lands as well as how much there is, so the map genuinely redraws — most visibly under a stalled Atlantic, the one mechanism here that can leave a region colder than it started.',
  },
  {
    title: 'Reflected sunlight',
    body: 'Earth’s energy imbalance roughly doubled between 2005 and 2019, and the larger share came from the planet reflecting less sunlight rather than trapping more heat — 2023 then set a record-low planetary albedo, traced mainly to retreating low cloud. In this app that shows up as extra warming weighted to where the bright surfaces are: the Arctic sea-ice margin and northern snow line take most of it, the northern mid-latitudes pick up the cloud signal, and the Antarctic sea-ice zone gets a smaller share because the Southern Ocean carries the heat downward instead.',
  },
  {
    title: 'Aerosol unmasking',
    body: 'Sulphate pollution reflects sunlight and brightens marine cloud, hiding part of the warming already committed by the CO₂ emitted alongside it. Cutting it — the 2020 marine fuel sulphur cap, East Asian air-quality policy — removes that shield far faster than the CO₂ decays. Modelled here as extra warming over the regions that carried the haze: East and South Asia, Europe, eastern North America and the busiest shipping lanes.',
  },
  {
    title: 'Atlantic overturning',
    body: 'The only mechanism modelled here that can make somewhere colder in a warming world. It is applied as an absolute cooling rather than a multiplier, because a fraction of a positive global mean can never produce a region that ends up below where it started. Magnitudes follow the collapse literature — strongest over the Nordic seas and Iceland, several degrees over Britain, Ireland and Scandinavia, tapering across western Europe. The same slowdown banks water against north-east North America, measured to the nearest point of a country’s coastline rather than its centroid, since the effect falls off within roughly 1,300 km and most large countries have their middle a long way inland.',
  },
  {
    title: 'Country temperature',
    body: 'Local warming scales the global figure by three patterns: an asymmetric zonal profile (the Arctic runs 2–3× the global rate, while the Southern Ocean is the slowest-warming water on Earth and Antarctica sits near the global mean), land–sea contrast so continental interiors outrun maritime margins, and the North Atlantic warming hole south of Greenland. A sketch of the pattern, not a downscaled model — no altitude or vegetation detail.',
  },
  {
    title: 'Land lost to the sea',
    body: 'Each country carries a measured share of land below 5 m (the low-elevation coastal zone), and losses at other heights are interpolated from that share. Rise is resolved per coast rather than globally: melting ice sheets pull the ocean toward them, so relative sea level falls near a shrinking one and overshoots by 10–30% in the far field; a slowing Atlantic circulation banks water on north-east North America; and land motion — post-glacial rebound lifting Scandinavia, groundwater extraction sinking deltas — can outweigh the climate signal. Exposure by elevation, not flood defences, sediment gain, or where a specific city floods.',
  },
  {
    title: 'Fire weather',
    body: 'Fire needs fuel, dryness and heat at the same time, so it is modelled as a product of three terms rather than as a function of temperature — which would rank the Sahara as the most flammable place on Earth. The drying term is vapour pressure deficit evaluated at the warm-season temperature, not the annual mean: fire is a summer event, and Siberia averages about −5°C while still burning millions of hectares. VPD rises roughly 7% per °C by Clausius–Clapeyron, so the drying power of the air accelerates with warming even where rainfall holds steady. This is fire weather, not fire: there is no ignition, no wind and no people in it.',
  },
  {
    title: 'Rainfall',
    body: 'A smooth zonal pattern — wet tropics, dry subtropics, wetter mid and high latitudes — plus regional corrections for the monsoons, the Mediterranean, southwest North America, southern Africa, Chile, southern Australia and eastern Amazonia, where latitude alone gets the sign wrong.',
  },
  {
    title: 'Rivers',
    body: 'Flow combines three competing mechanisms: glacier melt on a peak-water curve, snowpack whose annual loss scales with basin warmth, and rainfall net of evaporation. This is why some rivers rise before they fall, and why a basin can keep its rain and still lose its river.',
  },
  {
    title: 'Ice',
    body: 'Arctic summer sea ice is treated as near-linear with warming (AR6 finds no classical tipping point). The Greenland and Antarctic sheets move on century-to-millennial clocks, so their bars change slowly even under extreme forcing — the committed loss is far larger than the loss shown by 2300.',
  },
]

/** Concrete provenance for the data files this app ships. */
export const DATA_SOURCES: ModelNote[] = [
  {
    title: 'Coastal exposure',
    body: 'World Bank WDI (AG.LND.EL5M.ZS, AG.LND.TOTL.K2, 2015), derived from CIESIN’s Low Elevation Coastal Zone dataset.',
  },
  {
    title: 'Baseline rainfall',
    body: 'World Bank country climatology (mm/yr) where available, with a latitude fallback elsewhere — the panel marks which is in use.',
  },
  {
    title: 'Country shapes',
    body: 'Natural Earth 1:50m boundaries, served as TopoJSON and rendered on a WebGL globe.',
  },
]

export const LIMITS_NOTE =
  'Meridian is an illustrative teaching model, not a forecast and not a flood map. It runs a handful of tuned curves in your browser rather than a general circulation model, and it cannot tell you what will happen to a specific street, farm or house. Use the tools above for decisions that matter.'
