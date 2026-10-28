// Historical capture code and the current replay adapter are separate identities.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

export async function verifyRouteTools(manifest) {
  const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
  assert.match(manifest.captureToolCommit, /^[0-9a-f]{40}$/);
  const historical = [
    { path: manifest.captureTool, sha256: manifest.captureToolSha256 },
    ...manifest.captureDependencies,
  ];
  assert.equal(historical.length, 2);
  for (const file of historical)
    assert.equal(
      sha(execFileSync("git", ["show", `${manifest.captureToolCommit}:${file.path}`])),
      file.sha256,
      `Changed historical capture tool ${file.path}`,
    );
  const current = manifest.verificationTools;
  assert.ok(current.length >= 7, "Missing current route tool identities");
  assert.equal(new Set(current.map((file) => file.path)).size, current.length);
  for (const path of [
    manifest.captureTool,
    "tests/browser/hard-expedition-route.js",
    "tests/browser/helpers/scene.js",
    "tests/browser/helpers/clock.js",
    "tests/browser/helpers/flight-inputs.js",
    "reference/hard-flight-inputs.json",
    "scripts/verify-route-tools.js",
  ]) assert.ok(current.some((file) => file.path === path), `Missing route tool ${path}`);
  for (const file of current) {
    const bytes = await readFile(file.path).catch(() => {
      throw Error(`SETUP: missing ${file.path}`);
    });
    assert.equal(sha(bytes), file.sha256, `Changed current route tool ${file.path}`);
  }
}
