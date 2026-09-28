import React from 'react';
import { Shield, AlertTriangle, CheckCircle2, Fish, MapPin, Anchor } from 'lucide-react';

export default function GeofencePfzCard({ geofencing, location: _location }) {
  if (!geofencing) return null;

  const {
    distance_to_boundary_nm,
    minimum_safe_boundary_distance_nm = 3.0,
    protected_area_status,
    imbl_boundary_status,
    boundary_veto,
    alerts = [],
    pfz_exposure,
  } = geofencing;

  const isMpaViolation = protected_area_status === 'INSIDE_RESTRICTED_MPA';
  const isImblCritical = imbl_boundary_status === 'CRITICAL_IMBL_PROXIMITY';

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
            Geofence Proximity & Marine Boundaries
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-[11px] font-mono px-2 py-0.5 rounded font-bold border ${
              boundary_veto
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
            }`}
          >
            {boundary_veto ? 'PROXIMITY ALERT' : 'GEOFENCE CLEAR'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Coastal Baseline Distance */}
        <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-medium">Baseline Distance (dg)</span>
            <Anchor className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <p className="text-lg font-bold text-white font-mono">
            {distance_to_boundary_nm !== null && distance_to_boundary_nm !== undefined
              ? `${distance_to_boundary_nm} NM`
              : 'N/A'}
          </p>
          <p className="text-[11px] text-slate-400">
            Safe Margin: <strong className="text-slate-300 font-mono">{minimum_safe_boundary_distance_nm} NM</strong>
          </p>
        </div>

        {/* Marine Protected Area Check */}
        <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-medium">Malvan Sanctuary (MPA)</span>
            {isMpaViolation ? (
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            )}
          </div>
          <p
            className={`text-sm font-bold font-mono ${
              isMpaViolation ? 'text-rose-400' : 'text-emerald-400'
            }`}
          >
            {isMpaViolation ? 'INSIDE RESTRICTED MPA' : 'CLEAR OF MPA'}
          </p>
          <p className="text-[10px] text-slate-400">
            Sindhudurg Coral Biodiversity Zone
          </p>
        </div>

        {/* IMBL Proximity Check */}
        <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-medium">IMBL Border Status</span>
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <p
            className={`text-sm font-bold font-mono ${
              isImblCritical ? 'text-rose-400' : 'text-emerald-400'
            }`}
          >
            {imbl_boundary_status || 'CLEAR'}
          </p>
          <p className="text-[10px] text-slate-400">
            International Maritime Boundary Line
          </p>
        </div>
      </div>

      {/* INCOIS Potential Fishing Zone (PFZ) Advisory Banner */}
      {pfz_exposure && (
        <div className="bg-slate-950/90 rounded-xl p-3.5 border border-cyan-500/30 flex items-start gap-3">
          <Fish className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-cyan-300 uppercase">
                INCOIS Potential Fishing Zone (PFZ)
              </span>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                  pfz_exposure.is_inside
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {pfz_exposure.is_inside ? 'INSIDE PFZ CORRIDOR' : 'OUTSIDE ACTIVE PFZ'}
              </span>
            </div>
            <p className="text-slate-300 text-xs leading-relaxed">
              {pfz_exposure.advisory || 'Pelagic chlorophyll & thermal front data monitored via INCOIS bulletins.'}
            </p>
          </div>
        </div>
      )}

      {/* Geofence Alert Items */}
      {alerts && alerts.length > 0 && (
        <div className="space-y-1.5 pt-1">
          {alerts.map((alert, idx) => (
            <div
              key={idx}
              className="bg-amber-950/60 border border-amber-500/40 rounded-lg p-2.5 text-xs text-amber-200 flex items-center gap-2"
            >
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{alert}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
