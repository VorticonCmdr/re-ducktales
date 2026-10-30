import {
  egaCopyWork,
  egaSpriteWork,
  normalCoreGraphicsMilliseconds,
} from "./ega-work.js";
import { ORIGINAL_GRAPHICS_TIMING } from "./timing.js";

// Overlay2:1e33..1e84, after the caller flush and before the global reader.
// These are source calls, not the full-page Canvas reconstruction. Selector
// lines, numeric text, entry pages and remaining CPU work are still uncharged.
export function destinationFooterWork(entries, atomicAvailable) {
  if (!Array.isArray(entries) || typeof atomicAvailable !== "boolean")
    throw Error("Invalid destination drawing resources");
  const copy = egaCopyWork({
    width: 320,
    height: 32,
    sourceX: 0,
    sourceY: 168,
    destinationX: 0,
    destinationY: 168,
    sourceStrideBytes: 40,
    destinationStrideBytes: 40,
    sourceVideo: false,
    destinationVideo: true,
  });
  const calls = [{ kind: "copy", source: 0x1e51, work: copy }];
  for (const [asset, x, y, source] of [
    [25, 8, 175, 0x1e59],
    [23, 40, 172, 0x1e61],
    [26, 192, 170, 0x1e69],
    [27, 248, 174, 0x1e71],
    ...(atomicAvailable ? [[29, 281, 170, 0x1e80]] : []),
  ])
    calls.push({
      kind: "sprite",
      asset,
      x,
      y,
      source,
      work: egaSpriteWork(entries[asset], 0, x, y),
    });
  return calls.map((call) => ({
    ...call,
    milliseconds: normalCoreGraphicsMilliseconds(
      call.work,
      ORIGINAL_GRAPHICS_TIMING.cyclesPerMillisecond,
    ),
  }));
}
