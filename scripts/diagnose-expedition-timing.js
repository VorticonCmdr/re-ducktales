// Exploratory timing diagnosis. A state/input match is not elapsed-time parity.
// This command intentionally fails while the measured mountain timing differs.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { parseArchive } from "../src/assets.js";
import { unpackImage } from "../src/game/executable.js";
import { Mountain } from "../src/game/mountain.js";
import { FlightMemory } from "../src/game/flight-physics.js";
import { DRIVER_HZ, RETRACE_HZ } from "../src/game/application.js";
import { verifyFreshMountainPacing } from "./verify-mountain-pacing.js";
const evidenceOnly = process.argv.includes("--evidence-only");
const sha = (b) => createHash("sha256").update(b).digest("hex");
const load = (p) =>
  readFile(p).catch(() => {
    throw Error(`SETUP: missing expedition timing evidence ${p}`);
  });
const json = async (p) => JSON.parse(await load(p));
const m = await json("reference/expedition-timing-investigation.json");
assert.equal(
  sha(await load("scripts/diagnose-expedition-timing.js")),
  m.diagnosticSha256,
  "Changed timing diagnostic",
);
assert.equal(m.expectedMountainInputs, 15);
assert.equal(m.completedMovementTimingAcceptance, false);
for (const [role, a] of Object.entries(m.artifacts)) {
  const b = await load(a.path);
  assert.equal(b.length, a.bytes, `Truncated ${role}`);
  assert.equal(sha(b), a.sha256, `Corrupt ${role}`);
}
const proof = await json(m.artifacts["pause-proof"].path);
assert.equal(proof.completed, true);
assert.ok(proof.hostMilliseconds >= 1000 && proof.hostMilliseconds < 5000);
assert.equal(proof.counterBefore, proof.counterAfter);
assert.equal(proof.statusAfter.stop.stop_id, proof.stopId);
assert.deepEqual(proof.injections, []);
assert.equal(proof.partialRestore, false);
const fresh = (role) => json(m.artifacts[role].path);
const extract = (raw) => {
  const x = raw.state ?? JSON.parse(raw.content[0].text);
  assert.equal(x.aborted, false);
  assert.ok(x.results.every((r) => r.status === "ok"));
  const cpu = x.results.find((r) => r.op === "cpu_read").registers;
  const memory = x.results.find((r) => r.op === "mem_read");
  const bytes = Buffer.from(memory.data, "base64");
  assert.equal(bytes.length, 65536);
  return { cpu, bytes };
};
const before = extract(await fresh("pause-before")),
  after = extract(await fresh("pause-after")),
  resumed = extract(await fresh("pause-resumed"));
assert.deepEqual(before.cpu, after.cpu);
assert.deepEqual(before.bytes, after.bytes);
assert.equal(before.bytes.readUInt32LE(0x2225), proof.counterBefore);
assert.ok(resumed.bytes.readUInt32LE(0x2225) > proof.counterAfter);
const runner = await fresh("pause-runner"),
  source = await fresh("pause-source");
assert.equal(runner.completed, true);
assert.equal(runner.exitCode, 0);
assert.equal(runner.sourceCommit, source.commit);
assert.equal(source.commit, m.pauseCaptureCommit);
assert.ok(runner.command.includes("--pause-clock-test"));
const engine = await fresh("pause-engine"),
  capture = await fresh("pause-capture");
assert.equal(capture.completed, true);
assert.equal(capture.pid, engine.pid);
assert.equal(capture.instanceId, engine.instance_id);
assert.equal(capture.scriptSha256, source.files["scripts/capture-security.py"]);
assert.equal(engine.version, "0.84.0-vc1 (f6d9b)");
assert.equal(proof.statusAfter.stop.core, "normal");
assert.equal(proof.statusAfter.stop.protected_mode, false);
assert.equal(
  sha(await load(m.artifacts["pause-zip"].path)),
  source.archiveSha256,
);
assert.equal(
  sha(
    execFileSync("git", ["archive", "--format=zip", source.commit], {
      maxBuffer: 32 * 1024 * 1024,
    }),
  ),
  source.archiveSha256,
);
assert.equal(
  source.files["scripts/capture-security.py"],
  sha(
    execFileSync("git", [
      "show",
      `${source.commit}:scripts/capture-security.py`,
    ]),
  ),
);
const native = await json(m.artifacts["mountain-reference"].path);
assert.equal(native.expectedInputCount, 15);
assert.equal(native.expectedCheckpointCount, 15);
const records = {};
for (const [key, a] of Object.entries({
  entry: native.initialArtifact,
  ...native.artifacts,
})) {
  const b = await load(a.path);
  assert.equal(sha(b), a.sha256, `Corrupt mountain ${key}`);
  records[key] = extract(JSON.parse(b));
}
assert.equal(Object.keys(records).length, 31);
const stream = native.inputEvents.flatMap((e) => Array(e.count).fill(e.byte));
assert.equal(stream.length, 15);
const build = await json("reference/build.json");
const files = {};
for (const [name, a] of Object.entries(build.files)) {
  const b = await load(`game/${name}`);
  assert.equal(b.length, a.bytes);
  assert.equal(sha(b), a.sha256);
  files[name] = b;
}
const memory = new FlightMemory(records.entry.bytes),
  bp = records.entry.cpu.esp - 2;
assert.equal(bp, 0x9f48);
// Revalidate the actual overlay rather than trusting a Ghidra loader/alias.
const exe = files["DUCKTALE.EXE"],
  overlayAt = 0x17600;
