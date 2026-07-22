import React, { useState } from 'react';
import { MapPin, Package, Flag, Clock, Navigation, Zap } from 'lucide-react';

const PRESETS = [
  { label: 'NYC → CHI → MIA', locations: ['New York, NY', 'Chicago, IL', 'Miami, FL'] },
  { label: 'LA → DAL → ATL', locations: ['Los Angeles, CA', 'Dallas, TX', 'Atlanta, GA'] },
  { label: 'SEA → DEN → HOU', locations: ['Seattle, WA', 'Denver, CO', 'Houston, TX'] },
];

const TripForm = ({ onSubmit, isLoading }) => {
  const [formData, setFormData] = useState({
    current_location: '',
    pickup_location: '',
    dropoff_location: '',
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
      current_location: preset.locations[0],
      pickup_location: preset.locations[1],
      dropoff_location: preset.locations[2],
      current_cycle_used: 0
    });
  };

  return (
    <div className="trip-form-section animate-fade-in">
      <div className="form-section-title">
        <Navigation size={14} style={{ color: '#93B1C2' }} />
        Plan Route
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div className="form-group">
          <label><MapPin size={12} /> Current Location</label>
          <input
            type="text"
            name="current_location"
            value={formData.current_location}
            onChange={handleChange}
            className="input-field"
            placeholder="e.g. New York, NY"
            required
          />
        </div>

        <div className="form-group">
          <label><Package size={12} /> Pickup Location</label>
          <input
            type="text"
            name="pickup_location"
            value={formData.pickup_location}
            onChange={handleChange}
            className="input-field"
            placeholder="e.g. Chicago, IL"
            required
          />
        </div>

        <div className="form-group">
          <label><Flag size={12} /> Dropoff Location</label>
          <input
            type="text"
            name="dropoff_location"
            value={formData.dropoff_location}
            onChange={handleChange}
            className="input-field"
            placeholder="e.g. Miami, FL"
            required
          />
        </div>

        <div className="form-group">
          <label><Clock size={12} /> Cycle Used (Hours)</label>
          <input
            type="number"
            name="current_cycle_used"
            value={formData.current_cycle_used}
            onChange={handleChange}
            className="input-field"
            min="0"
            max="70"
            step="0.5"
          />
          <p className="form-hint">70hr/8day cycle — hours already used</p>
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={isLoading}
          style={{ width: '100%', padding: '10px', marginTop: '4px' }}
        >
          {isLoading ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Navigation size={14} className="spinner" /> Planning...
            </span>
          ) : (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Zap size={14} /> Plan Trip
            </span>
          )}
        </button>
      </form>

      <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '8px' }}>
        <p style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
          Quick Presets
        </p>
        <div className="presets-row">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className="preset-chip"
              onClick={() => applyPreset(preset)}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TripForm;
