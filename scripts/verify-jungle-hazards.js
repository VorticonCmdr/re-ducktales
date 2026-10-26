import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { FlightMemory } from "../src/game/flight-physics.js";
import * as init from "../src/game/jungle-initialization.js";

const CASES = [
  ["monkey", "Monkeys", 0x106f, 6, 0x22b, 223, 224, 0x9e44, 0x9e6e],
  [
    "platform-reset",
    "Platforms",
    0x1285,
    0xa6f,
    0xb92,
    225,
    226,
    0x9e40,
    0x9e6c,
    false,
  ],
  ["monkey-entry", "Monkeys", 0x106f, 6, 0x22b, 231, 232, 0x9e44, 0x9e6e],
  ["bird", "Birds", 0x122b, 14, 0x152, 233, 234, 0x9e3e, 0x9e6e],
  ["vine", "Vines", 0x137f, 2, 0x5c, 235, 236, 0x9e64, 0x9e6e],
  ["fish-entry", "Fish", 0x111b, 0xd4, 0x1f1, 237, 238, 0x9e44, 0x9e6e],
  ["bonus-entry", "Bonus", 0xe0c, 0x2013, 0x208f, 239, 240, 0x9e60, 0x9e6e],
  ["snake", "Snakes", 0x133e, 0x34a, 0x40c, 241, 242, 0x9e52, 0x9e6e],
  ["transport", "Transports", 0x13c9, 14, 0x66, 243, 244, 0x9e58, 0x9e6e],
  [
    "platform-entry",
    "Platforms",
    0x1285,
    0xa6f,
    0xb92,
    245,
    246,
    0x9e40,
    0x9e6c,
    true,
  ],
];
const hash = (b) => createHash("sha256").update(b).digest("hex");
function result(raw, count) {
  assert.equal(raw.isError, false);
  const r = JSON.parse(raw.content[0].text);
  assert.equal(r.aborted, false);
  assert.equal(r.results.length, count);
  assert.ok(r.results.every((x) => x.status === "ok"));
  return r.results;
}
function decode(raw, cs, ip, count = 2) {
  const r = result(raw, count),
    cpu = r[0].registers;
  assert.deepEqual([cpu.cs, cpu.eip, cpu.ds, cpu.ss], [cs, ip, 0x1403, 0x1403]);
  const bytes = Buffer.from(r[1].data, "base64");
  assert.equal(bytes.length, 65536);
  return { cpu, bytes, results: r };
}
function compareDS(m, expected, exclusions, label) {
  let start = 0;
  for (const [lo, hi] of [...exclusions, [65536, 65536]]) {
    assert.ok(start <= lo && lo <= hi);
    assert.deepEqual(
      Buffer.from(m.bytes.subarray(start, lo)),
      expected.subarray(start, lo),
      `${label}: hazard DS divergence`,
    );
    start = hi;
  }
}
export async function verifyJungleHazards(resources) {
  const manifest = JSON.parse(
    await readFile("reference/jungle-hazards.json", "utf8"),
  );
  assert.equal(manifest.expectedCaseCount, 10);
  assert.equal(manifest.expectedCheckpointCount, 10);
  assert.equal(manifest.expectedCarriedCheckpointCount, 9);
  assert.equal(manifest.expectedInputCount, 2);
  assert.deepEqual(manifest.routineSchedule, CASES);
  assert.deepEqual(manifest.inputEvents, [
    { case: "platform-reset", first: false },
    { case: "platform-entry", first: true },
  ]);
  assert.deepEqual(manifest.deviceClockExclusion, [0x2225, 0x2229]);
  assert.deepEqual(manifest.carriedStackExclusion, [0x9e3e, 0x9e72]);
  assert.deepEqual(manifest.injections, [
    {
      at: "01f5:0439 before retry journey calculation",
      segment: 0x1403,
      offset: 0x9f5e,
      width: 1,
      before: 22,
      after: 25,
    },
  ]);
  const local = {};
  for (const [key, artifact] of Object.entries(manifest.artifacts)) {
    const raw = await readFile(artifact.path).catch(() => {
      throw Error(`SETUP: missing ${artifact.path}; see docs/jungle.md`);
    });
    assert.equal(hash(raw), artifact.sha256, `corrupt ${artifact.path}`);
    local[key] = JSON.parse(raw);
  }
  assert.equal(Object.keys(local).length, 23, "missing hazard capture");
  function identity(alterCode = false) {
    const target = decode(local["before-target"], 0x1f5, 0x439, 3),
      entry = decode(local.entry, 0xe0c, 0, 3);
    assert.equal(target.bytes[0x9f5e], 22);
    assert.equal(target.bytes[0x5b3c], 25);
    assert.equal(entry.bytes[0x9f5e], 25);
    assert.equal(entry.bytes[0x5b3c], 25);
    assert.equal(entry.bytes[0x4e0e], 23);
    assert.equal(entry.bytes.readUInt16LE(0x2229), 2725);
    assert.equal(entry.bytes.readUInt16LE(entry.cpu.esp + 4), 0);
    const exe = resources.executableRaw,
      overlay = 0x1fa00;
    assert.equal(exe.readUInt16LE(overlay + 6), 436);
    const body = Buffer.from(exe.subarray(overlay + 2048, overlay + 26104));
    const table = exe.readUInt16LE(overlay + 24);
    for (let i = 0; i < 436; i++) {
      const at = overlay + table + 4 * i,
        off = (exe.readUInt16LE(at + 2) - 0xc17) * 16 + exe.readUInt16LE(at);
      assert.ok(off >= 0 && off + 2 <= body.length);
      body.writeUInt16LE((body.readUInt16LE(off) + 0x1f5) & 65535, off);
    }
    const live = Buffer.from(entry.results[2].data, "base64");
    if (alterCode) live[0] ^= 1;
    assert.deepEqual(live, body, "fresh jungle overlay identity");
    // The recorded IRQ8 driver owns exactly DS2225..2228. Pin its code and
    // installed destination pointer before excluding that asynchronous clock.
    const clock = result(local["clock-driver"], 2),
      bytes = Buffer.from(clock[1].data, "base64");
    assert.equal(bytes.length, 0x3c1 - 0x288);
    assert.equal(clock[0].registers.eip, 0xb92);
    assert.deepEqual(bytes.subarray(4, 8), Buffer.from("25220314", "hex"));
    assert.deepEqual(
      bytes.subarray(32),
      Buffer.from(resources.driverEntries[5].data).subarray(0x2a8, 0x3c1),
      "IRQ8 clock driver code identity",
    );
    const bird = decode(local["bird-before"], 0x122b, 14);
    assert.equal(bird.bytes.readUInt16LE(0x2010), 0x37b);
    assert.equal(bird.bytes.readUInt16LE(0x2012), 0x2f7b);
  }
  function routines({
    omitCase = false,
    alterResult = false,
    wrongFirst = false,
  } = {}) {
    let executed = 0,
      consumed = 0;
    for (const [id, kind, cs, beforeIP, afterIP, , , lo, hi, first] of CASES) {
      if (omitCase && id === "vine") continue;
      const before = decode(local[id + "-before"], cs, beforeIP),
        after = decode(local[id + "-after"], cs, afterIP),
        m = new FlightMemory(before.bytes);
      assert.equal(after.cpu.ebp, before.cpu.esp - 2);
      const fn = init["initializeJungle" + kind];
      assert.equal(typeof fn, "function", "unsupported hazard initializer");
      if (first !== undefined) {
        const event = manifest.inputEvents[consumed++];
        assert.deepEqual(event, { case: id, first });
        assert.equal(
          before.bytes.readUInt16LE(before.cpu.esp + 4),
          Number(first),
        );
        fn(m, wrongFirst && first ? false : first);
      } else fn(m);
      if (alterResult && id === "bird") after.bytes[0x2229] ^= 1;
      // Only this routine crossed a timer IRQ; no adjacent RNG exclusion.
      compareDS(
        m,
        after.bytes,
        [...(id === "bird" ? [[0x2225, 0x2229]] : []), [lo, hi]],
        id,
      );
      if (id === "platform-reset")
        assert.equal(
          m.i(0x2229),
          before.bytes.readInt16LE(0x2229),
          "retry must preserve RNG",
        );
      executed++;
    }
    assert.equal(executed, 10, "unfinished hazard cases");
    assert.equal(consumed, 2, "unconsumed required initialization argument");
  }
  function carried(omitBird = false) {
    const m = new FlightMemory(
      decode(local["monkey-entry-before"], 0x106f, 6).bytes,
    );
    let checkpoints = 0,
      palettes = 0;
    const exclusions = [
      [0x2225, 0x2229],
      [0x9e3e, 0x9e72],
    ];
    for (const [id, kind, cs, , afterIP] of CASES.slice(2, 9)) {
      if (!(omitBird && kind === "Birds")) init["initializeJungle" + kind](m);
      compareDS(
        m,
        decode(local[id + "-after"], cs, afterIP).bytes,
        exclusions,
        `carried ${id}`,
      );
      checkpoints++;
    }
    init.initializeJungleLife(m, true, { palette: () => palettes++ });
    compareDS(
      m,
      decode(local["platform-entry-before"], 0x1285, 0xa6f).bytes,
      exclusions,
      "carried actor life start",
    );
    checkpoints++;
    init.initializeJunglePlatforms(m, true);
    compareDS(
      m,
      decode(local["platform-entry-after"], 0x1285, 0xb92).bytes,
      exclusions,
      "carried platforms",
    );
    checkpoints++;
    assert.equal(checkpoints, 9, "unfinished carried initialization");
    assert.equal(palettes, 1, "missing life palette output");
  }
  identity();
  routines();
  carried();
  assert.throws(() => identity(true), /overlay identity/);
  assert.throws(() => routines({ omitCase: true }), /unfinished hazard cases/);
  assert.throws(() => routines({ alterResult: true }), /hazard DS divergence/);
  assert.throws(() => routines({ wrongFirst: true }), /hazard DS divergence/);
  assert.throws(() => carried(true), /hazard DS divergence/);
  console.log(
    "Jungle hazards: 10 exact original initialization/reset cases,2 first/reset arguments,9 carried complete DS checkpoints; fresh overlay and IRQ8 driver code identity; five negative controls. Only documented stack scratch and the asynchronous four-byte device clock excluded. Scene/hazard advancement/browser route remain unfinished.",
  );
}