assert.equal(exe.readUInt16LE(overlayAt), 0x5a4d);
const size =
  (exe.readUInt16LE(overlayAt + 4) - 1) * 512 +
  (exe.readUInt16LE(overlayAt + 2) || 512);
const headerBytes = exe.readUInt16LE(overlayAt + 8) * 16;
const original = Buffer.from(
  exe.subarray(overlayAt + headerBytes, overlayAt + size),
);
assert.equal(original.length, 12002);
const relocationCount = exe.readUInt16LE(overlayAt + 6);
assert.equal(relocationCount, 68);
for (let i = 0; i < relocationCount; i++) {
  const at = overlayAt + exe.readUInt16LE(overlayAt + 24) + i * 4;
  const offset = exe.readUInt16LE(at) + 16 * exe.readUInt16LE(at + 2) - 0xc170;
  original.writeUInt16LE(
    (original.readUInt16LE(offset) + 0x1f5) & 65535,
    offset,
  );
}
const rawEntry = JSON.parse(
  (await json(native.initialArtifact.path)).content[0].text,
);
assert.equal(rawEntry.results.length, 3);
assert.deepEqual(Buffer.from(rawEntry.results[2].data, "base64"), original);
const mountain = new Mountain(
  {
    image: unpackImage(files["DUCKTALE.EXE"]),
    entries: parseArchive(files["MT.ARC"]),
    mainEntries: parseArchive(files["MAIN.ARC"]),
    variant: 0,
    difficulty: memory.b(0x8990),
    day: memory.b(0x4e0e),
    money: memory.view.getUint32(0x8cc0, true),
    seed: memory.view.getUint16(0x2229, true),
    stackBytes: records.entry.bytes.subarray(bp - 0x52, bp),
  },
  memory,
);
let tickAt = 1000 / DRIVER_HZ,
  retraceAt = 1000 / RETRACE_HZ,
  consumed = 0;
const portTimes = [],
  nativeTimes = [];
for (let guard = 0; guard < 2000 && consumed < stream.length; guard++) {
  const byte = stream[consumed];
  mountain.setControls({ fire: false, direction: byte === 3 ? "right" : null });
  const at = Math.min(tickAt, retraceAt);
  if (tickAt <= retraceAt) {
    mountain.advanceTick();
    tickAt += 1000 / DRIVER_HZ;
  } else {
    mountain.advanceRetrace();
    retraceAt += 1000 / RETRACE_HZ;
  }
  if (mountain.inputs.length === consumed) continue;
  assert.equal(
    mountain.inputs.length,
    consumed + 1,
    "Skipped timing consumption boundary",
  );
  const key = String(consumed).padStart(2, "0"),
    input = records[`${key}-input`],
    post = records[`${key}-after`];
  assert.deepEqual(
    [input.cpu.cs, input.cpu.eip, input.cpu.ds, input.cpu.ss],
    [0xe0c, 0x31c, 0x1403, 0x1403],
  );
  assert.equal(input.cpu.eax & 255, byte, "Independent original input stream");
  for (const offset of [
    0x5ae0, 0x5c72, 0x5c70, 0x54f6, 0x6882, 0x6d3c, 0x3d12, 0x2229,
  ])
    assert.equal(
      memory.i(offset),
      post.bytes.readInt16LE(offset),
      `Movement state${consumed} ${offset.toString(16)}`,
    );
  nativeTimes.push(input.bytes.readUInt32LE(0x2225));
  portTimes.push(at);
  consumed++;
}
assert.equal(consumed, 15);
assert.equal(mountain.frames, 15);
assert.equal(mountain.outcome, null);
const relative = nativeTimes.map((t) => t - nativeTimes[0]);
const compareCounters = (values) =>
  assert.deepEqual(
    values,
    m.nativeMountainRelativeCounters,
    "Changed native timing observations",
  );
compareCounters(relative);
const damaged = [...relative];
damaged[7]++;
assert.throws(
  () => compareCounters(damaged),
  /Changed native timing observations/,
);
assert.throws(
  () => compareCounters(relative.slice(1)),
  /Changed native timing observations/,
);
const nativeMilliseconds =
  ((nativeTimes.at(-1) - nativeTimes[0]) * 1000) / DRIVER_HZ;
const portMilliseconds = portTimes.at(-1) - portTimes[0];
const result = {
  scope:
    "Conditional retained mountain clock observations plus fresh office pause-invariance proof;not a fresh unpaused mountain benchmark",
  consumed,
  stateCheckpoints: 15,
  nativeRelativeCounters: relative,
  nativeMilliseconds,
  portMilliseconds,
  observedSpeedRatio: nativeMilliseconds / portMilliseconds,
  driverHz: DRIVER_HZ,
  retraceHz: RETRACE_HZ,
  initialStateInjection:
    "Original ENTRY memory/stack only, explicitly conditional;no intermediate state or clock injected",
  timingParity:
    Math.abs(nativeMilliseconds - portMilliseconds) <= 1000 / DRIVER_HZ,
};
result.freshMountain = await verifyFreshMountainPacing();
console.log(JSON.stringify(result, null, 2));
if (!evidenceOnly)
  assert.ok(
    result.timingParity && result.freshMountain.timingParity,
    "UNRESOLVED: mountain elapsed input cadence differs from retained and fresh native evidence;do not report timing acceptance",
  );
