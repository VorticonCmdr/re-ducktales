// Independent browser acceptance for all original Safari resource variants.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { originalGame } from "../tests/helpers/original-game.js";
import {
  safariCases,
  safariNames,
  photoScore,
  captureSafari,
  replaySafari,
} from "./lib/easy-safari-browser.js";
import {
  json,
  spec,
  fresh,
  archiveSource,
  checkSource,
  inventory,
  checkArtifacts,
} from "./lib/local-scenario-source.js";
const mode = process.argv[2] ?? "verify",
  arg = (k) =>
    process.argv.find((s) => s.startsWith("--" + k + "="))?.slice(k.length + 3),
  write = async (p, v) => writeFile(p, JSON.stringify(v, null, 2) + "\n");
const loaded = (p) =>
  p.startsWith("src/") ||
  p.startsWith("tests/browser/helpers/") ||
  [
    "scripts/easy-safari-variants.js",
    "scripts/lib/easy-safari-browser.js",
    "scripts/lib/carlsbad-browser.js",
    "scripts/lib/local-scenario-source.js",
    "tests/helpers/original-game.js",
    "reference/build.json",
    "package.json",
    "package-lock.json",
    "index.html",
    "vite.config.js",
    "vite.campaign.config.js",
  ].includes(p);
const names = [
  "source-revision.json",
  "sources.zip",
  "cases.json",
  "capture-status.json",
  ...safariCases.flatMap((c) =>
    [
      "captured-events.json",
      "campaign-checkpoints.json",
      "environment.json",
      "timeline.json",
    ].map((n) => c.variant + "/" + n),
  ),
];
async function validateCatalogue() {
  const { game } = await originalGame();
  assert.equal(safariCases.length, 6);
  for (const c of safariCases) {
    const l = game.campaign.locations[c.location];
    assert.deepEqual(
      {
        variant: l.flags >>> 4,
        asset: l.asset,
        location: c.location,
        x: l.x,
        y: l.y,
        name: l.name,
      },
      c,
    );
    assert.equal(l.flags & 15, 4);
  }
}
async function validateCaptures(root, cases) {
  assert.deepEqual(
    cases.map((c) => c.variant),
    [1, 2, 3, 4, 5, 6],
  );
  for (const c of cases) {
    const plan = safariCases[c.variant - 1];
    assert.equal(c.completed, true);
    assert.equal(c.accepted, false);
    assert.equal(c.restart, true);
    assert.ok(c.events > 0);
    assert.equal(c.photos.length, 12);
    assert.ok(c.score >= 500);
    assert.equal(c.score, photoScore(c.photos, c.final.target));
    assert.ok(c.photos.includes(c.final.target));
    const checks = await json(
        root + "/" + c.variant + "/campaign-checkpoints.json",
      ),
      events = await json(root + "/" + c.variant + "/captured-events.json"),
      timeline = await json(root + "/" + c.variant + "/timeline.json"),
      env = await json(root + "/" + c.variant + "/environment.json");
    assert.deepEqual(
      checks.map((p) => p.name),
      safariNames(c.attempts),
    );
    assert.equal(checks.length, c.checkpoints);
    assert.equal(events.length, c.events);
    assert.equal(checks.at(-1).eventCount, events.length);
    assert.deepEqual(
      timeline.observations,
      checks.map(({ name, at, eventCount }) => ({ name, at, eventCount })),
    );
    assert.equal(timeline.endAt, checks.at(-1).at);
    assert.equal(env.completed, true);
    assert.equal(env.hard, false);
    assert.equal(env.clockOrigin, 1);
    assert.equal(env.displayMilliseconds, 8);
    for (let i = 0; i < events.length; i++) {
      assert.ok(
        Number.isFinite(events[i].time) &&
          events[i].time >= 1 &&
          events[i].time <= timeline.endAt,
      );
      if (i) assert.ok(events[i].time >= events[i - 1].time);
    }
    const entry = checks[2].state,
      exhausted = checks.find((p) => p.name === "film-exhausted").state,
      results = checks.find((p) => p.name === "results").state,
      map = checks.at(-1).state;
    assert.equal(entry.difficulty, 0);
    assert.equal(entry.briefing.variant, c.variant);
    assert.equal(entry.campaign.location, plan.location);
    assert.equal(entry.expeditionKeys.mode, 1);
    assert.equal(entry.flight.outcome.code, 1);
    assert.equal(exhausted.photography.photoCount, 12);
    assert.equal(exhausted.photography.film, -1);
    assert.deepEqual(exhausted.photography.photos, c.photos);
    assert.equal(results.photography.score, c.score);
    assert.equal(map.scene, "map");
    assert.equal(map.money, entry.money + c.score);
    assert.equal(map.campaign.day, entry.campaign.day + 2);
    assert.deepEqual(map.campaign.playerCollected, [plan.location]);
    assert.equal(map.photography.outcome.code, 1);
    assert.equal(map.photography.score, 0);
    assert.equal(map.photography.outcome.score, c.score);
    assert.equal(c.final.money, map.money);
    assert.equal(c.final.day, map.campaign.day);
    assert.equal(c.final.location, plan.location);
    assert.equal(c.final.target, entry.photography.target);
  }
}
if (mode === "capture") {
  const root = await fresh(arg("output")),
    source = await archiveSource(root);
  await validateCatalogue();
  const cases = [];
  for (const c of safariCases) {
    console.log("Capturing Safari" + c.variant + " " + c.name);
    cases.push(await captureSafari(root + "/" + c.variant, c));
  }
  await write(root + "/cases.json", cases);
  await validateCaptures(root, cases);
  await checkSource(root, loaded);
  await write(root + "/capture-status.json", {
    completed: true,
    accepted: false,
    cases: 6,
    sourceCommit: source.commit,
    scope: "Exploratory complete browser routes;independent replay required",
  });
  console.log("EXPLORATORY Safari capture complete;not acceptance: " + root);
  process.exitCode = 1;
} else if (mode === "verify") {
  let root = arg("capture");
  if (!root) {
    const m = await json(
      arg("manifest") ?? "reference/easy-safari-variants.json",
    );
    assert.equal(m.id, "easy-all-safari-variants");
    assert.equal(m.accepted, true);
    assert.equal(m.cases, 6);
    await checkArtifacts(m.artifacts);
    await checkArtifacts({ build: m.build.manifest });
    assert.deepEqual(m.build.files, (await json("reference/build.json")).files);
    root = m.captureRoot;
  }
  const out = await fresh(
    arg("output") ?? ".local/easy-safari-replay-" + Date.now(),
  );
  let result;
  try {
    const source = await checkSource(root, loaded),
      before = await inventory(root, names),
      status = await json(root + "/capture-status.json"),
      cases = await json(root + "/cases.json");
    assert.equal(status.completed, true);
    assert.equal(status.accepted, false);
    assert.equal(status.cases, 6);
    assert.equal(status.sourceCommit, source.commit);
    await validateCatalogue();
    await validateCaptures(root, cases);
    const results = [];
    for (const c of cases) {
      console.log("Replaying Safari" + c.variant);
      const events = await json(
          root + "/" + c.variant + "/captured-events.json",
        ),
        checks = await json(
          root + "/" + c.variant + "/campaign-checkpoints.json",
        );
      let failure;
      await assert.rejects(
        () => replaySafari(events, checks, c, true),
        (e) => {
          assert.match(e.message, /Safari state photo-1/);
          assert.match(e.actual, /^[a-f0-9]{64}$/);
          assert.match(e.expected, /^[a-f0-9]{64}$/);
          assert.notEqual(e.actual, e.expected);
          failure = {
            checkpoint: "photo-1",
            actualStateSha256: e.actual,
            expectedStateSha256: e.expected,
          };
          return true;
        },
      );
      const positive = await replaySafari(events, checks, c);
      assert.equal(positive.observed.length, c.checkpoints);
      results.push({ ...positive, negativeControls: 1, negative: failure });
    }
    assert.equal(results.length, 6);
    await checkSource(root, loaded);
    assert.deepEqual(
      await inventory(root, names),
      before,
      "Capture mutated during replay",
    );
    result = {
      completed: true,
      cases: results,
      sourceCommit: source.commit,
      captureRoot: root,
      captureInventory: before,
      scope:
        "Independent port browser acceptance of all six Easy Safari variants;not native whole-route/cadence or other difficulties",
    };
    console.log(
      JSON.stringify({
        completed: true,
        cases: results.map(
          ({ variant, checked, consumed, restart, negativeControls }) => ({
            variant,
            checked,
            consumed,
            restart,
            negativeControls,
          }),
        ),
      }),
    );
  } finally {
    await write(
      out + "/result.json",
      result ?? { completed: false, error: "Required check failed" },
    );
  }
} else if (mode === "register") {
  const root = arg("capture"),
    replay = arg("replay"),
    target = arg("manifest");
  assert.ok(root && replay && target);
  const result = await json(replay + "/result.json"),
    source = await checkSource(root, loaded);
  assert.equal(result.completed, true);
  assert.equal(result.sourceCommit, source.commit);
  assert.equal(result.captureRoot, root);
  assert.deepEqual(
    result.cases.map((c) => c.variant),
    [1, 2, 3, 4, 5, 6],
  );
  const cases = await json(root + "/cases.json");
  await validateCaptures(root, cases);
  for (const c of result.cases) {
    const expected = cases[c.variant - 1];
    assert.equal(c.completed, true);
    assert.equal(c.restart, true);
    assert.equal(c.negativeControls, 1);
    assert.equal(c.checked, expected.checkpoints);
    assert.equal(c.consumed, expected.events);
    assert.equal(c.observed.length, c.checked);
    assert.equal(c.negative.checkpoint, "photo-1");
    assert.notEqual(
      c.negative.actualStateSha256,
      c.negative.expectedStateSha256,
    );
  }
  const artifacts = await inventory(root, names);
  assert.deepEqual(
    result.captureInventory,
    artifacts,
    "Replay/capture pairing changed",
  );
  artifacts.replay = await spec(replay + "/result.json");
  await writeFile(
    target,
    JSON.stringify(
      {
        id: "easy-all-safari-variants",
        accepted: true,
        cases: 6,
        captureRoot: root,
        sourceCommit: source.commit,
        artifacts,
        build: {
          manifest: await spec("reference/build.json"),
          files: (await json("reference/build.json")).files,
        },
        checkpoints: cases.map((c) => ({
          variant: c.variant,
          count: c.checkpoints,
          events: c.events,
          score: c.score,
        })),
        environment: {
          difficulty: 0,
          biosSeed: 0,
          audioEnabled: false,
          timezone: "UTC",
          clockOrigin: 1,
          displayMilliseconds: 8,
          repeatProvider: {
            initialDelayMilliseconds: 250,
            intervalMilliseconds: 32,
            scope:
              "authored external makes while consuming remaining film;not native typematic evidence",
          },
        },
        injections: [],
        fittedInputs: [],
        partialRestore: false,
        scope: result.scope,
        verify: "node scripts/easy-safari-variants.js verify",
      },
      null,
      2,
    ) + "\n",
    { flag: "wx" },
  );
  console.log("Registered all six Easy Safari browser variants");
} else throw Error("Unsupported Safari command " + mode);
