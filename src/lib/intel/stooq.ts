import { finiteNumbers, getText, nowIso } from "./http.ts";
import type { Quote, TrackKind } from "./types.ts";

function parseCsv(text: string): string[][] {
  return text
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.split(",").map((c) => c.trim()));
}

function num(raw?: string): number | null {
  if (!raw || raw === "N/D" || raw === "N/A") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function stooqQuote(opts: {
  symbol: string;
  kind: TrackKind;
  title: string;
  unit: string;
  note?: string;
}): Promise<Quote> {
  const symbol = opts.symbol.toLowerCase();
  const csv = await getText(`https://stooq.com/q/d/l/?s=${encodeURIComponent(symbol)}&i=d`);
  if (csv.includes("<html") || csv.includes("does not exist")) {
    throw new Error(`stooq blocked or missing for ${symbol}`);
  }
  const rows = parseCsv(csv);
  if (rows.length < 2) throw new Error(`stooq empty for ${symbol}`);
  const header = rows[0] ?? [];
  const closeIdx = header.findIndex((h) => h.toLowerCase() === "close");
  const dateIdx = header.findIndex((h) => h.toLowerCase() === "date");
  const body = rows.slice(1);
  const last = body[body.length - 1];
  const prev = body[body.length - 2];
  const close = num(last?.[closeIdx >= 0 ? closeIdx : 4]);
  const prevClose = num(prev?.[closeIdx >= 0 ? closeIdx : 4]);
  if (close == null || close <= 0) throw new Error(`stooq no close for ${symbol}`);
  const spark = finiteNumbers(body.map((r) => num(r[closeIdx >= 0 ? closeIdx : 4]))).slice(-40);
  const date = last?.[dateIdx >= 0 ? dateIdx : 0] ?? "";
  const stamp = date ? new Date(`${date}T00:00:00Z`) : null;
  return {
    kind: opts.kind,
    title: opts.title,
    price: close,
    currency: "USD",
    unit: opts.unit,
    changePct: prevClose && prevClose > 0 ? ((close - prevClose) / prevClose) * 100 : null,
    vendor: "Stooq",
    source: `stooq:${opts.symbol.toUpperCase()}`,
    url: `https://stooq.com/q/?s=${encodeURIComponent(symbol)}`,
    note: opts.note,
    spark,
    asOf: stamp && !Number.isNaN(stamp.getTime()) ? stamp.toISOString() : nowIso(),
  };
}
