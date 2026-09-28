import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import LocationSelector from './components/LocationSelector';
import RiskBadgeCard from './components/RiskBadgeCard';
import MapPicker from './components/MapPicker';
import WeatherCard from './components/WeatherCard';
import OceanCard from './components/OceanCard';
import DriftSarCard from './components/DriftSarCard';
import GeofencePfzCard from './components/GeofencePfzCard';
import RiskFactorsTable from './components/RiskFactorsTable';
import SourceHealthCard from './components/SourceHealthCard';
import EvidenceAuditCard from './components/EvidenceAuditCard';
import AIExplanationCard from './components/AIExplanationCard';
import SystemMetaCard from './components/SystemMetaCard';
import WarningsBanner from './components/WarningsBanner';
import Footer from './components/Footer';
import { assessRisk, fetchHealth, fetchSystemInfo } from './services/api';
import {
  DEFAULT_LOCATION,
  checkMaharashtraScope,
} from './config/maharashtraRegions';
import { detectRegionalLanguage } from './utils/regionDetector';
import { AlertCircle, RefreshCw, Info } from 'lucide-react';

export default function App() {
  const [lat, setLat] = useState(DEFAULT_LOCATION.lat.toString());
  const [lon, setLon] = useState(DEFAULT_LOCATION.lon.toString());
  const [label, setLabel] = useState(DEFAULT_LOCATION.label);
  const [demoMode, setDemoMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [assessment, setAssessment] = useState(null);
  const [systemInfo, setSystemInfo] = useState(null);
  const [error, setError] = useState(null);
  const [outOfScopeError, setOutOfScopeError] = useState(null);
  const [isConnected, setIsConnected] = useState(true);

  // Language selection state: 'auto' | 'en' | 'mr'
  const [languageMode, setLanguageMode] = useState('auto');

  // Operational vessel and horizon settings
  const [vesselClass, setVesselClass] = useState('traditional_motorized');
  const [forecastHorizon, setForecastHorizon] = useState(3.0);

  // Initial load: Fetch system info & run baseline assessment on Maharashtra default location
  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      // 1. Initial health and system info check
      try {
        const [health, sysInfo] = await Promise.all([fetchHealth(), fetchSystemInfo()]);
        if (!isMounted) return;
        setIsConnected(!!health);
        if (sysInfo) setSystemInfo(sysInfo);
      } catch (e) {
        console.warn('System initialization error:', e);
      }

      // 2. Initial assessment on default Maharashtra harbour (Mumbai)
      try {
        await handleAssess(
          DEFAULT_LOCATION.lat,
          DEFAULT_LOCATION.lon,
          DEFAULT_LOCATION.label,
          vesselClass,
          forecastHorizon,
          languageMode,
          false
        );
      } catch {
        if (isMounted) {
          console.warn('Live assessment fallback to demo mode snapshot...');
          try {
            await handleAssess(
              DEFAULT_LOCATION.lat,
              DEFAULT_LOCATION.lon,
              DEFAULT_LOCATION.label,
              vesselClass,
              forecastHorizon,
              languageMode,
              true
            );
          } catch (e) {
            console.error('Initial fallback also encountered issue:', e);
          }
        }
      }
    };

    init();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleAssess = async (
    targetLat,
    targetLon,
    targetLabel,
    targetVessel = vesselClass,
    targetHorizon = forecastHorizon,
    currentLangMode = languageMode,
    isDemo = demoMode
  ) => {
    // 1. Strict Maharashtra Geographic Boundary Check
    const scopeCheck = checkMaharashtraScope(targetLat, targetLon);
    if (!scopeCheck.inScope) {
      setOutOfScopeError(scopeCheck.message);
      setError(null);
      return;
    }

    setOutOfScopeError(null);
    setLoading(true);
    setError(null);
    setVesselClass(targetVessel);
    setForecastHorizon(targetHorizon);

    try {
      const data = await assessRisk({
        latitude: parseFloat(targetLat),
        longitude: parseFloat(targetLon),
        label: targetLabel || scopeCheck.district,
        demo: isDemo ? true : false,
        includeExplanation: true,
        language: currentLangMode,
        vessel_class: targetVessel,
        forecast_horizon_h: targetHorizon,
      });

      setAssessment(data);
      setIsConnected(true);
    } catch (err) {
      console.error('Assessment failed:', err);
      setError(err.message || 'Failed to fetch marine risk assessment.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleDemoMode = (newVal) => {
    setDemoMode(newVal);
    handleAssess(lat, lon, label, vesselClass, forecastHorizon, languageMode, newVal);
  };

  const handleLanguageChange = (newMode) => {
    setLanguageMode(newMode);
    if (assessment) {
      handleAssess(lat, lon, label, vesselClass, forecastHorizon, newMode);
    }
  };

  const handleMapLocationSelect = (selectedLat, selectedLon, districtName) => {
    const scopeCheck = checkMaharashtraScope(selectedLat, selectedLon);
    if (!scopeCheck.inScope) {
      setOutOfScopeError(scopeCheck.message);
      return;
    }

    setOutOfScopeError(null);
    setLat(selectedLat.toString());
    setLon(selectedLon.toString());
    const newLabel = districtName
      ? `${districtName} (${selectedLat}, ${selectedLon})`
      : `Maharashtra Coast (${selectedLat}, ${selectedLon})`;
    setLabel(newLabel);
    handleAssess(selectedLat, selectedLon, newLabel, vesselClass, forecastHorizon, languageMode);
  };

  const handleOutOfScopeFromMap = (message) => {
    setOutOfScopeError(message);
  };

  // Compute active regional language helper
  const activeLanguage =
    languageMode === 'auto'
      ? detectRegionalLanguage(lat, lon, label)
      : languageMode;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* Header Navbar */}
      <Navbar demoMode={demoMode} setDemoMode={handleToggleDemoMode} isConnected={isConnected} />

      {/* Main Content Container */}
      <main className="max-w-7xl mx-auto px-4 py-6 flex-1 w-full space-y-6">
        
        {/* Maharashtra Regional Scope & Operational Hero Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-cyan-950/40 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
          <div className="max-w-4xl space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-mono uppercase px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-bold">
                SIH 2026 Reference MVP
              </span>
              <span className="text-[11px] font-mono uppercase px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-bold">
                Maharashtra Coastal Waters
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Deterministic Marine Safety & Coastal Advisory Intelligence
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              ORCA delivers non-overridable deterministic safety decisions (GO / CAUTION / NO-GO) by ingesting live Open-Meteo marine physics, official IMD bulletins, INCOIS ocean state forecasts, and ISRO MOSDAC satellite data across the 7 coastal districts of Maharashtra.
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            {demoMode ? (
              <div className="inline-flex items-center gap-2 bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 px-3 py-1.5 rounded-lg text-xs font-semibold">
                <Info className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>Demo Mode Active: Offline verification dataset loaded for Maharashtra coastal waters.</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 px-3 py-1.5 rounded-lg text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0"></span>
                <span>Live Operational Mode: Live atmospheric & oceanographic telemetry enabled.</span>
              </div>
            )}
          </div>
        </div>

        {/* Location & Regional Target Selector */}
        <LocationSelector
          lat={lat}
          lon={lon}
          setLat={setLat}
          setLon={setLon}
          label={label}
          setLabel={setLabel}
          onAssess={(a, b, c, v, h) => handleAssess(a, b, c, v, h, languageMode)}
          loading={loading}
          outOfScopeError={outOfScopeError}
          setOutOfScopeError={setOutOfScopeError}
        />

        {/* Generic Server Error Alert Box */}
        {error && (
          <div className="bg-rose-950/80 border border-rose-500/50 rounded-2xl p-4 flex items-center justify-between text-rose-200 text-sm shadow-xl">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              <div>
                <p className="font-bold">Assessment Pipeline Notice</p>
                <p className="text-xs text-rose-300/80">{error}</p>
              </div>
            </div>
            <button
              onClick={() => handleAssess(lat, lon, label, vesselClass, forecastHorizon, languageMode)}
              className="bg-rose-900/50 hover:bg-rose-900 border border-rose-500/40 text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Structured Assessment Results Presentation */}
        {assessment && (
          <div className="space-y-6">
            
            {/* G. Official IMD/INCOIS Warnings Bulletin Banner */}
            <WarningsBanner
              warnings={assessment.warnings}
              warningSummary={assessment.warning_summary}
            />

            {/* A, B, C, D, E, F: Deterministic Decision, Veto Status & Interactive Maharashtra Map Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7">
                <RiskBadgeCard
                  assessment={assessment}
                  locationName={assessment.location?.label || label}
                />
              </div>

              <div className="lg:col-span-5 min-h-[380px]">
                <MapPicker
                  lat={assessment.location?.latitude || lat}
                  lon={assessment.location?.longitude || lon}
                  onLocationSelect={handleMapLocationSelect}
                  onOutOfScope={handleOutOfScopeFromMap}
                  label={assessment.location?.label || label}
                  riskLevel={assessment.risk?.level}
                  predictedPosition={assessment.predicted_position || assessment.drift?.drift}
                  searchRadiusNm={assessment.search_radius?.radius_nm}
                />
              </div>
            </div>

            {/* J. Surface Drift & SAR Search Radius Intelligence */}
            <DriftSarCard
              drift={assessment.drift}
              predictedPosition={assessment.predicted_position}
              searchRadius={assessment.search_radius}
              horizonH={assessment.forecast_horizon_h || forecastHorizon}
            />

            {/* K, L: Geofence Boundary & INCOIS Potential Fishing Zone (PFZ) Intelligence */}
            <GeofencePfzCard
              geofencing={assessment.geofencing}
              location={assessment.location}
            />

            {/* Weather & Ocean Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <WeatherCard weather={assessment.weather} />
              <OceanCard ocean={assessment.ocean} />
            </div>

            {/* Deterministic Risk Breakdown Table */}
            {assessment.risk?.factors && (
              <RiskFactorsTable factors={assessment.risk.factors} />
            )}

            {/* H. Multi-Source Provider Health & Telemetry Fabric */}
            <SourceHealthCard
              providers={assessment.providers}
              sources={assessment.sources}
              metadata={assessment.metadata}
              time={assessment.time}
            />

            {/* M, I: Structured Evidence Linkage & Data Quality Audit */}
            <EvidenceAuditCard
              evidence={assessment.evidence}
              dataQuality={assessment.data_quality}
              requestId={assessment.request_id}
              assessedAt={assessment.assessed_at}
            />

            {/* N. Guardrailed AI Summary Card with Marathi & English Support */}
            {assessment.explanation && (
              <AIExplanationCard
                explanation={assessment.explanation}
                languageMode={languageMode}
                activeLanguage={activeLanguage}
                onLanguageChange={handleLanguageChange}
              />
            )}

            {/* O, P: System Operational Metadata & Limitations */}
            <SystemMetaCard systemInfo={systemInfo} />

          </div>
        )}

      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
