import React from 'react';
import { Waves, Cpu, Globe, Mic, ShieldAlert, Fish, Database } from 'lucide-react';
import { TRANSLATIONS } from '../utils/translations';

export default function Navbar({
  demoMode,
  setDemoMode,
  isConnected,
  currentRole = 'fisherman',
  setRole,
  language = 'mr',
  setLanguage,
  onOpenVoice,
}) {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;

  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-slate-950/90 border-b border-slate-800 px-4 py-3 shadow-lg">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand & Subtitle */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-3">
            <div className="relative p-2.5 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/20">
              <Waves className="w-6 h-6 animate-pulse" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-slate-950"></div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-1.5">
                  ORCA
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    MAHARASHTRA MVP
                  </span>
                </h1>
              </div>
              <p className="text-[11px] text-slate-400">
                {t.appSubtitle}
              </p>
            </div>
          </div>

          {/* Mobile Voice Quick Button */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={onOpenVoice}
              className="p-2 rounded-xl bg-cyan-600 text-white"
              title="Voice Assistant"
            >
              <Mic className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Center: Role Switcher Tabs */}
        <div className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-2xl text-xs font-bold w-full md:w-auto justify-center">
          <button
            onClick={() => setRole('fisherman')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all ${
              currentRole === 'fisherman'
                ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Fish className="w-4 h-4" />
            <span>{t.roleFisherman}</span>
          </button>

          <button
            onClick={() => setRole('coast_guard')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all ${
              currentRole === 'coast_guard'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>{t.roleCoastGuard}</span>
          </button>

          <button
            onClick={() => setRole('researcher')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all ${
              currentRole === 'researcher'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>{t.roleResearcher}</span>
          </button>
        </div>

        {/* Right: Language + Voice + Connection Controls */}
        <div className="flex items-center gap-2.5 text-xs w-full md:w-auto justify-end">
          {/* Voice Assistant Button (Desktop) */}
          <button
            onClick={onOpenVoice}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-600/20 hover:bg-cyan-600 text-cyan-300 hover:text-white border border-cyan-500/30 transition-all font-bold"
            title="Ask ORCA in Marathi, Hindi, or English"
          >
            <Mic className="w-3.5 h-3.5" />
            <span>व्हॉइस / Voice</span>
          </button>

          {/* Language Selector */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-full px-2 py-1 gap-1">
            <Globe className="w-3.5 h-3.5 text-slate-400 ml-1" />
            <button
              onClick={() => setLanguage('mr')}
              className={`px-2 py-0.5 rounded-full font-bold transition-all ${
                language === 'mr' ? 'bg-cyan-500 text-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              मराठी
            </button>
            <button
              onClick={() => setLanguage('hi')}
              className={`px-2 py-0.5 rounded-full font-bold transition-all ${
                language === 'hi' ? 'bg-cyan-500 text-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              हिंदी
            </button>
            <button
              onClick={() => setLanguage('en')}
              className={`px-2 py-0.5 rounded-full font-bold transition-all ${
                language === 'en' ? 'bg-cyan-500 text-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              EN
            </button>
          </div>

          {/* Connection Status Pill */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-mono ${
              isConnected
                ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/50'
                : 'bg-amber-950/40 text-amber-400 border-amber-800/50'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`}></span>
            <span>{isConnected ? 'LIVE' : 'CONNECTING'}</span>
          </div>

          {/* Demo Toggle */}
          <button
            onClick={() => setDemoMode(!demoMode)}
            className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold flex items-center gap-1 transition-all ${
              demoMode
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-300'
            }`}
            title="Toggle between live APIs and deterministic offline demo data"
          >
            <Cpu className="w-3 h-3" />
            <span>{demoMode ? 'DEMO' : 'LIVE FEED'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
