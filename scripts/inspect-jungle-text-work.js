// Static control-flow evidence only. This never changes drawing deadlines.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { originalGame } from "../tests/helpers/original-game.js";
import { FlightMemory } from "../src/game/flight-physics.js";
import { presentJungleFrame } from "../src/game/jungle-presentation.js";
import { normalCoreGraphicsMilliseconds } from "../src/game/ega-work.js";
import { egaTransparentTextWork } from "./lib/ega-text-work.js";
const sha = (b) => createHash("sha256").update(b).digest("hex");
const manifest = JSON.parse(await readFile("reference/ega-text-static.json"));
const artifacts = {};
for (const [role, s] of Object.entries(manifest.artifacts)) {
  const b = await readFile(s.path).catch(() => {
    throw Error("SETUP: missing static text evidence " + s.path);
  });
  assert.equal(b.length, s.bytes);
  assert.equal(sha(b), s.sha256);
  artifacts[role] = JSON.parse(b);
}
for (const [p, h] of Object.entries(manifest.sources))
  assert.equal(sha(await readFile(p)), h, "Changed static text source " + p);
const { archives, image } = await originalGame(),
  driver = archives.get("IT.DRV")[1].data,
  font = archives.get("MAIN.ARC")[42].data;
assert.equal(sha(driver), manifest.driverSHA256);
assert.equal(sha(font), manifest.fontSHA256);
assert.equal(
  new DataView(driver.buffer, driver.byteOffset, driver.byteLength).getUint16(
    0x1a,
    true,
  ),
  0x81f,
);
assert.equal(
  Buffer.from(font.subarray(0, 8)).toString("hex"),
  "aa55080008000800",
);
function bytes(dis, source, start, end, base = 0) {
  assert.equal(dis.success, true);
  assert.equal(dis.truncated, false);
  let next = start;
  for (const i of dis.instructions) {
    const at = parseInt(i.address.split(":").at(-1), 16);
    assert.equal(at, next);
    assert.equal(
      Buffer.from(source.subarray(base + at, base + at + i.length)).toString(
        "hex",
      ),
      i.bytes,
      "Original text instruction bytes",
    );
    next += i.length;
  }
  assert.equal(next, end);
}
bytes(artifacts.driver, driver, 0x81f, 0xa27);
// Reproduce the supported EXEPACK relocation stream at Ghidra's load bias.
const executable = await readFile("game/DUCKTALE.EXE"),
  loaded = Buffer.from(image);
let cursor =
  executable.readUInt16LE(8) * 16 + executable.readUInt16LE(22) * 16 + 0x125;
for (let region = 0; region < 16; region++) {
  const count = executable.readUInt16LE(cursor);
  cursor += 2;
  for (let i = 0; i < count; i++) {
    const at = executable.readUInt16LE(cursor) + region * 65536;
    cursor += 2;
    loaded.writeUInt16LE((loaded.readUInt16LE(at) + 0x1000) & 65535, at);
  }
}
assert.equal(
  cursor,
  (executable.readUInt16LE(4) - 1) * 512 + (executable.readUInt16LE(2) || 512),
);
bytes(artifacts.numeric, loaded, 0x227, 0x2a7, 0x1c40);
const bad = structuredClone(artifacts.driver);
bad.instructions[0].bytes = "90";
assert.throws(
  () => bytes(bad, driver, 0x81f, 0xa27),
  /Original text instruction bytes/,
);
// Independently sum basic-block sizes from byte-validated source. Count OUT
// instructions from mnemonics; no expected state/pixels/timers supply inputs.
const ips = artifacts.driver.instructions.filter(
  (i) => parseInt(i.address.slice(-4), 16) < 0x909,
);
const range = (lo, hi = lo) =>
  ips.filter((i) => {
    const p = parseInt(i.address.slice(-4), 16);
    return p >= lo && p <= hi;
  });
