import { nasdaqQuote } from "./nasdaq.ts";
import { FETCH_MS, finiteNumbers, getJson, nowIso } from "./http.ts";
import type { Quote, TrackKind } from "./types.ts";

interface YahooChart {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        regularMarketChangePercent?: number;
        currency?: string;
        regularMarketTime?: number;
      };
      indicators?: {
        quote?: Array<{ close?: Array<number | null> }>;
      };
    }>;
  };
}

async function fromYahoo(symbol: string, host: string, range: string) {
  const data = await getJson<YahooChart>(
    `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}`,
    {},
    FETCH_MS,
  );
  const result = data.chart?.result?.[0];
  const meta = result?.meta;
  if (!meta?.regularMarketPrice) throw new Error(`Yahoo missing price for ${symbol}`);
  return {
    price: meta.regularMarketPrice,
    currency: meta.currency ?? "USD",
    changePct: meta.regularMarketChangePercent ?? null,
    spark: finiteNumbers(result?.indicators?.quote?.[0]?.close ?? []),
    asOf: meta.regularMarketTime
      ? new Date(meta.regularMarketTime * 1000).toISOString()
      : nowIso(),
    vendor: "Yahoo Finance",
    source: `yahoo:${symbol}`,
    url: `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}`,
  };
}

export async function yahooQuote(opts: {
  symbol: string;
  kind: TrackKind;
  title: string;
  unit: string;
  note?: string;
  range?: string;
}): Promise<Quote> {
  const range = opts.range ?? "1mo";
  const errors: string[] = [];
  const hosts = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];

  for (const host of hosts) {
    try {
      const seed = await fromYahoo(opts.symbol, host, range);
      return {
        kind: opts.kind,
        title: opts.title,
        price: seed.price,
        currency: seed.currency,
        unit: opts.unit,
        changePct: seed.changePct,
        vendor: seed.vendor,
        source: seed.source,
        url: seed.url,
        note: opts.note,
        spark: seed.spark,
        asOf: seed.asOf,
      };
    } catch (err) {
      errors.push(`${host}: ${(err as Error).message}`);
    }
  }

  if (opts.symbol === "NVDA" || opts.symbol === "AAPL") {
    try {
      return await nasdaqQuote({
        symbol: opts.symbol,
        kind: opts.kind,
        title: opts.title,
        unit: opts.unit,
        note: opts.note,
      });
    } catch (err) {
      errors.push(`nasdaq: ${(err as Error).message}`);
    }
  }

  throw new Error(errors.join(" | "));
}
