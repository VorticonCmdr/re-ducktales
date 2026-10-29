import { test, expect } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import { openOffice } from "./helpers/office-entry.js";
import { finishSecurityEntry } from "./helpers/security.js";
import manifest from "../../reference/destination.json" with { type: "json" };

// This fresh BIOS0 route naturally selects Bolognia/Redbeard's Rubies. Original
// capture context selects another destination. Only invariant label/footer
// regions are compared here; the two full original pages are separate checks.
test("destination shows original treasure labels and flight selector through real browser controls", async ({
  page,
}, info) => {
  const t = await openOffice(page);
  await page.locator("#map").click();
  await finishSecurityEntry({ page, until: t.until, state: t.state });
  const b = await t.canvas.boundingBox();
  await t.canvas.click({
    position: { x: (100.5 * b.width) / 320, y: (100.5 * b.height) / 200 },
  });
  await page.keyboard.press("Space");
  await t.until((s) => s.campaign.destination?.ready, "destination page");
  await page.keyboard.press("Space");
  await t.until((s) => !s.campaign.info, "Map confirmation returns to pointer");
  await page.keyboard.press("Space");
  await t.until(
    (s) => s.campaign.destination?.ready,
    "reopened destination page",
  );
  await page.keyboard.press("ArrowRight");
  await t.until(
    (s) => s.campaign.choice === 1 && s.campaign.destination?.ready,
    "flight selection",
  );
  // One complete70.086Hz video interval lets this observer see the new page.
  await page.clock.runFor(16);
  const state = await t.state();
  expect(state.campaign.day).toBe(1);
  expect(state.money).toBe(0);
  const actualBytes = Buffer.from(
    await t.canvas.evaluate((c) => c.toDataURL().split(",")[1]),
    "base64",
  );
  const actual = PNG.sync.read(actualBytes);
  expect([actual.width, actual.height]).toEqual([320, 200]);
  const spec = manifest.artifacts["notice-004-flush.png"];
  const expectedBytes = await readFile(spec.path).catch(() => {
    throw Error(`SETUP: missing original destination picture ${spec.path}`);
  });
  expect(expectedBytes.length).toBe(spec.bytes);
  expect(createHash("sha256").update(expectedBytes).digest("hex")).toBe(
    spec.sha256,
  );
  const expected = PNG.sync.read(expectedBytes);
  const region = (data, x, y, width, height) =>
    Buffer.concat(
      Array.from({ length: height }, (_, i) =>
        data.subarray(((y + i) * 320 + x) * 4, ((y + i) * 320 + x + width) * 4),
      ),
    );
  for (const [name, x, y, width, height] of [
    ["treasure label", 32, 62, 80, 8],
    ["description label", 32, 78, 168, 8],
    ["value label", 32, 110, 128, 8],
    ["travel label", 32, 126, 104, 8],
    ["whole footer and integer flight border", 0, 168, 320, 32],
  ]) {
    const got = region(actual.data, x, y, width, height),
      want = region(expected.data, x, y, width, height);
    expect(got.equals(want), `Original destination ${name}`).toBe(true);
    const changed = Buffer.from(want);
    changed[0] ^= 1;
    expect(got.equals(changed), `Changed ${name} must be rejected`).toBe(false);
  }
  await writeFile(info.outputPath("destination-bolognia.png"), actualBytes);
  await page.keyboard.press("Space");
  await t.until((s) => s.scene === "departure", "flight departure");
  await page.locator("#restart").click();
  await t.until((s) => s.scene === "title", "restart");
  expect(t.errors).toEqual([]);
  await expect(page.locator("#diagnostic")).toBeHidden();
});

