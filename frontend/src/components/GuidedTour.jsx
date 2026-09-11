import { useState, useEffect, useRef, useCallback } from 'react';
import './GuidedTour.css';

/**
 * Professional SaaS Interactive Guided Onboarding Engine
 * 100% Bespoke, Zero-Dependency Architecture:
 * - Pre-Tour Welcome Modal: Introduces platform value before Step 1
 * - Moving Spotlight Engine: Gliding focus frame with crystal-clear center and 4-panel blur surround
 * - Fixed Header Blur Guard: Sticky navigation header always stays deeply blurred and protected
 * - Safe Headroom Scrolling: Elements are smoothly positioned with guaranteed headroom below header
 * - Smart Floating Card: Dynamic collision detection, animated progress bar, category badge & arrow
 * - Post-Tour Celebration Modal: Animated milestone achievement on completion
 * - State Management: Step preservation in sessionStorage, completion persistence in localStorage
 * - Keyboard Accessibility: Enter/Right (Next), Left (Back), Esc (Close/Skip)
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
  const [stage, setStage] = useState('welcome'); // 'welcome' | 'touring' | 'completed'
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState(null);
  const [cardPosition, setCardPosition] = useState({ top: 0, left: 0, side: 'bottom', arrowLeft: '50%' });
  const [headerHeight, setHeaderHeight] = useState(75);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const cardRef = useRef(null);
  const rafRef = useRef(null);
  const retryTimeoutRef = useRef(null);
  const isClosingRef = useRef(false);

  const totalSteps = steps.length;
  const currentStep = steps[currentStepIndex] || null;

  // Session persistence key for preserving step across refreshes
  const sessionStepKey = `bbdrts_tour_session_step_${roleName.toLowerCase()}`;

  // ── Helper: Measure Sticky Header Height ──
  const getHeaderBottom = useCallback(() => {
    const headerEl = document.querySelector('.bbdrts-main-header');
    if (headerEl) {
      const rect = headerEl.getBoundingClientRect();
      return Math.round(rect.bottom);
    }
    return 75;
  }, []);

  // ── Helper: Safe Headroom Scrolling ──
  const scrollToTargetSafely = useCallback((element) => {
    if (!element) return;
    const hBottom = getHeaderBottom();
    const rect = element.getBoundingClientRect();
    const availableHeight = window.innerHeight - hBottom;

    let desiredTop;
    if (rect.height <= availableHeight - 70) {
      // Element fits in view: center it vertically below the header
      desiredTop = hBottom + Math.max(24, Math.round((availableHeight - rect.height) / 2));
    } else {
      // Tall element: give it 35px headroom below the header
      desiredTop = hBottom + 35;
    }

    const delta = Math.round(rect.top - desiredTop);
    if (Math.abs(delta) > 10) {
      window.scrollBy({
        top: delta,
        behavior: 'smooth'
      });
    }
  }, [getHeaderBottom]);

  // ── Helper: Smart Collision & Floating Card Positioning ──
  const calculateCardPosition = useCallback((targetRect) => {
    if (!targetRect) return { top: 0, left: 0, side: 'bottom', arrowLeft: '50%' };

    const hBottom = getHeaderBottom();
    const cardWidth = 390;
    const cardHeight = cardRef.current ? cardRef.current.offsetHeight : 230;
    const gap = 16;
    const pad = 16;

    const spaceBelow = window.innerHeight - targetRect.bottom;
    const spaceAbove = targetRect.top - hBottom;
    const spaceRight = window.innerWidth - targetRect.right;
    const spaceLeft = targetRect.left;

    const preferredSide = currentStep?.placement || 'bottom';
    let side = preferredSide;

    // Evaluate best fit
    if (preferredSide === 'bottom' && spaceBelow < cardHeight + gap + 10) {
      if (spaceAbove >= cardHeight + gap + 10) {
        side = 'top';
      } else if (spaceRight >= cardWidth + gap) {
        side = 'right';
      } else if (spaceLeft >= cardWidth + gap) {
        side = 'left';
      }
    } else if (preferredSide === 'top' && spaceAbove < cardHeight + gap + 10) {
      if (spaceBelow >= cardHeight + gap + 10) {
        side = 'bottom';
      } else if (spaceRight >= cardWidth + gap) {
        side = 'right';
      } else if (spaceLeft >= cardWidth + gap) {
        side = 'left';
      }
    } else if (preferredSide === 'right' && spaceRight < cardWidth + gap) {
      if (spaceBelow >= cardHeight + gap + 10) {
        side = 'bottom';
      } else if (spaceAbove >= cardHeight + gap + 10) {
        side = 'top';
      } else if (spaceLeft >= cardWidth + gap) {
        side = 'left';
      }
    }

    let top = 0;
    let left = 0;
    let arrowLeft = '50%';

    if (side === 'bottom') {
      top = targetRect.bottom + gap;
      left = targetRect.left + (targetRect.width / 2) - (cardWidth / 2);
    } else if (side === 'top') {
      top = targetRect.top - cardHeight - gap;
      left = targetRect.left + (targetRect.width / 2) - (cardWidth / 2);
    } else if (side === 'right') {
      top = targetRect.top + (targetRect.height / 2) - (cardHeight / 2);
      left = targetRect.right + gap;
    } else if (side === 'left') {
      top = targetRect.top + (targetRect.height / 2) - (cardHeight / 2);
      left = targetRect.left - cardWidth - gap;
    }

    // Clamp coordinates safely within viewport
    left = Math.max(pad, Math.min(window.innerWidth - cardWidth - pad, left));
    top = Math.max(hBottom + 12, Math.min(window.innerHeight - cardHeight - pad, top));

    // Calculate relative arrow position pointing to element center
    if (side === 'bottom' || side === 'top') {
      const targetCenter = targetRect.left + (targetRect.width / 2);
      const relativeArrowX = targetCenter - left;
      const clampedArrowX = Math.max(28, Math.min(cardWidth - 28, relativeArrowX));
      arrowLeft = `${clampedArrowX}px`;
    }

    return { top: Math.round(top), left: Math.round(left), side, arrowLeft };
  }, [currentStep, getHeaderBottom]);

  // ── Helper: Measure Target Element Bounding Rect ──
  const updateTargetGeometry = useCallback((targetEl) => {
    if (!targetEl) return;
    const rect = targetEl.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    const pad = 12;
    const hBottom = getHeaderBottom();

    const tLeft = Math.max(0, Math.round(rect.left - pad));
    const tTop = Math.max(hBottom, Math.round(rect.top - pad));
    const tRight = Math.min(window.innerWidth, Math.round(rect.right + pad));
    const tBottom = Math.max(tTop, Math.min(window.innerHeight, Math.round(rect.bottom + pad)));
    const tWidth = Math.max(0, tRight - tLeft);
    const tHeight = Math.max(0, tBottom - tTop);

    const calculatedRect = {
      left: tLeft,
      top: tTop,
      right: tRight,
      bottom: tBottom,
      width: tWidth,
      height: tHeight
    };

    setSpotlightRect(calculatedRect);
    setHeaderHeight(hBottom);
    setCardPosition(calculateCardPosition(calculatedRect));
  }, [calculateCardPosition, getHeaderBottom]);

  // ── Target Resolution & Step Transition ──
  const resolveCurrentStep = useCallback((stepIdx) => {
    if (!steps || steps.length === 0 || stepIdx >= steps.length) {
      setStage('completed');
      return;
    }

    const step = steps[stepIdx];
    if (!step || !step.target) return;

    setIsTransitioning(true);

    let attempts = 0;
    const maxAttempts = 20;

    const checkElement = () => {
      const el = document.querySelector(step.target);
      if (el && el.getBoundingClientRect().width > 0) {
        scrollToTargetSafely(el);
        setTimeout(() => {
          updateTargetGeometry(el);
          setIsTransitioning(false);
        }, 120);
      } else if (attempts < maxAttempts) {
        attempts++;
        retryTimeoutRef.current = setTimeout(checkElement, 80);
      } else {
        // Element not found: gracefully advance to next step instead of freezing
        setIsTransitioning(false);
        if (stepIdx + 1 < steps.length) {
          setCurrentStepIndex(stepIdx + 1);
        } else {
          setStage('completed');
        }
      }
    };

    checkElement();
  }, [steps, scrollToTargetSafely, updateTargetGeometry]);

  // ── Initialize / Reset Tour on isOpen ──
  useEffect(() => {
    if (!isOpen) {
      setStage('welcome');
      setSpotlightRect(null);
      isClosingRef.current = false;
      return;
    }

    isClosingRef.current = false;

    // Ensure dashboard tab is active
    if (typeof onTabChange === 'function') {
      try {
        onTabChange('dashboard');
      } catch (_) {}
    }

    // Check if resuming an existing session
    try {
      const savedStep = sessionStorage.getItem(sessionStepKey);
      if (savedStep !== null) {
        const parsed = parseInt(savedStep, 10);
        if (!isNaN(parsed) && parsed >= 0 && parsed < steps.length) {
          setCurrentStepIndex(parsed);
          setStage('touring');
          return;
        }
      }
    } catch (_) {}

    // Default: start with the welcome screen
    setStage('welcome');
    setCurrentStepIndex(0);
  }, [isOpen, onTabChange, sessionStepKey, steps.length]);

  // ── Handle Stage Transitions ──
  useEffect(() => {
    if (!isOpen || stage !== 'touring') return;
    resolveCurrentStep(currentStepIndex);

    try {
      sessionStorage.setItem(sessionStepKey, currentStepIndex.toString());
    } catch (_) {}

    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
  }, [isOpen, stage, currentStepIndex, resolveCurrentStep, sessionStepKey]);

  // ── Resize and Scroll Listeners ──
  useEffect(() => {
    if (!isOpen || stage !== 'touring') return;

    const handleWindowUpdate = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (currentStep?.target) {
          const el = document.querySelector(currentStep.target);
          if (el) updateTargetGeometry(el);
        }
      });
    };

    window.addEventListener('resize', handleWindowUpdate, { passive: true });
    window.addEventListener('scroll', handleWindowUpdate, { passive: true });

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', handleWindowUpdate);
      window.removeEventListener('scroll', handleWindowUpdate);
    };
  }, [isOpen, stage, currentStep, updateTargetGeometry]);

  // ── Tour Completion & Exit Handlers ──
  const handleCompleteTour = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;

    try {
      localStorage.setItem(tourKey, 'true');
      localStorage.removeItem('bbdrts_tour_force_launch');
      localStorage.removeItem('bbdrts_is_new_registration');
      sessionStorage.removeItem(sessionStepKey);
      if (dontShowAgain) {
        localStorage.setItem(`${tourKey}_never_show`, 'true');
      }
    } catch (_) {}

    if (typeof onClose === 'function') {
      onClose();
    }
  }, [tourKey, sessionStepKey, dontShowAgain, onClose]);

  const handleSkipTour = useCallback(() => {
    handleCompleteTour();
  }, [handleCompleteTour]);

  const handleStartTourFromWelcome = () => {
    setStage('touring');
    setCurrentStepIndex(0);
  };

  const handleNext = () => {
    if (currentStepIndex < totalSteps - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      setStage('completed');
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  // ── Keyboard Accessibility Navigation ──
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleSkipTour();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        if (stage === 'welcome') {
          handleStartTourFromWelcome();
        } else if (stage === 'touring') {
          handleNext();
        } else if (stage === 'completed') {
          handleCompleteTour();
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (stage === 'touring') {
          handleBack();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, stage, currentStepIndex, totalSteps, handleSkipTour, handleCompleteTour]);

  if (!isOpen) return null;

  // ── Progress Metrics ──
  const progressPercent = totalSteps > 0
    ? Math.round(((currentStepIndex + 1) / totalSteps) * 100)
    : 100;

  return (
    <div className={`bbdrts-tour-root theme-${theme}`} role="dialog" aria-modal="true">
      {/* ── Fixed Header Blur Guard (Guarantees sticky navbar is 100% blurred at all times) ── */}
      <div
        className="bbdrts-tour-header-guard"
        style={{ height: `${headerHeight}px` }}
        aria-hidden="true"
      />

      {/* ══════════════════════════════════════════════════════════
          STAGE 1: PRE-TOUR WELCOME MODAL
          ══════════════════════════════════════════════════════════ */}
      {stage === 'welcome' && (
        <div className="bbdrts-modal-overlay">
          <div className="bbdrts-welcome-card" role="document">
            <div className="bbdrts-welcome-badge">
              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>hub</span>
              <span>BBDRTS Protocol Onboarding</span>
            </div>

            <div className="bbdrts-welcome-icon-wrap">
              <span className="material-symbols-outlined bbdrts-welcome-hero-icon">
                {roleName.toLowerCase() === 'donor' ? 'volunteer_activism' : 'corporate_fare'}
              </span>
            </div>

            <h2 className="bbdrts-welcome-title">
              Welcome to your {roleName} Command Center
            </h2>

            <p className="bbdrts-welcome-desc">
              Take a 2-minute interactive guided walkthrough to discover verified emergency relief appeals, milestone-based escrow verification, dual payment rails (Web3 ETH &amp; GCash/Maya), and live Doppler weather radar intelligence.
            </p>

            <div className="bbdrts-welcome-highlights">
              <div className="bbdrts-highlight-item">
                <span className="material-symbols-outlined bbdrts-highlight-icon">verified_user</span>
                <div className="bbdrts-highlight-text">
                  <strong>100% Direct Giving</strong>
                  <span>Zero platform commission, zero gateway cuts.</span>
                </div>
              </div>
              <div className="bbdrts-highlight-item">
                <span className="material-symbols-outlined bbdrts-highlight-icon">account_balance_wallet</span>
                <div className="bbdrts-highlight-text">
                  <strong>Dual Payment Rails</strong>
                  <span>Sepolia ETH via MetaMask or instant GCash/Maya QR.</span>
                </div>
              </div>
              <div className="bbdrts-highlight-item">
                <span className="material-symbols-outlined bbdrts-highlight-icon">photo_camera</span>
                <div className="bbdrts-highlight-text">
                  <strong>Milestone Escrow Proofs</strong>
                  <span>Funds unlocked only after geotagged relief proof.</span>
                </div>
              </div>
            </div>

            <div className="bbdrts-welcome-actions">
              <button
                type="button"
                className="bbdrts-btn-primary"
                onClick={handleStartTourFromWelcome}
                autoFocus
              >
                <span>Start Interactive Tour</span>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_forward</span>
              </button>

              <button
                type="button"
                className="bbdrts-btn-ghost"
                onClick={handleSkipTour}
              >
                Skip for Now
              </button>
            </div>

            <label className="bbdrts-checkbox-row">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
              />
              <span>Don't show this walkthrough automatically again</span>
            </label>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          STAGE 2: ACTIVE SPOTLIGHT & SMART FLOATING CARD
          ══════════════════════════════════════════════════════════ */}
      {stage === 'touring' && spotlightRect && (
        <>
          {/* ── 4-Panel Blur Surround (Blurs background outside, center 100% crystal-clear) ── */}
          <div
            className={`bbdrts-tour-blur-surround ${isTransitioning ? 'transitioning' : ''}`}
            aria-hidden="true"
          >
            {/* Top Panel */}
            <div
              className="bbdrts-blur-panel"
              style={{
                top: 0,
                left: 0,
                width: '100vw',
                height: `${spotlightRect.top}px`
              }}
            />
            {/* Bottom Panel */}
            <div
              className="bbdrts-blur-panel"
              style={{
                top: `${spotlightRect.bottom}px`,
                left: 0,
                width: '100vw',
                height: `calc(100vh - ${spotlightRect.bottom}px)`
              }}
            />
            {/* Left Panel */}
            <div
              className="bbdrts-blur-panel"
              style={{
                top: `${spotlightRect.top}px`,
                left: 0,
                width: `${spotlightRect.left}px`,
                height: `${spotlightRect.height}px`
              }}
            />
            {/* Right Panel */}
            <div
              className="bbdrts-blur-panel"
              style={{
                top: `${spotlightRect.top}px`,
                left: `${spotlightRect.right}px`,
                width: `calc(100vw - ${spotlightRect.right}px)`,
                height: `${spotlightRect.height}px`
              }}
            />
          </div>

          {/* ── Gliding Spotlight Focus Frame (Radiant animated border & elevation) ── */}
          <div
            className="bbdrts-spotlight-frame"
            style={{
              top: `${spotlightRect.top}px`,
              left: `${spotlightRect.left}px`,
              width: `${spotlightRect.width}px`,
              height: `${spotlightRect.height}px`
            }}
            aria-hidden="true"
          />

          {/* ── Smart Floating Tutorial Card ── */}
          <div
            ref={cardRef}
            className={`bbdrts-floating-card side-${cardPosition.side} ${isTransitioning ? 'transitioning' : ''}`}
            style={{
              top: `${cardPosition.top}px`,
              left: `${cardPosition.left}px`
            }}
            role="document"
          >
            {/* Directional Pointer Arrow */}
            <div
              className={`bbdrts-card-arrow arrow-side-${cardPosition.side}`}
              style={{
                left: (cardPosition.side === 'bottom' || cardPosition.side === 'top') ? cardPosition.arrowLeft : undefined
              }}
              aria-hidden="true"
            />

            {/* Close Button ('✕') */}
            <button
              type="button"
              className="bbdrts-card-close-btn"
              onClick={handleSkipTour}
              title="Close tour (Esc)"
              aria-label="Close tour"
            >
              ✕
            </button>

            {/* Header: Category Badge & Step Counter */}
            <div className="bbdrts-card-header">
              <div className="bbdrts-card-badge">
                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
                  {currentStep?.icon || 'help'}
                </span>
                <span>{currentStep?.badge || `Step ${currentStepIndex + 1} of ${totalSteps}`}</span>
              </div>
              <span className="bbdrts-card-step-count">
                {currentStepIndex + 1}/{totalSteps}
              </span>
            </div>

            {/* Title Row */}
            <div className="bbdrts-card-title-row">
              <span className="material-symbols-outlined bbdrts-step-icon">
                {currentStep?.icon || 'help'}
              </span>
              <h3 className="bbdrts-card-title">{currentStep?.title}</h3>
            </div>

            {/* Description Body */}
            <p className="bbdrts-card-desc">{currentStep?.description}</p>

            {/* Animated Progress Bar */}
            <div className="bbdrts-progress-bar-wrap" aria-hidden="true">
              <div
                className="bbdrts-progress-bar-fill"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Footer Navigation Buttons */}
            <div className="bbdrts-card-footer">
              <button
                type="button"
                className="bbdrts-skip-link"
                onClick={handleSkipTour}
              >
                Skip Tour
              </button>

              <div className="bbdrts-card-nav-btns">
                {currentStepIndex > 0 && (
                  <button
                    type="button"
                    className="bbdrts-btn-back"
                    onClick={handleBack}
                  >
                    ← Back
                  </button>
                )}

                <button
                  type="button"
                  className="bbdrts-btn-next"
                  onClick={handleNext}
                  autoFocus
                >
                  <span>{currentStepIndex === totalSteps - 1 ? "Finish Tour ✓" : "Next →"}</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════
          STAGE 3: POST-TOUR CELEBRATION MODAL
          ══════════════════════════════════════════════════════════ */}
      {stage === 'completed' && (
        <div className="bbdrts-modal-overlay">
          <div className="bbdrts-celebration-card" role="document">
            <div className="bbdrts-celebration-icon-wrap">
              <span className="material-symbols-outlined bbdrts-celebration-hero-icon">
                military_tech
              </span>
            </div>

            <div className="bbdrts-welcome-badge" style={{ marginBottom: '12px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>verified</span>
              <span>Onboarding Completed</span>
            </div>

            <h2 className="bbdrts-celebration-title">You're All Set!</h2>

            <p className="bbdrts-celebration-desc">
              You now have the full operational understanding to explore emergency relief campaigns, track on-chain escrow proofs, and deploy humanitarian aid with 100% cryptographic transparency.
            </p>

            <div className="bbdrts-celebration-checklist">
              <div className="bbdrts-check-item">
                <span className="material-symbols-outlined bbdrts-check-icon">check_circle</span>
                <span>Verified profile &amp; zero-commission direct giving</span>
              </div>
              <div className="bbdrts-check-item">
                <span className="material-symbols-outlined bbdrts-check-icon">check_circle</span>
                <span>Multi-channel giving via Web3 Sepolia ETH &amp; GCash/Maya</span>
              </div>
              <div className="bbdrts-check-item">
                <span className="material-symbols-outlined bbdrts-check-icon">check_circle</span>
                <span>Ground-zero photo &amp; receipt verification ledger</span>
              </div>
            </div>

            <div className="bbdrts-celebration-actions">
              <button
                type="button"
                className="bbdrts-btn-primary"
                onClick={handleCompleteTour}
                autoFocus
              >
                <span>Start Exploring Dashboard</span>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>rocket_launch</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
