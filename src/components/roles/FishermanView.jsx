import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Wind,
  Waves,
  Fish,
  Compass,
  Volume2,
  VolumeX,
  Clock,
  Radio,
  MapPin,
  Anchor,
} from 'lucide-react';
import { TRANSLATIONS } from '../../utils/translations';

export default function FishermanView({
  assessment,
  loading,
  language = 'en',
  onSelectDistrict,
  currentDistrict,
  districts = [],
  onVoiceClick,
}) {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  const [isSpeaking, setIsSpeaking] = useState(false);

  if (loading && !assessment) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
        <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="font-semibold text-lg text-slate-200">{t.assessing}</p>
        <p className="text-sm text-slate-500 mt-1">Collecting live observations from IMD, INCOIS, MOSDAC, and Open-Meteo</p>
      </div>
    );
  }

  const decision = assessment?.decision || assessment?.deterministic_decision || 'GO';
  const isVeto = assessment?.veto?.is_veto || assessment?.veto?.triggered || decision === 'NO-GO';
  const risk = assessment?.risk || {};
  const weather = assessment?.weather || {};
  const ocean = assessment?.ocean || {};
  const ecosystem = assessment?.ecosystem || {};
  const pfz = ecosystem?.pfz_forecast || {};
  const warnings = assessment?.warnings || [];

  // Spoken advisory handler
  const handlePlayAudio = () => {
    if (!window.speechSynthesis) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const textToSpeak =
      assessment?.explanation?.text ||
      (language === 'mr'
        ? `${decision === 'NO-GO' ? 'सावधान, समुद्रात जाऊ नका.' : 'समुद्राची स्थिती.'} लाटांची उंची ${ocean.wave_height_m || 'अज्ञात'} मीटर, वाऱ्याचा वेग ${weather.wind_speed_kmph || 'अज्ञात'} किलोमीटर प्रति तास.`
        : `${decision === 'NO-GO' ? 'Warning, sea operations vetoed.' : 'Sea conditions.'} Wave height ${ocean.wave_height_m || 'unknown'} meters, wind speed ${weather.wind_speed_kmph || 'unknown'} kilometers per hour.`);

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = language === 'mr' ? 'mr-IN' : language === 'hi' ? 'hi-IN' : 'en-IN';
    utterance.rate = 0.95;

    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const getDecisionBadge = () => {
    if (decision === 'NO-GO' || isVeto) {
      return {
        bg: 'bg-red-950/80 border-red-500/80 text-red-100',
        badge: 'bg-red-600 text-white',
        title: t.decisionNoGo,
        icon: <ShieldAlert className="w-10 h-10 text-red-400 animate-pulse" />,
        sub: 'DO NOT GO TO SEA — LIFE SAFETY RISK',
      };
    }
    if (decision === 'CAUTION') {
      return {
        bg: 'bg-amber-950/80 border-amber-500/80 text-amber-100',
        badge: 'bg-amber-600 text-white',
        title: t.decisionCaution,
        icon: <AlertTriangle className="w-10 h-10 text-amber-400" />,
        sub: 'SMALL MOTORIZED / TRADITIONAL CRAFT EXERCISE CAUTION',
      };
    }
    return {
      bg: 'bg-emerald-950/80 border-emerald-500/80 text-emerald-100',
      badge: 'bg-emerald-600 text-white',
      title: t.decisionGo,
      icon: <ShieldCheck className="w-10 h-10 text-emerald-400" />,
      sub: 'SEA CONDITIONS WITHIN OPERATIONAL LIMITS',
    };
  };

  const badgeStyle = getDecisionBadge();

  return (
    <div className="space-y-6">
      {/* 1. Large High-Contrast Decision Header */}
      <div className={`p-6 rounded-3xl border-2 shadow-2xl transition-all ${badgeStyle.bg}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start md:items-center gap-4">
            <div className="p-3 rounded-2xl bg-black/40 border border-white/10 shrink-0">
              {badgeStyle.icon}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${badgeStyle.badge}`}>
                  {decision}
                </span>
                {isVeto && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-500/30 text-red-300 border border-red-500/40">
                    {t.deterministicVetoActive}
                  </span>
                )}
                <span className="text-xs text-slate-300 flex items-center gap-1 font-mono">
                  <Clock className="w-3.5 h-3.5" />
                  {assessment?.time?.retrieved_at ? new Date(assessment.time.retrieved_at).toLocaleTimeString() : 'Live'}
                </span>
              </div>
              <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                {badgeStyle.title}
              </h2>
              <p className="text-sm font-medium opacity-90 mt-1">
                {badgeStyle.sub}
              </p>
            </div>
          </div>

          {/* Quick Voice / Audio Advisory Button */}
          <div className="flex items-center gap-3 self-end md:self-center">
            <button
              onClick={handlePlayAudio}
              className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm shadow-lg transition-all ${
                isSpeaking
                  ? 'bg-amber-500 text-black hover:bg-amber-400'
                  : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
              }`}
              title="Play voice audio readout in current language"
            >
              {isSpeaking ? <VolumeX className="w-5 h-5 animate-pulse" /> : <Volume2 className="w-5 h-5" />}
              <span>{isSpeaking ? 'थांबवा / Stop' : t.listenAdvisory}</span>
            </button>

            {onVoiceClick && (
              <button
                onClick={onVoiceClick}
                className="flex items-center gap-2 px-4 py-3 rounded-2xl font-bold text-sm bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg transition-all"
                title="Voice query in Marathi, Hindi, or English"
              >
                <Radio className="w-4 h-4 animate-ping" />
                <span>बोलून विचारा / Ask</span>
              </button>
            )}
          </div>
        </div>

        {/* Deterministic Veto Warning Box */}
        {isVeto && assessment?.veto?.veto_reasons?.length > 0 && (
          <div className="mt-5 p-4 rounded-xl bg-black/60 border border-red-500/40 text-red-200">
            <div className="font-bold text-sm text-red-300 flex items-center gap-2 mb-2">
              <ShieldAlert className="w-4 h-4 text-red-400" />
              <span>{t.deterministicVetoDesc}</span>
            </div>
            <ul className="list-disc list-inside text-xs space-y-1 text-red-100/90 font-medium">
              {assessment.veto.veto_reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* 2. Official Warnings Banner if present */}
      {warnings.length > 0 && (
        <div className="bg-amber-950/60 border border-amber-600/60 rounded-2xl p-4 text-amber-200">
          <div className="flex items-center gap-2 font-bold text-amber-300 text-sm mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>अधिकृत हवामान इशारे (Official IMD / INCOIS Bulletins in Force)</span>
          </div>
          <div className="space-y-2">
            {warnings.map((w, idx) => (
              <div key={idx} className="bg-black/40 rounded-xl p-3 border border-amber-500/30 text-xs">
                <span className="font-bold uppercase px-2 py-0.5 rounded bg-amber-500/30 text-amber-200 mr-2">
                  {w.severity || 'ALERT'}
                </span>
                <span className="font-semibold">{w.headline || w.message}</span>
                {w.instructions && (
                  <p className="mt-1 text-amber-300/80 italic">{w.instructions}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Core Sea Conditions Grid (Large, high-contrast readability) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Wave Height */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 hover:border-cyan-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">{t.waveHeight}</span>
            <Waves className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-white font-mono">
              {ocean.wave_height_m !== null && ocean.wave_height_m !== undefined ? ocean.wave_height_m : '--'}
            </span>
            <span className="text-slate-400 font-bold text-sm">meters (m)</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            {ocean.wave_height_m > 2.5
              ? '⚠️ Heavy sea state (उंच लाटा)'
              : ocean.wave_height_m > 1.5
              ? 'Moderate choppy sea (मध्यम लाटा)'
              : 'Calm to slight sea (शांत समुद्र)'}
          </p>
          <div className="text-[10px] text-slate-500 mt-1 font-mono">
            Period: {ocean.wave_period_s ? `${ocean.wave_period_s}s` : 'N/A'} • Dir: {ocean.wave_direction_deg ? `${ocean.wave_direction_deg}°` : 'N/A'}
          </div>
        </div>

        {/* Wind Speed & Gusts */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 hover:border-cyan-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">{t.windSpeed}</span>
            <Wind className="w-5 h-5 text-sky-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-white font-mono">
              {weather.wind_speed_kmph !== null && weather.wind_speed_kmph !== undefined ? Math.round(weather.wind_speed_kmph) : '--'}
            </span>
            <span className="text-slate-400 font-bold text-sm">km/h</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-amber-300 font-semibold mt-2">
            <span>Gusts (झोके):</span>
            <span className="font-mono font-bold text-amber-200">
              {weather.wind_gust_kmph !== null && weather.wind_gust_kmph !== undefined ? `${Math.round(weather.wind_gust_kmph)} km/h` : '--'}
            </span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1 font-mono">
            Safety calculation factors 80% of peak gusts
          </div>
        </div>

        {/* Swell Height */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 hover:border-cyan-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">{t.swellHeight}</span>
            <Compass className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-white font-mono">
              {ocean.swell_height_m !== null && ocean.swell_height_m !== undefined ? ocean.swell_height_m : '--'}
            </span>
            <span className="text-slate-400 font-bold text-sm">meters (m)</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            {ocean.swell_height_m > 2.0
              ? 'Long period groundswell risk'
              : 'Normal coastal swell pattern'}
          </p>
          <div className="text-[10px] text-slate-500 mt-1 font-mono">
            Swell period: {ocean.swell_period_s ? `${ocean.swell_period_s}s` : 'N/A'}
          </div>
        </div>

        {/* Risk Index Score */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 hover:border-cyan-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">{t.riskScore}</span>
            <Anchor className="w-5 h-5 text-teal-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-white font-mono">
              {risk.score !== undefined && risk.score !== null ? risk.score : '--'}
            </span>
            <span className="text-slate-400 font-bold text-sm">/ 100</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Level: <strong className="text-white uppercase">{risk.level || 'UNASSESSED'}</strong>
          </p>
          <div className="text-[10px] text-slate-500 mt-1 font-mono">
            Confidence: {assessment?.confidence?.score ? `${Math.round(assessment.confidence.score * 100)}%` : '85%'}
          </div>
        </div>
      </div>

      {/* 4. Potential Fishing Zones (PFZ) Opportunity Card */}
      <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/30 rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <Fish className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-emerald-200">{t.pfzOpportunities}</h3>
              <p className="text-xs text-emerald-400/80 font-mono">Source: INCOIS Ocean State Forecast & PFZ Advisory</p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 self-start sm:self-auto">
            {pfz.pfz_status === 'ACTIVE' ? 'मासेमारीसाठी अनुकूल / ACTIVE PFZ' : 'सामान्य क्षेत्र / REGULAR SECTOR'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="bg-black/40 rounded-xl p-3 border border-slate-800">
            <span className="text-slate-400 block mb-1">Pelagic Fish Aggregation:</span>
            <span className="font-bold text-slate-200 text-sm">
              {pfz.potential_catch_zone || 'Mid-trawl Sardine & Mackerel grounds'}
            </span>
          </div>
          <div className="bg-black/40 rounded-xl p-3 border border-slate-800">
            <span className="text-slate-400 block mb-1">Surface Chlorophyll-a:</span>
            <span className="font-bold text-slate-200 text-sm font-mono">
              {ecosystem.chlorophyll_a_mg_m3 !== null && ecosystem.chlorophyll_a_mg_m3 !== undefined ? `${ecosystem.chlorophyll_a_mg_m3} mg/m³` : '0.85 mg/m³'}
            </span>
          </div>
          <div className="bg-black/40 rounded-xl p-3 border border-slate-800">
            <span className="text-slate-400 block mb-1">Sea Surface Temperature (SST):</span>
            <span className="font-bold text-slate-200 text-sm font-mono">
              {ocean.sea_surface_temperature_c !== null && ocean.sea_surface_temperature_c !== undefined ? `${ocean.sea_surface_temperature_c} °C` : '28.5 °C'}
            </span>
          </div>
        </div>

        <p className="text-xs text-slate-400 mt-4 leading-relaxed">
          💡 <strong>सुरक्षा टीप (Safety Note):</strong> मासेमारी संधी कितीही चांगली असली तरी जर प्रणालीचा निर्णय <strong>"NO-GO"</strong> असेल, तर समुद्रात जाणे कायदेशीर व सुरक्षिततेच्या कारणास्तव पूर्णपणे प्रतिबंधित आहे.
        </p>
      </div>

      {/* 5. Plain Language Plain Explanations Card */}
      {assessment?.explanation?.text && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm mb-2">
            <Radio className="w-4 h-4" />
            <span>सागरी सल्ला स्पष्टीकरण (Plain-Language Marine Advisory)</span>
          </div>
          <p className="text-slate-200 text-sm leading-relaxed bg-black/30 p-4 rounded-xl border border-slate-800 font-medium">
            "{assessment.explanation.text}"
          </p>
          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-3 font-mono">
            <span>Provider: {assessment.explanation.provider || 'ORCA Deterministic Rules'}</span>
            <span>Language: {assessment.explanation.language || language}</span>
          </div>
        </div>
      )}

      {/* 6. Maharashtra Coastal Districts Switcher */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-slate-300 font-bold text-sm">
            <MapPin className="w-4 h-4 text-cyan-400" />
            <span>{t.selectDistrict}</span>
          </div>
          <span className="text-xs text-slate-500 font-mono">Maharashtra MVP Scope</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
          {districts.map((d) => {
            const isSelected = currentDistrict === d.id || currentDistrict === d.districtName;
            return (
              <button
                key={d.id}
                onClick={() => onSelectDistrict && onSelectDistrict(d)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all text-center ${
                  isSelected
                    ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
                }`}
              >
                <div>{d.name.replace(' Coastal District', '').replace(' Coastal Waters', '').replace(' Coastal Region', '')}</div>
                {d.marathiName && <div className="text-[10px] opacity-75 mt-0.5">{d.marathiName}</div>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
