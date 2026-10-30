// Original IT.DRV resource1:01ef..035c. Work only; does not rasterize, access
// pixels or schedule a clock. Signed call words retain their original bit pattern.
const u16 = (v) => v & 65535;
const s16 = (v) => (v << 16) >> 16;
export function egaSignedCopyWork({
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
    [sourceX, sourceY, destinationX, destinationY].some(
      (v) => v < -32768 || v > 32767,
    ) ||
    sourceStrideBytes < 1 ||
    sourceStrideBytes > 65535 ||
    destinationStrideBytes < 1 ||
    destinationStrideBytes > 65535 ||
    typeof sourceVideo !== "boolean" ||
    typeof destinationVideo !== "boolean" ||
    (sourceVideo && sourceStrideBytes !== 40) ||
    (destinationVideo && destinationStrideBytes !== 40)
  )
    throw Error("Unsupported original signed EGA copy arguments");
  let instructions = 13,
    portWrites = 0,
    repeatOpcodes = 0,
    repeatIterations = 0;
  let rows = height;
  const sum = u16(destinationY + height);
  if (sum > 200) {
    //0207 JBE is unsigned,including negative destination Y.
    instructions += 4;
    const excess = u16(sum - 200);
    rows = u16(height - excess);
    //0211 JG consumes the flags from SUB BX,AX,including signed overflow.
    if (!(s16(height) > s16(excess)))
      return {
        instructions: instructions + 7,
        portWrites,
        repeatOpcodes,
        repeatIterations,
      };
  }
  instructions += 11;
  if (sourceVideo) {
    instructions += 5;
    portWrites++;
  }
  instructions += 2; //0249 CMP /024c JNZ always execute.
  if (destinationVideo) {
    instructions += 10;
    portWrites += 4;
  }
  instructions += 11;
  instructions += sourceY === 1 ? 1 : sourceY === 0 ? 3 : 2;
  instructions += 14;
  if (destinationY !== 1) instructions += destinationY === 0 ? 3 : 2;
  instructions += 8;
  const bytes = width >>> 3;
  let flatWords = 0;
  if (sourceStrideBytes === bytes) {
    instructions += 2;
    if (bytes === 40) {
      instructions += 2;
      if (destinationStrideBytes === 40) {
        instructions += 8;
        flatWords = u16(rows * 20); //02df..02e9 16-bit arithmetic.
      }
    }
  }
  for (let plane = 0; plane < 4; plane++) {
    instructions += 4;
    if (sourceVideo) {
      instructions += 4;
      portWrites++;
    }
    instructions += 2;
    if (destinationVideo) {
      instructions += 6;
      portWrites++;
    }
    instructions += 2;
    if (flatWords !== 0) {
      instructions += 2;
      repeatOpcodes++;
      repeatIterations += flatWords;
    } else {
      //0317..0335: DL is the row counter. Zero underflows to255 on DEC;
      // the loop executes256 rows. DH retains only the low byte of width.
      const loops = rows & 255 || 256;
      instructions += 4 + loops * 9;
      repeatOpcodes += loops * 2;
      repeatIterations += loops * ((bytes >>> 1) + (bytes & 1));
    }
    instructions += 4;
    if (!sourceVideo) instructions++;
    instructions += 2;
    if (!destinationVideo) instructions++;
    instructions += 3;
  }
  instructions += 6;
  return { instructions, portWrites, repeatOpcodes, repeatIterations };
}
