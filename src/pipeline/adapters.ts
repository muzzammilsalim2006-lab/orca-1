/**
 * ORCA Pipeline Source Adapters
 * Encapsulates adapters for:
 * 1. Open-Meteo Marine & Meteorology (Live API)
 * 2. IMD (Official Weather, Cyclone Bulletins)
 * 3. INCOIS (High Wave Alerts, Ocean State Forecast, PFZ)
 * 4. MOSDAC (ISRO Satellite Sea Surface Winds & SST)
 */

import {
  WeatherObservation,
  OceanObservation,
  SourceStatus,
  SourceHealthEntry,
  WarningsSummary,
  ProviderProvenance,
  CycloneObservation,
  EcosystemObservation,
  OfficialWarning,
} from './models';
import {
  normalizeImdWeather,
  normalizeImdWarnings,
  normalizeImdCycloneData,
} from './imdNormalizer';
import {
  normalizeIncoisOcean,
  normalizeIncoisAlerts,
  normalizeIncoisPfz,
} from './incoisNormalizer';
import {
  normalizeMosdacData,
  MosdacObservationResult,
} from './mosdacNormalizer';
import { resolveCoastalRegion } from './geo';
import { kmphToMps } from './units';

export interface SourceFetchResult<T> {
  data: T | null;
  status: SourceStatus;
  retrieved_at: string;
  source_url?: string;
  source_timestamp?: string | null;
  error?: string | null;
  note?: string;
  missing_fields?: string[];
}

export function buildProviderProvenance(
  provider_id: string,
  name: string,
  status: SourceStatus,
  retrieved_at: string,
  source_timestamp: string | null = null,
  missing_fields: string[] = [],
  source_url?: string,
  error?: string | null,
  note?: string
): ProviderProvenance {
  let age_seconds: number | null = null;
  if (source_timestamp) {
    const ts = new Date(source_timestamp).getTime();
    if (!isNaN(ts)) {
      age_seconds = Math.max(0, Math.round((Date.now() - ts) / 1000));
    }
  } else if (retrieved_at) {
    const ts = new Date(retrieved_at).getTime();
    if (!isNaN(ts)) {
      age_seconds = Math.max(0, Math.round((Date.now() - ts) / 1000));
    }
  }

  return {
    provider_id,
    name,
    status,
    retrieved_at,
    source_timestamp,
    age_seconds,
    source_url,
    error,
    note,
    missing_fields,
  };
}

// In-memory cache helper
const adapterCache = new Map<string, { data: any; expiry: number; status: SourceStatus }>();

function getCache(key: string): { data: any; status: SourceStatus } | null {
  const item = adapterCache.get(key);
  if (item && item.expiry > Date.now()) {
    return { data: item.data, status: 'CACHED' };
  }
  return null;
}

function setCache(key: string, data: any, ttlSeconds: number) {
  adapterCache.set(key, { data, expiry: Date.now() + ttlSeconds * 1000, status: 'CACHED' });
}

/**
 * Open-Meteo Weather Adapter (Live API with timeout & error handling)
 */
