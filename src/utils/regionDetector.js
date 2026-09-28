/**
 * Utility to detect the default regional language based on coordinates and location label.
 * For Maharashtra coastal districts and Goa, default regional language is Marathi ('mr').
 * Otherwise defaults to English ('en').
 */
export function detectRegionalLanguage(lat, lon, label = '') {
  const latitude = typeof lat === 'string' ? parseFloat(lat) : lat;
  const longitude = typeof lon === 'string' ? parseFloat(lon) : lon;
  const lbl = (label || '').toLowerCase();

  // Keyword check
  if (
    lbl.includes('mumbai') ||
    lbl.includes('goa') ||
    lbl.includes('panaji') ||
    lbl.includes('konkan') ||
    lbl.includes('marathi') ||
    lbl.includes('palghar') ||
    lbl.includes('thane') ||
    lbl.includes('alibag') ||
    lbl.includes('ratnagiri') ||
    lbl.includes('sindhudurg') ||
    lbl.includes('malvan')
  ) {
    return 'mr';
  }

  // Coordinate bounding box check for Maharashtra & Goa coastal corridor
  if (
    !isNaN(latitude) &&
    !isNaN(longitude) &&
    latitude >= 14.5 &&
    latitude <= 20.5 &&
    longitude >= 72.0 &&
    longitude <= 74.5
  ) {
    return 'mr';
  }

  return 'en';
}
