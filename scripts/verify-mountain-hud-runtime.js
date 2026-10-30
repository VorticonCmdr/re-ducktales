// Production HUD commands/work/effects at independently captured native inputs.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { originalGame } from "../tests/helpers/original-game.js";
import { FlightMemory } from "../src/game/flight-physics.js";
import { Mountain } from "../src/game/mountain.js";
import { egaSpriteWork } from "../src/game/ega-work.js";
import { egaLinePrimitiveWork } from "../src/game/ega-line-work.js";
import { originalHudNumberWork } from "../src/game/hud-number-work.js";
for (const script of [
  "verify-mountain-hud.js",
  "verify-ega-line-primitives.js",
  "verify-hud-number.js",
])
  execFileSync(process.execPath, ["scripts/" + script], { stdio: "pipe" });
// The historical formatter verifier checks its preserved model. Admit the
// production formatter/text implementation independently against all16 traces.
const formatter = JSON.parse(await readFile("reference/hud-number-work.json"));
const formatterInputs = JSON.parse(
  await readFile(formatter.artifacts.inputs.path),
);
assert.equal(formatterInputs.cases.length, 16);
for (let i = 0; i < 16; i++) {
  const expected = JSON.parse(
    await readFile(
      formatter.artifacts["case-" + String(i).padStart(2, "0")].path,
    ),
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
  const work = originalHudNumberWork(formatterInputs.cases[i], {
    instruction: (kind, ip) => trace.push(base[kind] + ip),
  });
  assert.deepEqual(trace, expected.trace, "Production formatter native path");
  assert.equal(work.instructions, trace.length);
  assert.equal(work.portWrites, expected.ports.length);
  assert.equal(work.text, expected.textCall.string);
  assert.equal(work.x & 65535, expected.textCall.words[2]);
}
assert.deepEqual(
  await readFile("src/game/mountain-hud.js"),
  await readFile("scripts/lib/mountain-hud.js"),
  "HUD source differs from original comparison",
);
const { image, archives } = await originalGame(),
  main = archives.get("MAIN.ARC"),
  mt = archives.get("MT.ARC"),
  entries = [...mt, main[23], main[25]];
const manifest = JSON.parse(await readFile("reference/mountain-hud-work.json"));
const inputs = JSON.parse(await readFile(manifest.artifacts.inputs.path)),
  cap = JSON.parse(await readFile(manifest.artifacts.capture.path));
async function compare({ omitLines = false, omitNumbers = false } = {}) {
  let calls = 0;
  const results = [];
  for (let i = 0; i < 12; i++) {
    const event = inputs.cases[i],
      initial = JSON.parse(await readFile(event.initial.path)),
      b = Buffer.from(initial.state.results[1].data, "base64");
    for (const [at, w, v] of event.patches)
      if (w === 1) b[at] = v & 255;
      else b.writeUInt16LE(v & 65535, at);
    b.writeUInt16LE(0xf100, 0x1ff0);
    b.writeUInt16LE(cap.codeSegment, 0x1ff2);
    b.writeUInt16LE(0, 0x295c);
    b.writeUInt16LE(0x3000, 0x2034);
    b.writeUInt16LE(cap.dataSegment, 0x2036);
    b[0x3000] = 14;
    const native = JSON.parse(
      await readFile(
        manifest.artifacts["case-" + String(i).padStart(2, "0")].path,
      ),
    );
    const g = Object.create(Mountain.prototype);
    g.memory = new FlightMemory(b);
    g.entries = entries;
    g.spriteWork = { instructions: 0, portWrites: 0, calls: 0 };
    g.hudWork = { instructions: 0, portWrites: 0, lines: 0, numbers: 0 };
    if (omitLines) g.chargeLine = () => {};
    if (omitNumbers)
      g.number = function (commands, c) {
        return Mountain.prototype.number.call(this, commands, c, false);
      };
    const commands = [];
    g.hud(commands);
    const expected = [],
      hud = { instructions: 0, portWrites: 0, lines: 0, numbers: 0 },
      sprites = { instructions: 0, portWrites: 0, calls: 0 };
    let life = 0;
    for (const call of native.calls) {
      const a = call.args;
      if (call.kind === "line") {
        const c = {
          op: "line",
          x: a[0],
          y: a[1],
          x2: a[2],
          y2: a[3],
          color: call.color,
        };
        expected.push(c);
        const cost = egaLinePrimitiveWork(c);
        hud.instructions += cost.instructions;
        hud.portWrites += cost.portWrites;
        hud.lines++;
      } else if (call.kind === "draw") {
        const at = a[0];
        let asset, x, y, frame;
        if (at === 0x3720) {
          asset = 12;
          x = 200 + life * 32;
          y = 178;
          frame = 2 - life;
          life++;
        } else {
          asset = at === 0x370c ? 17 : at === 0x36d6 ? 16 : undefined;
          assert.ok(asset);
          x = b.readInt16LE(at);
          y = b.readInt16LE(at + 2);
          frame = b[at + 18];
        }
        expected.push({ op: "sprite", asset, x, y, frame });
        const cost = egaSpriteWork(entries[asset], frame, x, y);
        sprites.instructions += cost.instructions;
        sprites.portWrites += cost.portWrites;
        sprites.calls++;
      } else {
        assert.equal(call.kind, "number");
        const video = b.readUInt16LE(0x2038);
        const c = {
          x: a[0],
          y: a[1],
          value: a[2] + a[3] * 65536,
          color: a[4],
          background: a[5],
          rightAlign: a[6] !== 0,
        };
        const cost = originalHudNumberWork({
          ...c,
          surfaceOffset: b.readUInt16LE(video + 4),
          backPage: b[0x2052] !== 0,
        });
        expected.push({
          op: "text",
          text: cost.text,
          x: cost.x,
          y: c.y,
          color: c.color,
        });
        hud.instructions += cost.instructions;
        hud.portWrites += cost.portWrites;
        hud.numbers++;
      }
    }
    assert.deepEqual(commands, expected, "Native-derived HUD commands");
    assert.deepEqual(g.hudWork, hud, "Native-derived HUD work");
    assert.deepEqual(g.spriteWork, sprites, "Native-derived HUD sprites");
    const actualDS = Buffer.from(g.memory.bytes.subarray(0, 65535)),
      expectedDS = Buffer.from(native.after.results[0].data, "base64");
    actualDS.fill(0, 0xfeb0, 0xfef0);
    expectedDS.fill(0, 0xfeb0, 0xfef0);
    assert.deepEqual(actualDS, expectedDS, "Production HUD DS effects");
    assert.equal(hud.lines, 34);
    assert.equal(hud.numbers, 2);
    calls += commands.length;
    results.push({ case: i, ...hud, sprites: sprites.calls });
  }
  assert.equal(calls, 486);
  return results;
}
const results = await compare();
await assert.rejects(compare({ omitLines: true }), /HUD work/);
await assert.rejects(compare({ omitNumbers: true }), /HUD work/);
const g = new Mountain({
  image,
  entries: mt,
  mainEntries: main,
  variant: 0,
  difficulty: 0,
  day: 4,
  money: 0,
  seed: 11324,
});
for (const [at, value] of [
  [0x36d6, 40],
  [0x36d8, 172],
  [0x370c, 8],
  [0x370e, 175],
])
  assert.equal(g.memory.i(at), value, "Original entry HUD coordinates");
assert.equal(g.lastDrawingWork.lineCalls, 34);
assert.equal(g.lastDrawingWork.numberCalls, 2);
console.log(
  JSON.stringify(
    {
      scope:
        "Production HUD commands/work/effects match native caller plus independent primitive rules;not native full-HUD pixels/time",
      cases: 12,
      calls: 486,
      negativeControls: 2,
      results,
    },
    null,
    2,
  ),
);
