import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { OrcaOrchestrator } from './src/pipeline/orchestrator';
import { evaluateRiskEngine, evaluateDataQuality } from './src/pipeline/riskEngine';
import { SUPPORTED_COASTAL_REGIONS } from './src/pipeline/geo';
import { ORCA_OPENAPI_SPEC } from './src/pipeline/openapi';

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';
const startTime = Date.now();

app.use(cors());
app.use(express.json());

// In-memory cache
const cache = {
  weather: new Map<string, { data: any; expiry: number }>(),
  ocean: new Map<string, { data: any; expiry: number }>(),
  warnings: new Map<string, { data: any; expiry: number }>(),
  stats: {
    weather: { hits: 0, misses: 0 },
    ocean: { hits: 0, misses: 0 },
    warnings: { hits: 0, misses: 0 },
  },
};

function getFromCache(type: 'weather' | 'ocean' | 'warnings', key: string) {
  const entry = cache[type].get(key);
  if (entry && entry.expiry > Date.now()) {
    cache.stats[type].hits++;
    return entry.data;
  }
  cache.stats[type].misses++;
  return null;
}

function setInCache(type: 'weather' | 'ocean' | 'warnings', key: string, data: any, ttlSeconds = 600) {
  cache[type].set(key, { data, expiry: Date.now() + ttlSeconds * 1000 });
}

// Factor thresholds and definitions
const FACTOR_THRESHOLDS: Record<string, { label: string; unit: string; low: number; high: number; weight: number }> = {
  wind: { label: 'Wind (incl. 80% of gusts)', unit: 'km/h', low: 25, high: 70, weight: 0.25 },
  rainfall: { label: 'Rainfall (24 h)', unit: 'mm', low: 35, high: 210, weight: 0.15 },
  wave_height: { label: 'Wave height', unit: 'm', low: 1.0, high: 3.5, weight: 0.25 },
  swell: { label: 'Swell height', unit: 'm', low: 1.2, high: 4.0, weight: 0.15 },
  ocean_current: { label: 'Ocean current', unit: 'km/h', low: 1.5, high: 5.5, weight: 0.10 },
};

const LEVEL_BANDS = {
  LOW: 'score < 35',
  MODERATE: '35 <= score < 60',
  HIGH: 'score >= 60 or official warning override',
};

const RECOMMENDATIONS = {
  LOW: 'Risk assessment based on available forecast data. Conditions appear generally manageable for coastal craft, but stay alert to weather changes and official bulletins.',
  MODERATE: 'Risk assessment based on available forecast data. Exercise caution near the coast; small fishing craft should avoid offshore waters as sea state can change rapidly.',
  HIGH: 'High risk advisory based on forecast data. All fishing vessels and small craft should suspend sea operations.',
};

const WARNING_RECOMMENDATION = 'An official IMD/NDMA warning is in effect. Cancel water/fishing activities and follow official instructions immediately.';

const SOURCES = [
  { name: 'Open-Meteo', url: 'https://open-meteo.com/', status: 'live meteorology fallback' },
  { name: 'Open-Meteo Marine', url: 'https://open-meteo.com/', status: 'live waves/swell/SST/currents' },
  { name: 'IMD (weather, marine & cyclone warnings)', url: 'https://api.imd.gov.in/', status: 'official adapter live / CONFIG_REQUIRED' },
  { name: 'INCOIS Ocean State Forecast / PFZ', url: 'https://incois.gov.in/', status: 'official adapter live / CONFIG_REQUIRED' },
  { name: 'ISRO MOSDAC Satellite Ocean Data', url: 'https://www.mosdac.gov.in/', status: 'official adapter live / CONFIG_REQUIRED' },
];

const GUARDRAILS = [
  'Official warnings (severity warning/alert) always override the computed score to HIGH.',
  'The LLM layer is explanation-only; it cannot change score, level, or recommendations.',
  'Missing values are shown as null and never replaced with zero.',
  'Risk wording is advisory (Low/Moderate/High) and never claims guaranteed safety.',
];

const LIMITATIONS = [
  'Prototype thresholds are assumptions unless tied to an official IMD/INCOIS source.',
  'Forecast uncertainty increases beyond 24 hours.',
  'Coastal conditions vary at beach level; this is a regional assessment.',
  'Follow official IMD/NDMA/Coast Guard advisories at all times.',
];

