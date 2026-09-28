/**
 * ORCA Deterministic Safety & Risk Engine
 * Implements weighted linear assessment of physical metrics.
 * 
 * Strict Guardrails:
 * 1. Missing values remain strictly null and are never assumed to be zero.
 * 2. Official warnings (severity 'warning' | 'alert') unconditionally override composite score to HIGH (min 85).
 * 3. The LLM explanation layer cannot alter the score, level, or safety recommendation.
 */

import {
  CommonMarineDataModel,
  OfficialWarning,
  OceanObservation,
  WeatherObservation,
  VesselClass,
} from './models';
import { kmphToMps, mpsToKmph } from './units';

export interface RiskFactor {
  name: string;
  label: string;
  value: number | null;
  unit: string;
  score: number | null;
  weight: number;
  status: 'ok' | 'missing';
  note?: string;
}

export interface DriftPredictionResult {
  origin: { latitude: number; longitude: number };
  predicted_position: { latitude: number; longitude: number };
  displacement_nm: number;
  displacement_km: number;
  forecast_horizon_h: number;
  search_radius_nm: number;
  search_radius_km: number;
  initial_search_radius_nm: number;
  drift_uncertainty_factor: number;
}

export interface DriftCalculationResult {
  current_velocity: {
    u_mps: number | null;
    v_mps: number | null;
    speed_mps: number | null;
    speed_kmph: number | null;
    direction_deg: number | null;
  };
  wind_velocity: {
    speed_mps: number | null;
    speed_kmph: number | null;
    direction_deg: number | null;
    u_mps: number | null;
    v_mps: number | null;
  };
  drift: {
    u_mps: number | null;
    v_mps: number | null;
    speed_mps: number | null;
    speed_kmph: number | null;
    speed_knots: number | null;
    direction_deg: number | null;
    leeway_factor_gamma: number;
    status: 'COMPUTED' | 'PARTIAL' | 'UNAVAILABLE';
    note?: string;
  };
  prediction?: DriftPredictionResult;
}

export interface VesselSafetyLimits {
  vessel_class: VesselClass;
  label: string;
  h_max_m: number | null; // Safe significant wave limit Hmax (m)
  w_lim_kmph: number | null; // Safe wind limit Wlim (km/h)
  d_min_nm: number | null; // Minimum safe boundary distance (NM)
  typical_beam_m: number | null;
  typical_fuel_endurance_h: number | null;
  status: 'CONFIGURED' | 'CONFIG_REQUIRED';
  is_prototype_threshold: boolean;
}

export const VESSEL_CLASS_LIMITS: Record<string, VesselSafetyLimits> = {
  traditional_non_motorized: {
    vessel_class: 'traditional_non_motorized',
    label: 'Traditional Non-Motorized Craft (Catamarans, Dugouts)',
    h_max_m: 1.0,
    w_lim_kmph: 30.0,
    d_min_nm: 2.0,
    typical_beam_m: 1.2,
    typical_fuel_endurance_h: 6.0,
    status: 'CONFIGURED',
    is_prototype_threshold: true,
  },
  traditional_motorized: {
    vessel_class: 'traditional_motorized',
    label: 'Motorized Traditional Craft (OBM / FRP boats)',
    h_max_m: 1.5,
    w_lim_kmph: 40.0,
    d_min_nm: 3.0,
    typical_beam_m: 2.0,
    typical_fuel_endurance_h: 12.0,
    status: 'CONFIGURED',
    is_prototype_threshold: true,
  },
  mechanized_trawler: {
    vessel_class: 'mechanized_trawler',
    label: 'Mechanized Inshore Trawler (9-15m)',
    h_max_m: 2.5,
    w_lim_kmph: 55.0,
    d_min_nm: 5.0,
    typical_beam_m: 3.8,
    typical_fuel_endurance_h: 48.0,
    status: 'CONFIGURED',
    is_prototype_threshold: true,
  },
  multiday_gillnetter: {
    vessel_class: 'multiday_gillnetter',
    label: 'Multi-Day Offshore Gillnetter / Longliner',
    h_max_m: 3.0,
    w_lim_kmph: 65.0,
    d_min_nm: 5.0,
    typical_beam_m: 4.5,
    typical_fuel_endurance_h: 120.0,
    status: 'CONFIGURED',
    is_prototype_threshold: true,
  },
  coastal_cargo: {
    vessel_class: 'coastal_cargo',
    label: 'Coastal Cargo & Small Ferry',
    h_max_m: 4.0,
    w_lim_kmph: 75.0,
    d_min_nm: 5.0,
    typical_beam_m: 8.0,
    typical_fuel_endurance_h: 72.0,
    status: 'CONFIGURED',
    is_prototype_threshold: true,
  },
  patrol_craft: {
    vessel_class: 'patrol_craft',
    label: 'Coast Guard / Coastal Police Patrol Vessel',
    h_max_m: 3.5,
    w_lim_kmph: 70.0,
    d_min_nm: 3.0,
    typical_beam_m: 5.0,
    typical_fuel_endurance_h: 36.0,
    status: 'CONFIGURED',
    is_prototype_threshold: true,
  },
  recreational: {
    vessel_class: 'recreational',
    label: 'Recreational Craft / Pleasure Boat',
    h_max_m: 1.2,
    w_lim_kmph: 35.0,
    d_min_nm: 2.0,
    typical_beam_m: 2.4,
    typical_fuel_endurance_h: 8.0,
    status: 'CONFIGURED',
    is_prototype_threshold: true,
  },
};

