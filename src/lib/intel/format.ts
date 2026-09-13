import type { Quote, TrackKind } from "./types.ts";

export const TRACK_LABEL: Record<TrackKind, string> = {
  gold: "黄金",
  gpu: "显卡",
  macmini: "Mac mini",
};

export function formatMoney(q: Pick<Quote, "price" | "currency" | "unit">): string {
  if (q.price == null) return "暂无报价";
  const digits = q.price >= 100 ? 2 : q.price >= 1 ? 2 : 4;
  const n = q.price.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
  return `${q.currency} ${n}`;
}

export function formatUnit(unit?: string): string {
  if (!unit) return "";
  return `/ ${unit}`;
}

export function formatChange(pct?: number | null): string | null {
  if (pct == null || !Number.isFinite(pct)) return null;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

export function formatStamp(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function relativeTime(iso?: string): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const delta = Date.now() - t;
  const min = Math.round(delta / 60_000);
  if (Math.abs(min) < 1) return "刚刚";
  if (Math.abs(min) < 60) return `${min} 分钟前`;
  const hr = Math.round(min / 60);
  if (Math.abs(hr) < 24) return `${hr} 小时前`;
  return formatStamp(iso);
}
