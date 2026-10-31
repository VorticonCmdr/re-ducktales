// Fresh current consumers of immutable historical inputs AND expected outputs.
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  fresh,
  json,
  spec,
  archiveSource,
  checkSource,
} from "./lib/local-scenario-source.js";
import {
  validateProducerArchive,
  validateHistoricalManifest,
  verifyProtected,
} from "./lib/consumer-provenance.js";
import { withRawBrowserPage } from "./lib/raw-browser-session.js";
import { runRecordedCampaign } from "../tests/browser/helpers/recorded-campaign.js";
import { replayAtomicRoute } from "./lib/atomic-route-browser.js";
import { replayCarlsbad } from "./lib/carlsbad-browser.js";
import { replayEasyMountain } from "./lib/easy-mountain-browser.js";
import { replayEasyJungle } from "./lib/easy-jungle-browser.js";
import { replaySafari } from "./lib/easy-safari-browser.js";
import { runCaveVariant } from "./lib/easy-cave-variants.js";
import { originalGame } from "../tests/helpers/original-game.js";
import { parseCaveMaps } from "../src/game/cave-scene.js";
const arg = (k) =>
    process.argv.find((s) => s.startsWith("--" + k + "="))?.slice(k.length + 3),
  out = await fresh(arg("output") ?? ".local/preserved-routes-" + Date.now()),
  source = await archiveSource(out),
  loaded = (p) =>
    p.startsWith("src/") ||
    p.startsWith("scripts/") ||
    p.startsWith("tests/") ||
    [
      "package.json",
      "package-lock.json",
      "index.html",
      "vite.config.js",
      "vite.campaign.config.js",
      "reference/build.json",
    ].includes(p);
