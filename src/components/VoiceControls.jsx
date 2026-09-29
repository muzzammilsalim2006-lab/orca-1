import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, Pause, Play, RotateCcw, Loader2 } from 'lucide-react';
import { voiceManager } from '../services/voiceManager';

/**
 * Reusable Voice Controls Bar for ORCA Assessment Screens
 * 
 * Provides:
 * - 🔊 Listen / ऐका / सुनें
 * - ⏸ Pause
 * - ▶ Resume
 * - ⏹ Stop
 * - 🔁 Replay
 * 
 * Automatically synchronizes with central voiceManager state.
 */
export default function VoiceControls({
  onPlay,
  language = 'en',
  className = '',
  buttonClassName = '',
}) {
  const [playbackState, setPlaybackState] = useState(voiceManager.playbackState);

  useEffect(() => {
    const unsubscribe = voiceManager.subscribe((state) => {
      setPlaybackState(state);
    });
    return unsubscribe;
  }, []);

  const labels = {
    mr: {
      listen: 'सल्ला ऐका (Listen)',
      loading: 'आवाज तयार करत आहे...',
      pause: 'थांबवा (Pause)',
      resume: 'पुढे सुरू करा (Resume)',
      stop: 'बंद करा (Stop)',
      replay: 'पुन्हा ऐका (Replay)',
    },
    hi: {
      listen: 'सलाह सुनें (Listen)',
      loading: 'ध्वनि तैयार हो रही है...',
      pause: 'विराम (Pause)',
      resume: 'पुनः सुनें (Resume)',
      stop: 'रोकें (Stop)',
      replay: 'दोबारा सुनें (Replay)',
    },
    en: {
      listen: 'Listen to Advisory',
      loading: 'Synthesizing Audio...',
      pause: 'Pause',
      resume: 'Resume',
      stop: 'Stop',
      replay: 'Replay',
    },
  };

  const t = labels[language] || labels.en;

  if (playbackState === 'loading') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <button
          disabled
          className={`flex-1 py-2.5 px-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 bg-slate-100 text-slate-500 border border-slate-200 shadow-xs ${buttonClassName}`}
        >
          <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
          <span>{t.loading}</span>
        </button>
      </div>
    );
  }

  if (playbackState === 'speaking') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {/* Pause Button */}
        <button
          type="button"
          onClick={() => voiceManager.pause()}
          className="flex-1 py-2.5 px-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
        >
          <Pause className="w-4 h-4" />
          <span>{t.pause}</span>
        </button>

        {/* Stop Button */}
        <button
          type="button"
          onClick={() => voiceManager.stop()}
          className="py-2.5 px-3.5 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
        >
          <VolumeX className="w-4 h-4 text-red-600" />
          <span>{t.stop}</span>
        </button>
      </div>
    );
  }

  if (playbackState === 'paused') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {/* Resume Button */}
        <button
          type="button"
          onClick={() => voiceManager.resume()}
          className="flex-1 py-2.5 px-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white transition-all cursor-pointer shadow-xs active:scale-[0.98]"
        >
          <Play className="w-4 h-4 fill-white" />
          <span>{t.resume}</span>
        </button>

        {/* Stop Button */}
        <button
          type="button"
          onClick={() => voiceManager.stop()}
          className="py-2.5 px-3.5 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
        >
          <VolumeX className="w-4 h-4 text-red-600" />
          <span>{t.stop}</span>
        </button>
      </div>
    );
  }

  // Idle state: Show Listen button with Replay option if text exists
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={() => {
          if (onPlay) onPlay();
        }}
        className={`flex-1 py-2.5 px-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 shadow-xs transition-all cursor-pointer active:scale-[0.98] ${buttonClassName}`}
      >
        <Volume2 className="w-4 h-4 text-teal-700" />
        <span>{t.listen}</span>
      </button>

      {voiceManager.lastSpokenText && (
        <button
          type="button"
          onClick={() => voiceManager.replay()}
          title={t.replay}
          className="p-2.5 rounded-2xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-xs transition-all cursor-pointer active:scale-[0.98]"
        >
          <RotateCcw className="w-4 h-4 text-teal-700" />
        </button>
      )}
    </div>
  );
}
