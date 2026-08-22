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
      'This is exposure by elevation and nothing else. It ignores flood defences, sediment supply, and the difference between land that floods once a decade and land that is permanently under water. Real losses depend on dikes and deltas as much as on elevation. Only the 5 m point is measured: the 1, 2, 3, 7 and 10 m fractions are one fixed hypsometric shape scaled to it, so every country is assumed to hold its low-lying land in the same proportions between the shoreline and 10 m \u2014 and this century\u2019s range, a rise of 0 to 3 m, lies entirely inside that derived part rather than on the measured point. Being a global average the shape flattens the countries it matters most for: it puts 21% of the Netherlands below 1 m when about 26% of the country is already below 0 m, so a polder coast is understated at exactly the heights it meets first. Summed worldwide the curve puts 1.7% of land below 10 m against the roughly 2% the low-elevation-coastal-zone literature reports.',
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
      'Annual totals only. It says nothing about whether the rain arrives as useful soaking or as a flood, and the intensification of extreme rainfall is a bigger deal than the change in the annual mean. The baseline is measured for 182 of 241 countries and a latitude climatology for the rest, and that fallback is a zonal land-only average, so it fails hardest on the two cases that reach it most often: maritime islands, which it treats as continental interiors, and desert coasts at tropical latitudes, which it treats as wet tropics. It gave Somaliland 2,200 mm against an observed 250 and Taiwan 450 against 2,500 \u2014 and because the water balance, the fire model and the humid-heat layer all read this one number, those errors were surfacing as 13,000 km\u00b2/yr of burned area in the Western Sahara. The fifteen places where the gap was large and the area real now carry measured values instead. What still uses the fallback is islands under 12,000 km\u00b2, where the same error is present and small.',
  },
  {
    id: 'drought',
    title: 'Water balance and drought',
    question: 'Where does the land actually run short of water?',
    steps: [
      'Rainfall alone cannot answer this. The atmosphere\u2019s demand for water rises with temperature faster than rainfall does, so a place can gain rain every year and still lose ground \u2014 which is why this layer computes the demand side and subtracts it.',
      'Potential evapotranspiration comes from Hargreaves\u2013Samani, run month by month. It needs the radiation arriving at the top of the atmosphere \u2014 computed from latitude and day of year, so a June day at 60\u00b0N genuinely delivers more energy than one at the equator \u2014 the monthly mean temperature, and the daily temperature range, which stands in for cloud and humidity. It is not a linear function of temperature.',
      'Monthly matters. A Mediterranean climate takes its rain in the months when demand is lowest and none at all when demand peaks, and an annual mean erases exactly the part that hurts. Rainfall is spread across the year by climate regime: monsoon, winter-wet Mediterranean, tropical wet-and-dry, or evenly in the deep tropics.',
      'The months are then run through a soil-water account. Rain meets demand first, the surplus recharges the soil to its capacity and then runs off, and once rain falls short the soil gives up water in proportion to what is left. Snow is held back until it melts, so a seasonally frozen country gets its winter precipitation in the spring, when the ground can use it.',
      'That gives the water balance P \u2212 PET in mm/yr, and the aridity index P / PET, classified on the UNEP boundaries used to define the world\u2019s drylands: hyper-arid below 0.05, arid to 0.20, semi-arid to 0.50, dry sub-humid to 0.65, humid above.',
      'The map shows the change in the balance divided by that country\u2019s own year-to-year spread, in standard deviations \u2014 the idea behind SPEI. Rainfall variability rises steeply as the mean falls, from about 15% of the mean in wet maritime climates to most of it in a desert, so the same 50 mm is noise in Ireland and a catastrophe in Libya. Read it in tenths: this is a permanent shift of the whole distribution, not one bad season. Half a standard deviation is already enough to roughly double how often a country meets what is currently its one-year-in-six drought, and the average land surface reaches half at about 4\u00b0C of warming. A full standard deviation takes nearer 6.5\u00b0C, which no pathway here reaches except the two stress tests.',
      'The fire model reads its humidity from this layer, using the evaporative fraction over the country\u2019s own driest quarter rather than a guess from annual rainfall.',
    ],
    formula:
      'PET = 0.0023 \u00d7 Ra \u00d7 (T + 17.8) \u00d7 \u221a(Tmax \u2212 Tmin), summed over the months; drought = \u0394(P \u2212 PET) \u00f7 \u03c3',
    limits:
      'Altitude is the largest error here, and there is no elevation data in this app to correct it with. Temperature comes from a zonal mean at the country\u2019s latitude, so every country is modelled at sea level: across the Andes, the Ethiopian highlands, the Himalaya, the Alps and Central Asia the model runs several degrees too warm \u2014 more than ten in the high Himalaya \u2014 and overstates evaporative demand by a third to three quarters. That biases the mountain world toward the dry classes: Ethiopia comes out semi-arid, Lesotho ranks among the driest countries on Earth, and Bolivia, Peru and Bhutan carry demand figures no highland climate reaches. It is also one number per country, so Chile reads humid while containing the Atacama and India reads humid while containing the Thar. Hargreaves has no wind and no measured humidity, and is known to overestimate demand in humid maritime places and underestimate it in windy arid ones. The rainfall seasonality is one harmonic per climate regime, not an observed monthly climatology, and the soil holds the same 150 mm everywhere. The standardised anomaly is a shift in the long-term mean, not a forecast of any particular drought, and in hyper-arid countries it is driven almost entirely by evaporative demand \u2014 a known property of SPEI, and the reason the Sahara scores strongly despite having almost no water left to lose. There is no ice mask either: Greenland and Antarctica are flagged as polar ground because their warmest month stays below 10\u00b0C, but a soil column is still being run over two ice sheets. Two things bias this layer toward too much drying rather than too little, which is worth naming because the fire and humid-heat layers lean the other way. PET here is a temperature-driven formulation, and those are known to overstate the drought trend under warming next to physically based Penman\u2013Monteith \u2014 the result that turned a reported global drying trend into \u2018little change\u2019 when Sheffield, Wood and Roderick recomputed it in 2012. Hargreaves is better behaved than the Thornthwaite scheme that finding was about, because it carries radiation and the daily temperature range rather than temperature alone, and measured here its demand rises 3.1% per \u00b0C of local warming, inside the 2.5\u20134% the Penman\u2013Monteith literature reports. The second is that there is no CO\u2082 physiological effect: plants close their stomata as CO\u2082 rises and transpire less, so real ecosystems dry less than an aridity index implies. How much less is contested \u2014 the stomatal saving is partly cancelled by an indirect vapour-pressure feedback, and the gap between dryness indices and measured impacts stays wide even in experiments with the plant effect switched off \u2014 so it is named here rather than applied. Against observations the present-day state holds up: 43.8% of land falls in the dryland classes against the 40.6% the UNCCD measured for 2020, area-weighted demand is 1,232 mm/yr against roughly 1,100\u20131,200 in the CGIAR-CSI Penman\u2013Monteith database, and across 69 countries the modelled demand has a median ratio of 0.96 to the observed figure with 62 inside 20% and the aridity class agreeing for 59.',
  },
  {
    id: 'fire',
    title: 'Fire: season length and burned area',
    question: 'How much of this country burns each year, and for how long?',
    steps: [
      'Fire needs three things at once: fuel to burn, dry fuel, and air thirsty enough to keep it dry. Modelling it as a straight function of temperature would rank the Sahara as the most flammable place on Earth.',
      'Estimate the warm-season temperature, not the annual mean. Fire is a summer event, and the annual mean hides it \u2014 Siberia averages about \u22125\u00b0C and still burns, because its summers reach the high teens. The seasonal swing comes from latitude and continentality.',
      'Convert that to vapour pressure deficit: how much more moisture the air could hold than it does. Saturation vapour pressure follows Clausius\u2013Clapeyron and rises about 7% per \u00b0C, so drying power accelerates with warming even where rainfall is unchanged.',
      'Read the deficit on a fire day, not on an average one \u2014 at the afternoon peak, and in a hot spell rather than a mean week. Burned area is dominated by a handful of days a season, and in the boreal those days are blocking highs. Holding the vapour pressure the air already carries fixed and re-evaluating saturation warmer costs a maritime climate little, because its air is wet to begin with, and costs a continental one a great deal.',
      'Take the humidity behind that from the water-balance layer: the share of the atmosphere\u2019s demand the land can actually supply. Where the soil runs out, evaporation stops moistening the air and humidity falls, so the deficit climbs from both ends.',
      'Stop treating a country as a point. Burned area peaks sharply at intermediate dryness, so a country that straddles the peak has its fires averaged out of existence at its middle \u2014 DR Congo\u2019s centroid is closed rainforest and its fires are all on the savanna fringes north and south of it. The model integrates across each country\u2019s own latitude range instead, using the area-weighted spread of its land computed from the outline itself, so overseas territory counts for its area rather than at full weight.',
      'Separate fuel load from fuel dryness. They move in opposite directions with rainfall and one term cannot carry both: the wet season grows the grass that the dry season burns. Fuel is accumulated month by month from the water the land actually evaporates, and decays as it is grazed, trampled and rotted, so the Sahel\u2019s fire season ends in spring even though its fire weather never does.',
      'Separate grass from forest. Grass cures in weeks and can re-burn the same hectare every year or two; forest needs years of drought and burns on a cycle of decades. And separate tropical grass from temperate: the frost line is the boundary, and a frost-free savanna puts several times the fine fuel on the ground that a temperate grassland does. Without that split a fire model ranks the North China plain and the Argentine pampas among the great fire regions of the world.',
      'Count the fire season in days. Month by month, ask whether the fuel bed is continuous, whether it has cured, whether there is snow on it and whether the air is dry enough \u2014 and add up the days for which all four hold.',
      'Add people. Fire needs an ignition, which in savanna is deliberate and annual; it is fought where it is a hazard rather than a tool; and a landscape cut into fields, roads and villages cannot carry a fire across itself. That last effect drove global burned area down by roughly a quarter between 1998 and 2015 while the climate warmed.',
      'Add boreal peat. Where the ground is cold and waterlogged it is organic, and fire there works down into carbon banked since the ice left. A pathway whose carbon sinks are failing is a pathway where permafrost is thawing, so it burns more of it \u2014 which is why the Earth-system scenarios move the boreal numbers and not the tropical ones.',
      'Calibrate the result against the MODIS satellite burned-area record. One global constant is fitted, so that the modelled world total lands on the observed 3\u20134 million km\u00b2 a year and Africa\u2019s share of it on the observed 60\u201370%. Nothing is fitted per country, and the observed figure is shown beside the model\u2019s own for the countries the record covers, so the estimate can be checked rather than believed.',
    ],
    formula:
      'burned area = country area \u00d7 \u03a3 bands [ regime ceiling \u00d7 growth \u00d7 fuel load \u00d7 (1 \u2212 e^(\u2212season days / 130)) \u00d7 human modulation \u00d7 peat thaw ]',
    limits:
      'Order of magnitude, not precision. The model has one rainfall figure, one population and one latitude band per country and no elevation, no land-cover map and no wind, so a country is only as well described as those four numbers make it. Against the satellite record about half the listed countries land within a factor of two and roughly three in five within a factor of three; the rest do not. It runs several times too high across the highlands \u2014 Mexico, Bolivia, Ethiopia, western China \u2014 for the same reason the water-balance layer does, because every country is modelled at sea level and so comes out hotter, thirstier and more flammable than it is. It runs far too low through the humid equatorial tropics \u2014 Congo, Gabon, Uganda, Colombia, Indonesia \u2014 where the rainfall model gives a nearly flat year and therefore no dry season for fire to use, and it understates the semi-arid grasslands of Botswana, Namibia, Kazakhstan and Mongolia. Population density is the only human variable available and it is not wealth: the model cannot tell a country that can afford aerial suppression and mechanised agriculture from one at the same density that cannot, so the United States and southern Europe come out too high. And the satellite record it is calibrated against misses small fires, so agricultural and Mediterranean landscapes are understated in the target as well as in the model. Interannual variability dwarfs all of this: Australia has burned between roughly 200,000 and 1,200,000 km\u00b2 in single years, and Canada\u2019s 2023 alone burned six times its long-run mean, so a single-year figure is not what this estimates.',
  },
  {
    id: 'humidheat',
    title: 'Humid heat and habitability',
    question: 'Where does heat stop being survivable, and how many people live there?',
    steps: [
      'Dry-bulb temperature is not what kills people. A body sheds heat by evaporating sweat, and evaporation depends on the gap between the water the air holds and the water it could hold \u2014 so 45\u00b0C in desert shade is survivable and 33\u00b0C on the Persian Gulf is not. The variable that says so is the wet-bulb temperature: the coldest a wet surface can get by evaporating into the air. Skin at rest sits near 35\u00b0C, so past a 35\u00b0C wet bulb no amount of sweating removes heat at all.',
      'Wet bulb comes from the Stull (2011) closed form, the standard shortcut in this literature \u2014 accurate to about 0.3\u00b0C against the exact psychrometric root, and clamped rather than extrapolated outside the humidity range it was fitted over.',
      'Every month gets its own wet bulb, because the most dangerous month is not the hottest one. The Gulf peaks in August, a month behind the sun, because it follows the sea; the monsoon lands peak when the rains arrive and the air is cooler and far wetter than it was in May.',
      'The temperature, the daily temperature range and the surface humidity all come from the water-balance layer, so this is the same climatology the drought and fire maps run on rather than a second one. Two corrections move heat between months without changing the annual mean: the surface cools itself in the months it has water to evaporate, and where the adjacent sea is much warmer or colder than its latitude implies the coastal warm season goes with it. The first is weighted by how much evaporative demand each month actually carries \u2014 a frozen January has none, and letting it set the reference for July turned a monsoon-cooling term into a summer heater worth up to 3.6\u00b0C across the dry interiors.',
      'The moisture usually arrives from somewhere else, and this is the part a temperature map cannot do. The land under the Gulf\u2019s record wet bulbs evaporates nothing \u2014 the vapour comes off a shallow enclosed sea sitting at 34\u00b0C, blows onshore, and is then heated by the desert without losing any of its water. So the model carries three air masses: what the land itself evaporates, what the local sea sends inland, and what a monsoon imports from the tropical ocean upstream, and it takes whichever is wettest.',
      'How warm those seas are is prescribed, not derived. Twelve marginal seas carry a hand-entered sea surface temperature anomaly read off the observational record \u2014 the Persian Gulf at 5.5\u00b0C above the open ocean at its latitude, the Red Sea at 4\u00b0C, the four great cold upwelling currents below theirs \u2014 in the same way the sea-level layer carries measured land motion and the fire layer carries measured burned area. That table is what puts the Gulf at the top of this ranking: remove it and Qatar falls 4.4\u00b0C, Bahrain 4.6\u00b0C, and the hot dry interiors return to the top. The physics decides how far that vapour travels, what its wet bulb is once the desert has heated it and which month it peaks in; it does not discover that the Gulf is hot.',
      'A ceiling on the continental air mass keeps that honest: every gram of water over land evaporated from a sea somewhere, and recycling returns water without creating any, so the boundary layer cannot carry more than the ocean at its own latitude plus what the surface is currently putting back \u2014 and in the deep tropics, where convection ventilates as fast as the surface moistens, not even that.',
      'The daily maximum sits below the temperature maximum, because the afternoon boundary layer deepens and mixes in dry air from above just as the thermometer peaks. Around that maximum the model carries a day-to-day spread \u2014 small in maritime and monsoon air, where the sea holds the wet bulb within a degree of itself for weeks, and several degrees over continental interiors.',
      'That spread is what turns a monthly figure into a count of days: days per year above 28\u00b0C, where sustained outdoor labour becomes unsafe; above 31\u00b0C, where the danger no longer needs exertion and reaches the old and the ill at rest; and above 35\u00b0C, the theoretical limit. The headline wet bulb is the level crossed on about one day a year, defined through that same curve so the peak and the day-counts are one statement rather than two.',
      'Then the people. Each country carries a population, shared with the fire model, and is counted into the band its yearly peak falls in. That peak is the country\u2019s worst inhabited zone rather than an average of its zones \u2014 the worse of its interior, evaluated at the centroid, and its coastal strip, which the local sea reaches in full. These bands are survivability claims about places, and an average over a country describes nowhere: the fourteen recorded days at or above a 35\u00b0C wet bulb all happened at five coastal stations, and averaging Dhahran with the Nejd reports 27\u00b0C for a country that holds two of them. 117 of 241 countries are scored on their coast. The earlier figure was a population-weighted blend of the two, and it was abandoned because the only weight available is the share of people below 5 m \u2014 a sea-level-rise flood contour, and as a measure of who breathes marine air it is low by something like five to ten times, 3.2% for Saudi Arabia and 0.9% for Iran \u2014 so it did not average the coast in, it averaged the coast away. It is still a whole country\u2019s population bucketed from a single national number, and it says how many people live somewhere that now reaches a line on its worst day, not how many people stand in it.',
    ],
    formula:
      'Tw = f_Stull(T, RH); RH from vapour = max(land evaporation, sea advection); days above X = \u03a3 months \u00d7 P(daily max Tw > X)',
    limits:
      'This cannot tell you about a city. It is two numbers per country \u2014 an interior evaluated at the centroid and a coastal strip \u2014 and humid heat varies enormously inside a country: Basra and Baghdad are 5\u00b0C of wet bulb apart, and Jacobabad and the Balochistan uplands more than that. Splitting the country in two fixed the worst of that wherever the extreme is coastal, and the countries this layer used to miss hardest \u2014 Saudi Arabia, Iran, Iraq, Yemen, Egypt and Oman, every one of them with its record on a shore and its centroid a long way inland \u2014 now land within about a degree of their published station maxima, where Saudi Arabia alone used to read 7\u00b0C low. It does nothing at all for an inland hotspot: Pakistan still reads about 4\u00b0C low, because Jacobabad is a monsoon valley 450 km from the sea and neither zone reaches it, and Pakistan holds seven of the fourteen days on which a 35\u00b0C wet bulb has ever been recorded. There is no altitude anywhere in this app, exactly as in the water-balance layer, so Ethiopia, Peru, Bolivia, Afghanistan, Mongolia, Kazakhstan and western China come out several degrees too hot \u2014 Ethiopia and Peru by about 5\u00b0C \u2014 and rank far higher than they should. The desert coasts of the Mediterranean still run about 2 to 4\u00b0C hot, worst in Libya, even after the basin was given its own marine humidity \u2014 0.70 of saturation at the sea rather than the 0.80 the Persian Gulf is read at, because the summer Mediterranean sits under subsiding air and its southern shore often breathes Sahara. Those are also the least certain figures in the check, read off monthly climatology rather than off a station record of annual maxima; the firmest constraint on them is that regional wet bulbs in European and Mediterranean heatwaves have never been observed above 28\u00b0C. Russia, Canada and Norway read 3 to 4\u00b0C below their populated south for the opposite reason, which is that a centroid in Siberia, the tundra or the Norwegian mountains is not where anyone lives. There is no acclimatisation in it and no air conditioning: a wet bulb is a property of the air, not of the person in it, and a Gulf state at 33\u00b0C with universal cooling and an Indian state at 31\u00b0C without it are not in the same danger. The humidity is inferred from a water balance and a prescribed sea surface temperature rather than measured, and the day-to-day spread is a normal distribution fitted to reason rather than to observations, which will overstate the far tail because real wet bulbs have a hard convective ceiling that a normal curve does not. The population figures are country totals placed in the band of a national peak. Checked against about sixty published national maxima the median miss is about 0.7\u00b0C and four in five land within 2\u00b0C, but that average hides errors pointing both ways rather than describing them: the highlands and the North African coast too hot, the Indus and the high-latitude interiors too cold.',
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
    title: 'Fire season and burned area',
    body: 'Fire needs fuel, dryness and heat at the same time, so it is modelled as a product of terms rather than as a function of temperature \u2014 which would rank the Sahara as the most flammable place on Earth. The drying term is vapour pressure deficit read on a fire day rather than an average one, because burned area is dominated by a handful of days a season. But an index nobody can check is not an answer, so the model carries on to two quantities that can be: the length of the fire season in days, counted month by month from the water balance, and the area that burns each year in km\u00b2, calibrated against the MODIS satellite record so the world total lands near the observed 3\u20134 million km\u00b2 a year with Africa taking 60\u201370% of it. Getting there needs fuel load and fuel dryness kept apart \u2014 the wet season grows the grass the dry season burns \u2014 grass and forest kept apart, tropical and temperate grass kept apart at the frost line, and a country stopped from being a point: DR Congo\u2019s middle is rainforest and its fires are all on the savanna fringes, so the model integrates across each country\u2019s own latitude range. People are in it too, as ignition, as suppression and as the fields and roads that stop a fire crossing a landscape. Boreal peat couples to the carbon-feedback pathways, because fire in thawing permafrost releases carbon banked since the ice left.',
  },
  {
    title: 'Humid heat and habitability',
    body: 'The one layer here that is about people rather than land. Heat kills through humidity: a body sheds heat by evaporating sweat, so what matters is the wet-bulb temperature \u2014 the coldest a wet surface can get by evaporating into the air \u2014 and not the reading on a thermometer. 45\u00b0C in desert shade is survivable; a 35\u00b0C wet bulb is not, at any level of fitness, hydration or shade, because skin sits at about that temperature and sweat stops removing heat. Wet bulb comes from the Stull (2011) relation, run month by month on the same climatology the drought and fire layers use, and the result is the opposite of a temperature map: the Saharan interior peaks near 26\u00b0C and the Persian Gulf near 33\u00b0C, because the Gulf is humid and the Sahara is not. Getting that right needs the moisture tracked to its source \u2014 the land under the Gulf\u2019s record wet bulbs evaporates nothing, and the vapour blows off a 34\u00b0C sea \u2014 and the same mechanism, on a larger scale, is what soaks the Indus and Ganges plains each July. How warm each marginal sea runs is prescribed rather than derived: twelve hand-entered anomalies read off the observational record, and it is that table, not the psychrometrics, that places the Gulf at the top \u2014 remove it and Qatar drops 4.4\u00b0C and the hot dry interiors return to the top of the ranking. The map then counts days per year above 28\u00b0C (outdoor work unsafe), 31\u00b0C (unsafe even at rest) and 35\u00b0C (the survivability limit), and puts a population behind each band \u2014 a country total bucketed by a single national number, not a count of the people actually standing in it. Each country is scored on the worse of two zones, its interior and its coastal strip, because the wet-bulb extremes are coastal and a national average puts Dhahran together with the Nejd and reports neither.',
  },
  {
    title: 'Water balance and drought',
    body: 'Rainfall is only half of drought. The other half is evaporative demand, which climbs with temperature faster than rainfall does — so this layer computes potential evapotranspiration with the Hargreaves–Samani formulation, month by month, from the radiation arriving at that latitude on that day, the monthly temperature, and the daily temperature range. Rain is spread across the year by climate regime and run through a soil-water account with snow held back until it melts. What comes out is the water balance P − PET, the UNEP aridity index P / PET with the standard dryland classes, and a standardised anomaly: the change in the balance measured in that country’s own year-to-year variability, because 50 mm is noise in Ireland and most of the year in Libya. It is the layer that explains why boreal Canada and Siberia can gain rainfall and still dry out.',
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
