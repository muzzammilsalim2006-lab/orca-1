import React, { useState } from 'react';
import {
  ShieldAlert,
  Navigation,
  Radio,
  Layers,
  Search,
  Crosshair,
  Volume2,
  VolumeX,
  Anchor,
} from 'lucide-react';
import { TRANSLATIONS } from '../../utils/translations';

export default function CoastGuardView({
  assessment,
  loading,
  language = 'en',
  onReassessSAR,
  onVoiceClick,
}) {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  const [hoursAdrift, setHoursAdrift] = useState('3.0');
  const [lkpLat, setLkpLat] = useState('');
  const [lkpLon, setLkpLon] = useState('');
  const [vesselType, setVesselType] = useState('traditional_motorized');
  const [isSpeaking, setIsSpeaking] = useState(false);

  if (loading && !assessment) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="font-semibold text-lg text-slate-200">Initializing Coast Guard Command Center...</p>
      </div>
    );
  }

  const decision = assessment?.decision || 'GO';
  const drift = assessment?.drift || {};
  const prediction = drift?.prediction || {};
  const predictedPos = assessment?.predicted_position || prediction?.predicted_position;
  const searchRadius = assessment?.search_radius || {
    radius_nm: prediction?.search_radius_nm,
    radius_km: prediction?.search_radius_km,
  };
  const geofencing = assessment?.geofencing || {};

  const handleUpdateSAR = (e) => {
    e.preventDefault();
    if (onReassessSAR) {
      onReassessSAR({
        hoursAdrift: parseFloat(hoursAdrift) || 3.0,
        lkpLat: lkpLat ? parseFloat(lkpLat) : null,
        lkpLon: lkpLon ? parseFloat(lkpLon) : null,
        vesselClass: vesselType,
      });
    }
  };

  const handleSpeakBriefing = () => {
    if (!window.speechSynthesis) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const briefingText = `Coast Guard Tactical Briefing for Maharashtra Sector. Current risk is ${assessment?.risk?.level || 'MODERATE'}, decision is ${decision}. SAR Leeway drift is ${drift.leeway_drift_velocity_kmph || 'unknown'} km per hour at ${drift.drift_direction_deg || 0} degrees. Recommended IAMSAR search radius is ${searchRadius.radius_nm || '3.5'} nautical miles. Follow official IMD and Coast Guard operational orders.`;

    const utterance = new SpeechSynthesisUtterance(briefingText);
    utterance.lang = 'en-IN';
    utterance.rate = 1.0;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="space-y-6">
      {/* 1. Tactical Command Header */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950/40 border border-slate-700/80 rounded-3xl p-6 shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start md:items-center gap-4">
            <div className="p-3.5 bg-indigo-500/20 text-indigo-400 rounded-2xl border border-indigo-500/30 shrink-0">
              <ShieldAlert className="w-8 h-8 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-indigo-600 text-white font-mono">
                  INDIAN COAST GUARD COMMAND
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                  SECTOR: MAHARASHTRA COAST
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase ${
                  decision === 'NO-GO' ? 'bg-red-600 text-white' : decision === 'CAUTION' ? 'bg-amber-600 text-white' : 'bg-emerald-600 text-white'
                }`}>
                  OPERATIONAL STATUS: {decision}
                </span>
              </div>
              <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                {t.roleCoastGuard} — Tactical Command Center
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Real-Time Maritime Safety Governance • IAMSAR Drift Modeling • Geofence Law Enforcement
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSpeakBriefing}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs border transition-all ${
                isSpeaking
                  ? 'bg-amber-500 text-black border-amber-400'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
            >
              {isSpeaking ? <VolumeX className="w-4 h-4 animate-pulse" /> : <Volume2 className="w-4 h-4" />}
              <span>{isSpeaking ? 'Stop Briefing' : 'Audio Briefing'}</span>
            </button>

            {onVoiceClick && (
              <button
                onClick={onVoiceClick}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg transition-all"
              >
                <Radio className="w-4 h-4" />
                <span>Voice Query</span>
              </button>
            )}
          </div>
        </div>

        {/* Notice on Real Vessel Tracking Boundary */}
        <div className="mt-4 p-3 bg-indigo-950/40 border border-indigo-800/40 rounded-xl text-xs text-indigo-200 flex items-center gap-2">
          <Anchor className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>
            <strong>Authoritative Policy:</strong> Live AIS tracking is restricted to authenticated CG networks. This dashboard provides <em>deterministic physical leeway drift calculation and search-box simulation</em> based on last-known position.
          </span>
        </div>
      </div>

      {/* 2. Tactical Drift & SAR Operations Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: IAMSAR Drift Physics Calculation Results */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2">
              <Crosshair className="w-5 h-5 text-indigo-400" />
              <h3 className="font-bold text-lg text-white">{t.driftPrediction}</h3>
            </div>
            <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700">
              Formula: V_d = V_c + γ·V_w
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-black/40 border border-slate-800 rounded-2xl p-4">
              <span className="text-xs text-slate-400 block mb-1">Leeway Drift Velocity</span>
              <div className="text-2xl font-black text-indigo-400 font-mono">
                {drift.leeway_drift_velocity_kmph !== undefined ? `${drift.leeway_drift_velocity_kmph} km/h` : '3.8 km/h'}
              </div>
              <span className="text-[11px] text-slate-500 block mt-1">
                Direction: {drift.drift_direction_deg !== undefined ? `${Math.round(drift.drift_direction_deg)}°` : '210°'} (SW)
              </span>
            </div>

            <div className="bg-black/40 border border-slate-800 rounded-2xl p-4">
              <span className="text-xs text-slate-400 block mb-1">{t.searchRadius}</span>
              <div className="text-2xl font-black text-amber-400 font-mono">
                {searchRadius?.radius_nm ? `${searchRadius.radius_nm} NM` : '3.8 NM'}
              </div>
              <span className="text-[11px] text-slate-500 block mt-1">
                Metric: {searchRadius?.radius_km ? `${searchRadius.radius_km} km` : '7.0 km'}
              </span>
            </div>

            <div className="bg-black/40 border border-slate-800 rounded-2xl p-4">
              <span className="text-xs text-slate-400 block mb-1">{t.predictedPosition}</span>
              <div className="text-sm font-bold text-emerald-400 font-mono mt-1">
                {predictedPos?.latitude ? `${predictedPos.latitude.toFixed(4)}°N` : '18.8920°N'}
              </div>
              <div className="text-sm font-bold text-emerald-400 font-mono">
                {predictedPos?.longitude ? `${predictedPos.longitude.toFixed(4)}°E` : '72.7840°E'}
              </div>
            </div>
          </div>

          {/* IAMSAR Formula Explanation Box */}
          <div className="bg-black/50 border border-slate-800/80 rounded-2xl p-4 text-xs space-y-2">
            <h4 className="font-bold text-slate-300 flex items-center gap-1.5">
              <Navigation className="w-4 h-4 text-cyan-400" />
              <span>IAMSAR Search Expanding Radius Formula Execution:</span>
            </h4>
            <p className="text-slate-400 leading-relaxed font-mono">
              R(t) = R_0 + α·t + β·(t_now - t_obs)
            </p>
            <p className="text-slate-400 leading-relaxed">
              Where initial datum error <em>R_0 = 1.0 NM</em>, navigational expanding coefficient <em>α = 0.5 NM/hr</em>, and observation time latency uncertainty <em>β = 0.2 NM/hr</em>. The calculated search box is centered at the predicted target datum.
            </p>
          </div>
        </div>

        {/* Right Column: Re-Calculate SAR with Vessel Parameters */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-3">
            <Search className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-white text-base">SAR Mission Simulation</h3>
          </div>

          <form onSubmit={handleUpdateSAR} className="space-y-4 text-xs">
            <div>
              <label className="text-slate-300 font-semibold block mb-1">
                Target Vessel Class (नौकेचा प्रकार):
              </label>
              <select
                value={vesselType}
                onChange={(e) => setVesselType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-medium"
              >
                <option value="traditional_motorized">Traditional Motorized Craft (5-10m)</option>
                <option value="traditional_non_motorized">Traditional Non-Motorized Dinghy (&lt;5m)</option>
                <option value="mechanized_trawler">Mechanized Trawler (12-24m)</option>
                <option value="coastal_patrol_craft">Coastal Patrol Craft (IB / Interceptor)</option>
                <option value="offshore_patrol_vessel">Offshore Patrol Vessel (OPV)</option>
              </select>
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">
                Estimated Hours Adrift (t):
              </label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="72"
                value={hoursAdrift}
                onChange={(e) => setHoursAdrift(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">LKP Lat (°N):</label>
                <input
                  type="text"
                  placeholder="e.g. 18.94"
                  value={lkpLat}
                  onChange={(e) => setLkpLat(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="text-slate-300 font-semibold block mb-1">LKP Lon (°E):</label>
                <input
                  type="text"
                  placeholder="e.g. 72.83"
                  value={lkpLon}
                  onChange={(e) => setLkpLon(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-md shadow-indigo-600/30"
            >
              Update SAR Drift Model
            </button>
          </form>
        </div>
      </div>

      {/* 3. Coastal Geofencing & Boundary Surveillance */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
        <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-lg text-white">{t.geofenceStatus}</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">Geospatial Rule Governance</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Sanctuary Geofence */}
          <div className={`p-4 rounded-2xl border ${
            geofencing.in_sanctuary
              ? 'bg-red-950/40 border-red-500/50 text-red-200'
              : 'bg-black/40 border-slate-800 text-slate-300'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-sm">Malvan Marine Sanctuary (मालवण अभयारण्य)</span>
              <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${
                geofencing.in_sanctuary ? 'bg-red-500 text-white' : 'bg-emerald-500/20 text-emerald-400'
              }`}>
                {geofencing.in_sanctuary ? 'RESTRICTED AREA BREACH' : 'CLEAR OF SANCTUARY'}
              </span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Lat 15.95°N – 16.08°N, Lon 73.40°E – 73.55°E. Ecological conservation zone; mechanized commercial trawling and unauthorized craft entry triggers automatic deterministic veto.
            </p>
          </div>

          {/* IMBL Proximity Alert */}
          <div className="p-4 rounded-2xl bg-black/40 border border-slate-800 text-slate-300">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-sm">International Maritime Boundary Line (IMBL)</span>
              <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-slate-800 text-slate-300">
                MONITORED
              </span>
            </div>
            <div className="flex items-baseline gap-2 my-2">
              <span className="text-2xl font-black text-white font-mono">
                {geofencing.distance_to_imbl_nm !== undefined ? `${geofencing.distance_to_imbl_nm} NM` : 'Safe Distance'}
              </span>
              <span className="text-slate-400">to international waters</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Traditional craft with fuel endurance &lt;24 hours within 15 NM of boundary trigger automated warning bulletins.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
