// Actual DOM player, not acceptance or an original-game oracle. Policies choose
// controls from current published state; no memory, RNG, clock or ownership patch.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { explorePhysicalFlight } from "../../tests/browser/helpers/flight-policy.js";
import { readEasyJunglePlan, jungleCases } from "./easy-jungle-browser.js";
import { planCaveVariant } from "./easy-cave-variants.js";

export async function continueWinningCampaign({
  page,
  state,
  until,
  press,
  point,
  settle,
  observe,
  root,
  locations,
}) {
  async function confirmTarget(id, x, y) {
    await until(
      (s) =>
        s.scene === "map" &&
        (!s.campaign.destination ||
          (s.campaign.destination.ready && !s.campaign.destination.confirming)),
    );
    await point(x, y);
    assert.equal((await state()).campaign.selected, id);
    await press("Space");
    const selected = await until(
      (s) =>
        s.scene !== "map" ||
        (s.campaign.destination?.ready && !s.campaign.destination.confirming),
    );
    if (selected.scene === "map") {
      for (let n = 0; n < 3 && (await state()).campaign.choice !== 1; n++) {
        await press(
          (await state()).campaign.choice === 2 ? "ArrowLeft" : "ArrowRight",
        );
        await until((s) => s.campaign.destination?.ready);
      }
      assert.equal((await state()).campaign.choice, 1);
      await press("Space");
      await until((s) => s.scene !== "map");
    }
  }
  async function depart(id, x, y) {
    await confirmTarget(id, x, y);
    await settle();
    assert.equal(
      (await state()).scene,
      "departure",
      "Authored destination did not launch;inspect its real consequence",
    );
    await observe("departure-" + id);
    await until((s) => s.scene === "flight");
    const trace = await explorePhysicalFlight({
      page,
      state,
      until,
      policy: { altitude: [25, 40], climbHeading: 3 },
    });
    await writeFile(
      root + "/flight-" + id + ".json",
      JSON.stringify(trace) + "\n",
    );
    await until((s) => s.scene !== "flight");
    await observe("flight-return-" + id);
    assert.equal(
      (await state()).flight.outcome.code,
      1,
      "Player pilot lost/crashed;not proof of a port defect",
    );
    await settle();
  }
  const keys = (byte) =>
    new Set([
      ...(byte & 64 ? ["Space"] : []),
      ...({
        1: ["ArrowUp"],
        3: ["ArrowRight"],
        5: ["ArrowDown"],
        7: ["ArrowLeft"],
      }[byte & 63] ?? []),
    ]);
  async function play(activity, stream) {
    assert.ok(stream.length > 0);
    let held = new Set(),
      used = 0;
    for (let i = 0; i < stream.length; i++) {
      const before = await state();
      assert.equal(
        before.scene,
        activity,
        "Unfinished authored " + activity + " controls",
      );
      assert.equal(before[activity].frames, used);
      const next = keys(stream[i]),
        following = keys(stream[i + 1] ?? 0);
      for (const key of held) if (!next.has(key)) await page.keyboard.up(key);
      for (const key of next) await page.keyboard.down(key);
      held = next;
      for (const key of [...held])
        if (!following.has(key)) {
          await page.keyboard.up(key);
          held.delete(key);
        }
      const after = await until(
        (s) => s.scene !== activity || s[activity].frames > used,
      );
      used++;
      assert.equal(after[activity].frames, used, "Skipped action input frame");
      if (used % 40 === 0) await observe(activity + "-input-" + used);
    }
    for (const key of held) await page.keyboard.up(key);
    assert.equal(used, stream.length);
    await observe(activity + "-controls-complete");
    await until((s) => s.scene !== activity);
    assert.equal(
      (await state())[activity].outcome.code,
      1,
      "Authored action route failed;not proof of a port defect",
    );
    assert.equal((await state())[activity].lives, 3);
    await observe(activity + "-award-entry");
    await until(
      (s) =>
        s.scene === "expedition-result" && !s.expeditionResult.presentation,
    );
    await observe(activity + "-award-ready");
    await settle();
    assert.equal((await state()).scene, "map");
    await observe(activity + "-map");
  }
  await depart(28, 264, 129);
  await until((s) => s.scene === "jungle");
  await observe("jungle-entry");
  const jungle = await readEasyJunglePlan(
    jungleCases.find((c) => c.variant === 2),
  );
  await play("jungle", jungle.stream);
  await depart(19, 158, 124);
  await until((s) => s.scene === "mountain");
  await observe("mountain-entry");
  const mountain = JSON.parse(await readFile("reference/mountain-ascent.json"));
  await play(
    "mountain",
    mountain.inputEvents.flatMap((e) => Array(e.count).fill(e.byte)),
  );

  for (const id of [9, 30, 21]) {
    // Original resource geometry in the declared BIOS0 startup permutation.
    // It chooses mouse coordinates only;it never initializes browser state.
    const destination = locations[id];
    assert.ok(destination && destination.flags & 8);
    await depart(id, destination.x, destination.y);
    await until((s) => s.scene === "cave");
    await observe("cave-entry-" + id);
    for (let move = 0; move < 48 && (await state()).scene === "cave"; move++) {
      const s = await until(
        (v) => v.scene !== "cave" || v.cave.phase === "exploring",
      );
      if (s.scene !== "cave") break;
      const live = s.cave,
        map = live.rooms.map((c) => c & ~16);
      map[live.room] |= 16;
      for (const room of [
        live.enemy,
        live.enemy - 8,
        live.enemy + 8,
        ...((live.enemy & 7) > 0 ? [live.enemy - 1] : []),
        ...((live.enemy & 7) < 7 ? [live.enemy + 1] : []),
      ])
        if (room >= 0 && room < 64) map[room] |= 64;
      let route;
      try {
        assert.ok(!(map[live.goal] & 64));
        route = planCaveVariant(map, s.briefing.variant);
      } catch {
        const narrow = live.rooms.map((c) => c & ~16);
        narrow[live.room] |= 16;
        narrow[live.enemy] |= 64;
        assert.notEqual(live.goal, live.enemy);
        route = planCaveVariant(narrow, s.briefing.variant);
      }
      const direction = route.events[1]?.controls.direction;
      assert.ok(direction);
      const key = {
        up: "ArrowUp",
        down: "ArrowDown",
        left: "ArrowLeft",
        right: "ArrowRight",
      }[direction];
      await page.keyboard.down(key);
      await page.keyboard.down("Space");
      await until((v) => v.scene !== "cave" || v.cave.room !== live.room);
      await page.keyboard.up("Space");
      await page.keyboard.up(key);
      await observe("cave-" + id + "-move-" + move);
      if (move === 47)
        assert.notEqual((await state()).scene, "cave", "Unfinished cave path");
    }
    await until((s) => s.scene !== "cave");
    assert.equal(
      (await state()).cave.outcome.code,
      1,
      "Authored cave path failed",
    );
    await observe("cave-" + id + "-award-entry");
    await until(
      (s) =>
        s.scene === "expedition-result" && !s.expeditionResult.presentation,
    );
    await observe("cave-" + id + "-award-ready");
    await settle();
  }
  async function finishBank() {
    if ((await state()).scene !== "bank") return;
    await observe("bank-" + (await state()).campaign.day);
    await page.keyboard.down("Space");
    await until((s) => s.scene !== "bank");
    await page.keyboard.up("Space");
    await settle();
  }
  async function bankTrip() {
    await confirmTarget(0, 212, 131);
    await settle();
    assert.ok(["bank", "ending"].includes((await state()).scene));
    await finishBank();
  }
  await bankTrip();
  for (let trip = 0; trip < 8 && (await state()).scene !== "ending"; trip++) {
    await page.locator("#back").click();
    await settle();
    await finishBank();
    if ((await state()).scene === "ending") break;
    await until((s) => s.scene === "office");
    await observe("office-return-" + trip);
    await page.locator("#map").click();
    await until((s) => s.scene !== "office" && s.scene !== "office-departure");
    await settle();
    await until((s) => s.scene === "map");
    await bankTrip();
  }
  const final = await until((s) => s.scene === "ending" && s.ending.ready);
  assert.equal(
    final.ending.won,
    true,
    "Authored strategy did not beat the rival",
  );
  await observe("winning-ending");
  await press("Space");
  await until((s) => s.ending.phase === "celebration" && s.ending.ready);
  await observe("winner-celebration");
  await press("Space");
  await until((s) => s.ending.phase === "replay" && s.ending.ready);
  await observe("replay-yes");
  await press("ArrowDown");
  await until((s) => s.ending.choice === 1 && s.ending.ready);
  await observe("replay-no");
  await press("Space");
  await until(
    (s) =>
      s.ending.phase === "credits" && s.ending.credit === -1 && s.ending.ready,
  );
  await observe("credits-title");
  for (let credit = 0; credit < 26; credit++) {
    await until(
      (s) =>
        s.ending.phase === "credits" &&
        s.ending.credit === credit &&
        s.ending.ready,
    );
    await observe("credit-" + credit);
  }
  await until((s) => s.ending.phase === "farewell" && s.ending.ready);
  await observe("farewell");
  await until((s) => s.ending.phase === "closed");
  await observe("closed");
  return state();
}
