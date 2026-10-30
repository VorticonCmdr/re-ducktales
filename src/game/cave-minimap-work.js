// Original source-derived EGA minimap call plan and primitive workload.
// Overlay6:1b26 dot,1cc8 initial cache,1dff markers. EGA only.
import { caveTrapNearby } from "./cave-scene.js";
import { egaDriverLineWork } from "./ega-line-work.js";
import { egaSignedCopyWork } from "./ega-copy-work.js";
import { normalCoreGraphicsMilliseconds } from "./ega-work.js";
import { ORIGINAL_GRAPHICS_TIMING } from "./timing.js";

export function caveMinimapCalls(m, phase, { kind = 17 } = {}) {
  if (!["initial", "party"].includes(phase))
    throw Error("Unsupported cave minimap phase");
  if (m.b(0x2042) !== 0 || m.b(0x2044) !== 0)
    throw Error("Unsupported non-EGA cave minimap");
  const mode = m.b(0x8990),
    calls = [];
  if (![0, 1, 2].includes(mode)) throw Error("Unsupported cave minimap mode");
  const point = (x, y, color) => calls.push({ kind: "point", x, y, color });
  function dot(room, color, links) {
    if (!Number.isInteger(room) || room < 0 || room >= 64)
      throw Error("Invalid cave minimap room");
    const x = 115 + (7 - (room >> 3) + (room & 7)) * 4,
      y = 139 + ((room >> 3) + (room & 7)) * 4;
    for (let dy = 0; dy < 3; dy++)
      for (let dx = 0; dx < 3; dx++) point(x + dx, y + dy, color);
    if (links)
      for (const [bit, dx, dy] of [
        [8, 3, -1],
        [4, -1, 3],
        [2, 3, 3],
        [1, -1, -1],
      ])
        if (m.b(0x5a42 + room * 2) & bit) point(x + dx, y + dy, 7);
  }
  function cacheCopy() {
    // Descriptor37+8 is the RAM destination surface. The source is draw page2038.
    calls.push({
      kind: "copy",
      width: m.i(0x5c60) * 8,
      height: m.i(0x5c62),
      sourceX: m.i(0x5c5c),
      sourceY: m.i(0x5c5e),
      destinationX: 0,
      destinationY: 0,
      sourceStrideBytes: 40,
      destinationStrideBytes: m.i(0x5c64),
      sourceVideo: true,
      destinationVideo: false,
    });
  }
  if (phase === "initial") {
    for (let room = 0; room < 64; room++)
      if (mode === 0 || m.b(0x5a42 + room * 2) & 16)
        dot(room, caveTrapNearby(m, room) ? 2 : 7, true);
    cacheCopy();
  } else if (kind === 17 && m.b(0x546a) === 0) {
    const room = m.i(0x4d32);
    if (mode !== 0) {
      // Preserve original1dff: the warning guard reads around the map BASE,
      // while its edge guards and dot/link arguments use the CURRENT room.
      const cell = m.b(0x5a42);
      const danger =
        (m.b(0x5a40) & 64 && (room & 7) !== 0 && cell & 1) ||
        (m.b(0x5a44) & 64 && (room & 7) !== 7 && cell & 2) ||
        (m.b(0x5a32) & 64 && room > 7 && cell & 8) ||
        (m.b(0x5a52) & 64 && room < 56 && cell & 4);
      dot(room, danger ? 2 : 7, true);
      cacheCopy();
    }
    dot(room, 12, true);
    if (mode !== 2) dot(m.i(0x97b0), 14, true);
    dot(m.i(0x6810), 6, false);
  }
  return calls;
}

export function caveMinimapWork(calls) {
  const work = {
    instructions: 0,
    portWrites: 0,
    repeatOpcodes: 0,
    repeatIterations: 0,
    points: 0,
    copies: 0,
  };
  for (const c of calls) {
    let cost;
    if (c.kind === "point") {
      if (!Number.isInteger(c.color) || c.color < 0 || c.color > 15)
        throw Error("Invalid cave minimap color");
      cost = egaDriverLineWork("point", [c.y, c.x]);
      work.points++;
    } else if (c.kind === "copy") {
      cost = egaSignedCopyWork(c);
      work.copies++;
    } else throw Error("Unsupported cave minimap operation");
    for (const k of [
      "instructions",
      "portWrites",
      "repeatOpcodes",
      "repeatIterations",
    ])
      work[k] += cost[k] ?? 0;
  }
  return {
    ...work,
    milliseconds: work.instructions
      ? normalCoreGraphicsMilliseconds(
          work,
          ORIGINAL_GRAPHICS_TIMING.cyclesPerMillisecond,
        )
      : 0,
  };
}
