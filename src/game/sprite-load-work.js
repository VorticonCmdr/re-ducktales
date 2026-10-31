// Original resident LZW0efd..1070,bit reader1071..10e7 and EGA converter
// 10e8..112a/12f0..13cd. Source work only;no clock or native timer inputs.
export function lzwGraphicsLoadWork(packed, expectedSize) {
  if (
    !(packed instanceof Uint8Array) ||
    packed.length < 2 ||
    packed.length > 65535 ||
    !Number.isInteger(expectedSize) ||
    expectedSize < 1 ||
    expectedSize > 65535
  )
    throw Error("Unsupported original sprite load stream");
  const decoded = new Uint8Array(expectedSize),
    prefix = new Uint16Array(4096),
    suffix = new Uint8Array(4096);
  let instructions = 38 + 8,
    repeatOpcodes = 0,
    repeatIterations = 0;
  let width = 9,
    threshold = 512,
    next = 258,
    previous = null,
    first = 0;
  let bit = 0,
    bufferBit = 0,
    written = 0,
    codes = 0,
    clears = 0,
    dictionarySteps = 0,
    specials = 0,
    widthChanges = 0,
    fileReads = 1;
  function readCode() {
    if (bit + width > packed.length * 8)
      throw Error("Truncated original sprite LZW stream");
    const old = bufferBit,
      shift = old & 7,
      byte = old >>> 3;
    bufferBit = (bufferBit + width) & 65535;
    instructions += 29 + shift * 3; //1071..1090,10c3..10e7;each shift has3 opcodes.
    if (byte >= 1021) {
      instructions += 20;
      repeatOpcodes++;
      repeatIterations += 1024 - byte;
      bufferBit = shift + width;
      fileReads++;
    }
    const at = bit >>> 3;
    const value =
      ((packed[at] |
        ((packed[at + 1] ?? 0) << 8) |
        ((packed[at + 2] ?? 0) << 16)) >>>
        (bit & 7)) &
      ((1 << width) - 1);
    bit += width;
    codes++;
    return value;
  }
  for (;;) {
    const code = readCode();
    instructions += 3; //0f70..0f76,including CALL1071.
    if (code === 257) {
      instructions++;
      break;
    } //0f78 JMPepilogue.
    instructions += 2; //0f7b/0f7e.
    if (code === 256) {
      clears++;
      width = 9;
      threshold = 512;
      next = 258;
      const literal = readCode();
      if (literal > 255)
        throw Error("Unsupported original LZW clear/literal sequence");
      instructions += 12; //0f80..0fab,sprite branch incl.converter CALL.
      if (written >= expectedSize)
        throw Error("Original sprite LZW output overflow");
      decoded[written++] = literal;
      previous = first = literal;
      continue;
    }
    if (previous === null || code > next || next >= 4096)
      throw Error("Unsupported original sprite LZW dictionary path");
    instructions += 5; //0fb0..0fbe.
    let current = code;
    const stack = [];
    if (code === next) {
      specials++;
      instructions += 5;
      current = previous;
      stack.push(first);
    }
    let depth = 0;
    while (current > 255) {
      if (current >= next || ++depth > 4096)
        throw Error("Invalid original sprite LZW prefix");
      stack.push(suffix[current]);
      current = prefix[current];
      dictionarySteps++;
      instructions += 11;
    }
    instructions += 2 + 9; //last0fce/0fd4 test;0ff1..1009.
    first = current;
    stack.push(first);
    instructions += stack.length * 5 + 1 + 17; //100b..1013,1015,101b..1050.
    for (let i = stack.length - 1; i >= 0; i--) {
      if (written >= expectedSize)
        throw Error("Original sprite LZW output overflow");
      decoded[written++] = stack[i];
    }
    prefix[next] = previous;
    suffix[next] = first;
    next++;
    previous = code;
    if (next >= threshold) {
      instructions += 2; //1052/1057.
      if (width !== 12) {
        width++;
        threshold <<= 1;
        widthChanges++;
        instructions += 2;
      }
    }
    instructions++; //1061 JMPtop.
  }
  if (written !== expectedSize)
    throw Error("Incomplete original sprite LZW output");
  return {
    decoded,
    instructions,
    portWrites: 0,
    repeatOpcodes,
    repeatIterations,
    codes,
    clears,
    dictionarySteps,
    specials,
    widthChanges,
    fileReads,
  };
}

export function egaGraphicsConversionWork(entry) {
  if (
    ![1, 2].includes(entry?.type) ||
    (entry.type === 1 && entry.frames !== 1) ||
    !Number.isInteger(entry.width) ||
    entry.width <= 0 ||
    entry.width % 8 ||
    !Number.isInteger(entry.frames) ||
    entry.frames < 1 ||
    !Number.isInteger(entry.height) ||
    entry.height < 1 ||
    !(entry.data instanceof Uint8Array) ||
    entry.data.length !== (entry.width * entry.frames * entry.height) / 2
  )
    throw Error("Unsupported original EGA sprite conversion");
  const sprite = entry.type === 2,
    planesCount = sprite ? 5 : 4;
  const span = entry.data.length / 4;
  if (!Number.isInteger(span) || span * planesCount > 65536)
    throw Error("Unsupported original sprite plane address span");
  const planes = new Uint8Array(span * planesCount),
    transparent = entry.data[0] >>> 4;
  // Per byte:3 dispatch,8 setup,2*(21 color+2 opacity-test+5 tail),
  // 3 group-test and2 return. Each full group adds4+18+6 RAM-store ops.
  let instructions =
      19 +
      entry.data.length * (3 + 8 + 2 * (21 + (sprite ? 2 : 0) + 5) + 3 + 2) +
      span * (4 + (sprite ? 18 : 15) + 6),
    opaquePixels = 0;
  for (let p = 0; p < entry.data.length * 2; p++) {
    const color = (entry.data[p >>> 1] >>> (p & 1 ? 0 : 4)) & 15,
      mask = 1 << (7 - (p & 7)),
      at = p >>> 3;
    for (let plane = 0; plane < 4; plane++)
      if (color & (1 << plane)) planes[plane * span + at] |= mask;
    if (sprite && color !== transparent) {
      planes[4 * span + at] |= mask;
      instructions += 3;
      opaquePixels++;
    }
  }
  return {
    planes,
    instructions,
    portWrites: 0,
    repeatOpcodes: 0,
    repeatIterations: 0,
    decodedBytes: entry.data.length,
    opaquePixels,
    span,
  };
}

// Existing sprite-only callers retain an explicit type guard.
export const lzwSpriteLoadWork = lzwGraphicsLoadWork;
export function egaSpriteConversionWork(entry) {
  if (entry?.type !== 2)
    throw Error("Unsupported original sprite conversion kind");
  return egaGraphicsConversionWork(entry);
}
