import React from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useApp } from '../../store/AppContext';

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useApp();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex max-w-sm flex-col gap-2"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const styleMap = {
          success:
            'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/90 dark:text-emerald-100',
          error:
            'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/90 dark:text-rose-100',
          info: 'border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100',
        };

        const Icon =
          toast.type === 'success'
            ? CheckCircle2
            : toast.type === 'error'
              ? AlertCircle
              : Info;

        return (
          <div
            key={toast.id}
            className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur ${styleMap[toast.type]}`}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="flex-1 leading-snug">{toast.text}</span>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Скрыть уведомление"
              className="rounded p-0.5 opacity-70 transition hover:opacity-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};