const DEMO_PROFILES: Record<string, any> = {
  chennai: {
    label: 'Chennai Coast',
    latitude: 13.0827,
    longitude: 80.2707,
    weather: {
      temperature_c: 29.4,
      feels_like_c: 33.8,
      humidity_pct: 76.0,
      pressure_hpa: 1006.2,
      wind_speed_kmph: 38.0,
      wind_gust_kmph: 55.0,
      wind_direction_deg: 112.0,
      precipitation_mm_last_hour: 2.6,
      precipitation_mm_24h: 68.0,
      visibility_km: null,
      condition: 'Moderate rain',
      source: {
        provider: 'Open-Meteo (IMD fallback, demo snapshot)',
        source_url: 'https://api.open-meteo.com/v1/forecast',
        retrieved_at: new Date().toISOString(),
        data_status: 'demo',
        note: 'Offline demo snapshot for Chennai.',
      },
    },
    ocean: {
      wave_height_m: 2.4,
      wave_period_s: 9.3,
      wave_direction_deg: 140.0,
      wind_wave_height_m: 1.2,
      swell_height_m: 1.8,
      swell_period_s: 11.0,
      swell_direction_deg: 135.0,
      sea_surface_temperature_c: 29.1,
      ocean_current_speed_kmph: 2.2,
      source: {
        provider: 'Open-Meteo Marine (demo snapshot)',
        source_url: 'https://marine-api.open-meteo.com/v1/marine',
        retrieved_at: new Date().toISOString(),
        data_status: 'demo',
        note: 'Offline demo snapshot for Chennai.',
      },
    },
    warnings: [],
  },
  kochi: {
    label: 'Kochi Port',
    latitude: 9.9312,
    longitude: 76.2673,
    weather: {
      temperature_c: 28.1,
      feels_like_c: 32.4,
      humidity_pct: 82.0,
      pressure_hpa: 1008.5,
      wind_speed_kmph: 30.0,
      wind_gust_kmph: 45.0,
      wind_direction_deg: 250.0,
      precipitation_mm_last_hour: 0.8,
      precipitation_mm_24h: 22.5,
      visibility_km: null,
      condition: 'Partly cloudy',
      source: {
        provider: 'Open-Meteo (IMD fallback, demo snapshot)',
        source_url: 'https://api.open-meteo.com/v1/forecast',
        retrieved_at: new Date().toISOString(),
        data_status: 'demo',
        note: 'Offline demo snapshot for Kochi.',
      },
    },
    ocean: {
      wave_height_m: 1.6,
      wave_period_s: 8.0,
      wave_direction_deg: 245.0,
      wind_wave_height_m: 0.9,
      swell_height_m: 1.2,
      swell_period_s: 10.0,
      swell_direction_deg: 240.0,
      sea_surface_temperature_c: 28.7,
      ocean_current_speed_kmph: 1.8,
      source: {
        provider: 'Open-Meteo Marine (demo snapshot)',
        source_url: 'https://marine-api.open-meteo.com/v1/marine',
        retrieved_at: new Date().toISOString(),
        data_status: 'demo',
        note: 'Offline demo snapshot for Kochi.',
      },
    },
    warnings: [
      {
        id: 'kerala-squally-weather',
        type: 'marine',
        severity: 'warning',
        headline: 'Squally weather with wind speeds reaching 45-55 kmph along Kerala coast; fishermen advised not to venture into sea',
        issued_by: 'IMD',
        valid_until: '2030-01-01T00:00:00Z',
        source: {
          provider: 'IMD bulletin (demo static)',
          retrieved_at: new Date().toISOString(),
          data_status: 'demo',
        },
      },
    ],
  },
  mumbai: {
    label: 'Mumbai Harbor',
    latitude: 18.9438,
    longitude: 72.8360,
    weather: {
      temperature_c: 31.0,
      feels_like_c: 36.2,
      humidity_pct: 78.0,
      pressure_hpa: 1010.0,
      wind_speed_kmph: 26.0,
      wind_gust_kmph: 38.0,
      wind_direction_deg: 270.0,
      precipitation_mm_last_hour: 0.0,
      precipitation_mm_24h: 5.0,
      visibility_km: null,
      condition: 'Mainly clear',
      source: {
        provider: 'Open-Meteo (IMD fallback, demo snapshot)',
        source_url: 'https://api.open-meteo.com/v1/forecast',
        retrieved_at: new Date().toISOString(),
        data_status: 'demo',
        note: 'Offline demo snapshot for Mumbai.',
      },
    },
    ocean: {
      wave_height_m: 1.3,
      wave_period_s: 7.5,
      wave_direction_deg: 260.0,
      wind_wave_height_m: 0.7,
      swell_height_m: 1.0,
      swell_period_s: 9.0,
      swell_direction_deg: 250.0,
      sea_surface_temperature_c: 29.5,
      ocean_current_speed_kmph: 1.4,
      source: {
        provider: 'Open-Meteo Marine (demo snapshot)',
        source_url: 'https://marine-api.open-meteo.com/v1/marine',
        retrieved_at: new Date().toISOString(),
        data_status: 'demo',
        note: 'Offline demo snapshot for Mumbai.',
      },
    },
    warnings: [],
  },
  goa: {
    label: 'Goa Coast (Panaji)',
    latitude: 15.4989,
    longitude: 73.8278,
    weather: {
      temperature_c: 29.8,
      feels_like_c: 34.5,
      humidity_pct: 80.0,
      pressure_hpa: 1009.2,
      wind_speed_kmph: 22.0,
      wind_gust_kmph: 32.0,
      wind_direction_deg: 260.0,
      precipitation_mm_last_hour: 0.2,
      precipitation_mm_24h: 12.0,
      visibility_km: null,
      condition: 'Partly cloudy',
      source: {
        provider: 'Open-Meteo (IMD fallback, demo snapshot)',
        source_url: 'https://api.open-meteo.com/v1/forecast',
        retrieved_at: new Date().toISOString(),
        data_status: 'demo',
        note: 'Offline demo snapshot for Goa.',
      },
    },
    ocean: {
      wave_height_m: 1.4,
      wave_period_s: 7.8,
      wave_direction_deg: 255.0,
      wind_wave_height_m: 0.8,
      swell_height_m: 1.1,
      swell_period_s: 9.2,
      swell_direction_deg: 250.0,
      sea_surface_temperature_c: 29.2,
      ocean_current_speed_kmph: 1.6,
      source: {
        provider: 'Open-Meteo Marine (demo snapshot)',
        source_url: 'https://marine-api.open-meteo.com/v1/marine',
        retrieved_at: new Date().toISOString(),
        data_status: 'demo',
        note: 'Offline demo snapshot for Goa.',
      },
    },
    warnings: [],
  },
  vizag: {
    label: 'Visakhapatnam (Vizag)',
    latitude: 17.6868,
    longitude: 83.2185,
    weather: {
      temperature_c: 30.5,
      feels_like_c: 35.0,
      humidity_pct: 75.0,
      pressure_hpa: 1007.5,
      wind_speed_kmph: 32.0,
      wind_gust_kmph: 48.0,
      wind_direction_deg: 180.0,
      precipitation_mm_last_hour: 1.0,
      precipitation_mm_24h: 35.0,
      visibility_km: null,
      condition: 'Scattered clouds',
      source: {
        provider: 'Open-Meteo (IMD fallback, demo snapshot)',
        source_url: 'https://api.open-meteo.com/v1/forecast',
        retrieved_at: new Date().toISOString(),
        data_status: 'demo',
        note: 'Offline demo snapshot for Vizag.',
      },
    },
    ocean: {
      wave_height_m: 2.1,
      wave_period_s: 8.5,
      wave_direction_deg: 170.0,
      wind_wave_height_m: 1.1,
      swell_height_m: 1.6,
      swell_period_s: 10.2,
      swell_direction_deg: 165.0,
      sea_surface_temperature_c: 29.0,
      ocean_current_speed_kmph: 2.0,
      source: {
        provider: 'Open-Meteo Marine (demo snapshot)',
        source_url: 'https://marine-api.open-meteo.com/v1/marine',
        retrieved_at: new Date().toISOString(),
        data_status: 'demo',
        note: 'Offline demo snapshot for Vizag.',
      },
    },
    warnings: [],
  },
};

