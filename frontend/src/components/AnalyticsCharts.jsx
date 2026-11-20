import { useState, useMemo, useEffect, useRef, useId } from 'react';

export function formatPhpCompact(val) {
  const num = Number(val || 0);
  if (Math.abs(num) >= 1_000_000) return `₱${(num / 1_000_000).toFixed(2)}M`;
  if (Math.abs(num) >= 10_000) return `₱${Math.round(num / 1000)}k`;
  if (Math.abs(num) >= 1_000) return `₱${(num / 1000).toFixed(1)}k`;
  return `₱${Math.round(num).toLocaleString('en-US')}`;
}

const WAVE_SAMPLES = 72;

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutQuint(t) {
  return 1 - Math.pow(1 - t, 5);
}

/**
 * Smooth requestAnimationFrame numeric counter for KPI values, currency totals,
 * ETH amounts, counts, and percentages — glides fluidly on 7D/30D/90D/All switches.
 */
export function AnimatedNumber({ value = 0, format, duration = 640 }) {
  const numTarget = Number(value || 0);
  const currRef = useRef(numTarget);
  const rafRef = useRef(null);
  const [displayVal, setDisplayVal] = useState(numTarget);

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (prefersReducedMotion() || currRef.current === numTarget) {
      currRef.current = numTarget;
      setDisplayVal(numTarget);
      return;
    }

    const from = currRef.current;
    const startTs = performance.now();

    const tick = (now) => {
      const rawT = Math.min(1, (now - startTs) / Math.max(1, duration));
      const eased = easeOutQuint(rawT);
      const next = from + (numTarget - from) * eased;
      currRef.current = next;
      setDisplayVal(next);
      if (rawT < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        currRef.current = numTarget;
        setDisplayVal(numTarget);
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [numTarget, duration]);

  return <>{format ? format(displayVal) : Math.round(displayVal).toLocaleString('en-US')}</>;
}

/**
 * Resample any array of normalized heights [0..1] onto a fixed-size grid (WAVE_SAMPLES)
 * using Fritsch-Carlson monotone cubic spline interpolation so ANY two datasets
 * (e.g. 7D vs 30D vs 90D vs All) can continuously wave-morph point-for-point.
 */
function sampleMonotoneSeries(rawValues, sampleCount = WAVE_SAMPLES) {
  const n = rawValues.length;
  if (n === 0) return new Array(sampleCount).fill(0);

  if (n === 1) {
    const peak = Math.max(0, Math.min(1, rawValues[0]));
    return Array.from({ length: sampleCount }, (_, k) => {
      const u = k / (sampleCount - 1);
      const dist = (u - 0.5) / 0.14;
      return peak * Math.exp(-0.5 * dist * dist);
    });
  }

  const xs = rawValues.map((_, i) => i / (n - 1));
  const ys = rawValues.map((v) => Math.max(0, Math.min(1, v)));

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

  const out = new Array(sampleCount);
  let seg = 0;
  for (let k = 0; k < sampleCount; k++) {
    const u = k / (sampleCount - 1);
    while (seg < n - 2 && u > xs[seg + 1]) seg += 1;
    const h = dxs[seg] || 1;
    const t = Math.max(0, Math.min(1, (u - xs[seg]) / h));
    const t2 = t * t;
    const t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;
    const val = h00 * ys[seg] + h10 * h * tangents[seg] + h01 * ys[seg + 1] + h11 * h * tangents[seg + 1];
    out[k] = Math.max(0, Math.min(1, val));
  }
  return out;
}

function buildWavePath(samples, padLeft, padTop, plotW, plotH) {
  const n = samples.length;
  if (n === 0) return '';
  const baselineY = padTop + plotH;
  const pts = samples.map((v, k) => ({
    x: padLeft + (k / (n - 1)) * plotW,
    y: Math.min(baselineY, padTop + plotH - v * plotH)
  }));

  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const curr = pts[i];
    const next = pts[i + 1];
    const midX = ((curr.x + next.x) * 0.5).toFixed(1);
    const midY = ((curr.y + next.y) * 0.5).toFixed(1);
    if (i === 0) {
      d += ` L ${midX} ${midY}`;
    } else {
      d += ` Q ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}, ${midX} ${midY}`;
    }
  }
  const last = pts[n - 1];
  d += ` L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
  return d;
}

function buildWaveArea(linePath, padLeft, plotW, baselineY) {
  if (!linePath) return '';
  return `${linePath} L ${(padLeft + plotW).toFixed(1)} ${baselineY.toFixed(1)} L ${padLeft.toFixed(1)} ${baselineY.toFixed(1)} Z`;
}

export function VercelAreaLineChart({
  data = [],
  height = 240,
  seriesMode = 'combined', // 'combined' | 'split' | 'disbursed' | 'volume'
  onSeriesModeChange,
  showModeSwitch = true,
  title = '',
  emptyMessage = 'No contribution activity recorded in this window.'
}) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const [internalMode, setInternalMode] = useState(seriesMode);
  const activeMode = onSeriesModeChange ? seriesMode : internalMode;
  const setMode = onSeriesModeChange || setInternalMode;
  const uid = useId().replace(/:/g, '');

  const w = 640;
  const h = height;
  const pad = { top: 14, right: 14, bottom: 26, left: 52 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;
  const baselineY = pad.top + plotH;

  const isCountAxis = activeMode === 'volume';

  // Target curves & exact interactive data points
  const { targetMaxY, targetPrimary, targetSecondary, hasSecondary, points } = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) {
      return {
        targetMaxY: isCountAxis ? 4 : 1000,
        targetPrimary: new Array(WAVE_SAMPLES).fill(0),
        targetSecondary: new Array(WAVE_SAMPLES).fill(0),
        hasSecondary: false,
        points: []
      };
    }

    let rawMax = 0;
    data.forEach((d) => {
      if (activeMode === 'volume') {
        rawMax = Math.max(rawMax, Number(d.txCount || 0));
      } else if (activeMode === 'disbursed') {
        rawMax = Math.max(rawMax, Number(d.disbursedPhp || 0), Number(d.totalPhp || 0) * 0.15);
      } else if (activeMode === 'split') {
        rawMax = Math.max(rawMax, Number(d.ewalletPhp ?? d.fiatPhp ?? 0), Number(d.bankCardPhp ?? d.cryptoPhp ?? 0));
      } else {
        rawMax = Math.max(rawMax, Number(d.totalPhp || 0), Number(d.disbursedPhp || 0));
      }
    });

    const niceMax = isCountAxis
      ? Math.max(4, Math.ceil(rawMax * 1.2))
      : (rawMax > 0 ? Math.ceil(rawMax * 1.12) : 1000);

    const rawPrimary = data.map((d) => {
      if (activeMode === 'volume') return Number(d.txCount || 0) / niceMax;
      if (activeMode === 'disbursed') return Number(d.disbursedPhp || 0) / niceMax;
      if (activeMode === 'split') return Number(d.ewalletPhp ?? d.fiatPhp ?? 0) / niceMax;
      return Number(d.totalPhp || 0) / niceMax;
    });

    const hasAnyDisb = data.some((d) => Number(d.disbursedPhp || 0) > 0);
    const showSec = activeMode === 'split' || (activeMode === 'combined' && hasAnyDisb);
    const rawSecondary = showSec
      ? data.map((d) => (activeMode === 'split' ? Number(d.bankCardPhp ?? d.cryptoPhp ?? 0) : Number(d.disbursedPhp || 0)) / niceMax)
      : data.map(() => 0);

    const pts = data.map((d, i) => {
      const x = data.length === 1
        ? pad.left + plotW / 2
        : pad.left + (i / (data.length - 1)) * plotW;
      const yTotal = pad.top + plotH - ((Number(d.totalPhp || 0) / niceMax) * plotH);
      const yDisb = pad.top + plotH - ((Number(d.disbursedPhp || 0) / niceMax) * plotH);
      const yEwallet = pad.top + plotH - ((Number(d.ewalletPhp ?? d.fiatPhp ?? 0) / niceMax) * plotH);
      const yBankCard = pad.top + plotH - ((Number(d.bankCardPhp ?? d.cryptoPhp ?? 0) / niceMax) * plotH);
      const yTx = pad.top + plotH - ((Number(d.txCount || 0) / niceMax) * plotH);
      return { ...d, i, x, yTotal, yDisb, yEwallet, yBankCard, yTx };
    });

    return {
      targetMaxY: niceMax,
      targetPrimary: sampleMonotoneSeries(rawPrimary, WAVE_SAMPLES),
      targetSecondary: sampleMonotoneSeries(rawSecondary, WAVE_SAMPLES),
      hasSecondary: showSec,
      points: pts
    };
  }, [data, plotH, plotW, pad.left, pad.top, activeMode, isCountAxis]);

  // Direct SVG DOM refs for locked 60-120fps continuous flowing wave animation with ZERO React re-render overhead
  const primaryLineRef = useRef(null);
  const primaryAreaRef = useRef(null);
  const secondaryLineRef = useRef(null);
  const secondaryAreaRef = useRef(null);
  const secondaryGroupRef = useRef(null);
  const tickTextRefs = useRef([]);

  // Persistent fluid wave physics state
  const waveStateRef = useRef({
    fromPrimary: new Array(WAVE_SAMPLES).fill(0),
    toPrimary: new Array(WAVE_SAMPLES).fill(0),
    currPrimary: new Array(WAVE_SAMPLES).fill(0),
    fromSecondary: new Array(WAVE_SAMPLES).fill(0),
    toSecondary: new Array(WAVE_SAMPLES).fill(0),
    currSecondary: new Array(WAVE_SAMPLES).fill(0),
    fromMaxY: 1000,
    toMaxY: 1000,
    currMaxY: 1000,
    fromSecOp: 0,
    toSecOp: 0,
    currSecOp: 0,
    morphStartTs: 0,
    morphDuration: 720,
    isCountAxis: false,
    initialized: false,
    lastWaveSig: ''
  });

  const waveSig = useMemo(
    () => `${activeMode}|${isCountAxis ? 1 : 0}|${targetMaxY}|${hasSecondary ? 1 : 0}|${targetPrimary.map((v) => v.toFixed(4)).join(',')}|${targetSecondary.map((v) => v.toFixed(4)).join(',')}`,
    [activeMode, isCountAxis, targetMaxY, hasSecondary, targetPrimary, targetSecondary]
  );

  // Trigger silky staggered wave morph ONLY when chart data/mode actually changes, and rest completely still once settled
  useEffect(() => {
    const st = waveStateRef.current;
    if (st.initialized && st.lastWaveSig === waveSig) {
      return;
    }
    st.lastWaveSig = waveSig;
    setHoverIdx(null);
    const now = performance.now();
    const reduced = prefersReducedMotion();

    if (!st.initialized) {
      st.fromPrimary = new Array(WAVE_SAMPLES).fill(0);
      st.currPrimary = new Array(WAVE_SAMPLES).fill(0);
      st.fromSecondary = new Array(WAVE_SAMPLES).fill(0);
      st.currSecondary = new Array(WAVE_SAMPLES).fill(0);
      st.fromMaxY = targetMaxY;
      st.currMaxY = targetMaxY;
      st.fromSecOp = 0;
      st.currSecOp = 0;
      st.initialized = true;
    } else {
      st.fromPrimary = [...st.currPrimary];
      st.fromSecondary = [...st.currSecondary];
      st.fromMaxY = st.currMaxY;
      st.fromSecOp = st.currSecOp;
    }

    st.toPrimary = [...targetPrimary];
    st.toSecondary = [...targetSecondary];
    st.toMaxY = targetMaxY;
    st.toSecOp = hasSecondary ? 1 : 0;
    st.isCountAxis = isCountAxis;
    st.morphStartTs = now;
    st.morphDuration = reduced ? 1 : 680;

    let rafId = null;
    const staggerSpread = 0.24;
    const displayPrimary = new Array(WAVE_SAMPLES);
    const displaySecondary = new Array(WAVE_SAMPLES);

    const drawFrame = (ts) => {
      const elapsed = Math.max(0, ts - st.morphStartTs);
      const rawT = reduced ? 1 : Math.min(1, elapsed / Math.max(1, st.morphDuration));
      const globalEase = easeOutQuint(rawT);

      // Subtle flowing liquid wave ripple ONLY during the transition, settling cleanly to exact 0
      const morphRippleEnv = reduced ? 0 : Math.sin(rawT * Math.PI) * (1 - rawT) * 0.024;

      for (let k = 0; k < WAVE_SAMPLES; k++) {
        const frac = k / (WAVE_SAMPLES - 1);
        const delay = frac * staggerSpread;
        const localT = reduced ? 1 : Math.max(0, Math.min(1, (rawT - delay) / (1 - staggerSpread)));
        const eased = easeInOutCubic(localT);

        const baseP = st.fromPrimary[k] + (st.toPrimary[k] - st.fromPrimary[k]) * eased;
        const baseS = st.fromSecondary[k] + (st.toSecondary[k] - st.fromSecondary[k]) * eased;
        st.currPrimary[k] = baseP;
        st.currSecondary[k] = baseS;

        const morphWave = Math.sin(frac * Math.PI * 3.0 - rawT * Math.PI * 2.2) * morphRippleEnv;
        const envP = baseP > 0.018 ? Math.min(1, baseP * 1.25) : 0;
        const envS = baseS > 0.018 ? Math.min(1, baseS * 1.25) : 0;

        displayPrimary[k] = Math.max(0, Math.min(1, baseP + morphWave * envP));
        displaySecondary[k] = Math.max(0, Math.min(1, baseS + morphWave * envS));
      }

      st.currMaxY = st.fromMaxY + (st.toMaxY - st.fromMaxY) * globalEase;
      st.currSecOp = st.fromSecOp + (st.toSecOp - st.fromSecOp) * globalEase;

      const pLine = buildWavePath(displayPrimary, pad.left, pad.top, plotW, plotH);
      if (primaryLineRef.current) primaryLineRef.current.setAttribute('d', pLine);
      if (primaryAreaRef.current) primaryAreaRef.current.setAttribute('d', buildWaveArea(pLine, pad.left, plotW, baselineY));

      if (secondaryGroupRef.current) {
        secondaryGroupRef.current.style.opacity = st.currSecOp.toFixed(3);
      }
      if (st.currSecOp > 0.005) {
        const sLine = buildWavePath(displaySecondary, pad.left, pad.top, plotW, plotH);
        if (secondaryLineRef.current) secondaryLineRef.current.setAttribute('d', sLine);
        if (secondaryAreaRef.current) secondaryAreaRef.current.setAttribute('d', buildWaveArea(sLine, pad.left, plotW, baselineY));
      }

      const fracs = [0, 0.33, 0.66, 1];
      for (let i = 0; i < 4; i++) {
        const el = tickTextRefs.current[i];
        if (el) {
          const val = Math.round(st.currMaxY * fracs[i]);
          el.textContent = st.isCountAxis ? `${val} tx` : formatPhpCompact(val);
        }
      }

      if (rawT < 1) {
        rafId = requestAnimationFrame(drawFrame);
      } else {
        rafId = null;
      }
    };

    rafId = requestAnimationFrame(drawFrame);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [targetPrimary, targetSecondary, targetMaxY, hasSecondary, isCountAxis, pad.left, pad.top, plotW, plotH, baselineY]);

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

  const initialPrimaryLine = useMemo(
    () => buildWavePath(targetPrimary, pad.left, pad.top, plotW, plotH),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const initialPrimaryArea = useMemo(
    () => buildWaveArea(initialPrimaryLine, pad.left, plotW, baselineY),
    [initialPrimaryLine, pad.left, plotW, baselineY]
  );

  const primaryColor = activeMode === 'disbursed' ? '#10b981' : 'var(--va-series-primary, #3291FF)';
  const primaryGradId = activeMode === 'disbursed' ? `vaAreaEm_${uid}` : `vaAreaBl_${uid}`;
  const secondaryColor = activeMode === 'split' ? 'var(--va-series-mono, #a1a1aa)' : '#10b981';
  const secondaryGradId = activeMode === 'split' ? `vaAreaNu_${uid}` : `vaAreaEm_${uid}`;

  const activePt = hoverIdx !== null && points[hoverIdx] ? points[hoverIdx] : null;
  const isEmpty = !data || data.length === 0;
  const initialTicks = [0, 0.33, 0.66, 1].map((p) => Math.round(targetMaxY * p));

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
                {hasSecondary && (
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
                  E-Wallets (GCash / Maya)
                </span>
                <span className="va-legend-item">
                  <span className="va-legend-swatch va-swatch-neutral" />
                  Bank / Card
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
                Donations / Day
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
              E-Wallet vs Bank
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
            <linearGradient id={`vaAreaBl_${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--va-series-primary, #3291FF)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--va-series-primary, #3291FF)" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id={`vaAreaEm_${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.20" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id={`vaAreaNu_${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--va-series-mono, #a1a1aa)" stopOpacity="0.14" />
              <stop offset="100%" stopColor="var(--va-series-mono, #a1a1aa)" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Horizontal Hairlines & Smoothly Scaling Y Ticks */}
          {initialTicks.map((val, idx) => {
            const yPos = pad.top + plotH - ((idx / 3) * plotH);
            return (
              <g key={idx}>
                <line
                  x1={pad.left}
                  x2={w - pad.right}
                  y1={yPos}
                  y2={yPos}
                  className={`va-grid-line ${idx === 0 ? 'va-grid-baseline' : ''}`}
                />
                <text
                  ref={(el) => { tickTextRefs.current[idx] = el; }}
                  x={pad.left - 10}
                  y={yPos + 3.5}
                  textAnchor="end"
                  className="va-axis-tick"
                >
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

          {/* Persistent Continuous Wave Layer (NEVER remounted — smoothly liquid-morphs on every filter change!) */}
          <g className="va-wave-layer" data-wave-engine="continuous">
            <path ref={primaryAreaRef} d={initialPrimaryArea} fill={`url(#${primaryGradId})`} className="va-wave-area" />
            <path
              ref={primaryLineRef}
              d={initialPrimaryLine}
              fill="none"
              stroke={primaryColor}
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="va-wave-stroke"
            />
            <g ref={secondaryGroupRef} style={{ opacity: hasSecondary ? 1 : 0 }}>
              <path ref={secondaryAreaRef} d="" fill={`url(#${secondaryGradId})`} />
              <path
                ref={secondaryLineRef}
                d=""
                fill="none"
                stroke={secondaryColor}
                strokeWidth="1.55"
                strokeDasharray={activeMode === 'combined' ? '3 3' : undefined}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
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
                      : activeMode === 'split' ? activePt.yEwallet
                        : activePt.yTotal
                }
                r="4"
                fill="var(--va-surface, #0a0a0a)"
                stroke={primaryColor}
                strokeWidth="2"
              />
              {activeMode === 'split' && (
                <circle
                  cx={activePt.x}
                  cy={activePt.yBankCard}
                  r="3.5"
                  fill="var(--va-surface, #0a0a0a)"
                  stroke="var(--va-series-mono, #a1a1aa)"
                  strokeWidth="2"
                />
              )}
            </g>
          )}

          {/* Single-point peak indicator when only 1 day exists */}
          {points.length === 1 && !activePt && (
            <circle
              cx={points[0].x}
              cy={activeMode === 'volume' ? points[0].yTx : activeMode === 'disbursed' ? points[0].yDisb : points[0].yTotal}
              r="4"
              fill="var(--va-surface, #0a0a0a)"
              stroke={primaryColor}
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

        {isEmpty && (
          <div className="va-wave-empty-overlay">
            <span>{emptyMessage}</span>
          </div>
        )}

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
                  <span>E-Wallets</span>
                  <strong>₱{Number(activePt.ewalletPhp ?? activePt.fiatPhp ?? 0).toLocaleString('en-US')}</strong>
                </div>
                <div className="va-tooltip-row">
                  <span className="va-legend-swatch va-swatch-neutral" />
                  <span>Bank / Card</span>
                  <strong>₱{Number(activePt.bankCardPhp ?? activePt.cryptoPhp ?? 0).toLocaleString('en-US')}</strong>
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
                <span>Donations</span>
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
              {activePt.txCount} verified donation{activePt.txCount === 1 ? '' : 's'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const GEIST_DONUT_COLORS = [
  'var(--va-series-primary, #3291FF)',
  '#10b981',
  '#a855f7',
  '#71717a'
];

// Stable canonical ring order so segments glide smoothly around the circumference without jumping
const CANONICAL_RAIL_ORDER = ['Bank / Card', 'GCash', 'Maya', 'Legacy On-Chain'];

export function VercelDonutChart({
  items = [],
  centerLabel = 'Total',
  centerValue = '₱0',
  stacked = false,
  emptyMessage = 'No channel breakdown available yet.'
}) {
  const [hoveredKey, setHoveredKey] = useState(null);

  const size = stacked ? 144 : 158;
  const cx = size / 2;
  const cy = size / 2;
  const r = stacked ? 56 : 62;
  const strokeW = 10;
  const circ = 2 * Math.PI * r;

  // Compute sculpted floating rounded arc targets (all segments stay persistently mounted!)
  const { canonicalSlices, totalVal, legendSlices } = useMemo(() => {
    const rawTotal = items.reduce((s, it) => s + Math.max(0, Number(it.value || 0)), 0);

    const orderedForRing = [...items].sort((a, b) => {
      const ia = CANONICAL_RAIL_ORDER.indexOf(a.key);
      const ib = CANONICAL_RAIL_ORDER.indexOf(b.key);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return String(a.key).localeCompare(String(b.key));
    });

    const nonZeroCount = orderedForRing.filter((it) => Number(it.value || 0) > 0).length;
    // Exact geometric circular sectors with crisp 1.5px hairline divider (zero round-cap distortion!)
    const gapFrac = nonZeroCount > 1 ? 1.5 / circ : 0;

    let cum = 0;
    const ringMap = new Map();
    const ringArr = orderedForRing.map((item, idx) => {
      const val = Math.max(0, Number(item.value || 0));
      const frac = rawTotal > 0 ? val / rawTotal : 0;
      const startFrac = cum;
      const sweepFrac = frac > 0 ? (frac > gapFrac * 1.6 ? frac - gapFrac : frac * 0.85) : 0;
      cum += frac;
      const entry = {
        ...item,
        color: item.color || GEIST_DONUT_COLORS[idx % GEIST_DONUT_COLORS.length],
        pctNum: Number((frac * 100).toFixed(1)),
        startFrac,
        sweepFrac,
        opacity: frac > 0 ? 1 : 0
      };
      ringMap.set(item.key, entry);
      return entry;
    });

    const legendArr = items.map((item, idx) => {
      const entry = ringMap.get(item.key);
      return entry || {
        ...item,
        color: item.color || GEIST_DONUT_COLORS[idx % GEIST_DONUT_COLORS.length],
        pctNum: 0,
        startFrac: 0,
        sweepFrac: 0,
        opacity: 0
      };
    });

    return { canonicalSlices: ringArr, totalVal: rawTotal, legendSlices: legendArr };
  }, [items, circ, strokeW]);

  // Kinetic rAF Donut Morph: fluidly glides every arc's size & position + subtle rotational spring + center counter roll
  const currSlicesRef = useRef({});
  const currTotalRef = useRef(0);
  const rafRef = useRef(null);
  const hasInitRef = useRef(false);
  const lastAnimSigRef = useRef(null);
  const canonicalSlicesRef = useRef(canonicalSlices);
  canonicalSlicesRef.current = canonicalSlices;

  const [animDonut, setAnimDonut] = useState(() => {
    const map = {};
    canonicalSlices.forEach((s) => {
      map[s.key] = { startFrac: s.startFrac, sweepFrac: s.sweepFrac, opacity: s.opacity };
    });
    return { slices: map, ringAngle: -90, displayTotal: totalVal };
  });

  const targetSig = canonicalSlices.map((s) => `${s.key}:${s.value}`).join('|');

  useEffect(() => {
    const slices = canonicalSlicesRef.current;
    const animSig = `${targetSig}::${totalVal}`;
    if (hasInitRef.current && lastAnimSigRef.current === animSig) {
      return;
    }
    lastAnimSigRef.current = animSig;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    if (prefersReducedMotion()) {
      const snap = {};
      slices.forEach((s) => {
        snap[s.key] = { startFrac: s.startFrac, sweepFrac: s.sweepFrac, opacity: s.opacity };
      });
      currSlicesRef.current = snap;
      currTotalRef.current = totalVal;
      setAnimDonut({ slices: snap, ringAngle: -90, displayTotal: totalVal });
      hasInitRef.current = true;
      return;
    }

    const fromSlices = {};
    slices.forEach((s) => {
      if (hasInitRef.current && currSlicesRef.current[s.key]) {
        fromSlices[s.key] = { ...currSlicesRef.current[s.key] };
      } else {
        fromSlices[s.key] = { startFrac: s.startFrac, sweepFrac: 0, opacity: 0 };
      }
    });
    const fromTotal = hasInitRef.current ? currTotalRef.current : 0;
    const isInitialLoad = !hasInitRef.current;
    hasInitRef.current = true;

    const duration = isInitialLoad ? 820 : 720;
    const startTs = performance.now();

    const step = (now) => {
      const elapsed = now - startTs;
      const rawT = Math.min(1, elapsed / duration);
      const eased = easeOutQuint(rawT);
      const nextMap = {};

      // Synchronized clockwork interpolation guarantees adjacent slices NEVER overlap mid-transition
      slices.forEach((s) => {
        const f = fromSlices[s.key] || { startFrac: s.startFrac, sweepFrac: 0, opacity: 0 };
        nextMap[s.key] = {
          startFrac: f.startFrac + (s.startFrac - f.startFrac) * eased,
          sweepFrac: f.sweepFrac + (s.sweepFrac - f.sweepFrac) * eased,
          opacity: f.opacity + (s.opacity - f.opacity) * Math.min(1, eased * 1.4)
        };
      });

      // Signature subtle rotational glide that settles smoothly back to -90deg
      const spinAmp = isInitialLoad ? 24 : 16;
      const ringAngle = -90 + Math.sin(rawT * Math.PI) * spinAmp * (1 - rawT);
      const displayTotal = Math.round(fromTotal + (totalVal - fromTotal) * eased);

      currSlicesRef.current = nextMap;
      currTotalRef.current = displayTotal;
      setAnimDonut({ slices: nextMap, ringAngle, displayTotal });

      if (rawT < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [targetSig, totalVal]);

  const activeSlice = hoveredKey ? legendSlices.find((s) => s.key === hoveredKey) : null;
  const animatedCenterDisplay = `₱${Number(animDonut.displayTotal || 0).toLocaleString('en-US')}`;

  return (
    <div className={`va-donut-layout ${stacked ? 'is-stacked' : ''}`}>
      <div className="va-donut-ring" style={{ width: `${size}px`, height: `${size}px` }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={centerLabel}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--va-border-subtle, #1a1a1a)" strokeWidth={strokeW} />
          <g data-donut-engine="kinetic" transform={`rotate(${animDonut.ringAngle.toFixed(2)} ${cx} ${cy})`}>
            {canonicalSlices.map((s) => {
              const st = animDonut.slices[s.key] || { startFrac: 0, sweepFrac: 0, opacity: 0 };
              const dashLen = Math.max(0, st.sweepFrac * circ);
              const dashOffset = -(st.startFrac * circ);
              const isHover = hoveredKey === s.key;
              const finalOpacity = hoveredKey
                ? (isHover ? st.opacity : st.opacity * 0.28)
                : st.opacity;
              return (
                <circle
                  key={s.key}
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={isHover ? 13 : strokeW}
                  strokeLinecap="butt"
                  strokeDasharray={`${dashLen.toFixed(2)} ${circ.toFixed(2)}`}
                  strokeDashoffset={dashOffset.toFixed(2)}
                  style={{
                    cursor: st.sweepFrac > 0.001 ? 'pointer' : 'default',
                    opacity: finalOpacity,
                    transition: 'stroke-width 160ms cubic-bezier(0.16, 1, 0.3, 1), opacity 160ms ease'
                  }}
                  onMouseEnter={() => { if (s.value > 0) setHoveredKey(s.key); }}
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
            {activeSlice
              ? `${activeSlice.pctNum}%`
              : (totalVal > 0 ? animatedCenterDisplay : centerValue)}
          </strong>
          {activeSlice && (
            <span className="va-donut-center-sub">
              {formatPhpCompact(activeSlice.value)}
            </span>
          )}
        </div>
      </div>

      {totalVal <= 0 && legendSlices.length === 0 ? (
        <div className="va-empty-state" style={{ minHeight: '90px' }}>
          <span>{emptyMessage}</span>
        </div>
      ) : (
        <div className="va-hairline-list">
          {legendSlices.map((s) => (
            <div
              key={s.key}
              className={`va-donut-row ${hoveredKey === s.key ? 'is-active' : ''}`}
              onMouseEnter={() => { if (s.value > 0) setHoveredKey(s.key); }}
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
      )}
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
