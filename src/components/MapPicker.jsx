import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Rectangle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Navigation } from 'lucide-react';
import {
  DEFAULT_MAHARASHTRA_CENTER,
  MAHARASHTRA_BOUNDS,
  checkMaharashtraScope,
} from '../config/maharashtraRegions';

// Vessel target marker icon
const customVesselIcon = L.divIcon({
  className: 'custom-leaflet-marker',
  html: `
    <div style="
      background: linear-gradient(135deg, #06b6d4, #2563eb);
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: 3px solid #ffffff;
      box-shadow: 0 0 15px rgba(6, 182, 212, 0.7);
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

// Predicted Drift Position Marker
const predictedPositionIcon = L.divIcon({
  className: 'predicted-drift-marker',
  html: `
    <div style="
      background: linear-gradient(135deg, #f59e0b, #ef4444);
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 2px dashed #ffffff;
      box-shadow: 0 0 12px rgba(239, 68, 68, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
    ">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
        <circle cx="12" cy="12" r="6"/>
      </svg>
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

// Component to handle map clicks and enforce Maharashtra boundaries
function MapEvents({ onLocationSelect, onOutOfScope }) {
  useMapEvents({
    click(e) {
      const clickedLat = parseFloat(e.latlng.lat.toFixed(4));
      const clickedLon = parseFloat(e.latlng.lng.toFixed(4));
      const scopeCheck = checkMaharashtraScope(clickedLat, clickedLon);

      if (!scopeCheck.inScope) {
        if (onOutOfScope) {
          onOutOfScope(scopeCheck.message);
        }
        return;
      }

      onLocationSelect(clickedLat.toString(), clickedLon.toString(), scopeCheck.district);
    },
  });
  return null;
}

// Component to smoothly recenter map
function RecenterMap({ lat, lon }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lon) {
      map.flyTo([lat, lon], 8, { duration: 1.2 });
    }
  }, [lat, lon, map]);
  return null;
}

export default function MapPicker({
  lat,
  lon,
  onLocationSelect,
  onOutOfScope,
  label,
  riskLevel,
  predictedPosition,
  searchRadiusNm,
}) {
  const latitude = parseFloat(lat) || DEFAULT_MAHARASHTRA_CENTER.lat;
  const longitude = parseFloat(lon) || DEFAULT_MAHARASHTRA_CENTER.lon;

  // Search radius in meters: 1 NM ≈ 1852 meters
  const searchRadiusMeters = searchRadiusNm ? searchRadiusNm * 1852 : null;

  // Bounding box for visual scope representation
  const scopeBounds = [
    [MAHARASHTRA_BOUNDS.minLat, MAHARASHTRA_BOUNDS.minLon],
    [MAHARASHTRA_BOUNDS.maxLat, MAHARASHTRA_BOUNDS.maxLon],
  ];

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
            Maharashtra Coastal Map
          </h3>
        </div>
        <span className="text-[11px] text-cyan-400/90 font-medium bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/50">
          Focused on Western Maharashtra
        </span>
      </div>

      <div className="relative flex-1 min-h-[340px] rounded-xl overflow-hidden border border-slate-800">
        <MapContainer
          center={[DEFAULT_MAHARASHTRA_CENTER.lat, DEFAULT_MAHARASHTRA_CENTER.lon]}
          zoom={DEFAULT_MAHARASHTRA_CENTER.zoom}
          scrollWheelZoom={true}
          style={{ width: '100%', height: '100%', minHeight: '340px', background: '#090d16' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <RecenterMap lat={latitude} lon={longitude} />
          <MapEvents onLocationSelect={onLocationSelect} onOutOfScope={onOutOfScope} />

          {/* Operational Maharashtra Corridor Visual Boundary */}
          <Rectangle
            bounds={scopeBounds}
            pathOptions={{
              color: '#06b6d4',
              weight: 1.5,
              dashArray: '4, 4',
              fillOpacity: 0.03,
            }}
          />

          {/* Vessel Target Marker */}
          <Marker position={[latitude, longitude]} icon={customVesselIcon}>
            <Popup>
              <div className="text-slate-900 font-sans p-1">
                <p className="font-bold text-sm">{label || 'Maharashtra Target Location'}</p>
                <p className="text-xs text-slate-600 font-mono mt-0.5">
                  {latitude.toFixed(4)}° N, {longitude.toFixed(4)}° E
                </p>
                {riskLevel && (
                  <span
                    className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded text-white ${
                      riskLevel === 'HIGH'
                        ? 'bg-rose-600'
                        : riskLevel === 'MODERATE'
                        ? 'bg-amber-600'
                        : 'bg-emerald-600'
                    }`}
                  >
                    {riskLevel} RISK
                  </span>
                )}
              </div>
            </Popup>
          </Marker>

          {/* Predicted Drift Vector Position Marker */}
          {predictedPosition &&
            predictedPosition.latitude !== undefined &&
            predictedPosition.longitude !== undefined && (
              <Marker
                position={[predictedPosition.latitude, predictedPosition.longitude]}
                icon={predictedPositionIcon}
              >
                <Popup>
                  <div className="text-slate-900 font-sans p-1">
                    <p className="font-bold text-xs text-amber-700">Predicted Drift Position</p>
                    <p className="text-[11px] text-slate-700 font-mono">
                      {predictedPosition.latitude.toFixed(4)}° N, {predictedPosition.longitude.toFixed(4)}° E
                    </p>
                    {searchRadiusNm && (
                      <p className="text-[10px] text-slate-600 mt-1">
                        IAMSAR Search Radius: <strong>{searchRadiusNm} NM</strong>
                      </p>
                    )}
                  </div>
                </Popup>
              </Marker>
            )}

          {/* IAMSAR Search Radius Circle around Predicted Position */}
          {predictedPosition &&
            predictedPosition.latitude !== undefined &&
            searchRadiusMeters && (
              <Circle
                center={[predictedPosition.latitude, predictedPosition.longitude]}
                radius={searchRadiusMeters}
                pathOptions={{
                  color: '#f59e0b',
                  fillColor: '#f59e0b',
                  fillOpacity: 0.15,
                  weight: 1.5,
                  dashArray: '3, 3',
                }}
              />
            )}
        </MapContainer>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
        <div className="flex items-center gap-1.5">
          <Navigation className="w-3.5 h-3.5 text-cyan-400" />
          <span>
            Selected: <strong className="text-white font-mono">{latitude.toFixed(4)}° N, {longitude.toFixed(4)}° E</strong>
          </span>
        </div>
        <span className="text-[11px] text-slate-500 font-mono">
          Click along Maharashtra coast to inspect
        </span>
      </div>
    </div>
  );
}
