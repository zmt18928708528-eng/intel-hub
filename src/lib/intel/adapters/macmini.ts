import { getText, nowIso } from "../http.ts";
import type { Quote } from "../types.ts";
import { yahooQuote } from "../yahoo.ts";

const MINI_URL = "https://www.apple.com/shop/refurbished/mac/mac-mini";
const REFURB_URL = "https://www.apple.com/shop/refurbished/mac";
const BUY_URL = "https://www.apple.com/shop/buy-mac/mac-mini";

const OFFICIAL_MSRP: Array<{ title: string; price: number; note: string }> = [
  {
    title: "Mac mini M4 16GB/256GB (new MSRP ref)",
    price: 599,
    note: "US list as of Apple's 2024 M4 refresh; confirm on buy page.",
  },
  {
    title: "Mac mini M4 Pro 24GB/512GB (new MSRP ref)",
    price: 1379,
    note: "Typical US starting config; confirm on buy page.",
  },
];

interface ProductLd {
  "@type"?: string;
  name?: string;
  description?: string;
  url?: string;
  offers?:
    | { price?: string | number; priceCurrency?: string; sku?: string }
    | Array<{
        price?: string | number;
        priceCurrency?: string;
        sku?: string;
      }>;
}

interface BootstrapTile {
  title?: string;
  partNumber?: string;
  price?: { currentPrice?: { raw_amount?: number }; priceCurrency?: string };
}

function isMini(name?: string): boolean {
  return !!name && /mac\s*mini/i.test(name);
}

function offerOf(p: ProductLd): { price: number | null; currency: string; sku?: string } {
  const offer = Array.isArray(p.offers) ? p.offers[0] : p.offers;
  const price = offer?.price == null ? null : Number(offer.price);
  return { price, currency: offer?.priceCurrency ?? "USD", sku: offer?.sku };
}

function fromJsonLd(html: string): Quote[] {
  const quotes: Quote[] = [];
  const re = /<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(re)) {
    try {
      const data = JSON.parse(match[1]) as ProductLd | ProductLd[];
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (item["@type"] !== "Product" || !isMini(item.name)) continue;
        const offer = offerOf(item);
        quotes.push({
          kind: "macmini",
          title: item.name ?? "Mac mini",
          price: offer.price,
          currency: offer.currency,
          unit: "unit",
          inStock: offer.price != null,
          vendor: "Apple Certified Refurbished",
          source: "apple:json-ld",
          url: item.url ?? MINI_URL,
          extra: { sku: offer.sku ?? "", specs: item.description ?? "" },
          asOf: nowIso(),
        });
      }
    } catch {
      /* skip bad block */
    }
  }
  return quotes;
}

function fromBootstrap(html: string): Quote[] {
  const match = html.match(/window\.REFURB_GRID_BOOTSTRAP\s*=\s*(\{[\s\S]*?\});\s*<\/script>/);
  if (!match) return [];
  try {
    const data = JSON.parse(match[1]) as { tiles?: BootstrapTile[] };
    return (data.tiles ?? [])
      .filter((t) => isMini(t.title))
      .map((t) => ({
        kind: "macmini" as const,
        title: t.title ?? "Mac mini",
        price: t.price?.currentPrice?.raw_amount ?? null,
        currency: t.price?.priceCurrency ?? "USD",
        unit: "unit",
        inStock: t.price?.currentPrice?.raw_amount != null,
        vendor: "Apple Certified Refurbished",
        source: "apple:bootstrap",
        url: MINI_URL,
        extra: { sku: t.partNumber ?? "" },
        asOf: nowIso(),
      }));
  } catch {
    return [];
  }
}

async function appleRefurbQuotes(): Promise<Quote[]> {
  let html = await getText(MINI_URL, 8_000);
  let quotes = fromJsonLd(html);
  if (quotes.length === 0) quotes = fromBootstrap(html);
  if (quotes.length === 0) {
    html = await getText(REFURB_URL, 8_000);
    quotes = fromJsonLd(html);
    if (quotes.length === 0) quotes = fromBootstrap(html);
  }
  return quotes;
}

export async function collectMacMini(): Promise<{ quotes: Quote[]; warnings: string[] }> {
  const quotes: Quote[] = [];
  const warnings: string[] = [];

  try {
    const live = await appleRefurbQuotes();
    quotes.push(...live);
    if (live.length === 0) {
      warnings.push("Apple refurbished listing currently has no Mac mini tiles (common when sold out).");
      quotes.push({
        kind: "macmini",
        title: "Refurbished Mac mini inventory",
        price: null,
        currency: "USD",
        inStock: false,
        vendor: "Apple",
        source: "apple:refurb",
        url: MINI_URL,
        note: "Watch this URL / fork saadiq/refurb-mini-spy or brosePR/macmini-watch.",
        asOf: nowIso(),
      });
    }
  } catch (err) {
    warnings.push(`Apple refurbished fetch failed: ${(err as Error).message}`);
  }

  for (const row of OFFICIAL_MSRP) {
    quotes.push({
      kind: "macmini",
      title: row.title,
      price: row.price,
      currency: "USD",
      unit: "unit",
      vendor: "Apple (reference MSRP)",
      source: "static:msrp",
      url: BUY_URL,
      note: row.note,
      asOf: nowIso(),
    });
  }

  try {
    quotes.push(
      await yahooQuote({
        symbol: "AAPL",
        kind: "macmini",
        title: "AAPL (Apple hardware proxy)",
        unit: "share",
        note: "Not a Mac mini SKU price.",
      }),
    );
  } catch (err) {
    warnings.push(`AAPL proxy failed: ${(err as Error).message}`);
  }

  return { quotes, warnings };
}
