import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { originalGame } from "../tests/helpers/original-game.js";
import { Game } from "../src/game/application.js";
import { Scheduler } from "../src/game/scheduler.js";
import { destinationFooterWork } from "../src/game/destination-work.js";
import { DRIVER_HZ } from "../src/game/timing.js";
const sha = (b) => createHash("sha256").update(b).digest("hex");
const checked = async (p, h) => {
  let b;
  try {
    b = await readFile(p);
  } catch {
    throw Error("SETUP: missing " + p + ";see docs/destination-loop.md");
  }
  assert.equal(sha(b), h, "Changed evidence " + p);
  return b;
};
const manifest = JSON.parse(await readFile("reference/destination-loop.json"));
assert.equal(manifest.expectedReads, 16);
assert.equal(manifest.expectedFlagCheckpoints, 48);
assert.equal(manifest.expectedNativeWorkCases, 16);
assert.deepEqual(manifest.injections, []);
assert.deepEqual(manifest.fittedInputs, []);
const parent = JSON.parse(
  await checked(manifest.parent.path, manifest.parent.sha256),
);
assert.equal(parent.expectedReads, 16);
assert.equal(parent.expectedArtifacts, 233);
assert.equal(Object.keys(parent.artifacts).length, 233);
for (const spec of Object.values(parent.artifacts)) {
  const b = await checked(spec.path, spec.sha256);
  assert.equal(b.length, spec.bytes);
}
for (const [p, h] of Object.entries(manifest.sources)) await checked(p, h);
const original = await originalGame();
const exe = await readFile("game/DUCKTALE.EXE"),
  body = Buffer.from(exe.subarray(0xfa00, 0x11ab0));
const load = async (name) =>
  JSON.parse(await readFile(parent.artifacts[name].path));
const mapping = await load("map-resident-mapping.json"),
  overlay = await load("map-live-overlay.json");
const relocated = Buffer.from(body);
assert.equal(relocated.length, 8368);
assert.equal(exe.readUInt16LE(0xf606), 180);
for (let i = 0; i < 180; i++) {
  const p = 0xf600 + exe.readUInt16LE(0xf618) + 4 * i,
    at = exe.readUInt16LE(p) + (exe.readUInt16LE(p + 2) - 0xc17) * 16;
  assert.ok(at >= 0 && at < 8367);
  relocated.writeUInt16LE(
    (relocated.readUInt16LE(at) + mapping.load) & 65535,
    at,
  );
}
assert.equal(overlay.read.aborted, false);
assert.equal(overlay.read.results[0].status, "ok");
assert.deepEqual(
  Buffer.from(overlay.read.results[0].data, "base64"),
  relocated,
);
const raw = JSON.parse(
  await checked(manifest.static.path, manifest.static.sha256),
);
assert.equal(raw.isError, false);
const listing = JSON.parse(raw.content[0].text);
function checkStatic(s) {
  assert.equal(s.program, "OFFICE_MAP.EXE");
  assert.equal(s.truncated, false);
  assert.equal(s.instructions.length, 65);
  assert.equal(s.bytes_disassembled, 176);
  let next = 0x1e17;
  for (const row of s.instructions) {
    const at = parseInt(row.address.split(":")[1], 16);
    assert.equal(at, next);
    assert.equal(
      body.subarray(at, at + row.length).toString("hex"),
      row.bytes,
      "Static footer byte mismatch",
    );
    next += row.length;
  }
  assert.equal(next, 0x1ec7);
}
checkStatic(listing);
const broken = structuredClone(listing);
broken.instructions[10].bytes = "00";
assert.throws(() => checkStatic(broken), /Static footer byte/);
const profile = JSON.parse(
  await checked(parent.inputProfile, parent.profileSha256),
);
assert.equal(profile.noticeReads, 16);
assert.equal(Object.keys(profile.noticeEvents).length, 16);
const engine = await load("engine.json"),
  configuration = await load("configuration.json");
