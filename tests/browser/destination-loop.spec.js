import { test, expect } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import { openOffice } from "./helpers/office-entry.js";
import { finishSecurityEntry } from "./helpers/security.js";
import original from "../../reference/destination.json" with { type: "json" };

async function destination(page) {
  const t = await openOffice(page);
  await page.locator("#map").click();
  await finishSecurityEntry({ page, until: t.until, state: t.state });
  const b = await t.canvas.boundingBox();
  await t.canvas.click({
    position: { x: (100.5 * b.width) / 320, y: (100.5 * b.height) / 200 },
  });
  await page.keyboard.press("Space");
  return t;
}
async function body(t) {
  return t.until(
    (s) =>
      s.campaign.destination?.ready &&
      s.campaign.destination.loop.completedCalls % 5 <= 2,
    "footer input window",
  );
}
async function pressInBody(page, t, key) {
  const s = await body(t),
    reads = s.campaign.destination.inputs;
  await page.keyboard.press(key);
  await t.until(
    (s) => s.campaign.destination?.inputs === reads + 1,
    "source reader consumes physical key",
  );
  return t.state();
}

test("destination autonomous neutral reads, footer keys and actual departure preserve original pixels", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  if (process.env.DUCKTALES_DESTINATION_LOOP_NEGATIVE === "omit-read")
    await page.route("**/src/game/destination-loop.js*", async (route) => {
      const response = await route.fetch();
      let source = await response.text();
      expect(source.split("else this.readBoundary();")).toHaveLength(2);
      source = source.replace(
        "else this.readBoundary();",
        'else this.phase = "stalled";',
      );
      await route.fulfill({
        response,
        body: source,
        contentType: "application/javascript",
      });
    });
  const t = await destination(page);
  await t.until((s) => s.campaign.destination?.phase === "wipe", "entry wipe");
  await page.keyboard.press("ArrowRight");
  await body(t);
  const first = await t.state();
  expect(first.campaign.choice).toBe(0);
  const reads = first.campaign.destination.inputs;
  await page.evaluate(() => {
    window.destinationLabels = [];
    const status = document.querySelector("#status");
    new MutationObserver(() =>
      window.destinationLabels.push(status.textContent),
    ).observe(status, { childList: true, subtree: true });
  });
  await page.clock.runFor(200);
  let s = await t.state();
  expect(
    s.campaign.destination.inputs - reads,
    "Required autonomous neutral destination reads",
  ).toBeGreaterThanOrEqual(3);
  expect(s.campaign.choice).toBe(0);
  expect(s.campaign.destination.loop.lastByte).toBe(0);
  const labels = await page.evaluate(() => window.destinationLabels);
  expect(labels.length).toBeGreaterThan(5);
  expect(
    labels.every((v) => v.startsWith("Choose how to travel")),
    "Neutral redraws keep UI controls/status stable",
  ).toBe(true);
  const observations = [{ case: "neutral", state: s.campaign.destination }];
  s = await body(t);
  const n = s.campaign.destination.inputs;
  await page.keyboard.down("KeyK");
  // The make never calls the reader directly. Even without advancing the
  // browser clock, the current choice and source input count stay unchanged.
  expect((await t.state()).campaign.destination.inputs).toBe(n);
  await t.until(
    (s) => s.campaign.destination?.inputs === n + 1,
    "KeyK source read",
  );
  s = await t.state();
  expect(s.campaign.choice).toBe(1);
  let trace = JSON.parse(await t.canvas.getAttribute("data-map-input"));
  // The diagnostic table is published on retrace. Use the source snapshot's
  // count/last byte for immediate reader assertions,then see the settled page.
  expect(s.campaign.destination.loop.lastByte).toBe(3);
  await page.keyboard.down("KeyK"); // physical repeat during seven-count wait
  await t.until(
    (s) => s.campaign.destination?.loop.footerPasses >= n + 2,
    "next source flush",
  );
  await page.clock.runFor(100);
  s = await t.state();
  expect(s.campaign.choice).toBe(1);
  expect(s.campaign.destination.loop.lastByte).toBe(0);
  s = await body(t);
  const fresh = s.campaign.destination.inputs;
  await page.keyboard.down("KeyK");
  await t.until(
    (s) => s.campaign.destination?.inputs === fresh + 1,
    "fresh physical repeat",
  );
  expect((await t.state()).campaign.choice).toBe(0);
  await page.keyboard.up("KeyK");
  s = await pressInBody(page, t, "Numpad6");
  expect(s.campaign.choice).toBe(1);
  s = await pressInBody(page, t, "Numpad9");
  expect(s.campaign.choice).toBe(1);
  expect(s.campaign.destination.loop.lastByte).toBe(2);
  await body(t);
  await page.clock.runFor(16);
  // Observe an actual published choice1 page. Native context has a different
  // location/treasure,so only its invariant complete footer is compared.
  await t.until(
    (s) => s.campaign.destination?.visibleChoice === 1,
    "published flight footer",
  );
  const actual = PNG.sync.read(
    Buffer.from(
      await t.canvas.evaluate((c) => c.toDataURL().split(",")[1]),
      "base64",
    ),
  );
  const spec = original.artifacts["notice-004-flush.png"],
    bytes = await readFile(spec.path);
  expect(bytes.length).toBe(spec.bytes);
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(spec.sha256);
  const expected = PNG.sync.read(bytes),
    start = 168 * 320 * 4;
  expect(
    actual.data.subarray(start).equals(expected.data.subarray(start)),
    "Original complete destination footer",
  ).toBe(true);
  const changed = Buffer.from(expected.data.subarray(start));
  changed[0] ^= 1;
  expect(actual.data.subarray(start).equals(changed)).toBe(false);
  await t.canvas.screenshot({
    path: info.outputPath("destination-loop-footer.png"),
  });
  trace = JSON.parse(await t.canvas.getAttribute("data-map-input"));
  observations.push({
    case: "flight-footer",
    state: (await t.state()).campaign.destination,
    trace,
  });
  await pressInBody(page, t, "NumpadEnter");
  await t.until((s) => s.scene === "departure", "natural flight departure");
  s = await t.state();
  expect(s.campaign.day).toBe(1);
  expect(s.money).toBe(0);
  await page.keyboard.press("Space");
  await t.until((s) => s.scene === "flight", "departure starts flight");
  expect((await t.state()).flight).not.toBeNull();
  await writeFile(
    info.outputPath("destination-loop.json"),
    JSON.stringify(observations, null, 2),
  );
  await t.canvas.screenshot({
    path: info.outputPath("destination-loop-flight.png"),
  });
  await page.locator("#restart").click();
  await t.until((s) => s.scene === "title", "Restart");
  expect(t.errors).toEqual([]);
  await expect(page.locator("#diagnostic")).toBeHidden();
});

