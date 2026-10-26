import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { FlightMemory } from "../src/game/flight-physics.js";
import {
  initializeJungleActorLists,
  selectJungleActorAnimation,
  advanceJungleActorFrame,
  rememberJungleActor,
  composeJungleActor,
} from "../src/game/jungle-animation.js";
import { renderFlightPixels } from "../src/game/flight-raster.js";

const ACTOR_WORDS = [
  0x88ae, 0x7164, 0x8b56, 0x4cf0, 0x6d9a, 0x797a, 0x5f46, 0x6858, 0x8d64,
  0x8924, 0x3d12, 0x6882,
];
const HISTORY = [0x711a, 0x7196, 0x68ae, 0x7030, 0x716a, 0x603e];
const CASES = [
  "initialization",
  "idle",
  "walk",
  "walk0",
  "walk1",
  "walk2",
  "walk3",
  "fire",
  "fire0",
  "fire1",
  "fire2",
  "present",
];
function decode(raw, cs, ip, count = 2) {
  assert.equal(raw.isError, false);
  const r = JSON.parse(raw.content[0].text);
  assert.equal(r.aborted, false);
  assert.equal(r.results.length, count);
  assert.ok(r.results.every((x) => x.status === "ok"));
  const cpu = r.results[0].registers;
  assert.deepEqual([cpu.cs, cpu.eip, cpu.ds, cpu.ss], [cs, ip, 0x1403, 0x1403]);
  const bytes = Buffer.from(r.results[1].data, "base64");
  assert.equal(bytes.length, 65536);
  return { cpu, bytes, results: r.results };
}
function compareActor(m, expected, label, presentation = false) {
  for (const at of [...ACTOR_WORDS, ...(presentation ? HISTORY : [])])
    assert.equal(
      m.i(at),
      expected.readInt16LE(at),
      `${label} DS:${at.toString(16)} divergence`,
    );
  assert.equal(m.b(0x3be), expected[0x3be], `${label} audio-enable divergence`);
  const sprite = m.view.getUint16(0x797a, true);
  assert.equal(
    m.b(sprite + 18),
    expected[sprite + 18],
    `${label} sprite frame divergence`,
  );
  if (presentation)
    for (const at of [sprite, sprite + 2])
      assert.equal(
        m.i(at),
        expected.readInt16LE(at),
        `${label} sprite position divergence`,
      );
}

