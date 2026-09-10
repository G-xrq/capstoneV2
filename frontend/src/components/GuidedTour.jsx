import { useEffect, useRef } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import './GuidedTour.css';

/**
 * Universal Guided Spotlight Onboarding Tour Component
 * Powered by Driver.js (v1.8.0) + 4-Panel Blur Surround:
 * - 4-Panel backdrop blur blurs the page outside while the active box remains 100% sharp
 * - Zero GPU compositor locks, zero requestAnimationFrame loops, 60fps hardware-accelerated transitions
 * - Calibrated reveal delay (spotlight glides and settles first, card fades in calmly)
 * - Safe overlay click protection (prevents accidental tour dismissals mid-tutorial)
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

    // ── 4-Panel Blur Surround ──
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
      const pad = 10;
      const x = Math.max(0, Math.round(rect.left - pad));
      const y = Math.max(0, Math.round(rect.top - pad));
      const w = Math.min(window.innerWidth - x, Math.round(rect.width + pad * 2));
      const h = Math.min(window.innerHeight - y, Math.round(rect.height + pad * 2));
      const r = x + w;
      const b = y + h;

      topP.style.top = '0px';
      topP.style.left = '0px';
      topP.style.width = '100vw';
      topP.style.height = `${y}px`;

      bottomP.style.top = `${b}px`;
      bottomP.style.left = '0px';
      bottomP.style.width = '100vw';
      bottomP.style.height = `calc(100vh - ${b}px)`;

      leftP.style.top = `${y}px`;
      leftP.style.left = '0px';
      leftP.style.width = `${x}px`;
      leftP.style.height = `${h}px`;

      rightP.style.top = `${y}px`;
      rightP.style.left = `${r}px`;
      rightP.style.width = `calc(100vw - ${r}px)`;
      rightP.style.height = `${h}px`;
    };

    const handleWindowChange = () => {
      updateBlurPanels();
    };
    window.addEventListener('resize', handleWindowChange);
    window.addEventListener('scroll', handleWindowChange, { passive: true });

    const cleanupSurround = () => {
      window.removeEventListener('resize', handleWindowChange);
      window.removeEventListener('scroll', handleWindowChange);
      const s = document.getElementById(surroundId);
      if (s) s.remove();
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
          align: 'start',
          showButtons: idx === 0 ? ['next', 'close'] : ['previous', 'next', 'close'],
          nextBtnText: idx === totalSteps - 1 ? "Got It, Let's Go! ✓" : 'Next →',
          prevBtnText: '← Back',
        }
      };
    });

    const driverObj = driver({
      showProgress: true,
      animate: true,
      smoothScroll: true,
      allowClose: true,
      skipMissingElement: true,
      stagePadding: 10,
      stageRadius: 12,
      popoverOffset: 14,
      overlayColor: 'rgba(0, 0, 0, 0.25)', // Subtle dark tint complementing 4-panel blur
      // Safe backdrop behavior: Clicking outside does NOT dismiss the tour mid-tutorial
      overlayClickBehavior: () => {
        // Deliberate no-op: prevents accidental dismissal when reading or clicking around
      },
      popoverClass: `bbdrts-tour-popover theme-${currentTheme}`,
      progressText: 'Step {{current}} of {{total}}',
      steps: driverSteps,
      onHighlightStarted: (element) => {
        updateBlurPanels(element);
      },
      onHighlighted: (element) => {
        updateBlurPanels(element);
      },
      onCloseClick: () => {
        if (driverRef.current) {
          try {
            driverRef.current.destroy();
          } catch (_) {}
          driverRef.current = null;
        }
      },
      onPopoverRender: (popoverDOM) => {
        if (popoverDOM && popoverDOM.closeButton) {
          popoverDOM.closeButton.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (driverRef.current) {
              try {
                driverRef.current.destroy();
              } catch (_) {}
              driverRef.current = null;
            }
          };
        }
      },
      onDestroyStarted: () => {
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

    // Small calm delay before launching drive() to ensure layout is ready
    const timer = setTimeout(() => {
      try {
        driverObj.drive();
        setTimeout(updateBlurPanels, 50);
      } catch (err) {
        console.warn('Driver.js drive() error:', err);
      }
    }, 280);

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
