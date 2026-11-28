import { useEffect, useRef } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { PAGE_GUIDES } from '../data/pageGuides';
import './PageGuideButton.css';

function resolveVisibleElement(selectorOrList) {
  if (!selectorOrList || typeof document === 'undefined') return null;
  const list = Array.isArray(selectorOrList) ? selectorOrList : [selectorOrList];
  for (const sel of list) {
    if (!sel || typeof sel !== 'string') continue;
    try {
      const el = document.querySelector(sel);
      if (!el) continue;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        return el;
      }
    } catch (_) {
      // Ignore invalid selector syntax
    }
  }
  return null;
}

export default function PageGuideButton({ guideKey, title, steps: customSteps }) {
  const driverRef = useRef(null);

  useEffect(() => {
    return () => {
      if (driverRef.current) {
        try {
          driverRef.current.destroy();
        } catch (_) {}
        driverRef.current = null;
      }
    };
  }, []);

  const config = guideKey ? PAGE_GUIDES[guideKey] : null;
  const pageTitle = title || config?.title || 'This Page';
  const rawSteps = Array.isArray(customSteps) && customSteps.length > 0
    ? customSteps
    : (config?.steps || []);

  if (rawSteps.length === 0) return null;

  const handleStartGuide = (e) => {
    e.stopPropagation();

    if (driverRef.current) {
      try {
        driverRef.current.destroy();
      } catch (_) {}
      driverRef.current = null;
    }

    const usedElements = new Set();
    const resolvedSteps = [];

    for (const step of rawSteps) {
      const el = resolveVisibleElement(step.selector);
      if (el && !usedElements.has(el)) {
        usedElements.add(el);
        resolvedSteps.push({
          element: el,
          popover: {
            title: step.title,
            description: step.description,
            side: step.side || 'bottom',
            align: step.align || 'start'
          }
        });
      }
    }

    // Fallback: if no specific sub-element is currently visible, show a clean centered guide summary
    if (resolvedSteps.length === 0) {
      resolvedSteps.push({
        popover: {
          title: `${pageTitle} Guide`,
          description: rawSteps[0]?.description || `Explore the controls and live data available on ${pageTitle}.`
        }
      });
    }

    const instance = driver({
      animate: true,
      allowClose: true,
      smoothScroll: true,
      overlayOpacity: 0.56,
      stagePadding: 8,
      stageRadius: 10,
      popoverOffset: 12,
      popoverClass: 'bbdrts-page-guide-popover',
      showProgress: true,
      progressText: '{{current}} of {{total}}',
      nextBtnText: 'Next',
      prevBtnText: 'Back',
      doneBtnText: 'Done',
      steps: resolvedSteps,
      onDestroyed: () => {
        driverRef.current = null;
      }
    });

    driverRef.current = instance;
    instance.drive();
  };

  return (
    <button
      type="button"
      className="pg-trigger-btn"
      onClick={handleStartGuide}
      title={`Quick guide for ${pageTitle}`}
      aria-label={`Open quick guide for ${pageTitle}`}
    >
      <span className="material-symbols-outlined" aria-hidden="true">help</span>
    </button>
  );
}
