import React from 'react';
import { Sparkles, Globe, Shield, FileText } from 'lucide-react';

export default function AIExplanationCard({
  explanation,
  languageMode = 'auto',
  activeLanguage = 'en',
  onLanguageChange,
}) {
  if (!explanation) return null;

  const isMarathi = activeLanguage === 'mr';
  const isLLM = explanation.provider && explanation.provider.includes('gemini');

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
      {/* Decorative top accent gradient */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            {isLLM ? <Sparkles className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white text-base">
                {isMarathi ? 'सागरी सुरक्षा सारांश (Advisory Summary)' : 'Marine Safety Advisory Summary'}
              </h3>
              <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                isLLM
                  ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}>
                {isLLM ? 'AI-Assisted' : 'Deterministic Template'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {isMarathi
                ? 'मासेमार आणि किनारी नागरिकांसाठी सुलभ मराठी सल्ला'
                : 'Plain-language coastal safety advisory generated from live observations'}
            </p>
          </div>
        </div>

        {/* Language Selection Buttons */}
        <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800 shrink-0">
          <Globe className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-0.5 shrink-0" />
          <button
            onClick={() => onLanguageChange && onLanguageChange('auto')}
            className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
              languageMode === 'auto'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Auto ({activeLanguage === 'mr' ? 'मराठी' : 'EN'})
          </button>
          <button
            onClick={() => onLanguageChange && onLanguageChange('en')}
            className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
              languageMode === 'en'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            English
          </button>
          <button
            onClick={() => onLanguageChange && onLanguageChange('mr')}
            className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
              languageMode === 'mr'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            मराठी
          </button>
        </div>
      </div>

      {/* Main Advisory Text */}
      <div className="mt-4">
        <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-line font-medium bg-slate-950/40 p-4 rounded-xl border border-slate-800/60">
          {explanation.text}
        </p>
      </div>

      {/* Footer / Guardrails Note */}
      <div className="mt-4 pt-3 border-t border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-400">
        <div className="flex items-center gap-1.5 text-slate-400">
          <Shield className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span>
            {isMarathi
              ? 'हे स्वयंचलित मार्गदर्शक आहे. अंतिम निर्णयासाठी अधिकृत IMD/NDMA सूचनांचे पालन करा.'
              : 'Advisory explanation only. Deterministic veto and official warnings always govern.'}
          </span>
        </div>
        {explanation.provider && (
          <span className="text-slate-500">
            Source: <span className="font-mono text-slate-400">{explanation.provider}</span>
          </span>
        )}
      </div>
    </div>
  );
}
