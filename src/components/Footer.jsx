import React from 'react';
import { Waves, Shield } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="mt-12 border-t border-slate-800 bg-slate-950 py-8 px-4 text-xs text-slate-500">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
        <div>
          <div className="flex items-center justify-center md:justify-start gap-2 text-slate-300 font-bold mb-1">
            <Waves className="w-4 h-4 text-cyan-400" />
            <span>ORCA Marine Safety & Risk Intelligence Platform</span>
          </div>
          <p className="max-w-md">
            SIH 2026 Internal Prototype. Built with FastAPI, Open-Meteo Marine Data, IMD warning logic, and React Leaflet.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-4 text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-cyan-400" /> Deterministic Engine
          </span>
          <span>•</span>
          <span>IMD Marine Advisories</span>
          <span>•</span>
          <span>Open-Meteo Marine API</span>
        </div>
      </div>
      <div className="max-w-7xl mx-auto mt-6 pt-4 border-t border-slate-900 text-center text-[11px] text-slate-600">
        Advisory tool only. Risk levels are estimates and never guarantee complete safety. Always follow official National Disaster Management Authority (NDMA) and Coast Guard directives.
      </div>
    </footer>
  );
}
