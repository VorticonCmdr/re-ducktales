import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { parseArchive } from "../src/assets.js";
import { unpackImage } from "../src/game/executable.js";
import { Game } from "../src/game/application.js";
import { parseLocations } from "../src/game/campaign.js";
import { parseCaveMaps } from "../src/game/cave-scene.js";
import { FlightMemory } from "../src/game/flight-physics.js";
class ObservedGame extends Game {
  arrive(target, flags) {
    this.dispatch = {
      target,
      flags,
      seed: this.seed,
      money: this.money,
      day: this.campaign.day,
      location: this.campaign.location,
    };
    super.arrive(target, flags);
  }
  startExpedition() {
    this.beforeCave = {
      seed: this.seed,
      money: this.money,
      day: this.campaign.day,
      location: this.campaign.location,
      variant: this.briefing.variant,
    };
    super.startExpedition();
  }
}
function captured(raw, ip, code = false) {
  assert.equal(raw.isError, false);
  const j = JSON.parse(raw.content[0].text);
  assert.equal(j.aborted, false);
  assert.equal(j.results.length, code ? 3 : 2);
  assert.ok(j.results.every((x) => x.status === "ok"));
  const c = j.results[0].registers;
  assert.deepEqual(
    [c.cs, c.eip, c.ds, c.ss],
    [ip === 0 ? 0xe0c : 0x1f5, ip, 0x1403, 0x1403],
  );
  const bytes = Buffer.from(j.results[1].data, "base64");
  assert.equal(bytes.length, 65536);
  if (code) {
    const signature = Buffer.from(j.results[2].data, "base64").toString("hex");
    assert.ok(
      signature.startsWith(
        ip === 0
          ? "558becb886009a9e1e030656c646f200"
          : "8a46e2988bf056a03c5b98500ee8370c",
      ),
      "original retry code identity",
    );
  }
  return { c, b: bytes };
}
function state(g) {
  return {
    seed: g.seed,
    money: g.money,
    day: g.campaign.day,
    location: g.campaign.location,
  };
}
function expected(b) {
  return {
    seed: b.readUInt16LE(0x2229),
    money: b.readUInt32LE(0x8cc0),
    day: b[0x4e0e],
    location: b[0x5b3c],
  };
}
export function compareRetry(
  local,
  resources,
  { omitGuideDraw = false, alterDay = false } = {},
) {
  const before = captured(local.before, 0x439, true),
    dispatch = captured(local.dispatch, 0x4ca),
    entry = captured(local.entry, 0, true);
  const target = before.b[before.c.ebp - 30];
  assert.equal(target, 15);
  assert.equal(before.b[0x5b3c], target);
  const ordered = Array.from({ length: 35 }, (_, slot) => {
    const at = before.b.readUInt16LE(0x4e2a + slot * 8);
    const name = before.b
      .subarray(at, at + 32)
      .toString("ascii")
      .split("\0")[0];
    const source = resources.locations.find((l) => l.name === name);
    assert.ok(source, `unknown original location ${slot}`);
    const [x, y, flags] = [32, 34, 36].map((d) =>
      before.b.readUInt16LE(at + d),
    );
    assert.deepEqual([x, y, flags], [source.x, source.y, source.flags]);
    return {
      ...source,
      treasure: before.b.readUInt16LE(at + 38),
      playerCollected: !!before.b[0x4e30 + slot * 8],
      rivalCollected: !!before.b[0x4e31 + slot * 8],
    };
  });
  assert.equal(ordered[target].name, "Klondike Mines");
  assert.equal(ordered[target].playerCollected, false);
  assert.equal(ordered[target].rivalCollected, false);
  const g = new ObservedGame(resources);
  // Conditional initial state comes only from the BEFORE capture. No output
  // values, timer fitting, memory restore or expected final state supply inputs.
  Object.assign(g.campaign, {
    locations: ordered,
    day: before.b[0x4e0e],
    location: before.b[0x5b3c],
    seed: before.b.readUInt16LE(0x2229),
  });
  g.seed = g.campaign.seed;
  g.money = before.b.readUInt32LE(0x8cc0);
  g.rareCoinTaken = !!before.b.readUInt16LE(0x4e26);
  g.flightMemory = new FlightMemory(before.b.slice());
  g.campaign.openMap();
  g.scene = "map";
  assert.equal(g.campaign.selected, target);
  g.input({ type: "fire" });
  assert.equal(dispatch.c.eax, 0, "original same-location journey cost");
  assert.equal(dispatch.b.readUInt16LE(dispatch.c.ebp - 20), 0);
  assert.ok(g.dispatch, "missing direct expedition dispatch");
  if (alterDay) g.dispatch.day++;
  assert.deepEqual(
    { ...g.dispatch, target: undefined, flags: undefined },
    { ...expected(dispatch.b), target: undefined, flags: undefined },
    "retry dispatch divergence",
  );
  assert.equal(g.dispatch.flags, ordered[target].flags);
  assert.equal(g.dispatch.target, target);
  assert.equal(g.flight, null);
  assert.equal(g.departure, null);
  assert.equal(g.rareCoinTaken, false);
  assert.equal(g.scene, "expedition-briefing");
  if (omitGuideDraw) g.seed = before.b.readUInt16LE(0x2229);
  for (let tick = 0; tick < 210; tick++) {
    g.advanceTick();
    g.advanceRetrace();
  }
  assert.equal(g.scene, "cave");
  assert.ok(g.beforeCave, "missing cave call");
  const { variant, ...actual } = g.beforeCave;
  assert.deepEqual(actual, expected(entry.b), "retry guide/entry divergence");
  assert.equal(variant, entry.b.readUInt16LE(entry.c.esp + 4));
  assert.equal(g.cave.options.seed, entry.b.readUInt16LE(0x2229));
  assert.equal(
    g.cave.inputs.length,
    0,
    "unexpected cave input before entry checkpoint",
  );
  return 2;
}
export async function verifyVisits() {
  const manifest = JSON.parse(
    await readFile("reference/campaign-retry.json", "utf8"),
  );
  assert.equal(manifest.expectedCheckpointCount, 2);
  assert.equal(manifest.expectedInputCount, 1);
  const local = {};
  for (const [k, f] of Object.entries(manifest.artifacts)) {
    const bytes = await readFile(f.path).catch(() => {
      throw Error(`SETUP: missing ${f.path}; see docs/campaign-visits.md`);
    });
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      f.sha256,
      `corrupt ${f.path}`,
    );
    local[k] = JSON.parse(bytes);
  }
  assert.deepEqual(Object.keys(local).sort(), ["before", "dispatch", "entry"]);
  const build = JSON.parse(await readFile("reference/build.json", "utf8")),
    raw = {};
  for (const n of [
    "DUCKTALE.EXE",
    "LOC.ARC",
    "CLUES.ARC",
    "EXP.ARC",
    "CAVEMAPS.ARC",
  ]) {
    const b = await readFile("game/" + n);
    assert.equal(b.length, build.files[n].bytes);
    assert.equal(
      createHash("sha256").update(b).digest("hex"),
      build.files[n].sha256,
    );
    raw[n] = b;
  }
  const resources = {
    locations: parseLocations(parseArchive(raw["LOC.ARC"])),
    expeditionResources: {
      image: unpackImage(raw["DUCKTALE.EXE"]),
      entries: parseArchive(raw["EXP.ARC"]),
      maps: parseCaveMaps(parseArchive(raw["CAVEMAPS.ARC"])),
      clues: parseArchive(raw["CLUES.ARC"]),
    },
  };
  assert.equal(
    compareRetry(local, resources),
    manifest.expectedCheckpointCount,
  );
  assert.throws(
    () => compareRetry(local, resources, { omitGuideDraw: true }),
    /guide\/entry divergence/,
  );
  assert.throws(
    () => compareRetry(local, resources, { alterDay: true }),
    /dispatch divergence/,
  );
  assert.throws(() => compareRetry({ ...local, dispatch: null }, resources));
  console.log(
    "Campaign retry: 2 conditional original checkpoints, one independent map-fire event; no flight/travel day, exact guide RNG/variant and cave call; 3 negative controls. No collected-notice pixel or audio comparison claimed.",
  );
}
if (process.argv[1]?.endsWith("verify-visits.js")) await verifyVisits();
