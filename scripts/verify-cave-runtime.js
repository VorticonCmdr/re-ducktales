import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import { Cave } from "../src/game/cave.js";
import { FlightMemory } from "../src/game/flight-physics.js";
import { CAVE_SPRITES } from "../src/game/cave-scene.js";
import { renderFlightPixels } from "../src/game/flight-raster.js";
class ObservedCave extends Cave {
  party(commands, options) {
    if (
      this.phase === "exploring" &&
      this.inputs.length === 1 &&
      !this.firstInput
    )
      this.firstInput = this.memory.bytes.slice();
    return super.party(commands, options);
  }
  moveEnemy() {
    const captured = super.moveEnemy();
    if (captured)
      this.terminal = {
        bytes: this.memory.bytes.slice(),
        inputs: this.inputs.length,
        idle: this.idleCount,
        progress: this.progress,
        previous: this.previousEnemy,
      };
    return captured;
  }
  *present(commands) {
    yield* super.present(commands);
    if (
      this.phase === "exploring" &&
      this.inputs.length === 1 &&
      !this.firstDecision
    ) {
      this.firstDecision = this.memory.bytes.slice();
      this.firstDecisionInputCount = this.inputs.length;
    }
    if (this.phase === "captured") {
      (this.captureFrames ??= []).push(commands);
      this.animated = this.memory.bytes.slice();
    }
  }
}
function snapshot(raw, ip, code = false) {
  assert.equal(raw.isError, false);
  const r = JSON.parse(raw.content[0].text);
  assert.equal(r.aborted, false);
  assert.equal(r.results.length, code ? 3 : 2);
  assert.ok(r.results.every((x) => x.status === "ok"));
  const cpu = r.results[0].registers;
  assert.deepEqual(
    [cpu.cs, cpu.eip, cpu.ds, cpu.ss],
    [ip === 0x4e7 ? 0x1f5 : 0xe0c, ip, 0x1403, 0x1403],
  );
  const bytes = Buffer.from(r.results[1].data, "base64");
  assert.equal(bytes.length, 65536);
  if (code) {
    assert.equal(
      Buffer.from(r.results[2].data, "base64").subarray(0, 16).toString("hex"),
      "558becb886009a9e1e030656c646f200",
    );
    assert.equal(bytes.readUInt16LE(cpu.esp + 4), 0);
  }
  return { cpu, m: new FlightMemory(bytes) };
}
const core = [
  [0x2229, 2],
  [0x4d32, 2],
  [0x97b0, 2],
  [0x6810, 2],
  [0x5a42, 128],
  [0x8b54, 1],
  [0x6d44, 1],
  [0x5c74, 1],
  [0x4e08, 2],
  [0x54ac, 2],
  [0x8b3e, 2],
  [0x4e28, 2],
  [0x546a, 1],
  [0x8cc0, 4],
  [0x5d2b, 1],
  [0x8eb2, 2],
];
function compare(bytes, expected, ranges = core) {
  for (const [a, n] of ranges)
    assert.deepEqual(
      bytes.slice(a, a + n),
      expected.bytes.slice(a, a + n),
      `cave runtime divergence at DS:${a.toString(16)}`,
    );
}
function create(resources, raw, currentDrive = 2) {
  const { m } = snapshot(raw, 0, true);
  return new ObservedCave(
    {
      ...resources,
      currentDrive,
      variant: 0,
      difficulty: m.b(0x8990),
      seed: m.view.getUint16(0x2229, true),
      money: m.view.getUint32(0x8cc0, true),
    },
    m,
  );
}
function execute(cave) {
  for (let i = 0; i < 10000 && !cave.outcome; i++) {
    cave.advanceTick();
    cave.advanceRetrace();
  }
  assert.ok(cave.outcome, "unfinished original cave scenario");
  assert.ok(
    cave.inputs.every((e) => e.code === 0),
    "unexpected cave input or device event",
  );
  return cave;
}
function checkCapture(
  resources,
  local,
  { drive = 2, alterSeed = false, omitSprite = false } = {},
) {
  const terminal = snapshot(local.captureTerminal, 0x832),
    animated = snapshot(local.captureAnimated, 0x1221),
    returned = snapshot(local.captureReturn, 0x4e7),
    c = execute(create(resources, local.captureEntry, drive));
  assert.equal(terminal.m.i(terminal.cpu.ebp - 0x7c), -3);
  assert.equal(c.terminal.inputs, 197, "unexpected original idle input count");
  assert.equal(c.inputs.length, 197, "unexpected post-terminal input");
  assert.equal(c.terminal.idle, terminal.m.i(terminal.cpu.ebp - 6));
  assert.equal(c.terminal.progress, terminal.m.i(terminal.cpu.ebp - 0x76));
  assert.equal(c.terminal.previous, terminal.m.i(terminal.cpu.ebp - 0x80));
  if (alterSeed) c.terminal.bytes[0x2229] ^= 1;
  const descriptors = [
    17, 18, 19, 20, 21, 14, 22, 23, 26, 37, 38, 39, 40, 41, 42, 43,
  ];
  const ranges = [
    ...core,
    ...descriptors.flatMap((id) => {
      const a = CAVE_SPRITES.get(id);
      return [
        [a, 12],
        [a + 18, 1],
      ];
    }),
  ];
  compare(c.terminal.bytes, terminal.m, ranges);
  assert.equal(c.captureFrames.length, 18, "skipped capture presentation");
  compare(c.animated, animated.m, [
    ...ranges,
    ...[29, 30, 46].flatMap((id) => {
      const a = CAVE_SPRITES.get(id);
      return [
        [a, 12],
        [a + 18, 1],
      ];
    }),
  ]);
  assert.equal(c.outcome.code, returned.cpu.eax & 65535);
  compare(c.memory.bytes, returned.m, core);
  // The native capture at1221 contains the completed loop14 page: BIOS page
  // selection for loop15 has happened, but the cached VGA image is one refresh
  // behind. This fixed alignment is build/stop-specific, never searched/fitted.
  const commands = omitSprite
    ? c.captureFrames[16].filter((x) => x.op !== "sprite")
    : c.captureFrames[16];
  const pixels = renderFlightPixels(
    commands,
    resources.entries,
    resources.font,
    "EXP.ARC",
  );
  const png = PNG.sync.read(local.capturePng);
  assert.deepEqual([png.width, png.height], [320, 200]);
  assert.deepEqual(
    Buffer.from(pixels),
    png.data,
    "capture loop14 pixel divergence",
  );
  return 4;
}
function checkIdle(resources, local) {
  const c = create(resources, local.idleEntry);
  for (let i = 0; i < 30 && !c.firstDecision; i++) {
    c.advanceTick();
    c.advanceRetrace();
  }
  assert.equal(c.firstDecisionInputCount, 1);
  assert.equal(c.inputs[0].code, 0);
  compare(c.firstInput, snapshot(local.idleFirstInput, 0x9a1).m);
  compare(c.firstDecision, snapshot(local.idleFirstDecision, 0xb9c).m);
  return 2;
}
export async function verifyCaveRuntime(resources) {
  const manifest = JSON.parse(
    await readFile("reference/cave-runtime.json", "utf8"),
  );
  assert.equal(manifest.expectedCheckpointCount, 6);
  assert.equal(manifest.expectedInputCount, 198);
  const local = {};
  for (const [key, f] of Object.entries(manifest.artifacts)) {
    const b = await readFile(f.path).catch(() => {
      throw Error(`SETUP: missing ${f.path}; see docs/cave.md`);
    });
    assert.equal(
      createHash("sha256").update(b).digest("hex"),
      f.sha256,
      `corrupt ${f.path}`,
    );
    local[key] = key === "capturePng" ? b : JSON.parse(b);
  }
  assert.deepEqual(
    Object.keys(local).sort(),
    [
      "captureEntry",
      "captureTerminal",
      "captureAnimated",
      "captureReturn",
      "capturePng",
      "idleEntry",
      "idleFirstInput",
      "idleFirstDecision",
    ].sort(),
  );
  assert.equal(
    checkCapture(resources, local) + checkIdle(resources, local),
    manifest.expectedCheckpointCount,
  );
  assert.throws(() => checkCapture(resources, local, { drive: 0 }));
  assert.throws(
    () => checkCapture(resources, local, { alterSeed: true }),
    /cave runtime divergence/,
  );
  assert.throws(
    () => checkCapture(resources, local, { omitSprite: true }),
    /pixel divergence/,
  );
  assert.throws(() =>
    checkIdle(resources, { ...local, idleFirstDecision: null }),
  );
  console.log(
    "Cave runtime: 6 conditional original checkpoints (197-input idle-to-capture segment, animation, return, exact loop14 PNG; second-entry idle boundaries); 4 negative controls. Drive C; audio/timing exclusions are explicit.",
  );
}
