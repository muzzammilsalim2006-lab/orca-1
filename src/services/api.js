import { MAHARASHTRA_PRESETS } from '../config/maharashtraRegions';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

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

export async function assessRisk({ latitude, longitude, label, demo = null, includeExplanation = true, language = 'auto' }) {
  try {
    const payload = {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      label: label || undefined,
      include_explanation: includeExplanation,
      language: language,
    };

    if (demo !== null) {
      payload.demo = demo;
    }

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
