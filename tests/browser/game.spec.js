import { test, expect } from "@playwright/test";

test("keyboard route loads originals, dives, returns and restarts", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const canvas = page.locator("#game");
  await expect(canvas).toHaveAttribute("data-scene", "title");
  await canvas.focus();
  await page.keyboard.press("Space");
  await expect(canvas).toHaveAttribute("data-scene", "difficulty");
  await page.keyboard.press("ArrowDown");
  await expect
    .poll(
      async () =>
        JSON.parse(await canvas.getAttribute("data-state")).difficulty,
    )
    .toBe(1);
  await page.keyboard.press("Enter");
  await expect(canvas).toHaveAttribute("data-scene", "office");
  await page.getByRole("checkbox", { name: "Sound (reconstructed)" }).check();
  await canvas.focus();
  await page.keyboard.down("ArrowUp");
  await page.keyboard.press("Space");
  await page.keyboard.up("ArrowUp");
  await expect(canvas).toHaveAttribute("data-scene", "money-bin");
  await expect
    .poll(() => page.locator("#sound").evaluate((a) => a.readyState))
    .toBeGreaterThan(0);
  await expect
    .poll(() => page.locator("#sound").evaluate((a) => a.currentTime))
    .toBeGreaterThan(0);
  await page.waitForFunction(() => {
    const state = JSON.parse(document.getElementById("game").dataset.state);
    return (
      state.bin?.phase === "idle" &&
      state.bin.nextPose === 3 &&
      state.bin.remaining >= 10
    );
  });
  await page.keyboard.press("Space");
  await expect
    .poll(
      async () => JSON.parse(await canvas.getAttribute("data-state")).bin.phase,
    )
    .toBe("dive");
  await expect(canvas).toHaveAttribute("data-scene", "office", {
    timeout: 20000,
  });
  const result = JSON.parse(await canvas.getAttribute("data-state"));
  expect(result.money).toBe(1000);
  expect(result.bin.won).toBe(true);
  expect(result.bin.complete).toBe(true);
  await expect(page.locator("#diagnostic")).toBeHidden();
  expect(errors).toEqual([]);
  await page.screenshot({
    path: ".local/browser-results/office-after-dive.png",
  });
  await page.getByRole("button", { name: "Restart", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-scene", "title");
  expect(JSON.parse(await canvas.getAttribute("data-state")).money).toBe(0);
});

test("corrupt original assets stop loading", async ({ page }) => {
  await page.route("**/game/MBIN.ARC", (route) =>
    route.fulfill({ body: "corrupt" }),
  );
  await page.goto("/");
  await expect(page.locator("#diagnostic")).toContainText(
    "Unsupported or corrupt MBIN.ARC",
  );
  await expect(page.locator("#actions")).toBeHidden();
});

test("office pixels match the captured original exactly", async ({ page }) => {
  const { readFile, writeFile } = await import("node:fs/promises");
  const { PNG } = await import("pngjs");
  const original = PNG.sync.read(await readFile(".local/original-office.png"));
  expect(original.width).toBe(320);
  expect(original.height).toBe(200);
  await page.goto("/");
  const canvas = page.locator("#game");
  await expect(canvas).toHaveAttribute("data-scene", "title");
  await canvas.focus();
  await page.keyboard.press("Space");
  await expect(canvas).toHaveAttribute("data-scene", "difficulty");
  await page.keyboard.press("Enter");
  await expect(canvas).toHaveAttribute("data-scene", "office");
  const url = await canvas.evaluate((c) => c.toDataURL("image/png"));
  const data = Buffer.from(url.split(",")[1], "base64");
  await writeFile(".local/browser-results/office-native.png", data);
  const actual = PNG.sync.read(data);
  let differences = 0;
  for (let i = 0; i < actual.data.length; i += 4)
    if (
      actual.data[i] !== original.data[i] ||
      actual.data[i + 1] !== original.data[i + 1] ||
      actual.data[i + 2] !== original.data[i + 2]
    )
      differences++;
  expect(differences, "office pixels differ from original DOSBox capture").toBe(
    0,
  );
});

test("failed dive preserves original final pose pixels", async ({ page }) => {
  const { readFile, writeFile } = await import("node:fs/promises");
  const { PNG } = await import("pngjs");
  const expected = PNG.sync.read(
    await readFile(".local/original-failed-end.png"),
  );
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const canvas = document.getElementById("game");
      canvas.addEventListener("gamepresent", (event) => {
        const state = event.detail;
        if (
          state.scene === "money-bin" &&
          state.bin?.sprites[0].asset === 10 &&
          state.bin.sprites[0].frame === 12
        )
          window.failedPoseCapture = canvas.toDataURL("image/png");
      });
    });
  });
  await page.goto("/");
  const canvas = page.locator("#game");
  await expect(canvas).toHaveAttribute("data-scene", "title");
  await canvas.focus();
  await page.keyboard.press("Space");
  await expect(canvas).toHaveAttribute("data-scene", "difficulty");
  await page.keyboard.press("Enter");
  await expect(canvas).toHaveAttribute("data-scene", "office");
  await page
    .getByRole("button", { name: "Enter money bin", exact: true })
    .click();
  await canvas.focus();
  await page.waitForFunction(() => {
    const s = JSON.parse(document.getElementById("game").dataset.state);
    return (
      s.bin?.phase === "idle" && s.bin.nextPose === 4 && s.bin.remaining >= 10
    );
  });
  await page.keyboard.press("Space");
  await page.waitForFunction(
    () => typeof window.failedPoseCapture === "string",
  );
  const actual = PNG.sync.read(
    Buffer.from(
      (await page.evaluate(() => window.failedPoseCapture)).split(",")[1],
      "base64",
    ),
  );
  await writeFile(".local/failed-actual.png", PNG.sync.write(actual));
  let differences = 0;
  for (let i = 0; i < actual.data.length; i += 4)
    if (
      actual.data[i] !== expected.data[i] ||
      actual.data[i + 1] !== expected.data[i + 1] ||
      actual.data[i + 2] !== expected.data[i + 2]
    )
      differences++;
  expect(differences, "failed-dive final pose differs from original").toBe(0);
  await expect(canvas).toHaveAttribute("data-scene", "office");
  expect(JSON.parse(await canvas.getAttribute("data-state")).money).toBe(0);
});

test("local folder loading works without the development asset endpoint and unsupported routes stop", async ({
  page,
}) => {
  const path = await import("node:path");
  await page.route("**/game/DUCKTALE.EXE", (route) =>
    route.fulfill({ status: 404, body: "" }),
  );
  await page.goto("/");
  await expect(page.locator("#diagnostic")).toContainText("Missing game/");
  await page.locator("#folder").setInputFiles(path.resolve("game"));
  const canvas = page.locator("#game");
  await expect(canvas).toHaveAttribute("data-scene", "title");
  await expect(page.locator("#diagnostic")).toBeHidden();
  await canvas.focus();
  await page.keyboard.press("Space");
  await expect(canvas).toHaveAttribute("data-scene", "difficulty");
  await page.keyboard.press("Enter");
  await expect(canvas).toHaveAttribute("data-scene", "office");
  await page.keyboard.down("ArrowLeft");
  await page.keyboard.press("Space");
  await page.keyboard.up("ArrowLeft");
  await expect(page.locator("#diagnostic")).toContainText(
    "Untranslated route: control center",
  );
  await page.getByRole("button", { name: "Restart", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-scene", "title");
  await expect(page.locator("#diagnostic")).toBeHidden();
});
