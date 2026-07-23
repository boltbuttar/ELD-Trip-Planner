import React, { useState } from 'react';
import axios from 'axios';
import {
  Truck, Map, FileText, Download, Plus
} from 'lucide-react';
import TripForm from './components/TripForm';
import MapView from './components/MapView';
import TripSummary from './components/TripSummary';
import EldLogSheet from './components/EldLogSheet';
import './App.css';

function transformApiResponse(apiData) {
  const routeCoords = (apiData.route?.geometry || []).map(coord => ({
    lat: coord[1],
    lng: coord[0]
  }));

  const stops = (apiData.stops || []).map(stop => ({
    type: stop.type,
    lat: stop.location?.lat || stop.lat,
    lng: stop.location?.lng || stop.lng,
    name: stop.name || 'Unknown',
    arrival: stop.arrival_time || stop.arrival,
    departure: stop.departure_time || stop.departure,
    duration: stop.duration_hours || stop.duration,
    description: stop.description || ''
  }));

  const logs = (apiData.daily_logs || []).map(dayLog => {
    const dayDate = dayLog.date;
    const dayStart = new Date(dayDate + 'T00:00:00');

    const events = (dayLog.events || []).map(evt => {
      let startHour, endHour;
      if (evt.start_hour !== undefined && evt.end_hour !== undefined) {
        startHour = evt.start_hour;
        endHour = evt.end_hour;
      } else if (evt.start && evt.end) {
        const evtStart = new Date(evt.start);
        const evtEnd = new Date(evt.end);
        startHour = (evtStart - dayStart) / (1000 * 60 * 60);
        endHour = (evtEnd - dayStart) / (1000 * 60 * 60);
      } else {
        startHour = 0;
        endHour = 0;
      }
      startHour = Math.max(0, Math.min(24, startHour));
      endHour = Math.max(0, Math.min(24, endHour));

      let type = evt.type;
      if (['pickup', 'dropoff', 'fueling', 'break'].includes(type)) {
        type = 'on_duty_not_driving';
      }

      return {
        type: evt.type,
        start_hour: startHour,
        end_hour: endHour,
        description: evt.description || evt.location || evt.type
      };
    }).filter(evt => evt.end_hour > evt.start_hour);

    return {
      day_number:    dayLog.day_number,
      date:          dayLog.date,
      total_miles:   dayLog.total_miles || 0,
      hours_summary: dayLog.hours_summary || { off_duty: 24, sleeper_berth: 0, driving: 0, on_duty_not_driving: 0 },
      events,
      remarks:       dayLog.remarks || [],
      from_location: dayLog.from_location || '',
      to_location:   dayLog.to_location   || ''
    };
  });

  const summary = {
    total_miles: apiData.trip_summary?.total_miles || 0,
    total_driving_hours: apiData.trip_summary?.total_driving_hours || 0,
    total_duty_hours: apiData.trip_summary?.total_duty_hours || 0,
    total_days: apiData.trip_summary?.total_days || logs.length,
    total_rest_stops: apiData.trip_summary?.total_rest_stops || 0,
    total_fuel_stops: apiData.trip_summary?.total_fuel_stops || 0,
    legs: apiData.route?.legs || []
  };

  return { route: routeCoords, stops, logs, summary };
}

