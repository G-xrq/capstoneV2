import React, { useState, useEffect, useRef, useMemo } from 'react';
import './SearchableAddressSelect.css';

export default function SearchableAddressSelect({
  label,
  icon,
  placeholder = '-- Select --',
  hint,
  disabled = false,
  disabledPlaceholder = '-- Select Previous First --',
  items = [], // Array of { code: string, name: string }
  selectedCode = '',
  selectedName = '',
  onSelect,   // ({ code, name }) => void
  onClear,    // () => void
  isLoading = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Keep displayed text in sync with parent's selectedName when not actively editing
  useEffect(() => {
    if (!isTyping) {
      setQuery(selectedName || '');
    }
  }, [selectedName, isTyping]);

  // Close and revert uncommitted query on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setIsTyping(false);
        setQuery(selectedName || '');
        setFocusedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedName]);

  // Priority Filter: Names starting with query appear first, followed by names containing query
  const filteredItems = useMemo(() => {
    if (!query || !isTyping) return items;
    const cleanQ = query.trim().toLowerCase();
    if (!cleanQ) return items;

    const startsWithMatches = [];
    const containsMatches = [];

    for (const item of items) {
      const nameLower = (item.name || '').toLowerCase();
      if (nameLower.startsWith(cleanQ)) {
        startsWithMatches.push(item);
      } else if (nameLower.includes(cleanQ)) {
        containsMatches.push(item);
      }
    }

    return [...startsWithMatches, ...containsMatches];
  }, [items, query, isTyping]);

  const handleInputFocus = () => {
    if (disabled || isLoading) return;
    setIsOpen(true);
    setFocusedIndex(-1);
    if (inputRef.current) {
      inputRef.current.select();
    }
  };

  const handleInputChange = (e) => {
    if (disabled || isLoading) return;
    setIsTyping(true);
    setQuery(e.target.value);
    setIsOpen(true);
    setFocusedIndex(0);
  };

  const handleItemSelect = (item) => {
    setIsTyping(false);
    setQuery(item.name);
    setIsOpen(false);
    setFocusedIndex(-1);
    if (onSelect) {
      onSelect(item);
    }
  };

  const handleClear = (e) => {
    e.stopPropagation();
    setIsTyping(false);
    setQuery('');
    setIsOpen(false);
    setFocusedIndex(-1);
    if (onClear) onClear();
    if (inputRef.current) inputRef.current.focus();
  };

  const handleKeyDown = (e) => {
    if (disabled || isLoading) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setFocusedIndex(0);
      } else {
        setFocusedIndex(prev => (prev + 1 < filteredItems.length ? prev + 1 : 0));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (isOpen) {
        setFocusedIndex(prev => (prev - 1 >= 0 ? prev - 1 : filteredItems.length - 1));
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen && filteredItems.length > 0) {
        const targetIndex = focusedIndex >= 0 && focusedIndex < filteredItems.length ? focusedIndex : 0;
        handleItemSelect(filteredItems[targetIndex]);
      } else {
        setIsOpen(true);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setIsTyping(false);
      setQuery(selectedName || '');
      setFocusedIndex(-1);
    }
  };

  // Scroll focused option into view
  useEffect(() => {
    if (focusedIndex >= 0 && listRef.current) {
      const optionEls = listRef.current.querySelectorAll('.bbdrts-searchable-option');
      if (optionEls[focusedIndex]) {
        optionEls[focusedIndex].scrollIntoView({ block: 'nearest' });
      }
    }
  }, [focusedIndex]);

  return (
    <div className={`bbdrts-searchable-select-wrap ${disabled ? 'is-disabled' : ''}`} ref={containerRef}>
      {label && <label className="bbdrts-studio-label">{label}</label>}

      <div className={`bbdrts-searchable-input-box ${isOpen ? 'is-open' : ''}`}>
        {icon && (
          <span className="material-symbols-outlined bbdrts-searchable-icon">
            {icon}
          </span>
        )}

        <input
          ref={inputRef}
          type="text"
          className="bbdrts-searchable-input"
          placeholder={disabled ? disabledPlaceholder : (isLoading ? 'Loading options...' : placeholder)}
          value={query}
          disabled={disabled || isLoading}
          onFocus={handleInputFocus}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          spellCheck="false"
        />

        <div className="bbdrts-searchable-actions">
          {isLoading && (
            <div className="bbdrts-searchable-spinner" />
          )}

          {!disabled && !isLoading && (query || selectedCode) && (
            <button
              type="button"
              className="bbdrts-searchable-clear-btn"
              onClick={handleClear}
              title="Clear selection"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>close</span>
            </button>
          )}

          <button
            type="button"
            className="bbdrts-searchable-arrow-btn"
            disabled={disabled || isLoading}
            tabIndex={-1}
            onClick={() => {
              if (disabled || isLoading) return;
              setIsOpen(prev => !prev);
              if (!isOpen && inputRef.current) {
                inputRef.current.focus();
              }
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              {isOpen ? 'expand_less' : 'expand_more'}
            </span>
          </button>
        </div>
      </div>

      {hint && <span className="bbdrts-status-hint">{hint}</span>}

      {/* Floating Options Dropdown Menu */}
      {isOpen && !disabled && (
        <div className="bbdrts-searchable-dropdown" ref={listRef} role="listbox">
          {filteredItems.length === 0 ? (
            <div className="bbdrts-searchable-empty">
              No matching locations found
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = item.code === selectedCode;
              const isFocused = idx === focusedIndex;
              return (
                <div
                  key={item.code}
                  className={`bbdrts-searchable-option ${isSelected ? 'selected' : ''} ${isFocused ? 'is-focused' : ''}`}
                  onClick={() => handleItemSelect(item)}
                  role="option"
                  aria-selected={isSelected}
                >
                  <span className="bbdrts-searchable-option-text">
                    {item.name}
                  </span>
                  {isSelected && (
                    <span className="material-symbols-outlined bbdrts-searchable-check">
                      check
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
