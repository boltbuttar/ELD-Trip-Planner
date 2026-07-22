import React, { useMemo } from 'react';
import './EldLogSheet.css';

// ─── Grid layout constants ────────────────────────────────────────────────────
const LABEL_W   = 62;        // left row-label column
const TOTAL_W   = 56;        // right total-hours column
const GRID_W    = 756;       // 24-hour grid width (756 / 24 = 31.5 px/hr)
const PX_PER_HR = GRID_W / 24;
const ROW_H     = 42;        // height of each status row
const TICK_ROWS = 4;         // number of status rows
const LABEL_Y   = 18;        // y-position of top hour labels (baseline)
const GRID_TOP  = LABEL_Y + 4;   // grid starts just below labels
const GRID_BOT  = GRID_TOP + ROW_H * TICK_ROWS;
const SVG_W     = LABEL_W + GRID_W + TOTAL_W;
const SVG_H     = GRID_BOT + 28;  // room for bottom labels

// ─── FMCSA official row order ─────────────────────────────────────────────────
const ROWS = [
  { key: 'off_duty',            shortLabel: ['Off', 'Duty'] },
  { key: 'sleeper_berth',       shortLabel: ['Sleeper', 'Berth'] },
  { key: 'driving',             shortLabel: ['Driving'] },
  { key: 'on_duty_not_driving', shortLabel: ['On Duty', '(Not', 'Driving)'] },
];

// FMCSA official label format: skips "1", uses Noon for 12, 13-23 for afternoon
const HOUR_LABELS = [
  [0, 'Mid-\nnight'], [2, '2'], [3, '3'], [4, '4'], [5, '5'],
  [6, '6'], [7, '7'], [8, '8'], [9, '9'], [10, '10'], [11, '11'],
  [12, 'Noon'], [13, '13'], [14, '14'], [15, '15'], [16, '16'],
  [17, '17'], [18, '18'], [19, '19'], [20, '20'], [21, '21'],
  [22, '22'], [23, '23'], [24, 'Mid-\nnight']
];

// Colour fills for status rows (light, behind the blue step-line)
const ROW_FILLS = {
  off_duty:            '#f0f4f8',
  sleeper_berth:       '#dbeafe',
  driving:             '#fef9c3',
  on_duty_not_driving: '#dcfce7',
};

// ─── Pure helpers (no hooks) ──────────────────────────────────────────────────
const rowIdx    = (key) => ROWS.findIndex(r => r.key === key);
const rowY      = (key) => GRID_TOP + rowIdx(key) * ROW_H;
const rowCenterY = (key) => rowY(key) + ROW_H / 2;
const hx        = (h)   => LABEL_W + h * PX_PER_HR;

const normType = (t) =>
  ['pickup', 'dropoff', 'fueling', 'break', 'on_duty_not_driving'].includes(t)
    ? 'on_duty_not_driving'
    : ['sleeper_berth', 'driving'].includes(t) ? t : 'off_duty';

const fmtDecHrs = (v = 0) => {
  if (v === 0) return '0';
  const h = Math.floor(v);
  const m = Math.round((v - h) * 60);
  if (m === 0) return `${h}`;
  const dec = m === 30 ? '5' : (m / 60).toFixed(2).slice(1);
  return `${h}.${dec.replace('.', '')}`;
};

const timeToDecHr = (timeStr) => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) + (m || 0) / 60;
};

