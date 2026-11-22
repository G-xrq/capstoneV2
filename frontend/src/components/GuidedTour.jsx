import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import confetti from 'canvas-confetti';
import './GuidedTour.css';

/**
 * Celebratory confetti cannon bursting outward strictly from each side of the final card
 */
const fireTourCelebration = (cardElement) => {
  try {
    const rect = cardElement?.getBoundingClientRect() || document.querySelector('.bbdrts-tour-popover')?.getBoundingClientRect();
    const winW = window.innerWidth || document.documentElement.clientWidth || 1000;
    const winH = window.innerHeight || document.documentElement.clientHeight || 800;

    let leftOriginX = 0.35;
    let rightOriginX = 0.65;
    let originY = 0.55;

    if (rect && rect.width > 0) {
      leftOriginX = Math.max(0.01, Math.min(0.99, (rect.left - 4) / winW));
      rightOriginX = Math.max(0.01, Math.min(0.99, (rect.right + 4) / winW));
      originY = Math.max(0.05, Math.min(0.95, (rect.top + rect.height * 0.5) / winH));
    }

    const brandColors = ['#22c55e', '#10b981', '#38bdf8', '#fbbf24', '#a855f7', '#ffffff', '#f43f5e'];

    // Wave 1: Immediate cannons bursting outward from EACH SIDE of the last card
    // Left side of the card shoots outward & upward to the left
    confetti({
      particleCount: 50,
      angle: 125,
      spread: 60,
      origin: { x: leftOriginX, y: originY },
      colors: brandColors,
      ticks: 240,
      gravity: 0.95,
      scalar: 1.05,
      drift: -0.15,
      disableForReducedMotion: false,
      zIndex: 2147483647
    });

    // Right side of the card shoots outward & upward to the right
    confetti({
      particleCount: 50,
      angle: 55,
      spread: 60,
      origin: { x: rightOriginX, y: originY },
      colors: brandColors,
      ticks: 240,
      gravity: 0.95,
      scalar: 1.05,
      drift: 0.15,
      disableForReducedMotion: false,
      zIndex: 2147483647
    });

    // Wave 2: Quick follow-up sparkle burst on each side of the card after 150ms
    setTimeout(() => {
      confetti({
        particleCount: 35,
        angle: 115,
        spread: 70,
        origin: { x: leftOriginX, y: originY },
        colors: brandColors,
        ticks: 220,
        gravity: 1.0,
        scalar: 0.85,
        disableForReducedMotion: false,
        zIndex: 2147483647
      });

      confetti({
        particleCount: 35,
        angle: 65,
        spread: 70,
        origin: { x: rightOriginX, y: originY },
        colors: brandColors,
        ticks: 220,
        gravity: 1.0,
        scalar: 0.85,
        disableForReducedMotion: false,
        zIndex: 2147483647
      });
    }, 150);
  } catch (err) {
    console.warn('Confetti launch error:', err);
  }
};

// Global helper for diagnostic manual testing
if (typeof window !== 'undefined') {
  window.__bbdrts_fire_confetti = fireTourCelebration;
}

// Debounced celebration trigger to guarantee exactly one celebration sequence
let lastCelebrationTimestamp = 0;
const triggerCelebration = (cardEl) => {
  const now = Date.now();
  if (now - lastCelebrationTimestamp < 2000) return;
  lastCelebrationTimestamp = now;
  fireTourCelebration(cardEl);
};

// Key Foundational Pillars for Donors (Crisp 2x2 Hairline Grid)
const DONOR_HIGHLIGHTS = [
  {
    icon: 'verified_user',
    title: 'Direct Giving · Transparent Fees',
    desc: '100% of your PHP contribution goes straight to accredited relief drives with gasless Sepolia proof.'
  },
  {
    icon: 'payments',
    title: 'GCash, Maya, Card & Bank Rails',
    desc: 'Donate in Philippine Pesos with automated receipt verification and instant cryptographic certificates.'
  },
  {
    icon: 'radar',
    title: 'Live PAGASA Doppler Radar',
    desc: 'Track real-time storm precipitation, typhoon signals, and active relief operations across LGUs.'
  },
  {
    icon: 'military_tech',
    title: '15 Recognition Tiers & Ledger',
    desc: 'Monitor your cumulative impact, analytics trends, and exportable audit receipts in one place.'
  }
];

