// Exact source/path work and decoded bytes. Not complete loader timing parity.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { originalGame } from "../tests/helpers/original-game.js";
import {
  lzwSpriteLoadWork,
  egaSpriteConversionWork,
  egaGraphicsConversionWork,
} from "../src/game/sprite-load-work.js";
import { normalCoreGraphicsMilliseconds } from "../src/game/ega-work.js";
const sha = (b) => createHash("sha256").update(b).digest("hex");
const manifest = JSON.parse(
  await readFile("reference/sprite-load-work-source.json"),
);
assert.equal(manifest.kind, "original-lzw-ega-sprite-work-source");
assert.equal(manifest.nativeTimingAcceptance, false);
async function artifact(spec) {
  const b = await readFile(spec.path);
  assert.equal(b.length, spec.bytes);
  assert.equal(sha(b), spec.sha256);
  return JSON.parse(b);
}
await artifact(manifest.build);
await artifact(manifest.nativeParent);
await artifact(manifest.backgroundParent);
execFileSync("python3", ["scripts/verify_cave_loader_profile.py"], {
  env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
  stdio: "inherit",
});
execFileSync(
  "python3",
  [
    "scripts/verify_cave_loader_profile.py",
    "--manifest=reference/cave-background-load-native.json",
  ],
  {
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
    stdio: "inherit",
  },
);
const { image, archives } = await originalGame(),
  exe = await readFile("game/DUCKTALE.EXE");
// Relocate the original unpacked resident to the declared analysis bias1000.
const relocated = Uint8Array.from(image),
  v = new DataView(relocated.buffer);
let cursor = exe.readUInt16LE(8) * 16 + exe.readUInt16LE(22) * 16 + 0x125;
for (let region = 0; region < 16; region++) {
  const count = exe.readUInt16LE(cursor);
  cursor += 2;
  for (let i = 0; i < count; i++) {
    const pos = region * 65536 + exe.readUInt16LE(cursor);
    cursor += 2;
    v.setUint16(pos, (v.getUint16(pos, true) + 0x1000) & 65535, true);
  }
}
const instructions = [];
for (const [name, start, end] of [
  ["lzw", 0xefd, 0x10e8],
  ["prefix", 0x10e8, 0x112b],
  ["converter", 0x12f0, 0x13ce],
]) {
  const raw = await artifact(manifest.source[name]),
    d = JSON.parse(raw.content[0].text);
  assert.equal(d.success, true);
  assert.equal(d.truncated, false);
  assert.equal(d.program, "CAVE_CODE.EXE");
  let at = start;
  for (const i of d.instructions) {
    assert.equal(i.address, `140e:${at.toString(16).padStart(4, "0")}`);
    const bytes = Buffer.from(i.bytes, "hex");
    assert.equal(bytes.length, i.length);
    assert.equal(
      Buffer.from(
        relocated.subarray(0x40e0 + at, 0x40e0 + at + bytes.length),
      ).toString("hex"),
      i.bytes,
    );
    instructions.push({ ...i, at });
    at += i.length;
  }
  assert.equal(at, end);
}
assert.equal(instructions.length, manifest.expectedSourceInstructions);
assert.equal(instructions.length, 294);
const count = (a, b) =>
  instructions.filter((i) => i.at >= a && i.at < b).length;
