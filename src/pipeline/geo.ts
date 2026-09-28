/**
 * Centralized Geographic Scope Definitions for ORCA Prototype
 * Scope covers Maharashtra coastal districts and Goa.
 * Includes official IMD station, district, and port identifiers.
 */

export interface CoastalRegionConfig {
  id: string;
  name: string;
  districtName: string;
  state: string;
  stationId?: string;
  stationName?: string;
  districtId?: number | string;
  portId?: string;
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
  defaultLanguage: 'mr' | 'en';
}

export const SUPPORTED_COASTAL_REGIONS: CoastalRegionConfig[] = [
  {
    id: 'palghar',
    name: 'Palghar Coastal District',
    districtName: 'Palghar',
    state: 'Maharashtra',
    stationId: '43014',
    stationName: 'Dahanu / Palghar',
    districtId: 570,
    portId: 'DAHANU',
    minLat: 19.5,
    maxLat: 20.3,
    minLon: 72.5,
    maxLon: 73.1,
    defaultLanguage: 'mr',
  },
  {
    id: 'thane',
    name: 'Thane Coastal Region',
    districtName: 'Thane',
    state: 'Maharashtra',
    stationId: '43004',
    stationName: 'Thane Belapur',
    districtId: 571,
    portId: 'THANE',
    minLat: 19.1,
    maxLat: 19.5,
    minLon: 72.7,
    maxLon: 73.2,
    defaultLanguage: 'mr',
  },
  {
    id: 'mumbai',
    name: 'Mumbai & Suburban Coastal Waters',
    districtName: 'Mumbai',
    state: 'Maharashtra',
    stationId: '43003',
    stationName: 'Mumbai (Colaba / Santacruz)',
    districtId: 573,
    portId: 'MUMBAI',
    minLat: 18.8,
    maxLat: 19.3,
    minLon: 72.7,
    maxLon: 73.1,
    defaultLanguage: 'mr',
  },
  {
    id: 'raigad',
    name: 'Raigad Coastal Waters (Alibag/Murud)',
    districtName: 'Raigad',
    state: 'Maharashtra',
    stationId: '43057',
    stationName: 'Alibag Coastal Observatory',
    districtId: 574,
    portId: 'ALIBAG',
    minLat: 18.0,
    maxLat: 18.9,
    minLon: 72.8,
    maxLon: 73.4,
    defaultLanguage: 'mr',
  },
  {
    id: 'ratnagiri',
    name: 'Ratnagiri Marine Zone',
    districtName: 'Ratnagiri',
    state: 'Maharashtra',
    stationId: '43110',
    stationName: 'Ratnagiri Coastal Station',
    districtId: 578,
    portId: 'RATNAGIRI',
    minLat: 16.5,
    maxLat: 18.1,
    minLon: 73.1,
    maxLon: 73.7,
    defaultLanguage: 'mr',
  },
  {
    id: 'sindhudurg',
    name: 'Sindhudurg Coastal Belt (Malvan/Vengurla)',
    districtName: 'Sindhudurg',
    state: 'Maharashtra',
    stationId: '43150',
    stationName: 'Vengurla Coastal Station',
    districtId: 580,
    portId: 'MALVAN',
    minLat: 15.7,
    maxLat: 16.6,
    minLon: 73.3,
    maxLon: 73.9,
    defaultLanguage: 'mr',
  },
  {
    id: 'goa',
    name: 'Goa Coastal Waters (North & South Goa)',
    districtName: 'Goa',
    state: 'Goa',
    stationId: '43192',
    stationName: 'Panaji Marine Observatory',
    districtId: 581,
    portId: 'MORMUGAO',
    minLat: 14.8,
    maxLat: 15.8,
    minLon: 73.6,
    maxLon: 74.3,
    defaultLanguage: 'mr',
  },
];

/**
 * Resolve coastal district and default regional language from latitude & longitude
 */
