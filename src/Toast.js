import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';

const TOAST_DURATION = 4000; // 4 seconds

const TOAST_TYPES = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info
};

export function Toast({ id, message, type = 'info', onDismiss }) {
  const [isExiting, setIsExiting] = useState(false);
  const IconComponent = TOAST_TYPES[type] || TOAST_TYPES.info;

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onDismiss(id), 300);
    }, TOAST_DURATION);

    return () => clearTimeout(timer);
  }, [id, onDismiss]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => onDismiss(id), 300);
  };

  return (
    <div
      role="status"
      className={`toast toast-${type} ${isExiting ? 'toast-exit' : ''}`}
    >
      <IconComponent className="toast-icon h-5 w-5" />
      <p className="toast-message">{message}</p>
      <button
        onClick={handleDismiss}
        className="toast-dismiss"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ToastContainer({ toasts, onDismiss }) {
  return (
    <div className="toast-wrap">
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}