export async function fetchOpenMeteoWeather(
  lat: number,
  lon: number,
  timeoutMs = 6000
): Promise<SourceFetchResult<WeatherObservation>> {
  const cacheKey = `weather:${lat.toFixed(2)}:${lon.toFixed(2)}`;
  const cached = getCache(cacheKey);
  if (cached) {
    return {
      data: cached.data,
      status: 'CACHED',
      retrieved_at: new Date().toISOString(),
      source_url: 'https://api.open-meteo.com/v1/forecast',
      note: 'Retrieved from server-side cache (TTL 300s).',
    };
  }

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,surface_pressure&daily=precipitation_sum&forecast_days=1&timezone=UTC`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) {
      throw new Error(`Open-Meteo Weather HTTP ${res.status}: ${res.statusText}`);
    }
    const data = await res.json();
    if (!data || !data.current) {
      throw new Error('Malformed Open-Meteo weather response payload');
    }

    const current = data.current;
    const daily = data.daily || {};
    const rain24h = daily.precipitation_sum && daily.precipitation_sum.length > 0 ? daily.precipitation_sum[0] : null;

    const windKmph = current.wind_speed_10m ?? null;
    const gustKmph = current.wind_gusts_10m ?? null;

    const weatherObs: WeatherObservation = {
      temperature_c: current.temperature_2m ?? null,
      feels_like_c: current.apparent_temperature ?? null,
      humidity_pct: current.relative_humidity_2m ?? null,
      pressure_hpa: current.surface_pressure ?? null,
      wind_speed_kmph: windKmph,
      wind_speed_mps: kmphToMps(windKmph),
      wind_gust_kmph: gustKmph,
      wind_gust_mps: kmphToMps(gustKmph),
      wind_direction_deg: current.wind_direction_10m ?? null,
      precipitation_mm_last_hour: current.precipitation ?? null,
      precipitation_mm_24h: rain24h,
      visibility_km: null, // Open-Meteo forecast current does not supply surface visibility in this profile; remains null
      cloud_cover_percent: current.cloud_cover !== undefined ? current.cloud_cover : null,
      lightning_density: null, // Lightning density supplied by IMD ground network
      condition: current.weather_code !== undefined ? getWeatherConditionName(current.weather_code) : null,
      source: {
        provider: 'Open-Meteo Meteorology',
        source_url: url,
        retrieved_at: new Date().toISOString(),
        source_timestamp: current.time || null,
        data_status: 'LIVE',
        note: 'Live meteorology via Open-Meteo API.',
      },
    };

    setCache(cacheKey, weatherObs, 300);

    return {
      data: weatherObs,
      status: 'LIVE',
      retrieved_at: weatherObs.source.retrieved_at,
      source_timestamp: weatherObs.source.source_timestamp,
      source_url: url,
      missing_fields: ['visibility_km', 'lightning_density'],
    };
  } catch (err: any) {
    return {
      data: null,
      status: 'UNAVAILABLE',
      retrieved_at: new Date().toISOString(),
      source_url: url,
      error: err.message || 'Weather fetch error',
      missing_fields: ['temperature_c', 'wind_speed_kmph', 'humidity_pct', 'precipitation_mm_24h'],
    };
  }
}

/**
 * Open-Meteo Marine Adapter (Live API with seaward boundary snapping)
 */
export async function fetchOpenMeteoMarine(
  lat: number,
  lon: number,
  timeoutMs = 6000
): Promise<SourceFetchResult<OceanObservation>> {
  const cacheKey = `ocean:${lat.toFixed(2)}:${lon.toFixed(2)}`;
  const cached = getCache(cacheKey);
  if (cached) {
    return {
      data: cached.data,
      status: 'CACHED',
      retrieved_at: new Date().toISOString(),
      source_timestamp: cached.data.source?.source_timestamp || null,
      source_url: 'https://marine-api.open-meteo.com/v1/marine',
      note: 'Retrieved from server-side cache (TTL 300s).',
      missing_fields: ['tide_height_m', 'tide_time_utc'],
    };
  }

  // Shoreline coordinate snapping candidates
  const candidates = [
    { lat, lon },
    // Seaward adjustments (West coast lon < 78 snaps westward, East coast snaps eastward)
    { lat, lon: lon < 78 ? lon - 0.08 : lon + 0.08 },
    { lat: lat + 0.04, lon: lon < 78 ? lon - 0.12 : lon + 0.12 },
  ];

  let rawData: any = null;
  let successUrl = '';
  let lastErr = '';

  for (const c of candidates) {
    const url = `https://marine-api.open-meteo.com/v1/marine?latitude=${c.lat.toFixed(4)}&longitude=${c.lon.toFixed(4)}&current=wave_height,wave_direction,wave_period,wind_wave_height,swell_wave_height,swell_wave_direction,swell_wave_period,ocean_current_velocity,ocean_current_direction,sea_surface_temperature&timezone=UTC`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (res.ok) {
        const json = await res.json();
        if (json.current && (json.current.wave_height !== null || json.current.swell_wave_height !== null)) {
          rawData = json;
          successUrl = url;
          break;
        }
      } else {
        lastErr = `HTTP ${res.status}: ${res.statusText}`;
      }
    } catch (e: any) {
      lastErr = e.message;
    }
  }

  if (!rawData || !rawData.current) {
    return {
      data: null,
      status: 'UNAVAILABLE',
      retrieved_at: new Date().toISOString(),
      error: `Marine data outside active ocean grid cell: ${lastErr}`,
      missing_fields: ['wave_height_m', 'wave_period_s', 'swell_height_m', 'ocean_current_speed_kmph'],
    };
  }

  const current = rawData.current;
  const velocityMs = current.ocean_current_velocity ?? null;
  const currentKmph = velocityMs !== null ? Math.round(velocityMs * 3.6 * 100) / 100 : null;

  const oceanObs: OceanObservation = {
    wave_height_m: current.wave_height !== null && current.wave_height !== undefined ? Math.round(current.wave_height * 100) / 100 : null,
    wave_period_s: current.wave_period !== null && current.wave_period !== undefined ? Math.round(current.wave_period * 10) / 10 : null,
    wave_direction_deg: current.wave_direction ?? null,
    wind_wave_height_m: current.wind_wave_height !== null && current.wind_wave_height !== undefined ? Math.round(current.wind_wave_height * 100) / 100 : null,
    swell_height_m: current.swell_wave_height !== null && current.swell_wave_height !== undefined ? Math.round(current.swell_wave_height * 100) / 100 : null,
    swell_period_s: current.swell_wave_period !== null && current.swell_wave_period !== undefined ? Math.round(current.swell_wave_period * 10) / 10 : null,
    swell_direction_deg: current.swell_wave_direction ?? null,
    sea_surface_temperature_c: current.sea_surface_temperature ?? null,
    ocean_current_speed_kmph: currentKmph,
    ocean_current_speed_mps: velocityMs,
    ocean_current_direction_deg: current.ocean_current_direction ?? null,
    current_u_mps: null, // Provided by INCOIS
    current_v_mps: null, // Provided by INCOIS
    significant_wave_height_m: current.wave_height !== null && current.wave_height !== undefined ? Math.round(current.wave_height * 100) / 100 : null,
    peak_wave_period_s: current.wave_period !== null && current.wave_period !== undefined ? Math.round(current.wave_period * 10) / 10 : null,
    tide_height_m: null, // Provided by INCOIS tide gauge network
    tide_time_utc: null,
    source: {
      provider: 'Open-Meteo Marine',
      source_url: successUrl,
      retrieved_at: new Date().toISOString(),
      source_timestamp: current.time || null,
      data_status: 'LIVE',
      note: 'Live ocean forecast retrieved from Open-Meteo Marine API.',
    },
  };

  setCache(cacheKey, oceanObs, 300);

  return {
    data: oceanObs,
    status: 'LIVE',
    retrieved_at: oceanObs.source.retrieved_at,
    source_timestamp: oceanObs.source.source_timestamp,
    source_url: successUrl,
    missing_fields: ['tide_height_m', 'tide_time_utc', 'current_u_mps', 'current_v_mps'],
  };
}