/**
 * Retrieve class safety limits or return transparent CONFIG_REQUIRED state
 */
export function getVesselSafetyLimits(vesselClass?: string | null): VesselSafetyLimits {
  if (!vesselClass || !VESSEL_CLASS_LIMITS[vesselClass]) {
    return {
      vessel_class: vesselClass || 'unspecified',
      label: vesselClass ? `Unconfigured Vessel Class (${vesselClass})` : 'Unspecified Vessel Class',
      h_max_m: null,
      w_lim_kmph: null,
      d_min_nm: 3.0,
      typical_beam_m: null,
      typical_fuel_endurance_h: null,
      status: 'CONFIG_REQUIRED',
      is_prototype_threshold: false,
    };
  }
  return VESSEL_CLASS_LIMITS[vesselClass];
}

export interface RiskIndexBreakdown {
  ri: number; // Final bounded index in [0, 1]
  wind_term: {
    ws_kmph: number | null;
    w_lim_kmph: number;
    weight_ww: number;
    contribution: number | null;
  };
  wave_term: {
    hs_m: number | null;
    h_lim_m: number;
    weight_wh: number;
    contribution: number | null;
  };
  warning_term: {
    color: string;
    indicator_i: number;
    weight_wc: number;
    contribution: number;
    status: 'PRESENT' | 'ABSENT' | 'UNAVAILABLE';
  };
  raw_sum: number;
  is_bounded: boolean;
  weights: { ww: number; wh: number; wc: number };
  limits: { w_lim_kmph: number; h_lim_m: number };
}

/**
 * ORCA Deterministic Risk Index (RI) Engine
 * RI = min(1, ww * (Ws / Wlim) + wh * (Hs / Hlim) + wc * I(WC))
 * 
 * Strict Guardrails:
 * - Bounded strictly between 0 and 1: 0 <= RI <= 1
 * - Missing values remain null and are not fabricated or assumed zero
 */
export function calculateRiskIndex(params: {
  windSpeedKmph?: number | null;
  waveHeightM?: number | null;
  warningColor?: string | null;
  warningSeverity?: string | null;
  warningStatus?: 'ACTIVE' | 'NONE' | 'UNAVAILABLE';
  vesselLimits?: VesselSafetyLimits | null;
  weights?: { ww: number; wh: number; wc: number };
}): RiskIndexBreakdown {
  const {
    windSpeedKmph = null,
    waveHeightM = null,
    warningColor = null,
    warningSeverity = null,
    warningStatus = 'NONE',
    vesselLimits = null,
    weights = { ww: 0.35, wh: 0.40, wc: 0.25 },
  } = params;

  // Applicable limits (from vessel class if configured, otherwise prototype defaults)
  const wLim = vesselLimits?.w_lim_kmph ?? 50.0;
  const hLim = vesselLimits?.h_max_m ?? 2.5;

  // 1. Wind term
  let windContrib: number | null = null;
  if (windSpeedKmph !== null && windSpeedKmph !== undefined && !isNaN(windSpeedKmph)) {
    windContrib = weights.ww * Math.max(0, windSpeedKmph / wLim);
  }

  // 2. Wave term
  let waveContrib: number | null = null;
  if (waveHeightM !== null && waveHeightM !== undefined && !isNaN(waveHeightM)) {
    waveContrib = weights.wh * Math.max(0, waveHeightM / hLim);
  }

  // 3. Warning Condition Indicator I(WC)
  let indicator = 0.0;
  let termStatus: 'PRESENT' | 'ABSENT' | 'UNAVAILABLE' = 'ABSENT';
  const colorUpper = (warningColor || '').toUpperCase();

  if (warningStatus === 'UNAVAILABLE') {
    termStatus = 'UNAVAILABLE';
    // Uncertainty: default to moderate baseline indicator (0.50) without pretending safe
    indicator = 0.50;
  } else if (colorUpper === 'RED' || warningSeverity === 'alert') {
    termStatus = 'PRESENT';
    indicator = 1.0;
  } else if (colorUpper === 'ORANGE' || warningSeverity === 'warning') {
    termStatus = 'PRESENT';
    indicator = 0.75;
  } else if (colorUpper === 'YELLOW' || warningSeverity === 'advisory' || warningSeverity === 'watch') {
    termStatus = 'PRESENT';
    indicator = 0.35;
  } else {
    termStatus = 'ABSENT';
    indicator = 0.0;
  }

  const warningContrib = weights.wc * indicator;

  // Compute composite raw sum
  let sum = warningContrib;
  let activeWeight = weights.wc;
  if (windContrib !== null) {
    sum += windContrib;
    activeWeight += weights.ww;
  }
  if (waveContrib !== null) {
    sum += waveContrib;
    activeWeight += weights.wh;
  }

  // Normalize by active weight when physical metrics are partially available
  const normalizedSum = activeWeight > 0 ? (sum / activeWeight) * (weights.ww + weights.wh + weights.wc) : sum;
  const boundedRI = Math.round(Math.min(1.0, Math.max(0.0, normalizedSum)) * 1000) / 1000;

  return {
    ri: boundedRI,
    wind_term: {
      ws_kmph: windSpeedKmph,
      w_lim_kmph: wLim,
      weight_ww: weights.ww,
      contribution: windContrib !== null ? Math.round(windContrib * 1000) / 1000 : null,
    },
    wave_term: {
      hs_m: waveHeightM,
      h_lim_m: hLim,
      weight_wh: weights.wh,
      contribution: waveContrib !== null ? Math.round(waveContrib * 1000) / 1000 : null,
    },
    warning_term: {
      color: colorUpper || 'NONE',
      indicator_i: indicator,
      weight_wc: weights.wc,
      contribution: Math.round(warningContrib * 1000) / 1000,
      status: termStatus,
    },
    raw_sum: Math.round(normalizedSum * 1000) / 1000,
    is_bounded: normalizedSum > 1.0,
    weights,
    limits: { w_lim_kmph: wLim, h_lim_m: hLim },
  };
}

