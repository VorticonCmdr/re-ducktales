import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { PNG } from "pngjs";
import catalog from "../reference/security-hard-expeditions.json" with { type: "json" };
const hash = (b) => createHash("sha256").update(b).digest("hex");
const canonical = (v) =>
  JSON.stringify(v, (_, x) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(
          Object.keys(x)
            .sort()
            .map((k) => [k, x[k]]),
        )
      : x,
  );
const load = (p) =>
  readFile(p).catch(() => {
    throw Error(`SETUP: missing Hard expedition artifact ${p}`);
  });
const json = async (p) => JSON.parse(await load(p));
assert.equal(catalog.pending, false);
assert.equal(catalog.browserVerified, true);
assert.equal(catalog.expectedCaseCount, 4);
assert.equal(catalog.expectedFullCheckpointCount, 169);
assert.equal(catalog.expectedEventCount, 3970);
assert.equal(
  Object.keys(catalog.artifacts).length,
  53,
  "Missing required evidence",
);
assert.deepEqual(
  catalog.cases.map((c) => c.key),
  ["bermuda", "boola", "thunderclap", "machu"],
);
assert.equal(
  hash(await load(catalog.buildManifest)),
  catalog.buildManifestSha256,
);
for (const [name, spec] of Object.entries(catalog.artifacts)) {
  const b = await load(spec.path);
  assert.equal(b.length, spec.bytes, name);
  assert.equal(hash(b), spec.sha256, `Corrupt ${name}`);
}
for (const [p, h] of Object.entries(catalog.verificationTools))
  assert.equal(hash(await load(p)), h, `Changed verifier ${p}`);
for (const [name, commit, archive, count] of [
  [
    "capture-source",
    catalog.captureCommit,
    `${catalog.captureRoot}/sources`,
    152,
  ],
  [
    "browser-source",
    catalog.browserCommit,
    `${catalog.artifactRoot}/browser-sources`,
    153,
  ],
  [
    "entry-capture-source",
    catalog.entryCaptureCommit,
    `${catalog.entryCaptureRoot}/sources`,
    141,
  ],
  [
    "entry-browser-source",
    catalog.entryBrowserCommit,
    `${catalog.entryArtifactRoot}/browser-sources`,
    88,
  ],
]) {
  const producer = await json(catalog.artifacts[name].path);
  assert.equal(producer.captureCommit ?? producer.browserCommit, commit);
  assert.equal(Object.keys(producer.files).length, count);
  for (const [p, h] of Object.entries(producer.files)) {
    assert.equal(hash(await load(`${archive}/${p}`)), h, p);
    assert.equal(hash(execFileSync("git", ["show", `${commit}:${p}`])), h, p);
  }
}
function report(r, count) {
  assert.deepEqual(r.errors, []);
  assert.equal(r.stats.expected, count);
  for (const k of ["unexpected", "skipped", "flaky"])
    assert.equal(r.stats[k], 0);
  const tests = [];
  function visit(s) {
    for (const spec of s.specs ?? []) tests.push(...spec.tests);
    for (const child of s.suites ?? []) visit(child);
  }
  r.suites.forEach(visit);
  assert.equal(tests.length, count);
  for (const t of tests) {
    assert.equal(t.status, "expected");
    assert.equal(t.results.length, 1);
    assert.equal(t.results[0].status, "passed");
  }
}
report(await json(catalog.artifacts["browser-results"].path), 8);
report(await json(catalog.artifacts["entry-browser-results"].path), 4);
const hardSource = await json(catalog.artifacts["shared-hard-source"].path);
assert.equal(hardSource.commit, catalog.sharedHardCommit);
assert.equal(Object.keys(hardSource.files).length, 266);
for (const [p, h] of Object.entries(hardSource.files)) {
  assert.equal(
    hash(await load(`${catalog.artifactRoot}/shared-hard-sources/${p}`)),
    h,
    p,
  );
  assert.equal(
    hash(execFileSync("git", ["show", `${hardSource.commit}:${p}`])),
    h,
    p,
  );
}
report(await json(catalog.artifacts["shared-hard-results"].path), 1);
const hardReference = await json("reference/hard-campaign-security.json");
const hardObserved = await json(
  catalog.artifacts["shared-hard-checkpoints"].path,
);
assert.equal(hardObserved.length, 28);
for (let i = 0; i < 28; i++)
  for (const k of ["name", "stateSha256", "pixelsSha256"])
    assert.equal(
      hardObserved[i][k],
      hardReference.browserCheckpoints[i][k],
      `Shared Hard checkpoint${i} ${k}`,
    );
const hardProgress = await json(catalog.artifacts["shared-hard-progress"].path);
assert.equal(hardProgress.completed, true);
assert.equal(hardProgress.consumed, 4140);
assert.deepEqual(hardProgress.errors, []);
assert.equal(hardProgress.navigation.length, 1);
assert.equal(
  (await json(catalog.artifacts["shared-hard-events"].path)).length,
  4140,
);
const inputCatalog = await json(catalog.artifacts["input-profile"].path);
assert.equal(inputCatalog.cases.length, 4);
const root = ".local/security-hard-expeditions-verification";
await mkdir(root, { recursive: true });
let checked = 0,
  consumed = 0,
  rendered = 0;
