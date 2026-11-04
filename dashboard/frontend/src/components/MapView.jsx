import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';

// Fix default marker icon issue in bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Technology-based marker colors
const techColors = {
  NR: '#3b82f6',      // blue
  LTE: '#10b981',     // emerald
  GSM: '#f97316',     // orange
  default: '#8b5cf6', // purple
};

function createColoredIcon(color, size = 16) {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      width: ${size}px; height: ${size}px;
      background: ${color};
      border: 2px solid #ffffff;
      border-radius: 50%;
      box-shadow: 0 0 8px rgba(0,0,0,0.6);
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

function createDeviceIcon(color = '#3b82f6', size = 28) {
  return L.divIcon({
    className: 'custom-device-marker',
    html: `
      <div style="position: relative; width: ${size}px; height: ${size}px;">
        <div style="
          position: absolute; inset: -10px;
          border-radius: 50%;
          background: ${color};
          opacity: 0.45;
          animation: ping 1.6s cubic-bezier(0, 0, 0.2, 1) infinite;
        "></div>
        <div style="
          position: relative;
          width: ${size}px; height: ${size}px;
          background: ${color};
          border: 3px solid #ffffff;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          color: white; font-size: 14px;
          box-shadow: 0 0 16px ${color};
        ">📱</div>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

function createTowerIcon(color = '#3b82f6', size = 26) {
  return L.divIcon({
    className: 'custom-tower-marker',
    html: `
      <div style="position: relative; width: ${size}px; height: ${size}px;">
        <div style="
          position: relative;
          width: ${size}px; height: ${size}px;
          background: #0f172a;
          border: 2px solid ${color};
          border-radius: 6px;
          display: flex; align-items: center; justify-content: center;
          color: white; font-size: 14px;
          box-shadow: 0 0 12px ${color}80;
        ">🗼</div>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

function FitBounds({ markers }) {
  const map = useMap();
  useEffect(() => {
    if (markers && markers.length > 0) {
      const valid = markers.filter((m) => m && m.lat != null && m.lng != null);
      if (valid.length > 0) {
        const bounds = L.latLngBounds(valid.map((m) => [m.lat, m.lng]));
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      }
    }
  }, [markers, map]);
  return null;
}

function RecenterMap({ center, zoom, flyToTrigger }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] != null && center[1] != null && !isNaN(center[0]) && !isNaN(center[1])) {
      if (flyToTrigger) {
        map.flyTo(center, Math.max(zoom || 16, 15), { duration: 1.2 });
      } else {
        map.setView(center, zoom || map.getZoom(), { animate: true });
      }
    }
  }, [center[0], center[1], zoom, flyToTrigger, map]);
  return null;
}

export default function MapView({
  center = [20.5937, 78.9629],
  zoom = 5,
  markers = [],
  cellSites = [],
  additionalMarkers = [],
  circle = null,
  circles = [],
  polyline = null,
  paths = [],
  height = '360px',
  className = '',
  recenterOnChange = false,
  disableFitBounds = false,
  flyToTrigger = 0,
}) {
  // Normalize all markers
  const allMarkers = [
    ...markers,
    ...cellSites.map((c) => ({
      id: c.site_id || c.id,
      lat: c.lat || c.latitude,
      lng: c.lng || c.longitude,
      tech: c.tech || c.technology,
      label: c.name || c.site_id,
      description: c.description,
    })),
    ...additionalMarkers,
  ];

  // Normalize circles
  const allCircles = [...circles];
  if (circle) {
    if (circle.center) {
      allCircles.push({
        lat: circle.center[0],
        lng: circle.center[1],
        radius: circle.radius,
        color: circle.color || '#ef4444',
      });
    } else if (circle.lat != null && circle.lng != null) {
      allCircles.push(circle);
    }
  }

  // Normalize paths
  const allPaths = [...paths];
  if (polyline && polyline.length > 1) {
    allPaths.push({
      positions: polyline,
      color: '#3b82f6',
      weight: 3,
    });
  }

  return (
    <div className={`rounded-xl overflow-hidden border border-slate-700/80 shadow-inner ${className}`} style={{ height }}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {recenterOnChange && <RecenterMap center={center} zoom={zoom} flyToTrigger={flyToTrigger} />}
        {!disableFitBounds && allMarkers.length > 0 && <FitBounds markers={allMarkers} />}

        {allMarkers.map((m, idx) => {
          const color = m.color || (m.tech ? techColors[m.tech] : null) || techColors.default;
          const size = m.size || (m.special ? 16 : 14);
          const icon = m.isDevice
            ? createDeviceIcon(m.color, m.size || 24)
            : m.isTower
            ? createTowerIcon(color, m.size || 26)
            : createColoredIcon(color, size);
          return (
            <Marker
              key={m.id || `marker-${idx}`}
              position={[m.lat, m.lng]}
              icon={icon}
            >
              <Popup>
                <div className="text-xs space-y-1">
                  <p className="font-bold text-slate-100">{m.label || m.id || 'Point'}</p>
                  {m.tech && <p className="text-blue-400 font-semibold">{m.tech}</p>}
                  {m.description && <p className="text-slate-300">{m.description}</p>}
                  <p className="text-slate-400 font-mono text-[10px]">
                    ({m.lat.toFixed(5)}, {m.lng.toFixed(5)})
                  </p>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {allCircles.map((c, idx) => (
          <Circle
            key={`circle-${idx}`}
            center={[c.lat, c.lng]}
            radius={c.radius}
            pathOptions={{
              color: c.color || '#ef4444',
              fillColor: c.fillColor || c.color || '#ef4444',
              fillOpacity: 0.18,
              weight: 2,
              dashArray: '4 4',
            }}
          />
        ))}

        {allPaths.map((p, idx) => (
          <Polyline
            key={`path-${idx}`}
            positions={p.positions}
            pathOptions={{
              color: p.color || '#3b82f6',
              weight: p.weight || 3,
              dashArray: p.dashed ? '6 6' : undefined,
            }}
          />
        ))}
      </MapContainer>
    </div>
  );
}
