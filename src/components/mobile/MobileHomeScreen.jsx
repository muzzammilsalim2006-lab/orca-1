import React from 'react';
import {
  Fish,
  Anchor,
  Microscope,
  ArrowRight,
  ShieldCheck,
  Compass,
  ChevronRight,
} from 'lucide-react';
import OrcaLogo from '../OrcaLogo';
import { TRANSLATIONS } from '../../utils/translations';

export default function MobileHomeScreen({
  currentLanguage = 'en',
  onSelectLanguage,
  onSelectRole,
}) {
  const t = TRANSLATIONS[currentLanguage] || TRANSLATIONS.en;

  const languages = [
    { id: 'en', label: 'English', sub: 'EN' },
    { id: 'hi', label: 'हिंदी', sub: 'HI' },
    { id: 'mr', label: 'मराठी', sub: 'MR' },
  ];

  const roleCards = [
    {
      id: 'fisherman',
      title: t.roleFisherman || 'Fisherman',
      titleEn: 'Fisherman',
      titleNative: currentLanguage === 'mr' ? 'मच्छीमार' : currentLanguage === 'hi' ? 'मछुआरे' : 'Fisherman',
      desc:
        currentLanguage === 'mr'
          ? 'मासेमारीच्या फेऱ्यांचे नियोजन करा, समुद्राची स्थिती समजून घ्या आणि सुरक्षा इशारे मिळवा.'
          : currentLanguage === 'hi'
          ? 'मत्स्य यात्रा की योजना बनाएं, समुद्र की स्थिति समझें और सुरक्षा चेतावनी प्राप्त करें।'
          : 'Plan fishing trips, understand sea conditions, and receive safety alerts.',
      icon: <Fish className="w-7 h-7 text-teal-600" />,
      iconBg: 'bg-teal-50 border border-teal-200/80 text-teal-700',
      badge: currentLanguage === 'mr' ? 'दैनिक फेऱ्या व PFZ' : currentLanguage === 'hi' ? 'दैनिक यात्रा व PFZ' : 'Daily Trips & PFZ',
      actionLabel: currentLanguage === 'mr' ? 'मच्छीमार पोर्टल उघडा' : currentLanguage === 'hi' ? 'मछुआरा ऐप खोलें' : 'Open Fisherman View',
      accentColor: 'border-teal-200 hover:border-teal-400 group-hover:shadow-teal-100',
      btnColor: 'bg-teal-600 hover:bg-teal-700 text-white',
      highlights: [
        currentLanguage === 'mr' ? 'GO / CAUTION / NO-GO त्वरित निर्णय' : currentLanguage === 'hi' ? 'तुरंत GO / CAUTION / NO-GO निर्णय' : 'GO / CAUTION / NO-GO decisions',
        currentLanguage === 'mr' ? 'INCOIS संभाव्य मासेमारी क्षेत्र (PFZ)' : currentLanguage === 'hi' ? 'INCOIS संभावित मत्स्य क्षेत्र' : 'INCOIS Potential Fishing Zones',
      ],
    },
    {
      id: 'coast_guard',
      title: t.roleCoastGuard || 'Coastal Guards',
      titleEn: 'Coastal Guards',
      titleNative: currentLanguage === 'mr' ? 'तटरक्षक दल' : currentLanguage === 'hi' ? 'तटरक्षक बल' : 'Coastal Guards',
      desc:
        currentLanguage === 'mr'
          ? 'किनारपट्टीच्या स्थितीवर लक्ष ठेवा, नौकांचे मूल्यांकन करा आणि प्रतिसाद मोहिमांना मदत करा.'
          : currentLanguage === 'hi'
          ? 'तटीय स्थितियों की निगरानी करें, जहाजों का आकलन करें और बचाव अभियानों का समर्थन करें।'
          : 'Monitor coastal conditions, assess vessels, and support response operations.',
      icon: <Anchor className="w-7 h-7 text-sky-600" />,
      iconBg: 'bg-sky-50 border border-sky-200/80 text-sky-700',
      badge: currentLanguage === 'mr' ? 'शोध व बचाव (SAR)' : currentLanguage === 'hi' ? 'खोज एवं बचाव (SAR)' : 'SAR & Tactical',
      actionLabel: currentLanguage === 'mr' ? 'तटरक्षक कमांड उघडा' : currentLanguage === 'hi' ? 'तटरक्षक कमांड खोलें' : 'Open Coast Guard View',
      accentColor: 'border-sky-200 hover:border-sky-400 group-hover:shadow-sky-100',
      btnColor: 'bg-sky-700 hover:bg-sky-800 text-white',
      highlights: [
        currentLanguage === 'mr' ? 'IAMSAR लीवे प्रवाह व शोध त्रिज्या अंदाज' : currentLanguage === 'hi' ? 'IAMSAR लीवे ड्रिफ्ट और खोज दायरा' : 'IAMSAR leeway drift & expanding radius',
        currentLanguage === 'mr' ? 'मालवण अभयारण्य व सागरी सीमा (IMBL)' : currentLanguage === 'hi' ? 'मालवण अभयारण्य व सीमा सुरक्षा' : 'Malvan sanctuary & IMBL geofencing',
      ],
    },
    {
      id: 'researcher',
      title: t.roleResearcher || 'Marine Researchers',
      titleEn: 'Marine Researchers',
      titleNative: currentLanguage === 'mr' ? 'सागरी संशोधक' : currentLanguage === 'hi' ? 'समुद्री शोधकर्ता' : 'Marine Researchers',
      desc:
        currentLanguage === 'mr'
          ? 'सागरी निरीक्षणे, पर्यावरणीय डेटा आणि वैज्ञानिक पुरावे तपासा.'
          : currentLanguage === 'hi'
          ? 'समुद्री अवलोकनों, पर्यावरणीय डेटा और वैज्ञानिक साक्ष्यों का अन्वेषण करें।'
          : 'Explore marine observations, environmental data, and scientific evidence.',
      icon: <Microscope className="w-7 h-7 text-indigo-600" />,
      iconBg: 'bg-indigo-50 border border-indigo-200/80 text-indigo-700',
      badge: currentLanguage === 'mr' ? 'टेलिमेट्री व पुरावे' : currentLanguage === 'hi' ? 'टेलीमेट्री व साक्ष्य' : 'Telemetry & Audit',
      actionLabel: currentLanguage === 'mr' ? 'संशोधक पोर्टल उघडा' : currentLanguage === 'hi' ? 'शोधकर्ता पोर्टल खोलें' : 'Open Researcher View',
      accentColor: 'border-indigo-200 hover:border-indigo-400 group-hover:shadow-indigo-100',
      btnColor: 'bg-indigo-600 hover:bg-indigo-700 text-white',
      highlights: [
        currentLanguage === 'mr' ? 'SST तापमान व क्लोरोफिल-ए उपग्रह डेटा' : currentLanguage === 'hi' ? 'SST तापमान व क्लोरोफिल-ए डेटा' : 'SST & Chlorophyll-a satellite feeds',
        currentLanguage === 'mr' ? 'डेटा ताजेपण क्षय व multi-source audit' : currentLanguage === 'hi' ? 'डेटा ताजगी क्षय व स्रोत ऑडिट' : 'Freshness decay & multi-source conflict audit',
      ],
    },
  ];

  return (
    <div className="flex-1 flex flex-col justify-between bg-gradient-to-b from-sky-50/70 via-white to-slate-50 text-slate-800 select-none overflow-y-auto font-sans">
      <div className="p-5 sm:p-6 space-y-5">
        {/* Top Header Bar: Clean Branding + Interactive Language Switcher */}
        <div className="flex items-center justify-between pt-1">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-2.5">
            <OrcaLogo size="md" variant="original" className="shadow-xs rounded-full" />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-black text-slate-900 tracking-tight font-serif">ORCA</span>
                <span className="text-[10px] font-bold text-teal-700 bg-teal-50 border border-teal-200 px-1.5 py-0.2 rounded-md font-mono">
                  v0.2.0
                </span>
              </div>
              <p className="text-[10.5px] font-bold text-amber-700/90 tracking-wide font-mono">
                SAFER SEAS • SMARTER DECISIONS
              </p>
            </div>
          </div>

          {/* Clean Segmented Language Selector (English, हिंदी, मराठी) */}
          <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-xs">
            {languages.map((lang) => {
              const isActive = currentLanguage === lang.id;
              return (
                <button
                  key={lang.id}
                  onClick={() => onSelectLanguage && onSelectLanguage(lang.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                  title={`Switch to ${lang.label}`}
                >
                  {lang.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Welcome / Identity Section */}
        <div className="pt-2 pb-1 space-y-1.5">
          <div className="flex items-center gap-1.5 text-teal-700 text-xs font-bold uppercase tracking-wider">
            <Compass className="w-3.5 h-3.5 text-teal-600" />
            <span>
              {currentLanguage === 'mr'
                ? 'सागरी सुरक्षा व सहकार्य प्लॅटफॉर्म'
                : currentLanguage === 'hi'
                ? 'समुद्री सुरक्षा एवं सहयोग मंच'
                : 'Coastal Safety & Advisory Platform'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
            {currentLanguage === 'mr'
              ? 'आपली भूमिका निवडा'
              : currentLanguage === 'hi'
              ? 'अपनी भूमिका चुनें'
              : 'Choose Your Role'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-sm">
            {currentLanguage === 'mr'
              ? 'महाराष्ट्र किनारपट्टीच्या सुरक्षिततेसाठी एकात्मिक ORCA इंजिनशी जोडले जा.'
              : currentLanguage === 'hi'
              ? 'महाराष्ट्र तटरेखा की सुरक्षा के लिए एकीकृत ORCA इंजन से जुड़ें।'
              : 'Access real-time sea conditions, safety assessments, and marine intelligence tailored to your operational needs.'}
          </p>
        </div>

        {/* 3 Large Role Cards (Image 3 Style: Light, Friendly, Touch-Friendly, Clear Visual Hierarchy) */}
        <div className="space-y-3.5">
          {roleCards.map((role) => (
            <div
              key={role.id}
              onClick={() => onSelectRole && onSelectRole(role.id)}
              className={`group bg-white rounded-3xl p-4.5 sm:p-5 border-2 ${role.accentColor} shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-[0.99] relative overflow-hidden`}
            >
              {/* Top Row: Icon + Role Title + Badge */}
              <div className="flex items-start justify-between gap-3 mb-2.5">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-2xl ${role.iconBg} shadow-xs shrink-0`}>
                    {role.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-black text-slate-900 group-hover:text-teal-700 transition-colors">
                        {role.title}
                      </h2>
                    </div>
                    <span className="text-[11px] font-bold text-slate-500">
                      {role.titleNative !== role.title ? `${role.titleNative} · ` : ''}{role.badge}
                    </span>
                  </div>
                </div>

                <div className="w-8 h-8 rounded-full bg-slate-100 group-hover:bg-teal-50 group-hover:text-teal-700 text-slate-400 flex items-center justify-center transition-all shrink-0 mt-0.5">
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>

              {/* Description: Clear, short, plain-language */}
              <p className="text-xs sm:text-[13px] text-slate-600 leading-relaxed mb-3">
                {role.desc}
              </p>

              {/* Role Highlights (Plain-language, easy to scan) */}
              <div className="space-y-1 mb-3.5 pt-2 border-t border-slate-100">
                {role.highlights.map((highlight, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-[11px] font-medium text-slate-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0" />
                    <span>{highlight}</span>
                  </div>
                ))}
              </div>

              {/* Action Button: Touch-Friendly, Clear CTA */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onSelectRole) onSelectRole(role.id);
                }}
                className={`w-full py-2.5 px-4 ${role.btnColor} font-bold rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer`}
              >
                <span>{role.actionLabel}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Clean Footer / Scope Note */}
        <div className="pt-2 pb-4 text-center space-y-1 border-t border-slate-200/60">
          <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>720 km Maharashtra Coastline Coverage</span>
          </div>
          <p className="text-[10px] text-slate-400">
            INCOIS Wave Forecasts · IMD Marine Bulletins · ISRO MOSDAC Telemetry
          </p>
        </div>
      </div>
    </div>
  );
}
