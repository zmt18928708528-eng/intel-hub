import { Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Sparkline } from "@/components/intel/sparkline";
import { extraLine, formatChange, formatMoney, formatUnit, relativeTime } from "@/lib/intel/format";
import { quoteKey, type Quote } from "@/lib/intel/types";
import { cn } from "@/lib/utils";
import { useWatchlist } from "@/stores/watchlist";

const TONE: Record<Quote["kind"], string> = {
  gold: "text-gold",
  gpu: "text-gpu",
  macmini: "text-mac",
};

export function QuoteCard({ quote }: { quote: Quote }) {
  const key = quoteKey(quote);
  const watched = useWatchlist((s) => s.keys.includes(key));
  const toggle = useWatchlist((s) => s.toggle);
  const change = formatChange(quote.changePct);
  const tone = quote.changePct == null ? "neutral" : quote.changePct >= 0 ? "up" : "down";
  const meta = extraLine(quote);
  const stale = quote.extra?.stale === true;
  const snap = quote.extra?.fromSnapshot === true;

  return (
    <article className="group flex min-h-[168px] flex-col rounded-xl border border-border bg-surface p-4 transition-[border-color,background-color] duration-[var(--motion-quick)] ease-[var(--ease-out)] hover:border-border-strong hover:bg-surface-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-subtle">
          {quote.vendor}
        </p>
        <button
          type="button"
          aria-label={watched ? "取消关注" : "加入关注"}
          aria-pressed={watched}
          onClick={() => toggle(key)}
          className="flex size-8 shrink-0 items-center justify-center rounded-sm text-subtle transition-colors hover:text-fg"
        >
          <Star className={cn("size-3.5", watched && "fill-accent text-accent")} />
        </button>
      </div>
      <h3 className="mt-2 line-clamp-2 text-sm font-medium leading-snug text-fg text-balance">
        {quote.title}
      </h3>
      <p className={cn("mt-3 font-mono text-2xl tabular-nums tracking-tight", TONE[quote.kind])}>
        {formatMoney(quote)}
        <span className="ml-1 text-xs text-subtle">{formatUnit(quote.unit)}</span>
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {change && <Badge variant={tone === "up" ? "up" : "down"}>{change}</Badge>}
        {quote.inStock === true && <Badge variant="stock">有货</Badge>}
        {quote.inStock === false && <Badge variant="warn">缺货</Badge>}
        {stale && <Badge variant="warn">较旧</Badge>}
        {snap && <Badge variant="default">快照</Badge>}
      </div>
      {meta ? <p className="mt-2 line-clamp-1 text-[11px] text-subtle">{meta}</p> : null}
      {quote.spark && quote.spark.length > 1 && (
        <div className="mt-3">
          <Sparkline values={quote.spark} tone={tone} />
        </div>
      )}
      <div className="mt-auto flex items-end justify-between gap-2 pt-3">
        <p className="truncate text-[11px] text-subtle">{relativeTime(quote.asOf)}</p>
        {quote.url ? (
          <a
            href={quote.url}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-muted underline-offset-2 hover:text-fg hover:underline"
          >
            来源
          </a>
        ) : null}
      </div>
      {quote.note ? (
        <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-subtle">{quote.note}</p>
      ) : null}
    </article>
  );
}