assert.equal(engine.version, "0.84.0-vc1 (f6d9b)");
assert.equal(engine.mcp_protocol, "1.14");
assert.equal(engine.capabilities.debugger.limits.effective_core, "normal");
assert.match(configuration.screen.text, /cpu_cycles[^\n]*\n3000\s*\n/);
assert.match(configuration.screen.text, /dosbox memsize[^\n]*\n16\s*\n/);
assert.match(configuration.screen.text, /dosbox machine[^\n]*\nsvga_s3\s*\n/);
const capture = await load("notice-capture.json");
assert.equal(capture.completed, true);
assert.equal(capture.partialRestore, false);
assert.deepEqual(capture.injections, []);
assert.equal(capture.replay.active, false);
assert.equal(capture.replay.remaining, 0);
function snapshot(r, ip) {
  assert.equal(r.state.aborted, false);
  assert.ok(r.state.results.every((x) => x.status === "ok"));
  assert.equal(r.stop.protected_mode, false);
  assert.equal(r.stop.core, "normal");
  const regs = r.state.results[0].registers,
    ds = Buffer.from(r.state.results[1].data, "base64");
  assert.equal(regs.cs, capture.segment);
  assert.equal(regs.ds, mapping.ds);
  assert.equal(regs.ss, mapping.ds);
  assert.equal(regs.eip, ip);
  assert.equal(ds.length, 65536);
  assert.equal(ds[0x3c1], 1);
  return { regs, ds };
}
const rows = [];
for (let i = 0; i < 16; i++) {
  const at = String(i).padStart(3, "0");
  rows.push({
    flush: snapshot(await load(`notice-${at}-flush.json`), 0x1193),
    before: snapshot(await load(`notice-${at}-before.json`), 0x11e9),
    after: snapshot(await load(`notice-${at}-input.json`), 0x11ee),
  });
}
const returned = snapshot(await load("notice-return.json"), 0x1227);
assert.equal(returned.regs.eax & 65535, 1);
const entries = original.archives.get("MAIN.ARC");
const footer = destinationFooterWork(entries, false),
  atomic = destinationFooterWork(entries, true);
