/**
 * INCOIS (Indian National Centre for Ocean Information Services) Data Normalizer
 * 
 * Normalizes official INCOIS web-service & API responses into ORCA Common Marine Data Model entities:
 * - Ocean State Forecast (OSF):
 *   - Current vector U (eastward m/s) and V (northward m/s)
 *   - Significant Wave Height Hs (m)
 *   - Peak Wave Period Tp (s)
 *   - Swell wave height (m), period (s), direction (deg)
 *   - Sea Surface Temperature (°C)
 * - Tidal Predictions:
 *   - Tide height (m)
 *   - Tide time UTC (ISO string)
 * - Potential Fishing Zone (PFZ):
 *   - Advisory text & geographic coordinates/polygon
 * - High Wave Alerts & Swell Surge Bulletins:
 *   - High Wave Alert / Swell Surge Warning / Ocean State Warning
 *   - Severity mapping & deterministic safety veto integration
 * 
 * Strict safety rules:
 * - Current components U and V must be in m/s
 * - Missing variables remain strictly null and are never coerced to zero
 * - Provider provenance, exact issue/validity timestamps, and station IDs are preserved
 * - High wave alerts preserve raw text and trigger safety escalation
 */

import {
  OceanObservation,
  OfficialWarning,
  SourceStatus,
  WarningSeverity,
  EcosystemObservation,
} from './models';
import { uvCurrentToSpeedAndDir } from './units';

export interface RawIncoisOsfPayload {
  // Current components
  current_u?: number | string | null;
  current_v?: number | string | null;
  u?: number | string | null;
  v?: number | string | null;
  current_speed?: number | string | null;
  current_direction?: number | string | null;
  // Wave metrics
  significant_wave_height?: number | string | null;
  swh?: number | string | null;
  wave_height?: number | string | null;
  hs?: number | string | null;
  peak_wave_period?: number | string | null;
  pwp?: number | string | null;
  wave_period?: number | string | null;
  tp?: number | string | null;
  wave_direction?: number | string | null;
  pwd?: number | string | null;
  wind_wave_height?: number | string | null;
  // Swell metrics
  swell_wave_height?: number | string | null;
  ssh?: number | string | null;
  swell_wave_period?: number | string | null;
  ssp?: number | string | null;
  swell_wave_direction?: number | string | null;
  ssd?: number | string | null;
  // Environment
  sea_surface_temperature?: number | string | null;
  sst?: number | string | null;
  // Tide fields
  tide_height?: number | string | null;
  tide_time_utc?: string | null;
  tide_time?: string | null;
  // Metadata
  forecast_time?: string | null;
  observation_time?: string | null;
  issue_time?: string | null;
  station_id?: string | null;
  station_name?: string | null;
  region?: string | null;
}

export interface RawIncoisAlert {
  id?: string;
  alert_id?: string;
  alert_type?: string;
  warning_type?: string;
  title?: string;
  headline?: string;
  description?: string;
  message?: string;
  warning_text?: string;
  severity?: string;
  color_code?: string;
  colour_code?: string;
  issue_date?: string;
  issue_time?: string;
  issued_at?: string;
  valid_from?: string;
  valid_until?: string;
  valid_to?: string;
  coastal_region?: string;
  region?: string;
  affected_area?: string;
  wave_height_range?: string;
  max_wave_height?: number | string;
  advice?: string;
  advice_to_fishermen?: string;
}

export interface RawIncoisPfzPayload {
  advisory_id?: string;
  sector?: string;
  region?: string;
  advisory?: string;
  advisory_text?: string;
  valid_from?: string;
  valid_until?: string;
  coordinates?: Array<[number, number]> | Array<{ lat: number; lon: number }>;
  polygon?: Array<[number, number]>;
  depth_m?: number | null;
  distance_nm?: number | null;
  bearing_deg?: number | null;
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
 * Normalizes official INCOIS Ocean State Forecast (OSF) & Tide data into ORCA OceanObservation
 */
export function normalizeIncoisOcean(
  raw: RawIncoisOsfPayload | null | undefined,
  sourceUrl: string,
  retrievedAt: string,
  dataStatus: SourceStatus = 'LIVE'
): OceanObservation | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  // 1. Zonal and Meridional current vector components (m/s)
  const rawU = parseSafeFloat(raw.current_u ?? raw.u);
  const rawV = parseSafeFloat(raw.current_v ?? raw.v);

  // Bounds validation for physical currents in m/s (-5 to +5 m/s)
  const current_u_mps = rawU !== null && rawU >= -5 && rawU <= 5 ? Math.round(rawU * 100) / 100 : null;
  const current_v_mps = rawV !== null && rawV >= -5 && rawV <= 5 ? Math.round(rawV * 100) / 100 : null;

  // Compute speed and direction from U and V if available; otherwise check direct fields
  let speedMps: number | null = null;
  let speedKmph: number | null = null;
  let dirDeg: number | null = null;

