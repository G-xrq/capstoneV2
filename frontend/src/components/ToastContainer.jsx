import './Toast.css';

const ICON_MAP = {
  success: 'check_circle',
  error: 'error',
  warning: 'warning',
  info: 'info'
};

export default function ToastContainer({ toasts, onDismiss }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast-card toast-${t.type}`}>
          <div className="toast-icon-wrapper">
            <span className="material-symbols-outlined">
              {ICON_MAP[t.type] || 'info'}
            </span>
          </div>

          <div className="toast-body">
            {t.title && <div className="toast-title">{t.title}</div>}
            <div className="toast-message">{t.message}</div>
          </div>

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
}
