import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { MapDeadline } from "../src/game/map-deadline.js";
import { unpackImage } from "../src/game/executable.js";
const sha = (b) => createHash("sha256").update(b).digest("hex");
const required = (p) =>
  readFile(p).catch(() => {
    throw Error(
      `SETUP: missing map clock evidence ${p};see docs/ordinary-keyboard.md`,
    );
  });
const m = JSON.parse(await required("reference/map-clock.json"));
assert.equal(m.completed, true);
assert.deepEqual(m.injections, []);
assert.equal(m.partialRestore, false);
assert.deepEqual(m.fittedInputs, []);
assert.equal(m.expectedCalls, 35);
assert.equal(m.expectedExternalReads, 70);
assert.equal(m.sourceFileCount, 529);
assert.equal(Object.keys(m.artifacts).length, m.expectedArtifacts);
assert.equal(m.expectedArtifacts, 306);
for (const [p, h] of Object.entries(m.verificationTools))
  assert.equal(sha(await required(p)), h, `Changed map clock verifier ${p}`);
for (const [role, a] of Object.entries(m.artifacts)) {
  const b = await required(a.path);
  assert.equal(b.length, a.bytes, `Truncated ${role}`);
  assert.equal(sha(b), a.sha256, `Corrupt ${role}`);
}
const load = async (role) => JSON.parse(await required(m.artifacts[role].path));
const source = await load("source");
assert.equal(source.captureCommit, m.captureCommit);
assert.match(m.captureCommit, /^[a-f0-9]{40}$/);
const files = execFileSync(
  "git",
  ["ls-tree", "-r", "--name-only", m.captureCommit],
  { encoding: "utf8" },
)
  .trim()
  .split("\n")
  .sort();
assert.equal(files.length, 529);
assert.deepEqual(Object.keys(source.files).sort(), files);
assert.equal(source.sourceArchiveSha256, m.artifacts.zip.sha256);
// Read compressed members without extracting ignored HTML into Vite's watched
// preview tree. ZipFile.read also verifies each member's CRC.
const archive = JSON.parse(
  execFileSync(
    "python3",
    [
      "-c",
      [
        "import zipfile,json,hashlib,sys",
        "z=zipfile.ZipFile(sys.argv[1]); names=z.namelist()",
        "assert len(names)==len(set(names))",
        "print(json.dumps({p:hashlib.sha256(z.read(p)).hexdigest() for p in names}))",
      ].join("\n"),
      m.artifacts.zip.path,
    ],
    { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 },
  ),
);
assert.deepEqual(archive, source.files);
for (const [p, h] of Object.entries(source.files)) {
  assert.ok(!p.startsWith("/") && !p.split("/").includes(".."));
  assert.equal(
    sha(execFileSync("git", ["show", `${m.captureCommit}:${p}`])),
    h,
    `Git producer ${p}`,
  );
}
const runner = await load("runner"),
  capture = await load("capture.json"),
  clockCapture = await load("map-clock-capture.json"),
  cleanup = await load("cleanup");
assert.equal(runner.exitCode, 0);
assert.equal(runner.status, "finished");
assert.equal(runner.sourceCommit, m.captureCommit);
assert.equal(capture.completed, true);
assert.equal(capture.scriptSha256, source.files["scripts/capture-security.py"]);
assert.equal(clockCapture.completed, true);
assert.equal(clockCapture.expectedCalls, 35);
assert.equal(clockCapture.expectedExternalReads, 70);
assert.equal(clockCapture.initialMapReadExcluded, 0);
for (const c of [capture, clockCapture]) {
  assert.deepEqual(c.injections, []);
  assert.equal(c.partialRestore, false);
}
assert.equal(cleanup.pid, capture.pid);
assert.equal(cleanup.instanceId, capture.instanceId);
assert.equal(cleanup.processAbsent, true);
assert.equal(cleanup.exitCode, 1);
assert.equal(
  sha(await required("reference/build.json")),
  m.buildManifestSha256,
);
const build = JSON.parse(await required("reference/build.json"));
assert.equal(Object.keys(build.files).length, 22);
for (const [p, id] of Object.entries(build.files)) {
  const b = await required(`game/${p}`);
  assert.equal(b.length, id.bytes);
  assert.equal(sha(b), id.sha256, `Original ${p}`);
}
const exe = await required("game/DUCKTALE.EXE"),
  image = Buffer.from(unpackImage(exe));
const mapping = await load("map-resident-mapping.json"),
  clockMapping = await load("map-clock-mapping.json");
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
for (const [i, r] of mapping.ranges.entries()) {
  const result = mapping.read.results[i];
  assert.equal(result.status, "ok");
  assert.deepEqual(
    Buffer.from(result.data, "base64"),
    image.subarray(r.imageOffset, r.imageOffset + r.length),
    `Original resident ${r.name}`,
  );
}
assert.equal(
  mapping.ranges.reduce((s, r) => s + r.length, 0),
  1220,
);
const overlay = await load("map-live-overlay.json"),
  body = Buffer.from(exe.subarray(0xfa00, 0x11ab0));
assert.equal(body.length, 8368);
assert.equal(exe.readUInt16LE(0xf606), 180);
for (let i = 0; i < 180; i++) {
  const p = 0xf600 + exe.readUInt16LE(0xf618) + 4 * i,
    at = exe.readUInt16LE(p) + (exe.readUInt16LE(p + 2) - 0xc17) * 16;
  assert.ok(at >= 0 && at < body.length - 1);
  body.writeUInt16LE((body.readUInt16LE(at) + mapping.load) & 65535, at);
}
assert.equal(overlay.read.aborted, false);
assert.equal(overlay.read.results[0].status, "ok");
assert.deepEqual(Buffer.from(overlay.read.results[0].data, "base64"), body);
assert.equal(body[0x10ac], 0x9a);
assert.equal(body.readUInt16LE(0x10ad), 0x1d8);
assert.equal(body.readUInt16LE(0x10af), clockMapping.segment);
assert.equal(clockMapping.segment, mapping.load + 0x98e);
assert.equal(
  clockMapping.liveCall,
  body.subarray(0x10ac, 0x10b1).toString("hex"),
);
const rows = await load("map-clock-consumption.json"),
  events = await load("map-clock-inputs.json");
