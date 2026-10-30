// Original-source/primitive evidence. This is not browser or whole-cave timing acceptance.
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { FlightMemory } from "../src/game/flight-physics.js";
import { caveMinimap } from "../src/game/cave-scene.js";
import { egaDriverLineWork } from "../src/game/ega-line-work.js";
import { caveMinimapCalls, caveMinimapWork } from "./lib/cave-minimap-work.js";
const sha = (b) => createHash("sha256").update(b).digest("hex");
const m = JSON.parse(await readFile("reference/cave-minimap-work.json"));
assert.equal(m.id, "original-cave-minimap-call-work");
assert.equal(m.expectedSourceRanges, 4);
for (const [p, h] of Object.entries(m.sources))
  assert.equal(sha(await readFile(p)), h, "Changed minimap model source " + p);
const artifacts = {};
assert.deepEqual(Object.keys(m.artifacts).sort(), [
  "cache-function",
  "cache-listing",
  "dot-function",
  "dot-listing",
  "initial-caller",
  "marker-function",
  "marker-listing",
]);
for (const [role, s] of Object.entries(m.artifacts)) {
  const b = await readFile(s.path).catch(() => {
    throw Error("SETUP: missing minimap evidence " + s.path);
  });
  assert.equal(b.length, s.bytes);
  assert.equal(sha(b), s.sha256, "Corrupt minimap evidence");
  artifacts[role] = JSON.parse(b);
}
for (const fn of [
  artifacts["dot-function"],
  artifacts["cache-function"],
  artifacts["marker-function"].functions["1da0:056f"],
])
  assert.equal(fn.language_id, "x86:LE:16:Real Mode");
for (const s of m.parents)
  assert.equal(sha(await readFile(s.path)), s.sha256, "Changed minimap parent");
for (const name of [
  "verify-cave-input.js",
  "verify-ega-line-primitives.js",
  "verify-ega-signed-copies.js",
])
  process.stdout.write(
    execFileSync(process.execPath, ["scripts/" + name], {
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
    }),
  );
const parent = JSON.parse(await readFile("reference/cave-input.json"));
async function capture(role) {
  const e = JSON.parse(await readFile(parent.artifacts[role].path));
  assert.equal(e.isError, false);
  const r = JSON.parse(e.content[0].text);
  assert.equal(r.aborted, false);
  return r.results;
}
const first = await capture("first"),
  before = await capture("pauseReturn");
const nativeBody = Buffer.from(first[2].data, "base64").subarray(0, 11054);
const exe = await readFile("game/DUCKTALE.EXE"),
  body = Buffer.from(nativeBody);
assert.equal(sha(exe), m.executableSHA256, "Unsupported minimap executable");
const table = 0x1a800 + exe.readUInt16LE(0x1a800 + 24);
assert.equal(exe.readUInt16LE(0x1a806), 196);
for (let i = 0; i < 196; i++) {
  const p = table + i * 4,
    at = exe.readUInt16LE(p) + (exe.readUInt16LE(p + 2) - 0xc17) * 16;
  body.writeUInt16LE((body.readUInt16LE(at) + 0x1000 - 0x1f5) & 65535, at);
}
function listing(spec, bytes) {
  const r = artifacts[spec.role];
  assert.equal(r.program, "CAVE_CODE.EXE");
  assert.equal(r.success, true);
  assert.equal(r.truncated, false);
  let at = spec.start;
  for (const i of r.instructions) {
    const [s, o] = i.address.split(":").map((v) => parseInt(v, 16));
    const offset = s * 16 + o - 0x1c170;
    assert.equal(offset, at, "Missing original minimap instruction");
    assert.equal(
      bytes.subarray(at, at + i.length).toString("hex"),
      i.bytes,
      "Original minimap bytes",
    );
    at += i.length;
  }
  assert.equal(at, spec.end, "Unfinished minimap source range");
}
assert.equal(m.ranges.length, 4);
for (const s of m.ranges) {
  if (s.prologue) {
    assert.equal(
      nativeBody.subarray(s.start + 6, s.start + 11).toString("hex"),
      "9a9e1e0306",
      "Original stack probe",
    );
    body.set(Buffer.from(s.prologue, "hex"), s.start + 6);
  }
  listing(s, body);
}
const corrupt = Buffer.from(body);
corrupt[m.ranges[0].start] ^= 1;
assert.throws(() => listing(m.ranges[0], corrupt), /Original minimap bytes/);
const memory = new FlightMemory(Buffer.from(before[1].data, "base64"));
assert.deepEqual(
  [memory.i(0x1ff4), memory.i(0x1ff6)],
  [0x515, 0x2ed7],
  "Native point dispatch",
);
const line = JSON.parse(await readFile("reference/ega-line-runtime-work.json"));
const point = JSON.parse(await readFile(line.artifacts["case-00"].path));
const initial = caveMinimapCalls(memory, "initial"),
  party = caveMinimapCalls(memory, "party");