const DEMO_LOCATIONS = [
  { label: 'Chennai Coast', latitude: 13.0827, longitude: 80.2707 },
  { label: 'Kochi Port (Cyclone Demo)', latitude: 9.9312, longitude: 76.2673 },
  { label: 'Visakhapatnam (Vizag)', latitude: 17.6868, longitude: 83.2185 },
  { label: 'Mumbai Harbor', latitude: 18.9438, longitude: 72.8360 },
  { label: 'Goa Coast (Panaji)', latitude: 15.4989, longitude: 73.8278 },
];

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function getNearestDemoProfile(lat: number, lon: number) {
  let nearestKey = 'chennai';
  let minDistance = Infinity;
  for (const [key, profile] of Object.entries(DEMO_PROFILES)) {
    const dist = haversineKm(lat, lon, profile.latitude, profile.longitude);
    if (dist < minDistance) {
      minDistance = dist;
      nearestKey = key;
    }
  }
  return DEMO_PROFILES[nearestKey];
}

function detectRegionalLanguage(lat: number, lon: number, label = ''): 'mr' | 'en' {
  const lbl = (label || '').toLowerCase();
  if (lat >= 18.7 && lat <= 19.4 && lon >= 72.7 && lon <= 73.15) return 'mr';
  if (lat >= 14.8 && lat <= 15.8 && lon >= 73.6 && lon <= 74.3) return 'mr';
  if (lbl.includes('mumbai') || lbl.includes('goa') || lbl.includes('panaji') || lbl.includes('konkan') || lbl.includes('marathi')) {
    return 'mr';
  }
  return 'en';
}

function ramp(value: number | null | undefined, low: number, high: number): number | null {
  if (value === null || value === undefined) return null;
  if (value <= low) return 0.0;
  if (value >= high) return 100.0;
  return Math.round(((value - low) / (high - low)) * 1000) / 10;
}

export function evaluateRisk(weather: any, ocean: any, warnings: any[] = []) {
  const missing: string[] = [];
  const factors: any[] = [];
  const t = FACTOR_THRESHOLDS;

  if (weather) {
    let windEff = weather.wind_speed_kmph;
    if (windEff !== null && windEff !== undefined && weather.wind_gust_kmph !== null && weather.wind_gust_kmph !== undefined) {
      windEff = Math.max(windEff, 0.8 * weather.wind_gust_kmph);
    }
    const windScore = ramp(windEff, t.wind.low, t.wind.high);
    factors.push({
      name: 'wind',
      label: t.wind.label,
      value: windEff !== null && windEff !== undefined ? Math.round(windEff * 100) / 100 : null,
      unit: t.wind.unit,
      score: windScore,
      weight: t.wind.weight,
      status: windScore !== null ? 'ok' : 'missing',
      note: weather.wind_gust_kmph ? 'Includes 80% of gust speed.' : undefined,
    });
    if (windScore === null) missing.push('wind');

    let rainVal = weather.precipitation_mm_24h;
    let rainNote = '24 h forecast total.';
    if (rainVal === null || rainVal === undefined) {
      rainVal = weather.precipitation_mm_last_hour;
      rainNote = 'Last-hour value used (24 h total unavailable).';
    }
    const rainScore = ramp(rainVal, t.rainfall.low, t.rainfall.high);
    factors.push({
      name: 'rainfall',
      label: t.rainfall.label,
      value: rainVal !== null && rainVal !== undefined ? Math.round(rainVal * 100) / 100 : null,
      unit: t.rainfall.unit,
      score: rainScore,
      weight: t.rainfall.weight,
      status: rainScore !== null ? 'ok' : 'missing',
      note: rainNote,
    });
    if (rainScore === null) missing.push('rainfall');
  } else {
    for (const key of ['wind', 'rainfall']) {
      factors.push({
        name: key,
        label: t[key].label,
        value: null,
        unit: t[key].unit,
        score: null,
        weight: t[key].weight,
        status: 'missing',
        note: 'Value unavailable (not assumed zero).',
      });
      missing.push(key);
    }
    missing.push('weather');
  }

  if (ocean) {
    const oceanMetrics = [
      { key: 'wave_height', val: ocean.wave_height_m },
      { key: 'swell', val: ocean.swell_height_m },
      { key: 'ocean_current', val: ocean.ocean_current_speed_kmph },
    ];
    for (const item of oceanMetrics) {
      const s = ramp(item.val, t[item.key].low, t[item.key].high);
      factors.push({
        name: item.key,
        label: t[item.key].label,
        value: item.val !== null && item.val !== undefined ? Math.round(item.val * 100) / 100 : null,
        unit: t[item.key].unit,
        score: s,
        weight: t[item.key].weight,
        status: s !== null ? 'ok' : 'missing',
      });
      if (s === null) missing.push(item.key);
    }
  } else {
    for (const key of ['wave_height', 'swell', 'ocean_current']) {
      factors.push({
        name: key,
        label: t[key].label,
        value: null,
        unit: t[key].unit,
        score: null,
        weight: t[key].weight,
        status: 'missing',
        note: 'Value unavailable (not assumed zero).',
      });
      missing.push(key);
    }
    missing.push('ocean');
  }

  const scored = factors.filter((f) => f.status === 'ok' && f.score !== null);
  let composite = 50.0;
  if (scored.length > 0) {
    const weightSum = scored.reduce((acc, f) => acc + f.weight, 0);
    composite = scored.reduce((acc, f) => acc + f.score * f.weight, 0) / weightSum;
  }

  const missingCount = factors.filter((f) => f.status === 'missing').length;
  let score = composite + Math.min(12.0, 4.0 * missingCount);

  if (!weather || !ocean) {
    score = Math.max(score, 45.0);
  }

  const advisories: string[] = [];
  let warningOverride = false;
  const activeWarnings = (warnings || []).filter((w) => ['warning', 'alert'].includes(w.severity));
  const watchWarnings = (warnings || []).filter((w) => ['advisory', 'watch'].includes(w.severity));

  if (activeWarnings.length > 0) {
    warningOverride = true;
    score = Math.max(score, 85.0);
    advisories.push('Official warning in effect: ' + activeWarnings.map((w) => w.headline).join(' | '));
  } else if (watchWarnings.length > 0) {
    score = Math.max(score, 45.0);
    advisories.push('Official advisory in effect: ' + watchWarnings.map((w) => w.headline).join(' | '));
  }

  if (!ocean) {
    advisories.push('Ocean conditions unavailable — treat sea state as unknown and avoid entering the water.');
  }
  if (!weather) {
    advisories.push('Weather data unavailable — assessment is based on limited information.');
  }

  score = Math.round(Math.min(100.0, Math.max(0.0, score)) * 10) / 10;
  const level: 'LOW' | 'MODERATE' | 'HIGH' = score < 35 ? 'LOW' : score < 60 ? 'MODERATE' : 'HIGH';
  const recommendation = warningOverride ? WARNING_RECOMMENDATION : RECOMMENDATIONS[level];

  return {
    score,
    level,
    factors,
    missing_inputs: Array.from(new Set(missing)).sort(),
    warning_override: warningOverride,
    advisories,
    recommendation,
  };
}

