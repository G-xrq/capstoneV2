import { useState, useEffect, useRef, useMemo } from 'react';
import './CustomDateTimePicker.css';

/**
 * Helper: Format a Date object into human-friendly "MMM D, YYYY, h:mm A"
 * e.g. "Nov 12, 2026, 6:00 PM"
 */
export function formatFriendlyDate(d) {
  if (!d || isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Helper: Parse any date string into a valid Date object or null
 */
export function parseDateSafe(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

export default function CustomDateTimePicker({
  value = '',
  onChange,
  placeholder = 'Select date and time...',
  icon = 'event_available',
  highlight = false,
  showPresets = false,
  disabled = false,
  align = 'left',
  invalid = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const parsedDate = useMemo(() => parseDateSafe(value), [value]);
  const [calViewDate, setCalViewDate] = useState(() => parsedDate || new Date());

  const [selectedIsoDate, setSelectedIsoDate] = useState(() => {
    if (!parsedDate) return '';
    const y = parsedDate.getFullYear();
    const m = String(parsedDate.getMonth() + 1).padStart(2, '0');
    const d = String(parsedDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });

  const [selectedHour, setSelectedHour] = useState(() => {
    if (!parsedDate) {
      const h = new Date().getHours() % 12;
      return h === 0 ? 12 : h;
    }
    const h = parsedDate.getHours() % 12;
    return h === 0 ? 12 : h;
  });

  const [selectedMinute, setSelectedMinute] = useState(() => {
    if (!parsedDate) return new Date().getMinutes();
    return parsedDate.getMinutes();
  });

  const [selectedAmpm, setSelectedAmpm] = useState(() => {
    if (!parsedDate) return new Date().getHours() >= 12 ? 'PM' : 'AM';
    return parsedDate.getHours() >= 12 ? 'PM' : 'AM';
  });

  // Draft text states for clean direct typing in Hour / Minute boxes
  const [hourDraft, setHourDraft] = useState(() => String(selectedHour).padStart(2, '0'));
  const [minuteDraft, setMinuteDraft] = useState(() => String(selectedMinute).padStart(2, '0'));

  useEffect(() => {
    if (parsedDate) {
      const y = parsedDate.getFullYear();
      const m = String(parsedDate.getMonth() + 1).padStart(2, '0');
      const d = String(parsedDate.getDate()).padStart(2, '0');
      setSelectedIsoDate(`${y}-${m}-${d}`);
      const h = parsedDate.getHours() % 12;
      const h12 = h === 0 ? 12 : h;
      const min = parsedDate.getMinutes();
      setSelectedHour(h12);
      setSelectedMinute(min);
      setHourDraft(String(h12).padStart(2, '0'));
      setMinuteDraft(String(min).padStart(2, '0'));
      setSelectedAmpm(parsedDate.getHours() >= 12 ? 'PM' : 'AM');
      setCalViewDate(parsedDate);
    } else if (!value) {
      setSelectedIsoDate('');
    }
  }, [value, parsedDate]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const calMonthCells = useMemo(() => {
    const year = calViewDate.getFullYear();
    const month = calViewDate.getMonth();
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const cells = [];
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevDate = new Date(year, month - 1, dayNum);
      const iso = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      cells.push({ dayNum, iso, isCurrentMonth: false, isPast: iso < todayIso, isToday: iso === todayIso });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ dayNum: d, iso, isCurrentMonth: true, isPast: iso < todayIso, isToday: iso === todayIso });
    }
    const remaining = 7 - (cells.length % 7);
    if (remaining < 7) {
      for (let j = 1; j <= remaining; j++) {
        const nextDate = new Date(year, month + 1, j);
        const iso = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(j).padStart(2, '0')}`;
        cells.push({ dayNum: j, iso, isCurrentMonth: false, isPast: iso < todayIso, isToday: iso === todayIso });
      }
    }
    return cells;
  }, [calViewDate]);

  const commitDateTime = (targetIsoDate, hour, minute, ampm) => {
    let baseDate = targetIsoDate;
    if (!baseDate) {
      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      const d = String(today.getDate()).padStart(2, '0');
      baseDate = `${y}-${m}-${d}`;
      setSelectedIsoDate(baseDate);
    }

    const [y, m, d] = baseDate.split('-').map(Number);
    let h24 = hour % 12;
    if (ampm === 'PM') h24 += 12;

    const resultDate = new Date(y, m - 1, d, h24, minute, 0);
    const formatted = formatFriendlyDate(resultDate);
    if (onChange) onChange(formatted, resultDate);
  };

  const applyDateObject = (targetDate) => {
    const y = targetDate.getFullYear();
    const m = String(targetDate.getMonth() + 1).padStart(2, '0');
    const d = String(targetDate.getDate()).padStart(2, '0');
    const iso = `${y}-${m}-${d}`;
    const h = targetDate.getHours() % 12;
    const hour12 = h === 0 ? 12 : h;
    const min = targetDate.getMinutes();
    const ampm = targetDate.getHours() >= 12 ? 'PM' : 'AM';

    setSelectedIsoDate(iso);
    setSelectedHour(hour12);
    setSelectedMinute(min);
    setHourDraft(String(hour12).padStart(2, '0'));
    setMinuteDraft(String(min).padStart(2, '0'));
    setSelectedAmpm(ampm);
    setCalViewDate(targetDate);

    const formatted = formatFriendlyDate(targetDate);
    if (onChange) onChange(formatted, targetDate);
  };

  const handleSelectDay = (iso) => {
    setSelectedIsoDate(iso);
    commitDateTime(iso, selectedHour, selectedMinute, selectedAmpm);
  };

  const stepHour = (delta) => {
    const next = ((selectedHour - 1 + delta + 12) % 12) + 1;
    setSelectedHour(next);
    setHourDraft(String(next).padStart(2, '0'));
    commitDateTime(selectedIsoDate, next, selectedMinute, selectedAmpm);
  };

  const stepMinute = (delta) => {
    const next = (selectedMinute + delta + 60) % 60;
    setSelectedMinute(next);
    setMinuteDraft(String(next).padStart(2, '0'));
    commitDateTime(selectedIsoDate, selectedHour, next, selectedAmpm);
  };

  const setExactMinute = (min) => {
    const clamped = Math.max(0, Math.min(59, min));
    setSelectedMinute(clamped);
    setMinuteDraft(String(clamped).padStart(2, '0'));
    commitDateTime(selectedIsoDate, selectedHour, clamped, selectedAmpm);
  };

  const commitHourDraft = (rawText) => {
    const num = parseInt(rawText, 10);
    if (!Number.isNaN(num) && num >= 1 && num <= 12) {
      setSelectedHour(num);
      setHourDraft(String(num).padStart(2, '0'));
      commitDateTime(selectedIsoDate, num, selectedMinute, selectedAmpm);
    } else {
      setHourDraft(String(selectedHour).padStart(2, '0'));
    }
  };

  const commitMinuteDraft = (rawText) => {
    const num = parseInt(rawText, 10);
    if (!Number.isNaN(num) && num >= 0 && num <= 59) {
      setSelectedMinute(num);
      setMinuteDraft(String(num).padStart(2, '0'));
      commitDateTime(selectedIsoDate, selectedHour, num, selectedAmpm);
    } else {
      setMinuteDraft(String(selectedMinute).padStart(2, '0'));
    }
  };

  const handleAmpmChange = (newAmpm) => {
    if (newAmpm === selectedAmpm) return;
    setSelectedAmpm(newAmpm);
    commitDateTime(selectedIsoDate, selectedHour, selectedMinute, newAmpm);
  };

  const handleApplyPreset = (minutesOffset) => {
    const target = new Date();
    target.setMinutes(target.getMinutes() + minutesOffset);
    target.setSeconds(0, 0);
    applyDateObject(target);
  };

  const handleClear = (e) => {
    if (e) e.stopPropagation();
    setSelectedIsoDate('');
    if (onChange) onChange('', null);
  };

  return (
    <div className={`bbdrts-custom-dt-root ${align === 'right' ? 'align-right' : ''}`} ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        className={`bbdrts-custom-dt-trigger ${isOpen ? 'open' : ''} ${highlight ? 'highlight' : ''} ${invalid ? 'invalid' : ''} ${value ? 'has-value' : ''}`}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <span className="material-symbols-outlined trigger-icon">{icon}</span>

        <span className="trigger-display-text">
          {value || placeholder}
        </span>

        <div className="trigger-actions">
          {value && (
            <span
              role="button"
              tabIndex={0}
              className="trigger-clear-btn"
              onClick={handleClear}
              onKeyDown={(e) => { if (e.key === 'Enter') handleClear(e); }}
              title="Clear date and time"
            >
              <span className="material-symbols-outlined">close</span>
            </span>
          )}
          <span className="material-symbols-outlined trigger-chevron">expand_more</span>
        </div>
      </button>

      {isOpen && (
        <div
          className="bbdrts-custom-dt-popover"
          role="dialog"
          aria-modal="false"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Left Column: Month Calendar */}
          <div className="dt-cal-column">
            <div className="dt-cal-header">
              <button
                type="button"
                className="dt-cal-header-btn"
                onClick={() => setCalViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                title="Previous Month"
                aria-label="Previous month"
              >
                <span className="material-symbols-outlined">chevron_left</span>
              </button>

              <div className="dt-cal-title-wrap">
                <span className="dt-cal-month-title">
                  {calViewDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </span>
                <button
                  type="button"
                  className="dt-cal-today-chip"
                  onClick={() => {
                    const now = new Date();
                    setCalViewDate(now);
                    const y = now.getFullYear();
                    const m = String(now.getMonth() + 1).padStart(2, '0');
                    const d = String(now.getDate()).padStart(2, '0');
                    handleSelectDay(`${y}-${m}-${d}`);
                  }}
                  title="Jump to today"
                >
                  Today
                </button>
              </div>

              <button
                type="button"
                className="dt-cal-header-btn"
                onClick={() => setCalViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                title="Next Month"
                aria-label="Next month"
              >
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>

            <div className="dt-cal-weekdays">
              {['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>

            <div className="dt-cal-grid">
              {calMonthCells.map((cell) => {
                const isSelected = selectedIsoDate === cell.iso;
                return (
                  <button
                    key={cell.iso}
                    type="button"
                    className={`dt-cal-day ${!cell.isCurrentMonth ? 'outside' : ''} ${cell.isPast ? 'past' : ''} ${cell.isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelectDay(cell.iso)}
                  >
                    <span>{cell.dayNum}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="dt-cal-divider" aria-hidden="true" />

          {/* Right Column: Clean Geist Time Picker */}
          <div className="dt-time-column">
            <div className="dt-section-block">
              <div className="dt-section-title">
                <span className="material-symbols-outlined">schedule</span>
                <span>Time</span>
              </div>

              {/* Hour : Minute Steppers (Editable + Arrows + Wheel, zero native selects) */}
              <div className="dt-stepper-box">
                <div className="dt-stepper-unit">
                  <button
                    type="button"
                    className="dt-step-arrow"
                    onClick={() => stepHour(1)}
                    aria-label="Increase hour"
                  >
                    <span className="material-symbols-outlined">keyboard_arrow_up</span>
                  </button>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={2}
                    className="dt-step-input"
                    aria-label="Hour"
                    value={hourDraft}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 2);
                      setHourDraft(digits);
                    }}
                    onBlur={(e) => commitHourDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowUp') { e.preventDefault(); stepHour(1); }
                      if (e.key === 'ArrowDown') { e.preventDefault(); stepHour(-1); }
                      if (e.key === 'Enter') commitHourDraft(hourDraft);
                    }}
                  />
                  <span className="dt-step-caption">HR</span>
                  <button
                    type="button"
                    className="dt-step-arrow"
                    onClick={() => stepHour(-1)}
                    aria-label="Decrease hour"
                  >
                    <span className="material-symbols-outlined">keyboard_arrow_down</span>
                  </button>
                </div>

                <span className="dt-stepper-colon">:</span>

                <div className="dt-stepper-unit">
                  <button
                    type="button"
                    className="dt-step-arrow"
                    onClick={() => stepMinute(1)}
                    aria-label="Increase minute"
                  >
                    <span className="material-symbols-outlined">keyboard_arrow_up</span>
                  </button>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={2}
                    className="dt-step-input"
                    aria-label="Minute"
                    value={minuteDraft}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 2);
                      setMinuteDraft(digits);
                    }}
                    onBlur={(e) => commitMinuteDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowUp') { e.preventDefault(); stepMinute(1); }
                      if (e.key === 'ArrowDown') { e.preventDefault(); stepMinute(-1); }
                      if (e.key === 'Enter') commitMinuteDraft(minuteDraft);
                    }}
                  />
                  <span className="dt-step-caption">MIN</span>
                  <button
                    type="button"
                    className="dt-step-arrow"
                    onClick={() => stepMinute(-1)}
                    aria-label="Decrease minute"
                  >
                    <span className="material-symbols-outlined">keyboard_arrow_down</span>
                  </button>
                </div>
              </div>

              {/* Full-Width AM / PM Segmented Switch (Zero Clipping) */}
              <div className="dt-ampm-segmented" role="group" aria-label="AM or PM">
                <button
                  type="button"
                  className={`dt-ampm-seg-btn ${selectedAmpm === 'AM' ? 'active' : ''}`}
                  onClick={() => handleAmpmChange('AM')}
                >
                  AM
                </button>
                <button
                  type="button"
                  className={`dt-ampm-seg-btn ${selectedAmpm === 'PM' ? 'active' : ''}`}
                  onClick={() => handleAmpmChange('PM')}
                >
                  PM
                </button>
              </div>

              {/* Quick Quarter-Hour Minutes */}
              <div className="dt-quick-mins" role="group" aria-label="Quick minutes">
                {[0, 15, 30, 45].map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`dt-min-chip ${selectedMinute === m ? 'active' : ''}`}
                    onClick={() => setExactMinute(m)}
                  >
                    :{String(m).padStart(2, '0')}
                  </button>
                ))}
              </div>
            </div>

            {showPresets && (
              <div className="dt-section-block">
                <div className="dt-section-title">
                  <span className="material-symbols-outlined">bolt</span>
                  <span>Quick Offset</span>
                </div>
                <div className="dt-presets-grid">
                  <button type="button" className="dt-preset-pill" onClick={() => handleApplyPreset(15)}>+15m</button>
                  <button type="button" className="dt-preset-pill" onClick={() => handleApplyPreset(30)}>+30m</button>
                  <button type="button" className="dt-preset-pill" onClick={() => handleApplyPreset(60)}>+1h</button>
                  <button type="button" className="dt-preset-pill" onClick={() => handleApplyPreset(120)}>+2h</button>
                </div>
              </div>
            )}

            <div className="dt-column-footer">
              <div className="dt-actions-row">
                <button
                  type="button"
                  className="dt-btn-clear"
                  onClick={() => {
                    handleClear();
                    setIsOpen(false);
                  }}
                >
                  Clear
                </button>

                <button
                  type="button"
                  className="dt-btn-apply-done"
                  onClick={() => setIsOpen(false)}
                >
                  <span className="material-symbols-outlined">check</span>
                  <span>Done</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
