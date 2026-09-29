import React from 'react';
import { ArrowRight, Compass } from 'lucide-react';
import OrcaLogo from '../OrcaLogo';
import { TRANSLATIONS } from '../../utils/translations';

export default function MobileSplashScreen({ onContinue, language = 'en' }) {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;

  return (
    <div className="flex-1 flex flex-col justify-between p-6 sm:p-8 bg-gradient-to-b from-sky-50 via-white to-slate-50 text-slate-800 select-none overflow-hidden font-sans">
      {/* Top subtle brand metadata */}
      <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-1">
        <span className="flex items-center gap-1.5 font-bold text-sky-800">
          <Compass className="w-3.5 h-3.5 text-teal-600 animate-spin" style={{ animationDuration: '12s' }} />
          <span>ORCA MOBILE • MAHARASHTRA</span>
        </span>
        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-semibold">
          v0.2.0
        </span>
      </div>

      {/* Center Primary Hero: Official ORCA Logo */}
      <div className="my-auto text-center space-y-6 max-w-xs mx-auto py-6">
        {/* Prominent Official Brand Logo Asset */}
        <div className="relative inline-block transition-transform duration-300 hover:scale-105">
          {/* Subtle soft ambient glow behind the gold badge */}
          <div className="absolute inset-0 rounded-full bg-amber-400/15 blur-xl -z-10" />
          <OrcaLogo size="2xl" variant="original" className="shadow-xl rounded-full" />
        </div>

        {/* Title and Approved Terminology */}
        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-950 font-serif">
            ORCA
          </h1>
          <p className="text-xs font-extrabold uppercase tracking-widest text-sky-800">
            {t.splashTagline || 'Ocean Risk & Coastal Assistance'}
          </p>
          <p className="text-xs font-bold text-amber-700 tracking-wider pt-0.5">
            {t.splashMotto || 'SAFER SEAS • SMARTER DECISIONS'}
          </p>
          <p className="text-xs text-slate-500 leading-relaxed pt-2">
            {language === 'mr'
              ? 'महाराष्ट्र किनारपट्टीसाठी अधिकृत हवामान व सागरी सुरक्षा बुद्धिमत्ता प्रणाली'
              : language === 'hi'
              ? 'महाराष्ट्र तटरेखा के लिए आधिकारिक मौसम एवं समुद्री सुरक्षा बुद्धिमत्ता मंच'
              : 'Deterministic Marine Safety & Decision Support for Maharashtra Waters'}
          </p>
        </div>
      </div>

      {/* Bottom Transition / Action Button */}
      <div className="space-y-3 pb-3">
        <button
          onClick={onContinue}
          className="w-full py-4 bg-gradient-to-r from-sky-700 via-teal-700 to-sky-800 hover:from-sky-600 hover:to-teal-600 text-white font-extrabold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-sky-800/20 transition-all active:scale-[0.98] text-sm cursor-pointer"
        >
          <span>{t.getStarted}</span>
          <ArrowRight className="w-4 h-4" />
        </button>

        <p className="text-[10.5px] text-slate-400 text-center font-medium">
          IMD • INCOIS • ISRO MOSDAC • Open-Meteo
        </p>
      </div>
    </div>
  );
}
