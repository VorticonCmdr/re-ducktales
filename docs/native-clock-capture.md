# Precise read-only capture timestamps

The existing frame observer exposes render numbers and guest memory,not PIC
emulated milliseconds. CPU registers and input replay status cannot reconstruct
a native timer phase:frame replay elapsed_ms is host wall time. Fitting an offset
from expected sprite positions would be conditional evidence rather than an
independent environment provider.

A focused private tool correction adds Lua `dosbox.emulated_time_ms()`. It reads
PIC_FullIndex() on the existing emulation thread and returns a number. It neither
advances guest execution nor writes memory,schedules events,changes clocks or
charges guest cycles. Lua source commitdd93dd60a and paused CPU-read extension523e7d6c9 are on the existing private
`codex/dos-io-budget-observer` branch in `/private/tmp/ducktales-dos-io-engine`.
The shared engine/configuration,HOME and originals are unchanged.

The private existing emulator was rebuilt with target `dosbox` (the output file
is named dosbox_with_debugger). The captured engine reports version7ae3d;that
version string is not substituted for source provenance. Source commit/file
hashes and actual copied binary SHA are pinned independently.

Shell-only calibration at sourcee180a8a records61 consecutive callbacks across60
frames and856.084ms. All duplicate PIC reads within a callback are equal.
Frame intervals14.267667..14.268667ms show the CPU/PIC quantization;they are not
used to fit a game frame period. The owned emulator90398 closes0,with no input,
guest writes or restore. [Manifest](../reference/native-clock-calibration.json).
The checker verifies source/binary identity,complete rows and shutdown;four
controls reject a missing row,skipped frame,backwards clock and changed endpoint.

```sh
node scripts/verify-native-clock.js
# Fresh shell-only calibration;new output/private port required:
PYTHONDONTWRITEBYTECODE=1 DUCKTALES_DOSBOX_MCP_ROOT=/Users/valentin.pletzer/projects/emulator/dosbox-mcp \
 /Users/valentin.pletzer/projects/emulator/dosbox-mcp/.venv/bin/python scripts/capture-native-clock.py \
 --engine /private/tmp/ducktales-dos-io-engine/build-io/dosbox_with_debugger \
 --engine-source /private/tmp/ducktales-dos-io-engine --port 8417 --output .local/native-clock-calibration-FRESH
```

The jungle recipe now accepts an explicitly calibrated private engine through
`--pic-clock-engine` and `--pic-clock-source`,only with jump/walk-hold observers.
It requires the calibration check and exact source/binary identities before
launch. Default recipes remain on the user's configured engine. At the existing
ENTRY setup stop it records emulated milliseconds in an atomic CPU-read result. The
uninterrupted observer adds PIC milliseconds as its17th CSV field;original
position/RNG/counter fields and the independently authored inputs stay separate.
Lua runs only at frame callbacks,so the first ENTRY attempt using a one-read
script while paused was correctly rejected and excluded. Atomic CPU reads now
carry a timestamp from that same emulation-thread boundary. No measurement stop
or partial machine restore is introduced. The added paused-state calibration
is required before the new binary can be used.
All original live flight/jungle/EGA identity checks still run after engine change.

The timed game capture is the next experiment. Calibration alone accepts no game
clock phase,movement timing,CPU equivalence or browser behavior. A new timed
fixture needs its own manifest/checker before its data can support such a claim.

The paused-state extension is now calibrated in `.local/native-clock-calibration-02`,
capture source6f69815 and private engine source523e7d6c9. It adds three atomic
CPU reads across two requests at one setup stop. All registers and PIC timestamps
remain identical while paused. The current checker passes61 frame callbacks,
three paused reads and five corruption controls. The original Lua-only calibration
is preserved in `reference/native-clock-calibration-01.json`;the current manifest
selects the new source/binary fingerprint. This validates the two observation
boundaries only;the timed original game scenario is still pending.
