import React from 'react';
import { Sparkles, Bot, ShieldCheck, Languages, Globe } from 'lucide-react';

export default function AIExplanationCard({
  explanation,
  languageMode = 'auto',
  activeLanguage = 'en',
  onLanguageChange,
}) {
  if (!explanation) return null;

  const currentLang = explanation.language || activeLanguage;
  const isMarathi = currentLang === 'mr';

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 border border-indigo-500/30 rounded-2xl p-5 shadow-xl">
      {/* Header with Title and Metadata */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-indigo-500/20 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white tracking-tight flex items-center gap-1.5">
              {isMarathi ? 'एआय सोपा भाषा सल्लागार सारांश' : 'AI Plain-Language Advisory Summary'}
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            </h3>
            <p className="text-[11px] text-slate-400">
              {isMarathi ? 'सागरी सुरक्षितता माहिती सोप्या मराठी भाषेत' : 'Translating complex marine metrics for coastal users'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Active Language Badge */}
          <div className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
            <Globe className="w-3 h-3 text-cyan-400" />
            <span>{isMarathi ? 'भाषा: मराठी (Marathi)' : 'Language: English'}</span>
            {languageMode === 'auto' && (
              <span className="text-[9px] bg-cyan-500/20 text-cyan-200 px-1 py-0.2 rounded font-normal ml-1">
                (Auto Region)
              </span>
            )}
          </div>

          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
            Provider: {explanation.provider || 'Template Engine'}
          </span>
        </div>
      </div>

      {/* Manual & Automatic Language Selector Control */}
      {onLanguageChange && (
        <div className="mb-3 flex items-center justify-between bg-slate-950/40 px-3 py-2 rounded-xl border border-slate-800/60 flex-wrap gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-300 font-medium">
            <Languages className="w-3.5 h-3.5 text-indigo-400" />
            <span>Language Selection:</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onLanguageChange('auto')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                languageMode === 'auto'
                  ? 'bg-indigo-500/20 text-indigo-200 border-indigo-500/50 shadow-sm'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              Automatic
            </button>
            <button
              type="button"
              onClick={() => onLanguageChange('en')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                languageMode === 'en'
                  ? 'bg-indigo-500/20 text-indigo-200 border-indigo-500/50 shadow-sm'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => onLanguageChange('mr')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                languageMode === 'mr'
                  ? 'bg-indigo-500/20 text-indigo-200 border-indigo-500/50 shadow-sm'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              मराठी (Marathi)
            </button>
          </div>
        </div>
      )}

      {/* Explanation Content */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 text-sm text-slate-100 leading-relaxed font-normal">
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
