/**
 * ORCA Common Marine Data Model & Pipeline Contracts
 * Defines standard interfaces for all data sources, normalized observations,
 * validation results, source health, and pipeline execution.
 * 
 * Supports full environmental & hazard parameters from:
 * - Open-Meteo (Live Marine & Meteorology)
 * - IMD (Official Weather, Cyclone Warnings, Lightning & Gusts)
 * - INCOIS (Ocean State Forecast, Currents U/V, Wave Periods, Tides, PFZ)
 * - MOSDAC / ISRO (Satellite SST, Chlorophyll-a, Ocean Winds, Cloud Cover)
 * - Vessel & Mission Specifications
 * - Geofencing & Maritime Boundaries
 */

export type SourceStatus = 'LIVE' | 'CACHED' | 'CONFIG_REQUIRED' | 'UNAVAILABLE' | 'ERROR' | 'DEMO';

export type FreshnessStatus = 'LIVE' | 'RECENT' | 'STALE' | 'UNAVAILABLE';

export type ValidationStatus = 'VALID' | 'PARTIAL' | 'INVALID';

export type WarningSeverity = 'none' | 'watch' | 'advisory' | 'warning' | 'alert';

export interface SourceHealthEntry {
  provider_id: string;
  name: string;
  status: SourceStatus;
  last_retrieval_attempt: string;
  last_success?: string | null;
  error?: string | null;
  note?: string;
}

export interface PipelineSourceHealth {
  open_meteo: SourceHealthEntry;
  imd: SourceHealthEntry;
  incois: SourceHealthEntry;
  mosdac: SourceHealthEntry;
}

export interface ProviderProvenance {
  provider_id: string;
  name: string;
  status: SourceStatus;
  retrieved_at: string;
  source_timestamp: string | null;
  age_seconds: number | null;
  source_url?: string;
  error?: string | null;
  note?: string;
  missing_fields: string[];
}

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  label?: string;
  region?: string;
}

export interface TimeMetadata {
  observation_time?: string | null;
  forecast_time?: string | null;
  retrieved_at: string;
  freshness: FreshnessStatus;
  age_seconds?: number | null;
}

export interface WeatherObservation {
  temperature_c: number | null;
  feels_like_c: number | null;
  humidity_pct: number | null;
  pressure_hpa: number | null;
  wind_speed_kmph: number | null;
  wind_speed_mps: number | null;
  wind_gust_kmph: number | null;
  wind_gust_mps: number | null;
  wind_direction_deg: number | null;
  precipitation_mm_last_hour: number | null;
  precipitation_mm_24h: number | null;
  visibility_km: number | null;
  cloud_cover_percent: number | null;
  lightning_density: number | null; // strikes/km²/hour
  condition: string | null;
  source: {
    provider: string;
    source_url?: string;
    retrieved_at: string;
    data_status: SourceStatus;
    source_timestamp?: string | null;
    note?: string;
  };
}

export interface OceanObservation {
  wave_height_m: number | null;
  wave_period_s: number | null;
  wave_direction_deg: number | null;
  wind_wave_height_m: number | null;
  swell_height_m: number | null;
  swell_period_s: number | null;
  swell_direction_deg: number | null;
  sea_surface_temperature_c: number | null;
  ocean_current_speed_kmph: number | null;
  ocean_current_speed_mps: number | null;
  ocean_current_direction_deg: number | null;
  // INCOIS & Physical Oceanographic Vector Components
  current_u_mps: number | null; // Zonal eastward velocity
  current_v_mps: number | null; // Meridional northward velocity
  significant_wave_height_m: number | null;
  peak_wave_period_s: number | null;
  tide_height_m: number | null;
  tide_time_utc: string | null;
  source: {
    provider: string;
    source_url?: string;
    retrieved_at: string;
    data_status: SourceStatus;
    source_timestamp?: string | null;
    note?: string;
  };
}

export interface EcosystemObservation {
  chlorophyll_a_mg_m3: number | null;
  sea_surface_temperature_c: number | null;
  cloud_cover_percent: number | null;
  pfz_advisory: string | null;
  pfz_polygon: Array<[number, number]> | null;
  observation_timestamp: string | null;
  source: {
    provider: string;
    source_url?: string;
    retrieved_at: string;
    data_status: SourceStatus;
    note?: string;
  } | null;
}

