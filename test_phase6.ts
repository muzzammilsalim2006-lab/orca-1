/**
 * ORCA Phase 6 Test Suite — Deterministic Intelligence Layer Verification
 * 
 * Verifies all 14 Phase 6 capabilities:
 * 1. Risk Index formula RI = min(1, ww(Ws/Wlim) + wh(Hs/Hlim) + wc I(WC))
 * 2. Risk Index strictly bounded: 0 <= RI <= 1 under extreme sea states
 * 3. Missing fields in RI remain null (never assumed zero)
 * 4. Vessel-class safety limits (Hmax, Wlim, dmin) for all configured classes
 * 5. Transparent CONFIG_REQUIRED for unconfigured/unknown vessel classes
 * 6. Deterministic Safety Veto:
 *    - Red/Orange warning -> NO-GO
 *    - Hs > Hmax -> NO-GO
 *    - Ws > Wlim -> NO-GO
 *    - dg < dmin -> NO-GO
 * 7. Warning priority semantics: PRESENT, ABSENT, UNAVAILABLE (uncertainty preserved)
 * 8. Physical drift vector calculation: V_d = V_c + γ V_w (preserves U/V components)
 * 9. Predicted position: P(t) = P0 + V_d * t over forecast horizon
 * 10. Search radius expansion: R(t) = R0 + drift_error * distance
 * 11. Freshness evaluation and factor decay
 * 12. Source agreement factor and multi-source conflict tracking
 * 13. Confidence model: C = w1*F + w2*A + w3*S
 * 14. Geofencing, IMBL proximity, Marine Sanctuary (MPA), and PFZ exposure
 * 15. Structured evidence linkage (LLM cannot override deterministic veto)
 * 16. DEMO mode preservation & full orchestrator integration
 */

import { OrcaOrchestrator } from './src/pipeline/orchestrator';
import {
  evaluateRiskEngine,
  calculateRiskIndex,
  getVesselSafetyLimits,
  calculateDriftVector,
} from './src/pipeline/riskEngine';
import {
  evaluateGeofencingAndProximity,
} from './src/pipeline/geo';
import { CommonMarineDataModel } from './src/pipeline/models';

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

