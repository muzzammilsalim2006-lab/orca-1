import React from 'react';
import { Wifi, Battery, Signal, ArrowLeft } from 'lucide-react';
import OrcaLogo from '../OrcaLogo';
import { TRANSLATIONS } from '../../utils/translations';

export default function MobileShell({
  children,
  currentRole,
  onSwitchRole,
  currentLanguage,
  onSwitchLanguage,
  demoMode,
  onToggleDemo,
  isConnected,
  _onOpenVoice,
  onResetToHome,
  showTopBar = true,
}) {
  const t = TRANSLATIONS[currentLanguage] || TRANSLATIONS.en;

  const rolePillColors = {
    fisherman: 'bg-teal-600 text-white',
    coast_guard: 'bg-sky-700 text-white',
    researcher: 'bg-indigo-700 text-white',
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-0 sm:p-4 md:p-6 select-none font-sans text-slate-800">
      {/* Smartphone Outer Bezel Container */}
      <div className="w-full sm:max-w-[430px] h-[100dvh] sm:h-[880px] bg-slate-50 sm:rounded-[44px] sm:border-[8px] sm:border-slate-800/90 flex flex-col overflow-hidden shadow-2xl relative">
        
        {/* Dynamic Island / Speaker Notch (Desktop View Only) */}
        <div className="hidden sm:flex items-center justify-center pt-2.5 pb-1 bg-slate-900 shrink-0">
          <div className="w-24 h-4 bg-black rounded-full border border-slate-700/60 flex items-center justify-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-800"></span>
            <span className="w-8 h-1 bg-slate-700 rounded-full"></span>
          </div>
        </div>

        {/* Mobile Status Bar (Clean Light Style) */}
        <div className="px-5 py-1.5 flex items-center justify-between text-[11px] font-mono text-slate-600 bg-white border-b border-slate-200/80 shrink-0">
          <div className="flex items-center gap-1.5 font-bold text-slate-800">
            <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>

          <div className="flex items-center gap-2">
            <Signal className="w-3 h-3 text-slate-500" />
            <Wifi className={`w-3 h-3 ${isConnected ? 'text-emerald-600' : 'text-amber-500'}`} />
            <div className="flex items-center gap-0.5">
              <span className="text-[10px]">98%</span>
              <Battery className="w-3.5 h-3.5 text-slate-700" />
            </div>
          </div>
        </div>

        {/* Top App Bar with Role & Language Quick Switcher */}
        {showTopBar && (
          <div className="px-3.5 py-2 bg-white/95 backdrop-blur-md border-b border-slate-200/80 flex items-center justify-between gap-2 shrink-0 shadow-sm z-30">
            {/* Left: Back / Home button, Brand Emblem & Role dropdown */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={onResetToHome}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                title="Back to Welcome / Role Selection"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              <OrcaLogo size="xs" variant="original" className="rounded-full shrink-0" />

              <select
                value={currentRole}
                onChange={(e) => onSwitchRole && onSwitchRole(e.target.value)}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold uppercase tracking-wider outline-none cursor-pointer transition-all shadow-sm ${
                  rolePillColors[currentRole] || 'bg-teal-600 text-white'
                }`}
              >
                <option value="fisherman">🎣 {t.roleFisherman}</option>
                <option value="coast_guard">🛡️ {t.roleCoastGuard}</option>
                <option value="researcher">🔬 {t.roleResearcher}</option>
              </select>
            </div>

            {/* Right: Language Toggle & Voice & Live Status */}
            <div className="flex items-center gap-1.5 text-xs">
              {/* Language Switcher Buttons */}
              <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg p-0.5">
                <button
                  onClick={() => onSwitchLanguage('mr')}
                  className={`px-1.5 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                    currentLanguage === 'mr' ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  मराठी
                </button>
                <button
                  onClick={() => onSwitchLanguage('hi')}
                  className={`px-1.5 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                    currentLanguage === 'hi' ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  हिंदी
                </button>
                <button
                  onClick={() => onSwitchLanguage('en')}
                  className={`px-1.5 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                    currentLanguage === 'en' ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  EN
                </button>
              </div>

              {/* Demo Mode Toggle */}
              <button
                onClick={onToggleDemo}
                className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold transition-all cursor-pointer ${
                  demoMode
                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                    : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                }`}
                title="Toggle Live / Demo mode"
              >
                {demoMode ? 'DEMO' : 'LIVE'}
              </button>
            </div>
          </div>
        )}

        {/* Dynamic Screen Viewport Container */}
        <div className="flex-1 flex flex-col overflow-hidden relative bg-slate-50">
          {children}
        </div>

        {/* Bottom Home Indicator Bar (Mobile Phone Frame) */}
        <div className="py-1 bg-white border-t border-slate-100 flex items-center justify-center shrink-0">
          <div className="w-32 h-1 bg-slate-300 rounded-full" />
        </div>
      </div>
    </div>
  );
}