export interface ImdFetchResult {
  weather: WeatherObservation | null;
  warnings: WarningsSummary;
  cyclone?: CycloneObservation | null;
  health: SourceHealthEntry;
}

/**
 * IMD (India Meteorological Department) Official Source Adapter
 * 
 * Connects to official IMD API portal (https://api.imd.gov.in/api/v1):
 * - District-wise Warnings (/districtwarning)
 * - Coastal Bulletins (/coastalbulletin)
 * - Port Warnings (/portwarning)
 * - Current Weather (/current_wx)
 * - Cyclone Track (/cyclone_track)
 * 
 * Rules:
 * - If IMD_API_KEY is not configured in the environment, reports CONFIG_REQUIRED. Never fabricates data.
 * - Handles authentication errors gracefully without crashing the pipeline.
 * - Normalizes warnings with Day 1-5 numeric color codes (1=Red, 2=Orange, 3=Yellow, 4=Green).
 * - Preserves provenance, exact issue/validity timestamps, and station IDs.
 */
export async function fetchImdData(
  lat: number,
  lon: number,
  regionName?: string,
  districtName?: string,
  timeoutMs?: number
): Promise<ImdFetchResult> {
  const apiKey = process.env.IMD_API_KEY;
  const imdEndpoint = process.env.IMD_ENDPOINT_URL;
  const imdCapUrl = process.env.IMD_CAP_URL;
  const envTimeout = process.env.IMD_TIMEOUT_MS ? parseInt(process.env.IMD_TIMEOUT_MS, 10) : NaN;
  const configuredTimeout = timeoutMs || (!isNaN(envTimeout) && envTimeout > 0 ? envTimeout : 5000);

  const geo = resolveCoastalRegion(lat, lon);
  const targetDistrict = districtName || geo.districtName;
  const targetRegion = regionName || geo.regionName;
  const targetDistrictId = geo.districtId;
  const targetStationId = geo.stationId;
  const targetPortId = geo.portId;

  const nowIso = new Date().toISOString();

  // 1. Strict Configuration Verification
  if (!apiKey && !imdEndpoint && !imdCapUrl) {
    return {
      weather: null,
      warnings: {
        status: 'UNAVAILABLE',
        items: [],
        provider: 'India Meteorological Department (IMD)',
        retrieved_at: nowIso,
      },
      cyclone: null,
      health: {
        provider_id: 'imd',
        name: 'India Meteorological Department (IMD)',
        status: 'CONFIG_REQUIRED',
        last_retrieval_attempt: nowIso,
        error: 'IMD credentials or endpoint URL (IMD_API_KEY or IMD_ENDPOINT_URL) not configured in environment',
        note: 'Adapter ready; awaiting authorized IMD API key (IMD_API_KEY).',
      },
    };
  }

  // Check in-memory cache for recent IMD response (TTL 300s)
  const cacheKey = `imd:${lat.toFixed(2)}:${lon.toFixed(2)}`;
  const cached = getCache(cacheKey);
  if (cached) {
    return {
      weather: cached.data.weather,
      warnings: cached.data.warnings,
      cyclone: cached.data.cyclone || null,
      health: {
        provider_id: 'imd',
        name: 'India Meteorological Department (IMD)',
        status: 'CACHED',
        last_retrieval_attempt: nowIso,
        last_success: cached.data.retrieved_at,
        note: 'Retrieved from server-side cache (TTL 300s).',
      },
    };
  }

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'User-Agent': 'ORCA-Marine-Safety-System/1.0',
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
    headers['X-API-KEY'] = apiKey;
  }

  // Determine base API endpoint
  const isCustomEndpoint = Boolean(imdEndpoint || imdCapUrl);
  const baseUrl = (imdEndpoint || imdCapUrl || 'https://api.imd.gov.in/api/v1').replace(/\/+$/, '');

  try {
    let rawWeatherPayload: any = null;
    let rawWarningsPayload: any = null;
    let cycloneData: CycloneObservation | null = null;
    const collectedWarnings: any[] = [];

    if (isCustomEndpoint && (baseUrl.includes('?') || !baseUrl.endsWith('/api/v1'))) {
      // Direct custom endpoint (e.g. test mock server or specific bulletin URL)
      const queryParams = new URLSearchParams({
        lat: lat.toFixed(4),
        lon: lon.toFixed(4),
      });
      if (targetDistrict) queryParams.set('district', targetDistrict);
      if (targetRegion) queryParams.set('region', targetRegion);

      const fetchUrl = baseUrl.includes('?') ? `${baseUrl}&${queryParams.toString()}` : `${baseUrl}?${queryParams.toString()}`;
      const res = await fetch(fetchUrl, { headers, signal: AbortSignal.timeout(configuredTimeout) });
      if (!res.ok) {
        throw new Error(`IMD Gateway HTTP ${res.status}: ${res.statusText}`);
      }
      const payload = await res.json();
      if (!payload || typeof payload !== 'object') {
        throw new Error('Malformed IMD API response payload (not an object)');
      }
      rawWeatherPayload = payload;
      rawWarningsPayload = payload.warnings || payload;
    } else {
      // Official IMD API Gateway Endpoints:
      // 1. District Warnings
      const distWarningUrl = `${baseUrl}/districtwarning${targetDistrictId ? `?id=${targetDistrictId}` : ''}`;
      const distRes = await fetch(distWarningUrl, { headers, signal: AbortSignal.timeout(configuredTimeout) });
      if (distRes.ok) {
        const distData = await distRes.json();
        if (distData?.error) {
          if (distData.error.toLowerCase().includes('key') || distData.error.toLowerCase().includes('auth')) {
            return {
              weather: null,
              warnings: { status: 'UNAVAILABLE', items: [], provider: 'India Meteorological Department (IMD)', retrieved_at: nowIso },
              cyclone: null,
              health: {
                provider_id: 'imd',
                name: 'India Meteorological Department (IMD)',
                status: 'CONFIG_REQUIRED',
                last_retrieval_attempt: nowIso,
                error: distData.error,
                note: 'Official IMD API returned authentication error.',
              },
            };
          }
        } else if (distData) {
          rawWarningsPayload = distData;
        }
      }

      // 2. Coastal Bulletins
      try {
        const coastalRes = await fetch(`${baseUrl}/coastalbulletin`, { headers, signal: AbortSignal.timeout(configuredTimeout) });
        if (coastalRes.ok) {
          const coastalData = await coastalRes.json();
          if (Array.isArray(coastalData)) {
            collectedWarnings.push(...coastalData);
          }
        }
      } catch {
        // Non-blocking for secondary bulletins
      }

      // 2b. Port Warnings
      try {
        const portUrl = `${baseUrl}/portwarning${targetPortId ? `?id=${targetPortId}` : ''}`;
        const portRes = await fetch(portUrl, { headers, signal: AbortSignal.timeout(configuredTimeout) });
        if (portRes.ok) {
          const portData = await portRes.json();
          if (Array.isArray(portData)) {
            collectedWarnings.push(...portData);
          } else if (portData && !portData.error) {
            collectedWarnings.push(portData);
          }
        }
      } catch {
        // Non-blocking
      }

      // 3. Current Weather
      try {
        const wxUrl = `${baseUrl}/current_wx${targetStationId ? `?id=${targetStationId}` : ''}`;
        const wxRes = await fetch(wxUrl, { headers, signal: AbortSignal.timeout(configuredTimeout) });
        if (wxRes.ok) {
          const wxData = await wxRes.json();
          if (wxData && !wxData.error) {
            rawWeatherPayload = Array.isArray(wxData) ? wxData[0] : wxData;
          }
        }
      } catch {
        // Non-blocking if weather observation is unavailable
      }

      // 4. Cyclone Track
      try {
        const cycRes = await fetch(`${baseUrl}/cyclone_track`, { headers, signal: AbortSignal.timeout(configuredTimeout) });
        if (cycRes.ok) {
          const cycData = await cycRes.json();
          if (cycData && cycData.status && cycData.data) {
            const parsedCyc = normalizeImdCycloneData(cycData, nowIso);
            cycloneData = parsedCyc.cyclone;
            collectedWarnings.push(...parsedCyc.warnings);
          }
        }
      } catch {
        // Non-blocking
      }
    }

    // Normalize Weather
    const weather = normalizeImdWeather(rawWeatherPayload, baseUrl, nowIso, 'LIVE');

    // Combine warnings from all official sources
    if (rawWarningsPayload) {
      if (Array.isArray(rawWarningsPayload)) {
        collectedWarnings.push(...rawWarningsPayload);
      } else {
        collectedWarnings.push(rawWarningsPayload);
      }
    }

    const warnings = normalizeImdWarnings(collectedWarnings, nowIso, true, targetDistrict || targetRegion);

    const result: ImdFetchResult = {
      weather,
      warnings,
      cyclone: cycloneData,
      health: {
        provider_id: 'imd',
        name: 'India Meteorological Department (IMD)',
        status: 'LIVE',
        last_retrieval_attempt: nowIso,
        last_success: nowIso,
        note: `Retrieved successfully from IMD Gateway (${targetDistrict || targetRegion || 'Coastal'}).`,
      },
    };

    setCache(cacheKey, { weather, warnings, cyclone: cycloneData, retrieved_at: nowIso }, 300);
    return result;
  } catch (err: any) {
    const isTimeout = err.name === 'TimeoutError' || (err.message && err.message.toLowerCase().includes('timeout'));
    const errorMsg = isTimeout ? `IMD request timed out after ${configuredTimeout}ms` : err.message;

    return {
      weather: null,
      warnings: {
        status: 'UNAVAILABLE',
        items: [],
        provider: 'India Meteorological Department (IMD)',
        retrieved_at: nowIso,
      },
      cyclone: null,
      health: {
        provider_id: 'imd',
        name: 'India Meteorological Department (IMD)',
        status: 'UNAVAILABLE',
        last_retrieval_attempt: nowIso,
        error: errorMsg,
        note: 'IMD service query failed; fallback to Open-Meteo & local warnings.',
      },
    };
  }
}


