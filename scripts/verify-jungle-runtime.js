import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Jungle } from "../src/game/jungle.js";
import {
  prepareJungle,
  initializeJungleEntry,
} from "../src/game/jungle-state.js";
import { FlightMemory } from "../src/game/flight-physics.js";
import { JUNGLE_SPRITES } from "../src/game/jungle-scene.js";
import {
  invalidateJungleActor,
  presentJungleFrame,
} from "../src/game/jungle-presentation.js";
import { sampleJungleControls } from "../src/game/jungle-controls.js";
import { collideJungleGround } from "../src/game/jungle-collision.js";
import {
  advanceJungleCamera,
  advanceJungleHazards,
} from "../src/game/jungle-hazards.js";
import {
  updateJungleRider,
  advanceJungleMotion,
} from "../src/game/jungle-motion.js";

const hash = (b) => createHash("sha256").update(b).digest("hex");
function exact(a, b, label) {
  assert.equal(a.length, b.length, label);
  for (let i = 0; i < a.length; i++)
    if (a[i] !== b[i])
      assert.fail(
        `${label}:byte ${i.toString(16)},actual ${a[i]},expected ${b[i]}`,
      );
}
const ENTITY_RANGES = [
  [0x514a, 512],
  [0x6040, 2000],
  [0x5d40, 340],
  [0x58cc, 372],
  [0x397e, 190],
  [0x7034, 228],
  [0x776e, 30],
  [0x6a26, 154],
  [0x95ea, 176],
  [0x5bb2, 44],
  [0x8c30, 80],
  [0x3a4a, 160],
];
const LISTS = [
  [0x6812, 5],
  [0x8a9e, 10],
  [0x89a6, 10],
  [0x5c76, 8],
  [0x5b40, 8],
  [0x54b0, 3],
  [0x95c0, 3],
  [0x8e50, 7],
  [0x8d02, 7],
  [0x797c, 7],
  [0x68ee, 7],
  [0x8b5c, 9],
  [0x4d92, 1],
  [0x96be, 1],
  [0x96cc, 1],
  [0x9244, 1],
  [0x9252, 1],
  [0x8926, 5],
  [0x7902, 5],
  [0x9274, 3],
  [0x96f2, 5],
  [0x5fc0, 6],
  [0x8a80, 2],
  [0x9764, 2],
  [0x5ae6, 3],
  [0x697e, 12],
  [0x5f4a, 5],
  [0x6dc6, 3],
  [0x6884, 3],
  [0x8a34, 4],
  [0x6e6c, 1],
  [0x6e7a, 5],
  [0x6df4, 4],
];
export async function verifyJungleRuntime(resources) {
  const manifest = JSON.parse(
    await readFile("reference/jungle-runtime.json", "utf8"),
  );
  assert.deepEqual(
    [
      manifest.expectedCaseCount,
      manifest.expectedOriginalCheckpointCount,
      manifest.expectedReplayCheckpointCount,
      manifest.expectedReplayInputCount,
      manifest.expectedOriginalInputCount,
      manifest.expectedPresentationCount,
      manifest.expectedClockEventCount,
    ],
    [3, 2, 20, 824, 2, 875, 6405],
  );
  assert.deepEqual(manifest.clockProvider, {
    driverNumerator: 1193182,
    driverDivisors: [1365, 12],
    retraceHz: 70.086,
    tieOrder: "driver-first",
  });
  assert.deepEqual(manifest.stackExclusion, [0x9df2, 0x9e72]);
  assert.deepEqual(manifest.deviceClockExclusion, [0x2225, 0x2229]);
  assert.deepEqual(manifest.injections, []);
  assert.deepEqual(manifest.fittedInputs, []);
  assert.deepEqual(manifest.initial, {
    variant: 0,
    difficulty: 0,
    seed: 2725,
    money: 44,
    day: 23,
    audioEnabled: false,
  });
  assert.deepEqual(manifest.inputEvents, [
    { byte: 0, count: 2 },
    { byte: 64, count: 1 },
    { byte: 0, count: 15 },
    { byte: 3, count: 18 },
    { byte: 5, count: 788 },
  ]);
  const local = {};
  for (const [key, a] of Object.entries(manifest.artifacts)) {
    const raw = await readFile(a.path).catch(() => {
      throw Error(`SETUP:missing ${a.path};see docs/jungle.md`);
    });
    assert.equal(hash(raw), a.sha256, `corrupt ${a.path}`);
    const envelope = JSON.parse(raw);
    assert.equal(envelope.isError, false);
    const r = JSON.parse(envelope.content[0].text);
    assert.equal(r.aborted, false);
    assert.ok(r.results.every((x) => x.status === "ok"));
    local[key] = {
      results: r.results,
      cpu: r.results[0].registers,
      m: new FlightMemory(Buffer.from(r.results[1].data, "base64")),
    };
  }
  assert.equal(Object.keys(local).length, 5);
  function initialize({ alterSeed = false } = {}) {
    const before = local.entry.m,
      expected = local.initialized.m;
    assert.deepEqual([local.entry.cpu.cs, local.entry.cpu.eip], [0xe0c, 0]);
    assert.deepEqual(
      [local.initialized.cpu.cs, local.initialized.cpu.eip],
      [0x1285, 0xb92],
    );
    const initial = {
      variant: before.i(0x54f8),
      difficulty: before.b(0x8990),
      seed: before.view.getUint16(0x2229, true),
      money: before.view.getUint32(0x8cc0, true),
      day: before.b(0x4e0e),
    };
    assert.deepEqual(initial, {
      variant: 0,
      difficulty: 0,
      seed: 2725,
      money: 44,
      day: 23,
    });
    if (alterSeed) initial.seed ^= 1;
    const { memory: m } = prepareJungle(
      { ...resources, ...initial },
      new FlightMemory(before.bytes),
    );
    initializeJungleEntry(m, {
      wait: () => assert.fail("unexpected initialization wait"),
    });
    for (const [at, length] of ENTITY_RANGES)
      exact(
        m.bytes.subarray(at, at + length),
        expected.bytes.subarray(at, at + length),
        "jungle initialization arrays",
      );
    for (const at of [
      0x5cfc, 0x3d12, 0x8e26, 0x8d64, 0x8924, 0x7158, 0x882a, 0x7166, 0x544c,
      0x5462, 0x5f46, 0x6858, 0x7030, 0x711a, 0x716a, 0x7196, 0x88ae, 0x7164,
      0x8b56, 0x4cf0, 0x6d9a, 0x2229, 0x78e8, 0x3a48,
    ])
      assert.equal(
        m.i(at),
        expected.i(at),
        `jungle initialization scalar ${at.toString(16)}`,
      );
    exact(
      m.bytes.subarray(0x2056, 0x2067),
      expected.bytes.subarray(0x2056, 0x2067),
      "jungle initialization palette",
    );
    const virtual = new Map(),
      original = new Map();
    for (const [at, asset] of JUNGLE_SPRITES) {
      const p = m.view.getUint16(at, true),
        q = expected.view.getUint16(at, true);
      virtual.set(p, asset);
      original.set(q, asset);
      for (const d of [0, 2, 4, 6, 8, 10])
        assert.equal(
          m.i(p + d),
          expected.i(q + d),
          "jungle descriptor geometry",
        );
      assert.equal(m.b(p + 18), expected.b(q + 18), "jungle descriptor frame");
    }
    for (const [at, count] of LISTS)
      for (let i = 0; i < count; i++) {
        const p = at + i * 14;
        assert.ok(
          virtual.has(m.view.getUint16(p, true)) &&
            original.has(expected.view.getUint16(p, true)),
          "unloaded jungle tuple sprite",
        );
        assert.equal(
          virtual.get(m.view.getUint16(p, true)),
          original.get(expected.view.getUint16(p, true)),
          "jungle tuple sprite identity",
        );
        exact(
          m.bytes.subarray(p + 2, p + 14),
          expected.bytes.subarray(p + 2, p + 14),
          "jungle tuple fields",
        );
      }
  }
  initialize();
  assert.throws(() => initialize({ alterSeed: true }), /jungle initialization/);
  function frame({ omitInvalidation = false, wrongInput = false } = {}) {
    const m = new FlightMemory(local["frame-before"].m.bytes),
      expected = local["frame-after"].m;
    for (const [key, ip] of [
      ["frame-before", 0xdc],
      ["frame-input", 0x680],
      ["frame-after", 0x47c],
    ]) {
      const c = local[key].cpu;
      assert.deepEqual([c.cs, c.eip, c.ds, c.ss], [0xe0c, ip, 0x1403, 0x1403]);
    }
    assert.equal(manifest.originalInputEvents.length, 2);
    assert.equal(
      manifest.originalInputEvents[0].byte,
      local["frame-input"].cpu.eax & 255,
    );
    assert.equal(manifest.originalInputEvents[0].byte, 0);
    const color = Buffer.from(
      local["frame-before"].results[2].data,
      "base64",
    )[0];
    assert.equal(manifest.originalInputEvents[1].byte, color);
    const effects = {
      color,
      draw: () => {},
      copy: () => {},
      line: () => {},
      text: () => {},
      wait: () => assert.fail("unexpected original frame wait"),
    };
    assert.equal(m.i(0x78e8), 0);
    assert.equal(m.i(0x1aac), 0);
    if (!omitInvalidation) invalidateJungleActor(m);
    m.i(0x8b56, 0);
    sampleJungleControls(
      m,
      wrongInput ? 3 : manifest.originalInputEvents[0].byte,
      effects,
    );
    collideJungleGround(m, effects);
    assert.notEqual(m.i(0x6882), 7, "unsupported original frame life reset");
    advanceJungleCamera(m);
    if (m.i(0x8e0e)) m.i(0x78e8, 3);
    advanceJungleHazards(m, effects);
    updateJungleRider(m, effects);
    advanceJungleMotion(m, effects);
    presentJungleFrame(m, effects);
    let start = 0;
    for (const [lo, hi] of [
      manifest.deviceClockExclusion,
      manifest.stackExclusion,
      [65536, 65536],
    ]) {
      exact(
        m.bytes.subarray(start, lo),
        expected.bytes.subarray(start, lo),
        "whole jungle frame DS divergence",
      );
      start = hi;
    }
    assert.equal(
      effects.color,
      Buffer.from(local["frame-after"].results[2].data, "base64")[0],
    );
  }
  frame();
  assert.throws(
    () => frame({ omitInvalidation: true }),
    /whole jungle frame DS divergence/,
  );
  assert.throws(
    () => frame({ wrongInput: true }),
    /whole jungle frame DS divergence/,
  );
  function replay({
    omitFire = false,
    omitInput = false,
    omitCheckpoint = false,
    extraInput = false,
    alterPixel = false,
  } = {}) {
    const stream = manifest.inputEvents.flatMap((e) => {
      assert.ok(Number.isInteger(e.count) && e.count > 0);
      return Array(e.count).fill(e.byte);
    });
    assert.equal(stream.length, 824);
    if (omitInput) stream.pop();
    if (extraInput) stream.push(0);
    const checkpoints = structuredClone(manifest.checkpoints);
    if (omitCheckpoint) checkpoints.pop();
    assert.equal(checkpoints.length, 20, "missing jungle checkpoint");
    const j = new Jungle({ ...resources, ...manifest.initial });
    let driver = 0,
      retrace = 0,
      events = 0,
      executed = 0,
      presentation = 0;
    while (!j.outcome && events < 10000) {
      const count = j.inputs.length,
        byte = stream[count];
      if (byte !== undefined)
        j.setControls({
          direction:
            { 1: "up", 3: "right", 5: "down", 7: "left" }[byte & 63] ?? null,
          fire: !omitFire && !!(byte & 64),
        });
      if ((driver + 1) / (1193182 / (1365 * 12)) <= (retrace + 1) / 70.086) {
        driver++;
        j.advanceTick();
      } else {
        retrace++;
        j.advanceRetrace();
      }
      events++;
      assert.ok(j.inputs.length - count <= 1, "missed jungle input boundary");
      if (j.presentations !== presentation) {
        assert.equal(
          j.presentations,
          presentation + 1,
          "skipped jungle presentation",
        );
        assert.equal(j.current.length, 256000);
        presentation++;
      }
      if (j.inputs.length > count) {
        assert.notEqual(byte, undefined, "unfinished jungle input stream");
        assert.equal(j.inputs.at(-1).input, omitFire ? byte & 63 : byte);
        const expected = checkpoints[executed];
        if (expected?.inputCount === j.inputs.length) {
          const current = j.current ? Uint8Array.from(j.current) : null;
          if (alterPixel && current) current[0] ^= 1;
          assert.deepEqual(
            {
              inputCount: j.inputs.length,
              ...j.snapshot(),
              memorySha256: hash(j.memory.bytes),
              pixelSha256: current ? hash(current) : null,
            },
            expected,
            `jungle replay checkpoint${executed}`,
          );
          executed++;
        }
      }
    }
    assert.equal(executed, 20, "unfinished jungle checkpoints");
    assert.equal(events, 6405, "jungle clock event count");
    assert.equal(presentation, 875, "jungle presentation count");
    assert.equal(
      j.inputs.length,
      stream.length,
      "unconsumed jungle input event",
    );
    assert.deepEqual(j.snapshot(), manifest.final, "jungle replay final");
  }
  replay();
  assert.throws(() => replay({ omitFire: true }), /jungle replay checkpoint/);
  assert.throws(
    () => replay({ omitInput: true }),
    /unfinished jungle input stream/,
  );
  assert.throws(
    () => replay({ omitCheckpoint: true }),
    /missing jungle checkpoint/,
  );
  assert.throws(
    () => replay({ extraInput: true }),
    /unconsumed jungle input event/,
  );
  assert.throws(() => replay({ alterPixel: true }), /jungle replay checkpoint/);
  console.log(
    "Jungle runtime:conditional loader arrays/tuples/descriptors and one exact original whole-frame DS comparison;20 independent carried checkpoints,824 inputs,6405 clock events,875 presentations,failure after scroll960;8 negative controls. Independent expected values are port regressions,not original full-level captures.",
  );
}
