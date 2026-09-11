import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import confetti from 'canvas-confetti';
import './GuidedTour.css';

/**
 * Celebratory confetti cannon bursting outward from each side of the final card and screen
 */
const fireTourCelebration = (cardElement) => {
  try {
    const rect = cardElement?.getBoundingClientRect() || document.querySelector('.bbdrts-tour-popover')?.getBoundingClientRect();
    const winW = window.innerWidth || document.documentElement.clientWidth || 1000;
    const winH = window.innerHeight || document.documentElement.clientHeight || 800;

    let leftOriginX = 0.2;
    let rightOriginX = 0.8;
    let originY = 0.55;

    if (rect && rect.width > 0) {
      leftOriginX = Math.max(0.04, Math.min(0.96, (rect.left - 12) / winW));
      rightOriginX = Math.max(0.04, Math.min(0.96, (rect.right + 12) / winW));
      originY = Math.max(0.08, Math.min(0.92, (rect.top + rect.height * 0.5) / winH));
    }

    const brandColors = ['#22c55e', '#10b981', '#38bdf8', '#fbbf24', '#a855f7', '#ffffff', '#f43f5e'];

    // Wave 1: Immediate celebratory cannons popping from EACH SIDE of the card
    confetti({
      particleCount: 55,
      angle: 125, // shoots outward & upward to the left of the card
      spread: 65,
      origin: { x: leftOriginX, y: originY },
      colors: brandColors,
      ticks: 260,
      gravity: 0.95,
      scalar: 1.1,
      drift: -0.15,
      disableForReducedMotion: false,
      zIndex: 2147483647
    });

    confetti({
      particleCount: 55,
      angle: 55, // shoots outward & upward to the right of the card
      spread: 65,
      origin: { x: rightOriginX, y: originY },
      colors: brandColors,
      ticks: 260,
      gravity: 0.95,
      scalar: 1.1,
      drift: 0.15,
      disableForReducedMotion: false,
      zIndex: 2147483647
    });

    // Dual screen-side edge bursts popping across the screen
    confetti({
      particleCount: 45,
      angle: 60,
      spread: 60,
      origin: { x: 0.04, y: 0.72 },
      colors: brandColors,
      ticks: 260,
      gravity: 0.95,
      scalar: 1.0,
      disableForReducedMotion: false,
      zIndex: 2147483647
    });

    confetti({
      particleCount: 45,
      angle: 120,
      spread: 60,
      origin: { x: 0.96, y: 0.72 },
      colors: brandColors,
      ticks: 260,
      gravity: 0.95,
      scalar: 1.0,
      disableForReducedMotion: false,
      zIndex: 2147483647
    });

    // Wave 2: Sparkling burst from each side after 180ms
    setTimeout(() => {
      confetti({
        particleCount: 40,
        angle: 115,
        spread: 75,
        origin: { x: leftOriginX, y: originY },
        colors: brandColors,
        ticks: 240,
        gravity: 1.05,
        scalar: 0.85,
        disableForReducedMotion: false,
        zIndex: 2147483647
      });

      confetti({
        particleCount: 40,
        angle: 65,
        spread: 75,
        origin: { x: rightOriginX, y: originY },
        colors: brandColors,
        ticks: 240,
        gravity: 1.05,
        scalar: 0.85,
        disableForReducedMotion: false,
        zIndex: 2147483647
      });
    }, 180);

    // Wave 3: Golden & emerald sparkle shower raining from top after 360ms
    setTimeout(() => {
      confetti({
        particleCount: 50,
        spread: 100,
        origin: { x: 0.5, y: 0.25 },
        colors: ['#22c55e', '#fbbf24', '#ffffff', '#38bdf8'],
        ticks: 280,
        gravity: 0.85,
        scalar: 1.0,
        disableForReducedMotion: false,
        zIndex: 2147483647
      });
    }, 360);
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

// Key Foundational Pillars for Donors
const DONOR_HIGHLIGHTS = [
  {
    icon: 'verified_user',
    color: '#22c55e',
    title: '100% Direct Giving • 0% Platform Fees',
    desc: 'Zero intermediary deductions. Smart contracts ensure 100% of your contributions go straight to verified relief campaigns.'
  },
  {
    icon: 'currency_exchange',
    color: '#38bdf8',
    title: 'Dual Web3 & Philippine E-Wallet Rails',
    desc: 'Donate via Sepolia Ethereum crypto or standard Philippine fiat QR (GCash & Maya) with instant cryptographic receipt hashing.'
  },
  {
    icon: 'military_tech',
    color: '#fbbf24',
    title: '12-Tier Honors Ladder & Soulbound Badges',
    desc: 'Climb from Bayanihan Starter to National Hero. Earn permanent on-chain soulbound NFT badges and leaderboard recognition.'
  },
  {
    icon: 'radar',
    color: '#a855f7',
    title: 'Live PAGASA Doppler Weather Radar',
    desc: 'Real-time satellite storm tracking, typhoon signals, and affected LGU impact heatmaps directly connected to active relief operations.'
  },
  {
    icon: 'lock_clock',
    color: '#10b981',
    title: 'Milestone Escrows & Geotagged Proofs',
    desc: 'Funds unlock in staged tranches. NGOs must upload timestamped, geotagged photos and verified beneficiary distribution logs.'
  },
  {
    icon: 'receipt_long',
    color: '#f43f5e',
    title: 'Instant Official Tax & Audit Receipts',
    desc: 'Generate one-click verifiable BIR-compliant donation certificates with cryptographic transaction hashes for seamless tax reporting.'
  }
];

// Key Foundational Pillars for NGOs / Organizations
const NGO_HIGHLIGHTS = [
  {
    icon: 'campaign',
    color: '#22c55e',
    title: 'Instant Relief Drive Deployment',
    desc: 'Deploy verified emergency disaster relief drives in seconds during active PAGASA typhoon signals with targeted beneficiary quotas.'
  },
  {
    icon: 'lock_clock',
    color: '#38bdf8',
    title: 'Milestone-Based Escrow Transparency',
    desc: 'Release relief funding in staged tranches. Provide complete public accountability with cryptographically sealed expense ledgers.'
  },
  {
    icon: 'radar',
    color: '#a855f7',
    title: 'PAGASA Doppler Radar & Impact Zones',
    desc: 'Map relief operations directly to live Doppler radar typhoon tracks, storm signals, and high-risk calamity zones across Philippine LGUs.'
  },
  {
    icon: 'add_a_photo',
    color: '#fbbf24',
    title: 'Geotagged Ground-Zero Proofs',
    desc: 'Upload timestamped, geotagged photos of supply distribution and supplier receipts directly onto the immutable blockchain ledger.'
  },
  {
    icon: 'payments',
    color: '#10b981',
    title: 'Dual Currency Disbursements',
    desc: 'Receive both Sepolia ETH crypto donations and direct Philippine e-wallet (GCash / Maya) funds for rapid local procurement.'
  },
  {
    icon: 'assignment_turned_in',
    color: '#f43f5e',
    title: 'Automated Compliance & Audit Reports',
    desc: 'Generate one-click audit-ready PDF dossiers and transparent expenditure summaries for governing bodies, partners, and donors.'
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

    // ── 2. 4-Panel Blur Surround ──
    const surroundId = 'bbdrts-tour-blur-surround';
    let surroundEl = document.getElementById(surroundId);
    if (!surroundEl) {
      surroundEl = document.createElement('div');
      surroundEl.id = surroundId;
      surroundEl.innerHTML = `
        <div class="bbdrts-blur-panel bbdrts-blur-top"></div>
        <div class="bbdrts-blur-panel bbdrts-blur-bottom"></div>
        <div class="bbdrts-blur-panel bbdrts-blur-left"></div>
        <div class="bbdrts-blur-panel bbdrts-blur-right"></div>
      `;
      document.body.appendChild(surroundEl);
    }

    // Trigger smooth fade-in for surround and header guard
    requestAnimationFrame(() => {
      if (headerGuardEl) headerGuardEl.classList.add('is-active');
      if (surroundEl) surroundEl.classList.add('is-active');
    });

    const topP = surroundEl.querySelector('.bbdrts-blur-top');
    const bottomP = surroundEl.querySelector('.bbdrts-blur-bottom');
    const leftP = surroundEl.querySelector('.bbdrts-blur-left');
    const rightP = surroundEl.querySelector('.bbdrts-blur-right');

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

      if (!el || !topP || !bottomP || !leftP || !rightP) {
        if (topP) {
          topP.style.top = '0px';
          topP.style.left = '0px';
          topP.style.width = '100vw';
          topP.style.height = '100vh';
        }
        if (bottomP) { bottomP.style.height = '0px'; }
        if (leftP) { leftP.style.width = '0px'; }
        if (rightP) { rightP.style.width = '0px'; }
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
      const h = Math.max(0, b - y);

      topP.style.top = '0px';
      topP.style.left = '0px';
      topP.style.width = '100vw';
      topP.style.height = `${y}px`;

      bottomP.style.top = `${b}px`;
      bottomP.style.left = '0px';
      bottomP.style.width = '100vw';
      bottomP.style.height = `${Math.max(0, window.innerHeight - b)}px`;

      leftP.style.top = `${y}px`;
      leftP.style.left = '0px';
      leftP.style.width = `${x}px`;
      leftP.style.height = `${h}px`;

      rightP.style.top = `${y}px`;
      rightP.style.left = `${r}px`;
      rightP.style.width = `${Math.max(0, window.innerWidth - r)}px`;
      rightP.style.height = `${h}px`;

      // Synchronously update Driver.js SVG cutout path on every frame
      const pathEl = document.querySelector('.driver-overlay path');
      if (pathEl) {
        const rad = 12;
        const w = window.innerWidth;
        const winH = window.innerHeight;
        const boxW = rect.width + pad * 2;
        const boxH = rect.height + pad * 2;
        const cr = Math.min(rad, boxW / 2, boxH / 2);
        const l = Math.floor(Math.max(cr, 0));
        const u = rect.left - pad + l;
        const d = rect.top - pad;
        const f = boxW - l * 2;
        const p = boxH - l * 2;
        pathEl.setAttribute(
          'd',
          `M${w},0L0,0L0,${winH}L${w},${winH}L${w},0Z M${u},${d} h${f} a${l},${l} 0 0 1 ${l},${l} v${p} a${l},${l} 0 0 1 -${l},${l} h-${f} a${l},${l} 0 0 1 -${l},-${l} v-${p} a${l},${l} 0 0 1 ${l},-${l} z`
        );
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
    };

    const totalSteps = currentSteps.length;
    const currentRole = roleNameRef.current;
    const currentTheme = themeRef.current;

    const driverSteps = currentSteps.map((s, idx) => {
      const stepNumber = idx + 1;
      const isLastStep = idx === totalSteps - 1;
      const badgeText = s.badge || `Step ${stepNumber} of ${totalSteps} • ${currentRole} Tutorial`;
      const iconHtml = s.icon
        ? `<span class="material-symbols-outlined driver-step-icon">${s.icon}</span>`
        : '';

      const popoverTitle = `
        <div class="driver-popover-badge">
          <span class="material-symbols-outlined" style="font-size: 13px;">help</span>
          <span>${badgeText}</span>
        </div>
        <div class="driver-step-title-row">
          ${iconHtml}
          <span>${s.title || ''}</span>
        </div>
      `;

      return {
        element: s.target,
        popover: {
          title: popoverTitle,
          description: s.description || '',
          side: s.placement || 'bottom',
          align: s.align || 'start',
          showButtons: idx === 0 ? ['next', 'close'] : ['previous', 'next', 'close'],
          nextBtnText: isLastStep ? "Got It, Let's Go! ✓" : 'Next →',
          prevBtnText: '← Back',
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
      skipMissingElement: true,
      stagePadding: 12,
      stageRadius: 12,
      popoverOffset: 14,
      overlayColor: 'rgba(0, 0, 0, 0.45)',
      overlayClickBehavior: () => {
        // Deliberate no-op: prevents accidental dismissal
      },
      popoverClass: `bbdrts-tour-popover theme-${currentTheme}`,
      progressText: 'Step {{current}} of {{total}}',
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

        scrollToTargetSafely(element);
        syncTourLayout(element);
      },
      onHighlighted: (element, step, { state }) => {
        currentStepIndexRef.current = state?.activeIndex || 0;
        document.body.classList.add('tour-traveling');

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
        }, 340);
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
          popoverDOM.closeButton.innerHTML = '✕';
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

  // ── Phase 1: High-Impact Welcome Modal ──
  if (tourPhase === 'welcome') {
    const isDonor = roleName.toLowerCase().includes('donor');
    const highlights = isDonor ? DONOR_HIGHLIGHTS : NGO_HIGHLIGHTS;
    const headerEmblem = isDonor ? 'volunteer_activism' : 'corporate_fare';
    const badgeText = isDonor ? 'BBDRTS PHILIPPINES • DIRECT GIVING NETWORK' : 'BBDRTS PHILIPPINES • RELIEF OPERATIONS';
    const titleText = isDonor
      ? 'Welcome to BBDRTS: Direct, Transparent Disaster Giving'
      : 'Welcome to BBDRTS: Decentralized Relief Operations';
    const subtitleText = isDonor
      ? 'The first blockchain-powered disaster response network built for the Philippines. Explore what makes our ecosystem truly direct and transparent before taking the 8-step walkthrough:'
      : 'Deploy verified emergency relief drives, manage milestone escrows with total public transparency, and deliver accountability across the Philippines:';

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
          {/* Top Right Close Button */}
          <button 
            type="button" 
            className="bbdrts-welcome-close" 
            onClick={handleSkipTour}
            title="Close (Esc)"
          >
            ✕
          </button>

          {/* Modal Header */}
          <div className="bbdrts-welcome-header">
            <div className="bbdrts-welcome-emblem">
              <span className="material-symbols-outlined">{headerEmblem}</span>
            </div>
            <div>
              <div className="bbdrts-welcome-badge">
                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>verified</span>
                <span>{badgeText}</span>
              </div>
              <h2 id="bbdrts-welcome-heading" className="bbdrts-welcome-title">{titleText}</h2>
              <p className="bbdrts-welcome-subtitle">{subtitleText}</p>
            </div>
          </div>

          {/* 6 Key Architectural Pillars */}
          <div className="bbdrts-welcome-grid">
            {highlights.map((item, idx) => (
              <div key={idx} className="bbdrts-welcome-card">
                <div 
                  className="bbdrts-welcome-card-icon"
                  style={{
                    backgroundColor: `${item.color}18`,
                    color: item.color,
                    border: `1px solid ${item.color}35`
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>{item.icon}</span>
                </div>
                <div>
                  <div className="bbdrts-welcome-card-title">{item.title}</div>
                  <p className="bbdrts-welcome-card-desc">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Scope Indicator */}
          <div className="bbdrts-welcome-scope">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--tour-accent, #22c55e)' }}>explore</span>
              <span><strong>8-Step Spotlight Walkthrough</strong> covers your live metrics, campaigns, radar, and actions.</span>
            </div>
            <span style={{ fontSize: '0.72rem', opacity: 0.8 }}>Sepolia Testnet • 100% On-Chain</span>
          </div>

          {/* Actions */}
          <div className="bbdrts-welcome-actions">
            <button 
              type="button" 
              className="bbdrts-btn-skip" 
              onClick={handleSkipTour}
            >
              Explore on My Own
            </button>
            <button 
              type="button" 
              className="bbdrts-btn-start" 
              onClick={handleStartTourSteps}
            >
              <span>Start Guided Spotlight Tour</span>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_forward</span>
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  // Tour phase runs Driver.js via DOM side-effects
  return null;
}
