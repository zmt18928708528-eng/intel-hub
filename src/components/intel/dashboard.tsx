import { useQuery } from "@tanstack/react-query";
import { Cpu, RefreshCw, Search, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { QuoteCard } from "@/components/intel/quote-card";
import { Sparkline } from "@/components/intel/sparkline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchIntel } from "@/lib/intel/functions";
import {
  cnyPerGram,
  formatChange,
  formatMoney,
  formatStamp,
  TRACK_LABEL,
} from "@/lib/intel/format";
import { quoteKey, type IntelBundle, type Quote, type TrackKind } from "@/lib/intel/types";
import { cn } from "@/lib/utils";
import { useWatchlist } from "@/stores/watchlist";

type Tab = "all" | TrackKind | "watch";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "all", label: "全部" },
  { id: "gold", label: "黄金" },
  { id: "gpu", label: "显卡" },
  { id: "macmini", label: "Mac mini" },
  { id: "watch", label: "关注" },
];

const GPU_MODELS = ["RTX5090", "RTX4090", "H100", "B200", "A100", "RTX5080", "RTX5070"];

const REFRESH_MS = 90_000;

function cheapestCloudGpu(gpu: Quote[]): Quote | undefined {
  const cloud = gpu.filter(
    (q) =>
      (q.source === "gputracker.dev" || q.source === "runpod:graphql") && q.price != null,
  );
  const fresh = cloud.filter((q) => q.extra?.stale !== true);
  const pool = fresh.length > 0 ? fresh : cloud;
  const preferred = ["RTX5090", "RTX4090", "H100", "B200", "A100", "RTX5080"];
  for (const model of preferred) {
    const hit = pool.find((q) => q.extra?.watchModel === model);
    if (hit) return hit;
  }
  return [...pool].sort((a, b) => (a.price ?? 99) - (b.price ?? 99))[0];
}

function refurbStock(mac: Quote[]): { count: number; quote?: Quote } {
  const live = mac.filter(
    (q) =>
      (q.source === "apple:json-ld" || q.source === "apple:bootstrap" || q.source === "apple:refurb") &&
      q.inStock !== false,
  );
  const any = mac.find((q) => q.source.startsWith("apple:"));
  return { count: live.filter((q) => q.price != null).length, quote: live[0] ?? any };
}

function sourcePills(data: IntelBundle): Array<{ id: string; ok: boolean }> {
  const has = (prefix: string) =>
    [...data.gold, ...data.gpu, ...data.macmini].some((q) => q.source.startsWith(prefix));
  return [
    { id: "Yahoo / Nasdaq", ok: has("yahoo:") || has("nasdaq:") },
    { id: "Gold spot", ok: has("gold-api") || has("currency-api") || has("coingecko") },
    { id: "RunPod", ok: has("runpod:") },
    { id: "gputracker", ok: has("gputracker") },
    { id: "Apple", ok: has("apple:") },
  ];
}

