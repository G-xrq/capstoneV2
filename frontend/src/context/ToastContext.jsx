import { createContext, useContext, useState, useCallback } from 'react';
import ToastContainer from '../components/ToastContainer';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((type, message, title = '', duration = 4000) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 9);
    
    // Auto title defaults if not specified
    let toastTitle = title;
    if (!toastTitle) {
      if (type === 'success') toastTitle = 'Success';
      else if (type === 'error') toastTitle = 'Action Failed';
      else if (type === 'warning') toastTitle = 'Attention';
      else toastTitle = 'System Notice';
    }

    const newToast = { id, type, title: toastTitle, message, duration };

    setToasts((prevToasts) => [...prevToasts.slice(-4), newToast]); // Keep max 5 active toasts

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }

    return id;
  }, [removeToast]);

  const showSuccess = useCallback((message, title, duration) => showToast('success', message, title, duration), [showToast]);
  const showError   = useCallback((message, title, duration) => showToast('error', message, title, duration), [showToast]);
  const showWarning = useCallback((message, title, duration) => showToast('warning', message, title, duration), [showToast]);
  const showInfo    = useCallback((message, title, duration) => showToast('info', message, title, duration), [showToast]);

  // Bind global window dispatcher fallback so non-React helpers (like web3Connection.js) can dispatch toasts
  if (typeof window !== 'undefined') {
    window.showToast = (type, message, title, duration) => showToast(type, message, title, duration);
  }

  return (
    <ToastContext.Provider value={{ showToast, showSuccess, showError, showWarning, showInfo, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    // Fallback if component is outside ToastProvider
    return {
      showToast: (type, msg, title, dur) => {
        if (typeof window !== 'undefined' && window.showToast) {
          window.showToast(type, msg, title, dur);
        } else {
          console.log(`[Toast ${type.toUpperCase()}]: ${msg}`);
        }
      },
      showSuccess: (msg, title, dur) => (window.showToast ? window.showToast('success', msg, title, dur) : console.log(msg)),
      showError:   (msg, title, dur) => (window.showToast ? window.showToast('error', msg, title, dur) : console.error(msg)),
      showWarning: (msg, title, dur) => (window.showToast ? window.showToast('warning', msg, title, dur) : console.warn(msg)),
      showInfo:    (msg, title, dur) => (window.showToast ? window.showToast('info', msg, title, dur) : console.log(msg)),
      removeToast: () => {}
    };
  }
  return context;
}
