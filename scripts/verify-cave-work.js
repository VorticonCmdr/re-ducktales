// Conditional native input-return -> next-deadline drawing segment, not a
// native whole-level timing replay. Expected clocks never enter game logic.
import assert from "node:assert/strict";
import { readFileSync as read } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { parseArchive } from "../src/assets.js";
import { FlightMemory } from "../src/game/flight-physics.js";
import {
  drawCaveParty,
  caveRandom,
  CAVE_SPRITES,
} from "../src/game/cave-scene.js";
import { cavePartyWork, caveSpriteWork } from "../src/game/cave-work.js";
import {
  egaCopyWork,
  normalCoreGraphicsMilliseconds,
} from "../src/game/ega-work.js";
import { DRIVER_HZ } from "../src/game/timing.js";
const sha = (b) => createHash("sha256").update(b).digest("hex");
const manifest = JSON.parse(read("reference/cave-draw-work.json"));
function checked(path, hash) {
  let bytes;
  try {
    bytes = read(path);
  } catch {
    throw Error(`SETUP: missing ${path}; see docs/cave-timing.md`);
  }
  assert.equal(sha(bytes), hash, `Corrupt or changed ${path}`);
  return bytes;
}
assert.equal(manifest.expectedCaseCount, 1);
assert.equal(manifest.expectedSpriteCalls, 7);
assert.equal(manifest.acceptanceLevel, "conditional-native-drawing-work");
assert.deepEqual(manifest.injections, []);
assert.deepEqual(manifest.fittedInputs, []);
for (const [path, hash] of Object.entries(manifest.sources))
  checked(path, hash);
const parent = JSON.parse(
  checked(manifest.parent.path, manifest.parent.sha256),
);
assert.equal(parent.configuration.cpu_cycles, 3000);
assert.equal(parent.configuration.core, "normal");
for (const cmd of [
  ["scripts/verify-ega-work.js"],
  ["scripts/verify-cave-input.js"],
])
  execFileSync(process.execPath, cmd, { stdio: "inherit" });
const build = JSON.parse(
  checked("reference/build.json", manifest.buildManifestSha256),
);
const exe = checked("game/DUCKTALE.EXE", build.files["DUCKTALE.EXE"].sha256);
const entries = parseArchive(
  checked("game/EXP.ARC", build.files["EXP.ARC"].sha256),
);
function result(role) {
  const a = parent.artifacts[role],
    e = JSON.parse(checked(a.path, a.sha256));
  assert.equal(e.isError, false);
  const r = JSON.parse(e.content[0].text);
  assert.equal(r.aborted, false);
  assert.ok(r.results.every((v) => v.status === "ok"));
  return r.results;
}
const before = result("pauseReturn"),
  after = result("deadlineEntry"),
  first = result("first");
assert.deepEqual(
  [before[0].registers.cs, before[0].registers.eip, before[0].registers.ds],
  [0xe0c, 0x9a6, 0x1403],
);
assert.deepEqual(
  [after[0].registers.cs, after[0].registers.eip, after[0].registers.ds],
  [0xb83, 0x1d8, 0x1403],
);
assert.equal(before[0].registers.eax & 255, 0);
const a = Buffer.from(before[1].data, "base64"),
  b = Buffer.from(after[1].data, "base64");
assert.equal(a.length, 65536);
assert.equal(b.length, 65536);
const body = Buffer.from(
  Buffer.from(first[2].data, "base64").subarray(0, 11054),
);
assert.equal(
  body.subarray(0xa84, 0xa90).toString("hex"),
  "2bc050b8110050b8de79500e",
);
assert.equal(
  0xa93 + body.readInt16LE(0xa91),
  0x20b8,
  "original neutral party call target",
);
assert.equal(body.subarray(0x20be, 0x20c3).toString("hex"), "9a9e1e0306");
const table = 0x1a800 + exe.readUInt16LE(0x1a800 + 24);
for (let i = 0; i < 196; i++) {
  const p = table + i * 4,
    o = exe.readUInt16LE(p) + (exe.readUInt16LE(p + 2) - 0xc17) * 16;
  body.writeUInt16LE((body.readUInt16LE(o) + 0x1000 - 0x1f5) & 65535, o);
}
// Analysis-only SUB SP,12 + NOP replaces the exact original stack-probe CALL.
// Every byte, including that explicitly reconstructed normalization, compares.
body.set(Buffer.from("81ec0c0090", "hex"), 0x20be);
function artifact(name) {
  const spec = manifest.artifacts[name],
    e = JSON.parse(checked(spec.path, spec.sha256));
  assert.equal(e.isError, false);
  return JSON.parse(e.content[0].text);
}
const listing = artifact("party-instructions"),
  fn = artifact("party-function");
