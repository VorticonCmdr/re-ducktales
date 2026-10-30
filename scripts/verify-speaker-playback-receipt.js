// Verify a registered local sound acceptance without rerunning the browser.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { originalGame } from "../tests/helpers/original-game.js";
await originalGame();
const sha = (b) => createHash("sha256").update(b).digest("hex");
const m = JSON.parse(
  await readFile(
    process.argv.find((a) => a.startsWith("--manifest="))?.slice(11) ??
      "reference/speaker-playback-current.json",
  ),
);
assert.equal(m.build, "dos-fb658562");
assert.equal(m.browserCases, 7);
assert.equal(m.streamCases, 3);
assert.equal(m.completed, true);
const artifacts = {};
for (const [role, spec] of Object.entries(m.artifacts)) {
  const b = await readFile(spec.path).catch(() => {
    throw Error(
      `SETUP: missing sound evidence ${spec.path}; run npm run verify:speaker-game`,
    );
  });
  assert.equal(b.length, spec.bytes, `Corrupt ${role} size`);
  assert.equal(sha(b), spec.sha256, `Corrupt ${role}`);
  artifacts[role] = JSON.parse(b);
}
assert.ok(
  Object.keys(artifacts.sources).length >= 13,
  "Missing source inventory",
);
for (const [p, expected] of Object.entries({
  ...artifacts.sources,
  ...m.verificationSources,
}))
  assert.equal(sha(await readFile(p)), expected, `Changed sound source ${p}`);
assert.equal(artifacts.receipt.completed, true);
assert.equal(artifacts.receipt.browserCases, 7);
assert.equal(artifacts.receipt.reportNegativeControls, 3);
const tests = [];
function visit(s) {
  for (const spec of s.specs ?? []) tests.push(...spec.tests);
  for (const c of s.suites ?? []) visit(c);
}
for (const s of artifacts.browser.suites) visit(s);
assert.deepEqual(artifacts.browser.errors, []);
assert.equal(tests.length, 7);
for (const t of tests) {
  assert.equal(t.expectedStatus, "passed");
  assert.equal(t.results.length, 1);
  assert.equal(t.results[0].status, "passed");
}
for (const role of ["tandy-route", "speaker-route"]) {
  const a = artifacts[role];
  assert.ok(a.menuInputs.length > 0);
  assert.ok(a.events.length > 0);
  assert.equal(a.stats.requests, a.stats.lastAcknowledged);
  assert.ok(Number(a.stats.signalSamples) > 1024);
  assert.equal(
    Number(a.stats.acknowledgements) + Number(a.stats.chains),
    Number(a.stats.interrupts),
  );
  assert.ok(a.events.some((e) => e.type === "complete" && !e.busy));
}
console.log(
  "Registered speaker playback evidence: 7 actual browser cases, 3 stream cases, both flight/cave boundaries, exact artifacts and source identities. No full-campaign or waveform claim.",
);
