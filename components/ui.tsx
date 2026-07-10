import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "ink";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand text-brand-fg hover:brightness-105 border-transparent",
  secondary:
    "bg-surface text-foreground hover:bg-[color-mix(in_srgb,var(--border)_45%,transparent)] border-[var(--border-card)]",
  ghost:
    "bg-transparent text-secondary hover:bg-[color-mix(in_srgb,var(--border)_45%,transparent)] border-transparent",
  danger:
    "bg-transparent text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] border-[var(--danger)]",
  ink: "bg-[#1a1712] text-[#fbf8f1] hover:opacity-90 border-transparent",
};

export function Button({
  variant = "secondary",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; children: ReactNode }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ color, backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl border border-[var(--border-card)] bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)] ${className}`}
    >
      {children}
    </div>
  );
}