export function Dashboard({ initial }: { initial: IntelBundle }) {
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [model, setModel] = useState<string | null>(null);
  const watchKeys = useWatchlist((s) => s.keys);
  const hydrate = useWatchlist((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const intelQuery = useQuery({
    queryKey: ["intel"],
    queryFn: () => fetchIntel({ data: { force: true } }),
    initialData: initial,
    staleTime: 0,
    refetchOnMount: "always",
    refetchInterval: REFRESH_MS,
  });

  const data = intelQuery.data ?? initial;
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  const updatedAt = intelQuery.dataUpdatedAt || Date.now();
  const remain = Math.max(0, Math.round((REFRESH_MS - (Date.now() - updatedAt)) / 1000));
  void tick;

  const gold =
    data.gold.find(
      (q) =>
        q.source.startsWith("yahoo:") ||
        q.source.startsWith("stooq:") ||
        q.source.startsWith("gold-api.com") ||
        q.source.startsWith("goldprice.org"),
    ) ?? data.gold[0];
  const gpuDeal = cheapestCloudGpu(data.gpu);
  const mini = refurbStock(data.macmini);
  const nvda = data.gpu.find((q) => q.source === "yahoo:NVDA" || q.source === "nasdaq:NVDA");
  const pills = sourcePills(data);
  const usingSnap = [...data.gold, ...data.gpu, ...data.macmini].some(
    (q) => q.extra?.fromSnapshot === true,
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (item: Quote) => {
      const hay = `${item.title} ${item.vendor} ${item.source} ${item.extra?.watchModel ?? ""}`.toLowerCase();
      if (q && !hay.includes(q)) return false;
      if (model && item.kind === "gpu") {
        const wm = String(item.extra?.watchModel ?? "");
        if (wm !== model && !item.title.toUpperCase().includes(model)) return false;
      }
      return true;
    };

    const goldQ = data.gold.filter(match);
    const gpuQ = data.gpu.filter(match);
    const macQ = data.macmini.filter(match);

    if (tab === "watch") {
      const set = new Set(watchKeys);
      return {
        gold: goldQ.filter((item) => set.has(quoteKey(item))),
        gpu: gpuQ.filter((item) => set.has(quoteKey(item))),
        macmini: macQ.filter((item) => set.has(quoteKey(item))),
      };
    }
    return {
      gold: tab === "all" || tab === "gold" ? goldQ : [],
      gpu: tab === "all" || tab === "gpu" ? gpuQ : [],
      macmini: tab === "all" || tab === "macmini" ? macQ : [],
    };
  }, [data, query, tab, watchKeys, model]);

  const emptyWatch = tab === "watch" && watchKeys.length === 0;
  const emptyFilter =
    filtered.gold.length + filtered.gpu.length + filtered.macmini.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-subtle">
              Live intel desk
            </p>
            <h1 className="mt-2 font-display text-4xl font-medium tracking-[-0.03em] text-fg sm:text-5xl">
              Intel Hub
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
              黄金期货与现货、云 GPU 租价、Mac mini 翻新库存。公开接口聚合，失败自动用快照补齐。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-right">
              <p className="text-xs tabular-nums text-subtle">{formatStamp(data.asOf)}</p>
              <p className="text-[11px] tabular-nums text-subtle">
                {intelQuery.isFetching ? "正在更新" : `${remain}s 后自动刷新`}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => intelQuery.refetch()}
              disabled={intelQuery.isFetching}
            >
              <RefreshCw className={cn("size-3.5", intelQuery.isFetching && "animate-spin")} />
              刷新
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={usingSnap ? "warn" : "stock"}>{usingSnap ? "部分快照" : "实时"}</Badge>
          {pills.map((p) => (
            <span
              key={p.id}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px]",
                p.ok
                  ? "border-border text-muted"
                  : "border-dashed border-border text-subtle",
              )}
            >
              {p.id}
              {p.ok ? "" : " · 缺"}
            </span>
          ))}
          <a
            href="/api/intel"
            className="ml-auto text-[11px] text-muted underline-offset-2 hover:text-fg hover:underline"
          >
            JSON API
          </a>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Kpi
            kicker={
              gold?.source.startsWith("yahoo:") || gold?.source.startsWith("stooq:")
                ? "COMEX 黄金"
                : "黄金现货"
            }
            title={gold ? formatMoney(gold) : "—"}
            hint={cnyPerGram(gold) ?? (gold?.unit ? `每 ${gold.unit}` : "")}
            change={formatChange(gold?.changePct)}
            spark={gold?.spark}
            tone={gold?.changePct != null && gold.changePct < 0 ? "down" : "up"}
            kind="gold"
          />
          <Kpi
            kicker="最低云 GPU"
            title={gpuDeal ? formatMoney(gpuDeal) : "—"}
            hint={gpuDeal ? gpuDeal.title : "暂无云租报价"}
            spark={nvda?.spark}
            tone="neutral"
            kind="gpu"
          />
          <Kpi
            kicker="翻新 Mac mini"
            title={mini.count > 0 ? `${mini.count} 款在售` : "缺货"}
            hint={mini.quote?.title ?? "Apple Certified Refurbished"}
            tone={mini.count > 0 ? "up" : "down"}
            kind="macmini"
          />
        </div>
      </header>

      {data.warnings.length > 0 && (
        <div className="flex gap-3 rounded-lg border border-warn/25 bg-warn/10 px-4 py-3">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" />
          <ul className="space-y-1 text-sm text-muted">
            {data.warnings.slice(0, 6).map((w) => (
              <li key={w}>
                {w
                  .replace(/https?:\/\/\S+/g, "")
                  .replace(/\s+\|\s+/g, " · ")
                  .replace(/\s+/g, " ")
                  .trim()
                  .slice(0, 220)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "h-11 rounded-full px-4 text-sm font-medium transition-colors",
                tab === t.id
                  ? "bg-accent text-accent-fg"
                  : "border border-border text-muted hover:border-border-strong hover:text-fg",
              )}
            >
              {t.label}
              {t.id === "watch" && watchKeys.length > 0 ? (
                <span className="ml-1.5 tabular-nums text-xs opacity-70">{watchKeys.length}</span>
              ) : null}
            </button>
          ))}
        </div>
        <label className="relative flex h-11 min-w-[200px] flex-1 items-center sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 size-4 text-subtle" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索型号 / 来源"
            className="h-11 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm text-fg outline-none placeholder:text-subtle focus:border-border-strong"
          />
        </label>
      </div>

      {(tab === "gpu" || tab === "all") && (
        <div className="flex flex-wrap gap-1.5">
          {GPU_MODELS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModel((cur) => (cur === m ? null : m))}
              className={cn(
                "h-9 rounded-full border px-3 text-xs font-medium",
                model === m
                  ? "border-accent bg-accent text-accent-fg"
                  : "border-border text-muted hover:border-border-strong hover:text-fg",
              )}
            >
              {m}
            </button>
          ))}
        </div>
      )}

      {emptyWatch ? (
        <EmptyState
          title="还没有关注项"
          body="点卡片右上角的星标，把黄金、GPU 或 Mini 报价钉在这里。"
        />
      ) : emptyFilter ? (
        <EmptyState
          title={intelQuery.isFetching ? "正在拉取情报" : "没有匹配的报价"}
          body={
            intelQuery.isFetching
              ? "正在请求 Yahoo、Stooq、gputracker 与 Apple。"
              : "换个关键词，或切回全部。"
          }
        />
      ) : (
        <div className="flex flex-col gap-10">
          <Section kind="gold" quotes={filtered.gold} />
          <Section kind="gpu" quotes={filtered.gpu} />
          <Section kind="macmini" quotes={filtered.macmini} />
        </div>
      )}

      <footer className="flex flex-col gap-2 border-t border-border pt-6 text-xs text-subtle sm:flex-row sm:items-center sm:justify-between">
        <p>
          数据来自 Yahoo Finance、Stooq、gold-api.com、currency-api、gputracker.dev、RunPod、NVIDIA
          Partner Search、Apple 翻新页。不是投资建议。
        </p>
        <a
          href="https://github.com/zmt18928708528-eng/intel-hub"
          className="hover:text-fg"
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>
      </footer>
    </div>
  );
}