export type VetoReasonCode =
  | 'OFFICIAL_WARNING'
  | 'WAVE_LIMIT_EXCEEDED'
  | 'WIND_LIMIT_EXCEEDED'
  | 'BOUNDARY_PROXIMITY_VIOLATION'
  | 'RESTRICTED_MARINE_SANCTUARY'
  | 'CRITICAL_IMBL_PROXIMITY';

export interface SafetyVetoResult {
  decision: 'GO' | 'CAUTION' | 'NO-GO';
  is_veto: boolean;
  triggered: boolean;
  reasons: string[];
  veto_reasons: string[];
  reason_codes: VetoReasonCode[];
  warning_veto: boolean;
  wave_veto: boolean;
  wind_veto: boolean;
  boundary_veto: boolean;
  vessel_limits_applied: VesselSafetyLimits | null;
  warnings_status: 'PRESENT' | 'ABSENT' | 'UNAVAILABLE';
}

export interface EvidenceTraceability {
  wave?: {
    source: string;
    hs_m: number | null;
    h_max_m: number | null;
    status: string;
  };
  wind?: {
    source: string;
    ws_kmph: number | null;
    w_lim_kmph: number | null;
    status: string;
  };
  warning?: {
    source: string;
    count: number;
    highest_severity: string;
    color: string;
    status: 'PRESENT' | 'ABSENT' | 'UNAVAILABLE';
  };
  drift?: {
    current_source: string;
    wind_source: string;
    leeway_gamma: number;
    drift_speed_mps: number | null;
    displacement_km: number | null;
    search_radius_nm: number | null;
  };
  geofence?: {
    distance_to_boundary_nm: number | null;
    safe_margin_nm: number | null;
    protected_area_status: string | null;
    imbl_status: string | null;
  };
  confidence?: {
    score: number;
    freshness_factor: number;
    agreement_factor: number;
    completeness_factor: number;
  };
}

export interface AssessmentEvidence {
  evidence_id: string;
  timestamp: string;
  risk_index: number;
  deterministic_decision: 'GO' | 'CAUTION' | 'NO-GO';
  veto_applied: boolean;
  veto_reasons: string[];
  reason_codes: VetoReasonCode[];
  vessel_limits_applied: VesselSafetyLimits | null;
  primary_risk_factors: Array<{ factor: string; value: number | null; unit: string; contribution: string }>;
  drift_prediction: DriftPredictionResult | null;
  official_warnings_count: number;
  confidence_composite: number;
  data_freshness_status: string;
  geofence_status: string;
  pfz_exposure: { is_inside: boolean; distance_to_pfz_nm: number | null; advisory: string | null } | null;
  traceability?: EvidenceTraceability;
}

export type DataQualityStatus = 'NORMAL' | 'DEGRADED' | 'INCOMPLETE' | 'UNAVAILABLE';

export interface DataQualityReport {
  status: DataQualityStatus;
  is_degraded: boolean;
  completeness_ratio: number;
  degradation_notes: string[];
  missing_fields: string[];
  freshness: string;
  unconfirmed_warnings: boolean;
}

/**
 * Deterministic Data Quality & Degradation Evaluator
 * Detects missing inputs, unreachable warning services, validator anomalies, and freshness decay.
 */
export function evaluateDataQuality(data: CommonMarineDataModel): DataQualityReport {
  const notes: string[] = [];
  let isDegraded = false;
  let status: DataQualityStatus = 'NORMAL';
  const unconfirmedWarnings = data.warnings.status === 'UNAVAILABLE';

  if (!data.weather && !data.ocean) {
    status = 'UNAVAILABLE';
    isDegraded = true;
    notes.push('Both weather and ocean forecast observations are unavailable.');
  } else if (!data.weather) {
    status = 'DEGRADED';
    isDegraded = true;
    notes.push('Weather forecast data is missing; assessment relies on ocean state alone.');
  } else if (!data.ocean) {
    status = 'DEGRADED';
    isDegraded = true;
    notes.push('Ocean marine forecast data is missing; sea conditions are unknown.');
  }

  if (unconfirmedWarnings) {
    isDegraded = true;
    if (status === 'NORMAL') status = 'DEGRADED';
    notes.push('Official IMD/INCOIS warning provider is unreachable; marine safety status unconfirmed.');
  }

  if (data.metadata?.data_completeness !== undefined && data.metadata.data_completeness < 0.6) {
    if (status !== 'UNAVAILABLE') status = 'INCOMPLETE';
    isDegraded = true;
    notes.push(`Critical marine parameters incomplete (${Math.round(data.metadata.data_completeness * 100)}% completeness).`);
  }

  if (data.metadata?.validation_status === 'INVALID') {
    isDegraded = true;
    if (status === 'NORMAL') status = 'DEGRADED';
    notes.push('Observation data contains out-of-bounds metrics sanitized by validator.');
  }

  if (data.time?.freshness === 'STALE') {
    isDegraded = true;
    if (status === 'NORMAL') status = 'DEGRADED';
    notes.push('Observation data age exceeds standard freshness window (STALE).');
  }

  return {
    status,
    is_degraded: isDegraded,
    completeness_ratio: data.metadata?.data_completeness ?? (isDegraded ? 0.5 : 1.0),
    degradation_notes: notes,
    missing_fields: data.metadata?.missing_fields ?? [],
    freshness: data.time?.freshness ?? 'LIVE',
    unconfirmed_warnings: unconfirmedWarnings,
  };
}

