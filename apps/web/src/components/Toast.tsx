"use client";

import { CheckCircle2, Loader2, XCircle, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { EXPLORER } from "../lib/contracts";

type ToastKind = "pending" | "success" | "error";
type ToastItem = { id: number; kind: ToastKind; title: string; body?: string; tx?: string };

type Ctx = {
  push: (t: Omit<ToastItem, "id">) => number;
  update: (id: number, t: Partial<Omit<ToastItem, "id">>) => void;
  dismiss: (id: number) => void;
};
const ToastCtx = createContext<Ctx | null>(null);

export function useToast() {
  const c = useContext(ToastCtx);
  if (!c) throw new Error("useToast must be used inside <ToastProvider>");
  return c;
}

let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => setItems((p) => p.filter((t) => t.id !== id)), []);
  const push = useCallback<Ctx["push"]>(
    (t) => {
      const id = ++seq;
      setItems((p) => [...p, { ...t, id }]);
      if (t.kind !== "pending") setTimeout(() => dismiss(id), 6000);
      return id;
    },
    [dismiss]
  );
  const update = useCallback<Ctx["update"]>(
    (id, t) => {
      setItems((p) => p.map((x) => (x.id === id ? { ...x, ...t } : x)));
      if (t.kind && t.kind !== "pending") setTimeout(() => dismiss(id), 6000);
    },
    [dismiss]
  );
  const value = useMemo(() => ({ push, update, dismiss }), [push, update, dismiss]);

  const tone = {
    pending: { icon: <Loader2 className="h-4 w-4 animate-spin text-amber" />, bar: "bg-amber" },
    success: { icon: <CheckCircle2 className="h-4 w-4 text-teal" />, bar: "bg-teal" },
    error: { icon: <XCircle className="h-4 w-4 text-danger" />, bar: "bg-danger" },
  };

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="fixed bottom-20 md:bottom-6 right-4 z-[60] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className="animate-rise relative overflow-hidden rounded-xl border border-line bg-surface p-4 pl-5 shadow-pop">
            <span className={`absolute left-0 top-0 h-full w-1 ${tone[t.kind].bar}`} />
            <div className="flex items-start gap-3">
              <span className="mt-0.5">{tone[t.kind].icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{t.title}</p>
                {t.body && <p className="mt-0.5 text-xs text-muted break-words">{t.body}</p>}
                {t.tx && (
                  <a href={`${EXPLORER}/tx/${t.tx}`} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-brand underline">
                    View on Etherscan
                  </a>
                )}
              </div>
              <button onClick={() => dismiss(t.id)} className="text-muted hover:text-ink" aria-label="Dismiss">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
