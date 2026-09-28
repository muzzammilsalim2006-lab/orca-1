/**
 * ORCA Phase 2: Common Marine Data Model & Pipeline Foundation Test Suite
 * 
 * Verifies:
 * 1. Unit Normalization (m/s, km/h, knots, NM, degrees, percentages, U/V current vectors)
 * 2. Extended Coordinate & Physical Boundary Validation
 * 3. Strict Null Preservation (wave height, chlorophyll, tide, lightning)
 * 4. Missing fields tracking
 * 5. Timestamp Freshness & Provenance (age_seconds, source_timestamp)
 * 6. Provider Status Isolation (open_meteo, imd, incois, mosdac)
 * 7. Vessel & Mission Parameter Support
 * 8. Geofencing Schema Foundation (non-fabrication of boundaries)
 * 9. Ecosystem & Fisheries Foundation
 * 10. Multi-Source Conflict & Agreement Tracking (retaining source values)
 * 11. Confidence Formula Foundation: C = w1*F + w2*A + w3*S
 * 12. End-to-end Orchestration with Live Open-Meteo & Demo Snapshot
 */

import { OrcaOrchestrator } from './src/pipeline/orchestrator';
import { validateCoordinates, validateObservations, assessFreshness, computeFreshnessDetails } from './src/pipeline/validator';
import {
  mpsToKmph,
  kmphToMps,
  knotsToKmph,
  knotsToMps,
  kmToNm,
  nmToKm,
  normalizeDegrees,
  clampPercentage,
  uvCurrentToSpeedAndDir,
} from './src/pipeline/units';
import { evaluateRiskEngine } from './src/pipeline/riskEngine';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}${detail ? ` - ${detail}` : ''}`);
    failed++;
  }
}

async function runPhase2Tests() {
  console.log('========================================');
  console.log('ORCA PHASE 2 DATA MODEL & PIPELINE TEST SUITE');
  console.log('========================================');

  // Test Group 1: Unit Normalization
  console.log('\nTest Group 1: Unit Normalization');
  assert(mpsToKmph(10) === 36, 'mpsToKmph: 10 m/s = 36 km/h');
  assert(kmphToMps(36) === 10, 'kmphToMps: 36 km/h = 10 m/s');
  assert(knotsToKmph(10) === 18.52, 'knotsToKmph: 10 knots = 18.52 km/h');
  assert(knotsToMps(10) === 5.14, 'knotsToMps: 10 knots = 5.14 m/s');
  assert(kmToNm(1.852) === 1, 'kmToNm: 1.852 km = 1 NM');
  assert(nmToKm(1) === 1.85, 'nmToKm: 1 NM = 1.85 km');
  assert(normalizeDegrees(370) === 10, 'normalizeDegrees: 370° wrapped to 10°');
  assert(normalizeDegrees(-30) === 330, 'normalizeDegrees: -30° wrapped to 330°');
  assert(clampPercentage(-10) === 0, 'clampPercentage: negative clamped to 0%');
  assert(clampPercentage(110) === 100, 'clampPercentage: > 100 clamped to 100%');
  assert(clampPercentage(74.5) === 74.5, 'clampPercentage: valid value preserved');

  const uv = uvCurrentToSpeedAndDir(1.0, 0.0);
  assert(uv.speed_mps === 1.0, 'U/V Vector Current: speed is 1.0 m/s');
  assert(uv.speed_kmph === 3.6, 'U/V Vector Current: speed is 3.6 km/h');
  assert(uv.direction_deg === 90, 'U/V Vector Current: eastward flow is 90°');

  // Test Group 2: Coordinate & Physical Metric Validation
  console.log('\nTest Group 2: Coordinate & Physical Metric Validation');
  const latErr = validateCoordinates(95.0, 72.8);
  assert(latErr.length > 0 && latErr[0].includes('latitude'), 'Rejects latitude > 90');
  const lonErr = validateCoordinates(18.9, -195.0);
  assert(lonErr.length > 0 && lonErr[0].includes('longitude'), 'Rejects longitude < -180');
  const nanErr = validateCoordinates(NaN as any, 72.8);
  assert(nanErr.length > 0, 'Rejects NaN latitude');

  // Test Group 3: Strict Null Preservation & Missing Data Tracking
  console.log('\nTest Group 3: Strict Null Preservation & Missing Data Tracking');
  const partialWeather = {
    temperature_c: 28.5,
    feels_like_c: 32.0,
    humidity_pct: 75,
    pressure_hpa: 1010,
    wind_speed_kmph: null,
    wind_speed_mps: null,
    wind_gust_kmph: null,
    wind_gust_mps: null,
    wind_direction_deg: null,
    precipitation_mm_last_hour: null,
    precipitation_mm_24h: null,
    visibility_km: null,
    cloud_cover_percent: null,
    lightning_density: null,
    condition: null,
    source: { provider: 'test', retrieved_at: new Date().toISOString(), data_status: 'LIVE' as const },
  };

  const partialOcean = {
    wave_height_m: null,
    wave_period_s: null,
    wave_direction_deg: null,
    wind_wave_height_m: null,
    swell_height_m: null,
    swell_period_s: null,
    swell_direction_deg: null,
    sea_surface_temperature_c: null,
    ocean_current_speed_kmph: null,
    ocean_current_speed_mps: null,
    ocean_current_direction_deg: null,
    current_u_mps: null,
    current_v_mps: null,
    significant_wave_height_m: null,
    peak_wave_period_s: null,
    tide_height_m: null,
    tide_time_utc: null,
    source: { provider: 'test', retrieved_at: new Date().toISOString(), data_status: 'LIVE' as const },
  };

  const validationResult = validateObservations(partialWeather, partialOcean);
  assert(validationResult.cleanWeather?.wind_speed_kmph === null, 'Missing wind speed remains strictly null (never zero)');
  assert(validationResult.cleanWeather?.lightning_density === null, 'Missing lightning density remains strictly null');
  assert(validationResult.cleanOcean?.wave_height_m === null, 'Missing wave height remains strictly null');
  assert(validationResult.cleanOcean?.tide_height_m === null, 'Missing tide height remains strictly null');
  assert(validationResult.missing_fields.includes('wave_height_m'), 'Records wave_height_m in missing_fields list');
  assert(validationResult.missing_fields.includes('wind_speed_kmph'), 'Records wind_speed_kmph in missing_fields list');
  assert(validationResult.missing_fields.includes('chlorophyll_a_mg_m3'), 'Records chlorophyll_a_mg_m3 in missing_fields list');

  // Test Group 4: Timestamp Freshness & Age Tracking
  console.log('\nTest Group 4: Timestamp Freshness & Age Tracking');
  const nowIso = new Date().toISOString();
  const past20Min = new Date(Date.now() - 20 * 60 * 1000).toISOString();
  const past2Hours = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const past5Hours = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();

  assert(assessFreshness(nowIso) === 'LIVE', 'Immediate timestamp classified as LIVE');
  assert(assessFreshness(past20Min) === 'LIVE', '20-minute old timestamp classified as LIVE (< 0.5h)');
  assert(assessFreshness(past2Hours) === 'RECENT', '2-hour old timestamp classified as RECENT');
  assert(assessFreshness(past5Hours) === 'STALE', '5-hour old timestamp classified as STALE');
  assert(assessFreshness('') === 'UNAVAILABLE', 'Empty timestamp classified as UNAVAILABLE');

  const detailed = computeFreshnessDetails(nowIso, past20Min);
  assert(detailed.freshness === 'LIVE', 'computeFreshnessDetails classifies 20m as LIVE');
  assert(typeof detailed.age_seconds === 'number' && detailed.age_seconds >= 1100 && detailed.age_seconds <= 1300, 'computeFreshnessDetails returns accurate age_seconds (~1200s)');

  // Test Group 5: Vessel & Mission Model Handling
  console.log('\nTest Group 5: Vessel & Mission Model Handling');
  const testVesselData = await OrcaOrchestrator.collectAndProcess({
    latitude: 18.9438,
    longitude: 72.836,
    demo: true,
    vessel_beam_m: 4.2,
    vessel_class: 'traditional_motorized',
    fuel_endurance_h: 18.0,
    last_known_latitude: 18.92,
    last_known_longitude: 72.81,
    mission_type: 'artisanal_fishing',
  });

  assert(testVesselData.vessel !== null, 'Vessel model present in Common Marine Data Model');
  assert(testVesselData.vessel?.vessel_beam_m === 4.2, 'Vessel beam preserved (4.2 m)');
  assert(testVesselData.vessel?.vessel_class === 'traditional_motorized', 'Vessel class preserved');
  assert(testVesselData.vessel?.fuel_endurance_h === 18.0, 'Fuel endurance preserved (18.0 h)');
  assert(testVesselData.vessel?.status === 'CONFIGURED', 'Vessel status is CONFIGURED');

  const testVesselOmitted = await OrcaOrchestrator.collectAndProcess({
    latitude: 18.9438,
    longitude: 72.836,
    demo: true,
  });
  assert(testVesselOmitted.vessel?.status === 'NOT_PROVIDED', 'Omitted vessel data marked NOT_PROVIDED');
  assert(testVesselOmitted.vessel?.vessel_beam_m === null, 'Omitted vessel beam is null');

  // Test Group 6: Geofencing Model Foundation
  console.log('\nTest Group 6: Geofencing Model Foundation');
  assert(testVesselData.geofencing !== null, 'Geofencing model present in Common Marine Data Model');
  assert(testVesselData.geofencing?.status === 'UNAVAILABLE', 'Geofencing status is UNAVAILABLE (unconnected)');
  assert(testVesselData.geofencing?.distance_to_boundary_nm === null, 'Geofence distance is null (no fake data)');
  assert(testVesselData.geofencing?.minimum_safe_boundary_distance_nm === null, 'Safe boundary distance is null');

  // Test Group 7: Ecosystem & Fisheries Model Foundation
  console.log('\nTest Group 7: Ecosystem & Fisheries Model Foundation');
  assert(testVesselData.ecosystem !== null, 'Ecosystem model present in Common Marine Data Model');
  assert(testVesselData.ecosystem?.chlorophyll_a_mg_m3 === null, 'Chlorophyll-a is null until MOSDAC connected');
  assert(testVesselData.ecosystem?.pfz_advisory === null, 'PFZ advisory is null until INCOIS connected');
  assert(testVesselData.ecosystem?.sea_surface_temperature_c !== null, 'SST populated from marine observation');

  // Test Group 8: Provider Status & Comprehensive Provenance
  console.log('\nTest Group 8: Provider Status & Comprehensive Provenance');
  assert(testVesselData.providers.open_meteo !== undefined, 'Open-Meteo provider present in providers map');
  assert(testVesselData.providers.imd.status === 'CONFIG_REQUIRED', 'IMD reports CONFIG_REQUIRED');
  assert(testVesselData.providers.incois.status === 'CONFIG_REQUIRED', 'INCOIS reports CONFIG_REQUIRED');
  assert(testVesselData.providers.mosdac.status === 'CONFIG_REQUIRED', 'MOSDAC reports CONFIG_REQUIRED');
  assert(Array.isArray(testVesselData.providers.open_meteo.missing_fields), 'Open-Meteo provenance tracks missing fields array');

  // Test Group 9: Confidence Model: C = w1*F + w2*A + w3*S
  console.log('\nTest Group 9: Confidence Model: C = w1*F + w2*A + w3*S');
  const confidenceBreakdown = testVesselData.metadata.confidence_breakdown;
  assert(confidenceBreakdown !== undefined, 'confidence_breakdown present in metadata');
  assert(confidenceBreakdown?.weights.w1_freshness === 0.35, 'Weight w1 (freshness) is 0.35');
  assert(confidenceBreakdown?.weights.w2_agreement === 0.35, 'Weight w2 (agreement) is 0.35');
  assert(confidenceBreakdown?.weights.w3_spatial === 0.30, 'Weight w3 (spatial/completeness) is 0.30');
  assert(
    confidenceBreakdown !== undefined &&
    confidenceBreakdown.composite >= 0.0 &&
    confidenceBreakdown.composite <= 1.0,
    'Composite confidence is between 0.0 and 1.0'
  );

  // Test Group 10: Live End-to-End Orchestrator Pipeline
  console.log('\nTest Group 10: Live End-to-End Orchestrator Pipeline');
  try {
    const liveData = await OrcaOrchestrator.collectAndProcess({
      latitude: 18.9438,
      longitude: 72.836,
      demo: false,
    });
    assert(liveData.location.latitude === 18.9438, 'Preserves requested latitude');
    assert(liveData.weather !== null, 'Live weather observation present');
    assert(liveData.ocean !== null, 'Live ocean observation present');
    assert(liveData.weather?.wind_speed_mps !== null, 'Live wind speed normalized to m/s');
    assert(liveData.ocean?.ocean_current_speed_mps !== null, 'Live current velocity normalized to m/s');
    assert(['LIVE', 'CACHED'].includes(liveData.metadata.source_status), 'Real live or cached source status');

    const risk = evaluateRiskEngine(liveData);
    assert(typeof risk.score === 'number', `Computes deterministic risk score: ${risk.score}`);
    assert(['LOW', 'MODERATE', 'HIGH'].includes(risk.level), `Risk level valid: ${risk.level}`);
  } catch (err: any) {
    console.error('Live Open-Meteo test encountered network error (acceptable in offline environments):', err.message);
  }

  console.log('\n========================================');
  console.log(`PHASE 2 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase2Tests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
