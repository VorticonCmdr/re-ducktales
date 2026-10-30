// Original overlay5:1744..189d. Numeric calls retain their original seven words;
// resident color/dispatch CPU work is outside this call-plan boundary.
export function drawMountainHudSource(m, { line, draw, number }) {
  const lives = m.b(0x4d34);
  if (lives > 3) throw Error("Unsupported mountain HUD lives");
  for (let y = 169; y < 199; y++) line({ x: 0, y, x2: 319, y2: y, color: 0 });
  for (const [x, y, x2, y2] of [
    [0, 168, 319, 168],
    [319, 168, 319, 199],
    [0, 199, 319, 199],
    [0, 168, 0, 199],
  ])
    line({ x, y, x2, y2, color: 4 });
  draw(0x370c);
  draw(0x36d6);
  m.b(0x3732, 2);
  m.i(0x3720, 200);
  m.i(0x3722, 178);
  for (let i = 0; i < lives; i++) {
    draw(0x3720);
    m.b(0x3732, m.b(0x3732) - 1);
    m.i(0x3720, m.i(0x3720) + 32);
  }
  number(mountainMoneyCall(m));
  const day = m.signedByte(0x4e0e);
  number({
    x: day < 10 ? 18 : 14,
    y: 182,
    value: day,
    color: 1,
    background: 15,
    rightAlign: false,
  });
}
// Same original call at ordinary-frame1351 and full-HUD1851.
export function mountainMoneyCall(m) {
  return {
    x: 168,
    y: 174,
    value: m.view.getUint32(0x8cc0, true),
    color: 15,
    background: 4,
    rightAlign: true,
  };
}
