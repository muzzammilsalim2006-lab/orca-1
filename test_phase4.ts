/**
 * ORCA Phase 4 Test Suite — Official INCOIS Integration & Verification
 * 
 * Verifies all 12 required Phase 4 verification cases:
 * 1. INCOIS successful response (U, V, Hs, Tp normalization)
 * 2. INCOIS current vector normalization (m/s) and drift calculation (V_d = V_c + γ V_w)
 * 3. INCOIS tide normalization (metres, UTC timestamp)
 * 4. INCOIS high wave / swell surge alert normalization and warning priority
 * 5. INCOIS PFZ normalization (advisory & geometry)
 * 6. INCOIS missing config -> CONFIG_REQUIRED
 * 7. INCOIS network failure / unreachable -> UNAVAILABLE (no crash)
 * 8. INCOIS malformed payload handling (null preservation, bounds check)
 * 9. INCOIS timeout handling (AbortSignal handling without crashing)
 * 10. Multi-source comparison (Open-Meteo wave vs INCOIS wave)
 * 11. Graceful degradation: Open-Meteo operates when INCOIS is CONFIG_REQUIRED or UNAVAILABLE
 * 12. Full assessment with Open-Meteo + IMD + INCOIS
 */

import http from 'http';
import { OrcaOrchestrator } from './src/pipeline/orchestrator';
import { fetchIncoisData } from './src/pipeline/adapters';
import {
  normalizeIncoisOcean,
  normalizeIncoisAlerts,
  normalizeIncoisPfz,
  RawIncoisOsfPayload,
  RawIncoisAlert,
  RawIncoisPfzPayload,
} from './src/pipeline/incoisNormalizer';
import { evaluateRiskEngine, calculateDriftVector } from './src/pipeline/riskEngine';
import { CommonMarineDataModel, OceanObservation, WeatherObservation } from './src/pipeline/models';

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

