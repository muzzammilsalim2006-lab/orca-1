/**
 * Regional Language Detector for Coastal ORCA Assessment
 * 
 * Detects whether a location is in the coastal regions of Mumbai or Goa
 * and returns the appropriate default regional language code ("mr" for Marathi, "en" for default).
 */

// Bounding boxes for coastal regions (latitude N, longitude E)
// Coastal Mumbai & Thane/Palghar maritime waters
const MUMBAI_COAST_BBOX = {
  minLat: 18.70,
  maxLat: 19.40,
  minLon: 72.70,
  maxLon: 73.15,
};

// Coastal Goa maritime waters (North and South Goa coast)
const GOA_COAST_BBOX = {
  minLat: 14.80,
  maxLat: 15.80,
  minLon: 73.60,
  maxLon: 74.30,
};

/**
 * Checks if coordinates fall within a geographic bounding box
 */
function isPointInBBox(lat, lon, bbox) {
  return (
    lat >= bbox.minLat &&
    lat <= bbox.maxLat &&
    lon >= bbox.minLon &&
    lon <= bbox.maxLon
  );
}

/**
 * Detects the regional language based on coordinates or location label.
 * Prefer latitude & longitude when available.
 * 
 * @param {number|string} latitude 
 * @param {number|string} longitude 
 * @param {string} [label=""] 
 * @returns {string} Language code: "mr" (Marathi) or "en" (English / default)
 */
export function detectRegionalLanguage(latitude, longitude, label = "") {
  const lat = parseFloat(latitude);
  const lon = parseFloat(longitude);
  const labelLower = (label || "").toLowerCase();

  // 1. Coordinate-based bounding box check (Primary authority)
  if (!isNaN(lat) && !isNaN(lon)) {
    if (isPointInBBox(lat, lon, MUMBAI_COAST_BBOX)) {
      return "mr";
    }
    if (isPointInBBox(lat, lon, GOA_COAST_BBOX)) {
      return "mr";
    }
  }

  // 2. Location name / label check fallback
  if (
    labelLower.includes("mumbai") ||
    labelLower.includes("goa") ||
    labelLower.includes("panaji") ||
    labelLower.includes("konkan")
  ) {
    return "mr";
  }

  // 3. Default language for all other coastal locations (e.g. Chennai, Kochi, Vizag)
  return "en";
}
