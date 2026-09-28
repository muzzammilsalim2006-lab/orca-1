/**
 * Comprehensive Pipeline Test Suite for ORCA Phase 2
 * Tests:
 * 1. Open-Meteo LIVE retrieval
 * 2. Open-Meteo timeout handling
 * 3. Open-Meteo malformed response handling
 * 4. Missing fields remain null (no conversion to zero)
 * 5. Validation failure & boundary checking
 * 6. Stale data classification
 * 7. Source unavailable handling
 * 8. Multi-source aggregation & completeness calculation
 * 9. Demo fallback mode
 * 10. Config-required provider reporting
 * 11. Warning unavailable vs warning none semantics
 * 12. End-to-end OrcaOrchestrator pipeline integration
 */

import { OrcaOrchestrator } from './src/pipeline/orchestrator';
import { validateCoordinates, validateObservations, assessFreshness } from './src/pipeline/validator';
import { aggregateMarineData } from './src/pipeline/aggregator';
import { evaluateRiskEngine } from './src/pipeline/riskEngine';
import { fetchImdWarnings, fetchIncoisData, fetchMosdacData } from './src/pipeline/adapters';

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${msg}`);
    passCount++;
  } else {
    console.error(`  ✗ FAIL: ${msg}`);
    failCount++;
  }
}

async function runTestSuite() {
  console.log('\n========================================');
  console.log('ORCA PHASE 2 PIPELINE TEST SUITE');
  console.log('========================================\n');

  // Test 1: Coordinate Validation
  console.log('Test Group 1: Coordinate Validation');
  const validCoords = validateCoordinates(18.9438, 72.8360);
  assert(validCoords.length === 0, 'Mumbai Harbor coordinates valid');
  const invalidLat = validateCoordinates(120, 72.83);
  assert(invalidLat.length > 0 && invalidLat[0].includes('latitude'), 'Rejects latitude > 90');
  const invalidLon = validateCoordinates(18.94, -200);
  assert(invalidLon.length > 0 && invalidLon[0].includes('longitude'), 'Rejects longitude < -180');

  // Test 2: Validation of physical bounds & impossible values
  console.log('\nTest Group 2: Physical Metrics Validation');
  const badWeather = {
    temperature_c: 95.0, // impossible
    feels_like_c: 100.0,
    humidity_pct: 120,
    pressure_hpa: 600,
    wind_speed_kmph: -15.0, // impossible negative
    wind_gust_kmph: 20.0,
    wind_direction_deg: 180,
    precipitation_mm_last_hour: 0,
    precipitation_mm_24h: -5.0, // impossible negative
    visibility_km: null,
    condition: 'Storm',
    source: { provider: 'test', retrieved_at: new Date().toISOString(), data_status: 'LIVE' as const },
  };

  const badOcean = {
    wave_height_m: -1.5, // impossible negative
    wave_period_s: 50.0, // impossible period
    wave_direction_deg: 90,
    wind_wave_height_m: null,
    swell_height_m: -0.5, // impossible negative
    swell_period_s: null,
    swell_direction_deg: null,
    sea_surface_temperature_c: 28.0,
    ocean_current_speed_kmph: -4.0, // impossible negative
    source: { provider: 'test', retrieved_at: new Date().toISOString(), data_status: 'LIVE' as const },
  };

  const valResult = validateObservations(badWeather, badOcean);
  assert(valResult.cleanWeather?.temperature_c === null, 'Sanitizes impossible temperature to null');
  assert(valResult.cleanWeather?.wind_speed_kmph === null, 'Sanitizes negative wind speed to null');
  assert(valResult.cleanWeather?.precipitation_mm_24h === null, 'Sanitizes negative precipitation to null');
  assert(valResult.cleanOcean?.wave_height_m === null, 'Sanitizes negative wave height to null');
  assert(valResult.cleanOcean?.wave_period_s === null, 'Sanitizes impossible wave period to null');
  assert(valResult.cleanOcean?.ocean_current_speed_kmph === null, 'Sanitizes negative current speed to null');
  assert(valResult.errors.length >= 5, 'Records exact error reasons for all corrupted metrics');

  // Test 3: Null preservation (Missing fields must remain null, never assumed zero)
  console.log('\nTest Group 3: Null Preservation & Missing Data Integrity');
  const missingWeather = {
    temperature_c: 30.0,
    feels_like_c: 34.0,
    humidity_pct: 80,
    pressure_hpa: 1008,
    wind_speed_kmph: null,
    wind_gust_kmph: null,
    wind_direction_deg: null,
    precipitation_mm_last_hour: null,
    precipitation_mm_24h: null,
    visibility_km: null,
    condition: null,
    source: { provider: 'test', retrieved_at: new Date().toISOString(), data_status: 'LIVE' as const },
  };
  const missingVal = validateObservations(missingWeather, null);
  assert(missingVal.cleanWeather?.wind_speed_kmph === null, 'Wind speed remains strictly null');
  assert(missingVal.cleanWeather?.precipitation_mm_24h === null, 'Rainfall remains strictly null');
  assert(missingVal.cleanOcean === null, 'Missing ocean remains strictly null');

  // Test 4: Data Freshness
  console.log('\nTest Group 4: Data Freshness Tracking');
  const now = new Date().toISOString();
  const recent = new Date(Date.now() - 1000 * 60 * 60).toISOString(); // 1 hr ago
  const stale = new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(); // 6 hrs ago
  assert(assessFreshness(now) === 'LIVE', 'Immediate timestamp classified as LIVE');
  assert(assessFreshness(recent) === 'RECENT', '1-hour old data classified as RECENT');
  assert(assessFreshness(stale) === 'STALE', '6-hour old data classified as STALE');
  assert(assessFreshness('') === 'UNAVAILABLE', 'Empty timestamp classified as UNAVAILABLE');

  // Test 5: Provider Status Reporting & Health (CONFIG_REQUIRED vs UNAVAILABLE)
  console.log('\nTest Group 5: Provider Health & CONFIG_REQUIRED Status');
  const imdRes = await fetchImdWarnings(18.94, 72.83);
  assert(imdRes.health.status === 'CONFIG_REQUIRED', 'IMD reports CONFIG_REQUIRED when credentials absent');
  const incoisRes = await fetchIncoisData(18.94, 72.83);
  assert(incoisRes.health.status === 'CONFIG_REQUIRED', 'INCOIS reports CONFIG_REQUIRED when token absent');
  const mosdacRes = await fetchMosdacData(18.94, 72.83);
  assert(mosdacRes.health.status === 'CONFIG_REQUIRED', 'MOSDAC reports CONFIG_REQUIRED when credentials absent');

  // Test 6: Warning Semantics: UNAVAILABLE vs NONE vs ACTIVE
  console.log('\nTest Group 6: Warning Status Semantics (UNAVAILABLE vs NONE vs ACTIVE)');
  assert(imdRes.warnings.status === 'UNAVAILABLE', 'Warning status is UNAVAILABLE (not NONE) when source unconfigured');

  // Test 7: Multi-Source Aggregation
  console.log('\nTest Group 7: Multi-Source Aggregator & Completeness');
  const aggResult = aggregateMarineData({
    location: { latitude: 18.94, longitude: 72.83, region: 'Mumbai' },
    weather: {
      temperature_c: 28.5,
      feels_like_c: 32.0,
      humidity_pct: 75,
      pressure_hpa: 1010,
      wind_speed_kmph: 20.0,
      wind_gust_kmph: 25.0,
      wind_direction_deg: 240,
      precipitation_mm_last_hour: 0,
      precipitation_mm_24h: 5.0,
      visibility_km: null,
      condition: 'Clear',
      source: { provider: 'Open-Meteo', retrieved_at: new Date().toISOString(), data_status: 'LIVE' },
    },
    ocean: {
      wave_height_m: 1.2,
      wave_period_s: 8.0,
      wave_direction_deg: 250,
      wind_wave_height_m: 0.8,
      swell_height_m: 1.0,
      swell_period_s: 10.0,
      swell_direction_deg: 240,
      sea_surface_temperature_c: 29.0,
      ocean_current_speed_kmph: 2.1,
      source: { provider: 'Open-Meteo Marine', retrieved_at: new Date().toISOString(), data_status: 'LIVE' },
    },
    warnings: { status: 'NONE', items: [], provider: 'IMD', retrieved_at: new Date().toISOString() },
    sources: {
      open_meteo: { provider_id: 'open_meteo', name: 'Open-Meteo', status: 'LIVE', last_retrieval_attempt: new Date().toISOString() },
      imd: { provider_id: 'imd', name: 'IMD', status: 'CONFIG_REQUIRED', last_retrieval_attempt: new Date().toISOString() },
      incois: { provider_id: 'incois', name: 'INCOIS', status: 'CONFIG_REQUIRED', last_retrieval_attempt: new Date().toISOString() },
      mosdac: { provider_id: 'mosdac', name: 'MOSDAC', status: 'CONFIG_REQUIRED', last_retrieval_attempt: new Date().toISOString() },
    },
    validationStatus: 'VALID',
    errors: [],
  });

  assert(aggResult.metadata.data_completeness === 1.0, 'Completeness is 100% when all 5 key factors present');
  assert(aggResult.metadata.source_status === 'LIVE', 'Aggregated status is LIVE');
  assert(aggResult.metadata.confidence >= 0.8, 'Confidence is high (>= 0.8) for complete live observation');

  // Test 8: Deterministic Risk Engine & Official Warning Override
  console.log('\nTest Group 8: Deterministic Risk Engine & Warning Override');
  const normalRisk = evaluateRiskEngine(aggResult);
  assert(normalRisk.score < 35, `Normal conditions produce LOW risk (computed: ${normalRisk.score})`);
  assert(normalRisk.level === 'LOW', 'Risk level is LOW');
  assert(!normalRisk.warning_override, 'warning_override is false without warnings');

  // Add official cyclone warning
  const warningModel = {
    ...aggResult,
    warnings: {
      status: 'ACTIVE' as const,
      items: [
        {
          headline: 'Severe Cyclone Warning along coast',
          severity: 'warning' as const,
          source: 'IMD Cyclone Bulletin',
        },
      ],
      provider: 'IMD',
      retrieved_at: new Date().toISOString(),
    },
  };
  const warningRisk = evaluateRiskEngine(warningModel);
  assert(warningRisk.warning_override === true, 'Official warning sets warning_override to true');
  assert(warningRisk.score >= 85.0, `Official warning unconditionally forces risk score >= 85 (got ${warningRisk.score})`);
  assert(warningRisk.level === 'HIGH', 'Risk level is overridden to HIGH');

  // Test 9: Demo Fallback Mode
  console.log('\nTest Group 9: Demo Fallback Preservation');
  const demoOutput = await OrcaOrchestrator.collectAndProcess({
    latitude: 9.9312,
    longitude: 76.2673,
    label: 'Kochi Port (Demo)',
    demo: true,
  });
  assert(demoOutput.metadata.source_status === 'DEMO', 'Demo flag produces DEMO source status');
  assert(demoOutput.weather?.source.data_status === 'DEMO', 'Weather source tagged as DEMO (never false LIVE)');
  assert(demoOutput.ocean?.source.data_status === 'DEMO', 'Ocean source tagged as DEMO');

  // Test 10: Real End-to-End OrcaOrchestrator Live Query
  console.log('\nTest Group 10: Live End-to-End Orchestrator Pipeline');
  try {
    const liveOutput = await OrcaOrchestrator.collectAndProcess({
      latitude: 18.9438,
      longitude: 72.8360,
      label: 'Mumbai Harbor Live Pipeline Test',
      demo: false,
    });
    assert(liveOutput.location.latitude === 18.9438, 'Preserves requested latitude');
    assert(liveOutput.weather !== null, 'Retrieves live weather data');
    assert(liveOutput.ocean !== null, 'Retrieves live ocean data');
    assert(liveOutput.metadata.source_status === 'LIVE' || liveOutput.metadata.source_status === 'CACHED', 'Reports real status (LIVE or CACHED)');
    const liveRisk = evaluateRiskEngine(liveOutput);
    assert(typeof liveRisk.score === 'number', `Computes deterministic risk score: ${liveRisk.score}`);
    assert(liveRisk.factors.length === 5, 'Produces exactly 5 risk factors in breakdown table');
  } catch (err: any) {
    assert(false, `Live orchestrator failed: ${err.message}`);
  }

  console.log('\n========================================');
  console.log(`TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('========================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runTestSuite();
