import { collectGold } from "./adapters/gold.ts";
import { collectGpu } from "./adapters/gpu.ts";
import { collectMacMini } from "./adapters/macmini.ts";
import { nowIso } from "./http.ts";
import { bundledSnapshot, emptyBundle, loadRemoteSnapshot, mergeSnapshot } from "./snapshot.ts";
import type { IntelBundle, TrackKind } from "./types.ts";

export async function collectAll(only?: TrackKind): Promise<IntelBundle> {
  const bundle = emptyBundle();

  const jobs: Array<Promise<void>> = [];
  if (!only || only === "gold") {
    jobs.push(
      collectGold().then((r) => {
        bundle.gold = r.quotes;
        bundle.warnings.push(...r.warnings);
      }),
    );
  }
  if (!only || only === "gpu") {
    jobs.push(
      collectGpu().then((r) => {
        bundle.gpu = r.quotes;
        bundle.warnings.push(...r.warnings);
      }),
    );
  }
  if (!only || only === "macmini") {
    jobs.push(
      collectMacMini().then((r) => {
        bundle.macmini = r.quotes;
        bundle.warnings.push(...r.warnings);
      }),
    );
  }

  await Promise.all(jobs);
  bundle.asOf = nowIso();

  let next = mergeSnapshot(bundle, bundledSnapshot(), only);
  const emptyTrack =
    ((!only || only === "gold") && next.gold.length === 0) ||
    ((!only || only === "gpu") && next.gpu.length === 0) ||
    ((!only || only === "macmini") && next.macmini.length === 0);
  if (emptyTrack) {
    const remote = await loadRemoteSnapshot();
    if (remote) next = mergeSnapshot(next, remote, only);
  }
  return next;
}
