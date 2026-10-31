// Actual-browser route explored before this recording/checker was authored.
import assert from "node:assert/strict";
import { withCarlsbadBrowser } from "./carlsbad-browser.js";
import { finishSecurityEntry } from "../../tests/browser/helpers/security.js";
import { explorePhysicalFlight } from "../../tests/browser/helpers/flight-policy.js";
import {
  observeRecordedRoute,
  saveRecordedRoute,
} from "../../tests/browser/helpers/entry-recording.js";
import { recordedDOMInput } from "../../tests/browser/helpers/recorded-dom-input.js";
export async function captureAtomicRoute(output) {
  return withCarlsbadBrowser(async (c) => {
    const { page, canvas, state, press } = c;
    const notes = [];
    async function until(predicate) {
      for (let i = 0; i < 20000; i++) {
        const s = await state();
        if (s?.diagnostic) throw Error(s.diagnostic);
        if (s && predicate(s)) return s;
        await page.clock.runFor(8);
      }
      throw Error(
        "Unfinished atomic explorer " + JSON.stringify(await state()),
      );
    }
    async function note(name) {
      notes.push(
        await observeRecordedRoute({ page, state: await state(), name }),
      );
      console.log("Atomic route " + name);
    }
    async function point(x, y) {
      const b = await canvas.boundingBox();
      await canvas.click({
        position: { x: (b.width * x) / 320, y: (b.height * y) / 200 },
      });
      await page.clock.runFor(100);
    }
    await until((s) => s.scene === "title");
    await press("Space");
    await until((s) => s.scene === "difficulty" && s.difficultyMenu.ready);
    await press("Enter");
    await until((s) => s.scene === "office");
    await page.locator("#map").click();
    await finishSecurityEntry({ page, state, until });
    await point(240, 70);
    assert.equal((await state()).campaign.asset, 29);
    await press("Space");
    await until((s) => s.campaign.destination?.ready);
    await press("ArrowRight");
    await until(
      (s) => s.campaign.choice === 1 && s.campaign.destination?.ready,
    );
    await press("Space");
    await until((s) => s.scene === "departure");
    await press("Space");
    await until((s) => s.scene === "flight");
    await explorePhysicalFlight({
      page,
      state,
      until,
      policy: { altitude: [25, 40], climbHeading: 3 },
    });
    await until((s) => s.scene === "cave");
    await note("cave-entry");
    assert.equal((await state()).briefing.variant, 7);
    await until((s) => s.cave.phase === "exploring");
    for (const key of [
      "ArrowRight",
      "ArrowDown",
      "ArrowDown",
      "ArrowRight",
      "ArrowUp",
      "ArrowUp",
      "ArrowRight",
      "ArrowRight",
      "ArrowRight",
    ]) {
      await until((s) => s.cave.phase === "exploring");
      const old = await state();
      await page.keyboard.down(key);
      await page.keyboard.down("Space");
      await until((s) => s.scene !== "cave" || s.cave.room !== old.cave.room);
      await page.keyboard.up("Space");
      await page.keyboard.up(key);
      await note("room-" + (await state()).cave.room);
    }
    await until((s) => s.scene === "expedition-result");
    await note("award");
    assert.equal((await state()).cave.outcome.code, 1);
    assert.equal((await state()).campaign.location, 24);
    await press("Space");
    await until(
      (s) =>
        s.scene === "expedition-result" &&
        s.expeditionResult.phase === "atomic",
    );
    await note("unlock");
    assert.equal((await state()).campaign.atomicAvailable, true);
    await press("Space");
    await until((s) => s.scene === "map");
    await page.locator("#back").click();
    await until((s) => s.scene === "office");
    await page.locator("#map").click();
    await finishSecurityEntry({ page, state, until });
    await point(37, 33);
    await press("Space");
    await until((s) => s.campaign.destination?.ready);
    await press("ArrowLeft");
    await until(
      (s) => s.campaign.choice === 2 && s.campaign.destination?.ready,
    );
    await note("choice");
    await page.keyboard.press("Space");
    await until((s) => s.scene === "atomic-transport");
    await note("charge");
    assert.equal((await state()).atomicTransport.phase, "charge");
    for (const key of ["p", "q", "s"]) await page.keyboard.press(key);
    await page.clock.runFor(8);
    assert.equal((await state()).systemOverlay, null);
    assert.equal((await state()).atomicTransport.phase, "charge");
    assert.equal(await page.locator("#audio").isChecked(), false);
    await note("charge-keys-ignored");
    const next = await until(
      (s) =>
        s.scene !== "atomic-transport" || s.atomicTransport.phase === "report",
    );
    assert.notEqual(
      next.scene,
      "atomic-transport",
      "Expected recorded successful charge",
    );
    await until((s) => s.scene === "expedition-briefing");
    await note("arrival");
    await until((s) =>
      ["cave", "jungle", "mountain", "photography"].includes(s.scene),
    );
    await note("second-entry");
    if ((await state()).scene === "cave") {
      await until((s) => s.cave.phase === "exploring");
      const s = await state(),
        key = [
          [2, "ArrowRight"],
          [4, "ArrowDown"],
          [8, "ArrowUp"],
          [1, "ArrowLeft"],
        ].find(
          ([bit]) =>
            s.cave.rooms[s.cave.room] & bit &&
            !(
              s.cave.rooms[s.cave.room + { 2: 1, 4: 8, 8: -8, 1: -1 }[bit]] & 64
            ),
        )[1];
      await page.keyboard.down(key);
      await page.keyboard.down("Space");
      await until((v) => v.cave.room !== s.cave.room);
      await page.keyboard.up("Space");
      await page.keyboard.up(key);
      await until((v) => v.cave.phase === "exploring");
      assert.equal((await state()).money, 3450);
      assert.equal((await state()).systemOverlay, null);
      await note("second-action");
    }
    assert.equal((await state()).money, 3450);
    assert.equal((await state()).campaign.day, 6);
    await saveRecordedRoute({
      page,
      root: output,
      observations: notes,
      scope:
        "Earned atomic transmitter successful travel with queued charge P/Q/S;port regression,not native whole-game timing",
    });
    await page.locator("#restart").click();
    await until((s) => s.scene === "title");
    assert.equal((await state()).atomicTransport, null);
    assert.equal((await state()).campaign.atomicAvailable, false);
    assert.equal((await state()).campaign.aircraft, "launchpad");
    assert.equal((await state()).money, 0);
    return {
      completed: true,
      accepted: false,
      checkpoints: notes.length,
      events: notes.at(-1).eventCount,
      restart: true,
    };
  });
}

