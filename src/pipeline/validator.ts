/**
 * ORCA Pipeline Validator
 * 
 * Validates physical bounds, data integrity, timestamp freshness, and coordinate validity.
 * Ensures:
 * - Missing values remain strictly null and are never silently converted to zero.
 * - Impossible physical values are rejected, sanitized to null, and recorded as validation errors.
 * - Stale or unparseable timestamps are accurately tracked.
 * - Coordinates, percentages, directions, and vector bounds adhere to marine standards.
 */

import {
  WeatherObservation,
  OceanObservation,
  EcosystemObservation,
  VesselMissionModel,
  ValidationStatus,
  FreshnessStatus,
} from './models';
import { normalizeDegrees, clampPercentage } from './units';

export interface ValidationResult {
  status: ValidationStatus;
  errors: string[];
  warnings: string[];
  cleanWeather: WeatherObservation | null;
  cleanOcean: OceanObservation | null;
  cleanEcosystem: EcosystemObservation | null;
  cleanVessel: VesselMissionModel | null;
  missing_fields: string[];
}

/**
 * Validate geographic coordinate ranges
 */
export function validateCoordinates(lat: number, lon: number): string[] {
  const errors: string[] = [];
  if (lat === null || lat === undefined || typeof lat !== 'number' || isNaN(lat)) {
    errors.push('Latitude must be a valid non-empty number.');
  } else if (lat < -90 || lat > 90) {
    errors.push(`Invalid latitude: ${lat}. Must be between -90 and 90.`);
  }

  if (lon === null || lon === undefined || typeof lon !== 'number' || isNaN(lon)) {
    errors.push('Longitude must be a valid non-empty number.');
  } else if (lon < -180 || lon > 180) {
    errors.push(`Invalid longitude: ${lon}. Must be between -180 and 180.`);
  }

  return errors;
}

/**
 * Assess data freshness status based on timestamp (maintains 100% backwards compatibility)
 */
export function assessFreshness(retrievedAtStr?: string | null, maxAgeHours = 3): FreshnessStatus {
  if (!retrievedAtStr) return 'UNAVAILABLE';
  try {
    const timestampMs = new Date(retrievedAtStr).getTime();
    if (isNaN(timestampMs)) return 'UNAVAILABLE';

    const ageMs = Date.now() - timestampMs;
    const ageSeconds = Math.max(0, Math.round(ageMs / 1000));
    const ageHours = ageSeconds / 3600;

    if (ageHours < 0.5) return 'LIVE';
    if (ageHours < maxAgeHours) return 'RECENT';
    return 'STALE';
  } catch {
    return 'UNAVAILABLE';
  }
}

/**
 * Detailed freshness and age calculation supporting source timestamps and clock skew
 */
export function computeFreshnessDetails(
  retrievedAtStr?: string | null,
  sourceTimestampStr?: string | null,
  maxAgeHours = 3
): { freshness: FreshnessStatus; age_seconds: number | null } {
  const timeStr = sourceTimestampStr || retrievedAtStr;
  if (!timeStr) {
    return { freshness: 'UNAVAILABLE', age_seconds: null };
  }

  try {
    const timestampMs = new Date(timeStr).getTime();
    if (isNaN(timestampMs)) {
      return { freshness: 'UNAVAILABLE', age_seconds: null };
    }

    const ageMs = Date.now() - timestampMs;
    const ageSeconds = Math.max(0, Math.round(ageMs / 1000));
    const ageHours = ageSeconds / 3600;

    let freshness: FreshnessStatus = 'STALE';
    if (ageHours < 0.5) {
      freshness = 'LIVE';
    } else if (ageHours < maxAgeHours) {
      freshness = 'RECENT';
    }

    return { freshness, age_seconds: ageSeconds };
  } catch {
    return { freshness: 'UNAVAILABLE', age_seconds: null };
  }
}

/**
 * Comprehensive validation across weather, ocean, ecosystem, and vessel inputs
 */
