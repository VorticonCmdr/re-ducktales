// Work performed by the supported original EGA sprite primitive,035d..0514.
// Counts normal-core opcodes and port writes, not host Canvas operations.
// This is a primitive work description; it does not schedule simulation time.
export function egaSpriteWork(entry, frame, x, y) {
  if (
    entry?.type !== 2 ||
    !Number.isInteger(entry.width) ||
    entry.width <= 0 ||
    entry.width % 8 ||
    !Number.isInteger(entry.height) ||
    entry.height < 1 ||
    !Number.isInteger(entry.frames) ||
    entry.frames < 1 ||
    entry.data?.length !== (entry.width * entry.height * entry.frames) / 2
  )
    throw Error("Unsupported original EGA sprite layout");
  if (
    !Number.isInteger(frame) ||
    frame < 0 ||
    frame >= entry.frames ||
    frame > 255 ||
    !Number.isInteger(x) ||
    x < -32768 ||
    x > 32767 ||
    !Number.isInteger(y) ||
    y < -32768 ||
    y > 32767
  )
    throw Error("Invalid original EGA sprite arguments");
  const width = entry.width / 8,
    height = entry.height;
  const byteX = x >> 3,
    shift = (-x + 8) & 7;
  const transparent = entry.data[0] >> 4;
  // The original loader builds one shared opacity plane for all four colors.
  const opaqueByte = (row, byte) => {
    const start =
      (row * entry.width * entry.frames) / 2 +
      (frame * entry.width) / 2 +
      byte * 4;
    for (let i = 0; i < 4; i++) {
      const p = entry.data[start + i];
      if (p >> 4 !== transparent || (p & 15) !== transparent) return true;
    }
    return false;
  };
  let instructions = 43; //035d..03c8,including initial Y comparison/branch.
  if (y !== 1) instructions += (y & 65535) > 1 ? 2 : 3; //03ca..03d0
  instructions += 16; //03d2..03f8
  let portWrites = 4;
  for (let row = 0; row < height; row++) {
    const py = ((y + row) << 16) >> 16;
    instructions += 3; //03f9..03fe
    if (py < 0)
      instructions++; //0400:negative rows still advance source/destination.
    else {
      instructions += 2; //0403..0406
      if (py >= 200) {
        instructions++;
        break;
      } //0408
      instructions += 5; //040b..0413,row locals
      let bx = byteX,
        remaining = width,
        skipped = 0;
      for (;;) {
        instructions += 3; //0416..041b
        if (bx >= 0) {
          instructions += 2; //041d..0420
          if (bx < 40) break;
        }
        instructions += 5; //0422..042a
        bx++;
        skipped++;
        remaining--;
        if (remaining === 0) {
          instructions++;
          break;
        } //042c
      }
      if (remaining) {
        instructions += 2; //042f..0431
        for (let plane = 0; plane < 4; plane++) {
          instructions += 19; //0434..0455,0459..045d
          portWrites += 2;
          if (remaining >= 40 - bx) instructions++; //0457
          const bytes = Math.min(remaining, 40 - bx);
          if (shift === 0) {
            instructions++; //04bd
            let lastOpaque = false;
            for (let b = 0; b < bytes; b++) {
              lastOpaque = opaqueByte(row, skipped + b);
              instructions += lastOpaque ? 13 : 9; //04c0..04db
            }
            if (lastOpaque) instructions++; //04d8 after final opaque byte
          } else {
            instructions += 8; //045f..0471
            if (byteX < 0) instructions += 4; //0473..047b,preceding source byte
            instructions += bytes * 20 + 2; //047d..04a8
            if (bx + bytes < 40) instructions += 7; //04aa..04b7,trailing destination byte
            instructions += 2; //04ba..04bb
          }
          instructions += 6; //04dd..04e7
          if (plane < 3) instructions++; //04e9
        }
      }
      instructions += 5; //04ec..04f6
    }
    instructions += 6; //04f7..0507
    if (row < height - 1) instructions++; //0509
  }
  instructions += 6; //050c..0514
  return { instructions, portWrites };
}

