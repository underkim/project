export type ToastType = 'success' | 'error' | 'info';

export interface ToastAction {
  label: string;
  href: string;
}

export function showToast(message: string, type: ToastType = 'success', action?: ToastAction) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('app-toast', { detail: { message, type, action } }));
}
