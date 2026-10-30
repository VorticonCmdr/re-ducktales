// Source-inferred helper calls composed with native primitive evidence.
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { originalGame } from "../tests/helpers/original-game.js";
import { FlightMemory } from "../src/game/flight-physics.js";
import { composeCaveRoom, drawCaveParty } from "../src/game/cave-scene.js";
import {
  caveRoomCompositionWork,
  caveInitialMinimapWork,
  caveRuntimePartyWork,
} from "../src/game/cave-runtime-work.js";
import { caveSpriteWork } from "../src/game/cave-work.js";
import { egaSignedCopyWork } from "../src/game/ega-copy-work.js";
import { normalCoreGraphicsMilliseconds } from "../src/game/ega-work.js";
const sha = (b) => createHash("sha256").update(b).digest("hex");
const m = JSON.parse(await readFile("reference/cave-composition-work.json"));
assert.equal(m.id, "original-cave-composition-runtime-work");
for (const [p, h] of Object.entries(m.sources))
  assert.equal(sha(await readFile(p)), h, "Changed cave source " + p);
for (const p of m.parents)
  assert.equal(sha(await readFile(p.path)), p.sha256, "Changed cave parent");
const data = {};
assert.deepEqual(Object.keys(m.artifacts).sort(), [
  "doors-listing",
  "functions",
  "room-listing",
]);
for (const [key, s] of Object.entries(m.artifacts)) {
  const b = await readFile(s.path).catch(() => {
    throw Error("SETUP: missing cave composition " + s.path);
  });
  assert.equal(b.length, s.bytes);
  assert.equal(sha(b), s.sha256);
  data[key] = JSON.parse(b);
}
for (const fn of Object.values(data.functions.functions))
  assert.equal(fn.language_id, "x86:LE:16:Real Mode");
for (const script of ["verify-cave-minimap-work.js", "verify-cave-work.js"])
  process.stdout.write(
    execFileSync(process.execPath, ["scripts/" + script], {
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
    }),
  );
const { archives } = await originalGame();
const entries = archives.get("EXP.ARC");
const parent = JSON.parse(await readFile("reference/cave-input.json"));
async function record(role) {
  const e = JSON.parse(await readFile(parent.artifacts[role].path));
  assert.equal(e.isError, false);
  const r = JSON.parse(e.content[0].text);
  assert.equal(r.aborted, false);
  return r.results;
}
const first = await record("first"),
  before = await record("pauseReturn");
const native = Buffer.from(first[2].data, "base64").subarray(0, 11054),
  body = Buffer.from(native),
  exe = await readFile("game/DUCKTALE.EXE");
assert.equal(sha(exe), m.executableSHA256);
const table = 0x1a800 + exe.readUInt16LE(0x1a818);
for (let i = 0; i < 196; i++) {
  const p = table + i * 4,
    at = exe.readUInt16LE(p) + (exe.readUInt16LE(p + 2) - 0xc17) * 16;
  body.writeUInt16LE((body.readUInt16LE(at) + 0x1000 - 0x1f5) & 65535, at);
}
assert.equal(m.ranges.length, 2);
function check(spec, bytes) {
  const r = data[spec.role];
  assert.equal(r.program, "CAVE_CODE.EXE");
  assert.equal(r.truncated, false);
  assert.equal(r.success, true);
  let next = spec.start;
  for (const row of r.instructions) {
    const [s, o] = row.address.split(":").map((v) => parseInt(v, 16));
    const at = s * 16 + o - 0x1c170;
    assert.equal(at, next);
    assert.equal(
      bytes.subarray(at, at + row.length).toString("hex"),
      row.bytes,
      "Original cave composition bytes",
    );
    next += row.length;
  }
  assert.equal(next, spec.end);
}
for (const spec of m.ranges) {
  assert.equal(
    native.subarray(spec.start + 5, spec.start + 10).toString("hex"),
    "9a9e1e0306",
  );
  body.set(Buffer.from("81ec000090", "hex"), spec.start + 5);
  check(spec, body);
}
const corrupt = Buffer.from(body);
corrupt[0x26bb] ^= 1;
assert.throws(
  () => check(m.ranges[0], corrupt),
  /Original cave composition bytes/,
);
const prototype = (await readFile("scripts/lib/cave-minimap-work.js", "utf8"))
  .replace(
    "// Source-derived analysis model, not yet connected to the browser runtime.",
    "// Original source-derived EGA minimap call plan and primitive workload.",
  )
  .replaceAll("../../src/game/", "./");
