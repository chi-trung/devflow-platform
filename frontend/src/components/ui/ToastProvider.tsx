import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  push: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastType, typeof Info> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

const ACCENTS: Record<ToastType, string> = {
  success: "border-l-primary text-primary",
  error: "border-l-destructive text-destructive",
  info: "border-l-sky-300 text-sky-300",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  // One timer per toast so hover/focus can pause exactly the toast being
  // read — WCAG 1.4.13 wants a pointer-held popup to stay while the pointer
  // is on it, and a keyboard user must not lose focus under a timed removal.
  const timers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) window.clearTimeout(timer);
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const arm = useCallback((id: number) => {
    timers.current.set(id, window.setTimeout(() => dismiss(id), 4000));
  }, [dismiss]);

  const pause = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) window.clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  // Re-arm on leave; the handler only ever fires on a still-mounted toast,
  // and the has(id) guard stops a double-fire (focusOut + mouseLeave) from
  // stacking two timers on the same toast.
  const resume = useCallback((id: number) => {
    if (!timers.current.has(id)) arm(id);
  }, [arm]);

  useEffect(() => {
    const live = timers.current;
    return () => live.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const push = useCallback(
    (message: string, type: ToastType = "success") => {
      const id = ++nextId.current;
      setToasts((current) => {
        const next = [...current.slice(-3), { id, message, type }];
        // slice() can silently evict the oldest toast; without this its
        // timer keeps firing and dismiss() runs on an unmounted id.
        for (const gone of current) if (!next.includes(gone)) pause(gone.id);
        return next;
      });
      arm(id);
    },
    [arm, pause],
  );

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2"
      >
        {toasts.map((toast) => {
          const Icon = ICONS[toast.type];
          return (
            <div
              key={toast.id}
              // WCAG 1.4.13 / 2.2.1: a timed popup must be holdable open —
              // hovering or focusing pauses its dismiss timer; leaving
              // restarts the full window.
              onMouseEnter={() => pause(toast.id)}
              onMouseLeave={() => resume(toast.id)}
              onFocus={() => pause(toast.id)}
              onBlur={() => resume(toast.id)}
              className={`pointer-events-auto flex items-start gap-2.5 rounded-lg border border-border border-l-2 bg-card p-3 shadow-[0_8px_32px_rgba(0,0,0,0.5)] rise ${ACCENTS[toast.type]}`}
            >
              <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p className="flex-1 text-sm text-foreground">{toast.message}</p>
              <button
                type="button"
                aria-label={t("ui.dismiss")}
                onClick={() => dismiss(toast.id)}
                className="text-muted-foreground transition-colors duration-150 hover:text-foreground"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}
