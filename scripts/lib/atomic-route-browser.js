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
export async function captureAtomicRoute(
  output,
  { report = false, guide = false, award = false } = {},
) {
  if (award && (report || guide))
    throw Error("Award route ends before atomic travel");
  if (guide && !report) throw Error("Guide route requires earned misdirection");
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
    if (report) {
      const reads = (await state()).cave.inputReads;
      await until((s) => s.cave.inputReads >= reads + 6);
    }
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
    if (award) {
      async function resultControls(prefix, phase, total) {
        assert.equal((await state()).expeditionResult.phase, phase);
        assert.equal((await state()).expeditionResult.remaining, total);
        await page.keyboard.press("p");
        await page.keyboard.press("Space");
        await until((s) => s.expeditionResult.remaining <= total - 6);
        assert.equal((await state()).systemOverlay, null);
        await note(prefix + "-before-poll");
        await until((s) => s.systemOverlay?.kind === "pause");
        assert.equal((await state()).expeditionResult.remaining, total - 7);
        await note(prefix + "-pause");
        await until((s) => s.systemOverlay?.phase === "waiting");
        assert.equal((await state()).expeditionResult.remaining, total - 7);
        await note(prefix + "-waiting");
        await page.keyboard.press("p");
        await until((s) => s.systemOverlay === null);
        assert.equal((await state()).expeditionResult.remaining, total - 7);
        await note(prefix + "-resumed");
        await page.keyboard.press("q");
        await page.keyboard.press("Space");
        await until((s) => s.systemOverlay?.kind === "quit");
        assert.equal((await state()).expeditionResult.remaining, total - 14);
        await note(prefix + "-quit");
        await page.keyboard.press("n");
        await until((s) => s.systemOverlay === null);
        await note(prefix + "-no");
        await until((s) => s.expeditionResult.remaining <= total - 21);
        assert.equal((await state()).scene, "expedition-result");
        assert.equal((await state()).expeditionResult.phase, phase);
        await note(prefix + "-neutral");
        await page.keyboard.press("Space");
      }
      await resultControls("award", "award", 280);
      await until((s) => s.expeditionResult?.phase === "atomic");
      await note("unlock");
      assert.equal((await state()).campaign.atomicAvailable, true);
      await resultControls("notice", "atomic", 700);
      await until((s) => s.scene === "map");
      assert.equal((await state()).money, 3400);
      assert.equal((await state()).campaign.day, 3);
      assert.deepEqual((await state()).campaign.playerCollected, [24]);
      await note("awarded-map");
      await saveRecordedRoute({
        page,
        root: output,
        observations: notes,
        scope:
          "Earned treasure award40 and atomic notice100 input waits;real P/Q/Fire and Restart;muted port regression,not native timing",
      });
      await page.locator("#restart").click();
      await until((s) => s.scene === "title");
      assert.equal((await state()).money, 0);
      assert.equal((await state()).expeditionResult, null);
      assert.equal((await state()).campaign.atomicAvailable, false);
      return {
        completed: true,
        accepted: false,
        route: "award",
        checkpoints: notes.length,
        events: notes.at(-1).eventCount,
        restart: true,
      };
    }
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
    if (report) {
      assert.equal(next.scene, "atomic-transport");
      assert.equal(next.atomicTransport.roll, 0);
      assert.equal(next.atomicTransport.seed, 6900);
      assert.equal(next.atomicTransport.inputPolls, 1);
      assert.equal(next.systemOverlay, null);
      await note("misdirection");
      await page.keyboard.press("p");
      await until((s) => s.systemOverlay?.kind === "pause");
      await note("report-pause");
      const remaining = (await state()).atomicTransport.remaining;
      await until((s) => s.systemOverlay?.phase === "waiting");
      assert.equal((await state()).atomicTransport.remaining, remaining);
      await note("pause-waiting");
      await page.keyboard.press("p");
      await until((s) => s.systemOverlay === null);
      assert.equal((await state()).atomicTransport.inputPolls, 2);
      await note("pause-resumed");
      await page.keyboard.press("q");
      await until((s) => s.systemOverlay?.kind === "quit");
      await note("report-quit");
      await page.keyboard.press("n");
      await until((s) => s.systemOverlay === null);
      assert.equal((await state()).atomicTransport.inputPolls, 3);
      await note("quit-no-resumed");
      await page.keyboard.press("Space");
    } else
      assert.notEqual(
        next.scene,
        "atomic-transport",
        "Expected recorded successful charge",
      );
    await until((s) => s.scene === "expedition-briefing");
    await note("arrival");
    if (guide) {
      assert.equal((await state()).briefing.remaining, 210);
      await page.keyboard.press("p");
      await page.keyboard.press("Space");
      await until((s) => s.briefing.remaining <= 204);
      assert.equal((await state()).briefing.remaining, 204);
      assert.equal((await state()).systemOverlay, null);
      await note("guide-before-poll");
      await until((s) => s.systemOverlay?.kind === "pause");
      assert.equal((await state()).briefing.remaining, 203);
      assert.equal((await state()).briefing.waitingForInputPoll, true);
      await note("guide-pause");
      await until((s) => s.systemOverlay?.phase === "waiting");
      assert.equal((await state()).briefing.remaining, 203);
      await note("guide-waiting");
      await page.keyboard.press("p");
      await until((s) => s.systemOverlay === null);
      assert.equal((await state()).scene, "expedition-briefing");
      assert.equal((await state()).briefing.remaining, 203);
      await note("guide-resumed");
      await page.keyboard.press("q");
      await page.keyboard.press("Space");
      await until((s) => s.systemOverlay?.kind === "quit");
      assert.equal((await state()).briefing.remaining, 196);
      await note("guide-quit");
      await page.keyboard.press("n");
      await until((s) => s.systemOverlay === null);
      assert.equal((await state()).scene, "expedition-briefing");
      await note("guide-quit-no");
      await until((s) => s.briefing.remaining <= 189);
      assert.equal((await state()).scene, "expedition-briefing");
      assert.equal((await state()).systemOverlay, null);
      await note("guide-neutral-after-no");
      await page.keyboard.press("Space");
    }

    await until((s) =>
      ["cave", "jungle", "mountain", "photography"].includes(s.scene),
    );
    await note("second-entry");
    if (!report) {
      assert.equal((await state()).scene, "cave");
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
    if (report) {
      const final = await state();
      assert.equal(final.scene, "jungle");
      assert.equal(final.campaign.location, 1);
      assert.equal(final.atomicTransport.outcome.misdirected, true);
      assert.equal(final.atomicTransport.inputPolls, 4);
      assert.equal(final.systemOverlay, null);
    }
    assert.equal((await state()).money, report ? 3400 : 3450);
    assert.equal((await state()).campaign.day, 6);
    await saveRecordedRoute({
      page,
      root: output,
      observations: notes,
      scope: guide
        ? "Earned guide controls;source shared09f5(30),real input/Pause/Quit-No/Fire;port regression,no native full-timing claim"
        : report
          ? "Earned atomic misdirection with Pause/Quit-No/Fire and redirected jungle entry;independent port inputs,no native timing claim"
          : "Earned atomic transmitter successful travel with queued charge P/Q/S;port regression,not native whole-game timing",
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
      route: guide ? "guide" : report ? "report" : "success",
      checkpoints: notes.length,
      events: notes.at(-1).eventCount,
      restart: true,
    };
  });
}

