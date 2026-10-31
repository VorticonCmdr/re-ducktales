// Browser exploration from an independently recorded Standard startup prefix.
// No private state injection; capture is exploratory, not original parity.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { fresh, archiveSource, checkSource, json, checkArtifacts } from "./lib/local-scenario-source.js";
import { validateProducerArchive } from "./lib/consumer-provenance.js";
import { withCarlsbadBrowser } from "./lib/carlsbad-browser.js";
import { recordedDOMInput } from "../tests/browser/helpers/recorded-dom-input.js";
const arg = k => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const reason = arg("reason") ?? "player";
assert.ok(["player", "rival"].includes(reason));
const root = await fresh(arg("output")), source = await archiveSource(root);
const m = await json("reference/standard-wages-full-route.json");
await checkArtifacts(m.artifacts);
await validateProducerArchive(m.producer);
const checks = await json(m.artifacts["campaign-checkpoints"].path), events = await json(m.artifacts["captured-events"].path);
const entry = checks.find(c => c.name === "map-after-cave");
assert.ok(entry);
const result = await withCarlsbadBrowser(async ({page, canvas, state, until}) => {
  let now = 1;
  for (const e of events.slice(0, entry.eventCount)) {
    if (e.time > now) await page.clock.runFor(e.time - now);
    now = e.time;
    await recordedDOMInput(page, e);
  }
  await page.clock.runFor(entry.at - now);
  const before = await state();
  assert.equal(before.scene, "map");
  assert.deepEqual(before.campaign.playerCollected, [24]);
  assert.deepEqual(before.campaign.rivalCollected, [1]);
  const [x,y] = reason === "player" ? [240,70] : [64,73];
  const box = await canvas.boundingBox();
  await canvas.click({position:{x:box.width*x/320,y:box.height*y/200}});
  await page.keyboard.press("Space");
  await until(s => s.scene === "visit-notice");
  const entered = await state();
  assert.equal(entered.visitNotice.reason, reason);
  await page.keyboard.press("p");
  await page.clock.runFor(16);
  const earlyPause = await state();
  await until(s => !!s.systemOverlay);
  const paused = await state();
  await page.locator("#restart").click();
  await until(s=>s.scene === "title");
  return {completed:true,accepted:false,reason,before,entered,earlyPause,paused,restart:true,sourceCommit:source.commit};
});
await checkSource(root,p=>p.startsWith("src/")||p.startsWith("scripts/")||p.startsWith("tests/"));
await writeFile(root+"/notice-exploration.json",JSON.stringify(result,null,2)+"\n");
console.log(JSON.stringify({reason,completed:true,earlyPause:result.earlyPause.systemOverlay,entered:result.entered.visitNotice}));