// Key Foundational Pillars for NGOs / Organizations
const NGO_HIGHLIGHTS = [
  {
    icon: 'campaign',
    title: 'Rapid Relief Drive Deployment',
    desc: 'Launch verified emergency campaigns during active storm signals with clear funding milestones.'
  },
  {
    icon: 'qr_code_2',
    title: 'Multi-Rail PHP Payout Library',
    desc: 'Manage reusable GCash, Maya, and Bank QR vouchers with smart auto-cropping and OCR extraction.'
  },
  {
    icon: 'add_a_photo',
    title: 'Geotagged Ground-Zero Proofs',
    desc: 'Publish timestamped distribution photos and supplier receipts directly to the public audit ledger.'
  },
  {
    icon: 'assignment_turned_in',
    title: 'Audit-Ready Compliance Reports',
    desc: 'Generate transparent expenditure summaries and Sepolia-verified dossiers for partners and donors.'
  }
];

// Key Foundational Pillars for System Administrators
const ADMIN_HIGHLIGHTS = [
  {
    icon: 'verified_user',
    title: 'SEC & DSWD NGO Accreditation',
    desc: 'Verify institutional registrations, authorized signatories, and compliance documents before approval.'
  },
  {
    icon: 'account_balance',
    title: 'Multi-Rail Ledger Reconciliation',
    desc: 'Audit GCash, Maya, card, and bank receipts against immutable gasless Ethereum Sepolia records.'
  },
  {
    icon: 'inventory_2',
    title: 'Disbursement & Proof Oversight',
    desc: 'Inspect geotagged distribution evidence and milestone unlocks before releasing staged relief tranches.'
  },
  {
    icon: 'dns',
    title: 'Protocol Health & Broadcasts',
    desc: 'Monitor Sepolia RPC status, publish emergency advisories, and review sequential activity logs.'
  }
];

/**
 * Universal Guided Spotlight Onboarding Tour Component
 * Powered by Driver.js (v1.8.0) + Welcome Introduction Modal + 4-Panel Blur Surround + Header Blur Guard:
 * - High-Impact Welcome Modal introduces core platform pillars before the spotlight begins
 * - Header Blur Guard (z-index 1000000015): Sticky header ALWAYS stays blurred and protected
 * - 4-Panel backdrop blur blurs the page outside while the active box remains 100% crystal-clear
 * - Safe headroom scrolling: elements are never scrolled beneath the fixed header
 * - Popover collision prevention: guarantees tooltips never overlap the highlighted box
 * - Celebratory Confetti: Pops from both sides of the last card & screen flanks when clicking 'Got It, Let's Go!'
 */
