import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
const root =
  process.env.DUCKTALES_MAP_NEGATIVE_OUTPUT ??
  ".local/map-input-browser-negative";
await mkdir(root, { recursive: true });
for (const [mode, title, expected, received] of [
  ["omit-letter", "original map scan order", /Expected:\s*3/, /Received:\s*0/],
  ["omit-repeat", "map held keys need fresh makes", /"x": 48/, /"x": 47/],
]) {
  const args = [
    "node_modules/@playwright/test/cli.js",
    "test",
    "tests/browser/map-pointer.spec.js",
    "--grep",
    title,
    `--output=${root}/${mode}`,
  ];
  if (process.env.DUCKTALES_MAP_TEST_CONFIG)
    args.push("--config", process.env.DUCKTALES_MAP_TEST_CONFIG);
  const result = spawnSync(process.execPath, args, {
    encoding: "utf8",
    timeout: 120000,
    maxBuffer: 4 * 1024 * 1024,
    env: { ...process.env, DUCKTALES_MAP_INPUT_NEGATIVE: mode },
  });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  await writeFile(`${root}/${mode}.log`, output);
  assert.ifError(result.error);
  assert.equal(result.status, 1, `Missing map make must fail: ${mode}`);
  assert.match(output, /1 failed/);
  assert.match(output, expected);
  assert.match(output, received);
  if (mode === "omit-letter") assert.match(output, /Original input 8/);
  assert.doesNotMatch(
    output,
    /SETUP:|No tests found|Test timeout|TimeoutError|browserType\.launch:|Test was interrupted|ETIMEDOUT|Channel closed|Unfinished map/,
  );
}
console.log(
  "Map browser negative controls: omitted letter make and omitted repeat make rejected by exact input/pointer comparisons.",
);
