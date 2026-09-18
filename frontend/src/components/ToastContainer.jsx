import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './Toast.css';

const ICON_MAP = {
  success: 'check_circle',
  error: 'error',
  warning: 'warning',
  info: 'info'
};

export default function ToastContainer({ toasts, onDismiss }) {
  const [theme, setTheme] = useState(() => (
    typeof document !== 'undefined'
      ? (document.documentElement.getAttribute('data-theme') || 'dark')
      : 'dark'
  ));

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const updateTheme = () => {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
      setTheme(currentTheme);
    };
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
    return () => observer.disconnect();
  }, []);

  if (!toasts || toasts.length === 0) return null;

  const content = (
    <div className="toast-container" aria-live="polite" data-theme={theme}>
      {toasts.map((t) => (
        <div key={t.id} className={`toast-card toast-${t.type}`}>
          <div className="toast-icon-wrapper">
            <span className="material-symbols-outlined">
              {t.icon || ICON_MAP[t.type] || 'info'}
            </span>
          </div>

          <div className="toast-body">
            {t.title && <div className="toast-title">{t.title}</div>}
            <div className="toast-message">{t.message}</div>
          </div>

          {t.action && (
            <button
              type="button"
              className="toast-action-btn"
              onClick={(e) => {
                e.stopPropagation();
                if (typeof t.action.onClick === 'function') {
                  t.action.onClick();
                }
                onDismiss(t.id);
              }}
            >
              {t.action.label || 'Action'}
            </button>
          )}

          <button
            className="toast-dismiss-btn"
            onClick={() => onDismiss(t.id)}
            aria-label="Close notification"
          >
            ×
          </button>

          {t.duration > 0 && (
            <div
              className="toast-progress-bar"
              style={{ animationDuration: `${t.duration}ms` }}
            />
          )}
        </div>
      ))}
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}
