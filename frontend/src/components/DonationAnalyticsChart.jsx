import { useState, useMemo, useRef, useEffect } from 'react';

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

// Fritsch-Carlson monotone cubic Hermite spline -> strictly preserves monotonicity (ZERO below-zero overshoot!)
function buildMonotonePath(pts, baselineY) {
  const n = pts.length;
  if (n === 0) return '';
  if (n === 1) return `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;

  const dx = [];
  const dy = [];
  const slopes = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1].x - pts[i].x);
    dy.push(pts[i + 1].y - pts[i].y);
    slopes.push(dx[i] !== 0 ? dy[i] / dx[i] : 0);
  }

  const m = new Array(n).fill(0);
  m[0] = slopes[0];
  m[n - 1] = slopes[n - 2];

  for (let i = 1; i < n - 1; i++) {
    if (slopes[i - 1] * slopes[i] <= 0) {
      m[i] = 0;
    } else {
      m[i] = (slopes[i - 1] + slopes[i]) / 2;
    }
  }

  for (let i = 0; i < n - 1; i++) {
    if (Math.abs(slopes[i]) < 1e-6) {
      m[i] = 0;
      m[i + 1] = 0;
    } else {
      const a = m[i] / slopes[i];
      const b = m[i + 1] / slopes[i];
      const h = Math.hypot(a, b);
      if (h > 3) {
        const t = 3 / h;
        m[i] = t * a * slopes[i];
        m[i + 1] = t * b * slopes[i];
      }
    }
  }

  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
    const step = dx[i] / 3;
    const cp1x = pts[i].x + step;
    const cp1y = Math.min(baselineY, pts[i].y + m[i] * step);
    const cp2x = pts[i + 1].x - step;
    const cp2y = Math.min(baselineY, pts[i + 1].y - m[i + 1] * step);
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${pts[i + 1].x.toFixed(2)} ${pts[i + 1].y.toFixed(2)}`;
  }
  return d;
}

export default function DonationAnalyticsChart({ donations = [] }) {
  const [rangeId, setRangeId] = useState('30D');
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const stageRef = useRef(null);
  const [chartWidth, setChartWidth] = useState(560);

  // Measure actual container width so SVG renders at true 1:1 pixel aspect (no oval dots or stretched text!)
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = () => {
      const w = Math.floor(el.getBoundingClientRect().width);
      if (w > 120) setChartWidth(w);
    };
    update();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(update);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const rangeConfig = RANGES.find(r => r.id === rangeId) || RANGES[1];

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
    let ceil = 1000;
    if (rawMax > 0) {
      const mag = Math.pow(10, Math.floor(Math.log10(rawMax)));
      ceil = Math.ceil((rawMax * 1.22) / (mag / 2)) * (mag / 2);
    }

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

  // True 1:1 Pixel Coordinate System
  const W = chartWidth;
  const H = 148;
  const padL = 48;
  const padR = 16;
  const padT = 18;
  const padB = 24;
  const innerW = Math.max(80, W - padL - padR);
  const innerH = H - padT - padB;
  const baselineY = padT + innerH;

  const coords = points.map((pt, i) => {
    const x = padL + (points.length > 1 ? (i / (points.length - 1)) * innerW : innerW / 2);
    const ratio = maxVal > 0 ? Math.min(1, pt.totalPhp / maxVal) : 0;
    const y = baselineY - ratio * innerH;
    return { ...pt, x, y };
  });

  const linePath = buildMonotonePath(coords, baselineY);
  const areaPath = coords.length > 0
    ? `${linePath} L ${coords[coords.length - 1].x.toFixed(2)} ${baselineY.toFixed(2)} L ${coords[0].x.toFixed(2)} ${baselineY.toFixed(2)} Z`
    : '';

  const activeIdx = hoveredIdx !== null && coords[hoveredIdx] ? hoveredIdx : defaultActiveIdx;
  const activePt = coords[activeIdx] || null;

  const tooltipLeft = activePt ? Math.max(66, Math.min(W - 66, activePt.x)) : W / 2;
  const placeBelow = activePt ? activePt.y < 54 : false;
  const tooltipTop = activePt ? (placeBelow ? activePt.y + 14 : activePt.y - 12) : 20;

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
              <strong>₱{Math.round(periodTotal).toLocaleString('en-US')}</strong> · {periodCount} receipt{periodCount !== 1 ? 's' : ''} ({rangeId})
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

      <div className="da-chart-stage" ref={stageRef}>
        {activePt && (
          <div
            className={`da-tooltip ${placeBelow ? 'is-below' : ''}`}
            style={{ left: `${tooltipLeft}px`, top: `${tooltipTop}px` }}
          >
            <div className="da-tooltip-val">₱{Math.round(activePt.totalPhp).toLocaleString('en-US')}</div>
            <div className="da-tooltip-sub">
              {activePt.fullDate}
              {activePt.count > 0 ? ` · ${activePt.count} tx` : ''}
            </div>
          </div>
        )}

        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          className="da-svg"
          role="img"
          aria-label={`Donation analytics chart for ${rangeId}`}
        >
          <defs>
            <linearGradient id="daTealStroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#0d9488" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
            <linearGradient id="daTealArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.20" />
              <stop offset="100%" stopColor="#0d9488" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {[0, 0.5, 1].map((t, idx) => {
            const gy = baselineY - t * innerH;
            return (
              <g key={idx}>
                <line x1={padL} y1={gy} x2={W - padR} y2={gy} className="da-grid-line" />
                <text x={padL - 8} y={gy + 3.5} textAnchor="end" className="da-axis-lbl">
                  {formatCompactPhp(maxVal * t)}
                </text>
              </g>
            );
          })}

          {coords.map((pt, i) => (
            <g key={i}>
              <line x1={pt.x} y1={padT} x2={pt.x} y2={baselineY} className={`da-v-guide ${i === activeIdx ? 'is-active' : ''}`} />
              {(coords.length <= 7 || i % 2 === 0 || i === coords.length - 1) && (
                <text x={pt.x} y={H - 5} textAnchor="middle" className="da-axis-lbl">
                  {pt.shortLabel}
                </text>
              )}
            </g>
          ))}

          {areaPath && <path d={areaPath} fill="url(#daTealArea)" />}

          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke="url(#daTealStroke)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {coords.map((pt, i) => {
            const isActive = i === activeIdx;
            return (
              <g
                key={i}
                className="da-point-group"
                onMouseEnter={() => setHoveredIdx(i)}
                onClick={() => setHoveredIdx(i)}
              >
                {isActive && <circle cx={pt.x} cy={pt.y} r="8" fill="#10b981" fillOpacity="0.16" />}
                <circle cx={pt.x} cy={pt.y} r={isActive ? 4 : 2.5} className={`da-node ${isActive ? 'is-active' : ''}`} />
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
