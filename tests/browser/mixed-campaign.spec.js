import { test, expect } from "@playwright/test";
import startup from "../../reference/campaign-startup-browser.json" with { type: "json" };
import ascent from "../../reference/mountain-ascent.json" with { type: "json" };
import manifest from "../../reference/mixed-campaign.json" with { type: "json" };
import { writeFile } from "node:fs/promises";

// Browser acceptance with a feedback controller, not an original-game replay.
// No game state is injected. Expected checkpoints never supply control values.
test("one campaign carries four expeditions, rival activity and deposits through the deadline", async ({
  page,
}, info) => {
  test.setTimeout(360000);
  const errors = [],
    checkpoints = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-01-01T00:00:01Z"));
  await page.addInitScript(() => {
    window.mixedCampaignEvents = [];
    for (const type of ["keydown", "keyup", "pointerdown", "pointerup"])
      document.addEventListener(type, (event) => {
        const target = event.target.closest?.("canvas,button");
        const bounds = target?.getBoundingClientRect();
        window.mixedCampaignEvents.push({
          time: performance.now(),
          type,
          key: event.key ?? null,
          target: target?.id ?? null,
          ...(target?.id === "game"
            ? {
                x: ((event.clientX - bounds.left) * 320) / bounds.width,
                y: ((event.clientY - bounds.top) * 200) / bounds.height,
              }
            : {}),
        });
      });
    window.requestAnimationFrame = (callback) =>
      setTimeout(() => callback(performance.now()), 8);
    window.cancelAnimationFrame = clearTimeout;
  });
  await page.goto("/");
  await expect(page.locator("#actions")).toBeVisible();
  const canvas = page.locator("#game");
  const state = () => canvas.getAttribute("data-state").then(JSON.parse);
  async function until(predicate, max = 10000) {
    for (let n = 0; n < max; n++) {
      const s = await state();
      if (s?.diagnostic) throw Error(s.diagnostic);
      if (s && predicate(s)) return s;
      await page.clock.runFor(8);
    }
    throw Error(`Unfinished mixed campaign: ${JSON.stringify(await state())}`);
  }
  async function press(key) {
    await page.keyboard.press(key);
    await page.clock.runFor(100);
  }
  async function checkpoint(name) {
    const s = await state();
    checkpoints.push({ name, state: s });
    const summary = {
      scene: s.scene,
      day: s.campaign?.day,
      money: s.money,
      banked: s.campaign?.banked,
      seed: s.seed,
    };
    if (manifest.expected[name])
      expect(summary, name).toEqual(manifest.expected[name]);
    console.log(
      name,
      JSON.stringify({
        scene: s.scene,
        day: s.campaign?.day,
        money: s.money,
        banked: s.campaign?.banked,
        seed: s.seed,
      }),
    );
  }
  async function point(x, y) {
    const r = await canvas.boundingBox();
    await canvas.click({
      position: { x: (r.width * x) / 320, y: (r.height * y) / 200 },
    });
    await page.clock.runFor(100);
  }
  async function settleReports() {
    for (
      let count = 0;
      (await state()).scene === "rival-report" && count < 8;
      count++
    ) {
      await checkpoint("rival-report");
      await page.keyboard.down("Space");
      await until((s) => s.scene !== "rival-report");
      await page.keyboard.up("Space");
    }
    expect((await state()).scene).not.toBe("rival-report");
  }
  async function finishBank() {
    if ((await state()).scene !== "bank") return;
    const before = await state();
    expect(before.money).toBe(0);
    await checkpoint("bank-deposited");
    await page.keyboard.down("Space");
    await until((s) => s.scene !== "bank");
    await page.keyboard.up("Space");
    await settleReports();
  }
  async function depart(x, y) {
    await settleReports();
    if ((await state()).scene === "office") {
      await page.locator("#map").click();
      await page.clock.runFor(100);
      await settleReports();
    }
    expect((await state()).scene).toBe("map");
    const fromOffice = (await state()).campaign.location === 35;
    await point(x, y);
    await press("Space");
    await settleReports();
    // The office offers an aircraft choice. Expeditions departing from other
    // locations start directly with the already selected aircraft.
    if (fromOffice) {
      await until((s) => s.scene === "map" && s.campaign.info);
      await press("ArrowRight");
      await press("Space");
      await settleReports();
    }
  }
  async function fly({ crash = false } = {}) {
    expect((await state()).scene).toBe("departure");
    await page.keyboard.down("Space");
    await until((s) => s.scene === "flight" && s.flight.speed > 4);
    if (crash) {
      await page.keyboard.down("ArrowDown");
      await until((s) => s.flight.heading > 0);
      await page.keyboard.up("ArrowDown");
      await page.keyboard.up("Space");
    } else {
      let held = null,
        frames = 0;
      for (; frames < 1500; frames++) {
        const s = await state(),
          f = s.flight;
        if (
          s.scene !== "flight" ||
          f.phase === "landing" ||
          f.phase === "complete"
        )
          break;
        const desired =
          f.tile > f.tiles - 5
            ? f.y < 135
              ? 15
              : 0
            : f.y > 90
              ? 1
              : f.y < 75
                ? 15
                : 0;
        const delta = (desired - f.heading + 16) % 16;
        const direction =
          f.speed < 4 || !delta ? null : delta < 8 ? "ArrowDown" : "ArrowUp";
        if (direction !== held) {
          if (held) await page.keyboard.up(held);
          if (direction) await page.keyboard.down(direction);
          held = direction;
        }
        await until(
          (after) =>
            after.scene !== "flight" ||
            after.flight.frames > f.frames ||
            after.flight.phase !== f.phase,
        );
      }
      if (held) await page.keyboard.up(held);
      await page.keyboard.up("Space");
      expect(frames, "flight input sequence must finish").toBeLessThan(1500);
    }
    await until(
      (s) =>
        ![
          "departure",
          "flight",
          "crash-repairs",
          "expedition-briefing",
        ].includes(s.scene),
    );
    await checkpoint("arrival");
  }
  try {
    await until((s) => s.scene === "title");
    await expect(
      page.getByRole("checkbox", { name: "Sound (reconstructed)" }),
    ).not.toBeChecked();
    await canvas.focus();
    await press("Space");
    await press("Enter");
    // First expedition reuses the independently authored startup keyboard
    // stream. Later expeditions carry the resulting state, not fresh fixtures.
    await depart(64, 73);
    await fly({ crash: true });
    const entry = await state();
    expect(entry.scene).toBe("jungle");
    expect(entry.jungle.seed).toBe(startup.jungle.entrySeed);
    let held = new Set(),
      used = 0,
      checked = 0;
    const stream = startup.jungle.inputEvents.flatMap((e) =>
      Array(e.count).fill(e.byte),
    );
    expect(stream).toHaveLength(857);
    // Deliberately wrong external input for the separate negative-control run.
    // Counts remain unchanged: an actual state comparison must reject it.
    if (process.env.DUCKTALES_MIXED_NEGATIVE === "wrong-jungle-input")
      stream[0] = 3;
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
      expect(before.scene).toBe("jungle");
      expect(before.jungle.frames).toBe(used);
      const after = await until(
        (s) => s.scene !== "jungle" || s.jungle.frames > used,
      );
      used++;
      expect(after.jungle.frames).toBe(used);
      const expected = startup.jungle.checkpoints[checked];
      if (expected?.inputCount === used) {
        for (const field of startup.jungle.browserComparisonFields)
          expect(after.jungle[field], `jungle ${checked} ${field}`).toEqual(
            expected.state[field],
          );
        checked++;
      }
    }
    for (const key of held) await page.keyboard.up(key);
    expect(checked).toBe(23);
    await until((s) => s.scene === "expedition-result");
    expect((await state()).money).toBe(1000);
    await press("Space");
    await until((s) => s.scene === "map");
    await checkpoint("jungle-return");
    await depart(212, 131);
    await finishBank();
    expect((await state()).campaign.banked).toBe(1000);
    await page.locator("#back").click();
    await page.clock.runFor(100);
    await settleReports();
    expect((await state()).scene).toBe("office");

    await depart(46, 56);
    await fly();
    await until(
      (s) => s.scene === "photography" && s.photography.phase === "playing",
    );
    const photoEntry = await state();
    let targetShot = false;
    for (let shot = 0; shot < 8 && !targetShot; shot++) {
      const ready = await until(
        (s) =>
          s.photography.phase !== "playing" ||
          s.photography.animals.some(
            (a) =>
              a.place && a.animal === s.photography.target && a.frame === 0,
          ),
      );
      expect(ready.photography.phase).toBe("playing");
      const column = ready.photography.animals.findIndex(
        (a) =>
          a.place && a.animal === ready.photography.target && a.frame === 0,
      );
      const key = ["ArrowLeft", "ArrowUp", "ArrowRight"][column];
      await page.keyboard.down(key);
      await until((s) => s.photography.column === column);
      await page.keyboard.up(key);
      const count = (await state()).photography.photoCount;
      await page.keyboard.down("Space");
      await until(
        (s) =>
          s.photography.photoCount > count || s.photography.phase !== "playing",
      );
      await page.keyboard.up("Space");
      targetShot = (await state()).photography.photos.includes(
        ready.photography.target,
      );
    }
    expect(targetShot).toBe(true);
    await page.keyboard.down("Space");
    const photos = await until((s) => s.photography.phase === "results");
    await page.keyboard.up("Space");
    const reward = photos.photography.photos.reduce(
      (sum, p) => sum + (p === photos.photography.target ? 500 : p ? 50 : 0),
      0,
    );
    await until((s) => s.scene === "map");
    expect((await state()).money).toBe(photoEntry.money + reward);
    expect((await state()).campaign.day).toBe(photoEntry.campaign.day + 2);
    await checkpoint("photography-return");

    await depart(37, 33);
    await fly();
    expect((await state()).scene).toBe("cave");
    for (let move = 0; move < 64 && (await state()).scene === "cave"; move++) {
      const now = await until(
        (s) =>
          s.scene !== "cave" ||
          ["exploring", "treasure", "complete"].includes(s.cave.phase),
      );
      if (now.scene !== "cave" || now.cave.phase !== "exploring") break;
      const { room, goal, rooms, enemy } = now.cave;
      let route;
      for (const margin of [1, 0, -1]) {
        const queue = [[room, []]],
          seen = new Set([room]);
        while (queue.length) {
          const [at, path] = queue.shift();
          if (at === goal) {
            route = path;
            break;
          }
          const danger =
            margin === 1
              ? [enemy, enemy - 8, enemy + 8, enemy - 1, enemy + 1]
              : margin === 0
                ? [enemy]
                : [];
          for (const [key, bit, delta] of [
            ["ArrowUp", 8, -8],
            ["ArrowRight", 2, 1],
            ["ArrowDown", 4, 8],
            ["ArrowLeft", 1, -1],
          ]) {
            const next = at + delta;
            if (
              !(rooms[at] & bit) ||
              next < 0 ||
              next >= 64 ||
              rooms[next] & 64 ||
              seen.has(next) ||
              (next !== goal && danger.includes(next))
            )
              continue;
            seen.add(next);
            queue.push([next, [...path, key]]);
          }
        }
        if (route?.length) break;
      }
      expect(route?.length, "cave path").toBeGreaterThan(0);
      await page.keyboard.down(route[0]);
      await page.keyboard.down("Space");
      await until((s) => s.scene !== "cave" || s.cave.room !== room);
      await page.keyboard.up("Space");
      await page.keyboard.up(route[0]);
    }
    const caveAward = await until((s) => s.scene === "expedition-result");
    expect(caveAward.cave.outcome.status).toBe("treasure");
    await press("Space");
    await until((s) => s.scene === "map");
    await checkpoint("cave-return");

    await depart(36, 61);
    await fly();
    expect((await state()).scene).toBe("mountain");
    const ascentInputs = ascent.inputEvents.flatMap((e) =>
      Array(e.count).fill(e.byte),
    );
    expect(ascentInputs).toHaveLength(764);
    held = new Set();
    let climbed = 0;
    for (const byte of ascentInputs) {
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
      expect(before.scene).toBe("mountain");
      const after = await until(
        (s) =>
          s.scene !== "mountain" || s.mountain.frames > before.mountain.frames,
      );
      expect(after.mountain.frames).toBe(before.mountain.frames + 1);
      climbed++;
    }
    for (const key of held) await page.keyboard.up(key);
    expect(climbed).toBe(764);
    const summit = await until((s) => s.scene === "expedition-result");
    expect(summit.mountain.outcome.code).toBe(1);
    await press("Space");
    await until((s) => s.scene === "map");
    await checkpoint("mountain-return");

    // Finish through real calendar-consuming bank/office travel. A final bank
    // can interrupt either leg when it crosses day30; both must be completed.
    for (let trip = 0; trip < 8 && (await state()).scene !== "ending"; trip++) {
      await depart(212, 131);
      await finishBank();
      if ((await state()).scene === "ending") break;
      await page.locator("#back").click();
      await page.clock.runFor(100);
      await settleReports();
      await finishBank();
    }
    const ended = await until((s) => s.scene === "ending" && s.ending.ready);
    expect(ended.campaign.day).toBeGreaterThanOrEqual(30);
    expect(ended.money).toBe(0);
    expect(ended.campaign.banked).toBeGreaterThan(1000);
    expect(ended.campaign.playerCollected).toEqual(
      expect.arrayContaining([1, 30, 31]),
    );
    expect(ended.campaign.rivalCollected.length).toBeGreaterThan(0);
    expect(ended.campaign.rivalUnlockMask).toBe(15);
    expect(ended.ending).toMatchObject(manifest.expectedEnding);
    expect(ended.campaign).toMatchObject(manifest.expectedOwnership);
    const events = await page.evaluate(() => window.mixedCampaignEvents);
    const activeKeys = new Set();
    for (const e of events) {
      if (e.type === "keydown") activeKeys.add(e.key);
      if (e.type === "keyup") activeKeys.delete(e.key);
    }
    expect(events.length).toBeGreaterThan(0);
    expect(
      [...activeKeys],
      "all held browser controls must be released",
    ).toEqual([]);
    await checkpoint("ending");
    expect(checkpoints).toHaveLength(manifest.expectedCheckpointCount);
    expect(checkpoints.map((c) => c.name)).toEqual(manifest.checkpointNames);
    await canvas.screenshot({
      path: info.outputPath("mixed-campaign-ending.png"),
    });
    expect(errors).toEqual([]);
    await expect(page.locator("#diagnostic")).toBeHidden();
  } finally {
    const events = await page.evaluate(() => window.mixedCampaignEvents);
    await writeFile(
      info.outputPath("captured-events.json"),
      JSON.stringify(events, null, 2),
    );
    await writeFile(
      info.outputPath("campaign-checkpoints.json"),
      JSON.stringify(checkpoints, null, 2),
    );
    await info.attach("campaign-checkpoints", {
      body: JSON.stringify(checkpoints, null, 2),
      contentType: "application/json",
    });
  }
});
