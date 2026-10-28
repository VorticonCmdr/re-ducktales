# Flight landing flag frame255

Build: `dos-fb658562`, original executable/resource hashes in
`reference/build.json`. Verification: `node scripts/verify-flight-flag-alias.js`
(also required by `npm run verify:flight-runtime`). Private original captures
are hash-pinned by `reference/flight-flag-alias.json`; missing captures fail setup.

The linked Hard campaign exposed a visible PLANE.ARC58/frame255 at(310,116)
during its second flight. The independent captured DOM input stream reproduces
the preceding eight complete state checkpoints before this failure. Those
campaign captures remain exploratory, not original-game goldens.

Overlay4:22ee..2576 copies an object's variant byte into descriptor685a before
incrementing it. End flags begin with variantff; carried object counter+6 can
delay that first presentation until it is visible. Original helper43f9 leaves
that counter unchanged. Ghidra `FLIGHT_TRANSLATION.EXE` foreground entry
1e22:023e resolves this original code; helper2036:0209 resolves43f9. No object
state reset or modulo/clamped animation frame is justified by this code.

EGA IT.DRV001:035d zero-extends the frame byte and multiplies by the byte width.
Flag58 has widthBytes3,height24,stride9,planeSpan216. Frame255 starts at byte765.
Four color planes are followed by an opacity plane. Native allocations put
player-plane61 exactly1104 bytes after flag58:1080 decoded bytes rounded to1088,
then a16-byte DOS allocation header. Reads therefore alias the adjacent decoded
plane image. The exact decoded lengths checked are1080 and10240 bytes.
The intervening24 bytes contain allocation padding/metadata; the port does not
invent their contents. Every opaque pixel's color reads avoid that gap. A read
that requires an unknown byte stops with a diagnostic.

## Original experiment and reproduction

Single owner: this chat. DOSBox MCP0.84.0-vc1 f6d9b, protocol1.14, normal core,
svga_s3,3000 cycles, headless/muted, read-only original game root. No executable
or driver code was changed. Capture base revision7ecd8b7. This is a conditional
routine experiment, not an independent native Hard campaign or machine checkpoint.

Continue the original opening to difficulty and select Standard Wages, then
office Right+Space. Clear the security notice with Fire. At map entry, wait for
input initialization, hold Up1200ms from the office cursor, then Fire to inspect
Duckbill Island. Right selects Travel; Fire confirms, and another Fire continues
the briefing. Pause/arm a one-shot flight-entry breakpoint at0e0c:0000, then
physics0e0c:1330. Timed keys are emulator-side paired down/up events; debugger
stops make host-time scheduling conditional. Selection is visually verified,
not assumed from elapsed time.

Revalidate actual original bytes and real mode: flight entry begins
`55 8b ec b8 1c 00 9a 9e 1e 03 06 56 c6 06 c1 03`; physics begins
`55 8b ec b8 12 00 9a 9e 1e 03 06 56 a1 18 6d`.
DS/SS1403, overlay0e0c, EGA driver2ed7 were observed in this launch. Live driver
035d..0514 is compared byte for byte with the decoded original driver.

At physics stop1552 read descriptors DS685a/6f3e (20bytes each). The flag far
buffer was3ef5:0000, plane3f3a:0000; capture11344 bytes at the flag buffer.
Both decoded buffers match the asset-based decoder exactly, without exclusions.

Arm driver2ed7:0373 conditional on BX==685a. Stop1553 is before height/position/
frame/source reads (widthBytes3 already loaded). Capture CPU, descriptor, driver
code, and four VGA planes (A000:0000 length16384 each), selecting read-map4
through port3ce for each plane. Descriptor points at the actual allocated flag.
Inject only descriptor x310,y116,frame255; preserve its resource pointers.
Run to driver050c (stop1554), before DS restoration, and capture the same VGA
planes. This injection is an explicit routine input, independent of expected
pixels. Restore the descriptor x17,y116,frame0 after capture. The conditional
pixels persist in the framebuffer; no machine or partial-state restore is claimed.
The original remains paused at this stop; game DS is restored by the next pop.

The checker starts from the captured four VGA planes, renders the independent
command input, then compares all65536 plane bytes, including both pages and
padding. No pixel tolerance, exclusions, fitted timers, or expected-state-derived
input is used. The draw changes23 plane bytes, so equality is not vacuous. Negative
controls substitute frame0, corrupt an expected byte outside the drawn area, and
request unsupported frame254. All must fail. One conditional visible position is
native-validated; this does not establish original whole-flight parity or all
clipping positions.
