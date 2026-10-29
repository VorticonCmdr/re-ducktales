// Fixed-schedule original observation, not exact CPU/flip checkpoints.
import assert from "node:assert/strict";
import { readFileSync as read } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { parseArchive } from "../src/assets.js";
import { FlightMemory } from "../src/game/flight-physics.js";
import { advanceMountainHazards } from "../src/game/mountain-hazards.js";
import { egaSpriteWork } from "../src/game/ega-work.js";
const sha = (b) => createHash("sha256").update(b).digest("hex");
const load = (p) => {
  try {
    return read(p);
  } catch {
    throw Error(`SETUP: missing original page-observer artifact ${p}`);
  }
};
const m = JSON.parse(load("reference/mountain-pages.json"));
assert.equal(m.completedTimingAcceptance, false);
assert.equal(sha(load("scripts/verify-mountain-pages.js")), m.verifierSha256);
const a = {};
for (const [role, v] of Object.entries(m.artifacts)) {
  const b = load(v.path);
  assert.equal(b.length, v.bytes, `Truncated ${role}`);
  assert.equal(sha(b), v.sha256, `Corrupt ${role}`);
  if (v.path.endsWith(".json")) a[role] = JSON.parse(b);
}
assert.equal(a.runner.completed, true);
assert.equal(a.runner.exitCode, 0);
assert.equal(a.runner.sourceCommit, m.captureCommit);
assert.equal(a.source.commit, m.captureCommit);
assert.equal(sha(load(m.artifacts.zip.path)), a.source.archiveSha256);
assert.equal(
  sha(
    execFileSync("git", ["archive", "--format=zip", m.captureCommit], {
      maxBuffer: 32 * 1024 * 1024,
    }),
  ),
  a.source.archiveSha256,
);
for (const file of [
  "scripts/capture-security.py",
  "scripts/capture_mountain_timing.py",
  "scripts/capture_mountain_pages.py",
  "scripts/mountain-page-observer.lua",
])
  assert.equal(
    sha(execFileSync("git", ["show", `${m.captureCommit}:${file}`])),
    a.source.files[file],
  );
assert.equal(a.capture.completed, true);
assert.equal(
  a.capture.scriptSha256,
  a.source.files["scripts/capture-security.py"],
);
assert.equal(a.capture.pid, a.engine.pid);
assert.equal(a.capture.instanceId, a.engine.instance_id);
assert.equal(a.engine.version, m.engineVersion);
assert.equal(a.engine.mcp_protocol, "1.14");
assert.equal(a.identity.executableSha256, m.engineBinarySha256);
assert.deepEqual(a.breakpoints, { breakpoints: [], count: 0 });
assert.equal(a.observation.completed, true);
assert.equal(a.observation.expectedSamples, 80);
assert.deepEqual(a.loaded, {
  load: { name: "mountain-page-observer", status: "loaded" },
  start: { status: "started" },
});
assert.equal(a.result.name, "mountain-page-observer");
assert.equal(a.observation.finalStopId, a.observation.initialStopId + 1);
for (const x of [a.observation, a.capture]) {
  assert.deepEqual(x.injections, []);
  assert.equal(x.partialRestore, false);
}
assert.deepEqual(
  [
    a.observation.replay.active,
    a.observation.replay.remaining,
    a.observation.replay.dispatched,
  ],
  [false, 0, 2],
);
assert.equal(a.observation.replay.engine, "frame");
assert.equal(
  a.configuration.commands,
  "config -get cpu cpu_cycles\nconfig -get cpu core\nconfig -get dosbox memsize\nconfig -get dosbox vmem_delay\nconfig -get dosbox machine\n",
);
for (const [query, value] of [
  ["cpu cpu_cycles", "3000"],
  ["dosbox memsize", "16"],
  ["dosbox vmem_delay", "off"],
  ["dosbox machine", "svga_s3"],
])
  assert.ok(
    a.configuration.screen.text.includes(`config -get ${query}`) &&
      new RegExp(`config -get ${query}\\s*\\n${value}`).test(
        a.configuration.screen.text,
      ),
  );
const build = JSON.parse(load("reference/build.json"));
assert.equal(sha(load("reference/build.json")), m.buildManifestSha256);
for (const [name, v] of Object.entries(build.files)) {
  const b = load(`game/${name}`);
  assert.equal(b.length, v.bytes, name);
  assert.equal(sha(b), v.sha256, name);
}
const code = a.code,
  exe = load("game/DUCKTALE.EXE"),
  at = 0x17600;
assert.equal(exe.readUInt16LE(at), 0x5a4d);
assert.equal(exe.readUInt16LE(at + 6), 68);
const size =
  (exe.readUInt16LE(at + 4) - 1) * 512 + (exe.readUInt16LE(at + 2) || 512);
