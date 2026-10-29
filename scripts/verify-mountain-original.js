import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Mountain } from "../src/game/mountain.js";
import { FlightMemory } from "../src/game/flight-physics.js";

function capture(raw, cs, ip, count) {
  assert.equal(raw.isError, false);
  const r = JSON.parse(raw.content[0].text);
  assert.equal(r.aborted, false);
  assert.equal(r.results.length, count);
  assert.ok(r.results.every((x) => x.status === "ok"));
  const c = r.results[0].registers;
  assert.deepEqual([c.cs, c.eip, c.ds, c.ss], [cs, ip, 0x1403, 0x1403]);
  const bytes = Buffer.from(r.results[1].data, "base64");
  assert.equal(bytes.length, 65536);
  return { cpu: c, bytes, results: r.results };
}
function compare(
  local,
  resources,
  { alterCode = false, alterSeed = false, alterHazard = false } = {},
) {
  const before = capture(local.beforeInjection, 0x1f5, 0x439, 3);
  assert.equal(before.cpu.ebp, 0x9f7c);
  assert.equal(
    before.bytes[0x9f5e],
    33,
    "unexpected pre-injection destination",
  );
  assert.equal(before.bytes[0x4e0e], 10);
  const entry = capture(local.entry, 0xe0c, 0, 3),
    scene = capture(local.scene, 0xe0c, 0x317, 2);
  assert.equal(entry.bytes.readUInt16LE(entry.cpu.esp + 4), 0);
  assert.equal(entry.bytes.readUInt16LE(0x2229), 43353);
  assert.equal(entry.bytes[0x4e0e], 13);
  assert.equal(entry.bytes[0x8990], 0);
  const exe = resources.executableRaw,
    overlayAt = 0x17600;
  assert.equal(exe.readUInt16LE(overlayAt), 0x5a4d);
  assert.equal(exe.readUInt16LE(overlayAt + 6), 68);
  const body = Buffer.from(
    exe.subarray(overlayAt + 512, overlayAt + 512 + 12002),
  );
  const table = exe.readUInt16LE(overlayAt + 24);
  for (let i = 0; i < 68; i++) {
    const at = overlayAt + table + i * 4;
    const offset =
      (exe.readUInt16LE(at + 2) - 0xc17) * 16 + exe.readUInt16LE(at);
    assert.ok(
      offset >= 0 && offset + 2 <= body.length,
      "relocation outside overlay",
    );
    body.writeUInt16LE((body.readUInt16LE(offset) + 0x1f5) & 65535, offset);
  }
  const liveCode = Buffer.from(entry.results[2].data, "base64");
  assert.equal(liveCode.length, 12002);
  if (alterCode) liveCode[0] ^= 1;
  assert.deepEqual(liveCode, body, "static/runtime overlay identity");
  const m = new FlightMemory(entry.bytes);
  const mountain = new Mountain(
    {
      image: resources.image,
      entries: resources.entries,
      mainEntries: resources.mainEntries,
      variant: 0,
      difficulty: m.b(0x8990),
      seed: m.view.getUint16(0x2229, true),
      day: m.b(0x4e0e),
      money: m.view.getUint32(0x8cc0, true),
    },
    m,
  );
  // Compare the same prepared-page boundary; original initialization captures
  // never claimed that all drawing fits in one retrace.
  for (let step = 0; step < 100 && mountain.presentations < 1; step++)
    mountain.advanceRetrace();
  assert.equal(mountain.inputs.length, 0, "unexpected early input");
  assert.equal(mountain.presentations, 1);
  assert.ok(mountain.pending, "missing prepared second page");
  if (alterSeed) m.i(0x2229, m.i(0x2229) + 1);
  const expected = Buffer.from(scene.bytes);
  if (alterHazard) expected[m.i(0x5d26) + 1] ^= 1;
  const ranges = [
    [0x2229, 2],
    [0x57ee, 2],
    [0x5d26, 2],
    [0x4d34, 1],
    [0x5c70, 2],
    [0x6df0, 2],
    [0x54f6, 2],
    [0x5ae0, 2],
    [0x5c72, 2],
    [0x6d3c, 2],
    [0x6882, 2],
    [0x3d12, 2],
    [0x6ed4, 1],
    [0x88e4, 1],
    [0x1615, 1],
    [0x17da, 12],
    [0x3742, 4],
    [0x370a, 1],
    [m.i(0x5d26), 25 * 6],
    ...[0x36ea, 0x36ec, 0x36ee, 0x36f0, 0x3706, 0x3708, 0x3734, 0x3736].map(
      (at) => [at, 2],
    ),
  ];
  for (const at of [
    0x36f2,
    0x5c48,
    0x5ce8,
    0x3720,
    ...Array.from({ length: 10 }, (_, i) => 0x5804 + i * 20),
  ]) {
    ranges.push([at + 4, 8]);
    if (at !== 0x36f2) ranges.push([at + 18, 1]);
  }
  for (const [at, length] of ranges)
    assert.deepEqual(
      Buffer.from(m.bytes.subarray(at, at + length)),
      expected.subarray(at, at + length),
      `DS:${at.toString(16)} initialization divergence`,
    );
  return 1;
}

export async function verifyMountainOriginal(resources) {
  const manifest = JSON.parse(
    await readFile("reference/mountain-entry.json", "utf8"),
  );
  assert.equal(manifest.expectedCaseCount, 1);
  assert.equal(manifest.expectedCheckpointCount, 1);
  assert.equal(manifest.expectedInputCount, 0);
  assert.deepEqual(manifest.inputEvents, []);
  assert.deepEqual(manifest.injections, [
    {
      at: "01f5:0439 before travel",
      segment: 5123,
      offset: 40798,
      width: 1,
      before: 33,
      after: 24,
      meaning: "requested expedition target; does not alter mountain mechanics",
    },
  ]);
  const local = {};
  for (const [name, artifact] of Object.entries(manifest.artifacts)) {
    const bytes = await readFile(artifact.path).catch(() => {
      throw Error(`SETUP: missing ${artifact.path}; see docs/mountain.md`);
    });
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      artifact.sha256,
      `corrupt mountain artifact ${artifact.path}`,
    );
    local[name] = JSON.parse(bytes);
  }
  assert.equal(
    compare(local, resources),
    manifest.expectedCaseCount,
    "zero/incomplete original cases",
  );
  assert.throws(
    () => compare(local, resources, { alterCode: true }),
    /overlay identity/,
  );
  assert.throws(
    () => compare(local, resources, { alterSeed: true }),
    /2229.*divergence/,
  );
  assert.throws(
    () => compare(local, resources, { alterHazard: true }),
    /1618.*divergence/,
  );
  console.log(
    "Mountain original: 1 conditional initialization checkpoint, complete12002-byte relocated overlay identity, exact actor/lives/RNG/hazard/geometry fields; 3 negative controls. Explicit target injection; no pixel/timing parity claimed.",
  );
}
