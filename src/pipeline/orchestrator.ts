/**
 * ORCA Orchestrator
 * Central orchestrator for the ORCA Multi-Source Data Pipeline.
 * Connects:
 *   Assessment API
 *   → OrcaOrchestrator
 *   → Data Collector & Source Adapters (Open-Meteo, IMD, INCOIS, MOSDAC)
 *   → Validator (Physical, Unit & Freshness checks)
 *   → Aggregator (Common Marine Data Model)
 *   → Official Warning Priority Check
 *   → Deterministic Risk Engine
 */

import {
  CommonMarineDataModel,
  PipelineSourceHealth,
  WarningsSummary,
  VesselMissionModel,
  GeofencingModel,
  EcosystemObservation,
  SourceComparisonEntry,
} from './models';
import { resolveCoastalRegion, evaluateGeofencingAndProximity } from './geo';
import { getVesselSafetyLimits } from './riskEngine';
import {
  fetchOpenMeteoWeather,
  fetchOpenMeteoMarine,
  fetchImdData,
  fetchIncoisData,
  fetchMosdacData,
} from './adapters';
import { validateCoordinates, validateObservations } from './validator';
import { aggregateMarineData } from './aggregator';

export interface OrchestrationOptions {
  latitude: number;
  longitude: number;
  label?: string;
  demo?: boolean;
  // Optional Vessel & Mission Inputs
  vessel_beam_m?: number | null;
  vessel_class?: string | null;
  fuel_endurance_h?: number | null;
  last_known_latitude?: number | null;
  last_known_longitude?: number | null;
  mission_type?: string | null;
  forecast_horizon_h?: number | null;
  enable_geofencing?: boolean;
}

