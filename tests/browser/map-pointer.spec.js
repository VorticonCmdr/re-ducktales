import { test, expect } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { openOffice } from "./helpers/office-entry.js";
import { finishSecurityEntry } from "./helpers/security.js";
import manifest from "../../reference/map-keyboard.json" with { type: "json" };
import profile from "../../reference/map-keyboard-inputs.json" with { type: "json" };

async function fixture(name) {
  const spec = manifest.artifacts[name];
  if (!spec)
    throw Error(`SETUP: missing original map fixture declaration ${name}`);
  const bytes = await readFile(spec.path).catch(() => {
    throw Error(`SETUP: missing original map fixture ${spec.path}`);
  });
  expect(bytes.length, name).toBe(spec.bytes);
  expect(createHash("sha256").update(bytes).digest("hex"), name).toBe(
    spec.sha256,
  );
  return JSON.parse(bytes);
}

async function openMap(page) {
  const t = await openOffice(page);
  await page.locator("#map").click();
  await finishSecurityEntry({ page, until: t.until, state: t.state });
  const input = async () =>
    JSON.parse(await t.canvas.getAttribute("data-map-input"));
  async function poll(count) {
    for (let i = 0; i < 1000; i++) {
      const s = await t.state();
      if (s.diagnostic) throw Error(s.diagnostic);
      const value = await input();
      if (value?.polls >= count) {
        expect(value.polls, "No skipped map input poll").toBe(count);
        return value;
      }
      await page.clock.runFor(8);
    }
    throw Error(`Unfinished map input poll ${count}`);
  }
  await poll(1);
  return { ...t, input, poll };
}

// Native beforeRead0 is the initial neutral poll. Later inputs are authored
// independently of the captured expected values, at the preceding flush.
test("original map scan order, aliases, releases and six-count polls use real keyboard events", async ({
  page,
}, info) => {
  const t = await openMap(page);
  const rows = await fixture("map-consumption.json");
  const mapping = await fixture("map-capture.json");
  expect(rows.length).toBe(36);
  expect(profile.events.length).toBe(10);
  const keys = {
    KBD_right: "ArrowRight",
    KBD_k: "k",
    KBD_left: "ArrowLeft",
    KBD_kp3: "Numpad3",
    KBD_m: "m",
    KBD_up: "ArrowUp",
  };
  const flags = (ds) => [...ds.subarray(0x276c, 0x27ec)];
  const observations = [];
  let used = 0;
  for (const [index, row] of rows.entries()) {
    expect(row.index).toBe(index);
    const event = profile.events.find((e) => e.beforeRead === index);
    if (event) {
      for (const e of event.keys) {
        if (
          process.env.DUCKTALES_MAP_INPUT_NEGATIVE === "omit-letter" &&
          index === 8 &&
          e.pressed
        )
          continue;
        await page.keyboard[e.pressed ? "down" : "up"](keys[e.key]);
      }
      used++;
    }
    const actual = await t.poll(index + 1);
    const native = {};
    for (const stage of ["before", "input", "end"]) {
      const capture = await fixture(row[stage].artifact);
      native[stage] = Buffer.from(capture.state.results[1].data, "base64");
    }
    expect(actual.lastInput, `Original input ${index}`).toBe(row.input.ax);
    expect(actual.read.beforeFlags).toEqual(flags(native.before));
    expect(actual.read.readerFlags).toEqual(flags(native.input));
    expect(actual.read.endFlags).toEqual(flags(native.end));
    expect(actual.read.readerMode).toBe(0);
    expect(actual.read.endMode).toBe(1);
    expect(actual.read.returnCode).toBe(row.end.ax);
    expect(actual.period).toBe(6);
    expect(actual.cursor).toEqual({
      x: native.end.readInt16LE(mapping.xPointer),
      y: native.end.readInt16LE(mapping.yPointer),
    });
    expect(actual.pointerMotion).toEqual({
      acceleration: native.end.readInt16LE(0x5514),
      dx: native.end.readInt16LE(0x4dc8),
      dy: native.end.readInt16LE(0x4e10),
      firstPollLatch: native.end.readInt16LE(0x697c),
    });
    if (index) {
      expect(actual.read.clock - observations[index - 1].read.clock).toBe(6);
      // The initial original drawing consumes one counter count, producing
      // a first gap of5. CPU drawing cost is not translated here. Steady
      // completed polls have the exact six-count interval in both callers.
      if (index >= 2)
        expect(row.before.clock - rows[index - 1].before.clock).toBe(6);
    }
    observations.push(actual);
  }
  expect(used).toBe(10);
  expect(t.errors).toEqual([]);
  await expect(page.locator("#diagnostic")).toBeHidden();
  await writeFile(
    info.outputPath("map-inputs.json"),
    JSON.stringify(observations, null, 2),
  );
  await t.canvas.screenshot({
    path: info.outputPath("map-original-inputs.png"),
  });
});

test("map held keys need fresh makes and Fire reaches destination, flight choice and restart", async ({
  page,
}, info) => {
  const t = await openMap(page);
  await page.keyboard.down("ArrowRight");
  expect((await t.poll(2)).cursor).toEqual({ x: 47, y: 139 });
  const held = await t.poll(31);
  expect(held.cursor).toEqual({ x: 47, y: 139 });
  expect(held.flags).toEqual(Array(128).fill(0));
  if (process.env.DUCKTALES_MAP_INPUT_NEGATIVE !== "omit-repeat")
    await page.keyboard.down("ArrowRight");
  expect((await t.poll(32)).cursor).toEqual({ x: 48, y: 139 });
  await page.keyboard.up("ArrowRight");
  await t.poll(33);
  const b = await t.canvas.boundingBox();
  await t.canvas.click({
    position: { x: (100.5 * b.width) / 320, y: (100.5 * b.height) / 200 },
  });
  await page.keyboard.down("Space");
  await t.until((s) => s.campaign.info, "destination");
  // Simulation state is published each animation frame; the input trace is
  // published at the next video presentation. Wait for that observer boundary.
  let fire;
  for (let i = 0; i < 100; i++) {
    fire = await t.input();
    if (fire?.lastInput & 0xc0) break;
    await page.clock.runFor(8);
  }
  expect(fire.lastInput & 0xc0).toBe(0xc0);
  expect(fire.read.endMode).toBe(0);
  expect(fire.read.endFlags[0x39]).toBe(0x80);
  expect(fire.mode).toBe(1);
  expect(fire.flags).toEqual(Array(128).fill(0));
  await page.clock.runFor(400);
  expect((await t.state()).campaign.choice).toBe(0);
  await page.keyboard.up("Space");
  await page.keyboard.press("ArrowRight");
  await t.until((s) => s.campaign.choice === 1, "flight choice");
  await t.canvas.screenshot({ path: info.outputPath("map-flight-choice.png") });
  await page.keyboard.press("Space");
  await t.until((s) => s.scene === "departure", "departure");
  await page.locator("#restart").click();
  await t.until((s) => s.scene === "title", "restart");
  expect(t.errors).toEqual([]);
  await expect(page.locator("#diagnostic")).toBeHidden();
});
