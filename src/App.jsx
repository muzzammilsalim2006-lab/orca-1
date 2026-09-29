import React, { useState, useEffect } from 'react';
import MobileShell from './components/mobile/MobileShell';
import MobileSplashScreen from './components/mobile/MobileSplashScreen';
import MobileLanguageScreen from './components/mobile/MobileLanguageScreen';
import MobileHomeScreen from './components/mobile/MobileHomeScreen';
import MobileLoginScreen from './components/mobile/MobileLoginScreen';
import MobileFishermanApp from './components/mobile/MobileFishermanApp';
import MobileCoastGuardApp from './components/mobile/MobileCoastGuardApp';
import MobileResearcherApp from './components/mobile/MobileResearcherApp';
import VoiceAssistantModal from './components/VoiceAssistantModal';
import { voiceManager } from './services/voiceManager';
import { assessRisk, fetchHealth, fetchSystemInfo } from './services/api';
import {
  DEFAULT_LOCATION,
  MAHARASHTRA_DISTRICTS,
  checkMaharashtraScope,
} from './config/maharashtraRegions';

export default function App() {
  // Mobile flow state: 'splash' | 'language' | 'role' | 'login' | 'app'
  const [appStep, setAppStep] = useState('splash');

  // Role: 'fisherman' | 'coast_guard' | 'researcher'
  const [role, setRole] = useState('fisherman');

  // Language: 'mr' | 'hi' | 'en'
  const [language, setLanguage] = useState('en');

  // User session state (client-side prototype session)
  const [_userSession, setUserSession] = useState(null);

  // Marine Assessment State
  const [lat, setLat] = useState(DEFAULT_LOCATION.lat.toString());
  const [lon, setLon] = useState(DEFAULT_LOCATION.lon.toString());
  const [label, setLabel] = useState(DEFAULT_LOCATION.label);
  const [demoMode, setDemoMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [assessment, setAssessment] = useState(null);
  const [isConnected, setIsConnected] = useState(true);

  // Operational vessel and horizon settings
  const [vesselClass, setVesselClass] = useState('traditional_motorized');
  const [forecastHorizon, setForecastHorizon] = useState(3.0);

  // Voice Assistant Modal state
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);

  // Initial assessment and connection verification
  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      try {
        const [health] = await Promise.all([fetchHealth(), fetchSystemInfo()]);
        if (!isMounted) return;
        setIsConnected(!!health);
      } catch (e) {
        console.warn('System connection check:', e);
      }

      try {
        await executeAssessment(
          DEFAULT_LOCATION.lat,
          DEFAULT_LOCATION.lon,
          DEFAULT_LOCATION.label,
          vesselClass,
          forecastHorizon,
          language,
          false
        );
      } catch {
        if (isMounted) {
          try {
            await executeAssessment(
              DEFAULT_LOCATION.lat,
              DEFAULT_LOCATION.lon,
              DEFAULT_LOCATION.label,
              vesselClass,
              forecastHorizon,
              language,
              true
            );
          } catch (e) {
            console.error('Fallback initial assessment encountered issue:', e);
          }
        }
      }
    };

    init();
    return () => {
      isMounted = false;
    };
  }, []);

  const executeAssessment = async (
    targetLat,
    targetLon,
    targetLabel,
    targetVessel = vesselClass,
    targetHorizon = forecastHorizon,
    targetLang = language,
    forceDemo = demoMode,
    extraParams = {}
  ) => {
    setLoading(true);

    try {
      const scopeCheck = checkMaharashtraScope(targetLat, targetLon);
      if (!scopeCheck.inScope) {
        setLoading(false);
        return null;
      }

      const res = await assessRisk({
        latitude: targetLat,
        longitude: targetLon,
        label: targetLabel,
        demo: forceDemo,
        includeExplanation: true,
        language: targetLang,
        vesselClass: targetVessel,
        forecastHorizonH: targetHorizon,
        ...extraParams,
      });

      setAssessment(res);
      setIsConnected(true);
      return res;
    } catch (err) {
      console.error('Assessment pipeline error:', err);
      setIsConnected(false);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleToggleDemoMode = () => {
    const nextMode = !demoMode;
    setDemoMode(nextMode);
    executeAssessment(lat, lon, label, vesselClass, forecastHorizon, language, nextMode);
  };

  const handleLanguageChange = (newLang) => {
    // 1. Immediately cancel any currently playing speech across the application
    voiceManager.stop();
    voiceManager.setLanguage(newLang);

    // 2. Update central application state
    setLanguage(newLang);

    // 3. Immediately re-fetch assessment in the selected language so screen & voice summaries match
    if (assessment) {
      executeAssessment(lat, lon, label, vesselClass, forecastHorizon, newLang, demoMode);
    }
  };

  const handleSelectDistrict = (district) => {
    setLat(district.representativeCoord.lat.toString());
    setLon(district.representativeCoord.lon.toString());
    const newLabel = `${district.name}, Maharashtra`;
    setLabel(newLabel);
    executeAssessment(
      district.representativeCoord.lat,
      district.representativeCoord.lon,
      newLabel,
      vesselClass,
      forecastHorizon,
      language,
      demoMode
    );
  };

  const handleMapLocationSelect = (selectedLat, selectedLon, districtName) => {
    const scopeCheck = checkMaharashtraScope(selectedLat, selectedLon);
    if (!scopeCheck.inScope) return;

    setLat(selectedLat.toString());
    setLon(selectedLon.toString());
    const newLabel = districtName
      ? `${districtName} (${selectedLat}, ${selectedLon})`
      : `Maharashtra Coastal Waters (${selectedLat}, ${selectedLon})`;
    setLabel(newLabel);
    executeAssessment(selectedLat, selectedLon, newLabel, vesselClass, forecastHorizon, language, demoMode);
  };

  const handleReassessSAR = ({ hoursAdrift, lkpLat, lkpLon, vesselClass: sarVessel }) => {
    setForecastHorizon(hoursAdrift);
    if (sarVessel) setVesselClass(sarVessel);
    executeAssessment(
      lat,
      lon,
      label,
      sarVessel || vesselClass,
      hoursAdrift,
      language,
      demoMode,
      {
        lastKnownLatitude: lkpLat,
        lastKnownLongitude: lkpLon,
        enableGeofencing: true,
      }
    );
  };

  const handleAssessTrip = (vessel, hours) => {
    setVesselClass(vessel);
    setForecastHorizon(hours);
    executeAssessment(lat, lon, label, vessel, hours, language, demoMode);
  };

  const handleLoginSuccess = (session) => {
    setUserSession(session);
    setAppStep('app');
  };

  return (
    <MobileShell
      currentRole={role}
      onSwitchRole={(newRole) => setRole(newRole)}
      currentLanguage={language}
      onSwitchLanguage={handleLanguageChange}
      demoMode={demoMode}
      onToggleDemo={handleToggleDemoMode}
      isConnected={isConnected}
      onOpenVoice={() => setIsVoiceModalOpen(true)}
      onResetToHome={() => setAppStep('role')}
      showTopBar={appStep === 'app'}
    >
      {/* 1. Splash Screen with Prominent Official ORCA Brand Logo */}
      {appStep === 'splash' && (
        <MobileSplashScreen
          onContinue={() => setAppStep('language')}
          language={language}
        />
      )}

      {/* 2. Step 1: Language Selection Screen */}
      {appStep === 'language' && (
        <MobileLanguageScreen
          currentLanguage={language}
          onSelectLanguage={handleLanguageChange}
          onContinue={() => setAppStep('role')}
          onBack={() => setAppStep('splash')}
        />
      )}

      {/* 3. Step 2: Role Selection Screen (Clean Coastal Hierarchy) */}
      {(appStep === 'role' || appStep === 'home') && (
        <MobileHomeScreen
          currentLanguage={language}
          onSelectLanguage={handleLanguageChange}
          onSelectRole={(selectedRole) => {
            setRole(selectedRole);
            setAppStep('login');
          }}
        />
      )}

      {/* 4. Step 3: Role-Specific Login Screen with Official ORCA Logo */}
      {appStep === 'login' && (
        <MobileLoginScreen
          currentRole={role}
          onLoginSuccess={handleLoginSuccess}
          onBack={() => setAppStep('role')}
          language={language}
          onSwitchLanguage={handleLanguageChange}
        />
      )}

      {/* 5. Role-Specific Application Workspace */}
      {appStep === 'app' && (
        <>
          {role === 'fisherman' && (
            <MobileFishermanApp
              assessment={assessment}
              loading={loading}
              language={language}
              districts={MAHARASHTRA_DISTRICTS}
              currentDistrict={label}
              onSelectDistrict={handleSelectDistrict}
              onMapLocationSelect={handleMapLocationSelect}
              onVoiceClick={() => setIsVoiceModalOpen(true)}
              onAssessTrip={handleAssessTrip}
            />
          )}

          {role === 'coast_guard' && (
            <MobileCoastGuardApp
              assessment={assessment}
              loading={loading}
              language={language}
              onReassessSAR={handleReassessSAR}
              onMapLocationSelect={handleMapLocationSelect}
              onVoiceClick={() => setIsVoiceModalOpen(true)}
            />
          )}

          {role === 'researcher' && (
            <MobileResearcherApp
              assessment={assessment}
              loading={loading}
              language={language}
              onHorizonChange={(newH) => {
                setForecastHorizon(newH);
                executeAssessment(lat, lon, label, vesselClass, newH, language, demoMode);
              }}
              forecastHorizon={forecastHorizon}
              onMapLocationSelect={handleMapLocationSelect}
              onVoiceClick={() => setIsVoiceModalOpen(true)}
            />
          )}
        </>
      )}

      {/* Voice Assistant Modal */}
      <VoiceAssistantModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        language={language}
        onApplyAssessment={(res) => {
          if (res?.location) {
            setLat(res.location.latitude.toString());
            setLon(res.location.longitude.toString());
            setLabel(res.location.label);
          }
          setAssessment(res);
        }}
      />
    </MobileShell>
  );
}
