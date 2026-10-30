# Current port status

Updated2026-10-30. **The whole game remains incomplete. This is completion work,
not only fine-tuning.** A complete Easy route works;Hard campaigns,arbitrary-route
finishability and full original-game parity remain unproven.

## Working gameplay and current verification

HTML/CSS/vanilla JavaScript with npm/Vite connects office/security,map and
transport selection,departures,flight,all four expedition families,rewards,
rival reports,banking and the campaign endings. Originals remain authoritative
in ignored `game/`;production visitors select their own files. Nothing has been
pushed or deployed.

The current physical-keyboard Easy route runs from startup through jungle,
Safari,cave and mountain,then wins on day31 with$14,550 banked against$12,500.
It collects locations1/30/31/32,retains all three mountain lives,and restarts to a
fresh game. Independent simulation matches34 full states and1,470 flight
presentations. Actual-browser replay matches every state and320x200 pixel digest
from4,981 DOM events.

**`npm run verify:current-campaign` passes from clean commit`79e2bb0`.** The gate
includes22 exact original identities,177 unit cases with zero failures/skips,
one complete actual-browser route and restart,six campaign negative controls,
seven cave reveal source/mechanism controls,and the production build. All834
protected historical artifacts remain unchanged. The713-file source archive and
15 evidence artifacts are pinned by the[clean receipt](../reference/cave-reveal-campaign-integration.json).
[Scenario and limits](cave-reveal-campaign.md).

The first cave treasure presentation now uses the original striped copy:five
row groups,five retraces per group,and unchanged page roles. All fifteen
party/RNG draws remain. [Reveal evidence](cave-reveal.md). The new full campaign
records34 checkpoints;the historical35-point producer recorded the identical
mountain-entry boundary twice. No unique boundary is omitted. Historical
captures,expectations and[earlier clean receipt](../reference/current-physical-campaign-integration.json)
remain intact.

## Hard campaign and remaining gameplay coverage

The actual-browser Hard route wins the opening race,obtains jungle treasure
with all three lives,and banks$2,250. Diagnostic startup replay matches all12
checkpoints/781 events through that deposit. The longer capture loses the second
flight race to Safari at294 updates. Read-only investigation identifies falling
cargo at tile4/read49,then its associated body at read56. The default model
reproduces the browser's entire final state exactly;additional player strategies
still lose. This is not established as a port-mechanic defect or a complete Hard
acceptance result. [Current Hard evidence](current-hard-campaign.md).

Next:continue Hard coverage,including recovery after a legitimate race loss and
other available destinations. Require a full independent input replay and actual
browser acceptance before calling a Hard route complete. Continue targeted
original timing,input and audio work alongside that coverage.

## Restored security and sound

The unchecked **Original security system** option restores the surviving failure
path and logs the correct code once per challenge. Default play retains this
executable's forced success. This is static restoration from the patched build,
not comparison with an independently obtained unpatched edition. [Evidence](security.md#optional-restoration).

Tandy/PCjr includes Sound001,persistent channels,priorities,flight engine words,
mute and completion;all121 public requests have viewer playback. Speaker remains
the default;its noise is approximate and its flight-engine rendition is omitted.
Physical waveform/gain/filter parity remains open. [Audio](audio.md).

## Known gaps and verification limits

- Original whole-game cadence is unverified. Mountain copy/text/line and remaining
  CPU/device costs are omitted;jungle still omits line/text/remaining CPU costs.
  Cave omits minimap fills,room composition,copies outside the party helper and
  remaining CPU/device work. Safari omits HUD line/text,result-sheet drawing and
  remaining CPU/device costs. Native whole-reveal timing also remains open.
- Destination entry-page drawing,selector lines/numeric text,other CPU/device
  costs,and exact video/cache phase alignment remain partial. Neutral polling,
  source flush/read ordering and deferred system-key polling are implemented.
- Complete cross-scene queued physical keyboard delivery and remaining
  system/modifier/BIOS behavior are incomplete. Mouse/joystick parity and
  broader difficulty/destination coverage remain separate work.
- The broader **`npm run verify` is not green**:historical shared-runtime/source
  inventories and older receipts require current regressions. The focused Easy
  gate does not waive them. [Historical campaign evidence](current-campaign.md).
- Native coverage of nonzero bank/sparkle pixels and unusual sprite aliases is
  limited. BIOS seed0 is an explicit browser provider;original time-of-day
  seeding is pending. Original save/load/high-score behavior/formats have not
  been established;browser persistence would be an explicit addition.

## Supported build and commands

Only the22-file executable/resource pairing in[build.json](../reference/build.json)
is supported. `DUCKTALE.EXE` SHA-256:
`fb658562b480ccf75a9dd0a7344c9ae74737e2ca651c0a09dc546928f612a981`.
MZ/EXEPACK,x86 LE16 real mode,overlays,no extender. Actual relocated game bytes
and native address correspondence were checked;the analysis image is never run.
No native emulator state changed during the current campaign/reveal work.

```sh
npm run verify:current-campaign
# Same focused gate,explicit name:
npm run verify:reveal-campaign
npm run verify:cave-reveal
npm test
npm run build
npm run dev
```

Missing/corrupt originals,captures or source history are explicit setup failures.
Required counts,events,checkpoints and exact comparisons fail strictly. Earlier
focused milestones and their historical scope remain in[status history](status-history.md)
and the subsystem documents;past passes are not current whole-game acceptance.
