import React from 'react';
import { MapPin, Navigation, Search, Sparkles, AlertTriangle } from 'lucide-react';

const PRESET_LOCATIONS = [
  { label: 'Chennai Coast', lat: 13.0827, lon: 80.2707, tag: 'Moderate Demo' },
  { label: 'Kochi Port', lat: 9.9312, lon: 76.2673, tag: 'Cyclone Warning Demo' },
  { label: 'Visakhapatnam (Vizag)', lat: 17.6868, lon: 83.2185, tag: 'Bay of Bengal' },
  { label: 'Mumbai Harbor', lat: 18.9438, lon: 72.8360, tag: 'Marathi Region' },
  { label: 'Goa Coast (Panaji)', lat: 15.4989, lon: 73.8278, tag: 'Marathi Region' },
];

export default function LocationSelector({
  lat,
  lon,
  setLat,
  setLon,
  label,
  setLabel,
  onAssess,
  loading,
  demoMode,
  setDemoMode,
}) {
  const handleSelectPreset = (preset) => {
    setLat(preset.lat);
    setLon(preset.lon);
    setLabel(preset.label);
    onAssess(preset.lat, preset.lon, preset.label);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onAssess(lat, lon, label);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <Navigation className="w-4 h-4 text-cyan-400" />
          Location & Assessment Target
        </h2>
        <span className="text-xs text-slate-400">Indian Coastal Waters</span>
      </div>

      {/* Preset Buttons */}
      <div className="mb-4">
        <label className="text-xs text-slate-400 block mb-2 font-medium">Quick Demo Preset Locations:</label>
        <div className="flex flex-wrap gap-2">
          {PRESET_LOCATIONS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => handleSelectPreset(preset)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all flex items-center gap-1.5 ${
                parseFloat(lat) === preset.lat && parseFloat(lon) === preset.lon
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-sm shadow-cyan-500/20'
                  : 'bg-slate-800/80 text-slate-300 border-slate-700/60 hover:bg-slate-800 hover:border-slate-600'
              }`}
            >
              <MapPin className="w-3.5 h-3.5 text-cyan-400" />
              <span>{preset.label}</span>
              {preset.tag.includes('Cyclone') && (
                <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] px-1.5 py-0.5 rounded-md font-semibold">
                  Cyclone Alert
                </span>
              )}
              {preset.tag.includes('Marathi') && (
                <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] px-1.5 py-0.5 rounded-md font-semibold">
                  मराठी
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Coordinate Form */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-slate-400 block mb-1">Latitude (°N)</label>
          <input
            type="number"
            step="any"
            min="-90"
            max="90"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            required
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors"
            placeholder="e.g. 13.0827"
          />
        </div>

        <div>
          <label className="text-xs text-slate-400 block mb-1">Longitude (°E)</label>
          <input
            type="number"
            step="any"
            min="-180"
            max="180"
            value={lon}
            onChange={(e) => setLon(e.target.value)}
            required
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors"
            placeholder="e.g. 80.2707"
          />
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold px-4 py-2 rounded-xl text-sm transition-all shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                <span>Analyzing Risk...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Assess Marine Risk</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
