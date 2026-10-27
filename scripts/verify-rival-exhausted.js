import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import { advanceRival } from "../src/game/rival.js";
import { parseArchive, imagePixels } from "../src/assets.js";
import { unpackImage, executableText } from "../src/game/executable.js";
import { capture, sameBytes } from "./verify-investments.js";
import build from "../reference/build.json" with { type: "json" };
const manifest = JSON.parse(
    await readFile("reference/rival-exhausted.json", "utf8"),
  ),
  raw = {},
  files = {};
const hash = (b) => createHash("sha256").update(b).digest("hex");
assert.equal(manifest.expectedCaseCount, 2);
assert.equal(manifest.expectedCheckpointCount, 5);
assert.equal(Object.keys(manifest.artifacts).length, 13);
assert.deepEqual(manifest.fittedInputs, []);
assert.deepEqual(manifest.inputEvents, []);
for (const [name, item] of Object.entries(manifest.artifacts)) {
  const b = await readFile(item.path).catch(() => {
    throw Error(`SETUP: missing ${item.path}; see docs/rival.md`);
  });
  assert.equal(hash(b), item.sha256, `corrupt ${item.path}`);
  raw[name] = item.path.endsWith(".json") ? JSON.parse(b) : b;
}
for (const name of ["DUCKTALE.EXE", "MAIN.ARC"]) {
  const b = (files[name] = await readFile(`game/${name}`));
  assert.equal(b.length, build.files[name].bytes);
  assert.equal(hash(b), build.files[name].sha256);
}
const exe = files["DUCKTALE.EXE"],
  image = Buffer.from(unpackImage(exe)),
  relocated = Buffer.from(image);
let at = exe.readUInt16LE(8) * 16 + exe.readUInt16LE(22) * 16 + 0x125;
for (let region = 0; region < 16; region++) {
  const count = exe.readUInt16LE(at);
  at += 2;
  for (let i = 0; i < count; i++, at += 2) {
    const p = region * 65536 + exe.readUInt16LE(at);
    relocated.writeUInt16LE((relocated.readUInt16LE(p) + 0x1f5) & 65535, p);
  }
}
const setup = capture(raw.beforeSetup, 4, 0x4608),
  miss = capture(raw.missBefore, 2, 0x4608),
  selected = capture(raw.missSelected, 2, 0x4678),
  missAfter = capture(raw.missAfter, 2, 0x4928),
  claimSetup = capture(raw.claimBeforeSetup, 2, 0x4608),
  claim = capture(raw.claimBefore, 2, 0x4608),
  report = capture(raw.claimReport, 2, 0x4897),
  claimAfter = capture(raw.claimAfter, 2, 0x4928);
assert.equal(setup.results[2].addr, 0x4608);
assert.equal(setup.results[3].addr, 0x2fd0);
sameBytes(
  Buffer.from(setup.results[2].data, "base64"),
  relocated.subarray(0x26b8, 0x26b8 + 1275),
  "exhausted rival complete code",
);
sameBytes(
  Buffer.from(setup.results[3].data, "base64"),
  relocated.subarray(0x1080, 0x1242),
  "exhausted rival travel code",
);
assert.equal(raw.mode.isError, false);
const mode = JSON.parse(raw.mode.content[0].text);
assert.equal(mode.debugging, true);
assert.equal(mode.stop.stop_id, 560);
assert.equal(mode.stop.protected_mode, false);
assert.equal(mode.stop.core, "normal");
let checked = 1;
const injected = Buffer.from(setup.bytes);
for (let i = 1; i < 35; i++) injected[0x4e30 + i * 8] = 1;
injected.writeUInt16LE(0, 0x2229);
sameBytes(miss.bytes, injected, "exact exhausted miss setup");
const nextSetup = Buffer.from(claimSetup.bytes);
nextSetup.writeUInt16LE(56, 0x2229);
sameBytes(claim.bytes, nextSetup, "exact exhausted claim setup");
assert.equal(setup.bytes.readUInt16LE(0x2229), 56053);
assert.equal(claimSetup.bytes.readUInt16LE(0x2229), 17689);
assert.equal(raw.setup.result.isError, false);
const mutations = JSON.parse(raw.setup.result.content[0].text);
assert.equal(mutations.aborted, false);
assert.equal(mutations.results.length, 35);
assert.ok(mutations.results.every((r) => r.status === "ok"));
assert.equal(raw.setup.request.ops.length, 35);
for (let i = 0; i < 34; i++)
  assert.deepEqual(raw.setup.request.ops[i], {
    op: "mem_cas",
    segment: 0x1403,
    offset: 0x4e30 + (i + 1) * 8,
    expected: setup.bytes
      .subarray(0x4e30 + (i + 1) * 8, 0x4e31 + (i + 1) * 8)
      .toString("base64"),
    data: "AQ==",
  });
assert.deepEqual(raw.setup.request.ops[34], {
  op: "mem_cas",
  segment: 0x1403,
  offset: 0x2229,
  expected: setup.bytes.subarray(0x2229, 0x222b).toString("base64"),
  data: "AAA=",
});
assert.deepEqual(raw.claimSetup.request, {
  segment: 0x1403,
  offset: 0x2229,
  expected: claimSetup.bytes.subarray(0x2229, 0x222b).toString("base64"),
  data: "OAA=",
});
assert.equal(raw.claimSetup.result.isError, false);
assert.equal(JSON.parse(raw.claimSetup.result.content[0].text).status, "ok");
assert.equal(raw.navigationReplay.isError, false);
const replay = JSON.parse(raw.navigationReplay.content[0].text);
assert.equal(replay.active, false);
assert.equal(replay.remaining, 0);
assert.equal(replay.total, 2);
assert.equal(replay.dispatched, 2);
checked++;

