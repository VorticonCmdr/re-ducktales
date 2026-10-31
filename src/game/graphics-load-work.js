// Counted resident decoder/converter work. Original timer observations are
// comparison outputs,never inputs to this budget. DOS/IRQ/allocator work is
// still outside this subtotal;see docs/cave-loader-work.md.
import {
  lzwGraphicsLoadWork,
  lzwByteLoadWork,
  egaGraphicsConversionWork,
} from "./sprite-load-work.js";
import { normalCoreGraphicsMilliseconds } from "./ega-work.js";
import { ORIGINAL_GRAPHICS_TIMING } from "./timing.js";

export function graphicsLoadWork(entry) {
  if (
    !(entry?.data instanceof Uint8Array) ||
    !(entry?.packedData instanceof Uint8Array) ||
    entry.packedData.length !== entry.packedSize
  )
    throw Error("Missing original packed graphics load bytes");
  const decoded = lzwGraphicsLoadWork(entry.packedData, entry.data.length);
  if (decoded.decoded.some((value, at) => value !== entry.data[at]))
    throw Error("Original graphics load payload differs from decoded asset");
  const converted = egaGraphicsConversionWork(entry);
  const work = {
    instructions: decoded.instructions + converted.instructions,
    portWrites: 0,
    repeatOpcodes: decoded.repeatOpcodes,
    repeatIterations: decoded.repeatIterations,
  };
  return {
    ...work,
    milliseconds: normalCoreGraphicsMilliseconds(
      work,
      ORIGINAL_GRAPHICS_TIMING.cyclesPerMillisecond,
    ),
    resource: entry.index,
    archive: entry.archive,
    decodedBytes: entry.data.length,
    planarBytes: converted.planes.length,
    fileReads: decoded.fileReads,
    scope: "resident-lzw-and-mode1-ram-conversion",
  };
}

export function byteLoadWork(entry) {
  if (
    entry?.type !== 4 ||
    !(entry.data instanceof Uint8Array) ||
    !(entry.packedData instanceof Uint8Array) ||
    entry.packedData.length !== entry.packedSize
  )
    throw Error("Missing original packed byte load resource");
  const { decoded, ...work } = lzwByteLoadWork(
    entry.packedData,
    entry.data.length,
  );
  if (decoded.some((value, at) => value !== entry.data[at]))
    throw Error("Original byte load payload differs from decoded resource");
  return {
    ...work,
    milliseconds: normalCoreGraphicsMilliseconds(
      work,
      ORIGINAL_GRAPHICS_TIMING.cyclesPerMillisecond,
    ),
    resource: entry.index,
    archive: entry.archive,
    decodedBytes: decoded.length,
    planarBytes: 0,
    scope: "resident-lzw-byte-output",
  };
}