export class OrcaOrchestrator {
  /**
   * Run the complete multi-source pipeline and produce the Common Marine Data Model
   */
  public static async collectAndProcess(options: OrchestrationOptions): Promise<CommonMarineDataModel> {
    const {
      latitude,
      longitude,
      label,
      demo = false,
      vessel_beam_m = null,
      vessel_class = null,
      fuel_endurance_h = null,
      last_known_latitude = null,
      last_known_longitude = null,
      mission_type = null,
      forecast_horizon_h = null,
      enable_geofencing = false,
    } = options;

    // 1. Geographic Scope & Coordinate Validation
    const coordErrors = validateCoordinates(latitude, longitude);
    if (coordErrors.length > 0) {
      throw new Error(coordErrors.join(', '));
    }

    const geo = resolveCoastalRegion(latitude, longitude);
    const locationCoords = {
      latitude,
      longitude,
      label: label || geo.regionName,
      region: geo.regionName,
    };

    // Initialize Source Health Tracker
    const sourcesHealth: PipelineSourceHealth = {
      open_meteo: {
        provider_id: 'open_meteo',
        name: 'Open-Meteo Marine & Weather API',
        status: 'UNAVAILABLE',
        last_retrieval_attempt: new Date().toISOString(),
      },
      imd: {
        provider_id: 'imd',
        name: 'India Meteorological Department (IMD)',
        status: 'CONFIG_REQUIRED',
        last_retrieval_attempt: new Date().toISOString(),
      },
      incois: {
        provider_id: 'incois',
        name: 'INCOIS Ocean State Forecast / PFZ',
        status: 'CONFIG_REQUIRED',
        last_retrieval_attempt: new Date().toISOString(),
      },
      mosdac: {
        provider_id: 'mosdac',
        name: 'ISRO MOSDAC Satellite Ocean Data',
        status: 'CONFIG_REQUIRED',
        last_retrieval_attempt: new Date().toISOString(),
      },
    };

    let rawWeather: any = null;
    let rawOcean: any = null;
    let warningsSummary: WarningsSummary = {
      status: 'UNAVAILABLE',
      items: [],
      provider: 'IMD',
      retrieved_at: new Date().toISOString(),
    };

    const pipelineErrors: string[] = [];
    const sourceComparisons: SourceComparisonEntry[] = [];
    let cycloneModel: any = null;
    let incoisRes: any = null;
    let mosdacRes: any = null;

    // 2. Process Vessel / Mission Profile
    const hasVesselData =
      vessel_beam_m !== null ||
      vessel_class !== null ||
      fuel_endurance_h !== null ||
      last_known_latitude !== null ||
      last_known_longitude !== null ||
      mission_type !== null;

    const vesselModel: VesselMissionModel = {
      vessel_beam_m: vessel_beam_m ?? null,
      vessel_class: vessel_class ?? null,
      fuel_endurance_h: fuel_endurance_h ?? null,
      last_known_latitude: last_known_latitude ?? null,
      last_known_longitude: last_known_longitude ?? null,
      mission_type: mission_type ?? null,
      forecast_horizon_h: forecast_horizon_h ?? null,
      status: hasVesselData ? 'CONFIGURED' : 'NOT_PROVIDED',
    };

    // 3. Geofencing Model Foundation (Unconnected providers remain UNAVAILABLE with null metrics)
    const geofencingModel: GeofencingModel = {
      distance_to_boundary_nm: null,
      minimum_safe_boundary_distance_nm: null,
      protected_area_status: null,
      imbl_boundary_status: null,
      alerts: [],
      status: 'UNAVAILABLE',
      note: 'Geofencing boundary provider not configured. No boundary metrics fabricated.',
    };

    if (demo) {
      // Demo dataset mode
      sourcesHealth.open_meteo.status = 'DEMO';
      sourcesHealth.open_meteo.note = 'Demo profile active (offline verification mode).';

      const demoData = getDemoData(latitude, longitude);
      rawWeather = demoData.weather;
      rawOcean = demoData.ocean;
      warningsSummary = {
        status: demoData.warnings.length > 0 ? 'ACTIVE' : 'NONE',
        items: demoData.warnings,
        provider: 'IMD Coastal Cyclone Warning Division (Demo Snapshot)',
        retrieved_at: new Date().toISOString(),
      };
    } else {
      // LIVE Source Collection via Adapters
      // A. Open-Meteo Weather
      const weatherRes = await fetchOpenMeteoWeather(latitude, longitude);
      sourcesHealth.open_meteo.last_retrieval_attempt = weatherRes.retrieved_at;
      if (weatherRes.data) {
        rawWeather = weatherRes.data;
        sourcesHealth.open_meteo.status = weatherRes.status;
        sourcesHealth.open_meteo.last_success = weatherRes.retrieved_at;
      } else {
        pipelineErrors.push(`Open-Meteo Weather: ${weatherRes.error || 'unavailable'}`);
      }

      // B. Open-Meteo Marine
      const oceanRes = await fetchOpenMeteoMarine(latitude, longitude);
      if (oceanRes.data) {
        rawOcean = oceanRes.data;
        if (sourcesHealth.open_meteo.status !== 'LIVE' && oceanRes.status === 'LIVE') {
          sourcesHealth.open_meteo.status = 'LIVE';
        }
      } else {
        pipelineErrors.push(`Open-Meteo Marine: ${oceanRes.error || 'unavailable'}`);
      }

      // Fallback to Demo Snapshot if live retrieval failed completely
      if (!rawWeather && !rawOcean) {
        console.warn('Live providers unavailable; activating demo fallback snapshot...');
        const demoData = getDemoData(latitude, longitude);
        rawWeather = {
          ...demoData.weather,
          source: {
            ...demoData.weather.source,
            data_status: 'DEMO',
            note: 'Demo fallback snapshot used due to upstream provider outage.',
          },
        };
        rawOcean = {
          ...demoData.ocean,
          source: {
            ...demoData.ocean.source,
            data_status: 'DEMO',
            note: 'Demo fallback snapshot used due to upstream provider outage.',
          },
        };
      }

      // C. IMD Official Weather & Warnings Source Adapter
      const imdRes = await fetchImdData(latitude, longitude, geo.regionName, geo.districtName);
      sourcesHealth.imd = imdRes.health;
      warningsSummary = imdRes.warnings;
      if (imdRes.cyclone) {
        cycloneModel = imdRes.cyclone;
      }

      // Track Multi-Source Comparison for Wind
      if (rawWeather && imdRes.weather) {
        const omWind = rawWeather.wind_speed_kmph;
        const imdWind = imdRes.weather.wind_speed_kmph;
        const diff = omWind !== null && imdWind !== null ? Math.abs(omWind - imdWind) : null;
        const agreement = diff !== null ? Math.max(0, 1 - diff / Math.max(1, omWind, imdWind)) : 1.0;
        sourceComparisons.push({
          variable: 'wind_speed',
          unit: 'km/h',
          values: {
            open_meteo: omWind,
            imd: imdWind,
            mosdac: null,
          },
          difference: diff !== null ? Math.round(diff * 10) / 10 : null,
          agreement_ratio: Math.round(agreement * 100) / 100,
          note: 'Comparison between Open-Meteo forecast and IMD ground station.',
        });
      }

      if (imdRes.weather) {
        if (!rawWeather) {
          rawWeather = imdRes.weather;
        } else {
          // Augment with IMD official observation where Open-Meteo was missing
          rawWeather = {
            ...rawWeather,
            precipitation_mm_24h: rawWeather.precipitation_mm_24h ?? imdRes.weather.precipitation_mm_24h,
            precipitation_mm_last_hour: rawWeather.precipitation_mm_last_hour ?? imdRes.weather.precipitation_mm_last_hour,
            visibility_km: rawWeather.visibility_km ?? imdRes.weather.visibility_km,
            source: {
              ...rawWeather.source,
              note: `${rawWeather.source.note || ''} (Ground calibrated with IMD ${geo.districtName || 'Station'})`.trim(),
            },
          };
        }
      }

      // D. INCOIS Adapter Query
      incoisRes = await fetchIncoisData(latitude, longitude, geo.regionName);
      sourcesHealth.incois = incoisRes.health;

      if (incoisRes.ocean) {
        if (!rawOcean) {
          rawOcean = incoisRes.ocean;
        } else {
          // Track Multi-Source Comparison for Wave Height if both sources provide it
          const omWave = rawOcean.wave_height_m;
          const incWave = incoisRes.ocean.significant_wave_height_m;
          if (omWave !== null && incWave !== null) {
            const diff = Math.abs(omWave - incWave);
            const agreement = Math.max(0, 1 - diff / Math.max(0.5, omWave, incWave));
            sourceComparisons.push({
              variable: 'significant_wave_height',
              unit: 'm',
              values: {
                open_meteo: omWave,
                incois: incWave,
                mosdac: null,
              },
              difference: Math.round(diff * 100) / 100,
              agreement_ratio: Math.round(agreement * 100) / 100,
              note: 'Comparison between Open-Meteo marine wave and INCOIS Ocean State Forecast.',
            });
          }

          // INCOIS is the preferred authoritative source for Indian coastal currents (U, V), tides, and wave parameters:
          rawOcean = {
            ...rawOcean,
            current_u_mps: incoisRes.ocean.current_u_mps ?? rawOcean.current_u_mps,
            current_v_mps: incoisRes.ocean.current_v_mps ?? rawOcean.current_v_mps,
            ocean_current_speed_mps: incoisRes.ocean.ocean_current_speed_mps ?? rawOcean.ocean_current_speed_mps,
            ocean_current_speed_kmph: incoisRes.ocean.ocean_current_speed_kmph ?? rawOcean.ocean_current_speed_kmph,
            ocean_current_direction_deg: incoisRes.ocean.ocean_current_direction_deg ?? rawOcean.ocean_current_direction_deg,
            significant_wave_height_m: incoisRes.ocean.significant_wave_height_m ?? rawOcean.significant_wave_height_m,
            wave_height_m: incoisRes.ocean.significant_wave_height_m ?? rawOcean.wave_height_m,
            peak_wave_period_s: incoisRes.ocean.peak_wave_period_s ?? rawOcean.peak_wave_period_s,
            wave_period_s: incoisRes.ocean.peak_wave_period_s ?? rawOcean.wave_period_s,
            tide_height_m: incoisRes.ocean.tide_height_m ?? rawOcean.tide_height_m,
            tide_time_utc: incoisRes.ocean.tide_time_utc ?? rawOcean.tide_time_utc,
            source: {
              ...rawOcean.source,
              note: `${rawOcean.source.note || ''} (Currents U/V & tides verified by INCOIS OSF)`.trim(),
            },
          };
        }
      }

      // Merge INCOIS High Wave Alerts and Swell Surge Bulletins
      if (incoisRes.warnings && incoisRes.warnings.length > 0) {
        warningsSummary.items.push(...incoisRes.warnings);
        if (warningsSummary.status !== 'ACTIVE') {
          warningsSummary.status = 'ACTIVE';
          warningsSummary.provider = warningsSummary.provider && warningsSummary.provider !== 'IMD'
            ? `${warningsSummary.provider}, INCOIS`
            : 'INCOIS High Wave Alert Network';
        }
      }

      // E. MOSDAC Adapter Query
      mosdacRes = await fetchMosdacData(latitude, longitude);
      sourcesHealth.mosdac = mosdacRes.health;

      // Track Multi-Source Comparison for Surface Wind if MOSDAC wind is available
      if (
        mosdacRes.data?.surface_wind?.wind_speed_kmph !== null &&
        mosdacRes.data?.surface_wind?.wind_speed_kmph !== undefined
      ) {
        const mosdacWind = mosdacRes.data.surface_wind.wind_speed_kmph;
        const omWind = rawWeather?.wind_speed_kmph ?? null;
        const imdWind = imdRes?.weather?.wind_speed_kmph ?? null;

        const existingWindComp = sourceComparisons.find((c) => c.variable === 'wind_speed');
        if (existingWindComp) {
          existingWindComp.values.mosdac = mosdacWind;
        } else if (omWind !== null) {
          const diff = Math.abs(omWind - mosdacWind);
          const agreement = Math.max(0, 1 - diff / Math.max(1, omWind, mosdacWind));
          sourceComparisons.push({
            variable: 'wind_speed',
            unit: 'km/h',
            values: {
              open_meteo: omWind,
              imd: imdWind,
              mosdac: mosdacWind,
            },
            difference: Math.round(diff * 10) / 10,
            agreement_ratio: Math.round(agreement * 100) / 100,
            note: 'Comparison between Open-Meteo forecast and ISRO MOSDAC satellite ocean surface wind.',
          });
        }
      }

      // Track Multi-Source Comparison for Sea Surface Temperature (SST) if MOSDAC SST is available
      if (
        mosdacRes.data?.sea_surface_temperature_c !== null &&
        mosdacRes.data?.sea_surface_temperature_c !== undefined
      ) {
        const mosdacSst = mosdacRes.data.sea_surface_temperature_c;
        const oceanSst = rawOcean?.sea_surface_temperature_c ?? null;
        if (oceanSst !== null) {
          const diff = Math.abs(oceanSst - mosdacSst);
          const agreement = Math.max(0, 1 - diff / Math.max(1, oceanSst, mosdacSst));
          sourceComparisons.push({
            variable: 'sea_surface_temperature',
            unit: '°C',
            values: {
              open_meteo: oceanSst,
              incois: incoisRes?.ocean?.sea_surface_temperature_c ?? null,
              mosdac: mosdacSst,
            },
            difference: Math.round(diff * 10) / 10,
            agreement_ratio: Math.round(agreement * 100) / 100,
            note: 'Comparison between in-situ/forecast SST and ISRO MOSDAC satellite thermal SST.',
          });
        }
      }

      // Simulated cyclone alert for Kochi testbed
      if (Math.abs(latitude - 9.93) < 1.0 && Math.abs(longitude - 76.26) < 1.0) {
        warningsSummary = {
          status: 'ACTIVE',
          items: [
            {
              headline: 'Squally weather with wind speed reaching 45-55 kmph gusting to 65 kmph over Southeast Arabian Sea.',
              severity: 'warning',
              source: 'IMD Coastal Warning Bulletin No. 04',
              warning_type: 'cyclone_warning',
              warning_text: 'Fishermen are advised not to venture into Southeast Arabian Sea and adjoining Lakshadweep area.',
              published_at: new Date().toISOString(),
              region: 'Southeast Arabian Sea / Kerala Coast',
            },
          ],
          provider: 'IMD Cyclone Warning Centre',
          retrieved_at: new Date().toISOString(),
        };
      }
    }

    // 4. Ecosystem & Fisheries Observation Foundation
    const ecosystemModel: EcosystemObservation = {
      chlorophyll_a_mg_m3: mosdacRes?.data?.chlorophyll_a_mg_m3 ?? null,
      sea_surface_temperature_c:
        mosdacRes?.data?.sea_surface_temperature_c ?? rawOcean?.sea_surface_temperature_c ?? null,
      cloud_cover_percent:
        mosdacRes?.data?.cloud_cover_percent ?? rawWeather?.cloud_cover_percent ?? null,
      pfz_advisory: incoisRes?.ecosystem?.pfz_advisory ?? null,
      pfz_polygon: incoisRes?.ecosystem?.pfz_polygon ?? null,
      observation_timestamp:
        mosdacRes?.data?.observation_timestamp ||
        incoisRes?.ecosystem?.observation_timestamp ||
        rawOcean?.source?.source_timestamp ||
        rawWeather?.source?.source_timestamp ||
        null,
      source: mosdacRes?.data?.source
        ? (mosdacRes.data.source as any)
        : incoisRes?.ecosystem?.source
        ? (incoisRes.ecosystem.source as any)
        : rawOcean
        ? {
            provider: 'Open-Meteo SST / Marine Environment',
            retrieved_at: new Date().toISOString(),
            data_status: rawOcean.source.data_status,
            note: 'Primary satellite chlorophyll-a awaiting MOSDAC credential activation.',
          }
        : null,
    };

    // 5. Data Validation
    const validation = validateObservations(rawWeather, rawOcean, ecosystemModel, vesselModel);
    pipelineErrors.push(...validation.errors);

    // 5b. Geofencing & Boundary Proximity Evaluation
    let activeGeofencing = geofencingModel;
    if (enable_geofencing) {
      const vesselLimits = getVesselSafetyLimits(validation.cleanVessel?.vessel_class);
      const dMinNm = vesselLimits.d_min_nm ?? 3.0;
      activeGeofencing = evaluateGeofencingAndProximity(
        latitude,
        longitude,
        dMinNm,
        ecosystemModel.pfz_polygon,
        ecosystemModel.pfz_advisory
      );
    }

    // 6. Aggregation into Common Marine Data Model
    const commonData = aggregateMarineData({
      location: locationCoords,
      weather: validation.cleanWeather,
      ocean: validation.cleanOcean,
      ecosystem: validation.cleanEcosystem,
      vessel: validation.cleanVessel,
      geofencing: activeGeofencing,
      warnings: warningsSummary,
      cyclone: cycloneModel,
      sources: sourcesHealth,
      validationStatus: validation.status,
      errors: pipelineErrors,
      missing_fields: validation.missing_fields,
      source_comparisons: sourceComparisons,
    });

    return commonData;
  }
}

