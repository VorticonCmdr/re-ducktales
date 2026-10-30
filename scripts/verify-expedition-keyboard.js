import assert from "node:assert/strict";
import { readFileSync as read } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { Game } from "../src/game/application.js";
import { Scheduler } from "../src/game/scheduler.js";
import { caveDirectionFromByte, Cave } from "../src/game/cave.js";
import { parseArchive } from "../src/assets.js";
import { unpackImage } from "../src/game/executable.js";
import { parseLocations, parseLoot } from "../src/game/campaign.js";
const sha = (b) => createHash("sha256").update(b).digest("hex");
function checked(p, h) {
  let b;
  try {
    b = read(p);
  } catch {
    throw Error(`SETUP: missing ${p};see docs/expedition-keyboard.md`);
  }
  assert.equal(sha(b), h, `Corrupt ${p}`);
  return b;
}
const m = JSON.parse(read("reference/expedition-keyboard.json"));
assert.equal(
  m.acceptanceLevel,
  "native-key-invariants-plus-independent-input-integration",
);
assert.equal(m.expectedIndependentReads, 17);
assert.equal(m.expectedNativeFlagCheckpoints, 6);
assert.equal(m.expectedCaveGroupingCases, 256);
assert.deepEqual(m.injections, []);
assert.deepEqual(m.fittedInputs, []);
assert.equal(m.partialRestore, false);
assert.equal(m.reader.path, "src/game/ordinary-keyboard.js");
checked(m.reader.path, m.reader.sha256);
const build = JSON.parse(checked(m.buildManifest, m.buildManifestSha256)),
  files = {};
for (const [n, s] of Object.entries(build.files))
  files[n] = checked(`game/${n}`, s.sha256);
assert.equal(Object.keys(files).length, 22);
const image = Buffer.from(unpackImage(files["DUCKTALE.EXE"])),
  exe = files["DUCKTALE.EXE"];
const parents = {};
for (const [role, s] of Object.entries(m.parents))
  parents[role] = JSON.parse(checked(s.path, s.sha256));
assert.equal(Object.keys(parents).length, 6);
function artifact(parent, role) {
  const a = parent.artifacts[role];
  return JSON.parse(checked(a.path, a.sha256));
}
function capture(parent, role) {
  const x = artifact(parent, role),
    r = x.content ? JSON.parse(x.content[0].text) : x.state;
  assert.equal(r.aborted, false);
  assert.ok(r.results.every((s) => s.status === "ok"));
  const ds = r.results.find(
    (s) => s.data && Buffer.from(s.data, "base64").length === 65536,
  );
  assert.ok(ds, "Missing full native DS");
  return {
    raw: x,
    cpu: r.results[0].registers,
    bytes: Buffer.from(ds.data, "base64"),
    results: r.results,
  };
}
const bodies = {};
for (const [name, s] of Object.entries(m.sourceLayouts)) {
  const bytes = exe.subarray(s.offset, s.offset + s.length);
  assert.equal(sha(bytes), s.sha256);
  assert.equal(bytes.readUInt16LE(0), 0x5a4d);
  assert.equal(bytes.readUInt16LE(8) * 16, s.headerBytes);
  assert.equal(bytes.readUInt16LE(6), s.relocations);
  assert.equal(bytes.length - s.headerBytes, s.bodyBytes);
  bodies[name] = Buffer.from(bytes.subarray(s.headerBytes));
}
assert.equal(Object.keys(bodies).length, 6);
const modeWrites = [
  ["resident", 0x77, 1],
  ["office", 0x361, 0],
  ["office", 0x6c4, 1],
  ["office", 0x1768, 1],
  ["office", 0x1ed3, 0],
  ["office", 0x20a5, 1],
  ["flight", 0xc, 0],
  ["mountain", 0x63, 0],
  ["mountain", 0x1544, 1],
  ["cave", 0x2a, 0],
  ["photography", 0xe3, 1],
];
for (const [name, at, mode] of modeWrites)
  assert.equal(
    (name === "resident" ? image : bodies[name])
      .subarray(at, at + 5)
      .toString("hex"),
    `c606c1030${mode}`,
    `${name} ordinary reader mode store`,
  );
