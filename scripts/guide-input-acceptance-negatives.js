// Negative controls touch only fresh local copies of consumer evidence.
import assert from "node:assert/strict";
import { readFile, writeFile, copyFile, mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { json, spec, fresh } from "./lib/local-scenario-source.js";
const m = await json("reference/guide-input-acceptance.json"),
  out = await fresh(
    process.argv.find((a) => a.startsWith("--output="))?.slice(9),
  ),
  results = [];
for (const name of [
  "zero-browser-cases",
  "missing-guide-checkpoint",
  "corrupt-regression-result",
]) {
  const root = out + "/" + name;
  await mkdir(root);
  const modified = structuredClone(m);
  if (name === "missing-guide-checkpoint") {
    modified.captureRoot = root;
    for (const file of [
      "sources.zip",
      "source-revision.json",
      "capture-status.json",
      "captured-events.json",
      "campaign-checkpoints.json",
    ])
      await copyFile(m.captureRoot + "/" + file, root + "/" + file);
    const checks = await json(root + "/campaign-checkpoints.json");
    checks.splice(
      checks.findIndex((c) => c.name === "guide-pause"),
      1,
    );
    await writeFile(
      root + "/campaign-checkpoints.json",
      JSON.stringify(checks),
    );
    modified.artifacts["producer/campaign-checkpoints.json"] = await spec(
      root + "/campaign-checkpoints.json",
    );
  } else {
    modified.regressionRoot = root;
    for (const file of ["sources.zip", "source-revision.json", "result.json"])
      await copyFile(m.regressionRoot + "/" + file, root + "/" + file);
    if (name === "zero-browser-cases") {
      const result = await json(root + "/result.json");
      result.browserCases = [];
      await writeFile(root + "/result.json", JSON.stringify(result));
      modified.artifacts["regression/result.json"] = await spec(
        root + "/result.json",
      );
    } else {
      modified.artifacts["regression/result.json"] = await spec(
        root + "/result.json",
      );
      await writeFile(
        root + "/result.json",
        (await readFile(root + "/result.json", "utf8")) + " ",
      );
    }
  }
  const manifest = root + "/manifest.json";
  await writeFile(manifest, JSON.stringify(modified));
  const r = spawnSync(
    process.execPath,
    ["scripts/verify-guide-input-acceptance.js", "--manifest=" + manifest],
    { encoding: "utf8", timeout: 60000, maxBuffer: 4 * 1024 * 1024 },
  );
  assert.ifError(r.error);
  assert.equal(r.status, 1, "Negative did not fail " + name);
  assert.match(
    r.stderr,
    name === "zero-browser-cases"
      ? /0 !== 14/
      : name === "missing-guide-checkpoint"
        ? /29 !== 30/
        : /Corrupt scenario fixture/,
    "Wrong negative failure " + name,
  );
  await writeFile(root + "/checker.log", r.stdout + r.stderr);
  results.push({ name, rejected: true });
}
assert.equal(results.length, 3);
await writeFile(
  out + "/result.json",
  JSON.stringify({ completed: true, cases: results }, null, 2) + "\n",
);
console.log(
  "Guide receipt negatives:zero browser cases,missing guide checkpoint,and corrupt regression result all rejected.",
);