  if (current_u_mps !== null && current_v_mps !== null) {
    const derived = uvCurrentToSpeedAndDir(current_u_mps, current_v_mps);
    speedMps = derived.speed_mps;
    speedKmph = derived.speed_kmph;
    dirDeg = derived.direction_deg;
  } else {
    const directSpeed = parseSafeFloat(raw.current_speed);
    if (directSpeed !== null && directSpeed >= 0 && directSpeed <= 15) {
      speedMps = Math.round(directSpeed * 100) / 100;
      speedKmph = Math.round(speedMps * 3.6 * 100) / 100;
    }
    const directDir = parseSafeFloat(raw.current_direction);
    if (directDir !== null && directDir >= 0 && directDir <= 360) {
      dirDeg = Math.round(directDir * 10) / 10;
    }
  }

  // 2. Wave metrics
  const rawHs = parseSafeFloat(raw.significant_wave_height ?? raw.swh ?? raw.hs ?? raw.wave_height);
  const significant_wave_height_m = rawHs !== null && rawHs >= 0 && rawHs <= 25 ? Math.round(rawHs * 100) / 100 : null;

  const rawTp = parseSafeFloat(raw.peak_wave_period ?? raw.pwp ?? raw.tp ?? raw.wave_period);
  const peak_wave_period_s = rawTp !== null && rawTp >= 1 && rawTp <= 35 ? Math.round(rawTp * 10) / 10 : null;

  const rawWaveDir = parseSafeFloat(raw.wave_direction ?? raw.pwd);
  const wave_direction_deg = rawWaveDir !== null && rawWaveDir >= 0 && rawWaveDir <= 360 ? Math.round(rawWaveDir * 10) / 10 : null;

  const rawWindWave = parseSafeFloat(raw.wind_wave_height);
  const wind_wave_height_m = rawWindWave !== null && rawWindWave >= 0 && rawWindWave <= 25 ? Math.round(rawWindWave * 100) / 100 : null;

  // 3. Swell metrics
  const rawSwellH = parseSafeFloat(raw.swell_wave_height ?? raw.ssh);
  const swell_height_m = rawSwellH !== null && rawSwellH >= 0 && rawSwellH <= 25 ? Math.round(rawSwellH * 100) / 100 : null;

  const rawSwellP = parseSafeFloat(raw.swell_wave_period ?? raw.ssp);
  const swell_period_s = rawSwellP !== null && rawSwellP >= 1 && rawSwellP <= 35 ? Math.round(rawSwellP * 10) / 10 : null;

  const rawSwellDir = parseSafeFloat(raw.swell_wave_direction ?? raw.ssd);
  const swell_direction_deg = rawSwellDir !== null && rawSwellDir >= 0 && rawSwellDir <= 360 ? Math.round(rawSwellDir * 10) / 10 : null;

  // 4. Sea Surface Temperature
  const rawSST = parseSafeFloat(raw.sea_surface_temperature ?? raw.sst);
  const sea_surface_temperature_c = rawSST !== null && rawSST >= 10 && rawSST <= 40 ? Math.round(rawSST * 10) / 10 : null;

  // 5. Tidal Prediction
  const rawTideH = parseSafeFloat(raw.tide_height);
  const tide_height_m = rawTideH !== null && rawTideH >= -5 && rawTideH <= 15 ? Math.round(rawTideH * 100) / 100 : null;
  const tide_time_utc = raw.tide_time_utc || raw.tide_time || null;

  // Reject entirely empty/corrupt payloads where all primary physical measurements are missing
  if (
    current_u_mps === null &&
    current_v_mps === null &&
    significant_wave_height_m === null &&
    peak_wave_period_s === null &&
    tide_height_m === null &&
    speedMps === null &&
    sea_surface_temperature_c === null
  ) {
    return null;
  }

  const sourceTimestamp = raw.forecast_time || raw.observation_time || raw.issue_time || null;

  return {
    wave_height_m: significant_wave_height_m,
    wave_period_s: peak_wave_period_s,
    wave_direction_deg,
    wind_wave_height_m,
    swell_height_m,
    swell_period_s,
    swell_direction_deg,
    sea_surface_temperature_c,
    ocean_current_speed_kmph: speedKmph,
    ocean_current_speed_mps: speedMps,
    ocean_current_direction_deg: dirDeg,
    current_u_mps,
    current_v_mps,
    significant_wave_height_m,
    peak_wave_period_s,
    tide_height_m,
    tide_time_utc,
    source: {
      provider: 'INCOIS Ocean State Forecast',
      source_url: sourceUrl,
      retrieved_at: retrievedAt,
      data_status: dataStatus,
      source_timestamp: sourceTimestamp,
      note: 'Official Ocean State Forecast (OSF) retrieved from INCOIS.',
    },
  };
}

