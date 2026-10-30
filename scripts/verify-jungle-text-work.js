// Runtime admission: exact original native formatter plus preserved draw inputs.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { originalGame } from "../tests/helpers/original-game.js";
import { originalHudNumberWork } from "../src/game/hud-number-work.js";
import { jungleWorkEffects } from "../src/game/jungle-work.js";
import { presentJungleFrame } from "../src/game/jungle-presentation.js";
import { jungleSceneResources } from "../src/game/jungle-scene.js";
import { FlightMemory } from "../src/game/flight-physics.js";
import { normalCoreGraphicsMilliseconds } from "../src/game/ega-work.js";
const sha = (b) => createHash("sha256").update(b).digest("hex");
execFileSync(process.execPath, ["scripts/verify-hud-number.js"], {
  stdio: "inherit",
});
const manifest = JSON.parse(await readFile("reference/hud-number-work.json"));
const json = async (role) =>
  JSON.parse(await readFile(manifest.artifacts[role].path));
const inputs = await json("inputs");
assert.equal(inputs.cases.length, 16);
let nativeCases = 0;
for (let i = 0; i < 16; i++) {
  const expected = await json("case-" + String(i).padStart(2, "0")),
    trace = [],
    base = {
      formatter: 0x1c40,
      stack: 0x40e0,
      divide: 0x40e0,
      remainder: 0x40e0,
      assign: 0x40e0,
      driver: 0xa000,
    };
  const work = originalHudNumberWork(inputs.cases[i], {
    instruction: (kind, ip) => trace.push(base[kind] + ip),
  });
  assert.deepEqual(trace, expected.trace, "Runtime native formatter path");
  assert.equal(work.text, expected.textCall.string);
  assert.equal(work.x & 65535, expected.textCall.words[2]);
  assert.equal(work.instructions, trace.length);
  assert.equal(work.portWrites, expected.ports.length);
  nativeCases++;
}
assert.equal(nativeCases, 16);
const historicalRevision = "f7baa4d";
async function frozen(path) {
  const source = execFileSync("git", [
    "show",
    historicalRevision + ":" + path,
  ]).toString();
  for (const match of source.matchAll(/from "(\.[^"]+)"/g)) {
    const dep = resolve(path, "..", match[1]);
    const archived = execFileSync("git", [
      "show",
      historicalRevision + ":" + dep.slice(process.cwd().length + 1),
    ]);
    assert.equal(
      sha(await readFile(dep)),
      sha(archived),
      "Changed frozen draw dependency " + dep,
    );
  }
  const adjusted = source.replace(
    /from "(\.[^"]+)"/g,
    (_, p) => 'from "' + pathToFileURL(resolve(path, "..", p)).href + '"',
  );
  return import(
    "data:text/javascript;base64," + Buffer.from(adjusted).toString("base64")
  );
}
const oldWork = (await frozen("src/game/jungle-work.js")).jungleWorkEffects,
  oldPresent = (await frozen("src/game/jungle-presentation.js"))
    .presentJungleFrame;
const { archives } = await originalGame(),
  scene = jungleSceneResources(
    archives.get("JG.ARC"),
    archives.get("MAIN.ARC"),
    archives.get("MT.ARC"),
  );
const parent = JSON.parse(await readFile("reference/jungle-presentation.json")),
  prior = JSON.parse(await readFile("reference/jungle-draw-work.json"));
