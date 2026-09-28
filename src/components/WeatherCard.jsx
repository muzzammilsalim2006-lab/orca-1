import React from 'react';
import { CloudRain, Wind, Thermometer, Gauge } from 'lucide-react';

export default function WeatherCard({ weather }) {
  if (!weather) {
    return (
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl text-center text-slate-400">
        <CloudRain className="w-8 h-8 mx-auto text-slate-600 mb-2" />
        <p className="text-xs">Weather metrics unavailable for this region.</p>
      </div>
    );
  }

  const {
    temperature_c,
    feels_like_c,
    wind_speed_kmph,
    wind_gust_kmph,
    precipitation_mm_24h,
    precipitation_mm_last_hour,
    humidity_pct,
    pressure_hpa,
    source,
  } = weather;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
      <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <CloudRain className="w-4 h-4 text-sky-400" />
          Atmospheric & Weather Conditions
        </h3>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] px-2 py-0.5 rounded font-mono font-semibold border ${
            source?.data_status === 'LIVE'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
          }`}>
            {source?.data_status || 'LIVE'}
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
            Source: {source?.provider || 'IMD / Open-Meteo'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Wind Speed */}
        <div className="bg-slate-950/70 border border-slate-800 p-3.5 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium">Wind Speed</span>
            <Wind className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-lg font-bold text-white">
            {wind_speed_kmph !== null ? `${wind_speed_kmph} km/h` : 'N/A'}
          </p>
          {wind_gust_kmph !== null && (
            <p className="text-[10px] text-amber-400/90 mt-0.5">Gusts: {wind_gust_kmph} km/h</p>
          )}
        </div>

        {/* Rain / Precip */}
        <div className="bg-slate-950/70 border border-slate-800 p-3.5 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium">Precipitation</span>
            <CloudRain className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-lg font-bold text-white">
            {precipitation_mm_24h !== null
              ? `${precipitation_mm_24h} mm`
              : precipitation_mm_last_hour !== null
              ? `${precipitation_mm_last_hour} mm/h`
              : 'N/A'}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">24h Forecast Total</p>
        </div>

        {/* Temperature */}
        <div className="bg-slate-950/70 border border-slate-800 p-3.5 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium">Temperature</span>
            <Thermometer className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-lg font-bold text-white">
            {temperature_c !== null ? `${temperature_c} °C` : 'N/A'}
          </p>
          {feels_like_c !== null && (
            <p className="text-[10px] text-slate-400 mt-0.5">Feels: {feels_like_c} °C</p>
          )}
        </div>

        {/* Pressure / Humidity */}
        <div className="bg-slate-950/70 border border-slate-800 p-3.5 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium">Pressure & Hum</span>
            <Gauge className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-lg font-bold text-white">
            {pressure_hpa !== null ? `${pressure_hpa} hPa` : 'N/A'}
          </p>
          {humidity_pct !== null && (
            <p className="text-[10px] text-slate-400 mt-0.5">Humidity: {humidity_pct}%</p>
          )}
        </div>
      </div>
    </div>
  );
}
