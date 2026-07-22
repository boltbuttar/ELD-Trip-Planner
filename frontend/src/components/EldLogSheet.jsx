import React, { useMemo } from 'react';

const EldLogSheet = ({ logData }) => {
  if (!logData) return null;

  const {
    day_number = 1,
    date = '',
    events = [],
    total_miles = 0,
    hours_summary = { off_duty: 24, sleeper_berth: 0, driving: 0, on_duty_not_driving: 0 },
    remarks = []
  } = logData;

  // ── SVG Grid Constants ──
  const SVG_W = 960;
  const LABEL_W = 130;       // left label area
  const TOTALS_W = 58;       // right totals column
  const GRID_X = LABEL_W;
  const GRID_W = SVG_W - LABEL_W - TOTALS_W;  // 772
  const PX_PER_HR = GRID_W / 24;

  const HEADER_Y = 0;
  const HOUR_LABEL_Y = 64;
  const GRID_TOP = 76;
  const ROW_H = 44;
  const ROW_GAP = 0;

  const ROWS = [
    { key: 'off_duty',            label: '1. Off Duty',             y: GRID_TOP },
    { key: 'sleeper_berth',       label: '2. Sleeper Berth',        y: GRID_TOP + ROW_H },
    { key: 'driving',             label: '3. Driving',              y: GRID_TOP + ROW_H * 2 },
    { key: 'on_duty_not_driving', label: '4. On Duty (Not Driving)', y: GRID_TOP + ROW_H * 3 },
  ];

  const GRID_BOTTOM = GRID_TOP + ROW_H * 4;

  const rowCenter = (key) => {
    const row = ROWS.find(r => r.key === key);
    return row ? row.y + ROW_H / 2 : ROWS[0].y + ROW_H / 2;
  };

  const hourToX = (h) => GRID_X + h * PX_PER_HR;

  // ── Build the continuous status line path ──
  const statusPath = useMemo(() => {
    if (!events || events.length === 0) {
      // Default: all off duty
      const y = rowCenter('off_duty');
      return `M ${hourToX(0)} ${y} L ${hourToX(24)} ${y}`;
    }

    // Sort & fill gaps with off_duty
    const sorted = [...events]
      .filter(e => e.end_hour > e.start_hour)
      .sort((a, b) => a.start_hour - b.start_hour);

    // Fill any gaps in the timeline with off_duty
    const filled = [];
    let cursor = 0;
    for (const evt of sorted) {
      if (evt.start_hour > cursor + 0.01) {
        filled.push({ type: 'off_duty', start_hour: cursor, end_hour: evt.start_hour });
      }
      filled.push(evt);
      cursor = evt.end_hour;
    }
    if (cursor < 23.99) {
      filled.push({ type: 'off_duty', start_hour: cursor, end_hour: 24 });
    }

    if (filled.length === 0) {
      const y = rowCenter('off_duty');
      return `M ${hourToX(0)} ${y} L ${hourToX(24)} ${y}`;
    }

    let d = '';
    filled.forEach((evt, i) => {
      const y = rowCenter(evt.type);
      const x1 = hourToX(evt.start_hour);
      const x2 = hourToX(evt.end_hour);

      if (i === 0) {
        d += `M ${x1} ${y}`;
      } else {
        // Vertical transition from previous row to this row
        d += ` L ${x1} ${y}`;
      }
      // Horizontal line for this event
      d += ` L ${x2} ${y}`;
    });

    return d;
  }, [events]);

  const formatHours = (val) => {
    const h = Math.floor(val);
    const m = Math.round((val - h) * 60);
    return `${h}:${m.toString().padStart(2, '0')}`;
  };

  const totalHours = Object.values(hours_summary).reduce((s, v) => s + v, 0);

  // Hour labels for the top
  const hourLabels = [];
  for (let h = 0; h <= 24; h++) {
    let text;
    if (h === 0 || h === 24) text = 'Mid-\nnight';
    else if (h === 12) text = 'Noon';
    else if (h <= 11) text = String(h);
    else text = String(h - 12);
    hourLabels.push({ h, text });
  }

  return (
    <div className="eld-sheet-wrapper animate-fade-in">
      {/* ── Document Header ── */}
      <div className="eld-doc-header">
        <div className="eld-title-block">
          <span className="eld-us-dot">U.S. DEPARTMENT OF TRANSPORTATION</span>
          <h2 className="eld-title">DRIVER'S DAILY LOG</h2>
          <span className="eld-subtitle">(ONE CALENDAR DAY — 24 HOURS)</span>
        </div>
        <div className="eld-copy-block">
          <span>ORIGINAL — Submit to carrier within 13 days</span>
          <span>DUPLICATE — Driver retains possession for eight days</span>
        </div>
      </div>

      {/* ── Metadata Fields ── */}
      <div className="eld-meta-row">
        <div className="eld-meta-field">
          <span className="eld-field-label">Date</span>
          <span className="eld-field-value">{date}</span>
        </div>
        <div className="eld-meta-field">
          <span className="eld-field-label">Total Miles Driving Today</span>
          <span className="eld-field-value">{Math.round(total_miles)}</span>
        </div>
        <div className="eld-meta-field">
          <span className="eld-field-label">Day</span>
          <span className="eld-field-value">{day_number}</span>
        </div>
      </div>
      <div className="eld-meta-row">
        <div className="eld-meta-field" style={{ flex: 2 }}>
          <span className="eld-field-label">Name of Carrier</span>
          <span className="eld-field-value">Spotter Logistics Inc.</span>
        </div>
        <div className="eld-meta-field" style={{ flex: 2 }}>
          <span className="eld-field-label">Main Office Address</span>
          <span className="eld-field-value">Houston, TX</span>
        </div>
        <div className="eld-meta-field">
          <span className="eld-field-label">Vehicle Numbers</span>
          <span className="eld-field-value">TRK-4821</span>
        </div>
      </div>

      {/* ── SVG Graph Grid ── */}
      <div className="eld-grid-container">
        <svg
          viewBox={`0 0 ${SVG_W} ${GRID_BOTTOM + 4}`}
          width="100%"
          preserveAspectRatio="xMidYMid meet"
          className="eld-svg"
        >
          {/* Hour labels at top */}
          {hourLabels.map(({ h, text }) => {
            const x = hourToX(h);
            const lines = text.split('\n');
            return (
              <g key={`hlabel-${h}`}>
                {lines.map((line, li) => (
                  <text
                    key={li}
                    x={x}
                    y={HOUR_LABEL_Y - (lines.length - 1 - li) * 11}
                    textAnchor="middle"
                    fontSize="9"
                    fontFamily="Inter, sans-serif"
                    fontWeight="600"
                    fill="#1e293b"
                  >
                    {line}
                  </text>
                ))}
              </g>
            );
          })}

          {/* Grid background */}
          <rect x={GRID_X} y={GRID_TOP} width={GRID_W} height={ROW_H * 4}
                fill="#fafbfc" stroke="#1e293b" strokeWidth="1.5" />

          {/* Row backgrounds (alternating) */}
          {ROWS.map((row, i) => (
            <rect key={`rowbg-${i}`} x={GRID_X} y={row.y} width={GRID_W} height={ROW_H}
                  fill={i % 2 === 0 ? '#f8fafc' : '#f1f5f9'} />
          ))}

          {/* Horizontal row separators */}
          {ROWS.map((row, i) => (
            <line key={`hsep-${i}`}
              x1={GRID_X} y1={row.y}
              x2={GRID_X + GRID_W} y2={row.y}
              stroke="#334155" strokeWidth={i === 0 ? "1.5" : "1"} />
          ))}
          <line x1={GRID_X} y1={GRID_BOTTOM} x2={GRID_X + GRID_W} y2={GRID_BOTTOM}
                stroke="#334155" strokeWidth="1.5" />

          {/* Vertical grid lines for each hour */}
          {Array.from({ length: 25 }).map((_, h) => {
            const x = hourToX(h);
            return (
              <line key={`vhr-${h}`}
                x1={x} y1={GRID_TOP} x2={x} y2={GRID_BOTTOM}
                stroke="#334155" strokeWidth={h === 0 || h === 24 ? "1.5" : "0.8"} />
            );
          })}

          {/* 15-minute tick marks */}
          {Array.from({ length: 24 * 4 }).map((_, i) => {
            if (i % 4 === 0) return null; // Skip full hours
            const x = GRID_X + (i / 4) * PX_PER_HR;
            const isHalf = i % 2 === 0;
            return (
              <g key={`tick-${i}`}>
                {ROWS.map((row, ri) => (
                  <line key={`tick-${i}-${ri}`}
                    x1={x} y1={row.y}
                    x2={x} y2={row.y + (isHalf ? 8 : 4)}
                    stroke="#94a3b8" strokeWidth="0.5" />
                ))}
                {ROWS.map((row, ri) => (
                  <line key={`tickb-${i}-${ri}`}
                    x1={x} y1={row.y + ROW_H}
                    x2={x} y2={row.y + ROW_H - (isHalf ? 8 : 4)}
                    stroke="#94a3b8" strokeWidth="0.5" />
                ))}
              </g>
            );
          })}

          {/* Row labels on the left */}
          {ROWS.map((row) => (
            <text key={`label-${row.key}`}
              x={GRID_X - 8}
              y={row.y + ROW_H / 2 + 4}
              textAnchor="end"
              fontSize="9.5"
              fontFamily="Inter, sans-serif"
              fontWeight="600"
              fill="#1e293b"
            >
              {row.label}
            </text>
          ))}

          {/* Totals column on the right */}
          {ROWS.map((row) => {
            const val = hours_summary[row.key] || 0;
            return (
              <text key={`total-${row.key}`}
                x={GRID_X + GRID_W + TOTALS_W / 2}
                y={row.y + ROW_H / 2 + 4}
                textAnchor="middle"
                fontSize="10"
                fontFamily="Inter, sans-serif"
                fontWeight="700"
                fill="#1e293b"
              >
                {formatHours(val)}
              </text>
            );
          })}

          {/* "Total Hours" header on right */}
          <text
            x={GRID_X + GRID_W + TOTALS_W / 2}
            y={GRID_TOP - 4}
            textAnchor="middle"
            fontSize="8"
            fontFamily="Inter, sans-serif"
            fontWeight="700"
            fill="#1e293b"
          >
            TOTAL
          </text>
          <text
            x={GRID_X + GRID_W + TOTALS_W / 2}
            y={GRID_TOP - 4 + 10}
            textAnchor="middle"
            fontSize="8"
            fontFamily="Inter, sans-serif"
            fontWeight="700"
            fill="#1e293b"
          >
            HOURS
          </text>

          {/* ── THE STATUS LINE (the main drawing) ── */}
          <path
            d={statusPath}
            stroke="#0f172a"
            strokeWidth="3"
            fill="none"
            strokeLinejoin="bevel"
            strokeLinecap="butt"
          />
        </svg>
      </div>

      {/* ── Totals Bar ── */}
      <div className="eld-totals-bar">
        <div className="eld-total-item">
          <span className="eld-total-label">Off Duty</span>
          <span className="eld-total-val">{formatHours(hours_summary.off_duty || 0)}</span>
        </div>
        <div className="eld-total-item">
          <span className="eld-total-label">Sleeper Berth</span>
          <span className="eld-total-val">{formatHours(hours_summary.sleeper_berth || 0)}</span>
        </div>
        <div className="eld-total-item">
          <span className="eld-total-label">Driving</span>
          <span className="eld-total-val eld-driving">{formatHours(hours_summary.driving || 0)}</span>
        </div>
        <div className="eld-total-item">
          <span className="eld-total-label">On Duty (Not Driving)</span>
          <span className="eld-total-val">{formatHours(hours_summary.on_duty_not_driving || 0)}</span>
        </div>
        <div className="eld-total-item eld-grand-total">
          <span className="eld-total-label">TOTAL</span>
          <span className="eld-total-val">{formatHours(totalHours)}</span>
        </div>
      </div>

      {/* ── Remarks Section ── */}
      <div className="eld-remarks">
        <h4 className="eld-remarks-title">REMARKS</h4>
        <div className="eld-remarks-note">
          Enter name of place you reported and where released from work and when and where each change of duty occurred.
        </div>
        {remarks.length > 0 ? (
          <table className="eld-remarks-table">
            <thead>
              <tr>
                <th style={{ width: '12%' }}>Time</th>
                <th style={{ width: '50%' }}>Location</th>
                <th style={{ width: '38%' }}>Status / Activity</th>
              </tr>
            </thead>
            <tbody>
              {remarks.map((r, i) => (
                <tr key={i}>
                  <td>{r.time}</td>
                  <td>{r.location}</td>
                  <td>{(r.status || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="eld-no-remarks">No remarks recorded for this day.</p>
        )}
      </div>

      {/* ── Certification ── */}
      <div className="eld-certification">
        <p>I certify that these entries are true and correct.</p>
        <div className="eld-sig-row">
          <div className="eld-sig-field">
            <span className="eld-sig-line"></span>
            <span className="eld-sig-label">Driver's Signature</span>
          </div>
          <div className="eld-sig-field">
            <span className="eld-sig-line"></span>
            <span className="eld-sig-label">Co-Driver</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EldLogSheet;
