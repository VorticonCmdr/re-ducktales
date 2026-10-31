// Source-authored controls, observed first in actual Easy browser exploration.
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { withCarlsbadBrowser as withRecordedBrowser } from "./carlsbad-browser.js";
import { finishSecurityEntry } from "../../tests/browser/helpers/security.js";
import { explorePhysicalFlight } from "../../tests/browser/helpers/flight-policy.js";
import {
  observeRecordedRoute,
  saveRecordedRoute,
} from "../../tests/browser/helpers/entry-recording.js";
import { sha } from "./local-scenario-source.js";
import { replayRecordedScenario } from "./recorded-browser-scenario.js";
export const jungleCases = [
  {
    key: "bermuda",
    variant: 1,
    location: 2,
    inputs: 503,
    treasure: 2000,
    pickups: 200,
  },
  {
    key: "boola",
    variant: 2,
    location: 4,
    inputs: 421,
    treasure: 1000,
    pickups: 350,
  },
];
export async function readEasyJunglePlan(c) {
  const catalog = JSON.parse(
    await readFile("reference/security-hard-expedition-inputs.json"),
  );
  const source = catalog.cases.find(
    (p) => p.key === c.key && p.activity === "jungle",
  );
  assert.ok(source);
  const original = source.inputEvents.flatMap((e) =>
    Array(e.count).fill(e.byte),
  );
  assert.equal(original.length, source.inputCount);
  assert.equal(sha(Buffer.from(original)), source.sha256);
  const rows = structuredClone(source.inputEvents);
  if (c.key === "bermuda") {
    for (const [index, byte, from, to] of [
      [12, 0, 20, 32],
      [14, 0, 6, 38],
      [15, 1, 28, 40],
    ]) {
      assert.deepEqual(rows[index], { byte, count: from });
      rows[index].count = to;
    }
  }
  const stream = rows.flatMap((e) => Array(e.count).fill(e.byte));
  assert.equal(stream.length, c.inputs);
  const boundaries = new Set();
  let n = 0;
  for (const row of rows) {
    assert.ok(Number.isInteger(row.count) && row.count > 0);
    n += row.count;
    boundaries.add(n);
  }
  const firstMove = stream.findIndex((b) => [3, 7].includes(b & 63)) + 1;
  assert.ok(firstMove > 0);
  boundaries.add(firstMove);
  return {
    rows,
    stream,
    boundaries,
    firstMove,
    departurePoint: source.departurePoint,
  };
}
export async function captureEasyJungle(root, c) {
  await mkdir(root);
  return withRecordedBrowser(async (tools) => {
    const { page, canvas, state, until, press } = tools,
      points = [];
    const observe = async (name) =>
      points.push(
        await observeRecordedRoute({ page, state: await state(), name }),
      );
    await until((s) => s.scene === "title");
    await press("Space");
    await until((s) => s.scene === "difficulty" && s.difficultyMenu.ready);
    await press("Enter");
    await until((s) => s.scene === "office");
    await observe("office");
    await page.locator("#map").click();
    await finishSecurityEntry(tools);
    const recipe = await readEasyJunglePlan(c);
    const b = await canvas.boundingBox();
    await canvas.click({
      position: {
        x: (b.width * recipe.departurePoint[0]) / 320,
        y: (b.height * recipe.departurePoint[1]) / 200,
      },
    });
    await page.clock.runFor(100);
    await press("Space");
    await until((s) => s.campaign.destination?.ready);
    await press("ArrowRight");
    await until(
      (s) => s.campaign.choice === 1 && s.campaign.destination?.ready,
    );
    await press("Space");
    await until((s) => s.scene === "departure");
    await observe("departure");
    await press("Space");
    await until((s) => s.scene === "flight");
    await explorePhysicalFlight({
      page,
      state,
      until,
      policy: { altitude: [25, 40], climbHeading: 3 },
    });
    await until((s) => s.scene === "jungle");
    const entry = await state();
    assert.equal(entry.briefing.variant, c.variant);
    assert.equal(entry.difficulty, 0);
    assert.equal(entry.jungle.frames, 0);
    assert.equal(entry.flight.outcome.code, 1);
    await observe("entry");
    const { stream, boundaries } = recipe;
    const keys = (byte) =>
      new Set([
        ...(byte & 64 ? ["Space"] : []),
        ...({
          1: ["ArrowUp"],
          3: ["ArrowRight"],
          5: ["ArrowDown"],
          7: ["ArrowLeft"],
        }[byte & 63] ?? []),
      ]);
    let held = new Set(),
      used = 0;
    for (let i = 0; i < stream.length; i++) {
      assert.equal(
        (await state()).scene,
        "jungle",
        "Unfinished jungle input sequence",
      );
      const next = keys(stream[i]);
      for (const k of held) if (!next.has(k)) await page.keyboard.up(k);
      for (const k of next) await page.keyboard.down(k);
      held = next;
      // Mode0 consumes a released flag once. Release before the last intended read.
      const following = keys(stream[i + 1] ?? 0);
      for (const k of [...held])
        if (!following.has(k)) {
          await page.keyboard.up(k);
          held.delete(k);
        }
      const before = await state();
      assert.equal(before.jungle.frames, used);
      const after = await until(
        (s) => s.scene !== "jungle" || s.jungle.frames > used,
      );
      used++;
      assert.equal(after.jungle.frames, used, "Skipped jungle input frame");
      if (boundaries.has(used) || used % 40 === 0)
        await observe("input-" + used);
    }
    for (const k of held) await page.keyboard.up(k);
    const award = await until((s) => s.scene === "expedition-result");
    assert.equal(award.jungle.outcome.code, 1);
    assert.equal(award.jungle.lives, 3);
    assert.equal(award.jungle.money, c.pickups);
    assert.equal(award.expeditionResult.value, c.treasure);
    assert.equal(award.money, c.pickups + c.treasure);
    await observe("award");
    await page.keyboard.down("Space");
    await until((s) => s.scene === "map");
    await page.keyboard.up("Space");
    await page.clock.runFor(16);
    const map = await state();
    assert.deepEqual(map.campaign.playerCollected, [c.location]);
    assert.equal(map.campaign.day, entry.campaign.day + 1);
    await observe("map");
    await saveRecordedRoute({
      page,
      root,
      observations: points,
      scope:
        "EXPLORATORY complete Easy alternate jungle;independent DOM replay required",
    });
    const environment = JSON.parse(await readFile(root + "/environment.json"));
    environment.completed = true;
    environment.scope = "Route complete;not accepted until independent replay";
    await writeFile(
      root + "/environment.json",
      JSON.stringify(environment, null, 2) + "\n",
    );
    await page.locator("#restart").click();
    await until((s) => s.scene === "title");
    assert.equal((await state()).money, 0);
    assert.equal((await state()).jungle, null);
    assert.deepEqual((await state()).campaign.playerCollected, []);
    return {
      key: c.key,
      completed: true,
      accepted: false,
      checkpoints: points.length,
      events: points.at(-1).eventCount,
      inputs: used,
      restart: true,
      expectedOutcome: {
        money: map.money,
        day: map.campaign.day,
        playerCollected: map.campaign.playerCollected,
        ...Object.fromEntries(
          ["frames", "presentations", "lives", "seed"].map((k) => [
            k,
            map.jungle[k],
          ]),
        ),
      },
    };
  });
}
export const replayEasyJungle = (manifest, out, negativeMode) =>
  replayRecordedScenario(manifest, out, negativeMode, "jungle");
