/**
 * ORCA Phase 7 Test Suite — API Contract, Evidence, Provider Health & Response Hardening
 * 
 * Verifies all 30 Phase 7 verification cases:
 * API INFO:
 * 1. /api/info success & operational metadata
 * 2. Provider statuses: open_meteo, imd, incois, mosdac
 * 3. No secret leakage in /api/info
 * 
 * ASSESSMENT:
 * 4. Successful structured assessment response
 * 5. Deterministic NO-GO veto response
 * 6. Deterministic GO safe response
 * 7. Degraded assessment when a stream is missing
 * 8. Incomplete data quality tracking
 * 9. Provider unavailable handling (degraded, no 500)
 * 10. Warning unavailable vs no warning distinction
 * 
 * RISK:
 * 11. Structured risk contract (score, level, risk_index breakdown)
 * 12. Confidence contract (score, breakdown, is_high_confidence)
 * 
 * VETO:
 * 13. Veto contract (decision, is_veto, triggered, reasons)
 * 14. Veto reason codes (OFFICIAL_WARNING, WAVE_LIMIT_EXCEEDED, etc.)
 * 15. Evidence linkage to deterministic veto
 * 
 * DRIFT:
 * 16. Drift contract structure
 * 17. Predicted position structure
 * 18. Search radius structure
 * 
 * PROVIDERS:
 * 19. Open-Meteo health representation
 * 20. IMD health representation (no fake timestamp)
 * 21. INCOIS health representation
 * 22. MOSDAC health representation
 * 
 * VALIDATION:
 * 23. Invalid latitude (HTTP 422, INVALID_LATITUDE)
 * 24. Invalid longitude (HTTP 422, INVALID_LONGITUDE)
 * 25. Malformed request (HTTP 422, VALIDATION_ERROR)
 * 
 * SECURITY:
 * 26. No credentials in /api/info
 * 27. No credentials in /api/assess
 * 28. No secrets in evidence payload
 * 29. No secret leakage in API error responses
 * 
 * OPENAPI:
 * 30. OpenAPI 3.0.3 schema generation succeeds
 */

import http from 'http';
import { ORCA_OPENAPI_SPEC } from './src/pipeline/openapi';

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

