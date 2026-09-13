import { cn } from "@/lib/utils";

export function Sparkline({
  values,
  className,
  tone = "neutral",
}: {
  values?: number[];
  className?: string;
  tone?: "up" | "down" | "neutral";
}) {
  const pts = (values ?? []).filter((n) => Number.isFinite(n));
  if (pts.length < 2) {
    return <div className={cn("h-8 w-full", className)} aria-hidden />;
  }
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const w = 120;
  const h = 32;
  const d = pts
    .map((v, i) => {
      const x = (i / (pts.length - 1)) * w;
      const y = h - ((v - min) / span) * (h - 4) - 2;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  const stroke =
    tone === "up" ? "var(--color-up)" : tone === "down" ? "var(--color-down)" : "var(--color-muted)";

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={cn("h-8 w-full overflow-visible", className)}
      preserveAspectRatio="none"
      aria-hidden
    >
      <path d={d} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