export async function replayAtomicRoute(
  events,
  checks,
  {
    omitAtomicChoice = false,
    report = false,
    omitReportPause = false,
    guide = false,
    omitGuidePause = false,
    award = false,
    omitAwardPause = false,
  } = {},
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
        i >=
          (checks.find((c) => c.name === "unlock")?.eventCount ?? Infinity) &&
        e.type === "keydown" &&
        e.key === "ArrowLeft",
    );
    if (!award) assert.ok(choice > 0, "SETUP: missing atomic selection");
    const pause = report
      ? events.findIndex(
          (e, i) =>
            i >= checks.find((c) => c.name === "misdirection").eventCount &&
            e.type === "keydown" &&
            e.key === "p",
        )
      : -1;
    if (omitReportPause)
      assert.ok(report && pause > 0, "SETUP: missing report Pause");
    const guidePause = guide
      ? events.findIndex(
          (e, i) =>
            i >= checks.find((c) => c.name === "arrival").eventCount &&
            e.type === "keydown" &&
            e.key === "p",
        )
      : -1;
    if (omitGuidePause)
      assert.ok(guide && guidePause > 0, "SETUP:missing guide Pause");
    const awardPause = award
      ? events.findIndex(
          (e, i) =>
            i >= checks.find((c) => c.name === "award").eventCount &&
            e.type === "keydown" &&
            e.key === "p",
        )
      : -1;
    if (omitAwardPause)
      assert.ok(award && awardPause > 0, "SETUP: missing award Pause");
    let now = 1,
      consumed = 0,
      omitted = 0;
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
        if (
          !(omitAtomicChoice && consumed === choice) &&
          !(omitReportPause && consumed === pause) &&
          !(omitGuidePause && consumed === guidePause) &&
          !(omitAwardPause && consumed === awardPause)
        )
          await recordedDOMInput(page, e);
        else omitted++;
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
        expected.eventCount - omitted,
        "Atomic consumed DOM events",
      );
      console.log(
        "Atomic " +
          (award ? "award" : guide ? "guide" : report ? "report" : "success") +
          " checkpoint " +
          expected.name,
      );
    }
    assert.equal(consumed, events.length);
    const final = await state();
    if (award) {
      assert.equal(final.scene, "map");
      assert.equal(final.money, 3400);
      assert.equal(final.campaign.day, 3);
      assert.deepEqual(final.campaign.playerCollected, [24]);
      assert.equal(final.campaign.atomicAvailable, true);
    } else {
      assert.equal(final.scene, report ? "jungle" : "cave");
      if (report) {
        assert.equal(final.campaign.location, 1);
        assert.equal(final.atomicTransport.outcome.misdirected, true);
        assert.equal(final.atomicTransport.inputPolls, 4);
      } else assert.equal(final.cave.room, 18);
      assert.equal(final.money, report ? 3400 : 3450);
      assert.equal(final.campaign.day, 6);
      assert.equal(final.systemOverlay, null);
    }
    await page.locator("#restart").click();
    await until((s) => s.scene === "title");
    assert.equal((await state()).money, 0);
    assert.equal((await state()).campaign.atomicAvailable, false);
    assert.equal((await state()).atomicTransport, null);
    return { completed: true, checked: checks.length, consumed, restart: true };
  });
}
