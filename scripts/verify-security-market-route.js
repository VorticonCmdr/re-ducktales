import assert from "node:assert/strict";
import { originalGame } from "../tests/helpers/original-game.js";
import { Scheduler } from "../src/game/scheduler.js";
import manifest from "../reference/security-market-route.json" with { type: "json" };
const { game: g } = await originalGame(),
  clock = new Scheduler(g, 0);
function until(p, label) {
  for (let n = 0; n < 10000; n++) {
    if (p(g)) return;
    clock.advanceTo(clock.now + 8);
  }
  throw Error(`unfinished ${label}: ${JSON.stringify(g.snapshot())}`);
}
function input(type, extra = {}) {
  g.input({ type, ...extra });
}
until((g) => g.opening?.skipEnabled, "title");
input("fire");
until((g) => g.difficultyMenu?.ready, "difficulty");
input("fire");
until((g) => g.scene === "office", "office");
const checkpoints = [];
let securityVisits = 0;
for (let trip = 0; trip < 4; trip++) {
  input("map");
  until((g) => g.scene === "security" || g.scene === "map", "map entry");
  if (g.scene === "security") {
    assert.equal(trip, 0, "Security runs only on the first office map entry");
    securityVisits++;
    until((g) => g.security?.ready, "security");
    input("right");
    until((g) => g.security.selection === 1 && g.security.ready, "selection");
    input("fire");
    until((g) => g.scene === "map", "answer");
    assert.equal(g.seed, 46760);
  }
  input("point", { x: 212, y: 131 });
  input("fire");
  input("right");
  input("fire");
  until((g) => g.scene === "bank", "arrival");
  input("controls", { fire: true, direction: null });
  until((g) => g.scene === "map", "bank return");
  input("controls", { fire: false, direction: null });
  input("back");
  until((g) => g.scene === "office", "office return");
  assert.equal(g.campaign.day, 7 + trip * 6);
  checkpoints.push({ day: g.campaign.day, seed: g.seed });
}
input("investments");
until((g) => g.scene === "investments", "investments");
const news = [];
while (g.investments.phase === "news") {
  assert.ok(news.length < 15);
  news.push({
    company: g.investments.company,
    status: g.investments.newsStatus,
  });
  input("fire");
}
assert.equal(g.investments.phase, "portfolio");
assert.ok(news.length > 0);
assert.equal(securityVisits, 1, "Required security entry must execute");
assert.equal(checkpoints.length, manifest.expectedCheckpointCount);
assert.deepEqual(checkpoints, manifest.checkpoints);
assert.deepEqual(news, manifest.news);
input("back");
until((g) => g.scene === "office", "investment exit");
input("investments");
until((g) => g.scene === "investments", "investment reentry");
assert.equal(
  g.investments.phase,
  "portfolio",
  "Every bulletin remains consumed",
);
// Negative controls establish that each comparison rejects a wrong result.
const altered = structuredClone(checkpoints);
altered[0].seed ^= 1;
assert.throws(() => assert.deepEqual(altered, manifest.checkpoints));
assert.throws(() => assert.deepEqual(news.slice(1), manifest.news));
console.log(
  "Security market route:4 exact calendar/RNG checkpoints,3 ordered bulletins, consumed-news reentry and2 negative controls. Port regression only.",
);
