import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { expect } from "@playwright/test";
import { recordedDOMInput } from "./recorded-dom-input.js";

// Exploratory continuation only. Reconstruct preceding scenes from initial
// startup and independent DOM events;no partial memory restore.
export async function replayCampaignPrefix({
  page,
  root,
  through,
  checkpoint,
}) {
  const artifacts = {},
    json = async (name) => {
      const b = await readFile(`${root}/${name}`).catch(() => {
        throw Error(`SETUP: missing campaign prefix ${root}/${name}`);
      });
      artifacts[name] = createHash("sha256").update(b).digest("hex");
      return JSON.parse(b);
    };
  const environment = await json("environment.json"),
    events = await json("captured-events.json"),
    checks = await json("campaign-checkpoints.json");
  expect(environment.physical).toBe(true);
  expect(environment.clockOrigin).toBe(1);
  expect(environment.displayMilliseconds).toBe(8);
  const end =
    through === "all-recorded"
      ? checks.length - 1
      : checks.findIndex((c) => c.name === through);
  expect(end, "Required prefix checkpoint").toBeGreaterThanOrEqual(0);
  let consumed = 0,
    time = 1;
  async function advance(at) {
    expect(Number.isFinite(at)).toBe(true);
    expect(at).toBeGreaterThanOrEqual(time);
    if (at > time) await page.clock.runFor(at - time);
    time = at;
  }
  await page.locator("#game").focus();
  for (const c of checks.slice(0, end + 1)) {
    expect(c.eventCount).toBeGreaterThanOrEqual(consumed);
    expect(c.eventCount).toBeLessThanOrEqual(events.length);
    while (consumed < c.eventCount) {
      const e = events[consumed++];
      await advance(e.time);
      await recordedDOMInput(page, e);
    }
    await advance(c.at);
    const actual = await checkpoint(c.name);
    for (const field of [
      "name",
      "at",
      "eventCount",
      "stateSha256",
      "pixelsSha256",
    ])
      expect(actual[field], `Reconstructed prefix ${c.name} ${field}`).toEqual(
        c[field],
      );
  }
  expect(consumed).toBe(checks[end].eventCount);
  if (through === "all-recorded")
    while (consumed < events.length) {
      const e = events[consumed++];
      await advance(e.time);
      await recordedDOMInput(page, e);
    }
  return {
    scope: "EXPLORATORY prefix continuation;not complete campaign acceptance",
    root,
    through,
    checkpoints: end + 1,
    lastCheckpoint: checks[end].name,
    events: consumed,
    recordedTailEvents: consumed - checks[end].eventCount,
    inputCaptureTruncated: !!environment.observerError,
    artifacts,
  };
}
