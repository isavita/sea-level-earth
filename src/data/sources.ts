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
