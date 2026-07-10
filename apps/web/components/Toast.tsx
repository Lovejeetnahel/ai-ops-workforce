'use client';
import { createContext, useCallback, useContext, useRef, useState } from 'react';

type ToastKind = 'ok' | 'warn' | 'err';
type ToastItem = { id: number; kind: ToastKind; title: string; body?: string };

const ICONS: Record<ToastKind, string> = { ok: '✓', warn: '⚠', err: '✕' };

const ToastCtx = createContext<{ push: (kind: ToastKind, title: string, body?: string) => void } | null>(null);

/** Wrap the app once (root layout) to enable useToast() anywhere below it. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const push = useCallback((kind: ToastKind, title: string, body?: string) => {
    const id = ++counter.current;
    setItems((prev) => [...prev, { id, kind, title, body }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 4500);
  }, []);

  const dismiss = (id: number) => setItems((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="toast-stack">
        {items.map((t) => (
          <div className={`toast ${t.kind}`} key={t.id}>
            <span className="t-ico">{ICONS[t.kind]}</span>
            <div className="t-body">
              <div className="t-title">{t.title}</div>
              {t.body && <div className="muted">{t.body}</div>}
            </div>
            <button className="t-close" onClick={() => dismiss(t.id)} aria-label="Dismiss">✕</button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/** useToast().success('Saved') / .error('Could not save', 'Try again') / .warn(...) */
export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return {
    success: (title: string, body?: string) => ctx.push('ok', title, body),
    error: (title: string, body?: string) => ctx.push('err', title, body),
    warn: (title: string, body?: string) => ctx.push('warn', title, body),
  };
}
