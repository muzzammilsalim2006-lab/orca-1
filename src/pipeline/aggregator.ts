/**
 * ORCA Pipeline Aggregator
 * 
 * Combines validated data streams into the Common Marine Data Model.
 * Computes:
 * - data_completeness (fraction of key physical factors present)
 * - confidence & confidence_breakdown (C = w1*F + w2*A + w3*S where w1+w2+w3=1)
 * - source_conflicts (multi-source comparison for overlapping variables)
 * - comprehensive provider provenance tracking
 * - unified warnings summary with official precedence
 */

import {
  CommonMarineDataModel,
  LocationCoordinates,
  WeatherObservation,
  OceanObservation,
  EcosystemObservation,
  VesselMissionModel,
  GeofencingModel,
  PipelineSourceHealth,
  ProviderProvenance,
  WarningsSummary,
  SourceStatus,
  ValidationStatus,
  SourceComparisonEntry,
  ConfidenceBreakdown,
} from './models';
import { computeFreshnessDetails } from './validator';

export interface AggregateInput {
  location: LocationCoordinates;
  weather: WeatherObservation | null;
  ocean: OceanObservation | null;
  ecosystem?: EcosystemObservation | null;
  vessel?: VesselMissionModel | null;
  geofencing?: GeofencingModel | null;
  warnings: WarningsSummary;
  cyclone?: CycloneObservation | null;
  sources: PipelineSourceHealth;
  providers?: Record<string, ProviderProvenance>;
  validationStatus: ValidationStatus;
  errors: string[];
  missing_fields?: string[];
  source_comparisons?: SourceComparisonEntry[];
}

