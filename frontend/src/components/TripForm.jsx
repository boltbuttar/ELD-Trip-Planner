import React, { useState } from 'react';
import { MapPin, Package, Flag, Clock, Zap, Navigation, ChevronRight } from 'lucide-react';

const PRESETS = [
  { label: 'NYC → Chicago → Miami',     locations: ['New York, NY',    'Chicago, IL',   'Miami, FL'] },
  { label: 'LA → Dallas → Atlanta',     locations: ['Los Angeles, CA', 'Dallas, TX',    'Atlanta, GA'] },
  { label: 'Seattle → Denver → Houston',locations: ['Seattle, WA',     'Denver, CO',    'Houston, TX'] },
  { label: 'Chicago → St. Louis → Nashville', locations: ['Chicago, IL', 'St. Louis, MO', 'Nashville, TN'] },
];

const FIELDS = [
  { name: 'current_location', label: 'Current Location', icon: MapPin,   placeholder: 'e.g. New York, NY',   color: '#60a5fa' },
  { name: 'pickup_location',  label: 'Pickup Location',  icon: Package,  placeholder: 'e.g. Chicago, IL',    color: '#34d399' },
  { name: 'dropoff_location', label: 'Dropoff Location', icon: Flag,     placeholder: 'e.g. Miami, FL',      color: '#f87171' },
];

const TripForm = ({ onSubmit, isLoading }) => {
  const [formData, setFormData] = useState({
    current_location:  '',
    pickup_location:   '',
    dropoff_location:  '',
    current_cycle_used: 0
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'current_cycle_used' ? parseFloat(value) || 0 : value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.current_location && formData.pickup_location && formData.dropoff_location) {
      onSubmit(formData);
    }
  };

  const applyPreset = (preset) => {
    setFormData({
      current_location:   preset.locations[0],
      pickup_location:    preset.locations[1],
      dropoff_location:   preset.locations[2],
      current_cycle_used: 0
    });
  };

  return (
    <div className="animate-fade-in">
      {/* Section label */}
      <div className="sidebar-section-title">
        <Navigation size={11} /> Plan Trip
      </div>

      <form onSubmit={handleSubmit}>
        {/* Location fields */}
        {FIELDS.map(({ name, label, icon: Icon, placeholder, color }) => (
          <div className="form-group" key={name}>
            <div className="form-label">
              <Icon size={11} style={{ color }} /> {label}
            </div>
            <div className="input-wrap">
              <div className="input-icon">
                <Icon size={13} style={{ color }} />
              </div>
              <input
                type="text"
                name={name}
                value={formData[name]}
                onChange={handleChange}
                className="input-field"
                placeholder={placeholder}
                required
                autoComplete="off"
              />
            </div>
          </div>
        ))}

        {/* Cycle hours */}
        <div className="form-group">
          <div className="form-label">
            <Clock size={11} style={{ color: '#f59e0b' }} /> Cycle Used (Hrs)
          </div>
          <div className="input-wrap">
            <div className="input-icon">
              <Clock size={13} style={{ color: '#f59e0b' }} />
            </div>
            <input
              type="number"
              name="current_cycle_used"
              value={formData.current_cycle_used}
              onChange={handleChange}
              className="input-field"
              min="0" max="70" step="0.5"
            />
          </div>
          {/* Cycle progress bar */}
          <div style={{ marginTop: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '0.58rem', color: 'var(--sidebar-muted)' }}>70hr/8-day cycle used</span>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: formData.current_cycle_used > 60 ? '#f87171' : '#60a5fa' }}>
                {formData.current_cycle_used}h / 70h
              </span>
            </div>
            <div style={{ height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${Math.min(100, (formData.current_cycle_used / 70) * 100)}%`,
                background: formData.current_cycle_used > 60 ? '#ef4444' : formData.current_cycle_used > 40 ? '#f59e0b' : '#3b82f6',
                borderRadius: '2px',
                transition: 'width 0.3s ease, background 0.3s ease'
              }} />
            </div>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          className="btn-plan"
          disabled={isLoading || !formData.current_location || !formData.pickup_location || !formData.dropoff_location}
        >
          {isLoading ? (
            <>
              <Navigation size={15} className="spinner" />
              Planning Route…
            </>
          ) : (
            <>
              <Zap size={15} />
              Plan HOS Trip
            </>
          )}
        </button>
      </form>

      {/* Quick Presets */}
      <div className="presets-section">
        <div className="presets-label">Quick Presets</div>
        <div className="presets-grid">
          {PRESETS.map(preset => (
            <button
              key={preset.label}
              type="button"
              className="preset-btn"
              onClick={() => applyPreset(preset)}
              disabled={isLoading}
            >
              <Navigation size={11} style={{ color: '#60a5fa', flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{preset.label}</span>
              <ChevronRight size={11} className="preset-arrow" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TripForm;
