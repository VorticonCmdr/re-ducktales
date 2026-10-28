import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { unpackImage } from "../src/game/executable.js";
import build from "../reference/build.json" with { type: "json" };
import manifest from "../reference/flight-lightning-input.json" with { type: "json" };

const hash = (b) => createHash("sha256").update(b).digest("hex");
const exe = await readFile("game/DUCKTALE.EXE").catch(() => {
  throw Error("SETUP: missing game/DUCKTALE.EXE");
});
assert.equal(hash(exe), build.files["DUCKTALE.EXE"].sha256);
assert.equal(exe.length, build.files["DUCKTALE.EXE"].bytes);
const source = manifest.originalEvidence;
for (const key of ["overlayFile", "overlayBody"]) {
  const s = source[key];
  assert.equal(
    hash(exe.subarray(s.offset, s.offset + s.length)),
    s.sha256,
    key,
  );
}
const body = exe.subarray(
  source.overlayBody.offset,
  source.overlayBody.offset + source.overlayBody.length,
);
const branch = source.strikeBranch;
assert.equal(
  hash(body.subarray(branch.offset, branch.offset + branch.length)),
  branch.sha256,
  "strike branch",
);
for (const type of [42, 43])
  assert.equal(body.readUInt16LE(0x2b09 + (type - 27) * 2), 0x2962);
assert.equal(
  body.subarray(0x2997, 0x29a4).toString("hex"),
  "9aa5190e042bc0a36654a39c8a",
);
const image = unpackImage(exe),
  flush = source.residentFlush;
assert.equal(
  hash(image.subarray(flush.imageOffset, flush.imageOffset + flush.length)),
  flush.sha256,
  "resident input clear",
);
assert.equal(manifest.portComponent.requiredCases, 1);

// A temporary module removes the caller's callback. Imports still resolve to
// the real code, and the checked-in runtime is never edited for this control.
const out = resolve(".local/flight-lightning");
await mkdir(out, { recursive: true });
const runtimePath = resolve("src/game/flight.js"),
  testPath = resolve("tests/flight-input.test.js");
function absoluteImports(text, path) {
  return text.replace(
    /from "(\.[^"]+)"/g,
    (_, p) => `from "${pathToFileURL(resolve(dirname(path), p)).href}"`,
  );
}
const runtime = await readFile(runtimePath, "utf8");
const needle = "        flushInput: () => this.flushInput(),\n";
assert.equal(
  runtime.split(needle).length,
  2,
  "missing or ambiguous lightning callback",
);
const broken = resolve(out, "without-lightning-flush.js");
await writeFile(
  broken,
  absoluteImports(runtime.replace(needle, ""), runtimePath),
);
let test = absoluteImports(await readFile(testPath, "utf8"), testPath);
const flightURL = pathToFileURL(runtimePath).href;
assert.equal(test.split(flightURL).length, 2);
test = test.replace(flightURL, pathToFileURL(broken).href);
const negative = resolve(out, "without-lightning-flush.test.js");
await writeFile(negative, test);
const result = spawnSync(
  process.execPath,
  ["--test", "--test-name-pattern=naturally generated lightning", negative],
  { encoding: "utf8", timeout: 30000 },
);
const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
await writeFile(resolve(out, "missing-callback-negative.log"), output);
assert.ifError(result.error);
assert.equal(result.status, 1, "missing callback must fail");
assert.match(
  output,
  /Flight lightning collision requires the original input-flush provider/,
);
assert.match(output, /tests 1/);
assert.match(output, /fail 1/);
assert.match(output, /skipped 0/);
assert.doesNotMatch(output, /SETUP:|ERR_MODULE_NOT_FOUND/);
console.log(
  "Flight lightning: exact original switch/branch/flush identities; missing-callback negative control rejected at the required boundary.",
);