assert.equal(instructions.find((i) => i.at === 0x134a).bytes, "75b5"); //Backedge1301 repeats LEADI for BOTH nibbles.
assert.equal(instructions.find((i) => i.at === 0x1075).bytes, "8ec0"); //MOV ES,AX;tool text reverses operands,bytes authoritative.
// Independent whole-string dictionary oracle,not the native prefix-chain model.
function oracle(packed) {
  let dictionary,
    previous = null,
    width = 9,
    threshold = 512,
    bit = 0,
    base = 0,
    nextLiteral = false;
  const stats = {
    codes: 0,
    clears: 0,
    specials: 0,
    widthChanges: 0,
    dictionarySteps: 0,
    fileReads: 1,
  };
  let bitsWork = 0,
    repeatIterations = 0,
    refills = 0,
    thresholdChecks = 0,
    normal = 0,
    normalBytes = 0;
  const reset = () => {
    dictionary = Array.from({ length: 258 }, (_, i) =>
      i < 256 ? Uint8Array.of(i) : null,
    );
    previous = null;
    width = 9;
    threshold = 512;
  };
  reset();
  for (;;) {
    assert.ok(bit + width <= packed.length * 8);
    const byte = bit >>> 3;
    bitsWork +=
      count(0x1071, 0x1092) +
      count(0x10c3, 0x10d0) +
      count(0x10d6, 0x10e8) +
      3 * (bit & 7);
    if (byte >= base + 1021) {
      repeatIterations += base + 1024 - byte;
      base = byte;
      bitsWork += count(0x1092, 0x10c3);
      refills++;
      stats.fileReads++;
    }
    const code =
      ((packed[byte] |
        ((packed[byte + 1] ?? 0) << 8) |
        ((packed[byte + 2] ?? 0) << 16)) >>>
        (bit & 7)) &
      ((1 << width) - 1);
    bit += width;
    stats.codes++;
    if (code === 256) {
      reset();
      stats.clears++;
      nextLiteral = true;
      continue;
    }
    if (code === 257) break;
    let value = dictionary[code],
      special = false;
    if (code === dictionary.length && previous) {
      value = Uint8Array.from([...previous, previous[0]]);
      special = true;
      stats.specials++;
    }
    assert.ok(value);
    if (nextLiteral) {
      assert.equal(value.length, 1);
      nextLiteral = false;
    } else {
      normal++;
      normalBytes += value.length;
      stats.dictionarySteps += value.length - 1 - (special ? 1 : 0);
    }
    if (previous) {
      assert.ok(dictionary.length < 4096);
      dictionary.push(Uint8Array.from([...previous, value[0]]));
      if (dictionary.length >= threshold) {
        thresholdChecks++;
        if (width < 12) {
          width++;
          threshold <<= 1;
          stats.widthChanges++;
        }
      }
    }
    previous = value;
  }
  const loops = stats.codes - stats.clears;
  const work =
    count(0xefd, 0xf70) +
    count(0x1064, 0x1071) +
    bitsWork +
    loops * 3 +
    1 +
    (loops - 1) * 2 +
    stats.clears * count(0xf80, 0xfad) +
    normal *
      (count(0xfb0, 0xfc0) +
        2 +
        count(0xff1, 0x100b) +
        1 +
        count(0x101b, 0x1052) +
        1) +
    stats.specials * count(0xfc0, 0xfce) +
    stats.dictionarySteps * (2 + count(0xfd6, 0xff1)) +
    normalBytes * 5 +
    thresholdChecks * 2 +
    stats.widthChanges * 2;
  return {
    ...stats,
    instructions: work,
    repeatOpcodes: refills,
    repeatIterations,
  };
}
function conversionCount(entry) {
  const sprite = entry.type === 2;
  let opaque = 0;
  for (const b of entry.data) {
    opaque += b >>> 4 !== entry.data[0] >>> 4;
    opaque += (b & 15) !== entry.data[0] >>> 4;
  }
  const setup = count(0x12f0, 0x1301),
    pixel =
      count(0x1301, 0x1336) +
      (sprite ? count(0x1336, 0x133c) : 0) +
      count(0x1342, 0x134c);
  const group =
    count(0x1352, 0x135e) +
    count(0x135e, 0x138f) -
    (sprite ? 0 : count(0x1383, 0x138b)) +
    count(0x13bb, 0x13c9);
  // First-call dispatch follows mode1's initialization path;subsequent calls3.
  const initial =
    count(0x10e8, 0x10ef) + count(0x10f2, 0x1117) + count(0x1121, 0x112b) + 1;
  const n = entry.data.length;
  return (
    initial +
    (n - 1) * 3 +
    n * (setup + 2 * pixel + count(0x134c, 0x1352) + count(0x13c9, 0x13ce)) +
    (n / 4) * group +
    (sprite ? opaque * count(0x133c, 0x1342) : 0)
  );
}
const raw = await readFile("game/EXP.ARC");
function compareCount(actual, expected) {
  assert.equal(actual, expected, "Original converter instruction count");
}
function comparePlanes(actual, expected) {
  assert.equal(Buffer.compare(actual, expected), 0, "Original planar bytes");
}
let cases = 0,
  pictures = 0,
  native = null,
  background = null,
  negatives = 0;
