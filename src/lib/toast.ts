export type ToastType = 'success' | 'error' | 
  'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

type Listener = (t: ToastItem) => void;
const listeners: Listener[] = [];

export const toastBus = {
  subscribe: (fn: Listener) => {
    listeners.push(fn);
    return () => {
      const i = listeners.indexOf(fn);
      if (i > -1) listeners.splice(i, 1);
    };
  },
  emit: (t: ToastItem) => listeners.forEach(fn => fn(t))
};

const emit = (
  type: ToastType, 
  title: string, 
  message?: string, 
  duration = 3000
) => {
  toastBus.emit({ 
    id: `${Date.now()}-${Math.random()}`, 
    type, title, message, duration 
  });
};

export const toast = {
  success: (title: string, message?: string) => 
    emit('success', title, message, 3000),
  error: (title: string, message?: string) => 
    emit('error', title, message, 5000),
  warning: (title: string, message?: string) => 
    emit('warning', title, message, 4000),
  info: (title: string, message?: string) => 
    emit('info', title, message, 3000),
};
