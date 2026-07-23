import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Truck, Map, FileText, Download, Plus,
  RotateCcw, CheckCircle2, Fuel, Coffee,
  Navigation2, Package, Flag, Gauge
} from 'lucide-react';
import TripForm from './components/TripForm';
import MapView from './components/MapView';
import TripSummary from './components/TripSummary';
import EldLogSheet from './components/EldLogSheet';
import './App.css';

// ─── Response transformer ─────────────────────────────────────────────────────
function transformApiResponse(apiData) {
  const routeCoords = (apiData.route?.geometry || []).map(c => ({ lat: c[1], lng: c[0] }));

  const stops = (apiData.stops || []).map(s => ({
    type:        s.type,
    lat:         s.location?.lat || s.lat,
    lng:         s.location?.lng || s.lng,
    name:        s.name || 'Unknown',
    arrival:     s.arrival_time  || s.arrival,
    departure:   s.departure_time || s.departure,
    duration:    s.duration_hours || s.duration,
    description: s.description || ''
  }));

  const logs = (apiData.daily_logs || []).map(dayLog => {
    const dayStart = new Date(dayLog.date + 'T00:00:00');
    const events = (dayLog.events || []).map(evt => {
      let startHour = evt.start_hour, endHour = evt.end_hour;
      if (startHour === undefined && evt.start && evt.end) {
        startHour = (new Date(evt.start) - dayStart) / 3600000;
        endHour   = (new Date(evt.end)   - dayStart) / 3600000;
      }
      startHour = Math.max(0, Math.min(24, startHour || 0));
      endHour   = Math.max(0, Math.min(24, endHour   || 0));
      return { type: evt.type, start_hour: startHour, end_hour: endHour, description: evt.description || evt.type };
    }).filter(e => e.end_hour > e.start_hour);

    return {
      day_number:    dayLog.day_number,
      date:          dayLog.date,
      total_miles:   dayLog.total_miles   || 0,
      hours_summary: dayLog.hours_summary || { off_duty: 24, sleeper_berth: 0, driving: 0, on_duty_not_driving: 0 },
      events,
      remarks:       dayLog.remarks       || [],
      from_location: dayLog.from_location || '',
      to_location:   dayLog.to_location   || ''
    };
  });

  return {
    route: routeCoords,
    stops,
    logs,
    summary: {
      total_miles:         apiData.trip_summary?.total_miles         || 0,
      total_driving_hours: apiData.trip_summary?.total_driving_hours || 0,
      total_duty_hours:    apiData.trip_summary?.total_duty_hours    || 0,
      total_days:          apiData.trip_summary?.total_days          || logs.length,
      total_rest_stops:    apiData.trip_summary?.total_rest_stops    || 0,
      total_fuel_stops:    apiData.trip_summary?.total_fuel_stops    || 0,
      legs:                apiData.route?.legs                       || []
    }
  };
}

