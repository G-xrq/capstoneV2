import React, { useEffect, useMemo, useRef, useState } from 'react';
import { API_URL } from '../config';

// Module-level client cache keyed by "city|province" so switching/typing never re-fetches PSGC barangays
const clientPsgcCache = new Map();

function normKey(v) {
  return String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^city of\s+/i, '')
    .replace(/\s+city$/i, '')
    .trim();
}

function normBrgy(v) {
  return String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^(brgy\.?|barangay)\s+/i, '')
    .replace(/\s*\((pob\.?|poblacion)\)/gi, '')
    .trim();
}

export default function BarangayCombobox({
  value = '',
  onChange,
  city = '',
  province = '',
  suggestedBarangay = '',
  onDismissSuggestion,
  prefetchedBarangays = [],
  prefetchedForCity = '',
  disabled = false,
  inputClassName = 'input deploy-field-input',
  placeholder = 'Select or type official Barangay',
  variant = 'deploy' // 'deploy' | 'edit'
}) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef(null);

  const cityKey = normKey(city);
  const provKey = normKey(province);
  const cacheKey = `${cityKey}|${provKey}`;

  // Hydrate immediately if map reverse-geocode already delivered official PSA PSGC barangays for this city
  useEffect(() => {
    if (
      Array.isArray(prefetchedBarangays) &&
      prefetchedBarangays.length > 0 &&
      cityKey &&
      normKey(prefetchedForCity) === cityKey
    ) {
      clientPsgcCache.set(cacheKey, { barangays: prefetchedBarangays, source: 'PSA PSGC' });
      setOptions(prefetchedBarangays);
      setSource('PSA PSGC');
    }
  }, [prefetchedBarangays, prefetchedForCity, cityKey, cacheKey]);

  // Fetch official PSA PSGC barangays whenever city / province changes
  useEffect(() => {
    if (!cityKey || cityKey.length < 2) {
      setOptions([]);
      setSource('');
      setLoading(false);
      return;
    }

    if (clientPsgcCache.has(cacheKey)) {
      const cached = clientPsgcCache.get(cacheKey);
      setOptions(cached.barangays || []);
      setSource(cached.source || '');
      setLoading(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('city', city.trim());
        if (province && province.trim()) params.set('province', province.trim());
        const res = await fetch(`${API_URL}/api/geo/barangays?${params.toString()}`);
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          if (cancelled) return;
          const list = Array.isArray(data?.barangays) ? data.barangays : [];
          const src = data?.source || '';
          if (list.length > 0) {
            clientPsgcCache.set(cacheKey, { barangays: list, source: src });
          }
          setOptions(list);
          setSource(src);
        }
      } catch (_) {
        if (!cancelled) {
          setOptions([]);
          setSource('');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 240);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [city, province, cityKey, cacheKey]);

  // Close popover on outside click
  useEffect(() => {
    const handleOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const filtered = useMemo(() => {
    if (!options.length) return [];
    const q = normBrgy(value);
    if (!q) return options;
    const starts = [];
    const contains = [];
    for (const opt of options) {
      const n = normBrgy(opt);
      if (n.startsWith(q) || opt.toLowerCase().startsWith(q)) starts.push(opt);
      else if (n.includes(q) || opt.toLowerCase().includes(q)) contains.push(opt);
    }
    return [...starts, ...contains];
  }, [options, value]);

  const isPsaVerified = useMemo(() => {
    if (!value || !options.length) return false;
    const valNorm = normBrgy(value);
    return options.some((opt) => normBrgy(opt) === valNorm);
  }, [value, options]);

  const showSuggestion = Boolean(
    suggestedBarangay &&
    normBrgy(suggestedBarangay) !== normBrgy(value)
  );

  const handleSelect = (brgyName) => {
    if (onChange) onChange(brgyName);
    setOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      if (filtered.length > 0) setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && activeIndex >= 0 && filtered[activeIndex]) {
      e.preventDefault();
      handleSelect(filtered[activeIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const isEdit = variant === 'edit';

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          className={isEdit ? undefined : inputClassName}
          type="text"
          placeholder={options.length > 0 ? `Search ${options.length} PSA barangays...` : placeholder}
          value={value}
          onChange={(e) => {
            if (onChange) onChange(e.target.value);
            if (!open && options.length > 0) setOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => {
            if (options.length > 0) setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          autoComplete="off"
          style={{
            width: '100%',
            paddingRight: options.length > 0 || isPsaVerified || loading ? '36px' : undefined
          }}
        />

        {/* Right indicator: loading spinner, verified check, or dropdown chevron */}
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled || (!options.length && !loading)}
          onClick={() => {
            if (options.length > 0) setOpen((prev) => !prev);
          }}
          title={
            isPsaVerified
              ? `Verified official ${source || 'PSA PSGC'} barangay`
              : options.length > 0
                ? `Choose from ${options.length} official ${source || 'PSA PSGC'} barangays`
                : 'Enter Municipality / City to load official PSA barangays'
          }
          style={{
            position: 'absolute',
            right: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'transparent',
            border: 'none',
            padding: '2px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: options.length > 0 ? 'pointer' : 'default',
            color: isPsaVerified
              ? '#22c55e'
              : isEdit
                ? '#a1a1aa'
                : 'var(--text-muted)'
          }}
        >
          {loading ? (
            <span className="material-symbols-outlined spin" style={{ fontSize: '16px' }}>progress_activity</span>
          ) : isPsaVerified ? (
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>verified</span>
          ) : options.length > 0 ? (
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              {open ? 'expand_less' : 'expand_more'}
            </span>
          ) : null}
        </button>
      </div>

      {/* Official PSA PSGC Searchable Dropdown */}
      {open && options.length > 0 && !disabled && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 60,
            background: isEdit ? '#111113' : 'var(--bg-elevated, #111113)',
            border: `1px solid ${isEdit ? 'rgba(255,255,255,0.12)' : 'var(--border, rgba(255,255,255,0.12))'}`,
            borderRadius: '10px',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.35)',
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              padding: '6px 10px',
              fontSize: '0.68rem',
              fontWeight: 600,
              color: isEdit ? '#a1a1aa' : 'var(--text-muted)',
              borderBottom: `1px solid ${isEdit ? 'rgba(255,255,255,0.08)' : 'var(--border, rgba(255,255,255,0.08))'}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '13px', color: '#22c55e' }}>verified</span>
              <span>{source || 'PSA PSGC'} Official List</span>
            </span>
            <span>{filtered.length} / {options.length}</span>
          </div>

          <div style={{ maxHeight: '210px', overflowY: 'auto', padding: '4px' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '10px', fontSize: '0.76rem', color: isEdit ? '#71717a' : 'var(--text-muted)', textAlign: 'center' }}>
                No matching barangay in {city}. You can still keep your typed entry.
              </div>
            ) : (
              filtered.map((opt, idx) => {
                const isSelected = normBrgy(opt) === normBrgy(value);
                const isActive = idx === activeIndex;
                return (
                  <button
                    key={opt}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelect(opt);
                    }}
                    onMouseEnter={() => setActiveIndex(idx)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '7px 10px',
                      borderRadius: '6px',
                      border: 'none',
                      background: isSelected
                        ? 'rgba(34, 197, 94, 0.14)'
                        : isActive
                          ? (isEdit ? 'rgba(255,255,255,0.07)' : 'var(--bg-hover, rgba(128,128,128,0.12))')
                          : 'transparent',
                      color: isSelected
                        ? '#22c55e'
                        : isEdit
                          ? '#ededed'
                          : 'var(--text-primary)',
                      fontSize: '0.8rem',
                      fontWeight: isSelected ? 600 : 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px'
                    }}
                  >
                    <span>{opt}</span>
                    {isSelected && (
                      <span className="material-symbols-outlined" style={{ fontSize: '15px', color: '#22c55e' }}>check</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Optional Unconfirmed Map-Nearby Hint (NEVER silently auto-filled!) */}
      {showSuggestion && !disabled && (
        <div
          style={{
            marginTop: '5px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '6px',
            padding: '4px 8px',
            borderRadius: '7px',
            fontSize: '0.71rem',
            background: isEdit ? 'rgba(245, 158, 11, 0.08)' : 'var(--bg-inset, rgba(245, 158, 11, 0.08))',
            border: '1px solid rgba(245, 158, 11, 0.28)',
            color: isEdit ? '#d4d4d8' : 'var(--text-secondary)'
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Map nearby (verify): <strong style={{ color: isEdit ? '#fafafa' : 'var(--text-primary)' }}>{suggestedBarangay}</strong>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => {
                handleSelect(suggestedBarangay);
                if (onDismissSuggestion) onDismissSuggestion();
              }}
              style={{
                background: 'rgba(34, 197, 94, 0.14)',
                color: '#22c55e',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                borderRadius: '5px',
                padding: '1px 7px',
                fontSize: '0.69rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Use
            </button>
            {onDismissSuggestion && (
              <button
                type="button"
                onClick={onDismissSuggestion}
                title="Dismiss suggestion"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: isEdit ? '#71717a' : 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '0 2px',
                  display: 'inline-flex',
                  alignItems: 'center'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>close</span>
              </button>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