const WEATHER_CODES: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Rime fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Dense drizzle',
  61: 'Light rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Freezing rain',
  67: 'Heavy freezing rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  80: 'Rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Severe thunderstorm with hail',
};

export async function fetchLiveWeather(lat: number, lon: number): Promise<{ data: any; status: 'LIVE' | 'CACHED' }> {
  const cacheKey = `weather:${lat.toFixed(2)}:${lon.toFixed(2)}`;
  const cached = getFromCache('weather', cacheKey);
  if (cached) {
    return { data: cached, status: 'CACHED' };
  }

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,surface_pressure&daily=precipitation_sum&forecast_days=1&timezone=UTC`;
  const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`Weather fetch failed: ${res.statusText}`);
  const data = await res.json();
  const current = data.current || {};
  const daily = data.daily || {};
  const dailyPrecip = (daily.precipitation_sum || [])[0] ?? null;

  const weather = {
    temperature_c: current.temperature_2m ?? null,
    feels_like_c: current.apparent_temperature ?? null,
    humidity_pct: current.relative_humidity_2m ?? null,
    pressure_hpa: current.surface_pressure ?? null,
    wind_speed_kmph: current.wind_speed_10m ?? null,
    wind_gust_kmph: current.wind_gusts_10m ?? null,
    wind_direction_deg: current.wind_direction_10m ?? null,
    precipitation_mm_last_hour: current.precipitation ?? null,
    precipitation_mm_24h: dailyPrecip,
    visibility_km: null,
    condition: WEATHER_CODES[current.weather_code] || 'Unknown',
    source: {
      provider: 'Open-Meteo (IMD fallback)',
      source_url: 'https://api.open-meteo.com/v1/forecast',
      retrieved_at: new Date().toISOString(),
      data_status: 'LIVE',
      note: 'Live meteorology via Open-Meteo API.',
    },
  };
  setInCache('weather', cacheKey, weather, 300);
  return { data: weather, status: 'LIVE' };
}

export async function fetchLiveOcean(lat: number, lon: number): Promise<{ data: any; status: 'LIVE' | 'CACHED' }> {
  const cacheKey = `ocean:${lat.toFixed(2)}:${lon.toFixed(2)}`;
  const cached = getFromCache('ocean', cacheKey);
  if (cached) {
    return { data: cached, status: 'CACHED' };
  }

  // Marine models sometimes need grid snapping seaward for shoreline coordinates
  const candidateCoords = [
    { lat, lon },
    // Slight seaward offsets if coastal coordinate falls on land cell (West Coast / East Coast aware)
    { lat, lon: lon < 78 ? lon - 0.08 : lon + 0.08 },
    { lat: lat + 0.05, lon: lon < 78 ? lon - 0.10 : lon + 0.10 },
  ];

  let rawData: any = null;
  let successUrl = '';

  for (const coord of candidateCoords) {
    try {
      const url = `https://marine-api.open-meteo.com/v1/marine?latitude=${coord.lat.toFixed(4)}&longitude=${coord.lon.toFixed(4)}&current=wave_height,wave_direction,wave_period,wind_wave_height,swell_wave_height,swell_wave_direction,swell_wave_period,ocean_current_velocity,ocean_current_direction,sea_surface_temperature&timezone=UTC`;
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (res.ok) {
        const json = await res.json();
        if (json.current && (json.current.wave_height !== null || json.current.swell_wave_height !== null)) {
          rawData = json;
          successUrl = url;
          break;
        }
      }
    } catch {
      // try next candidate coordinate
    }
  }

  if (!rawData || !rawData.current) {
    throw new Error('Ocean marine forecast coordinates outside active marine grid cell');
  }

  const current = rawData.current;
  const velocityMs = current.ocean_current_velocity ?? null;
  const currentKmph = velocityMs !== null ? Math.round(velocityMs * 3.6 * 100) / 100 : null;

  const ocean = {
    wave_height_m: current.wave_height ?? null,
    wave_period_s: current.wave_period ?? null,
    wave_direction_deg: current.wave_direction ?? null,
    wind_wave_height_m: current.wind_wave_height ?? null,
    swell_height_m: current.swell_wave_height ?? null,
    swell_period_s: current.swell_wave_period ?? null,
    swell_direction_deg: current.swell_wave_direction ?? null,
    sea_surface_temperature_c: current.sea_surface_temperature ?? null,
    ocean_current_speed_kmph: currentKmph,
    source: {
      provider: 'Open-Meteo Marine',
      source_url: successUrl || 'https://marine-api.open-meteo.com/v1/marine',
      retrieved_at: new Date().toISOString(),
      data_status: 'LIVE',
      note: 'Live ocean forecast retrieved from Open-Meteo Marine API.',
    },
  };

  setInCache('ocean', cacheKey, ocean, 300);
  return { data: ocean, status: 'LIVE' };
}

