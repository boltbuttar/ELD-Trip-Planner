import React from 'react';
import { Route, Clock, Calendar, Bed, Fuel, Activity } from 'lucide-react';

const CARDS = [
  { key: 'total_miles', icon: Route, label: 'Total Distance', color: '#4299E1', bg: 'rgba(66,153,225,0.1)', format: v => `${Math.round(v).toLocaleString()}`, unit: 'mi' },
  { key: 'total_driving_hours', icon: Clock, label: 'Driving Time', color: '#48BB78', bg: 'rgba(72,187,120,0.1)', format: v => v.toFixed(1), unit: 'hrs' },
  { key: 'total_days', icon: Calendar, label: 'Days', color: '#9F7AEA', bg: 'rgba(159,122,234,0.1)', format: v => v, unit: '' },
  { key: 'total_duty_hours', icon: Activity, label: 'Duty Hours', color: '#F56565', bg: 'rgba(245,101,101,0.1)', format: v => v.toFixed(1), unit: 'hrs' },
  { key: 'total_rest_stops', icon: Bed, label: 'Rest Stops', color: '#ECC94B', bg: 'rgba(236,201,75,0.1)', format: v => v, unit: '' },
  { key: 'total_fuel_stops', icon: Fuel, label: 'Fuel Stops', color: '#4FD1C5', bg: 'rgba(79,209,197,0.1)', format: v => v, unit: '' },
];

const TripSummary = ({ summary }) => {
  if (!summary) return null;

  // Generate mini bar chart data from driving hours
  const totalMiles = summary.total_miles || 0;
  const drivingHrs = summary.total_driving_hours || 0;

  return (
    <div className="animate-slide-up">
      {/* Big stat card like $223,465.40 in reference */}
      <div className="stat-card" style={{ marginBottom: '10px' }}>
        <div className="stat-card-header">
          <span className="stat-card-title">Total Distance</span>
        </div>
        <div className="stat-card-value">
          {Math.round(totalMiles).toLocaleString()}
          <span className="unit"> mi</span>
        </div>
        <div className="stat-card-change positive">
          {drivingHrs.toFixed(1)} hrs driving · {summary.total_days || 0} day{(summary.total_days || 0) !== 1 ? 's' : ''}
        </div>
        {/* Mini bar chart */}
        <div className="stat-mini-chart">
          {[35, 60, 80, 45, 90, 55, 70, 40, 85, 50, 65, 75].map((h, i) => (
            <div key={i} className={`stat-bar ${i >= 8 ? 'active' : ''}`} style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>

      {/* Shipment Status breakdown like reference */}
      <div className="stat-card" style={{ marginBottom: '10px' }}>
        <div className="stat-card-header">
          <span className="stat-card-title">Trip Breakdown</span>
        </div>
        <div className="status-breakdown">
          <div className="status-item">
            <div className="status-item-value">{drivingHrs.toFixed(1)}</div>
            <div className="status-item-label">Driving</div>
          </div>
          <div className="status-item">
            <div className="status-item-value">{(summary.total_duty_hours - drivingHrs).toFixed(1)}</div>
            <div className="status-item-label">On Duty</div>
          </div>
          <div className="status-item">
            <div className="status-item-value">{summary.total_rest_stops}</div>
            <div className="status-item-label">Rests</div>
          </div>
          <div className="status-item">
            <div className="status-item-value">{summary.total_fuel_stops}</div>
            <div className="status-item-label">Fuel</div>
          </div>
        </div>
      </div>

      {/* Mini summary cards grid */}
      <div className="summary-grid">
        {CARDS.map(({ key, icon: Icon, label, color, bg, format, unit }) => {
          const val = summary[key] || 0;
          return (
            <div key={key} className="summary-mini-card">
              <div className="summary-mini-icon" style={{ background: bg, color }}>
                <Icon size={16} />
              </div>
              <div>
                <div className="summary-mini-value">
                  {format(val)}{unit && <span style={{ fontSize: '0.65rem', color: '#A0AEC0', marginLeft: '2px' }}>{unit}</span>}
                </div>
                <div className="summary-mini-label">{label}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TripSummary;
