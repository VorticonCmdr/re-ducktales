// Counted resident payload-clear/decoder/converter work. Original timer observations are
// comparison outputs,never inputs to this budget. DOS/IRQ/allocator work is
// still outside this subtotal except required payload zeroing;see docs/cave-loader-work.md.
import {
  lzwGraphicsLoadWork,
  lzwByteLoadWork,
  egaGraphicsConversionWork,
} from "./sprite-load-work.js";
import { normalCoreGraphicsMilliseconds } from "./ega-work.js";
import { ORIGINAL_GRAPHICS_TIMING } from "./timing.js";
import { allocationPayloadClearWork } from "./allocation-clear-work.js";

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
  const clear = allocationPayloadClearWork(converted.planes.length);
  const work = {
    instructions: decoded.instructions + converted.instructions + clear.instructions,
    portWrites: 0,
    repeatOpcodes: decoded.repeatOpcodes + clear.repeatOpcodes,
    repeatIterations: decoded.repeatIterations + clear.repeatIterations,
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
    clearedPayloadBytes: clear.clearedPayloadBytes,
    scope: "resident-lzw-mode1-ram-conversion-and-payload-clear",
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
  const clear = allocationPayloadClearWork(decoded.length);
  const combined = {
    ...work,
    instructions: work.instructions + clear.instructions,
    repeatOpcodes: work.repeatOpcodes + clear.repeatOpcodes,
    repeatIterations: work.repeatIterations + clear.repeatIterations,
  };
  return {
    ...combined,
    milliseconds: normalCoreGraphicsMilliseconds(
      combined,
      ORIGINAL_GRAPHICS_TIMING.cyclesPerMillisecond,
    ),
    resource: entry.index,
    archive: entry.archive,
    decodedBytes: decoded.length,
    planarBytes: 0,
    clearedPayloadBytes: clear.clearedPayloadBytes,
    scope: "resident-lzw-byte-output-and-payload-clear",
  };
}
