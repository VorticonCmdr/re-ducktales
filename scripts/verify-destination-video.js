import assert from "node:assert/strict";
const e =
  await import("./verify-destination.js?manifest=reference/destination-video.json");
const { manifest: m, snapshot, snapshots, rows, archives, body } = e;
assert.equal(m.expectedVideoSnapshots, 29);
assert.equal(m.expectedFlipPairs, 5);
const capture = await e.load("notice-capture.json");
assert.equal(capture.videoBoundaries, 10);
await snapshot("notice-entry.json", 0xab7, 0);
for (const row of rows)
  for (const [stage, ip] of [
    ["flip-before", 0x1101],
    ["flip-after", 0x1105],
  ]) {
    const { s, regs, ds } = await snapshot(row[stage].artifact, ip);
    assert.equal(s.stop.stop_id, row[stage].stopId);
    assert.equal(regs.eax & 65535, row[stage].ax);
    assert.equal(ds.readUInt32LE(0x2225), row[stage].clock);
    assert.equal(ds.readUInt16LE((regs.ebp - 0x7c) & 65535), row[stage].choice);
  }
assert.equal(snapshots.size, 29);
const original = Buffer.from(archives.get("IT.DRV")[1].data);
assert.equal(original.length, 2599);
const preDraw = new Set([
  "notice-entry.json",
  "notice-before-entry-flush.json",
  "notice-after-entry-flush.json",
]);
const slots = [0x32d, 0x331, 0x341, 0x34b];
assert.deepEqual(
  m.driverMutableData.map(({ offset, length }) => [offset, length]),
  [
    [0x1e, 10],
    [0x28, 16],
  ],
);
assert.deepEqual(
  m.driverPatchWords.map(({ offset, writer }) => [offset, writer]),
  [
    [0x32d, 0x2a8],
    [0x331, 0x276],
    [0x341, 0x26a],
    [0x34b, 0x29a],
  ],
);
for (const [at, hex] of [
  [0x26a, "2ea34103"],
  [0x276, "2e89163103"],
  [0x29a, "2ea34b03"],
  [0x2a8, "2e89162d03"],
])
  assert.equal(
    original.subarray(at, at + hex.length / 2).toString("hex"),
    hex,
    "Original rectangle operand writer",
  );