const body = Buffer.from(
  exe.subarray(at + exe.readUInt16LE(at + 8) * 16, at + size),
);
assert.equal(body.length, 12002);
for (let i = 0; i < 68; i++) {
  const p = at + exe.readUInt16LE(at + 24) + i * 4,
    o = exe.readUInt16LE(p) + exe.readUInt16LE(p + 2) * 16 - 0xc170;
  body.writeUInt16LE((body.readUInt16LE(o) + code.load) & 65535, o);
}
assert.equal(code.read.aborted, false);
assert.deepEqual(Buffer.from(code.read.results[0].data, "base64"), body);
assert.equal(code.segment, code.load + 0xc17);
assert.equal(code.ds, code.load + 0x120e);
function memory(role, ip, segment = code.segment) {
  const x = a[role],
    r = x.state;
  assert.equal(r.aborted, false);
  assert.ok(r.results.every((v) => v.status === "ok"));
  const c = r.results[0].registers;
  assert.deepEqual([c.cs, c.ds, c.ss], [segment, code.ds, code.ds]);
  if (ip !== undefined) assert.equal(c.eip, ip);
  assert.equal(x.stop.core, "normal");
  assert.equal(x.stop.protected_mode, false);
  const bytes = Buffer.from(r.results[1].data, "base64");
  assert.equal(bytes.length, 65536);
  return { bytes, cpu: c, stop: x.stop };
}
const initial = memory("first", 0x31c),
  final = memory("final", undefined, a.driver.segment);
assert.ok(
  final.cpu.eip >= 0x64 && final.cpu.eip <= 0x71,
  "Final pause left validated EGA retrace routine",
);
assert.equal(initial.stop.stop_id, a.observation.initialStopId);
assert.equal(final.stop.stop_id, a.observation.finalStopId);
assert.equal(initial.cpu.eax & 255, 0);
assert.equal(final.bytes[0x27b9], 0);
const driver = Buffer.from(a.driver.read.results[0].data, "base64"),
  originalDriver = Buffer.from(parseArchive(load("game/IT.DRV"))[1].data);
assert.equal(a.driver.read.aborted, false);
assert.equal(driver.length, 2599);
assert.equal(sha(originalDriver), a.driver.originalSha256);
for (const [lo, hi] of [
  [0x64, 0x85],
  [0xe5, 0x101],
  [0x35d, 0x515],
])
  assert.deepEqual(driver.subarray(lo, hi), originalDriver.subarray(lo, hi));