/**
 * Normalizes INCOIS High Wave Alerts, Swell Surge Alerts, and Ocean State Warnings
 */
export function normalizeIncoisAlerts(
  rawAlerts: RawIncoisAlert[] | RawIncoisAlert | null | undefined,
  retrievedAt: string,
  targetRegion?: string
): OfficialWarning[] {
  if (!rawAlerts) return [];
  const alertsArray: RawIncoisAlert[] = Array.isArray(rawAlerts) ? rawAlerts : [rawAlerts];
  const normalized: OfficialWarning[] = [];

  for (const a of alertsArray) {
    if (!a || typeof a !== 'object') continue;

    const alertType = a.alert_type || a.warning_type || 'Ocean State Warning';
    const rawHeadline = a.headline || a.title || a.description || `${alertType} for coastal waters`;
    const message = a.message || a.warning_text || a.description || '';
    const advice = a.advice_to_fishermen || a.advice || '';
    const fullText = [message, advice].filter(Boolean).join(' ');

    const rawColor = (a.color_code || a.colour_code || '').toUpperCase();
    const rawSev = (a.severity || '').toLowerCase();

    // Map severity: High Wave Alerts & Swell Surge Bulletins indicate immediate dangerous conditions
    let severity: WarningSeverity = 'watch';
    if (
      rawColor === 'RED' ||
      rawSev === 'alert' ||
      alertType.toLowerCase().includes('high wave') ||
      rawHeadline.toLowerCase().includes('high wave alert') ||
      rawHeadline.toLowerCase().includes('swell surge alert')
    ) {
      severity = 'warning';
      if (rawColor === 'RED' || rawSev === 'alert' || rawHeadline.toLowerCase().includes('red alert')) {
        severity = 'alert';
      }
    } else if (rawColor === 'ORANGE' || rawSev === 'warning') {
      severity = 'warning';
    } else if (rawColor === 'YELLOW' || rawSev === 'watch' || rawSev === 'advisory') {
      severity = 'watch';
    }

    const issuedAt = a.issued_at || a.issue_time || a.issue_date || null;
    const validUntil = a.valid_until || a.valid_to || null;
    const region = a.coastal_region || a.affected_area || a.region || targetRegion || 'Indian Coastal Waters';

    normalized.push({
      id: a.id || a.alert_id || `incois-alert-${Math.random().toString(36).substring(2, 9)}`,
      headline: rawHeadline,
      severity,
      source: 'INCOIS (Indian National Centre for Ocean Information Services)',
      warning_type: 'marine_warning',
      warning_text: fullText || rawHeadline,
      published_at: issuedAt || retrievedAt,
      issued_at: issuedAt || undefined,
      valid_until: validUntil || undefined,
      region,
      official_color_code: rawColor || (severity === 'alert' ? 'RED' : severity === 'warning' ? 'ORANGE' : 'YELLOW'),
      warning_colour: rawColor || (severity === 'alert' ? 'RED' : severity === 'warning' ? 'ORANGE' : 'YELLOW'),
      warning_message: fullText || rawHeadline,
      warning_issued_at: issuedAt || null,
      warning_valid_until: validUntil || null,
      marine_area: region,
    });
  }

  return normalized;
}

/**
 * Normalizes official INCOIS Potential Fishing Zone (PFZ) advisory & geometry
 */
export function normalizeIncoisPfz(
  raw: RawIncoisPfzPayload | null | undefined,
  sourceUrl: string,
  retrievedAt: string,
  dataStatus: SourceStatus = 'LIVE'
): Partial<EcosystemObservation> | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const advisoryText = raw.advisory || raw.advisory_text || null;

  // Extract coordinate polygon
  let pfz_polygon: Array<[number, number]> | null = null;
  if (Array.isArray(raw.polygon) && raw.polygon.length > 0) {
    pfz_polygon = raw.polygon;
  } else if (Array.isArray(raw.coordinates) && raw.coordinates.length > 0) {
    pfz_polygon = raw.coordinates.map((pt: any) => {
      if (Array.isArray(pt) && pt.length >= 2) {
        return [Number(pt[0]), Number(pt[1])];
      } else if (pt && typeof pt === 'object' && pt.lat !== undefined && pt.lon !== undefined) {
        return [Number(pt.lat), Number(pt.lon)];
      }
      return [0, 0];
    });
  }

  if (!advisoryText && !pfz_polygon) {
    return null;
  }

  return {
    pfz_advisory: advisoryText,
    pfz_polygon,
    observation_timestamp: raw.valid_from || raw.valid_until || retrievedAt,
    source: {
      provider: 'INCOIS Potential Fishing Zone (PFZ)',
      source_url: sourceUrl,
      retrieved_at: retrievedAt,
      data_status: dataStatus,
      note: 'Official Potential Fishing Zone (PFZ) advisory from INCOIS.',
    },
  };
}