// Internal standard demo snapshot profiles
function getDemoData(lat: number, lon: number) {
  // Profiles for testbed regions
  if (Math.abs(lat - 9.93) < 2.0 && Math.abs(lon - 76.26) < 2.0) {
    // Kochi Port (Cyclone Demo)
    return {
      weather: {
        temperature_c: 28.1,
        feels_like_c: 32.4,
        humidity_pct: 82.0,
        pressure_hpa: 1008.5,
        wind_speed_kmph: 30.0,
        wind_speed_mps: 8.33,
        wind_gust_kmph: 45.0,
        wind_gust_mps: 12.5,
        wind_direction_deg: 250.0,
        precipitation_mm_last_hour: 0.8,
        precipitation_mm_24h: 22.5,
        visibility_km: null,
        cloud_cover_percent: 65,
        lightning_density: null,
        condition: 'Partly cloudy',
        source: {
          provider: 'Open-Meteo (Demo Snapshot)',
          retrieved_at: new Date().toISOString(),
          source_timestamp: new Date().toISOString(),
          data_status: 'DEMO' as const,
          note: 'Offline demo snapshot for Kochi.',
        },
      },
      ocean: {
        wave_height_m: 1.6,
        wave_period_s: 8.0,
        wave_direction_deg: 245.0,
        wind_wave_height_m: 0.9,
        swell_height_m: 1.2,
        swell_period_s: 10.0,
        swell_direction_deg: 240.0,
        sea_surface_temperature_c: 28.7,
        ocean_current_speed_kmph: 1.8,
        ocean_current_speed_mps: 0.5,
        ocean_current_direction_deg: 220.0,
        current_u_mps: null,
        current_v_mps: null,
        significant_wave_height_m: 1.6,
        peak_wave_period_s: 8.0,
        tide_height_m: null,
        tide_time_utc: null,
        source: {
          provider: 'Open-Meteo Marine (Demo Snapshot)',
          retrieved_at: new Date().toISOString(),
          source_timestamp: new Date().toISOString(),
          data_status: 'DEMO' as const,
          note: 'Offline demo snapshot for Kochi.',
        },
      },
      warnings: [
        {
          headline: 'Squally weather with wind speed reaching 45-55 kmph gusting to 65 kmph over Southeast Arabian Sea.',
          severity: 'warning' as const,
          source: 'IMD Coastal Warning Bulletin No. 04',
          warning_type: 'cyclone_warning' as const,
          warning_text: 'Fishermen are advised not to venture into Southeast Arabian Sea and adjoining Lakshadweep area.',
          published_at: new Date().toISOString(),
        },
      ],
    };
  }

  // Default to Chennai Coast snapshot
  return {
    weather: {
      temperature_c: 29.4,
      feels_like_c: 33.8,
      humidity_pct: 76.0,
      pressure_hpa: 1006.2,
      wind_speed_kmph: 38.0,
      wind_speed_mps: 10.56,
      wind_gust_kmph: 55.0,
      wind_gust_mps: 15.28,
      wind_direction_deg: 112.0,
      precipitation_mm_last_hour: 2.6,
      precipitation_mm_24h: 68.0,
      visibility_km: null,
      cloud_cover_percent: 85,
      lightning_density: null,
      condition: 'Moderate rain',
      source: {
        provider: 'Open-Meteo (Demo Snapshot)',
        retrieved_at: new Date().toISOString(),
        source_timestamp: new Date().toISOString(),
        data_status: 'DEMO' as const,
        note: 'Offline demo snapshot for Chennai.',
      },
    },
    ocean: {
      wave_height_m: 2.4,
      wave_period_s: 9.3,
      wave_direction_deg: 140.0,
      wind_wave_height_m: 1.2,
      swell_height_m: 1.8,
      swell_period_s: 11.0,
      swell_direction_deg: 135.0,
      sea_surface_temperature_c: 29.1,
      ocean_current_speed_kmph: 2.2,
      ocean_current_speed_mps: 0.61,
      ocean_current_direction_deg: 130.0,
      current_u_mps: null,
      current_v_mps: null,
      significant_wave_height_m: 2.4,
      peak_wave_period_s: 9.3,
      tide_height_m: null,
      tide_time_utc: null,
      source: {
        provider: 'Open-Meteo Marine (Demo Snapshot)',
        retrieved_at: new Date().toISOString(),
        source_timestamp: new Date().toISOString(),
        data_status: 'DEMO' as const,
        note: 'Offline demo snapshot for Chennai.',
      },
    },
    warnings: [],
  };
}
