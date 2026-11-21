import { useState, useMemo, useRef, useEffect } from 'react';

const RANGES = [
  { id: 'TODAY', label: 'Today', days: 1, buckets: 8 },
  { id: 'WEEK', label: 'Week', days: 7, buckets: 7 },
  { id: 'MONTH', label: 'Month', days: 30, buckets: 10 },
  { id: 'YEAR', label: 'Year', days: 365, buckets: 12 }
];

const SAMPLES = 48; // Fixed sample resolution for seamless continuous morphing across any bucket count

function formatCompactPhp(val) {
  const n = Number(val) || 0;
  if (n <= 0) return '₱0';
  if (n >= 1_000_000) return `₱${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `₱${(n / 1_000).toFixed(n >= 10_000 || n % 1_000 === 0 ? 0 : 1)}k`;
  return `₱${Math.round(n)}`;
}

// Compute Fritsch-Carlson monotone Hermite tangents for a discrete set of (x, y) points
function computeMonotoneTangents(pts) {
  const n = pts.length;
  if (n < 2) return new Array(n).fill(0);

  const dx = [];
  const slopes = [];
  for (let i = 0; i < n - 1; i++) {
    const dxi = pts[i + 1].x - pts[i].x;
    dx.push(dxi);
    slopes.push(dxi !== 0 ? (pts[i + 1].y - pts[i].y) / dxi : 0);
  }

  const m = new Array(n).fill(0);
  m[0] = slopes[0];
  m[n - 1] = slopes[n - 2];

  for (let i = 1; i < n - 1; i++) {
    m[i] = slopes[i - 1] * slopes[i] <= 0 ? 0 : (slopes[i - 1] + slopes[i]) / 2;
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
  return m;
}

// Sample a monotone Hermite curve defined on normalized [0, 1] x-domain at `sampleCount` evenly spaced points
function sampleMonotoneY(normalizedValues, sampleCount) {
  const n = normalizedValues.length;
  if (n === 0) return new Array(sampleCount).fill(0);
  if (n === 1) return new Array(sampleCount).fill(normalizedValues[0]);

  const pts = normalizedValues.map((val, i) => ({
    x: i / (n - 1),
    y: Math.max(0, Math.min(1, val))
  }));
  const m = computeMonotoneTangents(pts);

  const out = new Array(sampleCount);
  for (let s = 0; s < sampleCount; s++) {
    const u = s / (sampleCount - 1);
    const seg = Math.min(n - 2, Math.floor(u * (n - 1)));
    const p0 = pts[seg];
    const p1 = pts[seg + 1];
    const h = p1.x - p0.x || 1;
    const t = Math.max(0, Math.min(1, (u - p0.x) / h));
    const t2 = t * t;
    const t3 = t2 * t;

    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;

    const val = h00 * p0.y + h10 * h * m[seg] + h01 * p1.y + h11 * h * m[seg + 1];
    out[s] = Math.max(0, Math.min(1, val));
  }
  return out;
}

// Build smooth SVG path from dense resampled normalized values [0..1]
function buildPathFromSamples(normSamples, padL, innerW, baselineY, innerH) {
  const n = normSamples.length;
  if (n === 0) return '';
  const pts = normSamples.map((v, i) => ({
    x: padL + (i / (n - 1)) * innerW,
    y: baselineY - Math.max(0, Math.min(1, v)) * innerH
  }));

  const m = computeMonotoneTangents(pts);
  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
    const step = (pts[i + 1].x - pts[i].x) / 3;
    const cp1x = pts[i].x + step;
    const cp1y = Math.min(baselineY, pts[i].y + m[i] * step);
    const cp2x = pts[i + 1].x - step;
    const cp2y = Math.min(baselineY, pts[i + 1].y - m[i + 1] * step);
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${pts[i + 1].x.toFixed(2)} ${pts[i + 1].y.toFixed(2)}`;
  }
  return d;
}