function buildTemplateExplanation(response: any, language: 'mr' | 'en' | 'hi'): string {
  const { risk, weather, ocean, location, warnings } = response;

  if (language === 'mr') {
    const hasCyclone = (warnings || []).some((w: any) => w.type === 'cyclone' || (w.headline || '').toLowerCase().includes('cyclone'));
    const hasMarine = (warnings || []).some((w: any) => w.type === 'marine' || ['warning', 'alert'].includes(w.severity));

    const parts: string[] = [];
    if (hasCyclone) {
      parts.push('समुद्रात जाणे टाळण्याचा सल्ला दिला जातो. अधिकृत चक्रीवादळाचा इशारा लागू आहे.');
      parts.push('स्थानिक प्रशासन आणि अधिकृत हवामान विभागाच्या सूचनांचे तंतोतंत पालन करा.');
    } else if (hasMarine) {
      parts.push('खराब हवामान आणि तीव्र सागरी इशारा लागू आहे.');
      parts.push('समुद्रात जाणे टाळा आणि अधिकृत सागरी हवामान bulletins चे पालन करा.');
    } else if (risk.level === 'HIGH') {
      parts.push('समुद्रात जाणे टाळण्याचा सल्ला दिला जातो. समुद्रात तीव्र वारे आणि उंच लाटा असल्यामुळे धोका जास्त आहे.');
      parts.push('स्थानिक प्रशासन आणि अधिकृत हवामान विभागाच्या सूचनांचे पालन करा.');
    } else if (risk.level === 'MODERATE') {
      parts.push('उद्यासाठी समुद्राची स्थिती मध्यम धोकादायक आहे. वाऱ्याचा वेग आणि लाटांची उंची वाढलेली आहे.');
      parts.push('समुद्रात जाण्यापूर्वी अधिकृत सागरी इशारे तपासा आणि सावधगिरी बाळगा.');
    } else {
      parts.push('समुद्राची स्थिती सध्या तुलनेने अनुकूल आहे.');
      parts.push('तरीही समुद्रात जाण्यापूर्वी ताजे हवामान आणि सागरी इशारे तपासा.');
    }

    const condDetails: string[] = [];
    if (weather && weather.wind_speed_kmph !== null) {
      condDetails.push(`वाऱ्याचा वेग सुमारे ${Math.round(weather.wind_speed_kmph)} km/h`);
    }
    if (ocean && ocean.wave_height_m !== null) {
      condDetails.push(`लाटांची उंची ${ocean.wave_height_m} m`);
    }
    if (condDetails.length > 0) {
      parts.push(`(${condDetails.join(', ')} आहे.)`);
    }
    if (risk.missing_inputs?.length > 0) {
      parts.push('टीप: काही सागरी माहिती उपलब्ध नसल्याने हे मूल्यांकन प्रातिनिधिक मानले जावे.');
    }
    parts.push('हा स्वयंचलित सल्ला आहे. हवामान खात्याच्या (IMD) अधिकृत सूचनांचे नेहमी पालन करा.');
    return parts.join(' ');
  }

  if (language === 'hi') {
    const hasCyclone = (warnings || []).some((w: any) => w.type === 'cyclone' || (w.headline || '').toLowerCase().includes('cyclone'));
    const hasMarine = (warnings || []).some((w: any) => w.type === 'marine' || ['warning', 'alert'].includes(w.severity));

    const parts: string[] = [];
    if (hasCyclone) {
      parts.push('समुद्र में जाने से बचने की सलाह दी जाती है। आधिकारिक चक्रवात चेतावनी लागू है।');
      parts.push('स्थानीय प्रशासन और आधिकारिक मौसम विभाग के निर्देशों का कड़ाई से पालन करें।');
    } else if (hasMarine) {
      parts.push('खराब मौसम और गंभीर समुद्री चेतावनी प्रभावी है।');
      parts.push('समुद्र में जाने से बचें और आधिकारिक समुद्री मौसम बुलेटिन का पालन करें।');
    } else if (risk.level === 'HIGH') {
      parts.push('समुद्र में जाने से बचने की सलाह दी जाती है। तेज हवाओं और ऊंची लहरों के कारण जोखिम अधिक है।');
      parts.push('स्थानीय प्रशासन और मौसम विभाग की आधिकारिक सलाह का पालन करें।');
    } else if (risk.level === 'MODERATE') {
      parts.push('समुद्र की स्थिति मध्यम रूप से जोखिम भरी है। हवा की गति और लहरों की ऊंचाई में वृद्धि हुई है।');
      parts.push('समुद्र में जाने से पहले आधिकारिक चेतावनी की जांच करें और अत्यधिक सावधानी बरतें।');
    } else {
      parts.push('समुद्र की स्थिति वर्तमान में अपेक्षाकृत अनुकूल है।');
      parts.push('फिर भी समुद्र में उतरने से पहले नवीनतम मौसम और आधिकारिक बुलेटिन अवश्य जांचें।');
    }

    const condDetails: string[] = [];
    if (weather && weather.wind_speed_kmph !== null) {
      condDetails.push(`हवा की गति लगभग ${Math.round(weather.wind_speed_kmph)} km/h`);
    }
    if (ocean && ocean.wave_height_m !== null) {
      condDetails.push(`लहरों की ऊंचाई ${ocean.wave_height_m} m`);
    }
    if (condDetails.length > 0) {
      parts.push(`(${condDetails.join(', ')} है।)`);
    }
    if (risk.missing_inputs?.length > 0) {
      parts.push('नोट: कुछ समुद्री डेटा अनुपलब्ध होने के कारण यह मूल्यांकन केवल सांकेतिक माना जाए।');
    }
    parts.push('यह स्वचालित सलाह है। भारत मौसम विज्ञान विभाग (IMD) की आधिकारिक सूचनाओं का हमेशा पालन करें।');
    return parts.join(' ');
  }

  // English Template
  const parts: string[] = [
    `Current risk for ${location.label || 'this location'} is ${risk.level} (score ${risk.score}/100).`,
  ];
  if (weather && weather.wind_speed_kmph !== null) {
    let wText = `Wind is about ${Math.round(weather.wind_speed_kmph)} km/h`;
    if (weather.precipitation_mm_24h !== null) {
      wText += ` with roughly ${Math.round(weather.precipitation_mm_24h)} mm of rain expected in 24 hours.`;
    } else {
      wText += '.';
    }
    parts.push(wText);
  }
  if (ocean && ocean.wave_height_m !== null) {
    parts.push(`Wave height is around ${ocean.wave_height_m} m.`);
  }
  for (const warning of warnings || []) {
    parts.push(`Official ${warning.severity}: ${warning.headline}`);
  }
  if (risk.missing_inputs?.length > 0) {
    parts.push(`Some data was unavailable (${risk.missing_inputs.join(', ')}), so treat this as indicative only.`);
  }
  parts.push(risk.recommendation);
  parts.push('This is an automated advisory, not a guarantee of safety. Always follow official IMD/NDMA advisories.');
  return parts.join(' ');
}

let geminiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI | null {
  if (!geminiClient && process.env.GEMINI_API_KEY) {
    try {
      geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    } catch {
      geminiClient = null;
    }
  }
  return geminiClient;
}