function Kpi({
  kicker,
  title,
  hint,
  change,
  spark,
  tone,
  kind,
}: {
  kicker: string;
  title: string;
  hint: string;
  change?: string | null;
  spark?: number[];
  tone: "up" | "down" | "neutral";
  kind: TrackKind;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-subtle">{kicker}</p>
        {change ? <Badge variant={tone === "down" ? "down" : "up"}>{change}</Badge> : null}
      </div>
      <p
        className={cn(
          "mt-3 font-mono text-2xl tabular-nums tracking-tight sm:text-3xl",
          kind === "gold" && "text-gold",
          kind === "gpu" && "text-gpu",
          kind === "macmini" && "text-mac",
        )}
      >
        {title}
      </p>
      <p className="mt-1 line-clamp-1 text-xs text-muted">{hint}</p>
      {spark && spark.length > 1 ? (
        <div className="mt-3">
          <Sparkline values={spark} tone={tone} />
        </div>
      ) : (
        <div className="mt-3 h-8" />
      )}
    </div>
  );
}

function Section({ kind, quotes }: { kind: TrackKind; quotes: Quote[] }) {
  if (quotes.length === 0) return null;
  const sorted = [...quotes].sort((a, b) => (a.price ?? 1e12) - (b.price ?? 1e12));
  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="font-display text-lg font-medium tracking-tight text-fg">{TRACK_LABEL[kind]}</h2>
        <p className="text-xs tabular-nums text-subtle">{quotes.length} 条</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((q) => (
          <QuoteCard key={quoteKey(q)} quote={q} />
        ))}
      </div>
    </section>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-16 text-center">
      <Cpu className="size-6 text-subtle" />
      <p className="mt-4 text-sm font-medium text-fg">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted">{body}</p>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
      <Skeleton className="h-10 w-48" />
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-36 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-44 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