export interface RiskAssessmentResult {
  score: number;
  level: 'LOW' | 'MODERATE' | 'HIGH';
  factors: RiskFactor[];
  missing_inputs: string[];
  warning_override: boolean;
  advisories: string[];
  recommendation: string;
  official_warnings: OfficialWarning[];
  drift?: DriftCalculationResult;
  risk_index?: number;
  risk_index_breakdown?: RiskIndexBreakdown;
  veto?: SafetyVetoResult;
  evidence?: AssessmentEvidence;
}

export const FACTOR_THRESHOLDS: Record<string, { label: string; unit: string; low: number; high: number; weight: number }> = {
  wind: { label: 'Wind (incl. 80% of gusts)', unit: 'km/h', low: 25, high: 70, weight: 0.25 },
  rainfall: { label: 'Rainfall (24 h)', unit: 'mm', low: 35, high: 210, weight: 0.15 },
  wave_height: { label: 'Wave height', unit: 'm', low: 1.0, high: 3.5, weight: 0.25 },
  swell: { label: 'Swell height', unit: 'm', low: 1.2, high: 4.0, weight: 0.15 },
  ocean_current: { label: 'Ocean current', unit: 'km/h', low: 1.5, high: 5.5, weight: 0.10 },
};

export const RECOMMENDATIONS = {
  LOW: 'Risk assessment based on available forecast data. Conditions appear generally manageable for coastal craft, but stay alert to weather changes and official bulletins.',
  MODERATE: 'Risk assessment based on available forecast data. Exercise caution near the coast; small fishing craft should avoid offshore waters as sea state can change rapidly.',
  HIGH: 'High risk advisory based on forecast data. All fishing vessels and small craft should suspend sea operations.',
};

export const WARNING_RECOMMENDATION = 'An official IMD/NDMA coastal safety warning is in effect. Suspend water/fishing activities immediately and follow official civil instructions.';

function ramp(val: number | null | undefined, low: number, high: number): number | null {
  if (val === null || val === undefined || isNaN(val)) return null;
  if (val <= low) return 0.0;
  if (val >= high) return 100.0;
  return Math.round(((val - low) / (high - low)) * 1000) / 10;
}

