import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const sha = (b) => createHash("sha256").update(b).digest("hex");
const manifest = JSON.parse(
  await readFile("reference/lightning-flight-inputs.json"),
);
assert.equal(
  manifest.baselineCommit,
  "57beb92d1250452ee5e8ed22ec8e04b48321fe08",
);
assert.equal(Object.keys(manifest.sourceFiles).length, 5);
for (const [path, hash] of Object.entries(manifest.sourceFiles))
  assert.equal(
    sha(execFileSync("git", ["show", `${manifest.baselineCommit}:${path}`])),
    hash,
    `Changed baseline source ${path}`,
  );
assert.equal(manifest.artifacts.length, 9);
for (const file of manifest.artifacts) {
  const bytes = await readFile(file.path).catch(() => {
    throw Error(`SETUP: missing ${file.path}`);
  });
  assert.equal(bytes.length, file.bytes, `Truncated ${file.path}`);
  assert.equal(sha(bytes), file.sha256, `Corrupt ${file.path}`);
}
const source = manifest.artifacts.find((f) =>
  f.path.endsWith("/observed-inputs.json"),
);
assert.ok(source);
const observed = JSON.parse(await readFile(source.path));
assert.equal(observed.length, 112);
assert.equal(
  observed.at(-1).code,
  0,
  "Strike-internal neutral input is separate from player controls",
);
function compare(codes) {
  assert.equal(codes.length, 111, "Missing required controls");
  assert.equal(codes.length, manifest.inputCount);
  assert.ok(codes.every((code) => [192, 193, 197].includes(code)));
  assert.equal(
    sha(Buffer.from(codes)),
    manifest.sha256,
    "Changed external control stream",
  );
  assert.deepEqual(
    codes,
    observed.slice(0, -1).map((e) => e.code),
  );
}
const codes = manifest.events.flatMap(({ byte, count }) => {
  assert.ok(Number.isInteger(count) && count > 0);
  return Array(count).fill(byte);
});
compare(codes);
assert.throws(() => compare([]), /Missing required controls/);
assert.throws(() => compare(codes.slice(1)), /Missing required controls/);
const changed = [...codes];
changed[17] = changed[17] === 192 ? 197 : 192;
assert.throws(() => compare(changed), /Changed external control stream/);
const receipt = manifest.artifacts.find((f) => f.path.endsWith("/browser.log"));
assert.ok(receipt);
assert.match(await readFile(receipt.path, "utf8"), /1 passed/);
console.log(
  "Lightning controls:111 observed external values,112th internal neutral read distinguished, baseline provenance and3 negative controls. Port input evidence, not original flight parity.",
);