assert.deepEqual(
  [
    initial.bytes.readUInt16LE(0x1fd4),
    initial.bytes.readUInt16LE(0x1fd6),
    initial.bytes.readUInt16LE(0x1ff0),
    initial.bytes.readUInt16LE(0x1ff2),
  ],
  [0xe5, a.driver.segment, 0x35d, a.driver.segment],
);
const template = execFileSync("git", [
  "show",
  `${m.captureCommit}:scripts/mountain-page-observer.lua`,
]).toString();
assert.equal(sha(Buffer.from(template)), a.script.templateSha256);
assert.equal(
  a.script.source,
  template
    .replace("__DS__", String(code.ds))
    .replace("__EGA__", String(a.driver.segment)),
);
assert.deepEqual(
  [
    ...new Set(
      [...a.script.source.matchAll(/dosbox\.([a-z_]+)\s*\(/g)].map((v) => v[1]),
    ),
  ].sort(),
  ["frame", "mem_read_byte", "mem_read_word", "wait_frames"],
);
function inputs(x) {
  assert.deepEqual(x.events, [
    { type: "key", key: "KBD_right", pressed: true, frame: 0 },
    { type: "key", key: "KBD_right", pressed: false, frame: 40 },
  ]);
  assert.equal(x.scheduled.events_scheduled, 2);
}
inputs(a.schedule);
// Scope the one-bit observer's alias bound to this fixed scene. Use original
// geometry/masks and the statically translated draw calls, never native timers
// to fit a workload. Minimum over every asset frame excludes pose selection.
for (const path of ["src/game/ega-work.js", "src/game/mountain-hazards.js"])
  assert.equal(sha(load(path)), m.workSources[path]);
const mt = parseArchive(load("game/MT.ARC")),
  main = parseArchive(load("game/MAIN.ARC"));
const mem = new FlightMemory(initial.bytes),
  shapes = [];
const assets = new Map(
  [5, 6, 7, 8, 9, 10, 11, 13, 14, 15].map((id, i) => [0x5804 + i * 20, id]),
);
advanceMountainHazards(
  mem,
  mem.b((initial.cpu.ebp & 65535) - 0x34),
  0,
  (at) => {
    assert.ok(assets.has(at));
    shapes.push({ asset: assets.get(at), x: mem.i(at), y: mem.i(at + 2) });
  },
  () => {
    throw Error("Unsupported sound in alias bound");
  },
  () => {
    throw Error("Unsupported HUD in alias bound");
  },
);
assert.deepEqual(shapes, m.expectedInitialHazardShapes);
const least = (entry, x, y) =>
  Math.min(
    ...Array.from(
      { length: entry.frames },
      (_, f) => egaSpriteWork(entry, f, x, y).instructions,
    ),
  );
const minimumSpriteMilliseconds =
  (egaSpriteWork(main[23], 0, 40, 172).instructions +
    shapes.reduce((sum, s) => sum + least(mt[s.asset], s.x, s.y), 0) +
    Math.min(...[16, 32, 48, 64].map((x) => least(mt[2], x, 131)))) /
  3000;
assert.ok(
  minimumSpriteMilliseconds > (2 * 1000) / 70.086,
  "One-bit page sampling could alias this scene",
);
function samples(result) {
  assert.equal(result.state, "completed");
  assert.equal(result.output_truncated, false);
  assert.equal(result.output.completed, true);
  assert.equal(result.output.expectedSamples, 80);
  const rows = Object.values(result.output.samples).sort(
    (a, b) => a.index - b.index,
  );
  assert.equal(rows.length, 80);
  const flips = [];
  for (let i = 0; i < rows.length; i++) {
    const s = rows[i];
    assert.equal(s.index, i + 1);
    assert.equal(s.frame, rows[0].frame + i);
    for (const key of [
      "clock",
      "page",
      "historyPage",
      "x",
      "y",
      "action",
      "actorFrame",
      "lives",
      "right",
      "seed",
    ])
      assert.ok(Number.isInteger(s[key]), key);
    assert.ok([0, 1].includes(s.page));
    assert.equal(s.historyPage, s.page ^ 1);
    assert.equal(s.y, 131);
    assert.ok([0, 1].includes(s.action)); // Original idle0 and walking1.
    // Walking completion clears action before its last pose4/9 is replaced.
    assert.ok(
      s.action === 0
        ? [4, 9, 20].includes(s.actorFrame)
        : s.actorFrame >= 0 && s.actorFrame <= 9,
    );
    assert.equal(s.lives, 3);
    assert.equal(s.seed, initial.bytes.readUInt16LE(0x2229));
    assert.ok([16, 32, 48, 64].includes(s.x));
    assert.ok([0, 64, 128].includes(s.right));
    if (i) {
      assert.ok(
        s.clock - rows[i - 1].clock >= 1 && s.clock - rows[i - 1].clock <= 2,
      );
      if (s.page !== rows[i - 1].page)
        flips.push({ before: rows[i - 1], after: s });
    }
  }
  assert.equal(rows[0].x, 16);
  assert.equal(rows.at(-1).x, 64);
  assert.equal(rows[0].right, 0);
  assert.equal(rows.at(-1).right, 0);
  assert.deepEqual(
    rows
      .filter((r, i) => !i || r.right !== rows[i - 1].right)
      .map((r) => r.right),
    [0, 128, 64, 0],
  );
  assert.deepEqual(
    flips.map((f) => f.after.index),
    m.expectedFlipSampleIndices,
  );
  assert.equal(flips.length, 26);
  assert.equal(rows.at(-1).clock - rows[0].clock, 82);
  const residentPeriod = (1365 * 12 * 1000) / 1193182;
  assert.ok(
    Math.abs(
      (rows.at(-1).clock - rows[0].clock) * residentPeriod -
        ((rows.length - 1) * 1000) / 70.086,
    ) < residentPeriod,
  );
  // Each transition is bracketed by adjacent observations, never assigned the
  // timestamp of its resulting state. Global cadence has one-sample uncertainty.
  const intervals = flips.length - 1;
  const minFrames = flips.at(-1).before.frame - flips[0].after.frame;
  const maxFrames = flips.at(-1).after.frame - flips[0].before.frame;
  assert.deepEqual([minFrames, maxFrames], [74, 76]);
  return {
    samples: rows.length,
    pageChanges: flips.length,
    intervals,
    meanMillisecondsRange: [minFrames, maxFrames].map(
      (v) => ((v / 70.086) * 1000) / intervals,
    ),
    minimumSpriteMilliseconds,
  };
}
const outcome = samples(a.result);
const omitted = structuredClone(a.result);
delete omitted.output.samples["10"];
assert.throws(() => samples(omitted), assert.AssertionError);
const altered = structuredClone(a.result);
altered.output.samples["11"].page ^= 1;
assert.throws(() => samples(altered), assert.AssertionError);
const missingRelease = structuredClone(a.schedule);
missingRelease.events.pop();
assert.throws(() => inputs(missingRelease), assert.AssertionError);
console.log(
  JSON.stringify(
    {
      ...outcome,
      negativeControls: 3,
      scope:
        "Original page-transition brackets with fixed inputs and no intermediate execution stops;not exact flip/input timestamps or browser acceptance",
      timingAcceptance: false,
    },
    null,
    2,
  ),
);
