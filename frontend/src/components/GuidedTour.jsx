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
  const [cardPosition, setCardPosition] = useState({ top: 100, left: 100, placement: 'bottom' });
  const [isReady, setIsReady] = useState(false);
  const animationFrameRef = useRef(null);

  const currentStep = steps[currentStepIndex] || null;

  // Calculate coordinates with generous padding and optimal non-overlapping card position
  const computeCoordinates = useCallback(() => {
    if (!currentStep) return;

    const el = document.querySelector(currentStep.target);
    if (!el) {
      setTargetRect(null);
      setCardPosition({
        top: Math.max(window.innerHeight / 2 - 120, 20),
        left: Math.max(window.innerWidth / 2 - 188, 16),
        placement: 'none'
      });
      setIsReady(true);
      return;
    }

    const rect = el.getBoundingClientRect();
    // Generous breathing room so elements are never cropped or overlayed
    const padX = 12;
    const padY = 8;
    const computedTarget = {
      top: Math.max(0, rect.top - padY),
      left: Math.max(0, rect.left - padX),
      width: rect.width + padX * 2,
      height: rect.height + padY * 2
    };
    setTargetRect(computedTarget);

    const cardWidth = Math.min(375, window.innerWidth - 32);
    const cardHeight = 230;
    const margin = 20;

    // Mobile / Narrow screen fallback: dock card at bottom or top away from target
    if (window.innerWidth < 768) {
      const isTargetInUpperHalf = computedTarget.top + computedTarget.height / 2 < window.innerHeight / 2;
      const top = isTargetInUpperHalf
        ? Math.min(window.innerHeight - cardHeight - 16, Math.max(computedTarget.top + computedTarget.height + margin, 16))
        : 16;
      const left = 16;
      setCardPosition({ top, left, placement: isTargetInUpperHalf ? 'bottom' : 'top' });
      setIsReady(true);
      return;
    }

    // Desktop: Evaluate clearance on all 4 sides to guarantee zero overlapping
    const spaceRight = window.innerWidth - (computedTarget.left + computedTarget.width);
    const spaceLeft = computedTarget.left;
    const spaceBottom = window.innerHeight - (computedTarget.top + computedTarget.height);
    const spaceTop = computedTarget.top;

    let preferred = currentStep.placement || 'auto';
    let chosenPlacement = preferred;

    if (preferred === 'right' && spaceRight >= cardWidth + margin) {
      chosenPlacement = 'right';
    } else if (preferred === 'left' && spaceLeft >= cardWidth + margin) {
      chosenPlacement = 'left';
    } else if (preferred === 'bottom' && spaceBottom >= cardHeight + margin) {
      chosenPlacement = 'bottom';
    } else if (preferred === 'top' && spaceTop >= cardHeight + margin) {
      chosenPlacement = 'top';
    } else {
      // Auto pick side with maximum clearance
      const spaces = [
        { side: 'right', space: spaceRight },
        { side: 'bottom', space: spaceBottom },
        { side: 'left', space: spaceLeft },
        { side: 'top', space: spaceTop }
      ];
      spaces.sort((a, b) => b.space - a.space);
      chosenPlacement = spaces[0].side;
    }

    let top = 0;
    let left = 0;

    switch (chosenPlacement) {
      case 'right':
        left = computedTarget.left + computedTarget.width + margin;
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
        top = computedTarget.top + computedTarget.height + margin;
        left = computedTarget.left + computedTarget.width / 2 - cardWidth / 2;
        break;
    }

    // Strict viewport clamping to keep tooltip card completely in view
    left = Math.max(16, Math.min(window.innerWidth - cardWidth - 16, left));
    top = Math.max(16, Math.min(window.innerHeight - cardHeight - 16, top));

    setCardPosition({ top, left, placement: chosenPlacement });
    setIsReady(true);
  }, [currentStep]);

  // Navigate to step with smooth element scrolling and frame-accurate tracking
  const goToStep = useCallback((index) => {
    if (index < 0 || index >= steps.length) return;
    setCurrentStepIndex(index);

    const step = steps[index];
    if (step && step.tab && typeof onTabChange === 'function') {
      onTabChange(step.tab);
    }

    // Scroll target into view with robust element polling across tab transitions
    let attempts = 0;
    const pollAndAnchor = () => {
      const el = step.target ? document.querySelector(step.target) : null;
      if (el && el.getBoundingClientRect().width > 0) {
        try {
          el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        } catch (_) {}
        computeCoordinates();

        // Track positioning continuously across the 450ms scroll transition for zero glitching
        let start = Date.now();
        const trackMotion = () => {
          computeCoordinates();
          if (Date.now() - start < 450) {
            animationFrameRef.current = requestAnimationFrame(trackMotion);
          }
        };
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = requestAnimationFrame(trackMotion);
      } else if (attempts < 20) {
        attempts++;
        setTimeout(pollAndAnchor, 50);
      } else {
        computeCoordinates();
      }
    };
    pollAndAnchor();
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

  // Listen to resize and scroll
  useEffect(() => {
    if (!isOpen) return;

    const onScrollOrResize = () => {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = requestAnimationFrame(computeCoordinates);
    };

    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);

    return () => {
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isOpen, computeCoordinates]);

  // Open tour on mount
  useEffect(() => {
    if (isOpen) {
      goToStep(0);
    }
    return () => cancelAnimationFrame(animationFrameRef.current);
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
        style={{
          top: `${cardPosition.top}px`,
          left: `${cardPosition.left}px`,
          opacity: isReady ? 1 : 0
        }}
      >
        {/* Directional Arrow Pointer */}
        {cardPosition.placement === 'right' && <div className="guided-tour-arrow arrow-left" />}
        {cardPosition.placement === 'left' && <div className="guided-tour-arrow arrow-right" />}
        {cardPosition.placement === 'bottom' && <div className="guided-tour-arrow arrow-top" />}
        {cardPosition.placement === 'top' && <div className="guided-tour-arrow arrow-bottom" />}

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
