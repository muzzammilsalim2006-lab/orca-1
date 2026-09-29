import React from 'react';
import { ArrowLeft, ArrowRight, Check, Fish, ShieldAlert, Database } from 'lucide-react';
import OrcaLogo from '../OrcaLogo';
import { TRANSLATIONS } from '../../utils/translations';

export default function MobileRoleSelectionScreen({
  currentRole = 'fisherman',
  onSelectRole,
  onContinue,
  onBack,
  language = 'en',
}) {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;

  const roles = [
    {
      id: 'fisherman',
      title: t.roleFisherman,
      titleEn: 'Fisherman',
      icon: <Fish className="w-6 h-6 text-teal-600" />,
      tagline: language === 'mr' ? 'सागरी सुरक्षा, लाटा व मासेमारी क्षेत्र' : language === 'hi' ? 'समुद्री सुरक्षा, लहरें और मत्स्य क्षेत्र' : 'Sea safety decisions, waves & PFZ zones',
      badge: language === 'mr' ? 'दैनिक मासेमारी' : language === 'hi' ? 'दैनिक मत्स्य पालन' : 'Daily Operations',
      highlights: [
        language === 'mr' ? 'निर्णय: GO / CAUTION / NO-GO' : language === 'hi' ? 'निर्णय: GO / CAUTION / NO-GO' : 'Decisions: GO / CAUTION / NO-GO',
        language === 'mr' ? 'उंच लाटा व वादळी वारे इशारे' : language === 'hi' ? 'ऊंची लहरें व चक्रवात अलर्ट' : 'Wave height & squall warnings',
        language === 'mr' ? 'INCOIS संभाव्य मासेमारी क्षेत्र (PFZ)' : language === 'hi' ? 'INCOIS संभावित मत्स्य क्षेत्र (PFZ)' : 'INCOIS Potential Fishing Zones (PFZ)',
      ],
      borderAccent: 'border-teal-500 bg-teal-50/40',
      badgeClass: 'bg-teal-50 text-teal-800 border-teal-200',
    },
    {
      id: 'coast_guard',
      title: t.roleCoastGuard,
      titleEn: 'Coastal Guard',
      icon: <ShieldAlert className="w-6 h-6 text-sky-700" />,
      tagline: language === 'mr' ? 'शोध व बचाव (SAR) आणि किनारा नियंत्रण' : language === 'hi' ? 'खोज एवं बचाव (SAR) और तटीय निगरानी' : 'Tactical SAR leeway drift & geofencing',
      badge: language === 'mr' ? 'तटरक्षक दल' : language === 'hi' ? 'तटरक्षक बल' : 'Tactical Command',
      highlights: [
        language === 'mr' ? 'IAMSAR लीवे प्रवाह अंदाज' : language === 'hi' ? 'IAMSAR लीवे बहाव विश्लेषण' : 'IAMSAR leeway drift modeling',
        language === 'mr' ? 'अंदाजित शोध त्रिज्या (Expanding Radius)' : language === 'hi' ? 'अनुशंसित खोज त्रिज्या (Expanding Radius)' : 'Recommended search radius (NM)',
        language === 'mr' ? 'मालवण अभयारण्य व सीमा Geofence' : language === 'hi' ? 'मालवन अभयारण्य व सीमा Geofence' : 'Malvan sanctuary & IMBL geofence',
      ],
      borderAccent: 'border-sky-600 bg-sky-50/40',
      badgeClass: 'bg-sky-50 text-sky-800 border-sky-200',
    },
    {
      id: 'researcher',
      title: t.roleResearcher,
      titleEn: 'Marine Researcher',
      icon: <Database className="w-6 h-6 text-indigo-700" />,
      tagline: language === 'mr' ? 'समुद्रशास्त्र, उपग्रह डेटा आणि पुरावे' : language === 'hi' ? 'समुद्र विज्ञान, उपग्रह डेटा और साक्ष्य' : 'Oceanographic telemetry & provenance',
      badge: language === 'mr' ? 'वैज्ञानिक पोर्टल' : language === 'hi' ? 'वैज्ञानिक पोर्टल' : 'Research Portal',
      highlights: [
        language === 'mr' ? 'SST तापमान व क्लोरोफिल-ए (ISRO MOSDAC)' : language === 'hi' ? 'SST तापमान व क्लोरोफिल-ए (ISRO MOSDAC)' : 'SST & Chlorophyll-a satellite telemetry',
        language === 'mr' ? 'डेटा ताजेपण गणितीय क्षय (Freshness Decay)' : language === 'hi' ? 'डेटा ताजगी क्षय (Freshness Decay)' : 'Freshness decay modeling & multi-source audit',
        language === 'mr' ? 'सत्यापित पुरावा डाउनलोड (JSON logs)' : language === 'hi' ? 'साक्ष्य ऑडिट डाउनलोड (JSON logs)' : 'Provenance evidence JSON audit export',
      ],
      borderAccent: 'border-indigo-600 bg-indigo-50/40',
      badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200',
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
            <span>STEP 2 OF 3 • ROLE</span>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-1">
          <OrcaLogo size="md" variant="original" className="rounded-full shrink-0 shadow-2xs" />
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {language === 'mr' ? 'भूमिका निवडा' : language === 'hi' ? 'भूमिका चुनें' : 'Select Operational Role'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Configures tailored views while maintaining single backend authority.
            </p>
          </div>
        </div>
      </div>

      {/* Role Selection Cards */}
      <div className="my-auto space-y-3 py-3 max-w-sm w-full mx-auto">
        {roles.map((r) => {
          const isSelected = currentRole === r.id;
          return (
            <div
              key={r.id}
              onClick={() => onSelectRole && onSelectRole(r.id)}
              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                isSelected
                  ? `${r.borderAccent} shadow-md`
                  : 'bg-white hover:bg-slate-100/70 border-slate-200/90 text-slate-700 shadow-2xs'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 shrink-0">
                    {r.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-black text-slate-900">{r.title}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${r.badgeClass}`}>
                        {r.badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 font-medium mt-0.5">{r.tagline}</p>
                  </div>
                </div>

                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                  isSelected ? 'border-sky-700 bg-sky-700 text-white' : 'border-slate-300 bg-white'
                }`}>
                  {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </div>

              {/* Highlights */}
              <div className="mt-2.5 pt-2.5 border-t border-slate-200/80 text-[11px] space-y-1 text-slate-600">
                {r.highlights.map((h, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="text-teal-600 font-bold">•</span>
                    <span>{h}</span>
                  </div>
                ))}
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
          <span>
            {language === 'mr' ? 'पुढे जा (लॉगिन करा)' : language === 'hi' ? 'आगे बढ़ें (लॉगिन करें)' : 'Continue to Login'}
          </span>
          <ArrowRight className="w-4 h-4" />
        </button>

        <p className="text-[10.5px] text-slate-400 text-center font-medium">
          You can switch roles anytime within the application.
        </p>
      </div>
    </div>
  );
}