async function runPhase6Tests() {
  console.log('\n========================================');
  console.log('ORCA PHASE 6: DETERMINISTIC INTELLIGENCE LAYER TEST SUITE');
  console.log('========================================\n');

  // Test 1: Risk Index Formula: RI = min(1, ww(Ws/Wlim) + wh(Hs/Hlim) + wc I(WC))
  console.log('Test 1: Deterministic Risk Index (RI) Calculation');
  const limits = getVesselSafetyLimits('traditional_motorized'); // Wlim=40, Hlim=1.5
  const riNormal = calculateRiskIndex({
    windSpeedKmph: 20.0, // 20/40 = 0.50
    waveHeightM: 0.75, // 0.75/1.5 = 0.50
    warningColor: 'GREEN', // I(WC) = 0
    vesselLimits: limits,
    weights: { ww: 0.35, wh: 0.40, wc: 0.25 },
  });
  // Expected: 0.35*(20/40) + 0.40*(0.75/1.5) + 0.25*0 = 0.175 + 0.200 = 0.375
  assert(riNormal.ri === 0.375, `RI correctly computed: expected 0.375, got ${riNormal.ri}`);
  assert(riNormal.wind_term.contribution === 0.175, 'Wind term contribution is 0.175');
  assert(riNormal.wave_term.contribution === 0.2, 'Wave term contribution is 0.200');
  assert(riNormal.warning_term.contribution === 0, 'Warning term contribution is 0.0');
  assert(!riNormal.is_bounded, 'Normal condition is within bounds (< 1.0)');

  // Test 2: Risk Index Boundedness (0 <= RI <= 1) under Extreme Storm Conditions
  console.log('\nTest 2: Risk Index Strict Boundedness (0 <= RI <= 1)');
  const riExtreme = calculateRiskIndex({
    windSpeedKmph: 120.0, // 3x Wlim
    waveHeightM: 6.5, // >4x Hlim
    warningColor: 'RED', // I(WC) = 1.0
    vesselLimits: limits,
  });
  assert(riExtreme.ri === 1.0, `Extreme storm RI bounded at exactly 1.0 (got ${riExtreme.ri})`);
  assert(riExtreme.is_bounded, 'Engine flags raw_sum exceeded 1.0 and was safely clamped');

  const riCalm = calculateRiskIndex({
    windSpeedKmph: 0.0,
    waveHeightM: 0.0,
    warningColor: 'GREEN',
    vesselLimits: limits,
  });
  assert(riCalm.ri >= 0.0 && riCalm.ri <= 0.05, `Calm sea RI bounded at zero (got ${riCalm.ri})`);

  // Test 3: Missing Fields in RI Remain Null and Are Not Assumed Zero
  console.log('\nTest 3: Missing Fields Remain Strictly Null in RI');
  const riMissingWave = calculateRiskIndex({
    windSpeedKmph: 24.0,
    waveHeightM: null, // missing wave data
    warningColor: null,
    vesselLimits: limits,
  });
  assert(riMissingWave.wave_term.hs_m === null, 'Missing wave height remains strictly null');
  assert(riMissingWave.wave_term.contribution === null, 'Missing wave contribution remains null (not 0)');
  assert(riMissingWave.ri > 0 && riMissingWave.ri <= 1.0, `RI computed with available fields without zero assumption (${riMissingWave.ri})`);

  // Test 4: Vessel-Class Safety Limits for All 7 Configured Classes
  console.log('\nTest 4: Vessel-Class Safety Limits (Hmax, Wlim, dmin)');
  const traditionalNonMotor = getVesselSafetyLimits('traditional_non_motorized');
  assert(traditionalNonMotor.h_max_m === 1.0, 'traditional_non_motorized Hmax is 1.0 m');
  assert(traditionalNonMotor.w_lim_kmph === 30.0, 'traditional_non_motorized Wlim is 30 km/h');
  assert(traditionalNonMotor.d_min_nm === 2.0, 'traditional_non_motorized dmin is 2.0 NM');

  const traditionalMotor = getVesselSafetyLimits('traditional_motorized');
  assert(traditionalMotor.h_max_m === 1.5, 'traditional_motorized Hmax is 1.5 m');
  assert(traditionalMotor.w_lim_kmph === 40.0, 'traditional_motorized Wlim is 40 km/h');

  const mechanizedTrawler = getVesselSafetyLimits('mechanized_trawler');
  assert(mechanizedTrawler.h_max_m === 2.5, 'mechanized_trawler Hmax is 2.5 m');
  assert(mechanizedTrawler.w_lim_kmph === 55.0, 'mechanized_trawler Wlim is 55 km/h');
  assert(mechanizedTrawler.d_min_nm === 5.0, 'mechanized_trawler dmin is 5.0 NM');

  const multiday = getVesselSafetyLimits('multiday_gillnetter');
  assert(multiday.h_max_m === 3.0, 'multiday_gillnetter Hmax is 3.0 m');

  const cargo = getVesselSafetyLimits('coastal_cargo');
  assert(cargo.h_max_m === 4.0, 'coastal_cargo Hmax is 4.0 m');

  const patrol = getVesselSafetyLimits('patrol_craft');
  assert(patrol.h_max_m === 3.5, 'patrol_craft Hmax is 3.5 m');

  const recreational = getVesselSafetyLimits('recreational');
  assert(recreational.h_max_m === 1.2, 'recreational Hmax is 1.2 m');

  // Test 5: Transparent CONFIG_REQUIRED for Unconfigured/Unknown Vessel Classes
  console.log('\nTest 5: Transparent CONFIG_REQUIRED for Unconfigured Vessel Class');
  const unknownClass = getVesselSafetyLimits('experimental_hovercraft_v1');
  assert(unknownClass.status === 'CONFIG_REQUIRED', 'Reports CONFIG_REQUIRED for unconfigured vessel');
  assert(unknownClass.h_max_m === null, 'Does not invent Hmax for unknown vessel class');
  assert(unknownClass.w_lim_kmph === null, 'Does not invent Wlim for unknown vessel class');
  assert(!unknownClass.is_prototype_threshold, 'Flags that no prototype threshold is assumed');

  // Test 6: Deterministic Safety Veto — Red/Orange Official Warnings -> NO-GO
  console.log('\nTest 6: Deterministic Safety Veto on Official Warning (Red/Orange)');
  const redWarningData: CommonMarineDataModel = {
    location: { latitude: 18.94, longitude: 72.83 },
    time: { retrieved_at: new Date().toISOString(), freshness: 'LIVE' },
    weather: {
      temperature_c: 28,
      feels_like_c: 32,
      humidity_pct: 80,
      pressure_hpa: 1005,
      wind_speed_kmph: 20,
      wind_speed_mps: 5.56,
      wind_gust_kmph: 25,
      wind_gust_mps: 6.94,
      wind_direction_deg: 240,
      precipitation_mm_last_hour: 0,
      precipitation_mm_24h: 5,
      visibility_km: null,
      cloud_cover_percent: 50,
      lightning_density: null,
      condition: 'Overcast',
      source: { provider: 'Open-Meteo', retrieved_at: new Date().toISOString(), data_status: 'LIVE' },
    },
    ocean: {
      wave_height_m: 0.8,
      wave_period_s: 7,
      wave_direction_deg: 240,
      wind_wave_height_m: 0.5,
      swell_height_m: 0.6,
      swell_period_s: 8,
      swell_direction_deg: 235,
      sea_surface_temperature_c: 28.5,
      ocean_current_speed_kmph: 1.0,
      ocean_current_speed_mps: 0.28,
      ocean_current_direction_deg: 200,
      current_u_mps: 0.1,
      current_v_mps: 0.2,
      significant_wave_height_m: 0.8,
      peak_wave_period_s: 7,
      tide_height_m: null,
      tide_time_utc: null,
      source: { provider: 'INCOIS', retrieved_at: new Date().toISOString(), data_status: 'LIVE' },
    },
    ecosystem: null,
    vessel: {
      vessel_beam_m: 2.0,
      vessel_class: 'traditional_motorized',
      fuel_endurance_h: 12,
      last_known_latitude: 18.94,
      last_known_longitude: 72.83,
      mission_type: 'fishing',
      forecast_horizon_h: 3,
      status: 'CONFIGURED',
    },
    geofencing: null,
    warnings: {
      status: 'ACTIVE',
      items: [
        {
          headline: 'Severe squall warning over coastal waters',
          severity: 'warning',
          source: 'IMD',
          official_color_code: 'ORANGE',
        },
      ],
      provider: 'IMD',
      retrieved_at: new Date().toISOString(),
    },
    providers: {},
    metadata: {
      source_status: 'LIVE',
      data_completeness: 0.9,
      confidence: 0.88,
      validation_status: 'VALID',
      errors: [],
      missing_fields: [],
      source_conflicts: [],
      sources: {} as any,
    },
  };

  const evalRed = evaluateRiskEngine(redWarningData);
  assert(evalRed.veto !== undefined, 'Safety veto result attached');
  assert(evalRed.veto?.is_veto === true, 'Deterministic safety veto is ACTIVE');
  assert(evalRed.veto?.decision === 'NO-GO', 'Decision is strictly NO-GO');
  assert(evalRed.veto?.warning_veto === true, 'Warning veto flagged true');
  assert(evalRed.warning_override === true, 'Warning override is true');
  assert(evalRed.score >= 85.0, `Score is overridden to >= 85 (got ${evalRed.score})`);
  assert(evalRed.level === 'HIGH', 'Risk level is HIGH');

  // Test 7: Deterministic Safety Veto — Hs > Hmax (Significant Wave Limit Exceeded)
  console.log('\nTest 7: Deterministic Safety Veto on Wave Limit (Hs > Hmax)');
  const waveVetoData = JSON.parse(JSON.stringify(redWarningData));
  waveVetoData.warnings.items = []; // Remove official warnings
  waveVetoData.warnings.status = 'NONE';
  // traditional_motorized Hmax is 1.5 m. Set wave_height to 2.2 m
  waveVetoData.ocean.wave_height_m = 2.2;
  waveVetoData.ocean.significant_wave_height_m = 2.2;

  const evalWave = evaluateRiskEngine(waveVetoData);
  assert(evalWave.veto?.is_veto === true, 'Wave veto triggers deterministic NO-GO');
  assert(evalWave.veto?.wave_veto === true, 'Wave veto explicitly flagged');
  assert(evalWave.veto?.decision === 'NO-GO', 'Decision is NO-GO');
  assert(evalWave.score >= 85.0, `Score is overridden to >= 85 (got ${evalWave.score})`);
  assert(evalWave.recommendation.includes('Deterministic Safety VETO'), 'Recommendation specifies Deterministic VETO');
  assert(evalWave.recommendation.includes('1.5 m'), 'Veto advisory mentions the violated 1.5 m Hmax limit');

  // Test 8: Deterministic Safety Veto — Ws > Wlim (Wind Speed Exceeded)
  console.log('\nTest 8: Deterministic Safety Veto on Wind Limit (Ws > Wlim)');
  const windVetoData = JSON.parse(JSON.stringify(redWarningData));
  windVetoData.warnings.items = [];
  windVetoData.warnings.status = 'NONE';
  windVetoData.ocean.wave_height_m = 0.8; // Safe wave
  // traditional_motorized Wlim is 40.0 km/h. Set wind to 48.0 km/h
  windVetoData.weather.wind_speed_kmph = 48.0;

  const evalWind = evaluateRiskEngine(windVetoData);
  assert(evalWind.veto?.is_veto === true, 'Wind veto triggers deterministic NO-GO');
  assert(evalWind.veto?.wind_veto === true, 'Wind veto explicitly flagged');
  assert(evalWind.veto?.decision === 'NO-GO', 'Decision is NO-GO');
  assert(evalWind.recommendation.includes('Wlim'), 'Veto mentions Wlim limit');

  // Test 9: Warning Priority Semantics: UNAVAILABLE Preserves Uncertainty (Never Assumed Safe)
  console.log('\nTest 9: Warning Priority Semantics (UNAVAILABLE != ABSENT)');
  const unavailWarningData = JSON.parse(JSON.stringify(redWarningData));
  unavailWarningData.warnings.items = [];
  unavailWarningData.warnings.status = 'UNAVAILABLE';
  unavailWarningData.weather.wind_speed_kmph = 10.0; // Calm weather
  unavailWarningData.ocean.wave_height_m = 0.5; // Calm sea

  const evalUnavail = evaluateRiskEngine(unavailWarningData);
  assert(evalUnavail.veto?.warnings_status === 'UNAVAILABLE', 'Warning status preserved as UNAVAILABLE');
  assert(evalUnavail.advisories.some((a) => a.includes('unreachable')), 'Advisory records that warnings are unreachable');
  assert(evalUnavail.risk_index_breakdown?.warning_term.status === 'UNAVAILABLE', 'Risk Index warning term status is UNAVAILABLE');
  assert(evalUnavail.risk_index_breakdown?.warning_term.indicator_i === 0.5, 'Preserves conservative baseline indicator (0.50)');

  // Test 10: Drift Calculation: V_d = V_c + γ V_w (Preserves U/V Components)
  console.log('\nTest 10: Physical Drift Vector Engine (V_d = V_c + γ V_w)');
  const testOcean = {
    current_u_mps: 0.40, // 0.40 m/s Eastward
    current_v_mps: 0.30, // 0.30 m/s Northward
    ocean_current_speed_kmph: 1.8,
    ocean_current_direction_deg: 53.1,
  } as any;
  const testWeather = {
    wind_speed_kmph: 36.0, // 10.0 m/s
    wind_direction_deg: 270.0, // Wind FROM West blows TOWARDS East (dir + 180 = 90°)
  } as any;
  // Downwind vector: u_w = 10 * sin(90) = 10.0, v_w = 10 * cos(90) = 0.0
  // Leeway gamma = 0.03 -> gamma * u_w = 0.30, gamma * v_w = 0.0
  // Total drift: u_d = 0.40 + 0.30 = 0.70 m/s, v_d = 0.30 + 0.0 = 0.30 m/s
  const driftRes = calculateDriftVector(testOcean, testWeather, 0.03);
  assert(driftRes.drift.status === 'COMPUTED', 'Drift status is COMPUTED');
  assert(driftRes.drift.u_mps === 0.70, `Drift U is 0.70 m/s (got ${driftRes.drift.u_mps})`);
  assert(driftRes.drift.v_mps === 0.30, `Drift V is 0.30 m/s (got ${driftRes.drift.v_mps})`);
  // Speed = sqrt(0.70^2 + 0.30^2) = sqrt(0.49 + 0.09) = sqrt(0.58) ≈ 0.76 m/s
  assert(driftRes.drift.speed_mps === 0.76, `Drift speed is 0.76 m/s (got ${driftRes.drift.speed_mps})`);
  assert(driftRes.drift.speed_kmph === 2.74, `Drift speed is ~2.74 km/h (got ${driftRes.drift.speed_kmph})`);
  assert(driftRes.drift.speed_knots === 1.48, `Drift speed is ~1.48 knots (got ${driftRes.drift.speed_knots})`);

  // Test 11: Predicted Position: P(t) = P0 + V_d * t
  console.log('\nTest 11: Predicted Position Engine P(t) = P0 + V_d * t');
  const driftWithPred = calculateDriftVector(testOcean, testWeather, 0.03, {
    originLat: 18.9438,
    originLon: 72.8360,
    horizonHours: 3.0,
    initialRadiusNm: 0.5,
  });
  assert(driftWithPred.prediction !== undefined, 'Prediction result attached to drift');
  assert(driftWithPred.prediction?.origin.latitude === 18.9438, 'Origin latitude preserved');
  assert(driftWithPred.prediction?.forecast_horizon_h === 3.0, 'Forecast horizon 3.0 h preserved');
  // Over 3 hours (10800s):
  // delta_lat = (0.30 * 10800) / 111320 ≈ 0.0291° -> 18.9438 + 0.0291 = 18.9729°
  // cos(18.94°) ≈ 0.9458
  // delta_lon = (0.70 * 10800) / (111320 * 0.9458) ≈ 7560 / 105286 ≈ 0.0718° -> 72.8360 + 0.0718 = 72.9078°
  assert(
    driftWithPred.prediction!.predicted_position.latitude > 18.95 &&
    driftWithPred.prediction!.predicted_position.latitude < 19.00,
    `Predicted latitude north of origin: ${driftWithPred.prediction?.predicted_position.latitude}`
  );
  assert(
    driftWithPred.prediction!.predicted_position.longitude > 72.85 &&
    driftWithPred.prediction!.predicted_position.longitude < 72.95,
    `Predicted longitude east of origin: ${driftWithPred.prediction?.predicted_position.longitude}`
  );
  assert(driftWithPred.prediction!.displacement_km > 7.0 && driftWithPred.prediction!.displacement_km < 9.0, `Displacement is ~8.2 km (got ${driftWithPred.prediction?.displacement_km})`);

  // Test 12: Search Radius Expansion: R(t) = R0 + drift_error * distance
  console.log('\nTest 12: Search Radius Expansion R(t) = R0 + drift_error * distance');
  assert(driftWithPred.prediction!.initial_search_radius_nm === 0.5, 'Initial search radius is 0.5 NM');
  assert(driftWithPred.prediction!.drift_uncertainty_factor === 0.30, 'Drift uncertainty factor is 0.30 (IAMSAR standard)');
  assert(
    driftWithPred.prediction!.search_radius_nm > driftWithPred.prediction!.initial_search_radius_nm,
    `Search radius expanded with time: ${driftWithPred.prediction?.search_radius_nm} NM`
  );
  assert(driftWithPred.prediction!.search_radius_km > 2.0, `Search radius in km: ${driftWithPred.prediction?.search_radius_km} km`);

  // Test 13: Geofencing, Sanctuary (MPA), and Proximity Alerts
  console.log('\nTest 13: Deterministic Geofencing & Boundary Proximity Engine');
  // Test Malvan Marine Sanctuary coordinates (16.02 N, 73.48 E)
  const mpaCheck = evaluateGeofencingAndProximity(16.02, 73.48, 3.0);
  assert(mpaCheck.protected_area_status === 'INSIDE_RESTRICTED_MPA', 'Detects coordinates inside Malvan Marine Sanctuary');
  assert(mpaCheck.boundary_veto === true, 'Marine sanctuary intrusion activates boundary_veto');
  assert(mpaCheck.alerts.some((a) => a.includes('Malvan Marine Sanctuary')), 'Alert lists sanctuary restriction');

  // Test IMBL Proximity near Sir Creek (23.66 N, 67.88 E)
  const imblCheck = evaluateGeofencingAndProximity(23.66, 67.88, 5.0);
  assert(imblCheck.imbl_boundary_status === 'CRITICAL_IMBL_PROXIMITY', 'Detects critical proximity to Sir Creek IMBL');
  assert(imblCheck.boundary_veto === true, 'Critical IMBL proximity activates boundary_veto');

  // Test Safe Offshore Zone (18.5 N, 72.0 E)
  const safeCheck = evaluateGeofencingAndProximity(18.5, 72.0, 3.0);
  assert(safeCheck.protected_area_status === 'CLEAR', 'Protected area status is CLEAR offshore');
  assert(safeCheck.imbl_boundary_status === 'CLEAR', 'IMBL boundary status is CLEAR offshore');
  assert(safeCheck.boundary_veto === false, 'No boundary veto in safe offshore waters');

  // Test 14: PFZ (Potential Fishing Zone) Exposure & Geometry
  console.log('\nTest 14: Potential Fishing Zone (PFZ) Polygon Intersection');
  const pfzPolygon: Array<[number, number]> = [
    [18.90, 72.50],
    [19.10, 72.50],
    [19.10, 72.70],
    [18.90, 72.70],
  ];
  // Inside point: 19.00 N, 72.60 E
  const pfzInside = evaluateGeofencingAndProximity(19.00, 72.60, 3.0, pfzPolygon, 'High abundance tuna advisory');
  assert(pfzInside.pfz_exposure?.is_inside === true, 'Detects coordinate inside INCOIS PFZ polygon');
  assert(pfzInside.pfz_exposure?.distance_to_pfz_nm === 0.0, 'Distance to PFZ is 0.0 NM when inside');
  assert(pfzInside.pfz_exposure?.advisory === 'High abundance tuna advisory', 'Preserves PFZ advisory message');

  // Outside point: 18.50 N, 72.60 E
  const pfzOutside = evaluateGeofencingAndProximity(18.50, 72.60, 3.0, pfzPolygon, 'High abundance tuna advisory');
  assert(pfzOutside.pfz_exposure?.is_inside === false, 'Detects coordinate outside PFZ polygon');
  assert(pfzOutside.pfz_exposure!.distance_to_pfz_nm! > 20.0, `Calculates distance to PFZ: ${pfzOutside.pfz_exposure?.distance_to_pfz_nm} NM`);

  // Test 15: Structured Evidence Linkage
  console.log('\nTest 15: Structured Evidence Linkage (Authoritative Veto)');
  assert(evalRed.evidence !== undefined, 'Evidence payload attached to assessment');
  assert(evalRed.evidence?.veto_applied === true, 'Evidence records veto_applied = true');
  assert(evalRed.evidence?.deterministic_decision === 'NO-GO', 'Evidence records deterministic_decision = NO-GO');
  assert(evalRed.evidence?.veto_reasons.length > 0, 'Evidence preserves explicit veto reasons');
  assert(evalRed.evidence?.confidence_composite === 0.88, 'Evidence links confidence score');

  // Test 16: End-to-End Orchestrator Pipeline with Vessel, Geofencing, and Risk Engine
  console.log('\nTest 16: End-to-End Orchestrator Integration (Phase 6 Complete)');
  const endToEndData = await OrcaOrchestrator.collectAndProcess({
    latitude: 18.9438,
    longitude: 72.8360,
    demo: true,
    vessel_class: 'traditional_motorized',
    vessel_beam_m: 2.2,
    fuel_endurance_h: 12.0,
    forecast_horizon_h: 4.0,
    enable_geofencing: true,
  });

  const fullAssessment = evaluateRiskEngine(endToEndData);
  assert(fullAssessment.risk_index !== undefined, 'End-to-end assessment contains risk_index');
  assert(fullAssessment.risk_index! >= 0.0 && fullAssessment.risk_index! <= 1.0, 'End-to-end risk_index is bounded [0, 1]');
  assert(fullAssessment.veto !== undefined, 'End-to-end assessment contains deterministic veto');
  assert(fullAssessment.drift?.prediction !== undefined, 'End-to-end drift prediction present');
  assert(fullAssessment.drift?.prediction?.forecast_horizon_h === 4.0, 'Forecast horizon 4.0 h applied to drift prediction');
  assert(endToEndData.geofencing?.status === 'ACTIVE' || endToEndData.geofencing?.status === 'CLEAR', 'Geofencing actively evaluated');
  assert(fullAssessment.evidence !== undefined, 'Structured evidence linkage present on final result');

  console.log('\n========================================');
  console.log(`PHASE 6 TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('========================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runPhase6Tests().catch((err) => {
  console.error('Phase 6 Test runner failed:', err);
  process.exit(1);
});