export function validateObservations(
  weather: WeatherObservation | null,
  ocean: OceanObservation | null,
  ecosystem?: EcosystemObservation | null,
  vessel?: VesselMissionModel | null
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const missing_fields: string[] = [];

  let cleanWeather = weather ? { ...weather } : null;
  let cleanOcean = ocean ? { ...ocean } : null;
  let cleanEcosystem = ecosystem ? { ...ecosystem } : null;
  let cleanVessel = vessel ? { ...vessel } : null;

  // 1. Weather Observation Validation
  if (cleanWeather) {
    // Temperature: between -10°C and 60°C for Indian coastal waters
    if (cleanWeather.temperature_c !== null) {
      if (cleanWeather.temperature_c < -10 || cleanWeather.temperature_c > 60) {
        errors.push(`Impossible ambient temperature: ${cleanWeather.temperature_c}°C`);
        cleanWeather.temperature_c = null;
      }
    } else {
      missing_fields.push('temperature_c');
    }

    // Wind speed: non-negative and < 350 km/h (97.2 m/s)
    if (cleanWeather.wind_speed_kmph !== null) {
      if (cleanWeather.wind_speed_kmph < 0) {
        errors.push(`Impossible negative wind speed: ${cleanWeather.wind_speed_kmph} km/h`);
        cleanWeather.wind_speed_kmph = null;
        cleanWeather.wind_speed_mps = null;
      } else if (cleanWeather.wind_speed_kmph > 350) {
        errors.push(`Impossible excessive wind speed: ${cleanWeather.wind_speed_kmph} km/h`);
        cleanWeather.wind_speed_kmph = null;
        cleanWeather.wind_speed_mps = null;
      }
    } else {
      missing_fields.push('wind_speed_kmph');
    }

    if (cleanWeather.wind_speed_mps !== null && cleanWeather.wind_speed_mps < 0) {
      errors.push(`Negative wind speed in m/s: ${cleanWeather.wind_speed_mps}`);
      cleanWeather.wind_speed_mps = null;
    }

    // Wind gusts
    if (cleanWeather.wind_gust_kmph !== null && cleanWeather.wind_gust_kmph < 0) {
      errors.push(`Negative wind gust speed: ${cleanWeather.wind_gust_kmph} km/h`);
      cleanWeather.wind_gust_kmph = null;
      cleanWeather.wind_gust_mps = null;
    }

    // Wind direction: 0 - 360 degrees
    if (cleanWeather.wind_direction_deg !== null) {
      if (cleanWeather.wind_direction_deg < 0 || cleanWeather.wind_direction_deg > 360) {
        errors.push(`Invalid wind direction angle: ${cleanWeather.wind_direction_deg}°`);
        cleanWeather.wind_direction_deg = normalizeDegrees(cleanWeather.wind_direction_deg);
      }
    }

    // Rainfall
    if (cleanWeather.precipitation_mm_24h !== null && cleanWeather.precipitation_mm_24h < 0) {
      errors.push(`Negative 24h precipitation: ${cleanWeather.precipitation_mm_24h} mm`);
      cleanWeather.precipitation_mm_24h = null;
    }
    if (cleanWeather.precipitation_mm_last_hour !== null && cleanWeather.precipitation_mm_last_hour < 0) {
      errors.push(`Negative hourly precipitation: ${cleanWeather.precipitation_mm_last_hour} mm`);
      cleanWeather.precipitation_mm_last_hour = null;
    }

    // Humidity percentage: 0 to 100
    if (cleanWeather.humidity_pct !== null) {
      if (cleanWeather.humidity_pct < 0 || cleanWeather.humidity_pct > 100) {
        errors.push(`Invalid humidity percentage: ${cleanWeather.humidity_pct}%`);
        cleanWeather.humidity_pct = clampPercentage(cleanWeather.humidity_pct);
      }
    }

    // Cloud cover percentage: 0 to 100
    if (cleanWeather.cloud_cover_percent !== null) {
      if (cleanWeather.cloud_cover_percent < 0 || cleanWeather.cloud_cover_percent > 100) {
        errors.push(`Invalid cloud cover percentage: ${cleanWeather.cloud_cover_percent}%`);
        cleanWeather.cloud_cover_percent = clampPercentage(cleanWeather.cloud_cover_percent);
      }
    }

    // Lightning density: non-negative
    if (cleanWeather.lightning_density !== null) {
      if (cleanWeather.lightning_density < 0) {
        errors.push(`Negative lightning density: ${cleanWeather.lightning_density}`);
        cleanWeather.lightning_density = null;
      }
    } else {
      missing_fields.push('lightning_density');
    }

    // Visibility: non-negative
    if (cleanWeather.visibility_km !== null) {
      if (cleanWeather.visibility_km < 0) {
        errors.push(`Negative visibility distance: ${cleanWeather.visibility_km} km`);
        cleanWeather.visibility_km = null;
      }
    } else {
      missing_fields.push('visibility_km');
    }

    // Surface pressure
    if (cleanWeather.pressure_hpa !== null) {
      if (cleanWeather.pressure_hpa < 850 || cleanWeather.pressure_hpa > 1080) {
        warnings.push(`Extreme atmospheric pressure reading: ${cleanWeather.pressure_hpa} hPa`);
      }
    }
  } else {
    warnings.push('Weather data is missing from primary providers.');
    missing_fields.push('weather');
  }

  // 2. Ocean Observation Validation
  if (cleanOcean) {
    // Wave height: non-negative and <= 30 m
    if (cleanOcean.wave_height_m !== null) {
      if (cleanOcean.wave_height_m < 0) {
        errors.push(`Impossible negative wave height: ${cleanOcean.wave_height_m} m`);
        cleanOcean.wave_height_m = null;
      } else if (cleanOcean.wave_height_m > 30) {
        errors.push(`Impossible extreme wave height: ${cleanOcean.wave_height_m} m`);
        cleanOcean.wave_height_m = null;
      }
    } else {
      missing_fields.push('wave_height_m');
    }

    // Wave period: 0 - 35 s
    if (cleanOcean.wave_period_s !== null && (cleanOcean.wave_period_s < 0 || cleanOcean.wave_period_s > 35)) {
      errors.push(`Implausible wave period: ${cleanOcean.wave_period_s} s`);
      cleanOcean.wave_period_s = null;
    }

    // Swell height
    if (cleanOcean.swell_height_m !== null && cleanOcean.swell_height_m < 0) {
      errors.push(`Impossible negative swell height: ${cleanOcean.swell_height_m} m`);
      cleanOcean.swell_height_m = null;
    } else if (cleanOcean.swell_height_m === null) {
      missing_fields.push('swell_height_m');
    }

    // Ocean current speed
    if (cleanOcean.ocean_current_speed_kmph !== null) {
      if (cleanOcean.ocean_current_speed_kmph < 0) {
        errors.push(`Impossible negative current speed: ${cleanOcean.ocean_current_speed_kmph} km/h`);
        cleanOcean.ocean_current_speed_kmph = null;
        cleanOcean.ocean_current_speed_mps = null;
      } else if (cleanOcean.ocean_current_speed_kmph > 30) {
        warnings.push(`Very high surface current speed: ${cleanOcean.ocean_current_speed_kmph} km/h`);
      }
    } else {
      missing_fields.push('ocean_current_speed_kmph');
    }

    // Sea Surface Temperature: 5°C to 45°C
    if (cleanOcean.sea_surface_temperature_c !== null) {
      if (cleanOcean.sea_surface_temperature_c < 5 || cleanOcean.sea_surface_temperature_c > 45) {
        warnings.push(`Atypical SST for Indian waters: ${cleanOcean.sea_surface_temperature_c}°C`);
      }
    } else {
      missing_fields.push('sea_surface_temperature_c');
    }

    // Tide height
    if (cleanOcean.tide_height_m === null) {
      missing_fields.push('tide_height_m');
    }
  } else {
    warnings.push('Ocean wave/swell data is missing from primary providers.');
    missing_fields.push('ocean');
  }

  // 3. Ecosystem Observation Validation
  if (cleanEcosystem) {
    if (cleanEcosystem.chlorophyll_a_mg_m3 !== null && cleanEcosystem.chlorophyll_a_mg_m3 < 0) {
      errors.push(`Negative chlorophyll-a concentration: ${cleanEcosystem.chlorophyll_a_mg_m3}`);
      cleanEcosystem.chlorophyll_a_mg_m3 = null;
    } else if (cleanEcosystem.chlorophyll_a_mg_m3 === null) {
      missing_fields.push('chlorophyll_a_mg_m3');
    }
  } else {
    missing_fields.push('chlorophyll_a_mg_m3', 'pfz_polygon');
  }

  // 4. Vessel Mission Validation (Optional input)
  if (cleanVessel) {
    if (cleanVessel.vessel_beam_m !== null && cleanVessel.vessel_beam_m < 0) {
      errors.push(`Negative vessel beam dimension: ${cleanVessel.vessel_beam_m} m`);
      cleanVessel.vessel_beam_m = null;
    }
    if (cleanVessel.fuel_endurance_h !== null && cleanVessel.fuel_endurance_h < 0) {
      errors.push(`Negative fuel endurance hours: ${cleanVessel.fuel_endurance_h}`);
      cleanVessel.fuel_endurance_h = null;
    }
    if (cleanVessel.last_known_latitude !== null && (cleanVessel.last_known_latitude < -90 || cleanVessel.last_known_latitude > 90)) {
      errors.push(`Invalid last known latitude: ${cleanVessel.last_known_latitude}`);
      cleanVessel.last_known_latitude = null;
    }
    if (cleanVessel.last_known_longitude !== null && (cleanVessel.last_known_longitude < -180 || cleanVessel.last_known_longitude > 180)) {
      errors.push(`Invalid last known longitude: ${cleanVessel.last_known_longitude}`);
      cleanVessel.last_known_longitude = null;
    }
  }

  // Determine overall validation status
  let status: ValidationStatus = 'VALID';
  if (errors.length > 0) {
    status = cleanWeather || cleanOcean ? 'PARTIAL' : 'INVALID';
  } else if (!cleanWeather || !cleanOcean) {
    status = 'PARTIAL';
  }

  return {
    status,
    errors,
    warnings,
    cleanWeather,
    cleanOcean,
    cleanEcosystem,
    cleanVessel,
    missing_fields: Array.from(new Set(missing_fields)).sort(),
  };
}
