'use client';

import {
  createContext,
  FormEvent,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

type ToastTone = 'info' | 'success' | 'warning' | 'danger';

interface ToastItem {
  id: string;
  title?: string;
  message: string;
  tone: ToastTone;
}

interface DialogState {
  kind: 'alert' | 'confirm' | 'prompt';
  title: string;
  message: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  resolve: (value: string | boolean | null) => void;
}

interface FeedbackApi {
  toast: (message: string, opts?: { title?: string; tone?: ToastTone }) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  alert: (message: string, title?: string) => Promise<void>;
  confirm: (
    message: string,
    title?: string,
    opts?: { confirmLabel?: string; cancelLabel?: string; danger?: boolean },
  ) => Promise<boolean>;
  prompt: (message: string, opts?: { title?: string; defaultValue?: string }) => Promise<string | null>;
}

const FeedbackContext = createContext<FeedbackApi | null>(null);

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [promptValue, setPromptValue] = useState('');
  const dialogRef = useRef<HTMLFormElement>(null);

  const closeDialog = useCallback((value: string | boolean | null) => {
    setDialog((current) => {
      current?.resolve(value);
      return null;
    });
  }, []);

  useEffect(() => {
    if (!dialog) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeDialog(dialog.kind === 'alert' ? true : null);
      }
    };
    window.addEventListener('keydown', onKey);
    dialogRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog, closeDialog]);

  const removeToast = useCallback((id: string) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, opts?: { title?: string; tone?: ToastTone }) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((list) => [...list, {
      id,
      message,
      title: opts?.title,
      tone: opts?.tone ?? 'info',
    }]);
    window.setTimeout(() => removeToast(id), 4200);
  }, [removeToast]);

  const openDialog = useCallback(( partial: Omit<DialogState, 'resolve'> ) => {
    return new Promise<string | boolean | null>((resolve) => {
      setPromptValue(partial.defaultValue ?? '');
      setDialog({ ...partial, resolve });
    });
  }, []);

  const api = useMemo<FeedbackApi>(() => ({
    toast,
    success: (message, title = 'موفق') => toast(message, { title, tone: 'success' }),
    error: (message, title = 'خطا') => toast(message, { title, tone: 'danger' }),
    alert: async (message, title = 'پیام') => {
      await openDialog({
        kind: 'alert',
        title,
        message,
        confirmLabel: 'باشه',
      });
    },
    confirm: async (message, title = 'تأیید', opts) => {
      const result = await openDialog({
        kind: 'confirm',
        title,
        message,
        confirmLabel: opts?.confirmLabel ?? 'تأیید',
        cancelLabel: opts?.cancelLabel ?? 'انصراف',
        danger: opts?.danger,
      });
      return Boolean(result);
    },
    prompt: async (message, opts) => {
      const result = await openDialog({
        kind: 'prompt',
        title: opts?.title ?? 'ورود اطلاعات',
        message,
        defaultValue: opts?.defaultValue ?? '',
        confirmLabel: 'ثبت',
        cancelLabel: 'انصراف',
      });
      return typeof result === 'string' ? result : null;
    },
  }), [toast, openDialog]);

  function onDialogSubmit(e: FormEvent) {
    e.preventDefault();
    if (!dialog) return;
    if (dialog.kind === 'prompt') closeDialog(promptValue);
    else if (dialog.kind === 'confirm') closeDialog(true);
    else closeDialog(true);
  }

  return (
    <FeedbackContext.Provider value={api}>
      {children}

      <div className="ui-toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`ui-toast tone-${t.tone}`} role="status">
            <div className="ui-toast-body">
              {t.title && <strong>{t.title}</strong>}
              <p>{t.message}</p>
            </div>
            <button type="button" className="ui-toast-close" onClick={() => removeToast(t.id)} aria-label="بستن">
              ×
            </button>
          </div>
        ))}
      </div>

      {dialog && (
        <div className="ui-dialog-backdrop" role="presentation" onClick={() => closeDialog(dialog.kind === 'confirm' || dialog.kind === 'prompt' ? null : true)}>
          <form
            ref={dialogRef}
            className="ui-dialog-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ui-dialog-title"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            onSubmit={onDialogSubmit}
          >
            <h3 id="ui-dialog-title">{dialog.title}</h3>
            <p className="ui-dialog-message">{dialog.message}</p>
            {dialog.kind === 'prompt' && (
              <input
                className="ui-dialog-input"
                autoFocus
                value={promptValue}
                onChange={(e) => setPromptValue(e.target.value)}
              />
            )}
            <div className="ui-dialog-actions">
              {(dialog.kind === 'confirm' || dialog.kind === 'prompt') && (
                <button type="button" className="btn" onClick={() => closeDialog(null)}>
                  {dialog.cancelLabel ?? 'انصراف'}
                </button>
              )}
              <button
                type="submit"
                className={`btn ${dialog.danger ? 'regen-btn-danger' : 'btn-primary'}`}
              >
                {dialog.confirmLabel ?? 'باشه'}
              </button>
            </div>
          </form>
        </div>
      )}
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useFeedback must be used within FeedbackProvider');
  return ctx;
}
