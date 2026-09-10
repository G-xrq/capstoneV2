import { useEffect, useRef } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import './GuidedTour.css';

/**
 * Universal Guided Spotlight Onboarding Tour Component
 * Powered by Driver.js (v1.8.0) with:
 * - Delayed smooth popover reveal (zero layout glitching)
 * - Safe overlay click protection (prevents accidental tour dismissals mid-tutorial)
 * - Crystal-clear hardware-accelerated SVG spotlight cutout
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

  useEffect(() => {
    if (!isOpen || !steps || steps.length === 0) {
      if (driverRef.current) {
        driverRef.current.destroy();
        driverRef.current = null;
      }
      return;
    }

    isClosingRef.current = false;

    // Ensure we are settled on the dashboard view for stable layout rendering
    if (typeof onTabChange === 'function') {
      onTabChange('dashboard');
    }

    const totalSteps = steps.length;
    const driverSteps = steps.map((s, idx) => {
      const stepNumber = idx + 1;
      const badgeText = s.badge || `Step ${stepNumber} of ${totalSteps} • ${roleName} Tutorial`;
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
      overlayColor: 'rgba(0, 0, 0, 0.82)',
      // Safe backdrop behavior: Clicking outside does NOT dismiss the tour mid-tutorial
      overlayClickBehavior: () => {
        // Deliberate no-op: prevents accidental dismissal when reading or clicking around
      },
      popoverClass: `bbdrts-tour-popover theme-${theme}`,
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
        if (!isClosingRef.current) {
          isClosingRef.current = true;
          try {
            localStorage.setItem(tourKey, 'true');
            localStorage.removeItem('bbdrts_tour_force_launch');
            localStorage.removeItem('bbdrts_is_new_registration');
          } catch (_) {}
          if (typeof onClose === 'function') {
            onClose();
          }
        }
        if (driverRef.current) {
          driverRef.current.destroy();
          driverRef.current = null;
        }
      }
    });

    driverRef.current = driverObj;

    // Buffer delay to guarantee DOM styles and layout are ready before drive()
    const timer = setTimeout(() => {
      try {
        driverObj.drive();
      } catch (err) {
        console.warn('Driver.js drive() error:', err);
      }
    }, 150);

    return () => {
      clearTimeout(timer);
      if (driverRef.current) {
        driverRef.current.destroy();
        driverRef.current = null;
      }
    };
  }, [isOpen, steps, tourKey, roleName, theme, onTabChange, onClose]);

  return null;
}