export type VesselClass =
  | 'traditional_non_motorized'
  | 'traditional_motorized'
  | 'mechanized_trawler'
  | 'multiday_gillnetter'
  | 'coastal_cargo'
  | 'patrol_craft'
  | 'recreational'
  | string;

export interface VesselMissionModel {
  vessel_beam_m: number | null;
  vessel_class: VesselClass | null;
  fuel_endurance_h: number | null;
  last_known_latitude: number | null;
  last_known_longitude: number | null;
  mission_type: string | null;
  forecast_horizon_h: number | null;
  status: 'CONFIGURED' | 'NOT_PROVIDED' | 'UNAVAILABLE';
}

export interface GeofencingModel {
  distance_to_boundary_nm: number | null;
  minimum_safe_boundary_distance_nm: number | null;
  protected_area_status: string | null;
  imbl_boundary_status: string | null;
  alerts: string[];
  status: 'ACTIVE' | 'CLEAR' | 'UNAVAILABLE';
  boundary_veto?: boolean;
  pfz_exposure?: {
    is_inside: boolean;
    distance_to_pfz_nm: number | null;
    advisory: string | null;
  } | null;
  note?: string;
}

export interface CycloneObservation {
  active: boolean;
  name: string | null;
  category: string | null;
  observed_points: Array<{
    date_time: string;
    latitude: number;
    longitude: number;
    msw_kmph?: number | null;
    category?: string | null;
  }>;
  forecast_points: Array<{
    date_time: string;
    latitude: number;
    longitude: number;
    msw_kmph?: number | null;
    category?: string | null;
  }>;
  cone_geometry?: any;
  source_timestamp?: string | null;
}

export interface OfficialWarning {
  id?: string;
  headline: string;
  severity: WarningSeverity;
  source: string;
  warning_type?: 'weather_warning' | 'marine_warning' | 'cyclone_warning' | 'general';
  warning_text?: string;
  published_at?: string;
  expires_at?: string;
  region?: string;
  issued_at?: string;
  valid_from?: string;
  valid_until?: string;
  affected_area?: string;
  official_color_code?: 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED' | string;
  // Field aliases defined in ORCA specifications
  warning_colour?: string | null;
  warning_message?: string | null;
  warning_issued_at?: string | null;
  warning_valid_until?: string | null;
  gust_speed_kmh?: number | null;
  lightning_density?: number | null;
  visibility_km?: number | null;
  marine_area?: string | null;
  sea_condition?: string | null;
  port_signal?: string | null;
}

export interface WarningsSummary {
  status: 'NONE' | 'ACTIVE' | 'UNAVAILABLE';
  items: OfficialWarning[];
  provider: string;
  retrieved_at: string;
}

export interface SourceComparisonEntry {
  variable: string;
  unit: string;
  values: Record<string, number | null>;
  difference?: number | null;
  agreement_ratio?: number | null; // 0.0 to 1.0 (1.0 = perfect agreement)
  note?: string;
}

export interface ConfidenceBreakdown {
  composite: number; // 0.0 to 1.0 (C = w1*F + w2*A + w3*S)
  freshness_factor: number; // F (0.0 to 1.0)
  agreement_factor: number; // A (0.0 to 1.0)
  spatial_completeness_factor: number; // S (0.0 to 1.0)
  weights: {
    w1_freshness: number;
    w2_agreement: number;
    w3_spatial: number;
  };
}

export interface CommonMarineDataModel {
  location: LocationCoordinates;
  time: TimeMetadata;
  weather: WeatherObservation | null;
  ocean: OceanObservation | null;
  ecosystem: EcosystemObservation | null;
  vessel: VesselMissionModel | null;
  geofencing: GeofencingModel | null;
  warnings: WarningsSummary;
  cyclone?: CycloneObservation | null;
  providers: Record<string, ProviderProvenance>;
  metadata: {
    source_status: SourceStatus;
    data_completeness: number; // 0.0 to 1.0 percentage of key fields present
    confidence: number; // 0.0 to 1.0 confidence score
    confidence_breakdown?: ConfidenceBreakdown;
    validation_status: ValidationStatus;
    errors: string[];
    missing_fields: string[];
    source_conflicts: SourceComparisonEntry[];
    sources: PipelineSourceHealth;
  };
}
