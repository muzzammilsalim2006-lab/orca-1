import React from 'react';
import { Database, AlertTriangle } from 'lucide-react';

export default function SourceHealthCard({ providers, sources, metadata, time }) {
  const providerData = providers || sources;
  if (!providerData) return null;

  const providerList = [
    { key: 'open_meteo', defaultName: 'Open-Meteo Global Marine', ...(providerData.open_meteo) },
    { key: 'imd', defaultName: 'IMD National Marine & Cyclone Service', ...(providerData.imd) },
    { key: 'incois', defaultName: 'INCOIS Ocean State Forecast / PFZ', ...(providerData.incois) },
    { key: 'mosdac', defaultName: 'ISRO MOSDAC Satellite Ocean Data', ...(providerData.mosdac) },
  ];

  const getStatusBadge = (status) => {
    switch (status) {
      case 'LIVE':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            LIVE
          </span>
        );
      case 'CACHED':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
            CACHED
          </span>
        );
      case 'DEMO':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
            DEMO
          </span>
        );
      case 'CONFIG_REQUIRED':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
            CONFIG_REQUIRED
          </span>
        );
      case 'ERROR':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
            ERROR
          </span>
        );
      case 'UNAVAILABLE':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
            UNAVAILABLE
          </span>
        );
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
          <Database className="w-4 h-4 text-cyan-400" />
          Multi-Source Provider Health & Telemetry Fabric
        </h3>
        <div className="flex items-center gap-3 text-xs">
          {metadata?.data_completeness !== undefined && (
            <span className="text-slate-400">
              Completeness: <strong className="text-white font-mono">{Math.round(metadata.data_completeness * 100)}%</strong>
            </span>
          )}
          {time?.freshness && (
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-slate-950 text-slate-300 border border-slate-800">
              Freshness: {time.freshness}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {providerList.map((src) => {
          const displayName = src.name || src.defaultName;
          const status = src.status || 'UNAVAILABLE';

          return (
            <div
              key={src.key}
              className="bg-slate-950/70 border border-slate-800/80 p-3.5 rounded-xl flex flex-col justify-between space-y-2"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <span className="font-semibold text-xs text-white leading-tight">
                    {displayName}
                  </span>
                  {getStatusBadge(status)}
                </div>

                {src.note && (
                  <p className="text-[11px] text-slate-400 leading-normal">{src.note}</p>
                )}

                {src.error && (
                  <p className="text-[10px] text-rose-300/90 font-mono leading-tight mt-1.5 bg-rose-500/10 p-1.5 rounded border border-rose-500/20">
                    {src.error}
                  </p>
                )}
              </div>

              <div className="pt-2 border-t border-slate-800/60 text-[10px] text-slate-400 space-y-0.5 font-mono">
                <div className="flex items-center justify-between">
                  <span>Latency:</span>
                  <span className="text-slate-300">
                    {src.latency_ms !== null && src.latency_ms !== undefined ? `${src.latency_ms} ms` : 'Not measured'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Last Checked:</span>
                  <span className="text-slate-300">
                    {src.last_retrieval
                      ? new Date(src.last_retrieval).toLocaleTimeString()
                      : src.last_retrieval_attempt
                      ? new Date(src.last_retrieval_attempt).toLocaleTimeString()
                      : 'Never'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-[11px] text-slate-400 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
        <span>
          <strong>Provider Failure Semantics:</strong> A status of <code>UNAVAILABLE</code> or <code>CONFIG_REQUIRED</code> indicates an unreachable or unconfigured source; it is never taken as proof that sea conditions are safe.
        </span>
      </div>
    </div>
  );
}
