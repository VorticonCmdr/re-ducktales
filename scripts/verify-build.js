import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import build from "../reference/build.json" with { type: "json" };
let executed = 0;
for (const [name, expected] of Object.entries(build.files)) {
  const bytes = await readFile(`game/${name}`).catch(() => {
    throw Error(
      `SETUP: missing game/${name}. Supply this build's original files.`,
    );
  });
  assert.equal(bytes.length, expected.bytes, `${name}: byte length mismatch`);
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    expected.sha256,
    `${name}: SHA-256 mismatch`,
  );
  executed++;
}
assert.equal(executed, 22, "incomplete build inventory");
console.log(`Original build: ${executed} exact file identities verified.`);
