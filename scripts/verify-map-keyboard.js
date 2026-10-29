import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { OrdinaryKeyboard } from "../src/game/ordinary-keyboard.js";
import { advanceMapPointer } from "../src/game/map-pointer.js";
import { unpackImage } from "../src/game/executable.js";
const sha = (b) => createHash("sha256").update(b).digest("hex");
const required = (p) =>
  readFile(p).catch(() => {
    throw Error(
      `SETUP: missing map keyboard artifact ${p};see docs/ordinary-keyboard.md`,
    );
  });
const manifest = JSON.parse(await required("reference/map-keyboard.json"));
assert.equal(manifest.completed, true);
assert.equal(manifest.expectedReads, 36);
assert.equal(manifest.expectedSequences, 10);
assert.equal(manifest.sourceFileCount, 518);
assert.deepEqual(manifest.injections, []);
assert.equal(manifest.partialRestore, false);
assert.equal(
  sha(await required("reference/build.json")),
  manifest.buildManifestSha256,
);
for (const [p, h] of Object.entries(manifest.verificationTools))
  assert.equal(sha(await required(p)), h, `Changed map keyboard tool ${p}`);
assert.equal(
  Object.keys(manifest.artifacts).length,
  manifest.expectedArtifacts,
);
assert.equal(manifest.expectedArtifacts, 159);
for (const [name, spec] of Object.entries(manifest.artifacts)) {
  const b = await required(spec.path);
  assert.equal(b.length, spec.bytes, `Truncated ${name}`);
  assert.equal(sha(b), spec.sha256, `Corrupt ${name}`);
}
const load = async (name) =>
  JSON.parse(await required(manifest.artifacts[name].path));
const source = await load("capture-source");
assert.match(manifest.captureCommit, /^[a-f0-9]{40}$/);
assert.equal(source.captureCommit, manifest.captureCommit);
assert.equal(Object.keys(source.files).length, 518);
assert.deepEqual(
  Object.keys(source.files).sort(),
  execFileSync(
    "git",
    ["ls-tree", "-r", "--name-only", manifest.captureCommit],
    { encoding: "utf8" },
  )
    .trim()
    .split("\n")
    .sort(),
);
for (const [p, h] of Object.entries(source.files)) {
  assert.equal(
    sha(await required(`${manifest.sourceArchive}/${p}`)),
    h,
    `Archived source ${p}`,
  );
  assert.equal(
    sha(execFileSync("git", ["show", `${source.captureCommit}:${p}`])),
    h,
    `Git producer source ${p}`,
  );
}
const runner = await load("runner");
assert.equal(runner.exitCode, 0);
assert.equal(runner.sourceCommit, manifest.captureCommit);
const profile = JSON.parse(await required(manifest.inputProfile));
assert.equal(profile.expectedReads, 36);
assert.equal(profile.events.length, 10);
const capture = await load("capture.json"),
  map = await load("map-capture.json");
assert.equal(capture.completed, true);
assert.equal(map.completed, true);
assert.equal(map.inputReads, 36);
assert.equal(map.authoredSequences, 10);
assert.equal(map.profileSha256, sha(await required(manifest.inputProfile)));
assert.equal(
  capture.scriptSha256,
  sha(
    execFileSync("git", [
      "show",
      `${manifest.captureCommit}:scripts/capture-security.py`,
    ]),
  ),
);
// Capture tooling can gain new scenarios after an immutable capture. Validate
// this producer against both its archived source and Git, rather than requiring
// the current capture tool to remain frozen. The archive is checked above.
assert.equal(capture.scriptSha256, manifest.captureScriptSha256);
assert.equal(capture.scriptSha256, source.files["scripts/capture-security.py"]);
for (const c of [capture, map]) {
  assert.deepEqual(c.injections, []);
  assert.equal(c.partialRestore, false);
}
assert.equal(map.replay.active, false);
assert.equal(map.replay.remaining, 0);
const exe = await required("game/DUCKTALE.EXE");
const build = JSON.parse(await required("reference/build.json"));
for (const [name, identity] of Object.entries(build.files)) {
  const bytes = await required(`game/${name}`);
  assert.equal(bytes.length, identity.bytes, name);
  assert.equal(sha(bytes), identity.sha256, `Original ${name}`);
}
const mapping = await load("map-resident-mapping.json"),
  overlay = await load("map-live-overlay.json");
