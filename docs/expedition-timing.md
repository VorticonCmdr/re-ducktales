# Expedition movement timing investigation

The user reports fast movement in jungle, mountain, cave and safari. This is an
open fidelity defect; no speed adjustment has been accepted. Per-input movement
regressions and complete port campaigns do not prove real-time pacing.

## First measured mountain discrepancy

The retained original walk in [mountain-movement.json](../reference/mountain-movement.json)
has 15 separately captured input reads. Its relative driver counters are:

```
0, 3, 7, 10, 13, 16, 19, 22, 25, 28, 32, 35, 38, 41, 44
```

Using the independently established driver rate, 1193182/(1365*12), that spans
604.032ms from the first read to the last. The current Mountain component,
advanced with the browser's separate 72.844Hz driver and 70.086Hz retrace clocks,
consumes the same 15 joystick values in 199.755ms. Named actor/action/location
and RNG values match every post-update capture. The elapsed cadence differs by
about 3.024×. The original first input is neutral, followed by thirteen Right
samples and a final neutral sample. Expected output never chooses these inputs.

This is conditional evidence: its initial memory/stack comes from the original
entry, and an earlier setup changed the requested destination before travel.
No intermediate state, deadline or timer is injected. Both sequences subtract
only the first input's clock origin. Native timer readings are quantized; the
one-counter comparison tolerance allows that phase uncertainty, not a per-frame
fit. The discrepancy is much larger than the tolerance.

The source explains why this needs investigation. `mountain.js` waits for one
retrace per presentation and represents its drawing work synchronously. The
original has a deadline at life entry, but no additional fixed per-update driver
wait. Original execution/drawing before the page flip takes time. Adding a
three-frame sleep merely because this one case is near 3× is not a faithful
translation of that work. More scene/workload measurements are needed.

## Fresh pause-clock control

A fresh isolated original launch, source `aaf33a9`, used the exact supported
22-file pairing, read-only originals, port8387 and its own process/instance.
The complete relocated office overlay matched before any observation. The
resident timer stayed at733 across a 1026.222ms host pause at the same CPU stop;
all64K DS bytes and CPU registers remained exact. After resuming, the timer
advanced to739. No guest writes, state restore or shared emulator was used.

The engine reports DOSBox0.84.0-vc1(f6d9b), protocol1.14, effective normal core,
3000 configured cycles,16MiB and svga_s3. The retained mountain metadata names
the same version/configuration. It lacks an engine-binary checksum, so the pause
control supports the interpretation of those observations but is not a new
unpaused mountain benchmark. No timing conclusion is yet established for jungle,
cave or safari.

[Investigation manifest](../reference/expedition-timing-investigation.json) pins
original build, retained mountain references, capture recipe revision, fresh
runner, Git ZIP/source hashes, complete pause states, engine/configuration,
startup input and final completion records. Proprietary artifacts remain local.

## Commands and outcomes

```sh
npm run verify:expedition-timing-evidence
npm run diagnose:expedition-timing
```

The first checks the evidence and reports the mismatch; it is not timing
acceptance. The second deliberately exits1 on the unresolved cadence difference.
Missing/corrupt inputs or zero cases fail before a timing result. Two checker
controls reject an altered native timer sample and an omitted sample. Original
fixtures are never modified. The complete12002-byte/68-relocation mountain
code is revalidated against the original executable, avoiding Ghidra's known
invalid entry decompilation and segment aliases.

Reproduce the pause control from a clean committed source using the installed
bridge's Python environment and its site-packages path:

```sh
DUCKTALES_DOSBOX_MCP_ROOT=/path/to/site-packages PYTHONDONTWRITEBYTECODE=1 /path/to/bridge/python scripts/capture-security.py --pause-clock-test --port 8387 --output .local/new-pause-control/capture
```

The recipe refuses the unrelated8386 endpoint, preflights its own port, verifies
process/instance identity on every state and stops only its own process. Its
normal security segment still completes after the pause experiment.

Next: a fresh mountain movement timing capture with an emulator-side input
schedule and counted loop boundaries, with setup separated from measured input.
Then measure jungle, cave and safari and implement the missing execution-time
boundary without changing integer movement, RNG or music clocks. Keep the
existing speed unchanged until the measurement supports a concrete correction.
