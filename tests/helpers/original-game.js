import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import build from "../../reference/build.json" with { type: "json" };
import { parseArchive } from "../../src/assets.js";
import { unpackImage } from "../../src/game/executable.js";
import { Game } from "../../src/game/application.js";
import { parseLocations, parseLoot } from "../../src/game/campaign.js";
import { parseCaveMaps } from "../../src/game/cave-scene.js";
import { investmentResources } from "../../src/game/investments.js";
export async function originalGame({ physicalKeyboard = false } = {}) {
  assert.equal(typeof physicalKeyboard, "boolean");
  const archives = new Map();
  let image;
  for (const [name, expected] of Object.entries(build.files)) {
    const bytes = await readFile(`game/${name}`).catch(() => {
      throw Error(`SETUP: missing original game/${name}`);
    });
    assert.equal(bytes.length, expected.bytes, `Corrupt original ${name}`);
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      expected.sha256,
      `Unsupported original ${name}`,
    );
    if (name === "DUCKTALE.EXE") image = unpackImage(bytes);
    else if (/\.(ARC|DRV)$/.test(name))
      archives.set(name, parseArchive(bytes, name));
  }
  const a = (name) => archives.get(name);
  const game = new Game({
    expeditionInput: physicalKeyboard ? "keyboard" : "digital",
    destinationInput: physicalKeyboard ? "keyboard" : "boundary",
    biosSeed: 0,
    audioEnabled: false,
    openingResources: { image, entries: a("MAIN.ARC") },
    bankResources: { image, entries: a("MAC.ARC") },
    locations: parseLocations(a("LOC.ARC")),
    loot: parseLoot(a("LOOT.ARC")),
    investmentResources: {
      ...investmentResources(a("INVEST.ARC"), a("CHART.ARC")),
      image,
    },
    expeditionResources: {
      image,
      entries: a("EXP.ARC"),
      maps: parseCaveMaps(a("CAVEMAPS.ARC")),
      clues: a("CLUES.ARC"),
      mountainEntries: a("MT.ARC"),
      jungleEntries: a("JG.ARC"),
      photographyEntries: a("PS.ARC"),
      mainEntries: a("MAIN.ARC"),
    },
    flightResources: { image, entries: a("PLANE.ARC") },
  });
  return { game, image, archives };
}
