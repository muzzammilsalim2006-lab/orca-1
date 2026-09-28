import React from 'react';
import { Sliders, CheckCircle2, AlertCircle } from 'lucide-react';

export default function RiskFactorsTable({ factors }) {
  if (!factors || factors.length === 0) return null;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
      <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <Sliders className="w-4 h-4 text-cyan-400" />
          Deterministic Risk Engine Breakdown
        </h3>
        <span className="text-xs text-slate-400">Weighted Risk Calculation</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950/80 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
            <tr>
              <th className="px-3 py-2.5 rounded-l-lg">Risk Factor</th>
              <th className="px-3 py-2.5">Observed Value</th>
              <th className="px-3 py-2.5">Sub-Score</th>
              <th className="px-3 py-2.5">Weight</th>
              <th className="px-3 py-2.5">Data Status</th>
              <th className="px-3 py-2.5 rounded-r-lg">Engine Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {factors.map((f) => {
              const isMissing = f.status === 'missing' || f.value === null;
              return (
                <tr key={f.name} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-3 py-3 font-medium text-white flex items-center gap-2">
                    <span>{f.label}</span>
                  </td>

                  <td className="px-3 py-3 font-semibold">
                    {isMissing ? (
                      <span className="text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 font-mono">
                        null (unavailable)
                      </span>
                    ) : (
                      <span className="text-cyan-300 font-mono">
                        {f.value} {f.unit}
                      </span>
                    )}
                  </td>

                  <td className="px-3 py-3 font-mono">
                    {f.score !== null ? (
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                          <div
                            className={`h-full ${
                              f.score > 60 ? 'bg-rose-500' : f.score > 35 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, f.score)}%` }}
                          />
                        </div>
                        <span className="font-bold">{f.score}</span>
                      </div>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>

                  <td className="px-3 py-3 text-slate-400 font-mono">
                    {(f.weight * 100).toFixed(0)}%
                  </td>

                  <td className="px-3 py-3">
                    {f.status === 'ok' ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-medium">
                        <CheckCircle2 className="w-3 h-3" /> OK
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 font-medium">
                        <AlertCircle className="w-3 h-3" /> Missing
                      </span>
                    )}
                  </td>

                  <td className="px-3 py-3 text-slate-400 max-w-xs truncate">
                    {f.note || '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
