#!/usr/bin/env node
import { collectAll } from "./collect.ts";
import type { Quote, TrackKind } from "./types.ts";

function fmt(q: Quote): string {
  const price =
    q.price == null
      ? "n/a"
      : `${q.currency} ${q.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  const ch = q.changePct != null ? ` ${q.changePct >= 0 ? "+" : ""}${q.changePct.toFixed(2)}%` : "";
  const stock = q.inStock == null ? "" : q.inStock ? " [in stock]" : " [sold out]";
  return `  - ${q.title}: ${price}${q.unit ? "/" + q.unit : ""}${ch}${stock}  (${q.vendor})`;
}

async function main() {
  const args = process.argv.slice(2);
  const jsonOut = args.includes("--json");
  const arg = (args.find((a) => !a.startsWith("--")) ?? "all").toLowerCase();
  const only = ["gold", "gpu", "macmini"].includes(arg) ? (arg as TrackKind) : undefined;
  if (arg === "--help" || arg === "-h" || args.includes("-h") || args.includes("--help")) {
    console.log("Usage: npm run intel -- [gold|gpu|macmini|all] [--json]");
    process.exit(0);
  }

  const data = await collectAll(only);
  if (jsonOut) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }
  if (!only || only === "gold") {
    console.log("GOLD");
    data.gold.forEach((q) => console.log(fmt(q)));
  }
  if (!only || only === "gpu") {
    console.log("GPU");
    data.gpu.forEach((q) => console.log(fmt(q)));
  }
  if (!only || only === "macmini") {
    console.log("MAC MINI");
    data.macmini.forEach((q) => console.log(fmt(q)));
  }
  if (data.warnings.length) {
    console.log("WARNINGS");
    data.warnings.forEach((w) => console.log(`  ! ${w}`));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
