import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import './GuidedTour.css';

/**
 * Universal Guided Spotlight Onboarding Tour Component
 * Theme-aware (light/dark/cyber/default) with smooth animation, generous padding,
 * directional arrow pointing, and robust positioning that never overlaps highlighted objects.
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
  const [targetRect, setTargetRect] = useState(null);
  const [cardPosition, setCardPosition] = useState({ top: 100, left: 100, placement: 'bottom', arrowOffset: {} });
  const [isReady, setIsReady] = useState(false);

  const cardRef = useRef(null);
  const scrollTimeoutRef = useRef(null);

  const currentStep = steps[currentStepIndex] || null;

  // Accurately compute spotlight cutout and card placement with strict collision prevention
  const computeCoordinates = useCallback(() => {
    if (!currentStep) return;

    const el = document.querySelector(currentStep.target);
    if (!el) {
      setTargetRect(null);
      setCardPosition({
        top: Math.max(window.innerHeight / 2 - 140, 20),
        left: Math.max(window.innerWidth / 2 - 190, 16),
        placement: 'none',
        arrowOffset: {}
      });
      setIsReady(true);
      return;
    }

    const rect = el.getBoundingClientRect();
    // Generous breathing room so element borders and badges aren't cropped
    const padX = 10;
    const padY = 8;
    const computedTarget = {
      top: Math.max(0, rect.top - padY),
      left: Math.max(0, rect.left - padX),
      width: rect.width + padX * 2,
      height: rect.height + padY * 2,
      right: rect.left - padX + rect.width + padX * 2,
      bottom: rect.top - padY + rect.height + padY * 2
    };
    setTargetRect(computedTarget);

    // Dynamically measure actual rendered card size from the DOM
    const cardEl = cardRef.current;
    const cardWidth = cardEl ? cardEl.offsetWidth : Math.min(380, window.innerWidth - 32);
    // Real card height is typically 280-330px depending on content
    const cardHeight = cardEl ? cardEl.offsetHeight : 300;
    const margin = 18;

    // Mobile / Very narrow screen fallback: place above or below whichever has more room
    if (window.innerWidth < 768) {
      const spaceBelow = window.innerHeight - computedTarget.bottom;
      const spaceAbove = computedTarget.top;
      const placeBottom = spaceBelow >= cardHeight + margin || spaceBelow >= spaceAbove;
      
      const top = placeBottom
        ? Math.min(window.innerHeight - cardHeight - 12, computedTarget.bottom + margin)
        : Math.max(12, computedTarget.top - cardHeight - margin);
      const left = 16;
      
      const targetCenterX = computedTarget.left + computedTarget.width / 2;
      const arrowClampedX = Math.max(24, Math.min(cardWidth - 24, targetCenterX - left));

      setCardPosition({
        top: Math.max(12, top),
        left,
        placement: placeBottom ? 'bottom' : 'top',
        arrowOffset: { left: `${arrowClampedX}px` }
      });
      setIsReady(true);
      return;
    }

    // Desktop: Evaluate clearance on all 4 sides
    const spaceRight = window.innerWidth - computedTarget.right;
    const spaceLeft = computedTarget.left;
    const spaceBottom = window.innerHeight - computedTarget.bottom;
    const spaceTop = computedTarget.top;

    let preferred = currentStep.placement || 'bottom';
    let chosenPlacement = preferred;

    // Wide elements (width > 45% viewport) cannot have cards placed to the left or right
    const isWideTarget = computedTarget.width > window.innerWidth * 0.45;

    if (isWideTarget && (preferred === 'left' || preferred === 'right')) {
      preferred = 'bottom';
      chosenPlacement = 'bottom';
    }

    // Check if preferred placement fits without clipping
    if (preferred === 'right' && spaceRight >= cardWidth + margin + 16 && !isWideTarget) {
      chosenPlacement = 'right';
    } else if (preferred === 'left' && spaceLeft >= cardWidth + margin + 16 && !isWideTarget) {
      chosenPlacement = 'left';
    } else if (preferred === 'bottom' && spaceBottom >= cardHeight + margin) {
      chosenPlacement = 'bottom';
    } else if (preferred === 'top' && spaceTop >= cardHeight + margin) {
      chosenPlacement = 'top';
    } else {
      // Fallback: Pick between bottom, top, and right based on available clearance
      if (spaceBottom >= cardHeight + margin) {
        chosenPlacement = 'bottom';
      } else if (spaceTop >= cardHeight + margin) {
        chosenPlacement = 'top';
      } else if (spaceRight >= cardWidth + margin + 16 && !isWideTarget) {
        chosenPlacement = 'right';
      } else {
        // Whichever vertical side has the larger opening
        chosenPlacement = spaceBottom >= spaceTop ? 'bottom' : 'top';
      }
    }

    let top = 0;
    let left = 0;

    switch (chosenPlacement) {
      case 'right':
        left = computedTarget.right + margin;
        top = computedTarget.top + computedTarget.height / 2 - cardHeight / 2;
        break;
      case 'left':
        left = computedTarget.left - cardWidth - margin;
        top = computedTarget.top + computedTarget.height / 2 - cardHeight / 2;
        break;
      case 'top':
        top = computedTarget.top - cardHeight - margin;
        left = computedTarget.left + computedTarget.width / 2 - cardWidth / 2;
        break;
      case 'bottom':
      default:
        top = computedTarget.bottom + margin;
        left = computedTarget.left + computedTarget.width / 2 - cardWidth / 2;
        break;
    }

    // Viewport bounds clamping so card and buttons are NEVER cut off
    left = Math.max(16, Math.min(window.innerWidth - cardWidth - 16, left));
    top = Math.max(16, Math.min(window.innerHeight - cardHeight - 16, top));

    // STRICT OVERLAP PREVENTION:
    // If the clamped card box intersects the spotlight target box, resolve collision
    const cardBox = {
      top,
      left,
      right: left + cardWidth,
      bottom: top + cardHeight
    };

    const isOverlapping = !(
      cardBox.right <= computedTarget.left ||
      cardBox.left >= computedTarget.right ||
      cardBox.bottom <= computedTarget.top ||
      cardBox.top >= computedTarget.bottom
    );

    if (isOverlapping) {
      if (chosenPlacement === 'bottom' || (chosenPlacement !== 'top' && spaceBottom >= spaceTop)) {
        chosenPlacement = 'bottom';
        // Push below the spotlighted object
        top = computedTarget.bottom + 12;
        if (top + cardHeight > window.innerHeight - 12) {
          // If pushing below exceeds viewport, check if top has better room
          if (spaceTop > spaceBottom) {
            chosenPlacement = 'top';
            top = Math.max(12, computedTarget.top - cardHeight - 12);
          } else {
            top = Math.max(12, window.innerHeight - cardHeight - 12);
          }
        }
      } else {
        chosenPlacement = 'top';
        top = Math.max(12, computedTarget.top - cardHeight - 12);
        if (top < 12 && spaceBottom > spaceTop) {
          chosenPlacement = 'bottom';
          top = Math.min(window.innerHeight - cardHeight - 12, computedTarget.bottom + 12);
        }
      }
    }

    // Dynamic directional pointer arrow calculation
    let arrowOffset = {};
    if (chosenPlacement === 'bottom' || chosenPlacement === 'top') {
      const targetCenterX = computedTarget.left + computedTarget.width / 2;
      const relativeX = targetCenterX - left;
      const clampedX = Math.max(24, Math.min(cardWidth - 24, relativeX));
      arrowOffset = { left: `${clampedX}px` };
    } else if (chosenPlacement === 'left' || chosenPlacement === 'right') {
      const targetCenterY = computedTarget.top + computedTarget.height / 2;
      const relativeY = targetCenterY - top;
      const clampedY = Math.max(24, Math.min(cardHeight - 24, relativeY));
      arrowOffset = { top: `${clampedY}px` };
    }

    setCardPosition({ top, left, placement: chosenPlacement, arrowOffset });
    setIsReady(true);
  }, [currentStep]);

  // Navigate to step with smart clearance scrolling and zero-jitter transition
  const goToStep = useCallback((index) => {
    if (index < 0 || index >= steps.length) return;
    setCurrentStepIndex(index);

    const step = steps[index];
    if (step && step.tab && typeof onTabChange === 'function') {
      onTabChange(step.tab);
    }

    // Poll for DOM element availability after potential tab change
    let attempts = 0;
    const maxAttempts = 20;

    const findAndScrollToElement = () => {
      const el = step.target ? document.querySelector(step.target) : null;
      if (el && el.getBoundingClientRect().width > 0) {
        const elRect = el.getBoundingClientRect();
        const preferredPlacement = step.placement || 'bottom';

        // Calculate intelligent clearance scroll target
        let targetScrollY = window.scrollY;

        if (preferredPlacement === 'bottom') {
          // Position element near top of viewport (~90px from top), guaranteeing maximum open clearance below
          targetScrollY = window.scrollY + elRect.top - 90;
        } else if (preferredPlacement === 'top') {
          // Position element lower in viewport, guaranteeing maximum clearance above
          targetScrollY = window.scrollY + elRect.top - (window.innerHeight - elRect.height - 40);
        } else {
          // Lateral elements: vertically center comfortably
          targetScrollY = window.scrollY + elRect.top - (window.innerHeight / 2 - elRect.height / 2);
        }

        targetScrollY = Math.max(0, targetScrollY);

        const currentScrollY = window.scrollY;
        const scrollDelta = Math.abs(currentScrollY - targetScrollY);

        if (scrollDelta > 20) {
          window.scrollTo({
            top: targetScrollY,
            behavior: 'smooth'
          });
        }

        // Compute coordinates immediately, then lock in once after scroll settles
        computeCoordinates();

        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }
        scrollTimeoutRef.current = setTimeout(() => {
          computeCoordinates();
        }, 320);

      } else if (attempts < maxAttempts) {
        attempts++;
        setTimeout(findAndScrollToElement, 60);
      } else {
        computeCoordinates();
      }
    };

    // Slight micro-delay so react can mount new tab before querying
    setTimeout(findAndScrollToElement, 40);
  }, [steps, onTabChange, computeCoordinates]);

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      goToStep(currentStepIndex + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      goToStep(currentStepIndex - 1);
    }
  };

  const handleComplete = () => {
    try {
      localStorage.setItem(tourKey, 'true');
      localStorage.removeItem('bbdrts_tour_force_launch');
    } catch (_) {}
    onClose();
  };

  const handleSkip = () => {
    try {
      localStorage.setItem(tourKey, 'true');
      localStorage.removeItem('bbdrts_tour_force_launch');
    } catch (_) {}
    onClose();
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleSkip();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentStepIndex, steps.length]);

  // Listen to resize and user scroll with single-frame requestAnimationFrame throttling
  useEffect(() => {
    if (!isOpen) return;

    let ticking = false;
    const handleScrollOrResize = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          computeCoordinates();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [isOpen, computeCoordinates]);

  // Open tour on mount
  useEffect(() => {
    if (isOpen) {
      goToStep(0);
    }
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [isOpen]);

  if (!isOpen || !currentStep) return null;

  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;
  const stepCountText = `${currentStepIndex + 1} out of ${steps.length}`;

  const content = (
    <div className="guided-tour-root" data-theme={theme}>
      {/* ── Spotlight Cutout ── */}
      {targetRect && (
        <div
          className="guided-tour-spotlight"
          style={{
            top: `${targetRect.top}px`,
            left: `${targetRect.left}px`,
            width: `${targetRect.width}px`,
            height: `${targetRect.height}px`
          }}
        />
      )}

      {/* ── Floating Tooltip Card ── */}
      <div
        className="guided-tour-card"
        ref={cardRef}
        style={{
          top: `${cardPosition.top}px`,
          left: `${cardPosition.left}px`,
          opacity: isReady ? 1 : 0
        }}
      >
        {/* Directional Arrow Pointer */}
        {cardPosition.placement === 'right' && (
          <div className="guided-tour-arrow arrow-left" style={cardPosition.arrowOffset} />
        )}
        {cardPosition.placement === 'left' && (
          <div className="guided-tour-arrow arrow-right" style={cardPosition.arrowOffset} />
        )}
        {cardPosition.placement === 'bottom' && (
          <div className="guided-tour-arrow arrow-top" style={cardPosition.arrowOffset} />
        )}
        {cardPosition.placement === 'top' && (
          <div className="guided-tour-arrow arrow-bottom" style={cardPosition.arrowOffset} />
        )}

        {/* Card Header */}
        <div className="guided-tour-header">
          <div className="guided-tour-badge">
            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>help</span>
            <span>{currentStep.badge || `${roleName} Tutorial`}</span>
          </div>
          <button
            type="button"
            className="guided-tour-skip-btn"
            onClick={handleSkip}
            title="Exit tutorial"
          >
            Skip Tour ✕
          </button>
        </div>

        {/* Title */}
        <h4 className="guided-tour-title">
          {currentStep.icon && (
            <span className="material-symbols-outlined guided-tour-title-icon">
              {currentStep.icon}
            </span>
          )}
          <span>{currentStep.title}</span>
        </h4>

        {/* Description */}
        <p className="guided-tour-desc">
          {currentStep.description}
        </p>

        {/* Stepper Dots */}
        <div className="guided-tour-progress-bar">
          {steps.map((_, idx) => (
            <div
              key={idx}
              className={`guided-tour-dot ${idx === currentStepIndex ? 'active' : idx < currentStepIndex ? 'completed' : ''}`}
            />
          ))}
        </div>

        {/* Footer Actions */}
        <div className="guided-tour-footer">
          <span className="guided-tour-step-text">
            Step {stepCountText}
          </span>
          <div className="guided-tour-actions">
            {!isFirstStep && (
              <button
                type="button"
                className="guided-tour-btn guided-tour-btn-prev"
                onClick={handlePrev}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>arrow_back</span>
                Back
              </button>
            )}

            <button
              type="button"
              className={`guided-tour-btn ${isLastStep ? 'guided-tour-btn-finish' : 'guided-tour-btn-next'}`}
              onClick={handleNext}
            >
              <span>{isLastStep ? 'Got It, Let\'s Go!' : 'Next'}</span>
              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                {isLastStep ? 'check' : 'arrow_forward'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
