import { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './GeistSelect.css';

function computePopoverStyle(triggerEl, { alignRight, menuMinWidth, searchable, itemCount }) {
  if (!triggerEl) return null;
  const rect = triggerEl.getBoundingClientRect();
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;
  const minW = menuMinWidth || (searchable ? 340 : Math.max(rect.width, 200));
  const desiredWidth = Math.max(rect.width, Math.min(minW, viewportW - 32));
  const finalWidth = Math.min(desiredWidth, viewportW - 24);

  let left = alignRight ? rect.right - finalWidth : rect.left;
  if (left + finalWidth > viewportW - 12) left = viewportW - finalWidth - 12;
  if (left < 12) left = 12;

  const spaceBelow = viewportH - rect.bottom - 14;
  const spaceAbove = rect.top - 14;
  const estimatedH = Math.min(340, (searchable ? 54 : 14) + itemCount * 42);
  const openUpward = spaceBelow < Math.min(estimatedH, 220) && spaceAbove > spaceBelow;

  return {
    position: 'fixed',
    left: `${Math.round(left)}px`,
    width: `${Math.round(finalWidth)}px`,
    ...(openUpward
      ? { bottom: `${Math.round(viewportH - rect.top + 6)}px`, top: 'auto' }
      : { top: `${Math.round(rect.bottom + 6)}px`, bottom: 'auto' }),
    maxHeight: `${Math.max(160, Math.min(350, (openUpward ? spaceAbove : spaceBelow) - 8))}px`
  };
}

/**
 * Reusable Dual-Theme Vercel Geist Dropdown (Single-Select)
 * - Portal-anchored popover (auto-flips upward, clamps to viewport, zero scroll clipping)
 * - Optional built-in search bar for long lists
 * - Rich option rows with icon, subtitle, badge, and active emerald checkmark
 */
export default function GeistSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Select option...',
  searchable = false,
  searchPlaceholder = 'Search...',
  emptyText = 'No matching options',
  alignRight = false,
  compact = false,
  activeHighlight = false,
  width,
  menuMinWidth
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [menuStyle, setMenuStyle] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const searchInputRef = useRef(null);

  const selectedOption = useMemo(
    () => options.find((o) => String(o.id) === String(value)) || options[0] || null,
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) =>
      `${o.label || ''} ${o.sub || ''} ${o.badge || ''} ${o.id || ''}`.toLowerCase().includes(q)
    );
  }, [options, query]);

  const reposition = () => {
    setMenuStyle(
      computePopoverStyle(triggerRef.current, {
        alignRight,
        menuMinWidth,
        searchable,
        itemCount: options.length
      })
    );
  };

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    reposition();
    if (searchable) {
      setTimeout(() => searchInputRef.current?.focus(), 20);
    }

    const handleOutside = (e) => {
      if (triggerRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleKey, true);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleKey, true);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open, searchable, options.length]);

  return (
    <div
      className="gs-dd-root"
      style={width ? { width, maxWidth: '100%' } : undefined}
    >
      <button
        ref={triggerRef}
        type="button"
        className={`gs-dd-trigger ${open ? 'is-open' : ''} ${compact ? 'is-compact' : ''} ${activeHighlight ? 'is-active-filter' : ''}`}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="gs-dd-trigger-left">
          {selectedOption?.icon && (
            <span className="material-symbols-outlined gs-dd-trigger-ico">
              {selectedOption.icon}
            </span>
          )}
          <span
            className="gs-dd-trigger-label"
            title={selectedOption?.triggerLabel || selectedOption?.label || placeholder}
          >
            {selectedOption?.triggerLabel || selectedOption?.label || placeholder}
          </span>
        </span>
        <span className="material-symbols-outlined gs-dd-chevron">expand_more</span>
      </button>

      {open && menuStyle && createPortal(
        <div
          ref={menuRef}
          className="gs-dd-popover"
          style={menuStyle}
          role="listbox"
          onClick={(e) => e.stopPropagation()}
        >
          {searchable && (
            <div className="gs-dd-search-wrap">
              <span className="material-symbols-outlined gs-dd-search-ico">search</span>
              <input
                ref={searchInputRef}
                type="text"
                className="gs-dd-search-input"
                placeholder={searchPlaceholder}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button
                  type="button"
                  className="gs-dd-search-clear"
                  onClick={() => setQuery('')}
                  aria-label="Clear filter"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              )}
            </div>
          )}

          <div className="gs-dd-list">
            {filteredOptions.length === 0 ? (
              <div className="gs-dd-empty">{emptyText}</div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = String(opt.id) === String(value);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={`gs-dd-option ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => {
                      onChange?.(opt.id);
                      setOpen(false);
                    }}
                  >
                    {opt.icon && (
                      <span className="material-symbols-outlined gs-dd-opt-ico">
                        {opt.icon}
                      </span>
                    )}
                    <span className="gs-dd-opt-text">
                      <span className="gs-dd-opt-label" title={opt.label}>{opt.label}</span>
                      {opt.sub && <span className="gs-dd-opt-sub" title={opt.sub}>{opt.sub}</span>}
                    </span>
                    {opt.badge && <span className="gs-dd-opt-badge">{opt.badge}</span>}
                    {isSelected && (
                      <span className="material-symbols-outlined gs-dd-check">check</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

/**
 * Reusable Dual-Theme Vercel Geist Multi-Select Dropdown (e.g., Tags filter)
 */
export function GeistMultiSelect({
  selected = [],
  onToggle,
  onClear,
  options = [], // [{ id, label, count }]
  label = 'Tags',
  allLabel = 'All Tags',
  allCount = 0,
  icon = 'sell',
  searchable = true,
  searchPlaceholder = 'Search tags...',
  emptyText = 'No tags found',
  alignRight = false,
  compact = true,
  width,
  menuMinWidth = 260
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [menuStyle, setMenuStyle] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const searchInputRef = useRef(null);

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) =>
      `${o.label || ''} ${o.id || ''}`.toLowerCase().includes(q)
    );
  }, [options, query]);

  const reposition = () => {
    setMenuStyle(
      computePopoverStyle(triggerRef.current, {
        alignRight,
        menuMinWidth,
        searchable,
        itemCount: options.length + 1
      })
    );
  };

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    reposition();
    if (searchable) {
      setTimeout(() => searchInputRef.current?.focus(), 20);
    }

    const handleOutside = (e) => {
      if (triggerRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleKey, true);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleKey, true);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open, searchable, options.length]);

  const selectedCount = selected.length;

  return (
    <div
      className="gs-dd-root"
      style={width ? { width, maxWidth: '100%' } : undefined}
    >
      <button
        ref={triggerRef}
        type="button"
        className={`gs-dd-trigger ${open ? 'is-open' : ''} ${compact ? 'is-compact' : ''} ${selectedCount > 0 ? 'is-active-filter' : ''}`}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="gs-dd-trigger-left">
          <span className="material-symbols-outlined gs-dd-trigger-ico">{icon}</span>
          <span className="gs-dd-trigger-label">{label}</span>
          {selectedCount > 0 && (
            <span className="gs-dd-count-pill">{selectedCount}</span>
          )}
        </span>
        <span className="material-symbols-outlined gs-dd-chevron">expand_more</span>
      </button>

      {open && menuStyle && createPortal(
        <div
          ref={menuRef}
          className="gs-dd-popover"
          style={menuStyle}
          role="listbox"
          aria-multiselectable="true"
          onClick={(e) => e.stopPropagation()}
        >
          {searchable && (
            <div className="gs-dd-search-wrap">
              <span className="material-symbols-outlined gs-dd-search-ico">search</span>
              <input
                ref={searchInputRef}
                type="text"
                className="gs-dd-search-input"
                placeholder={searchPlaceholder}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {selectedCount > 0 && (
                <button
                  type="button"
                  className="gs-dd-multi-clear"
                  onClick={() => onClear?.()}
                >
                  Clear ({selectedCount})
                </button>
              )}
            </div>
          )}

          <div className="gs-dd-list">
            {!query.trim() && (
              <button
                type="button"
                role="option"
                aria-selected={selectedCount === 0}
                className={`gs-dd-option ${selectedCount === 0 ? 'is-selected' : ''}`}
                onClick={() => onClear?.()}
              >
                <span className="material-symbols-outlined gs-dd-opt-ico">apps</span>
                <span className="gs-dd-opt-text">
                  <span className="gs-dd-opt-label">{allLabel}</span>
                </span>
                <span className="gs-dd-opt-badge">{allCount}</span>
                {selectedCount === 0 && (
                  <span className="material-symbols-outlined gs-dd-check">check</span>
                )}
              </button>
            )}

            {filteredOptions.length === 0 ? (
              <div className="gs-dd-empty">{emptyText}</div>
            ) : (
              filteredOptions.map((opt) => {
                const isChecked = selected.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="option"
                    aria-selected={isChecked}
                    className={`gs-dd-option ${isChecked ? 'is-selected' : ''}`}
                    onClick={() => onToggle?.(opt.id)}
                  >
                    <span className={`gs-dd-checkbox ${isChecked ? 'is-checked' : ''}`} aria-hidden="true">
                      {isChecked && <span className="material-symbols-outlined">check</span>}
                    </span>
                    <span className="gs-dd-opt-text">
                      <span className="gs-dd-opt-label" title={opt.label}>{opt.label}</span>
                    </span>
                    {opt.count > 0 && <span className="gs-dd-opt-badge">{opt.count}</span>}
                  </button>
                );
              })
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
