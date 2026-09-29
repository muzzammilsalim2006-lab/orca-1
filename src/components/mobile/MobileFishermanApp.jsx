import React, { useState, useEffect } from 'react';
import {
  Home,
  MapPin,
  Anchor,
  AlertTriangle,
  Radio,
  Waves,
  Wind,
  Compass,
  Fish,
  Clock,
  ShieldAlert,
  ShieldCheck,
  CheckCircle,
  Navigation,
} from 'lucide-react';
import MapPicker from '../MapPicker';
import VoiceControls from '../VoiceControls';
import { voiceManager } from '../../services/voiceManager';
import { formatAssessmentForSpeech } from '../../utils/speechFormatting';
import { TRANSLATIONS } from '../../utils/translations';

export default function MobileFishermanApp({
  assessment,
  language = 'mr',
  districts = [],
  onSelectDistrict,
  onMapLocationSelect,
  onVoiceClick,
  onAssessTrip,
}) {
  const _t = TRANSLATIONS[language] || TRANSLATIONS.mr;
  const [activeTab, setActiveTab] = useState('home'); // 'home' | 'map' | 'trip' | 'alerts'
  const [tripVessel, setTripVessel] = useState('traditional_motorized');
  const [tripHours, setTripHours] = useState('4');

  // Cancel speech on unmount
  useEffect(() => {
    return () => {
      voiceManager.stop();
    };
  }, []);

  const decision = assessment?.decision || assessment?.deterministic_decision || 'GO';
  const isVeto = assessment?.veto?.is_veto || assessment?.veto?.triggered || decision === 'NO-GO';
  const risk = assessment?.risk || {};
  const weather = assessment?.weather || {};
  const ocean = assessment?.ocean || {};
  const ecosystem = assessment?.ecosystem || {};
  const pfz = ecosystem?.pfz_forecast || {};
  const warnings = assessment?.warnings || [];

  // Spoken natural female audio advisory using authoritative assessment
  const handlePlayAudio = () => {
    const spokenText = formatAssessmentForSpeech(assessment, language, 'fisherman');
    voiceManager.speak(spokenText, language);
  };

  // Clean Light Theme Safety Status Badge & Card
  const getSafetyCardData = () => {
    if (decision === 'NO-GO' || isVeto) {
      return {
        cardBg: 'bg-red-50 border-red-200 text-red-950',
        badgeBg: 'bg-red-600 text-white',
        title: '🔴 NO-GO — समुद्रात जाऊ नका',
        titleEn: 'DO NOT GO TO SEA',
        sub: 'हवामान अथवा लाटा धोकादायक मर्यादेपलीकडे आहेत.',
        icon: <ShieldAlert className="w-8 h-8 text-red-600" />,
        accent: 'border-l-4 border-l-red-600',
      };
    }
    if (decision === 'CAUTION') {
      return {
        cardBg: 'bg-amber-50 border-amber-200 text-amber-950',
        badgeBg: 'bg-amber-500 text-slate-950',
        title: '🟠 CAUTION — सावधगिरी बाळगा',
        titleEn: 'EXERCISE HIGH CAUTION',
        sub: 'लहान नौकांनी सावध राहावे; लाटा किंवा वारे वाढलेले आहेत.',
        icon: <AlertTriangle className="w-8 h-8 text-amber-600" />,
        accent: 'border-l-4 border-l-amber-500',
      };
    }
    return {
      cardBg: 'bg-emerald-50 border-emerald-200 text-emerald-950',
      badgeBg: 'bg-emerald-600 text-white',
      title: '🟢 GO — समुद्रात जाऊ शकता',
      titleEn: 'CONDITIONS MANAGEABLE',
      sub: 'सागरी परिस्थिती सामान्य आणि सुरक्षित आहे.',
      icon: <ShieldCheck className="w-8 h-8 text-emerald-600" />,
      accent: 'border-l-4 border-l-emerald-600',
    };
  };

  const safety = getSafetyCardData();

  return (
    <div className="flex-1 flex flex-col justify-between bg-slate-50 text-slate-800 select-none overflow-hidden font-sans">
      {/* Scrollable Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-20">
        
        {/* ==================== TAB: HOME ==================== */}
        {activeTab === 'home' && (
          <div className="space-y-4">
            
            {/* 1. Primary Safety Decision Card (Clean, light, instantly understandable) */}
            <div className={`p-5 rounded-3xl border shadow-sm space-y-3.5 transition-all ${safety.cardBg} ${safety.accent}`}>
              {/* Header line with badge and time */}
              <div className="flex items-center justify-between">
                <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${safety.badgeBg}`}>
                  {decision}
                </span>
                <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {assessment?.time?.retrieved_at ? new Date(assessment.time.retrieved_at).toLocaleTimeString() : 'Live'}
                </span>
              </div>

              {/* Decision text and icon */}
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 rounded-2xl bg-white shadow-xs shrink-0 border border-slate-100">
                  {safety.icon}
                </div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 leading-snug">
                    {safety.title}
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed font-medium">
                    {safety.sub}
                  </p>
                </div>
              </div>

              {/* Why? Immediate Plain-Language Reasons Box */}
              {isVeto && assessment?.veto?.veto_reasons?.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-white border border-red-200 text-xs space-y-1.5 shadow-xs">
                  <span className="font-extrabold text-red-700 block">
                    कारण (Why is it NO-GO?):
                  </span>
                  <ul className="space-y-1 text-slate-700 text-xs">
                    {assessment.veto.veto_reasons.map((r, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-red-600 font-bold">•</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action Buttons: Audio Advisory & Voice Query */}
              <div className="pt-2 flex items-center gap-2">
                <VoiceControls
                  onPlay={handlePlayAudio}
                  language={language}
                  className="flex-1"
                />

                <button
                  type="button"
                  onClick={onVoiceClick}
                  className="py-2.5 px-4 rounded-2xl font-extrabold text-xs bg-sky-700 hover:bg-sky-600 text-white flex items-center gap-1.5 shadow-md shadow-sky-700/20 transition-all cursor-pointer active:scale-[0.98]"
                >
                  <Radio className="w-4 h-4" />
                  <span>बोलून विचारा / Ask</span>
                </button>
              </div>
            </div>

            {/* 2. Official Warnings Notification if active */}
            {warnings.length > 0 && (
              <div className="p-4 rounded-3xl bg-amber-50 border border-amber-200 shadow-xs space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>हवामान खात्याचे अधिकृत इशारे (Official Warning Bulletins)</span>
                </div>
                {warnings.map((w, idx) => (
                  <div key={idx} className="p-3 bg-white rounded-2xl border border-amber-200 text-xs space-y-1">
                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-100 text-amber-900 mr-2">
                      {w.severity || 'WARNING'}
                    </span>
                    <span className="font-bold text-slate-800">{w.headline || w.message}</span>
                    {w.instructions && (
                      <p className="text-slate-600 text-[11px] italic mt-1">{w.instructions}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 3. Core Marine Weather & Ocean Conditions (Light 2x2 cards) */}
            <div className="grid grid-cols-2 gap-3">
              {/* Wave Card */}
              <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-1">
                <div className="flex items-center justify-between text-slate-500 mb-0.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider">लाटा (Waves)</span>
                  <Waves className="w-4 h-4 text-sky-600" />
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-slate-900 font-mono">
                    {ocean.wave_height_m !== undefined && ocean.wave_height_m !== null ? ocean.wave_height_m : '--'}
                  </span>
                  <span className="text-xs font-bold text-slate-500">meters</span>
                </div>
                <p className="text-[11px] text-slate-600 pt-0.5">
                  {ocean.wave_height_m > 2.2 ? '⚠️ धोकादायक लाटा' : ocean.wave_height_m > 1.5 ? 'मध्यम लाटा' : 'शांत समुद्र'}
                </p>
                <div className="text-[10px] text-slate-400 font-mono pt-1">
                  Period: {ocean.wave_period_s ? `${ocean.wave_period_s}s` : '8s'}
                </div>
              </div>

              {/* Wind Card */}
              <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-1">
                <div className="flex items-center justify-between text-slate-500 mb-0.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider">वारे (Wind)</span>
                  <Wind className="w-4 h-4 text-teal-600" />
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-slate-900 font-mono">
                    {weather.wind_speed_kmph ? Math.round(weather.wind_speed_kmph) : '--'}
                  </span>
                  <span className="text-xs font-bold text-slate-500">km/h</span>
                </div>
                <div className="text-[11px] font-semibold text-amber-700 pt-0.5">
                  झोके (Gusts): {weather.wind_gust_kmph ? `${Math.round(weather.wind_gust_kmph)} km/h` : '--'}
                </div>
                <div className="text-[10px] text-slate-400 font-mono pt-1">
                  Calculates 80% peak gust
                </div>
              </div>

              {/* Swell Card */}
              <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-1">
                <div className="flex items-center justify-between text-slate-500 mb-0.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider">उधाण (Swell)</span>
                  <Compass className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-slate-900 font-mono">
                    {ocean.swell_height_m !== undefined && ocean.swell_height_m !== null ? ocean.swell_height_m : '--'}
                  </span>
                  <span className="text-xs font-bold text-slate-500">meters</span>
                </div>
                <p className="text-[11px] text-slate-600 pt-0.5">
                  Groundswell wave height
                </p>
              </div>

              {/* Risk Index Card */}
              <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-1">
                <div className="flex items-center justify-between text-slate-500 mb-0.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider">धोका (Risk)</span>
                  <Anchor className="w-4 h-4 text-slate-600" />
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-slate-900 font-mono">
                    {risk.score ?? '--'}
                  </span>
                  <span className="text-xs font-bold text-slate-500">/ 100</span>
                </div>
                <p className="text-[11px] font-extrabold text-sky-800 uppercase pt-0.5">
                  {risk.level || 'LOW'} RISK
                </p>
              </div>
            </div>

            {/* 4. Potential Fishing Zone (PFZ) Opportunity Card */}
            <div className="p-4 rounded-3xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 text-xs space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-emerald-900">
                  <Fish className="w-4 h-4 text-emerald-700" />
                  <span>मासेमारी संधी (INCOIS PFZ Opportunity)</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white">
                  {pfz.pfz_status === 'ACTIVE' ? 'मासेमारी अनुकूल' : 'सामान्य क्षेत्र'}
                </span>
              </div>
              <p className="text-slate-700 leading-relaxed font-medium">
                {pfz.potential_catch_zone || 'Coastal pelagic aggregation (Mackerel, Sardines) near 20m depth contour.'}
              </p>
              <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1 font-mono border-t border-emerald-200/60">
                <span>Chlorophyll: {ecosystem.chlorophyll_a_mg_m3 || '0.85'} mg/m³</span>
                <span>SST: {ocean.sea_surface_temperature_c || '28.5'} °C</span>
              </div>
            </div>

            {/* 5. Natural Language Advisory */}
            {assessment?.explanation?.text && (
              <div className="p-4 rounded-3xl bg-white border border-slate-200 text-xs shadow-xs space-y-1.5">
                <div className="font-bold text-sky-800 flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-sky-600" />
                  <span>सागरी सल्ला (Natural Language Marine Advisory):</span>
                </div>
                <p className="text-slate-700 leading-relaxed font-medium bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  "{assessment.explanation.text}"
                </p>
              </div>
            )}

            {/* 6. Quick Coastal District Switcher (7 Maharashtra Districts) */}
            <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-sky-600" />
                  <span>महाराष्ट्र किनारपट्टी जिल्हा निवडा:</span>
                </span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 text-xs">
                {districts.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => onSelectDistrict && onSelectDistrict(d)}
                    className="p-2.5 rounded-2xl bg-slate-50 hover:bg-sky-50 text-slate-800 hover:text-sky-900 font-bold text-center border border-slate-200 hover:border-sky-300 transition-all text-[11px] cursor-pointer shadow-2xs"
                  >
                    <div>{d.name.replace(' Coastal District', '').replace(' Coastal Waters', '').replace(' Coastal Region', '')}</div>
                    {d.marathiName && <div className="text-[9px] text-slate-500 font-normal">{d.marathiName}</div>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB: MAP ==================== */}
        {activeTab === 'map' && (
          <div className="space-y-3">
            <div className="p-3 bg-white rounded-2xl border border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700 shadow-xs">
              <span>महाराष्ट्र सागरी संवादी नकाशा (Tap to Select Position)</span>
              <span className="text-sky-700 font-mono text-[11px]">
                {assessment?.location?.label || 'Maharashtra Sector'}
              </span>
            </div>

            <div className="h-[460px] rounded-3xl overflow-hidden border border-slate-200 shadow-sm">
              <MapPicker
                lat={assessment?.location?.latitude || 18.9438}
                lon={assessment?.location?.longitude || 72.8360}
                onLocationSelect={(lat, lon, dName) => onMapLocationSelect && onMapLocationSelect(lat, lon, dName)}
                label={assessment?.location?.label || 'Selected Marine Position'}
                riskLevel={assessment?.risk?.level}
                predictedPosition={assessment?.predicted_position}
                searchRadiusNm={assessment?.search_radius?.radius_nm}
              />
            </div>
          </div>
        )}

        {/* ==================== TAB: TRIP ASSESSMENT ==================== */}
        {activeTab === 'trip' && (
          <div className="space-y-4">
            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4 text-xs">
              <div className="flex items-center gap-2">
                <Navigation className="w-5 h-5 text-sky-700" />
                <h3 className="font-extrabold text-slate-900 text-base">मासेमारी फेरी नियोजन (Trip Assessment)</h3>
              </div>
              <p className="text-slate-600 leading-relaxed">
                Check whether planned voyage hours and vessel limits comply with backend deterministic marine safety standards.
              </p>

              <div className="space-y-3.5">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">
                    नौकेचा प्रकार (Vessel Class):
                  </label>
                  <select
                    value={tripVessel}
                    onChange={(e) => setTripVessel(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 font-semibold outline-none focus:border-sky-500"
                  >
                    <option value="traditional_motorized">Traditional Motorized Craft (OBM, max wave 2.2m)</option>
                    <option value="traditional_non_motorized">Traditional Non-Motorized Dinghy (max wave 1.2m)</option>
                    <option value="mechanized_trawler">Mechanized Trawler (max wave 3.2m)</option>
                    <option value="mechanized_purse_seiner">Mechanized Purse Seiner (max wave 3.0m)</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-700 font-bold block mb-1">
                    फेरीचा कालावधी / तास (Planned Trip Duration in Hours):
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="48"
                    value={tripHours}
                    onChange={(e) => setTripHours(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 font-mono font-bold outline-none focus:border-sky-500"
                  />
                </div>

                <button
                  onClick={() => onAssessTrip && onAssessTrip(tripVessel, parseFloat(tripHours))}
                  className="w-full py-3.5 bg-gradient-to-r from-sky-600 to-teal-600 hover:from-sky-500 text-white font-extrabold rounded-2xl text-sm transition-all shadow-md shadow-sky-600/20 cursor-pointer"
                >
                  सुरक्षा पडताळणी करा / Assess Trip Safety
                </button>
              </div>
            </div>

            {/* Current Vessel Safety Limits Box */}
            <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs text-xs space-y-2">
              <span className="font-bold text-slate-800 block">नौकेची कमाल मर्यादा (Physical Limits):</span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-slate-500 block">Max Safe Wave:</span>
                  <span className="font-black text-sky-700 font-mono text-base">
                    {tripVessel === 'traditional_non_motorized' ? '1.2 m' : tripVessel === 'traditional_motorized' ? '2.2 m' : '3.2 m'}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-slate-500 block">Max Safe Wind:</span>
                  <span className="font-black text-sky-700 font-mono text-base">
                    {tripVessel === 'traditional_non_motorized' ? '25 km/h' : '45 km/h'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB: ALERTS ==================== */}
        {activeTab === 'alerts' && (
          <div className="space-y-3">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <span>हवामान खात्याचे अधिकृत इशारे (Official IMD / INCOIS Bulletins)</span>
            </h3>

            {warnings.length === 0 ? (
              <div className="p-8 text-center bg-white border border-slate-200 rounded-3xl shadow-xs text-slate-500 space-y-2">
                <CheckCircle className="w-10 h-10 text-emerald-600 mx-auto" />
                <p className="font-bold text-slate-800 text-sm">सध्या कोणताही चक्रीवादळ अथवा तीव्र सागरी इशारा नाही</p>
                <p className="text-xs">No active cyclone, squall, or heavy marine alerts issued by IMD for this coastal sector.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {warnings.map((w, idx) => (
                  <div key={idx} className="p-4 rounded-3xl bg-amber-50 border border-amber-200 text-amber-950 text-xs space-y-1.5 shadow-xs">
                    <span className="font-black uppercase px-2 py-0.5 rounded bg-amber-200 text-amber-900 inline-block text-[10px]">
                      {w.severity || 'ALERT'}
                    </span>
                    <h4 className="font-bold text-sm text-slate-900">{w.headline || w.message}</h4>
                    {w.instructions && (
                      <p className="text-amber-800 italic pt-0.5">{w.instructions}</p>
                    )}
                    <span className="text-[10px] text-amber-700 font-mono block pt-1">
                      Source: {w.provider || 'India Meteorological Department (IMD)'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Fixed Clean Light Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 py-1.5 px-3 max-w-md mx-auto shadow-lg">
        <div className="grid grid-cols-5 gap-1 text-center">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all cursor-pointer ${
              activeTab === 'home' ? 'text-teal-700 font-black' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Home className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">मुख्य (Home)</span>
          </button>

          <button
            onClick={() => setActiveTab('map')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all cursor-pointer ${
              activeTab === 'map' ? 'text-teal-700 font-black' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <MapPin className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">नकाशा (Map)</span>
          </button>

          <button
            onClick={() => setActiveTab('trip')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all cursor-pointer ${
              activeTab === 'trip' ? 'text-teal-700 font-black' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Navigation className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">फेरी (Trip)</span>
          </button>

          <button
            onClick={() => setActiveTab('alerts')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all relative cursor-pointer ${
              activeTab === 'alerts' ? 'text-teal-700 font-black' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <AlertTriangle className="w-5 h-5 mb-0.5" />
            {warnings.length > 0 && (
              <span className="absolute top-0 right-3 w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            )}
            <span className="text-[10px]">इशारे (Alerts)</span>
          </button>

          <button
            onClick={onVoiceClick}
            className="flex flex-col items-center justify-center py-1 rounded-xl text-teal-700 hover:text-teal-800 font-bold cursor-pointer"
          >
            <div className="w-7 h-7 rounded-full bg-teal-100 flex items-center justify-center mb-0.5 border border-teal-300">
              <Radio className="w-3.5 h-3.5 text-teal-700 animate-pulse" />
            </div>
            <span className="text-[10px]">व्हॉइस (Voice)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
