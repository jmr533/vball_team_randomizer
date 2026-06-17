import { useState, useCallback } from 'react';

let toastId = 0;

/**
 * Custom hook for managing toast notifications
 * @returns {Object} Object with toasts array and show function
 */
export function useToast() {
  const [toasts, setToasts] = useState([]);

  const show = useCallback((message, type = 'info') => {
    const id = toastId++;
    const toast = { id, message, type };
    
    setToasts((prevToasts) => [...prevToasts, toast]);
    
    return id;
  }, []);

  const dismiss = useCallback((id) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  }, []);

  const success = useCallback((message) => show(message, 'success'), [show]);
  const error = useCallback((message) => show(message, 'error'), [show]);
  const info = useCallback((message) => show(message, 'info'), [show]);

  return {
    toasts,
    dismiss,
    show,
    success,
    error,
    info
  };
}