// Read live interpolated normalized Y at any normalized X position u ∈ [0, 1]
function sampleAtU(normSamples, u) {
  const n = normSamples.length;
  if (n === 0) return 0;
  const pos = Math.max(0, Math.min(1, u)) * (n - 1);
  const i0 = Math.floor(pos);
  const i1 = Math.min(n - 1, i0 + 1);
  const frac = pos - i0;
  return normSamples[i0] * (1 - frac) + normSamples[i1] * frac;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

export default function DonationAnalyticsChart({ donations = [] }) {
  const [rangeId, setRangeId] = useState('MONTH');
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [transitionDir, setTransitionDir] = useState(1); // +1 forward (right entry), -1 backward (left entry)
  const stageRef = useRef(null);
  const [chartWidth, setChartWidth] = useState(560);

  // Measure container width for 1:1 non-distorted SVG rendering
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

  const rangeIndex = Math.max(0, RANGES.findIndex(r => r.id === rangeId));
  const rangeConfig = RANGES[rangeIndex] || RANGES[2];

  const handleSelectRange = (nextId) => {
    if (nextId === rangeId) return;
    const nextIdx = RANGES.findIndex(r => r.id === nextId);
    setTransitionDir(nextIdx >= rangeIndex ? 1 : -1);
    setHoveredIdx(null);
    setRangeId(nextId);
  };

  // Compute bucketed real data for the selected timeframe
  const targetData = useMemo(() => {
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
    if (rangeConfig.id !== 'TODAY') {
      anchorEnd.setHours(23, 59, 59, 999);
    }
    const endMs = anchorEnd.getTime();
    const spanMs = rangeConfig.days * 86_400_000;
    const startMs = endMs - spanMs;
    const bucketMs = spanMs / rangeConfig.buckets;

    const buckets = Array.from({ length: rangeConfig.buckets }, (_, idx) => {
      const bStart = startMs + idx * bucketMs;
      const bEnd = bStart + bucketMs;
      const midDate = new Date(bEnd - 1000);
      let shortLabel;
      let fullDate;

      if (rangeConfig.id === 'TODAY') {
        shortLabel = midDate.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }).replace(' ', '');
        fullDate = midDate.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
      } else if (rangeConfig.id === 'YEAR') {
        shortLabel = midDate.toLocaleDateString('en-US', { month: 'short' });
        fullDate = midDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      } else {
        shortLabel = midDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        fullDate = midDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }

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

    const normDiscrete = buckets.map(b => (ceil > 0 ? Math.min(1, b.totalPhp / ceil) : 0));
    const denseSamples = sampleMonotoneY(normDiscrete, SAMPLES);

    return {
      points: buckets,
      maxVal: ceil,
      periodTotal: pTotal,
      periodCount: pCount,
      defaultActiveIdx: peakIdx,
      denseSamples
    };
  }, [donations, rangeConfig]);

  // Continuous direction-aware animation state
  const [animState, setAnimState] = useState(() => ({
    samples: targetData.denseSamples,
    maxVal: targetData.maxVal,
    periodTotal: targetData.periodTotal,
    progress: 1
  }));

  const currentRef = useRef(animState);
  currentRef.current = animState;
  const rafRef = useRef(null);

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ||
        document.documentElement.getAttribute('data-reduced-motion') === 'true');

    if (prefersReduced) {
      setAnimState({
        samples: targetData.denseSamples,
        maxVal: targetData.maxVal,
        periodTotal: targetData.periodTotal,
        progress: 1
      });
      return;
    }

    const fromSamples = currentRef.current.samples?.length === SAMPLES
      ? [...currentRef.current.samples]
      : new Array(SAMPLES).fill(0);
    const toSamples = targetData.denseSamples;
    const fromMax = currentRef.current.maxVal || targetData.maxVal;
    const toMax = targetData.maxVal;
    const fromTotal = currentRef.current.periodTotal || 0;
    const toTotal = targetData.periodTotal;
    const dir = transitionDir;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const duration = 520; // Silky fluid morph duration
    const waveSpread = 0.34; // Staggered directional wave sweep across the curve
    const startTime = performance.now();

    const tick = (now) => {
      const rawT = Math.min(1, (now - startTime) / duration);
      const globalEase = easeOutCubic(rawT);

      const nextSamples = new Array(SAMPLES);
      for (let i = 0; i < SAMPLES; i++) {
        const u = i / (SAMPLES - 1);
        // Forward (+1): new trend progressively enters from RIGHT (u=1 leads, sweeping to u=0)
        // Backward (-1): new trend progressively enters from LEFT (u=0 leads, sweeping to u=1)
        const delay = dir > 0 ? (1 - u) * waveSpread : u * waveSpread;
        const localRaw = Math.max(0, Math.min(1, (rawT - delay) / (1 - waveSpread)));
        const localEase = easeOutCubic(localRaw);
        nextSamples[i] = fromSamples[i] + (toSamples[i] - fromSamples[i]) * localEase;
      }

      setAnimState({
        samples: nextSamples,
        maxVal: fromMax + (toMax - fromMax) * globalEase,
        periodTotal: fromTotal + (toTotal - fromTotal) * globalEase,
        progress: globalEase
      });

      if (rawT < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [targetData, transitionDir]);

  // True 1:1 Pixel Coordinates
  const W = chartWidth;
  const H = 148;
  const padL = 48;
  const padR = 16;
  const padT = 18;
  const padB = 24;
  const innerW = Math.max(80, W - padL - padR);
  const innerH = H - padT - padB;
  const baselineY = padT + innerH;

  const linePath = buildPathFromSamples(animState.samples, padL, innerW, baselineY, innerH);
  const areaPath = linePath
    ? `${linePath} L ${(padL + innerW).toFixed(2)} ${baselineY.toFixed(2)} L ${padL.toFixed(2)} ${baselineY.toFixed(2)} Z`
    : '';

  // Discrete interactive points ride smoothly ON the animated curve at their exact normalized X
  const coords = targetData.points.map((pt, i) => {
    const u = targetData.points.length > 1 ? i / (targetData.points.length - 1) : 0.5;
    const x = padL + u * innerW;
    const liveNormY = sampleAtU(animState.samples, u);
    const y = baselineY - liveNormY * innerH;
    return { ...pt, x, y, u };
  });

  const activeIdx = hoveredIdx !== null && coords[hoveredIdx] ? hoveredIdx : targetData.defaultActiveIdx;
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
              <strong>₱{Math.round(animState.periodTotal).toLocaleString('en-US')}</strong> · {targetData.periodCount} receipt{targetData.periodCount !== 1 ? 's' : ''} ({rangeConfig.label})
            </span>
          </div>
        </div>

        {/* Direction-Aware Sliding Time Filter Selector (Today · Week · Month · Year) */}
        <div className="da-range-group" role="tablist" aria-label="Analytics timeframe">
          <span
            className="da-range-indicator"
            style={{
              width: `calc((100% - 6px) / ${RANGES.length})`,
              transform: `translateX(${rangeIndex * 100}%)`
            }}
            aria-hidden="true"
          />
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              role="tab"
              aria-selected={rangeId === r.id}
              className={`da-range-btn ${rangeId === r.id ? 'active' : ''}`}
              onClick={() => handleSelectRange(r.id)}
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
            style={{
              left: `${tooltipLeft}px`,
              top: `${tooltipTop}px`,
              opacity: 0.35 + 0.65 * animState.progress
            }}
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
          aria-label={`Donation analytics chart for ${rangeConfig.label}`}
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

          {/* Synchronized Y-Axis Scale & Horizontal Gridlines */}
          {[0, 0.5, 1].map((t, idx) => {
            const gy = baselineY - t * innerH;
            return (
              <g key={idx}>
                <line x1={padL} y1={gy} x2={W - padR} y2={gy} className="da-grid-line" />
                <text x={padL - 8} y={gy + 3.5} textAnchor="end" className="da-axis-lbl">
                  {formatCompactPhp(animState.maxVal * t)}
                </text>
              </g>
            );
          })}

          {/* Synchronized Vertical Guides & X-Axis Labels */}
          <g className="da-x-axis-group" style={{ opacity: 0.25 + 0.75 * animState.progress }}>
            {coords.map((pt, i) => (
              <g key={`${rangeId}-${i}`}>
                <line x1={pt.x} y1={padT} x2={pt.x} y2={baselineY} className={`da-v-guide ${i === activeIdx ? 'is-active' : ''}`} />
                {(coords.length <= 7 || i % 2 === 0 || i === coords.length - 1) && (
                  <text x={pt.x} y={H - 5} textAnchor="middle" className="da-axis-lbl">
                    {pt.shortLabel}
                  </text>
                )}
              </g>
            ))}
          </g>

          {/* Continuous Morphing Area Fill */}
          {areaPath && <path d={areaPath} fill="url(#daTealArea)" />}

          {/* Continuous Morphing Teal-Emerald Spline */}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke="url(#daTealStroke)"
              strokeWidth="2.1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Synchronized Interactive Nodes Riding on the Live Curve */}
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
