// Conditional API fixture. Pointer values are query operands, not executable
// sequence addresses. No sequencer/IRQ is run in these query/wait captures.
export function prepareTandyStatusCase(driver, c) {
  const bytes = new Uint8Array(65535);
  bytes.set(driver);
  const view = new DataView(bytes.buffer);
  for (let ch = 0; ch < 4; ch++) {
    const at = view.getUint16(0x2b1 + ch * 2, true);
    view.setUint16(at, c.pointers[ch], true);
    bytes[at + 2] = c.durations[ch];
  }
  bytes[0x2ea] = c.marker;
  // Far-return frame; entry is reached by an external scratch-alias jump.
  view.setUint16(0xfef0, 0x4003, true);
  view.setUint16(0xfef2, 0x459c, true);
  bytes.set([0xeb, 0xfe], 0x4003);
  return bytes;
}
