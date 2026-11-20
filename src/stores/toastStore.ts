import { create } from 'zustand';
import { uid } from '@/lib/utils';

export type ToastTone = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
  /** Milliseconds before auto-dismiss; 0 keeps it until dismissed. */
  duration: number;
}

interface ToastState {
  toasts: Toast[];
  push: (toast: Omit<Toast, 'id' | 'duration' | 'tone'> & Partial<Pick<Toast, 'duration' | 'tone'>>) => string;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],
  push: (toast) => {
    const id = uid('toast');
    const next: Toast = { id, tone: 'info', duration: 5200, ...toast };
    set((s) => ({ toasts: [...s.toasts.slice(-3), next] }));
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Imperative helper usable outside React (event handlers, mutations). */
export const toast = {
  show: (title: string, description?: string, tone: ToastTone = 'info') => useToastStore.getState().push({ title, description, tone }),
  success: (title: string, description?: string) => useToastStore.getState().push({ title, description, tone: 'success' }),
  error: (title: string, description?: string) => useToastStore.getState().push({ title, description, tone: 'error', duration: 8000 }),
};
