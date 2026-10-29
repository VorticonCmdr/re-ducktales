import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { openRecordedApplication } from "./helpers/clock.js";
import { finishSecurityEntry } from "./helpers/security.js";
import { waitForScene } from "./helpers/scene.js";
import { exploreFlight } from "./helpers/flight-policy.js";
import {
  installEntryRecording,
  observeRecordedRoute,
  saveRecordedRoute,
} from "./helpers/entry-recording.js";

// A fresh player-controlled browser route. Independent acceptance also replays
// its timestamped DOM stream; expected snapshots never select an input here.
export async function runHardExpedition({ page, info, manifest, inputs }) {
  test.setTimeout(180000);
  const capture = process.env.DUCKTALES_CAPTURE_HARD_EXPEDITION;
  if (!capture)
    expect(
      manifest.pending,
      "SETUP: Hard route needs independent acceptance",
    ).toBe(false);
  const errors = [],
    observations = [];
  let checked = 0;
  page.on("pageerror", (e) => errors.push(e.message));
  await installEntryRecording(page);
  await openRecordedApplication(page, 1);
  await expect(page.locator("#actions")).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "Sound (reconstructed)" }),
  ).not.toBeChecked();
  const canvas = page.locator("#game"),
    state = () => canvas.getAttribute("data-state").then(JSON.parse),
    activity = inputs.activity;
  async function until(predicate, max = 10000) {
    for (let i = 0; i < max; i++) {
      const s = await state();
      if (s?.diagnostic) throw Error(s.diagnostic);
      if (s && predicate(s)) return s;
      await page.clock.runFor(8);
    }
    throw Error(
      `Unfinished Hard ${inputs.key}: ${JSON.stringify(await state())}`,
    );
  }
  async function press(key) {
    await page.keyboard.press(key);
    await page.clock.runFor(100);
  }
  async function point(x, y) {
    const b = await canvas.boundingBox();
    await canvas.click({
      position: { x: (b.width * x) / 320, y: (b.height * y) / 200 },
    });
    await page.clock.runFor(100);
  }
  async function observe(name) {
    const p = await observeRecordedRoute({ page, state: await state(), name });
    observations.push(p);
    if (!capture) {
      const expected = manifest.checkpoints[checked++];
      expect(expected, "Unexpected Hard checkpoint").toBeDefined();
      for (const k of [
        "name",
        "at",
        "eventCount",
        "stateSha256",
        "pixelsSha256",
      ])
        expect(p[k], `Hard ${inputs.key} ${name} ${k}`).toEqual(expected[k]);
    }
    return p;
  }
  await until((s) => s.scene === "title" && s.opening?.skipEnabled);
  await canvas.focus();
  await press("Space");
  await waitForScene(page, canvas, "difficulty");
  await press("ArrowUp");
  await until((s) => s.difficulty === 2);
  await press("Enter");
  await waitForScene(page, canvas, "office");
  await page.locator("#map").click();
  await finishSecurityEntry({ page, state, until });
  await point(...inputs.departurePoint);
  await press("Space");
  await press("ArrowRight");
  await press("Space");
  expect((await state()).scene).toBe("departure");
  expect((await state()).departure.racing).toBe(true);
  const flightTrace = await exploreFlight({
    page,
    state,
    until,
    hard: true,
    policy: inputs.flightPolicy,
  });
  await writeFile(
    info.outputPath("hard-flight.json"),
    JSON.stringify(flightTrace, null, 2),
  );
  const entry = await until(
    (s) =>
      !["flight", "crash-repairs", "expedition-briefing"].includes(s.scene),
  );
  expect(entry.scene).toBe(activity);
  expect(entry.briefing.variant).toBe(inputs.variant);
  expect(entry.flight.outcome.code).toBe(1);
  expect(entry[activity].frames).toBe(0);
  expect(entry[activity].lives).toBe(3);
  const first = await observe("entry");
  if (!capture) {
    if (manifest.verificationEdition === "office") {
      expect(first.stateSha256, "Current recorded Hard entry").toBe(
        manifest.entryStateSha256,
      );
      expect(first.pixelsSha256).toBe(manifest.entryPixelsSha256);
    } else {
      const entryManifest = JSON.parse(await readFile(inputs.entryManifest));
      const entryChecks = JSON.parse(
        await readFile(entryManifest.artifacts["campaign-checkpoints"].path),
      );
      expect(first.stateSha256, "Independently verified Hard entry").toBe(
        entryChecks[0].stateSha256,
      );
      expect(first.pixelsSha256).toBe(entryChecks[0].pixelsSha256);
    }
  }
  const stream = inputs.inputEvents.flatMap((e) => Array(e.count).fill(e.byte));
  expect(stream).toHaveLength(inputs.inputCount);
  expect(createHash("sha256").update(Buffer.from(stream)).digest("hex")).toBe(
    inputs.sha256,
  );
  const boundaries = new Set();
  let boundary = 0;
  for (const row of inputs.inputEvents) {
    boundary += row.count;
    boundaries.add(boundary);
  }
  let held = new Set(),
    used = 0;
  for (const byte of stream) {
    const next = new Set([
      ...(byte & 64 ? ["Space"] : []),
      ...({
        1: ["ArrowUp"],
        3: ["ArrowRight"],
        5: ["ArrowDown"],
        7: ["ArrowLeft"],
      }[byte & 63] ?? []),
    ]);
    for (const key of held) if (!next.has(key)) await page.keyboard.up(key);
    for (const key of next) if (!held.has(key)) await page.keyboard.down(key);
    held = next;
    const before = await state();
    expect(before.scene).toBe(activity);
    expect(before[activity].frames).toBe(used);
    const after = await until(
      (s) => s.scene !== activity || s[activity].frames > used,
    );
    used++;
    expect(after[activity].frames, "Exactly one expedition input frame").toBe(
      used,
    );
    if (boundaries.has(used) || used % 40 === 0) await observe(`input-${used}`);
  }
  for (const key of held) await page.keyboard.up(key);
  expect(used).toBe(inputs.inputCount);
  const award = await until((s) => s.scene === "expedition-result");
  expect(award[activity].outcome.code).toBe(1);
  expect(award[activity].lives).toBe(3);
  expect(award.expeditionResult.value).toBe(inputs.treasure);
  expect(award.money).toBe(
    entry.money + award[activity].money + inputs.treasure,
  );
  expect(award.campaign.day).toBe(entry.campaign.day + 1);
  await observe("award");
  await press("Space");
  const returned = await until((s) => s.scene === "map");
  expect(returned.campaign.playerCollected).toContain(inputs.location);
  expect(returned.money).toBe(award.money);
  expect(returned.campaign.rivalUnlockMask).toBe(activity === "jungle" ? 1 : 2);
  await observe("returned-map");
  await point(212, 131);
  await press("Space");
  const bank = await until((s) => s.scene === "bank");
  expect(bank.money).toBe(0);
  expect(bank.campaign.banked).toBe(entry.campaign.banked + award.money);
  await observe("bank");
  await page.keyboard.down("Space");
  await until((s) => s.scene !== "bank");
  await page.keyboard.up("Space");
  await page.clock.runFor(100);
  const deposited = await until((s) => s.scene === "map");
  expect(deposited.campaign.banked).toBe(bank.campaign.banked);
  expect(deposited.campaign.playerCollected).toContain(inputs.location);
  await observe("deposited");
  if (capture)
    await saveRecordedRoute({
      page,
      root: `${capture}/${inputs.key}`,
      observations,
      hard: true,
      scope:
        "Exploratory Hard alternate expedition/treasure/bank route;not acceptance or native whole-expedition parity",
    });
  else expect(checked).toBe(manifest.expectedCheckpointCount);
  await page.locator("#restart").click();
  await page.clock.runFor(100);
  const fresh = await until((s) => s.scene === "title");
  expect(fresh.money).toBe(0);
  expect(fresh.campaign.banked).toBe(0);
  expect(fresh.campaign.day).toBe(1);
  expect(fresh.campaign.playerCollected).toEqual([]);
  expect(fresh[activity]).toBeNull();
  expect(fresh.flight).toBeNull();
  expect(errors).toEqual([]);
  await expect(page.locator("#diagnostic")).toBeHidden();
  if (capture)
    throw Error("EXPLORATORY Hard expedition route saved;not acceptance");
}
