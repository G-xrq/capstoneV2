import { useEffect, useRef } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import './GuidedTour.css';

/**
 * Universal Guided Spotlight Onboarding Tour Component
 * Powered by Driver.js (v1.8.0) with:
 * - Calibrated reveal delay (spotlight glides first, card reveals calmly)
 * - Outside backdrop blur overlay (blurs background outside, keeping cutout 100% crisp)
 * - Safe overlay click protection (prevents accidental tour dismissals mid-tutorial)
 * - Polished header, badge, close button, and typography alignment
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

  // Keep references to mutable props to prevent infinite re-render loops
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
        driverRef.current.destroy();
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

    // Dynamic outside backdrop blur overlay (blurs page outside while keeping cutout 100% sharp)
    const blurOverlayId = 'bbdrts-tour-blur-overlay';

    let blurEl = document.getElementById(blurOverlayId);
    if (!blurEl) {
      blurEl = document.createElement('div');
      blurEl.id = blurOverlayId;
      document.body.appendChild(blurEl);
    }

    let lastClip = '';
    const syncBlurCutout = () => {
      const overlay = document.getElementById(blurOverlayId);
      if (!overlay) return;

      const activeEl = document.querySelector('.driver-active-element');
      if (!activeEl) {
        if (lastClip !== 'none') {
          lastClip = 'none';
          overlay.style.clipPath = 'none';
        }
        return;
      }

      const rect = activeEl.getBoundingClientRect();
      const pad = 10;
      const x = Math.max(0, Math.round(rect.left - pad));
      const y = Math.max(0, Math.round(rect.top - pad));
      const r = Math.min(window.innerWidth, Math.round(rect.right + pad));
      const b = Math.min(window.innerHeight, Math.round(rect.bottom + pad));

      if (r <= x || b <= y) {
        if (lastClip !== 'none') {
          lastClip = 'none';
          overlay.style.clipPath = 'none';
        }
        return;
      }

      // Single continuous polygon donut: covers entire viewport EXCEPT [x..r, y..b]
      const nextClip = `polygon(0% 0%, 0% 100%, ${x}px 100%, ${x}px ${y}px, ${r}px ${y}px, ${r}px ${b}px, ${x}px ${b}px, ${x}px 100%, 100% 100%, 100% 0%)`;
      if (lastClip !== nextClip) {
        lastClip = nextClip;
        overlay.style.clipPath = nextClip;
      }
    };

    let isRunning = true;
    let animFrameId = null;
    const renderLoop = () => {
      if (!isRunning) return;
      syncBlurCutout();
      animFrameId = requestAnimationFrame(renderLoop);
    };
    animFrameId = requestAnimationFrame(renderLoop);

    const cleanupBlur = () => {
      isRunning = false;
      if (animFrameId) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
      }
      const bEl = document.getElementById(blurOverlayId);
      if (bEl) bEl.remove();
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
      overlayColor: 'rgba(0, 0, 0, 0.78)',
      // Safe backdrop behavior: Clicking outside does NOT dismiss the tour mid-tutorial
      overlayClickBehavior: () => {
        // Deliberate no-op: prevents accidental dismissal when reading or clicking around
      },
      popoverClass: `bbdrts-tour-popover theme-${currentTheme}`,
      progressText: 'Step {{current}} of {{total}}',
      steps: driverSteps,
      onCloseClick: () => {
        if (driverRef.current) {
          driverRef.current.destroy();
        }
      },
      onPopoverRender: (popoverDOM) => {
        if (popoverDOM && popoverDOM.closeButton) {
          popoverDOM.closeButton.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (driverRef.current) {
              driverRef.current.destroy();
            }
          };
        }
      },
      onDestroyStarted: () => {
        cleanupBlur();
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
        if (driverRef.current) {
          driverRef.current.destroy();
          driverRef.current = null;
        }
      }
    });

    driverRef.current = driverObj;

    // Calm delay before launching drive() to ensure layout and scroll are fully settled
    const timer = setTimeout(() => {
      try {
        driverObj.drive();
      } catch (err) {
        console.warn('Driver.js drive() error:', err);
      }
    }, 450);

    return () => {
      clearTimeout(timer);
      cleanupBlur();
      if (driverRef.current) {
        driverRef.current.destroy();
        driverRef.current = null;
      }
    };
  }, [isOpen]);

  return null;
}