async function generateAIExplanation(response: any, targetLang: 'mr' | 'en' | 'hi') {
  const genai = getGemini();
  if (genai) {
    try {
      const systemPrompt = `You are ORCA, a marine safety explanation assistant.
Generate a short, simple plain-language summary based only on the supplied assessment data.
Selected language: ${targetLang}

STRICT GUARDRAILS:
1. If the selected language is 'mr', write the complete summary in Marathi using Devanagari script.
2. If the selected language is 'hi', write the complete summary in Hindi using Devanagari script.
3. If the selected language is 'en', write the complete summary in English.
4. Do not invent weather or ocean values.
5. Do not change the risk level or risk score.
6. Do not override official warnings or deterministic safety vetoes.
7. Do not say that conditions are guaranteed safe.
8. Use simple language suitable for fishermen and coastal users.
9. Clearly explain the main risk factors, safety vetoes (if active), and the recommended action.
10. Keep explanation under 100 words.`;

      const compactData = {
        location: response.location,
        risk: {
          score: response.risk.score,
          level: response.risk.level,
          risk_index: response.risk.risk_index,
          warning_override: response.risk.warning_override,
          veto_decision: response.risk.veto?.decision,
          veto_reasons: response.risk.veto?.veto_reasons,
          recommendation: response.risk.recommendation,
        },
        warnings: (response.warnings || []).map((w: any) => w.headline),
        conditions: {
          wind_kmph: response.weather?.wind_speed_kmph ?? null,
          rain_24h_mm: response.weather?.precipitation_mm_24h ?? null,
          wave_height_m: response.ocean?.wave_height_m ?? null,
          swell_height_m: response.ocean?.swell_height_m ?? null,
          current_kmph: response.ocean?.ocean_current_speed_kmph ?? null,
        },
      };

      const result = await genai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          { role: 'user', parts: [{ text: `${systemPrompt}\n\nData:\n${JSON.stringify(compactData)}` }] }
        ],
      });

      const text = result.text?.trim();
      if (text) {
        return {
          text,
          provider: 'llm:gemini-2.5-flash',
          generated_at: new Date().toISOString(),
          language: targetLang,
        };
      }
    } catch (err) {
      console.warn('Gemini explanation error, using template:', err);
    }
  }

  return {
    text: buildTemplateExplanation(response, targetLang),
    provider: 'template',
    generated_at: new Date().toISOString(),
    language: targetLang,
  };
}

// ----------------- API ROUTES ----------------- //

function buildProviderHealthSummary(sources?: any, providers?: any) {
  const isImdConfigured = Boolean(process.env.IMD_API_KEY || process.env.IMD_CAP_URL);
  const isIncoisConfigured = Boolean(process.env.INCOIS_API_KEY || process.env.INCOIS_TOKEN);
  const isMosdacConfigured = Boolean(process.env.MOSDAC_API_KEY || process.env.MOSDAC_TOKEN);

  const openMeteoStatus = sources?.open_meteo?.status || providers?.open_meteo?.status || 'LIVE';
  const imdStatus = sources?.imd?.status || providers?.imd?.status || (isImdConfigured ? 'LIVE' : 'CONFIG_REQUIRED');
  const incoisStatus = sources?.incois?.status || providers?.incois?.status || (isIncoisConfigured ? 'LIVE' : 'CONFIG_REQUIRED');
  const mosdacStatus = sources?.mosdac?.status || providers?.mosdac?.status || (isMosdacConfigured ? 'LIVE' : 'CONFIG_REQUIRED');

  return {
    open_meteo: {
      name: 'Open-Meteo Marine & Weather API',
      status: openMeteoStatus,
      endpoint: 'https://api.open-meteo.com/',
      configured: true,
      last_retrieval: providers?.open_meteo?.retrieved_at || sources?.open_meteo?.last_retrieval_attempt || new Date().toISOString(),
      latency_ms: null,
      freshness: providers?.open_meteo?.age_seconds !== null && providers?.open_meteo?.age_seconds < 1800 ? 'LIVE' : 'RECENT',
      error: providers?.open_meteo?.error || sources?.open_meteo?.error || null,
      note: 'Live meteorology fallback endpoint active.',
    },
    imd: {
      name: 'India Meteorological Department (IMD)',
      status: imdStatus,
      endpoint: 'https://api.imd.gov.in/api/v1',
      configured: isImdConfigured,
      last_retrieval: providers?.imd?.source_timestamp || null,
      latency_ms: null,
      freshness: null,
      error: providers?.imd?.error || sources?.imd?.error || null,
      note: isImdConfigured
        ? 'Official IMD coastal weather and warning service configured.'
        : 'Awaiting official IMD API key or CAP access token.',
    },
    incois: {
      name: 'INCOIS Ocean State Forecast / PFZ',
      status: incoisStatus,
      endpoint: 'https://incois.gov.in/api/v1',
      configured: isIncoisConfigured,
      last_retrieval: providers?.incois?.source_timestamp || null,
      latency_ms: null,
      freshness: null,
      error: providers?.incois?.error || sources?.incois?.error || null,
      note: isIncoisConfigured
        ? 'Official INCOIS Ocean State Forecast service configured.'
        : 'Awaiting official INCOIS data service credentials.',
    },
    mosdac: {
      name: 'ISRO MOSDAC Satellite Ocean Data',
      status: mosdacStatus,
      endpoint: 'https://www.mosdac.gov.in/api/v1/satellite_ocean',
      configured: isMosdacConfigured,
      last_retrieval: providers?.mosdac?.source_timestamp || null,
      latency_ms: null,
      freshness: null,
      error: providers?.mosdac?.error || sources?.mosdac?.error || null,
      note: isMosdacConfigured
        ? 'Official ISRO MOSDAC ocean satellite data service configured.'
        : 'Awaiting official MOSDAC/SAC token activation.',
    },
  };
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/health', (req, res) => {
  const uptimeSeconds = Math.round((Date.now() - startTime) / 100) / 10;
  const mem = process.memoryUsage();
  res.json({
    status: 'UP',
    service: 'orca-marine-safety',
    version: '0.2.0',
    uptime_seconds: uptimeSeconds,
    demo_mode: true,
    cache: cache.stats,
    memory: {
      rss_mb: Math.round((mem.rss / 1024 / 1024) * 10) / 10,
      heap_used_mb: Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10,
    },
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/info', (req, res) => {
  const providersHealth = buildProviderHealthSummary();
  res.json({
    message: 'ORCA Marine Safety & Coastal Advisory Backend',
    service_name: 'orca-marine-safety',
    version: '0.2.0',
    api_version: '0.2.0',
    status: 'OPERATIONAL',
    health: '/health',
    health_url: '/health',
    docs_url: '/docs',
    openapi_url: '/openapi.json',
    environment: process.env.NODE_ENV || 'development',
    demo_mode_available: true,
    default_mode: 'live',
    deterministic_engine: {
      status: 'ONLINE',
      version: '1.0.0',
      veto_pipeline: 'ACTIVE',
      rule_governance: 'DETERMINISTIC',
      ai_override_allowed: false,
    },
    capabilities: [
      'deterministic_risk_index',
      'deterministic_safety_veto',
      'vessel_class_limits',
      'drift_vector_prediction',
      'iamsar_search_radius',
      'coastal_geofencing',
      'marine_sanctuary_protection',
      'imbl_boundary_proximity',
      'pfz_fisheries_exposure',
      'multi_source_agreement',
      'data_quality_degradation_tracking',
      'structured_evidence_linkage',
    ],
    providers: providersHealth,
    provider_failure_semantics: {
      UNAVAILABLE: 'Provider temporarily unreachable; warning status cannot be assumed safe.',
      CONFIG_REQUIRED: 'Provider credentials unconfigured; missing data remains null.',
      ERROR: 'Provider error; uncertainty preserved.',
    },
  });
});

app.get('/openapi.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json(ORCA_OPENAPI_SPEC);
});

