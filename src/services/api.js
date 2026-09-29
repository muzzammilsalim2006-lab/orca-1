import { MAHARASHTRA_PRESETS } from '../config/maharashtraRegions';

/**
 * Configurable Base URL for standalone Mobile (Expo/React Native) or Web deployment.
 * Reads from EXPO_PUBLIC_API_BASE_URL or VITE_API_BASE_URL, falling back cleanly
 * to same-origin relative URLs without hardcoded private LAN IPs.
 */
export const getApiBaseUrl = () => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    if (import.meta.env.EXPO_PUBLIC_API_BASE_URL) {
      return import.meta.env.EXPO_PUBLIC_API_BASE_URL.replace(/\/$/, '');
    }
    if (import.meta.env.VITE_API_BASE_URL && !import.meta.env.VITE_API_BASE_URL.includes(':8000')) {
      return import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '');
    }
  }
  if (typeof process !== 'undefined' && process.env) {
    if (process.env.EXPO_PUBLIC_API_BASE_URL) {
      return process.env.EXPO_PUBLIC_API_BASE_URL.replace(/\/$/, '');
    }
    if (process.env.REACT_APP_API_BASE_URL) {
      return process.env.REACT_APP_API_BASE_URL.replace(/\/$/, '');
    }
  }
  return '';
};

const API_BASE_URL = getApiBaseUrl();

export async function fetchHealth() {
  try {
    const res = await fetch(`${API_BASE_URL}/health`);
    if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Health check failed:', err.message);
    return null;
  }
}

export async function fetchSystemInfo() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/info`);
    if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Fetch system info failed:', err.message);
    return null;
  }
}

export async function fetchMeta() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/meta`);
    if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Fetch meta failed:', err.message);
    return null;
  }
}

export async function fetchDemoLocations() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/demo/locations`);
    if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Fetch demo locations failed:', err.message);
    return MAHARASHTRA_PRESETS;
  }
}

export async function assessRisk({
  latitude,
  longitude,
  label,
  demo = null,
  includeExplanation = true,
  language = 'auto',
  vesselClass = null,
  vesselBeamM = null,
  fuelEnduranceH = null,
  lastKnownLatitude = null,
  lastKnownLongitude = null,
  missionType = null,
  forecastHorizonH = null,
  enableGeofencing = null,
}) {
  try {
    const payload = {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      label: label || undefined,
      include_explanation: includeExplanation,
      language: language,
    };

    if (demo !== null) payload.demo = demo;
    if (vesselClass) payload.vessel_class = vesselClass;
    if (vesselBeamM !== null && vesselBeamM !== undefined) payload.vessel_beam_m = parseFloat(vesselBeamM);
    if (fuelEnduranceH !== null && fuelEnduranceH !== undefined) payload.fuel_endurance_h = parseFloat(fuelEnduranceH);
    if (lastKnownLatitude !== null && lastKnownLatitude !== undefined) payload.last_known_latitude = parseFloat(lastKnownLatitude);
    if (lastKnownLongitude !== null && lastKnownLongitude !== undefined) payload.last_known_longitude = parseFloat(lastKnownLongitude);
    if (missionType) payload.mission_type = missionType;
    if (forecastHorizonH !== null && forecastHorizonH !== undefined) payload.forecast_horizon_h = parseFloat(forecastHorizonH);
    if (enableGeofencing !== null && enableGeofencing !== undefined) payload.enable_geofencing = Boolean(enableGeofencing);

    const res = await fetch(`${API_BASE_URL}/api/assess`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorJson = await res.json().catch(() => ({}));
      const msg = errorJson.error?.message || `Server returned error ${res.status}`;
      throw new Error(msg);
    }

    return await res.json();
  } catch (err) {
    console.error('Assessment API Error:', err);
    throw err;
  }
}

// Unified mobile alias
export const assessMission = assessRisk;
export const getSystemInfo = fetchSystemInfo;
export const getMetadata = fetchMeta;
export const getDemoLocations = fetchDemoLocations;
