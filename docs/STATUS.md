# Current port status

Updated2026-10-29. **The whole game is incomplete; this is completion work, not
only fine-tuning.** Selected complete campaigns work; arbitrary-route
finishability and full original-game parity remain unproven.

## Integration

Main remains 054ac66, served on5187. Its last full gate passed117 unit, 74 development
browser and2 production cases, zero skips, including required original comparisons
and negatives. Runtime6a02e89 and its receipts are retained in
`.local/office-integration-full-gate-20261028/`; see [office evidence](office-transitions.md).

Development branch `codex/security-menu` adds original control-center departure
and first-map security. Runtime remains 9cfc0a3; subsequent work migrates real
browser routes and recordings through its changed shared RNG. The full branch
gate and integration into main are pending. Originals and old recordings remain
unchanged; no seed is reset to preserve old expectations.

## Working routes and evidence

- Original opening/Sound001→difficulty→office→original19-presentation money-bin
  departure→dive/reward→return/restart. [Opening](opening-investigation.md), [office](office-transitions.md).
- Office→map→departure→keyboard flight→landing or crash/repair→expedition→results
  →map. All35 destinations can be inspected. Jungle, mountain, cave and photography
  have completion/failure paths. Banking, investments, rival claims/reports, atomic
  travel, calendar/deadline handling and both endings are connected.
- The security-aware full Hard campaign covers all four expedition families and
  finishes day 31, losing17200 against 61000. Independent Game and browser replays
  match28 exact state/pixel checkpoints and4140 DOM events;1629 flight renders
  include one supported flag alias. Its current browser adapter regression also
  passes. [Hard campaign evidence](hard-campaign-security.md).
- Easy jungle entry independently matches50 DOM events and one complete snapshot;
  a fresh browser matches its pixels and passes pause/deferral/quit controls.
  [Entry evidence](security-jungle-entry.md).
- Easy Okeefadokie treasure/duplicate-notice route matches27 snapshots and pixel
  hashes in fresh and fixed-DOM browsers plus independent Game replay:70 events,
  860 jungle samples, 1050 dollars, one life, day 17. [Treasure evidence](security-jungle-treasure.md).
- Security-aware bank/endings/trading, map controls, departure dispatches, cave
  retry/treasure, Too-Pei transmitter/atomic travel, photography and real-audio
  notices have focused acceptance. [Travel integration](security-route-integration.md),
  [expeditions](security-expedition-integration.md).
- Cave/camera/flight input boundaries, persistent Tandy mute/speed/completion and
  failure handling pass. Real-time jungle life loss/return and mountain hook,
  all three life palettes, life reset and retry pass. [Input/audio](security-input-audio-integration.md),
  [terrain](security-terrain-integration.md).
- Tandy/PCjr is connected: Sound001 (~49s/3558 sequencer ticks), persistent channels,
  priorities, engine words and explicit completion. All121 public requests have
  viewer playback. PC speaker is the default.

Historical main routes include an Easy day 30 win 15000 against 10500 and a
pre-security Hard day 33 loss 19600 against 44000 (3350 DOM events/25 checkpoints).
They remain separate baselines; they do not prove those routes after security.
Alternate jungle layouts and mountain variants1/2 also retain their earlier
scoped evidence. [Hard routes](hard-expeditions.md), [mountains](hard-mountains.md).

## Supported build and limits

Only the 22-file pairing in [build.json](../reference/build.json) is supported.
DUCKTALE.EXE SHA-256:
fb658562b480ccf75a9dd0a7344c9ae74737e2ca651c0a09dc546928f612a981.
MZ/EXEPACK, x86 LE16 real mode, overlays, no extender. Fresh relocated-code checks
establish actual game code rather than a loader stub. Native security segments
cover82 RNG boundaries, 16 inputs and24 pictures; native office comparisons cover
20 pictures. [Security evidence](security.md).

Original routines/segments, carried port replay and actual browser acceptance are
distinct evidence levels. No complete native campaign/CPU/IRQ timing comparison
is claimed. Originals remain authoritative in ignored game/; private fixtures,
pictures and traces stay local. Production visitors select their own originals.

## Remaining work

- Migrate mountain-ascent, lightning, alternate Hard expedition recordings and the
  linked Easy campaign through security; preserve old inputs. Promote the newly
  accepted Hard recording deliberately, then pass the full branch gate before merging.
- Original office entry/selection, investment transitions and several map/notice
  presentations remain incomplete. Broader destination/difficulty coverage and
  original whole-scene comparisons are needed.
- CPU/file/IRQ/input timing, hardware audio waveform/gain/filter parity, nonzero bank
  animation/sparkle pixels and unusual sprite aliases remain incomplete. Speaker
  noise is approximate; its engine is omitted. BIOS seed0 is an explicit browser
  provider. Unsupported paths stop with diagnostics.
- No original save/load/high-score format has been identified. Browser persistence
  would be an explicit addition.

## Commands

`npm run verify` is the required full gate. Relevant focused commands:

```
npm run verify:security
npm run verify:hard-security-campaign
npm run test:hard-security-campaign
npm run verify:jungle
npm run verify:security-jungle-entry
npm run verify:security-jungle-treasure
```

Other focused commands are documented with their scenarios. Missing/corrupt
fixtures and incomplete comparisons fail setup/verification. Local development:
`npm run dev -- --port 5186`. No push, publication or deployment is requested.
