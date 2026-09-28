import React from 'react';
import { Radio, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function WarningsBanner({ warnings, warningSummary }) {
  const status = warningSummary?.status || (warnings && warnings.length > 0 ? 'ACTIVE' : 'NONE');

  if (status === 'UNAVAILABLE') {
    return (
      <div id="warnings-banner-unavailable" className="bg-slate-900/80 border border-amber-500/30 rounded-xl p-3.5 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-2.5 text-xs text-amber-300">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Official IMD Coastal Warning bulletin service currently unreachable; check local harbor signals & civil advisories.</span>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase whitespace-nowrap">
          WARNING: UNAVAILABLE
        </span>
      </div>
    );
  }

  if (status === 'NONE' || !warnings || warnings.length === 0) {
    return (
      <div id="warnings-banner-clear" className="bg-slate-900/60 border border-emerald-500/30 rounded-xl p-3.5 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-2.5 text-xs text-slate-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>No official IMD coastal warnings, heavy rainfall, or cyclone alerts active for this coastal district.</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase whitespace-nowrap">
            IMD: GREEN
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase whitespace-nowrap">
            STATUS: CLEAR
          </span>
        </div>
      </div>
    );
  }

  return (
    <div id="warnings-banner-active" className="bg-rose-950/90 border-2 border-rose-500/80 rounded-2xl p-4 shadow-xl shadow-rose-950/60 animate-pulse">
      <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-rose-500/30">
        <div className="flex items-center gap-2">
          <Radio className="w-5 h-5 text-rose-400 animate-spin" />
          <h3 className="text-xs font-black uppercase text-rose-200 tracking-wider">
            OFFICIAL IMD MARINE & CYCLONE WARNING BULLETIN ({warnings.length} Active)
          </h3>
        </div>
        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-500 text-white uppercase">
          WARNING ACTIVE
        </span>
      </div>

      <div className="space-y-2.5">
        {warnings.map((w, idx) => {
          const colorCode = w.official_color_code || (w.severity === 'alert' ? 'RED' : w.severity === 'warning' ? 'ORANGE' : 'YELLOW');
          const colorBg =
            colorCode === 'RED'
              ? 'bg-red-500/20 text-red-300 border-red-500/40'
              : colorCode === 'ORANGE'
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              : 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';

          return (
            <div key={w.id || idx} className="bg-slate-950/90 rounded-xl p-3.5 border border-rose-500/40">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs mb-1.5">
                <div className="flex items-center gap-2">
                  <span className={`font-bold uppercase px-2 py-0.5 rounded border text-[11px] ${colorBg}`}>
                    {w.warning_type || 'Coastal Warning'} • {w.severity?.toUpperCase()} ({colorCode})
                  </span>
                  {w.affected_area && (
                    <span className="text-[11px] text-slate-300 font-medium">
                      Area: {w.affected_area}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 font-mono">Source: {w.source || 'IMD'}</span>
              </div>
              <p className="text-sm font-semibold text-white mt-1 leading-snug">{w.headline}</p>
              {w.warning_text && w.warning_text !== w.headline && (
                <p className="text-xs text-slate-300 mt-1 leading-relaxed bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                  {w.warning_text}
                </p>
              )}
              {(w.issued_at || w.valid_until) && (
                <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-400 font-mono mt-2 pt-1 border-t border-slate-800/80">
                  {w.issued_at && <span>Issued: {new Date(w.issued_at).toLocaleString()}</span>}
                  {w.valid_until && <span>Valid Until: {new Date(w.valid_until).toLocaleString()}</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
