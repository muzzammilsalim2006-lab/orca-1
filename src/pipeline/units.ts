/**
 * ORCA Unit Normalization Library
 * 
 * Standardizes physical marine and meteorological units as defined in the ORCA specification:
 * - Wind & Current velocity: m/s (meters per second) and km/h (kilometers per hour)
 * - Wind & Wave direction: degrees (0° - 360°)
 * - Wave & Swell height: meters (m)
 * - Wave period: seconds (s)
 * - Sea Surface Temperature (SST) & Ambient Temperature: degrees Celsius (°C)
 * - Cloud cover & Humidity: percentage (0% - 100%)
 * - Wind gusts: km/h and m/s
 * - Visibility: kilometers (km)
 * - Tide height: meters (m)
 * - Lightning density: strikes/km²/hour
 * - Vessel beam: meters (m)
 * - Fuel endurance: hours (h)
 * - Geofence distance: nautical miles (NM)
 */

/**
 * Convert meters per second (m/s) to kilometers per hour (km/h)
 */
export function mpsToKmph(mps: number | null | undefined): number | null {
  if (mps === null || mps === undefined || isNaN(mps)) return null;
  return Math.round(mps * 3.6 * 100) / 100;
}

/**
 * Convert kilometers per hour (km/h) to meters per second (m/s)
 */
export function kmphToMps(kmph: number | null | undefined): number | null {
  if (kmph === null || kmph === undefined || isNaN(kmph)) return null;
  return Math.round((kmph / 3.6) * 100) / 100;
}

/**
 * Convert knots to kilometers per hour (km/h)
 */
export function knotsToKmph(knots: number | null | undefined): number | null {
  if (knots === null || knots === undefined || isNaN(knots)) return null;
  return Math.round(knots * 1.852 * 100) / 100;
}

/**
 * Convert knots to meters per second (m/s)
 */
export function knotsToMps(knots: number | null | undefined): number | null {
  if (knots === null || knots === undefined || isNaN(knots)) return null;
  return Math.round(knots * 0.514444 * 100) / 100;
}

/**
 * Convert kilometers (km) to nautical miles (NM)
 */
export function kmToNm(km: number | null | undefined): number | null {
  if (km === null || km === undefined || isNaN(km)) return null;
  return Math.round((km / 1.852) * 100) / 100;
}

/**
 * Convert nautical miles (NM) to kilometers (km)
 */
export function nmToKm(nm: number | null | undefined): number | null {
  if (nm === null || nm === undefined || isNaN(nm)) return null;
  return Math.round(nm * 1.852 * 100) / 100;
}

/**
 * Normalize compass heading / angle to 0° - 360° range
 */
export function normalizeDegrees(deg: number | null | undefined): number | null {
  if (deg === null || deg === undefined || isNaN(deg)) return null;
  let normalized = deg % 360;
  if (normalized < 0) normalized += 360;
  return Math.round(normalized * 10) / 10;
}

/**
 * Clamp percentage values to valid 0.0 - 100.0% range
 */
export function clampPercentage(pct: number | null | undefined): number | null {
  if (pct === null || pct === undefined || isNaN(pct)) return null;
  return Math.round(Math.min(100.0, Math.max(0.0, pct)) * 10) / 10;
}

/**
 * Convert U (eastward) and V (northward) vector current components in m/s to speed and direction
 */
export function uvCurrentToSpeedAndDir(
  uMps: number | null | undefined,
  vMps: number | null | undefined
): { speed_mps: number | null; speed_kmph: number | null; direction_deg: number | null } {
  if (uMps === null || uMps === undefined || vMps === null || vMps === undefined || isNaN(uMps) || isNaN(vMps)) {
    return { speed_mps: null, speed_kmph: null, direction_deg: null };
  }
  const speedMps = Math.round(Math.sqrt(uMps * uMps + vMps * vMps) * 100) / 100;
  const speedKmph = mpsToKmph(speedMps);
  // Oceanographic current direction (direction current is flowing towards, in degrees from North)
  let dirRad = Math.atan2(uMps, vMps);
  let dirDeg = (dirRad * 180) / Math.PI;
  if (dirDeg < 0) dirDeg += 360;
  return {
    speed_mps: speedMps,
    speed_kmph: speedKmph,
    direction_deg: Math.round(dirDeg * 10) / 10,
  };
}