test("destination entry bands, selection wait and confirmation wait gate real browser input", async ({
  page,
}, info) => {
  await page.addInitScript(() => {
    window.destinationEntry = [];
    window.destinationAudio = [];
    const seen = new Set();
    document.addEventListener("gameaudio", (e) =>
      window.destinationAudio.push(e.detail),
    );
    document.addEventListener(
      "gamepresent",
      (e) => {
        const d = e.detail.campaign?.destination;
        if (!d?.transition) return;
        const name = `${d.transition.kind}-${d.transition.band}`;
        if (seen.has(name)) return;
        seen.add(name);
        window.destinationEntry.push({
          name,
          retraces: d.retraces,
          ready: d.ready,
        });
      },
      true,
    );
  });
  const t = await openOffice(page);
  await page.locator("#map").click();
  await finishSecurityEntry({ page, until: t.until, state: t.state });
  const b = await t.canvas.boundingBox();
  await t.canvas.click({
    position: { x: (100.5 * b.width) / 320, y: (100.5 * b.height) / 200 },
  });
  await page.keyboard.press("Space");
  await t.until(
    (s) => s.campaign.destination?.phase === "wipe",
    "destination wipe",
  );
  await page.keyboard.press("ArrowRight");
  let s = await t.until(
    (s) => s.campaign.destination?.discardedDuringWait === 1,
    "entry ignores input before its flush",
  );
  expect(s.campaign.choice).toBe(0);
  await expect(page.locator("#fire")).toBeDisabled();
  s = await t.until((s) => s.campaign.destination?.ready, "entry complete");
  expect(s.campaign.destination.retraces).toBe(51);
  const entry = await page.evaluate(() => window.destinationEntry);
  expect(entry.map((v) => v.name)).toEqual(
    ["wipe", "reveal"].flatMap((kind) =>
      Array.from({ length: 5 }, (_, i) => `${kind}-${i}`),
    ),
  );
  expect(entry.map((v) => v.retraces)).toEqual([
    1, 5, 10, 15, 20, 25, 30, 35, 40, 45,
  ]);
  expect(entry.every((v) => v.ready === false)).toBe(true);
  await expect(page.locator("#fire")).toBeEnabled();
  await page.getByLabel("Sound device", { exact: true }).selectOption("tandy");
  await page.getByRole("checkbox", { name: "Sound (reconstructed)" }).check();
  await page.clock.runFor(32);
  await t.canvas.focus();
  if (process.env.DUCKTALES_DESTINATION_WAIT_NEGATIVE !== "omit-right")
    await page.keyboard.press("ArrowRight");
  // Two driver periods are enough to consume the key and remain strictly
  // inside the seven-count selection wait. This is an authored test interval.
  await page.clock.runFor(32);
  s = await t.state();
  expect(s.campaign.choice, "Required Right make selects flight").toBe(1);
  let d = s.campaign.destination;
  expect(d.phase).toBe("selection-wait");
  expect(d.visibleChoice).toBe(0);
  expect(d.driverDeadline - d.lastInputClock).toBe(7);
  const selectionDeadline = d.driverDeadline;
  await page.keyboard.press("Space");
  s = await t.until(
    (s) => s.campaign.destination?.discardedDuringWait === 2,
    "selection wait ignores early Fire",
  );
  expect(s.scene).toBe("map");
  await t.until(
    (s) => s.campaign.destination?.clock === selectionDeadline - 1,
    "last selection count",
  );
  expect((await t.state()).campaign.destination.visibleChoice).toBe(0);
  s = await t.until(
    (s) => s.campaign.destination?.ready,
    "new selection displayed and settled",
  );
  expect(s.campaign.destination.visibleChoice).toBe(1);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.destinationAudio.filter(
            (v) => v.type === "ack" && v.argument === 36,
          ).length,
      ),
    )
    .toBe(1);
  const audio = await page.evaluate(() => window.destinationAudio);
  await page.keyboard.press("Space");
  s = await t.until(
    (s) => s.campaign.destination?.phase === "confirm-wait",
    "confirmation post-flip wait",
  );
  d = s.campaign.destination;
  const confirmationDeadline = d.driverDeadline;
  expect(s.scene).toBe("map");
  expect(d.ready).toBe(false);
  await expect(page.locator("#back")).toBeDisabled();
  await t.until(
    (s) => s.campaign.destination?.clock === confirmationDeadline - 1,
    "last confirmation count",
  );
  expect((await t.state()).scene).toBe("map");
  s = await t.until(
    (s) => s.scene === "departure",
    "completed confirmation hands off",
  );
  expect(s.tick).toBe(confirmationDeadline);
  await writeFile(
    info.outputPath("destination-wait-observations.json"),
    JSON.stringify(
      { entry, selectionDeadline, confirmationDeadline, audio },
      null,
      2,
    ),
  );
  await t.canvas.screenshot({
    path: info.outputPath("destination-waits-departure.png"),
  });
  await page.locator("#restart").click();
  await t.until((s) => s.scene === "title", "restart");
  expect(t.errors).toEqual([]);
  await expect(page.locator("#diagnostic")).toBeHidden();
});

