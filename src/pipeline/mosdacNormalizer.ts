/**
 * MOSDAC / ISRO Data Normalizer
 * 
 * Normalizes official ISRO MOSDAC satellite and oceanographic data products into
 * ORCA Common Marine Data Model entities:
 * 1. Chlorophyll-a concentration (EOS-06 / Oceansat-3 OCM) -> mg/m³
 * 2. Sea Surface Temperature (INSAT-3D/3DR / ScatSat-1) -> °C
 * 3. Ocean Surface Wind speed (OSCAT-3 / ScatSat-1) -> m/s (and km/h)
 * 4. Ocean Surface Wind direction -> degrees [0, 360]
 * 5. Cloud cover fraction / percentage (INSAT-3D/3DR Imager) -> %
 * 6. Observation timestamp -> UTC ISO
 * 
 * Strict safety rules:
 * - Missing variables remain strictly null and are never coerced to zero
 * - Never fabricate wind direction when only wind speed is available
 * - Cloud fraction [0, 1] is cleanly normalized to percentage [0, 100]%
 * - Kelvin SST (> 200 K) is converted to Celsius (°C = K - 273.15)
 * - Provider provenance, exact observation timestamps, and satellite product IDs are preserved
 */

import { SourceStatus } from './models';
import { mpsToKmph, normalizeDegrees, clampPercentage } from './units';

export interface RawMosdacPayload {
  // Chlorophyll-a
  chlorophyll_a?: number | string | null;
  chlorophyll?: number | string | null;
  chla?: number | string | null;
  // Sea surface temperature
  sea_surface_temperature?: number | string | null;
  sst?: number | string | null;
  // Surface wind
  wind_speed?: number | string | null;
  surface_wind_speed?: number | string | null;
  wind_speed_mps?: number | string | null;
  wind_direction?: number | string | null;
  wind_direction_deg?: number | string | null;
  // Cloud cover
  cloud_cover?: number | string | null;
  cloud_fraction?: number | string | null;
  cloud_cover_percent?: number | string | null;
  cloud_fraction_percent?: number | string | null;
  // Metadata & Timestamps
  observation_time?: string | null;
  observation_timestamp?: string | null;
  forecast_time?: string | null;
  issue_time?: string | null;
  time?: string | null;
  product_id?: string | null;
  satellite?: string | null;
  sensor?: string | null;
  grid_id?: string | null;
  scene_id?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
}

export interface MosdacObservationResult {
  chlorophyll_a_mg_m3: number | null;
  sea_surface_temperature_c: number | null;
  surface_wind: {
    wind_speed_mps: number | null;
    wind_speed_kmph: number | null;
    wind_direction_deg: number | null;
  };
  cloud_cover_percent: number | null;
  observation_timestamp: string | null;
  product_id: string | null;
  satellite_sensor: string | null;
  source: {
    provider: string;
    product_id?: string;
    source_url?: string;
    retrieved_at: string;
    data_status: SourceStatus;
    observation_timestamp?: string | null;
    note?: string;
  };
}

/**
 * Safely parse a numeric float value; preserves null/undefined/NaN as null (never zero)
 */
function parseSafeFloat(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  const num = typeof val === 'number' ? val : parseFloat(String(val).trim());
  return isNaN(num) ? null : num;
}

/**
 * Normalizes cloud fraction or percentage into standard 0.0 - 100.0% range
 */
export function normalizeCloudCover(rawCloud: any): number | null {
  const val = parseSafeFloat(rawCloud);
  if (val === null) return null;

  // Fraction in [0, 1.0] range -> multiply by 100 to get percentage
  if (val >= 0 && val <= 1.0) {
    return Math.round(val * 100 * 10) / 10;
  }
  // Already in [1.0, 100.0] range
  if (val > 1.0 && val <= 100.0) {
    return clampPercentage(val);
  }
  // Negative or invalid > 100
  return null;
}

/**
 * Normalizes SST into Celsius; converts Kelvin (> 200 K) if necessary
 */
export function normalizeSst(rawSst: any): number | null {
  const val = parseSafeFloat(rawSst);
  if (val === null) return null;

  let sstC = val;
  // Kelvin conversion (e.g. 301.15 K -> 28.0 °C)
  if (val > 200 && val < 350) {
    sstC = val - 273.15;
  }

  // Physical marine SST bounds (-2 °C to 45 °C)
  if (sstC >= -2 && sstC <= 45) {
    return Math.round(sstC * 10) / 10;
  }
  return null;
}

/**
 * Normalizes raw MOSDAC satellite observations into standard ORCA physical parameters
 */
export function normalizeMosdacData(
  raw: RawMosdacPayload | null | undefined,
  sourceUrl: string,
  retrievedAt: string,
  dataStatus: SourceStatus = 'LIVE'
): MosdacObservationResult | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  // 1. Chlorophyll-a concentration (mg/m³)
  const rawChla = parseSafeFloat(raw.chlorophyll_a ?? raw.chlorophyll ?? raw.chla);
  const chlorophyll_a_mg_m3 =
    rawChla !== null && rawChla >= 0.01 && rawChla <= 100.0 ? Math.round(rawChla * 100) / 100 : null;

  // 2. Sea Surface Temperature (°C)
  const sea_surface_temperature_c = normalizeSst(raw.sea_surface_temperature ?? raw.sst);

  // 3. Surface Wind (speed in m/s, direction in degrees)
  const rawWindSpeed = parseSafeFloat(raw.wind_speed ?? raw.surface_wind_speed ?? raw.wind_speed_mps);
  const wind_speed_mps =
    rawWindSpeed !== null && rawWindSpeed >= 0 && rawWindSpeed <= 75.0 ? Math.round(rawWindSpeed * 100) / 100 : null;
  const wind_speed_kmph = mpsToKmph(wind_speed_mps);

  // Wind direction is independent; do not fabricate if absent
  const rawWindDir = parseSafeFloat(raw.wind_direction ?? raw.wind_direction_deg);
  const wind_direction_deg = rawWindDir !== null ? normalizeDegrees(rawWindDir) : null;

  // 4. Cloud Cover Percentage (0% - 100%)
  const cloud_cover_percent = normalizeCloudCover(
    raw.cloud_cover_percent ?? raw.cloud_cover ?? raw.cloud_fraction ?? raw.cloud_fraction_percent
  );

  // 5. Timestamps
  const observation_timestamp =
    raw.observation_time || raw.observation_timestamp || raw.time || raw.issue_time || raw.forecast_time || null;

  // Reject entirely empty/corrupt payloads where no valid satellite metrics exist
  if (
    chlorophyll_a_mg_m3 === null &&
    sea_surface_temperature_c === null &&
    wind_speed_mps === null &&
    cloud_cover_percent === null
  ) {
    return null;
  }

  const productId = raw.product_id || raw.scene_id || null;
  const satelliteSensor = [raw.satellite, raw.sensor].filter(Boolean).join('/') || null;

  return {
    chlorophyll_a_mg_m3,
    sea_surface_temperature_c,
    surface_wind: {
      wind_speed_mps,
      wind_speed_kmph,
      wind_direction_deg,
    },
    cloud_cover_percent,
    observation_timestamp,
    product_id: productId,
    satellite_sensor: satelliteSensor,
    source: {
      provider: 'ISRO MOSDAC Satellite Ocean Data',
      product_id: productId || undefined,
      source_url: sourceUrl,
      retrieved_at: retrievedAt,
      data_status: dataStatus,
      observation_timestamp,
      note: `Satellite ocean observations retrieved from ISRO MOSDAC (${satelliteSensor || productId || 'EO Satellite'}).`,
    },
  };
}
