// Static/live-byte correspondence and scheduling contract,not native cadence.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { originalGame } from "../tests/helpers/original-game.js";
const sha = (b) => createHash("sha256").update(b).digest("hex");
const m = JSON.parse(await readFile("reference/mountain-phase.json")),
  data = {};
assert.equal(m.id, "original-mountain-page-phase");
assert.equal(Object.keys(m.artifacts).length, 4);
for (const [role, s] of Object.entries(m.artifacts)) {
  const b = await readFile(s.path).catch(() => {
    throw Error("SETUP: missing mountain phase evidence " + s.path);
  });
  assert.equal(b.length, s.bytes);
  assert.equal(sha(b), s.sha256, "Corrupt phase artifact");
  data[role] = JSON.parse(b);
}
for (const [p, h] of Object.entries(m.sources))
  assert.equal(sha(await readFile(p)), h, "Changed phase source " + p);
for (const p of m.parents)
  assert.equal(sha(await readFile(p.path)), p.sha256, "Changed phase parent");
const { archives } = await originalGame(),
  exe = await readFile("game/DUCKTALE.EXE"),
  body = exe.subarray(0x17800, 0x17600 + 12514),
  driver = Buffer.from(archives.get("IT.DRV")[1].data);
assert.equal(sha(exe), m.executableSHA256);
assert.equal(sha(body), m.overlayBodySHA256);
assert.equal(sha(driver), m.driverSHA256);
function check(record, bytes, start, end) {
  assert.equal(record.success, true);
  assert.equal(record.truncated, false);
  let next = start;
  for (const i of record.instructions) {
    const at = parseInt(i.address.split(":").at(-1), 16);
    if (at < start || at >= end) continue;
    assert.equal(at, next, "Phase instruction coverage gap");
    assert.equal(
      bytes.subarray(at, at + i.length).toString("hex"),
      i.bytes,
      "Original phase bytes",
    );
    next += i.length;
  }
  assert.equal(next, end, "Missing phase instructions");
}
check(data.caller, body, 0x1436, 0x156a);
check(data.driver, driver, 0xe5, 0x101);
check(data.wait, driver, 0x64, 0x72);
assert.equal(body.subarray(0x145d, 0x1461).toString("hex"), "ff1ed41f");
assert.equal(driver.subarray(0xfd, 0x100).toString("hex"), "e864ff");
assert.equal(
  driver.subarray(0x64, 0x72).toString("hex"),
  "bada03ec240875fbec240874fbc3",
);
const before = data.before;
assert.equal(before.state.aborted, false);
assert.ok(before.state.results.every((r) => r.status === "ok"));
const ds = Buffer.from(before.state.results[1].data, "base64");
assert.equal(ds.length, 65536);
assert.equal(ds.readUInt16LE(0x1fd4), 0xe5);
assert.equal(ds.readUInt16LE(0x1fd6), 0x2ed8);
const bad = structuredClone(data.wait);
bad.instructions.find((i) => i.address === "0000:006a").bytes = "74fb";
assert.throws(() => check(bad, driver, 0x64, 0x72), /Original phase bytes/);
const missing = structuredClone(data.driver);
missing.instructions = missing.instructions.filter(
  (i) => i.address !== "0000:00fd",
);
assert.throws(() => check(missing, driver, 0xe5, 0x101), /coverage gap/);
// This independently validates live flip/wait bytes and80 original read-only
// samples from a fixed-input scenario,without executing the original again.
execFileSync(process.execPath, ["scripts/verify-mountain-pages.js"], {
  stdio: "pipe",
});
const tests = execFileSync(
  process.execPath,
  ["--test", "--test-reporter=tap", "tests/mountain-phase.test.js"],
  { encoding: "utf8" },
);
for (const regex of [
  /# tests 6\b/,
  /# pass 6\b/,
  /# fail 0\b/,
  /# skipped 0\b/,
])
  assert.match(tests, regex);
console.log(
  JSON.stringify(
    {
      scope:
        "Original page/wait code and retained live correspondence plus6 independent scheduling-contract cases;not new native elapsed-time/full-campaign acceptance",
      staticRanges: 3,
      retainedOriginalSamples: 80,
      phaseCases: 6,
      staticNegativeControls: 2,
      roundedPolicyRejected: true,
    },
    null,
    2,
  ),
);