/**
 * Backward-compatible fetchImdWarnings (delegates directly to fetchImdData)
 */
export async function fetchImdWarnings(
  lat: number,
  lon: number,
  regionName?: string,
  districtName?: string
): Promise<{ warnings: WarningsSummary; health: SourceHealthEntry }> {
  const result = await fetchImdData(lat, lon, regionName, districtName);
  return {
    warnings: result.warnings,
    health: result.health,
  };
}

export interface IncoisFetchResult {
  ocean: OceanObservation | null;
  ecosystem: Partial<EcosystemObservation> | null;
  warnings: OfficialWarning[];
  health: SourceHealthEntry;
}

/**
 * INCOIS (Indian National Centre for Ocean Information Services) Official Source Adapter
 * 
 * Connects to official INCOIS API / web-service portal (https://incois.gov.in):
 * - Ocean State Forecast (/osf) with U/V current components (m/s), Hs (m), Tp (s), swell
 * - High Wave Alerts & Swell Surge Bulletins (/warnings)
 * - Tidal Predictions (/tide) with tide height (m) and UTC timestamp
 * - Potential Fishing Zone (/pfz) with advisory text and polygon coordinates
 * 
 * Rules:
 * - If INCOIS credentials (INCOIS_TOKEN / INCOIS_API_KEY / INCOIS_ENDPOINT_URL) are not configured,
 *   reports CONFIG_REQUIRED. Never fabricates ocean data.
 * - Handles authentication errors gracefully without crashing the pipeline.
 * - Current components U and V are normalized to m/s for authoritative drift calculations.
 * - High wave alerts preserve raw text and trigger safety escalation in the deterministic risk engine.
 * - Preserves provenance, exact issue/validity timestamps, and station IDs.
 */
