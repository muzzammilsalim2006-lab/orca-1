import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import LocationSelector from './components/LocationSelector';
import RiskBadgeCard from './components/RiskBadgeCard';
import MapPicker from './components/MapPicker';
import WeatherCard from './components/WeatherCard';
import OceanCard from './components/OceanCard';
import RiskFactorsTable from './components/RiskFactorsTable';
import AIExplanationCard from './components/AIExplanationCard';
import WarningsBanner from './components/WarningsBanner';
import Footer from './components/Footer';
import { assessRisk, fetchHealth } from './services/api';
import { AlertCircle, RefreshCw, Info, WifiOff } from 'lucide-react';

export default function App() {
  const [lat, setLat] = useState('13.0827');
  const [lon, setLon] = useState('80.2707');
  const [label, setLabel] = useState('Chennai Coast');
  const [demoMode, setDemoMode] = useState(true);
  const [loading, setLoading] = useState(false);
  const [assessment, setAssessment] = useState(null);
  const [error, setError] = useState(null);
  const [isConnected, setIsConnected] = useState(true);

  // Check health on mount
  useEffect(() => {
    fetchHealth().then((health) => {
      setIsConnected(!!health);
    });
  }, []);

  // Run initial assessment on mount
  useEffect(() => {
    handleAssess(lat, lon, label);
  }, []);

  const handleAssess = async (targetLat, targetLon, targetLabel) => {
    setLoading(true);
    setError(null);
    try {
      const data = await assessRisk({
        latitude: targetLat,
        longitude: targetLon,
        label: targetLabel,
        demo: demoMode ? true : false,
        includeExplanation: true,
      });
      setAssessment(data);
      setIsConnected(true);
    } catch (err) {
      console.error('Assessment failed:', err);
      setError(err.message || 'Failed to fetch marine risk assessment.');
    } finally {
      setLoading(false);
    }
  };

  const handleMapLocationSelect = (selectedLat, selectedLon) => {
    setLat(selectedLat);
    setLon(selectedLon);
    setLabel(`Selected Location (${selectedLat}, ${selectedLon})`);
    handleAssess(selectedLat, selectedLon, `Selected Location (${selectedLat}, ${selectedLon})`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header Navbar */}
      <Navbar demoMode={demoMode} setDemoMode={setDemoMode} isConnected={isConnected} />

      {/* Main Content Container */}
      <main className="max-w-7xl mx-auto px-4 py-6 flex-1 w-full space-y-6">
        
        {/* Project Explanation Hero Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-cyan-950/30 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
          <div className="max-w-3xl">
            <h2 className="text-xl font-bold text-white tracking-tight mb-1">
              AI-Assisted Marine Safety & Coastal Advisory Engine
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              ORCA combines live IMD warnings, Open-Meteo weather forecasts, and ocean wave dynamics into an easy-to-understand, deterministic marine risk rating for fishermen and coastal communities.
            </p>
          </div>
          {demoMode && (
            <div className="mt-3 inline-flex items-center gap-2 bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 px-3 py-1 rounded-lg text-xs font-semibold">
              <Info className="w-4 h-4 text-cyan-400" />
              <span>Demo Mode Active: Using saved sample dataset for 100% reliable offline demonstration.</span>
            </div>
          )}
        </div>

        {/* Location Input Selector */}
        <LocationSelector
          lat={lat}
          lon={lon}
          setLat={setLat}
          setLon={setLon}
          label={label}
          setLabel={setLabel}
          onAssess={(a, b, c) => handleAssess(a, b, c)}
          loading={loading}
          demoMode={demoMode}
          setDemoMode={setDemoMode}
        />

        {/* Error Alert Box */}
        {error && (
          <div className="bg-rose-950/80 border border-rose-500/50 rounded-2xl p-4 flex items-center justify-between text-rose-200 text-sm shadow-xl">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              <div>
                <p className="font-bold">Assessment Failed</p>
                <p className="text-xs text-rose-300/80">{error}</p>
              </div>
            </div>
            <button
              onClick={() => handleAssess(lat, lon, label)}
              className="bg-rose-900/50 hover:bg-rose-900 border border-rose-500/40 text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Assessment Results */}
        {assessment && (
          <div className="space-y-6">
            
            {/* Warnings Bulletin Banner */}
            <WarningsBanner warnings={assessment.warnings} />

            {/* Risk Badge & Interactive Map Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7">
                <RiskBadgeCard
                  risk={assessment.risk}
                  mode={assessment.mode}
                  locationName={assessment.location?.label || label}
                />
              </div>

              <div className="lg:col-span-5 min-h-[340px]">
                <MapPicker
                  lat={assessment.location?.latitude || lat}
                  lon={assessment.location?.longitude || lon}
                  onLocationSelect={handleMapLocationSelect}
                  label={assessment.location?.label || label}
                  riskLevel={assessment.risk?.level}
                />
              </div>
            </div>

            {/* Weather & Ocean Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <WeatherCard weather={assessment.weather} />
              <OceanCard ocean={assessment.ocean} />
            </div>

            {/* Deterministic Risk Breakdown Table */}
            {assessment.risk?.factors && (
              <RiskFactorsTable factors={assessment.risk.factors} />
            )}

            {/* Guardrailed AI Summary Card */}
            {assessment.explanation && (
              <AIExplanationCard explanation={assessment.explanation} />
            )}

          </div>
        )}

      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
