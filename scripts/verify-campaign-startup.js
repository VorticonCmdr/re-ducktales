import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Game } from "../src/game/application.js";
import { Jungle } from "../src/game/jungle.js";
import { parseArchive } from "../src/assets.js";
import { parseLocations } from "../src/game/campaign.js";
import { unpackImage } from "../src/game/executable.js";
import { investmentResources } from "../src/game/investments.js";
import build from "../reference/build.json" with { type: "json" };
import manifest from "../reference/campaign-startup-browser.json" with { type: "json" };
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const files = {};
for (const name of [
  "DUCKTALE.EXE",
  "INVEST.ARC",
  "CHART.ARC",
  "LOC.ARC",
  "JG.ARC",
  "MAIN.ARC",
  "MT.ARC",
]) {
  const bytes = await readFile(`game/${name}`).catch(() => {
    throw Error(`SETUP: missing game/${name}`);
  });
  assert.equal(bytes.length, build.files[name].bytes);
  assert.equal(hash(bytes), build.files[name].sha256);
  files[name] = bytes;
}
const image = unpackImage(files["DUCKTALE.EXE"]);
const archive = (name) => parseArchive(files[name], name);
const g = new Game({
  biosSeed: 0,
  locations: parseLocations(archive("LOC.ARC")),
  investmentResources: {
    ...investmentResources(archive("INVEST.ARC"), archive("CHART.ARC")),
    image,
  },
});
assert.equal(g.marketMemory.i(0x2229) & 65535, manifest.startup.companySeed);
assert.equal(g.seed, manifest.startup.locationAndLootSeed);
g.input({ type: "fire" });
g.input({ type: "fire" });
assert.equal(g.seed, manifest.startup.easyDayOneSeed);
assert.equal(g.marketMemory.b(0x7162), 1);
assert.equal(g.campaign.locations[1].name, "Okeefadokie Swamp");
assert.equal(g.campaign.locations[31].name, "El Capitan");
assert.equal(manifest.mountain.checkpointSeeds.length, 26);
const resources = {
  image,
  entries: archive("JG.ARC"),
  mainEntries: archive("MAIN.ARC"),
  mountainEntries: archive("MT.ARC"),
};
function replay({
  alterInput = false,
  alterPixel = false,
  omitCheckpoint = false,
} = {}) {
  const route = manifest.jungle;
  const stream = route.inputEvents.flatMap((e) => {
    assert.ok(Number.isInteger(e.count) && e.count > 0);
    return Array(e.count).fill(e.byte);
  });
  assert.equal(stream.length, 857);
  const checks = [...route.checkpoints];
  if (omitCheckpoint) checks.pop();
  assert.equal(checks.length, 23, "missing startup jungle checkpoint");
  assert.deepEqual(
    checks.map((c) => c.inputCount),
    route.checkpointIds,
  );
  if (alterInput) stream[67] = 0;
  const j = new Jungle({ ...resources, ...route.initial });
  let driver = 0,
    retrace = 0,
    events = 0,
    checked = 0,
    presentations = j.presentations;
  while (!j.outcome && events < 15000) {
    const before = j.inputs.length,
      byte = stream[before];
    if (byte !== undefined)
      j.setControls({
        direction:
          { 1: "up", 3: "right", 5: "down", 7: "left" }[byte & 63] ?? null,
        fire: !!(byte & 64),
      });
    if ((driver + 1) / (1193182 / (1365 * 12)) <= (retrace + 1) / 70.086) {
      driver++;
      j.advanceTick();
    } else {
      retrace++;
      j.advanceRetrace();
    }
    events++;
    assert.ok(j.inputs.length - before <= 1, "skipped input boundary");
    if (j.presentations !== presentations) {
      assert.equal(j.presentations, presentations + 1, "skipped rendering");
      presentations++;
    }
    if (j.inputs.length > before) {
      assert.notEqual(byte, undefined, "unfinished startup input stream");
      assert.equal(j.inputs.at(-1).input, byte);
      const check = checks[checked];
      if (check?.inputCount === j.inputs.length) {
        assert.deepEqual(
          j.snapshot(),
          check.state,
          `startup jungle checkpoint${checked}`,
        );
        assert.equal(hash(j.memory.bytes), check.memorySha256);
        const pixels = Uint8Array.from(j.current);
        if (alterPixel) pixels[0] ^= 1;
        assert.equal(hash(pixels), check.pixelSha256, "startup pixels");
        checked++;
      }
    }
  }
  assert.equal(checked, 23, "unfinished startup checkpoints");
  assert.equal(events, route.expectedClockEventCount);
  assert.equal(presentations, route.expectedPresentationCount);
  assert.equal(j.inputs.length, stream.length, "unconsumed required inputs");
  assert.deepEqual(j.snapshot(), route.final);
  assert.equal(hash(j.memory.bytes), route.finalMemorySha256);
  assert.equal(hash(j.current), route.finalPixelSha256);
  assert.equal(j.outcome.code, 1);
}
replay();
assert.throws(
  () => replay({ alterInput: true }),
  /startup jungle checkpoint|unfinished/,
);
assert.throws(() => replay({ alterPixel: true }), /startup pixels/);
assert.throws(
  () => replay({ omitCheckpoint: true }),
  /missing startup jungle checkpoint/,
);
console.log(
  "Corrected campaign startup and independent jungle completion: 23 exact state/DS/pixel checkpoints,857 inputs,6409 clocks,904 presentations; negative controls passed. Port regression,not an original campaign replay.",
);
