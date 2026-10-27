import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { FlightMemory } from "../src/game/flight-physics.js";
import { Jungle } from "../src/game/jungle.js";
import { collideJungleTransport } from "../src/game/jungle-hazards.js";
import { jungleActorCenter } from "../src/game/jungle-collision.js";
import { restoreJunglePalette } from "../src/game/jungle-state.js";

const hash = (b) => createHash("sha256").update(b).digest("hex");
function exact(actual, expected, label) {
  assert.equal(actual.length, expected.length, label);
  for (let i = 0; i < actual.length; i++)
    if (actual[i] !== expected[i])
      assert.fail(
        `${label}:byte ${i.toString(16)},actual ${actual[i]},expected ${expected[i]}`,
      );
}
export async function verifyJungleTreasure(resources) {
  const manifest = JSON.parse(
    await readFile("reference/jungle-treasure.json", "utf8"),
  );
  assert.deepEqual(
    [
      manifest.expectedOriginalContactCount,
      manifest.expectedOriginalReturnCount,
      manifest.expectedReplayCheckpointCount,
      manifest.expectedInputCount,
      manifest.expectedClockEventCount,
      manifest.expectedPresentationCount,
    ],
    [1, 1, 20, 792, 6026, 839],
  );
  assert.deepEqual(
    manifest.checkpointIds,
    [
      1, 3, 5, 16, 19, 24, 36, 44, 80, 120, 200, 300, 400, 500, 600, 700, 766,
      775, 787, 792,
    ],
  );
  assert.deepEqual(manifest.initial, {
    variant: 0,
    difficulty: 0,
    seed: 11324,
    money: 0,
    day: 4,
    audioEnabled: false,
  });
  assert.deepEqual(manifest.inputEvents, [
    { byte: 0, count: 2 },
    { byte: 64, count: 1 },
    { byte: 0, count: 15 },
    { byte: 3, count: 18 },
    { byte: 0, count: 8 },
    { byte: 5, count: 722 },
    { byte: 1, count: 5 },
    { byte: 5, count: 2 },
    { byte: 1, count: 17 },
    { byte: 3, count: 2 },
  ]);
  assert.deepEqual(manifest.contactStackExclusion, [0x9e44, 0x9e6c]);
  assert.deepEqual(manifest.fittedInputs, []);
  assert.deepEqual(manifest.originalInputEvents, [
    { kind: "goal-id", value: 1, source: "incoming SS:SP+4 at13c9:00cb" },
  ]);
  assert.deepEqual(manifest.setupWrites, [
    { offset: 0x5f46, before: 8, after: 1124 },
    { offset: 0x6858, before: 16, after: 80 },
    { offset: 0x5ed2, before: 0, after: 960 },
    { offset: 0x78e8, before: 0, after: 3 },
  ]);
  assert.deepEqual(manifest.clockProvider, {
    driverNumerator: 1193182,
    driverDivisors: [1365, 12],
    retraceHz: 70.086,
    tieOrder: "driver-first",
  });
  const local = {};
  for (const [key, a] of Object.entries(manifest.artifacts)) {
    const raw = await readFile(a.path).catch(() => {
      throw Error(`SETUP:missing ${a.path};see docs/jungle.md`);
    });
    assert.equal(hash(raw), a.sha256, `corrupt ${a.path}`);
    const envelope = JSON.parse(raw);
    assert.equal(envelope.isError, false);
    const result = JSON.parse(envelope.content[0].text);
    assert.equal(result.aborted, false);
    assert.ok(result.results.every((x) => x.status === "ok"));
    local[key] = {
      cpu: result.results[0].registers,
      bytes: Buffer.from(result.results[1].data, "base64"),
      results: result.results,
    };
    assert.equal(local[key].bytes.length, 65536);
  }
  assert.deepEqual(Object.keys(local).sort(), [
    "contact-after",
    "contact-before",
    "return",
    "setup-after",
    "setup-before",
  ]);
  for (const [key, cs, ip] of [
    ["setup-before", 0xe0c, 0x651],
    ["setup-after", 0xe0c, 0x651],
    ["contact-before", 0x13c9, 0xcb],
    ["contact-after", 0x13c9, 0x14f],
    ["return", 0xe0c, 0x4b0],
  ]) {
    const cpu = local[key].cpu;
    assert.deepEqual(
      [cpu.cs, cpu.eip, cpu.ds, cpu.ss],
      [cs, ip, 0x1403, 0x1403],
    );
  }
  const exe = resources.executableRaw,
    body = Buffer.from(exe.subarray(0x1fa00 + 2048, 0x1fa00 + 26104)),
    table = exe.readUInt16LE(0x1fa00 + 24);
  assert.equal(exe.readUInt16LE(0x1fa00 + 6), 436);
  for (let i = 0; i < 436; i++) {
    const at = 0x1fa00 + table + i * 4,
      offset = exe.readUInt16LE(at) + (exe.readUInt16LE(at + 2) - 0xc17) * 16;
    assert.ok(offset >= 0 && offset + 2 <= body.length);
    body.writeUInt16LE((body.readUInt16LE(offset) + 0x1f5) & 65535, offset);
  }
  assert.equal(local["setup-before"].results.length, 3);
  exact(
    Buffer.from(local["setup-before"].results[2].data, "base64"),
    body,
    "treasure overlay identity",
  );
  function setup(omitWrite = false) {
    const expected = Buffer.from(local["setup-before"].bytes);
    for (const [step, write] of manifest.setupWrites.entries()) {
      assert.equal(expected.readInt16LE(write.offset), write.before);
      if (!(omitWrite && step === 0))
        expected.writeInt16LE(write.after, write.offset);
    }
    exact(expected, local["setup-after"].bytes, "conditional treasure setup");
    assert.deepEqual(local["setup-before"].cpu, local["setup-after"].cpu);
  }
  setup();
  assert.throws(() => setup(true), /conditional treasure setup/);
  function contact({
    omitGoal = false,
    wrongArgument = false,
    alterRng = false,
  } = {}) {
    const before = local["contact-before"],
      after = local["contact-after"],
      m = new FlightMemory(before.bytes);
    assert.equal(before.cpu.esp, 0x9e6c);
    assert.equal(after.cpu.esp, before.cpu.esp);
    assert.equal(m.i(before.cpu.esp + 4), 1);
    assert.equal(m.i(0x1aac), 0);
    assert.deepEqual([jungleActorCenter(m), m.i(0x6858) + 16], [1128, 96]);
    const goal = 0x776e + 10;
    assert.deepEqual(
      [m.i(goal + 4), m.i(goal + 6), m.i(goal + 4) + 48, m.i(goal + 6) + 30],
      [1125, 85, 1173, 115],
    );
    if (!omitGoal)
      collideJungleTransport(
        m,
        wrongArgument ? 2 : manifest.originalInputEvents[0].value,
      );
    if (alterRng) m.i(0x2229, m.i(0x2229) ^ 1);
    const [lo, hi] = manifest.contactStackExclusion;
    exact(
      m.bytes.subarray(0, lo),
      after.bytes.subarray(0, lo),
      "treasure contact DS divergence",
    );
    exact(
      m.bytes.subarray(hi),
      after.bytes.subarray(hi),
      "treasure contact DS divergence",
    );
    assert.equal(m.i(0x1aac), 1);
    assert.equal(after.cpu.eax & 65535, 1);
  }
  contact();
  assert.throws(
    () => contact({ omitGoal: true }),
    /treasure contact DS divergence/,
  );
  assert.throws(
    () => contact({ wrongArgument: true }),
    /treasure contact DS divergence/,
  );
  assert.throws(
    () => contact({ alterRng: true }),
    /treasure contact DS divergence/,
  );
  function returned(omitPalette = false) {
    const raw = local.return,
      m = new FlightMemory(local["contact-after"].bytes),
      expected = Uint8Array.from(m.bytes);
    assert.equal(raw.cpu.eax & 65535, 1);
    assert.equal(raw.bytes.readInt16LE(0x1aac), 1);
    assert.equal(raw.bytes.readUInt32LE(0x8cc0), 94);
    assert.equal(raw.bytes[0x4e0e], 24);
    assert.equal(m.b(0x2042), 0);
    assert.deepEqual([raw.bytes[0x205b], raw.bytes[0x2063]], [0x85, 0x8d]);
    expected[0x205b] = 0x85;
    expected[0x2063] = 0x8d;
    if (!omitPalette) restoreJunglePalette(m);
    exact(m.bytes, expected, "treasure palette mutation scope");
    exact(
      m.bytes.subarray(0x2056, 0x2067),
      raw.bytes.subarray(0x2056, 0x2067),
      "treasure return palette",
    );
  }
  returned();
  assert.throws(() => returned(true), /treasure palette mutation scope/);
  function replay({
    omitClimb = false,
    alterPixel = false,
    omitCheckpoint = false,
    extraInput = false,
  } = {}) {
    const stream = manifest.inputEvents.flatMap((e) =>
      Array(e.count).fill(e.byte),
    );
    assert.equal(stream.length, 792);
    if (extraInput) stream.push(0);
    const checks = structuredClone(manifest.checkpoints);
    if (omitCheckpoint) checks.pop();
    assert.equal(checks.length, 20, "missing treasure checkpoint");
    assert.deepEqual(
      checks.map((c) => c.inputCount),
      manifest.checkpointIds,
    );
    const j = new Jungle({ ...resources, ...manifest.initial });
    let driver = 0,
      retrace = 0,
      events = 0,
      executed = 0,
      presentation = 0;
    while (!j.outcome && events < 10000) {
      const n = j.inputs.length,
        byte = stream[n],
        input = omitClimb && byte === 1 ? 0 : byte;
      if (input !== undefined)
        j.setControls({
          direction:
            { 1: "up", 3: "right", 5: "down", 7: "left" }[input & 63] ?? null,
          fire: !!(input & 64),
        });
      if ((driver + 1) / (1193182 / (1365 * 12)) <= (retrace + 1) / 70.086) {
        driver++;
        j.advanceTick();
      } else {
        retrace++;
        j.advanceRetrace();
      }
      events++;
      assert.ok(j.inputs.length - n <= 1, "missed treasure input boundary");
      if (j.presentations !== presentation) {
        assert.equal(
          j.presentations,
          presentation + 1,
          "skipped treasure presentation",
        );
        assert.equal(j.current.length, 256000);
        presentation++;
      }
      if (j.inputs.length > n) {
        assert.notEqual(input, undefined, "unfinished treasure input stream");
        assert.equal(j.inputs.at(-1).input, input);
        const expected = checks[executed];
        if (expected?.inputCount === j.inputs.length) {
          const pixels = Uint8Array.from(j.current);
          if (alterPixel) pixels[0] ^= 1;
          assert.deepEqual(
            {
              inputCount: j.inputs.length,
              state: j.snapshot(),
              memorySha256: hash(j.memory.bytes),
              pixelSha256: hash(pixels),
            },
            expected,
            `treasure checkpoint${executed}`,
          );
          executed++;
        }
      }
    }
    assert.equal(executed, 20, "unfinished treasure checkpoints");
    assert.equal(events, 6026, "treasure clock count");
    assert.equal(presentation, 839, "treasure display count");
    assert.equal(j.inputs.length, stream.length, "unconsumed treasure input");
    assert.deepEqual(j.snapshot(), manifest.final, "treasure final");
    assert.equal(
      hash(j.memory.bytes),
      manifest.finalMemorySha256,
      "treasure final DS",
    );
    assert.equal(j.outcome.code, 1);
  }
  replay();
  assert.throws(() => replay({ omitClimb: true }), /treasure checkpoint/);
  assert.throws(() => replay({ alterPixel: true }), /treasure checkpoint/);
  assert.throws(
    () => replay({ omitCheckpoint: true }),
    /missing treasure checkpoint/,
  );
  assert.throws(
    () => replay({ extraInput: true }),
    /unconsumed treasure input/,
  );
  console.log(
    "Jungle treasure:one exact conditional original chest-contact DS case and return/palette contract;20 independent carried checkpoints,792 inputs,6026 clock events,839 display updates,success with one life;9 negative controls. Whole original level/timing and other variants remain unverified.",
  );
}