export async function fetchIncoisData(
  lat: number,
  lon: number,
  regionName?: string,
  timeoutMs?: number
): Promise<IncoisFetchResult> {
  const incoisToken = process.env.INCOIS_TOKEN || process.env.INCOIS_API_KEY;
  const incoisEndpoint = process.env.INCOIS_ENDPOINT_URL;
  const envTimeout = process.env.INCOIS_TIMEOUT_MS ? parseInt(process.env.INCOIS_TIMEOUT_MS, 10) : NaN;
  const configuredTimeout = timeoutMs || (!isNaN(envTimeout) && envTimeout > 0 ? envTimeout : 5000);

  const geo = resolveCoastalRegion(lat, lon);
  const targetRegion = regionName || geo.regionName;
  const nowIso = new Date().toISOString();

  // 1. Strict Configuration Verification
  if (!incoisToken && !incoisEndpoint) {
    return {
      ocean: null,
      ecosystem: null,
      warnings: [],
      health: {
        provider_id: 'incois',
        name: 'INCOIS (Indian National Centre for Ocean Information Services)',
        status: 'CONFIG_REQUIRED',
        last_retrieval_attempt: nowIso,
        error: 'INCOIS credentials or endpoint URL (INCOIS_TOKEN / INCOIS_ENDPOINT_URL) not configured in environment',
        note: 'Adapter interface ready; awaiting direct INCOIS OSF / PFZ authorized feed credentials.',
      },
    };
  }

  // Check in-memory cache for recent INCOIS response (TTL 300s)
  const cacheKey = `incois:${lat.toFixed(2)}:${lon.toFixed(2)}`;
  const cached = getCache(cacheKey);
  if (cached) {
    return {
      ocean: cached.data.ocean,
      ecosystem: cached.data.ecosystem || null,
      warnings: cached.data.warnings || [],
      health: {
        provider_id: 'incois',
        name: 'INCOIS (Indian National Centre for Ocean Information Services)',
        status: 'CACHED',
        last_retrieval_attempt: nowIso,
        last_success: cached.data.retrieved_at,
        note: 'Retrieved from server-side cache (TTL 300s).',
      },
    };
  }

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'User-Agent': 'ORCA-Marine-Safety-System/1.0',
  };
  if (incoisToken) {
    headers['Authorization'] = `Bearer ${incoisToken}`;
    headers['X-API-KEY'] = incoisToken;
  }

  // Determine base API endpoint
  const baseUrl = (incoisEndpoint || 'https://incois.gov.in/api/v1').replace(/\/+$/, '');
  const isCustomEndpoint = Boolean(incoisEndpoint);

  try {
    let rawOceanPayload: any = null;
    let rawAlertsPayload: any[] = [];
    let rawPfzPayload: any = null;

    if (isCustomEndpoint && (baseUrl.includes('?') || !baseUrl.endsWith('/api/v1'))) {
      // Direct custom endpoint (e.g. test mock server or specific combined feed)
      const queryParams = new URLSearchParams({
        lat: lat.toFixed(4),
        lon: lon.toFixed(4),
      });
      if (targetRegion) queryParams.set('region', targetRegion);

      const fetchUrl = baseUrl.includes('?') ? `${baseUrl}&${queryParams.toString()}` : `${baseUrl}?${queryParams.toString()}`;
      const res = await fetch(fetchUrl, { headers, signal: AbortSignal.timeout(configuredTimeout) });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          return {
            ocean: null,
            ecosystem: null,
            warnings: [],
            health: {
              provider_id: 'incois',
              name: 'INCOIS (Indian National Centre for Ocean Information Services)',
              status: 'CONFIG_REQUIRED',
              last_retrieval_attempt: nowIso,
              error: `INCOIS authentication rejected: HTTP ${res.status}`,
              note: 'Official INCOIS API returned unauthorized/forbidden status. Check INCOIS_TOKEN.',
            },
          };
        }
        throw new Error(`INCOIS Gateway HTTP ${res.status}: ${res.statusText}`);
      }
      const payload = await res.json();
      if (!payload || typeof payload !== 'object') {
        throw new Error('Malformed INCOIS API response payload (not an object)');
      }

      // Check for inline error payload
      if (payload.error) {
        const errStr = typeof payload.error === 'string' ? payload.error.toLowerCase() : '';
        if (errStr.includes('token') || errStr.includes('key') || errStr.includes('auth')) {
          return {
            ocean: null,
            ecosystem: null,
            warnings: [],
            health: {
              provider_id: 'incois',
              name: 'INCOIS (Indian National Centre for Ocean Information Services)',
              status: 'CONFIG_REQUIRED',
              last_retrieval_attempt: nowIso,
              error: payload.error,
              note: 'Official INCOIS API returned authentication error.',
            },
          };
        }
      }

      rawOceanPayload = payload.ocean || payload.osf || payload;
      rawAlertsPayload = payload.alerts || payload.warnings || (payload.alert ? [payload.alert] : []);
      rawPfzPayload = payload.pfz || null;
    } else {
      // Official INCOIS Multi-Service Endpoints:
      // 1. Ocean State Forecast (OSF)
      const osfUrl = `${baseUrl}/osf?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`;
      const osfRes = await fetch(osfUrl, { headers, signal: AbortSignal.timeout(configuredTimeout) });
      if (osfRes.ok) {
        const osfData = await osfRes.json();
        if (osfData?.error) {
          const errStr = typeof osfData.error === 'string' ? osfData.error.toLowerCase() : '';
          if (errStr.includes('token') || errStr.includes('key') || errStr.includes('auth')) {
            return {
              ocean: null,
              ecosystem: null,
              warnings: [],
              health: {
                provider_id: 'incois',
                name: 'INCOIS (Indian National Centre for Ocean Information Services)',
                status: 'CONFIG_REQUIRED',
                last_retrieval_attempt: nowIso,
                error: osfData.error,
                note: 'Official INCOIS API returned authentication error.',
              },
            };
          }
        }
        rawOceanPayload = Array.isArray(osfData) ? osfData[0] : osfData;
      } else if (osfRes.status === 401 || osfRes.status === 403) {
        return {
          ocean: null,
          ecosystem: null,
          warnings: [],
          health: {
            provider_id: 'incois',
            name: 'INCOIS (Indian National Centre for Ocean Information Services)',
            status: 'CONFIG_REQUIRED',
            last_retrieval_attempt: nowIso,
            error: `INCOIS authentication rejected: HTTP ${osfRes.status}`,
            note: 'Official INCOIS API returned unauthorized/forbidden status. Check INCOIS_TOKEN.',
          },
        };
      }

      // 2. High Wave Alerts & Swell Surge Bulletins
      try {
        const warnUrl = `${baseUrl}/warnings?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`;
        const warnRes = await fetch(warnUrl, { headers, signal: AbortSignal.timeout(configuredTimeout) });
        if (warnRes.ok) {
          const warnData = await warnRes.json();
          if (Array.isArray(warnData)) {
            rawAlertsPayload.push(...warnData);
          } else if (warnData && !warnData.error) {
            rawAlertsPayload.push(warnData);
          }
        }
      } catch {
        // Non-blocking
      }

      // 3. Tide Data
      try {
        const tideUrl = `${baseUrl}/tide?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`;
        const tideRes = await fetch(tideUrl, { headers, signal: AbortSignal.timeout(configuredTimeout) });
        if (tideRes.ok) {
          const tideData = await tideRes.json();
          const tideObj = Array.isArray(tideData) ? tideData[0] : tideData;
          if (tideObj && !tideObj.error) {
            if (!rawOceanPayload) rawOceanPayload = {};
            rawOceanPayload.tide_height = rawOceanPayload.tide_height ?? tideObj.tide_height ?? tideObj.height;
            rawOceanPayload.tide_time_utc = rawOceanPayload.tide_time_utc ?? tideObj.tide_time_utc ?? tideObj.time;
          }
        }
      } catch {
        // Non-blocking
      }

      // 4. PFZ Data
      try {
        const pfzUrl = `${baseUrl}/pfz?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`;
        const pfzRes = await fetch(pfzUrl, { headers, signal: AbortSignal.timeout(configuredTimeout) });
        if (pfzRes.ok) {
          const pfzData = await pfzRes.json();
          if (pfzData && !pfzData.error) {
            rawPfzPayload = Array.isArray(pfzData) ? pfzData[0] : pfzData;
          }
        }
      } catch {
        // Non-blocking
      }
    }

    const ocean = normalizeIncoisOcean(rawOceanPayload, baseUrl, nowIso, 'LIVE');
    const warnings = normalizeIncoisAlerts(rawAlertsPayload, nowIso, targetRegion);
    const ecosystem = normalizeIncoisPfz(rawPfzPayload, baseUrl, nowIso, 'LIVE');

    const result: IncoisFetchResult = {
      ocean,
      ecosystem,
      warnings,
      health: {
        provider_id: 'incois',
        name: 'INCOIS (Indian National Centre for Ocean Information Services)',
        status: 'LIVE',
        last_retrieval_attempt: nowIso,
        last_success: nowIso,
        note: `Retrieved successfully from INCOIS Ocean State Forecast (${targetRegion || 'Coastal India'}).`,
      },
    };

    setCache(cacheKey, { ocean, ecosystem, warnings, retrieved_at: nowIso }, 300);
    return result;
  } catch (err: any) {
    const isTimeout = err.name === 'TimeoutError' || (err.message && err.message.toLowerCase().includes('timeout'));
    const errorMsg = isTimeout ? `INCOIS request timed out after ${configuredTimeout}ms` : err.message;

    return {
      ocean: null,
      ecosystem: null,
      warnings: [],
      health: {
        provider_id: 'incois',
        name: 'INCOIS (Indian National Centre for Ocean Information Services)',
        status: 'UNAVAILABLE',
        last_retrieval_attempt: nowIso,
        error: errorMsg,
        note: 'INCOIS service query failed; falling back to Open-Meteo Marine.',
      },
    };
  }
}