assert.deepEqual(
  initial.at(-1),
  {
    kind: "copy",
    width: 64,
    height: 63,
    sourceX: 112,
    sourceY: 137,
    destinationX: 0,
    destinationY: 0,
    sourceStrideBytes: 40,
    destinationStrideBytes: 8,
    sourceVideo: true,
    destinationVideo: false,
  },
  "Original cache descriptor and copy argument order",
);
function rasterPoints(commands) {
  return commands.flatMap((c) =>
    Array.from({ length: c.height }, (_, dy) =>
      Array.from({ length: c.width }, (_, dx) => ({
        kind: "point",
        x: c.x + dx,
        y: c.y + dy,
        color: c.color,
      })),
    ).flat(),
  );
}
assert.deepEqual(
  initial.filter((c) => c.kind === "point"),
  rasterPoints(caveMinimap(memory)),
  "Cached map renderer and original initial calls",
);
assert.equal(initial.filter((c) => c.kind === "point").length, 776);
assert.equal(party.length, 33);
for (const c of [...initial, ...party].filter((c) => c.kind === "point")) {
  const trace = [];
  const cost = egaDriverLineWork("point", [c.y, c.x], {
    instruction: (ip) => trace.push(ip),
  });
  assert.deepEqual(trace, point.trace, "Native in-bounds point path");
  assert.equal(cost.portWrites, point.ports.length);
}
assert.deepEqual(caveMinimapWork(party), m.expectedPartyPrimitiveWork);
assert.deepEqual(caveMinimapWork(initial), m.expectedInitialPrimitiveWork);
// Independent mode and caller guards. These are source-derived cases, not native captures.
for (const [mode, n] of [
  [0, 33],
  [1, 46],
  [2, 35],
]) {
  memory.b(0x8990, mode);
  assert.equal(
    caveMinimapCalls(memory, "party").filter((c) => c.kind === "point").length,
    n,
  );
}
assert.deepEqual(caveMinimapCalls(memory, "party", { kind: 10 }), []);
memory.b(0x546a, 1);
assert.deepEqual(caveMinimapCalls(memory, "party"), []);
memory.b(0x546a, 0);
memory.b(0x2042, 1);
assert.throws(() => caveMinimapCalls(memory, "party"), /non-EGA/);
memory.b(0x2042, 0);
// An independent source-derived input distinguishes the original base-pointer
// warning guard from a plausible but incorrect current-room-neighbor rewrite.
const quirk = new FlightMemory(Buffer.from(before[1].data, "base64"));
quirk.b(0x8990, 1);
quirk.b(0x5a42, 1);
quirk.b(0x5a40, 64);
for (const p of [0x5a44, 0x5a32, 0x5a52, 0x5a62]) quirk.b(p, 0);
quirk.i(0x4d32, 17);
assert.equal(caveMinimapCalls(quirk, "party")[0].color, 2);
quirk.i(0x4d32, 16);
assert.equal(caveMinimapCalls(quirk, "party")[0].color, 7);
assert.throws(
  () => caveMinimapCalls(memory, "invalid"),
  /Unsupported cave minimap phase/,
);
assert.throws(
  () =>
    assert.deepEqual(
      caveMinimapWork(party.slice(1)),
      m.expectedPartyPrimitiveWork,
    ),
  /Expected values/,
);
assert.throws(
  () =>
    assert.deepEqual(
      caveMinimapWork([...party, ...initial]),
      m.expectedPartyPrimitiveWork,
    ),
  /Expected values/,
);
const output = ".local/cave-minimap-verification-" + Date.now();
await mkdir(output);
await writeFile(
  output + "/result.json",
  JSON.stringify(
    {
      completed: true,
      sourceRanges: 4,
      originalPixelCases: 32,
      sourceInferredPartyPoints: 33,
      initialCachePoints: 776,
      partyWork: caveMinimapWork(party),
      initialWork: caveMinimapWork(initial),
      runtimeIntegrated: false,
      scope: m.scope,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  "Cave minimap:4 original code ranges;809 point paths match native primitive;33 marker points and776 initial cache points kept separate;mode/guard cases and3 failure controls. Analysis only. Report:" +
    output,
);