function App() {
  const [tripData, setTripData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeLogDay, setActiveLogDay] = useState(1);
  const [activeView, setActiveView] = useState('route'); // 'route' or 'logs'

  const handlePlanTrip = async (formData) => {
    setLoading(true);
    setError(null);
    setTripData(null);
    try {
      const response = await axios.post('/api/plan-trip/', formData);
      if (response.data.error) throw new Error(response.data.error);
      const transformed = transformApiResponse(response.data);
      setTripData(transformed);
      setActiveLogDay(1);
      setActiveView('route');
    } catch (err) {
      const msg = err.response?.data?.error || err.message || "Failed to plan trip.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const activeLog = tripData?.logs?.find(l => l.day_number === activeLogDay);

  return (
    <div className="app-container">
      {/* ── Toolbar ── */}
      <div className="app-toolbar">
        <div className="toolbar-left">
          <div className="toolbar-brand">
            <Truck size={18} style={{ color: '#93B1C2' }} />
            <span className="toolbar-brand-name">Spotter ELD</span>
          </div>
          <div className="toolbar-divider"></div>
          <button
            className={`toolbar-icon-btn ${activeView === 'route' ? 'active' : ''}`}
            onClick={() => setActiveView('route')}
            title="Route Map"
          >
            <Map size={17} />
            <span className="toolbar-btn-label">Map</span>
          </button>
          <button
            className={`toolbar-icon-btn ${activeView === 'logs' ? 'active' : ''}`}
            onClick={() => setActiveView('logs')}
            title="ELD Logs"
          >
            <FileText size={17} />
            <span className="toolbar-btn-label">ELD Logs</span>
          </button>
        </div>
        <div className="toolbar-right">
          <button className="btn" onClick={() => window.print()}>
            <Download size={14} /> Export
          </button>
          <button className="btn btn-primary" onClick={() => {
            setTripData(null);
            setActiveView('route');
          }}>
            <Plus size={14} /> New Trip
          </button>
        </div>
      </div>

      {/* ── Main 3-Panel Dashboard ── */}
      <div className="dashboard-body">
        {/* ── Left Panel ── */}
        <div className="left-panel">
          <TripForm onSubmit={handlePlanTrip} isLoading={loading} />
          {tripData && tripData.summary && (
            <TripSummary summary={tripData.summary} />
          )}
        </div>

        {/* ── Center Panel ── */}
        <div className="center-panel">
          {loading ? (
            <div className="loading-overlay">
              <div className="loading-spinner"></div>
              <p className="loading-text">Planning HOS-compliant route...</p>
              <p className="loading-sub">Geocoding locations & calculating stops</p>
            </div>
          ) : activeView === 'logs' && activeLog ? (
            <div className="log-viewer-panel" style={{ overflowY: 'auto', height: '100%' }}>
              <EldLogSheet logData={activeLog} />
            </div>
          ) : (
            <MapView routeData={tripData} />
          )}
        </div>

        {/* ── Right Panel ── */}
        <div className="right-panel">
          {tripData && tripData.logs && tripData.logs.length > 0 ? (
            <>
              <div className="right-panel-header">
                <div className="right-panel-title">Daily Logs</div>
                <div className="panel-tabs">
                  <button
                    className={`panel-tab ${activeView === 'route' ? 'active' : ''}`}
                    onClick={() => setActiveView('route')}
                  >
                    Map
                  </button>
                  <button
                    className={`panel-tab ${activeView === 'logs' ? 'active' : ''}`}
                    onClick={() => setActiveView('logs')}
                  >
                    Logs
                  </button>
                </div>
              </div>
              <div className="log-list">
                {tripData.logs.map(log => (
                  <div
                key={log.day_number}
                className={`log-list-item ${activeLogDay === log.day_number ? 'active' : ''}`}
                onClick={() => {
                  setActiveLogDay(log.day_number);
                  setActiveView('logs');
                }}
              >
                <div className="log-item-top-row">
                  <span className="log-item-id">#DAY-{log.day_number}</span>
                  <span className="log-item-status">{log.hours_summary.driving.toFixed(1)}h driving</span>
                </div>
                <div className="log-item-route">
                  <span className="log-item-loc">{log.date}</span>
                  <div className="route-line">
                    <Truck size={11} className="route-truck-icon" />
                  </div>
                  <span className="log-item-loc">{Math.round(log.total_miles)} mi</span>
                </div>
              </div>
                ))}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <FileText size={40} className="empty-state-icon" />
              <p className="empty-state-text">No logs yet</p>
              <p className="empty-state-sub">Plan a trip to generate ELD daily logs</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Toast ── */}
      {error && (
        <div className="toast animate-slide-up" onClick={() => setError(null)}>
          <span>⚠️ {error}</span>
          <button className="toast-close">✕</button>
        </div>
      )}
    </div>
  );
}

export default App;
