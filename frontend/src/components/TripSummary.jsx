import React from 'react';
import { Route, Clock, Calendar, Bed, Fuel, Activity, Navigation2 } from 'lucide-react';

const TripSummary = ({ summary }) => {
  if (!summary) return null;

  const miles       = summary.total_miles          || 0;
  const drivingHrs  = summary.total_driving_hours  || 0;
  const dutyHrs     = summary.total_duty_hours     || 0;
  const days        = summary.total_days           || 0;
  const rests       = summary.total_rest_stops     || 0;
  const fuels       = summary.total_fuel_stops     || 0;
  const legs        = summary.legs                 || [];

  // HOS utilisation bars (as % of daily limits)
  const hosItems = [
    { label: 'Driving',  hrs: drivingHrs / days, limit: 11, color: '#3b82f6' },
    { label: 'On Duty',  hrs: dutyHrs    / days, limit: 14, color: '#10b981' },
  ];

  return (
    <div className="summary-section animate-slide-up">

      <div className="sidebar-section-title">
        <Activity size={11} /> Trip Summary
      </div>

      {/* Big hero stat */}
      <div style={{
        background: 'linear-gradient(135deg, #1e3a8a 0%, #312e81 100%)',
        borderRadius: 'var(--r-lg)',
        padding: '14px 16px',
        border: '1px solid rgba(59,130,246,0.3)',
        marginBottom: '8px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* bg glow */}
        <div style={{
          position: 'absolute', top: -20, right: -20,
          width: 80, height: 80, borderRadius: '50%',
          background: 'rgba(59,130,246,0.25)', filter: 'blur(20px)', pointerEvents: 'none'
        }} />
        <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'rgba(148,163,184,0.8)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
          Total Distance
        </div>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '2rem', fontWeight: 800, color: '#fff', lineHeight: 1 }}>
          {Math.round(miles).toLocaleString()}
          <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#94a3b8', marginLeft: '5px' }}>mi</span>
        </div>
        <div style={{ display: 'flex', gap: '12px', marginTop: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.68rem', color: '#93c5fd', fontWeight: 600 }}>
            🕐 {drivingHrs.toFixed(1)} hrs driving
          </span>
          <span style={{ fontSize: '0.68rem', color: '#86efac', fontWeight: 600 }}>
            📅 {days} day{days !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Stat cards 2×2 grid */}
      <div className="stat-cards-grid">
        {[
          { icon: Clock,        val: drivingHrs.toFixed(1), unit: 'h', label: 'Driving',    bg: 'rgba(59,130,246,0.15)',  color: '#60a5fa' },
          { icon: Activity,     val: dutyHrs.toFixed(1),    unit: 'h', label: 'On Duty',    bg: 'rgba(16,185,129,0.15)', color: '#34d399' },
          { icon: Bed,          val: rests,                 unit: '',  label: 'Rest Stops', bg: 'rgba(139,92,246,0.15)', color: '#a78bfa' },
          { icon: Fuel,         val: fuels,                 unit: '',  label: 'Fuel Stops', bg: 'rgba(245,158,11,0.15)', color: '#fbbf24' },
        ].map(({ icon: Icon, val, unit, label, bg, color }) => (
          <div key={label} className="stat-card">
            <div className="stat-card-icon" style={{ background: bg }}>
              <Icon size={14} style={{ color }} />
            </div>
            <div className="stat-card-val">
              {val}{unit && <span className="unit">{unit}</span>}
            </div>
            <div className="stat-card-label">{label}</div>
          </div>
        ))}
      </div>

      {/* HOS utilisation bars */}
      <div className="hos-status-row">
        <div className="hos-status-title">Avg Daily HOS Usage</div>
        <div className="hos-bars">
          {hosItems.map(item => {
            const pct = days > 0 ? Math.min(100, (item.hrs / item.limit) * 100) : 0;
            return (
              <div key={item.label} className="hos-bar-row">
                <div className="hos-bar-label">{item.label}</div>
                <div className="hos-bar-track">
                  <div className="hos-bar-fill" style={{ width: `${pct}%`, background: item.color }} />
                </div>
                <div className="hos-bar-val">{days > 0 ? item.hrs.toFixed(1) : '—'}h</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Route legs */}
      {legs.length > 0 && (
        <div className="route-legs">
          <div className="hos-status-title" style={{ marginBottom: '8px' }}>Route Legs</div>
          {legs.map((leg, i) => (
            <div key={i} className="leg-item">
              <div className="leg-dot" style={{ background: i === 0 ? '#3b82f6' : '#10b981' }} />
              <div className="leg-info">
                <div className="leg-route">
                  {leg.from} → {leg.to}
                </div>
                <div className="leg-meta">
                  {Math.round(leg.distance_miles)} mi · {leg.duration_hours?.toFixed(1)} hrs
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TripSummary;
