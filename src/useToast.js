import { useState, useCallback } from 'react';

let toastId = 0;

/**
 * Custom hook for managing toast notifications
 * @returns {Object} Object with toasts array, dismiss, success, and error functions
 */
export function useToast() {
  const [toasts, setToasts] = useState([]);

  const show = useCallback((message, type = 'info', action) => {
    const id = toastId++;
    const toast = { id, message, type, action };
    
    setToasts((prevToasts) => [...prevToasts, toast]);
    
    return id;
  }, []);

  const dismiss = useCallback((id) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  }, []);

  const success = useCallback((message) => show(message, 'success'), [show]);
  const error = useCallback((message) => show(message, 'error'), [show]);
  const info = useCallback((message, action) => show(message, 'info', action), [show]);
  return {
    toasts,
    dismiss,
    success,
    error,
    info
  };
}