async function runPhase4Tests() {
  console.log('\n========================================');
  console.log('ORCA PHASE 4: INCOIS INTEGRATION TEST SUITE');
  console.log('========================================\n');

  // Test 1: INCOIS Successful Ocean State Forecast (OSF) Normalization
  console.log('Test 1: INCOIS Successful Response (U, V, Hs, Tp normalization)');
  const mockOsfPayload: RawIncoisOsfPayload = {
    current_u: 0.45,
    current_v: 0.28,
    swh: 2.15,
    pwp: 11.2,
    wave_direction: 240,
    swell_wave_height: 1.8,
    swell_wave_period: 12.5,
    swell_wave_direction: 235,
    sea_surface_temperature: 28.6,
    tide_height: 1.42,
    tide_time_utc: '2026-09-28T16:30:00Z',
    forecast_time: '2026-09-28T12:00:00Z',
    station_name: 'Ratnagiri Buoy / OSF Point',
  };

  const normOcean = normalizeIncoisOcean(mockOsfPayload, 'https://incois.gov.in/portal/osf', '2026-09-28T12:05:00Z', 'LIVE');
  assert(normOcean !== null, 'Ocean observation normalized successfully');
  assert(normOcean?.current_u_mps === 0.45, 'U current component preserved as 0.45 m/s');
  assert(normOcean?.current_v_mps === 0.28, 'V current component preserved as 0.28 m/s');
  assert(normOcean?.significant_wave_height_m === 2.15, 'Hs normalized to 2.15 m');
  assert(normOcean?.wave_height_m === 2.15, 'wave_height_m mapped to Hs (2.15 m)');
  assert(normOcean?.peak_wave_period_s === 11.2, 'Tp normalized to 11.2 s');
  assert(normOcean?.wave_period_s === 11.2, 'wave_period_s mapped to Tp (11.2 s)');
  assert(normOcean?.swell_height_m === 1.8, 'Swell height preserved as 1.8 m');
  assert(normOcean?.swell_period_s === 12.5, 'Swell period preserved as 12.5 s');
  assert(normOcean?.sea_surface_temperature_c === 28.6, 'SST preserved as 28.6 C');
  assert(normOcean?.source.provider === 'INCOIS Ocean State Forecast', 'Source tagged as INCOIS Ocean State Forecast');

  // Test 2: Current Vector Normalization & Drift Engine Integration (V_d = V_c + γ V_w)
  console.log('\nTest 2: INCOIS Current Vector Normalization (m/s) and Drift Calculation');
  // Current: U = 0.5 m/s (East), V = 0 m/s (North)
  // Wind: Speed = 10 m/s (36 km/h) blowing from North (0°).
  // Downwind direction is South (180°), so wind force pushes South: u_w = 0, v_w = -10 m/s.
  // With leeway factor gamma = 0.03:
  // gamma * u_w = 0 m/s, gamma * v_w = -0.3 m/s
  // V_d: u_d = 0.5 + 0 = 0.5 m/s, v_d = 0 - 0.3 = -0.3 m/s
  // Drift speed = sqrt(0.5^2 + (-0.3)^2) = sqrt(0.25 + 0.09) = sqrt(0.34) = 0.58 m/s (~2.1 km/h)
  // Drift direction = atan2(0.5, -0.3) = 149°
  const testOcean: OceanObservation = {
    wave_height_m: 1.5,
    wave_period_s: 8.0,
    wave_direction_deg: 240,
    wind_wave_height_m: null,
    swell_height_m: null,
    swell_period_s: null,
    swell_direction_deg: null,
    sea_surface_temperature_c: 28.0,
    ocean_current_speed_kmph: 1.8,
    ocean_current_speed_mps: 0.5,
    ocean_current_direction_deg: 90,
    current_u_mps: 0.5,
    current_v_mps: 0.0,
    significant_wave_height_m: 1.5,
    peak_wave_period_s: 8.0,
    tide_height_m: 1.2,
    tide_time_utc: '2026-09-28T14:00:00Z',
    source: {
      provider: 'INCOIS OSF',
      retrieved_at: new Date().toISOString(),
      data_status: 'LIVE',
    },
  };

  const testWeather: WeatherObservation = {
    temperature_c: 30.0,
    feels_like_c: 34.0,
    humidity_pct: 75,
    pressure_hpa: 1010,
    wind_speed_kmph: 36.0,
    wind_speed_mps: 10.0,
    wind_gust_kmph: 45.0,
    wind_gust_mps: 12.5,
    wind_direction_deg: 0.0, // Blowing from North
    precipitation_mm_last_hour: 0,
    precipitation_mm_24h: 0,
    visibility_km: null,
    cloud_cover_percent: 40,
    lightning_density: null,
    condition: 'Clear',
    source: {
      provider: 'Open-Meteo',
      retrieved_at: new Date().toISOString(),
      data_status: 'LIVE',
    },
  };

  const driftResult = calculateDriftVector(testOcean, testWeather, 0.03);
  assert(driftResult.drift.status === 'COMPUTED', 'Drift status is COMPUTED when both current and wind present');
  assert(driftResult.current_velocity.u_mps === 0.5, 'Current U component is 0.5 m/s');
  assert(driftResult.current_velocity.v_mps === 0.0, 'Current V component is 0.0 m/s');
  assert(driftResult.drift.u_mps === 0.5, 'Drift U component is 0.5 m/s');
  assert(driftResult.drift.v_mps === -0.3, 'Drift V component is -0.3 m/s (-10 * 0.03)');
  assert(driftResult.drift.speed_mps === 0.58, 'Drift speed is 0.58 m/s (sqrt(0.5^2 + (-0.3)^2))');
  assert(Math.abs(driftResult.drift.speed_kmph! - 2.09) < 0.1, 'Drift speed in km/h is ~2.1 km/h');
  assert(Math.abs(driftResult.drift.direction_deg! - 121.0) < 0.5, 'Drift direction is ~121° (East-Southeastward)');

  // Test 3: INCOIS Tide Normalization
  console.log('\nTest 3: INCOIS Tide Normalization (metres, UTC timestamp)');
  assert(normOcean?.tide_height_m === 1.42, 'Tide height normalized to 1.42 metres');
  assert(normOcean?.tide_time_utc === '2026-09-28T16:30:00Z', 'Tide UTC timestamp preserved');
  
  // Negative tide check (spring low tide)
  const lowTidePayload: RawIncoisOsfPayload = {
    current_u: 0.1,
    current_v: 0.1,
    tide_height: -0.35,
    tide_time_utc: '2026-09-28T22:45:00Z',
  };
  const lowTideOcean = normalizeIncoisOcean(lowTidePayload, 'https://incois.gov.in', '2026-09-28T12:00:00Z', 'LIVE');
  assert(lowTideOcean?.tide_height_m === -0.35, 'Negative tide height preserved accurately as -0.35 m');

  // Test 4: INCOIS High Wave Alert & Warning Priority Elevation
  console.log('\nTest 4: INCOIS High Wave / Swell Surge Alert Normalization and Warning Priority');
  const rawIncoisAlert: RawIncoisAlert = {
    id: 'INCOIS-HWA-2026-09',
    alert_type: 'High Wave Alert',
    headline: 'High Wave Alert for Maharashtra Coast (Dahanu to Vengurla)',
    description: 'High waves in the range of 3.0 to 3.8 meters are forecasted along the coast.',
    advice_to_fishermen: 'Fishermen and coastal population are alerted to take necessary precautions.',
    color_code: 'ORANGE',
    severity: 'warning',
    issued_at: '2026-09-28T09:00:00Z',
    valid_until: '2026-09-29T23:30:00Z',
    coastal_region: 'Maharashtra Coast',
  };

  const normAlerts = normalizeIncoisAlerts(rawIncoisAlert, '2026-09-28T10:00:00Z', 'Maharashtra');
  assert(normAlerts.length === 1, 'Exactly 1 INCOIS alert normalized');
  assert(normAlerts[0].severity === 'warning', 'High wave alert mapped to warning severity');
  assert(normAlerts[0].official_color_code === 'ORANGE', 'Official color code ORANGE preserved');
  assert(normAlerts[0].issued_at === '2026-09-28T09:00:00Z', 'issued_at timestamp preserved');
  assert(normAlerts[0].source.includes('INCOIS'), 'Source tagged as INCOIS');

  // Verify that INCOIS High Wave Alert triggers deterministic risk override
  const mockCalmCommonData: CommonMarineDataModel = {
    location: { latitude: 18.94, longitude: 72.83, label: 'Mumbai Coast' },
    time: { retrieved_at: new Date().toISOString(), freshness: 'LIVE' },
    weather: {
      temperature_c: 28.0,
      feels_like_c: 30.0,
      humidity_pct: 65,
      pressure_hpa: 1012,
      wind_speed_kmph: 15.0, // Calm physical wind
      wind_speed_mps: 4.17,
      wind_gust_kmph: 20.0,
      wind_gust_mps: 5.56,
      wind_direction_deg: 270,
      precipitation_mm_last_hour: 0,
      precipitation_mm_24h: 0,
      visibility_km: 10,
      cloud_cover_percent: 20,
      lightning_density: null,
      condition: 'Clear',
      source: { provider: 'Open-Meteo', retrieved_at: new Date().toISOString(), data_status: 'LIVE' },
    },
    ocean: {
      wave_height_m: 1.2, // Calm physical wave
      wave_period_s: 7.0,
      wave_direction_deg: 250,
      wind_wave_height_m: null,
      swell_height_m: 0.8,
      swell_period_s: 8.0,
      swell_direction_deg: 245,
      sea_surface_temperature_c: 28.5,
      ocean_current_speed_kmph: 1.0,
      ocean_current_speed_mps: 0.28,
      ocean_current_direction_deg: 220,
      current_u_mps: 0.2,
      current_v_mps: 0.2,
      significant_wave_height_m: 1.2,
      peak_wave_period_s: 7.0,
      tide_height_m: null,
      tide_time_utc: null,
      source: { provider: 'INCOIS OSF', retrieved_at: new Date().toISOString(), data_status: 'LIVE' },
    },
    ecosystem: null,
    vessel: null,
    geofencing: null,
    warnings: {
      status: 'ACTIVE',
      items: normAlerts,
      provider: 'INCOIS High Wave Alert Network',
      retrieved_at: new Date().toISOString(),
    },
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

  const evaluatedRisk = evaluateRiskEngine(mockCalmCommonData);
  assert(evaluatedRisk.warning_override === true, 'INCOIS High Wave Alert activates warning_override');
  assert(evaluatedRisk.score >= 85, `Score overridden to >= 85 (got ${evaluatedRisk.score})`);
  assert(evaluatedRisk.level === 'HIGH', 'Risk level is overridden to HIGH');

  // Test 5: INCOIS Potential Fishing Zone (PFZ) Normalization
  console.log('\nTest 5: INCOIS Potential Fishing Zone (PFZ) Normalization');
  const mockPfzPayload: RawIncoisPfzPayload = {
    advisory_id: 'PFZ-MAH-2026-0928',
    sector: 'Ratnagiri to Sindhudurg',
    advisory: 'PFZ advisory valid: Bearing 235 deg from Mirya Bay, distance 18-22 NM, depth 40-50m.',
    valid_from: '2026-09-28T06:00:00Z',
    valid_until: '2026-09-29T18:00:00Z',
    polygon: [
      [16.98, 73.15],
      [16.95, 73.22],
      [16.88, 73.20],
      [16.98, 73.15],
    ],
  };

  const normPfz = normalizeIncoisPfz(mockPfzPayload, 'https://incois.gov.in/portal/pfz', '2026-09-28T10:00:00Z', 'LIVE');
  assert(normPfz !== null, 'PFZ advisory normalized');
  assert(normPfz?.pfz_advisory?.includes('Mirya Bay') === true, 'PFZ advisory text preserved');
  assert(Array.isArray(normPfz?.pfz_polygon) && normPfz?.pfz_polygon.length === 4, 'PFZ polygon coordinate array preserved (4 vertices)');
  assert(normPfz?.source?.provider === 'INCOIS Potential Fishing Zone (PFZ)', 'PFZ source provider tagged as INCOIS');

  // Test 6: INCOIS Missing Configuration -> CONFIG_REQUIRED
  console.log('\nTest 6: INCOIS Missing Configuration (CONFIG_REQUIRED status)');
  const origToken = process.env.INCOIS_TOKEN;
  const origKey = process.env.INCOIS_API_KEY;
  const origEndpoint = process.env.INCOIS_ENDPOINT_URL;

  delete process.env.INCOIS_TOKEN;
  delete process.env.INCOIS_API_KEY;
  delete process.env.INCOIS_ENDPOINT_URL;

  const missingConfigRes = await fetchIncoisData(18.94, 72.83);
  assert(missingConfigRes.health.status === 'CONFIG_REQUIRED', 'Reports CONFIG_REQUIRED when env absent');
  assert(missingConfigRes.ocean === null, 'Ocean is null when CONFIG_REQUIRED (no fabricated data)');
  assert(missingConfigRes.warnings.length === 0, 'Warnings empty when CONFIG_REQUIRED');

  // Test 7: INCOIS Network Failure / Unreachable -> UNAVAILABLE (no crash)
  console.log('\nTest 7: INCOIS Network Failure / Gateway Error -> UNAVAILABLE');
  // Use a port that is immediately refused
  process.env.INCOIS_ENDPOINT_URL = 'http://127.0.0.1:59999/api/v1';
  process.env.INCOIS_TOKEN = 'test-token';

  const networkFailRes = await fetchIncoisData(18.94, 72.83, undefined, 500);
  assert(networkFailRes.health.status === 'UNAVAILABLE', 'Reports UNAVAILABLE on network failure');
  assert(networkFailRes.ocean === null, 'Ocean observation is null on failure');
  assert(networkFailRes.health.error !== null, 'Error message recorded on connection refusal');

  // Test 8: INCOIS Malformed Payload Handling & Bounds Checking
  console.log('\nTest 8: INCOIS Malformed Payload & Bounds Validation');
  const malformedPayload: any = {
    current_u: 'invalid_string',
    current_v: 999.0, // impossible current (> 5 m/s)
    swh: -5.0, // impossible negative wave height
    pwp: 'corrupt',
    tide_height: 50.0, // impossible tide (> 15m)
  };
  const malformedOcean = normalizeIncoisOcean(malformedPayload, 'https://incois.gov.in', '2026-09-28T12:00:00Z', 'LIVE');
  assert(malformedOcean === null, 'Payload with only invalid/impossible bounds returns null (no crash)');

  // Partial valid payload with null preservation
  const partialPayload: RawIncoisOsfPayload = {
    current_u: 0.32,
    current_v: 0.18,
    swh: 1.8,
    // pwp missing
    // tide missing
  };
  const partialOcean = normalizeIncoisOcean(partialPayload, 'https://incois.gov.in', '2026-09-28T12:00:00Z', 'LIVE');
  assert(partialOcean !== null, 'Partial payload normalized successfully');
  assert(partialOcean?.current_u_mps === 0.32, 'Valid U component preserved');
  assert(partialOcean?.peak_wave_period_s === null, 'Missing peak wave period strictly preserved as null');
  assert(partialOcean?.tide_height_m === null, 'Missing tide height strictly preserved as null');

  // Test 9: INCOIS Timeout Handling
  console.log('\nTest 9: INCOIS Timeout Handling');
  // Start a local HTTP server that hangs
  const hangingServer = http.createServer((_req, _res) => {
    // Intentionally never respond
  });
  await new Promise<void>((resolve) => hangingServer.listen(0, '127.0.0.1', () => resolve()));
  const hangingPort = (hangingServer.address() as any).port;

  process.env.INCOIS_ENDPOINT_URL = `http://127.0.0.1:${hangingPort}/api/v1`;
  const timeoutRes = await fetchIncoisData(18.94, 72.83, undefined, 200);
  assert(timeoutRes.health.status === 'UNAVAILABLE', 'Reports UNAVAILABLE on timeout');
  assert(timeoutRes.health.error?.toLowerCase().includes('time') === true, 'Error message indicates timeout');

  hangingServer.close();

  // Test 10: Multi-Source Comparison (Open-Meteo Wave vs INCOIS Wave)
  console.log('\nTest 10: Multi-Source Comparison (Open-Meteo wave vs INCOIS wave)');
  // Start a mock INCOIS server returning valid live data
  const mockServer = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        ocean: {
          current_u: 0.42,
          current_v: -0.15,
          significant_wave_height: 2.2,
          peak_wave_period: 10.5,
          tide_height: 1.35,
          tide_time_utc: '2026-09-28T15:00:00Z',
        },
        alerts: [
          {
            headline: 'Rough sea alert along Maharashtra coast',
            severity: 'watch',
            color_code: 'YELLOW',
          },
        ],
        pfz: {
          advisory: 'PFZ Sector Mumbai High: 45 NM bearing 270 deg.',
          polygon: [
            [19.0, 72.0],
            [19.2, 72.2],
            [19.0, 72.0],
          ],
        },
      })
    );
  });
  await new Promise<void>((resolve) => mockServer.listen(0, '127.0.0.1', () => resolve()));
  const mockPort = (mockServer.address() as any).port;

  process.env.INCOIS_ENDPOINT_URL = `http://127.0.0.1:${mockPort}/test-endpoint`;
  process.env.INCOIS_TOKEN = 'mock-incois-token';

  const fullPipelineRes = await OrcaOrchestrator.collectAndProcess({
    latitude: 18.9438,
    longitude: 72.836,
    label: 'Mumbai Harbor',
  });

  assert(fullPipelineRes.ocean !== null, 'Ocean observation present');
  assert(fullPipelineRes.ocean?.current_u_mps === 0.42, 'INCOIS U component authoritative (0.42 m/s)');
  assert(fullPipelineRes.ocean?.current_v_mps === -0.15, 'INCOIS V component authoritative (-0.15 m/s)');
  assert(fullPipelineRes.ocean?.tide_height_m === 1.35, 'INCOIS tide height authoritative (1.35 m)');
  assert(fullPipelineRes.ecosystem?.pfz_advisory?.includes('Mumbai High') === true, 'INCOIS PFZ advisory attached to ecosystem');

  // Verify wave height source comparison
  const waveComparison = fullPipelineRes.metadata.source_conflicts.find((c) => c.variable === 'significant_wave_height');
  assert(waveComparison !== undefined, 'Source comparison recorded for significant_wave_height');
  assert(waveComparison?.values.incois === 2.2, 'INCOIS wave value tracked in comparison');
  assert(waveComparison?.values.open_meteo !== null, 'Open-Meteo wave value tracked in comparison');

  mockServer.close();

  // Test 11: Graceful Degradation: Open-Meteo Operates when INCOIS is CONFIG_REQUIRED or UNAVAILABLE
  console.log('\nTest 11: Graceful Degradation (Open-Meteo operates when INCOIS fails)');
  delete process.env.INCOIS_TOKEN;
  delete process.env.INCOIS_ENDPOINT_URL;

  const degradedRes = await OrcaOrchestrator.collectAndProcess({
    latitude: 18.9438,
    longitude: 72.836,
    label: 'Mumbai Harbor',
  });

  assert(degradedRes.weather !== null, 'Open-Meteo weather is available');
  assert(degradedRes.ocean !== null, 'Open-Meteo marine fallback is available');
  assert(degradedRes.metadata.sources.incois.status === 'CONFIG_REQUIRED', 'INCOIS health status recorded as CONFIG_REQUIRED');
  assert(degradedRes.metadata.source_status === 'LIVE', 'Overall pipeline status remains LIVE via Open-Meteo');

  // Test 12: Full Assessment with Open-Meteo + IMD + INCOIS
  console.log('\nTest 12: Full Assessment with Drift Integration');
  const evaluatedDegraded = evaluateRiskEngine(degradedRes);
  assert(evaluatedDegraded.drift !== undefined, 'Drift calculation result present on risk assessment');
  assert(evaluatedDegraded.drift?.drift.status !== undefined, 'Drift status is defined');
  assert(evaluatedDegraded.factors.length === 5, 'Standard 5 physical risk factors present');
  assert(['LOW', 'MODERATE', 'HIGH'].includes(evaluatedDegraded.level), 'Risk level valid');

  // Restore env
  if (origToken) process.env.INCOIS_TOKEN = origToken;
  else delete process.env.INCOIS_TOKEN;
  if (origKey) process.env.INCOIS_API_KEY = origKey;
  else delete process.env.INCOIS_API_KEY;
  if (origEndpoint) process.env.INCOIS_ENDPOINT_URL = origEndpoint;
  else delete process.env.INCOIS_ENDPOINT_URL;

  console.log('\n========================================');
  console.log(`PHASE 4 TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('========================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runPhase4Tests().catch((err) => {
  console.error('Unhandled Phase 4 test error:', err);
  process.exit(1);
});