export function resolveCoastalRegion(lat: number, lon: number): {
  regionName: string;
  districtName: string;
  state: string;
  stationId?: string;
  stationName?: string;
  districtId?: number | string;
  portId?: string;
  isWithinPrototypeScope: boolean;
  defaultLanguage: 'mr' | 'en';
} {
  for (const region of SUPPORTED_COASTAL_REGIONS) {
    if (lat >= region.minLat && lat <= region.maxLat && lon >= region.minLon && lon <= region.maxLon) {
      return {
        regionName: `${region.name}, ${region.state}`,
        districtName: region.districtName,
        state: region.state,
        stationId: region.stationId,
        stationName: region.stationName,
        districtId: region.districtId,
        portId: region.portId,
        isWithinPrototypeScope: true,
        defaultLanguage: region.defaultLanguage,
      };
    }
  }

  // Broad boundary check for Maharashtra & Goa coastal longitude/latitude
  if (lat >= 14.5 && lat <= 20.5 && lon >= 72.0 && lon <= 74.5) {
    return {
      regionName: 'Maharashtra & Goa Coastal Maritime Zone',
      districtName: 'Maharashtra Coast',
      state: 'Maharashtra',
      isWithinPrototypeScope: true,
      defaultLanguage: 'mr',
    };
  }

  return {
    regionName: 'Indian Coastal Waters',
    districtName: 'Coastal India',
    state: 'India',
    isWithinPrototypeScope: false,
    defaultLanguage: 'en',
  };
}

/**
 * Standard Haversine distance formula between two geographic coordinates
 * @returns Distance in Nautical Miles (NM)
 */
export function haversineDistanceNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R_NM = 3440.065; // Earth radius in nautical miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R_NM * c * 100) / 100;
}

/**
 * Point in polygon check using ray-casting algorithm
 */
