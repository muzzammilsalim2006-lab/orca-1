/**
 * Centralized Geographic Scope Configuration for ORCA Reference Frontend
 * 
 * CRITICAL PRODUCT BOUNDARY:
 * ORCA's SIH MVP is strictly scoped to MAHARASHTRA COASTAL WATERS.
 * Primary operational coastal districts:
 * - Mumbai City
 * - Mumbai Suburban
 * - Thane
 * - Palghar
 * - Raigad
 * - Ratnagiri
 * - Sindhudurg
 * 
 * Pan-India and out-of-state locations (Goa, Chennai, Kochi, Visakhapatnam)
 * are excluded from user-facing presets and reference client workflows.
 */

export const MAHARASHTRA_BOUNDS = {
  // Southern coastal border (Sindhudurg near Terekhol River)
  minLat: 15.65,
  // Northern coastal border (Palghar near Bordi / Dahanu)
  maxLat: 20.35,
  // Offshore waters (~40-50 NM into the Arabian Sea)
  minLon: 72.00,
  // Coastal landward limit & tidal creeks
  maxLon: 73.95,
};

export const DEFAULT_MAHARASHTRA_CENTER = {
  lat: 18.55,
  lon: 72.95,
  zoom: 8,
};

export const DEFAULT_LOCATION = {
  lat: 18.9438,
  lon: 72.8360,
  label: 'Mumbai Harbour, Maharashtra',
  district: 'Mumbai City',
};

export const MAHARASHTRA_DISTRICTS = [
  {
    id: 'palghar',
    name: 'Palghar Coastal District',
    districtName: 'Palghar',
    marathiName: 'पालघर जिल्हा',
    minLat: 19.50,
    maxLat: 20.35,
    minLon: 72.50,
    maxLon: 73.15,
    representativeCoord: { lat: 19.6965, lon: 72.7655 },
    stationName: 'Dahanu / Satpati Coastal Hub',
    description: 'Satpati, Dahanu, Arnala northern Maharashtra trawl fishing grounds',
  },
  {
    id: 'thane',
    name: 'Thane Coastal Region',
    districtName: 'Thane',
    marathiName: 'ठाणे किनारा',
    minLat: 19.10,
    maxLat: 19.55,
    minLon: 72.70,
    maxLon: 73.20,
    representativeCoord: { lat: 19.2800, lon: 72.8300 },
    stationName: 'Uttan / Thane Coastal Station',
    description: 'Uttan, Bhayandar, Thane Creek & coastal fishing communities',
  },
  {
    id: 'mumbai_suburban',
    name: 'Mumbai Suburban Waters',
    districtName: 'Mumbai Suburban',
    marathiName: 'मुंबई उपनगर',
    minLat: 19.05,
    maxLat: 19.32,
    minLon: 72.75,
    maxLon: 72.98,
    representativeCoord: { lat: 19.1310, lon: 72.8120 },
    stationName: 'Versova Fishery Observatory',
    description: 'Versova, Marve, Madh Island, Bandra to Gorai coastal waters',
  },
  {
    id: 'mumbai_city',
    name: 'Mumbai City Harbour & Coast',
    districtName: 'Mumbai City',
    marathiName: 'मुंबई शहर',
    minLat: 18.88,
    maxLat: 19.06,
    minLon: 72.78,
    maxLon: 72.95,
    representativeCoord: { lat: 18.9438, lon: 72.8360 },
    stationName: 'Colaba / Sassoon Docks',
    description: 'Mumbai Port zone, Colaba, Sassoon Docks, Mazagon marine corridor',
  },
  {
    id: 'raigad',
    name: 'Raigad Coastal Waters',
    districtName: 'Raigad',
    marathiName: 'रायगड किनारा',
    minLat: 18.00,
    maxLat: 18.95,
    minLon: 72.80,
    maxLon: 73.40,
    representativeCoord: { lat: 18.6414, lon: 72.8722 },
    stationName: 'Alibag Coastal Observatory',
    description: 'Alibag, Murud-Janjira, Rewas, Mandwa coastal and offshore waters',
  },
  {
    id: 'ratnagiri',
    name: 'Ratnagiri Marine Zone',
    districtName: 'Ratnagiri',
    marathiName: 'रत्नागिरी सागरी क्षेत्र',
    minLat: 16.50,
    maxLat: 18.15,
    minLon: 73.00,
    maxLon: 73.70,
    representativeCoord: { lat: 16.9902, lon: 73.2800 },
    stationName: 'Ratnagiri Coastal Station / Mirya Bay',
    description: 'Mirya Bay, Jaigad, Dabhol, Guhagar deep-water fishing banks',
  },
  {
    id: 'sindhudurg',
    name: 'Sindhudurg Coastal Belt',
    districtName: 'Sindhudurg',
    marathiName: 'सिंधुदुर्ग सागरी पट्टा',
    minLat: 15.65,
    maxLat: 16.60,
    minLon: 73.30,
    maxLon: 73.90,
    representativeCoord: { lat: 15.9042, lon: 73.5800 },
    stationName: 'Malvan / Vengurla Marine Station',
    description: 'Malvan Marine Sanctuary, Vengurla, Devgad southern Konkan waters',
  },
];

