import { useState, useMemo } from 'react';

const RANGES = [
  { id: '7D', label: '7D', days: 7, buckets: 7 },
  { id: '30D', label: '30D', days: 30, buckets: 6 },
  { id: '90D', label: '90D', days: 90, buckets: 6 },
  { id: '1Y', label: '1Y', days: 365, buckets: 12 }
];

function formatCompactPhp(val) {
  const n = Number(val) || 0;
  if (n <= 0) return '₱0';
  if (n >= 1_000_000) return `₱${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `₱${(n / 1_000).toFixed(n >= 10_000 || n % 1_000 === 0 ? 0 : 1)}k`;
  return `₱${Math.round(n)}`;
}

// Convert point array into a smooth SVG cubic bezier path (Catmull-Rom tension)
function buildSmoothPath(pts) {
  if (!pts.length) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

export default function DonationAnalyticsChart({ donations = [] }) {
  const [rangeId, setRangeId] = useState('7D');
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const rangeConfig = RANGES.find(r => r.id === rangeId) || RANGES[0];

  // Bucket real donations chronologically relative to latest donation or today
  const { points, maxVal, periodTotal, periodCount, defaultActiveIdx } = useMemo(() => {
    const list = Array.isArray(donations) ? donations : [];
    const parsed = list.map(d => {
      const ts = d.createdAt ? new Date(d.createdAt).getTime() : Date.now();
      const validTs = Number.isFinite(ts) ? ts : Date.now();
      const eth = parseFloat(d.amount || d.Amount || 0) || 0;
      const php = Number(d.phpAmount || d.amountPhp) || Math.round(eth * 170000);
      return { ts: validTs, php: Math.max(0, php) };
    });

    const latestDonationTs = parsed.length > 0 ? Math.max(...parsed.map(p => p.ts)) : Date.now();
    const anchorEnd = new Date(Math.max(Date.now(), latestDonationTs));
    anchorEnd.setHours(23, 59, 59, 999);
    const endMs = anchorEnd.getTime();
    const spanMs = rangeConfig.days * 86_400_000;
    const startMs = endMs - spanMs;
    const bucketMs = spanMs / rangeConfig.buckets;

    const buckets = Array.from({ length: rangeConfig.buckets }, (_, idx) => {
      const bStart = startMs + idx * bucketMs;
      const bEnd = bStart + bucketMs;
      const midDate = new Date(bEnd - 1000);
      const shortLabel = rangeConfig.id === '1Y'
        ? midDate.toLocaleDateString('en-US', { month: 'short' })
        : midDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const fullDate = rangeConfig.id === '1Y'
        ? midDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        : midDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      return { bStart, bEnd, shortLabel, fullDate, totalPhp: 0, count: 0 };
    });

    let pTotal = 0;
    let pCount = 0;

    for (const item of parsed) {
      if (item.ts >= startMs && item.ts <= endMs) {
        const rawIdx = Math.floor((item.ts - startMs) / bucketMs);
        const idx = Math.max(0, Math.min(buckets.length - 1, rawIdx));
        buckets[idx].totalPhp += item.php;
        buckets[idx].count += 1;
        pTotal += item.php;
        pCount += 1;
      }
    }

    const rawMax = Math.max(...buckets.map(b => b.totalPhp), 0);
    // Nice clean Y-axis ceiling
    let ceil = 1000;
    if (rawMax > 0) {
      const mag = Math.pow(10, Math.floor(Math.log10(rawMax)));
      ceil = Math.ceil((rawMax * 1.18) / (mag / 2)) * (mag / 2);
    }

    // Default active point = peak bucket (or last bucket if all zero)
    let peakIdx = buckets.length - 1;
    let peakVal = -1;
    buckets.forEach((b, i) => {
      if (b.totalPhp >= peakVal && b.totalPhp > 0) {
        peakVal = b.totalPhp;
        peakIdx = i;
      }
    });

    return {
      points: buckets,
      maxVal: ceil,
      periodTotal: pTotal,
      periodCount: pCount,
      defaultActiveIdx: peakIdx
    };
  }, [donations, rangeConfig]);

  // SVG Coordinate System
  const W = 760;
  const H = 196;
  const padL = 56;
  const padR = 20;
  const padT = 26;
  const padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const coords = points.map((pt, i) => {
    const x = padL + (points.length > 1 ? (i / (points.length - 1)) * innerW : innerW / 2);
    const ratio = maxVal > 0 ? Math.min(1, pt.totalPhp / maxVal) : 0;
    const y = padT + innerH - ratio * innerH;
    return { ...pt, x, y };
  });

  const linePath = buildSmoothPath(coords);
  const areaPath = coords.length > 0
    ? `${linePath} L ${coords[coords.length - 1].x.toFixed(2)} ${(padT + innerH).toFixed(2)} L ${coords[0].x.toFixed(2)} ${(padT + innerH).toFixed(2)} Z`
    : '';

  const activeIdx = hoveredIdx !== null && coords[hoveredIdx] ? hoveredIdx : defaultActiveIdx;
  const activePt = coords[activeIdx] || null;

  // Keep tooltip clamped horizontally within chart bounds
  const tooltipLeftPct = activePt ? Math.max(12, Math.min(88, (activePt.x / W) * 100)) : 50;
  const tooltipTopPct = activePt ? Math.max(8, ((activePt.y - 12) / H) * 100) : 20;

  return (
    <div className="da-card" onMouseLeave={() => setHoveredIdx(null)}>
      <div className="da-header">
        <div className="da-title-group">
          <span className="da-icon-box" aria-hidden="true">
            <span className="material-symbols-outlined">bar_chart</span>
          </span>
          <div className="da-title-meta">
            <h3 className="da-title">Donation Analytics</h3>
            <span className="da-period-summary">
              <strong>₱{Math.round(periodTotal).toLocaleString('en-US')}</strong> across {periodCount} receipt{periodCount !== 1 ? 's' : ''} ({rangeId})
            </span>
          </div>
        </div>

        <div className="da-range-group" role="tablist" aria-label="Analytics timeframe">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              role="tab"
              aria-selected={rangeId === r.id}
              className={`da-range-btn ${rangeId === r.id ? 'active' : ''}`}
              onClick={() => {
                setRangeId(r.id);
                setHoveredIdx(null);
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="da-chart-stage">
        {/* Floating Vercel Geist Tooltip */}
        {activePt && (
          <div
            className="da-tooltip"
            style={{
              left: `${tooltipLeftPct}%`,
              top: `${tooltipTopPct}%`
            }}
          >
            <div className="da-tooltip-val">₱{Math.round(activePt.totalPhp).toLocaleString('en-US')}</div>
            <div className="da-tooltip-sub">
              {activePt.fullDate}
              {activePt.count > 0 ? ` · ${activePt.count} receipt${activePt.count !== 1 ? 's' : ''}` : ''}
            </div>
          </div>
        )}

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="da-svg"
          preserveAspectRatio="none"
          role="img"
          aria-label={`Donation analytics chart for ${rangeId}`}
        >
          <defs>
            <linearGradient id="daTealStroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#0d9488" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
            <linearGradient id="daTealArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#0d9488" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Horizontal Hairline Grid + Y-Axis Labels */}
          {[0, 0.5, 1].map((t, idx) => {
            const gy = padT + innerH - t * innerH;
            const val = maxVal * t;
            return (
              <g key={idx}>
                <line
                  x1={padL}
                  y1={gy}
                  x2={W - padR}
                  y2={gy}
                  className="da-grid-line"
                />
                <text x={padL - 10} y={gy + 3.5} textAnchor="end" className="da-axis-lbl">
                  {formatCompactPhp(val)}
                </text>
              </g>
            );
          })}

          {/* Vertical Subtle Guides & X-Axis Labels */}
          {coords.map((pt, i) => (
            <g key={i}>
              <line
                x1={pt.x}
                y1={padT}
                x2={pt.x}
                y2={padT + innerH}
                className={`da-v-guide ${i === activeIdx ? 'is-active' : ''}`}
              />
              {(coords.length <= 7 || i % 2 === 0 || i === coords.length - 1) && (
                <text x={pt.x} y={H - 7} textAnchor="middle" className="da-axis-lbl">
                  {pt.shortLabel}
                </text>
              )}
            </g>
          ))}

          {/* Smooth Area Fill */}
          {areaPath && <path d={areaPath} fill="url(#daTealArea)" />}

          {/* Smooth Teal-Emerald Spline */}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke="url(#daTealStroke)"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Data Nodes + Interactive Hit Targets */}
          {coords.map((pt, i) => {
            const isActive = i === activeIdx;
            return (
              <g
                key={i}
                className="da-point-group"
                onMouseEnter={() => setHoveredIdx(i)}
                onClick={() => setHoveredIdx(i)}
              >
                {isActive && (
                  <circle cx={pt.x} cy={pt.y} r="9" fill="#10b981" fillOpacity="0.16" />
                )}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isActive ? 4.2 : 2.8}
                  className={`da-node ${isActive ? 'is-active' : ''}`}
                />
                {/* Wide invisible hit column for effortless hover */}
                <rect
                  x={pt.x - (innerW / Math.max(coords.length, 1)) / 2}
                  y={padT}
                  width={innerW / Math.max(coords.length, 1)}
                  height={innerH}
                  fill="transparent"
                />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
