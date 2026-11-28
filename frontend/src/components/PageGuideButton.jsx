import { useState } from 'react';
import GuidedTour from './GuidedTour';
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
      // Ignore invalid selector
    }
  }
  return null;
}

export default function PageGuideButton({ guideKey, title, steps: customSteps }) {
  const [isOpen, setIsOpen] = useState(false);
  const [resolvedSteps, setResolvedSteps] = useState([]);
  const [activeTheme, setActiveTheme] = useState('dark');

  const config = guideKey ? PAGE_GUIDES[guideKey] : null;
  const pageTitle = title || config?.title || 'This Page';
  const rawSteps = Array.isArray(customSteps) && customSteps.length > 0
    ? customSteps
    : (config?.steps || []);

  if (rawSteps.length === 0) return null;

  const handleOpenGuide = (e) => {
    e.stopPropagation();

    const currentTheme =
      typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light'
        ? 'light'
        : 'dark';
    setActiveTheme(currentTheme);

    const usedElements = new Set();
    const builtSteps = [];

    for (const step of rawSteps) {
      const el = resolveVisibleElement(step.selector);
      if (el && !usedElements.has(el)) {
        usedElements.add(el);
        builtSteps.push({
          target: el,
          badge: step.badge || `${pageTitle} Guide`,
          title: step.title,
          description: step.description,
          placement: step.side || step.placement || 'bottom',
          align: step.align || 'start',
          icon: step.icon || ''
        });
      }
    }

    if (builtSteps.length === 0) {
      const fallbackEl =
        document.querySelector('.admin-page-header') ||
        document.body;
      builtSteps.push({
        target: fallbackEl,
        badge: `${pageTitle} Guide`,
        title: pageTitle,
        description: rawSteps[0]?.description || `Explore the features and live controls available on ${pageTitle}.`,
        placement: 'bottom',
        align: 'start'
      });
    }

    setResolvedSteps(builtSteps);
    setIsOpen(true);
  };

  return (
    <>
      <button
        type="button"
        className="pg-trigger-btn"
        onClick={handleOpenGuide}
        title={`Page guide for ${pageTitle}`}
        aria-label={`Open page guide for ${pageTitle}`}
      >
        <span className="material-symbols-outlined" aria-hidden="true">help</span>
      </button>

      {isOpen && resolvedSteps.length > 0 && (
        <GuidedTour
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          steps={resolvedSteps}
          roleName={`${pageTitle} Guide`}
          theme={activeTheme}
          skipWelcome
          preserveTab
          disableConfetti
          skipLocalStorage
          startDelayMs={60}
        />
      )}
    </>
  );
}
