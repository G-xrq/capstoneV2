import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import './GuidedTour.css';

/**
 * Universal Guided Spotlight Onboarding Tour Component
 * Displays a darkened backdrop with a clear spotlight cutout over the target element,
 * along with an explanatory card and directional arrow.
 */
export default function GuidedTour({
  isOpen,
  onClose,
  steps = [],
  onTabChange,
  tourKey = 'bbdrts_tour_completed',
  roleName = 'User'
}) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const [cardPosition, setCardPosition] = useState({ top: 100, left: 100, placement: 'bottom' });
  const [isVisible, setIsVisible] = useState(false);
  const updateTimeoutRef = useRef(null);

  const currentStep = steps[currentStepIndex] || null;

  // Calculate position of spotlight and card relative to the target element
  const updatePosition = useCallback(() => {
    if (!currentStep) return;

    const el = document.querySelector(currentStep.target);
    if (!el) {
      // Element not found: center the card gracefully
      setTargetRect(null);
      setCardPosition({
        top: Math.max(window.innerHeight / 2 - 120, 20),
        left: Math.max(window.innerWidth / 2 - 180, 20),
        placement: 'none'
      });
      setIsVisible(true);
      return;
    }

    const rect = el.getBoundingClientRect();
    const padding = 6;
    const computedTarget = {
      top: Math.max(0, rect.top - padding),
      left: Math.max(0, rect.left - padding),
      width: rect.width + padding * 2,
      height: rect.height + padding * 2
    };
    setTargetRect(computedTarget);

    // Compute Card Coordinates
    const cardWidth = 360;
    const cardHeight = 220;
    const margin = 16;
    let preferred = currentStep.placement || 'auto';

    let top = 0;
    let left = 0;
    let finalPlacement = preferred;

    if (preferred === 'auto') {
      const spaceRight = window.innerWidth - (computedTarget.left + computedTarget.width);
      const spaceBottom = window.innerHeight - (computedTarget.top + computedTarget.height);
      const spaceLeft = computedTarget.left;

      if (spaceRight >= cardWidth + margin) {
        finalPlacement = 'right';
      } else if (spaceBottom >= cardHeight + margin) {
        finalPlacement = 'bottom';
      } else if (spaceLeft >= cardWidth + margin) {
        finalPlacement = 'left';
      } else {
        finalPlacement = 'top';
      }
    }

    switch (finalPlacement) {
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

    // Viewport clamping
    left = Math.max(16, Math.min(window.innerWidth - cardWidth - 16, left));
    top = Math.max(16, Math.min(window.innerHeight - cardHeight - 16, top));

    setCardPosition({ top, left, placement: finalPlacement });
    setIsVisible(true);
  }, [currentStep]);

  // Navigate between steps
  const goToStep = useCallback((index) => {
    if (index < 0 || index >= steps.length) return;
    setIsVisible(false);
    setCurrentStepIndex(index);

    const step = steps[index];
    if (step && step.tab && typeof onTabChange === 'function') {
      onTabChange(step.tab);
    }

    // Allow DOM to settle before querying target element
    clearTimeout(updateTimeoutRef.current);
    updateTimeoutRef.current = setTimeout(() => {
      const targetEl = document.querySelector(step.target);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
      setTimeout(updatePosition, 160);
    }, 120);
  }, [steps, onTabChange, updatePosition]);

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
    } catch (_) {}
    onClose();
  };

  const handleSkip = () => {
    try {
      localStorage.setItem(tourKey, 'true');
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

  // Handle window resizing and scrolling
  useEffect(() => {
    if (!isOpen) return;

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, updatePosition]);

  // Initial trigger when tour opens
  useEffect(() => {
    if (isOpen) {
      goToStep(0);
    }
    return () => clearTimeout(updateTimeoutRef.current);
  }, [isOpen]);

  if (!isOpen || !currentStep) return null;

  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;
  const stepCountText = `${currentStepIndex + 1} out of ${steps.length}`;

  const content = (
    <div className="guided-tour-root">
      {/* ── Spotlight Box ── */}
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

      {/* ── Explanatory Floating Card ── */}
      <div
        className="guided-tour-card"
        style={{
          top: `${cardPosition.top}px`,
          left: `${cardPosition.left}px`,
          opacity: isVisible ? 1 : 0
        }}
      >
        {/* Directional Arrow Pointer */}
        {cardPosition.placement === 'right' && <div className="guided-tour-arrow arrow-left" />}
        {cardPosition.placement === 'left' && <div className="guided-tour-arrow arrow-right" />}
        {cardPosition.placement === 'bottom' && <div className="guided-tour-arrow arrow-top" />}
        {cardPosition.placement === 'top' && <div className="guided-tour-arrow arrow-bottom" />}

        {/* Header */}
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

        {/* Progress Dots */}
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
