import React from 'react';
import { Cpu, ShieldCheck, AlertCircle, BookOpen } from 'lucide-react';

export default function SystemMetaCard({ systemInfo }) {
  const version = systemInfo?.version || '0.2.0';
  const status = systemInfo?.status || 'OPERATIONAL';
  const engineStatus = systemInfo?.deterministic_engine?.status || 'ONLINE';
  const ruleGovernance = systemInfo?.deterministic_engine?.rule_governance || 'DETERMINISTIC';

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
            ORCA System Architecture & Operational Boundary
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono px-2 py-0.5 rounded font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            SYSTEM: {status}
          </span>
          <span className="text-[11px] text-slate-400 font-mono">
            API v{version}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
          <span className="text-slate-400 text-[10px] uppercase font-semibold block">Deterministic Engine</span>
          <p className="text-emerald-400 font-bold font-mono mt-0.5 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            {engineStatus}
          </p>
          <p className="text-[10px] text-slate-500 mt-1">Rule Governance: {ruleGovernance}</p>
        </div>

        <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
          <span className="text-slate-400 text-[10px] uppercase font-semibold block">AI Override Allowed</span>
          <p className="text-rose-400 font-bold font-mono mt-0.5">
            FALSE (STRICTLY FORBIDDEN)
          </p>
          <p className="text-[10px] text-slate-500 mt-1">LLM cannot override safety veto</p>
        </div>

        <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
          <span className="text-slate-400 text-[10px] uppercase font-semibold block">MVP Geographic Scope</span>
          <p className="text-cyan-300 font-bold mt-0.5">
            Maharashtra Coast Only
          </p>
          <p className="text-[10px] text-slate-500 mt-1">7 coastal districts operational</p>
        </div>

        <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
          <span className="text-slate-400 text-[10px] uppercase font-semibold block">API Documentation</span>
          <div className="flex items-center gap-2 mt-1">
            <a
              href="/docs"
              target="_blank"
              rel="noreferrer"
              className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 font-mono text-[11px]"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Swagger UI</span>
            </a>
            <span className="text-slate-600">|</span>
            <a
              href="/openapi.json"
              target="_blank"
              rel="noreferrer"
              className="text-slate-400 hover:text-white font-mono text-[11px]"
            >
              JSON
            </a>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">OpenAPI 3.0.3 Contract</p>
        </div>
      </div>

      {/* Explicit Provider Failure Semantics Warning */}
      <div className="bg-slate-950/80 rounded-xl p-3.5 border border-slate-800 space-y-1.5 text-xs">
        <div className="flex items-center gap-2 text-amber-400 font-semibold text-[11px] uppercase tracking-wider">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Explicit Provider Failure Semantics</span>
        </div>
        <p className="text-slate-300 text-[11px] leading-relaxed">
          <strong className="text-white">CRITICAL SAFETY PRINCIPLE:</strong> Provider failure or unconfigured credentials (<code>UNAVAILABLE</code> / <code>CONFIG_REQUIRED</code>) is <strong>never</strong> interpreted as proof that conditions are safe. If warning or ocean telemetry is unreachable, sea state is treated as unconfirmed and missing inputs are strictly penalized by the deterministic risk engine.
        </p>
      </div>

      {/* Remaining Limitations Banner */}
      <div className="bg-slate-950/60 rounded-xl p-3.5 border border-slate-800/80 space-y-1 text-[11px] text-slate-400">
        <span className="text-slate-300 font-semibold uppercase text-[10px] block">
          SIH 2026 Reference MVP Limitations:
        </span>
        <ul className="list-disc list-inside space-y-0.5">
          <li>ORCA SIH MVP is geographically restricted to Maharashtra coastal waters; out-of-region coordinates are not evaluated.</li>
          <li>Local sea conditions vary at beach and inlet level; this represents regional deterministic intelligence.</li>
          <li>Forecast uncertainty increases past 12-24 hours; refresh frequently before setting sail.</li>
          <li>Advisory tool only. Mariners must always heed official IMD/NDMA bulletins and Indian Coast Guard directives.</li>
        </ul>
      </div>
    </div>
  );
}
