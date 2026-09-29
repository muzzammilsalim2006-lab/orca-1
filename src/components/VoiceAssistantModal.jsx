import React, { useState, useEffect } from 'react';
import {
  Mic,
  MicOff,
  X,
  Radio,
  Send,
} from 'lucide-react';
import VoiceControls from './VoiceControls';
import { voiceManager, LOCALE_MAP } from '../services/voiceManager';
import { formatAssessmentForSpeech } from '../utils/speechFormatting';
import { TRANSLATIONS } from '../utils/translations';
import { MAHARASHTRA_DISTRICTS } from '../config/maharashtraRegions';
import { assessRisk } from '../services/api';

export default function VoiceAssistantModal({
  isOpen,
  onClose,
  language = 'en',
  onApplyAssessment,
}) {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [loading, setLoading] = useState(false);
  const [voiceResult, setVoiceResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Stop speech when modal closes or unmounts
  useEffect(() => {
    if (!isOpen) {
      voiceManager.stop();
      setIsListening(false);
    }
  }, [isOpen]);

  // Stop speech when language changes while modal is open
  useEffect(() => {
    voiceManager.stop();
  }, [language]);

  const handleStartListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setErrorMsg('Web Speech recognition is not supported in this browser. Please type your query below.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = LOCALE_MAP[language] || 'en-IN';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setErrorMsg(null);
      };

      recognition.onresult = (event) => {
        const speechToText = event.results[0][0].transcript;
        setTranscript(speechToText);
        handleProcessQuery(speechToText);
      };

      recognition.onerror = (event) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error !== 'no-speech') {
          setErrorMsg(`Microphone error: ${event.error}. You can also type your query.`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err) {
      console.warn('Failed to start speech recognition:', err);
      setIsListening(false);
      setErrorMsg('Could not access microphone. Please type your query.');
    }
  };

  const handleProcessQuery = async (queryText) => {
    if (!queryText || !queryText.trim()) return;
    setLoading(true);
    setErrorMsg(null);

    // 1. Identify target district or location from query text
    const lower = queryText.toLowerCase();
    let targetDistrict = MAHARASHTRA_DISTRICTS.find((d) =>
      lower.includes(d.id) ||
      lower.includes(d.districtName.toLowerCase()) ||
      lower.includes(d.name.toLowerCase()) ||
      (d.marathiName && queryText.includes(d.marathiName))
    );

    // Keywords mapping
    if (!targetDistrict) {
      if (lower.includes('mumbai') || lower.includes('मुंबई') || lower.includes('colaba') || lower.includes('sassoon')) {
        targetDistrict = MAHARASHTRA_DISTRICTS.find((d) => d.id === 'mumbai_city');
      } else if (lower.includes('versova') || lower.includes('वर्सोवा') || lower.includes('marve') || lower.includes('madh') || lower.includes('bandra')) {
        targetDistrict = MAHARASHTRA_DISTRICTS.find((d) => d.id === 'mumbai_suburban');
      } else if (lower.includes('alibag') || lower.includes('अलिबाग') || lower.includes('murud') || lower.includes('raigad') || lower.includes('रायगड')) {
        targetDistrict = MAHARASHTRA_DISTRICTS.find((d) => d.id === 'raigad');
      } else if (lower.includes('ratnagiri') || lower.includes('रत्नागिरी') || lower.includes('mirya') || lower.includes('jaigad')) {
        targetDistrict = MAHARASHTRA_DISTRICTS.find((d) => d.id === 'ratnagiri');
      } else if (lower.includes('malvan') || lower.includes('मालवण') || lower.includes('sindhudurg') || lower.includes('सिंधुदुर्ग') || lower.includes('tarkarli')) {
        targetDistrict = MAHARASHTRA_DISTRICTS.find((d) => d.id === 'sindhudurg');
      } else if (lower.includes('palghar') || lower.includes('पालघर') || lower.includes('dahanu') || lower.includes('satpati')) {
        targetDistrict = MAHARASHTRA_DISTRICTS.find((d) => d.id === 'palghar');
      } else if (lower.includes('thane') || lower.includes('ठाणे') || lower.includes('bhayandar') || lower.includes('uttam')) {
        targetDistrict = MAHARASHTRA_DISTRICTS.find((d) => d.id === 'thane');
      } else {
        // Default to Mumbai Harbour
        targetDistrict = MAHARASHTRA_DISTRICTS.find((d) => d.id === 'mumbai_city');
      }
    }

    try {
      // 2. Query authoritative ORCA backend in the selected language
      const result = await assessRisk({
        latitude: targetDistrict.representativeCoord.lat,
        longitude: targetDistrict.representativeCoord.lon,
        label: `${targetDistrict.name}, Maharashtra`,
        includeExplanation: true,
        language: language,
      });

      setVoiceResult(result);
      if (onApplyAssessment) {
        onApplyAssessment(result);
      }

      // 3. Automatically speak the authoritative explanation with the female voice in selected language
      const spokenText = formatAssessmentForSpeech(result, language, 'fisherman');
      voiceManager.speak(spokenText, language);
    } catch (err) {
      console.error('Voice assessment error:', err);
      setErrorMsg('Failed to fetch backend safety assessment.');
    } finally {
      setLoading(false);
    }
  };

  const sampleQueries = {
    mr: [
      'आज मुंबईत मासेमारी करणे सुरक्षित आहे का?',
      'मालवण समुद्रात लाटा किती उंच आहेत?',
      'अलिबागमध्ये वादळाचा इशारा आहे का?',
    ],
    hi: [
      'क्या आज मुंबई में मछली पकड़ना सुरक्षित है?',
      'रत्नागिरी में समुद्र की स्थिति कैसी है?',
      'क्या तट पर कोई चक्रवात चेतावनी है?',
    ],
    en: [
      'Is it safe to fish off Versova today?',
      'What are the wave heights near Malvan?',
      'Are there active cyclone warnings for Raigad?',
    ],
  };

  const queries = sampleQueries[language] || sampleQueries.en;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-slate-800 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-50 text-teal-700 border border-teal-200">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-slate-900 text-base">
                  {t.voiceAssistant || 'ORCA Voice Assistant'}
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200 uppercase font-mono">
                  {LOCALE_MAP[language] || 'en-IN'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Natural Female Voice • Direct Backend Connection
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              voiceManager.stop();
              onClose();
            }}
            className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Microphone Pulse Interaction */}
        <div className="text-center py-2">
          <button
            onClick={isListening ? () => setIsListening(false) : handleStartListening}
            className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto transition-all shadow-md cursor-pointer ${
              isListening
                ? 'bg-red-600 text-white animate-pulse ring-8 ring-red-100'
                : 'bg-teal-600 hover:bg-teal-700 text-white shadow-teal-600/25 hover:scale-105'
            }`}
          >
            {isListening ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
          </button>
          <p className="text-xs font-bold text-slate-800 mt-3">
            {isListening
              ? (language === 'mr' ? '🎙️ ऐकत आहे... (Listening now)' : language === 'hi' ? '🎙️ सुन रहे हैं... (Listening)' : '🎙️ Listening now...')
              : (language === 'mr' ? 'क्लिक करा आणि बोला / Click to Speak' : language === 'hi' ? 'क्लिक करें और बोलें / Click to Speak' : 'Click to Speak (Female Assistant)')}
          </p>
          <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
            {t.voicePrompt || 'Ask about sea safety, wave heights, winds, or local weather anywhere in Maharashtra.'}
          </p>
        </div>

        {/* Quick Sample Queries */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            {language === 'mr' ? 'उदाहरणे (Tap to ask):' : language === 'hi' ? 'उदाहरण (पूछने के लिए टैप करें):' : 'Suggested questions:'}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {queries.map((q, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setTranscript(q);
                  handleProcessQuery(q);
                }}
                className="text-[11px] px-2.5 py-1 rounded-xl bg-slate-50 hover:bg-teal-50 hover:text-teal-800 hover:border-teal-200 border border-slate-200 text-slate-600 transition-colors text-left cursor-pointer"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Text Input Fallback */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleProcessQuery(transcript);
          }}
          className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-2 focus-within:border-teal-500 focus-within:bg-white transition-all"
        >
          <input
            type="text"
            placeholder={
              language === 'mr'
                ? 'किंवा प्रश्न येथे टाइप करा (उदा. आज मुंबईत मासेमारी सुरक्षित आहे का?)'
                : language === 'hi'
                ? 'या सवाल यहाँ लिखें (उदा. क्या आज मुंबई में समुद्र सुरक्षित है?)'
                : 'Or type your question (e.g. Is it safe to fish at Versova?)'
            }
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            className="flex-1 bg-transparent px-3 py-1 text-xs text-slate-800 outline-none placeholder:text-slate-400 font-medium"
          />
          <button
            type="submit"
            disabled={loading || !transcript.trim()}
            className="p-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white transition-all cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

        {errorMsg && (
          <p className="text-xs text-red-600 text-center font-medium bg-red-50 p-2.5 rounded-xl border border-red-200">
            {errorMsg}
          </p>
        )}

        {/* Loading Spinner */}
        {loading && (
          <div className="py-3 text-center text-slate-500 text-xs">
            <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span>Checking ORCA deterministic marine calculations...</span>
          </div>
        )}

        {/* Assessment Result Summary Matching Screen & Voice */}
        {voiceResult && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className={`px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                voiceResult.decision === 'NO-GO' ? 'bg-red-600 text-white' : voiceResult.decision === 'CAUTION' ? 'bg-amber-500 text-slate-950' : 'bg-emerald-600 text-white'
              }`}>
                {voiceResult.decision}
              </span>
              <span className="text-xs text-slate-600 font-mono font-bold">
                {voiceResult.location?.label || 'Maharashtra Coast'}
              </span>
            </div>

            <div className="text-xs text-slate-800 leading-relaxed font-medium bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
              "{voiceResult.explanation?.text || voiceResult.risk?.recommendation}"
            </div>

            <div className="text-[11px] text-slate-500 font-mono font-medium flex items-center justify-between">
              <span>Waves: {voiceResult.ocean?.wave_height_m ?? '--'}m • Wind: {Math.round(voiceResult.weather?.wind_speed_kmph || 0)} km/h</span>
              <span className="text-[10px] text-teal-700 font-bold bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                Authoritative IMD/INCOIS
              </span>
            </div>

            {/* Complete Voice Controls (Pause, Resume, Stop, Replay) */}
            <div className="pt-2 border-t border-slate-200">
              <VoiceControls
                onPlay={() => {
                  const text = formatAssessmentForSpeech(voiceResult, language, 'fisherman');
                  voiceManager.speak(text, language);
                }}
                language={language}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
