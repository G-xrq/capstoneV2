import { useState, useEffect, useRef, useCallback } from 'react';
import './GuidedTour.css';

/**
 * Universal High-Performance Guided Onboarding Tour Engine
 * 100% Bespoke, Zero-Lag, Synchronous Scroll-Locked Architecture:
 * - Direct synchronous DOM synchronization on scroll: Spotlight box and tutorial card
 *   are locked 1:1 to content with 0 frame delay regardless of aggressive scrolling.
 * - Smooth transition choreography: Card softly fades out on 'Next'/'Back', camera glides,
 *   and card fades in at the exact settled position — eliminating any wrong-place flashing.
 * - Silky smooth blur in & out: Root overlay transitions smoothly with cubic-bezier easing.
 * - Pinned Header Blur Guard (z-index: 1000000015): Sticky header stays deeply blurred and protected.
 * - Calibrated camera angles: Step 4 frames Featured Causes at top with card below;
 *   Step 5 automatically resets camera to top: 0 so sidebar is 100% visible.
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
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [mounted, setMounted] = useState(false);

  // References for zero-lag synchronous scroll synchronization
  const activeElementRef = useRef(null);
  const spotlightFrameRef = useRef(null);
  const topPanelRef = useRef(null);
  const bottomPanelRef = useRef(null);
  const leftPanelRef = useRef(null);
  const rightPanelRef = useRef(null);
  const headerGuardRef = useRef(null);
  const cardRef = useRef(null);
  const currentStepRef = useRef(null);

  // Stable references to props
  const stepsRef = useRef(steps);
  stepsRef.current = steps;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const tourKeyRef = useRef(tourKey);
  tourKeyRef.current = tourKey;

  const totalSteps = steps.length;
  const currentStep = steps[currentStepIndex] || null;
  currentStepRef.current = currentStep;

  // ── Helper: Measure Sticky Header Bottom Coordinate ──
  const getHeaderBottom = useCallback(() => {
    const headerEl = document.querySelector('.bbdrts-main-header');
    if (headerEl) {
      return Math.round(headerEl.getBoundingClientRect().bottom);
    }
    return 75;
  }, []);

  // ── Helper: Safe Headroom Camera Scrolling ──
  const scrollToTargetSafely = useCallback((element) => {
    if (!element) return;
    const hBottom = getHeaderBottom();

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
        targetY = Math.max(0, Math.round(window.scrollY + featuredHeadingEl.getBoundingClientRect().top - (hBottom + 8)));
      } else {
        targetY = Math.max(0, Math.round(window.scrollY + element.getBoundingClientRect().top - (hBottom + 45)));
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
      const targetY = Math.max(0, Math.round(window.scrollY + rect.top - (hBottom + 16)));
      window.scrollTo({
        top: targetY,
        behavior: 'smooth'
      });
      return;
    }

    // Case 4: Other dashboard elements
    const rect = element.getBoundingClientRect();
    const availableHeight = window.innerHeight - hBottom;

    let desiredTop;
    if (rect.height <= availableHeight - 80) {
      desiredTop = hBottom + Math.max(16, Math.round((availableHeight - rect.height) / 2));
    } else {
      desiredTop = hBottom + 16;
    }

    const targetY = Math.max(0, Math.round(window.scrollY + rect.top - desiredTop));
    if (Math.abs(window.scrollY - targetY) > 10) {
      window.scrollTo({
        top: targetY,
        behavior: 'smooth'
      });
    }
  }, [getHeaderBottom]);

  // ── Helper: Precise Popover Card Positioning & Arrow Calculation ──
  const calculateCardPosition = useCallback((rect, placement = 'bottom', align = 'center') => {
    const cardWidth = 380;
    const cardHeight = cardRef.current ? cardRef.current.offsetHeight : 210;
    const gap = 14;
    const pad = 14;
    const hBottom = getHeaderBottom();

    let top = 0;
    let left = 0;
    let arrowSide = 'top'; // Arrow on top edge of card, pointing up to element
    let arrowLeft = '50%';
    let arrowTop = undefined;

    if (placement === 'bottom') {
      top = rect.bottom + gap;
      if (align === 'start') {
        left = rect.left;
      } else if (align === 'end') {
        left = rect.right - cardWidth;
      } else {
        left = rect.left + (rect.width / 2) - (cardWidth / 2);
      }
      arrowSide = 'top';
      const relX = (rect.left + rect.width / 2) - left;
      arrowLeft = `${Math.max(24, Math.min(cardWidth - 24, relX))}px`;

      // If bottom overflows viewport, check if top has space
      if (top + cardHeight > window.innerHeight - 10) {
        if (rect.top - cardHeight - gap > hBottom + 10) {
          top = rect.top - cardHeight - gap;
          arrowSide = 'bottom';
        } else {
          top = Math.max(hBottom + 10, window.innerHeight - cardHeight - 10);
        }
      }
    } else if (placement === 'top') {
      top = rect.top - cardHeight - gap;
      if (align === 'start') {
        left = rect.left;
      } else if (align === 'end') {
        left = rect.right - cardWidth;
      } else {
        left = rect.left + (rect.width / 2) - (cardWidth / 2);
      }
      arrowSide = 'bottom';
      const relX = (rect.left + rect.width / 2) - left;
      arrowLeft = `${Math.max(24, Math.min(cardWidth - 24, relX))}px`;
    } else if (placement === 'right') {
      left = rect.right + gap;
      if (align === 'start') {
        top = rect.top;
      } else if (align === 'end') {
        top = rect.bottom - cardHeight;
      } else {
        top = rect.top + (rect.height / 2) - (cardHeight / 2);
      }
      arrowSide = 'left';
      const relY = (rect.top + rect.height / 2) - top;
      arrowTop = `${Math.max(20, Math.min(cardHeight - 20, relY))}px`;
      arrowLeft = undefined;
    } else if (placement === 'left') {
      left = rect.left - cardWidth - gap;
      if (align === 'start') {
        top = rect.top;
      } else if (align === 'end') {
        top = rect.bottom - cardHeight;
      } else {
        top = rect.top + (rect.height / 2) - (cardHeight / 2);
      }
      arrowSide = 'right';
      const relY = (rect.top + rect.height / 2) - top;
      arrowTop = `${Math.max(20, Math.min(cardHeight - 20, relY))}px`;
      arrowLeft = undefined;
    }

    // Clamping within viewport
    left = Math.max(pad, Math.min(window.innerWidth - cardWidth - pad, left));
    top = Math.max(hBottom + 10, Math.min(window.innerHeight - cardHeight - pad, top));

    return {
      top: Math.round(top),
      left: Math.round(left),
      arrowSide,
      arrowLeft,
      arrowTop
    };
  }, [getHeaderBottom]);

  // ── Synchronous Position Updater (Zero Lag on Aggressive Scroll) ──
  const syncPositionsNow = useCallback((isGliding = false) => {
    const el = activeElementRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    const hBottom = getHeaderBottom();
    const pad = 12;

    // Header guard height
    if (headerGuardRef.current) {
      headerGuardRef.current.style.height = `${hBottom}px`;
    }

    // Spotlight cutout coordinates clamped to header guard
    const y = Math.max(hBottom, Math.min(window.innerHeight, Math.round(rect.top - pad)));
    const x = Math.max(0, Math.min(window.innerWidth, Math.round(rect.left - pad)));
    const r = Math.max(0, Math.min(window.innerWidth, Math.round(rect.right + pad)));
    const b = Math.max(y, Math.min(window.innerHeight, Math.round(rect.bottom + pad)));
    const w = Math.max(0, r - x);
    const h = Math.max(0, b - y);

    // Synchronously update moving spotlight frame
    if (spotlightFrameRef.current) {
      if (isGliding) {
        spotlightFrameRef.current.classList.add('gliding');
      } else {
        spotlightFrameRef.current.classList.remove('gliding');
      }
      spotlightFrameRef.current.style.top = `${y}px`;
      spotlightFrameRef.current.style.left = `${x}px`;
      spotlightFrameRef.current.style.width = `${w}px`;
      spotlightFrameRef.current.style.height = `${h}px`;
    }

    // Synchronously update 4-panel blur surround
    if (topPanelRef.current) {
      topPanelRef.current.style.height = `${y}px`;
    }
    if (bottomPanelRef.current) {
      bottomPanelRef.current.style.top = `${b}px`;
      bottomPanelRef.current.style.height = `${Math.max(0, window.innerHeight - b)}px`;
    }
    if (leftPanelRef.current) {
      leftPanelRef.current.style.top = `${y}px`;
      leftPanelRef.current.style.width = `${x}px`;
      leftPanelRef.current.style.height = `${h}px`;
    }
    if (rightPanelRef.current) {
      rightPanelRef.current.style.top = `${y}px`;
      rightPanelRef.current.style.left = `${r}px`;
      rightPanelRef.current.style.width = `${Math.max(0, window.innerWidth - r)}px`;
      rightPanelRef.current.style.height = `${h}px`;
    }

    // Synchronously update floating card position and arrow
    if (cardRef.current && currentStepRef.current) {
      const pos = calculateCardPosition(rect, currentStepRef.current.placement, currentStepRef.current.align);
      cardRef.current.style.transform = `translate3d(${pos.left}px, ${pos.top}px, 0)`;

      const arrowEl = cardRef.current.querySelector('.driver-popover-arrow');
      if (arrowEl) {
        arrowEl.className = `driver-popover-arrow arrow-${pos.arrowSide}`;
        if (pos.arrowLeft !== undefined) arrowEl.style.left = pos.arrowLeft;
        else arrowEl.style.left = '';
        if (pos.arrowTop !== undefined) arrowEl.style.top = pos.arrowTop;
        else arrowEl.style.top = '';
      }
    }
  }, [calculateCardPosition, getHeaderBottom]);

  // ── Step Navigation Transition ──
  const navigateToStep = useCallback((targetStepIndex) => {
    const currentSteps = stepsRef.current || [];
    if (targetStepIndex < 0 || targetStepIndex >= currentSteps.length) return;

    const nextStep = currentSteps[targetStepIndex];
    if (!nextStep) return;

    // 1. Instantly hide card so it NEVER flashes in the wrong position
    setIsTransitioning(true);

    const targetEl = document.querySelector(nextStep.target);
    if (!targetEl) {
      // Element not yet in DOM, retry briefly
      setTimeout(() => navigateToStep(targetStepIndex), 100);
      return;
    }

    activeElementRef.current = targetEl;

    // 2. Smoothly scroll camera to the calibrated target position
    scrollToTargetSafely(targetEl);

    // 3. Spotlight glides to the new element
    syncPositionsNow(true);

    // 4. Once camera has glided (settling window), lock positions and fade card in
    const revealCard = () => {
      syncPositionsNow(false);
      setIsTransitioning(false);
    };

    setTimeout(revealCard, 260);
    setTimeout(revealCard, 450);
  }, [scrollToTargetSafely, syncPositionsNow]);

  // ── Mount / Open Lifecycle ──
  useEffect(() => {
    if (!isOpen) {
      setMounted(false);
      setIsClosing(false);
      activeElementRef.current = null;
      return;
    }

    // Ensure dashboard tab is mounted
    if (typeof onTabChange === 'function') {
      try {
        onTabChange('dashboard');
      } catch (_) {}
    }

    setMounted(true);
    setIsClosing(false);
    setCurrentStepIndex(0);

    // Short reveal delay for stable layout mount
    const timer = setTimeout(() => {
      navigateToStep(0);
    }, 280);

    return () => clearTimeout(timer);
  }, [isOpen, onTabChange, navigateToStep]);

  // ── Zero-Lag Synchronous Scroll & Resize Listener ──
  useEffect(() => {
    if (!mounted || isClosing) return;

    // Synchronous execution on scroll: ZERO frame delay!
    const handleScrollOrResize = () => {
      syncPositionsNow(false);
    };

    window.addEventListener('scroll', handleScrollOrResize, { passive: true });
    window.addEventListener('resize', handleScrollOrResize, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [mounted, isClosing, syncPositionsNow]);

  // ── Close Tour Gracefully with Fade-Out ──
  const handleClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);

    try {
      localStorage.setItem(tourKeyRef.current, 'true');
      localStorage.removeItem('bbdrts_tour_force_launch');
      localStorage.removeItem('bbdrts_is_new_registration');
    } catch (_) {}

    // Graceful 0.25s fade-out before unmounting
    setTimeout(() => {
      setMounted(false);
      if (typeof onCloseRef.current === 'function') {
        onCloseRef.current();
      }
    }, 250);
  }, [isClosing]);

  // ── Next & Back Buttons ──
  const handleNext = () => {
    if (currentStepIndex < totalSteps - 1) {
      const nextIdx = currentStepIndex + 1;
      setCurrentStepIndex(nextIdx);
      navigateToStep(nextIdx);
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      const prevIdx = currentStepIndex - 1;
      setCurrentStepIndex(prevIdx);
      navigateToStep(prevIdx);
    }
  };

  // ── Keyboard Controls (Escape, ArrowRight, ArrowLeft) ──
  useEffect(() => {
    if (!mounted || isClosing) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mounted, isClosing, currentStepIndex, totalSteps, handleClose]);

  if (!mounted) return null;

  return (
    <div className={`bbdrts-tour-root ${isClosing ? 'closing' : 'active'} theme-${theme}`}>
      {/* ── 1. Dedicated Fixed Header Blur Guard (z-index: 1000000015) ── */}
      <div 
        ref={headerGuardRef}
        id="bbdrts-tour-header-guard" 
        style={{ height: `${getHeaderBottom()}px` }} 
      />

      {/* ── 2. 4-Panel Blur Surround (Blurs background outside, keeping cutout 100% sharp) ── */}
      <div id="bbdrts-tour-blur-surround">
        <div ref={topPanelRef} className="bbdrts-blur-panel bbdrts-blur-top" style={{ top: 0, left: 0, width: '100vw' }} />
        <div ref={bottomPanelRef} className="bbdrts-blur-panel bbdrts-blur-bottom" style={{ left: 0, width: '100vw' }} />
        <div ref={leftPanelRef} className="bbdrts-blur-panel bbdrts-blur-left" style={{ left: 0 }} />
        <div ref={rightPanelRef} className="bbdrts-blur-panel bbdrts-blur-right" />
      </div>

      {/* ── 3. Moving Spotlight Focus Frame (Radiant animated border & elevation) ── */}
      <div 
        ref={spotlightFrameRef}
        className="bbdrts-spotlight-focus-frame"
      />

      {/* ── 4. Smart Floating Tutorial Card ── */}
      <div
        ref={cardRef}
        className={`bbdrts-tour-popover ${isTransitioning ? 'transitioning' : 'visible'}`}
        role="dialog"
        aria-modal="true"
      >
        {/* Directional Pointer Arrow */}
        <div className="driver-popover-arrow arrow-top" />

        {/* Close Button ('✕') */}
        <button
          type="button"
          className="driver-popover-close-btn"
          onClick={handleClose}
          title="Close tutorial (Esc)"
          aria-label="Close tutorial"
        >
          ✕
        </button>

        {/* Header: Category Badge & Title */}
        <div className="driver-popover-title">
          <div className="driver-popover-badge">
            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>help</span>
            <span>{currentStep?.badge || `Step ${currentStepIndex + 1} of ${totalSteps} • ${roleName} Tutorial`}</span>
          </div>
          <div className="driver-step-title-row">
            {currentStep?.icon && (
              <span className="material-symbols-outlined driver-step-icon">{currentStep.icon}</span>
            )}
            <span>{currentStep?.title || ''}</span>
          </div>
        </div>

        {/* Description Body */}
        <div className="driver-popover-description">
          {currentStep?.description}
        </div>

        {/* Footer Navigation & Progress */}
        <div className="driver-popover-footer">
          <div className="driver-popover-progress-text">
            Step {currentStepIndex + 1} of {totalSteps}
          </div>

          <div className="driver-popover-navigation-btns">
            {currentStepIndex > 0 && (
              <button
                type="button"
                className="driver-popover-prev-btn"
                onClick={handlePrev}
              >
                ← Back
              </button>
            )}

            <button
              type="button"
              className="driver-popover-next-btn"
              onClick={handleNext}
              autoFocus
            >
              {currentStepIndex === totalSteps - 1 ? "Got It, Let's Go! ✓" : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
