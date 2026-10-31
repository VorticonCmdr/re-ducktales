// Temporary consumer receipts only; never modify producer inputs or expectations.
import assert from "node:assert/strict";
import { readFile, writeFile, copyFile, mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fresh, json, spec } from "./lib/local-scenario-source.js";
const m = await json("reference/atomic-input-regression.json"),
  out = await fresh(
    process.argv.find((a) => a.startsWith("--output="))?.slice(9),
  );
const cases = [
  ["zero-browser-cases", (r) => (r.browserCases = []), /0 !== 12/],
  ["unconsumed-event", (r) => r.headless.consumed--, /4980/],
  ["corrupt-result", null, /Corrupt scenario fixture/],
];
const results = [];
for (const [name, change, diagnostic] of cases) {
  const root = out + "/" + name;
  await mkdir(root);
  for (const file of ["sources.zip", "source-revision.json"])
    await copyFile(m.consumerRoot + "/" + file, root + "/" + file);
  const result = await json(m.consumerRoot + "/result.json");
  if (change) change(result);
  await writeFile(root + "/result.json", JSON.stringify(result));
  const modified = { ...m, consumerRoot: root, artifacts: {} };
  for (const file of ["sources.zip", "source-revision.json", "result.json"])
    modified.artifacts[file] = await spec(root + "/" + file);
  if (!change)
    await writeFile(
      root + "/result.json",
      (await readFile(root + "/result.json", "utf8")) + " ",
    );
  const manifest = root + "/manifest.json";
  await writeFile(manifest, JSON.stringify(modified));
  const run = spawnSync(
    process.execPath,
    ["scripts/verify-atomic-input-regression.js", "--manifest=" + manifest],
    { encoding: "utf8", timeout: 60000, maxBuffer: 4 * 1024 * 1024 },
  );
  assert.ifError(run.error);
  assert.equal(run.status, 1, "Required negative did not fail " + name);
  assert.match(run.stderr, diagnostic, "Wrong negative failure " + name);
  await writeFile(root + "/checker.log", run.stdout + run.stderr);
  results.push({ name, rejected: true });
}
assert.equal(results.length, 3);
await writeFile(
  out + "/result.json",
  JSON.stringify({ completed: true, cases: results }, null, 2) + "\n",
);
console.log(
  "Receipt negative controls:zero browser cases,unconsumed headless event,and corrupt result all rejected.",
);