// ─── Component ────────────────────────────────────────────────────────────────
const EldLogSheet = ({ logData }) => {
  if (!logData) return null;

  const {
    day_number      = 1,
    date            = '',
    events          = [],
    total_miles     = 0,
    hours_summary   = { off_duty: 24, sleeper_berth: 0, driving: 0, on_duty_not_driving: 0 },
    remarks         = [],
    from_location   = '',
    to_location     = '',
  } = logData;

  // Parse date into month/day/year
  const [yyyy = '', mm = '', dd = ''] = date ? date.split('-') : [];
  const totalLoggedHrs = Object.values(hours_summary).reduce((s, v) => s + v, 0);

  // ─── Build timeline + step-function path ──────────────────────────────────
  const { filled, pathD } = useMemo(() => {
    const sorted = [...events]
      .filter(e =>
        typeof e.start_hour === 'number' &&
        typeof e.end_hour   === 'number' &&
        e.end_hour > e.start_hour
      )
      .sort((a, b) => a.start_hour - b.start_hour);

    const filled = [];
    let cursor = 0;

    for (const evt of sorted) {
      const s = Math.max(0, Math.min(24, evt.start_hour));
      const e = Math.max(0, Math.min(24, evt.end_hour));
      if (s > cursor + 0.005) {
        filled.push({ type: 'off_duty', start: cursor, end: s });
      }
      if (e > s) {
        filled.push({ type: normType(evt.type), start: s, end: e, desc: evt.description || '' });
      }
      cursor = Math.max(cursor, e);
    }
    if (cursor < 23.99) {
      filled.push({ type: 'off_duty', start: cursor, end: 24 });
    }
    if (filled.length === 0) {
      filled.push({ type: 'off_duty', start: 0, end: 24 });
    }

    // Build SVG path as a continuous step-function line
    let d = '';
    filled.forEach((seg, i) => {
      const cy = rowCenterY(seg.type);
      const x1 = hx(seg.start);
      const x2 = hx(seg.end);
      if (i === 0) {
        d += `M ${x1} ${cy}`;
      } else {
        // Vertical segment (transition between rows)
        d += ` L ${x1} ${cy}`;
      }
      // Horizontal segment across this status period
      d += ` L ${x2} ${cy}`;
    });

    return { filled, pathD: d };
  }, [events]);

  // ─── Render tick marks for a given row ────────────────────────────────────
  const renderTicks = (rowKey) => {
    const ry = rowY(rowKey);
    const marks = [];
    for (let q = 0; q <= 24 * 4; q++) {
      if (q % 4 === 0) continue; // full hours already handled by vertical grid lines
      const x = hx(q / 4);
      const isHalf = q % 2 === 0;
      const tickH  = isHalf ? 12 : 7;
      // top ticks
      marks.push(<line key={`t-${rowKey}-${q}-top`}
        x1={x} y1={ry} x2={x} y2={ry + tickH}
        stroke="#666" strokeWidth="0.5" />);
      // bottom ticks
      marks.push(<line key={`t-${rowKey}-${q}-bot`}
        x1={x} y1={ry + ROW_H} x2={x} y2={ry + ROW_H - tickH}
        stroke="#666" strokeWidth="0.5" />);
    }
    return marks;
  };

  return (
    <div className="eld-wrapper">
      <div className="eld-page">

        {/* ── Official Form Header ── */}
        <div className="eld-header-section">
          <div className="eld-hdr-top-row">
            <span className="eld-dot-label">U.S. DEPARTMENT OF TRANSPORTATION</span>
            <div className="eld-title-block">
              <span className="eld-form-title">DRIVER'S DAILY LOG</span>
              <span className="eld-form-subtitle">(ONE CALENDAR DAY — 24 HOURS)</span>
            </div>
            <div className="eld-copy-labels">
              <span>ORIGINAL — Submit to carrier within 13 days</span>
              <span>DUPLICATE — Driver retains possession for eight days</span>
            </div>
          </div>

          {/* Date / Miles / Vehicle row */}
          <div className="eld-date-miles-row">
            <div className="eld-date-cluster">
              <div className="eld-date-nums">
                <span className="eld-big-val">{mm}</span>
                <span className="eld-date-sep">/</span>
                <span className="eld-big-val">{dd}</span>
                <span className="eld-date-sep">/</span>
                <span className="eld-big-val">{yyyy}</span>
              </div>
              <div className="eld-date-sub-labels">
                <span>(MONTH)</span>
                <span style={{ marginLeft: '16px' }}>(DAY)</span>
                <span style={{ marginLeft: '16px' }}>(YEAR)</span>
              </div>
            </div>
            <div className="eld-miles-cluster">
              <span className="eld-big-val">{Math.round(total_miles)}</span>
              <span className="eld-field-sub">(TOTAL MILES DRIVING TODAY)</span>
            </div>
            <div className="eld-vehicle-cluster">
              <span className="eld-big-val eld-vehicle-num">TRK-4821</span>
              <span className="eld-field-sub">VEHICLE NUMBERS—(SHOW EACH UNIT)</span>
            </div>
          </div>

          {/* From / To */}
          <div className="eld-from-to-row">
            <div className="eld-from-block">
              <span className="eld-from-label">From:</span>
              <span className="eld-from-val">{from_location || '—'}</span>
            </div>
            <div className="eld-from-block">
              <span className="eld-from-label">To:</span>
              <span className="eld-from-val">{to_location || '—'}</span>
            </div>
          </div>

          {/* Certification line */}
          <div className="eld-cert-line">
            <em>I certify that these entries are true and correct</em>
          </div>

          {/* Carrier / Signature row */}
          <div className="eld-sig-row">
            <div className="eld-sig-block eld-border-bottom">
              <span className="eld-italic-field">Spotter Logistics Inc.</span>
              <span className="eld-field-sub">(NAME OF CARRIER OR CARRIERS)</span>
            </div>
            <div className="eld-sig-block eld-border-bottom">
              <span className="eld-italic-field">Driver Signature</span>
              <span className="eld-field-sub">(DRIVER'S SIGNATURE IN FULL)</span>
            </div>
          </div>

          {/* Main Office / Co-driver / Total Hours header */}
          <div className="eld-office-row">
            <div className="eld-sig-block eld-border-bottom">
              <span className="eld-italic-field" style={{ fontSize: '0.85rem' }}>Houston, TX</span>
              <span className="eld-field-sub">(MAIN OFFICE ADDRESS)</span>
            </div>
            <div className="eld-sig-block">
              <span style={{ letterSpacing: '4px' }}>—</span>
              <span className="eld-field-sub">(NAME OF CO-DRIVER)</span>
            </div>
            <div className="eld-total-hrs-col-hdr">
              TOTAL<br />HOURS
            </div>
          </div>
        </div>

        {/* ── GRAPH GRID (SVG) ── */}
        <div className="eld-grid-wrapper">
          <svg
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            width="100%"
            preserveAspectRatio="xMidYMid meet"
            className="eld-grid-svg"
          >
            {/* ── Top hour labels ── */}
            {HOUR_LABELS.map(([h, label]) => {
              const x = hx(h);
              const lines = label.split('\n');
              return lines.map((line, li) => (
                <text
                  key={`tl-${h}-${li}`}
                  x={x}
                  y={LABEL_Y - (lines.length - 1 - li) * 8}
                  textAnchor="middle"
                  fontSize="7"
                  fontFamily="Arial, Helvetica, sans-serif"
                  fontWeight={h === 0 || h === 12 || h === 24 ? '700' : '400'}
                  fill="#1a1a1a"
                >
                  {line}
                </text>
              ));
            })}

            {/* ── Grid outer border ── */}
            <rect
              x={LABEL_W} y={GRID_TOP}
              width={GRID_W} height={ROW_H * 4}
              fill="white" stroke="#1a1a1a" strokeWidth="1.5"
            />

            {/* ── Status filled rectangles (light tints) ── */}
            {filled.map((seg, i) => (
              <rect
                key={`fill-${i}`}
                x={hx(seg.start)}
                y={rowY(seg.type) + 1}
                width={hx(seg.end) - hx(seg.start)}
                height={ROW_H - 2}
                fill={ROW_FILLS[seg.type] || '#f5f5f5'}
                opacity="0.7"
              />
            ))}

            {/* ── Horizontal row dividers ── */}
            {ROWS.map((_, i) => (
              <line
                key={`hd-${i}`}
                x1={LABEL_W} y1={GRID_TOP + i * ROW_H}
                x2={LABEL_W + GRID_W} y2={GRID_TOP + i * ROW_H}
                stroke="#1a1a1a"
                strokeWidth={i === 0 ? 1.5 : 0.8}
              />
            ))}

            {/* ── Vertical hour lines ── */}
            {Array.from({ length: 25 }).map((_, h) => (
              <line
                key={`vl-${h}`}
                x1={hx(h)} y1={GRID_TOP}
                x2={hx(h)} y2={GRID_BOT}
                stroke="#1a1a1a"
                strokeWidth={h === 0 || h === 12 || h === 24 ? 1.5 : 0.5}
              />
            ))}

            {/* ── Ruler tick marks for each row ── */}
            {ROWS.map(r => renderTicks(r.key))}

            {/* ── Row labels (left side) ── */}
            {ROWS.map((row, ri) => {
              const cy = rowY(row.key) + ROW_H / 2;
              return row.shortLabel.map((line, li) => {
                const totalLines = row.shortLabel.length;
                const offsetY = (li - (totalLines - 1) / 2) * 9;
                return (
                  <text
                    key={`rl-${ri}-${li}`}
                    x={LABEL_W - 4}
                    y={cy + offsetY + 3}
                    textAnchor="end"
                    fontSize="8"
                    fontFamily="Arial, Helvetica, sans-serif"
                    fontWeight="700"
                    fill="#1a1a1a"
                  >
                    {line}
                  </text>
                );
              });
            })}

            {/* ── THE STEP-FUNCTION STATUS LINE ── */}
            <path
              d={pathD}
              fill="none"
              stroke="#1e40af"
              strokeWidth="2.8"
              strokeLinejoin="miter"
              strokeLinecap="square"
            />

            {/* ── Total hours per row (right column) ── */}
            {ROWS.map((row) => {
              const val = hours_summary[row.key] || 0;
              return (
                <text
                  key={`tot-${row.key}`}
                  x={LABEL_W + GRID_W + TOTAL_W / 2}
                  y={rowCenterY(row.key) + 4}
                  textAnchor="middle"
                  fontSize="12"
                  fontFamily="Arial, Helvetica, sans-serif"
                  fontWeight="900"
                  fill="#1a1a1a"
                >
                  {fmtDecHrs(val)}
                </text>
              );
            })}

            {/* ── Bottom hour labels ── */}
            {HOUR_LABELS.map(([h, label]) => {
              const x = hx(h);
              const lines = label.split('\n');
              return lines.map((line, li) => (
                <text
                  key={`bl-${h}-${li}`}
                  x={x}
                  y={GRID_BOT + 9 + li * 8}
                  textAnchor="middle"
                  fontSize="7"
                  fontFamily="Arial, Helvetica, sans-serif"
                  fontWeight={h === 0 || h === 12 || h === 24 ? '700' : '400'}
                  fill="#1a1a1a"
                >
                  {line}
                </text>
              ));
            })}

            {/* ── Total hours sum (bottom right) ── */}
            <text
              x={LABEL_W + GRID_W + TOTAL_W / 2}
              y={GRID_BOT + 14}
              textAnchor="middle"
              fontSize="11"
              fontFamily="Arial, Helvetica, sans-serif"
              fontWeight="900"
              fill="#1a1a1a"
            >
              ={Math.round(totalLoggedHrs)}
            </text>
          </svg>
        </div>

        {/* ── Remarks section ── */}
        <div className="eld-remarks-section">
          <div className="eld-remarks-ruler-row">
            <span className="eld-remarks-label">REMARKS</span>
            {/* Mini ruler SVG matching bottom of grid */}
            <svg viewBox={`0 0 ${GRID_W} 20`} width={`${(GRID_W / SVG_W) * 100}%`} className="eld-remarks-ruler-svg">
              <rect x={0} y={4} width={GRID_W} height={12} fill="white" stroke="#1a1a1a" strokeWidth="1" />
              {Array.from({ length: 24 * 4 + 1 }).map((_, q) => {
                const x = (q / 4) * PX_PER_HR;
                const isFull = q % 4 === 0;
                const isHalf = q % 2 === 0;
                const tickH = isFull ? 12 : isHalf ? 8 : 5;
                return (
                  <line key={`rr-${q}`}
                    x1={x} y1={4}
                    x2={x} y2={4 + tickH}
                    stroke="#555" strokeWidth={isFull ? 1 : 0.5}
                  />
                );
              })}
            </svg>
            <span className="eld-remarks-eq24">=24</span>
          </div>

          {/* Location remark entries — displayed vertically like official form */}
          {remarks.length > 0 && (
            <div className="eld-remarks-locs-row">
              {remarks.map((r, i) => (
                <div key={i} className="eld-remark-entry">
                  <div className="eld-remark-time">{r.time}</div>
                  <div className="eld-remark-loc-text">{r.location}</div>
                  <div className="eld-remark-status-tag">
                    {(r.status || '').replace(/_/g, ' ')}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="eld-remarks-instruction">
            Enter name of place you reported and where released from work and when and where each change of duty occurred.
            Use time standard of home terminal.
          </div>
        </div>

        {/* ── Shipping / Recap section ── */}
        <div className="eld-shipping-section">
          <div className="eld-shipping-row">
            <div className="eld-shipping-left">
              <span className="eld-shipping-title">Shipping Documents:</span>
              <div className="eld-shipping-field">
                <span className="eld-field-sub">DVL or Manifest No.</span>
                <div className="eld-field-line"></div>
              </div>
              <div className="eld-shipping-field">
                <span className="eld-field-sub">Shipper &amp; Commodity</span>
                <div className="eld-field-line"></div>
              </div>
            </div>
            <div className="eld-recap-block">
              <div className="eld-recap-title">Recap: 70 Hour / 8 Day Drivers</div>
              <table className="eld-recap-table">
                <tbody>
                  <tr>
                    <td>On duty hrs today (Lines 3 &amp; 4)</td>
                    <td className="eld-recap-val">
                      {fmtDecHrs((hours_summary.driving || 0) + (hours_summary.on_duty_not_driving || 0))}
                    </td>
                  </tr>
                  <tr>
                    <td>Total hrs on duty last 7 days</td>
                    <td className="eld-recap-val">—</td>
                  </tr>
                  <tr>
                    <td>Total hrs avail. tomorrow (70 hr minus A)</td>
                    <td className="eld-recap-val">—</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default EldLogSheet;
