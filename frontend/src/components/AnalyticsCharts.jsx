import { useState, useMemo, useId } from 'react';

export function formatPhpCompact(val) {
  const num = Number(val || 0);
  if (Math.abs(num) >= 1_000_000) return `₱${(num / 1_000_000).toFixed(2)}M`;
  if (Math.abs(num) >= 10_000) return `₱${Math.round(num / 1000)}k`;
  if (Math.abs(num) >= 1_000) return `₱${(num / 1000).toFixed(1)}k`;
  return `₱${Math.round(num).toLocaleString('en-US')}`;
}

/**
 * Fritsch-Carlson monotone cubic spline SVG path builder.
 * Strictly preserves monotonicity and never overshoots below the baseline.
 */
function buildMonotonePath(points, yKey, baselineY) {
  const n = points.length;
  if (n === 0) return '';
  if (n === 1) return `M ${points[0].x.toFixed(1)} ${points[0][yKey].toFixed(1)}`;
  if (n === 2) {
    return `M ${points[0].x.toFixed(1)} ${points[0][yKey].toFixed(1)} L ${points[1].x.toFixed(1)} ${points[1][yKey].toFixed(1)}`;
  }

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p[yKey]);
  const dxs = [];
  const ms = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = xs[i + 1] - xs[i] || 1;
    dxs.push(dx);
    ms.push((ys[i + 1] - ys[i]) / dx);
  }

  const tangents = new Array(n).fill(0);
  tangents[0] = ms[0];
  tangents[n - 1] = ms[n - 2];

  for (let i = 1; i < n - 1; i++) {
    if (ms[i - 1] * ms[i] <= 0) {
      tangents[i] = 0;
    } else {
      const w1 = 2 * dxs[i] + dxs[i - 1];
      const w2 = dxs[i] + 2 * dxs[i - 1];
      tangents[i] = (w1 + w2) / (w1 / ms[i - 1] + w2 / ms[i]);
    }
  }

  for (let i = 0; i < n - 1; i++) {
    if (Math.abs(ms[i]) < 1e-6) {
      tangents[i] = 0;
      tangents[i + 1] = 0;
    } else {
      const a = tangents[i] / ms[i];
      const b = tangents[i + 1] / ms[i];
      const h = Math.hypot(a, b);
      if (h > 3) {
        const s = 3 / h;
        tangents[i] = s * a * ms[i];
        tangents[i + 1] = s * b * ms[i];
      }
    }
  }

  const clampY = (y) => Math.min(baselineY, y);
  let d = `M ${xs[0].toFixed(1)} ${ys[0].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const dx3 = dxs[i] / 3;
    const cp1x = xs[i] + dx3;
    const cp1y = clampY(ys[i] + tangents[i] * dx3);
    const cp2x = xs[i + 1] - dx3;
    const cp2y = clampY(ys[i + 1] - tangents[i + 1] * dx3);
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${xs[i + 1].toFixed(1)} ${ys[i + 1].toFixed(1)}`;
  }
  return d;
}

