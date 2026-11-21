import { useState, useMemo, useRef, useEffect } from 'react';

const RANGES = [
  { id: 'TODAY', label: 'Today' },
  { id: 'WEEK', label: 'Week' },
  { id: 'MONTH', label: 'Month' },
  { id: 'YEAR', label: 'Year' },
  { id: 'ALL', label: 'All' }
];

const SAMPLES = 64; // Dense uniform curve resolution for continuous zero-break directional morphing

function formatCompactPhp(val) {
  const n = Number(val) || 0;
  if (n <= 0) return '₱0';
  if (n >= 1_000_000) return `₱${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `₱${(n / 1_000).toFixed(n >= 10_000 || n % 1_000 === 0 ? 0 : 1)}k`;
  return `₱${Math.round(n)}`;
}

// Fritsch-Carlson monotone Hermite tangents (guarantees zero below-zero overshoot)
function computeMonotoneTangents(pts) {
  const n = pts.length;
  if (n < 2) return new Array(n).fill(0);

  const slopes = [];
  for (let i = 0; i < n - 1; i++) {
    const dxi = pts[i + 1].x - pts[i].x;
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

// Evaluate monotone spline across [0..1] into `sampleCount` uniform points
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

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Build exact calendar-aligned buckets for Today / Week / Month / Year / All
function buildCalendarBuckets(rangeId, parsedDonations) {
  const now = new Date();
  const buckets = [];

  if (rangeId === 'TODAY') {
    // 12:00 AM – 11:59 PM today, 24 hourly intervals
    const year = now.getFullYear();
    const month = now.getMonth();
    const day = now.getDate();
    for (let h = 0; h < 24; h++) {
      const start = new Date(year, month, day, h, 0, 0, 0);
      const end = new Date(year, month, day, h, 59, 59, 999);
      const hourLabel = h === 0 ? '12AM' : h === 12 ? '12PM' : h < 12 ? `${h}AM` : `${h - 12}PM`;
      const showTick = h === 0 || h === 4 || h === 8 || h === 12 || h === 16 || h === 20 || h === 23;
      buckets.push({
        startMs: start.getTime(),
        endMs: end.getTime(),
        shortLabel: hourLabel,
        showTick,
        fullDate: `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · ${hourLabel}`,
        totalPhp: 0,
        count: 0
      });
    }
  } else if (rangeId === 'WEEK') {
    // Monday – Sunday of current week, 7 daily intervals
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday, 0, 0, 0, 0);
    for (let d = 0; d < 7; d++) {
      const start = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + d, 0, 0, 0, 0);
      const end = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + d, 23, 59, 59, 999);
      buckets.push({
        startMs: start.getTime(),
        endMs: end.getTime(),
        shortLabel: start.toLocaleDateString('en-US', { weekday: 'short' }),
        showTick: true,
        fullDate: start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
        totalPhp: 0,
        count: 0
      });
    }
  } else if (rangeId === 'MONTH') {
    // 1st – last day of current month, daily intervals
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthShort = now.toLocaleDateString('en-US', { month: 'short' });
    for (let d = 1; d <= daysInMonth; d++) {
      const start = new Date(year, month, d, 0, 0, 0, 0);
      const end = new Date(year, month, d, 23, 59, 59, 999);
      const showTick = d === 1 || d === 5 || d === 10 || d === 15 || d === 20 || d === 25 || d === daysInMonth;
      buckets.push({
        startMs: start.getTime(),
        endMs: end.getTime(),
        shortLabel: d === 1 || d === daysInMonth ? `${monthShort} ${d}` : `${d}`,
        showTick,
        fullDate: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        totalPhp: 0,
        count: 0
      });
    }
  } else if (rangeId === 'YEAR') {
    // January – December of current year, 12 monthly intervals
    const year = now.getFullYear();
    for (let m = 0; m < 12; m++) {
      const start = new Date(year, m, 1, 0, 0, 0, 0);
      const end = new Date(year, m + 1, 0, 23, 59, 59, 999);
      buckets.push({
        startMs: start.getTime(),
        endMs: end.getTime(),
        shortLabel: start.toLocaleDateString('en-US', { month: 'short' }),
        showTick: m % 2 === 0 || m === 11,
        fullDate: start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        totalPhp: 0,
        count: 0
      });
    }
  } else {
    // ALL: Adaptive historical timeline spanning earliest donation -> latest donation (or today)
    if (parsedDonations.length === 0) {
      const year = now.getFullYear();
      for (let i = 5; i >= 0; i--) {
        const start = new Date(year, now.getMonth() - i, 1, 0, 0, 0, 0);
        const end = new Date(year, now.getMonth() - i + 1, 0, 23, 59, 59, 999);
        buckets.push({
          startMs: start.getTime(),
          endMs: end.getTime(),
          shortLabel: start.toLocaleDateString('en-US', { month: 'short' }),
          showTick: true,
          fullDate: start.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          totalPhp: 0,
          count: 0
        });
      }
    } else {
      const minTs = Math.min(...parsedDonations.map(p => p.ts));
      const maxTs = Math.max(now.getTime(), ...parsedDonations.map(p => p.ts));
      const spanDays = Math.max(1, (maxTs - minTs) / 86_400_000);
      const minD = new Date(minTs);
      const maxD = new Date(maxTs);

      if (spanDays <= 35) {
        // Daily intervals across the full historical range
        const startDay = new Date(minD.getFullYear(), minD.getMonth(), minD.getDate(), 0, 0, 0, 0);
        const endDay = new Date(maxD.getFullYear(), maxD.getMonth(), maxD.getDate(), 23, 59, 59, 999);
        const totalDays = Math.max(2, Math.round((endDay - startDay) / 86_400_000));
        const tickStep = Math.max(1, Math.ceil(totalDays / 6));
        for (let d = 0; d < totalDays; d++) {
          const s = new Date(startDay.getFullYear(), startDay.getMonth(), startDay.getDate() + d, 0, 0, 0, 0);
          const e = new Date(startDay.getFullYear(), startDay.getMonth(), startDay.getDate() + d, 23, 59, 59, 999);
          buckets.push({
            startMs: s.getTime(),
            endMs: e.getTime(),
            shortLabel: s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            showTick: d === 0 || d === totalDays - 1 || d % tickStep === 0,
            fullDate: s.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            totalPhp: 0,
            count: 0
          });
        }
      } else if (spanDays <= 180) {
        // Weekly intervals
        const startDay = new Date(minD.getFullYear(), minD.getMonth(), minD.getDate(), 0, 0, 0, 0);
        const endMs = new Date(maxD.getFullYear(), maxD.getMonth(), maxD.getDate(), 23, 59, 59, 999).getTime();
        let cur = startDay.getTime();
        while (cur <= endMs) {
          const s = new Date(cur);
          const e = new Date(Math.min(endMs, cur + 7 * 86_400_000 - 1));
          buckets.push({
            startMs: s.getTime(),
            endMs: e.getTime(),
            shortLabel: s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            showTick: false,
            fullDate: `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
            totalPhp: 0,
            count: 0
          });
          cur += 7 * 86_400_000;
        }
        const tickStep = Math.max(1, Math.ceil(buckets.length / 6));
        buckets.forEach((b, i) => {
          b.showTick = i === 0 || i === buckets.length - 1 || i % tickStep === 0;
        });
      } else if (spanDays <= 760) {
        // Monthly intervals
        let y = minD.getFullYear();
        let m = minD.getMonth();
        const endY = maxD.getFullYear();
        const endM = maxD.getMonth();
        while (y < endY || (y === endY && m <= endM)) {
          const s = new Date(y, m, 1, 0, 0, 0, 0);
          const e = new Date(y, m + 1, 0, 23, 59, 59, 999);
          buckets.push({
            startMs: s.getTime(),
            endMs: e.getTime(),
            shortLabel: s.toLocaleDateString('en-US', { month: 'short', year: endY !== minD.getFullYear() ? '2-digit' : undefined }),
            showTick: false,
            fullDate: s.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
            totalPhp: 0,
            count: 0
          });
          m += 1;
          if (m > 11) { m = 0; y += 1; }
        }
        if (buckets.length === 1) {
          // Ensure at least 2 points for a line
          const prevS = new Date(minD.getFullYear(), minD.getMonth() - 1, 1, 0, 0, 0, 0);
          const prevE = new Date(minD.getFullYear(), minD.getMonth(), 0, 23, 59, 59, 999);
          buckets.unshift({
            startMs: prevS.getTime(),
            endMs: prevE.getTime(),
            shortLabel: prevS.toLocaleDateString('en-US', { month: 'short' }),
            showTick: true,
            fullDate: prevS.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
            totalPhp: 0,
            count: 0
          });
        }
        const tickStep = Math.max(1, Math.ceil(buckets.length / 6));
        buckets.forEach((b, i) => {
          b.showTick = i === 0 || i === buckets.length - 1 || i % tickStep === 0;
        });
      } else {
        // Quarterly intervals for multi-year history
        let y = minD.getFullYear();
        let q = Math.floor(minD.getMonth() / 3);
        const endY = maxD.getFullYear();
        const endQ = Math.floor(maxD.getMonth() / 3);
        while (y < endY || (y === endY && q <= endQ)) {
          const s = new Date(y, q * 3, 1, 0, 0, 0, 0);
          const e = new Date(y, q * 3 + 3, 0, 23, 59, 59, 999);
          buckets.push({
            startMs: s.getTime(),
            endMs: e.getTime(),
            shortLabel: `Q${q + 1} '${String(y).slice(-2)}`,
            showTick: false,
            fullDate: `Q${q + 1} ${y}`,
            totalPhp: 0,
            count: 0
          });
          q += 1;
          if (q > 3) { q = 0; y += 1; }
        }
        const tickStep = Math.max(1, Math.ceil(buckets.length / 6));
        buckets.forEach((b, i) => {
          b.showTick = i === 0 || i === buckets.length - 1 || i % tickStep === 0;
        });
      }
    }
  }

  return buckets;
}