export async function replayAtomicRoute(
  events,
  checks,
  { omitAtomicChoice = false } = {},
) {
  assert.ok(
    events.length > 0 && checks.length > 0,
    "SETUP: empty atomic route",
  );
  assert.equal(
    checks.at(-1).eventCount,
    events.length,
    "Unfinished atomic input stream",
  );
  return withCarlsbadBrowser(async ({ page, state, until }) => {
    const choice = events.findIndex(
      (e, i) =>
        i >= checks.find((c) => c.name === "unlock").eventCount &&
        e.type === "keydown" &&
        e.key === "ArrowLeft",
    );
    assert.ok(choice > 0, "SETUP: missing atomic selection");
    let now = 1,
      consumed = 0;
    async function advance(at) {
      assert.ok(at >= now, "Late atomic event");
      if (at > now) await page.clock.runFor(at - now);
      now = at;
    }
    for (const expected of checks) {
      assert.ok(
        expected.eventCount >= consumed && expected.eventCount <= events.length,
      );
      while (consumed < expected.eventCount) {
        const e = events[consumed];
        await advance(e.time);
        if (!(omitAtomicChoice && consumed === choice))
          await recordedDOMInput(page, e);
        consumed++;
      }
      await advance(expected.at);
      const actual = await observeRecordedRoute({
        page,
        state: await state(),
        name: expected.name,
      });
      assert.equal(actual.state.diagnostic, null);
      assert.equal(actual.at, expected.at);
      assert.equal(
        actual.stateSha256,
        expected.stateSha256,
        "Atomic state " + expected.name,
      );
      assert.equal(
        actual.pixelsSha256,
        expected.pixelsSha256,
        "Atomic pixels " + expected.name,
      );
      assert.equal(
        actual.eventCount,
        expected.eventCount,
        "Atomic consumed DOM events",
      );
    }
    assert.equal(consumed, events.length);
    const final = await state();
    assert.equal(final.scene, "cave");
    assert.equal(final.cave.room, 18);
    assert.equal(final.money, 3450);
    assert.equal(final.campaign.day, 6);
    assert.equal(final.systemOverlay, null);
    await page.locator("#restart").click();
    await until((s) => s.scene === "title");
    assert.equal((await state()).money, 0);
    assert.equal((await state()).campaign.atomicAvailable, false);
    assert.equal((await state()).atomicTransport, null);
    return { completed: true, checked: checks.length, consumed, restart: true };
  });
}
