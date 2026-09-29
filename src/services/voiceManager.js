/**
 * Centralized Voice & Audio Management Engine for ORCA
 * 
 * Provides:
 * 1. Single source of language truth synchronized across UI, Voice Output, and Voice Input.
 * 2. High-fidelity Neural Female TTS via server-side Gemini (Kore voice) with zero exposed API keys.
 * 3. Intelligent client-side SpeechSynthesis fallback with female voice prioritisation for en-IN, hi-IN, mr-IN.
 * 4. Deterministic playback controls: Listen, Pause, Resume, Stop, Replay.
 * 5. Automatic termination of current speech when user changes language.
 */

import { getApiBaseUrl } from './api.js';

export const LOCALE_MAP = {
  en: 'en-IN',
  hi: 'hi-IN',
  mr: 'mr-IN',
};

class VoiceManager {
  constructor() {
    this.currentLanguage = 'en';
    this.playbackState = 'idle'; // 'idle' | 'loading' | 'speaking' | 'paused'
    this.activeAudio = null;
    this.activeUtterance = null;
    this.lastSpokenText = '';
    this.listeners = new Set();
    this.cachedVoices = [];

    // Pre-load browser voices if available
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      this.cachedVoices = window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        this.cachedVoices = window.speechSynthesis.getVoices();
      };
    }
  }

  /**
   * Subscribe to playback state changes
   */
  subscribe(callback) {
    this.listeners.add(callback);
    callback(this.playbackState);
    return () => this.listeners.delete(callback);
  }

  notify() {
    for (const cb of this.listeners) {
      try {
        cb(this.playbackState);
      } catch (err) {
        console.warn('Voice listener notification failed:', err);
      }
    }
  }

  setPlaybackState(state) {
    this.playbackState = state;
    this.notify();
  }

  /**
   * Set the authoritative application language.
   * Immediately stops any speech in progress if the language changed.
   */
  setLanguage(newLang) {
    if (!newLang || !LOCALE_MAP[newLang]) return;
    if (this.currentLanguage !== newLang) {
      // Immediately stop any active speech to prevent language mixing
      this.stop();
      this.currentLanguage = newLang;
    }
  }

  getLanguage() {
    return this.currentLanguage;
  }

  getLocale() {
    return LOCALE_MAP[this.currentLanguage] || 'en-IN';
  }

  /**
   * Selects the highest quality natural FEMALE voice available in the browser runtime
   * for the given target language.
   */
  selectBestBrowserVoice(language = this.currentLanguage) {
    if (typeof window === 'undefined' || !window.speechSynthesis) return null;

    const voices = this.cachedVoices.length > 0 ? this.cachedVoices : window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;

    const targetLocale = LOCALE_MAP[language] || 'en-IN';
    const langPrefix = language;

    // Female voice indicators across Chrome, Safari, Edge, Android, iOS, Windows, Mac
    const femaleIndicators = [
      'female', 'woman', 'girl',
      'heera', 'veena', 'neerja', 'kavita', 'sangeeta', 'raveena',
      'swara', 'lekha', 'kalpana', 'aditi',
      'aarohi', 'ananya',
      'kore', 'aoede', 'natural',
      'samantha', 'victoria', 'karen', 'moira', 'tessa', 'zira'
    ];

    const isLikelyFemale = (voice) => {
      const name = (voice.name || '').toLowerCase();
      // Google Indian voices for Hindi/Marathi are female
      if (name.includes('google हिन्दी') || name.includes('google मराठी')) return true;
      return femaleIndicators.some((kw) => name.includes(kw));
    };

    // 1. Exact locale matching + female
    const exactFemale = voices.find((v) => {
      const matchLang = (v.lang || '').replace('_', '-').toLowerCase() === targetLocale.toLowerCase();
      return matchLang && isLikelyFemale(v);
    });
    if (exactFemale) return exactFemale;

    // 2. Exact locale matching (any gender)
    const exactAny = voices.find((v) => {
      return (v.lang || '').replace('_', '-').toLowerCase() === targetLocale.toLowerCase();
    });
    if (exactAny) return exactAny;

    // 3. Language prefix matching + female (e.g. 'mr' or 'hi')
    const prefixFemale = voices.find((v) => {
      const vLang = (v.lang || '').toLowerCase();
      return (vLang.startsWith(langPrefix) || vLang.includes(langPrefix)) && isLikelyFemale(v);
    });
    if (prefixFemale) return prefixFemale;

    // 4. Language prefix matching (any gender)
    const prefixAny = voices.find((v) => {
      const vLang = (v.lang || '').toLowerCase();
      return vLang.startsWith(langPrefix) || vLang.includes(langPrefix);
    });
    if (prefixAny) return prefixAny;

    // 5. Special fallback for Marathi: If no native Marathi voice is installed on the user's OS,
    // fallback to Hindi female voice (since Devanagari script and phonemes match perfectly).
    // NEVER fall back to an English voice for Marathi text!
    if (language === 'mr') {
      const hindiFemale = voices.find((v) => {
        const vLang = (v.lang || '').toLowerCase();
        return (vLang.startsWith('hi') || vLang.includes('hi')) && isLikelyFemale(v);
      }) || voices.find((v) => (v.lang || '').toLowerCase().startsWith('hi'));
      if (hindiFemale) return hindiFemale;
    }

    // 6. English fallback
    if (language === 'en') {
      const englishFemale = voices.find((v) => {
        const vLang = (v.lang || '').toLowerCase();
        return vLang.startsWith('en') && isLikelyFemale(v);
      });
      if (englishFemale) return englishFemale;
    }

    // Default voice
    return voices.find((v) => v.default) || voices[0];
  }

  /**
   * Speak advisory text using high-fidelity Neural TTS, falling back to Browser SpeechSynthesis.
   * @param {string} text - Speech-friendly plain-language text
   * @param {'mr' | 'hi' | 'en'} [lang] - Language code (defaults to current language)
   */
  async speak(text, lang = this.currentLanguage) {
    if (!text || !text.trim()) return;

    // Stop any existing playback
    this.stop();

    this.currentLanguage = lang;
    this.lastSpokenText = text;
    this.setPlaybackState('loading');

    // Attempt 1: Server-side Neural Female TTS (Gemini Kore voice)
    try {
      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}/api/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          language: this.currentLanguage,
        }),
      });

      if (res.ok) {
        const audioBlob = await res.blob();
        if (audioBlob.size > 1000) {
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);
          this.activeAudio = audio;

          audio.onplay = () => {
            this.setPlaybackState('speaking');
          };

          audio.onended = () => {
            URL.revokeObjectURL(audioUrl);
            this.activeAudio = null;
            this.setPlaybackState('idle');
          };

          audio.onerror = () => {
            URL.revokeObjectURL(audioUrl);
            this.activeAudio = null;
            // Fallback to browser SpeechSynthesis on audio playback failure
            this.speakWithBrowserTTS(text, lang);
          };

          await audio.play();
          return;
        }
      }
    } catch (err) {
      console.warn('Neural TTS unavailable or failed, falling back to browser synthesis:', err.message);
    }

    // Attempt 2: High-Quality Browser SpeechSynthesis with Female Voice matching
    this.speakWithBrowserTTS(text, lang);
  }

  /**
   * Client-side SpeechSynthesis fallback with female voice matching
   */
  speakWithBrowserTTS(text, lang = this.currentLanguage) {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      this.setPlaybackState('idle');
      return;
    }

    try {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      const targetLocale = LOCALE_MAP[lang] || 'en-IN';
      utterance.lang = targetLocale;

      // Select matching female voice
      const bestVoice = this.selectBestBrowserVoice(lang);
      if (bestVoice) {
        utterance.voice = bestVoice;
      }

      // Calm, human-friendly pacing
      utterance.rate = 0.95;
      utterance.pitch = 1.05; // Slightly elevated warm female tone

      utterance.onstart = () => {
        this.setPlaybackState('speaking');
      };

      utterance.onend = () => {
        this.activeUtterance = null;
        this.setPlaybackState('idle');
      };

      utterance.onerror = (e) => {
        console.warn('Browser SpeechSynthesis error:', e);
        this.activeUtterance = null;
        this.setPlaybackState('idle');
      };

      this.activeUtterance = utterance;
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('SpeechSynthesis execution error:', err);
      this.setPlaybackState('idle');
    }
  }

  /**
   * Pause active speech
   */
  pause() {
    if (this.activeAudio) {
      this.activeAudio.pause();
      this.setPlaybackState('paused');
    } else if (typeof window !== 'undefined' && window.speechSynthesis && this.playbackState === 'speaking') {
      window.speechSynthesis.pause();
      this.setPlaybackState('paused');
    }
  }

  /**
   * Resume paused speech
   */
  resume() {
    if (this.activeAudio && this.playbackState === 'paused') {
      this.activeAudio.play().then(() => {
        this.setPlaybackState('speaking');
      }).catch(() => {
        this.setPlaybackState('idle');
      });
    } else if (typeof window !== 'undefined' && window.speechSynthesis && this.playbackState === 'paused') {
      window.speechSynthesis.resume();
      this.setPlaybackState('speaking');
    }
  }

  /**
   * Stop active speech completely
   */
  stop() {
    if (this.activeAudio) {
      try {
        this.activeAudio.pause();
        this.activeAudio.currentTime = 0;
      } catch {}
      this.activeAudio = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
      this.activeUtterance = null;
    }
    this.setPlaybackState('idle');
  }

  /**
   * Replay last spoken advisory
   */
  replay() {
    if (this.lastSpokenText) {
      this.speak(this.lastSpokenText, this.currentLanguage);
    }
  }
}

// Global Singleton Instance
export const voiceManager = new VoiceManager();
