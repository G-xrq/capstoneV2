import { useState, useEffect, useRef } from 'react';

/**
 * Smoothly animates a numeric value with a cubic ease-out roll and triggers
 * a teal live-bump glow whenever the value increases after initial hydration
 * (matching the Landing Page's real-time counter animation).
 */
export function useSmoothCounter(targetValue, durationMs = 1050) {
  const safeTarget = Number.isFinite(Number(targetValue)) ? Math.round(Number(targetValue)) : 0;
  const [displayValue, setDisplayValue] = useState(safeTarget);
  const [isBumping, setIsBumping] = useState(false);

  const prevTargetRef = useRef(safeTarget);
  const displayRef = useRef(safeTarget);
  const mountedAtRef = useRef(Date.now());
  const bumpTimerRef = useRef(null);

  useEffect(() => {
    const startVal = displayRef.current;
    const endVal = safeTarget;
    if (startVal === endVal) return;

    const prevTarget = prevTargetRef.current;
    prevTargetRef.current = endVal;

    // Trigger teal glow on live increases (either from a non-zero prior value, or any increase after initial load settles)
    const elapsedSinceMount = Date.now() - mountedAtRef.current;
    const didIncrease = endVal > prevTarget && (prevTarget > 0 || elapsedSinceMount > 1400);

    if (didIncrease) {
      setIsBumping(true);
      if (bumpTimerRef.current) clearTimeout(bumpTimerRef.current);
      bumpTimerRef.current = setTimeout(() => {
        setIsBumping(false);
        bumpTimerRef.current = null;
      }, Math.max(1300, durationMs + 300));
    }

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      displayRef.current = endVal;
      setDisplayValue(endVal);
      return;
    }

    let rafId = null;
    const startTime = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - startTime) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextVal = Math.round(startVal + (endVal - startVal) * eased);
      displayRef.current = nextVal;
      setDisplayValue(nextVal);
      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        displayRef.current = endVal;
        setDisplayValue(endVal);
      }
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [safeTarget, durationMs]);

  useEffect(() => {
    return () => {
      if (bumpTimerRef.current) clearTimeout(bumpTimerRef.current);
    };
  }, []);

  return { value: displayValue, isBumping };
}

export default function LiveCounter({
  value = 0,
  prefix = '',
  suffix = '',
  duration = 1050,
  className = '',
  style,
  locale = 'en-US'
}) {
  const { value: animatedVal, isBumping } = useSmoothCounter(value, duration);

  return (
    <span
      className={`bbdrts-live-counter${isBumping ? ' is-live-bump' : ''}${className ? ` ${className}` : ''}`}
      style={style}
    >
      {prefix}
      {animatedVal.toLocaleString(locale)}
      {suffix}
    </span>
  );
}
