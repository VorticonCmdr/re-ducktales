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
  await load(
    process.argv.find((v) => v.startsWith("--manifest="))?.slice(11) ??
      "reference/mountain-frame-profile.json",
  ),
);
assert.equal(manifest.completedTimingAcceptance, false);
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
const detailed = manifest.profileKind === "draw-calls-and-cached-clock";
assert.ok(detailed || manifest.profileKind === undefined);
const stages = [
  ["before-erase", 0x1320],
  ["after-erase", 0x132a],
  ...(detailed
    ? [
        ["after-footer", 0x1335],
        ["after-money", 0x1356],
        ["after-hazards", 0x137d],
        ["after-actor", 0x13a1],
      ]
    : []),
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
  const totals = Array(stages.length + 1).fill(0);
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
    for (let j = 0; j < totals.length; j++) {
      assert.ok(clocks[j + 1] >= clocks[j]);
      totals[j] += clocks[j + 1] - clocks[j];
    }
    if (detailed) {
      const fine = [
        row.inputPicMilliseconds,
        ...row.stages.map((s) => s.picMilliseconds),
        row.nextInputPicMilliseconds,
      ];
      for (let j = 0; j < fine.length; j++) {
        assert.ok(Number.isFinite(fine[j]));
        if (j) assert.ok(fine[j] >= fine[j - 1]);
        // Independent resident counter and cached PIC observation may differ
        // by one resident counter phase plus one cached millisecond.
        const ticks = ((clocks[j] - clocks[0]) * 1365 * 12 * 1000) / 1193182;
        assert.ok(Math.abs(fine[j] - fine[0] - ticks) < 15);
      }
      if (i)
        assert.equal(
          row.inputPicMilliseconds,
          p.rows[i - 1].nextInputPicMilliseconds,
        );
    }
  }
  assert.deepEqual(totals, manifest.expectedSectionCounterTotals);
  assert.equal(
    totals.reduce((a, b) => a + b),
    manifest.expectedSectionCounterTotals.reduce((a, b) => a + b),
  );
  return totals;
}
const totals = verifyRows(profile);
assert.equal(measurement.completed, true);
assert.equal(
  measurement.counterDifference,
  totals.reduce((a, b) => a + b),
);
assert.equal(measurement.replay.active, false);
assert.equal(measurement.replay.remaining, 0);
assert.deepEqual(measurement.releaseBytes, [3, 0]);
assert.equal(state("release-edge", 0x31c).byte, 3);
assert.equal(state("release-neutral", 0x31c).byte, 0);
if (detailed) {
  assert.match(
    configuration.screen.text,
    /config -get dosbox vmem_delay\s*\noff/,
  );
  const control = artifacts["clock-control"];
  assert.equal(control.completed, true);
  assert.deepEqual(control.before, control.after);
  assert.equal(control.before.recording, true);
  assert.equal(control.before.paused, false);
  assert.equal(control.before.event_count, 0);
  assert.equal(control.before.truncated, false);
  assert.deepEqual(
    artifacts["clock-before"].state,
    artifacts["clock-after"].state,
  );
  assert.equal(artifacts["recorder-completion"].event_count, 0);
  assert.equal(artifacts["recorder-completion"].truncated, false);
  assert.deepEqual(artifacts["recorder-completion"].events, []);
}
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
