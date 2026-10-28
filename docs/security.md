# First-map security challenge

The source translation in `src/game/security.js` passes a native segment
comparison. It is not connected to browser gameplay yet. Run
`npm run verify:security-core`; missing originals or local captures fail setup.
This is a step toward the original campaign entry, not a completed browser
milestone or evidence that every campaign can finish.

## Evidence and behavior

Only the supported22-file build in `reference/build.json` is covered. The
actual real-mode overlay2 is checked against all8368 original bytes after180
relocations in this fresh launch. Source references below are overlay offsets,
not guessed addresses in a DOS loader stub.

- `07ad..0a42` generates four distinct letters, then an unsigned RNG draw modulo10
  selects the correct row. Each of the other nine rows gets four independently
  distinct letters. Repeated letters within a row retry the same slot. Distractor
  rows are not required to differ from the target or from each other.
- All draws use the carried shared16-bit RNG. The captured segment starts at
  seed55478 and independently reaches42707 through41 draws, with every native
  pre-read seed and RNG call site compared. The native target and correct-row
  stack locals match the translated result. No final seed supplies replay input.
- `0abf..0b70` uses whole-byte directions: Right3/Left7 change the row by1,
  Down5/Up1 by2. Values above9 become0; values below0 become9. Fire with a
  direction confirms the current row without movement. These direction rules
  are statically inferred; this capture exercises only neutral and Fire.
- The first wrong choice displays the yellow warning and requests sound70.
  The second wrong choice flashes the red/blank alarm three times, then exits.
  The captured native return is1. The supported executable has a forced-success
  branch near `0c9c`; the caller also uses `OR BP,BP` at `0f0f` rather than testing
  the return value. Preserve these build-specific quirks.
- `0e4e..0e59` clears a caller-owned flag before the first challenge. The resident
  campaign initializes that flag once per new campaign. The challenge is not a
  per-departure check. Connecting it will legitimately change later RNG states;
  the port must not reseed to retain the old campaign fixture.
- `0e89..0f0a` draws the day, money and footer before the challenge. The original
  signed32 money helper receives right edge176/y175. Omitting that draw caused
  the first pixel divergence; adding the source draw resolves it exactly.

The strict checker compares11 complete320×200 pictures: the control-center
exit, stable challenge, warning before/after its wait, six alarm presentations
and black return. It consumes seven separately versioned input events. Five
negative controls reject changed original code, zero RNG cases, a changed RNG
state, a missing picture and a changed pixel. No image tolerance, injected memory,
partial restore or fitted timer is used. Native movement/correct-first-choice
coverage, browser controls, and elapsed-time/audio parity remain unverified.

## Reproducing the original segment

The installed DOSBox MCP bridge currently caches its port configuration.
`bridge_setup` does not update the running client/instance manager, so assuming a
new port selected a new child is unsafe. This recipe uses the bridge's existing
`Config`, `InstanceManager` and `DosboxClient` classes with a per-run configuration
on an isolated endpoint. It preflights the listener, refuses the shared8386 port,
and requires the handshake and every state capture to match its own child PID
and instance ID. It does not edit the installed bridge or global configuration.
Only its owned process is stopped in `finally`. This is a bounded workaround;
the bridge still needs the focused cached-settings/handshake correction described
in [office transitions](office-transitions.md).

Set `DUCKTALES_DOSBOX_MCP_ROOT` to the installed bridge source directory. Use its
existing Python environment to run:

```sh
python3 scripts/prepare-analysis.py
DUCKTALES_DOSBOX_MCP_ROOT=/path/to/dosbox-mcp PYTHONDONTWRITEBYTECODE=1 /path/to/dosbox-mcp/.venv/bin/python scripts/capture-security.py --output .local/security-native-new
```

The output directory must be new. The capture checks all original file hashes,
uses the operator's configured binary/mode/auth settings, mounts originals
read-only, and records CONFIG queries:3000 cycles,normal effective core,16MB and
svga_s3. The startup schedule presses N at1500ms, Space at5000/6500/8000ms and
Enter at9500ms, each held150ms. It requires all10 events to finish.

After confirming the complete relocated overlay, it observes neutral office
input and fixed Right+Fire195. It releases both at security entry, captures every
RNG boundary, then four neutral security polls. Fire is scheduled at the next
pre-read `0abf` boundary. Scheduling after a previous `0ac4` read is incorrect:
the intervening original `19a5` flush discards that press. It captures the warning,
observes a neutral poll, schedules another fixed Fire at the pre-read boundary,
and requires all six post-wait alarm checkpoints, cleanup and return1.

The first two attempts are incomplete exploratory artifacts and are excluded.
The accepted `.local/security-native-fire0-03/` contains43 files with checksums
in `reference/security.json`, plus the exact capture-script hash. Initial polls
0..2 are retained as exploratory scanout states; the initial image comparison
uses poll3 after three source waits. The initial RNG seed is an observed segment
starting state: startup BIOS/timer scheduling is not independently replayed.
A new capture may have a different initial seed and challenge; retain it as a
new scenario rather than replacing these expected results.

The next milestone is the source-timed component and actual browser entry,
selection, warning/alarm, control flush, map return and restart. Wall-clock
scheduling must remain outside the component; source driver counts, retraces,
audio calls and consumed input reads need explicit boundaries.
