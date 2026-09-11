import { useEffect, useRef } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import './GuidedTour.css';

/**
 * Universal Guided Spotlight Onboarding Tour Component
 * Powered by Driver.js (v1.8.0) + 4-Panel Blur Surround + Header Blur Guard:
 * - Header Blur Guard (z-index 1000000015): Sticky header ALWAYS stays blurred and protected
 * - 4-Panel backdrop blur blurs the page outside while the active box remains 100% crystal-clear
 * - Safe headroom scrolling: elements are never scrolled beneath the fixed header
 * - Popover collision prevention: guarantees tooltips never overlap the highlighted box
 * - Native onDestroyed lifecycle for 100% reliable close button ('✕') and Escape key handling
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

  useEffect(() => {
    if (!isOpen) {
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

    // Ensure we are settled on the dashboard view for stable layout rendering (one-time on open)
    if (typeof onTabChangeRef.current === 'function') {
      try {
        onTabChangeRef.current('dashboard');
      } catch (_) {}
    }

    // ── 1. Dedicated Fixed Header Blur Guard ──
    // Pinned above the sticky navbar (z-index: 1000000015) so the header NEVER goes clear
    const headerGuardId = 'bbdrts-tour-header-guard';
    let headerGuardEl = document.getElementById(headerGuardId);
    if (!headerGuardEl) {
      headerGuardEl = document.createElement('div');
      headerGuardEl.id = headerGuardId;
      document.body.appendChild(headerGuardEl);
    }

    // ── 2. 4-Panel Blur Surround ──
    // Blurs page outside the active box while keeping the interior 100% crystal-clear
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

    // Trigger smooth fade-in for surround and header guard (Point 3 fix)
    requestAnimationFrame(() => {
      if (headerGuardEl) headerGuardEl.classList.add('is-active');
      if (surroundEl) surroundEl.classList.add('is-active');
    });

    const topP = surroundEl.querySelector('.bbdrts-blur-top');
    const bottomP = surroundEl.querySelector('.bbdrts-blur-bottom');
    const leftP = surroundEl.querySelector('.bbdrts-blur-left');
    const rightP = surroundEl.querySelector('.bbdrts-blur-right');

    // ── Unified Synchronous Layout Engine ──
    // Locks blur panels, SVG overlay cutout, and floating card to target element with 0ms latency (Points 4 & 5 fix)
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

      // CRUCIAL: The spotlight hole must NEVER extend into or above the sticky header
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

      // Synchronously update Driver.js SVG cutout path on every frame (Point 4 fix)
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

      // Synchronously update popover card during manual scroll (Point 5 fix)
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
    // Driver.js hardcodes `block: n ? 'start' : 'center'`. Because card height < window height,
    // Driver.js forcibly centers the card vertically, squishing bottom clearance and forcing
    // the popover on top of the card (Image 1). Intercepting scrollIntoView ensures our
    // calibrated camera angles hold rock-solid (Image 2).
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    let hasRestoredScroll = false;

    // Safe scrolling: guarantees elements are comfortably positioned below the header
    const scrollToTargetSafely = (element) => {
      if (!element) return;
      const headerEl = document.querySelector('.bbdrts-main-header');
      const headerBottom = headerEl ? Math.round(headerEl.getBoundingClientRect().bottom) : 75;

      // Case 1: Sidebar target detection (Steps 5, 6, 7, 8 etc.)
      // Always scroll page back to top: 0 so the entire sidebar and header are fully visible
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

      // Case 2: Step 4 First Campaign Card (Image 2 camera angle)
      // The camera MUST scroll down so that "Featured Relief Causes" header is at the top
      // right below the sticky header, framing the campaign card at the top and leaving
      // ample room below for the popover card!
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
          // Position Featured Relief Causes heading 8px below the sticky header (Matching Image 2)
          targetY = Math.max(0, Math.round(window.scrollY + featuredHeadingEl.getBoundingClientRect().top - (headerBottom + 8)));
        } else {
          // Fallback directly to the card: top of card 45px below header
          targetY = Math.max(0, Math.round(window.scrollY + element.getBoundingClientRect().top - (headerBottom + 45)));
        }

        window.scrollTo({
          top: targetY,
          behavior: 'smooth'
        });
        return;
      }

      // Case 3: Step 3 Metrics Grid
      if (element.id === 'tour-donor-metrics' || element.closest('#tour-donor-metrics')) {
        const rect = element.getBoundingClientRect();
        const targetY = Math.max(0, Math.round(window.scrollY + rect.top - (headerBottom + 16)));
        window.scrollTo({
          top: targetY,
          behavior: 'smooth'
        });
        return;
      }

      // Case 4: Other dashboard elements:
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

    // Override scrollIntoView on Element.prototype while tour is active
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

      // Synchronous instant layout sync on every scroll tick (0ms latency!)
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
          nextBtnText: idx === totalSteps - 1 ? "Got It, Let's Go! ✓" : 'Next →',
          prevBtnText: '← Back',
        }
      };
    });

    const driverObj = driver({
      showProgress: true,
      animate: false, // Prevents Driver.js from delaying popover mounting or animating its own intermediate state
      smoothScroll: false, // Handled by our custom safe headroom scrolling
      allowClose: true,
      skipMissingElement: true,
      stagePadding: 12,
      stageRadius: 12,
      popoverOffset: 14,
      overlayColor: 'rgba(0, 0, 0, 0.45)', // Cinematic dark tint complementing 4-panel blur
      // Safe backdrop behavior: Clicking outside does NOT dismiss the tour mid-tutorial
      overlayClickBehavior: () => {
        // Deliberate no-op: prevents accidental dismissal when reading or clicking around
      },
      popoverClass: `bbdrts-tour-popover theme-${currentTheme}`,
      progressText: 'Step {{current}} of {{total}}',
      steps: driverSteps,
      onHighlightStarted: (element, step, { state }) => {
        isNavigatingStepRef.current = true;
        currentStepIndexRef.current = state?.activeIndex || 0;

        // Hide popover immediately via body class so it NEVER renders at old coordinates
        clearTimeout(settleTimerRef.current);
        document.body.classList.add('tour-traveling');

        // Smoothly scroll camera to the calibrated target
        scrollToTargetSafely(element);

        // Smoothly morph blur cutout towards target element
        syncTourLayout(element);
      },
      onHighlighted: (element, step, { state }) => {
        currentStepIndexRef.current = state?.activeIndex || 0;

        // Keep popover strictly hidden while camera smooth scroll is traveling
        document.body.classList.add('tour-traveling');

        // Settle timer: Once smooth scroll arrives at destination (~320ms), reveal popover at exact position
        clearTimeout(settleTimerRef.current);
        settleTimerRef.current = setTimeout(() => {
          if (driverRef.current) {
            try {
              driverRef.current.refresh();
            } catch (_) {}
          }
          // Wait two animation frames so Driver.js's internal refresh requestAnimationFrame has finished
          // recalculating the popover and arrow coordinates BEFORE making the popover visible!
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              syncTourLayout(element);
              // Reveal popover with silky fade-in directly at final resting position!
              document.body.classList.remove('tour-traveling');
              isNavigatingStepRef.current = false;
            });
          });
        }, 320);

        // Backup stabilization tick at 520ms
        setTimeout(() => {
          if (driverRef.current) {
            try {
              driverRef.current.refresh();
            } catch (_) {}
          }
          syncTourLayout(element);
        }, 520);
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
        // Instantly hide card the millisecond the user clicks Next or Back
        if (popoverDOM.nextButton && !popoverDOM.nextButton._hasBBDRTSTourHandler) {
          popoverDOM.nextButton._hasBBDRTSTourHandler = true;
          popoverDOM.nextButton.addEventListener('click', () => {
            document.body.classList.add('tour-traveling');
            clearTimeout(settleTimerRef.current);
          }, { capture: true });
        }
        if (popoverDOM.previousButton && !popoverDOM.previousButton._hasBBDRTSTourHandler) {
          popoverDOM.previousButton._hasBBDRTSTourHandler = true;
          popoverDOM.previousButton.addEventListener('click', () => {
            document.body.classList.add('tour-traveling');
            clearTimeout(settleTimerRef.current);
          }, { capture: true });
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

    // Calibrated reveal delay before launching drive() to ensure layout has completely mounted
    const timer = setTimeout(() => {
      try {
        driverObj.drive();
        setTimeout(updateBlurPanels, 60);
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
  }, [isOpen]);

  return null;
}
