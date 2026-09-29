import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Compass,
  Radio,
  Crosshair,
  Layers,
} from 'lucide-react';
import MapPicker from '../MapPicker';
import VoiceControls from '../VoiceControls';
import { voiceManager } from '../../services/voiceManager';
import { formatAssessmentForSpeech } from '../../utils/speechFormatting';
import { TRANSLATIONS } from '../../utils/translations';

export default function MobileCoastGuardApp({
  assessment,
  language = 'en',
  onReassessSAR,
  onMapLocationSelect,
  onVoiceClick,
}) {
  const _t = TRANSLATIONS[language] || TRANSLATIONS.en;
  const [activeTab, setActiveTab] = useState('command'); // 'command' | 'map' | 'sar' | 'alerts'
  const [hoursAdrift, setHoursAdrift] = useState('3.0');
  const [lkpLat, setLkpLat] = useState('');
  const [lkpLon, setLkpLon] = useState('');
  const [vesselType, setVesselType] = useState('traditional_motorized');

  // Cancel speech on unmount
  useEffect(() => {
    return () => {
      voiceManager.stop();
    };
  }, []);

  const decision = assessment?.decision || 'GO';
  const _isVeto = assessment?.veto?.is_veto || assessment?.veto?.triggered || decision === 'NO-GO';
  const drift = assessment?.drift || {};
  const prediction = drift?.prediction || {};
  const predictedPos = assessment?.predicted_position || prediction?.predicted_position;
  const searchRadius = assessment?.search_radius || {
    radius_nm: prediction?.search_radius_nm,
    radius_km: prediction?.search_radius_km,
  };
  const geofencing = assessment?.geofencing || {};
  const warnings = assessment?.warnings || [];

  const handleUpdateSAR = (e) => {
    e.preventDefault();
    if (onReassessSAR) {
      onReassessSAR({
        hoursAdrift: parseFloat(hoursAdrift) || 3.0,
        lkpLat: lkpLat ? parseFloat(lkpLat) : null,
        lkpLon: lkpLon ? parseFloat(lkpLon) : null,
        vesselClass: vesselType,
      });
    }
  };

  const handleSpeakBriefing = () => {
    const spokenText = formatAssessmentForSpeech(assessment, language, 'coast_guard');
    voiceManager.speak(spokenText, language);
  };

  return (
    <div className="flex-1 flex flex-col justify-between bg-slate-50 text-slate-800 select-none overflow-hidden font-sans">
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-20">
        
        {/* Top Header Card (Clean Light Style) */}
        <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-100 text-sky-800 border border-sky-200 font-mono">
              COAST GUARD SECTOR • MAHARASHTRA
            </span>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                decision === 'NO-GO' ? 'bg-red-600 text-white' : decision === 'CAUTION' ? 'bg-amber-500 text-slate-950' : 'bg-emerald-600 text-white'
              }`}>
                {decision}
              </span>
            </div>
          </div>

          <div>
            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
              {language === 'mr' ? 'तटरक्षक दल कमांड केंद्र' : language === 'hi' ? 'तटरक्षक बल कमांड केंद्र' : 'Coast Guard Command Sector'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Tactical Surveillance • SAR Leeway Modeling • Sanctuary Geofence
            </p>
          </div>

          {/* Voice Controls Bar */}
          <div className="pt-1">
            <VoiceControls
              onPlay={handleSpeakBriefing}
              language={language}
            />
          </div>
        </div>

        {/* ==================== TAB: COMMAND ==================== */}
        {activeTab === 'command' && (
          <div className="space-y-4">
            
            {/* SAR Leeway Drift Prediction Card */}
            <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                <span className="flex items-center gap-1.5 text-sky-800">
                  <Compass className="w-4 h-4 text-sky-700" />
                  <span>शोध व बचाव (IAMSAR Leeway Drift Prediction)</span>
                </span>
                <span className="text-[10px] font-mono text-slate-400">V_d = V_c + γ·V_w</span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-slate-500 block text-[11px]">Leeway Velocity:</span>
                  <span className="text-2xl font-black text-sky-800 font-mono">
                    {drift.leeway_drift_velocity_kmph ?? '2.2'} km/h
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    Heading: {Math.round(drift.drift_direction_deg || 220)}°
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-slate-500 block text-[11px]">Search Radius (R):</span>
                  <span className="text-2xl font-black text-amber-700 font-mono">
                    {searchRadius.radius_nm ?? '2.5'} NM
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    Metric: {searchRadius.radius_km ?? '4.6'} km
                  </span>
                </div>
              </div>

              {predictedPos && (
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-[11px] font-mono text-slate-700 flex items-center justify-between">
                  <span className="font-bold text-slate-800">Predicted Target Datum:</span>
                  <span className="text-emerald-700 font-bold">{predictedPos.latitude?.toFixed(4)}°N, {predictedPos.longitude?.toFixed(4)}°E</span>
                </div>
              )}
            </div>

            {/* Geofence & Boundary Surveillance */}
            <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-3 text-xs">
              <div className="flex items-center justify-between font-bold text-slate-800">
                <span className="flex items-center gap-1.5 text-sky-800">
                  <Layers className="w-4 h-4 text-sky-700" />
                  <span>किनारपट्टी सीमा व अभयारण्य (Geofence Governance)</span>
                </span>
              </div>

              <div className="space-y-2">
                <div className={`p-3.5 rounded-2xl border ${
                  geofencing.in_sanctuary
                    ? 'bg-red-50 border-red-200 text-red-950'
                    : 'bg-slate-50 border-slate-100 text-slate-700'
                }`}>
                  <div className="flex items-center justify-between font-bold mb-1">
                    <span>Malvan Marine Sanctuary (मालवण अभयारण्य):</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                      geofencing.in_sanctuary ? 'bg-red-600 text-white' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {geofencing.in_sanctuary ? 'BREACHED' : 'CLEAR'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Ecologically sensitive marine protected zone (15.95°N – 16.08°N). Unauthorized trawler entry triggers immediate veto.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 text-slate-700">
                  <div className="flex items-center justify-between font-bold mb-1">
                    <span>Maritime Boundary (IMBL Proximity):</span>
                    <span className="text-sky-800 font-mono font-bold">
                      {geofencing.distance_to_imbl_nm !== undefined ? `${geofencing.distance_to_imbl_nm} NM` : 'Safe Distance'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Small craft with fuel endurance &lt;24 hours within 15 NM of boundary receive proximity alerts.
                  </p>
                </div>
              </div>
            </div>

            {/* Vessel Oversight Policy Notice */}
            <div className="p-4 rounded-3xl bg-sky-50 border border-sky-100 text-xs text-sky-950 leading-relaxed shadow-xs">
              <strong>Operational Policy Note:</strong> Live transponder AIS feeds remain on secure government hardware. ORCA calculates mathematical leeway drift based on reported last-known position (LKP).
            </div>
          </div>
        )}

        {/* ==================== TAB: RADAR MAP ==================== */}
        {activeTab === 'map' && (
          <div className="space-y-3">
            <div className="p-3 bg-white rounded-2xl border border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700 shadow-xs">
              <span>तटरक्षक रडार नकाशा (Tactical Map)</span>
              <span className="text-sky-800 font-mono text-[11px]">
                {assessment?.location?.label || 'Maharashtra Sector'}
              </span>
            </div>

            <div className="h-[460px] rounded-3xl overflow-hidden border border-slate-200 shadow-sm">
              <MapPicker
                lat={assessment?.location?.latitude || 18.9438}
                lon={assessment?.location?.longitude || 72.8360}
                onLocationSelect={(lat, lon, dName) => onMapLocationSelect && onMapLocationSelect(lat, lon, dName)}
                label={assessment?.location?.label || 'Tactical Marine Position'}
                riskLevel={assessment?.risk?.level}
                predictedPosition={assessment?.predicted_position}
                searchRadiusNm={assessment?.search_radius?.radius_nm}
              />
            </div>
          </div>
        )}

        {/* ==================== TAB: SAR SIMULATOR ==================== */}
        {activeTab === 'sar' && (
          <div className="space-y-4">
            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-3.5 text-xs">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <Crosshair className="w-4 h-4 text-sky-700" />
                <span>शोध मोहीम नियोजन (IAMSAR Drift Simulation)</span>
              </div>
              <p className="text-slate-600 leading-relaxed">
                Provide Last Known Position (LKP) and hours adrift to recalculate the probability of containment (POC) search box.
              </p>

              <form onSubmit={handleUpdateSAR} className="space-y-3.5 pt-1">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">
                    नौकेचा वर्ग (Target Vessel Class):
                  </label>
                  <select
                    value={vesselType}
                    onChange={(e) => setVesselType(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 font-semibold outline-none focus:border-sky-500"
                  >
                    <option value="traditional_motorized">Traditional Motorized Craft (5-10m)</option>
                    <option value="traditional_non_motorized">Traditional Non-Motorized Dinghy (&lt;5m)</option>
                    <option value="mechanized_trawler">Mechanized Trawler (12-24m)</option>
                    <option value="coastal_patrol_craft">Coastal Patrol Craft (IB / Interceptor)</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-700 font-bold block mb-1">
                    वाहून गेल्याचा कालावधी / तास (Hours Adrift - t):
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="72"
                    value={hoursAdrift}
                    onChange={(e) => setHoursAdrift(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 font-mono font-bold outline-none focus:border-sky-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-slate-700 font-bold block mb-1">LKP Lat (°N):</label>
                    <input
                      type="text"
                      placeholder="e.g. 18.94"
                      value={lkpLat}
                      onChange={(e) => setLkpLat(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-mono outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="text-slate-700 font-bold block mb-1">LKP Lon (°E):</label>
                    <input
                      type="text"
                      placeholder="e.g. 72.83"
                      value={lkpLon}
                      onChange={(e) => setLkpLon(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-mono outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 bg-gradient-to-r from-sky-700 to-indigo-700 hover:from-sky-600 text-white font-extrabold rounded-2xl transition-all shadow-md shadow-sky-700/20 text-xs cursor-pointer"
                >
                  नवीन शोध क्षेत्र मोजा / Update SAR Search Box
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ==================== TAB: ALERTS ==================== */}
        {activeTab === 'alerts' && (
          <div className="space-y-3 text-xs">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-600" />
              <span>सक्रिय सागरी इशारे व Veto आदेश (Maritime Bulletins)</span>
            </h3>

            {warnings.length === 0 ? (
              <div className="p-6 text-center bg-white border border-slate-200 rounded-3xl shadow-xs text-slate-500">
                <ShieldCheck className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                <p className="font-bold text-slate-800">No active cyclone or severe military alert in this sector</p>
              </div>
            ) : (
              <div className="space-y-2">
                {warnings.map((w, idx) => (
                  <div key={idx} className="p-4 rounded-3xl bg-red-50 border border-red-200 text-red-950 space-y-1 shadow-xs">
                    <span className="font-black uppercase px-2 py-0.5 rounded bg-red-200 text-red-900 text-[10px]">
                      {w.severity || 'ALERT'}
                    </span>
                    <h4 className="font-bold text-slate-900 text-sm">{w.headline || w.message}</h4>
                    {w.instructions && <p className="text-red-800 italic pt-0.5">{w.instructions}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Fixed Clean Light Bottom Nav Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 py-1.5 px-3 max-w-md mx-auto shadow-lg">
        <div className="grid grid-cols-5 gap-1 text-center">
          <button
            onClick={() => setActiveTab('command')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all cursor-pointer ${
              activeTab === 'command' ? 'text-sky-800 font-black' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldAlert className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">कमांड</span>
          </button>

          <button
            onClick={() => setActiveTab('map')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all cursor-pointer ${
              activeTab === 'map' ? 'text-sky-800 font-black' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Compass className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">रडार (Map)</span>
          </button>

          <button
            onClick={() => setActiveTab('sar')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all cursor-pointer ${
              activeTab === 'sar' ? 'text-sky-800 font-black' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Crosshair className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">SAR शोध</span>
          </button>

          <button
            onClick={() => setActiveTab('alerts')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all relative cursor-pointer ${
              activeTab === 'alerts' ? 'text-sky-800 font-black' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <AlertTriangle className="w-5 h-5 mb-0.5" />
            {warnings.length > 0 && (
              <span className="absolute top-0 right-3 w-2 h-2 rounded-full bg-red-600 animate-ping" />
            )}
            <span className="text-[10px]">इशारे</span>
          </button>

          <button
            onClick={onVoiceClick}
            className="flex flex-col items-center justify-center py-1 rounded-xl text-sky-800 hover:text-sky-900 font-bold cursor-pointer"
          >
            <div className="w-7 h-7 rounded-full bg-sky-100 flex items-center justify-center mb-0.5 border border-sky-300">
              <Radio className="w-3.5 h-3.5 text-sky-800 animate-pulse" />
            </div>
            <span className="text-[10px]">असिस्टंट</span>
          </button>
        </div>
      </div>
    </div>
  );
}