export default function GuidedTour({
  isOpen,
  onClose,
  steps = [],
  onTabChange,
  tourKey = 'bbdrts_tour_completed',
  roleName = 'User',
  theme = 'default'
}) {
  const [tourPhase, setTourPhase] = useState('welcome');
  const driverRef = useRef(null);
  const isClosingRef = useRef(false);
  const isNavigatingStepRef = useRef(false);
  const currentStepIndexRef = useRef(0);
  const settleTimerRef = useRef(null);

  // Stable references to props to prevent re-render loops
  const stepsRef = useRef(steps);
  stepsRef.current = steps;
  const onTabChangeRef = useRef(onTabChange);
  onTabChangeRef.current = onTabChange;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const tourKeyRef = useRef(tourKey);
  tourKeyRef.current = tourKey;
  const roleNameRef = useRef(roleName);
  roleNameRef.current = roleName;
  const themeRef = useRef(theme);
  themeRef.current = theme;

  // Whenever tour opens, always start in 'welcome' mode
  useEffect(() => {
    if (isOpen) {
      setTourPhase('welcome');
    }
  }, [isOpen]);

  const handleSkipTour = () => {
    try {
      localStorage.setItem(tourKeyRef.current, 'true');
      localStorage.removeItem('bbdrts_tour_force_launch');
      localStorage.removeItem('bbdrts_is_new_registration');
    } catch (_) {}
    if (typeof onCloseRef.current === 'function') {
      onCloseRef.current();
    }
  };

  const handleStartTourSteps = () => {
    if (typeof onTabChangeRef.current === 'function') {
      try {
        onTabChangeRef.current('dashboard');
      } catch (_) {}
    }
    setTourPhase('tour');
  };

  // Keyboard accessibility: Esc closes/skips during Welcome Phase
  useEffect(() => {
    if (!isOpen || tourPhase !== 'welcome') return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleSkipTour();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, tourPhase]);

  // Driver.js Spotlight Execution (runs strictly during 'tour' phase)
  useEffect(() => {
    if (!isOpen || tourPhase !== 'tour') {
      if (driverRef.current) {
        try {
          driverRef.current.destroy();
        } catch (_) {}
        driverRef.current = null;
      }
      return;
    }

    const currentSteps = stepsRef.current || [];
    if (currentSteps.length === 0) return;

    isClosingRef.current = false;
    isNavigatingStepRef.current = false;
    currentStepIndexRef.current = 0;

    // Ensure we are settled on the dashboard view for stable layout rendering
    if (typeof onTabChangeRef.current === 'function') {
      try {
        onTabChangeRef.current('dashboard');
      } catch (_) {}
    }

    // ── 1. Dedicated Fixed Header Blur Guard ──
    const headerGuardId = 'bbdrts-tour-header-guard';
    let headerGuardEl = document.getElementById(headerGuardId);
    if (!headerGuardEl) {
      headerGuardEl = document.createElement('div');
      headerGuardEl.id = headerGuardId;
      document.body.appendChild(headerGuardEl);
    }

    // ── 2. Seamless Unified Blur Surround (Zero horizontal seams / panel lines) ──
    const surroundId = 'bbdrts-tour-blur-surround';
    let surroundEl = document.getElementById(surroundId);
    if (!surroundEl) {
      surroundEl = document.createElement('div');
      surroundEl.id = surroundId;
      document.body.appendChild(surroundEl);
    }

    // Trigger smooth fade-in for surround and header guard
    requestAnimationFrame(() => {
      if (headerGuardEl) headerGuardEl.classList.add('is-active');
      if (surroundEl) surroundEl.classList.add('is-active');
    });

    // ── Unified Synchronous Layout Engine ──
    const syncTourLayout = (targetElement, isScrollEvent = false) => {
      const el = targetElement || document.querySelector('.driver-active-element');
      const surround = document.getElementById(surroundId);
      const guard = document.getElementById(headerGuardId);
      if (!surround) return;

      const headerEl = document.querySelector('.bbdrts-main-header');
      const headerBottom = headerEl ? Math.round(headerEl.getBoundingClientRect().bottom) : 75;

      if (guard) {
        guard.style.height = `${headerBottom}px`;
      }

      const w = window.innerWidth;
      const winH = window.innerHeight;

      if (!el) {
        surround.style.clipPath = 'none';
        surround.style.webkitClipPath = 'none';
        return;
      }

      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;

      const pad = 12;
      const targetLeft = rect.left - pad;
      const targetTop = rect.top - pad;
      const targetRight = rect.right + pad;
      const targetBottom = rect.bottom + pad;

      // The spotlight hole must NEVER extend into or above the sticky header
      const y = Math.max(headerBottom, Math.min(window.innerHeight, Math.round(targetTop)));
      const x = Math.max(0, Math.min(window.innerWidth, Math.round(targetLeft)));
      const r = Math.max(0, Math.min(window.innerWidth, Math.round(targetRight)));
      const b = Math.max(y, Math.min(window.innerHeight, Math.round(targetBottom)));

      const rad = 12;
      const boxW = r - x;
      const boxH = b - y;
      const cr = Math.min(rad, boxW / 2, boxH / 2);
      const l = Math.floor(Math.max(cr, 0));
      const u = x + l;
      const d = y;
      const f = Math.max(0, boxW - l * 2);
      const p = Math.max(0, boxH - l * 2);
      const pathData = `M${w},0L0,0L0,${winH}L${w},${winH}L${w},0Z M${u},${d} h${f} a${l},${l} 0 0 1 ${l},${l} v${p} a${l},${l} 0 0 1 -${l},${l} h-${f} a${l},${l} 0 0 1 -${l},-${l} v-${p} a${l},${l} 0 0 1 ${l},-${l} z`;

      // Seamless single-element clip-path cutout: zero panel slices, zero horizontal seams
      try {
        surround.style.clipPath = `path('${pathData}')`;
        surround.style.webkitClipPath = `path('${pathData}')`;
      } catch (_) {}
      if (!surround.style.clipPath || surround.style.clipPath === 'none') {
        const poly = `polygon(evenodd, 0 0, ${w}px 0, ${w}px ${winH}px, 0 ${winH}px, 0 0, ${x}px ${y}px, ${r}px ${y}px, ${r}px ${b}px, ${x}px ${b}px, ${x}px ${y}px)`;
        surround.style.clipPath = poly;
        surround.style.webkitClipPath = poly;
      }

      // Synchronously update Driver.js SVG cutout path on every frame
      const pathEl = document.querySelector('.driver-overlay path');
      if (pathEl) {
        pathEl.setAttribute('d', pathData);
      }

      // Synchronously update popover card during manual scroll
      const popoverEl = document.querySelector('.bbdrts-tour-popover');
      if (popoverEl && isScrollEvent && !isNavigatingStepRef.current) {
        const curStep = stepsRef.current[currentStepIndexRef.current];
        const placement = curStep?.placement || 'bottom';
        const popRect = popoverEl.getBoundingClientRect();
        const offset = 14;

        if (placement === 'bottom') {
          popoverEl.style.top = `${Math.round(rect.bottom + offset)}px`;
          popoverEl.style.bottom = 'auto';
          const desiredLeft = Math.round(rect.left + (rect.width - popRect.width) / 2);
          popoverEl.style.left = `${Math.max(16, Math.min(window.innerWidth - popRect.width - 16, desiredLeft))}px`;
          popoverEl.style.right = 'auto';
        } else if (placement === 'right') {
          popoverEl.style.left = `${Math.round(rect.right + offset)}px`;
          popoverEl.style.right = 'auto';
          const desiredTop = Math.round(rect.top + (rect.height - popRect.height) / 2);
          popoverEl.style.top = `${Math.max(headerBottom + 12, Math.min(window.innerHeight - popRect.height - 16, desiredTop))}px`;
          popoverEl.style.bottom = 'auto';
        }
      }
    };

    // ── Neutralize Driver.js hardcoded scrollIntoView({ block: 'center' }) ──
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    let hasRestoredScroll = false;

    const scrollToTargetSafely = (element) => {
      if (!element) return;
      const headerEl = document.querySelector('.bbdrts-main-header');
      const headerBottom = headerEl ? Math.round(headerEl.getBoundingClientRect().bottom) : 75;

      // Sidebar target detection (Always scroll page back to top: 0)
      const isSidebar = Boolean(
        element.closest('.ref-sidebar') || 
        element.id?.includes('tab-') || 
        element.id?.includes('sepolia-node') ||
        element.classList.contains('ref-nav-item')
      );

      if (isSidebar) {
        if (window.scrollY > 0) {
          window.scrollTo({
            top: 0,
            behavior: 'smooth'
          });
        }
        const sidebar = element.closest('.ref-sidebar');
        if (sidebar && typeof element.scrollIntoView === 'function') {
          try {
            element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          } catch (_) {}
        }
        return;
      }

      // Campaign Card target detection
      const isCampaignCard = Boolean(
        element.id === 'tour-donor-first-campaign' || 
        element.closest('#tour-donor-first-campaign') ||
        element.id === 'tour-donor-featured-causes' ||
        element.closest('#tour-donor-featured-causes')
      );

      if (isCampaignCard) {
        const featuredHeadingEl = document.querySelector('#tour-donor-featured-causes');
        let targetY;
        if (featuredHeadingEl) {
          targetY = Math.max(0, Math.round(window.scrollY + featuredHeadingEl.getBoundingClientRect().top - (headerBottom + 8)));
        } else {
          targetY = Math.max(0, Math.round(window.scrollY + element.getBoundingClientRect().top - (headerBottom + 45)));
        }

        window.scrollTo({
          top: targetY,
          behavior: 'smooth'
        });
        return;
      }

      // Metrics Grid
      if (element.id === 'tour-donor-metrics' || element.closest('#tour-donor-metrics')) {
        const rect = element.getBoundingClientRect();
        const targetY = Math.max(0, Math.round(window.scrollY + rect.top - (headerBottom + 16)));
        window.scrollTo({
          top: targetY,
          behavior: 'smooth'
        });
        return;
      }

      // Other dashboard elements
      const rect = element.getBoundingClientRect();
      const availableHeight = window.innerHeight - headerBottom;

      let desiredTop;
      if (rect.height <= availableHeight - 80) {
        desiredTop = headerBottom + Math.max(16, Math.round((availableHeight - rect.height) / 2));
      } else {
        desiredTop = headerBottom + 16;
      }

      const targetY = Math.max(0, Math.round(window.scrollY + rect.top - desiredTop));
      if (Math.abs(window.scrollY - targetY) > 10) {
        window.scrollTo({
          top: targetY,
          behavior: 'smooth'
        });
      }
    };

    Element.prototype.scrollIntoView = function(options) {
      scrollToTargetSafely(this);
    };

    // ── High-Frequency Instant Tracking Scroll & Resize Handlers ──
    let scrollEndTimer = null;
    const handleScroll = () => {
      const surround = document.getElementById(surroundId);
      if (surround && !surround.classList.contains('is-scrolling')) {
        surround.classList.add('is-scrolling');
      }

      syncTourLayout(null, true);

      clearTimeout(scrollEndTimer);
      scrollEndTimer = setTimeout(() => {
        if (surround) surround.classList.remove('is-scrolling');
        if (driverRef.current) {
          try {
            driverRef.current.refresh();
          } catch (_) {}
        }
        syncTourLayout();
      }, 120);
    };

    const handleResize = () => {
      syncTourLayout();
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });

    const cleanupSurround = () => {
      if (!hasRestoredScroll) {
        hasRestoredScroll = true;
        Element.prototype.scrollIntoView = originalScrollIntoView;
      }
      clearTimeout(scrollEndTimer);
      clearTimeout(settleTimerRef.current);
      document.body.classList.remove('tour-traveling');
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);

      const s = document.getElementById(surroundId);
      const g = document.getElementById(headerGuardId);
      if (s) s.classList.remove('is-active');
      if (g) g.classList.remove('is-active');

      setTimeout(() => {
        if (s) s.remove();
        if (g) g.remove();
      }, 260);

      document.body.classList.remove('tour-mobile-sidebar-active');
      try {
        window.dispatchEvent(new CustomEvent('bbdrts_tour_sidebar', { detail: { open: false } }));
      } catch (_) {}
    };

    let mobileSidebarCurrentlyOpen = false;
    const isMobileViewport = () => typeof window !== 'undefined' && window.innerWidth <= 900;
    const isElementInSidebar = (el) => Boolean(el && typeof el.closest === 'function' && el.closest('.ref-sidebar'));

    const syncMobileSidebarForElement = (el) => {
      if (!isMobileViewport()) {
        if (mobileSidebarCurrentlyOpen) {
          mobileSidebarCurrentlyOpen = false;
          document.body.classList.remove('tour-mobile-sidebar-active');
          window.dispatchEvent(new CustomEvent('bbdrts_tour_sidebar', { detail: { open: false } }));
        }
        return false;
      }
      const needsSidebar = isElementInSidebar(el);
      const changed = needsSidebar !== mobileSidebarCurrentlyOpen;
      mobileSidebarCurrentlyOpen = needsSidebar;
      document.body.classList.toggle('tour-mobile-sidebar-active', needsSidebar);
      window.dispatchEvent(new CustomEvent('bbdrts_tour_sidebar', { detail: { open: needsSidebar } }));
      return changed;
    };

    const totalSteps = currentSteps.length;
    const currentRole = roleNameRef.current;
    const currentTheme = themeRef.current;

    // Guarantee that every single step has a valid, existing DOM element
    const resolveTargetElement = (targetSelector, idx) => {
      let el = null;
      if (typeof targetSelector === 'string') {
        try {
          el = document.querySelector(targetSelector);
        } catch (_) {}
      } else if (targetSelector instanceof Element) {
        el = targetSelector;
      }

      if (el) return el;

      // Intelligent Fallbacks so a step is NEVER skipped or missing
      if (typeof targetSelector === 'string') {
        if (targetSelector.includes('sepolia-node') || idx === totalSteps - 1) {
          el = document.querySelector('.ref-sidebar-footer-group') || 
               document.querySelector('.ref-nav-item-tutorial') ||
               document.querySelector('.ref-sidebar-menu');
        } else if (targetSelector.includes('campaign')) {
          el = document.querySelector('#tour-donor-featured-causes') || 
               document.querySelector('.dbo-clean-card') || 
               document.querySelector('.campaign-card') ||
               document.querySelector('.dbo-section-wrapper');
        } else if (targetSelector.includes('badge')) {
          el = document.querySelector('#tour-donor-welcome') || 
               document.querySelector('.admin-page-header');
        } else if (targetSelector.includes('tab-')) {
          el = document.querySelector('.ref-sidebar-menu button') || 
               document.querySelector('.ref-sidebar');
        }
      }

      return el || document.querySelector('.admin-page-header') || document.querySelector('.ref-sidebar') || document.body;
    };

    const driverSteps = currentSteps.map((s, idx) => {
      const isLastStep = idx === totalSteps - 1;
      const targetElement = resolveTargetElement(s.target, idx);
      const rawBadge = s.badge || `${currentRole} Walkthrough`;
      // Strip any redundant 'Step X of Y' so it never repeats the footer progress text
      const badgeText = rawBadge.replace(/^Step\s+\d+\s+of\s+\d+\s*•?\s*/i, '').trim();
      const iconHtml = s.icon
        ? `<span class="material-symbols-outlined driver-step-icon">${s.icon}</span>`
        : '';

      const progressPct = Math.round(((idx + 1) / Math.max(1, totalSteps)) * 100);
      const popoverTitle = `
        <div class="gt-progress-bar" aria-hidden="true">
          <span class="gt-progress-fill" style="width:${progressPct}%"></span>
        </div>
        <div class="driver-popover-badge">
          <span class="bbdrts-scope-dot" aria-hidden="true"></span>
          <span>${badgeText}</span>
        </div>
        <div class="driver-step-title-row">
          <span>${s.title || ''}</span>
        </div>
      `;

      return {
        element: targetElement,
        popover: {
          title: popoverTitle,
          description: s.description || '',
          side: (isMobileViewport() && isElementInSidebar(targetElement))
            ? (isLastStep ? 'top' : 'bottom')
            : (s.placement || 'bottom'),
          align: (isMobileViewport() && isElementInSidebar(targetElement))
            ? 'start'
            : (s.align || 'start'),
          showButtons: idx === 0 ? ['next', 'close'] : ['previous', 'next', 'close'],
          nextBtnText: isLastStep ? 'Finish' : 'Next',
          prevBtnText: 'Back',
          // Step-level completion hooks guaranteeing confetti fires on last step
          onNextClick: isLastStep
            ? () => {
                const popoverEl = document.querySelector('.bbdrts-tour-popover');
                triggerCelebration(popoverEl);
                setTimeout(() => {
                  try {
                    driverRef.current?.destroy();
                  } catch (_) {}
                }, 260);
              }
            : () => {
                document.body.classList.add('tour-traveling');
                clearTimeout(settleTimerRef.current);
                driverRef.current?.moveNext();
              },
          onDoneClick: () => {
            const popoverEl = document.querySelector('.bbdrts-tour-popover');
            triggerCelebration(popoverEl);
            setTimeout(() => {
              try {
                driverRef.current?.destroy();
              } catch (_) {}
            }, 260);
          }
        }
      };
    });

    const driverObj = driver({
      showProgress: true,
      animate: false,
      smoothScroll: false,
      allowClose: true,
      skipMissingElement: false,
      stagePadding: 8,
      stageRadius: 8,
      popoverOffset: 12,
      overlayColor: 'rgba(0, 0, 0, 0.65)',
      overlayClickBehavior: () => {
        // Deliberate no-op: prevents accidental dismissal
      },
      popoverClass: `bbdrts-tour-popover theme-${currentTheme}`,
      progressText: '{{current}} / {{total}}',
      steps: driverSteps,
      onDoneClick: () => {
        const popoverEl = document.querySelector('.bbdrts-tour-popover');
        triggerCelebration(popoverEl);
        setTimeout(() => {
          try {
            driverRef.current?.destroy();
          } catch (_) {}
        }, 260);
      },
      onHighlightStarted: (element, step, { state }) => {
        isNavigatingStepRef.current = true;
        currentStepIndexRef.current = state?.activeIndex || 0;

        clearTimeout(settleTimerRef.current);
        document.body.classList.add('tour-traveling');

        const sidebarToggled = syncMobileSidebarForElement(element);
        if (!isElementInSidebar(element)) {
          scrollToTargetSafely(element);
        }
        if (!sidebarToggled) {
          syncTourLayout(element);
        }
      },
      onHighlighted: (element, step, { state }) => {
        currentStepIndexRef.current = state?.activeIndex || 0;
        document.body.classList.add('tour-traveling');

        const sidebarToggled = syncMobileSidebarForElement(element);
        const settleDelay = (isMobileViewport() && (sidebarToggled || isElementInSidebar(element))) ? 320 : 210;

        clearTimeout(settleTimerRef.current);
        settleTimerRef.current = setTimeout(() => {
          if (driverRef.current) {
            try {
              driverRef.current.refresh();
            } catch (_) {}
          }
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              syncTourLayout(element);
              document.body.classList.remove('tour-traveling');
              isNavigatingStepRef.current = false;
            });
          });
        }, settleDelay);
      },
      onCloseClick: () => {
        if (driverRef.current) {
          try {
            driverRef.current.destroy();
          } catch (_) {}
        }
      },
      onPopoverRender: (popoverDOM) => {
        if (!popoverDOM) return;
        
        // Immediate pointerdown celebration trigger on the final step's button
        if (popoverDOM.nextButton && !popoverDOM.nextButton._hasBBDRTSTourCelebration) {
          popoverDOM.nextButton._hasBBDRTSTourCelebration = true;
          popoverDOM.nextButton.addEventListener('pointerdown', () => {
            const isLast = currentStepIndexRef.current === totalSteps - 1;
            if (isLast) {
              triggerCelebration(popoverDOM.wrapper);
            }
          });
        }

        if (popoverDOM.previousButton && !popoverDOM.previousButton._hasBBDRTSTourHandler) {
          popoverDOM.previousButton._hasBBDRTSTourHandler = true;
          popoverDOM.previousButton.addEventListener('click', () => {
            document.body.classList.add('tour-traveling');
            clearTimeout(settleTimerRef.current);
          });
        }

        if (popoverDOM.closeButton) {
          popoverDOM.closeButton.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">close</span>';
          popoverDOM.closeButton.setAttribute('title', 'Close tutorial (Esc)');
          popoverDOM.closeButton.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (driverRef.current) {
              try {
                driverRef.current.destroy();
              } catch (_) {}
            }
          };
        }
      },
      onDestroyed: () => {
        document.body.classList.remove('tour-traveling');
        cleanupSurround();
        if (!isClosingRef.current) {
          isClosingRef.current = true;
          try {
            localStorage.setItem(tourKeyRef.current, 'true');
            localStorage.removeItem('bbdrts_tour_force_launch');
            localStorage.removeItem('bbdrts_is_new_registration');
          } catch (_) {}
          if (typeof onCloseRef.current === 'function') {
            onCloseRef.current();
          }
        }
        driverRef.current = null;
      }
    });

    driverRef.current = driverObj;

    const timer = setTimeout(() => {
      try {
        driverObj.drive();
        syncTourLayout();
      } catch (err) {
        console.warn('Driver.js drive() error:', err);
      }
    }, 380);

    return () => {
      clearTimeout(timer);
      cleanupSurround();
      if (driverRef.current) {
        try {
          driverRef.current.destroy();
        } catch (_) {}
        driverRef.current = null;
      }
    };
  }, [isOpen, tourPhase]);

  // If not open, render nothing
  if (!isOpen) return null;

  // ── Phase 1: Clean Vercel Geist Welcome Dialog ──
  if (tourPhase === 'welcome') {
    const isDonor = roleName.toLowerCase().includes('donor');
    const isAdmin = roleName.toLowerCase().includes('admin');
    const isNgo = !isDonor && !isAdmin;

    let highlights = DONOR_HIGHLIGHTS;
    let badgeText = 'Donor Portal';
    let titleText = 'Welcome to BBDRTS';
    let subtitleText = 'Direct Philippine Peso disaster relief with gasless Ethereum Sepolia notarization.';

    if (isAdmin) {
      highlights = ADMIN_HIGHLIGHTS;
      badgeText = 'Protocol Administration';
      titleText = 'BBDRTS Admin Console';
      subtitleText = 'Centralized oversight of accredited NGOs, multi-rail relief ledgers, and on-chain audit health.';
    } else if (isNgo) {
      highlights = NGO_HIGHLIGHTS;
      badgeText = 'NGO Operations';
      titleText = 'BBDRTS Relief Operations';
      subtitleText = 'Deploy emergency drives, manage reusable QR payout rails, and publish verified distribution proofs.';
    }

    const walkthroughCount = steps.length || 8;

    if (typeof document === 'undefined') return null;

    return createPortal(
      <div
        className="bbdrts-welcome-backdrop"
        onClick={handleSkipTour}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bbdrts-welcome-heading"
      >
        <div
          className={`bbdrts-welcome-modal theme-${theme}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Minimal Header */}
          <div className="gt-welcome-head">
            <div className="gt-welcome-head-copy">
              <div className="gt-welcome-eyebrow">
                <span className="bbdrts-scope-dot" aria-hidden="true" />
                <span>BBDRTS · {badgeText}</span>
              </div>
              <h2 id="bbdrts-welcome-heading" className="gt-welcome-title">{titleText}</h2>
              <p className="gt-welcome-sub">{subtitleText}</p>
            </div>
            <button
              type="button"
              className="bbdrts-welcome-close"
              onClick={handleSkipTour}
              title="Close tutorial (Esc)"
              aria-label="Close tutorial"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>close</span>
            </button>
          </div>

          {/* Clean 2x2 Hairline Pillar Grid (Zero Nested Boxes) */}
          <div className="gt-welcome-body">
            <div className="gt-pillar-grid">
              {highlights.map((item, idx) => (
                <div key={idx} className="gt-pillar-cell">
                  <div className="gt-pillar-top">
                    <span className="material-symbols-outlined gt-pillar-icon">{item.icon}</span>
                    <span className="gt-pillar-title">{item.title}</span>
                  </div>
                  <p className="gt-pillar-desc">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Signature Vercel Recessed Footer */}
          <div className="gt-welcome-foot">
            <div className="gt-welcome-meta">
              <span>{walkthroughCount}-step spotlight tour</span>
              <span className="gt-dot-sep">·</span>
              <span>Press <kbd>Esc</kbd> to skip</span>
            </div>
            <div className="bbdrts-welcome-buttons">
              <button
                type="button"
                className="bbdrts-btn-skip"
                onClick={handleSkipTour}
              >
                Skip
              </button>
              <button
                type="button"
                className="bbdrts-btn-start"
                onClick={handleStartTourSteps}
              >
                <span>Start Walkthrough</span>
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  // Tour phase runs Driver.js via DOM side-effects
  return null;
}
