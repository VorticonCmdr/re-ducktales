// Conditional native segments and static work counts; never timing acceptance.
import assert from "node:assert/strict";
import { readFileSync as read } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { parseArchive } from "../src/assets.js";
import {
  egaSpriteWork,
  egaCopyWork,
  normalCoreGraphicsMilliseconds,
  normalCoreSpriteMilliseconds,
} from "../src/game/ega-work.js";
import { FlightMemory } from "../src/game/flight-physics.js";
import { advanceMountainHazards } from "../src/game/mountain-hazards.js";
const sha = (b) => createHash("sha256").update(b).digest("hex");
const m = JSON.parse(read("reference/mountain-draw-work.json"));
execFileSync(
  process.execPath,
  [
    "scripts/verify-mountain-frame-profile.js",
    "--manifest=reference/mountain-draw-work.json",
  ],
  { stdio: "inherit" },
);
assert.equal(sha(read("src/game/ega-work.js")), m.workModuleSha256);
assert.equal(sha(read("scripts/verify-ega-work.js")), m.workVerifierSha256);
const json = (name) => JSON.parse(read(m.artifacts[name].path));
const disassembly = json("sprite-disassembly");
assert.equal(disassembly.success, true);
assert.equal(disassembly.truncated, false);
assert.equal(disassembly.program, "ducktales-ega-driver.bin");
const driver = parseArchive(read("game/IT.DRV"))[1].data;
const copyDisassembly = json("copy-disassembly");
assert.equal(copyDisassembly.success, true);
assert.equal(copyDisassembly.truncated, false);
function verifyCopyBytes(instructions) {
  for (const i of instructions) {
    const ip = parseInt(i.address.split(":").pop(), 16);
    assert.equal(
      Buffer.from(driver.subarray(ip, ip + i.length)).toString("hex"),
      i.bytes,
    );
  }
}
verifyCopyBytes(copyDisassembly.instructions);
const wrongRep = structuredClone(copyDisassembly.instructions);
wrongRep.find((i) => i.address === "0000:0313").bytes = "f3a4";
assert.throws(() => verifyCopyBytes(wrongRep), assert.AssertionError);
for (const [lo, hi, n] of [
  [0x1ef, 0x207, 13],
  [0x216, 0x23b, 11],
  [0x23d, 0x246, 5],
  [0x24e, 0x261, 10],
  [0x264, 0x281, 11],
  [0x28b, 0x2b3, 14],
  [0x2bd, 0x2ce, 8],
  [0x321, 0x335, 9],
  [0x337, 0x33d, 4],
  [0x34d, 0x352, 3],
])
  assert.equal(
    copyDisassembly.instructions.filter((i) => {
      const p = parseInt(i.address.split(":").pop(), 16);
      return p >= lo && p <= hi;
    }).length,
    n,
  );
const ins = disassembly.instructions.map((i) => ({
  ...i,
  ip: parseInt(i.address.split(":").pop(), 16),
}));
for (const i of ins)
  assert.equal(
    Buffer.from(driver.subarray(i.ip, i.ip + i.length)).toString("hex"),
    i.bytes,
  );
const count = (lo, hi) => ins.filter((i) => i.ip >= lo && i.ip <= hi).length;
// Validate the model's counted basic blocks against Ghidra and original bytes.
for (const [lo, hi, n] of [
  [0x35d, 0x3c8, 43],
  [0x3d2, 0x3f8, 16],
  [0x40b, 0x413, 5],
  [0x434, 0x455, 17],
  [0x459, 0x45d, 2],
  [0x45f, 0x471, 8],
  [0x473, 0x47b, 4],
  [0x47d, 0x4a3, 20],
  [0x4aa, 0x4b7, 7],
  [0x4c0, 0x4ca, 7],
  [0x4cc, 0x4d6, 6],
  [0x4dd, 0x4e7, 6],
  [0x4ec, 0x4f6, 5],
  [0x4f7, 0x507, 6],
  [0x50c, 0x512, 6],
])
  assert.equal(count(lo, hi), n, lo.toString(16));
const main = parseArchive(read("game/MAIN.ARC")),
  mt = parseArchive(read("game/MT.ARC"));
const ids = new Map(
  [5, 6, 7, 8, 9, 10, 11, 13, 14, 15].map((id, i) => [0x5804 + i * 20, id]),
);
const data = (role) => {
  const x = json(role);
  return {
    bytes: Buffer.from(x.state.results[1].data, "base64"),
    cpu: x.state.results[0].registers,
  };
};
function compareHazards(actual, expected, addresses) {
  for (const at of addresses)
    assert.equal(actual[at], expected[at], `Hazard DS:${at.toString(16)}`);
}
const profile = json("profile"),
  results = [];