function checkDriver(live, name) {
  assert.equal(live.length, 2599);
  // These four immediate WORDs are self-modified by the original rectangle
  // copier (stores at026a,0276,029a,02a8). Check their actual context values;
  // do not silently exclude arbitrary changed instruction operands.
  const map = archives.get("MAIN.ARC")[22];
  const expected = preDraw.has(name)
    ? [40 - map.width / 8, 0, (map.width * map.height) / 8, 8000]
    : [0, 0, 8000, 8000];
  assert.deepEqual(
    slots.map((at) => live.readUInt16LE(at)),
    expected,
    "Original rectangle patch operands",
  );
  const normalized = Buffer.from(live);
  // 001e..0027 are runtime pointers/flags;0028..0037 is the16-byte palette.
  // Code/jump-table bytes outside these data fields and the checked operands
  // must match the authoritative driver resource exactly.
  original.copy(normalized, 0x1e, 0x1e, 0x38);
  for (const at of slots) original.copy(normalized, at, at, at + 2);
  assert.deepEqual(
    normalized,
    original,
    "Original live EGA driver instructions",
  );
}
function checkPages(s) {
  const v = s.video;
  assert.ok(v, "Missing video boundary metadata");
  assert.equal(v.memory.aborted, false);
  assert.equal(v.memory.results.length, 2);
  assert.ok(v.memory.results.every((r) => r.status === "ok"));
  const bios = Buffer.from(v.memory.results[0].data, "base64"),
    driver = Buffer.from(v.memory.results[1].data, "base64");
  assert.equal(bios.length, 21);
  const page = bios[20];
  assert.ok(page === 0 || page === 1);
  assert.equal(bios.readUInt16LE(0), page * 8192, "BIOS page start");
  assert.equal(driver[0x27], v.driverNextPage);
  assert.equal(v.driverNextPage, page ^ 1, "Drawing/BIOS page relationship");
  const ds = Buffer.from(s.state.results[1].data, "base64");
  assert.equal(ds.readUInt16LE(0x1fd4), 0xe5);
  assert.equal(ds.readUInt16LE(0x1fd6), v.driverSegment);
  const surface = driver.readUInt16LE(0x1e);
  assert.equal(surface, v.drawingSurfacePointer);
  assert.deepEqual(
    v.drawingSurfaceWords,
    Array.from({ length: 6 }, (_, i) => ds.readUInt16LE(surface + i * 2)),
  );
  assert.deepEqual(v.drawingSurfaceWords.slice(0, 5), [
    40,
    200,
    0,
    0xa000 + (v.driverNextPage << 9),
    8000,
  ]);
  assert.equal(
    v.statusBefore.frame,
    v.statusAfter.frame,
    "Update counter changed during CPU stop",
  );
  assert.equal(
    v.frameBefore.frame_hash,
    v.frameAfter.frame_hash,
    "Raw image changed during CPU stop",
  );
  for (const f of [v.frameBefore, v.frameAfter]) {
    assert.deepEqual([f.width, f.height], [320, 200]);
    assert.equal(f.video_mode.bios_mode_number, 13);
    assert.match(f.frame_hash, /^[a-f0-9]{16}$/);
  }
  return {
    page,
    driver,
    frame: v.statusBefore.frame,
    hash: v.frameBefore.frame_hash,
  };
}
const pages = new Map();
for (const [name, s] of snapshots) {
  const record = checkPages(s.s);
  checkDriver(record.driver, name);
  const code = Buffer.from(s.s.stop.code_bytes, "base64"),
    at = s.regs.eip + 0xca0;
  assert.deepEqual(
    code,
    body.subarray(at, at + code.length),
    `Live map code at ${name}`,
  );
  pages.set(name, record);
}
for (const row of rows) {
  const before = pages.get(row["flip-before"].artifact),
    after = pages.get(row["flip-after"].artifact);
  assert.equal(after.page, before.page ^ 1, "Page flip toggles BIOS page");
  assert.ok(
    after.frame >= before.frame,
    "Update counter must not go backwards",
  );
}
// Input code3 is consumed at read2. The logical choice has become1 before
// flipping;the raw cache still contains the old page after that actual flip.
const old = pages.get(rows[0].flush.artifact).hash;
const fresh = pages.get(rows[4].flush.artifact).hash;
assert.notEqual(old, fresh);
assert.equal(rows[2]["flip-before"].choice, 1);
assert.equal(rows[2]["flip-after"].choice, 1);
assert.equal(pages.get(rows[2]["flip-before"].artifact).hash, old);
assert.equal(pages.get(rows[2]["flip-after"].artifact).hash, old);
assert.equal(pages.get(rows[3].flush.artifact).hash, old);
assert.equal(pages.get(rows[3].before.artifact).hash, fresh);
// Observed low-word/no-wrap wait segments only. Never use these resulting
// values to manufacture clock inputs or a browser polling period.
function waitSeven(start, end) {
  assert.ok(start > 0 && start < 0xfff0);
  assert.ok(end >= start + 7, "Original seven-count wait incomplete");
}
waitSeven(rows[2].input.clock, rows[2]["flip-before"].clock);
waitSeven(rows[4]["flip-after"].clock, e.ret.ds.readUInt32LE(0x2225));
const first = snapshots.get(rows[0].flush.artifact).s;
const badPage = structuredClone(first),
  bios = Buffer.from(badPage.video.memory.results[0].data, "base64");
bios[20] ^= 1;
badPage.video.memory.results[0].data = bios.toString("base64");
assert.throws(
  () => checkPages(badPage),
  /BIOS page start|Drawing\/BIOS page relationship/,
);
const badHash = structuredClone(first);
badHash.video.frameAfter.frame_hash = "0000000000000000";
assert.throws(() => checkPages(badHash), /Raw image changed during CPU stop/);
const driver = Buffer.from(first.video.memory.results[1].data, "base64");
const badCode = Buffer.from(driver);
badCode[0xe5] ^= 1;
assert.throws(
  () => checkDriver(badCode, rows[0].flush.artifact),
  /Original live EGA driver instructions/,
);
const badOperand = Buffer.from(driver);
badOperand[0x32e] ^= 1;
assert.throws(
  () => checkDriver(badOperand, rows[0].flush.artifact),
  /Original rectangle patch operands/,
);
assert.throws(
  () => waitSeven(100, 106),
  /Original seven-count wait incomplete/,
);
console.log(
  "Destination video:29 stable owned CPU snapshots,5 BIOS/drawing-page flips,all2599 EGA bytes with34 source-justified data/operand bytes separately scoped,old raw cache after choice/flip and new cache later;5 negative controls. Status.frame is an update counter,not a completed-scanout clock;no fitted browser timing or fixed frame alignment.",
);