app.get('/docs', (req, res) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ORCA Marine Safety API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css" />
  <style>
    body { margin: 0; background: #fafafa; font-family: sans-serif; }
    .topbar { display: none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      SwaggerUIBundle({
        url: '/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
      });
    };
  </script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

app.get('/api/meta', (req, res) => {
  res.json({
    version: '0.2.0',
    demo_mode: true,
    sources: SOURCES,
    supported_coastal_regions: SUPPORTED_COASTAL_REGIONS,
    factor_thresholds: FACTOR_THRESHOLDS,
    risk_levels: LEVEL_BANDS,
    guardrails: GUARDRAILS,
    limitations: LIMITATIONS,
    demo_locations: DEMO_LOCATIONS,
  });
});

app.get('/api/demo/locations', (req, res) => {
  res.json(DEMO_LOCATIONS);
});

app.post('/api/assess', async (req, res) => {
  try {
    const {
      latitude,
      longitude,
      label,
      demo = false,
      include_explanation = true,
      language = 'auto',
      vessel_beam_m,
      vessel_class,
      fuel_endurance_h,
      last_known_latitude,
      last_known_longitude,
      mission_type,
      forecast_horizon_h,
      enable_geofencing,
    } = req.body || {};

    // 1. Strict Coordinate & Input Validation
    if (latitude === undefined || latitude === null || String(latitude).trim() === '') {
      return res.status(422).json({
        error: { code: 'VALIDATION_ERROR', message: 'Valid latitude is required.', field: 'latitude' },
      });
    }

    const lat = parseFloat(latitude);
    if (isNaN(lat)) {
      return res.status(422).json({
        error: { code: 'VALIDATION_ERROR', message: 'Latitude must be a valid number.', field: 'latitude' },
      });
    }

    if (lat < -90 || lat > 90) {
      return res.status(422).json({
        error: {
          code: 'INVALID_LATITUDE',
          message: `Latitude must be between -90 and 90 degrees. Received: ${lat}`,
          field: 'latitude',
        },
      });
    }

    if (longitude === undefined || longitude === null || String(longitude).trim() === '') {
      return res.status(422).json({
        error: { code: 'VALIDATION_ERROR', message: 'Valid longitude is required.', field: 'longitude' },
      });
    }

    const lon = parseFloat(longitude);
    if (isNaN(lon)) {
      return res.status(422).json({
        error: { code: 'VALIDATION_ERROR', message: 'Longitude must be a valid number.', field: 'longitude' },
      });
    }

    if (lon < -180 || lon > 180) {
      return res.status(422).json({
        error: {
          code: 'INVALID_LONGITUDE',
          message: `Longitude must be between -180 and 180 degrees. Received: ${lon}`,
          field: 'longitude',
        },
      });
    }

    // Parse & validate optional vessel parameters safely
    let parsedVesselBeam: number | null = null;
    if (vessel_beam_m !== undefined && vessel_beam_m !== null) {
      parsedVesselBeam = parseFloat(vessel_beam_m);
      if (isNaN(parsedVesselBeam) || parsedVesselBeam < 0) {
        return res.status(422).json({
          error: {
            code: 'INVALID_VESSEL_PARAMETER',
            message: 'Vessel beam dimension cannot be negative.',
            field: 'vessel_beam_m',
          },
        });
      }
    }

    let parsedFuelEndurance: number | null = null;
    if (fuel_endurance_h !== undefined && fuel_endurance_h !== null) {
      parsedFuelEndurance = parseFloat(fuel_endurance_h);
      if (isNaN(parsedFuelEndurance) || parsedFuelEndurance < 0) {
        return res.status(422).json({
          error: {
            code: 'INVALID_VESSEL_PARAMETER',
            message: 'Fuel endurance cannot be negative.',
            field: 'fuel_endurance_h',
          },
        });
      }
    }

    let parsedHorizon: number | null = null;
    if (forecast_horizon_h !== undefined && forecast_horizon_h !== null) {
      parsedHorizon = parseFloat(forecast_horizon_h);
      if (isNaN(parsedHorizon) || parsedHorizon <= 0 || parsedHorizon > 168) {
        return res.status(422).json({
          error: {
            code: 'INVALID_HORIZON',
            message: 'Forecast horizon must be between 1 and 168 hours.',
            field: 'forecast_horizon_h',
          },
        });
      }
    }

    const parsedLastLat = last_known_latitude !== undefined && last_known_latitude !== null ? parseFloat(last_known_latitude) : null;
    const parsedLastLon = last_known_longitude !== undefined && last_known_longitude !== null ? parseFloat(last_known_longitude) : null;
    const parsedGeofencing = enable_geofencing !== undefined ? Boolean(enable_geofencing) : Boolean(vessel_class);

    const requestId = `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;

    // Route through the multi-source OrcaOrchestrator pipeline
    const pipelineData = await OrcaOrchestrator.collectAndProcess({
      latitude: lat,
      longitude: lon,
      label,
      demo: Boolean(demo),
      vessel_beam_m: parsedVesselBeam,
      vessel_class: vessel_class || null,
      fuel_endurance_h: parsedFuelEndurance,
      last_known_latitude: parsedLastLat,
      last_known_longitude: parsedLastLon,
      mission_type: mission_type || null,
      forecast_horizon_h: parsedHorizon,
      enable_geofencing: parsedGeofencing,
    });

    // Execute the deterministic risk engine on the Common Marine Data Model
    const risk = evaluateRiskEngine(pipelineData);
    const dataQualityReport = evaluateDataQuality(pipelineData);
    const providerHealthMap = buildProviderHealthSummary(pipelineData.metadata.sources, pipelineData.providers);

    const targetLang: 'mr' | 'en' | 'hi' =
      language === 'mr' || language === 'en' || language === 'hi'
        ? language
        : detectRegionalLanguage(lat, lon, label);

    const responsePayload: any = {
      request_id: requestId,
      assessed_at: pipelineData.time.retrieved_at,
      mode: pipelineData.metadata.source_status.toLowerCase(),
      is_demo: Boolean(demo) || pipelineData.metadata.source_status === 'DEMO',
      api_version: '0.2.0',
      location: pipelineData.location,
      time: pipelineData.time,
      decision: risk.veto?.decision ?? (risk.score >= 60 ? 'NO-GO' : risk.score >= 35 ? 'CAUTION' : 'GO'),
      deterministic_decision: risk.veto?.decision ?? 'GO',
      veto: {
        is_veto: risk.veto?.is_veto ?? false,
        triggered: risk.veto?.is_veto ?? false,
        decision: risk.veto?.decision ?? 'GO',
        reasons: risk.veto?.veto_reasons ?? [],
        veto_reasons: risk.veto?.veto_reasons ?? [],
        reason_codes: risk.veto?.reason_codes ?? [],
        warning_veto: risk.veto?.warning_veto ?? false,
        wave_veto: risk.veto?.wave_veto ?? false,
        wind_veto: risk.veto?.wind_veto ?? false,
        boundary_veto: risk.veto?.boundary_veto ?? false,
        vessel_limits_applied: risk.veto?.vessel_limits_applied ?? null,
        warnings_status: risk.veto?.warnings_status ?? 'ABSENT',
      },
      risk: {
        score: risk.score,
        level: risk.level,
        risk_index: risk.risk_index,
        risk_index_breakdown: risk.risk_index_breakdown,
        factors: risk.factors,
        missing_inputs: risk.missing_inputs,
        warning_override: risk.warning_override,
        advisories: risk.advisories,
        recommendation: risk.recommendation,
        veto: risk.veto,
        evidence: risk.evidence,
        evaluated_at: pipelineData.time.retrieved_at,
      },
      confidence: {
        score: pipelineData.metadata.confidence,
        breakdown: pipelineData.metadata.confidence_breakdown,
        is_high_confidence: pipelineData.metadata.confidence >= 0.8,
      },
      data_quality: dataQualityReport,
      weather: pipelineData.weather,
      ocean: pipelineData.ocean,
      ecosystem: pipelineData.ecosystem,
      warnings: pipelineData.warnings.items,
      warning_summary: {
        status: pipelineData.warnings.status,
        provider: pipelineData.warnings.provider,
        count: pipelineData.warnings.items.length,
        has_active_warnings: pipelineData.warnings.items.length > 0,
        provider_reachable: pipelineData.warnings.status !== 'UNAVAILABLE',
        uncertainty_note:
          pipelineData.warnings.status === 'UNAVAILABLE'
            ? 'Official warning provider unreachable. Warning status cannot be confirmed safe.'
            : null,
      },
      vessel: pipelineData.vessel,
      geofencing: pipelineData.geofencing,
      cyclone: pipelineData.cyclone || null,
      drift: risk.drift,
      predicted_position: risk.drift?.prediction?.predicted_position || null,
      search_radius: risk.drift?.prediction
        ? {
            radius_nm: risk.drift.prediction.search_radius_nm,
            radius_km: risk.drift.prediction.search_radius_km,
            initial_radius_nm: risk.drift.prediction.initial_search_radius_nm,
            drift_uncertainty_factor: risk.drift.prediction.drift_uncertainty_factor,
          }
        : null,
      providers: providerHealthMap,
      sources: pipelineData.metadata.sources,
      metadata: {
        source_status: pipelineData.metadata.source_status,
        data_completeness: pipelineData.metadata.data_completeness,
        confidence: pipelineData.metadata.confidence,
        confidence_breakdown: pipelineData.metadata.confidence_breakdown,
        freshness: pipelineData.time.freshness,
        validation_status: pipelineData.metadata.validation_status,
        errors: pipelineData.metadata.errors,
        missing_fields: pipelineData.metadata.missing_fields,
        source_conflicts: pipelineData.metadata.source_conflicts,
        retrieved_at: pipelineData.time.retrieved_at,
      },
      evidence: risk.evidence,
      explanation: null,
    };

    if (include_explanation) {
      responsePayload.explanation = await generateAIExplanation(responsePayload, targetLang);
    }

    res.json(responsePayload);
  } catch (error: any) {
    console.error('Assess API error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || 'Assessment failed',
      },
    });
  }
});

/**
 * High-Quality Server-Side Neural TTS Endpoint
 * Generates natural human-like female speech using Gemini TTS (Kore voice)
 * Keeps all API keys securely on the server.
 */
app.post('/api/tts', async (req, res) => {
  try {
    const { text, language: _lang } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text parameter required', fallback: true });
    }

    const genai = getGemini();
    if (!genai) {
      return res.status(503).json({ error: 'Neural TTS client unavailable', fallback: true });
    }

    // Call Gemini TTS model with female voice Kore (supports English, Hindi, and Marathi)
    const response = await genai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: text.trim(),
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: 'Kore',
            },
          },
        },
      },
    });

    const audioPart = response.candidates?.[0]?.content?.parts?.[0];
    const base64Data = audioPart?.inlineData?.data;
    const mimeType = audioPart?.inlineData?.mimeType || 'audio/wav';

    if (!base64Data) {
      return res.status(502).json({ error: 'No audio returned from TTS engine', fallback: true });
    }

    const audioBuffer = Buffer.from(base64Data, 'base64');
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', audioBuffer.length);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(audioBuffer);
  } catch (error: any) {
    console.warn('Neural TTS generation failed:', error.message);
    res.status(500).json({ error: error.message || 'TTS failure', fallback: true });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`ORCA fullstack server listening on http://${HOST}:${PORT}`);
  });
}

startServer();
