export const u8 = (value) => value & 0xff;
export const u16 = (value) => value & 0xffff;
export const s16 = (value) => (value << 16) >> 16;
export const u32 = (value) => value >>> 0;

// DUCK_UNPACKED.EXE 140e:0eb8: ADD AX,9248; ROR AX,1 (three times).
// Seed is an explicit environment value: original initialization reads BIOS 40:6c.
export function nextRandom(seed) {
  const sum = u16(seed + 0x9248);
  return u16((sum >>> 3) | (sum << 13));
}
