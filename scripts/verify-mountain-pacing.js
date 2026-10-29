// Fresh native cadence evidence. This remains a conditional component check:
// original ENTRY memory is supplied, never an intermediate expected state/time.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { Mountain } from "../src/game/mountain.js";
import { FlightMemory } from "../src/game/flight-physics.js";
import { parseArchive } from "../src/assets.js";
import { unpackImage } from "../src/game/executable.js";
import { DRIVER_HZ, RETRACE_HZ } from "../src/game/application.js";
const sha = (b) => createHash("sha256").update(b).digest("hex");
const load = (p) =>
  readFile(p).catch(() => {
    throw Error(`SETUP: missing mountain pacing artifact ${p}`);
  });
export async function verifyFreshMountainPacing() {
  const m = JSON.parse(await load("reference/mountain-pacing.json"));
  assert.equal(m.completed, true);
  assert.equal(m.completedTimingAcceptance, false);
  assert.equal(m.expectedEngineReads, 15);
  assert.equal(m.expectedMeasuredIntervals, 14);
  assert.deepEqual(m.injections, []);
  assert.equal(m.partialRestore, false);
  assert.equal(
    sha(await load("scripts/verify-mountain-pacing.js")),
    m.verifierSha256,
  );
  for (const [name, a] of Object.entries(m.artifacts)) {
    const b = await load(a.path);
    assert.equal(b.length, a.bytes, name);
    assert.equal(sha(b), a.sha256, `Corrupt ${name}`);
  }
  const json = async (role) => JSON.parse(await load(m.artifacts[role].path));
  const result = await json("measurement"),
    runner = await json("runner"),
    source = await json("source"),
    capture = await json("capture"),
    engine = await json("engine");
  assert.equal(runner.completed, true);
  assert.equal(runner.exitCode, 0);
  assert.equal(runner.sourceCommit, m.captureCommit);
  assert.equal(source.commit, m.captureCommit);
  assert.equal(Object.keys(source.files).length, m.sourceFileCount);
  assert.equal(engine.version, "0.84.0-vc1 (f6d9b)");
  assert.equal(engine.mcp_protocol, "1.14");
  const configuration = await json("configuration"),
    pause = await json("pause-proof");
  assert.match(
    configuration.screen.text,
    /config -get cpu cpu_cycles\s*\n3000/,
  );
  assert.match(configuration.screen.text, /config -get dosbox memsize\s*\n16/);
  assert.match(
    configuration.screen.text,
    /config -get dosbox machine\s*\nsvga_s3/,
  );
  assert.equal(pause.completed, true);
  assert.ok(pause.hostMilliseconds >= 1000);
  assert.equal(pause.counterBefore, pause.counterAfter);
  assert.equal(capture.completed, true);
  assert.equal(capture.pid, engine.pid);
  assert.equal(capture.instanceId, engine.instance_id);
  assert.deepEqual(capture.injections, []);
  assert.equal(capture.partialRestore, false);
  assert.equal(
    capture.scriptSha256,
    source.files["scripts/capture-security.py"],
  );
  assert.equal(sha(await load(m.artifacts.zip.path)), source.archiveSha256);
  assert.equal(
    sha(
      execFileSync("git", ["archive", "--format=zip", source.commit], {
        maxBuffer: 32 * 1024 * 1024,
      }),
    ),
    source.archiveSha256,
  );
  for (const path of [
    "scripts/capture-security.py",
    "scripts/capture_mountain_timing.py",
  ])
    assert.equal(
      sha(execFileSync("git", ["show", `${source.commit}:${path}`])),
      source.files[path],
    );
  assert.equal(result.completed, true);
  assert.equal(result.measuredIntervals, 14);
  assert.equal(result.engineCountedReads, 15);
  assert.equal(result.observedInputBoundaries, 4);
  assert.equal(result.cleanupInputReads, 2);
  assert.deepEqual(result.releaseBytes, [3, 0]);
  assert.deepEqual(result.injections, []);
  assert.equal(result.partialRestore, false);
  assert.equal(result.replay.active, false);
  assert.equal(result.replay.remaining, 0);
  const contract = await json("flight-contract");
  assert.equal(contract.racing, 0);
  assert.equal(contract.duration, 1);
  const code = await json("code"),
    loadBias = code.load,
    ds = code.ds,
    segment = code.segment;
  assert.equal(segment, loadBias + 0xc17);
  assert.equal(ds, loadBias + 0x120e);
  const state = async (role, ip) => {
    const x = await json(role),
      r = x.state;
    assert.equal(r.aborted, false);
    assert.equal(r.results.length, 2);
    assert.ok(r.results.every((v) => v.status === "ok"));
    const c = r.results[0].registers;
    assert.deepEqual([c.cs, c.eip, c.ds, c.ss], [segment, ip, ds, ds]);
    assert.equal(x.stop.protected_mode, false);
    assert.equal(x.stop.core, "normal");
    const bytes = Buffer.from(r.results[1].data, "base64");
    assert.equal(bytes.length, 65536);
    return { raw: x, cpu: c, bytes };
  };
  const entry = await state("entry", 0),
    first = await state("first", 0x31c),
    last = await state("last", 0x31c),
    firstBody = await state("first-body", 0x145d),
    lastBody = await state("last-body", 0x145d),
    edge = await state("release-edge", 0x31c),
    neutral = await state("release-neutral", 0x31c);
  assert.deepEqual(
    [
      first.cpu.eax & 255,
      last.cpu.eax & 255,
      edge.cpu.eax & 255,
      neutral.cpu.eax & 255,
    ],
    [0, 3, 3, 0],
  );
  assert.equal(first.bytes[0x27b9], 0);
  assert.equal(firstBody.bytes[0x27b9], 128);
  assert.equal(last.bytes[0x27b9], 128);
  assert.equal(lastBody.bytes[0x27b9], 64);
  assert.equal(edge.bytes[0x27b9], 0);
  assert.equal(neutral.bytes[0x27b9], 0);
  assert.equal(last.raw.stop.breakpoint.hit_count, 14);
  for (const x of [first, last, edge, neutral])
    assert.equal(x.bytes[0x4d34], 3);
  const start = first.bytes.readUInt32LE(0x2225),
    end = last.bytes.readUInt32LE(0x2225);
  assert.equal(result.counterBefore, start);
  assert.equal(result.counterAfter, end);
  assert.equal(end - start, m.expectedCounterDifference);
  assert.equal(result.counterDifference, end - start);
  assert.ok(firstBody.bytes.readUInt32LE(0x2225) > start);
  assert.ok(lastBody.bytes.readUInt32LE(0x2225) > end);
  const build = JSON.parse(await load("reference/build.json")),
    files = {};
  for (const [name, a] of Object.entries(build.files)) {
    const b = await load(`game/${name}`);
    assert.equal(b.length, a.bytes);
    assert.equal(sha(b), a.sha256);
    files[name] = b;
  }
  const exe = files["DUCKTALE.EXE"],
    at = 0x17600;
  assert.equal(exe.readUInt16LE(at), 0x5a4d);
  assert.equal(exe.readUInt16LE(at + 6), 68);
  const length =
      (exe.readUInt16LE(at + 4) - 1) * 512 + (exe.readUInt16LE(at + 2) || 512),
    original = Buffer.from(
      exe.subarray(at + 16 * exe.readUInt16LE(at + 8), at + length),
    );
  assert.equal(original.length, 12002);
  for (let i = 0; i < 68; i++) {
    const p = at + exe.readUInt16LE(at + 24) + 4 * i,
      o = exe.readUInt16LE(p) + 16 * exe.readUInt16LE(p + 2) - 0xc170;
    original.writeUInt16LE((original.readUInt16LE(o) + loadBias) & 65535, o);
  }
  assert.equal(code.read.aborted, false);
  assert.deepEqual(Buffer.from(code.read.results[0].data, "base64"), original);
  const memory = new FlightMemory(entry.bytes),
    bp = entry.cpu.esp - 2,
    offsets = [0x5ae0, 0x5c72, 0x5c70, 0x54f6, 0x6882, 0x6d3c, 0x3d12, 0x2229];
  const observations = [];
  let now = 0,
    g;
  const inputs = Array.from({ length: 15 }, (_, i) => (i ? 3 : 0));
  g = new Mountain(
    {
      image: unpackImage(exe),
      entries: parseArchive(files["MT.ARC"]),
      mainEntries: parseArchive(files["MAIN.ARC"]),
      variant: entry.bytes.readUInt16LE(entry.cpu.esp + 4),
      difficulty: memory.b(0x8990),
      day: memory.b(0x4e0e),
      money: memory.view.getUint32(0x8cc0, true),
      seed: memory.view.getUint16(0x2229, true),
      stackBytes: entry.bytes.subarray(bp - 0x52, bp),
      pollInput: () => {
        assert.ok(
          observations.length < inputs.length,
          "Unexpected extra port input",
        );
        g.setControls({
          fire: false,
          direction: inputs[observations.length] === 3 ? "right" : null,
        });
        observations.push({ at: now, fields: offsets.map((o) => memory.i(o)) });
        return true;
      },
    },
    memory,
  );
  let tick = 1000 / DRIVER_HZ,
    retrace = 1000 / RETRACE_HZ;
  for (let n = 0; n < 2000 && observations.length < inputs.length; n++) {
    now = Math.min(tick, retrace);
    if (tick <= retrace) {
      g.advanceTick();
      tick += 1000 / DRIVER_HZ;
    } else {
      g.advanceRetrace();
      retrace += 1000 / RETRACE_HZ;
    }
  }
  assert.equal(observations.length, 15);
  assert.equal(g.inputs.length, 15);
  assert.equal(g.frames, 15);
  assert.equal(g.outcome, null);
  assert.deepEqual(
    g.inputs.map((i) => i.input),
    inputs,
  );
  const compare = (actual, expected) =>
    assert.deepEqual(
      actual,
      offsets.map((o) => expected.bytes.readInt16LE(o)),
      "Fresh native movement/RNG endpoint",
    );
  compare(observations[0].fields, first);
  compare(observations.at(-1).fields, last);
  const damaged = [...observations.at(-1).fields];
  damaged[0]++;
  assert.throws(() => compare(damaged, last));
  assert.throws(() =>
    assert.equal(end - start + 1, m.expectedCounterDifference),
  );
  const nativeMilliseconds = ((end - start) * 1000) / DRIVER_HZ,
    portMilliseconds = observations.at(-1).at - observations[0].at;
  return {
    scope:
      "Fresh original counted cadence;two named state/RNG endpoints match conditional component replay. Intermediate native AL values inferred from held Right and mode0,not individually captured. Not uninterrupted scanout or native whole-level parity.",
    source: m.captureCommit,
    measuredIntervals: 14,
    nativeCounters: end - start,
    nativeMilliseconds,
    portMilliseconds,
    speedRatio: nativeMilliseconds / portMilliseconds,
    releaseBytes: result.releaseBytes,
    guestInjections: [],
    timingParity:
      Math.abs(nativeMilliseconds - portMilliseconds) <= 1000 / DRIVER_HZ,
  };
}