test("destination ordinary letters, keypad, releases and fresh repeat makes use mode1", async ({
  page,
}, info) => {
  const t = await openOffice(page);
  await page.locator("#map").click();
  await finishSecurityEntry({ page, until: t.until, state: t.state });
  const bounds = await t.canvas.boundingBox();
  await t.canvas.click({
    position: {
      x: (100.5 * bounds.width) / 320,
      y: (100.5 * bounds.height) / 200,
    },
  });
  await page.keyboard.press("Space");
  await t.until((s) => s.campaign.destination?.ready, "destination ready");
  const input = async () =>
    JSON.parse(await t.canvas.getAttribute("data-map-input"));
  const observations = [];
  if (process.env.DUCKTALES_DESTINATION_KEYBOARD_NEGATIVE !== "omit-k")
    await page.keyboard.down("KeyK");
  await page.clock.runFor(32);
  let s = await t.state(),
    trace = await input();
  expect(s.campaign.choice, "Required KeyK make selects flight").toBe(1);
  expect(trace.destinationRead.byte).toBe(3);
  expect(trace.destinationRead.beforeFlags[0x25]).toBe(128);
  expect(trace.destinationRead.readerFlags[0x25]).toBe(128);
  expect(trace.destinationRead.readerFlags[0x4d]).toBe(0);
  observations.push({ key: "KeyK", state: s.campaign.destination, trace });
  // A repeat during the explicit wait is flushed; held state alone must not
  // replenish it. A new physical repeat make after that flush is accepted.
  await page.keyboard.down("KeyK");
  await t.until(
    (s) => s.campaign.destination.discardedDuringWait === 1,
    "busy repeat discarded",
  );
  await t.until((s) => s.campaign.destination.ready, "first selection settles");
  expect((await input()).flags.every((v) => v === 0)).toBe(true);
  expect((await t.state()).campaign.destination.inputs).toBe(1);
  await page.keyboard.down("KeyK");
  await page.clock.runFor(32);
  expect((await t.state()).campaign.choice).toBe(0);
  await page.keyboard.up("KeyK");
  await t.until((s) => s.campaign.destination.ready, "fresh repeat settles");
  await page.keyboard.press("Numpad6");
  await t.until(
    (s) => s.campaign.choice === 1 && s.campaign.destination.ready,
    "keypad right",
  );
  for (const [key, byte, choice] of [
    ["KeyJ", 7, 0],
    ["KeyI", 1, 0],
    ["KeyM", 5, 0],
    ["Numpad7", 8, 0],
    ["Numpad9", 2, 0],
    ["Numpad1", 6, 0],
    ["Numpad3", 4, 0],
    ["Numpad5", 0, 0],
    ["Numpad8", 1, 0],
    ["Numpad2", 5, 0],
    ["Numpad4", 7, 1],
    ["Numpad6", 3, 0],
  ]) {
    const count = (await t.state()).campaign.destination.inputs;
    await page.keyboard.press(key);
    await t.until(
      (s) =>
        s.campaign.destination.inputs === count + 1 &&
        s.campaign.destination.ready,
      key,
    );
    // data-map-input is published on video retrace;data-state also updates
    // between retraces. Observe one complete video interval after the flush.
    await page.clock.runFor(16);
    s = await t.state();
    trace = await input();
    expect(trace.destinationRead.byte, `${key} original reader code`).toBe(
      byte,
    );
    expect(s.campaign.choice, key).toBe(choice);
    expect(
      trace.flags.every((v) => v === 0),
      `${key} caller flush`,
    ).toBe(true);
    observations.push({ key, state: s.campaign.destination, trace });
  }
  await page.keyboard.press("NumpadEnter");
  await t.until(
    (s) => s.scene === "map" && !s.campaign.info,
    "keypad Map confirmation",
  );
  expect((await t.state()).campaign.day).toBe(1);
  await page.keyboard.press("Space");
  await t.until((s) => s.campaign.destination?.ready, "reopened dialog");
  await page.keyboard.press("KeyK");
  await t.until(
    (s) => s.campaign.choice === 1 && s.campaign.destination.ready,
    "letter travel choice",
  );
  await page.keyboard.press("NumpadEnter");
  await t.until((s) => s.scene === "departure", "keypad travel confirmation");
  await writeFile(
    info.outputPath("destination-keyboard.json"),
    JSON.stringify(observations, null, 2),
  );
  await t.canvas.screenshot({
    path: info.outputPath("destination-keyboard-departure.png"),
  });
  await page.locator("#restart").click();
  await t.until((s) => s.scene === "title", "restart");
  expect(t.errors).toEqual([]);
  await expect(page.locator("#diagnostic")).toBeHidden();
});
