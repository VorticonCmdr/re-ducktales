// Original-only timing evidence, deliberately separate from browser acceptance.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const sha = (b) => createHash("sha256").update(b).digest("hex");
const load = async (path) => {
  try {
    return await readFile(path);
  } catch {
    throw Error(`SETUP: missing mountain profile artifact ${path}`);
  }
};
const manifest = JSON.parse(
  await load("reference/mountain-frame-profile.json"),
);
assert.equal(
  sha(await load("scripts/verify-mountain-frame-profile.js")),
  manifest.verifierSha256,
);
const artifacts = {};
for (const [name, a] of Object.entries(manifest.artifacts)) {
  const bytes = await load(a.path);
  assert.equal(bytes.length, a.bytes, `Truncated ${name}`);
  assert.equal(sha(bytes), a.sha256, `Corrupt ${name}`);
  if (a.path.endsWith(".json")) artifacts[name] = JSON.parse(bytes);
}
const {
  runner,
  source,
  capture,
  engine,
  code,
  profile,
  measurement,
  identity,
  configuration,
} = artifacts;
assert.equal(runner.completed, true);
assert.equal(runner.exitCode, 0);
assert.equal(runner.sourceCommit, manifest.captureCommit);
assert.equal(source.commit, manifest.captureCommit);
assert.equal(
  sha(await load(manifest.artifacts.zip.path)),
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
for (const name of [
  "scripts/capture-security.py",
  "scripts/capture_mountain_timing.py",
])
  assert.equal(
    sha(execFileSync("git", ["show", `${source.commit}:${name}`])),
    source.files[name],
  );
assert.equal(capture.scriptSha256, source.files["scripts/capture-security.py"]);
assert.equal(capture.completed, true);
assert.deepEqual(capture.injections, []);
assert.equal(capture.partialRestore, false);
assert.equal(capture.pid, engine.pid);
assert.equal(capture.instanceId, engine.instance_id);
assert.equal(engine.version, manifest.engineVersion);
assert.equal(engine.mcp_protocol, "1.14");
assert.equal(identity.executableSha256, manifest.engineBinarySha256);
assert.match(configuration.screen.text, /config -get cpu cpu_cycles\s*\n3000/);
assert.match(
  configuration.screen.text,
  /config -get dosbox machine\s*\nsvga_s3/,
);
assert.match(configuration.screen.text, /config -get dosbox memsize\s*\n16/);
const build = JSON.parse(await load("reference/build.json"));
assert.equal(
  sha(await load("reference/build.json")),
  manifest.buildManifestSha256,
);
for (const [name, expected] of Object.entries(build.files)) {
  const bytes = await load(`game/${name}`);
  assert.equal(bytes.length, expected.bytes, name);
  assert.equal(sha(bytes), expected.sha256, name);
}
const exe = await load("game/DUCKTALE.EXE"),
  at = 0x17600;
assert.equal(exe.readUInt16LE(at), 0x5a4d);
assert.equal(exe.readUInt16LE(at + 6), 68);
const length =
  (exe.readUInt16LE(at + 4) - 1) * 512 + (exe.readUInt16LE(at + 2) || 512);
const original = Buffer.from(
  exe.subarray(at + exe.readUInt16LE(at + 8) * 16, at + length),
);
assert.equal(original.length, 12002);
for (let i = 0; i < 68; i++) {
  const p = at + exe.readUInt16LE(at + 24) + i * 4;
  const o = exe.readUInt16LE(p) + exe.readUInt16LE(p + 2) * 16 - 0xc170;
  original.writeUInt16LE((original.readUInt16LE(o) + code.load) & 65535, o);
}
assert.equal(code.segment, code.load + 0xc17);
assert.equal(code.ds, code.load + 0x120e);
assert.equal(code.read.aborted, false);
assert.deepEqual(Buffer.from(code.read.results[0].data, "base64"), original);
const stages = [
  ["before-erase", 0x1320],
  ["after-erase", 0x132a],
  ["after-draw", 0x1436],
  ["before-flip", 0x145d],
];
function state(name, ip) {
  const x = artifacts[name],
    r = x.state;
  assert.equal(r.aborted, false);
  assert.equal(r.results.length, 2);
  assert.ok(r.results.every((v) => v.status === "ok"));
  const c = r.results[0].registers;
  assert.deepEqual(
    [c.cs, c.eip, c.ds, c.ss],
    [code.segment, ip, code.ds, code.ds],
  );
  assert.equal(x.stop.protected_mode, false);
  assert.equal(x.stop.core, "normal");
  const bytes = Buffer.from(r.results[1].data, "base64");
  assert.equal(bytes.length, 65536);
  assert.equal(bytes[0x4d34], 3);
  return { clock: bytes.readUInt32LE(0x2225), byte: c.eax & 255 };
}
function verifyRows(p) {
  assert.equal(p.completed, true);
  assert.equal(p.expectedFrames, 14);
  assert.equal(p.rows.length, 14);
  assert.deepEqual(p.injections, []);
  assert.equal(p.partialRestore, false);
  const totals = [0, 0, 0, 0, 0];
  for (let i = 0; i < 14; i++) {
    const row = p.rows[i],
      prefix = `frame-${String(i).padStart(2, "0")}`;
    assert.equal(row.index, i);
    assert.equal(row.stages.length, stages.length);
    const input = state(i === 0 ? "first" : `input-${i}`, 0x31c);
    assert.equal(input.byte, i === 0 ? 0 : 3);
    assert.equal(row.inputByte, input.byte);
    assert.equal(row.inputClock, input.clock);
    const clocks = [input.clock];
    for (let j = 0; j < stages.length; j++) {
      const [name, ip] = stages[j],
        s = row.stages[j];
      assert.deepEqual([s.name, s.ip], [name, ip]);
      assert.equal(s.clock, state(`${prefix}-${name}`, ip).clock);
      clocks.push(s.clock);
    }
    const next = state(`input-${i + 1}`, 0x31c);
    assert.equal(next.byte, 3);
    assert.equal(row.nextInputClock, next.clock);
    clocks.push(next.clock);
    for (let j = 0; j < 5; j++) {
      assert.ok(clocks[j + 1] >= clocks[j]);
      totals[j] += clocks[j + 1] - clocks[j];
    }
  }
  assert.deepEqual(totals, manifest.expectedSectionCounterTotals);
  assert.equal(
    totals.reduce((a, b) => a + b),
    44,
  );
  return totals;
}
const totals = verifyRows(profile);
assert.equal(measurement.completed, true);
assert.equal(measurement.counterDifference, 44);
assert.equal(measurement.replay.active, false);
assert.equal(measurement.replay.remaining, 0);
assert.deepEqual(measurement.releaseBytes, [3, 0]);
assert.equal(state("release-edge", 0x31c).byte, 3);
assert.equal(state("release-neutral", 0x31c).byte, 0);
// Checker controls mutate copies only; no original capture is changed.
const omitted = structuredClone(profile);
omitted.rows.splice(4, 1);
assert.throws(() => verifyRows(omitted), assert.AssertionError);
const changed = structuredClone(profile);
changed.rows[4].stages[2].clock++;
assert.throws(() => verifyRows(changed), assert.AssertionError);
console.log(
  JSON.stringify({
    evidenceVerified: true,
    frames: 14,
    sectionCounterTotals: totals,
    negativeControls: 2,
    timingAcceptance: false,
  }),
);
