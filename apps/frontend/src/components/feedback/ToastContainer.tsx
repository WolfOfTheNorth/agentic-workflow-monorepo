import React, { createContext, ReactNode, useCallback, useContext, useState } from 'react';
import Toast, { ToastType } from './Toast';

interface ToastData {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextValue {
  showToast: (toast: Omit<ToastData, 'id'>) => string;
  removeToast: (id: string) => void;
  clearAllToasts: () => void;

  // Convenience methods
  showSuccess: (title: string, message?: string, options?: Partial<ToastData>) => string;
  showError: (title: string, message?: string, options?: Partial<ToastData>) => string;
  showWarning: (title: string, message?: string, options?: Partial<ToastData>) => string;
  showInfo: (title: string, message?: string, options?: Partial<ToastData>) => string;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface ToastProviderProps {
  children: ReactNode;
  maxToasts?: number;
  position?:
    | 'top-right'
    | 'top-left'
    | 'bottom-right'
    | 'bottom-left'
    | 'top-center'
    | 'bottom-center';
}

export const ToastProvider: React.FC<ToastProviderProps> = ({
  children,
  maxToasts = 5,
  position = 'top-right',
}) => {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const generateId = useCallback(() => {
    return `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const showToast = useCallback(
    (toastData: Omit<ToastData, 'id'>) => {
      const id = generateId();
      const newToast: ToastData = { id, ...toastData };

      setToasts(prev => {
        const updated = [...prev, newToast];
        // Remove oldest toasts if we exceed the maximum
        if (updated.length > maxToasts) {
          return updated.slice(-maxToasts);
        }
        return updated;
      });

      return id;
    },
    [generateId, maxToasts]
  );

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const clearAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  // Convenience methods
  const showSuccess = useCallback(
    (title: string, message?: string, options: Partial<ToastData> = {}) => {
      return showToast({ type: 'success', title, message, ...options });
    },
    [showToast]
  );

  const showError = useCallback(
    (title: string, message?: string, options: Partial<ToastData> = {}) => {
      return showToast({ type: 'error', title, message, duration: 7000, ...options });
    },
    [showToast]
  );

  const showWarning = useCallback(
    (title: string, message?: string, options: Partial<ToastData> = {}) => {
      return showToast({ type: 'warning', title, message, ...options });
    },
    [showToast]
  );

  const showInfo = useCallback(
    (title: string, message?: string, options: Partial<ToastData> = {}) => {
      return showToast({ type: 'info', title, message, ...options });
    },
    [showToast]
  );

  const contextValue: ToastContextValue = {
    showToast,
    removeToast,
    clearAllToasts,
    showSuccess,
    showError,
    showWarning,
    showInfo,
  };

  const getPositionClasses = () => {
    const base = 'fixed z-50 pointer-events-none';
    switch (position) {
      case 'top-right':
        return `${base} top-4 right-4`;
      case 'top-left':
        return `${base} top-4 left-4`;
      case 'bottom-right':
        return `${base} bottom-4 right-4`;
      case 'bottom-left':
        return `${base} bottom-4 left-4`;
      case 'top-center':
        return `${base} top-4 left-1/2 transform -translate-x-1/2`;
      case 'bottom-center':
        return `${base} bottom-4 left-1/2 transform -translate-x-1/2`;
      default:
        return `${base} top-4 right-4`;
    }
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}

      {/* Toast Container */}
      <div className={getPositionClasses()} aria-live='polite' aria-label='Notifications'>
        <div className='flex flex-col space-y-2'>
          {toasts.map(toast => (
            <Toast
              key={toast.id}
              id={toast.id}
              type={toast.type}
              title={toast.title}
              message={toast.message}
              duration={toast.duration}
              action={toast.action}
              onClose={removeToast}
            />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
};

export default ToastProvider;
