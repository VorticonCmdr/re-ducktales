// Original resident044f..04c6 and far-calloc4072..410e clear allocation
// storage before the decoder runs. Both successful paths clear the payload.
// Near storage uses words plus an odd byte;far storage clears whole paragraphs.
// Count only the common payload work:allocator traversal,paragraph padding and
// wrapper instructions remain outside this subtotal. No measured time is input.
export function allocationPayloadClearWork(bytes) {
  if (!Number.isInteger(bytes) || bytes < 1 || bytes > 65535)
    throw Error("Unsupported original allocation payload size");
  return {
    instructions: 1,
    portWrites: 0,
    repeatOpcodes: 1,
    repeatIterations: Math.ceil(bytes / 2),
    clearedPayloadBytes: bytes,
    scope: "required-payload-zeroing-only",
  };
}