for (const row of catalog.cases) {
  const physicalNegative = (
    await load(catalog.artifacts[`negative-${row.key}`].path)
  ).toString();
  assert.match(
    physicalNegative,
    /Error: Carried browser state\d+ input-\d+|Error: Recorded external event sequence/,
  );
  assert.match(physicalNegative, /1 failed/);
  assert.doesNotMatch(
    physicalNegative,
    /SETUP:|ENOENT|No tests found|Test timeout|TimeoutError|browserType\.launch:|Test was interrupted|ETIMEDOUT|Channel closed/,
  );
  const m = await json(catalog.artifacts[`manifest-${row.key}`].path),
    inputs = inputCatalog.cases.find((c) => c.key === row.key);
  assert.equal(m.pending, false);
  assert.equal(m.browserVerified, true);
  assert.equal(m.milestone, "hard-expedition-bank");
  assert.equal(m.expectedHard, true);
  assert.equal(m.key, row.key);
  assert.equal(m.expectedInputCount, row.expectedInputs);
  assert.equal(m.expectedCheckpointCount, row.expectedCheckpoints);
  assert.equal(m.requiredEventCount, row.expectedEvents);
  assert.equal(m.captureCommit, catalog.captureCommit);
  assert.equal(m.expectedOutcome.lives, 3);
  assert.equal(m.expectedOutcome.money, 0);
  assert.equal(m.expectedOutcome.day, 6);
  assert.equal(m.expectedOutcome.banked, row.expectedDeposit);
  assert.equal(
    Object.keys(m.artifacts).length,
    m.expectedCheckpointCount + 6,
    "Missing required case evidence",
  );
  for (const [name, spec] of Object.entries(m.artifacts)) {
    const b = await load(spec.path);
    assert.equal(b.length, spec.bytes, `${row.key} ${name}`);
    assert.equal(hash(b), spec.sha256, `Corrupt ${row.key} ${name}`);
  }
  for (const name of ["captured-events", "campaign-checkpoints", "timeline"])
    assert.equal(
      hash(await load(`${m.captureRoot}/${name}.json`)),
      m.artifacts[name].sha256,
      `Changed captured ${row.key} ${name}`,
    );
  const codes = inputs.inputEvents.flatMap(({ byte, count }) => {
    assert.ok(
      Number.isInteger(count) && count > 0 && count <= inputs.inputCount,
    );
    assert.ok([0, 1, 3, 5, 7, 64, 65, 67, 69, 71].includes(byte));
    return Array(count).fill(byte);
  });
  assert.equal(codes.length, row.expectedInputs);
  assert.equal(hash(Buffer.from(codes)), inputs.sha256);
  const legacy = await load(inputs.legacyInputs);
  assert.equal(hash(legacy), inputs.legacyInputSha256);
  assert.deepEqual(codes, [
    ...Array(inputs.authoredNeutralPrefix).fill(0),
    ...JSON.parse(legacy)[inputs.activity].flatMap((e) =>
      Array(e.count).fill(e.byte),
    ),
  ]);
  assert.equal(inputs.authoredNeutralPrefix, row.key === "bermuda" ? 3 : 0);
  const checks = await json(m.artifacts["campaign-checkpoints"].path);
  assert.equal(checks.length, row.expectedCheckpoints);
  let n = 0;
  const boundaries = new Set();
  for (const r of inputs.inputEvents) {
    n += r.count;
    boundaries.add(n);
  }
  const expectedNames = [
    "entry",
    ...Array.from({ length: inputs.inputCount }, (_, i) => i + 1)
      .filter((i) => i % 40 === 0 || boundaries.has(i))
      .map((i) => `input-${i}`),
    "award",
    "returned-map",
    "bank",
    "deposited",
  ];
  assert.deepEqual(
    checks.map((c) => c.name),
    expectedNames,
  );
  for (const c of checks) {
    assert.equal(
      hash(canonical(c.state)),
      c.stateSha256,
      `${row.key} ${c.name}`,
    );
    const png = PNG.sync.read(await load(m.artifacts[`png-${c.name}`].path));
    assert.deepEqual([png.width, png.height], [320, 200]);
    assert.equal(hash(png.data), c.pixelsSha256);
  }
  assert.equal(
    hash(await load(inputs.entryManifest)),
    catalog.artifacts[`entry-manifest-${row.key}`].sha256,
  );
  const entry = await json(inputs.entryManifest),
    entryChecks = await json(entry.artifacts["campaign-checkpoints"].path);
  assert.equal(
    hash(
      PNG.sync.read(await load(catalog.artifacts[`entry-png-${row.key}`].path))
        .data,
    ),
    checks[0].pixelsSha256,
  );
  for (const k of ["at", "eventCount", "stateSha256", "pixelsSha256"])
    assert.equal(
      checks[0][k],
      entryChecks[0][k],
      `${row.key} independent entry ${k}`,
    );
  assert.equal(checks[0].state.briefing.variant, inputs.variant);
  assert.equal(checks[0].state[inputs.activity].lives, 3);
  assert.equal(checks[0].state.flight.outcome.code, 1);
  function compare(points) {
    assert.equal(
      points.length,
      row.expectedCheckpoints,
      "Missing browser checkpoints",
    );
    for (let i = 0; i < points.length; i++)
      for (const k of [
        "name",
        "at",
        "eventCount",
        "stateSha256",
        "pixelsSha256",
      ])
        assert.deepEqual(
          points[i][k],
          m.checkpoints[i][k],
          `${row.key} browser checkpoint${i} ${k}`,
        );
  }
  const browser = await json(
    catalog.artifacts[`${row.key}-browser-checkpoints`].path,
  );
  compare(browser);
  const altered = structuredClone(browser);
  altered[0].pixelsSha256 = "0".repeat(64);
  assert.throws(() => compare(altered), /browser checkpoint0 pixelsSha256/);
  assert.throws(() => compare(browser.slice(1)), /Missing browser checkpoints/);
  const progress = await json(
    catalog.artifacts[`${row.key}-browser-progress`].path,
  );
  assert.equal(progress.completed, true);
  assert.equal(progress.consumed, row.expectedEvents);
  assert.equal(progress.expectedEvents, row.expectedEvents);
  assert.deepEqual(progress.errors, []);
  assert.equal(progress.navigation.length, 1);
  assert.equal(
    (await json(catalog.artifacts[`${row.key}-browser-events`].path)).length,
    row.expectedEvents,
  );
  const entryProgress = await json(
    catalog.artifacts[`${row.key}-entry-progress`].path,
  );
  assert.equal(entryProgress.completed, true);
  assert.equal(entryProgress.consumed, 954);
  assert.deepEqual(entryProgress.errors, []);
  const entryBrowser = await json(
    catalog.artifacts[`${row.key}-entry-checkpoints`].path,
  );
  assert.equal(entryBrowser.length, 1);
  assert.equal(entryBrowser[0].stateSha256, checks[0].stateSha256);
  assert.equal(entryBrowser[0].pixelsSha256, checks[0].pixelsSha256);
  assert.equal(
    (await json(catalog.artifacts[`${row.key}-entry-events`].path)).length,
    954,
  );
  function replay(mode) {
    const r = spawnSync(
      process.execPath,
      [
        "scripts/replay-hard-campaign.js",
        m.artifactRoot,
        `--manifest=${row.manifest}`,
        ...(mode ? [`--negative=${mode}`] : []),
      ],
      { encoding: "utf8", timeout: 60000, maxBuffer: 8 * 1024 * 1024 },
    );
    assert.ifError(r.error);
    return { ...r, output: r.stdout + "\n" + r.stderr };
  }
  const positive = replay();
  await writeFile(`${root}/${row.key}-positive.log`, positive.output);
  assert.equal(positive.status, 0, positive.output);
  const result = JSON.parse(positive.stdout);
  assert.equal(result.mode, "recorded-input replay");
  assert.equal(result.checked, row.expectedCheckpoints);
  assert.equal(result.consumed, row.expectedEvents);
  assert.equal(result.rendered, 396);
  assert.equal(result.flagAliasPresentations, 0);
  assert.deepEqual(result.heldAtExploratoryEndpoint, []);
  const s = result.state,
    a = s[inputs.activity];
  assert.deepEqual(
    {
      money: s.money,
      banked: s.campaign.banked,
      day: s.campaign.day,
      playerCollected: s.campaign.playerCollected,
      ...Object.fromEntries(
        ["frames", "presentations", "lives", "seed"].map((k) => [k, a[k]]),
      ),
    },
    m.expectedOutcome,
  );
  for (const [mode, reason] of [
    [
      "wrong-security",
      /Unsupported security input map|Carried replay checkpoint0 entry/,
    ],
    ["alter-checkpoint", /Carried replay checkpoint0 entry/],
    ["omit-checkpoint", /Missing required checkpoints/],
  ]) {
    const r = replay(mode);
    await writeFile(`${root}/${row.key}-${mode}.log`, r.output);
    assert.equal(r.status, 1, mode);
    assert.match(r.output, reason);
    assert.doesNotMatch(r.output, /SETUP:|ENOENT|Cannot find module|Timed out/);
  }
  checked += result.checked;
  consumed += result.consumed;
  rendered += result.rendered;
}
assert.equal(checked, 169);
assert.equal(consumed, 3970);
assert.equal(rendered, 1584);
console.log(
  "Hard alternates:4 complete treasure/bank routes,169 exact Game/browser state-pixel checkpoints,3970 DOM events,1584 flight presentations,three lives in every route;24 comparison negatives. Four independent entry browser replays and full Hard28/4140 regression also pass. Port evidence,not whole-native expedition parity.",
);
