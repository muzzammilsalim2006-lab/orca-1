import React from 'react';
import { ArrowLeft, ArrowRight, Check, Globe } from 'lucide-react';
import OrcaLogo from '../OrcaLogo';
import { TRANSLATIONS } from '../../utils/translations';

export default function MobileLanguageScreen({
  currentLanguage = 'en',
  onSelectLanguage,
  onContinue,
  onBack,
}) {
  const t = TRANSLATIONS[currentLanguage] || TRANSLATIONS.en;

  const languages = [
    {
      id: 'mr',
      name: 'मराठी',
      englishName: 'Marathi',
      tagline: 'महाराष्ट्र किनारपट्टी स्थानिक भाषा',
      sub: 'कोकण, मुंबई आणि स्थानिक मच्छीमार संवाद',
      badge: 'प्राधान्य (Recommended)',
      borderAccent: 'border-teal-500 bg-teal-50/50',
    },
    {
      id: 'hi',
      name: 'हिंदी',
      englishName: 'Hindi',
      tagline: 'राष्ट्रीय समुद्री सुरक्षा भाषा',
      sub: 'तटरक्षक व राष्ट्रीय अलर्ट संदेश',
      badge: 'National Language',
      borderAccent: 'border-sky-600 bg-sky-50/50',
    },
    {
      id: 'en',
      name: 'English',
      englishName: 'English',
      tagline: 'International Maritime Language',
      sub: 'Standard IMO & Scientific Oceanography',
      badge: 'Global Standard',
      borderAccent: 'border-indigo-600 bg-indigo-50/50',
    },
  ];

  return (
    <div className="flex-1 flex flex-col justify-between p-5 sm:p-6 bg-slate-50 text-slate-800 select-none overflow-y-auto font-sans">
      {/* Top Header */}
      <div className="pt-1">
        <div className="flex items-center justify-between mb-2">
          {onBack && (
            <button
              onClick={onBack}
              type="button"
              className="flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer py-1 px-2 rounded-lg hover:bg-slate-200/60"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{t.backButton || 'Back'}</span>
            </button>
          )}
          <div className="flex items-center gap-1.5 text-sky-800 text-[11px] font-bold uppercase tracking-wider ml-auto">
            <Globe className="w-3.5 h-3.5 text-teal-600" />
            <span>STEP 1 OF 3 • LANGUAGE</span>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-1">
          <OrcaLogo size="md" variant="original" className="rounded-full shrink-0 shadow-2xs" />
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {currentLanguage === 'mr' ? 'भाषा निवडा' : currentLanguage === 'hi' ? 'भाषा चुनें' : 'Choose Language'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Controls safety advisories, voice language, and user interface.
            </p>
          </div>
        </div>
      </div>

      {/* Language Option Cards */}
      <div className="my-auto space-y-3 py-4 max-w-sm w-full mx-auto">
        {languages.map((lang) => {
          const isSelected = currentLanguage === lang.id;
          return (
            <div
              key={lang.id}
              onClick={() => onSelectLanguage && onSelectLanguage(lang.id)}
              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-4 ${
                isSelected
                  ? `${lang.borderAccent} shadow-md`
                  : 'bg-white hover:bg-slate-100/70 border-slate-200/90 text-slate-700 shadow-2xs'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xl font-black text-slate-900">{lang.name}</span>
                  <span className="text-xs text-slate-500 font-medium font-mono">({lang.englishName})</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isSelected ? 'bg-sky-700 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {lang.badge}
                  </span>
                </div>
                <p className="text-xs text-slate-700 font-semibold">{lang.tagline}</p>
                <p className="text-[11px] text-slate-500">{lang.sub}</p>
              </div>

              <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 ${
                isSelected ? 'border-sky-700 bg-sky-700 text-white' : 'border-slate-300 bg-white'
              }`}>
                {isSelected && <Check className="w-4 h-4 stroke-[3]" />}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom CTA */}
      <div className="space-y-3 pb-2 max-w-sm w-full mx-auto">
        <button
          onClick={onContinue}
          type="button"
          className="w-full py-3.5 bg-gradient-to-r from-sky-700 to-teal-700 hover:from-sky-600 hover:to-teal-600 text-white font-extrabold rounded-2xl flex items-center justify-center gap-2 shadow-md shadow-sky-800/15 transition-all active:scale-[0.98] text-sm cursor-pointer"
        >
          <span>{currentLanguage === 'mr' ? 'पुढे जा (भूमिका निवडा)' : currentLanguage === 'hi' ? 'आगे बढ़ें (भूमिका चुनें)' : 'Continue to Role Selection'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>

        <p className="text-[10.5px] text-slate-400 text-center font-medium">
          You can toggle language anytime from the top bar in the app.
        </p>
      </div>
    </div>
  );
}
