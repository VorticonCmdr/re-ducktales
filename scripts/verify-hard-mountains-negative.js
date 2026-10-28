import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

const fields = [
  "x",
  "y",
  "row",
  "column",
  "scroll",
  "action",
  "frame",
  "facing",
  "lives",
  "hook",
  "money",
  "seed",
];
for (const [name, title, variant, packets, samples, checkpoints] of [
  ["thunderclap", "Thunderclap", 1, 29, 494, 59],
  ["machu", "Machu Picchu", 2, 43, 706, 73],
]) {
  const manifest = JSON.parse(
    await readFile(`reference/${name}-mountain-browser.json`, "utf8"),
  );
  const inputBytes = await readFile(manifest.inputManifest).catch(() => {
    throw Error(`SETUP: missing ${manifest.inputManifest}`);
  });
  const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
  assert.equal(
    sha(inputBytes),
    manifest.inputManifestSha256,
    "Changed mountain input stream",
  );
  assert.equal(
    sha(await readFile(manifest.captureTool)),
    manifest.captureToolSha256,
    "Changed mountain capture tool",
  );
  assert.equal(manifest.captureDependencies.length, 1);
  for (const dependency of manifest.captureDependencies)
    assert.equal(
      sha(await readFile(dependency.path)),
      dependency.sha256,
      `Changed capture dependency ${dependency.path}`,
    );
  const stream = JSON.parse(inputBytes).mountain,
    route = manifest.mountain;
  assert.equal(manifest.expectedScenarioCount, 1);
  assert.equal(route.variant, variant);
  assert.equal(stream.length, packets);
  assert.equal(route.expectedPacketCount, packets);
  for (const e of stream) {
    assert.ok(Number.isInteger(e.count) && e.count > 0);
    assert.ok([0, 1, 3, 5, 7, 64].includes(e.byte));
  }
  assert.equal(
    stream.reduce((sum, e) => sum + e.count, 0),
    samples,
  );
  assert.equal(route.expectedInputCount, samples);
  assert.equal(route.expectedCheckpointCount, checkpoints);
  assert.equal(route.checkpoints.length, checkpoints);
  assert.deepEqual(route.comparisonFields, fields);
  let previous = 0;
  for (const checkpoint of route.checkpoints) {
    assert.ok(
      Number.isInteger(checkpoint.inputCount) &&
        checkpoint.inputCount > previous &&
        checkpoint.inputCount <= samples,
    );
    assert.deepEqual(Object.keys(checkpoint.state), fields);
    previous = checkpoint.inputCount;
  }
  assert.equal(previous, samples);
  assert.equal(manifest.negativeControl.inputIndex, 4);
  assert.equal(manifest.negativeControl.replacementByte, 0);
  assert.equal(
    manifest.negativeControl.requiredFailure,
    "Hard mountain checkpoint5 action",
  );
  const directory = `.local/hard-${name}`;
  await mkdir(directory, { recursive: true });
  const result = spawnSync(
    process.execPath,
    [
      "node_modules/@playwright/test/cli.js",
      "test",
      "tests/browser/hard-mountains.spec.js",
      "--grep",
      `Hard race, ${title} summit`,
      `--output=${directory}/negative-browser`,
    ],
    {
      encoding: "utf8",
      timeout: 120000,
      maxBuffer: 4 * 1024 * 1024,
      env: {
        ...process.env,
        DUCKTALES_HARD_NEGATIVE: manifest.negativeControl.mode,
      },
    },
  );
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  await writeFile(`${directory}/negative-control.log`, output);
  assert.ifError(result.error);
  assert.equal(result.status, 1, "missing first hook must fail");
  assert.ok(
    output.includes(manifest.negativeControl.requiredFailure),
    "must reject missing first hook at action checkpoint5",
  );
  assert.match(output, /1 failed/);
  assert.doesNotMatch(output, /No tests found|SETUP:|browserType\.launch:/);
  console.log(
    `${title} negative control: missing first hook rejected at checkpoint5 action.`,
  );
}
