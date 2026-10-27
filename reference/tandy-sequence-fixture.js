export function prepareTandySequenceCase(driver, c) {
  const b = new Uint8Array(65535);
  b.set(driver);
  const v = new DataView(b.buffer);
  function word(at, n) {
    v.setUint16(at, n, true);
  }
  for (let ch = 0; ch < 4; ch++) {
    let at = 0x1d1 + ch * 0x38;
    b.fill(c.kind === "tick" ? 0 : 0x31 + ch, at, at + 0x38);
    word(at, 0x3000);
    b[at + 7] = c.priorities[ch];
    if (c.kind === "tick") {
      b[at + 0x2e] = 255;
      b[at + 0x2f] = 255;
      word(at + 0x30, 0xf04);
      word(at + 0x32, 0xf04);
    }
    b[0x2c1 + ch] = c.kind === "tick" ? 255 : 17 + ch;
    b[0x2cd + ch] = c.kind === "tick" ? 255 : 33 + ch;
  }
  const at = 0x1d1 + c.channel * 0x38;
  b[0x1b3] = c.channel;
  b[0x1c9] = 1;
  b[0x1c5] = 0;
  b.set(c.args, 0x3000);
  if (c.kind === "tick") {
    b[at + 2] = 1;
    for (let ch = 0; ch < 4; ch++)
      if (ch !== c.channel) word(0x1d1 + ch * 0x38, 0);
  }
  for (const [off, width, value] of c.fields)
    if (width === 1) b[at + off] = value;
    else word(at + off, value);
  for (const [off, width, value] of c.extra)
    if (width === 1) b[off] = value;
    else word(off, value);
  const rel = (c.entry - 0x4003) & 65535;
  b.set([0xe8, rel & 255, rel >>> 8, 0xeb, 0xfb], 0x4000);
  return b;
}