assert.equal(
  await readFile("src/game/cave-minimap-work.js", "utf8"),
  prototype,
  "Production minimap differs from verified model",
);
assert.deepEqual(
  await readFile("src/game/ega-copy-work.js"),
  await readFile("scripts/lib/ega-signed-copy-work.js"),
);
const raw = Buffer.from(before[1].data, "base64"),
  actual = new FlightMemory(Buffer.from(raw));
const commands = drawCaveParty(actual, []),
  party = caveRuntimePartyWork(actual, entries, commands);
assert.deepEqual(
  party,
  m.expectedPartyWork,
  "Native-input party primitive work",
);
assert.equal(party.instructions, 353323 + 2 + 33 * 54);
assert.equal(party.portWrites, 3520 + 33 * 5);
assert.deepEqual(
  caveInitialMinimapWork(new FlightMemory(Buffer.from(raw)), entries),
  m.expectedInitialWork,
);
const position = {
  1: [87, 14],
  2: [26, 92],
  3: [40, 24],
  4: [220, 40],
  5: [0, 144],
  6: [240, 122],
  7: [104, 65],
  8: [104, 8],
  9: [104, 8],
};
const copy = (sv, dv) =>
  egaSignedCopyWork({
    width: 320,
    height: 200,
    sourceX: 0,
    sourceY: 0,
    destinationX: 0,
    destinationY: 0,
    sourceStrideBytes: 40,
    destinationStrideBytes: 40,
    sourceVideo: sv,
    destinationVideo: dv,
  });
let checked = 0;
for (let mask = 0; mask < 16; mask++)
  for (let distance = 0; distance < 8; distance++)
    for (const pit of [false, true])
      for (const danger of [false, true]) {
        const mem = new FlightMemory(Buffer.from(raw));
        for (let i = 0; i < 64; i++) mem.i(0x5a42 + i * 2, 0);
        mem.i(0x4d32, 27);
        mem.i(0x4e08, distance);
        mem.i(0x5a42 + 27 * 2, mask | (pit ? 64 : 0));
        if (danger)
          for (const id of [26, 28, 19, 35]) mem.i(0x5a42 + id * 2, 64);
        const ids = [
          [8, 4],
          [4, 5],
          [2, 6],
          [1, 3],
        ]
          .filter(([bit]) => !(mask & bit))
          .map(([, id]) => id);
        if (pit) ids.push(2);
        if (distance < 2) ids.push(9);
        else if (distance < 4) ids.push(8);
        else if (distance < 6) ids.push(7);
        if (danger && mask) ids.push(1);
        const c = composeCaveRoom(mem, entries);
        assert.deepEqual(
          c.slice(1).map(({ asset, x, y, frame }) => ({ asset, x, y, frame })),
          ids.map((id) => ({
            asset: id,
            x: position[id][0],
            y: position[id][1],
            frame: 0,
          })),
          "Original room branch plan",
        );
        const expected = [
          copy(false, true),
          ...c.slice(1).map((s) => caveSpriteWork(entries, s)),
          copy(true, false),
        ];
        const sums = {
          instructions: 0,
          portWrites: 0,
          repeatOpcodes: 0,
          repeatIterations: 0,
        };
        for (const w of expected)
          for (const k of Object.keys(sums)) sums[k] += w[k] ?? 0;
        assert.deepEqual(caveRoomCompositionWork(entries, c), {
          ...sums,
          milliseconds: normalCoreGraphicsMilliseconds(sums, 3000),
          copies: 2,
          sprites: ids.length,
        });
        checked++;
      }
assert.equal(checked, 512);
assert.equal(m.expectedRoomCases, checked);
assert.throws(
  () => caveRoomCompositionWork(entries, []),
  /Unsupported cave room composition/,
);
assert.throws(
  () =>
    caveRoomCompositionWork(entries, [
      {
        op: "copy",
        asset: 0,
        x: 0,
        y: 0,
        width: 320,
        height: 200,
        sourceX: 0,
        sourceY: 0,
      },
      { op: "restore" },
    ]),
  /Unsupported cave room overlay/,
);
assert.throws(
  () =>
    assert.equal(
      party.instructions - 33 * 54,
      m.expectedPartyWork.instructions,
    ),
  /Expected values/,
);
const output = ".local/cave-composition-verification-" + Date.now();
await mkdir(output);
const result = {
  completed: true,
  sourceRanges: 2,
  sourceBytes: 598,
  sourceDerivedRoomCases: checked,
  nativeInputPartyWork: party,
  runtimeIntegrated: true,
  scope: m.scope,
};
await writeFile(
  output + "/result.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(
  "Cave composition:598 original bytes,512 source-derived room plans,two signed copies per composition,initial cached map and33 native-input marker points;4 failure controls. No whole-native cadence claim. Report:" +
    output,
);