export interface MosdacFetchResult {
  data: MosdacObservationResult | null;
  health: SourceHealthEntry;
}

/**
 * MOSDAC / ISRO Official Source Adapter
 * 
 * Connects to official ISRO MOSDAC satellite data services (https://www.mosdac.gov.in):
 * - Chlorophyll-a concentration (EOS-06 / Oceansat-3 OCM) in mg/m³
 * - Satellite Sea Surface Temperature (INSAT-3D/3DR) in °C
 * - Ocean Surface Wind Speed & Direction (OSCAT-3 / ScatSat-1)
 * - Cloud Cover Fraction / Percentage (INSAT-3D/3DR)
 * 
 * Rules:
 * - If MOSDAC credentials (MOSDAC_USERNAME & MOSDAC_PASSWORD, or MOSDAC_TOKEN, or MOSDAC_API_KEY, or MOSDAC_ENDPOINT_URL)
 *   are not configured, reports CONFIG_REQUIRED. Never fabricates satellite data.
 * - Handles authentication errors gracefully without crashing the pipeline.
 * - Preserves provenance, observation timestamps, and satellite product IDs.
 */
export async function fetchMosdacData(
  lat: number,
  lon: number,
  timeoutMs?: number
): Promise<MosdacFetchResult> {
  const mosdacUser = process.env.MOSDAC_USERNAME;
  const mosdacPass = process.env.MOSDAC_PASSWORD;
  const mosdacToken = process.env.MOSDAC_TOKEN || process.env.MOSDAC_API_KEY;
  const mosdacEndpoint = process.env.MOSDAC_ENDPOINT_URL;
  const envTimeout = process.env.MOSDAC_TIMEOUT_MS ? parseInt(process.env.MOSDAC_TIMEOUT_MS, 10) : NaN;
  const configuredTimeout = timeoutMs || (!isNaN(envTimeout) && envTimeout > 0 ? envTimeout : 5000);

  const nowIso = new Date().toISOString();

  // 1. Strict Configuration Verification
  const hasAuth = Boolean((mosdacUser && mosdacPass) || mosdacToken || mosdacEndpoint);
  if (!hasAuth) {
    return {
      data: null,
      health: {
        provider_id: 'mosdac',
        name: 'ISRO MOSDAC (Meteorological & Oceanographic Satellite Data)',
        status: 'CONFIG_REQUIRED',
        last_retrieval_attempt: nowIso,
        error: 'MOSDAC credentials (MOSDAC_USERNAME / MOSDAC_PASSWORD / MOSDAC_TOKEN) not configured in environment',
        note: 'Adapter interface ready; awaiting authorized ISRO MOSDAC satellite portal credentials.',
      },
    };
  }

  // Check in-memory cache for recent MOSDAC response (TTL 300s)
  const cacheKey = `mosdac:${lat.toFixed(2)}:${lon.toFixed(2)}`;
  const cached = getCache(cacheKey);
  if (cached) {
    return {
      data: cached.data,
      health: {
        provider_id: 'mosdac',
        name: 'ISRO MOSDAC (Meteorological & Oceanographic Satellite Data)',
        status: 'CACHED',
        last_retrieval_attempt: nowIso,
        last_success: cached.data?.source?.retrieved_at || nowIso,
        note: 'Retrieved from server-side cache (TTL 300s).',
      },
    };
  }

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'User-Agent': 'ORCA-Marine-Safety-System/1.0',
  };
  if (mosdacToken) {
    headers['Authorization'] = `Bearer ${mosdacToken}`;
    headers['X-API-KEY'] = mosdacToken;
  } else if (mosdacUser && mosdacPass) {
    const creds = Buffer.from(`${mosdacUser}:${mosdacPass}`).toString('base64');
    headers['Authorization'] = `Basic ${creds}`;
  }

  const baseUrl = (mosdacEndpoint || 'https://www.mosdac.gov.in/api/v1/satellite_ocean').replace(/\/+$/, '');

  try {
    const queryParams = new URLSearchParams({
      lat: lat.toFixed(4),
      lon: lon.toFixed(4),
    });

    const fetchUrl = baseUrl.includes('?') ? `${baseUrl}&${queryParams.toString()}` : `${baseUrl}?${queryParams.toString()}`;
    const res = await fetch(fetchUrl, { headers, signal: AbortSignal.timeout(configuredTimeout) });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return {
          data: null,
          health: {
            provider_id: 'mosdac',
            name: 'ISRO MOSDAC (Meteorological & Oceanographic Satellite Data)',
            status: 'CONFIG_REQUIRED',
            last_retrieval_attempt: nowIso,
            error: `MOSDAC authentication rejected: HTTP ${res.status}`,
            note: 'Official MOSDAC API returned unauthorized/forbidden status. Check MOSDAC credentials.',
          },
        };
      }
      throw new Error(`MOSDAC Gateway HTTP ${res.status}: ${res.statusText}`);
    }

    const payload = await res.json();
    if (!payload || typeof payload !== 'object') {
      throw new Error('Malformed MOSDAC API response payload (not an object)');
    }

    if (payload.error) {
      const errStr = typeof payload.error === 'string' ? payload.error.toLowerCase() : '';
      if (errStr.includes('auth') || errStr.includes('user') || errStr.includes('pass') || errStr.includes('key')) {
        return {
          data: null,
          health: {
            provider_id: 'mosdac',
            name: 'ISRO MOSDAC (Meteorological & Oceanographic Satellite Data)',
            status: 'CONFIG_REQUIRED',
            last_retrieval_attempt: nowIso,
            error: payload.error,
            note: 'Official MOSDAC API returned authentication error.',
          },
        };
      }
    }

    const normalized = normalizeMosdacData(payload, fetchUrl, nowIso, 'LIVE');

    const result: MosdacFetchResult = {
      data: normalized,
      health: {
        provider_id: 'mosdac',
        name: 'ISRO MOSDAC (Meteorological & Oceanographic Satellite Data)',
        status: 'LIVE',
        last_retrieval_attempt: nowIso,
        last_success: nowIso,
        note: `Retrieved successfully from ISRO MOSDAC (${normalized?.product_id || normalized?.satellite_sensor || 'EO Ocean Satellites'}).`,
      },
    };

    setCache(cacheKey, normalized, 300);
    return result;
  } catch (err: any) {
    const isTimeout = err.name === 'TimeoutError' || (err.message && err.message.toLowerCase().includes('timeout'));
    const errorMsg = isTimeout ? `MOSDAC request timed out after ${configuredTimeout}ms` : err.message;

    return {
      data: null,
      health: {
        provider_id: 'mosdac',
        name: 'ISRO MOSDAC (Meteorological & Oceanographic Satellite Data)',
        status: 'UNAVAILABLE',
        last_retrieval_attempt: nowIso,
        error: errorMsg,
        note: 'MOSDAC service query failed; satellite observations unavailable.',
      },
    };
  }
}

function getWeatherConditionName(code: number): string {
  const map: Record<number, string> = {
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
    71: 'Light snow',
    80: 'Rain showers',
    81: 'Moderate rain showers',
    82: 'Violent rain showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with hail',
    99: 'Severe thunderstorm with hail',
  };
  return map[code] || 'Cloudy';
}
