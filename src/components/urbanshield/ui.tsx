import type { ReactNode } from "react";

export const tierColor = (v: number) =>
  v >= 0.66 ? "text-risk" : v >= 0.4 ? "text-watch" : "text-ok";
export const tierBg = (v: number) =>
  v >= 0.66 ? "bg-risk" : v >= 0.4 ? "bg-watch" : "bg-ok";
export const tierSoft = (v: number) =>
  v >= 0.66 ? "bg-risk-soft" : v >= 0.4 ? "bg-watch-soft" : "bg-ok-soft";

export const money = (n: number | string | null | undefined) =>
  n === "" || n == null || isNaN(Number(n))
    ? "N/A"
    : "$" + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 });

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-border bg-card p-6 shadow-panel ${className}`}
    >
      {children}
    </div>
  );
}

export function Kicker({ children }: { children: ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
      {children}
    </div>
  );
}

export function SectionTitle({
  kicker,
  children,
  sub,
}: {
  kicker?: string;
  children: ReactNode;
  sub?: string;
}) {
  return (
    <div className="mb-5">
      {kicker && <Kicker>{kicker}</Kicker>}
      <h2 className="mt-1 font-display text-2xl leading-tight">{children}</h2>
      {sub && <p className="mt-2 text-sm text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function Field({
  label,
  hint,
  prefix,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  prefix?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="mb-4 block">
      <div className="text-[13px] font-semibold text-foreground">{label}</div>
      {hint && <div className="mb-1.5 text-xs text-muted-foreground">{hint}</div>}
      <div className="relative flex items-center">
        {prefix && (
          <span className="pointer-events-none absolute left-3 text-sm text-muted-foreground">
            {prefix}
          </span>
        )}
        <input
          type="number"
          min="0"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full rounded-lg border border-input bg-background py-2.5 text-[15px] outline-none transition-colors focus:border-primary ${
            prefix ? "pl-7 pr-3" : "px-3"
          }`}
        />
      </div>
    </label>
  );
}

export function Stat({
  label,
  value,
  tone = "",
  note,
}: {
  label: string;
  value: string;
  tone?: string;
  note?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-secondary/50 p-4">
      <Kicker>{label}</Kicker>
      <div className={`mt-1 font-display text-3xl ${tone}`}>{value}</div>
      {note && <div className="mt-1 text-xs text-muted-foreground">{note}</div>}
    </div>
  );
}