export function VercelAreaLineChart({
  data = [],
  height = 240,
  seriesMode = 'combined', // 'combined' | 'split' | 'disbursed' | 'volume'
  onSeriesModeChange,
  showModeSwitch = true,
  animKey = '',
  title = '',
  emptyMessage = 'No contribution activity recorded in this window.'
}) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const [internalMode, setInternalMode] = useState(seriesMode);
  const activeMode = onSeriesModeChange ? seriesMode : internalMode;
  const setMode = onSeriesModeChange || setInternalMode;
  const uid = useId().replace(/:/g, '');
  const clipId = `vaReveal_${uid}`;
  const dataSig = data.length > 0 ? `${data.length}_${data[0]?.date}_${data[data.length - 1]?.date}` : 'empty';
  const revealKey = `${animKey}_${activeMode}_${dataSig}`;

  const w = 640;
  const h = height;
  const pad = { top: 14, right: 14, bottom: 26, left: 52 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;
  const baselineY = pad.top + plotH;

  const isCountAxis = activeMode === 'volume';

  const { maxY, ticksY, points } = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) {
      return { maxY: 1000, ticksY: [0, 500, 1000], points: [] };
    }
    let rawMax = 0;
    data.forEach((d) => {
      if (activeMode === 'volume') {
        rawMax = Math.max(rawMax, Number(d.txCount || 0));
      } else if (activeMode === 'disbursed') {
        rawMax = Math.max(rawMax, Number(d.disbursedPhp || 0), Number(d.totalPhp || 0) * 0.15);
      } else if (activeMode === 'split') {
        rawMax = Math.max(rawMax, Number(d.fiatPhp || 0), Number(d.cryptoPhp || 0));
      } else {
        rawMax = Math.max(rawMax, Number(d.totalPhp || 0), Number(d.disbursedPhp || 0));
      }
    });
    const niceMax = isCountAxis
      ? Math.max(4, Math.ceil(rawMax * 1.2))
      : (rawMax > 0 ? Math.ceil(rawMax * 1.12) : 1000);
    const ticks = [0, 0.33, 0.66, 1].map((p) => Math.round(niceMax * p));

    const pts = data.map((d, i) => {
      const x = data.length === 1
        ? pad.left + plotW / 2
        : pad.left + (i / (data.length - 1)) * plotW;
      const yTotal = pad.top + plotH - ((Number(d.totalPhp || 0) / niceMax) * plotH);
      const yDisb = pad.top + plotH - ((Number(d.disbursedPhp || 0) / niceMax) * plotH);
      const yFiat = pad.top + plotH - ((Number(d.fiatPhp || 0) / niceMax) * plotH);
      const yCrypto = pad.top + plotH - ((Number(d.cryptoPhp || 0) / niceMax) * plotH);
      const yTx = pad.top + plotH - ((Number(d.txCount || 0) / niceMax) * plotH);
      return { ...d, i, x, yTotal, yDisb, yFiat, yCrypto, yTx };
    });

    return { maxY: niceMax, ticksY: ticks, points: pts };
  }, [data, plotH, plotW, pad.left, pad.top, activeMode, isCountAxis]);

  const xLabelIndices = useMemo(() => {
    if (points.length <= 5) return points.map((_, i) => i);
    const step = Math.ceil((points.length - 1) / 4);
    const idxs = [];
    for (let i = 0; i < points.length; i += step) idxs.push(i);
    const last = points.length - 1;
    if (idxs[idxs.length - 1] !== last) {
      if (last - idxs[idxs.length - 1] < Math.max(2, Math.floor(step * 0.65))) {
        idxs[idxs.length - 1] = last;
      } else {
        idxs.push(last);
      }
    }
    return idxs;
  }, [points]);

  if (!data || data.length === 0) {
    return (
      <div className="va-empty-state" style={{ minHeight: `${height}px` }}>
        <span>{emptyMessage}</span>
      </div>
    );
  }

  const buildArea = (key) => {
    if (points.length < 2) return '';
    const line = buildMonotonePath(points, key, baselineY);
    const firstX = points[0].x.toFixed(1);
    const lastX = points[points.length - 1].x.toFixed(1);
    return `${line} L ${lastX} ${baselineY.toFixed(1)} L ${firstX} ${baselineY.toFixed(1)} Z`;
  };

  const activePt = hoverIdx !== null && points[hoverIdx] ? points[hoverIdx] : null;
  const hasAnyDisb = points.some((p) => Number(p.disbursedPhp || 0) > 0);

  return (
    <div className="va-chart-container">
      <div className="va-chart-toolbar">
        <div className="va-chart-title-group">
          {title && <h3 className="va-section-heading">{title}</h3>}
          <div className="va-legend-row">
            {activeMode === 'combined' && (
              <>
                <span className="va-legend-item">
                  <span className="va-legend-swatch va-swatch-blue" />
                  Inflow
                </span>
                {hasAnyDisb && (
                  <span className="va-legend-item">
                    <span className="va-legend-swatch va-swatch-emerald" />
                    Disbursed
                  </span>
                )}
              </>
            )}
            {activeMode === 'split' && (
              <>
                <span className="va-legend-item">
                  <span className="va-legend-swatch va-swatch-blue" />
                  Fiat
                </span>
                <span className="va-legend-item">
                  <span className="va-legend-swatch va-swatch-neutral" />
                  Sepolia ETH
                </span>
              </>
            )}
            {activeMode === 'disbursed' && (
              <span className="va-legend-item">
                <span className="va-legend-swatch va-swatch-emerald" />
                Direct Aid Disbursed
              </span>
            )}
            {activeMode === 'volume' && (
              <span className="va-legend-item">
                <span className="va-legend-swatch va-swatch-blue" />
                Verified Gifts / Day
              </span>
            )}
          </div>
        </div>

        {showModeSwitch && (
          <div className="va-segmented-mini" role="group" aria-label="Chart series mode">
            <button
              type="button"
              className={`va-seg-mini-btn ${activeMode === 'combined' ? 'active' : ''}`}
              onClick={() => setMode('combined')}
            >
              Inflow
            </button>
            <button
              type="button"
              className={`va-seg-mini-btn ${activeMode === 'split' ? 'active' : ''}`}
              onClick={() => setMode('split')}
            >
              Fiat vs Crypto
            </button>
            <button
              type="button"
              className={`va-seg-mini-btn ${activeMode === 'volume' ? 'active' : ''}`}
              onClick={() => setMode('volume')}
            >
              Tx Count
            </button>
          </div>
        )}
      </div>

      <div className="va-svg-stage" onMouseLeave={() => setHoverIdx(null)}>
        <svg viewBox={`0 0 ${w} ${h}`} className="va-line-svg" role="img" aria-label="Relief Funds Trend Chart">
          <defs>
            <linearGradient id="vaAreaBlue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--va-series-primary, #3291FF)" stopOpacity="0.20" />
              <stop offset="100%" stopColor="var(--va-series-primary, #3291FF)" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="vaAreaEmerald" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.20" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="vaAreaNeutral" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--va-series-mono, #a1a1aa)" stopOpacity="0.14" />
              <stop offset="100%" stopColor="var(--va-series-mono, #a1a1aa)" stopOpacity="0.0" />
            </linearGradient>
            <clipPath id={clipId}>
              <rect
                key={revealKey}
                x={pad.left - 4}
                y={0}
                width={plotW + pad.right + 8}
                height={h}
                className="va-chart-reveal-rect"
              />
            </clipPath>
          </defs>

          {/* Horizontal Hairlines & Y Ticks */}
          {ticksY.map((val, idx) => {
            const yPos = pad.top + plotH - ((val / (maxY || 1)) * plotH);
            return (
              <g key={idx}>
                <line
                  x1={pad.left}
                  x2={w - pad.right}
                  y1={yPos}
                  y2={yPos}
                  className={`va-grid-line ${idx === 0 ? 'va-grid-baseline' : ''}`}
                />
                <text x={pad.left - 10} y={yPos + 3.5} textAnchor="end" className="va-axis-tick">
                  {isCountAxis ? `${val} tx` : formatPhpCompact(val)}
                </text>
              </g>
            );
          })}

          {/* X Axis Ticks */}
          {xLabelIndices.map((idx) => {
            const pt = points[idx];
            if (!pt) return null;
            return (
              <text key={pt.date} x={pt.x} y={h - 5} textAnchor="middle" className="va-axis-tick">
                {pt.label}
              </text>
            );
          })}

          {/* Series Rendering (Smooth Sweep + Fade on 7D/30D/90D/All or Series Switch) */}
          <g key={revealKey} clipPath={`url(#${clipId})`} className="va-series-animated">
          {activeMode === 'combined' && (
            <>
              {points.length > 1 && <path d={buildArea('yTotal')} fill="url(#vaAreaBlue)" />}
              <path
                d={buildMonotonePath(points, 'yTotal', baselineY)}
                fill="none"
                stroke="var(--va-series-primary, #3291FF)"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {hasAnyDisb && (
                <>
                  {points.length > 1 && <path d={buildArea('yDisb')} fill="url(#vaAreaEmerald)" />}
                  <path
                    d={buildMonotonePath(points, 'yDisb', baselineY)}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                    strokeLinecap="round"
                  />
                </>
              )}
            </>
          )}

          {activeMode === 'split' && (
            <>
              {points.length > 1 && <path d={buildArea('yFiat')} fill="url(#vaAreaBlue)" />}
              <path
                d={buildMonotonePath(points, 'yFiat', baselineY)}
                fill="none"
                stroke="var(--va-series-primary, #3291FF)"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {points.length > 1 && <path d={buildArea('yCrypto')} fill="url(#vaAreaNeutral)" />}
              <path
                d={buildMonotonePath(points, 'yCrypto', baselineY)}
                fill="none"
                stroke="var(--va-series-mono, #a1a1aa)"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}

          {activeMode === 'disbursed' && (
            <>
              {points.length > 1 && <path d={buildArea('yDisb')} fill="url(#vaAreaEmerald)" />}
              <path
                d={buildMonotonePath(points, 'yDisb', baselineY)}
                fill="none"
                stroke="#10b981"
                strokeWidth="1.85"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}

          {activeMode === 'volume' && (
            <>
              {points.length > 1 && <path d={buildArea('yTx')} fill="url(#vaAreaBlue)" />}
              <path
                d={buildMonotonePath(points, 'yTx', baselineY)}
                fill="none"
                stroke="var(--va-series-primary, #3291FF)"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}
          </g>

          {/* Hover Crosshair & Active Ring */}
          {activePt && (
            <g>
              <line
                x1={activePt.x}
                x2={activePt.x}
                y1={pad.top}
                y2={baselineY}
                className="va-crosshair"
              />
              <circle
                cx={activePt.x}
                cy={
                  activeMode === 'volume' ? activePt.yTx
                    : activeMode === 'disbursed' ? activePt.yDisb
                      : activeMode === 'split' ? activePt.yFiat
                        : activePt.yTotal
                }
                r="4"
                fill="var(--va-surface, #0a0a0a)"
                stroke={activeMode === 'disbursed' ? '#10b981' : 'var(--va-series-primary, #3291FF)'}
                strokeWidth="2"
              />
              {activeMode === 'split' && (
                <circle
                  cx={activePt.x}
                  cy={activePt.yCrypto}
                  r="3.5"
                  fill="var(--va-surface, #0a0a0a)"
                  stroke="var(--va-series-mono, #a1a1aa)"
                  strokeWidth="2"
                />
              )}
            </g>
          )}

          {points.length === 1 && (
            <circle
              cx={points[0].x}
              cy={activeMode === 'volume' ? points[0].yTx : activeMode === 'disbursed' ? points[0].yDisb : points[0].yTotal}
              r="4.5"
              fill="var(--va-surface, #0a0a0a)"
              stroke="var(--va-series-primary, #3291FF)"
              strokeWidth="2"
            />
          )}

          {/* Interactive Columns */}
          {points.map((pt) => {
            const colW = points.length === 1 ? plotW : Math.max(14, plotW / points.length);
            const colX = points.length === 1 ? pad.left : pt.x - colW / 2;
            return (
              <rect
                key={pt.date}
                x={colX}
                y={pad.top}
                width={colW}
                height={plotH}
                fill="transparent"
                style={{ cursor: 'crosshair' }}
                onMouseEnter={() => setHoverIdx(pt.i)}
                onClick={() => setHoverIdx(pt.i)}
              />
            );
          })}
        </svg>

        {activePt && (
          <div
            className="va-tooltip"
            style={{
              left: `${Math.min(82, Math.max(18, (activePt.x / w) * 100))}%`
            }}
          >
            <div className="va-tooltip-date">{activePt.date}</div>
            {activeMode === 'split' ? (
              <>
                <div className="va-tooltip-row">
                  <span className="va-legend-swatch va-swatch-blue" />
                  <span>Fiat Rails</span>
                  <strong>₱{Number(activePt.fiatPhp || 0).toLocaleString('en-US')}</strong>
                </div>
                <div className="va-tooltip-row">
                  <span className="va-legend-swatch va-swatch-neutral" />
                  <span>Sepolia ETH</span>
                  <strong>₱{Number(activePt.cryptoPhp || 0).toLocaleString('en-US')}</strong>
                </div>
              </>
            ) : activeMode === 'disbursed' ? (
              <div className="va-tooltip-row">
                <span className="va-legend-swatch va-swatch-emerald" />
                <span>Disbursed</span>
                <strong>₱{Number(activePt.disbursedPhp || 0).toLocaleString('en-US')}</strong>
              </div>
            ) : activeMode === 'volume' ? (
              <div className="va-tooltip-row">
                <span className="va-legend-swatch va-swatch-blue" />
                <span>Verified Gifts</span>
                <strong>{activePt.txCount} tx</strong>
              </div>
            ) : (
              <>
                <div className="va-tooltip-row">
                  <span className="va-legend-swatch va-swatch-blue" />
                  <span>Inflow</span>
                  <strong>₱{Number(activePt.totalPhp || 0).toLocaleString('en-US')}</strong>
                </div>
                {activePt.disbursedPhp > 0 && (
                  <div className="va-tooltip-row">
                    <span className="va-legend-swatch va-swatch-emerald" />
                    <span>Disbursed</span>
                    <strong>₱{Number(activePt.disbursedPhp || 0).toLocaleString('en-US')}</strong>
                  </div>
                )}
              </>
            )}
            <div className="va-tooltip-foot">
              {activePt.txCount} gift{activePt.txCount === 1 ? '' : 's'} · {Number(activePt.ethAmount || 0).toFixed(4)} ETH
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const GEIST_DONUT_COLORS = [
  'var(--va-series-primary, #3291FF)',
  'var(--va-series-mono, #ededed)',
  '#10b981',
  '#71717a'
];

export function VercelDonutChart({
  items = [],
  centerLabel = 'Total',
  centerValue = '₱0',
  stacked = false,
  emptyMessage = 'No channel breakdown available yet.'
}) {
  const [hoveredKey, setHoveredKey] = useState(null);

  const nonZero = items.filter((it) => Number(it.value || 0) > 0);
  const totalVal = nonZero.reduce((s, it) => s + Number(it.value || 0), 0);

  if (totalVal <= 0 || nonZero.length === 0) {
    return (
      <div className="va-empty-state" style={{ minHeight: '190px' }}>
        <span>{emptyMessage}</span>
      </div>
    );
  }

  const size = stacked ? 142 : 156;
  const cx = size / 2;
  const cy = size / 2;
  const r = stacked ? 56 : 62;
  const circ = 2 * Math.PI * r;
  const gapPx = nonZero.length > 1 ? 2.5 : 0;

  let cumulative = 0;
  const slices = items.map((item, idx) => {
    const val = Number(item.value || 0);
    const pct = totalVal > 0 ? val / totalVal : 0;
    const rawLen = pct * circ;
    const dashLen = rawLen > gapPx ? rawLen - gapPx : rawLen;
    const dashOffset = -cumulative * circ;
    cumulative += pct;
    return {
      ...item,
      color: item.color || GEIST_DONUT_COLORS[idx % GEIST_DONUT_COLORS.length],
      pctNum: Number((pct * 100).toFixed(1)),
      dashLen,
      dashOffset
    };
  });

  const activeSlice = hoveredKey ? slices.find((s) => s.key === hoveredKey) : null;

  return (
    <div className={`va-donut-layout ${stacked ? 'is-stacked' : ''}`}>
      <div className="va-donut-ring" style={{ width: `${size}px`, height: `${size}px` }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={centerLabel}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--va-border-subtle, #1a1a1a)" strokeWidth="10" />
          <g transform={`rotate(-90 ${cx} ${cy})`}>
            {slices.map((s) => {
              if (s.value <= 0) return null;
              const isHover = hoveredKey === s.key;
              return (
                <circle
                  key={s.key}
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={isHover ? 12.5 : 10}
                  strokeDasharray={`${s.dashLen} ${circ}`}
                  strokeDashoffset={s.dashOffset}
                  style={{
                    cursor: 'pointer',
                    transition: 'stroke-dasharray 420ms cubic-bezier(0.16, 1, 0.3, 1), stroke-dashoffset 420ms cubic-bezier(0.16, 1, 0.3, 1), stroke-width 140ms ease, opacity 140ms ease',
                    opacity: hoveredKey && !isHover ? 0.28 : 1
                  }}
                  onMouseEnter={() => setHoveredKey(s.key)}
                  onMouseLeave={() => setHoveredKey(null)}
                />
              );
            })}
          </g>
        </svg>

        <div className="va-donut-center">
          <span className="va-donut-center-label">
            {activeSlice ? activeSlice.label : centerLabel}
          </span>
          <strong className="va-donut-center-val">
            {activeSlice ? `${activeSlice.pctNum}%` : centerValue}
          </strong>
          {activeSlice && (
            <span className="va-donut-center-sub">
              {formatPhpCompact(activeSlice.value)}
            </span>
          )}
        </div>
      </div>

      <div className="va-hairline-list">
        {slices.map((s) => (
          <div
            key={s.key}
            className={`va-donut-row ${hoveredKey === s.key ? 'is-active' : ''}`}
            onMouseEnter={() => setHoveredKey(s.key)}
            onMouseLeave={() => setHoveredKey(null)}
          >
            <div className="va-donut-row-left">
              <span className="va-legend-swatch" style={{ background: s.color }} />
              <div className="va-row-labels">
                <span className="va-row-title">{s.label}</span>
                {s.meta && <span className="va-row-sub">{s.meta}</span>}
              </div>
            </div>
            <div className="va-donut-row-right">
              <strong className="va-num">{s.displayValue || formatPhpCompact(s.value)}</strong>
              <span className="va-pct">{s.pctNum}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Authentic Vercel Analytics "List Bar" component
 * with subtle column header labels and subtle proportional row fills.
 */
export function VercelBarChart({
  items = [],
  maxItems = 6,
  leftColLabel = '',
  rightColLabel = '',
  emptyMessage = 'No records in this period.'
}) {
  const list = (items || []).slice(0, maxItems);
  const maxVal = Math.max(1, ...list.map((it) => Number(it.value || 0)));

  if (list.length === 0) {
    return (
      <div className="va-empty-state" style={{ minHeight: '165px' }}>
        <span>{emptyMessage}</span>
      </div>
    );
  }

  return (
    <div className="va-listbar-wrap">
      {(leftColLabel || rightColLabel) && (
        <div className="va-listbar-colhead">
          <span>{leftColLabel}</span>
          <span>{rightColLabel}</span>
        </div>
      )}
      {list.map((item, idx) => {
        const val = Number(item.value || 0);
        const widthPct = item.forcePct !== undefined
          ? Math.max(0, Math.min(100, Number(item.forcePct || 0)))
          : (val > 0 ? Math.max(2, Math.round((val / maxVal) * 100)) : 0);

        return (
          <div key={item.key || item.label || idx} className="va-listbar-row">
            <div
              className="va-listbar-fill"
              style={{ width: `${widthPct}%` }}
              aria-hidden="true"
            />
            <div className="va-listbar-content">
              <div className="va-listbar-left">
                <span className="va-row-title" title={item.label}>{item.label}</span>
                {item.sub && <span className="va-row-sub">{item.sub}</span>}
              </div>
              <div className="va-listbar-right">
                <strong className="va-num">{item.displayValue || `₱${Math.round(val).toLocaleString('en-US')}`}</strong>
                {item.badge && <span className="va-pct">{item.badge}</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function VercelFunnelMeter({ funnel }) {
  const { approved = 0, pending = 0, rejected = 0, total = 0, approvalRatePct = 100, avgAiConfidence = 0 } = funnel || {};
  const denom = Math.max(1, total);
  const appPct = (approved / denom) * 100;
  const pendPct = (pending / denom) * 100;
  const rejPct = (rejected / denom) * 100;

  return (
    <div className="va-funnel">
      <div className="va-funnel-kpis">
        <div className="va-funnel-kpi">
          <span>Approval Rate</span>
          <strong>{approvalRatePct}%</strong>
        </div>
        <div className="va-funnel-kpi">
          <span>Slips Audited</span>
          <strong>{total}</strong>
        </div>
        <div className="va-funnel-kpi">
          <span>Avg AI OCR</span>
          <strong>{avgAiConfidence > 0 ? `${avgAiConfidence}%` : '—'}</strong>
        </div>
      </div>

      <div className="va-funnel-track">
        {approved > 0 && <div className="va-funnel-seg seg-ok" style={{ width: `${appPct}%` }} title={`Approved: ${approved}`} />}
        {pending > 0 && <div className="va-funnel-seg seg-warn" style={{ width: `${pendPct}%` }} title={`Pending: ${pending}`} />}
        {rejected > 0 && <div className="va-funnel-seg seg-err" style={{ width: `${rejPct}%` }} title={`Rejected: ${rejected}`} />}
      </div>

      <div className="va-funnel-rows">
        <div className="va-funnel-row">
          <span className="va-funnel-stat"><span className="va-dot-sm ok" />Approved receipts</span>
          <strong className="va-num">{approved}</strong>
        </div>
        <div className="va-funnel-row">
          <span className="va-funnel-stat"><span className="va-dot-sm warn" />Pending verification</span>
          <strong className="va-num">{pending}</strong>
        </div>
        <div className="va-funnel-row">
          <span className="va-funnel-stat"><span className="va-dot-sm err" />Flagged / rejected</span>
          <strong className="va-num">{rejected}</strong>
        </div>
      </div>
    </div>
  );
}
