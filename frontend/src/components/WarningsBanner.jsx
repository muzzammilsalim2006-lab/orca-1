import React from 'react';
import { ShieldAlert, AlertTriangle, Radio } from 'lucide-react';

export default function WarningsBanner({ warnings }) {
  if (!warnings || warnings.length === 0) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <ShieldAlert className="w-4 h-4 text-emerald-400" />
          <span>No official IMD coastal warnings or cyclone alerts active for this region.</span>
        </div>
        <span className="text-[10px] text-slate-500 uppercase">Status: Clear</span>
      </div>
    );
  }

  return (
    <div className="bg-rose-950/90 border-2 border-rose-500/80 rounded-2xl p-4 shadow-xl shadow-rose-950/60 animate-pulse">
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-rose-500/30">
        <Radio className="w-5 h-5 text-rose-400 animate-spin" />
        <h3 className="text-xs font-black uppercase text-rose-200 tracking-wider">
          OFFICIAL MARINE & CYCLONE WARNING BULLETIN ({warnings.length} Active)
        </h3>
      </div>

      <div className="space-y-2">
        {warnings.map((w, idx) => (
          <div key={w.id || idx} className="bg-slate-950/80 rounded-xl p-3 border border-rose-500/40">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-bold text-rose-300 uppercase px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/40">
                {w.type} • {w.severity}
              </span>
              <span className="text-[11px] text-slate-400">Issued by: {w.issued_by || 'IMD'}</span>
            </div>
            <p className="text-sm font-semibold text-white mt-1">{w.headline}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