const paths = [
  "reference/cave-composition-campaign.json",
  "reference/easy-cave-variants.json",
  "reference/easy-mountain-variants.json",
  "reference/easy-jungle-variants.json",
  "reference/easy-safari-variants.json",
  "reference/atomic-earned-route.json",
  "reference/atomic-earned-report.json",
];
let result;
try {
  const manifests = [],
    protectedFiles = {};
  for (const path of paths) {
    const r = await validateHistoricalManifest(path);
    manifests.push(r.manifest);
    Object.assign(protectedFiles, r.protectedFiles);
  }
  const [
    full,
    caves,
    mountains,
    jungles,
    safaris,
    atomicSuccess,
    atomicReport,
  ] = manifests;
  assert.equal(full.expectedCheckpointCount, 34);
  assert.equal(full.requiredEventCount, 4981);
  assert.equal(caves.componentCases, 8);
  assert.equal(caves.browserCheckpoints, 12);
  assert.equal(mountains.cases, 2);
  assert.equal(jungles.cases, 2);
  assert.equal(safaris.cases, 6);
  const producers = [];
  for (const m of manifests) {
    const root =
      m === full ? dirname(m.artifacts["producer-source"].path) : m.captureRoot;
    producers.push({
      root,
      commit: (await validateProducerArchive(root)).commit,
    });
  }
  await checkSource(out, loaded);
  const { image, archives } = await originalGame(),
    resources = {
      image,
      entries: archives.get("EXP.ARC"),
      font: archives.get("MAIN.ARC")[42].data,
      maps: parseCaveMaps(archives.get("CAVEMAPS.ARC")),
    };
  const inputs = await json(caves.captureRoot + "/component-inputs.json"),
    expected = await json(caves.captureRoot + "/component-checkpoints.json");
  assert.equal(inputs.length, 8);
  assert.equal(expected.length, 8);
  let componentPresentations = 0;
  for (let i = 0; i < 8; i++) {
    assert.equal(inputs[i].variant, i);
    componentPresentations += runCaveVariant(
      resources,
      inputs[i],
      expected[i],
    ).presentations;
  }
  assert.equal(componentPresentations, 2696);
  // Copy, never modify, historical files: diagnostic failure output belongs here.
  const headlessRoot = out + "/headless";
  await mkdir(headlessRoot);
  for (const n of [
    "environment",
    "captured-events",
    "campaign-checkpoints",
    "timeline",
  ])
    await copyFile(full.artifacts[n].path, headlessRoot + "/" + n + ".json");
  const h = spawnSync(
    process.execPath,
    ["scripts/replay-hard-campaign.js", headlessRoot, "--manifest=" + paths[0]],
    { encoding: "utf8", timeout: 660000, maxBuffer: 16 * 1024 * 1024 },
  );
  await writeFile(out + "/headless.log", (h.stdout ?? "") + (h.stderr ?? ""));
  assert.ifError(h.error);
  assert.equal(h.status, 0, "Current headless campaign failed");
  const headless = JSON.parse(h.stdout.trim().split("\n").at(-1));
  assert.equal(headless.checked, 34);
  assert.equal(headless.consumed, 4981);
  assert.equal(headless.rendered, 1470);
  console.log(
    "Preserved headless campaign:34 checkpoints,4981 events,1470 flight presentations",
  );
  const cases = [];
  await mkdir(out + "/full-browser");
  console.log("Replaying full Easy browser campaign");
  const main = await withRawBrowserPage(async (page) => {
    await runRecordedCampaign({
      page,
      info: { outputPath: (n) => join(out + "/full-browser", n) },
      manifest: full,
    });
    await page.locator("#restart").click();
    for (let i = 0; i < 20000; i++) {
      const s = JSON.parse(
        await page.locator("#game").getAttribute("data-state"),
      );
      assert.equal(s.diagnostic, null);
      if (s.scene === "title") {
        assert.equal(s.money, 0);
        assert.deepEqual(s.campaign.playerCollected, []);
        return { group: "full", checked: 34, consumed: 4981, restart: true };
      }
      await page.clock.runFor(8);
    }
    throw Error("Unfinished full campaign Restart");
  });
  cases.push(main);
  console.log("Replaying Carlsbad");
  const cr = caves.captureRoot;
  cases.push({
    group: "cave",
    ...(await replayCarlsbad(
      await json(cr + "/captured-events.json"),
      await json(cr + "/campaign-checkpoints.json"),
    )),
  });
  for (const [m, group, replay, milestone] of [
    [mountains, "mountain", replayEasyMountain, "mountain-ascent"],
    [jungles, "jungle", replayEasyJungle, "jungle-treasure"],
  ]) {
    const descriptions = await json(m.captureRoot + "/cases.json");
    assert.equal(descriptions.length, 2);
    for (const c of descriptions) {
      console.log("Replaying " + c.key);
      const artifacts = {};
      for (const n of [
        "environment",
        "captured-events",
        "campaign-checkpoints",
        "timeline",
      ])
        artifacts[n] = await spec(
          m.captureRoot + "/" + c.key + "/" + n + ".json",
        );
      const r = await replay(
        {
          milestone,
          artifacts,
          requiredEventCount: c.requiredEventCount,
          expectedCheckpointCount: c.expectedCheckpointCount,
          expectedOutcome: c.expectedOutcome,
        },
        out + "/" + c.key,
      );
      cases.push({ group, key: c.key, ...r });
    }
  }
  const safariCases = await json(safaris.captureRoot + "/cases.json");
  assert.deepEqual(
    safariCases.map((c) => c.variant),
    [1, 2, 3, 4, 5, 6],
  );
  for (const c of safariCases) {
    console.log("Replaying Safari" + c.variant);
    const root = safaris.captureRoot + "/" + c.variant;
    const r = await replaySafari(
      await json(root + "/captured-events.json"),
      await json(root + "/campaign-checkpoints.json"),
      c,
    );
    cases.push({
      group: "safari",
      variant: c.variant,
      completed: r.completed,
      checked: r.checked,
      consumed: r.consumed,
      restart: r.restart,
    });
  }
  for (const [m, report] of [
    [atomicSuccess, false],
    [atomicReport, true],
  ]) {
    assert.equal(m.expectedCheckpointCount, report ? 23 : 18);
    assert.equal(m.requiredEventCount, report ? 492 : 486);
    console.log(
      "Replaying preserved atomic " + (report ? "report" : "success"),
    );
    const r = await replayAtomicRoute(
      await json(m.inputStream),
      await json(m.expectedOutputs),
      { report },
    );
    cases.push({ group: report ? "atomic-report" : "atomic-success", ...r });
  }
  assert.equal(cases.length, 14);
  assert.equal(
    cases.reduce((n, c) => n + c.checked, 0),
    313,
  );
  assert.equal(
    cases.reduce((n, c) => n + c.consumed, 0),
    11095,
  );
  assert.ok(cases.every((c) => c.restart === true));
  await checkSource(out, loaded);
  await verifyProtected(protectedFiles);
  result = {
    completed: true,
    sourceCommit: source.commit,
    sourceFileCount: Object.keys(source.files).length,
    producerSources: producers,
    componentCases: 8,
    componentPresentations,
    headless: { checked: 34, consumed: 4981, rendered: 1470 },
    browserCases: cases,
    protectedFiles,
    scope:
      "Current implementation replayed immutable historical port inputs/expectations;separate producer and consumer archives;not native whole-game parity",
  };
  console.log(
    JSON.stringify({
      completed: true,
      browserCases: 14,
      checkpoints: 313,
      events: 11095,
      componentPresentations,
    }),
  );
} finally {
  await writeFile(
    out + "/result.json",
    JSON.stringify(
      result ?? {
        completed: false,
        error: "Required preserved-route check failed",
      },
      null,
      2,
    ) + "\n",
  );
}
