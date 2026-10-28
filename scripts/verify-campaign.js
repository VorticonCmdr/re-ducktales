import {
  bankResources,
  advanceBankToReturn,
} from "../tests/helpers/bank-fixture.js";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { Game } from "../src/game/application.js";
import { parseArchive } from "../src/assets.js";
import { parseLocations } from "../src/game/campaign.js";
export const CAMPAIGN_INPUTS = [
  { type: "fire" },
  { type: "fire" },
  { type: "map" },
  { type: "point", x: 212, y: 131 },
  { type: "fire" },
  { type: "right" },
  { type: "fire" },
  { type: "controls", fire: true, direction: null },
  { type: "controls", fire: false, direction: null },
  { type: "point", x: 46, y: 139 },
  { type: "fire" },
];
export function compareCampaign(
  fixture,
  locations,
  { dropDeparture = false, alterResult = false, inputs = CAMPAIGN_INPUTS } = {},
) {
  assert.equal(
    fixture.checkpoints.length,
    3,
    "incomplete original campaign checkpoints",
  );
  const g = new Game({ locations, bankResources });
  let consumed = 0,
    executed = 0;
  assert.deepEqual(
    inputs,
    CAMPAIGN_INPUTS,
    "unexpected campaign input schedule",
  );
  for (const [i, event] of inputs.slice(0, 7).entries()) {
    if (dropDeparture && i === 6) continue;
    g.input(event);
    consumed++;
  }
  function compare(index) {
    const raw = fixture.checkpoints[index];
    assert.equal(raw.isError, false);
    const parsed = JSON.parse(raw.content[0].text);
    assert.equal(parsed.aborted, false);
    assert.equal(parsed.results.length, 5);
    const values = parsed.results.map((r, i) => {
      assert.equal(r.status, "ok");
      const b = Buffer.from(r.data, "base64");
      assert.equal(b.length, [1, 1, 4, 4, 2][i]);
      return b.readUIntLE(0, b.length);
    });
    if (alterResult && index === 0) values[0]++;
    assert.deepEqual(
      [
        g.campaign.day,
        g.campaign.location,
        g.money,
        g.campaign.banked,
        Number(g.rareCoinTaken),
      ],
      values,
      `campaign divergence ${index}`,
    );
    executed++;
  }
  compare(0);
  g.input(inputs[7]);
  consumed++;
  advanceBankToReturn(g);
  g.input(inputs[8]);
  consumed++;
  compare(1);
  for (const event of inputs.slice(9)) {
    g.input(event);
    consumed++;
  }
  compare(2);
  assert.equal(consumed, 11, "unconsumed campaign inputs");
  assert.equal(executed, 3);
  assert.equal(g.scene, "office");
  return executed;
}
export async function verifyCampaign() {
  const m = JSON.parse(await readFile("reference/campaign-bank.json", "utf8"));
  for (const a of Object.values(m.artifacts)) {
    const bytes = await readFile(a.path).catch(() => {
      throw Error(
        `SETUP: missing campaign artifact ${a.path}; see docs/campaign-travel.md`,
      );
    });
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      a.sha256,
      `corrupt campaign artifact ${a.path}`,
    );
  }
  assert.equal(m.inputs.length, 11, "unfinished campaign input schedule");
  assert.equal(m.expectedCheckpointCount, 3);
  const fixture = JSON.parse(await readFile(m.artifacts.trace.path, "utf8"));
  const locations = parseLocations(
    parseArchive(await readFile("game/LOC.ARC")),
  );
  assert.equal(
    compareCampaign(fixture, locations, { inputs: m.inputs }),
    m.expectedCheckpointCount,
  );
  assert.throws(
    () => compareCampaign(fixture, locations, { dropDeparture: true }),
    /campaign divergence/,
  );
  assert.throws(
    () => compareCampaign(fixture, locations, { alterResult: true }),
    /campaign divergence/,
  );
  console.log(
    "Campaign: 3 exact original state checkpoints; 2 negative controls rejected.",
  );
}
if (process.argv[1]?.endsWith("verify-campaign.js")) await verifyCampaign();