assert.equal(
  bodies.jungle.indexOf(Buffer.from("c103", "hex")),
  -1,
  "Jungle contains no direct mode operand;caller mode is retained",
);
assert.equal(parents.mountain.completed, true);
assert.deepEqual(parents.mountain.injections, []);
assert.equal(parents.mountain.partialRestore, false);
const nativeCode = artifact(parents.mountain, "code");
assert.equal(nativeCode.segment, nativeCode.load + 0xc17);
assert.equal(nativeCode.ds, nativeCode.load + 0x120e);
const mountainCode = Buffer.from(bodies.mountain);
const mh = exe.subarray(m.sourceLayouts.mountain.offset);
for (let i = 0; i < 68; i++) {
  const p = mh.readUInt16LE(24) + i * 4;
  const at = mh.readUInt16LE(p) + (mh.readUInt16LE(p + 2) - 0xc17) * 16;
  mountainCode.writeUInt16LE(
    (mountainCode.readUInt16LE(at) + nativeCode.load) & 65535,
    at,
  );
}
assert.equal(nativeCode.read.aborted, false);
assert.ok(nativeCode.read.results.every((r) => r.status === "ok"));
assert.deepEqual(
  Buffer.from(nativeCode.read.results[0].data, "base64"),
  mountainCode,
);
const configuration = artifact(parents.mountain, "configuration");
assert.match(configuration.screen.text, /config -get cpu cpu_cycles\s*\n3000/);
const measurement = artifact(parents.mountain, "measurement");
assert.equal(measurement.completed, true);
assert.equal(measurement.replay.active, false);
assert.equal(measurement.replay.remaining, 0);
assert.deepEqual(measurement.releaseBytes, [3, 0]);
const native = {};
for (const role of [
  "first",
  "first-body",
  "last",
  "last-body",
  "release-edge",
  "release-neutral",
]) {
  native[role] = capture(parents.mountain, role);
  assert.equal(native[role].bytes[0x3c1], 0);
  assert.equal(native[role].cpu.cs, nativeCode.segment);
  assert.equal(native[role].cpu.ds, nativeCode.ds);
  assert.equal(native[role].raw.stop.protected_mode, false);
  assert.equal(native[role].raw.stop.core, "normal");
}
assert.deepEqual(
  ["first", "last", "release-edge", "release-neutral"].map(
    (k) => native[k].cpu.eax & 255,
  ),
  [0, 3, 3, 0],
);
assert.deepEqual(
  [
    "first",
    "first-body",
    "last",
    "last-body",
    "release-edge",
    "release-neutral",
  ].map((k) => native[k].bytes[0x27b9]),
  [0, 128, 128, 64, 0, 0],
);
assert.equal(capture(parents.cave, "pauseReturn").bytes[0x3c1], 0);
assert.equal(capture(parents.jungle, "00-before").bytes[0x3c1], 0);
assert.equal(capture(parents.photography, "pass9-before").bytes[0x3c1], 1);
// Full original/live cave identity before relating its analysis listing.
const originalCave = Buffer.from(bodies.cave),
  caveLayout = m.sourceLayouts.cave;
const caveHeader = exe.subarray(
    caveLayout.offset,
    caveLayout.offset + caveLayout.headerBytes,
  ),
  relocations = [];
for (let i = 0; i < 196; i++) {
  const p = caveHeader.readUInt16LE(24) + 4 * i,
    at =
      caveHeader.readUInt16LE(p) +
      (caveHeader.readUInt16LE(p + 2) - 0xc17) * 16;
  relocations.push(at);
  originalCave.writeUInt16LE(
    (originalCave.readUInt16LE(at) + 0x1f5) & 65535,
    at,
  );
}
const first = capture(parents.cave, "first");
assert.equal(first.cpu.cs, 0xe0c);
assert.deepEqual(
  Buffer.from(first.results[2].data, "base64").subarray(0, 11054),
  originalCave,
);
for (const at of relocations)
  originalCave.writeUInt16LE(
    (originalCave.readUInt16LE(at) + 0x1000 - 0x1f5) & 65535,
    at,
  );
let linked = 0;
function link(list, body = originalCave) {
  assert.equal(list.program, "CAVE_CODE.EXE");
  assert.equal(list.success, true);
  assert.equal(list.truncated, false);
  assert.ok(list.instructions.length > 0);
  for (const i of list.instructions) {
    const [s, o] = i.address.split(":").map((v) => parseInt(v, 16)),
      at = s * 16 + o - 0x1c170;
    assert.equal(
      body.subarray(at, at + i.length).toString("hex"),
      i.bytes,
      "Cave analysis/native byte mismatch",
    );
    linked += i.length;
  }
}
for (const s of Object.values(m.staticArtifacts)) {
  const r = JSON.parse(checked(s.path, s.sha256));
  assert.equal(r.isError, false);
  link(JSON.parse(r.content[0].text));
}
assert.equal(Object.keys(m.staticArtifacts).length, 5);
assert.equal(linked, 526);
// Derive the supported pairs from actual CMP immediate operands. Labels come
// from the source door pointer/pose calls and following room-offset branches.
const groups = [
  ["up", 0x9b2, 0x9b6],
  ["right", 0x9e5, 0x9e9],
  ["left", 0xa3f, 0xa43],
  ["down", 0xa66, 0xa6a],
];
const expected = new Map();
for (const [label, a, b] of groups) {
  assert.equal(bodies.cave[a], 0x3c);
  assert.equal(bodies.cave[b], 0x3c);
  expected.set(bodies.cave[a + 1], label);
  expected.set(bodies.cave[b + 1], label);
}
for (const at of [0x9ac, 0x9df, 0xa39, 0xa60])
  assert.equal(bodies.cave.subarray(at, at + 2).toString("hex"), "241f");