export function isPointInPolygon(point: [number, number], polygon: Array<[number, number]>): boolean {
  if (!polygon || polygon.length < 3) return false;
  const [lat, lon] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect = yi > lon !== yj > lon && lat < ((xj - xi) * (lon - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Known official maritime boundaries and marine protected areas
export const MARITIME_REFERENCE_BOUNDARIES = {
  // International Maritime Boundary Line (IMBL) reference points
  imbl_sir_creek: { name: 'India-Pakistan IMBL (Sir Creek Sector)', lat: 23.65, lon: 67.85 },
  imbl_palk_strait: { name: 'India-Sri Lanka IMBL (Palk Strait)', lat: 9.85, lon: 79.55 },
  // Marine Protected Areas (MPA)
  malvan_marine_sanctuary: {
    name: 'Malvan Marine Sanctuary (Sindhudurg)',
    minLat: 15.95,
    maxLat: 16.12,
    minLon: 73.42,
    maxLon: 73.58,
  },
  // Maharashtra coastline reference points for 12 NM territorial water boundary buffer
  maharashtra_coast_refs: [
    { lat: 19.98, lon: 72.72 }, // Dahanu
    { lat: 18.95, lon: 72.82 }, // Mumbai Colaba
    { lat: 18.28, lon: 72.95 }, // Murud
    { lat: 16.98, lon: 73.28 }, // Ratnagiri
    { lat: 15.80, lon: 73.68 }, // Vengurla
    { lat: 15.42, lon: 73.80 }, // Mormugao
  ],
};

/**
 * Deterministic Geofencing & Proximity Intelligence Engine
 * Evaluates:
 * - Distance to maritime boundaries (dg)
 * - Proximity alerts relative to class-specific minimum safe distance (dmin)
 * - Protected Area (MPA) intrusions
 * - IMBL boundary proximity
 * - INCOIS Potential Fishing Zone (PFZ) intersection / proximity
 */
export function evaluateGeofencingAndProximity(
  lat: number,
  lon: number,
  dMinNm: number = 3.0,
  pfzPolygon?: Array<[number, number]> | null,
  pfzAdvisory?: string | null
): {
  distance_to_boundary_nm: number | null;
  minimum_safe_boundary_distance_nm: number | null;
  protected_area_status: string | null;
  imbl_boundary_status: string | null;
  alerts: string[];
  status: 'ACTIVE' | 'CLEAR' | 'UNAVAILABLE';
  boundary_veto: boolean;
  pfz_exposure: {
    is_inside: boolean;
    distance_to_pfz_nm: number | null;
    advisory: string | null;
  } | null;
  note?: string;
} {
  const alerts: string[] = [];
  let boundaryVeto = false;

  // 1. Calculate approximate distance to nearest coastal baseline / territorial water reference point
  let nearestCoastDistNm = 999.0;
  for (const ref of MARITIME_REFERENCE_BOUNDARIES.maharashtra_coast_refs) {
    const dist = haversineDistanceNm(lat, lon, ref.lat, ref.lon);
    if (dist < nearestCoastDistNm) {
      nearestCoastDistNm = dist;
    }
  }

  // Baseline boundary distance dg
  const dg = Math.round(nearestCoastDistNm * 10) / 10;
  const dmin = Math.round(dMinNm * 10) / 10;

  // Check minimum safe boundary distance constraint (dg < dmin)
  if (dg < dmin) {
    alerts.push(`PROXIMITY WARNING: Distance to coastal boundary (${dg} NM) is less than safe margin (${dmin} NM).`);
    boundaryVeto = true;
  }

  // 2. Check IMBL Proximity
  let imblStatus = 'CLEAR';
  const distSirCreek = haversineDistanceNm(lat, lon, MARITIME_REFERENCE_BOUNDARIES.imbl_sir_creek.lat, MARITIME_REFERENCE_BOUNDARIES.imbl_sir_creek.lon);
  const distPalk = haversineDistanceNm(lat, lon, MARITIME_REFERENCE_BOUNDARIES.imbl_palk_strait.lat, MARITIME_REFERENCE_BOUNDARIES.imbl_palk_strait.lon);
  const minImblDist = Math.min(distSirCreek, distPalk);

  if (minImblDist <= 5.0) {
    imblStatus = 'CRITICAL_IMBL_PROXIMITY';
    alerts.push(`CRITICAL IMBL ALERT: Vessel within ${minImblDist} NM of International Maritime Boundary Line! Risk of border transgression.`);
    boundaryVeto = true;
  } else if (minImblDist <= 15.0) {
    imblStatus = 'IMBL_ADVISORY_ZONE';
    alerts.push(`IMBL ADVISORY: Vessel operating ${minImblDist} NM from International Maritime Boundary Line.`);
  }

  // 3. Marine Protected Area (MPA) Check
  let protectedAreaStatus = 'CLEAR';
  const mpa = MARITIME_REFERENCE_BOUNDARIES.malvan_marine_sanctuary;
  if (lat >= mpa.minLat && lat <= mpa.maxLat && lon >= mpa.minLon && lon <= mpa.maxLon) {
    protectedAreaStatus = 'INSIDE_RESTRICTED_MPA';
    alerts.push(`RESTRICTED MPA: Coordinates fall inside Malvan Marine Sanctuary. Commercial trawl/gillnet operations prohibited.`);
    boundaryVeto = true;
  }

  // 4. INCOIS Potential Fishing Zone (PFZ) Exposure
  let pfzExposure: { is_inside: boolean; distance_to_pfz_nm: number | null; advisory: string | null } | null = null;
  if (pfzPolygon && pfzPolygon.length >= 3) {
    const isInside = isPointInPolygon([lat, lon], pfzPolygon);
    let minPfzDistNm = isInside ? 0.0 : 999.0;
    if (!isInside) {
      for (const vertex of pfzPolygon) {
        const d = haversineDistanceNm(lat, lon, vertex[0], vertex[1]);
        if (d < minPfzDistNm) minPfzDistNm = d;
      }
    }
    pfzExposure = {
      is_inside: isInside,
      distance_to_pfz_nm: isInside ? 0.0 : Math.round(minPfzDistNm * 10) / 10,
      advisory: pfzAdvisory || (isInside ? 'Vessel currently positioned within INCOIS PFZ advisory zone.' : null),
    };
  } else if (pfzAdvisory) {
    pfzExposure = {
      is_inside: false,
      distance_to_pfz_nm: null,
      advisory: pfzAdvisory,
    };
  }

  const overallStatus: 'ACTIVE' | 'CLEAR' | 'UNAVAILABLE' = alerts.length > 0 ? 'ACTIVE' : 'CLEAR';

  return {
    distance_to_boundary_nm: dg,
    minimum_safe_boundary_distance_nm: dmin,
    protected_area_status: protectedAreaStatus,
    imbl_boundary_status: imblStatus,
    alerts,
    status: overallStatus,
    boundary_veto: boundaryVeto,
    pfz_exposure: pfzExposure,
    note: alerts.length > 0 ? alerts.join(' | ') : 'Geofence clear of restricted boundaries and IMBL.',
  };
}

