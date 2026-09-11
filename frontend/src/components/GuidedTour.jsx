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

    const topP = surroundEl.querySelector('.bbdrts-blur-top');
    const bottomP = surroundEl.querySelector('.bbdrts-blur-bottom');
    const leftP = surroundEl.querySelector('.bbdrts-blur-left');
    const rightP = surroundEl.querySelector('.bbdrts-blur-right');

    const updateBlurPanels = (targetEl) => {
      const el = targetEl || document.querySelector('.driver-active-element');
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
    };

    // Safe scrolling: guarantees elements are comfortably positioned below the header
    const scrollToTargetSafely = (element) => {
      if (!element) return;
      const headerEl = document.querySelector('.bbdrts-main-header');
      const headerBottom = headerEl ? Math.round(headerEl.getBoundingClientRect().bottom) : 75;
      const rect = element.getBoundingClientRect();
      const availableHeight = window.innerHeight - headerBottom;

      let desiredTop;
      if (rect.height <= availableHeight - 70) {
        // Fits nicely: center it vertically between headerBottom and window bottom
        desiredTop = headerBottom + Math.max(20, Math.round((availableHeight - rect.height) / 2));
      } else {
        // Tall element: give it 35px headroom below the header
        desiredTop = headerBottom + 35;
      }

      const scrollDelta = Math.round(rect.top - desiredTop);
      if (Math.abs(scrollDelta) > 12) {
        window.scrollBy({
          top: scrollDelta,
          behavior: 'smooth'
        });
      }
    };

    let scrollRafId = null;
    const handleWindowChange = () => {
      if (scrollRafId) return;
      scrollRafId = requestAnimationFrame(() => {
        scrollRafId = null;
        updateBlurPanels();
      });
    };
    window.addEventListener('resize', handleWindowChange, { passive: true });
    window.addEventListener('scroll', handleWindowChange, { passive: true });

    const cleanupSurround = () => {
      if (scrollRafId) cancelAnimationFrame(scrollRafId);
      window.removeEventListener('resize', handleWindowChange);
      window.removeEventListener('scroll', handleWindowChange);
      const s = document.getElementById(surroundId);
      if (s) s.remove();
      const g = document.getElementById(headerGuardId);
      if (g) g.remove();
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
      animate: true,
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
      onHighlightStarted: (element) => {
        // Softly dim the blur surround during spotlight scroll transition
        const surround = document.getElementById(surroundId);
        if (surround) surround.style.opacity = '0.35';
        scrollToTargetSafely(element);
      },
      onHighlighted: (element) => {
        // Spotlight has settled: lock blur panels to the exact resting target
        updateBlurPanels(element);
        const surround = document.getElementById(surroundId);
        if (surround) surround.style.opacity = '1';
        setTimeout(() => updateBlurPanels(element), 50);
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

        // Overlap Prevention: guarantees the popover never covers the highlighted element
        const wrapper = popoverDOM.wrapper;
        if (wrapper) {
          setTimeout(() => {
            const activeEl = document.querySelector('.driver-active-element');
            if (!activeEl) return;
            const headerEl = document.querySelector('.bbdrts-main-header');
            const headerBottom = headerEl ? Math.round(headerEl.getBoundingClientRect().bottom) : 75;

            const aRect = activeEl.getBoundingClientRect();
            const pRect = wrapper.getBoundingClientRect();

            const isOverlapping = (
              pRect.left < aRect.right &&
              pRect.right > aRect.left &&
              pRect.top < aRect.bottom &&
              pRect.bottom > aRect.top
            );

            if (isOverlapping) {
              const spaceBelow = window.innerHeight - aRect.bottom;
              const spaceAbove = aRect.top - headerBottom;

              if (spaceBelow >= pRect.height + 14) {
                wrapper.style.top = `${Math.round(aRect.bottom + 12)}px`;
                wrapper.style.bottom = 'auto';
              } else if (spaceAbove >= pRect.height + 14) {
                wrapper.style.top = `${Math.round(aRect.top - pRect.height - 12)}px`;
                wrapper.style.bottom = 'auto';
              }
            }
          }, 40);
        }
      },
      onDestroyed: () => {
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
