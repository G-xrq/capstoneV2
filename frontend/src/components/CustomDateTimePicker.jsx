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
  showPresets = true,
  disabled = false,
  align = 'left'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Parse initial or incoming value
  const parsedDate = useMemo(() => parseDateSafe(value), [value]);

  // Calendar view navigation (Month / Year)
  const [calViewDate, setCalViewDate] = useState(() => parsedDate || new Date());

  // Internal state for selected components
  const [selectedIsoDate, setSelectedIsoDate] = useState(() => {
    if (!parsedDate) return '';
    const y = parsedDate.getFullYear();
    const m = String(parsedDate.getMonth() + 1).padStart(2, '0');
    const d = String(parsedDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });

  const [selectedHour, setSelectedHour] = useState(() => {
    if (!parsedDate) return 12;
    const h = parsedDate.getHours() % 12;
    return h === 0 ? 12 : h;
  });

  const [selectedMinute, setSelectedMinute] = useState(() => {
    if (!parsedDate) return 0;
    return parsedDate.getMinutes();
  });

  const [selectedAmpm, setSelectedAmpm] = useState(() => {
    if (!parsedDate) return 'PM';
    return parsedDate.getHours() >= 12 ? 'PM' : 'AM';
  });

  // Keep internal state synchronized when external value changes
  useEffect(() => {
    if (parsedDate) {
      const y = parsedDate.getFullYear();
      const m = String(parsedDate.getMonth() + 1).padStart(2, '0');
      const d = String(parsedDate.getDate()).padStart(2, '0');
      setSelectedIsoDate(`${y}-${m}-${d}`);
      const h = parsedDate.getHours() % 12;
      setSelectedHour(h === 0 ? 12 : h);
      setSelectedMinute(parsedDate.getMinutes());
      setSelectedAmpm(parsedDate.getHours() >= 12 ? 'PM' : 'AM');
      setCalViewDate(parsedDate);
    } else if (!value) {
      setSelectedIsoDate('');
    }
  }, [value, parsedDate]);

  // Close on click outside or Escape
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Compute Calendar Month Grid (Unrestricted selection, NO colored dots)
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
    // Previous month tail days
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevDate = new Date(year, month - 1, dayNum);
      const iso = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      cells.push({ dayNum, iso, isCurrentMonth: false, isPast: iso < todayIso, isToday: iso === todayIso });
    }
    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ dayNum: d, iso, isCurrentMonth: true, isPast: iso < todayIso, isToday: iso === todayIso });
    }
    // Next month head days to fill 7-col grid cleanly
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

  // Build the combined Date object and notify parent
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

  // Day click on calendar
  const handleSelectDay = (iso) => {
    setSelectedIsoDate(iso);
    commitDateTime(iso, selectedHour, selectedMinute, selectedAmpm);
  };

  // Time component changes
  const handleHourChange = (newHour) => {
    const val = parseInt(newHour, 10) || 12;
    setSelectedHour(val);
    commitDateTime(selectedIsoDate, val, selectedMinute, selectedAmpm);
  };

  const handleMinuteChange = (newMin) => {
    const val = parseInt(newMin, 10) || 0;
    setSelectedMinute(val);
    commitDateTime(selectedIsoDate, selectedHour, val, selectedAmpm);
  };

  const handleAmpmChange = (newAmpm) => {
    setSelectedAmpm(newAmpm);
    commitDateTime(selectedIsoDate, selectedHour, selectedMinute, newAmpm);
  };

  // Preset offsets (+15m, +30m, +1h, etc.)
  const handleApplyPreset = (minutesOffset) => {
    const target = new Date();
    target.setMinutes(target.getMinutes() + minutesOffset);
    applyDateObject(target);
  };

  const handleApplyTomorrow = (targetHour24 = 9) => {
    const target = new Date();
    target.setDate(target.getDate() + 1);
    target.setHours(targetHour24, 0, 0, 0);
    applyDateObject(target);
  };

  const handleApplyNow = () => {
    applyDateObject(new Date());
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
    setSelectedAmpm(ampm);
    setCalViewDate(targetDate);

    const formatted = formatFriendlyDate(targetDate);
    if (onChange) onChange(formatted, targetDate);
  };

  const handleClear = (e) => {
    if (e) e.stopPropagation();
    setSelectedIsoDate('');
    if (onChange) onChange('', null);
  };

  // Human preview text of current selection
  const previewText = useMemo(() => {
    if (!selectedIsoDate) return 'No date selected';
    const [y, m, d] = selectedIsoDate.split('-').map(Number);
    let h24 = selectedHour % 12;
    if (selectedAmpm === 'PM') h24 += 12;
    const temp = new Date(y, m - 1, d, h24, selectedMinute, 0);
    return formatFriendlyDate(temp);
  }, [selectedIsoDate, selectedHour, selectedMinute, selectedAmpm]);

  return (
    <div className={`bbdrts-custom-dt-root ${align === 'right' ? 'align-right' : ''}`} ref={containerRef}>
      
      {/* ── Custom Trigger Box (Replaces Native Browser Input) ── */}
      <button
        type="button"
        disabled={disabled}
        className={`bbdrts-custom-dt-trigger ${isOpen ? 'open' : ''} ${highlight ? 'highlight' : ''} ${value ? 'has-value' : ''}`}
        onClick={() => !disabled && setIsOpen(prev => !prev)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <span className="material-symbols-outlined trigger-icon">
          {icon}
        </span>

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
          <span className="material-symbols-outlined trigger-chevron">
            expand_more
          </span>
        </div>
      </button>

      {/* ── Custom Calendar Popover with Time Panel on the Side ── */}
      {isOpen && (
        <div className="bbdrts-custom-dt-popover" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
          
          {/* ════ LEFT COLUMN: CUSTOM CALENDAR (Image 1 Style, NO Dots) ════ */}
          <div className="dt-cal-column">
            
            {/* Header: Prev, Month Year, Today Chip, Next */}
            <div className="dt-cal-header">
              <button
                type="button"
                className="dt-cal-header-btn"
                onClick={() => setCalViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                title="Previous Month"
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
                  title="Select today's date"
                >
                  Today
                </button>
              </div>

              <button
                type="button"
                className="dt-cal-header-btn"
                onClick={() => setCalViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                title="Next Month"
              >
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>

            {/* Weekdays Row: SU MO TU WE TH FR SA */}
            <div className="dt-cal-weekdays">
              {['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'].map(d => (
                <span key={d}>{d}</span>
              ))}
            </div>

            {/* 7-Col Days Grid */}
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

            <div className="dt-cal-bottom-hint">
              <span>Click any date to select</span>
            </div>
          </div>

          {/* ════ VERTICAL DIVIDER ════ */}
          <div className="dt-cal-divider" aria-hidden="true" />

          {/* ════ RIGHT COLUMN: TIME & PRESETS PANEL (On the side of the calendar) ════ */}
          <div className="dt-time-column">
            
            {/* 1. Time Selection Section */}
            <div className="dt-section-block">
              <div className="dt-section-title">
                <span className="material-symbols-outlined">schedule</span>
                <span>SET TIME</span>
              </div>

              <div className="dt-time-picker-row">
                
                {/* Hour Selector (01 - 12) */}
                <div className="dt-time-unit">
                  <label htmlFor="dt-select-hour" className="dt-time-sub">HR</label>
                  <select
                    id="dt-select-hour"
                    className="dt-select-input"
                    value={selectedHour}
                    onChange={(e) => handleHourChange(e.target.value)}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(h => (
                      <option key={h} value={h}>
                        {String(h).padStart(2, '0')}
                      </option>
                    ))}
                  </select>
                </div>

                <span className="dt-time-colon">:</span>

                {/* Minute Selector (00 - 59) */}
                <div className="dt-time-unit">
                  <label htmlFor="dt-select-min" className="dt-time-sub">MIN</label>
                  <select
                    id="dt-select-min"
                    className="dt-select-input"
                    value={selectedMinute}
                    onChange={(e) => handleMinuteChange(e.target.value)}
                  >
                    {Array.from({ length: 60 }, (_, m) => m).map(m => (
                      <option key={m} value={m}>
                        {String(m).padStart(2, '0')}
                      </option>
                    ))}
                  </select>
                </div>

                {/* AM / PM Segmented Control */}
                <div className="dt-ampm-switch">
                  <button
                    type="button"
                    className={`dt-ampm-btn ${selectedAmpm === 'AM' ? 'active' : ''}`}
                    onClick={() => handleAmpmChange('AM')}
                  >
                    AM
                  </button>
                  <button
                    type="button"
                    className={`dt-ampm-btn ${selectedAmpm === 'PM' ? 'active' : ''}`}
                    onClick={() => handleAmpmChange('PM')}
                  >
                    PM
                  </button>
                </div>

              </div>
            </div>

            {/* 2. Quick Duration Presets Strip */}
            {showPresets && (
              <div className="dt-section-block">
                <div className="dt-section-title">
                  <span className="material-symbols-outlined">bolt</span>
                  <span>QUICK PRESETS</span>
                </div>

                <div className="dt-presets-grid">
                  <button type="button" className="dt-preset-pill" onClick={() => handleApplyPreset(5)}>+5m</button>
                  <button type="button" className="dt-preset-pill" onClick={() => handleApplyPreset(15)}>+15m</button>
                  <button type="button" className="dt-preset-pill" onClick={() => handleApplyPreset(30)}>+30m</button>
                  <button type="button" className="dt-preset-pill" onClick={() => handleApplyPreset(60)}>+1 Hour</button>
                  <button type="button" className="dt-preset-pill" onClick={() => handleApplyPreset(120)}>+2 Hours</button>
                  <button type="button" className="dt-preset-pill" onClick={() => handleApplyPreset(240)}>+4 Hours</button>
                  <button type="button" className="dt-preset-pill highlight-preset" onClick={() => handleApplyTomorrow(9)}>Tomorrow 9 AM</button>
                </div>
              </div>
            )}

            {/* 3. Live Selected Preview & Footer Actions */}
            <div className="dt-column-footer">
              <div className="dt-live-preview-box">
                <span className="preview-label">Selected Target:</span>
                <strong className="preview-val" title={previewText}>
                  {previewText}
                </strong>
              </div>

              <div className="dt-actions-row">
                <button
                  type="button"
                  className="dt-btn-set-now"
                  onClick={handleApplyNow}
                  title="Set to current moment"
                >
                  Set to Now
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
