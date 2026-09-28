import React from 'react';
import { Waves, Cpu } from 'lucide-react';

export default function Navbar({ demoMode, setDemoMode, isConnected }) {
  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-slate-950/80 border-b border-slate-800/80 px-4 py-3">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="relative p-2.5 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 text-white shadow-lg shadow-cyan-500/20">
            <Waves className="w-6 h-6 animate-pulse" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-slate-950"></div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
                ORCA <span className="text-xs font-semibold uppercase px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">SIH 2026</span>
              </h1>
            </div>
            <p className="text-xs text-slate-400">AI-Assisted Coastal & Marine Risk Intelligence Platform</p>
          </div>
        </div>

        {/* Controls & Indicators */}
        <div className="flex items-center gap-3 text-xs">
          {/* Connection Pill */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${
            isConnected 
              ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/50' 
              : 'bg-amber-950/40 text-amber-400 border-amber-800/50'
          }`}>
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`}></span>
            <span>{isConnected ? 'Backend Live' : 'Backend Connecting'}</span>
          </div>

          {/* Demo Toggle */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full">
            <span className="text-slate-400 flex items-center gap-1">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span>Demo Mode</span>
            </span>
            <button
              onClick={() => setDemoMode(!demoMode)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                demoMode ? 'bg-cyan-500' : 'bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  demoMode ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
            <span className={`font-semibold ${demoMode ? 'text-cyan-400' : 'text-slate-500'}`}>
              {demoMode ? 'ON (Offline Ready)' : 'OFF (Live Data)'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