assert.equal(prior.expectedCaseCount, 6);
const initials = [];
for (const c of prior.cases) {
  const spec = parent.artifacts[c.id + "-before"],
    bytes = await readFile(spec.path);
  assert.equal(sha(bytes), spec.sha256);
  const r = JSON.parse(JSON.parse(bytes).content[0].text);
  assert.equal(r.aborted, false);
  assert.ok(r.results.every((x) => x.status === "ok"));
  initials.push({
    bytes: Buffer.from(r.results[1].data, "base64"),
    color: Buffer.from(r.results[2].data, "base64")[0],
  });
}
function compare(fault = null) {
  let checked = 0,
    totalTexts = 0;
  const rows = [];
  for (let i = 0; i < 6; i++) {
    function run(adapter, present) {
      const memory = new FlightMemory(initials[i].bytes),
        commands = [];
      let cost = {
          instructions: 0,
          formatterInstructions: 0,
          driverInstructions: 0,
          portWrites: 0,
        },
        texts = 0;
      const sink = {
        color: initials[i].color,
        draw(resource) {
          commands.push([
            "sprite",
            resource,
            [...memory.bytes.subarray(resource, resource + 20)],
          ]);
        },
        copy(c) {
          commands.push(["copy", c]);
        },
        line(c) {
          commands.push(["line", c]);
        },
        text(c) {
          commands.push(["text", c]);
          texts++;
          const input =
            c.y === 180
              ? {
                  value: memory.view.getUint32(0x8cc0, true),
                  x: 175,
                  rightAlign: true,
                }
              : {
                  value: memory.signedByte(0x4e0e),
                  x: memory.signedByte(0x4e0e) < 10 ? 18 : 14,
                };
          assert.equal(memory.b(0x2052), 0);
          assert.equal(
            memory.view.getUint16(
              memory.view.getUint16(0x2038, true) + 4,
              true,
            ),
            0,
          );
          const w = originalHudNumberWork(input);
          assert.equal(w.text, c.text);
          assert.equal(w.x, c.x);
          for (const k of Object.keys(cost)) cost[k] += w[k];
        },
        wait() {
          assert.fail("Unexpected drawing wait");
        },
        sound() {
          assert.fail("Unexpected sound");
        },
      };
      const { effects, work } = adapter(memory, scene, sink);
      present(memory, effects);
      return {
        memory: memory.bytes,
        commands,
        cost,
        texts,
        work,
        color: effects.color,
      };
    }
    const before = run(oldWork, oldPresent),
      after = run(jungleWorkEffects, presentJungleFrame),
      c = before.cost;
    const wanted = {
      ...before.work,
      instructions: before.work.instructions + c.instructions,
      portWrites: before.work.portWrites + c.portWrites,
      texts: before.texts,
      textInstructions: c.instructions,
      textFormatterInstructions: c.formatterInstructions,
      textDriverInstructions: c.driverInstructions,
      textPortWrites: c.portWrites,
      omittedTexts: 0,
    };
    if (fault === "omit-text" && i === 2)
      after.work.instructions -= c.instructions;
    if (fault === "omit-formatter" && i === 2)
      after.work.instructions -= c.formatterInstructions;
    if (fault === "omit-port" && i === 2) after.work.portWrites--;
    assert.deepEqual(after.work, wanted, "Jungle text work");
    assert.deepEqual(after.memory, before.memory, "Text changed game state");
    assert.deepEqual(
      after.commands,
      before.commands,
      "Text changed original drawing commands",
    );
    assert.equal(after.color, before.color);
    assert.equal(before.texts, before.work.omittedTexts);
    checked++;
    totalTexts += before.texts;
    rows.push({
      case: prior.cases[i].id,
      texts: before.texts,
      ...c,
      milliseconds: c.instructions
        ? normalCoreGraphicsMilliseconds(c, 3000)
        : 0,
    });
  }
  assert.equal(checked, 6);
  assert.equal(totalTexts, 4);
  return rows;
}
const rows = compare();
for (const fault of ["omit-text", "omit-formatter", "omit-port"])
  assert.throws(() => compare(fault), /Jungle text work/);
assert.throws(
  () => originalHudNumberWork({ value: 0, x: 0, stackAvailable: false }),
  /stack exhaustion/,
);
console.log(
  JSON.stringify(
    {
      scope:
        "Runtime original formatter admission:16 exact native paths,six preserved source drawings,four text calls,three migration negatives. Not whole-jungle/campaign timing acceptance.",
      rows,
    },
    null,
    2,
  ),
);