function state(b) {
  const loot = [],
    locations = Array.from({ length: 35 }, (_, i) => {
      const p = b.readUInt16LE(0x4e2a + i * 8),
        l = b.readUInt16LE(0x4e2c + i * 8);
      assert.ok(p >= 0x71f6 && p + 40 <= 65536);
      assert.ok(l >= 0x6f52 && l + 4 <= 65536);
      loot.push({ value: b.readInt16LE(l + 2) });
      return {
        x: b.readInt16LE(p + 32),
        y: b.readInt16LE(p + 34),
        treasure: i + 1,
        playerCollected: !!b[0x4e30 + i * 8],
        rivalCollected: !!b[0x4e31 + i * 8],
      };
    });
  return {
    day: b[0x4e0e],
    difficulty: b[0x8990],
    unlockMask: b[0x96ba],
    seed: b.readUInt16LE(0x2229),
    rival: {
      day: b[0x715e],
      location: b[0x581],
      money: b.readUInt32LE(0x4e0a),
      banked: b.readUInt32LE(0x54f2),
    },
    locations,
    loot,
  };
}
function compare(
  before,
  after,
  { omitFlag = false, alterResult = false, omitAlias = false } = {},
) {
  const s = state(before.bytes),
    expected = state(after.bytes);
  assert.equal(
    s.locations.slice(1).filter((l) => l.playerCollected).length,
    34,
  );
  if (omitFlag) {
    assert.equal(s.locations[2].rivalCollected, false);
    s.locations[2].playerCollected = false;
  }
  const result = advanceRival({ ...s, memory: before.m });
  assert.equal(result.target, 35, "required exhausted destination");
  if (alterResult) s.rival.money++;
  if (omitAlias) before.m.b(0x4f49, 255);
  assert.equal(result.seed, expected.seed, "exhausted rival RNG");
  assert.deepEqual(s.rival, expected.rival, "exhausted rival fields");
  assert.deepEqual(
    s.locations,
    expected.locations,
    "normal collection flags unchanged",
  );
  sameBytes(
    before.m.bytes.subarray(0x4f42, 0x4f4a),
    after.bytes.subarray(0x4f42, 0x4f4a),
    "exhausted alias bytes",
  );
  return result;
}
assert.equal(selected.cpu.eax & 65535, 35);
const missResult = compare(miss, missAfter);
assert.equal(missResult.kind, "miss");
assert.equal(missResult.draws, 2);
assert.equal(missResult.report, null);
assert.equal(missResult.seed, 13458);
checked++;
const claimResult = compare(claim, claimAfter);
assert.equal(claimResult.kind, "claim");
assert.equal(claimResult.draws, 3);
assert.equal(claimResult.report.value, 0);
assert.equal(claimResult.report.name.length, 50);
assert.equal(claimResult.report.name.charCodeAt(49), 17);
assert.equal(claimResult.seed, 29915);
assert.equal(report.bytes[0x358e], 35);
assert.equal(report.bytes.readUInt16LE(0x2229), claimResult.seed);
assert.equal(report.bytes[0x4f49], 1);
assert.equal(report.bytes.readUInt32LE(0x4e0a), 0);
sameBytes(
  report.bytes.subarray(0x4f42, 0x4f4a),
  claimAfter.bytes.subarray(0x4f42, 0x4f4a),
  "report alias survives return",
);
checked++;
function fresh(c) {
  return {
    ...c,
    m: capture(c === claim ? raw.claimBefore : raw.missBefore, 2, 0x4608).m,
  };
}
assert.throws(
  () => compare(fresh(miss), missAfter, { omitFlag: true }),
  /required exhausted destination/,
);
assert.throws(
  () => compare(fresh(miss), missAfter, { alterResult: true }),
  /exhausted rival fields/,
);
assert.throws(
  () => compare(fresh(claim), claimAfter, { omitAlias: true }),
  /exhausted alias bytes/,
);

const entries = parseArchive(files["MAIN.ARC"]),
  font = entries[42].data;
function render(linear = true) {
  const pixels = Uint8Array.from(imagePixels(entries[33]));
  function text(s, x, y) {
    for (const c of s) {
      for (let row = 0; row < 8; row++)
        for (let col = 0; col < 8; col++)
          if (font[8 + c.charCodeAt(0) * 8 + row] & (128 >> col)) {
            if (linear || x + col < 320)
              pixels.set([255, 255, 255, 255], ((y + row) * 320 + x + col) * 4);
          }
      x += 8;
    }
  }
  for (const [p, y] of [
    [0x52c, 60],
    [0x538, 76],
    [0x562, 100],
    [0x571, 116],
  ])
    text(executableText(image, p), 168, y);
  const name = claimResult.report.name;
  text(name, 224 - name.length * 4, 132);
  text(executableText(image, 0x57f), 224 + name.length * 4, 132);
  return pixels;
}
const png = PNG.sync.read(raw.reportPNG);
assert.deepEqual([png.width, png.height], [320, 200]);
sameBytes(png.data, render(), "exact exhausted rival report");
assert.throws(
  () => sameBytes(png.data, render(false), "required EGA text spill"),
  /required EGA text spill/,
);
const bad = render();
bad[0] ^= 1;
assert.throws(
  () => sameBytes(png.data, bad, "negative exhausted report pixel"),
  /negative exhausted report pixel/,
);
checked++;
assert.equal(checked, manifest.expectedCheckpointCount);
console.log(
  "Exhausted rival:2 conditional original cases,5 required checkpoints,complete code/alias identities,one exact full report PNG and5 negative controls. Conditional collected flags/seeds are explicit; no natural exhausted campaign replay claimed.",
);