const image = Buffer.from(unpackImage(exe));
let cursor = exe.readUInt16LE(8) * 16 + exe.readUInt16LE(22) * 16 + 0x125;
for (let region = 0; region < 16; region++) {
  const count = exe.readUInt16LE(cursor);
  cursor += 2;
  for (let i = 0; i < count; i++, cursor += 2) {
    const at = exe.readUInt16LE(cursor) + region * 65536;
    image.writeUInt16LE((image.readUInt16LE(at) + mapping.load) & 65535, at);
  }
}
assert.equal(mapping.ranges.length, 5);
assert.equal(mapping.read.aborted, false);
for (const [i, row] of mapping.ranges.entries()) {
  const result = mapping.read.results[i];
  assert.equal(result.status, "ok");
  assert.deepEqual(
    Buffer.from(result.data, "base64"),
    image.subarray(row.imageOffset, row.imageOffset + row.length),
    `Live resident ${row.name}`,
  );
}
const at = 0xf600,
  body = Buffer.from(exe.subarray(at + 1024, at + 9392));
assert.equal(body.length, 8368);
assert.equal(exe.readUInt16LE(at + 6), 180);
for (let i = 0; i < 180; i++) {
  const p = at + exe.readUInt16LE(at + 24) + 4 * i,
    offset = exe.readUInt16LE(p) + (exe.readUInt16LE(p + 2) - 0xc17) * 16;
  assert.ok(offset >= 0 && offset < body.length - 1);
  body.writeUInt16LE(
    (body.readUInt16LE(offset) + mapping.load) & 65535,
    offset,
  );
}
assert.equal(overlay.read.aborted, false);
assert.equal(overlay.read.results[0].status, "ok");
assert.deepEqual(
  Buffer.from(overlay.read.results[0].data, "base64"),
  body,
  "Full live map overlay",
);
assert.equal(overlay.entrySegment, overlay.segment + 0xca);
assert.equal(map.segment, overlay.entrySegment);
const inputs = await load("inputs.json"),
  rows = await load("map-consumption.json");
const native = new Map();
for (const row of rows)
  for (const stage of ["before", "input", "end"]) {
    const s = await load(row[stage].artifact);
    assert.equal(s.state.aborted, false);
    assert.equal(s.state.results.length, 2);
    assert.ok(s.state.results.every((r) => r.status === "ok"));
    const regs = s.state.results[0].registers;
    assert.equal(s.stop.protected_mode, false);
    assert.equal(s.stop.stop_id, row[stage].stopId);
    assert.equal(regs.cs, map.segment);
    assert.equal(regs.ds, mapping.ds);
    assert.equal(regs.ss, mapping.ds);
    assert.equal(
      regs.eip,
      { before: 0x1238, input: 0x123d, end: 0x140e }[stage],
    );
    const ds = Buffer.from(s.state.results[1].data, "base64");
    assert.equal(ds.length, 65536);
    assert.equal(regs.eax & 65535, row[stage].ax);
    assert.equal(ds.readUInt32LE(0x2225), row[stage].clock);
    assert.equal(ds.readUInt32LE(0x27f8), row[stage].deadline);
    assert.equal(ds.readUInt32LE(0x27fc), row[stage].period);
    native.set(`${row.index}/${stage}`, { ds, regs });
  }
