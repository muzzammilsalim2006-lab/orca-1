const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

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
    return [
      { label: 'Chennai Coast', latitude: 13.0827, longitude: 80.2707 },
      { label: 'Kochi Port (Cyclone Demo)', latitude: 9.9312, longitude: 76.2673 },
      { label: 'Visakhapatnam (Vizag)', latitude: 17.6868, longitude: 83.2185 },
      { label: 'Mumbai Harbor', latitude: 18.9438, longitude: 72.8360 },
    ];
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