assert.equal(listing.program, "CAVE_CODE.EXE");
assert.equal(listing.truncated, false);
assert.equal(listing.instructions.length, 246);
assert.equal(fn.language_id, "x86:LE:16:Real Mode");
assert.equal(fn.entry_point, "1e22:0008");
assert.equal(fn.size, 728);
function code(instructions) {
  let expected = 0x20b8;
  for (const i of instructions) {
    const [s, o] = i.address.split(":").map((v) => parseInt(v, 16));
    const at = s * 16 + o - 0x1c170;
    assert.equal(at, expected, "Missing cave source byte range");
    assert.equal(
      body.subarray(at, at + i.length).toString("hex"),
      i.bytes,
      `Cave source byte mismatch ${i.address}`,
    );
    expected += i.length;
  }
  assert.equal(expected, 0x2390);
}
code(listing.instructions);
const wrongCode = structuredClone(listing.instructions);
wrongCode[5].bytes = "57";
assert.throws(() => code(wrongCode), /Cave source byte mismatch/);
const m = new FlightMemory(a),
  word = (p) => m.view.getUint16(p, true),
  video = word(0x2038),
  room = word(0x203a);
assert.deepEqual(
  [word(0x1fec), word(0x1ff0), word(0x1fee), word(0x1ff2)],
  [0x1ef, 0x35d, 0x2ed7, 0x2ed7],
);
for (const p of [video, room])
  assert.deepEqual([word(p), word(p + 2), word(p + 8)], [40, 200, 8000]);
assert.ok([0xa000, 0xa200].includes(word(video + 6)));
const commands = drawCaveParty(m, []);
assert.deepEqual(
  commands.filter((c) => c.op === "sprite").map((c) => c.asset),
  [17, 14, 26, 22, 23, 37],
);
assert.equal(a[before[0].registers.ebp - 8], 0, "original idle-pose latch");
const idleRoll = caveRandom(m) & 255;
assert.equal(idleRoll, 245);
assert.ok(idleRoll > 230);
const idleAsset = 38 + (caveRandom(m) % 5);
assert.equal(idleAsset, 38);
const ptr = CAVE_SPRITES.get(idleAsset),
  idle = {
    op: "sprite",
    asset: idleAsset,
    x: m.i(ptr),
    y: m.i(ptr + 2),
    frame: m.b(ptr + 18),
  };
assert.equal(
  m.view.getUint16(0x2229, true),
  b.readUInt16LE(0x2229),
  "native caller RNG",
);
for (const p of new Set(CAVE_SPRITES.values()))
  assert.deepEqual(
    Buffer.from(m.bytes.subarray(p, p + 20)),
    b.subarray(p, p + 20),
    `native cave descriptor ${p.toString(16)}`,
  );
for (const p of [0x6d44, 0x5c74])
  assert.equal(m.b(p), b[p], "native torch state");
const party = cavePartyWork(entries, commands),
  extra = caveSpriteWork(entries, idle);
assert.deepEqual(party, manifest.expectedPartyWork, "Cave party work counts");
assert.deepEqual(extra, manifest.expectedIdleWork, "Cave idle work counts");
const combined = {
  instructions: party.instructions + extra.instructions,
  portWrites: party.portWrites + extra.portWrites,
  repeatOpcodes: party.repeatOpcodes,
  repeatIterations: party.repeatIterations,
};
function budget(work, delta = 10) {
  assert.equal(
    delta,
    manifest.observedDriverCounts,
    "Changed native cave counter",
  );
  const ms = normalCoreGraphicsMilliseconds(work, 3000),
    period = 1000 / DRIVER_HZ;
  assert.ok(
    ms >= (delta - 1) * period && ms <= (delta + 1) * period,
    `Cave native drawing budget: ${ms} ms versus ${delta} counts`,
  );
  return ms;
}
const delta = b.readUInt32LE(0x2225) - a.readUInt32LE(0x2225),
  milliseconds = budget(combined, delta);
assert.throws(
  () =>
    assert.deepEqual(
      cavePartyWork(
        entries,
        commands.filter((c) => c.asset !== 37),
      ),
      manifest.expectedPartyWork,
      "Cave party work counts",
    ),
  /Cave party work counts/,
);
const copy = egaCopyWork({
  width: 320,
  height: 200,
  sourceX: 0,
  sourceY: 0,
  destinationX: 0,
  destinationY: 0,
  sourceStrideBytes: 40,
  destinationStrideBytes: 40,
  sourceVideo: false,
  destinationVideo: true,
});
const missingCopy = { ...combined };
for (const key of Object.keys(combined)) missingCopy[key] -= copy[key] ?? 0;
assert.throws(() => budget(missingCopy), /Cave native drawing budget/);
assert.throws(
  () => budget({ instructions: 1, portWrites: 0 }),
  /Cave native drawing budget/,
);
assert.throws(() => budget(combined, 11), /Changed native cave counter/);
console.log(
  `Cave work: one conditional native segment,7 source sprite calls plus one320x200 RAM restore;${milliseconds.toFixed(3)}ms partial work versus${delta} original driver counts;728 helper bytes linked through exact relocations/declared analysis prologue;42 complete descriptors and RNG match;5 negative controls. Fill/other CPU costs and native uninterrupted cadence remain unverified.`,
);
