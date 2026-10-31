// Conditional original primitive RGBA,not natural bank/game timing or hidden
// EGA-page aliasing. Inputs/RAM pattern are independent of expected pixels.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { PNG } from "pngjs";
import { EGA } from "../src/assets.js";
import { originalGame } from "../tests/helpers/original-game.js";
import { bankSparkleCopyBytes } from "../src/game/bank-sparkle-copy.js";
import { json, sha, checkArtifacts } from "./lib/local-scenario-source.js";
import { validateProducerArchive } from "./lib/consumer-provenance.js";
const m = await json("reference/bank-copy-pixels.json");
assert.equal(m.kind, "conditional-original-bank-copy-pixels");
assert.equal(m.wholeGameComparison, false);
assert.equal(m.requiredCases, 6);
assert.equal(m.requiredNegativeControls, 8);
await checkArtifacts(m.artifacts);
const source = await validateProducerArchive(m.producer),
  capture = await json(m.artifacts.capture.path),
  input = await json(m.artifacts.inputs.path),
  lifecycle = await json(m.artifacts.lifecycle.path),
  startup = await json(m.artifacts.startup.path),
  parked = await json(m.artifacts.parked.path);
assert.equal(source.commit, m.captureToolRevision);
const configuration = await json(m.artifacts.configuration.path);
assert.equal(configuration.port, 8403);
assert.notEqual(configuration.port, 8386);
assert.equal(configuration.portableBinarySHA256, m.artifacts.binary.sha256);
assert.equal(configuration.binary.sha256, m.artifacts.binary.sha256);
assert.equal(configuration.configSHA256, m.artifacts.portableConfig.sha256);

assert.equal(capture.completed, true);
assert.equal(capture.accepted, false);
assert.equal(capture.oneCase, false);
assert.equal(capture.cases, 6);
assert.equal(lifecycle.terminal, true);
assert.equal(lifecycle.ownedPID, capture.pid);
assert.equal(lifecycle.sharedSessionChanged, false);
assert.equal(startup.program.program, "PARK");
assert.equal(parked.stop.registers.eip, 0x109);
assert.equal(parked.stop.registers.flags & 0x601, 0);
assert.equal(startup.parkBytes, "bb0010b44acd21fafcebfe");
assert.equal(
  sha(Buffer.from(parked.code.results[0].data, "base64")),
  startup.parkSHA256,
);
const original = await originalGame(),
  driver = Buffer.from(original.archives.get("IT.DRV")[1].data);
