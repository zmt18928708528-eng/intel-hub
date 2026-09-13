export type TrackKind = "gold" | "gpu" | "macmini";

export interface Quote {
  kind: TrackKind;
  title: string;
  price: number | null;
  currency: string;
  unit?: string;
  changePct?: number | null;
  inStock?: boolean | null;
  vendor: string;
  source: string;
  url?: string;
  note?: string;
  extra?: Record<string, string | number | boolean | null>;
  asOf: string;
}

export interface IntelBundle {
  asOf: string;
  gold: Quote[];
  gpu: Quote[];
  macmini: Quote[];
  warnings: string[];
}