function expected(input) {
  const path = [
    ...range(0x81f, 0x837),
    ...(input.backPage ? range(0x839, 0x83f) : []),
    ...range(0x841, 0x88a),
  ];
  let x = input.x & 65535,
    di = (x + (input.surfaceOffset ?? 0)) & 65535,
    glyphs = 0,
    alignedGlyphs = 0;
  const height = input.fontHeight ?? 8,
    width = input.fontWidth ?? 8;
  for (const c of input.text.split("\0")[0]) {
    path.push(...range(0x88d, 0x8c2));
    const aligned = (di & 7) === 0;
    if (aligned) {
      alignedGlyphs++;
      path.push(...range(0x8c4));
    }
    for (let y = 0; y < (height || 256); y++)
      path.push(...(aligned ? range(0x8c6, 0x8d2) : range(0x8d6, 0x8ef)));
    if (aligned) path.push(...range(0x8d4));
    path.push(...range(0x8f1, 0x8ff));
    x = (x + width) & 65535;
    di = x;
    glyphs++;
  }
  path.push(...range(0x88d, 0x893), ...range(0x901, 0x906));
  return {
    instructions: path.length,
    portWrites: path.filter((i) => i.mnemonic === "OUT").length,
    glyphs,
    alignedGlyphs,
  };
}
let cases = 0;
for (let x = 0; x < 8; x++)
  for (const text of ["", "0", "12", "4294967295", "1\0ignored"])
    for (const backPage of [false, true])
      for (const width of [0, 7, 8]) {
        const input = { x, text, backPage, fontWidth: width };
        const trace = [];
        const got = egaTransparentTextWork(input, {
          instruction: (ip) => trace.push(ip),
        });
        assert.deepEqual(got, expected(input));
        assert.equal(trace.length, got.instructions);
        assert.ok(
          trace.every((ip) =>
            ips.some((i) => parseInt(i.address.slice(-4), 16) === ip),
          ),
        );
        cases++;
      }
for (const input of [
  { x: 65535, surfaceOffset: 1, text: "123" },
  { x: -1, text: "00", fontWidth: 7, fontHeight: 0 },
]) {
  assert.deepEqual(egaTransparentTextWork(input), expected(input));
  cases++;
}
assert.equal(cases, 242);
const sample = expected({ x: 0, text: "1" });
assert.throws(() =>
  assert.deepEqual({ ...sample, portWrites: sample.portWrites - 1 }, sample),
);
assert.throws(() =>
  assert.deepEqual(
    { ...sample, instructions: sample.instructions - 3 },
    sample,
  ),
);
assert.throws(
  () => egaTransparentTextWork({ x: 0, text: "\u0100" }),
  /Unsupported/,
);
const parent = JSON.parse(await readFile("reference/jungle-presentation.json")),
  prior = JSON.parse(await readFile("reference/jungle-draw-work.json"));
assert.equal(prior.expectedCaseCount, 6);
const rows = [];
for (const c of prior.cases) {
  const spec = parent.artifacts[c.id + "-before"],
    raw = await readFile(spec.path);
  assert.equal(sha(raw), spec.sha256);
  const batch = JSON.parse(JSON.parse(raw).content[0].text);
  assert.equal(batch.aborted, false);
  assert.ok(batch.results.every((r) => r.status === "ok"));
  const m = new FlightMemory(Buffer.from(batch.results[1].data, "base64")),
    texts = [];
  presentJungleFrame(m, {
    color: Buffer.from(batch.results[2].data, "base64")[0],
    draw() {},
    copy() {},
    line() {},
    text(c) {
      texts.push({ ...c, work: egaTransparentTextWork(c) });
    },
    wait() {
      assert.fail("Unexpected wait");
    },
    sound() {
      assert.fail("Unexpected sound");
    },
  });
  assert.equal(
    texts.length,
    c.work.omittedTexts,
    "Missing original text calls",
  );
  const totals = texts.reduce(
    (a, t) => ({
      instructions: a.instructions + t.work.instructions,
      portWrites: a.portWrites + t.work.portWrites,
    }),
    { instructions: 0, portWrites: 0 },
  );
  rows.push({
    case: c.id,
    texts,
    ...totals,
    milliseconds: totals.instructions
      ? normalCoreGraphicsMilliseconds(totals, 3000)
      : 0,
  });
}
assert.equal(rows.length, 6);
assert.equal(
  rows.reduce((a, r) => a + r.texts.length, 0),
  4,
);
console.log(
  JSON.stringify(
    {
      scope:
        "Statically inferred EGA transparent text driver only.242 control-flow cases and3 comparator negatives;not independent native evidence,formatter cost,native pixels/cadence or runtime integration.",
      rows,
    },
    null,
    2,
  ),
);