for (const entry of archives.get("EXP.ARC")) {
  if (![1, 2].includes(entry.type)) continue;
  const packed = raw.subarray(
      entry.offset + 16,
      entry.offset + 16 + entry.packedSize,
    ),
    lzw = lzwSpriteLoadWork(packed, entry.data.length),
    expected = oracle(packed);
  assert.equal(
    Buffer.compare(lzw.decoded, entry.data),
    0,
    `Decoded sprite${entry.index}`,
  );
  for (const [field, value] of Object.entries(expected))
    assert.equal(lzw[field], value, `LZW${entry.index} ${field}`);
  const converted = egaGraphicsConversionWork(entry),
    expectedCount = conversionCount(entry);
  compareCount(converted.instructions, expectedCount);
  if (entry.type === 2) cases++;
  else pictures++;
  if (entry.index === 10 || entry.index === 0) {
    const profile = await artifact(
        entry.index === 0 ? manifest.backgroundParent : manifest.nativeParent,
      ),
      spec = profile.artifacts["cave-loader-payload.json"],
      capture = await artifact(spec);
    const target = Buffer.from(capture.read.results[0].data, "base64");
    comparePlanes(converted.planes, target);
    assert.throws(
      () =>
        compareCount(converted.instructions - entry.data.length, expectedCount),
      /Original converter instruction count/,
    );
    negatives++;
    const altered = Uint8Array.from(converted.planes);
    altered[200] ^= 1;
    assert.throws(
      () => comparePlanes(altered, target),
      /Original planar bytes/,
    );
    negatives++;
    const partial = normalCoreGraphicsMilliseconds(
      {
        instructions: lzw.instructions + converted.instructions,
        portWrites: 0,
        repeatOpcodes: lzw.repeatOpcodes,
        repeatIterations: lzw.repeatIterations,
      },
      3000,
    );
    const observation = {
      decodedBytes: entry.data.length,
      planarBytes: target.length,
      lzwInstructions: lzw.instructions,
      converterInstructions: converted.instructions,
      accountedMilliseconds: partial,
      nativeWholeLoadCounts: profile.expectedDriverCounts,
      nativeTimingAcceptance: false,
      omitted: manifest.omitted,
    };
    if (entry.index === 0) {
      background = observation;
      assert.throws(
        () =>
          comparePlanes(
            egaSpriteConversionWork({ ...entry, type: 2 }).planes,
            target,
          ),
        /Original planar bytes/,
      );
      negatives++;
    } else native = observation;
  }
}
assert.equal(cases, manifest.expectedSprites);
assert.equal(cases, 46);
assert.equal(pictures, manifest.expectedPictures);
assert.equal(pictures, 1);
assert.ok(native && background);
assert.throws(
  () => lzwSpriteLoadWork(Uint8Array.of(0, 0), 2),
  /Unsupported|Truncated/,
);
negatives++;
assert.throws(
  () => egaSpriteConversionWork({ type: 2, width: 7 }),
  /Unsupported/,
);
negatives++;
assert.equal(negatives, 7);
console.log(
  JSON.stringify(
    {
      sourceInstructions: 294,
      originalBytes: 780,
      spriteCases: cases,
      pictureCases: pictures,
      negativeControls: negatives,
      native,
      background,
    },
    null,
    2,
  ),
);
