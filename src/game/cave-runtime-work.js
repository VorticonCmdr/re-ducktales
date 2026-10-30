// Original EGA cave helpers. Work is independent of presentation and clocks.
import { egaSignedCopyWork } from "./ega-copy-work.js";
import { egaCopyWork, normalCoreGraphicsMilliseconds } from "./ega-work.js";
import { cavePartyWork, caveSpriteWork } from "./cave-work.js";
import { caveMinimapCalls, caveMinimapWork } from "./cave-minimap-work.js";
import { ORIGINAL_GRAPHICS_TIMING } from "./timing.js";

const fields = [
  "instructions",
  "portWrites",
  "repeatOpcodes",
  "repeatIterations",
];
function total(parts) {
  const sum = Object.fromEntries(fields.map((k) => [k, 0]));
  for (const part of parts) for (const k of fields) sum[k] += part[k] ?? 0;
  return {
    ...sum,
    milliseconds: normalCoreGraphicsMilliseconds(
      sum,
      ORIGINAL_GRAPHICS_TIMING.cyclesPerMillisecond,
    ),
  };
}
function roomCopy(sourceVideo, destinationVideo) {
  return {
    width: 320,
    height: 200,
    sourceX: 0,
    sourceY: 0,
    destinationX: 0,
    destinationY: 0,
    sourceStrideBytes: 40,
    destinationStrideBytes: 40,
    sourceVideo,
    destinationVideo,
  };
}

// Original26bb..28ad: cache->video, door/room overlays, video->cache.
// The one renderer copy command describes pixels; it is not the source call list.
export function caveRoomCompositionWork(entries, commands) {
  const c = commands[0];
  if (
    !c ||
    c.op !== "copy" ||
    c.asset !== 0 ||
    c.width !== 320 ||
    c.height !== 200 ||
    c.sourceX !== 0 ||
    c.sourceY !== 0 ||
    c.x !== 0 ||
    c.y !== 0
  )
    throw Error("Unsupported cave room composition");
  const parts = [
    egaSignedCopyWork(roomCopy(false, true)),
    egaSignedCopyWork(roomCopy(true, false)),
  ];
  for (const sprite of commands.slice(1)) {
    if (
      sprite.op !== "sprite" ||
      ![1, 2, 3, 4, 5, 6, 7, 8, 9].includes(sprite.asset)
    )
      throw Error("Unsupported cave room overlay");
    parts.push(caveSpriteWork(entries, sprite));
  }
  return { ...total(parts), copies: 2, sprites: commands.length - 1 };
}

// Original03bd..03d3 draws sprite37, then1cc8 builds and stores its map cache.
export function caveInitialMinimapWork(m, entries) {
  const sprite = caveSpriteWork(entries, {
    asset: 37,
    frame: m.b(0x5c6e),
    x: m.i(0x5c5c),
    y: m.i(0x5c5e),
  });
  const map = caveMinimapWork(caveMinimapCalls(m, "initial"));
  return {
    ...total([sprite, map]),
    copies: map.copies,
    sprites: 1,
    minimapPoints: map.points,
  };
}

export function caveRuntimePartyWork(m, entries, commands, options) {
  const base = cavePartyWork(entries, commands);
  const map = caveMinimapWork(caveMinimapCalls(m, "party", options));
  // The historical nonnegative copy counter omitted two setup opcodes. Preserve
  // that frozen evidence model; replace only its copy contribution here with
  // the independently native-verified signed primitive.
  const oldCopy = egaCopyWork(roomCopy(false, true));
  const correction = Object.fromEntries(fields.map((k) => [k, -oldCopy[k]]));
  return {
    ...base,
    ...total([base, correction, egaSignedCopyWork(roomCopy(false, true)), map]),
    omittedFills: 0,
    renderedMinimapFills: base.omittedFills,
    minimapPoints: map.points,
    minimapCopies: map.copies,
    copies: base.copies + map.copies,
  };
}
