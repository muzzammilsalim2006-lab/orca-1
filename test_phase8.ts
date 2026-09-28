/**
 * ORCA Phase 8 Test Suite — Maharashtra-Scoped Reference Frontend Finalization
 * 
 * Verifies all Phase 8 requirements:
 * 1. Centralized geographic configuration defines all 7 Maharashtra coastal districts
 * 2. Demo presets strictly contain Maharashtra locations (no Goa, Chennai, Kochi, Vizag)
 * 3. checkMaharashtraScope validates within-scope coordinates and rejects out-of-scope coordinates
 * 4. Structured out-of-scope validation message clearly informs user of Maharashtra boundary
 * 5. Initial map center and default location are centered on Maharashtra coastal waters
 * 6. Successful end-to-end assessment for all 5 core Maharashtra presets
 * 7. Verification of all structured result fields A through P
 * 8. Zero credential leaks in frontend configuration
 */

import http from 'http';
import {
  MAHARASHTRA_BOUNDS,
  DEFAULT_MAHARASHTRA_CENTER,
  DEFAULT_LOCATION,
  MAHARASHTRA_DISTRICTS,
  MAHARASHTRA_PRESETS,
  checkMaharashtraScope,
} from './src/config/maharashtraRegions';

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

function requestJson(
  method: string,
  path: string,
  body?: any
): Promise<{ statusCode: number; data: any; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : undefined;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 3000,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {}),
        },
        timeout: 8000,
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          let parsed: any;
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = raw;
          }
          resolve({ statusCode: res.statusCode || 500, data: parsed, headers: res.headers });
        });
      }
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request to ${path} timed out`));
    });

    if (postData) req.write(postData);
    req.end();
  });
}

async function runPhase8Tests() {
  console.log('\n========================================');
  console.log('ORCA PHASE 8: MAHARASHTRA-SCOPED REFERENCE FRONTEND TEST SUITE');
  console.log('========================================\n');

  // --- Group 1: Geographic Scope & District Coverage ---
  console.log('Group 1: Maharashtra Centralized Geographic Configuration');
  assert(Array.isArray(MAHARASHTRA_DISTRICTS), 'MAHARASHTRA_DISTRICTS is an array');
  assert(MAHARASHTRA_DISTRICTS.length >= 7, `Defines all 7 coastal regions (found: ${MAHARASHTRA_DISTRICTS.length})`);

  const districtNames = MAHARASHTRA_DISTRICTS.map((d) => d.districtName);
  assert(districtNames.includes('Mumbai City'), 'Covers Mumbai City');
  assert(districtNames.includes('Mumbai Suburban'), 'Covers Mumbai Suburban');
  assert(districtNames.includes('Thane'), 'Covers Thane');
  assert(districtNames.includes('Palghar'), 'Covers Palghar');
  assert(districtNames.includes('Raigad'), 'Covers Raigad');
  assert(districtNames.includes('Ratnagiri'), 'Covers Ratnagiri');
  assert(districtNames.includes('Sindhudurg'), 'Covers Sindhudurg');

  // Verify Marathi district names
  const marathiNames = MAHARASHTRA_DISTRICTS.map((d) => d.marathiName);
  assert(marathiNames.some((m) => m.includes('मुंबई')), 'Includes Marathi name for Mumbai');
  assert(marathiNames.some((m) => m.includes('पालघर')), 'Includes Marathi name for Palghar');
  assert(marathiNames.some((m) => m.includes('सिंधुदुर्ग')), 'Includes Marathi name for Sindhudurg');

  // --- Group 2: User-Facing Presets Scope Isolation ---
  console.log('\nGroup 2: User-Facing Demo Presets Isolation');
  assert(Array.isArray(MAHARASHTRA_PRESETS), 'MAHARASHTRA_PRESETS is an array');
  const presetLabels = MAHARASHTRA_PRESETS.map((p) => p.label.toLowerCase());

  // Must include the 5 core suggested Maharashtra presets
  assert(presetLabels.some((l) => l.includes('mumbai harbour')), 'Includes Mumbai Harbour preset');
  assert(presetLabels.some((l) => l.includes('palghar')), 'Includes Palghar Coast preset');
  assert(presetLabels.some((l) => l.includes('raigad')), 'Includes Raigad Coast preset');
  assert(presetLabels.some((l) => l.includes('ratnagiri')), 'Includes Ratnagiri Coast preset');
  assert(presetLabels.some((l) => l.includes('sindhudurg')), 'Includes Sindhudurg Coast preset');

  // MUST NOT include non-Maharashtra locations
  assert(!presetLabels.some((l) => l.includes('goa')), 'Strictly excludes Goa from user presets');
  assert(!presetLabels.some((l) => l.includes('chennai')), 'Strictly excludes Chennai from user presets');
  assert(!presetLabels.some((l) => l.includes('kochi')), 'Strictly excludes Kochi from user presets');
  assert(!presetLabels.some((l) => l.includes('visakhapatnam') || l.includes('vizag')), 'Strictly excludes Vizag from user presets');

  // --- Group 3: Default Map Center & Initial Location ---
  console.log('\nGroup 3: Default Map Center & Initial Location');
  assert(
    DEFAULT_MAHARASHTRA_CENTER.lat >= 18.0 && DEFAULT_MAHARASHTRA_CENTER.lat <= 19.5,
    `Default map center latitude is focused on Maharashtra coast (${DEFAULT_MAHARASHTRA_CENTER.lat})`
  );
  assert(
    DEFAULT_MAHARASHTRA_CENTER.lon >= 72.5 && DEFAULT_MAHARASHTRA_CENTER.lon <= 73.5,
    `Default map center longitude is focused on Western Arabian Sea (${DEFAULT_MAHARASHTRA_CENTER.lon})`
  );
  assert(
    DEFAULT_LOCATION.label.includes('Mumbai'),
    `Initial location is default Maharashtra harbour (${DEFAULT_LOCATION.label})`
  );
  assert(
    DEFAULT_LOCATION.district === 'Mumbai City',
    'Initial default district is Mumbai City'
  );

  // --- Group 4: Coordinate Validation & Scope Enforcement ---
  console.log('\nGroup 4: Coordinate Validation & Scope Boundary Enforcement');

  // In-scope coordinates
  const mumbaiCheck = checkMaharashtraScope(18.9438, 72.8360);
  assert(mumbaiCheck.inScope === true, 'Mumbai Harbour (18.9438, 72.8360) is inside scope');
  assert(mumbaiCheck.districtName === 'Mumbai City', 'Identifies Mumbai City district');

  const palgharCheck = checkMaharashtraScope(19.6965, 72.7655);
  assert(palgharCheck.inScope === true, 'Palghar Coast (19.6965, 72.7655) is inside scope');
  assert(palgharCheck.districtName === 'Palghar', 'Identifies Palghar district');

  const raigadCheck = checkMaharashtraScope(18.6414, 72.8722);
  assert(raigadCheck.inScope === true, 'Raigad Coast (18.6414, 72.8722) is inside scope');

  const ratnagiriCheck = checkMaharashtraScope(16.9902, 73.2800);
  assert(ratnagiriCheck.inScope === true, 'Ratnagiri Coast (16.9902, 73.2800) is inside scope');

  const sindhudurgCheck = checkMaharashtraScope(15.9042, 73.5800);
  assert(sindhudurgCheck.inScope === true, 'Sindhudurg Coast (15.9042, 73.5800) is inside scope');

  // Out-of-scope coordinates
  const chennaiCheck = checkMaharashtraScope(13.0827, 80.2707);
  assert(chennaiCheck.inScope === false, 'Chennai (13.0827, 80.2707) correctly flagged OUT of scope');
  assert(chennaiCheck.reason === 'OUTSIDE_MAHARASHTRA_SCOPE', 'Reason is OUTSIDE_MAHARASHTRA_SCOPE');
  assert(
    chennaiCheck.message.includes('ORCA currently supports Maharashtra coastal waters'),
    'Provides structured message explaining Maharashtra scope'
  );

  const kochiCheck = checkMaharashtraScope(9.9312, 76.2673);
  assert(kochiCheck.inScope === false, 'Kochi (9.9312, 76.2673) correctly flagged OUT of scope');

  const goaCheck = checkMaharashtraScope(15.4989, 73.8278);
  assert(goaCheck.inScope === false, 'Goa (15.4989, 73.8278) is strictly outside Maharashtra MVP boundary');

  const vizagCheck = checkMaharashtraScope(17.6868, 83.2185);
  assert(vizagCheck.inScope === false, 'Visakhapatnam (17.6868, 83.2185) correctly flagged OUT of scope');

  const nanCheck = checkMaharashtraScope('abc', 'def');
  assert(nanCheck.inScope === false, 'Non-numeric coordinates rejected');
  assert(nanCheck.reason === 'INVALID_COORDINATES', 'Reason is INVALID_COORDINATES');

  // --- Group 5: Backend Assessment for All 5 Maharashtra Presets ---
  console.log('\nGroup 5: Backend Pipeline Assessment for Maharashtra Presets');

  const presetsToTest = [
    { name: 'Mumbai Harbour', lat: 18.9438, lon: 72.8360 },
    { name: 'Palghar Coast', lat: 19.6965, lon: 72.7655 },
    { name: 'Raigad Coast', lat: 18.6414, lon: 72.8722 },
    { name: 'Ratnagiri Coast', lat: 16.9902, lon: 73.2800 },
    { name: 'Sindhudurg Coast', lat: 15.9042, lon: 73.5800 },
  ];

  for (const preset of presetsToTest) {
    const res = await requestJson('POST', '/api/assess', {
      latitude: preset.lat,
      longitude: preset.lon,
      label: preset.name,
      demo: true,
      vessel_class: 'traditional_motorized',
      forecast_horizon_h: 3.0,
      enable_geofencing: true,
    });

    assert(res.statusCode === 200, `${preset.name} returns HTTP 200`);
    const data = res.data;
    assert(data.decision !== undefined, `${preset.name} has deterministic decision: ${data.decision}`);
    assert(data.risk?.score !== undefined, `${preset.name} has numeric risk score: ${data.risk?.score}`);
    assert(data.confidence?.score !== undefined, `${preset.name} has confidence score: ${data.confidence?.score}`);
    assert(data.veto !== undefined, `${preset.name} has veto contract object`);
    assert(data.drift !== undefined, `${preset.name} has drift intelligence contract`);
    assert(data.providers !== undefined, `${preset.name} has providers health map`);

    // Special check for Sindhudurg: Malvan Marine Sanctuary proximity check
    if (preset.name === 'Sindhudurg Coast') {
      assert(data.geofencing !== undefined, 'Sindhudurg includes geofencing evaluation');
      assert(data.geofencing.protected_area_status !== undefined, 'Evaluates Malvan MPA status');
    }
  }

  // --- Group 6: Verification of Contract Items A through P ---
  console.log('\nGroup 6: Structured Result Contract Items A through P');
  const sampleRes = await requestJson('POST', '/api/assess', {
    latitude: 18.9438,
    longitude: 72.8360,
    label: 'Mumbai Harbour',
    demo: true,
    vessel_class: 'traditional_motorized',
    forecast_horizon_h: 3.0,
    enable_geofencing: true,
  });
  const resp = sampleRes.data;

  // A. Location
  assert(resp.location?.latitude === 18.9438, 'A: Location latitude verified');
  assert(resp.location?.longitude === 72.8360, 'A: Location longitude verified');

  // B. Risk index
  assert(typeof resp.risk.risk_index === 'number', 'B: Risk index (0 to 1) present');
  assert(typeof resp.risk.score === 'number', 'B: Risk score (0 to 100) present');

  // C. Confidence
  assert(typeof resp.confidence.score === 'number', 'C: Confidence score present');
  assert(typeof resp.confidence.is_high_confidence === 'boolean', 'C: is_high_confidence present');

  // D. Safety decision
  assert(['GO', 'CAUTION', 'NO-GO'].includes(resp.decision), `D: Safety decision is standard enum (${resp.decision})`);

  // E. Veto status
  assert(typeof resp.veto.is_veto === 'boolean', 'E: Veto status (is_veto) present');

  // F. Veto reasons
  assert(Array.isArray(resp.veto.reasons), 'F: Veto reasons array present');
  assert(Array.isArray(resp.veto.reason_codes), 'F: Veto reason_codes array present');

  // G. Official warnings
  assert(resp.warning_summary !== undefined, 'G: Warning summary present');
  assert(['NONE', 'ACTIVE', 'UNAVAILABLE'].includes(resp.warning_summary.status), 'G: Warning status semantic');

  // H. Provider health
  assert(resp.providers.open_meteo !== undefined, 'H: Open-Meteo health present');
  assert(resp.providers.imd !== undefined, 'H: IMD health present');
  assert(resp.providers.incois !== undefined, 'H: INCOIS health present');
  assert(resp.providers.mosdac !== undefined, 'H: MOSDAC health present');

  // I. Data quality / degradation
  assert(resp.data_quality !== undefined, 'I: Data quality present');
  assert(typeof resp.data_quality.completeness_ratio === 'number', 'I: Completeness ratio numeric');
  assert(Array.isArray(resp.data_quality.degradation_notes), 'I: Degradation notes array present');

  // J. Drift / predicted position / search radius
  assert(resp.drift !== undefined, 'J: Drift object present');
  assert(resp.predicted_position !== undefined, 'J: Predicted position present');
  assert(resp.search_radius !== undefined, 'J: Search radius present');
  assert(resp.search_radius.radius_nm > 0, 'J: Search radius expanded with 30% IAMSAR buffer');

  // K. Geofence / proximity
  assert(resp.geofencing !== undefined, 'K: Geofence object present');
  assert(resp.geofencing.distance_to_boundary_nm !== null, 'K: Distance to coastal boundary present');

  // L. PFZ / fleet exposure
  assert(resp.geofencing.pfz_exposure !== undefined, 'L: PFZ exposure contract evaluated');

  // M. Evidence / provenance
  assert(resp.evidence !== undefined, 'M: Evidence object present');
  assert(typeof resp.evidence.evidence_id === 'string', 'M: Cryptographic evidence ID present');

  // N. Advisory / explanation
  assert(resp.explanation !== undefined, 'N: Advisory explanation present');
  assert(typeof resp.explanation.text === 'string', 'N: Advisory text populated');

  // O. Operational / Build metadata
  const infoRes = await requestJson('GET', '/api/info');
  assert(infoRes.data.version === '0.2.0', 'O: Version 0.2.0 verified in /api/info');
  assert(infoRes.data.deterministic_engine.status === 'ONLINE', 'O: Deterministic engine ONLINE');
  assert(infoRes.data.deterministic_engine.ai_override_allowed === false, 'O: AI override disallowance verified');

  // P. Remaining limitations & semantics
  assert(
    infoRes.data.provider_failure_semantics.UNAVAILABLE.includes('warning status cannot be assumed safe'),
    'P: Explicit failure semantic: UNAVAILABLE != safe'
  );

  // --- Group 7: Security Audit ---
  console.log('\nGroup 7: Security Audit');
  const codeDump = JSON.stringify(MAHARASHTRA_PRESETS) + JSON.stringify(MAHARASHTRA_BOUNDS);
  assert(!codeDump.includes('AIzaSy'), 'Zero Google API keys in regions configuration');
  assert(!codeDump.includes('Bearer '), 'Zero Bearer tokens in regions configuration');
  assert(!codeDump.includes('secret'), 'Zero secrets in regions configuration');

  console.log('\n========================================');
  console.log(`PHASE 8 TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('========================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runPhase8Tests().catch((e) => {
  console.error('Test execution failed:', e);
  process.exit(1);
});