export function evaluateRiskEngine(data: CommonMarineDataModel): RiskAssessmentResult {
  const { weather, ocean, warnings } = data;
  const t = FACTOR_THRESHOLDS;
  const factors: RiskFactor[] = [];
  const missing: string[] = [];

  // 1. Weather Factors
  if (weather) {
    // Wind factor
    const baseWind = weather.wind_speed_kmph;
    const gust = weather.wind_gust_kmph;
    let effectiveWind: number | null = null;
    if (baseWind !== null && baseWind !== undefined) {
      effectiveWind = gust !== null && gust !== undefined ? baseWind + 0.8 * Math.max(0, gust - baseWind) : baseWind;
    }

    const windScore = ramp(effectiveWind, t.wind.low, t.wind.high);
    factors.push({
      name: 'wind',
      label: t.wind.label,
      value: effectiveWind !== null ? Math.round(effectiveWind * 100) / 100 : null,
      unit: t.wind.unit,
      score: windScore,
      weight: t.wind.weight,
      status: windScore !== null ? 'ok' : 'missing',
      note: 'Includes 80% of gust speed.',
    });
    if (windScore === null) missing.push('wind');

    // Rainfall factor
    const rain24h = weather.precipitation_mm_24h;
    const rainScore = ramp(rain24h, t.rainfall.low, t.rainfall.high);
    factors.push({
      name: 'rainfall',
      label: t.rainfall.label,
      value: rain24h !== null && rain24h !== undefined ? Math.round(rain24h * 10) / 10 : null,
      unit: t.rainfall.unit,
      score: rainScore,
      weight: t.rainfall.weight,
      status: rainScore !== null ? 'ok' : 'missing',
      note: '24 h forecast total.',
    });
    if (rainScore === null) missing.push('rainfall');
  } else {
    factors.push(
      { name: 'wind', label: t.wind.label, value: null, unit: t.wind.unit, score: null, weight: t.wind.weight, status: 'missing', note: 'Value unavailable (not assumed zero).' },
      { name: 'rainfall', label: t.rainfall.label, value: null, unit: t.rainfall.unit, score: null, weight: t.rainfall.weight, status: 'missing', note: 'Value unavailable (not assumed zero).' }
    );
    missing.push('wind', 'rainfall', 'weather');
  }

  // 2. Ocean Factors
  if (ocean) {
    const oceanMetrics = [
      { key: 'wave_height', val: ocean.wave_height_m },
      { key: 'swell', val: ocean.swell_height_m },
      { key: 'ocean_current', val: ocean.ocean_current_speed_kmph },
    ];
    for (const item of oceanMetrics) {
      const s = ramp(item.val, t[item.key].low, t[item.key].high);
      factors.push({
        name: item.key,
        label: t[item.key].label,
        value: item.val !== null && item.val !== undefined ? Math.round(item.val * 100) / 100 : null,
        unit: t[item.key].unit,
        score: s,
        weight: t[item.key].weight,
        status: s !== null ? 'ok' : 'missing',
      });
      if (s === null) missing.push(item.key);
    }
  } else {
    for (const key of ['wave_height', 'swell', 'ocean_current']) {
      factors.push({
        name: key,
        label: t[key].label,
        value: null,
        unit: t[key].unit,
        score: null,
        weight: t[key].weight,
        status: 'missing',
        note: 'Value unavailable (not assumed zero).',
      });
      missing.push(key);
    }
    missing.push('ocean');
  }

  // 3. Composite Calculation
  const scored = factors.filter((f) => f.status === 'ok' && f.score !== null);
  let composite = 50.0;
  if (scored.length > 0) {
    const weightSum = scored.reduce((acc, f) => acc + f.weight, 0);
    composite = scored.reduce((acc, f) => acc + f.score * f.weight, 0) / weightSum;
  }

  // Penalize missing physical inputs defensively
  const missingCount = factors.filter((f) => f.status === 'missing').length;
  let score = composite + Math.min(12.0, 4.0 * missingCount);

  if (!weather || !ocean) {
    score = Math.max(score, 45.0);
  }

  // 4. Vessel Safety Limits & Class Parameters
  const vesselLimits = getVesselSafetyLimits(data.vessel?.vessel_class);

  // 5. Official Warning & Deterministic Safety Veto Check
  const advisories: string[] = [];
  let warningOverride = false;
  const warningList = warnings?.items || [];
  const activeWarnings = warningList.filter((w) => ['warning', 'alert'].includes(w.severity));
  const watchWarnings = warningList.filter((w) => ['advisory', 'watch'].includes(w.severity));

  let warningVeto = false;
  let waveVeto = false;
  let windVeto = false;
  let boundaryVeto = false;
  const vetoReasons: string[] = [];

  // Deterministic Veto Condition 1: Official Red / Orange / Alert / Warning
  if (activeWarnings.length > 0) {
    warningVeto = true;
    const col = activeWarnings[0].official_color_code || activeWarnings[0].warning_colour || 'ORANGE/RED';
    vetoReasons.push(`Official ${col} warning in effect: ${activeWarnings[0].headline}`);
  }

  // Deterministic Veto Condition 2: Hs > Hmax (Wave Height exceeds class limit)
  const hs = ocean?.wave_height_m ?? ocean?.significant_wave_height_m ?? null;
  if (hs !== null && vesselLimits.h_max_m !== null && hs > vesselLimits.h_max_m) {
    waveVeto = true;
    vetoReasons.push(`Significant wave height (${hs} m) exceeds safe limit Hmax (${vesselLimits.h_max_m} m) for ${vesselLimits.label}`);
  }

  // Deterministic Veto Condition 3: Ws > Wlim (Wind Speed exceeds class limit)
  const ws = weather?.wind_speed_kmph ?? null;
  if (ws !== null && vesselLimits.w_lim_kmph !== null && ws > vesselLimits.w_lim_kmph) {
    windVeto = true;
    vetoReasons.push(`Wind speed (${ws} km/h) exceeds safe operating limit Wlim (${vesselLimits.w_lim_kmph} km/h) for ${vesselLimits.label}`);
  }

  // Deterministic Veto Condition 4: Geofence / Boundary Distance dg < dmin or Sanctuary Intrusion
  if (data.geofencing?.boundary_veto) {
    boundaryVeto = true;
    const geofenceAlert = data.geofencing.alerts[0] || 'Maritime boundary safety margin violation.';
    vetoReasons.push(`Deterministic Geofence VETO: ${geofenceAlert}`);
  }

  const isVeto = warningVeto || waveVeto || windVeto || boundaryVeto;

  if (isVeto) {
    warningOverride = true;
    score = Math.max(score, 85.0);
    for (const r of vetoReasons) {
      advisories.push(r);
    }
  } else if (watchWarnings.length > 0) {
    score = Math.max(score, 45.0);
    advisories.push('Official Advisory in effect: ' + watchWarnings.map((w) => w.headline).join(' | '));
  }

  // Preserve uncertainty when warning provider is unreachable
  const warningStatusSemantics: 'PRESENT' | 'ABSENT' | 'UNAVAILABLE' =
    warnings?.status === 'UNAVAILABLE'
      ? 'UNAVAILABLE'
      : activeWarnings.length > 0 || watchWarnings.length > 0
      ? 'PRESENT'
      : 'ABSENT';

  if (warnings?.status === 'UNAVAILABLE') {
    advisories.push('Official IMD/INCOIS bulletins currently unreachable; check local coastal harbor signals.');
  }

  if (!ocean) {
    advisories.push('Ocean conditions unavailable — treat sea state as unknown and avoid entering offshore waters.');
  }
  if (!weather) {
    advisories.push('Weather data unavailable — assessment is based on limited information.');
  }

  score = Math.round(Math.min(100.0, Math.max(0.0, score)) * 10) / 10;
  const level: 'LOW' | 'MODERATE' | 'HIGH' = score < 35 ? 'LOW' : score < 60 ? 'MODERATE' : 'HIGH';

  let recommendation = RECOMMENDATIONS[level];
  if (isVeto) {
    recommendation = warningVeto
      ? WARNING_RECOMMENDATION
      : `Deterministic Safety VETO (NO-GO): ${vetoReasons[0]}. Suspend water and fishing operations immediately.`;
  }

  // 6. Risk Index Calculation (RI = min(1, ww(Ws/Wlim) + wh(Hs/Hlim) + wc I(WC)))
  const riskIndexBreakdown = calculateRiskIndex({
    windSpeedKmph: ws,
    waveHeightM: hs,
    warningColor: activeWarnings[0]?.official_color_code || activeWarnings[0]?.warning_colour || null,
    warningSeverity: activeWarnings[0]?.severity || (watchWarnings.length > 0 ? watchWarnings[0].severity : null),
    warningStatus: warnings?.status,
    vesselLimits,
  });

  // 7. Drift Vector & Search Radius Prediction Engine
  const originLat = data.vessel?.last_known_latitude ?? data.location?.latitude ?? null;
  const originLon = data.vessel?.last_known_longitude ?? data.location?.longitude ?? null;
  const horizonHours = data.vessel?.forecast_horizon_h ?? 3.0;

  const drift = calculateDriftVector(ocean, weather, 0.03, {
    originLat,
    originLon,
    horizonHours,
  });

  // 8. Deterministic Safety Veto Result
  const reasonCodes: VetoReasonCode[] = [];
  if (warningVeto) reasonCodes.push('OFFICIAL_WARNING');
  if (waveVeto) reasonCodes.push('WAVE_LIMIT_EXCEEDED');
  if (windVeto) reasonCodes.push('WIND_LIMIT_EXCEEDED');
  if (boundaryVeto) {
    if (data.geofencing?.protected_area_status === 'INSIDE_RESTRICTED_MPA') {
      reasonCodes.push('RESTRICTED_MARINE_SANCTUARY');
    } else if (data.geofencing?.imbl_boundary_status === 'CRITICAL_IMBL_PROXIMITY') {
      reasonCodes.push('CRITICAL_IMBL_PROXIMITY');
    } else {
      reasonCodes.push('BOUNDARY_PROXIMITY_VIOLATION');
    }
  }

  const vetoDecision: 'GO' | 'CAUTION' | 'NO-GO' = isVeto
    ? 'NO-GO'
    : watchWarnings.length > 0 || score >= 60
    ? 'CAUTION'
    : 'GO';

  const vetoResult: SafetyVetoResult = {
    decision: vetoDecision,
    is_veto: isVeto,
    triggered: isVeto,
    reasons: vetoReasons,
    veto_reasons: vetoReasons,
    reason_codes: reasonCodes,
    warning_veto: warningVeto,
    wave_veto: waveVeto,
    wind_veto: windVeto,
    boundary_veto: boundaryVeto,
    vessel_limits_applied: vesselLimits.status === 'CONFIGURED' ? vesselLimits : null,
    warnings_status: warningStatusSemantics,
  };

  // 9. Structured Evidence & Explanation Linkage
  const evidenceId = `ev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const evidence: AssessmentEvidence = {
    evidence_id: evidenceId,
    timestamp: new Date().toISOString(),
    risk_index: riskIndexBreakdown.ri,
    deterministic_decision: vetoResult.decision,
    veto_applied: isVeto,
    veto_reasons: vetoReasons,
    reason_codes: reasonCodes,
    vessel_limits_applied: vesselLimits.status === 'CONFIGURED' ? vesselLimits : null,
    primary_risk_factors: scored.map((f) => ({
      factor: f.name,
      value: f.value,
      unit: f.unit,
      contribution: `${Math.round(f.weight * 100)}% weight (score ${f.score}/100)`,
    })),
    drift_prediction: drift.prediction || null,
    official_warnings_count: warningList.length,
    confidence_composite: data.metadata?.confidence ?? 0.85,
    data_freshness_status: data.time?.freshness ?? 'LIVE',
    geofence_status: data.geofencing?.status ?? 'CLEAR',
    pfz_exposure: data.geofencing?.pfz_exposure || null,
    traceability: {
      wave: {
        source: ocean?.source?.provider || 'none',
        hs_m: hs,
        h_max_m: vesselLimits.h_max_m,
        status: waveVeto ? 'LIMIT_EXCEEDED' : 'PERMISSIBLE',
      },
      wind: {
        source: weather?.source?.provider || 'none',
        ws_kmph: ws,
        w_lim_kmph: vesselLimits.w_lim_kmph,
        status: windVeto ? 'LIMIT_EXCEEDED' : 'PERMISSIBLE',
      },
      warning: {
        source: warnings?.provider || 'IMD',
        count: warningList.length,
        highest_severity: activeWarnings[0]?.severity || (watchWarnings[0]?.severity ?? 'none'),
        color: activeWarnings[0]?.official_color_code || 'NONE',
        status: warningStatusSemantics,
      },
      drift: {
        current_source: ocean?.source?.provider || 'none',
        wind_source: weather?.source?.provider || 'none',
        leeway_gamma: 0.03,
        drift_speed_mps: drift.drift.speed_mps,
        displacement_km: drift.prediction?.displacement_km ?? null,
        search_radius_nm: drift.prediction?.search_radius_nm ?? null,
      },
      geofence: {
        distance_to_boundary_nm: data.geofencing?.distance_to_boundary_nm ?? null,
        safe_margin_nm: data.geofencing?.minimum_safe_boundary_distance_nm ?? null,
        protected_area_status: data.geofencing?.protected_area_status ?? null,
        imbl_status: data.geofencing?.imbl_boundary_status ?? null,
      },
      confidence: {
        score: data.metadata?.confidence ?? 0.85,
        freshness_factor: data.metadata?.confidence_breakdown?.freshness_factor ?? 1.0,
        agreement_factor: data.metadata?.confidence_breakdown?.agreement_factor ?? 0.85,
        completeness_factor: data.metadata?.confidence_breakdown?.spatial_completeness_factor ?? 1.0,
      },
    },
  };

  return {
    score,
    level,
    factors,
    missing_inputs: Array.from(new Set(missing)).sort(),
    warning_override: warningOverride,
    advisories,
    recommendation,
    official_warnings: warningList,
    drift,
    risk_index: riskIndexBreakdown.ri,
    risk_index_breakdown: riskIndexBreakdown,
    veto: vetoResult,
    evidence,
  };
}

/**
 * Physical Drift Vector & Search Radius Prediction Engine
 * Computes surface drift vector: V_d = V_c + γ * V_w
 * Predicts position: P(t) = P0 + V_d * t
 * Expands search radius: R(t) = R0 + drift_uncertainty * distance
 * 
 * Strict unit rules:
 * - Internal vector math operates in m/s
 * - Preserves both components U and V
 * - Exports speed in m/s, km/h, and knots
 */
export function calculateDriftVector(
  ocean: OceanObservation | null | undefined,
  weather: WeatherObservation | null | undefined,
  leewayGamma = 0.03,
  predictionOptions?: {
    originLat?: number | null;
    originLon?: number | null;
    horizonHours?: number | null;
    initialRadiusNm?: number | null;
    driftUncertainty?: number;
  }
): DriftCalculationResult {
  // 1. Current velocity vector components (m/s)
  let u_c: number | null = null;
  let v_c: number | null = null;
  let currentSpeedMps: number | null = null;
  let currentSpeedKmph: number | null = null;
  let currentDirDeg: number | null = null;

  if (ocean) {
    if (ocean.current_u_mps !== null && ocean.current_v_mps !== null) {
      u_c = ocean.current_u_mps;
      v_c = ocean.current_v_mps;
      currentSpeedMps = Math.round(Math.sqrt(u_c * u_c + v_c * v_c) * 100) / 100;
      currentSpeedKmph = mpsToKmph(currentSpeedMps);
      let dirRad = Math.atan2(u_c, v_c);
      let dirDeg = (dirRad * 180) / Math.PI;
      if (dirDeg < 0) dirDeg += 360;
      currentDirDeg = Math.round(dirDeg * 10) / 10;
    } else {
      const spd = ocean.ocean_current_speed_mps ?? kmphToMps(ocean.ocean_current_speed_kmph);
      const dir = ocean.ocean_current_direction_deg;
      if (spd !== null && dir !== null) {
        currentSpeedMps = spd;
        currentSpeedKmph = mpsToKmph(spd);
        currentDirDeg = dir;
        const rad = (dir * Math.PI) / 180;
        u_c = Math.round(spd * Math.sin(rad) * 100) / 100;
        v_c = Math.round(spd * Math.cos(rad) * 100) / 100;
      }
    }
  }

  // 2. Wind velocity vector components (m/s)
  let u_w: number | null = null;
  let v_w: number | null = null;
  let windSpeedMps: number | null = null;
  let windSpeedKmph: number | null = null;
  let windDirDeg: number | null = null;

  if (weather) {
    const wSpd = weather.wind_speed_mps ?? kmphToMps(weather.wind_speed_kmph);
    const wDir = weather.wind_direction_deg;
    if (wSpd !== null) {
      windSpeedMps = wSpd;
      windSpeedKmph = weather.wind_speed_kmph ?? mpsToKmph(wSpd);
      if (wDir !== null) {
        windDirDeg = wDir;
        // Direction towards which wind pushes
        const downwindRad = ((wDir + 180) * Math.PI) / 180;
        u_w = Math.round(wSpd * Math.sin(downwindRad) * 100) / 100;
        v_w = Math.round(wSpd * Math.cos(downwindRad) * 100) / 100;
      }
    }
  }

  // 3. Composite Drift Vector V_d = V_c + γ * V_w
  let u_d: number | null = null;
  let v_d: number | null = null;
  let driftSpeedMps: number | null = null;
  let driftSpeedKmph: number | null = null;
  let driftSpeedKnots: number | null = null;
  let driftDirDeg: number | null = null;
  let status: 'COMPUTED' | 'PARTIAL' | 'UNAVAILABLE' = 'UNAVAILABLE';
  let note: string | undefined;

  const hasCurrent = u_c !== null && v_c !== null;
  const hasWind = u_w !== null && v_w !== null;

  if (hasCurrent && hasWind) {
    u_d = Math.round((u_c! + leewayGamma * u_w!) * 100) / 100;
    v_d = Math.round((v_c! + leewayGamma * v_w!) * 100) / 100;
    status = 'COMPUTED';
    note = `Combined ocean current and ${Math.round(leewayGamma * 100)}% wind leeway.`;
  } else if (hasCurrent) {
    u_d = u_c;
    v_d = v_c;
    status = 'PARTIAL';
    note = 'Drift derived exclusively from ocean current (wind direction unavailable).';
  } else if (hasWind) {
    u_d = Math.round(leewayGamma * u_w! * 100) / 100;
    v_d = Math.round(leewayGamma * v_w! * 100) / 100;
    status = 'PARTIAL';
    note = `Drift derived exclusively from ${Math.round(leewayGamma * 100)}% wind leeway (ocean currents unavailable).`;
  } else {
    status = 'UNAVAILABLE';
    note = 'Current vector components and wind data unavailable for drift computation.';
  }

  if (u_d !== null && v_d !== null) {
    driftSpeedMps = Math.round(Math.sqrt(u_d * u_d + v_d * v_d) * 100) / 100;
    driftSpeedKmph = mpsToKmph(driftSpeedMps);
    driftSpeedKnots = driftSpeedMps !== null ? Math.round((driftSpeedMps / 0.514444) * 100) / 100 : null;
    let dRad = Math.atan2(u_d, v_d);
    let dDeg = (dRad * 180) / Math.PI;
    if (dDeg < 0) dDeg += 360;
    driftDirDeg = Math.round(dDeg * 10) / 10;
  }

  // 4. Predicted Position P(t) and Search Radius R(t)
  let prediction: DriftPredictionResult | undefined;
  if (
    predictionOptions?.originLat !== undefined &&
    predictionOptions?.originLat !== null &&
    predictionOptions?.originLon !== undefined &&
    predictionOptions?.originLon !== null
  ) {
    const originLat = predictionOptions.originLat;
    const originLon = predictionOptions.originLon;
    const horizonHours = predictionOptions.horizonHours || 3.0;
    const initialRadiusNm = predictionOptions.initialRadiusNm ?? 0.5;
    const driftUncertainty = predictionOptions.driftUncertainty ?? 0.30;
    const tSec = horizonHours * 3600;

    if (u_d !== null && v_d !== null && driftSpeedMps !== null) {
      // 1 deg latitude ≈ 111,320 meters
      const deltaLat = (v_d * tSec) / 111320;
      const cosLat = Math.cos((originLat * Math.PI) / 180);
      const deltaLon = (u_d * tSec) / (111320 * (Math.abs(cosLat) > 0.01 ? cosLat : 1.0));

      const predLat = Math.round((originLat + deltaLat) * 10000) / 10000;
      const predLon = Math.round((originLon + deltaLon) * 10000) / 10000;

      const dispMeters = driftSpeedMps * tSec;
      const dispNm = Math.round((dispMeters / 1852) * 100) / 100;
      const dispKm = Math.round((dispMeters / 1000) * 100) / 100;

      // IAMSAR Search Radius expansion: R(t) = R0 + drift_error * distance
      const searchRadiusNm = Math.round((initialRadiusNm + driftUncertainty * dispNm) * 100) / 100;
      const searchRadiusKm = Math.round(searchRadiusNm * 1.852 * 100) / 100;

      prediction = {
        origin: { latitude: originLat, longitude: originLon },
        predicted_position: { latitude: predLat, longitude: predLon },
        displacement_nm: dispNm,
        displacement_km: dispKm,
        forecast_horizon_h: horizonHours,
        search_radius_nm: searchRadiusNm,
        search_radius_km: searchRadiusKm,
        initial_search_radius_nm: initialRadiusNm,
        drift_uncertainty_factor: driftUncertainty,
      };
    } else {
      // Conservative stationary prediction when drift vector unavailable
      prediction = {
        origin: { latitude: originLat, longitude: originLon },
        predicted_position: { latitude: originLat, longitude: originLon },
        displacement_nm: 0,
        displacement_km: 0,
        forecast_horizon_h: horizonHours,
        search_radius_nm: initialRadiusNm,
        search_radius_km: Math.round(initialRadiusNm * 1.852 * 100) / 100,
        initial_search_radius_nm: initialRadiusNm,
        drift_uncertainty_factor: driftUncertainty,
      };
    }
  }

  return {
    current_velocity: {
      u_mps: u_c,
      v_mps: v_c,
      speed_mps: currentSpeedMps,
      speed_kmph: currentSpeedKmph,
      direction_deg: currentDirDeg,
    },
    wind_velocity: {
      speed_mps: windSpeedMps,
      speed_kmph: windSpeedKmph,
      direction_deg: windDirDeg,
      u_mps: u_w,
      v_mps: v_w,
    },
    drift: {
      u_mps: u_d,
      v_mps: v_d,
      speed_mps: driftSpeedMps,
      speed_kmph: driftSpeedKmph,
      speed_knots: driftSpeedKnots,
      direction_deg: driftDirDeg,
      leeway_factor_gamma: leewayGamma,
      status,
      note,
    },
    prediction,
  };
}
