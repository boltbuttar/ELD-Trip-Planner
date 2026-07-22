import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const createCustomIcon = (color, label) => {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `
      <div style="
        background-color: ${color};
        width: 26px;
        height: 26px;
        border-radius: 50%;
        border: 2.5px solid white;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: 700;
        font-size: 10px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.25);
        font-family: 'Inter', sans-serif;
      ">
        ${label}
      </div>
    `,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -13]
  });
};

const MARKER_CONFIG = {
  start:   { color: '#48BB78', label: 'S', title: 'Start' },
  pickup:  { color: '#4299E1', label: 'P', title: 'Pickup' },
  dropoff: { color: '#F56565', label: 'D', title: 'Dropoff' },
  fuel:    { color: '#ECC94B', label: 'F', title: 'Fuel Stop' },
  rest:    { color: '#9F7AEA', label: 'R', title: 'Rest Stop' },
  break:   { color: '#ED8936', label: 'B', title: 'Break' },
};

const formatTime = (isoString) => {
  if (!isoString) return '';
  try {
    return new Date(isoString).toLocaleString([], {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch { return isoString; }
};

const MapBounds = ({ route, stops }) => {
  const map = useMap();
  useEffect(() => {
    const bounds = L.latLngBounds();
    let hasPoints = false;

    if (route && route.length > 0) {
      const step = Math.max(1, Math.floor(route.length / 200));
      for (let i = 0; i < route.length; i += step) {
        bounds.extend([route[i].lat, route[i].lng]);
        hasPoints = true;
      }
      bounds.extend([route[route.length - 1].lat, route[route.length - 1].lng]);
    }
    if (stops && stops.length > 0) {
      stops.forEach(stop => {
        if (stop.lat && stop.lng) {
          bounds.extend([stop.lat, stop.lng]);
          hasPoints = true;
        }
      });
    }
    if (hasPoints && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
    }
  }, [route, stops, map]);
  return null;
};

const MapView = ({ routeData }) => {
  const defaultCenter = [39.8283, -98.5795];
  const defaultZoom = 4;
  const route = routeData?.route || [];
  const stops = routeData?.stops || [];
  const routePositions = route.map(p => [p.lat, p.lng]);

  return (
    <div className="map-container" style={{ height: '100%' }}>
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        {/* Light satellite-style tiles to match the globe aesthetic */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />

        <MapBounds route={route} stops={stops} />

        {routePositions.length > 1 && (
          <Polyline
            positions={routePositions}
            pathOptions={{
              color: '#424242',
              weight: 3,
              opacity: 0.8,
              dashArray: '8, 6',
              smoothFactor: 1
            }}
          />
        )}

        {stops.map((stop, index) => {
          if (!stop.lat || !stop.lng) return null;
          const config = MARKER_CONFIG[stop.type] || { color: '#A0AEC0', label: '?', title: stop.type };
          const icon = createCustomIcon(config.color, config.label);

          return (
            <Marker
              key={`stop-${index}-${stop.type}`}
              position={[stop.lat, stop.lng]}
              icon={icon}
            >
              <Popup>
                <div style={{ fontFamily: 'Inter, sans-serif', minWidth: '170px', color: '#2D3748' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    borderBottom: `2px solid ${config.color}`,
                    paddingBottom: '5px', marginBottom: '5px'
                  }}>
                    <div style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: config.color
                    }}></div>
                    <strong style={{ fontSize: '13px' }}>{config.title}</strong>
                  </div>
                  <p style={{ margin: '3px 0', fontSize: '12px', fontWeight: 500 }}>
                    {stop.name}
                  </p>
                  {stop.arrival && (
                    <p style={{ margin: '2px 0', fontSize: '11px', color: '#718096' }}>
                      <strong>Arrive:</strong> {formatTime(stop.arrival)}
                    </p>
                  )}
                  {stop.departure && (
                    <p style={{ margin: '2px 0', fontSize: '11px', color: '#718096' }}>
                      <strong>Depart:</strong> {formatTime(stop.departure)}
                    </p>
                  )}
                  {stop.duration && (
                    <p style={{ margin: '2px 0', fontSize: '11px', color: '#718096' }}>
                      <strong>Duration:</strong> {stop.duration} hrs
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
};

export default MapView;
