// Source-defined HUD work and conditional original primitive evidence.
// This does not assert uninterrupted original Safari timing.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { json, checkArtifacts, sha } from "./lib/local-scenario-source.js";
import { originalGame } from "../tests/helpers/original-game.js";
import {
  preparePhotography,
  photographyHud,
} from "../src/game/photography-scene.js";
import { photographyWork } from "../src/game/photography-work.js";
import { photographyHudPrimitiveWork } from "../src/game/photography-hud-work.js";
import { originalHudNumberWork } from "../src/game/hud-number-work.js";
const m = await json("reference/photography-hud-work.json");
assert.equal(m.kind, "photography-hud-work");
assert.equal(m.expectedCases, 28);
assert.equal(m.nativeComparison, "conditional-primitive/source-call-plan");
assert.deepEqual(m.exclusions, []);
assert.deepEqual(m.fittedInputs, []);
await checkArtifacts(m.artifacts);
for (const [path, h] of Object.entries(m.sources))
  assert.equal(sha(await readFile(path)), h, "Changed Safari HUD work " + path);
for (const command of [
  "scripts/verify-photography-work.js",
  "scripts/verify-ega-line-primitives.js",
  "scripts/verify-hud-number.js",
])
  execFileSync(process.execPath, [command], { stdio: "inherit" });
const native = await json("reference/hud-number-work.json");
const inputs = await json(native.artifacts.inputs.path);
assert.equal(inputs.cases.length, 16);
for (let i = 0; i < 16; i++) {
  const expected = await json(
    native.artifacts["case-" + String(i).padStart(2, "0")].path,
  );
  const trace = [],
    base = {
      formatter: 0x1c40,
      stack: 0x40e0,
      divide: 0x40e0,
      remainder: 0x40e0,
      assign: 0x40e0,
      driver: 0xa000,
    };
  const cost = originalHudNumberWork(inputs.cases[i], {
    instruction: (kind, ip) => trace.push(base[kind] + ip),
  });
  assert.deepEqual(trace, expected.trace);
  assert.equal(cost.text, expected.textCall.string);
  assert.equal(cost.x & 65535, expected.textCall.words[2]);
  assert.equal(cost.portWrites, expected.ports.length);
}
const { image, archives } = await originalGame();
const entries = archives.get("PS.ARC");
const p = preparePhotography({
  image,
  entries,
  difficulty: 0,
  variant: 4,
  seed: 45009,
  money: 2094,
  day: 27,
  location: 12,
});
const glyphs = [
  "/",
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
];
let cases = 0,
  negatives = 0;
for (const started of [false, true])
  for (let film = -1; film <= 12; film++) {
    p.memory.b(0x5d2a, film);
    const commands = [];
    photographyHud(commands, p.memory, p.assets, started);
    assert.deepEqual(
      commands.map((c) => c.op),
      started
        ? ["line", "line", "line", "line", "sprite", "sprite", "sprite", "text"]
        : ["line", "line", "line", "line", "sprite", "sprite", "text"],
    );
    assert.deepEqual(
      commands.slice(0, 4).map((c) => [c.x, c.y, c.x2, c.y2, c.color]),
      [
        [0, 176, 319, 176, 4],
        [0, 199, 319, 199, 4],
        [0, 176, 0, 199, 4],
        [319, 176, 319, 199, 4],
      ],
    );
    const text = commands.at(-1);
    assert.deepEqual(text, {
      op: "text",
      text: glyphs[film + 1],
      x: 300 - glyphs[film + 1].length * 8,
      y: 183,
      color: 15,
    });
    const actual = photographyWork(entries, commands, { film });
    const sprites = photographyWork(
      entries,
      commands.filter((c) => c.op === "sprite"),
    );
    const extra = commands
      .filter((c) => c.op !== "sprite")
      .map((c) => photographyHudPrimitiveWork(c, { film }));
    for (const key of ["instructions", "portWrites"])
      assert.equal(
        actual[key] - sprites[key],
        extra.reduce((n, c) => n + c[key], 0),
      );
    assert.equal(
      actual.hudInstructions,
      film === -1 ? 1038 : film < 10 ? 1019 : 1251,
    );
    assert.equal(actual.hudPortWrites, film < 10 ? 42 : 58);
    assert.equal(actual.omittedLines, 0);
    assert.equal(actual.omittedTexts, 0);
    assert.ok(actual.milliseconds > sprites.milliseconds);
    const missingLine = photographyWork(entries, commands.slice(1), { film });
    assert.notEqual(missingLine.instructions, actual.instructions);
    negatives++;
    const missingText = photographyWork(entries, commands.slice(0, -1), {
      film,
    });
    assert.notEqual(missingText.instructions, actual.instructions);
    negatives++;
    assert.throws(
      () => photographyWork(entries, [{ ...text, text: "wrong" }], { film }),
      /formatter command mismatch/,
    );
    negatives++;
    cases++;
  }
assert.equal(cases, m.expectedCases);
assert.throws(
  () =>
    photographyHudPrimitiveWork({
      op: "line",
      x: 1,
      y: 176,
      x2: 319,
      y2: 176,
      color: 4,
    }),
  /Unsupported/,
);
negatives++;
assert.throws(
  () => photographyHudPrimitiveWork({ op: "text" }),
  /Missing photography signed film/,
);
negatives++;
assert.equal(negatives, 86);
console.log(
  `Safari HUD:28 source-defined call plans,16 exact production/native formatter traces,original line primitives and86 missing/altered/unsupported negatives. Partial source work;not uninterrupted native cadence.`,
);