export default function DonationAnalyticsChart({ donations = [] }) {
  const [rangeId, setRangeId] = useState('YEAR');
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [transitionDir, setTransitionDir] = useState(1); // +1: Today->All (enters from right), -1: All->Today (enters from left)
  const stageRef = useRef(null);
  const [chartWidth, setChartWidth] = useState(560);

  // Measure live width for crisp 1:1 SVG geometry
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
  const rangeConfig = RANGES[rangeIndex] || RANGES[3];

  const handleSelectRange = (nextId) => {
    if (nextId === rangeId) return;
    const nextIdx = RANGES.findIndex(r => r.id === nextId);
    setTransitionDir(nextIdx >= rangeIndex ? 1 : -1);
    setHoveredIdx(null);
    setRangeId(nextId);
  };

  // Compute exact calendar-bucketed data for the selected range
  const targetData = useMemo(() => {
    const list = Array.isArray(donations) ? donations : [];
    const parsed = list
      .map(d => {
        const ts = d.createdAt ? new Date(d.createdAt).getTime() : NaN;
        if (!Number.isFinite(ts)) return null;
        const eth = parseFloat(d.amount || d.Amount || 0) || 0;
        const php = Number(d.phpAmount || d.amountPhp) || Math.round(eth * 170000);
        return { ts, php: Math.max(0, php) };
      })
      .filter(Boolean);

    const buckets = buildCalendarBuckets(rangeId, parsed);

    let pTotal = 0;
    let pCount = 0;

    for (const item of parsed) {
      for (let i = 0; i < buckets.length; i++) {
        if (item.ts >= buckets[i].startMs && item.ts <= buckets[i].endMs) {
          buckets[i].totalPhp += item.php;
          buckets[i].count += 1;
          pTotal += item.php;
          pCount += 1;
          break;
        }
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
  }, [donations, rangeId]);

  // Continuous direction-aware timeline shift morph (NO fade, NO chart sliding!)
  const [animState, setAnimState] = useState(() => ({
    samples: targetData.denseSamples,
    maxVal: targetData.maxVal,
    periodTotal: targetData.periodTotal
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
        periodTotal: targetData.periodTotal
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

    const duration = 950;
    const bandWidth = 0.40; // Smooth travelling horizon width across [0..1]
    const startTime = performance.now();

    const tick = (now) => {
      const rawT = Math.min(1, (now - startTime) / duration);
      const globalEase = easeOutCubic(rawT);

      const nextSamples = new Array(SAMPLES);
      for (let i = 0; i < SAMPLES; i++) {
        const u = i / (SAMPLES - 1);
        // Forward (+1, Today -> All): travelling front sweeps from RIGHT (u=1) -> LEFT (u=0)
        // Backward (-1, All -> Today): travelling front sweeps from LEFT (u=0) -> RIGHT (u=1)
        const waveFront = dir > 0
          ? 1 + bandWidth - globalEase * (1 + bandWidth * 2)
          : -bandWidth + globalEase * (1 + bandWidth * 2);

        const blend = dir > 0
          ? smoothstep(waveFront - bandWidth, waveFront + bandWidth, u)
          : 1 - smoothstep(waveFront - bandWidth, waveFront + bandWidth, u);

        // Subtle continuous timeline-flow drift inside the active wave band (never detaches endpoints)
        const drift = Math.sin(blend * Math.PI) * 0.08 * dir;
        const fromVal = sampleAtU(fromSamples, u + drift);
        const toVal = sampleAtU(toSamples, u - drift * 0.5);

        nextSamples[i] = Math.max(0, Math.min(1, fromVal * (1 - blend) + toVal * blend));
      }

      setAnimState({
        samples: nextSamples,
        maxVal: fromMax + (toMax - fromMax) * globalEase,
        periodTotal: fromTotal + (toTotal - fromTotal) * globalEase
      });

      if (rawT < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setAnimState({
          samples: toSamples,
          maxVal: toMax,
          periodTotal: toTotal
        });
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [targetData, transitionDir]);

  // Fixed 1:1 Chart Dimensions (Never moves or resizes on filter change)
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

  // Discrete interactive points ride smoothly on the continuous morphing spline
  const coords = targetData.points.map((pt, i) => {
    const u = targetData.points.length > 1 ? i / (targetData.points.length - 1) : 0.5;
    const x = padL + u * innerW;
    const liveNormY = sampleAtU(animState.samples, u);
    const y = baselineY - liveNormY * innerH;
    return { ...pt, x, y, u };
  });

  const activeIdx = hoveredIdx !== null && coords[hoveredIdx] ? hoveredIdx : targetData.defaultActiveIdx;
  const activePt = coords[activeIdx] || null;

  const tooltipLeft = activePt ? Math.max(70, Math.min(W - 70, activePt.x)) : W / 2;
  const placeBelow = activePt ? activePt.y < 30 : false;
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

        {/* 5-Range Sliding Selector: Today · Week · Month · Year · All */}
        <div className="da-range-group" role="tablist" aria-label="Analytics time range">
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

          {/* Y-Axis Scale & Horizontal Gridlines */}
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

          {/* Calendar X-Axis Ticks & Active Vertical Guide (Solid, Zero Fade) */}
          {coords.map((pt, i) => (
            <g key={i}>
              {i === activeIdx && (
                <line x1={pt.x} y1={padT} x2={pt.x} y2={baselineY} className="da-v-guide is-active" />
              )}
              {pt.showTick && (
                <text x={pt.x} y={H - 5} textAnchor="middle" className="da-axis-lbl">
                  {pt.shortLabel}
                </text>
              )}
            </g>
          ))}

          {/* Continuous Morphing Area Fill */}
          {areaPath && <path d={areaPath} fill="url(#daTealArea)" />}

          {/* Continuous Morphing Teal-Emerald Trend Line */}
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
            const showDot = isActive || coords.length <= 12 || pt.totalPhp > 0;
            return (
              <g
                key={i}
                className="da-point-group"
                onMouseEnter={() => setHoveredIdx(i)}
                onClick={() => setHoveredIdx(i)}
              >
                {isActive && <circle cx={pt.x} cy={pt.y} r="8" fill="#10b981" fillOpacity="0.16" />}
                {showDot && (
                  <circle cx={pt.x} cy={pt.y} r={isActive ? 4 : 2.4} className={`da-node ${isActive ? 'is-active' : ''}`} />
                )}
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
