import { useCallback } from 'react';
import { useToast, ToastAction } from '../components/ui/Toast';

/**
 * Helper de feedback de UX global.
 * Centraliza mensagens de sucesso, erro, info e avisos
 * usando o ToastProvider já montado no App root.
 */
export function useAppFeedback() {
  const { showToast } = useToast();

  const success = useCallback(
    (message: string, action?: ToastAction) => showToast(message, 'success', action),
    [showToast],
  );

  const error = useCallback(
    (message: string, action?: ToastAction) => showToast(message, 'error', action),
    [showToast],
  );

  const info = useCallback(
    (message: string, action?: ToastAction) => showToast(message, 'info', action),
    [showToast],
  );

  const warning = useCallback(
    (message: string, action?: ToastAction) => showToast(message, 'warning', action),
    [showToast],
  );

  return { success, error, info, warning };
}