assert.equal(rows.length, 35);
assert.equal(events.length, 70);
const snapshots = new Map();
for (const [index, row] of rows.entries()) {
  assert.equal(row.beforeMapRead, index + 1);
  for (const [stage, ip] of Object.entries({
    entry: 0x1d8,
    ready: 0x1f4,
    read: 0x1f9,
    end: 0x208,
  })) {
    const s = await load(row[stage].artifact),
      regs = s.state.results[0].registers,
      ds = Buffer.from(s.state.results[1].data, "base64");
    assert.equal(s.stop.protected_mode, false);
    assert.equal(s.stop.stop_id, row[stage].stopId);
    assert.equal(s.state.aborted, false);
    assert.equal(s.state.results.length, 2);
    assert.ok(s.state.results.every((r) => r.status === "ok"));
    assert.equal(regs.cs, clockMapping.segment);
    assert.equal(regs.eip, ip);
    assert.equal(regs.ds, mapping.ds);
    assert.equal(regs.ss, mapping.ds);
    assert.equal(ds.length, 65536);
    assert.equal(ds.readUInt32LE(0x2225), row[stage].clock);
    assert.equal(ds.readUInt32LE(0x27f8), row[stage].deadline);
    assert.equal(ds.readUInt32LE(0x27fc), row[stage].period);
    assert.equal(row[stage].period, 6);
    snapshots.set(row[stage].artifact, { regs, ds });
  }
}
const seed = snapshots.get(rows[0].entry.artifact).ds.readUInt16LE(0x2229);
for (const { ds } of snapshots.values())
  assert.equal(
    ds.readUInt16LE(0x2229),
    seed,
    "Deadline segment must not change RNG",
  );
for (const [i, e] of events.entries()) {
  const index = Math.floor(i / 2),
    phase = i % 2 ? "read" : "ready";
  assert.equal(e.beforeMapRead, index + 1);
  assert.equal(e.phase, phase);
  assert.equal(e.artifact, rows[index][phase].artifact);
  assert.equal(e.stopId, rows[index][phase].stopId);
  const r = snapshots.get(e.artifact).regs;
  assert.equal(
    e.value,
    (r.edx & 65535) * 65536 + (r.eax & 65535),
    "Clock result must originate at its native consumption boundary",
  );
}
function replay(stream, records) {
  assert.equal(records.length, 35);
  assert.equal(stream.length, 70);
  const timer = new MapDeadline({
    deadline: records[0].entry.deadline,
    period: 6,
  });
  let used = 0;
  for (const row of records) {
    assert.equal(
      timer.deadline,
      row.entry.deadline,
      "Carried deadline before call",
    );
    let reads = 0;
    assert.equal(
      timer.poll(() => {
        const e = stream[used++];
        assert.ok(e, "Missing required clock read");
        reads++;
        return e.value;
      }),
      true,
      "Captured successful deadline read",
    );
    assert.equal(reads, 2);
    assert.equal(
      timer.deadline,
      row.end.deadline,
      "Original resulting deadline",
    );
    const r = snapshots.get(row.end.artifact).regs;
    assert.equal(timer.deadline, (r.edx & 65535) * 65536 + (r.eax & 65535));
  }
  assert.equal(used, 70, "Unconsumed required clock events");
}
replay(events, rows);
assert.throws(() => replay(events.slice(1), rows));
assert.throws(() => replay(events, rows.slice(1)));
const changed = structuredClone(rows);
changed[10].end.deadline++;
assert.throws(() => replay(events, changed));
const shifted = structuredClone(events);
shifted[1].value++;
assert.throws(() => replay(shifted, rows));
// The capture has identical adjacent reads and exact six-count completions.
// Independent source-derived edge cases are needed to distinguish reusing the
// first clock,advancing an old deadline,signed comparison and ADD/ADC carry.
let calls = 0;
const reads = [0x80000001, 0xfffffffd],
  edge = new MapDeadline({ deadline: 0x80000000, period: 6 });
assert.equal(
  edge.poll(() => reads[calls++]),
  true,
);
assert.equal(calls, 2);
assert.equal(edge.deadline, 3);
calls = 0;
const pending = new MapDeadline({ deadline: 0x80000000 });
assert.equal(
  pending.poll(() => {
    calls++;
    return 0x7fffffff;
  }),
  false,
);
assert.equal(calls, 1);
assert.equal(pending.deadline, 0x80000000);
const disabled = new MapDeadline({ deadline: 123, period: 0 });
assert.equal(
  disabled.poll(() => {
    throw Error("Clock must not be read");
  }),
  true,
);
assert.equal(disabled.deadline, 123);
assert.throws(() => new MapDeadline({ deadline: -1 }));
assert.throws(() => new MapDeadline().poll(() => NaN));
const map = await load("map-capture.json");
assert.equal(map.completed, true);
assert.equal(map.inputReads, 36);
assert.equal(map.replay.active, false);
assert.equal(map.replay.remaining, 0);
console.log(
  "Map deadline:35 carried original completion calls,70 separately captured clock results,full overlay/1220 resident bytes,529 archived producer files;4 replay negatives and source-derived unsigned/carry/two-read/disabled edges. Earlier spin polls,Game integration and browser timing remain unverified.",
);