assert.equal(footer.length, 5);
assert.equal(atomic.length, 6);
assert.equal(sha(JSON.stringify(footer)), manifest.footerWorkSha256);
assert.equal(sha(JSON.stringify(atomic)), manifest.atomicFooterWorkSha256);
function workCase(row, fault = false, index = 0) {
  const b = row.before.ds;
  const source = b.readUInt16LE(0x203a),
    dest = b.readUInt16LE(0x2038);
  assert.deepEqual(
    [
      b.readUInt16LE(source),
      b.readUInt16LE(source + 2),
      b.readUInt16LE(source + 8),
    ],
    [40, 200, 8000],
  );
  assert.deepEqual(
    [
      b.readUInt16LE(dest),
      b.readUInt16LE(dest + 2),
      b.readUInt16LE(dest + 6),
      b.readUInt16LE(dest + 8),
    ],
    [40, 200, index % 2 ? 0xa200 : 0xa000, 8000],
  );
  assert.notEqual(b.readUInt16LE(source + 6), 0xa000);
  assert.deepEqual(
    [b.readUInt16LE(0x1fec), b.readUInt16LE(0x1ff0)],
    [0x1ef, 0x35d],
  );
  for (const [index, at] of [
    [1, 0x6e2c],
    [2, 0x71c0],
    [3, 0x77c6],
    [4, 0x5d2c],
  ]) {
    const c = footer[index],
      entry = entries[c.asset];
    assert.deepEqual(
      [
        b.readInt16LE(at),
        b.readInt16LE(at + 2),
        b.readUInt16LE(at + 4) * 8,
        b.readUInt16LE(at + 6),
        b[at + 18],
      ],
      [c.x, c.y, entry.width, entry.height, 0],
      "Native footer descriptor",
    );
  }
  const counts =
    row.before.ds.readUInt32LE(0x2225) -
    row.flush.ds.readUInt32LE(0x2225) +
    (fault ? 100 : 0);
  const ms = footer.reduce((n, c) => n + c.milliseconds, 0);
  assert.ok(
    ms >= ((counts - 1) * 1000) / DRIVER_HZ &&
      ms <= ((counts + 1) * 1000) / DRIVER_HZ,
    "Native conditional footer budget outside counter-phase bracket",
  );
}
for (const [index, row] of rows.entries()) workCase(row, false, index);
assert.throws(
  () => workCase(rows[0], true),
  /Native conditional footer budget/,
);
const changedDescriptor = {
  ...rows[0],
  before: { ...rows[0].before, ds: Buffer.from(rows[0].before.ds) },
};
changedDescriptor.before.ds[0x6e2c] ^= 1;
assert.throws(() => workCase(changedDescriptor), /Native footer descriptor/);
const scan = {
  KBD_space: 0x39,
  KBD_enter: 0x1c,
  KBD_kpenter: 0x1c,
  KBD_i: 0x17,
  KBD_j: 0x24,
  KBD_k: 0x25,
  KBD_m: 0x32,
  KBD_up: 0x48,
  KBD_down: 0x50,
  KBD_left: 0x4b,
  KBD_right: 0x4d,
  KBD_kp7: 0x47,
  KBD_kp9: 0x49,
  KBD_kp4: 0x4b,
  KBD_kp5: 0x4c,
  KBD_kp6: 0x4d,
  KBD_kp1: 0x4f,
  KBD_kp2: 0x50,
  KBD_kp3: 0x51,
};
function compare(fault = null) {
  const g = new Game({
    destinationInput: "keyboard",
    locations: original.game.locations,
    loot: original.game.loot,
    expeditionResources: original.game.expeditionResources,
  });
  const scheduler = new Scheduler(g, 0);
  g.scene = "map";
  g.campaign.point(100, 100);
  g.input({ type: "fire" });
  const loop = g.campaign.destinationWaits;
  let flushes = 0,
    reads = 0,
    events = 0,
    flagChecks = 0;
  const beforeFlush = loop.flushInput,
    readByte = loop.readInputByte;
  function hardware(keys) {
    for (const key of keys ?? []) {
      assert.ok(scan[key.key] !== undefined);
      g.input({
        type: "map-key",
        scanCode: scan[key.key],
        pressed: key.pressed,
      });
      events++;
    }
  }
  loop.flushInput = () => {
    if (fault !== "skip-flush") beforeFlush();
    const row = rows[flushes];
    assert.ok(row, "Unexpected destination flush");
    assert.deepEqual(
      g.campaign.mapKeyboard.bytes(),
      Uint8Array.from(row.flush.ds.subarray(0x276c, 0x27ec)),
      "Native source flush flags",
    );
    flagChecks++;
    const spec = profile.noticeEvents[flushes];
    assert.ok(spec);
    hardware(fault === "missing-make" && flushes === 1 ? [] : spec.keys);
    flushes++;
  };
  loop.readInputByte = () => {
    const row = rows[reads];
    assert.ok(row, "Unexpected destination read");
    assert.deepEqual(
      g.campaign.mapKeyboard.bytes(),
      Uint8Array.from(row.before.ds.subarray(0x276c, 0x27ec)),
      "Native pre-reader flags",
    );
    flagChecks++;
    assert.equal(
      loop.choice,
      row.before.ds.readUInt16LE((row.before.regs.ebp - 0x7c) & 65535),
      "Native carried choice",
    );
    const byte = readByte();
    assert.equal(
      byte + (fault === "result" && reads === 0 ? 1 : 0),
      row.after.regs.eax & 65535,
      "Native destination byte",
    );
    assert.deepEqual(
      g.campaign.mapKeyboard.bytes(),
      Uint8Array.from(row.after.ds.subarray(0x276c, 0x27ec)),
      "Native post-reader flags",
    );
    flagChecks++;
    hardware(profile.noticeEvents[reads].afterKeys);
    reads++;
    return byte;
  };
  for (let i = 0; i < 6000 && !loop.outcome; i++)
    scheduler.advanceTo(scheduler.now + 1);
  assert.ok(loop.outcome, "Unfinished autonomous destination");
  assert.equal(reads, 16);
  assert.equal(flushes, 16);
  assert.equal(flagChecks, 48);
  assert.equal(
    events,
    Object.values(profile.noticeEvents).reduce(
      (n, e) => n + (e.keys?.length ?? 0) + (e.afterKeys?.length ?? 0),
      0,
    ),
  );
  assert.deepEqual(loop.outcome, { returnCode: 1, choice: 1 });
  assert.equal(g.scene, "departure");
  assert.equal(loop.completedCalls, 80);
  assert.deepEqual(
    g.campaign.mapKeyboard.bytes(),
    Uint8Array.from(returned.ds.subarray(0x276c, 0x27ec)),
    "Native final flush flags",
  );
  return {
    reads,
    flagChecks,
    events,
    footerMilliseconds: footer.reduce((n, c) => n + c.milliseconds, 0),
  };
}
const result = compare();
assert.throws(() => compare("missing-make"), /Native pre-reader flags/);
assert.throws(() => compare("skip-flush"), /Native source flush flags/);
assert.throws(() => compare("result"), /Native destination byte/);
console.log(
  "Destination loop:" +
    JSON.stringify(result) +
    ";16 conditional native drawing budgets,65 exact source instructions/full relocated8368-byte code,48 entire flag checkpoints and6 negative controls. Native timestamps never drive inputs;not uninterrupted native cadence or complete drawing cost.",
);
