import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { CheckCircle, XCircle, AlertTriangle, X } from 'lucide-react';

// =============================================
// Types
// =============================================
type ToastType = 'success' | 'error' | 'warning';

interface ToastItem {
  id:      string;
  type:    ToastType;
  message: string;
}

interface ToastContextValue {
  success: (message: string) => void;
  error:   (message: string) => void;
  warning: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DURATION_MS = 4000;

// =============================================
// Toast Item Component
// =============================================
const STYLES: Record<ToastType, { wrapper: string; icon: ReactElement }> = {
  success: {
    wrapper: 'bg-emerald-50 border-emerald-400 text-emerald-800',
    icon: <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />,
  },
  error: {
    wrapper: 'bg-red-50 border-red-400 text-red-800',
    icon: <XCircle className="h-5 w-5 text-red-500 shrink-0" />,
  },
  warning: {
    wrapper: 'bg-amber-50 border-amber-400 text-amber-800',
    icon: <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />,
  },
};

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  const { wrapper, icon } = STYLES[item.type];

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(item.id), DURATION_MS);
    return () => clearTimeout(timer);
  }, [item.id, onDismiss]);

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-lg border px-4 py-3 shadow-md min-w-72 max-w-sm
        animate-in slide-in-from-right-4 fade-in duration-200 ${wrapper}`}
    >
      {icon}
      <p className="flex-1 text-sm font-medium">{item.message}</p>
      <button
        onClick={() => onDismiss(item.id)}
        className="opacity-60 hover:opacity-100 transition-opacity"
        aria-label="닫기"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// =============================================
// Provider
// =============================================
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counterRef = useRef(0);

  const add = useCallback((type: ToastType, message: string) => {
    const id = `toast-${++counterRef.current}`;
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value: ToastContextValue = {
    success: (msg) => add('success', msg),
    error:   (msg) => add('error', msg),
    warning: (msg) => add('warning', msg),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Toast 컨테이너 — 오른쪽 하단 고정 */}
      <div
        aria-live="polite"
        className="fixed bottom-6 right-6 z-50 flex flex-col gap-2"
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} item={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// =============================================
// Hook
// =============================================
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
