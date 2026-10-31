// Visible byte addresses for the bank's original IT.DRV 01ef copy:32x18,
// identical aligned source/destination coordinates,40 bytes per planar row.
// Keep the unsigned Y+height test,signed JG and DL row counter. In particular,
// y=-19 copies through row199;ordinary rectangle clipping would be incorrect.
const u16 = (v) => v & 65535,
  s16 = (v) => (v << 16) >> 16;
export function bankSparkleCopyBytes(x, y) {
  if (
    !Number.isInteger(x) ||
    x < 0 ||
    x > 65528 ||
    x & 7 ||
    !Number.isInteger(y) ||
    y < -32768 ||
    y > 32767
  )
    throw Error("Unsupported original bank sparkle copy coordinates");
  let rows = 18;
  const sum = u16(y + 18);
  if (sum > 200) {
    const excess = u16(sum - 200);
    if (!(18 > s16(excess))) return [];
    rows = u16(18 - excess);
  }
  const count = rows & 255 || 256,
    bytes = [];
  for (let row = 0; row < count; row++)
    for (let column = 0; column < 4; column++) {
      const at = u16(y * 40 + (x >>> 3) + row * 40 + column);
      if (at < 8000) bytes.push(at);
    }
  return bytes;
}