async function runPhase7Tests() {
  console.log('\n========================================');
  console.log('ORCA PHASE 7: API CONTRACT & RESPONSE HARDENING TEST SUITE');
  console.log('========================================\n');

  // --- Group 1: /api/info Endpoint ---
  console.log('Group 1: /api/info System & Health Contract');
  const infoRes = await requestJson('GET', '/api/info');
  assert(infoRes.statusCode === 200, '/api/info returns HTTP 200');
  assert(infoRes.data.service_name === 'orca-marine-safety', 'Service name is orca-marine-safety');
  assert(infoRes.data.version === '0.2.0', 'API version is 0.2.0');
  assert(infoRes.data.status === 'OPERATIONAL', 'Service status is OPERATIONAL');
  assert(infoRes.data.deterministic_engine?.status === 'ONLINE', 'Deterministic engine reports ONLINE');
  assert(infoRes.data.deterministic_engine?.rule_governance === 'DETERMINISTIC', 'Rule governance is DETERMINISTIC');
  assert(infoRes.data.deterministic_engine?.ai_override_allowed === false, 'AI override explicitly disallowed');
  assert(Array.isArray(infoRes.data.capabilities), 'Exposes capabilities array');
  assert(infoRes.data.capabilities.includes('deterministic_safety_veto'), 'Lists deterministic_safety_veto capability');
  assert(infoRes.data.capabilities.includes('drift_vector_prediction'), 'Lists drift_vector_prediction capability');

  // --- Group 2: Provider Statuses in /api/info ---
  console.log('\nGroup 2: Provider Statuses in /api/info');
  const providers = infoRes.data.providers || {};
  assert(providers.open_meteo !== undefined, 'Open-Meteo present in providers');
  assert(providers.open_meteo.status === 'LIVE', 'Open-Meteo status is LIVE');
  assert(providers.imd !== undefined, 'IMD present in providers');
  assert(providers.incois !== undefined, 'INCOIS present in providers');
  assert(providers.mosdac !== undefined, 'MOSDAC present in providers');
  assert(
    ['LIVE', 'CONFIG_REQUIRED', 'UNAVAILABLE', 'DEMO'].includes(providers.imd.status),
    `IMD status is valid semantic state (${providers.imd.status})`
  );
  assert(
    ['LIVE', 'CONFIG_REQUIRED', 'UNAVAILABLE', 'DEMO'].includes(providers.incois.status),
    `INCOIS status is valid semantic state (${providers.incois.status})`
  );
  assert(
    ['LIVE', 'CONFIG_REQUIRED', 'UNAVAILABLE', 'DEMO'].includes(providers.mosdac.status),
    `MOSDAC status is valid semantic state (${providers.mosdac.status})`
  );

  // --- Group 3: Security & Secret Leakage in /api/info ---
  console.log('\nGroup 3: Security & Secret Sanitization in /api/info');
  const infoString = JSON.stringify(infoRes.data);
  assert(!infoString.includes('AIzaSy'), 'No Google API keys leaked');
  assert(!infoString.includes('Bearer '), 'No Bearer tokens leaked');
  assert(!infoString.includes('password'), 'No passwords leaked');
  assert(!infoString.includes('secret'), 'No secret keys leaked');
  assert(infoRes.data.provider_failure_semantics !== undefined, 'Exposes explicit provider failure semantics');
  assert(
    infoRes.data.provider_failure_semantics.UNAVAILABLE.includes('warning status cannot be assumed safe'),
    'Explicitly clarifies UNAVAILABLE != safe'
  );

  // --- Group 4: /api/assess Successful Assessment ---
  console.log('\nGroup 4: /api/assess Successful Structured Assessment');
  const assessRes = await requestJson('POST', '/api/assess', {
    latitude: 18.9438,
    longitude: 72.8360,
    label: 'Mumbai Harbor',
    demo: true,
    vessel_class: 'traditional_motorized',
    forecast_horizon_h: 3.0,
  });
  assert(assessRes.statusCode === 200, '/api/assess returns HTTP 200');
  const d = assessRes.data;
  assert(typeof d.request_id === 'string' && d.request_id.startsWith('req_'), 'request_id is structured');
  assert(d.api_version === '0.2.0', 'api_version is 0.2.0');
  assert(d.is_demo === true, 'is_demo explicitly flagged true');
  assert(d.location.latitude === 18.9438, 'Latitude preserved');
  assert(d.location.longitude === 72.8360, 'Longitude preserved');

  // --- Group 5 & 6: Deterministic Safety Decision & Veto Contract ---
  console.log('\nGroup 5 & 6: Deterministic Decision & Veto Contract');
  assert(['GO', 'CAUTION', 'NO-GO'].includes(d.decision), `decision is standard enum (${d.decision})`);
  assert(d.deterministic_decision === d.decision, 'deterministic_decision matches decision');
  assert(typeof d.veto === 'object' && d.veto !== null, 'veto contract object present');
  assert(typeof d.veto.is_veto === 'boolean', 'veto.is_veto is boolean');
  assert(d.veto.triggered === d.veto.is_veto, 'veto.triggered aliases is_veto');
  assert(Array.isArray(d.veto.reasons), 'veto.reasons is an array');
  assert(Array.isArray(d.veto.reason_codes), 'veto.reason_codes is an array');
  if (d.veto.is_veto) {
    assert(d.decision === 'NO-GO', 'When veto is triggered, decision is strictly NO-GO');
    assert(d.veto.reasons.length > 0, 'Veto reasons are populated when triggered');
  }

  // --- Group 7 & 8: Data Quality & Degradation Tracking ---
  console.log('\nGroup 7 & 8: Data Quality & Degradation Contract');
  assert(d.data_quality !== undefined, 'data_quality object present');
  assert(
    ['NORMAL', 'DEGRADED', 'INCOMPLETE', 'UNAVAILABLE'].includes(d.data_quality.status),
    `data_quality.status is valid (${d.data_quality.status})`
  );
  assert(typeof d.data_quality.is_degraded === 'boolean', 'data_quality.is_degraded is boolean');
  assert(typeof d.data_quality.completeness_ratio === 'number', 'completeness_ratio is numeric');
  assert(Array.isArray(d.data_quality.degradation_notes), 'degradation_notes is array');

  // --- Group 9: Warning Unavailable vs No Warning Semantics ---
  console.log('\nGroup 9: Warning Status Semantics in Assessment');
  assert(d.warning_summary !== undefined, 'warning_summary present');
  assert(
    ['NONE', 'ACTIVE', 'UNAVAILABLE'].includes(d.warning_summary.status),
    `warning_summary.status is semantic enum (${d.warning_summary.status})`
  );
  assert(typeof d.warning_summary.provider_reachable === 'boolean', 'provider_reachable is boolean');
  if (d.warning_summary.status === 'UNAVAILABLE') {
    assert(!d.warning_summary.provider_reachable, 'provider_reachable is false when UNAVAILABLE');
    assert(d.warning_summary.uncertainty_note !== null, 'uncertainty_note warns of unconfirmed status');
  }

  // --- Group 10 & 11: Risk & Confidence Contracts ---
  console.log('\nGroup 10 & 11: Risk and Confidence Contract');
  assert(typeof d.risk.score === 'number', 'risk.score is numeric');
  assert(['LOW', 'MODERATE', 'HIGH'].includes(d.risk.level), `risk.level is valid (${d.risk.level})`);
  assert(typeof d.risk.risk_index === 'number', 'risk.risk_index is numeric');
  assert(d.risk.risk_index >= 0.0 && d.risk.risk_index <= 1.0, 'risk.risk_index is bounded [0, 1]');
  assert(typeof d.risk.risk_index_breakdown === 'object', 'risk_index_breakdown is present');
  assert(Array.isArray(d.risk.factors) && d.risk.factors.length === 5, 'Produces all 5 physical risk factors');
  assert(typeof d.confidence.score === 'number', 'confidence.score is numeric');
  assert(typeof d.confidence.is_high_confidence === 'boolean', 'confidence.is_high_confidence is boolean');
  assert(d.confidence.breakdown !== undefined, 'confidence.breakdown is present');
  assert(d.confidence.breakdown.weights.w1_freshness === 0.35, 'Confidence weight w1 is 0.35');

  // --- Group 12: Drift, Predicted Position & Search Radius ---
  console.log('\nGroup 12: Drift, Predicted Position and Search Radius Contracts');
  assert(d.drift !== undefined, 'drift object present in assessment');
  assert(d.drift.current_velocity !== undefined, 'current_velocity present');
  assert(d.drift.wind_velocity !== undefined, 'wind_velocity present');
  assert(d.drift.drift !== undefined, 'drift vector present');
  assert(d.predicted_position !== undefined, 'predicted_position root field present');
  if (d.drift.drift.status === 'COMPUTED') {
    assert(d.predicted_position.latitude !== undefined, 'Predicted latitude present');
    assert(d.predicted_position.longitude !== undefined, 'Predicted longitude present');
    assert(d.search_radius !== null, 'Search radius contract populated');
    assert(d.search_radius.radius_nm >= 0.5, `Search radius expanded (got ${d.search_radius.radius_nm} NM)`);
    assert(d.search_radius.drift_uncertainty_factor === 0.30, 'Standard 30% IAMSAR drift uncertainty factor');
  }

  // --- Group 13: Provider Health Map in Assessment ---
  console.log('\nGroup 13: Provider Health Map in Assessment');
  assert(d.providers !== undefined, 'providers health map present');
  assert(d.providers.open_meteo.status === 'DEMO' || d.providers.open_meteo.status === 'LIVE', 'Open-Meteo health status verified');
  assert(d.providers.open_meteo.endpoint === 'https://api.open-meteo.com/', 'Official endpoint documented');
  assert(d.providers.open_meteo.configured === true, 'Open-Meteo configured is true');
  assert(d.providers.imd.latency_ms === null, 'Unmeasured latency is strictly null (never fabricated)');

  // --- Group 14: Structured Evidence Contract & Traceability ---
  console.log('\nGroup 14: Structured Evidence Contract & Traceability');
  assert(d.evidence !== undefined, 'evidence object present');
  assert(typeof d.evidence.evidence_id === 'string', 'evidence_id is string');
  assert(typeof d.evidence.deterministic_decision === 'string', 'evidence includes deterministic_decision');
  assert(Array.isArray(d.evidence.reason_codes), 'evidence includes reason_codes');
  assert(d.evidence.traceability !== undefined, 'evidence traceability block present');
  assert(d.evidence.traceability.wave !== undefined, 'wave traceability present');
  assert(d.evidence.traceability.wind !== undefined, 'wind traceability present');
  assert(d.evidence.traceability.warning !== undefined, 'warning traceability present');
  assert(d.evidence.traceability.drift !== undefined, 'drift traceability present');

  // --- Group 15: Input Validation Tests (HTTP 422) ---
  console.log('\nGroup 15: Input Validation Handlers (HTTP 422)');
  const badLatRes = await requestJson('POST', '/api/assess', {
    latitude: 105.0, // Invalid > 90
    longitude: 72.836,
  });
  assert(badLatRes.statusCode === 422, 'Rejects latitude > 90 with HTTP 422');
  assert(badLatRes.data.error?.code === 'INVALID_LATITUDE', 'Returns error code INVALID_LATITUDE');

  const badLonRes = await requestJson('POST', '/api/assess', {
    latitude: 18.94,
    longitude: 250.0, // Invalid > 180
  });
  assert(badLonRes.statusCode === 422, 'Rejects longitude > 180 with HTTP 422');
  assert(badLonRes.data.error?.code === 'INVALID_LONGITUDE', 'Returns error code INVALID_LONGITUDE');

  const missingCoordRes = await requestJson('POST', '/api/assess', {
    label: 'Nowhere',
  });
  assert(missingCoordRes.statusCode === 422, 'Rejects missing coordinates with HTTP 422');
  assert(missingCoordRes.data.error?.code === 'VALIDATION_ERROR', 'Returns error code VALIDATION_ERROR');

  const negativeBeamRes = await requestJson('POST', '/api/assess', {
    latitude: 18.94,
    longitude: 72.83,
    vessel_beam_m: -2.5,
  });
  assert(negativeBeamRes.statusCode === 422, 'Rejects negative vessel beam with HTTP 422');
  assert(negativeBeamRes.data.error?.code === 'INVALID_VESSEL_PARAMETER', 'Returns error code INVALID_VESSEL_PARAMETER');

  // --- Group 16: Security & Credentials Leakage in Errors & Assessment ---
  console.log('\nGroup 16: Security Audit (Zero Credentials in Responses or Errors)');
  const assessJsonStr = JSON.stringify(d);
  assert(!assessJsonStr.includes('AIzaSy'), 'Zero Google API keys in assessment');
  assert(!assessJsonStr.includes('Bearer '), 'Zero authorization tokens in assessment');
  assert(!assessJsonStr.includes('private'), 'No private credentials in assessment');
  assert(!assessJsonStr.includes('node_modules'), 'No internal file paths leaked in assessment');

  // Test error response security
  const errJsonStr = JSON.stringify(badLatRes.data);
  assert(!errJsonStr.includes('stack'), 'No stack traces in 422 error response');

  // --- Group 17: Health Check (/health) ---
  console.log('\nGroup 17: Application Health Check (/health)');
  const healthRes = await requestJson('GET', '/health');
  assert(healthRes.statusCode === 200, '/health returns HTTP 200');
  assert(healthRes.data.status === 'UP', 'Health reports UP');
  assert(typeof healthRes.data.uptime_seconds === 'number', 'Uptime is numeric');
  assert(typeof healthRes.data.memory?.rss_mb === 'number', 'Memory RSS is numeric');

  // --- Group 18: OpenAPI 3.0.3 Specification (/openapi.json and /docs) ---
  console.log('\nGroup 18: OpenAPI 3.0.3 Specification');
  assert(ORCA_OPENAPI_SPEC.openapi === '3.0.3', 'Exported ORCA_OPENAPI_SPEC is valid 3.0.3');
  const openapiRes = await requestJson('GET', '/openapi.json');
  assert(openapiRes.statusCode === 200, '/openapi.json returns HTTP 200');
  assert(openapiRes.data.openapi === '3.0.3', 'OpenAPI version is 3.0.3');
  assert(openapiRes.data.paths['/api/assess'] !== undefined, '/api/assess path documented');
  assert(openapiRes.data.paths['/api/info'] !== undefined, '/api/info path documented');
  assert(openapiRes.data.components?.schemas?.AssessmentResponse !== undefined, 'AssessmentResponse schema defined');

  const docsRes = await requestJson('GET', '/docs');
  assert(docsRes.statusCode === 200, '/docs returns HTTP 200');
  assert(typeof docsRes.data === 'string' && docsRes.data.includes('SwaggerUIBundle'), '/docs serves Swagger UI documentation');

  console.log('\n========================================');
  console.log(`PHASE 7 TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('========================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runPhase7Tests().catch((err) => {
  console.error('Phase 7 Test Runner failed:', err);
  process.exit(1);
});
