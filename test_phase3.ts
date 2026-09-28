/**
 * ORCA Phase 3 Test Suite — IMD Integration & Verification
 * 
 * Tests the 12 required Phase 3 verification cases:
 * 1. IMD successful response (weather & warning normalization)
 * 2. IMD warning response (active official alert elevation)
 * 3. IMD no-warning response (status NONE vs UNAVAILABLE)
 * 4. IMD unavailable (network outage/error handling)
 * 5. IMD configuration missing (CONFIG_REQUIRED status)
 * 6. IMD timeout handling (AbortSignal handling without crashing)
 * 7. Malformed IMD response handling
 * 8. Partial IMD response (null preservation, partial observation)
 * 9. Common Marine Data Model normalization integrity
 * 10. Warning priority over deterministic engine
 * 11. Open-Meteo working when IMD fails
 * 12. Full assessment with both sources active
 */

import { OrcaOrchestrator } from './src/pipeline/orchestrator';
import { fetchImdData, fetchOpenMeteoWeather } from './src/pipeline/adapters';
import { normalizeImdWeather, normalizeImdWarnings, RawImdPayload } from './src/pipeline/imdNormalizer';
import { evaluateRiskEngine } from './src/pipeline/riskEngine';
import { aggregateMarineData } from './src/pipeline/aggregator';
import { resolveCoastalRegion } from './src/pipeline/geo';

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