// ─── Loading step messages ────────────────────────────────────────────────────
const LOADING_STEPS = [
  'Geocoding locations…',
  'Fetching optimal route via OSRM…',
  'Simulating HOS regulations…',
  'Generating ELD log sheets…'
];

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [tripData,    setTripData]    = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [loadStep,    setLoadStep]    = useState(0);
  const [error,       setError]       = useState(null);
  const [activeLogDay,setActiveLogDay]= useState(1);
  const [activeView,  setActiveView]  = useState('map'); // 'map' | 'logs'

  // Cycle through loading step messages
  useEffect(() => {
    if (!loading) { setLoadStep(0); return; }
    const id = setInterval(() => setLoadStep(p => Math.min(p + 1, LOADING_STEPS.length - 1)), 2500);
    return () => clearInterval(id);
  }, [loading]);

  const handlePlanTrip = async (formData) => {
    setLoading(true);
    setError(null);
    setTripData(null);
    try {
      const res = await axios.post('/api/plan-trip/', formData);
      if (res.data.error) throw new Error(res.data.error);
      setTripData(transformApiResponse(res.data));
      setActiveLogDay(1);
      setActiveView('map');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to plan trip.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => { setTripData(null); setActiveView('map'); setError(null); };

  const activeLog = tripData?.logs?.find(l => l.day_number === activeLogDay);
  const totalDays = tripData?.logs?.length || 0;

  return (
    <div className="app-container">

      {/* ══════════════════════════════════════════════════
          LEFT SIDEBAR
          ══════════════════════════════════════════════════ */}
      <aside className="sidebar">
        {/* Brand */}
        <div className="sidebar-header">
          <div className="brand-row">
            <div className="brand-icon-wrap">
              <Truck size={18} color="#fff" />
            </div>
            <div>
              <div className="brand-name">Spotter ELD</div>
              <div className="brand-sub">FMCSA-Compliant Trip Planner</div>
            </div>
          </div>
        </div>

        <div className="sidebar-body">
          {/* ── Trip Form ── */}
          <TripForm onSubmit={handlePlanTrip} isLoading={loading} />

          {/* ── Trip Summary ── */}
          {tripData?.summary && (
            <TripSummary summary={tripData.summary} />
          )}
        </div>
      </aside>

      {/* ══════════════════════════════════════════════════
          MAIN AREA
          ══════════════════════════════════════════════════ */}
      <div className="main-area">

        {/* ── Topbar ── */}
        <header className="topbar">
          <div className="topbar-tabs">
            <button
              className={`topbar-tab ${activeView === 'map' ? 'active' : ''}`}
              onClick={() => setActiveView('map')}
            >
              <Map size={15} /> Route Map
            </button>
            <button
              className={`topbar-tab ${activeView === 'logs' ? 'active' : ''}`}
              onClick={() => setActiveView('logs')}
              disabled={!tripData}
            >
              <FileText size={15} /> ELD Logs
              {totalDays > 0 && (
                <span className="log-count-badge">{totalDays}</span>
              )}
            </button>
          </div>

          <div className="topbar-actions">
            {tripData && (
              <div className="status-pill">
                <span className="status-dot" />
                Trip Planned
              </div>
            )}
            {tripData && (
              <button className="btn" onClick={() => window.print()} title="Print ELD Logs">
                <Download size={14} /> Export
              </button>
            )}
            <button className="btn btn-primary" onClick={handleReset}>
              <RotateCcw size={14} /> New Trip
            </button>
          </div>
        </header>

        {/* ── Content ── */}
        <div className="content-area">

          {/* ── Center (Map or Log Viewer) ── */}
          <div className="center-panel">
            {loading && (
              <div className="loading-overlay">
                <div className="loading-ring" />
                <div className="loading-title">Planning HOS-Compliant Route</div>
                <div className="loading-steps">
                  {LOADING_STEPS.map((step, i) => (
                    <div className="loading-step" key={i} style={{ opacity: i <= loadStep ? 1 : 0.35, transition: 'opacity 0.4s' }}>
                      <div className="loading-step-dot" style={{ background: i <= loadStep ? 'var(--c-success)' : 'var(--brand-400)', animationDelay: `${i * 0.3}s` }} />
                      {step}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeView === 'logs' && activeLog ? (
              <div className="log-viewer-panel">
                <EldLogSheet logData={activeLog} />
              </div>
            ) : (
              <MapView routeData={tripData} />
            )}
          </div>

          {/* ── Right Log Panel ── */}
          <aside className="right-log-panel">
            <div className="log-panel-header">
              <div className="log-panel-title">
                <FileText size={15} />
                Daily ELD Logs
                {totalDays > 0 && <span className="log-count-badge">{totalDays}</span>}
              </div>

              {/* View toggle tabs (within right panel) */}
              {tripData && (
                <div className="topbar-tabs" style={{ width: '100%' }}>
                  <button
                    className={`topbar-tab ${activeView === 'map' ? 'active' : ''}`}
                    style={{ flex: 1, justifyContent: 'center' }}
                    onClick={() => setActiveView('map')}
                  >
                    <Map size={13} /> Map
                  </button>
                  <button
                    className={`topbar-tab ${activeView === 'logs' ? 'active' : ''}`}
                    style={{ flex: 1, justifyContent: 'center' }}
                    onClick={() => setActiveView('logs')}
                  >
                    <FileText size={13} /> Logs
                  </button>
                </div>
              )}
            </div>

            {tripData?.logs?.length > 0 ? (
              <div className="log-list">
                {tripData.logs.map(log => {
                  const hs = log.hours_summary;
                  const total = (hs.off_duty + hs.sleeper_berth + hs.driving + hs.on_duty_not_driving) || 24;
                  return (
                    <div
                      key={log.day_number}
                      className={`log-list-item ${activeLogDay === log.day_number ? 'active' : ''}`}
                      onClick={() => { setActiveLogDay(log.day_number); setActiveView('logs'); }}
                    >
                      <div className="log-item-day-badge">Day {log.day_number}</div>
                      <div className="log-item-date">
                        {new Date(log.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </div>
                      <div className="log-item-meta">
                        <span className="log-item-chip driving">
                          <Gauge size={10} /> {hs.driving.toFixed(1)}h driving
                        </span>
                        <span className="log-item-chip miles">
                          <Navigation2 size={10} /> {Math.round(log.total_miles)} mi
                        </span>
                      </div>
                      {/* Mini 24h status bar */}
                      <div className="log-item-hours-bar">
                        <div className="hours-seg off"   style={{ width: `${(hs.off_duty            / total) * 100}%` }} />
                        <div className="hours-seg sleep" style={{ width: `${(hs.sleeper_berth       / total) * 100}%` }} />
                        <div className="hours-seg drive" style={{ width: `${(hs.driving             / total) * 100}%` }} />
                        <div className="hours-seg duty"  style={{ width: `${(hs.on_duty_not_driving / total) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}

                {/* Legend */}
                <div style={{ padding: '10px 12px', borderTop: '1px solid var(--canvas-border)', marginTop: '4px' }}>
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Status Legend</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {[
                      { label: 'Off Duty', cls: 'off', color: '#94a3b8' },
                      { label: 'Sleeper',  cls: 'sleep', color: '#818cf8' },
                      { label: 'Driving',  cls: 'drive', color: 'var(--c-info)' },
                      { label: 'On Duty',  cls: 'duty',  color: 'var(--c-success)' }
                    ].map(s => (
                      <div key={s.cls} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                        <div style={{ width: 10, height: 4, borderRadius: 2, background: s.color }} />
                        {s.label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon-wrap">
                  <FileText size={28} />
                </div>
                <div className="empty-state-title">No Logs Yet</div>
                <div className="empty-state-sub">
                  Enter trip details in the left panel and click "Plan Trip" to generate FMCSA-compliant ELD daily logs.
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>

      {/* ── Error Toast ── */}
      {error && (
        <div className="toast" onClick={() => setError(null)}>
          <span>⚠️ {error}</span>
          <button className="toast-close">✕</button>
        </div>
      )}
    </div>
  );
}