// Original copy primitive01ef..035c. The caller supplies semantic surface types;
// the original compares descriptor addresses with the active video descriptor.
// This scope covers the bounded nonnegative rectangles used for mountain erase.
export function egaCopyWork({
  width,
  height,
  sourceX,
  sourceY,
  destinationX,
  destinationY,
  sourceStrideBytes,
  destinationStrideBytes,
  sourceVideo,
  destinationVideo,
}) {
  if (
    ![
      width,
      height,
      sourceX,
      sourceY,
      destinationX,
      destinationY,
      sourceStrideBytes,
      destinationStrideBytes,
    ].every(Number.isInteger) ||
    width < 1 ||
    width > 320 ||
    height < 1 ||
    height > 255 ||
    sourceX < 0 ||
    destinationX < 0 ||
    sourceY < 0 ||
    sourceY > 199 ||
    destinationY < 0 ||
    destinationY > 200 ||
    sourceStrideBytes < 1 ||
    sourceStrideBytes > 65535 ||
    destinationStrideBytes < 1 ||
    destinationStrideBytes > 65535 ||
    sourceX + width > sourceStrideBytes * 8 ||
    destinationX + width > destinationStrideBytes * 8 ||
    typeof sourceVideo !== "boolean" ||
    typeof destinationVideo !== "boolean" ||
    (sourceVideo && sourceStrideBytes !== 40) ||
    (destinationVideo && destinationStrideBytes !== 40)
  )
    throw Error("Unsupported original EGA copy rectangle");
  let instructions = 13,
    portWrites = 0,
    repeatOpcodes = 0,
    repeatIterations = 0;
  let rows = height;
  if (destinationY + rows > 200) {
    instructions += 4;
    rows = 200 - destinationY; //0209..0211
    if (rows === 0)
      return {
        instructions: instructions + 7,
        portWrites,
        repeatOpcodes,
        repeatIterations,
      }; //0213,0354..035c
  }
  instructions += 11; //0216..023b
  if (sourceVideo) {
    instructions += 5;
    portWrites++;
  } //023d..0246
  if (destinationVideo) {
    instructions += 10;
    portWrites += 4;
  } //024e..0261
  instructions += 11; //0264..0281
  instructions += sourceY === 1 ? 1 : sourceY === 0 ? 3 : 2; //0283..0289
  instructions += 14; //028b..02b3
  if (destinationY !== 1) instructions += destinationY === 0 ? 3 : 2; //02b5..02bb
  instructions += 8; //02bd..02ce
  // Original SHR truncates sub-byte widths/coordinates; no transparency merge.
  const bytes = width >> 3;
  let flat = false;
  if (sourceStrideBytes === bytes) {
    instructions += 2; //02d0..02d3
    if (bytes === 40) {
      instructions += 2; //02d5..02d8
      if (destinationStrideBytes === 40) {
        instructions += 8;
        flat = true;
      } //02da..02e9
    }
  }
  for (let plane = 0; plane < 4; plane++) {
    instructions += 4; //02ec..02f2
    if (sourceVideo) {
      instructions += 4;
      portWrites++;
    } //02f4..02fb
    instructions += 2; //02fc..0300
    if (destinationVideo) {
      instructions += 6;
      portWrites++;
    } //0302..030d
    instructions += 2; //030e..0311
    if (flat) {
      instructions += 2;
      repeatOpcodes++;
      repeatIterations += rows * 20; //0313..0315
    } else {
      instructions += 4 + rows * 9; //0317..0335
      repeatOpcodes += rows * 2;
      repeatIterations += rows * ((bytes >> 1) + (bytes & 1));
    }
    instructions += 4; //0337..033d
    if (!sourceVideo) instructions++; //033f
    instructions += 2; //0343..0347
    if (!destinationVideo) instructions++; //0349
    instructions += 3; //034d..0352
  }
  instructions += 6; //0354..035c
  return { instructions, portWrites, repeatOpcodes, repeatIterations };
}

// The scoped normal-core model: one budget unit per non-REP opcode, with the
// emulator's additional write-I/O charge. Interrupt/device work and budget-end
// clamping are separate platform costs, intentionally not invented here.
export function normalCoreGraphicsMilliseconds(work, cyclesPerMillisecond) {
  const repeatOpcodes = work?.repeatOpcodes ?? 0,
    repeatIterations = work?.repeatIterations ?? 0;
  if (
    !Number.isInteger(cyclesPerMillisecond) ||
    cyclesPerMillisecond < 1 ||
    !Number.isInteger(work?.instructions) ||
    work.instructions < 1 ||
    !Number.isInteger(work.portWrites) ||
    work.portWrites < 0 ||
    !Number.isInteger(repeatOpcodes) ||
    repeatOpcodes < 0 ||
    repeatOpcodes > work.instructions ||
    !Number.isInteger(repeatIterations) ||
    repeatIterations < 0
  )
    throw Error("Invalid normal-core graphics work");
  return (
    (work.instructions -
      repeatOpcodes +
      repeatIterations +
      work.portWrites * Math.floor(cyclesPerMillisecond / 1365)) /
    cyclesPerMillisecond
  );
}
export const normalCoreSpriteMilliseconds = normalCoreGraphicsMilliseconds;
