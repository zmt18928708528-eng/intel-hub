import { finiteNumbers, getJson, nowIso } from "./http.ts";
import type { Quote, TrackKind } from "./types.ts";

interface NasdaqChart {
  data?: {
    symbol?: string;
    lastSalePrice?: string;
    percentageChange?: string;
    timeAsOf?: string;
    chart?: Array<{ y?: number | null }>;
  };
}

function parseMoney(raw?: string): number | null {
  if (!raw) return null;
  const n = Number(String(raw).replace(/[^0-9.+-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export async function nasdaqQuote(opts: {
  symbol: string;
  kind: TrackKind;
  title: string;
  unit: string;
  note?: string;
}): Promise<Quote> {
  const data = await getJson<NasdaqChart>(
    `https://api.nasdaq.com/api/quote/${encodeURIComponent(opts.symbol)}/chart?assetclass=stocks`,
    {
      headers: {
        Accept: "application/json,text/plain,*/*",
        Origin: "https://www.nasdaq.com",
        Referer: "https://www.nasdaq.com/",
      },
    },
  );
  const row = data.data;
  const price = parseMoney(row?.lastSalePrice);
  if (price == null) throw new Error(`Nasdaq missing price for ${opts.symbol}`);
  const spark = finiteNumbers((row?.chart ?? []).map((p) => p.y)).filter((_, i, arr) => {
    const step = Math.max(1, Math.floor(arr.length / 40));
    return i % step === 0 || i === arr.length - 1;
  });
  return {
    kind: opts.kind,
    title: opts.title,
    price,
    currency: "USD",
    unit: opts.unit,
    changePct: parseMoney(row?.percentageChange),
    vendor: "Nasdaq",
    source: `nasdaq:${opts.symbol}`,
    url: `https://www.nasdaq.com/market-activity/stocks/${opts.symbol.toLowerCase()}`,
    note: opts.note,
    spark,
    asOf: nowIso(),
  };
}
