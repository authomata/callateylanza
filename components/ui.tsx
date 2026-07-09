import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand text-brand-fg hover:opacity-90 border-transparent",
  secondary: "bg-surface text-foreground hover:bg-[color-mix(in_srgb,var(--border)_40%,transparent)] border-border",
  ghost: "bg-transparent text-foreground hover:bg-[color-mix(in_srgb,var(--border)_40%,transparent)] border-transparent",
  danger: "bg-transparent text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] border-[var(--danger)]",
};

export function Button({
  variant = "secondary",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; children: ReactNode }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{
        color,
        backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-border bg-surface ${className}`}>{children}</div>
  );
}
