import React from 'react';
import { Compass, Navigation, Wind, Activity, Target } from 'lucide-react';

export default function DriftSarCard({ drift, predictedPosition, searchRadius, horizonH = 3.0 }) {
  if (!drift) return null;

  const driftVector = drift.drift || {};
  const currentVel = drift.current_velocity || {};
  const windVel = drift.wind_velocity || {};
  const isComputed = driftVector.status === 'COMPUTED';

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
            Surface Drift & SAR Search Intelligence
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono px-2 py-0.5 rounded font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            Vector Status: {driftVector.status || 'ACTIVE'}
          </span>
          <span className="text-[11px] text-slate-400 font-mono">
            Horizon: {horizonH}h
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Ocean Current Vector */}
        <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-medium">Surface Current (Uc)</span>
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <p className="text-lg font-bold text-white font-mono">
            {currentVel.speed_kmph !== null && currentVel.speed_kmph !== undefined
              ? `${currentVel.speed_kmph} km/h`
              : 'N/A'}
          </p>
          <p className="text-[11px] text-slate-400">
            Bearing: <strong className="text-cyan-300 font-mono">{currentVel.direction_deg !== null && currentVel.direction_deg !== undefined ? `${currentVel.direction_deg}°` : 'N/A'}</strong>
          </p>
        </div>

        {/* Leeway Wind Vector */}
        <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-medium">Wind Leeway (Uw)</span>
            <Wind className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <p className="text-lg font-bold text-white font-mono">
            {windVel.speed_kmph !== null && windVel.speed_kmph !== undefined
              ? `${windVel.speed_kmph} km/h`
              : 'N/A'}
          </p>
          <p className="text-[11px] text-slate-400">
            Leeway: <strong className="text-blue-300 font-mono">{windVel.leeway_factor ? `${Math.round(windVel.leeway_factor * 100)}%` : '3%'}</strong>
          </p>
        </div>

        {/* Total Net Drift Vector */}
        <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-medium">Net Drift Vector</span>
            <Navigation className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <p className="text-lg font-bold text-amber-300 font-mono">
            {driftVector.speed_knots !== null && driftVector.speed_knots !== undefined
              ? `${driftVector.speed_knots} kts`
              : 'N/A'}
            <span className="text-xs text-slate-400 ml-1">
              ({driftVector.speed_kmph || '0'} km/h)
            </span>
          </p>
          <p className="text-[11px] text-slate-400">
            Set (Direction): <strong className="text-amber-400 font-mono">{driftVector.direction_deg !== null && driftVector.direction_deg !== undefined ? `${driftVector.direction_deg}°` : 'N/A'}</strong>
          </p>
        </div>
      </div>

      {/* Predicted Position & IAMSAR Search Radius */}
      {isComputed && (
        <div className="bg-slate-950/90 rounded-xl p-4 border border-amber-500/30 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-rose-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Predicted Datum Position (+{horizonH} Hours)
              </h4>
            </div>
            {predictedPosition?.displacement_nm !== undefined && (
              <span className="text-xs font-mono text-cyan-300">
                Displacement: <strong>{predictedPosition.displacement_nm} NM</strong>
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase">Datum Coordinates</span>
              <p className="text-white font-mono font-bold mt-0.5 text-sm">
                {predictedPosition?.latitude?.toFixed(4)}° N, {predictedPosition?.longitude?.toFixed(4)}° E
              </p>
              <p className="text-[10px] text-slate-400 mt-1">
                Projected using current + 3% leeway vector integration
              </p>
            </div>

            <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase">
                IAMSAR Search Radius (R)
              </span>
              <p className="text-amber-400 font-mono font-bold mt-0.5 text-sm">
                {searchRadius?.radius_nm ? `${searchRadius.radius_nm} Nautical Miles` : '1.0 NM (Default)'}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">
                Includes 30% IAMSAR drift uncertainty factor (dv * 0.3)
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
