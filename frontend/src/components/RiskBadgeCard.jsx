import React from 'react';
import { ShieldCheck, ShieldAlert, AlertOctagon, Info, Zap } from 'lucide-react';

export default function RiskBadgeCard({ risk, mode, locationName }) {
  if (!risk) return null;

  const { score, level, warning_override, recommendation, advisories, missing_inputs } = risk;

  // Level configuration
  const config = {
    LOW: {
      bg: 'from-emerald-950/60 via-slate-900 to-slate-950',
      border: 'border-emerald-500/40',
      badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50',
      text: 'text-emerald-400',
      icon: ShieldCheck,
      title: 'LOW RISK ADVISORY',
    },
    MODERATE: {
      bg: 'from-amber-950/60 via-slate-900 to-slate-950',
      border: 'border-amber-500/40',
      badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/50',
      text: 'text-amber-400',
      icon: ShieldAlert,
      title: 'MODERATE RISK ADVISORY',
    },
    HIGH: {
      bg: 'from-rose-950/70 via-slate-900 to-slate-950',
      border: 'border-rose-500/50',
      badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/50',
      text: 'text-rose-400',
      icon: AlertOctagon,
      title: 'HIGH RISK / DANGER ADVISORY',
    },
  }[level] || {
    bg: 'from-slate-900 to-slate-950',
    border: 'border-slate-800',
    badgeBg: 'bg-slate-800 text-slate-300',
    text: 'text-slate-300',
    icon: Info,
    title: 'UNKNOWN RISK',
  };

  const IconComponent = config.icon;

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${config.bg} border ${config.border} p-6 shadow-2xl transition-all duration-300`}>
      {/* Background Glow */}
      <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-cyan-500/5 blur-3xl pointer-events-none"></div>

      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        {/* Left Section: Risk Level & Score */}
        <div className="flex items-center gap-5">
          {/* Gauge Score Circle */}
          <div className="relative flex items-center justify-center">
            <svg className="w-24 h-24 transform -rotate-90">
              <circle
                cx="48"
                cy="48"
                r="40"
                stroke="currentColor"
                strokeWidth="8"
                className="text-slate-800"
                fill="transparent"
              />
              <circle
                cx="48"
                cy="48"
                r="40"
                stroke="currentColor"
                strokeWidth="8"
                strokeDasharray={251.2}
                strokeDashoffset={251.2 - (251.2 * score) / 100}
                strokeLinecap="round"
                className={`${config.text} transition-all duration-1000 ease-out`}
                fill="transparent"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-2xl font-black text-white tracking-tighter">{score}</span>
              <span className="text-[10px] text-slate-400 font-medium uppercase">Score</span>
            </div>
          </div>

          {/* Badge & Title */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`px-3 py-1 rounded-full text-xs font-extrabold tracking-wider border flex items-center gap-1.5 uppercase ${config.badgeBg}`}>
                <IconComponent className="w-4 h-4" />
                {level} RISK
              </span>
              <span className={`text-xs px-2.5 py-0.5 rounded-full border ${
                mode === 'live' 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                  : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
              }`}>
                {mode === 'live' ? 'Live Ocean Data' : 'Demo Mode Sample'}
              </span>
            </div>
            <h3 className="text-lg font-bold text-white tracking-tight">
              {locationName ? `Assessment for ${locationName}` : 'Coastal Risk Assessment'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Deterministic Safety Engine Evaluated</p>
          </div>
        </div>

        {/* Right Section: Warning Override Indicator */}
        {warning_override && (
          <div className="w-full lg:w-auto bg-rose-950/80 border border-rose-500/60 rounded-xl p-3.5 flex items-start gap-3 shadow-lg shadow-rose-950/50">
            <AlertOctagon className="w-6 h-6 text-rose-400 shrink-0 mt-0.5 animate-bounce" />
            <div>
              <h4 className="text-xs font-bold text-rose-200 uppercase tracking-wider">Official Warning Override Triggered</h4>
              <p className="text-xs text-rose-300/90 mt-0.5">
                Official IMD/Marine hazard alert active. Computed risk score elevated to HIGH automatically.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Advisory Recommendation Box */}
      <div className="mt-5 bg-slate-950/70 border border-slate-800/80 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-1.5">
          <Zap className="w-4 h-4 text-cyan-400" />
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Safety Recommendation & Advisory</h4>
        </div>
        <p className="text-sm text-slate-200 leading-relaxed font-medium">
          {recommendation}
        </p>

        {advisories && advisories.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-800/60 flex flex-col gap-1">
            {advisories.map((adv, idx) => (
              <p key={idx} className="text-xs text-amber-300/90 flex items-start gap-1.5">
                <span className="text-amber-400 font-bold">•</span>
                <span>{adv}</span>
              </p>
            ))}
          </div>
        )}

        {missing_inputs && missing_inputs.length > 0 && (
          <div className="mt-2 text-[11px] text-slate-400 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
            <span className="font-semibold text-amber-400">Notice on Data Inputs:</span> Missing parameters ({missing_inputs.join(', ')}) were preserved as null and penalized according to ORCA risk criteria.
          </div>
        )}
      </div>
    </div>
  );
}
