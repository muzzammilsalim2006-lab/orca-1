import React from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertOctagon,
  CheckCircle2,
  XCircle,
  Info,
  Anchor,
  Clock,
  Zap,
} from 'lucide-react';

export default function RiskBadgeCard({ assessment, locationName }) {
  if (!assessment) return null;

  const {
    decision = 'UNKNOWN',
    deterministic_decision,
    veto = {},
    risk = {},
    confidence = {},
    mode = 'live',
    is_demo = false,
    assessed_at: _assessed_at,
    vessel_class,
    forecast_horizon_h,
    location = {},
  } = assessment;

  const finalDecision = deterministic_decision || decision || 'UNKNOWN';
  const isVeto = veto.is_veto || veto.triggered || false;
  const vetoReasons = veto.reasons || [];
  const vetoCodes = veto.reason_codes || [];

  // Decision UI configuration
  const decisionConfig = {
    GO: {
      bg: 'from-emerald-950/70 via-slate-900 to-slate-950',
      border: 'border-emerald-500/50',
      badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60',
      badgeText: 'text-emerald-400',
      icon: ShieldCheck,
      title: 'GO — CONDITIONS MANAGEABLE',
      sub: 'Deterministic checks passed for selected vessel class within Maharashtra coastal waters.',
    },
    CAUTION: {
      bg: 'from-amber-950/70 via-slate-900 to-slate-950',
      border: 'border-amber-500/50',
      badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/60',
      badgeText: 'text-amber-400',
      icon: ShieldAlert,
      title: 'CAUTION — ELEVATED RISK',
      sub: 'Sub-threshold warnings or deteriorating sea state observed. Close monitoring advised.',
    },
    'NO-GO': {
      bg: 'from-rose-950/80 via-slate-900 to-slate-950',
      border: 'border-rose-500/60',
      badgeBg: 'bg-rose-500/25 text-rose-300 border-rose-500/70',
      badgeText: 'text-rose-400',
      icon: AlertOctagon,
      title: 'NO-GO — SAFETY VETO ACTIVE',
      sub: 'Sea operations suspended. Deterministic threshold exceeded or official warning in effect.',
    },
  }[finalDecision] || {
    bg: 'from-slate-900 to-slate-950',
    border: 'border-slate-800',
    badgeBg: 'bg-slate-800 text-slate-300 border-slate-700',
    badgeText: 'text-slate-300',
    icon: Info,
    title: 'STATUS UNCONFIRMED',
    sub: 'Assessment pending or insufficient data streams.',
  };

  const DecisionIcon = decisionConfig.icon;
  const score = typeof risk.score === 'number' ? risk.score : 0;
  const riskIndex = typeof risk.risk_index === 'number' ? risk.risk_index : (score / 100);
  const confidenceScore = typeof confidence.score === 'number' ? Math.round(confidence.score * 100) : null;

  return (
    <div
      id="deterministic-risk-card"
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${decisionConfig.bg} border ${decisionConfig.border} p-6 shadow-2xl transition-all duration-300 space-y-5`}
    >
      {/* Background Accent Glow */}
      <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-cyan-500/5 blur-3xl pointer-events-none"></div>

      {/* Top Banner: Decision, Target Location & Mode */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span
              id="deterministic-decision-badge"
              className={`px-3 py-1 rounded-full text-xs font-black tracking-wider border flex items-center gap-1.5 uppercase ${decisionConfig.badgeBg}`}
            >
              <DecisionIcon className="w-4 h-4" />
              DECISION: {finalDecision}
            </span>

            <span
              id="veto-status-badge"
              className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold border flex items-center gap-1 ${
                isVeto
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 animate-pulse'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              }`}
            >
              {isVeto ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              VETO: {isVeto ? 'TRIGGERED' : 'CLEAR'}
            </span>

            <span className="text-[11px] px-2.5 py-0.5 rounded-full border bg-slate-900 text-slate-300 border-slate-700">
              {is_demo ? '■ DEMO DATASET' : mode === 'cached' ? '▲ CACHED OBS' : '● LIVE MARINE DATA'}
            </span>
          </div>

          <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>{location.label || locationName || 'Maharashtra Coastal Waters'}</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
            <span>Deterministic Safety Governance</span>
            <span>•</span>
            <span className="font-mono text-[11px] text-cyan-400">
              {location.latitude ? `${location.latitude.toFixed(4)}°N, ${location.longitude.toFixed(4)}°E` : ''}
            </span>
          </p>
        </div>

        {/* Operational Context Chips */}
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          {vessel_class && (
            <div className="bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800 flex items-center gap-1.5 text-slate-300">
              <Anchor className="w-3.5 h-3.5 text-cyan-400" />
              <span>Vessel: <strong className="text-white capitalize">{vessel_class.replace(/_/g, ' ')}</strong></span>
            </div>
          )}
          {forecast_horizon_h && (
            <div className="bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800 flex items-center gap-1.5 text-slate-300">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>Horizon: <strong className="text-white">{forecast_horizon_h}h</strong></span>
            </div>
          )}
        </div>
      </div>

      {/* Metrics Row: Gauge, Risk Index, and Confidence */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
        {/* Left: Gauge Circle */}
        <div className="md:col-span-4 flex items-center gap-4 bg-slate-950/70 p-4 rounded-xl border border-slate-800">
          <div className="relative flex items-center justify-center shrink-0">
            <svg className="w-20 h-20 transform -rotate-90">
              <circle
                cx="40"
                cy="40"
                r="32"
                stroke="currentColor"
                strokeWidth="7"
                className="text-slate-800"
                fill="transparent"
              />
              <circle
                cx="40"
                cy="40"
                r="32"
                stroke="currentColor"
                strokeWidth="7"
                strokeDasharray={201}
                strokeDashoffset={201 - (201 * score) / 100}
                strokeLinecap="round"
                className={`${decisionConfig.badgeText} transition-all duration-1000 ease-out`}
                fill="transparent"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-xl font-black text-white tracking-tight">{score}</span>
              <span className="text-[9px] text-slate-400 uppercase font-mono">/ 100</span>
            </div>
          </div>

          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
              Composite Risk Score
            </span>
            <span className={`text-base font-extrabold uppercase ${decisionConfig.badgeText}`}>
              {risk.level || 'MODERATE'} RISK
            </span>
            <span className="text-[11px] text-slate-400 block mt-0.5">
              Risk Index: <strong className="text-white font-mono">{riskIndex.toFixed(2)}</strong> (0-1)
            </span>
          </div>
        </div>

        {/* Center: Confidence & Data Quality */}
        <div className="md:col-span-4 bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
              Confidence & Integrity
            </span>
            {confidence.is_high_confidence ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                HIGH CONFIDENCE
              </span>
            ) : (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                DEGRADED CONFIDENCE
              </span>
            )}
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white font-mono">
              {confidenceScore !== null ? `${confidenceScore}%` : 'N/A'}
            </span>
            <span className="text-xs text-slate-400">multi-stream agreement</span>
          </div>

          {confidence.breakdown && (
            <div className="grid grid-cols-4 gap-1 text-[9px] font-mono text-slate-400 pt-1 border-t border-slate-800">
              <div title="Freshness weight 35%">Fresh: {Math.round((confidence.breakdown.c_freshness || 1) * 100)}%</div>
              <div title="Resolution weight 25%">Res: {Math.round((confidence.breakdown.c_resolution || 1) * 100)}%</div>
              <div title="Completeness weight 20%">Comp: {Math.round((confidence.breakdown.c_completeness || 1) * 100)}%</div>
              <div title="Agreement weight 20%">Agr: {Math.round((confidence.breakdown.c_agreement || 1) * 100)}%</div>
            </div>
          )}
        </div>

        {/* Right: Operational Summary */}
        <div className="md:col-span-4 bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-1.5">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">
            Operational Summary
          </span>
          <p className="text-xs font-semibold text-white leading-snug">
            {decisionConfig.title}
          </p>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            {decisionConfig.sub}
          </p>
        </div>
      </div>

      {/* Veto Triggers Section (If Veto Active) */}
      {isVeto && (
        <div id="veto-reasons-panel" className="bg-rose-950/90 border border-rose-500/70 rounded-xl p-4 space-y-2 shadow-lg">
          <div className="flex items-center gap-2">
            <AlertOctagon className="w-5 h-5 text-rose-400 animate-bounce" />
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-rose-200">
              Active Deterministic Safety Vetoes ({vetoReasons.length})
            </h4>
          </div>

          <div className="space-y-1.5 pt-1">
            {vetoReasons.map((reason, idx) => {
              const code = vetoCodes[idx] || 'SAFETY_VETO';
              return (
                <div
                  key={idx}
                  className="bg-slate-950/80 rounded-lg p-2.5 border border-rose-500/40 flex items-start gap-2 text-xs"
                >
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 shrink-0">
                    {code}
                  </span>
                  <span className="text-rose-100 font-medium leading-relaxed">{reason}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Safety Recommendation Box */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-1.5">
          <Zap className="w-4 h-4 text-cyan-400" />
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Deterministic Advisory Recommendation
          </h4>
        </div>
        <p className="text-sm text-slate-200 leading-relaxed font-medium">
          {risk.recommendation}
        </p>

        {risk.advisories && risk.advisories.length > 0 && (
          <div className="mt-3 pt-2.5 border-t border-slate-800 flex flex-col gap-1">
            {risk.advisories.map((adv, idx) => (
              <p key={idx} className="text-xs text-amber-300/90 flex items-start gap-2">
                <span className="text-amber-400 font-bold">•</span>
                <span>{adv}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
