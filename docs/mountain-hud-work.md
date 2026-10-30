# Mountain HUD source calls and work

The browser HUD now uses the original overlay 5 caller at body `1744..189d`.
Ordinary frames charge the original cash-number call at `1351`, full redraws
charge all HUD lines/sprites/numbers, and the rope charges its source line.
Canvas reconstruction is uncharged. Numeric output uses the original signed32
formatter, including remainder-glyph quirks and wrapped right alignment.

## Original evidence

`reference/mountain-hud-work.json` pins 20 local artifacts, exact executable/body
identities, source hashes, the capture recipe and exclusions. It uses the same
supported `DUCKTALE.EXE` SHA-256
`fb658562b480ccf75a9dd0a7344c9ae74737e2ca651c0a09dc546928f612a981`.
The body SHA is `b50591460d43e848d52b49ee7b843065413d877dca8dc75455ce7dca2a7f2bd0`.

The clean raw Ghidra HUD listing matches original bytes contiguously. Entry
`004b..0062` also establishes MAIN cash sprite position (40,172) and day sprite
(8,175). These descriptor writes are now translated in mountain initialization;
the previous Canvas HUD used those positions without initializing descriptors.
The 102-byte entry request returns a complete instruction ending at `0067`, so
the checker validates all 104 actual bytes instead of trusting the request's
byte-count summary.

The private native experiment calls original `1744` after applying resident and
68 overlay relocations. Original HUD code and stack helper execute unchanged.
Explicit preserving observers replace resident line `4190` and numeric formatter
`1e67` with one-byte RETF, and the sprite vector points to RETF2. A private color
pointer lets the original caller write/restore color. The observer records exact
ordered line coordinates/colors, sprite addresses and seven-word numeric inputs.
These are declared effect stubs, not actual native drawing or formatter execution.

Twelve independent cases cover day9/10/30, signed days -1/-128, signed32 high-bit
money, zero money and zero-to-three lives. All 486 calls match: 408 lines, 54
sprites and 24 number calls. Each case compares 65,471 DS bytes (`0000..fffe`
except64 private stack bytes `feb0..feef`) and all 61,522 code bytes, including
the two declared observer replacements. Byteffff is unread. Eight controls reject
wrong calls, numeric arguments, DS, code, case count, inputs, unsupported IPs and
empty execution. These independently initialized routines are not a machine
checkpoint or continuous campaign replay.

The capture records emulator binary/bridge hashes, normal core, protocol, exact
launch arguments and isolated dummy audio/video configuration. Private port8401
closed in `finally`; shared8386 was untouched. Reproduce with a new output folder
and private port using the manifest recipe. Missing/corrupt artifacts fail.

## Runtime and primitive verification

```sh
node scripts/verify-mountain-hud.js
node scripts/verify-mountain-hud-runtime.js
node scripts/verify-mountain-hud-integration.js
```

The runtime checker compares production commands, DS effects and separate
sprite/line/number budgets against all 12 native caller inputs. It requires the
existing native numeric formatter proof and native line primitive proof. The
latter checks32 cases, 3,722 exact IPs, 140 OUT sites, all original code bytes and
six failure controls. Numeric work checks16 cases, signed-width behavior, original
text output and original driver execution. Two production controls omit line or
number charging while preserving commands and must fail.

`verify-ega-line-primitives.js` retains the complete native portion of the earlier
line verifier as a separately scoped command. The old combined
`verify-ega-lines.js` also invokes an obsolete jungle workload inspection, which
fails its jungle-source guard. That command and historical manifests remain
unchanged; the new native-only command makes no jungle workload acceptance claim.

The full HUD has30 black horizontal lines (169..198), four borders, MAIN sprites,
lives and two numbers. Ordinary frames charge only the footer sprite and money
number; reconstructed day/border/lives work is not charged. Numeric work requires
the supported8×8 font and scale0. Source rope sums wrap signed16 before line
dispatch. Resident dispatch, color setting and general caller CPU work remain
excluded rather than estimated.

The focused gate requires the full independent764-input ascent with26 checkpoints
and870 rendered presentations, all180 units, real browser mountain controls,
three actual browser omissions (copies, HUD lines, HUD numbers) and a production
build. It starts from clean committed source and saves source archive/inventory,
log, result and runner status in a new ignored directory. It rejects source edits
during verification. The route uses separate authored input and expected-state
streams; no expected results choose an input or timer.

## Remaining scope

This is not original full-HUD pixels or timing acceptance. Primitive work and
caller inputs are independently established, then composed. Mountain opening/
scroll terrain copies, resident/CPU/device work and exact retrace phase remain.
The last whole Easy campaign acceptance predates copy/HUD integration; current
source guards reject that saved receipt. A new complete browser campaign is
required after scheduling work. Hard campaigns remain deferred.
