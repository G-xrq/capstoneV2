import { useState, useMemo } from 'react';

const CHART_PALETTE = ['#10b981', '#38bdf8', '#a855f7', '#f59e0b', '#f43f5e', '#14b8a6', '#8b5cf6'];

export function formatPhpCompact(val) {
  const num = Number(val || 0);
  if (Math.abs(num) >= 1_000_000) return `₱${(num / 1_000_000).toFixed(2)}M`;
  if (Math.abs(num) >= 10_000) return `₱${Math.round(num / 1000)}k`;
  if (Math.abs(num) >= 1_000) return `₱${(num / 1000).toFixed(1)}k`;
  return `₱${Math.round(num).toLocaleString('en-US')}`;
}

export function VercelAreaLineChart({
  data = [],
  height = 240,
  showCryptoSplit = false,
  emptyMessage = 'No contribution trend recorded in this period.'
}) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const [seriesMode, setSeriesMode] = useState('combined'); // 'combined' | 'split'

  const w = 680;
  const h = height;
  const pad = { top: 18, right: 16, bottom: 32, left: 54 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  const { maxY, ticksY, points } = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) {
      return { maxY: 1000, ticksY: [0, 500, 1000], points: [] };
    }
    let rawMax = 0;
    data.forEach((d) => {
      rawMax = Math.max(
        rawMax,
        Number(d.totalPhp || 0),
        Number(d.disbursedPhp || 0),
        seriesMode === 'split' ? Math.max(Number(d.fiatPhp || 0), Number(d.cryptoPhp || 0)) : 0
      );
    });
    const niceMax = rawMax > 0 ? Math.ceil(rawMax * 1.15) : 1000;
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((p) => Math.round(niceMax * p));

    const pts = data.map((d, i) => {
      const x = data.length === 1
        ? pad.left + plotW / 2
        : pad.left + (i / (data.length - 1)) * plotW;
      const yTotal = pad.top + plotH - ((Number(d.totalPhp || 0) / niceMax) * plotH);
      const yDisb = pad.top + plotH - ((Number(d.disbursedPhp || 0) / niceMax) * plotH);
      const yFiat = pad.top + plotH - ((Number(d.fiatPhp || 0) / niceMax) * plotH);
      const yCrypto = pad.top + plotH - ((Number(d.cryptoPhp || 0) / niceMax) * plotH);
      return { ...d, i, x, yTotal, yDisb, yFiat, yCrypto };
    });

    return { maxY: niceMax, ticksY: ticks, points: pts };
  }, [data, plotH, plotW, pad.left, pad.top, seriesMode]);

  if (!data || data.length === 0) {
    return (
      <div className="analytics-chart-empty" style={{ minHeight: `${height}px` }}>
        <span className="material-symbols-outlined">show_chart</span>
        <span>{emptyMessage}</span>
      </div>
    );
  }

  const buildPath = (key) => {
    if (points.length === 0) return '';
    return points.map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt[key].toFixed(1)}`).join(' ');
  };

  const buildAreaPath = (key) => {
    if (points.length === 0) return '';
    const line = buildPath(key);
    const baselineY = (pad.top + plotH).toFixed(1);
    const firstX = points[0].x.toFixed(1);
    const lastX = points[points.length - 1].x.toFixed(1);
    return `${line} L ${lastX} ${baselineY} L ${firstX} ${baselineY} Z`;
  };

  const xLabelIndices = useMemo(() => {
    if (points.length <= 6) return points.map((_, i) => i);
    const step = Math.ceil((points.length - 1) / 5);
    const idxs = [];
    for (let i = 0; i < points.length; i += step) idxs.push(i);
    if (idxs[idxs.length - 1] !== points.length - 1) idxs.push(points.length - 1);
    return idxs;
  }, [points]);

  const activePt = hoverIdx !== null && points[hoverIdx] ? points[hoverIdx] : null;
  const hasAnyDisb = points.some((p) => p.disbursedPhp > 0);

  return (
    <div className="analytics-chart-wrap">
      {showCryptoSplit && (
        <div className="analytics-series-controls">
          <div className="analytics-legend-inline">
            {seriesMode === 'combined' ? (
              <>
                <span className="legend-chip">
                  <span className="legend-dot" style={{ background: '#10b981' }} />
                  Total Inflow
                </span>
                {hasAnyDisb && (
                  <span className="legend-chip">
                    <span className="legend-dot" style={{ background: '#38bdf8' }} />
                    Disbursed Aid
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="legend-chip">
                  <span className="legend-dot" style={{ background: '#38bdf8' }} />
                  Fiat (GCash / Maya / Bank)
                </span>
                <span className="legend-chip">
                  <span className="legend-dot" style={{ background: '#a855f7' }} />
                  On-Chain ETH
                </span>
              </>
            )}
          </div>

          <div className="vercel-pill-group">
            <button
              type="button"
              className={`vercel-pill-btn ${seriesMode === 'combined' ? 'active' : ''}`}
              onClick={() => setSeriesMode('combined')}
            >
              Inflow vs Disbursed
            </button>
            <button
              type="button"
              className={`vercel-pill-btn ${seriesMode === 'split' ? 'active' : ''}`}
              onClick={() => setSeriesMode('split')}
            >
              Fiat vs Crypto
            </button>
          </div>
        </div>
      )}

      <div className="analytics-svg-stage" onMouseLeave={() => setHoverIdx(null)}>
        <svg viewBox={`0 0 ${w} ${h}`} className="analytics-line-svg" role="img" aria-label="Relief Funds Trend Chart">
          <defs>
            <linearGradient id="bbdrtsAreaEmerald" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.01" />
            </linearGradient>
            <linearGradient id="bbdrtsAreaSky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.01" />
            </linearGradient>
            <linearGradient id="bbdrtsAreaPurple" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a855f7" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#a855f7" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Y Gridlines & Labels */}
          {ticksY.map((val, idx) => {
            const yPos = pad.top + plotH - ((val / (maxY || 1)) * plotH);
            return (
              <g key={idx}>
                <line
                  x1={pad.left}
                  x2={w - pad.right}
                  y1={yPos}
                  y2={yPos}
                  className="analytics-grid-line"
                />
                <text x={pad.left - 8} y={yPos + 3.5} textAnchor="end" className="analytics-axis-label">
                  {formatPhpCompact(val)}
                </text>
              </g>
            );
          })}

          {/* X Axis Labels */}
          {xLabelIndices.map((idx) => {
            const pt = points[idx];
            if (!pt) return null;
            return (
              <text key={pt.date} x={pt.x} y={h - 8} textAnchor="middle" className="analytics-axis-label">
                {pt.label}
              </text>
            );
          })}

          {/* Paths */}
          {seriesMode === 'combined' ? (
            <>
              {points.length > 1 && <path d={buildAreaPath('yTotal')} fill="url(#bbdrtsAreaEmerald)" />}
              <path d={buildPath('yTotal')} fill="none" stroke="#10b981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              {hasAnyDisb && (
                <>
                  {points.length > 1 && <path d={buildAreaPath('yDisb')} fill="url(#bbdrtsAreaSky)" />}
                  <path d={buildPath('yDisb')} fill="none" stroke="#38bdf8" strokeWidth="1.8" strokeDasharray="4 3" strokeLinecap="round" />
                </>
              )}
            </>
          ) : (
            <>
              {points.length > 1 && <path d={buildAreaPath('yFiat')} fill="url(#bbdrtsAreaSky)" />}
              <path d={buildPath('yFiat')} fill="none" stroke="#38bdf8" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
              {points.length > 1 && <path d={buildAreaPath('yCrypto')} fill="url(#bbdrtsAreaPurple)" />}
              <path d={buildPath('yCrypto')} fill="none" stroke="#a855f7" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
            </>
          )}

          {/* Hover Vertical Crosshair + Active Nodes */}
          {activePt && (
            <line
              x1={activePt.x}
              x2={activePt.x}
              y1={pad.top}
              y2={pad.top + plotH}
              className="analytics-crosshair-line"
            />
          )}

          {points.map((pt) => {
            const isActive = hoverIdx === pt.i;
            const showDot = points.length <= 16 || pt.totalPhp > 0 || isActive;
            const yMain = seriesMode === 'combined' ? pt.yTotal : pt.yFiat;
            const colMain = seriesMode === 'combined' ? '#10b981' : '#38bdf8';
            return (
              <g key={pt.date}>
                {showDot && (
                  <circle
                    cx={pt.x}
                    cy={yMain}
                    r={isActive ? 5 : points.length === 1 ? 5 : 2.8}
                    fill={colMain}
                    stroke="var(--bg-card, #0a0a0a)"
                    strokeWidth="1.8"
                  />
                )}
                {seriesMode === 'split' && (pt.cryptoPhp > 0 || isActive) && (
                  <circle
                    cx={pt.x}
                    cy={pt.yCrypto}
                    r={isActive ? 4.5 : 2.6}
                    fill="#a855f7"
                    stroke="var(--bg-card, #0a0a0a)"
                    strokeWidth="1.5"
                  />
                )}
                <rect
                  x={points.length === 1 ? pad.left : pt.x - Math.max(10, plotW / (points.length * 2))}
                  y={pad.top}
                  width={points.length === 1 ? plotW : Math.max(20, plotW / points.length)}
                  height={plotH}
                  fill="transparent"
                  style={{ cursor: 'crosshair' }}
                  onMouseEnter={() => setHoverIdx(pt.i)}
                  onClick={() => setHoverIdx(pt.i)}
                />
              </g>
            );
          })}
        </svg>

        {activePt && (
          <div
            className="analytics-tooltip"
            style={{
              left: `${Math.min(82, Math.max(18, (activePt.x / w) * 100))}%`
            }}
          >
            <div className="analytics-tooltip-date">{activePt.date}</div>
            {seriesMode === 'combined' ? (
              <>
                <div className="analytics-tooltip-row">
                  <span className="dot" style={{ background: '#10b981' }} />
                  <span>Inflow:</span>
                  <strong>₱{Number(activePt.totalPhp || 0).toLocaleString('en-US')}</strong>
                </div>
                {activePt.disbursedPhp > 0 && (
                  <div className="analytics-tooltip-row">
                    <span className="dot" style={{ background: '#38bdf8' }} />
                    <span>Disbursed:</span>
                    <strong>₱{Number(activePt.disbursedPhp || 0).toLocaleString('en-US')}</strong>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="analytics-tooltip-row">
                  <span className="dot" style={{ background: '#38bdf8' }} />
                  <span>Fiat Rails:</span>
                  <strong>₱{Number(activePt.fiatPhp || 0).toLocaleString('en-US')}</strong>
                </div>
                <div className="analytics-tooltip-row">
                  <span className="dot" style={{ background: '#a855f7' }} />
                  <span>Sepolia ETH:</span>
                  <strong>₱{Number(activePt.cryptoPhp || 0).toLocaleString('en-US')}</strong>
                </div>
              </>
            )}
            <div className="analytics-tooltip-meta">
              {activePt.txCount} verified gift{activePt.txCount === 1 ? '' : 's'} · {Number(activePt.ethAmount || 0).toFixed(4)} ETH
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function VercelDonutChart({
  items = [],
  centerLabel = 'Total Volume',
  centerValue = '₱0',
  emptyMessage = 'No channel breakdown available yet.'
}) {
  const [hoveredKey, setHoveredKey] = useState(null);

  const nonZero = items.filter((it) => Number(it.value || 0) > 0);
  const totalVal = nonZero.reduce((s, it) => s + Number(it.value || 0), 0);

  if (totalVal <= 0 || nonZero.length === 0) {
    return (
      <div className="analytics-chart-empty" style={{ minHeight: '210px' }}>
        <span className="material-symbols-outlined">pie_chart</span>
        <span>{emptyMessage}</span>
      </div>
    );
  }

  const size = 168;
  const cx = size / 2;
  const cy = size / 2;
  const r = 60;
  const circ = 2 * Math.PI * r;

  let cumulative = 0;
  const slices = items.map((item, idx) => {
    const val = Number(item.value || 0);
    const pct = totalVal > 0 ? val / totalVal : 0;
    const dashLen = pct * circ;
    const dashOffset = -cumulative * circ;
    cumulative += pct;
    return {
      ...item,
      color: item.color || CHART_PALETTE[idx % CHART_PALETTE.length],
      pctNum: Number((pct * 100).toFixed(1)),
      dashLen,
      dashOffset
    };
  });

  const activeSlice = hoveredKey ? slices.find((s) => s.key === hoveredKey) : null;

  return (
    <div className="analytics-donut-layout">
      <div className="analytics-donut-ring-wrap">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="analytics-donut-svg" role="img" aria-label={centerLabel}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border, #262626)" strokeWidth="18" />
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
                  strokeWidth={isHover ? 22 : 18}
                  strokeDasharray={`${s.dashLen} ${circ}`}
                  strokeDashoffset={s.dashOffset}
                  style={{
                    cursor: 'pointer',
                    transition: 'stroke-width 150ms ease, opacity 150ms ease',
                    opacity: hoveredKey && !isHover ? 0.38 : 1
                  }}
                  onMouseEnter={() => setHoveredKey(s.key)}
                  onMouseLeave={() => setHoveredKey(null)}
                />
              );
            })}
          </g>
        </svg>

        <div className="analytics-donut-center">
          <span className="analytics-donut-center-label">
            {activeSlice ? activeSlice.label : centerLabel}
          </span>
          <strong className="analytics-donut-center-val">
            {activeSlice ? `${activeSlice.pctNum}%` : centerValue}
          </strong>
          {activeSlice && (
            <span className="analytics-donut-center-sub">
              ₱{Number(activeSlice.value || 0).toLocaleString('en-US')}
            </span>
          )}
        </div>
      </div>

      <div className="analytics-donut-legend">
        {slices.map((s) => (
          <div
            key={s.key}
            className={`analytics-donut-legend-row ${hoveredKey === s.key ? 'is-active' : ''}`}
            onMouseEnter={() => setHoveredKey(s.key)}
            onMouseLeave={() => setHoveredKey(null)}
          >
            <div className="analytics-legend-left">
              <span className="legend-dot" style={{ background: s.color }} />
              <div className="analytics-legend-labels">
                <span className="analytics-legend-name">{s.label}</span>
                {s.meta && <span className="analytics-legend-meta">{s.meta}</span>}
              </div>
            </div>
            <div className="analytics-legend-right">
              <strong className="analytics-legend-amt">{s.displayValue || formatPhpCompact(s.value)}</strong>
              <span className="analytics-legend-pct">{s.pctNum}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function VercelBarChart({
  items = [],
  maxItems = 7,
  defaultColor = '#10b981',
  emptyMessage = 'No categorical records yet.'
}) {
  const list = (items || []).slice(0, maxItems);
  const maxVal = Math.max(1, ...list.map((it) => Number(it.value || 0)));

  if (list.length === 0) {
    return (
      <div className="analytics-chart-empty" style={{ minHeight: '180px' }}>
        <span className="material-symbols-outlined">bar_chart</span>
        <span>{emptyMessage}</span>
      </div>
    );
  }

  return (
    <div className="analytics-bar-list">
      {list.map((item, idx) => {
        const val = Number(item.value || 0);
        const widthPct = item.forcePct !== undefined
          ? Math.max(0, Math.min(100, Number(item.forcePct || 0)))
          : (val > 0 ? Math.max(4, Math.round((val / maxVal) * 100)) : 0);
        const barColor = item.color || CHART_PALETTE[idx % CHART_PALETTE.length] || defaultColor;
        return (
          <div key={item.key || item.label || idx} className="analytics-bar-item">
            <div className="analytics-bar-head">
              <div className="analytics-bar-label-wrap">
                <span className="analytics-bar-label" title={item.label}>{item.label}</span>
                {item.sub && <span className="analytics-bar-sub">{item.sub}</span>}
              </div>
              <div className="analytics-bar-values">
                <strong>{item.displayValue || `₱${Math.round(val).toLocaleString('en-US')}`}</strong>
                {item.badge && <span className="analytics-bar-badge">{item.badge}</span>}
              </div>
            </div>
            <div className="analytics-bar-track">
              <div
                className="analytics-bar-fill"
                style={{ width: `${widthPct}%`, background: barColor }}
              />
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
    <div className="analytics-funnel-wrap">
      <div className="analytics-funnel-bar">
        {approved > 0 && <div className="funnel-seg seg-approved" style={{ width: `${appPct}%` }} title={`Approved: ${approved}`} />}
        {pending > 0 && <div className="funnel-seg seg-pending" style={{ width: `${pendPct}%` }} title={`Pending: ${pending}`} />}
        {rejected > 0 && <div className="funnel-seg seg-rejected" style={{ width: `${rejPct}%` }} title={`Rejected: ${rejected}`} />}
      </div>

      <div className="analytics-funnel-stats">
        <div className="funnel-stat-item">
          <span className="legend-dot" style={{ background: '#10b981' }} />
          <span>Approved</span>
          <strong>{approved}</strong>
        </div>
        <div className="funnel-stat-item">
          <span className="legend-dot" style={{ background: '#f59e0b' }} />
          <span>Pending</span>
          <strong>{pending}</strong>
        </div>
        <div className="funnel-stat-item">
          <span className="legend-dot" style={{ background: '#f43f5e' }} />
          <span>Rejected</span>
          <strong>{rejected}</strong>
        </div>
        <div className="funnel-stat-item" style={{ marginLeft: 'auto' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#38bdf8' }}>smart_toy</span>
          <span>Avg AI OCR</span>
          <strong>{avgAiConfidence > 0 ? `${avgAiConfidence}%` : 'N/A'}</strong>
        </div>
      </div>

      <div className="analytics-funnel-footnote">
        Verification Approval Rate: <strong>{approvalRatePct}%</strong> across {total} submitted manual payment slip{total === 1 ? '' : 's'}.
      </div>
    </div>
  );
}
