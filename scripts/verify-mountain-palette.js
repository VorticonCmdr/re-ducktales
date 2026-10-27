import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { parseArchive, EGA } from "../src/assets.js";
import { unpackImage } from "../src/game/executable.js";
import { FlightMemory } from "../src/game/flight-physics.js";
import { Mountain } from "../src/game/mountain.js";
import {
  renderMountainPixels,
  createMountainRasterCache,
} from "../src/game/mountain-scene.js";
import { capture, sameBytes } from "./verify-investments.js";
import { verifyMountainOriginal } from "./verify-mountain-original.js";
import build from "../reference/build.json" with { type: "json" };

export async function verifyMountainPalette(resources) {
  const manifest = JSON.parse(
    await readFile("reference/mountain-palette.json", "utf8"),
  );
  assert.equal(manifest.expectedCapturedPaletteCount, 1);
  assert.equal(manifest.expectedStaticLifeCases, 3);
  assert.equal(manifest.expectedSwatchCount, 48);
  assert.deepEqual(manifest.lifeCases, [3, 2, 1]);
  assert.equal(Object.keys(manifest.artifacts).length, 3);
  const local = {};
  for (const [name, item] of Object.entries(manifest.artifacts)) {
    const b = await readFile(item.path).catch(() => {
      throw Error(`SETUP: missing ${item.path}; see docs/mountain.md`);
    });
    assert.equal(
      createHash("sha256").update(b).digest("hex"),
      item.sha256,
      `corrupt ${item.path}`,
    );
    local[name] = JSON.parse(b);
  }
  const original = capture(local.entry, 3, 0xe0c0),
    scene = capture(local.scene, 2, 0xe0c0 + 0x317);
  const code = Buffer.from(original.results[2].data, "base64");
  const branches = [
    [3, 0x243, 0x248, 0x84, 0x8c, 4],
    [2, 0x259, 0x25e, 0x49, 0x41, 1],
    [1, 0x265, 0x26a, 0xc2, 0x4a, 2],
  ];
  function sourcePair(bytes, row) {
    const [, a, b, p, q] = row;
    sameBytes(
      bytes.subarray(a, a + 5),
      Buffer.from([0xc6, 0x06, 0x5b, 0x20, p]),
      "mountain palette source first slot",
    );
    sameBytes(
      bytes.subarray(b, b + 5),
      Buffer.from([0xc6, 0x06, 0x63, 0x20, q]),
      "mountain palette source second slot",
    );
  }
  for (const row of branches) sourcePair(code, row);
  const badCode = Buffer.from(code);
  badCode[0x247] ^= 1;
  assert.throws(
    () => sourcePair(badCode, branches[0]),
    /mountain palette source/,
  );
  assert.equal(local.driver.isError, false);
  const driver = JSON.parse(local.driver.content[0].text);
  assert.equal(driver.aborted, false);
  assert.equal(driver.results.length, 3);
  assert.ok(driver.results.every((x) => x.status === "ok"));
  assert.equal(driver.results[1].addr, 0x2ed70 + 0x8e);
  sameBytes(
    Buffer.from(driver.results[1].data, "base64"),
    Buffer.from(resources.driverEntries[1].data).subarray(0x8e, 0xe5),
    "shared original EGA palette handler",
  );
  const m = new FlightMemory(original.bytes),
    mountain = new Mountain(
      {
        ...resources,
        variant: 0,
        difficulty: m.b(0x8990),
        seed: m.view.getUint16(0x2229, true),
        money: m.view.getUint32(0x8cc0, true),
        day: m.b(0x4e0e),
      },
      m,
    );
  sameBytes(
    m.bytes.subarray(0x2056, 0x2066),
    scene.bytes.subarray(0x2056, 0x2066),
    "captured original mountain life3 palette",
  );
  // Authored logical-color page: every slot is checked against source-derived
  // colors. Life2/1 are explicit static-rule conditions,not original captures.
  const commands = Array.from({ length: 16 }, (_, color) => ({
    op: "fill",
    color,
    x: color * 20,
    y: 0,
    width: 20,
    height: 200,
  }));
  const cache = createMountainRasterCache();
  let swatches = 0,
    cases = 0;
  for (const row of branches) {
    const [lives, , , p, q, color] = row;
    m.b(0x4d34, lives);
    mountain.resetLife();
    assert.deepEqual([m.b(0x205b), m.b(0x2063)], [p, q]);
    const bytes = Uint8Array.from(m.bytes),
      first = renderMountainPixels(
        commands,
        mountain.entries,
        resources.mainEntries[42].data,
        m,
        cache,
      );
    assert.equal(first.length, 256000);
    assert.equal(
      renderMountainPixels(
        commands,
        mountain.entries,
        resources.mainEntries[42].data,
        m,
        cache,
      ),
      first,
      "stable palette cache",
    );
    for (let i = 0; i < 16; i++) {
      const expected = EGA[i === 5 || i === 13 ? color : i];
      sameBytes(
        first.subarray(i * 20 * 4, i * 20 * 4 + 4),
        Uint8Array.from([...expected, 255]),
        `mountain life${lives} logical color${i}`,
      );
      swatches++;
    }
    sameBytes(m.bytes, bytes, "mountain rendering observes memory");
    cases++;
  }
  assert.equal(cases, manifest.expectedStaticLifeCases);
  assert.equal(swatches, manifest.expectedSwatchCount);
  const last = renderMountainPixels(
    commands,
    mountain.entries,
    resources.mainEntries[42].data,
    m,
    cache,
  );
  const bad = Uint8ClampedArray.from(last);
  bad[5 * 20 * 4] ^= 1;
  assert.throws(
    () => sameBytes(bad, last, "negative mountain palette pixel"),
    /negative mountain palette pixel/,
  );
  const required = (items) =>
    assert.deepEqual(items, [3, 2, 1], "required life palette cases");
  assert.throws(() => required([3, 1]), /required life palette cases/);
  console.log(
    "Mountain palette:1 exact original life3 palette,3 static original-code life branches,48 rendered logical-color swatches and3 negative controls. Shared original EGA handler matched; no whole-frame mountain pixel parity claimed.",
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const raw = {};
  for (const name of ["DUCKTALE.EXE", "MT.ARC", "MAIN.ARC", "IT.DRV"]) {
    const bytes = (raw[name] = await readFile(`game/${name}`));
    assert.equal(bytes.length, build.files[name].bytes);
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      build.files[name].sha256,
    );
  }
  const resources = {
    image: unpackImage(raw["DUCKTALE.EXE"]),
    entries: parseArchive(raw["MT.ARC"]),
    mainEntries: parseArchive(raw["MAIN.ARC"]),
    driverEntries: parseArchive(raw["IT.DRV"]),
    executableRaw: raw["DUCKTALE.EXE"],
  };
  await verifyMountainOriginal(resources);
  await verifyMountainPalette(resources);
}
