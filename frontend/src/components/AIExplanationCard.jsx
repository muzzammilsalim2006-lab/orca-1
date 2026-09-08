import React from 'react';
import { Sparkles, Bot, ShieldCheck } from 'lucide-react';

export default function AIExplanationCard({ explanation }) {
  if (!explanation) return null;

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 border border-indigo-500/30 rounded-2xl p-5 shadow-xl">
      <div className="flex items-center justify-between mb-3 border-b border-indigo-500/20 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white tracking-tight flex items-center gap-1.5">
              AI Plain-Language Advisory Summary
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            </h3>
            <p className="text-[11px] text-slate-400">Translating complex marine metrics for coastal users</p>
          </div>
        </div>

        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
          Provider: {explanation.provider || 'Template Engine'}
        </span>
      </div>

      {/* Explanation Content */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 text-sm text-slate-200 leading-relaxed font-normal">
        {explanation.text}
      </div>

      {/* Guardrail Disclaimer */}
      <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-400 bg-slate-950/40 px-3 py-2 rounded-lg border border-slate-800/80">
        <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
        <span>
          <strong className="text-slate-300">Guardrail Enforced:</strong> {explanation.guardrail || 'Advisory only. This explanation cannot modify risk scores or official warnings.'}
        </span>
      </div>
    </div>
  );
}