export async function verifyJungleAnimation(resources) {
  const manifest = JSON.parse(
    await readFile("reference/jungle-animation.json", "utf8"),
  );
  assert.equal(manifest.expectedCaseCount, 12);
  assert.equal(manifest.expectedCheckpointCount, 12);
  assert.equal(manifest.expectedInputCount, 3);
  assert.equal(manifest.expectedClosedLoopCheckpointCount, 7);
  assert.deepEqual(
    manifest.routineSchedule.map((c) => c.id),
    CASES,
    "missing routine case",
  );
  assert.deepEqual(manifest.inputEvents, [
    { case: "idle", action: 5 },
    { case: "walk", action: 1 },
    { case: "fire", action: 18 },
  ]);
  assert.deepEqual(manifest.injections, [
    {
      at: "01f5:0439 before travel",
      segment: 0x1403,
      offset: 0x9f5e,
      width: 1,
      before: 33,
      after: 25,
      meaning:
        "requested jungle destination; does not alter animation mechanics",
    },
  ]);
  const local = {};
  for (const [key, a] of Object.entries(manifest.artifacts)) {
    const bytes = await readFile(a.path).catch(() => {
      throw Error(`SETUP: missing ${a.path}; see docs/jungle.md`);
    });
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      a.sha256,
      `corrupt jungle artifact ${a.path}`,
    );
    local[key] = JSON.parse(bytes);
  }
  assert.equal(Object.keys(local).length, 26, "missing capture artifact");
  function identity(alterCode = false) {
    const target = decode(local.beforeTarget, 0x1f5, 0x439, 3),
      entry = decode(local.entry, 0xe0c, 0, 3);
    assert.equal(target.cpu.ebp, 0x9f7c);
    assert.equal(target.bytes[0x9f5e], 33);
    assert.equal(target.bytes[0x4e0e], 14);
    assert.equal(entry.bytes.readUInt16LE(entry.cpu.esp + 4), 0);
    assert.equal(entry.bytes[0x4e0e], 17);
    assert.equal(entry.bytes.readUInt16LE(0x2229), 40257);
    const exe = resources.executableRaw,
      overlay = 0x1fa00;
    assert.equal(exe.readUInt16LE(overlay), 0x5a4d);
    assert.equal(exe.readUInt16LE(overlay + 6), 436);
    assert.equal(exe.readUInt16LE(overlay + 8) * 16, 2048);
    const body = Buffer.from(exe.subarray(overlay + 2048, overlay + 26104));
    const table = exe.readUInt16LE(overlay + 24);
    for (let i = 0; i < 436; i++) {
      const at = overlay + table + i * 4,
        offset = (exe.readUInt16LE(at + 2) - 0xc17) * 16 + exe.readUInt16LE(at);
      assert.ok(offset >= 0 && offset + 2 <= body.length);
      body.writeUInt16LE((body.readUInt16LE(offset) + 0x1f5) & 65535, offset);
    }
    const live = Buffer.from(entry.results[2].data, "base64");
    if (alterCode) live[0] ^= 1;
    assert.equal(live.length, 24056);
    assert.deepEqual(live, body, "live jungle overlay identity");
  }
  const cache = new WeakMap();
  function render(m) {
    const pose = new FlightMemory(m.bytes);
    rememberJungleActor(pose);
    const assets = new Map(
      [
        [0x957e, 0],
        [0x9762, 5],
        [0x5f2c, 6],
        [0x5f90, 17],
      ].map(([at, id]) => [pose.view.getUint16(at, true), id]),
    );
    renderFlightPixels(
      composeJungleActor(pose, assets),
      resources.entries,
      resources.mainEntries[42].data,
      "JG.ARC",
      cache,
    );
  }
  function routines({
    alterDelay = false,
    alterResult = false,
    omitCase = false,
  } = {}) {
    let executed = 0,
      consumed = 0,
      rendered = 0;
    for (const c of manifest.routineSchedule) {
      if (omitCase && c.id === "walk2") continue;
      const cs = ["select", "advance"].includes(c.kind) ? 0x118c : 0xe0c;
      const [beforeIP, afterIP] =
        {
          initialize: [0x173e, 0x1ef4],
          select: [0x6a9, 0x9f8],
          advance: [0x64e, 0x6a7],
          present: [0x11c5, 0x1223],
        }[c.kind] ?? [];
      assert.ok(beforeIP !== undefined, "unsupported routine");
      const before = decode(local[c.id + "-before"], cs, beforeIP),
        after = decode(local[c.id + "-after"], cs, afterIP);
      const m = new FlightMemory(before.bytes);
      if (c.kind === "initialize") {
        initializeJungleActorLists(m);
        if (alterDelay) m.i(0x54c2, m.i(0x54c2) + 1);
        const bp = before.cpu.ebp;
        assert.equal(bp, 0x9e6a);
        assert.equal(after.cpu.ebp, bp);
        // This14-byte exclusion is the original loop local and scratch below
        // SP used by calls/interrupts; no game table falls in this interval.
        for (const [start, end] of [
          [0, bp - 14],
          [bp, 65536],
        ])
          assert.deepEqual(
            Buffer.from(m.bytes.subarray(start, end)),
            after.bytes.subarray(start, end),
            "initializer DS divergence",
          );
      } else {
        if (c.kind === "select") {
          const event = manifest.inputEvents[consumed];
          assert.equal(
            event.case,
            c.id,
            "unconsumed/reordered selector argument",
          );
          assert.equal(
            before.bytes.readInt16LE(before.cpu.esp + 4),
            event.action,
            "independent argument/capture disagreement",
          );
          assert.equal(c.action, event.action);
          const sounds = [];
          selectJungleActorAnimation(m, event.action, {
            sound: (id) => sounds.push(id),
          });
          assert.deepEqual(
            sounds,
            c.id === "fire" ? [0x64] : [],
            "direct sound requests",
          );
          consumed++;
        } else if (c.kind === "advance") advanceJungleActorFrame(m);
        else rememberJungleActor(m);
        if (alterResult && c.id === "walk") after.bytes[0x5f46] ^= 1;
        compareActor(m, after.bytes, c.id, c.kind === "present");
        render(m);
        rendered++;
      }
      executed++;
    }
    assert.equal(executed, 12, "missing routine checkpoint");
    assert.equal(consumed, 3, "unconsumed selector argument");
    assert.equal(rendered, 11, "unrendered actor pose");
    return executed;
  }
  function carried(omitAdvance = false) {
    let executed = 0;
    for (const [name, count] of [
      ["walk", 4],
      ["fire", 3],
    ]) {
      const first = decode(local[name + "0-before"], 0x118c, 0x64e);
      const m = new FlightMemory(first.bytes);
      for (let i = 0; i < count; i++) {
        if (!(omitAdvance && i === 1)) advanceJungleActorFrame(m);
        const after = decode(local[name + i + "-after"], 0x118c, 0x6a7);
        compareActor(m, after.bytes, `${name} carried${i}`);
        render(m);
        executed++;
      }
    }
    assert.equal(executed, 7, "unfinished carried sequence");
    return executed;
  }
  identity();
  const cases = routines(),
    checkpoints = carried();
  assert.throws(() => identity(true), /overlay identity/);
  assert.throws(
    () => routines({ alterDelay: true }),
    /initializer DS divergence/,
  );
  assert.throws(() => routines({ alterResult: true }), /walk.*divergence/);
  assert.throws(
    () => routines({ omitCase: true }),
    /missing routine checkpoint/,
  );
  assert.throws(() => carried(true), /carried.*divergence/);
  const silent = new FlightMemory(
      decode(local["fire-before"], 0x118c, 0x6a9).bytes,
    ),
    sounds = [];
  silent.b(0x3be, 0);
  selectJungleActorAnimation(silent, 18, { sound: (id) => sounds.push(id) });
  assert.deepEqual(
    sounds,
    [],
    "disabled audio must not issue a direct request",
  );
  assert.throws(
    () => selectJungleActorAnimation(silent, 8),
    /Untranslated jungle vine projection/,
  );
  console.log(
    `Jungle animation: ${cases} conditional original routine checkpoints,3 consumed selector arguments,${checkpoints} carried animation checkpoints,18 decoded poses; complete24056-byte/436-relocation identity and5 negative controls. No complete scene/gameplay/pixel/timing parity claimed.`,
  );
}
