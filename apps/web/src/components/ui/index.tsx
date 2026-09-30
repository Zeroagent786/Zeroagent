"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { Check, Copy, X } from "lucide-react";
import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { EXPLORER } from "../../lib/contracts";
import { short } from "../../lib/format";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/* ---------- Button ---------- */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
};
export function Button({ variant = "primary", size = "md", loading, className, children, disabled, ...rest }: BtnProps) {
  const base =
    "inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap";
  const sizes = { sm: "h-8 px-3 text-xs", md: "h-10 px-4 text-sm", lg: "h-12 px-6 text-base" };
  const variants = {
    primary: "bg-ink text-white hover:bg-[#27272A] shadow-sm",
    secondary: "bg-surface text-ink border border-line hover:bg-subtle",
    ghost: "text-muted hover:text-ink hover:bg-subtle",
    danger: "bg-surface text-danger border border-red-200 hover:bg-red-50",
  };
  return (
    <button className={cx(base, sizes[size], variants[variant], className)} disabled={disabled || loading} {...rest}>
      {loading && <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />}
      {children}
    </button>
  );
}

/* ---------- Card ---------- */
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("bg-surface/80 backdrop-blur-sm border border-line rounded-xl shadow-card", className)}>{children}</div>;
}
export function CardHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="px-5 py-4 border-b border-line flex items-center justify-between gap-4">
      <div>
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* ---------- Badge ---------- */
const tones = {
  neutral: "bg-subtle text-muted border-line",
  teal: "bg-teal/10 text-teal border-teal/20",
  amber: "bg-amber/10 text-amber border-amber/25",
  red: "bg-red-50 text-danger border-red-200",
  navy: "bg-brand/10 text-brand border-brand/20",
};
export function Badge({ tone = "neutral", dot, children }: { tone?: keyof typeof tones; dot?: boolean; children: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium", tones[tone])}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/* ---------- Metric ---------- */
export function MetricCard({
  icon,
  label,
  value,
  hint,
  loading,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  hint?: string;
  loading?: boolean;
}) {
  return (
    <Card className="p-5 hover:border-line-active transition-colors">
      <div className="flex items-center gap-2 text-xs font-medium text-muted uppercase tracking-wider">
        <span className="text-brand">{icon}</span>
        {label}
      </div>
      {loading ? (
        <div className="skeleton h-9 w-20 mt-3" />
      ) : (
        <div className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">{value}</div>
      )}
      {hint && <div className="mt-1.5 text-xs text-muted">{hint}</div>}
    </Card>
  );
}

/* ---------- Address ---------- */
export function Address({ value, type = "address", className }: { value: string; type?: "address" | "tx"; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className={cx("inline-flex items-center gap-1.5 font-mono text-xs", className)}>
      <a href={`${EXPLORER}/${type}/${value}`} target="_blank" rel="noreferrer" className="hover:underline">
        {short(value)}
      </a>
      <button
        type="button"
        aria-label="Copy"
        onClick={() => {
          navigator.clipboard?.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
        className="text-muted hover:text-ink"
      >
        {copied ? <Check className="h-3 w-3 text-teal" /> : <Copy className="h-3 w-3" />}
      </button>
    </span>
  );
}

/* ---------- Modal + Drawer (Radix Dialog) ---------- */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  wide,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-[2px] [animation:fade-in_.15s_ease]" />
        <Dialog.Content
          className={cx(
            "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[calc(100vw-2rem)] max-h-[90dvh] overflow-y-auto scroll-thin rounded-2xl border border-line bg-surface p-6 shadow-pop [animation:dialog-in_.2s_ease] focus:outline-none",
            wide ? "max-w-2xl" : "max-w-md"
          )}
        >
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <Dialog.Title className="text-lg font-semibold tracking-tight">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="text-sm text-muted mt-1">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <Dialog.Close className="rounded-md p-1 text-muted hover:text-ink hover:bg-subtle" aria-label="Close">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function Drawer({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-[2px] [animation:fade-in_.15s_ease]" />
        <Dialog.Content className="fixed right-0 top-0 z-50 h-dvh w-full max-w-lg overflow-y-auto scroll-thin border-l border-line bg-surface shadow-pop [animation:drawer-in_.25s_cubic-bezier(.2,.7,.2,1)] focus:outline-none">
          <div className="sticky top-0 z-10 flex items-center justify-between bg-surface/90 backdrop-blur border-b border-line px-6 h-14">
            <Dialog.Title className="text-sm font-semibold">{title}</Dialog.Title>
            <Dialog.Close className="rounded-md p-1 text-muted hover:text-ink hover:bg-subtle" aria-label="Close">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">{title}</Dialog.Description>
          <div className="p-6">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* ---------- Tabs (underline style) ---------- */
export const Tabs = TabsPrimitive.Root;
export function TabsList({ children }: { children: ReactNode }) {
  return <TabsPrimitive.List className="flex gap-6 border-b border-line overflow-x-auto scroll-thin">{children}</TabsPrimitive.List>;
}
export function TabsTrigger({ value, count, children }: { value: string; count?: number; children: ReactNode }) {
  return (
    <TabsPrimitive.Trigger
      value={value}
      className="relative -mb-px pb-3 text-sm font-medium text-muted hover:text-ink data-[state=active]:text-ink border-b-2 border-transparent data-[state=active]:border-ink transition-colors whitespace-nowrap"
    >
      {children}
      {count !== undefined && (
        <span className="ml-2 rounded-full bg-subtle px-1.5 py-0.5 text-[10px] font-semibold text-muted">{count}</span>
      )}
    </TabsPrimitive.Trigger>
  );
}
export const TabsContent = TabsPrimitive.Content;

/* ---------- Form ---------- */
export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-ink mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted mt-1.5">{hint}</span>}
    </label>
  );
}
export const inputCls =
  "w-full h-10 rounded-lg border border-line bg-surface px-3 text-sm placeholder:text-[#A1A1AA] focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 transition";

/* ---------- Misc ---------- */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("skeleton", className)} />;
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      <div className="h-12 w-12 rounded-xl bg-subtle border border-line flex items-center justify-center text-muted mb-4">{icon}</div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="text-sm text-muted mt-1 max-w-sm">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