/**
 * Curated Maharashtra-Focused Operational Presets
 * Replaces all non-Maharashtra locations (Chennai, Kochi, Vizag, Goa).
 */
export const MAHARASHTRA_PRESETS = [
  {
    label: 'Mumbai Harbour',
    lat: 18.9438,
    lon: 72.8360,
    district: 'Mumbai City',
    tag: 'Port & Sassoon Docks',
    description: 'Major commercial harbour and artisanal fishing fleet terminal',
  },
  {
    label: 'Palghar Coast',
    lat: 19.6965,
    lon: 72.7655,
    district: 'Palghar',
    tag: 'Satpati Fishing Grounds',
    description: 'High-density artisanal and motorized gillnetting zone',
  },
  {
    label: 'Raigad Coast',
    lat: 18.6414,
    lon: 72.8722,
    district: 'Raigad',
    tag: 'Alibag Coastal Waters',
    description: 'Shallow coastal shelf and tidal inlet fishing routes',
  },
  {
    label: 'Ratnagiri Coast',
    lat: 16.9902,
    lon: 73.2800,
    district: 'Ratnagiri',
    tag: 'Mirya Bay Trawler Belt',
    description: 'Deep-sea mechanized trawler harbor and pelagic zone',
  },
  {
    label: 'Sindhudurg Coast',
    lat: 15.9042,
    lon: 73.5800,
    district: 'Sindhudurg',
    tag: 'Malvan Marine Sanctuary',
    description: 'Coral biodiversity zone and sensitive marine sanctuary border',
  },
  {
    label: 'Mumbai Suburban (Versova)',
    lat: 19.1310,
    lon: 72.8120,
    district: 'Mumbai Suburban',
    tag: 'Versova Fishery Jetty',
    description: 'Koli fishing community hub and nearshore creek waters',
  },
];

/**
 * Validates whether a coordinate lies within the supported Maharashtra operational corridor.
 * Returns structured validation object.
 */
export function checkMaharashtraScope(lat, lon) {
  const latitude = typeof lat === 'string' ? parseFloat(lat) : lat;
  const longitude = typeof lon === 'string' ? parseFloat(lon) : lon;

  if (isNaN(latitude) || isNaN(longitude)) {
    return {
      inScope: false,
      reason: 'INVALID_COORDINATES',
      message: 'Latitude and Longitude must be valid numerical coordinates.',
    };
  }

  // Check overall bounding envelope
  if (
    latitude < MAHARASHTRA_BOUNDS.minLat ||
    latitude > MAHARASHTRA_BOUNDS.maxLat ||
    longitude < MAHARASHTRA_BOUNDS.minLon ||
    longitude > MAHARASHTRA_BOUNDS.maxLon
  ) {
    return {
      inScope: false,
      reason: 'OUTSIDE_MAHARASHTRA_SCOPE',
      latitude,
      longitude,
      message: `ORCA currently supports Maharashtra coastal waters. The requested coordinate (${latitude.toFixed(4)}°N, ${longitude.toFixed(4)}°E) is outside the supported Maharashtra operational region (Palghar, Thane, Mumbai City, Mumbai Suburban, Raigad, Ratnagiri, Sindhudurg).`,
      supportedDistricts: MAHARASHTRA_DISTRICTS.map((d) => d.districtName),
    };
  }

  // Identify matching coastal district if applicable
  let matchedDistrict = null;
  for (const d of MAHARASHTRA_DISTRICTS) {
    if (
      latitude >= d.minLat &&
      latitude <= d.maxLat &&
      longitude >= d.minLon &&
      longitude <= d.maxLon
    ) {
      matchedDistrict = d;
      break;
    }
  }

  return {
    inScope: true,
    latitude,
    longitude,
    district: matchedDistrict ? matchedDistrict.name : 'Maharashtra Coastal Waters',
    districtName: matchedDistrict ? matchedDistrict.districtName : 'Maharashtra Coast',
    marathiDistrict: matchedDistrict?.marathiName || 'महाराष्ट्र सागरी किनारा',
    districtId: matchedDistrict?.id || 'maharashtra_coast',
    defaultLanguage: 'mr',
  };
}
