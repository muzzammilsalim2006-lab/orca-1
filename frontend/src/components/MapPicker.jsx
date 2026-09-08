import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Layers } from 'lucide-react';

// Fix Leaflet marker icon issue in React
const customIcon = L.divIcon({
  className: 'custom-leaflet-marker',
  html: `
    <div style="
      background: linear-gradient(135deg, #06b6d4, #2563eb);
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: 3px solid #ffffff;
      box-shadow: 0 0 15px rgba(6, 182, 212, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
    ">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
        <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"/>
        <circle cx="12" cy="10" r="3"/>
      </svg>
    </div>
  `,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

// Component to handle clicking on map to select coordinates
function MapEvents({ onLocationSelect }) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat.toFixed(4), e.latlng.lng.toFixed(4));
    },
  });
  return null;
}

// Component to update view when center changes
function RecenterMap({ lat, lon }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lon) {
      map.flyTo([lat, lon], 8, { duration: 1.5 });
    }
  }, [lat, lon, map]);
  return null;
}

export default function MapPicker({ lat, lon, onLocationSelect, label, riskLevel }) {
  const latitude = parseFloat(lat) || 13.0827;
  const longitude = parseFloat(lon) || 80.2707;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Interactive Coastal Map</h3>
        </div>
        <span className="text-xs text-slate-400">Click anywhere on coast to inspect</span>
      </div>

      <div className="relative flex-1 min-h-[320px] rounded-xl overflow-hidden border border-slate-800">
        <MapContainer
          center={[latitude, longitude]}
          zoom={7}
          scrollWheelZoom={true}
          style={{ width: '100%', height: '100%', minHeight: '320px', background: '#0f172a' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <RecenterMap lat={latitude} lon={longitude} />
          <MapEvents onLocationSelect={onLocationSelect} />
          <Marker position={[latitude, longitude]} icon={customIcon}>
            <Popup>
              <div className="text-slate-900 font-sans p-1">
                <p className="font-bold text-sm">{label || 'Selected Location'}</p>
                <p className="text-xs text-slate-600">{latitude.toFixed(4)}° N, {longitude.toFixed(4)}° E</p>
                {riskLevel && (
                  <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded text-white ${
                    riskLevel === 'HIGH' ? 'bg-rose-600' : riskLevel === 'MODERATE' ? 'bg-amber-600' : 'bg-emerald-600'
                  }`}>
                    {riskLevel} RISK
                  </span>
                )}
              </div>
            </Popup>
          </Marker>
        </MapContainer>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
        <span>Target: <strong className="text-cyan-400">{latitude.toFixed(4)}° N, {longitude.toFixed(4)}° E</strong></span>
        <span className="text-[11px] text-slate-500">Map tiles via OpenStreetMap</span>
      </div>
    </div>
  );
}
