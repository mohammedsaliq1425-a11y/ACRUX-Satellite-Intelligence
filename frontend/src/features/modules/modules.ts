import {
  Bot, Compass, FileText, Flame, Globe, LayoutDashboard, Layers, Orbit, Radio, Satellite, Telescope, CloudSun,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface BackendCapability { method: "GET" | "POST"; path: string; description: string }

export interface ModuleDef {
  id: string;
  number: number;               // 1-12, as listed in the Project Acrux spec
  title: string;                // full module name
  navLabel: string;             // short sidebar label
  path: string;
  icon: LucideIcon;
  summary: string;              // one-line card description
  description: string;          // page intro
  plannedUi: string[];          // what the finished page will provide
  backend: BackendCapability[]; // what already exists server-side
  sources: string[];            // backend source ids this module depends on
  simulated?: boolean;
  phase: 3 | 4 | 5;             // build phase in which the interactive page arrives
  gaps?: string[];              // honest notes on what has NO data integration yet
}

export const MODULES: ModuleDef[] = [
  {
    id: "earth-observation", number: 1, title: "Earth Observation Intelligence", navLabel: "Earth Observation",
    path: "/earth-observation", icon: Globe, phase: 3,
    summary: "Search NASA imagery and explore locations with clearly labelled layers.",
    description: "Explore a location on an interactive map, browse NASA image-library results, and inspect source metadata, timestamps and attribution.",
    plannedUi: ["Interactive map with location search and latitude/longitude entry", "Layer panel separating base map, imagery, observation layers and derived layers", "NASA image previews with credit and metadata", "Date and dataset filters, plus export of supported data"],
    backend: [{ method: "GET", path: "/api/space/images", description: "Search the NASA Image and Video Library (catalogue imagery, not a live view)" }],
    sources: ["nasa_images"],
    gaps: ["NASA Earthdata / GIBS imagery layers are not integrated yet, so no satellite tile layers are offered."],
  },
  {
    id: "wildfire", number: 2, title: "Wildfire & Disaster Monitoring", navLabel: "Wildfire & Disaster",
    path: "/wildfire", icon: Flame, phase: 3,
    summary: "Satellite fire hotspot detections from NASA FIRMS, with CSV export.",
    description: "Map and tabulate FIRMS hotspot detections for a region and date range. Detections are observations, not confirmed fires or fire perimeters.",
    plannedUi: ["Hotspot map with region and date filters", "Table with acquisition time, instrument, confidence and fire radiative power", "Summary charts computed from the retrieved records only", "CSV export of the actual records"],
    backend: [
      { method: "GET", path: "/api/fires", description: "Hotspot records plus summary for a bounding box (needs FIRMS_MAP_KEY)" },
      { method: "GET", path: "/api/fires/export.csv", description: "CSV download of the same records" },
    ],
    sources: ["firms"],
    gaps: ["Floods, cyclones, drought and earthquakes have no data integration yet and will be shown as unavailable rather than simulated."],
  },
  {
    id: "weather", number: 3, title: "Weather & Climate Intelligence", navLabel: "Weather & Climate",
    path: "/weather", icon: CloudSun, phase: 3,
    summary: "Forecasts and historical weather from Open-Meteo, with unit control.",
    description: "Search a place and see model-based current conditions, hourly and daily forecasts, and historical reanalysis, each labelled for what it is.",
    plannedUi: ["Location search with coordinates and time zone", "Temperature, precipitation and wind charts", "Unit selection (uses your Settings preferences)", "Clear separation of current, forecast, historical and derived values"],
    backend: [
      { method: "GET", path: "/api/weather/geocode", description: "Place-name search" },
      { method: "GET", path: "/api/weather/forecast", description: "Current + hourly + daily forecast" },
      { method: "GET", path: "/api/weather/history", description: "Daily historical reanalysis (up to 366 days)" },
      { method: "GET", path: "/api/storage/locations", description: "Saved locations (optional; needs Supabase)" },
    ],
    sources: ["open_meteo", "supabase"],
  },
  {
    id: "communication", number: 4, title: "Satellite Communication Intelligence", navLabel: "Satellite Communication",
    path: "/communication", icon: Radio, phase: 4,
    summary: "Link budgets, path loss, delay and orbit comparisons.",
    description: "Understand how satellites talk to ground stations, and calculate free-space path loss, received power, link margin and propagation delay.",
    plannedUi: ["Interactive satellite-to-ground-station diagram", "Link-budget calculator with documented formulas and assumptions", "LEO / MEO / GEO comparison", "Explanations of frequency bands, antenna gain and attenuation"],
    backend: [
      { method: "POST", path: "/api/calc/link-budget", description: "Full link budget with documented formulas" },
      { method: "POST", path: "/api/calc/orbit-comparison", description: "Illustrative LEO/MEO/GEO range, loss, delay and coverage" },
    ],
    sources: [],
  },
  {
    id: "navigation", number: 5, title: "Navigation & Positioning Intelligence", navLabel: "Navigation & Positioning",
    path: "/navigation", icon: Compass, phase: 4, simulated: true,
    summary: "GNSS trilateration and dilution-of-precision, simulated.",
    description: "Move simulated satellites and a receiver to see how geometry drives positioning error. All satellite positions are simulated.",
    plannedUi: ["Sky plot with draggable simulated satellites", "Receiver position and clock-bias controls", "Live DOP and error readouts from the solver", "Explanations of GPS, Galileo, GLONASS, BeiDou and error sources"],
    backend: [{ method: "POST", path: "/api/calc/gnss", description: "Pseudorange least-squares fix plus GDOP/PDOP/HDOP/VDOP/TDOP" }],
    sources: [],
  },
  {
    id: "space-science", number: 6, title: "Space Science & Astronomy", navLabel: "Space Science",
    path: "/space-science", icon: Telescope, phase: 3,
    summary: "APOD, near-Earth objects, exoplanets and NASA imagery.",
    description: "Browse astronomy imagery, near-Earth object close approaches and confirmed exoplanets from public NASA and JPL services.",
    plannedUi: ["Astronomy Picture of the Day with credit", "Near-Earth object table and charts (flybys, not impact predictions)", "Exoplanet search and comparison charts", "Object detail panels with source links"],
    backend: [
      { method: "GET", path: "/api/space/apod", description: "Astronomy Picture of the Day" },
      { method: "GET", path: "/api/space/neo-feed", description: "NASA NeoWs close approaches (≤ 7 days)" },
      { method: "GET", path: "/api/space/small-body", description: "JPL small-body orbit and physical parameters" },
      { method: "GET", path: "/api/space/exoplanets", description: "NASA Exoplanet Archive search" },
      { method: "GET", path: "/api/space/images", description: "NASA image library search" },
    ],
    sources: ["nasa_api", "jpl_ssd", "exoplanet_archive", "nasa_images"],
    gaps: ["NASA mission-status information has no integration yet and will not be shown until a documented source is added."],
  },
  {
    id: "digital-twin", number: 7, title: "Satellite Health & Digital Twin", navLabel: "Digital Twin",
    path: "/digital-twin", icon: Satellite, phase: 4, simulated: true,
    summary: "A 3D satellite with simulated telemetry and anomaly detection.",
    description: "Inspect an interactive 3D spacecraft model and a simulated telemetry stream, with rule-based anomaly detection you can audit alert by alert.",
    plannedUi: ["Rotatable 3D model with selectable components", "Telemetry charts: battery, solar power, temperature, attitude, comms", "Fault injection to see how alerts respond", "Alert history with reason, expected range and suggested diagnostic"],
    backend: [
      { method: "POST", path: "/api/telemetry/simulate", description: "Simulated telemetry + rule-based alerts (+ optional ML outliers)" },
      { method: "GET", path: "/api/telemetry/fault-kinds", description: "Injectable fault types" },
      { method: "GET", path: "/api/storage/simulation-runs", description: "Saved run summaries (optional; needs Supabase)" },
    ],
    sources: ["supabase"],
  },
  {
    id: "space-objects", number: 8, title: "Space Debris & Asteroid Tracking", navLabel: "Debris & Asteroids",
    path: "/space-objects", icon: Orbit, phase: 4,
    summary: "Near-Earth asteroids kept separate from human-made debris.",
    description: "Explore asteroid close approaches and small-body orbits from JPL, with asteroid data clearly separated from orbital debris and from educational simulations.",
    plannedUi: ["Asteroid search, classification and detail panels", "Close-approach comparison charts", "Educational orbit visualisation only where the data supports it", "Explicit limits: not a space-surveillance or collision-warning system"],
    backend: [
      { method: "GET", path: "/api/space/close-approaches", description: "JPL close-approach data" },
      { method: "GET", path: "/api/space/small-body", description: "Orbital elements and physical parameters" },
    ],
    sources: ["jpl_ssd", "nasa_api"],
    gaps: ["Human-made orbital debris has no data integration yet (it needs a catalogue source such as TLE/GP data). It will be shown as unavailable, never invented."],
  },
  {
    id: "multimodal", number: 9, title: "Multimodal Satellite Intelligence", navLabel: "Multimodal Analysis",
    path: "/multimodal", icon: Layers, phase: 5,
    summary: "Combine imagery, weather and fire data for a chosen region.",
    description: "A workspace that brings together the data available for one region and separates observed data from derived indicators, AI interpretation and simulation.",
    plannedUi: ["Region selection with image and layer previews", "Weather and wildfire context for the same area", "Derived indicators with documented methods and limitations", "Structured, exportable summary"],
    backend: [],
    sources: ["open_meteo", "firms", "nasa_images"],
    gaps: ["Image classification, segmentation and change detection are not implemented and will not be implied."],
  },
  {
    id: "assistant", number: 10, title: "AI Intelligence Assistant", navLabel: "AI Assistant",
    path: "/assistant", icon: Bot, phase: 5,
    summary: "A grounded assistant powered through OpenRouter (backend only).",
    description: "Ask about the data you are viewing. The backend passes labelled context to the model and keeps your API key out of the browser.",
    plannedUi: ["Chat with suggested, context-aware questions", "Source references for the context used", "Retry and clear errors for missing keys or provider failures", "AI text always marked as interpretation"],
    backend: [
      { method: "GET", path: "/api/ai/status", description: "Whether a key and model are configured" },
      { method: "POST", path: "/api/ai/chat", description: "Grounded chat with rate limiting and timeouts" },
    ],
    sources: ["openrouter"],
  },
  {
    id: "reports", number: 11, title: "Reports & Analytics", navLabel: "Reports & Analytics",
    path: "/reports", icon: FileText, phase: 5,
    summary: "Source-attributed reports with CSV and PDF export.",
    description: "Generate readable reports from real retrieved data, with timestamps, methods, limitations and simulation disclaimers.",
    plannedUi: ["Report types for each module", "Executive summary, data tables, charts and limitations", "CSV export and PDF export", "A clear message when there is not enough data"],
    backend: [
      { method: "GET", path: "/api/fires/export.csv", description: "CSV export of retrieved hotspot records" },
      { method: "GET", path: "/api/storage/reports", description: "Saved reports (optional; needs Supabase)" },
      { method: "POST", path: "/api/storage/reports", description: "Save a report, with credentials stripped (optional; needs Supabase)" },
    ],
    sources: ["supabase"],
  },
  {
    id: "mission-control", number: 12, title: "Mission Control Dashboard", navLabel: "Mission Control",
    path: "/mission-control", icon: LayoutDashboard, phase: 3,
    summary: "One operational overview of every module and data source.",
    description: "A unified overview: map, weather, wildfire, near-Earth objects, twin status, reports and source health, each with a source and timestamp.",
    plannedUi: ["Overview map with refresh, date and location controls", "Panels for weather, hotspots and near-Earth objects", "Digital-twin status, always labelled simulated", "Alerts and data-source status"],
    backend: [{ method: "GET", path: "/api/sources", description: "Live data-source status" }],
    sources: ["open_meteo", "nasa_api", "firms", "jpl_ssd", "exoplanet_archive", "nasa_images", "openrouter", "supabase"],
  },
];

export const MODULE_BY_ID: Record<string, ModuleDef> = Object.fromEntries(MODULES.map((m) => [m.id, m]));