async function runPhase3Tests() {
  console.log('\n========================================');
  console.log('ORCA PHASE 3: IMD INTEGRATION TEST SUITE');
  console.log('========================================\n');

  // 1. IMD Successful Response Normalization
  console.log('Test 1: IMD Successful Weather & Warning Normalization');
  const mockPayload: RawImdPayload = {
    station_id: 'MUMBAI_COLABA',
    station_name: 'Colaba Coastal Observatory',
    district: 'Mumbai',
    temperature: 29.4,
    humidity: 82,
    pressure: 1009.2,
    wind_speed_kmph: 24.5,
    rainfall_mm_24h: 12.0,
    rainfall_mm_last_hour: 2.5,
    weather_condition: 'Partly Cloudy with Coastal Breeze',
    warnings: [
      {
        id: 'imd-warn-001',
        headline: 'Heavy Rainfall Advisory for Mumbai Coastal Belt',
        severity: 'watch',
        color_code: 'YELLOW',
        warning_type: 'weather_warning',
        description: 'Isolated heavy falls likely along coastal regions during next 24 hours.',
        issued_at: '2026-09-22T08:30:00Z',
        valid_until: '2026-09-23T08:30:00Z',
        district: 'Mumbai',
      },
    ],
  };

  const normWeather = normalizeImdWeather(mockPayload, 'https://imd.gov.in/test', '2026-09-22T10:00:00Z', 'LIVE');
  assert(normWeather !== null, 'Weather normalized successfully');
  assert(normWeather?.temperature_c === 29.4, 'Temperature normalized to 29.4 C');
  assert(normWeather?.humidity_pct === 82, 'Humidity normalized to 82%');
  assert(normWeather?.wind_speed_kmph === 24.5, 'Wind speed normalized to 24.5 km/h');
  assert(normWeather?.precipitation_mm_24h === 12.0, '24h rainfall normalized to 12.0 mm');
  assert(normWeather?.source.provider === 'India Meteorological Department (IMD)', 'Source provider tagged as IMD');

  const normWarns = normalizeImdWarnings(mockPayload.warnings, '2026-09-22T10:00:00Z', true, 'Mumbai');
  assert(normWarns.status === 'ACTIVE', 'Warning status is ACTIVE when yellow warning present');
  assert(normWarns.items.length === 1, 'Exactly 1 warning parsed');
  assert(normWarns.items[0].severity === 'watch', 'Severity mapped to watch from YELLOW');
  assert(normWarns.items[0].official_color_code === 'YELLOW', 'Official color code preserved as YELLOW');
  assert(normWarns.items[0].issued_at === '2026-09-22T08:30:00Z', 'issued_at timestamp preserved');

  // 2. IMD Warning Response (Red/Alert severity mapping)
  console.log('\nTest 2: IMD Warning Response (RED Alert Cyclone Warning)');
  const cyclonePayload: RawImdPayload = {
    warnings: [
      {
        id: 'imd-cyc-09',
        headline: 'Severe Cyclonic Storm Warning over Arabian Sea',
        severity: 'alert',
        color_code: 'RED',
        warning_type: 'cyclone_warning',
        description: 'Total suspension of fishing operations along Maharashtra coast.',
        issued_at: '2026-09-22T06:00:00Z',
        district: 'Ratnagiri',
      },
    ],
  };
  const redWarns = normalizeImdWarnings(cyclonePayload.warnings, '2026-09-22T10:00:00Z', true, 'Ratnagiri');
  assert(redWarns.status === 'ACTIVE', 'Red alert marked ACTIVE');
  assert(redWarns.items[0].severity === 'alert', 'Color code RED mapped to alert severity');
  assert(redWarns.items[0].warning_type === 'cyclone_warning', 'Warning type classified as cyclone_warning');

  // 3. IMD No-Warning Response (NONE vs UNAVAILABLE)
  console.log('\nTest 3: IMD No-Warning Response (Status NONE)');
  const clearPayload: RawImdPayload = { warnings: [] };
  const clearWarns = normalizeImdWarnings(clearPayload.warnings, '2026-09-22T10:00:00Z', true, 'Palghar');
  assert(clearWarns.status === 'NONE', 'Successfully checked without warnings reports status NONE');
  assert(clearWarns.items.length === 0, 'Items array is empty for status NONE');

  // 4. IMD Unavailable (Service check failed)
  console.log('\nTest 4: IMD Unavailable vs NONE Distinction');
  const unavailWarns = normalizeImdWarnings(null, '2026-09-22T10:00:00Z', false, 'Palghar');
  assert(unavailWarns.status === 'UNAVAILABLE', 'Failed connection reports UNAVAILABLE (never falsely NONE)');

  // 5. IMD Configuration Missing (CONFIG_REQUIRED)
  console.log('\nTest 5: IMD Configuration Missing (CONFIG_REQUIRED)');
  // Ensure env is empty for this call
  const savedKey = process.env.IMD_API_KEY;
  const savedUrl = process.env.IMD_ENDPOINT_URL;
  delete process.env.IMD_API_KEY;
  delete process.env.IMD_ENDPOINT_URL;

  const configReqRes = await fetchImdData(18.94, 72.83, 'Mumbai Coastal', 'Mumbai');
  assert(configReqRes.health.status === 'CONFIG_REQUIRED', 'Reports CONFIG_REQUIRED when env absent');
  assert(configReqRes.warnings.status === 'UNAVAILABLE', 'Warnings marked UNAVAILABLE when CONFIG_REQUIRED');
  assert(configReqRes.weather === null, 'No fabricated weather returned when CONFIG_REQUIRED');

  // Restore env
  if (savedKey) process.env.IMD_API_KEY = savedKey;
  if (savedUrl) process.env.IMD_ENDPOINT_URL = savedUrl;

  // 6. IMD Timeout Handling
  console.log('\nTest 6: IMD Timeout Handling');
  // Configure unreachable local port with 50ms timeout
  process.env.IMD_ENDPOINT_URL = 'http://127.0.0.1:54321/imd/api';
  process.env.IMD_API_KEY = 'test_key';
  const timeoutRes = await fetchImdData(18.94, 72.83, 'Mumbai', 'Mumbai', 50);
  assert(timeoutRes.health.status === 'UNAVAILABLE', 'Reports UNAVAILABLE on timeout/failure');
  assert(timeoutRes.warnings.status === 'UNAVAILABLE', 'Warnings marked UNAVAILABLE on timeout');
  assert(timeoutRes.weather === null, 'Weather is null on timeout');
  assert(typeof timeoutRes.health.error === 'string', 'Error message recorded on timeout');

  // Clean up test env
  delete process.env.IMD_ENDPOINT_URL;
  delete process.env.IMD_API_KEY;

  // 7. Malformed IMD Response Handling
  console.log('\nTest 7: Malformed IMD Response Handling');
  const malformedPayload: any = { warnings: "not-an-array", temperature: "warm", wind_speed_kmph: 15.0 };
  const malformedWarns = normalizeImdWarnings(malformedPayload.warnings, '2026-09-22T10:00:00Z', true, 'Goa');
  assert(malformedWarns.status === 'NONE', 'Non-array warnings handled safely without throwing');
  const malformedWeather = normalizeImdWeather(malformedPayload, 'http://test', '2026-09-22T10:00:00Z', 'LIVE');
  assert(malformedWeather !== null, 'Weather object returned when valid wind metric exists');
  assert(malformedWeather?.temperature_c === null, 'Non-numeric temperature converted safely to null');
  assert(malformedWeather?.wind_speed_kmph === 15.0, 'Valid numeric wind metric preserved');

  // Also test completely unparseable payload (all strings/non-numeric) returns null
  const completelyCorruptPayload: any = { temperature: "warm", humidity: "humid", wind_speed_kmph: "fast" };
  const nullWeather = normalizeImdWeather(completelyCorruptPayload, 'http://test', '2026-09-22T10:00:00Z', 'LIVE');
  assert(nullWeather === null, 'Completely corrupt non-numeric payload rejected as null');

  // 8. Partial IMD Response (Null preservation)
  console.log('\nTest 8: Partial IMD Response (Null Preservation)');
  const partialPayload: RawImdPayload = {
    station_name: 'Alibag Coastal Station',
    district: 'Raigad',
    temperature: 30.2,
    // wind, rainfall, humidity absent
  };
  const partialWeather = normalizeImdWeather(partialPayload, 'http://test', '2026-09-22T10:00:00Z', 'LIVE');
  assert(partialWeather?.temperature_c === 30.2, 'Temperature present (30.2)');
  assert(partialWeather?.wind_speed_kmph === null, 'Missing wind speed remains strictly null');
  assert(partialWeather?.precipitation_mm_24h === null, 'Missing precipitation remains strictly null');
  assert(partialWeather?.humidity_pct === null, 'Missing humidity remains strictly null');

  // 9. Geographic District Mapping for Prototype
  console.log('\nTest 9: Prototype Geographic Scope & District Resolution');
  const mumbaiDistrict = resolveCoastalRegion(18.94, 72.83);
  assert(mumbaiDistrict.districtName === 'Mumbai', 'Resolves Mumbai district correctly');
  const alibagDistrict = resolveCoastalRegion(18.65, 72.88);
  assert(alibagDistrict.districtName === 'Raigad', 'Resolves Raigad district correctly');
  const malvanDistrict = resolveCoastalRegion(16.05, 73.47);
  assert(malvanDistrict.districtName === 'Sindhudurg', 'Resolves Sindhudurg district correctly');
  const goaDistrict = resolveCoastalRegion(15.49, 73.82);
  assert(goaDistrict.districtName === 'Goa', 'Resolves Goa district correctly');

  // 10. Official Warning Priority over Deterministic Engine
  console.log('\nTest 10: Warning Priority over Deterministic Engine');
  const baseAgg = aggregateMarineData({
    location: { latitude: 18.94, longitude: 72.83, region: 'Mumbai' },
    weather: {
      temperature_c: 28.0,
      feels_like_c: 30.0,
      humidity_pct: 70,
      pressure_hpa: 1012,
      wind_speed_kmph: 15.0, // CalmWinds
      wind_gust_kmph: 18.0,
      wind_direction_deg: 260,
      precipitation_mm_last_hour: 0,
      precipitation_mm_24h: 0, // No rain
      visibility_km: null,
      condition: 'Clear',
      source: { provider: 'Open-Meteo', retrieved_at: new Date().toISOString(), data_status: 'LIVE' },
    },
    ocean: {
      wave_height_m: 0.8, // Calm Sea
      wave_period_s: 7.0,
      wave_direction_deg: 260,
      wind_wave_height_m: 0.5,
      swell_height_m: 0.6,
      swell_period_s: 9.0,
      swell_direction_deg: 250,
      sea_surface_temperature_c: 28.5,
      ocean_current_speed_kmph: 1.2,
      source: { provider: 'Open-Meteo Marine', retrieved_at: new Date().toISOString(), data_status: 'LIVE' },
    },
    warnings: {
      status: 'ACTIVE',
      items: [
        {
          headline: 'IMD Coastal Cyclone Alert: Suspend sea activities',
          severity: 'alert',
          source: 'India Meteorological Department (IMD)',
          official_color_code: 'RED',
        },
      ],
      provider: 'India Meteorological Department (IMD)',
      retrieved_at: new Date().toISOString(),
    },
    sources: {
      open_meteo: { provider_id: 'open_meteo', name: 'Open-Meteo', status: 'LIVE', last_retrieval_attempt: new Date().toISOString() },
      imd: { provider_id: 'imd', name: 'IMD', status: 'LIVE', last_retrieval_attempt: new Date().toISOString() },
      incois: { provider_id: 'incois', name: 'INCOIS', status: 'CONFIG_REQUIRED', last_retrieval_attempt: new Date().toISOString() },
      mosdac: { provider_id: 'mosdac', name: 'MOSDAC', status: 'CONFIG_REQUIRED', last_retrieval_attempt: new Date().toISOString() },
    },
    validationStatus: 'VALID',
    errors: [],
  });

  const priorityRisk = evaluateRiskEngine(baseAgg);
  assert(priorityRisk.warning_override === true, 'warning_override is true');
  assert(priorityRisk.score >= 85.0, `Score is elevated to >= 85 (got ${priorityRisk.score}) despite calm physical metrics`);
  assert(priorityRisk.level === 'HIGH', 'Risk level is HIGH');

  // 11. Open-Meteo Working while IMD is UNAVAILABLE
  console.log('\nTest 11: Open-Meteo Working while IMD Fails');
  const omWeather = await fetchOpenMeteoWeather(18.9438, 72.8360);
  assert(omWeather.data !== null, 'Open-Meteo weather is successfully retrieved');
  assert(omWeather.status === 'LIVE' || omWeather.status === 'CACHED', 'Open-Meteo reports LIVE or CACHED');

  const imdFailedAgg = aggregateMarineData({
    location: { latitude: 18.94, longitude: 72.83, region: 'Mumbai' },
    weather: omWeather.data,
    ocean: {
      wave_height_m: 1.1,
      wave_period_s: 8.0,
      wave_direction_deg: 260,
      wind_wave_height_m: null,
      swell_height_m: 0.9,
      swell_period_s: null,
      swell_direction_deg: null,
      sea_surface_temperature_c: 28.0,
      ocean_current_speed_kmph: 1.8,
      source: { provider: 'Open-Meteo Marine', retrieved_at: new Date().toISOString(), data_status: 'LIVE' },
    },
    warnings: {
      status: 'UNAVAILABLE',
      items: [],
      provider: 'IMD',
      retrieved_at: new Date().toISOString(),
    },
    sources: {
      open_meteo: { provider_id: 'open_meteo', name: 'Open-Meteo', status: 'LIVE', last_retrieval_attempt: new Date().toISOString() },
      imd: { provider_id: 'imd', name: 'IMD', status: 'UNAVAILABLE', last_retrieval_attempt: new Date().toISOString(), error: 'Gateway timeout' },
      incois: { provider_id: 'incois', name: 'INCOIS', status: 'CONFIG_REQUIRED', last_retrieval_attempt: new Date().toISOString() },
      mosdac: { provider_id: 'mosdac', name: 'MOSDAC', status: 'CONFIG_REQUIRED', last_retrieval_attempt: new Date().toISOString() },
    },
    validationStatus: 'VALID',
    errors: ['IMD: Gateway timeout'],
  });

  assert(imdFailedAgg.metadata.source_status === 'LIVE', 'Aggregated status remains LIVE via Open-Meteo');
  assert(imdFailedAgg.weather !== null, 'Assessment produces valid weather observation');
  assert(imdFailedAgg.warnings.status === 'UNAVAILABLE', 'Warning status accurately reflects UNAVAILABLE');
  const imdFailedRisk = evaluateRiskEngine(imdFailedAgg);
  assert(typeof imdFailedRisk.score === 'number', 'Risk assessment computes successfully without crashing');
  assert(imdFailedRisk.advisories.some((a) => a.includes('IMD/INCOIS bulletins currently unreachable')), 'Advisory reflects unreachable IMD');

  // 12. Full Assessment Pipeline with Both Sources
  console.log('\nTest 12: Full Orchestrator Pipeline with Both Sources');
  const fullModel = await OrcaOrchestrator.collectAndProcess({
    latitude: 18.9438,
    longitude: 72.8360,
    label: 'Mumbai Harbor Phase 3 Pipeline Test',
    demo: false,
  });

  assert(fullModel.location.region?.includes('Mumbai'), 'Region correctly resolved to Mumbai');
  assert(fullModel.weather !== null, 'Weather observation present in Common Marine Data Model');
  assert(fullModel.ocean !== null, 'Ocean observation present in Common Marine Data Model');
  assert(fullModel.metadata.sources.open_meteo.status === 'LIVE' || fullModel.metadata.sources.open_meteo.status === 'CACHED', 'Open-Meteo provider status confirmed');
  assert(fullModel.metadata.sources.imd.status === 'CONFIG_REQUIRED' || fullModel.metadata.sources.imd.status === 'LIVE', 'IMD provider status tracked accurately');
  assert(['NONE', 'ACTIVE', 'UNAVAILABLE'].includes(fullModel.warnings.status), `Warning status adheres to semantic schema: ${fullModel.warnings.status}`);

  console.log('\n========================================');
  console.log(`PHASE 3 TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('========================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runPhase3Tests();