for (const [at, pair] of [
  [0xd59, [1, 2]],
  [0xebf, [5, 6]],
  [0xf51, [3, 4]],
  [0xfe6, [7, 8]],
]) {
  const b = bodies.cave.subarray(at, at + 32);
  assert.equal(b.subarray(0, 4).toString("hex"), "f64684c0");
  assert.equal(b.subarray(12, 14).toString("hex"), "241f");
  assert.ok(b.indexOf(Buffer.from([0x3c, pair[0]])) >= 0);
  assert.ok(b.indexOf(Buffer.from([0x3c, pair[1]])) >= 0);
}
function grouping(fn = caveDirectionFromByte) {
  let cases = 0;
  for (let byte = 0; byte < 256; byte++) {
    assert.equal(
      fn(byte),
      expected.get(byte & 31) ?? null,
      `Cave source direction byte${byte}`,
    );
    cases++;
  }
  assert.equal(cases, m.expectedCaveGroupingCases);
}
grouping();
const profile = JSON.parse(checked(m.inputProfile.path, m.inputProfile.sha256));
assert.equal(profile.expectedReadCount, 17);
assert.equal(profile.expectedEventCount, 2);
assert.equal(profile.events.length, 2);
assert.deepEqual(profile.events, [
  { beforeRead: 2, scanCode: 77, pressed: true },
  { beforeRead: 16, scanCode: 77, pressed: false },
]);
const resources = {
  image,
  entries: parseArchive(files["EXP.ARC"]),
  mountainEntries: parseArchive(files["MT.ARC"]),
  mainEntries: parseArchive(files["MAIN.ARC"]),
};
function replay({
  dropRelease = false,
  wrongMode = false,
  alterResult = false,
} = {}) {
  const g = new Game({
      locations: parseLocations(parseArchive(files["LOC.ARC"])),
      loot: parseLoot(parseArchive(files["LOOT.ARC"])),
      expeditionResources: resources,
      expeditionInput: "keyboard",
    }),
    clock = new Scheduler(g);
  g.seed = 0;
  g.campaign.location = 24;
  g.briefing = { activity: "mountain", variant: 0 };
  g.startExpedition();
  if (wrongMode) g.expeditionKeyboard.mode = 1;
  const p = g.mountain,
    originalPoll = p.pollInput;
  let consumed = 0,
    flagComparisons = 0;
  function flags(role, label) {
    flagComparisons++;
    assert.deepEqual(
      Buffer.from(g.expeditionKeyboard.bytes()),
      native[role].bytes.subarray(0x276c, 0x27ec),
      label,
    );
  }
  p.pollInput = () => {
    if (!originalPoll()) return false;
    const read = p.inputs.length + 1;
    for (const e of profile.events)
      if (e.beforeRead === read) {
        if (dropRelease && !e.pressed) continue;
        g.input({
          type: "expedition-key",
          scanCode: e.scanCode,
          pressed: e.pressed,
        });
        consumed++;
        if (read === 2) flags("first-body", "Native flags before2");
        if (read === 16) flags("last-body", "Native flags before16");
      }
    return true;
  };
  let checked = 0;
  for (let step = 0; step < 20000 && p.inputs.length < 17; step++) {
    const before = p.inputs.length;
    clock.advanceTo(clock.now + 2);
    if (p.inputs.length !== before) {
      assert.equal(p.inputs.length, before + 1, "Skipped physical source read");
      const n = p.inputs.length;
      let byte = g.lastExpeditionKeyByte;
      if (alterResult && n === 16) byte = 0;
      assert.equal(byte, n === 1 || n === 17 ? 0 : 3, `Native AL after${n}`);
      if (n === 1) flags("first", "Native flags after1");
      if (n === 15) flags("last", "Native flags after15");
      if (n === 16) flags("release-edge", "Native flags after16");
      if (n === 17) flags("release-neutral", "Native flags after17");
      checked++;
    }
  }
  assert.equal(checked, 17, "Unfinished physical source input sequence");
  assert.equal(flagComparisons, m.expectedNativeFlagCheckpoints);
  assert.equal(consumed, 2, "Unconsumed required hardware events");
  assert.equal(p.memory.b(0x4d34), 3);
  return checked;
}
assert.equal(replay(), 17);
assert.throws(() => replay({ dropRelease: true }), /Native flags after16/);
assert.throws(() => replay({ alterResult: true }), /Native AL after16/);
assert.throws(() => replay({ wrongMode: true }), /Native AL after3/);
assert.throws(
  () =>
    grouping((byte) => (byte === 0xe2 ? "right" : caveDirectionFromByte(byte))),
  /Cave source direction byte226/,
);
const s = Object.values(m.staticArtifacts)[0],
  bad = JSON.parse(JSON.parse(checked(s.path, s.sha256)).content[0].text);
bad.instructions[0].bytes = "00";
assert.throws(() => link(bad), /Cave analysis\/native byte mismatch/);
execFileSync(process.execPath, ["scripts/verify-mountain-frame-profile.js"], {
  stdio: "inherit",
});
console.log(
  `Expedition keyboard:17 independent Game source reads,2 hardware events,6 exact native128-byte flag checkpoints;${linked} listed Ghidra bytes linked to native cave code,256 source-derived direction cases and5 negative controls. Not a native whole-expedition replay.`,
);