assert.equal(sha(driver), input.driverSHA256);
assert.equal(sha(driver), capture.driverSHA256);
assert.deepEqual(input.sourcePattern, {
  seed: 107,
  planes: 4,
  planeBytes: 8000,
  formula: "((i%8000)*17+((i%8000)>>5)*11+(i//8000)*53+seed)&255",
});
assert.deepEqual(
  [
    input.sourceStrideBytes,
    input.destinationStrideBytes,
    input.sourceVideo,
    input.destinationVideo,
    input.destinationSegment,
    input.sourceOffset,
    input.destinationOffset,
    input.BIOSVideoMode,
  ],
  [40, 40, false, true, 0xa000, 0x1000, 0, 13],
);
const required = [
  [248, -13],
  [248, -19],
  [248, -18],
  [248, 195],
  [312, 0],
  [248, 0],
].map(([x, y]) => ({ x, y, width: 32, height: 18 }));
assert.deepEqual(input.cases, required);
const pattern = Buffer.from(
  Array.from(
    { length: 32000 },
    (_, i) =>
      ((i % 8000) * 17 +
        ((i % 8000) >> 5) * 11 +
        Math.floor(i / 8000) * 53 +
        107) &
      255,
  ),
);
assert.equal(sha(pattern), input.sourceSHA256);
const data = await Promise.all(
  required.map(async (_, i) => ({
    packet: await json(m.artifacts["case" + i].path),
    png: await readFile(m.artifacts["png" + i].path),
  })),
);
function compare(values, { omitByte = false, changedPixel = false } = {}) {
  assert.equal(values.length, 6, "Zero/missing native pixel cases");
  for (const [i, { packet: p, png }] of values.entries()) {
    const c = required[i];
    assert.equal(p.index, i);
    assert.deepEqual(p.input, c);
    const args = [18, 32, c.y, c.x, 0x2000, c.y, c.x, 0x2020];
    assert.deepEqual(p.args, args);
    assert.equal(p.entry.satisfied, true);
    assert.equal(p.returned.satisfied, true);
    assert.equal(p.entry.protected_mode, false);
    const seg = p.entry.registers.cs;
    assert.equal(p.entry.registers.ds, seg);
    assert.equal(p.entry.registers.ss, seg);
    assert.equal(p.entry.registers.eip, 0x1ef);
    assert.equal(p.entry.registers.esp, 0xfedc);
    assert.equal(p.entry.registers.flags & 0x600, 0);
    assert.equal(p.returned.registers.cs, seg);
    assert.equal(p.returned.registers.eip, 0x4024);
    assert.equal(
      p.returned.registers.esp,
      0xfef0,
      "Original far return did not restore stack",
    );
    assert.equal(p.entryMemory.aborted, false);
    assert.equal(p.entryMemory.results.length, 3);
    for (const r of p.entryMemory.results) assert.equal(r.status, "ok");
    const code = Buffer.from(driver);
    code.writeUInt16LE(0x2000, 0x1e);
    assert.equal(
      sha(Buffer.from(p.entryMemory.results[0].data, "base64")),
      sha(code),
      "Original driver code changed",
    );
    assert.equal(
      sha(Buffer.from(p.entryMemory.results[1].data, "base64")),
      sha(pattern),
      "Authored RAM source changed",
    );
    const stack = Buffer.from(p.entryMemory.results[2].data, "base64");
    assert.equal(stack.length, 16);
    assert.deepEqual(
      Array.from({ length: 8 }, (_, j) => stack.readUInt16LE(j * 2)),
      args.map((v) => v & 65535),
      "Original consumed stack words",
    );
    assert.deepEqual(
      [
        p.frameInfo.width,
        p.frameInfo.height,
        p.frameInfo.video_mode.bios_mode_number,
        p.frameInfo.video_mode.is_graphics_mode,
      ],
      [320, 200, 13, true],
      "Native frame not current EGA",
    );
    assert.ok(p.scanoutWaits.length >= 2);
    for (const w of p.scanoutWaits) assert.equal(w.wait.satisfied, true);
    const last = p.scanoutWaits.at(-1).frameInfo,
      prior = p.scanoutWaits.at(-2).frameInfo;
    assert.equal(last.frame_hash, prior.frame_hash);
    assert.equal(last.frame_hash, p.frameInfo.frame_hash);
    assert.notEqual(last.frame_hash, p.baselineFrameInfo.frame_hash);
    assert.equal(sha(png), p.pngSHA256);
    const actual = PNG.sync.read(png);
    assert.deepEqual([actual.width, actual.height], [320, 200]);
    const expected = new Uint8Array(320 * 200 * 4);
    for (let at = 3; at < expected.length; at += 4) expected[at] = 255;
    const offsets = bankSparkleCopyBytes(c.x, c.y);
    if (omitByte && i === 0) offsets.shift();
    for (const at of offsets)
      for (let bit = 0; bit < 8; bit++) {
        let color = 0;
        for (let plane = 0; plane < 4; plane++)
          color |= ((pattern[plane * 8000 + at] >> (7 - bit)) & 1) << plane;
        expected.set([...EGA[color], 255], (at * 8 + bit) * 4);
      }
    if (changedPixel && i === 0) actual.data[0] ^= 255;
    assert.equal(sha(actual.data), sha(expected), "Native pixel case" + i);
  }
}
compare(data);
assert.throws(() => compare([]), /Zero\/missing/);
assert.throws(() => compare(data.slice(0, -1)), /Zero\/missing/);
assert.throws(
  () => compare(data, { changedPixel: true }),
  /Native pixel case0/,
);
assert.throws(() => compare(data, { omitByte: true }), /Native pixel case0/);
const corruptSource = structuredClone(data);
const bytes = Buffer.from(
  corruptSource[0].packet.entryMemory.results[1].data,
  "base64",
);
bytes[0] ^= 1;
corruptSource[0].packet.entryMemory.results[1].data = bytes.toString("base64");
assert.throws(() => compare(corruptSource), /Authored RAM source changed/);
const wrongStack = structuredClone(data);
const words = Buffer.from(
  wrongStack[0].packet.entryMemory.results[2].data,
  "base64",
);
words[4] ^= 1;
wrongStack[0].packet.entryMemory.results[2].data = words.toString("base64");
assert.throws(() => compare(wrongStack), /Original consumed stack words/);
const unfinished = structuredClone(data);
unfinished[0].packet.returned.registers.esp--;
assert.throws(
  () => compare(unfinished),
  /Original far return did not restore stack/,
);
const stale = structuredClone(data);
stale[0].packet.frameInfo.width = 720;
assert.throws(() => compare(stale), /Native frame not current EGA/);
const proof = spawnSync(
  process.execPath,
  ["scripts/verify-bank-sparkle-copy-source.js"],
  { encoding: "utf8" },
);
assert.equal(proof.status, 0, proof.stdout + proof.stderr);
console.log(
  "Original bank-copy pixels:6 exact full320x200 RGBA cases,actual consumed arguments and authored source,original opcode identity,owned guest/closed private emulator,8 negative controls. Conditional primitive evidence;not natural bank timing or hidden-page aliasing.",
);
