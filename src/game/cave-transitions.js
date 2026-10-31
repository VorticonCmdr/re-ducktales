// Overlay6:2496. Coordinates and torch attachments remain in the original EXE.
const entry = {
  right: { asset: 10, pose: 3, count: 13, table: 0x1848, kind: 13, cover: 24 },
  down: { asset: 11, pose: 0, count: 12, table: 0x18ac, kind: 12, cover: 25 },
  up: { asset: 12, pose: 0, count: 13, table: 0x1910, kind: 13 },
  left: { asset: 13, pose: 3, count: 15, table: 0x196c, kind: 15 },
};
const exit = {
  right: { asset: 10, pose: 1, count: 12, table: 0x187c, kind: 10 },
  down: { asset: 11, pose: 2, count: 13, table: 0x18dc, kind: 11 },
  up: { asset: 12, pose: 2, count: 10, table: 0x1944, kind: 12, cover: 25 },
  left: { asset: 13, pose: 3, count: 13, table: 0x19a8, kind: 13, cover: 24 },
};
export function* caveTransition(stage, direction) {
  const p = ({ entry, exit }[stage] ?? {})[direction];
  if (!p) throw Error(`Unsupported cave passage ${stage}/${direction}`);
  const m = this.memory,
    at = 0x54fc;
  yield* this.load(p.asset);
  if (p.cover) yield* this.load(p.cover, p.cover === 24 ? 0 : 240, 0);
  let pose = p.pose;
  for (let i = 0; i < p.count; i++) {
    if (pose > 3) pose = 0;
    m.b(at + 18, pose);
    m.i(at, m.i(p.table + i * 4));
    m.i(at + 2, m.i(p.table + i * 4 + 2));
    const c = yield* this.party(this.back(), {
      asset: p.asset,
      kind: p.kind,
      pose,
    });
    if (stage === "entry" && !(this.cell & 80) && i < 8)
      yield* this.draw(c, 43);
    if (p.cover) yield* this.draw(c, p.cover);
    yield* this.present(c);
    pose++;
  }
  if (stage === "entry") {
    if (!(this.cell & 80)) {
      m.view.setUint32(
        0x8cc0,
        (m.view.getUint32(0x8cc0, true) + 50) >>> 0,
        true,
      );
      this.sound(0x20);
    }
    for (let i = 0; i < 4; i++) {
      const c = yield* this.party(this.back());
      if (!(this.cell & 80))
        c.push({ op: "text", text: "$50", x: 132, y: 128, color: 15 });
      yield* this.present(c);
    }
  } else yield* this.present(this.restoreBackground());
}
