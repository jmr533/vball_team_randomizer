import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';

const TOAST_DURATION = 4000; // 4 seconds

const TOAST_TYPES = {
  success: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    icon: CheckCircle,
    iconColor: 'text-green-600',
    text: 'text-green-800'
  },
  error: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: AlertCircle,
    iconColor: 'text-red-600',
    text: 'text-red-800'
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: Info,
    iconColor: 'text-blue-600',
    text: 'text-blue-800'
  }
};

export function Toast({ id, message, type = 'info', onDismiss }) {
  const [isExiting, setIsExiting] = useState(false);
  const typeConfig = TOAST_TYPES[type] || TOAST_TYPES.info;
  const IconComponent = typeConfig.icon;

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
      className={`transform transition-all duration-300 ${
        isExiting ? 'translate-x-96 opacity-0' : 'translate-x-0 opacity-100'
      }`}
    >
      <div
        className={`flex items-start gap-3 rounded-lg border ${typeConfig.bg} ${typeConfig.border} p-4 shadow-lg`}
      >
        <IconComponent className={`h-5 w-5 flex-shrink-0 ${typeConfig.iconColor}`} />
        <p className={`flex-1 ${typeConfig.text} text-sm font-medium`}>{message}</p>
        <button
          onClick={handleDismiss}
          className={`flex-shrink-0 ${typeConfig.text} opacity-50 hover:opacity-100 transition-opacity`}
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function ToastContainer({ toasts, onDismiss }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast {...toast} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
}
