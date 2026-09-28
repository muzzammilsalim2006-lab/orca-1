import React from 'react';
import { Waves, Compass, Activity, ThermometerSun } from 'lucide-react';

export default function OceanCard({ ocean }) {
  if (!ocean) {
    return (
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl text-center text-slate-400">
        <Waves className="w-8 h-8 mx-auto text-slate-600 mb-2" />
        <p className="text-xs">Ocean & marine metrics unavailable. Treated as unknown by safety engine.</p>
      </div>
    );
  }

  const {
    wave_height_m,
    wave_period_s,
    swell_height_m,
    swell_period_s,
    sea_surface_temperature_c,
    ocean_current_speed_kmph,
    source,
  } = ocean;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
      <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <Waves className="w-4 h-4 text-cyan-400" />
          Ocean State & Wave Parameters
        </h3>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] px-2 py-0.5 rounded font-mono font-semibold border ${
            source?.data_status === 'LIVE'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
          }`}>
            {source?.data_status || 'LIVE'}
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            Source: {source?.provider || 'Open-Meteo Marine'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Wave Height */}
        <div className="bg-slate-950/70 border border-slate-800 p-3.5 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium">Wave Height</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-lg font-bold text-white">
            {wave_height_m !== null ? `${wave_height_m} m` : 'N/A'}
          </p>
          {wave_period_s !== null && (
            <p className="text-[10px] text-slate-400 mt-0.5">Period: {wave_period_s} s</p>
          )}
        </div>

        {/* Swell Height */}
        <div className="bg-slate-950/70 border border-slate-800 p-3.5 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium">Swell Height</span>
            <Waves className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-lg font-bold text-white">
            {swell_height_m !== null ? `${swell_height_m} m` : 'N/A'}
          </p>
          {swell_period_s !== null && (
            <p className="text-[10px] text-slate-400 mt-0.5">Period: {swell_period_s} s</p>
          )}
        </div>

        {/* Ocean Current Speed */}
        <div className="bg-slate-950/70 border border-slate-800 p-3.5 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium">Ocean Current</span>
            <Compass className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-lg font-bold text-white">
            {ocean_current_speed_kmph !== null ? `${ocean_current_speed_kmph} km/h` : 'N/A'}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">Surface Drift</p>
        </div>

        {/* Sea Surface Temp */}
        <div className="bg-slate-950/70 border border-slate-800 p-3.5 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium">Sea Temp (SST)</span>
            <ThermometerSun className="w-4 h-4 text-orange-400" />
          </div>
          <p className="text-lg font-bold text-white">
            {sea_surface_temperature_c !== null ? `${sea_surface_temperature_c} °C` : 'N/A'}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">Coastal Water</p>
        </div>
      </div>
    </div>
  );
}
