import { expect } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import { openRecordedApplication } from "./clock.js";

const hash = (b) => createHash("sha256").update(b).digest("hex");
const canonical = (v) =>
  JSON.stringify(v, (_, x) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(
          Object.keys(x)
            .sort()
            .map((k) => [k, x[k]]),
        )
      : x,
  );
const inputBoundary = ({ time, type, key, target, x, y }) => ({
  time,
  type,
  key,
  target,
  ...(type === "pointerdown" && target === "game"
    ? {
        // Campaign.point consumes clamped, truncated logical coordinates.
        x: Math.max(32, Math.min(285, Math.trunc(x))),
        y: Math.max(28, Math.min(151, Math.trunc(y))),
      }
    : {}),
});

// An independent event stream drives actual browser keyboard/mouse adapters.
// Expected snapshots are read only at checkpoints and never select an input.
export async function runRecordedCampaign({
  page,
  info,
  manifest,
  negativeMode,
}) {
  if (negativeMode && negativeMode !== "omit-hard-choice")
    throw Error("SETUP: unknown recorded-input negative control");
  async function fixture(name) {
    const spec = manifest.artifacts[name];
    if (!spec) throw Error(`SETUP: missing ${name} fixture declaration`);
    const bytes = await readFile(spec.path).catch(() => {
      throw Error(`SETUP: missing ${spec.path}`);
    });
    expect(hash(bytes), `Corrupt ${name} fixture`).toBe(spec.sha256);
    return JSON.parse(bytes);
  }
  const events = await fixture("captured-events"),
    checks = await fixture("campaign-checkpoints"),
    environment = await fixture("environment"),
    timeline = await fixture("timeline");
  expect(events).toHaveLength(manifest.requiredEventCount);
  expect(checks).toHaveLength(manifest.expectedCheckpointCount);
  expect(environment.completed).toBe(true);
  expect(timeline.observations).toHaveLength(manifest.expectedCheckpointCount);
  expect(timeline.clockOrigin).toBe(environment.clockOrigin);
  const errors = [],
    observed = [];
  let consumed = 0,
    lastState = null,
    actualEvents = [],
    completed = false;
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    window.recordedCampaignEvents = [];
    for (const type of ["keydown", "keyup", "pointerdown", "pointerup"])
      document.addEventListener(
        type,
        (event) => {
          const target = event.target.closest?.("canvas,button");
          const bounds = target?.getBoundingClientRect();
          window.recordedCampaignEvents.push({
            time: performance.now(),
            type,
            key: event.key ?? null,
            target: target?.id ?? null,
            ...(target?.id === "game" && type.startsWith("pointer")
              ? {
                  x: ((event.clientX - bounds.left) * 320) / bounds.width,
                  y: ((event.clientY - bounds.top) * 200) / bounds.height,
                }
              : {}),
          });
        },
        true,
      );
  });
  await openRecordedApplication(page, timeline.clockOrigin);
  await expect(page.locator("#actions")).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "Sound (reconstructed)" }),
  ).not.toBeChecked();
  const canvas = page.locator("#game");
  await canvas.focus();
  const start = await page.evaluate(() => performance.now());
  expect(start, "Recorded display-clock origin").toBe(environment.clockOrigin);
  let currentTime = start;
  async function advance(at) {
    expect(
      at,
      "Input must not arrive after its recorded timestamp",
    ).toBeGreaterThanOrEqual(currentTime);
    if (at > currentTime) await page.clock.runFor(at - currentTime);
    currentTime = at;
  }
  async function input(event) {
    await advance(event.time);
    if (event.type === "keydown" || event.type === "keyup") {
      const key = event.key === " " ? "Space" : event.key;
      if (event.type === "keydown") await page.keyboard.down(key);
      else await page.keyboard.up(key);
      return;
    }
    expect(["pointerdown", "pointerup"]).toContain(event.type);
    expect(["game", "map", "back"]).toContain(event.target);
    const target = page.locator(`#${event.target}`);
    if (event.type === "pointerdown") await target.scrollIntoViewIfNeeded();
    const bounds = await target.boundingBox();
    expect(bounds).not.toBeNull();
    const x =
        event.target === "game"
          ? bounds.x + (event.x * bounds.width) / 320
          : bounds.x + bounds.width / 2,
      y =
        event.target === "game"
          ? bounds.y + (event.y * bounds.height) / 200
          : bounds.y + bounds.height / 2;
    await page.mouse.move(x, y);
    if (event.type === "pointerdown") await page.mouse.down();
    else await page.mouse.up();
  }
  try {
    for (let i = 0; i < checks.length; i++) {
      const checkpoint = checks[i];
      const point = timeline.observations[i];
      expect({
        name: checkpoint.name,
        at: checkpoint.at,
        eventCount: checkpoint.eventCount,
      }).toEqual(point);
      expect(point.eventCount).toBeGreaterThanOrEqual(consumed);
      expect(point.eventCount).toBeLessThanOrEqual(events.length);
      while (consumed < point.eventCount) {
        const event = events[consumed];
        if (!(
          negativeMode === "omit-hard-choice" &&
          consumed ===
            events.findIndex((e) => e.type === "keydown" && e.key === "ArrowUp")
        ))
          await input(event);
        consumed++;
      }
      await advance(point.at);
      expect(
        await page.evaluate(() => performance.now()),
        "Actual observation clock",
      ).toBe(point.at);
      lastState = JSON.parse(
        await canvas.getAttribute("data-state", { timeout: 5000 }),
      );
      expect(lastState.diagnostic).toBeNull();
      const png = PNG.sync.read(
        Buffer.from(
          (await canvas.evaluate((c) => c.toDataURL())).split(",")[1],
          "base64",
        ),
      );
      expect([png.width, png.height]).toEqual([320, 200]);
      const value = {
        name: checkpoint.name,
        stateSha256: hash(canonical(lastState)),
        pixelsSha256: hash(png.data),
        at: point.at,
        eventCount: consumed,
        state: lastState,
      };
      observed.push(value);
      expect(
        value.stateSha256,
        `Carried browser state${i} ${checkpoint.name}`,
      ).toBe(checkpoint.stateSha256);
      expect(
        value.pixelsSha256,
        `Carried browser pixels${i} ${checkpoint.name}`,
      ).toBe(checkpoint.pixelsSha256);
      actualEvents = await page.evaluate(() => window.recordedCampaignEvents);
      expect(actualEvents.map(inputBoundary)).toEqual(
        events.slice(0, consumed).map(inputBoundary),
      );
      console.log(
        `recorded checkpoint${i} ${checkpoint.name} (${consumed} events)`,
      );
    }
    expect(consumed).toBe(events.length);
    expect(actualEvents).toHaveLength(events.length);
    expect(lastState.scene).toBe("ending");
    expect(lastState.ending.ready).toBe(true);
    expect(lastState.ending).toEqual(manifest.expectedEnding);
    expect(errors).toEqual([]);
    await expect(page.locator("#diagnostic")).toBeHidden();
    completed = true;
  } finally {
    await writeFile(
      info.outputPath("campaign-checkpoints.json"),
      JSON.stringify(observed, null, 2),
    );
    await writeFile(
      info.outputPath("replay-progress.json"),
      JSON.stringify(
        {
          completed,
          consumed,
          expectedEvents: events.length,
          lastState,
          errors,
        },
        null,
        2,
      ),
    );
    await writeFile(
      info.outputPath("actual-events.json"),
      JSON.stringify(actualEvents, null, 2),
    );
  }
}