test("destination defers system keys until its reader, resumes Pause and cancels Quit", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const t = await destination(page);
  await t.until((s) => s.campaign.destination?.phase === "wipe", "entry wipe");
  await page.keyboard.press("KeyP");
  expect((await t.state()).systemOverlay).toBeNull();
  await body(t);
  await page.clock.runFor(100);
  expect((await t.state()).systemOverlay).toBeNull();
  let s = await body(t),
    read = s.campaign.destination.inputs;
  await page.keyboard.press("KeyP");
  expect((await t.state()).systemOverlay).toBeNull();
  s = await t.until(
    (s) => s.systemOverlay?.kind === "pause",
    "source Pause poll",
  );
  expect(s.campaign.destination.inputs).toBe(read);
  expect(s.campaign.destination.phase).toBe("reader-blocked");
  const frozen = await t.canvas.screenshot(),
    calls = s.campaign.destination.loop.completedCalls;
  await page.clock.runFor(100);
  s = await t.state();
  expect(s.campaign.destination.inputs).toBe(read);
  expect(s.campaign.destination.loop.completedCalls).toBe(calls);
  expect(await t.canvas.screenshot()).toEqual(frozen);
  await t.until((s) => s.systemOverlay?.phase === "waiting", "Pause lock");
  await page.keyboard.press("KeyP");
  await t.until((s) => !s.systemOverlay, "Pause resumes");
  await t.until(
    (s) => s.campaign.destination.inputs > read,
    "pending original read resumes",
  );
  s = await body(t);
  read = s.campaign.destination.inputs;
  await page.keyboard.press("KeyQ");
  s = await t.until(
    (s) => s.systemOverlay?.kind === "quit",
    "source Quit poll",
  );
  expect(s.campaign.destination.inputs).toBe(read);
  await page.keyboard.press("KeyN");
  await t.until((s) => !s.systemOverlay, "Quit cancelled");
  await t.until(
    (s) => s.campaign.destination.inputs > read,
    "reader continues",
  );
  s = await pressInBody(page, t, "NumpadEnter");
  await t.until(
    (s) => s.scene === "map" && !s.campaign.info,
    "Map confirmation",
  );
  expect((await t.state()).campaign.day).toBe(1);
  await writeFile(
    info.outputPath("destination-system.json"),
    JSON.stringify({ pauseRead: read, final: await t.state() }, null, 2),
  );
  await t.canvas.screenshot({
    path: info.outputPath("destination-loop-map.png"),
  });
  await page.locator("#restart").click();
  await t.until((s) => s.scene === "title", "Restart");
  expect(t.errors).toEqual([]);
  await expect(page.locator("#diagnostic")).toBeHidden();
});