let primitiveCalls = 0;
let eraseCopies = 0;
const cases = [];
for (const row of profile.rows) {
  const prefix = `frame-${String(row.index).padStart(2, "0")}`;
  const erase = data(`${prefix}-before-erase`).bytes;
  const page = erase[0x370a];
  assert.ok(page === 0 || page === 1);
  const oldFrame = erase.readInt16LE(0x3734 + page * 2);
  assert.ok(
    ![21, 27].includes(oldFrame),
    "Captured scenario left ordinary actor erase path",
  );
  const x = Math.max(0, erase.readInt16LE(0x36ea + page * 2) - 8),
    y = erase.readInt16LE(0x36ee + page * 2);
  const rect = {
    width: Math.min(56, 320 - x),
    height: Math.min(40, 168 - y),
    sourceX: x,
    sourceY: y,
    destinationX: x,
    destinationY: y,
    sourceStrideBytes: 40,
    destinationStrideBytes: 40,
    sourceVideo: false,
    destinationVideo: true,
  };
  const eraseWork = egaCopyWork(rect);
  assert.deepEqual(eraseWork, {
    instructions: 1521,
    portWrites: 8,
    repeatOpcodes: 296,
    repeatIterations: 592,
  });
  eraseCopies++;
  const start = data(`${prefix}-after-money`),
    end = data(`${prefix}-after-hazards`);
  const memory = new FlightMemory(start.bytes),
    calls = [];
  const bp = start.cpu.ebp & 65535;
  advanceMountainHazards(
    memory,
    memory.b(bp - 0x34),
    0,
    (at) => {
      assert.ok(ids.has(at), `Unexpected hazard sprite ${at.toString(16)}`);
      const entry = mt[ids.get(at)];
      calls.push(
        egaSpriteWork(entry, memory.b(at + 18), memory.i(at), memory.i(at + 2)),
      );
    },
    () => {
      throw Error("Unsupported sound path in captured work scenario");
    },
    () => {
      throw Error("Unsupported HUD path in captured work scenario");
    },
  );
  assert.equal(calls.length, 5);
  const addresses = new Set();
  for (const [at, n] of [
    [0x5804, 200],
    [memory.i(0x5d26) & 65535, 150],
    [0x2229, 2],
    [0x88e4, 1],
    [0x5ae0, 2],
    [0x5c72, 2],
    [0x6882, 2],
    [0x6d3c, 2],
    [0x4cf2, 2],
  ])
    for (let j = 0; j < n; j++) addresses.add(at + j);
  compareHazards(memory.bytes, end.bytes, addresses);
  cases.push({ actual: memory.bytes, expected: end.bytes, addresses });
  const actor = data(`${prefix}-after-actor`).bytes,
    at = actor.readUInt16LE(0x6df0);
  assert.equal(at, 0x5c48);
  const actorWork = egaSpriteWork(
    mt[2],
    actor[at + 18],
    actor.readInt16LE(at),
    actor.readInt16LE(at + 2),
  );
  const footer = egaSpriteWork(main[23], 0, 40, 172);
  const st = Object.fromEntries(
    row.stages.map((s) => [s.name, s.picMilliseconds]),
  );
  const nativeFooter = st["after-footer"] - st["after-erase"];
  const nativeActor = st["after-actor"] - st["after-hazards"];
  // Lower bounds only. Cached endpoints can differ in phase by up to1ms.
  // Extra interrupt,debug-resume and hazard logic costs are not fitted away.
  assert.ok(nativeFooter + 1 >= footer.instructions / 3000);
  assert.ok(nativeActor + 1 >= actorWork.instructions / 3000);
  primitiveCalls += calls.length + 2;
  results.push({
    frame: row.index,
    footer: {
      predicted: normalCoreSpriteMilliseconds(footer, 3000),
      observed: nativeFooter,
    },
    actor: {
      predicted: normalCoreSpriteMilliseconds(actorWork, 3000),
      observed: nativeActor,
    },
    hazards: {
      spritePrediction: calls.reduce(
        (sum, w) => sum + normalCoreSpriteMilliseconds(w, 3000),
        0,
      ),
      observedWithLogic: st["after-hazards"] - st["after-money"],
    },
  });
}
assert.equal(results.length, 14);
assert.equal(primitiveCalls, 98);
assert.equal(eraseCopies, 14);
// Full320x168 restore uses the original contiguous REP path, not168 row loops.
const fullCopy = egaCopyWork({
  width: 320,
  height: 168,
  sourceX: 0,
  sourceY: 0,
  destinationX: 0,
  destinationY: 0,
  sourceStrideBytes: 40,
  destinationStrideBytes: 40,
  sourceVideo: false,
  destinationVideo: true,
});
assert.deepEqual(fullCopy, {
  instructions: 195,
  portWrites: 8,
  repeatOpcodes: 4,
  repeatIterations: 13440,
});
assert.equal(normalCoreGraphicsMilliseconds(fullCopy, 3000), 13647 / 3000);
const corrupted = Uint8Array.from(cases[0].actual);
corrupted[0x5804] ^= 1;
assert.throws(
  () => compareHazards(corrupted, cases[0].expected, cases[0].addresses),
  assert.AssertionError,
);
assert.throws(() => egaSpriteWork(mt[2], mt[2].frames, 0, 0), /Invalid/);
assert.throws(
  () => egaSpriteWork({ ...mt[2], data: mt[2].data.subarray(1) }, 0, 0, 0),
  /Unsupported/,
);
console.log(
  JSON.stringify(
    {
      scope:
        "Static primitive work plus14 conditional native hazard segments;lower bounds,not timing parity",
      primitiveCalls,
      eraseCopies,
      fullRestoreMilliseconds: normalCoreGraphicsMilliseconds(fullCopy, 3000),
      negativeControls: 4,
      first: results[0],
      last: results.at(-1),
      timingAcceptance: false,
    },
    null,
    2,
  ),
);
