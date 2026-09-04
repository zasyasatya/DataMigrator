"use client";

import { Check, Copy } from "lucide-react";
import { useState, type ReactNode } from "react";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline" | "danger" | "dark";
  size?: "sm" | "md";
}) {
  // `type="button"` by default: action buttons must not submit the surrounding
  // form (submit buttons pass type="submit" explicitly).
  const base =
    "inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
  const variants = {
    primary: "bg-primary text-white hover:bg-primary-600 shadow-[0_6px_16px_-6px_rgba(124,92,246,.55)]",
    outline: "border border-line bg-white/70 text-ink hover:border-primary/50 hover:bg-primary-soft/60",
    ghost: "text-ink-2 hover:bg-primary-soft hover:text-primary-600",
    danger: "bg-danger-soft text-danger hover:bg-danger hover:text-white",
    dark: "bg-ink text-white hover:bg-black",
  };
  const sizes = { sm: "text-xs px-3 py-1.5", md: "text-sm px-4 py-2.5" };
  return (
    <button type={type} className={cx(base, variants[variant], sizes[size], className)} {...props} />
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("card", className)}>{children}</div>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[13px] font-semibold text-ink">{label}</span>
        {hint && <span className="text-[11px] text-ink-3">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-xl border border-line bg-white/80 px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-3 outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/15";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputCls, props.className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(inputCls, "leading-relaxed", props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(inputCls, "appearance-none pr-8", props.className)} />;
}

export function Badge({
  tone = "violet",
  children,
  dot,
}: {
  tone?: "violet" | "success" | "warning" | "danger" | "neutral";
  children: ReactNode;
  dot?: boolean;
}) {
  const tones = {
    violet: "bg-primary-soft text-primary-600",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
    neutral: "bg-white/70 text-ink-2 border border-line",
  };
  const dots = {
    violet: "bg-primary",
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
    neutral: "bg-ink-3",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        tones[tone]
      )}
    >
      {dot && <i className={cx("h-1.5 w-1.5 rounded-full", dots[tone])} />}
      {children}
    </span>
  );
}

export function Progress({ value, color = "bg-primary" }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line/80">
      <div
        className={cx("h-full rounded-full transition-all duration-500", color)}
        style={{ width: `${Math.min(100, Math.max(2, value))}%` }}
      />
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2.5"
      aria-pressed={checked}
    >
      <span
        className={cx(
          "relative h-6 w-10 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-line"
        )}
      >
        <span
          className={cx(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
            checked ? "left-[18px]" : "left-0.5"
          )}
        />
      </span>
      {label && <span className="text-sm font-medium text-ink">{label}</span>}
    </button>
  );
}

export function CopyButton({ text, label = "Salin" }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const ta = document.createElement("textarea");
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
        setOk(true);
        setTimeout(() => setOk(false), 1600);
      }}
    >
      {ok ? <Check size={14} className="text-success" /> : <Copy size={14} />}
      {ok ? "Tersalin" : label}
    </Button>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-md border border-line bg-white/80 px-1.5 py-0.5 text-[10px] font-semibold text-ink-3">
      {children}
    </kbd>
  );
}

export function Toast({ msg, tone = "success" }: { msg: string; tone?: "success" | "error" }) {
  return (
    <div
      className={cx(
        "fade-up fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-pop",
        tone === "success" ? "bg-ink" : "bg-danger"
      )}
    >
      {msg}
    </div>
  );
}

export function useToast() {
  const [toast, setToast] = useState<{ msg: string; tone: "success" | "error" } | null>(null);
  const show = (msg: string, tone: "success" | "error" = "success") => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 2400);
  };
  return { toast, show };
}
