/**
 * ORCA Phase 5 Test Suite — Official MOSDAC / ISRO Integration & Verification
 * 
 * Verifies all 21 required Phase 5 verification cases:
 * 1. MOSDAC provider successful response
 * 2. Missing MOSDAC credentials -> CONFIG_REQUIRED
 * 3. Unavailable service -> UNAVAILABLE (no crash)
 * 4. Malformed response handling
 * 5. Missing chlorophyll-a remains null (never zero)
 * 6. Missing SST remains null (never zero)
 * 7. Missing wind speed remains null (never zero)
 * 8. Missing wind direction remains null (never fabricated)
 * 9. Missing cloud cover remains null (never zero)
 * 10. Timestamp normalization (UTC ISO preserved)
 * 11. Unit normalization (Kelvin to Celsius, m/s to km/h)
 * 12. Cloud fraction/percentage normalization ([0, 1] to %)
 * 13. Provenance tracking
 * 14. Freshness assessment (age tracking & status)
 * 15. Cache behavior (TTL 300s, CACHED status)
 * 16. Geographic / no-data response (empty/out-of-bounds -> null)
 * 17. Aggregation with Open-Meteo + IMD + INCOIS + MOSDAC
 * 18. MOSDAC failure does not crash assessment
 * 19. Provider conflict remains transparent (source_conflicts tracking)
 * 20. Deterministic risk engine remains unchanged
 * 21. DEMO mode remains functional
 */

import http from 'http';
import { OrcaOrchestrator } from './src/pipeline/orchestrator';
import { fetchMosdacData } from './src/pipeline/adapters';
import {
  normalizeMosdacData,
  normalizeCloudCover,
  normalizeSst,
  RawMosdacPayload,
} from './src/pipeline/mosdacNormalizer';
import { evaluateRiskEngine } from './src/pipeline/riskEngine';
import { CommonMarineDataModel } from './src/pipeline/models';
import { computeFreshnessDetails } from './src/pipeline/validator';

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