export function aggregateMarineData(input: AggregateInput): CommonMarineDataModel {
  const {
    location,
    weather,
    ocean,
    ecosystem = null,
    vessel = null,
    geofencing = null,
    warnings,
    cyclone = null,
    sources,
    providers: customProviders,
    validationStatus,
    errors,
    missing_fields = [],
    source_comparisons = [],
  } = input;

  // 1. Calculate completeness across 5 key core physical risk factors
  // (wind, rainfall, wave_height, swell, current)
  const keyFactors = [
    weather?.wind_speed_kmph ?? null,
    weather?.precipitation_mm_24h ?? null,
    ocean?.wave_height_m ?? null,
    ocean?.swell_height_m ?? null,
    ocean?.ocean_current_speed_kmph ?? null,
  ];

  const presentCount = keyFactors.filter((v) => v !== null && v !== undefined).length;
  const dataCompleteness = Math.round((presentCount / keyFactors.length) * 100) / 100;

  // 2. Determine overall primary source status
  let overallStatus: SourceStatus = 'UNAVAILABLE';
  if (
    weather?.source.data_status === 'LIVE' ||
    ocean?.source.data_status === 'LIVE' ||
    sources.incois.status === 'LIVE' ||
    sources.mosdac.status === 'LIVE'
  ) {
    overallStatus = 'LIVE';
  } else if (
    weather?.source.data_status === 'CACHED' ||
    ocean?.source.data_status === 'CACHED' ||
    sources.incois.status === 'CACHED' ||
    sources.mosdac.status === 'CACHED'
  ) {
    overallStatus = 'CACHED';
  } else if (weather?.source.data_status === 'DEMO' || ocean?.source.data_status === 'DEMO') {
    overallStatus = 'DEMO';
  } else if (sources.open_meteo.status === 'CONFIG_REQUIRED' && sources.imd.status === 'CONFIG_REQUIRED') {
    overallStatus = 'CONFIG_REQUIRED';
  }

  // 3. Timestamps & Freshness Assessment
  const sourceTimestamp = weather?.source.source_timestamp || ocean?.source.source_timestamp || null;
  const retrievedAt = weather?.source.retrieved_at || ocean?.source.retrieved_at || new Date().toISOString();
  const { freshness, age_seconds } = computeFreshnessDetails(retrievedAt, sourceTimestamp);

  // 4. Compute Confidence Model: C = w1*F + w2*A + w3*S
  // F: Freshness factor (0.0 to 1.0)
  let freshnessFactor = 0.0;
  if (freshness === 'LIVE') freshnessFactor = 1.0;
  else if (freshness === 'RECENT') freshnessFactor = 0.75;
  else if (freshness === 'STALE') freshnessFactor = 0.35;
  else freshnessFactor = 0.0;

  // A: Source Agreement factor (0.0 to 1.0)
  // If multiple sources exist, compare them; otherwise baseline single-source confidence
  let agreementFactor = 0.85; // Baseline single verified provider
  if (source_comparisons.length > 0) {
    const validAgreements = source_comparisons
      .map((c) => c.agreement_ratio)
      .filter((r): r is number => r !== null && r !== undefined);
    if (validAgreements.length > 0) {
      const avgAgreement = validAgreements.reduce((a, b) => a + b, 0) / validAgreements.length;
      agreementFactor = Math.round(avgAgreement * 100) / 100;
    }
  } else if (sources.imd.status === 'LIVE' && sources.open_meteo.status === 'LIVE') {
    agreementFactor = 0.95;
  }

  // S: Spatial & Completeness factor (0.0 to 1.0)
  const spatialCompletenessFactor = dataCompleteness;

  // Weights defined in report: w1 = 0.35, w2 = 0.35, w3 = 0.30 (sum = 1.0)
  const weights = {
    w1_freshness: 0.35,
    w2_agreement: 0.35,
    w3_spatial: 0.30,
  };

  let compositeConfidence =
    weights.w1_freshness * freshnessFactor +
    weights.w2_agreement * agreementFactor +
    weights.w3_spatial * spatialCompletenessFactor;

  // Adjust for validation status
  if (validationStatus === 'INVALID') {
    compositeConfidence = Math.min(0.3, compositeConfidence);
  } else if (validationStatus === 'PARTIAL') {
    compositeConfidence = Math.max(0.1, compositeConfidence - 0.1);
  }

  const confidenceScore = Math.round(Math.min(1.0, Math.max(0.1, compositeConfidence)) * 100) / 100;

  const confidenceBreakdown: ConfidenceBreakdown = {
    composite: confidenceScore,
    freshness_factor: freshnessFactor,
    agreement_factor: agreementFactor,
    spatial_completeness_factor: spatialCompletenessFactor,
    weights,
  };

  // 5. Build Comprehensive Provider Provenance Map
  const providersMap: Record<string, ProviderProvenance> = customProviders || {
    open_meteo: {
      provider_id: 'open_meteo',
      name: 'Open-Meteo Marine & Weather API',
      status: sources.open_meteo.status,
      retrieved_at: sources.open_meteo.last_retrieval_attempt || retrievedAt,
      source_timestamp: sourceTimestamp,
      age_seconds: age_seconds,
      source_url: 'https://open-meteo.com/',
      error: sources.open_meteo.error || null,
      note: sources.open_meteo.note,
      missing_fields: weather ? ['visibility_km', 'lightning_density'] : ['weather', 'ocean'],
    },
    imd: {
      provider_id: 'imd',
      name: 'India Meteorological Department (IMD)',
      status: sources.imd.status,
      retrieved_at: sources.imd.last_retrieval_attempt || retrievedAt,
      source_timestamp: null,
      age_seconds: null,
      error: sources.imd.error || null,
      note: sources.imd.note,
      missing_fields: sources.imd.status === 'CONFIG_REQUIRED' ? ['all_fields_config_required'] : [],
    },
    incois: {
      provider_id: 'incois',
      name: 'INCOIS Ocean State Forecast / PFZ',
      status: sources.incois.status,
      retrieved_at: sources.incois.last_retrieval_attempt || retrievedAt,
      source_timestamp: sources.incois.status === 'LIVE' ? (ocean?.source?.source_timestamp || retrievedAt) : null,
      age_seconds: null,
      source_url: 'https://incois.gov.in/',
      error: sources.incois.error || null,
      note: sources.incois.note,
      missing_fields: sources.incois.status === 'CONFIG_REQUIRED'
        ? ['current_u_mps', 'current_v_mps', 'tide_height_m', 'pfz_polygon']
        : ocean && ocean.current_u_mps === null
        ? ['current_u_mps', 'current_v_mps']
        : [],
    },
    mosdac: {
      provider_id: 'mosdac',
      name: 'ISRO MOSDAC Satellite Ocean Data',
      status: sources.mosdac.status,
      retrieved_at: sources.mosdac.last_retrieval_attempt || retrievedAt,
      source_timestamp: sources.mosdac.status === 'LIVE' ? (ecosystem?.observation_timestamp || retrievedAt) : null,
      age_seconds: null,
      source_url: 'https://www.mosdac.gov.in/',
      error: sources.mosdac.error || null,
      note: sources.mosdac.note,
      missing_fields: sources.mosdac.status === 'CONFIG_REQUIRED'
        ? ['chlorophyll_a_mg_m3', 'satellite_sst', 'cloud_cover_percent']
        : ecosystem && ecosystem.chlorophyll_a_mg_m3 === null
        ? ['chlorophyll_a_mg_m3']
        : [],
    },
  };

  // Compile unique missing fields across all pipeline checks
  const combinedMissing = Array.from(new Set(missing_fields)).sort();

  return {
    location,
    time: {
      observation_time: sourceTimestamp || retrievedAt,
      forecast_time: sourceTimestamp || retrievedAt,
      retrieved_at: retrievedAt,
      freshness,
      age_seconds,
    },
    weather,
    ocean,
    ecosystem,
    vessel,
    geofencing,
    warnings,
    cyclone,
    providers: providersMap,
    metadata: {
      source_status: overallStatus,
      data_completeness: dataCompleteness,
      confidence: confidenceScore,
      confidence_breakdown: confidenceBreakdown,
      validation_status: validationStatus,
      errors,
      missing_fields: combinedMissing,
      source_conflicts: source_comparisons,
      sources,
    },
  };
}
