import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { unpackImage } from "../src/game/executable.js";
const sha = (b) => createHash("sha256").update(b).digest("hex");
const m = JSON.parse(await readFile("reference/bios-clock.json"));
assert.equal(m.id, "original-bios-seed-boundaries");
assert.equal(Object.keys(m.artifacts).length, 5);
assert.equal(m.expectedArtifactCount, 5);
const artifacts = {};
for (const [role, spec] of Object.entries(m.artifacts)) {
  const b = await readFile(spec.path).catch(() => {
    throw Error(
      "SETUP: missing BIOS evidence " + spec.path + "; see docs/bios-clock.md",
    );
  });
  assert.equal(b.length, spec.bytes);
  assert.equal(sha(b), spec.sha256, "Corrupt BIOS evidence " + role);
  artifacts[role] = b;
}
for (const p of m.parents)
  assert.equal(
    sha(await readFile(p.path)),
    p.sha256,
    "Changed BIOS parent " + p.path,
  );
const exe = await readFile("game/DUCKTALE.EXE");
assert.equal(sha(exe), m.executableSHA256, "Unsupported executable");
const image = Buffer.from(unpackImage(exe));
assert.equal(m.staticRanges.length, 3);
function check(spec, bytes) {
  assert.equal(
    bytes
      .subarray(spec.offset, spec.offset + spec.bytes.length / 2)
      .toString("hex"),
    spec.bytes,
    "Original BIOS code bytes",
  );
  const r = JSON.parse(artifacts[spec.role]);
  assert.equal(r.success, true);
  assert.equal(r.truncated, false);
  assert.ok(r.instructions.length > 0);
  const ghidra = Buffer.from(
    r.instructions.map((i) => i.bytes).join(""),
    "hex",
  );
  const expected = Buffer.from(spec.bytes, "hex");
  if (spec.role !== "helper.json")
    expected.writeUInt16LE(expected.readUInt16LE(3) + m.analysisLoadSegment, 3);
  assert.deepEqual(ghidra, expected, "Relocated Ghidra bytes");
}
for (const s of m.staticRanges) check(s, image);
const damaged = Buffer.from(image);
damaged[m.staticRanges[0].offset] ^= 1;
assert.throws(
  () => check(m.staticRanges[0], damaged),
  /Original BIOS code bytes/,
);
assert.throws(
  () => check(m.staticRanges[1], Buffer.alloc(0)),
  /Original BIOS code bytes/,
);
assert.match(artifacts["timer-source.h"].toString(), /PIT_TICK_RATE = 1193182/);
assert.match(artifacts["bios-source.cpp"].toString(), /value >= 0x1800B0/);
assert.equal(
  JSON.parse(await readFile("reference/difficulty-inputs.json"))
    .biosWordAtConsumption,
  m.nativeInputWord,
);
process.stdout.write(
  execFileSync(process.execPath, ["scripts/verify-difficulty.js"], {
    encoding: "utf8",
  }),
);
const log = execFileSync(
  process.execPath,
  ["--test", "--test-reporter=tap", "tests/bios-clock.test.js"],
  { encoding: "utf8" },
);
for (const pattern of [
  /# tests 8\b/,
  /# pass 8\b/,
  /# fail 0\b/,
  /# skipped 0\b/,
])
  assert.match(log, pattern);
console.log(
  "BIOS seed: 3 exact source ranges, original consumed word18293, 8 unit cases, 2 byte failure controls; nominal timer phase only.",
);
