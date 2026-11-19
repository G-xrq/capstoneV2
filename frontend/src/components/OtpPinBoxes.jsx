import { useRef, useEffect } from 'react';

/**
 * OtpPinBoxes - Sleek 6-Digit Individual Box PIN Input (Vercel Dark Theme)
 * Supports auto-focus, paste, keyboard navigation, and onComplete callback.
 */
export default function OtpPinBoxes({ value = '', onChange, onComplete, autoFocus = true, onSubmit }) {
  const inputRefs = [useRef(null), useRef(null), useRef(null), useRef(null), useRef(null), useRef(null)];

  const cleanVal = String(value || '').replace(/\D/g, '').slice(0, 6);
  const digits = Array.from({ length: 6 }, (_, i) => cleanVal[i] || '');

  useEffect(() => {
    if (autoFocus && inputRefs[0]?.current && !cleanVal) {
      inputRefs[0].current.focus();
    }
  }, [autoFocus]);

  const handleChange = (index, e) => {
    const rawChar = e.target.value.replace(/\D/g, '');
    if (!rawChar) {
      const next = [...digits];
      next[index] = '';
      const combined = next.join('');
      onChange?.(combined);
      return;
    }

    const lastChar = rawChar.slice(-1);
    const next = [...digits];
    next[index] = lastChar;
    const combined = next.join('');
    onChange?.(combined);

    if (index < 5 && lastChar) {
      inputRefs[index + 1]?.current?.focus();
    }

    if (combined.length === 6) {
      onComplete?.(combined);
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const currentCombined = digits.join('');
      if (onSubmit) {
        onSubmit(e, currentCombined);
      } else if (onComplete && currentCombined.length === 6) {
        onComplete(currentCombined);
      }
      return;
    }

    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        inputRefs[index - 1]?.current?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs[index - 1]?.current?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs[index + 1]?.current?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) {
      onChange?.(pasted);
      const focusIndex = Math.min(pasted.length, 5);
      inputRefs[focusIndex]?.current?.focus();
      if (pasted.length === 6) {
        onComplete?.(pasted);
      }
    }
  };

  return (
    <div className="otp-boxes-container" onPaste={handlePaste}>
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={inputRefs[i]}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={digit}
          onChange={e => handleChange(i, e)}
          onKeyDown={e => handleKeyDown(i, e)}
          className={`otp-single-box ${digit ? 'filled' : ''}`}
          autoFocus={autoFocus && i === 0}
          aria-label={`Digit ${i + 1}`}
        />
      ))}
    </div>
  );
}