const scan = {
  KBD_right: 0x4d,
  KBD_k: 0x25,
  KBD_left: 0x4b,
  KBD_kp3: 0x51,
  KBD_m: 0x32,
  KBD_up: 0x48,
};
function pointer(ds) {
  return {
    x: ds.readInt16LE(map.xPointer),
    y: ds.readInt16LE(map.yPointer),
    acceleration: ds.readInt16LE(0x5514),
    dx: ds.readInt16LE(0x4dc8),
    dy: ds.readInt16LE(0x4e10),
    firstPollLatch: ds.readInt16LE(0x697c),
  };
}
function compare(selected, negative) {
  assert.equal(selected.length, 36, "Missing map keyboard read");
  const keyboard = new OrdinaryKeyboard(0);
  let state = pointer(native.get("0/before").ds),
    consumed = 0;
  for (const [index, row] of selected.entries()) {
    assert.equal(row.index, index, "Unexpected map read order");
    const before = native.get(`${index}/before`),
      input = native.get(`${index}/input`),
      end = native.get(`${index}/end`);
    const event = profile.events.find((e) => e.beforeRead === index);
    if (event) {
      const previous = selected[index - 1];
      assert.equal(previous.scheduledForRead, index);
      const record = inputs[previous.scheduledInputRecord];
      assert.deepEqual(
        record.events,
        event.keys.map((e) => ({
          type: "key",
          key: e.key,
          pressed: e.pressed,
          t: 0,
        })),
        "Independent authored make/release schedule",
      );
      for (const e of event.keys) {
        if (negative === "omit-make" && index === 1) continue;
        const raw = scan[e.key];
        assert.ok(raw !== undefined);
        keyboard.event(
          negative === "normalize-first"
            ? ({ 0x25: 0x4d, 0x32: 0x50 }[raw] ?? raw)
            : raw,
          e.pressed,
        );
      }
      consumed++;
    }
    assert.equal(before.ds[0x3c1], 0);
    assert.equal(before.ds[0x27ec], 1);
    assert.deepEqual(
      pointer(before.ds),
      state,
      "Carried pointer state before input",
    );
    assert.deepEqual(
      Buffer.from(keyboard.bytes()),
      before.ds.subarray(0x276c, 0x27ec),
      `Map key flags before${index}`,
    );
    const byte = keyboard.poll();
    assert.equal(
      byte,
      (input.regs.eax & 65535) ^
        (negative === "alter-output" && index === 1 ? 1 : 0),
      `Map input byte${index}`,
    );
    assert.deepEqual(
      Buffer.from(keyboard.bytes()),
      input.ds.subarray(0x276c, 0x27ec),
      `Map key flags after reader${index}`,
    );
    const next = advanceMapPointer(state, byte);
    state = Object.fromEntries(Object.keys(state).map((k) => [k, next[k]]));
    assert.deepEqual(pointer(end.ds), state, `Map pointer result${index}`);
    assert.equal(end.ds[0x3c1], Number(next.drawEnabled));
    assert.equal(end.regs.eax & 65535, Number(next.fire));
    if (negative !== "omit-flush") keyboard.flush();
    assert.deepEqual(
      Buffer.from(keyboard.bytes()),
      end.ds.subarray(0x276c, 0x27ec),
      `Map key flags after caller flush${index}`,
    );
  }
  assert.equal(consumed, 10, "Unconsumed map input sequences");
}
compare(rows);
for (const [mode, reason] of [
  ["omit-make", /Map key flags before1/],
  ["normalize-first", /Map key flags before8/],
  ["alter-output", /Map input byte1/],
  ["omit-flush", /Map key flags after caller flush1/],
])
  assert.throws(() => compare(rows, mode), reason);
assert.throws(() => compare(rows.slice(1)), /Missing map keyboard read/);
// These are observed original clock results,never model inputs or fitted waits.
assert.deepEqual(
  rows.slice(1).map((r, i) => r.input.clock - rows[i].input.clock),
  [5, ...new Array(34).fill(6)],
);
assert.ok(rows.every((r) => r.input.period === 6));
console.log(
  "Map ordinary keys:36 original input/128-flag/pointer comparisons from10 independent make-release sequences,full8368-byte overlay and1220 resident bytes;5 negatives. Six-count steady native cadence observed;Game/browser timing and keyboard integration remain separate.",
);
