import React, { useState } from 'react';
import { MapPin, Navigation, Search, AlertCircle, ShieldAlert, Compass } from 'lucide-react';
import {
  MAHARASHTRA_PRESETS,
  MAHARASHTRA_DISTRICTS,
  checkMaharashtraScope,
} from '../config/maharashtraRegions';

export default function LocationSelector({
  lat,
  lon,
  setLat,
  setLon,
  label,
  setLabel,
  onAssess,
  loading,
  outOfScopeError,
  setOutOfScopeError,
}) {
  const [selectedVessel, setSelectedVessel] = useState('traditional_motorized');
  const [forecastHorizon, setForecastHorizon] = useState(3.0);

  const handleSelectPreset = (preset) => {
    if (setOutOfScopeError) setOutOfScopeError(null);
    setLat(preset.lat.toString());
    setLon(preset.lon.toString());
    setLabel(preset.label);
    onAssess(preset.lat, preset.lon, preset.label, selectedVessel, forecastHorizon);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const scopeCheck = checkMaharashtraScope(lat, lon);

    if (!scopeCheck.inScope) {
      if (setOutOfScopeError) {
        setOutOfScopeError(scopeCheck.message);
      }
      return;
    }

    if (setOutOfScopeError) setOutOfScopeError(null);
    const assignedLabel = label || `${scopeCheck.district} (${parseFloat(lat).toFixed(4)}, ${parseFloat(lon).toFixed(4)})`;
    onAssess(lat, lon, assignedLabel, selectedVessel, forecastHorizon);
  };

  // Check current coordinate scope dynamically for visual feedback
  const liveScope = checkMaharashtraScope(lat, lon);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-sm space-y-4">
      {/* Scope Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
            Assessment Target & Regional Scope
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] px-2.5 py-1 rounded-full font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
            Scope: Maharashtra Coastal Waters
          </span>
          <span className="text-[10px] text-slate-400 font-mono hidden md:inline">
            7 Coastal Districts
          </span>
        </div>
      </div>

      {/* Supported Districts Pill Carousel */}
      <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5 px-1">
          <span className="font-medium text-slate-300">Supported Maharashtra Coastal Districts (SIH MVP):</span>
          <span className="text-cyan-400 font-mono text-[10px]">7 Districts Operational</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {MAHARASHTRA_DISTRICTS.map((dist) => (
            <span
              key={dist.id}
              className="text-[11px] px-2 py-0.5 rounded-md bg-slate-900 text-slate-300 border border-slate-800 flex items-center gap-1"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
              <span>{dist.districtName}</span>
              <span className="text-slate-500 text-[10px]">({dist.marathiName})</span>
            </span>
          ))}
        </div>
      </div>

      {/* Maharashtra Quick Presets */}
      <div>
        <label className="text-xs text-slate-400 block mb-2 font-medium">
          Maharashtra Coastal Presets (Quick Access):
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {MAHARASHTRA_PRESETS.map((preset) => {
            const isSelected =
              Math.abs(parseFloat(lat) - preset.lat) < 0.001 &&
              Math.abs(parseFloat(lon) - preset.lon) < 0.001;

            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                className={`p-2.5 rounded-xl text-left text-xs font-medium border transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'bg-cyan-500/20 text-cyan-200 border-cyan-500/50 shadow-md shadow-cyan-500/10'
                    : 'bg-slate-950/70 text-slate-300 border-slate-800 hover:bg-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-1 text-cyan-400 mb-1 font-semibold">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{preset.label}</span>
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  {preset.tag}
                </div>
                <div className="text-[9px] text-slate-500 mt-1 font-mono">
                  {preset.lat.toFixed(2)}°N, {preset.lon.toFixed(2)}°E
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Out of Scope Warning Alert */}
      {outOfScopeError && (
        <div
          id="out-of-scope-banner"
          className="bg-amber-950/80 border-2 border-amber-500/80 rounded-xl p-4 shadow-xl text-amber-200 flex items-start gap-3 animate-fade-in"
        >
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300">
              Outside Supported Operational Scope
            </h4>
            <p className="text-xs text-amber-200/90 leading-relaxed font-medium">
              {outOfScopeError}
            </p>
            <p className="text-[11px] text-amber-300/80 pt-1">
              Please choose a location along the Maharashtra coastal shelf (e.g. Mumbai, Palghar, Raigad, Ratnagiri, or Sindhudurg) using the presets above or by clicking on the map.
            </p>
          </div>
        </div>
      )}

      {/* Custom Coordinate Form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">
              Latitude (°N) <span className="text-cyan-400">[15.65° - 20.35°N]</span>
            </label>
            <input
              type="number"
              step="any"
              min="-90"
              max="90"
              value={lat}
              onChange={(e) => {
                setLat(e.target.value);
                if (outOfScopeError && setOutOfScopeError) setOutOfScopeError(null);
              }}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors font-mono"
              placeholder="e.g. 18.9438"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">
              Longitude (°E) <span className="text-cyan-400">[72.00° - 73.95°E]</span>
            </label>
            <input
              type="number"
              step="any"
              min="-180"
              max="180"
              value={lon}
              onChange={(e) => {
                setLon(e.target.value);
                if (outOfScopeError && setOutOfScopeError) setOutOfScopeError(null);
              }}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors font-mono"
              placeholder="e.g. 72.8360"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Vessel Operational Class</label>
            <select
              value={selectedVessel}
              onChange={(e) => setSelectedVessel(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors"
            >
              <option value="traditional_motorized">Traditional Motorized Craft (&lt;10m)</option>
              <option value="traditional_non_motorized">Non-Motorized Country Craft</option>
              <option value="mechanized_trawler">Mechanized Coastal Trawler (10-15m)</option>
              <option value="multiday_gillnetter">Multiday Deep-Sea Gillnetter</option>
              <option value="patrol_craft">Coastal Patrol / SAR Craft</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Forecast Horizon</label>
            <select
              value={forecastHorizon}
              onChange={(e) => setForecastHorizon(parseFloat(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors"
            >
              <option value={1.0}>1 Hour (Immediate Departure)</option>
              <option value={3.0}>3 Hours (Standard Horizon)</option>
              <option value={6.0}>6 Hours (Half-Day Trip)</option>
              <option value={12.0}>12 Hours (Full-Day Mission)</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
          <div className="text-xs flex items-center gap-2">
            <Compass className="w-4 h-4 text-cyan-400 shrink-0" />
            {liveScope.inScope ? (
              <span className="text-emerald-400 font-medium">
                Within scope: <strong>{liveScope.district}</strong>
              </span>
            ) : (
              <span className="text-amber-400 font-medium flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                Target coordinates fall outside Maharashtra operational waters
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold px-6 py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                <span>Evaluating Pipeline...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Assess Maharashtra Coastal Risk</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