async function runPhase5Tests() {
  console.log('\n========================================');
  console.log('ORCA PHASE 5: MOSDAC / ISRO TEST SUITE');
  console.log('========================================\n');

  // Test 1: MOSDAC Successful Response Normalization
  console.log('Test 1: MOSDAC Provider Successful Response');
  const mockPayload: RawMosdacPayload = {
    chlorophyll_a: 1.45,
    sea_surface_temperature: 28.7,
    surface_wind_speed: 8.5,
    wind_direction: 260.0,
    cloud_cover: 0.35, // fraction 35%
    observation_time: '2026-09-28T06:30:00Z',
    product_id: 'EOS-06_OCM_L3_CHLA_DAILY',
    satellite: 'EOS-06',
    sensor: 'OCM-3',
  };

  const norm = normalizeMosdacData(mockPayload, 'https://mosdac.gov.in/data/ocm', '2026-09-28T07:00:00Z', 'LIVE');
  assert(norm !== null, 'MOSDAC payload normalized successfully');
  assert(norm?.chlorophyll_a_mg_m3 === 1.45, 'Chlorophyll-a preserved as 1.45 mg/m³');
  assert(norm?.sea_surface_temperature_c === 28.7, 'SST preserved as 28.7 °C');
  assert(norm?.surface_wind.wind_speed_mps === 8.5, 'Surface wind speed preserved as 8.5 m/s');
  assert(norm?.surface_wind.wind_speed_kmph === 30.6, 'Surface wind speed converted to 30.6 km/h (8.5 * 3.6)');
  assert(norm?.surface_wind.wind_direction_deg === 260.0, 'Surface wind direction preserved as 260.0°');
  assert(norm?.cloud_cover_percent === 35.0, 'Cloud fraction 0.35 normalized to 35.0%');
  assert(norm?.observation_timestamp === '2026-09-28T06:30:00Z', 'Observation timestamp preserved');
  assert(norm?.product_id === 'EOS-06_OCM_L3_CHLA_DAILY', 'Product ID preserved');
  assert(norm?.source.provider.includes('MOSDAC'), 'Provider tagged as MOSDAC');

  // Test 2: Missing MOSDAC Credentials -> CONFIG_REQUIRED
  console.log('\nTest 2: Missing MOSDAC Credentials -> CONFIG_REQUIRED');
  const origUser = process.env.MOSDAC_USERNAME;
  const origPass = process.env.MOSDAC_PASSWORD;
  const origToken = process.env.MOSDAC_TOKEN;
  const origEndpoint = process.env.MOSDAC_ENDPOINT_URL;

  delete process.env.MOSDAC_USERNAME;
  delete process.env.MOSDAC_PASSWORD;
  delete process.env.MOSDAC_TOKEN;
  delete process.env.MOSDAC_ENDPOINT_URL;

  const configReqRes = await fetchMosdacData(18.94, 72.83);
  assert(configReqRes.health.status === 'CONFIG_REQUIRED', 'Reports CONFIG_REQUIRED when credentials absent');
  assert(configReqRes.data === null, 'No fabricated satellite data returned when CONFIG_REQUIRED');
  assert(configReqRes.health.error !== null, 'Error note explains configuration requirement');

  // Test 3: Unavailable Service -> UNAVAILABLE
  console.log('\nTest 3: Unavailable Service -> UNAVAILABLE');
  process.env.MOSDAC_ENDPOINT_URL = 'http://127.0.0.1:59998/api/v1/satellite';
  process.env.MOSDAC_TOKEN = 'test-token';

  const unavailRes = await fetchMosdacData(18.94, 72.83, 500);
  assert(unavailRes.health.status === 'UNAVAILABLE', 'Reports UNAVAILABLE on network failure');
  assert(unavailRes.data === null, 'Data is null on failure');
  assert(unavailRes.health.error !== null, 'Error message recorded without crashing');

  // Test 4: Malformed Response Handling
  console.log('\nTest 4: Malformed Response Handling');
  const malformedPayload: any = {
    chlorophyll_a: 'corrupted',
    sea_surface_temperature: 999.0, // impossible temperature
    wind_speed: -15.0, // impossible negative
    cloud_cover: 'invalid',
  };
  const malformedNorm = normalizeMosdacData(malformedPayload, 'https://mosdac.gov.in', '2026-09-28T07:00:00Z', 'LIVE');
  assert(malformedNorm === null, 'Completely corrupt payload with no valid metrics returns null');

  // Test 5: Missing Chlorophyll-a Remains Null (Never Zero)
  console.log('\nTest 5: Missing Chlorophyll-a Remains Null');
  const missingChlaPayload: RawMosdacPayload = {
    sea_surface_temperature: 29.1,
    surface_wind_speed: 6.0,
  };
  const chlaNorm = normalizeMosdacData(missingChlaPayload, 'https://mosdac.gov.in', '2026-09-28T07:00:00Z', 'LIVE');
  assert(chlaNorm !== null, 'Payload with valid metrics normalized');
  assert(chlaNorm?.chlorophyll_a_mg_m3 === null, 'Missing chlorophyll-a remains strictly null (never 0)');

  // Test 6: Missing SST Remains Null (Never Zero)
  console.log('\nTest 6: Missing SST Remains Null');
  const missingSstPayload: RawMosdacPayload = {
    chlorophyll_a: 0.85,
    surface_wind_speed: 7.2,
  };
  const sstNorm = normalizeMosdacData(missingSstPayload, 'https://mosdac.gov.in', '2026-09-28T07:00:00Z', 'LIVE');
  assert(sstNorm?.sea_surface_temperature_c === null, 'Missing SST remains strictly null (never 0)');

  // Test 7: Missing Wind Speed Remains Null (Never Zero)
  console.log('\nTest 7: Missing Wind Speed Remains Null');
  const missingWindSpdPayload: RawMosdacPayload = {
    chlorophyll_a: 1.1,
    wind_direction: 180.0,
  };
  const windSpdNorm = normalizeMosdacData(missingWindSpdPayload, 'https://mosdac.gov.in', '2026-09-28T07:00:00Z', 'LIVE');
  assert(windSpdNorm?.surface_wind.wind_speed_mps === null, 'Missing wind speed remains strictly null');
  assert(windSpdNorm?.surface_wind.wind_speed_kmph === null, 'Missing wind speed in km/h remains strictly null');

  // Test 8: Missing Wind Direction Remains Null (Never Fabricated)
  console.log('\nTest 8: Missing Wind Direction Remains Null (Never Fabricated)');
  const missingWindDirPayload: RawMosdacPayload = {
    chlorophyll_a: 0.95,
    wind_speed: 12.0, // speed present
    // direction missing
  };
  const windDirNorm = normalizeMosdacData(missingWindDirPayload, 'https://mosdac.gov.in', '2026-09-28T07:00:00Z', 'LIVE');
  assert(windDirNorm?.surface_wind.wind_speed_mps === 12.0, 'Valid wind speed preserved');
  assert(windDirNorm?.surface_wind.wind_direction_deg === null, 'Missing wind direction strictly preserved as null');

  // Test 9: Missing Cloud Cover Remains Null (Never Zero)
  console.log('\nTest 9: Missing Cloud Cover Remains Null');
  const missingCloudPayload: RawMosdacPayload = {
    chlorophyll_a: 2.1,
    sea_surface_temperature: 28.0,
  };
  const cloudNorm = normalizeMosdacData(missingCloudPayload, 'https://mosdac.gov.in', '2026-09-28T07:00:00Z', 'LIVE');
  assert(cloudNorm?.cloud_cover_percent === null, 'Missing cloud cover remains strictly null (never 0)');

  // Test 10: Timestamp Normalization
  console.log('\nTest 10: Timestamp Normalization');
  const timestampPayload: RawMosdacPayload = {
    chlorophyll_a: 1.2,
    observation_time: '2026-09-28T04:15:30Z',
  };
  const tsNorm = normalizeMosdacData(timestampPayload, 'https://mosdac.gov.in', '2026-09-28T07:00:00Z', 'LIVE');
  assert(tsNorm?.observation_timestamp === '2026-09-28T04:15:30Z', 'Observation timestamp preserved accurately in UTC ISO format');
  assert(tsNorm?.source.observation_timestamp === '2026-09-28T04:15:30Z', 'Source provenance preserves observation timestamp');

  // Test 11: Unit Normalization (Kelvin to Celsius, m/s to km/h)
  console.log('\nTest 11: Unit Normalization (Kelvin to Celsius, m/s to km/h)');
  const kelvinSst = normalizeSst(302.15); // 302.15 K - 273.15 = 29.0 °C
  assert(kelvinSst === 29.0, 'Kelvin 302.15 K correctly converted to 29.0 °C');
  const celsiusSst = normalizeSst(28.4);
  assert(celsiusSst === 28.4, 'Celsius 28.4 °C preserved without modification');

  // Test 12: Cloud Fraction / Percentage Normalization
  console.log('\nTest 12: Cloud Fraction / Percentage Normalization');
  const fractionCloud = normalizeCloudCover(0.42); // 0.42 fraction -> 42.0%
  assert(fractionCloud === 42.0, 'Cloud fraction 0.42 converted to 42.0%');
  const percentCloud = normalizeCloudCover(65.0); // 65.0% -> 65.0%
  assert(percentCloud === 65.0, 'Cloud percentage 65.0% preserved without double multiplication');
  const clampCloud = normalizeCloudCover(105.0); // Invalid > 100
  assert(clampCloud === null, 'Invalid cloud cover > 100% sanitized to null');

  // Test 13: Provenance Tracking
  console.log('\nTest 13: Provenance Tracking');
  assert(norm?.source.provider === 'ISRO MOSDAC Satellite Ocean Data', 'Provider tagged accurately');
  assert(norm?.source.product_id === 'EOS-06_OCM_L3_CHLA_DAILY', 'Product ID preserved in provenance');
  assert(norm?.source.data_status === 'LIVE', 'Data status tracked in provenance');

  // Test 14: Freshness Assessment (Age Tracking & Status)
  console.log('\nTest 14: Freshness Assessment');
  const now = new Date();
  const past4Hours = new Date(now.getTime() - 4 * 3600 * 1000).toISOString();
  const freshnessDetails = computeFreshnessDetails(now.toISOString(), past4Hours, 3);
  assert(freshnessDetails.freshness === 'STALE', '4-hour-old satellite data classified as STALE (> 3h)');
  assert(freshnessDetails.age_seconds !== null && freshnessDetails.age_seconds >= 14400, 'Age in seconds computed accurately');

  // Test 15: Cache Behavior (TTL 300s, CACHED status)
  console.log('\nTest 15: Cache Behavior');
  const localServer = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        chlorophyll_a: 1.8,
        sea_surface_temperature: 29.5,
        wind_speed: 10.2,
        wind_direction: 255,
        cloud_cover: 0.2,
        observation_time: '2026-09-28T05:00:00Z',
      })
    );
  });
  await new Promise<void>((resolve) => localServer.listen(0, '127.0.0.1', () => resolve()));
  const localPort = (localServer.address() as any).port;

  process.env.MOSDAC_ENDPOINT_URL = `http://127.0.0.1:${localPort}/mosdac-live`;
  process.env.MOSDAC_TOKEN = 'test-token';

  const liveRes = await fetchMosdacData(18.94, 72.83);
  assert(liveRes.health.status === 'LIVE', 'First call returns LIVE');
  assert(liveRes.data?.chlorophyll_a_mg_m3 === 1.8, 'Chlorophyll-a matches live response');

  // Second call hits cache
  const cachedRes = await fetchMosdacData(18.94, 72.83);
  assert(cachedRes.health.status === 'CACHED', 'Second call within TTL returns CACHED');
  assert(cachedRes.data?.chlorophyll_a_mg_m3 === 1.8, 'Cached data preserved accurately');

  localServer.close();

  // Test 16: Geographic / No-Data Response
  console.log('\nTest 16: Geographic / No-Data Response');
  const emptyPayload: RawMosdacPayload = {};
  const noDataNorm = normalizeMosdacData(emptyPayload, 'https://mosdac.gov.in', '2026-09-28T07:00:00Z', 'LIVE');
  assert(noDataNorm === null, 'Empty payload outside coverage returns null without error');

  // Test 17: Aggregation with Open-Meteo + IMD + INCOIS + MOSDAC
  console.log('\nTest 17: Aggregation with All 4 Providers Active');
  // Re-start mock server for full pipeline
  const fullServer = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        chlorophyll_a: 1.62,
        sea_surface_temperature: 28.9,
        wind_speed: 9.0, // 32.4 km/h
        wind_direction: 245,
        cloud_cover: 0.15,
        product_id: 'OCM3_CHLA_L3_DAILY',
        satellite: 'EOS-06',
        observation_time: '2026-09-28T06:00:00Z',
      })
    );
  });
  await new Promise<void>((resolve) => fullServer.listen(0, '127.0.0.1', () => resolve()));
  const fullPort = (fullServer.address() as any).port;

  process.env.MOSDAC_ENDPOINT_URL = `http://127.0.0.1:${fullPort}/mosdac-live-pipeline`;
  process.env.MOSDAC_TOKEN = 'test-token';

  const fullAggResult = await OrcaOrchestrator.collectAndProcess({
    latitude: 18.9438,
    longitude: 72.836,
    label: 'Mumbai Harbor',
  });

  assert(fullAggResult.providers.open_meteo !== undefined, 'Open-Meteo present in providers');
  assert(fullAggResult.providers.imd !== undefined, 'IMD present in providers');
  assert(fullAggResult.providers.incois !== undefined, 'INCOIS present in providers');
  assert(fullAggResult.providers.mosdac !== undefined, 'MOSDAC present in providers');
  assert(fullAggResult.ecosystem?.chlorophyll_a_mg_m3 === 1.62, 'Ecosystem model populated with MOSDAC Chlorophyll-a (1.62 mg/m³)');
  assert(fullAggResult.providers.mosdac.status === 'LIVE', 'MOSDAC provider status is LIVE');

  // Test 18: MOSDAC Failure Does Not Crash Assessment
  console.log('\nTest 18: MOSDAC Failure Does Not Crash Assessment');
  fullServer.close();
  // Server closed -> next query will fail
  const fallbackResult = await OrcaOrchestrator.collectAndProcess({
    latitude: 15.4989,
    longitude: 73.8278,
    label: 'Goa Coast',
  });

  assert(fallbackResult.weather !== null, 'Open-Meteo weather is available despite MOSDAC failure');
  assert(fallbackResult.ocean !== null, 'Ocean data is available despite MOSDAC failure');
  assert(fallbackResult.metadata.sources.mosdac.status === 'UNAVAILABLE', 'MOSDAC status recorded as UNAVAILABLE');
  assert(fallbackResult.metadata.source_status === 'LIVE', 'Overall pipeline status remains LIVE via Open-Meteo');

  // Test 19: Provider Conflict Remains Transparent (Source Conflicts Tracking)
  console.log('\nTest 19: Provider Conflict Tracking (wind & SST in source_conflicts)');
  const windConflicts = fullAggResult.metadata.source_conflicts.find((c) => c.variable === 'wind_speed');
  assert(windConflicts !== undefined, 'Wind speed source comparison recorded');
  assert(windConflicts?.values.mosdac !== undefined, 'MOSDAC wind speed participates in multi-source comparison');

  // Test 20: Deterministic Risk Engine Remains Unchanged
  console.log('\nTest 20: Deterministic Risk Engine Remains Authoritative & Unchanged');
  const mockCleanModel: CommonMarineDataModel = {
    location: { latitude: 18.94, longitude: 72.83, label: 'Mumbai Harbor' },
    time: { retrieved_at: new Date().toISOString(), freshness: 'LIVE' },
    weather: {
      temperature_c: 29.0,
      feels_like_c: 32.0,
      humidity_pct: 70,
      pressure_hpa: 1010,
      wind_speed_kmph: 20.0,
      wind_speed_mps: 5.56,
      wind_gust_kmph: 25.0,
      wind_gust_mps: 6.94,
      wind_direction_deg: 260,
      precipitation_mm_last_hour: 0,
      precipitation_mm_24h: 0,
      visibility_km: 10,
      cloud_cover_percent: 30,
      lightning_density: null,
      condition: 'Clear',
      source: { provider: 'Open-Meteo', retrieved_at: new Date().toISOString(), data_status: 'LIVE' },
    },
    ocean: {
      wave_height_m: 1.2,
      wave_period_s: 7.5,
      wave_direction_deg: 250,
      wind_wave_height_m: 0.6,
      swell_height_m: 0.9,
      swell_period_s: 8.5,
      swell_direction_deg: 245,
      sea_surface_temperature_c: 28.5,
      ocean_current_speed_kmph: 1.5,
      ocean_current_speed_mps: 0.42,
      ocean_current_direction_deg: 220,
      current_u_mps: 0.3,
      current_v_mps: 0.3,
      significant_wave_height_m: 1.2,
      peak_wave_period_s: 7.5,
      tide_height_m: 1.2,
      tide_time_utc: '2026-09-28T12:00:00Z',
      source: { provider: 'INCOIS OSF', retrieved_at: new Date().toISOString(), data_status: 'LIVE' },
    },
    ecosystem: {
      chlorophyll_a_mg_m3: 1.5,
      sea_surface_temperature_c: 28.5,
      cloud_cover_percent: 25,
      pfz_advisory: null,
      pfz_polygon: null,
      observation_timestamp: new Date().toISOString(),
      source: { provider: 'ISRO MOSDAC', retrieved_at: new Date().toISOString(), data_status: 'LIVE' },
    },
    vessel: null,
    geofencing: null,
    warnings: { status: 'NONE', items: [], provider: 'IMD', retrieved_at: new Date().toISOString() },
    providers: {},
    metadata: {
      source_status: 'LIVE',
      data_completeness: 1.0,
      confidence: 0.95,
      validation_status: 'VALID',
      errors: [],
      missing_fields: [],
      source_conflicts: [],
      sources: {} as any,
    },
  };

  const riskResult = evaluateRiskEngine(mockCleanModel);
  assert(riskResult.factors.length === 5, 'Exactly 5 physical risk factors evaluated');
  assert(riskResult.warning_override === false, 'warning_override is false without active official warnings');
  assert(['LOW', 'MODERATE', 'HIGH'].includes(riskResult.level), 'Risk level matches standard levels');

  // Test 21: DEMO Mode Remains Functional
  console.log('\nTest 21: DEMO Mode Remains Functional');
  const demoResult = await OrcaOrchestrator.collectAndProcess({
    latitude: 18.9438,
    longitude: 72.836,
    label: 'Mumbai Harbor',
    demo: true,
  });

  assert(demoResult.metadata.source_status === 'DEMO', 'Demo flag produces DEMO source status');
  assert(demoResult.weather?.source.data_status === 'DEMO', 'Weather source tagged as DEMO');
  assert(demoResult.ocean?.source.data_status === 'DEMO', 'Ocean source tagged as DEMO');

  // Restore env
  if (origUser) process.env.MOSDAC_USERNAME = origUser;
  else delete process.env.MOSDAC_USERNAME;
  if (origPass) process.env.MOSDAC_PASSWORD = origPass;
  else delete process.env.MOSDAC_PASSWORD;
  if (origToken) process.env.MOSDAC_TOKEN = origToken;
  else delete process.env.MOSDAC_TOKEN;
  if (origEndpoint) process.env.MOSDAC_ENDPOINT_URL = origEndpoint;
  else delete process.env.MOSDAC_ENDPOINT_URL;

  console.log('\n========================================');
  console.log(`PHASE 5 TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('========================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runPhase5Tests().catch((err) => {
  console.error('Unhandled Phase 5 test error:', err);
  process.exit(1);
});
