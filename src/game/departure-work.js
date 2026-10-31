import { egaCopyWork, normalCoreGraphicsMilliseconds } from "./ega-work.js";
import { ORIGINAL_GRAPHICS_TIMING } from "./timing.js";

// IT.DRV[1]:01b0..01ee fills one whole EGA page:29 opcodes,5 port
// writes and REP STOSB of8000 bytes with all four planes enabled. The
// portrait helper then copies320x200 RAM pixels at11c4:0075. Resource
// loading, text, wipe/reveal writes and other CPU/device costs are omitted.
export function departureWork(entries) {
  if (
    entries?.[30]?.type !== 1 ||
    entries[30].width !== 320 ||
    entries[30].height !== 200
  )
    throw Error("Missing original departure portrait");
  return portraitPageWork(entries[30]);
}

// The same fill and full-page RAM copy are used by picture helper6 (MAIN35).
export function portraitPageWork(entry) {
  if (entry?.type !== 1 || entry.width !== 320 || entry.height !== 200)
    throw Error("Missing original full-page portrait");
  const fill = {
    instructions: 29,
    portWrites: 5,
    repeatOpcodes: 1,
    repeatIterations: 8000,
  };
  const copy = egaCopyWork({
    width: 320,
    height: 200,
    sourceX: 0,
    sourceY: 0,
    destinationX: 0,
    destinationY: 0,
    sourceStrideBytes: 40,
    destinationStrideBytes: 40,
    sourceVideo: false,
    destinationVideo: true,
  });
  const timed = (work) => ({
    ...work,
    milliseconds: normalCoreGraphicsMilliseconds(
      work,
      ORIGINAL_GRAPHICS_TIMING.cyclesPerMillisecond,
    ),
  });
  return { fill: timed(fill), copy: timed(copy) };
}
