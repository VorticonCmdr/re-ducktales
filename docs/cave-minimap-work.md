# Original cave minimap work

The browser runtime is unchanged by this investigation. The model lives in
`scripts/lib/cave-minimap-work.js` until its source boundaries can be integrated
with room composition and verified through the real cave route. Hard campaigns
remain deferred. No movement slowdown is shipped by this model.

## Recovered rule

Original overlay6 helper1b26 draws each3x3 dot as nine calls to the original
EGA point routine through DS1ff4, then its passage pixels in bit order8,4,2,1.
The native input fixture identifies that dispatch as2ed7:0515. Arguments are
16-bit callee-pop `[y,x]`; this is not a rectangle primitive.

Helper1cc8 builds the minimap cache once during startup. Caller03bd..03d3
first draws sprite37, passes map base5a42 and invokes1cc8. That helper draws
eligible cells and copies the64x63 region at112,137 from the video page into
descriptor37's RAM surface. Easy draws all64 cells; other modes draw visited
cells. The model includes that copy, but the preceding sprite draw and other
startup work remain outside it.

Helper1dff draws sprite37 from the cache during ordinary party17 frames.
It then draws current-room, treasure and wandering markers. In modes1/2 it
also updates the current cell in the cache; mode2 omits the treasure marker.
Party animations with a different kind or nonzero546a omit this helper.
The EGA variant is implemented; alternate video modes stop explicitly.

The browser reconstructs the cached bitmap with `caveMinimap()` commands for
rendering. Those commands are not extra original drawing calls on each frame.
Charging all273 rendered fill commands would count cached work repeatedly.
The model keeps initial cache construction and marker drawing separate.

The original mode1/2 warning test reads neighbors of the map BASE while using
the CURRENT room for its edge guards and drawing. This quirk is preserved and
has an independent input that distinguishes it from a current-neighbor rewrite.
That case is source-derived; it is not new native Hard-game acceptance.

## Evidence and result

Only `reference/build.json` is supported: executable SHA256
`fb658562b480ccf75a9dd0a7344c9ae74737e2ca651c0a09dc546928f612a981`.
The original captured11054-byte cave body,196 relocations and native DS are
validated by the existing cave input verifier. Four new Ghidra instruction
ranges compare byte for byte after the declared1000-versus01f5 relocation
difference and three analysis-only stack-probe normalizations. The analysis
executable is not run. Ghidra revision and private extracts are hash-pinned in
`reference/cave-minimap-work.json`.

At the preserved original pauseReturn input:

| Source boundary | Pixel calls | Cache copies | Primitive model time |
| --- | ---: | ---: | ---: |
| Initial cache construction | 776 | 1 | 17.541667ms |
| Ordinary Easy party markers | 33 | 0 | 0.704ms |

The33 marker points contribute1782 opcodes and165 OUTs. Every one of the809
point paths across both boundaries matches the native in-bounds point trace.
The independent native primitive gate checks all32 captured point/line cases;
the cache copy uses the separately checked signed copy model and16 native cases.
Its actual descriptor arguments are asserted independently.

These are **source-inferred call plans composed with native primitive evidence**.
They are not a captured execution of the complete minimap caller or measured
native elapsed time. The normal-core model uses3000 cycles/ms and the established
I/O charge. Caller, resident, interrupt and remaining device work are omitted.
No counter/output is fitted or consumed to produce inputs.

## Reproduce

```sh
node scripts/verify-cave-minimap-work.js
```

This requires the supported ignored originals and all parent/local fixtures;
missing or corrupt evidence fails setup. It checks the complete source ranges,
original dispatch, exact native point paths and copy argument order, three mode
plans, kind/animation/video guards and the base-pointer warning quirk. Negative
controls reject a changed instruction, one omitted marker pixel and repeated
cache work on a party frame. Fresh local results go under
`.local/cave-minimap-verification-*`; proprietary extracts remain ignored.

Next: recover the room composition boundaries, integrate both workloads without
charging Canvas cache reconstruction, and verify browser controls, timing and
the complete campaign. The current accepted BIOS-clock runtime and its evidence
remain unchanged.
