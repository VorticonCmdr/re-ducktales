# Physical keys in ground expeditions

Flight now shares this reader at its own source calls; its departure handoff,
pitch masks and return prompt are documented in [flight-keyboard.md](flight-keyboard.md).

The browser now supplies physical make, repeat-make and release events to the
original ordinary-key reader in caves, mountains, jungle and Safari. It no longer
uses an immediately released virtual direction as the keyboard reader's result.
The simulation consumes a byte at each existing source input call. Rendering,
RNG and drawing deadlines remain independent of the DOM.

## Original rules and caller differences

Only the 22-file build in `reference/build.json` is supported. The immutable
ordinary-key evidence identifies the IRQ handler, ascending raw-slot scanner and
reader; it checks 36 original calls, all 128 flags and original relocated code.
The existing reader implementation is unchanged. See [ordinary-keyboard.md](ordinary-keyboard.md).

Mode 0 retains a held slot. A release marks an existing slot `40`; the next read
deletes that slot **and still uses its key once**. Mountain's captured cleanup
observes Right `3`, release-marked flag `64`, one more Right `3`, then neutral `0`.
Mode 1 clears the normalized slot after scanning. I/J/K/M normalization occurs
after raw scan priority; keypad directions and center retain their original codes.
Fire produces `C0`. A release after a caller flush does not recreate a slot.

The callers differ:

- Cave and mountain select mode 0 at entry. Cave flushes after safe room entry;
  mountain flushes during entry and life reset.
- Safari selects mode 1 and flushes after each sampled input. A held key does not
  synthesize another make after that flush. The results reader uses the same
  physical backend at its existing dialogue input calls.
- Jungle retains the incoming mode. Ordinary flight selects mode 0; destination
  selection retains mode 1. Jungle's control helper clears the key matrix except
  on its cooldown early return. Entry and first-page reveals have additional
  source flushes. Inherited mode 1 is statically inferred and independently
  exercised; a natural original atomic-to-jungle capture remains unverified.

Cave masks direction with `1f` and groups codes 1/2 as Up, 3/4 as Right, 5/6 as
Down and 7/8 as Left. The old held-cardinal adapter could not expose these keypad
diagonals. Both pointing and Fire-triggered travel use the same source groups.
All 256 byte values now compare with the operands in the original mask/compare
instructions. An actual Game case uses keypad3 plus Fire to enter room 18 and
receive $50.

`reference/expedition-keyboard.json` pins original overlay identities and five
bounded Ghidra exports. The complete 11,054-byte cave and 12,002-byte mountain
native bodies match after their original relocations. Native CPU/segment mapping
and real mode are checked. All 526 listed cave instruction bytes link to actual
native code after load-base adjustment. Listing gaps or incorrectly recovered
instruction flow are not treated as semantic evidence; only the explicitly
inspected mask/compare prefixes supply direction rules. Original files and
analysis exports are never executed or overwritten by this check.

## Input and verification contracts

The browser explicitly chooses `Game({ expeditionInput: "keyboard" })` and feeds
the same reader through `expedition-key`. Component fixtures using already
decoded digital controls retain their separate `digital` provider. An empty
keyboard table never falls back to synthesized held controls. Providers validate
their eight-bit return value. Ordinary flags and the caller mode are mirrored
into the active component's original DS locations. `expeditionKeys` diagnostics
show the current flags, source-read count and last consumed byte; the older
`controls` field remains the separate digital-adapter state.

Real OS repeats remain external hardware events. The browser does not invent a
typematic clock. The Safari browser test declares its own repeat profile: first
after 250 ms, then every 32 ms, using actual DOM key makes. These authored values
are not fitted native timer inputs or evidence of the original repeat rate.
The test must consume all twelve photographs and reach film `-1` before results.

`expedition-keyboard-inputs.json` contains only two hardware events, placed before
source reads 2 and 16. A fresh independent Game consumes 17 reads and compares six
complete native flag checkpoints. The counted native capture records first,
last, release-edge and neutral AX explicitly; intermediate held values follow
the mode-0 rule. A separate original frame profile records all its 14 held reads.
This is an input-boundary invariant comparison, not an uninterrupted native
timing or actor-state replay. No native timer or actor state initializes Game.

Run `npm run verify:expedition-keyboard`. It includes source/native checks,
component regressions, all unit tests, five actual browser cases, an isolated
lost-release negative and production build. Missing fixtures, corrupt data,
zero/unfinished cases, skipped reads, leftover events and differing results fail.
Five native/invariant negatives reject a missing release, changed result, wrong
reader mode, altered grouping and changed source byte. The browser negative must
fail at the release-edge byte assertion; setup failures/timeouts do not count.

The old mountain source guard is retained through an explicit source bridge.
`mountain-ascent-input-bridge.json` first checks the exact historical class and
all unchanged transitive dependencies, then compares current and historical
classes at all 764 complete DS/locals/snapshot boundaries and 870 ordered
command/pixel publications. Every timer byte is included. Two negatives reject
changed memory and pixels. All 26 original port ascent checkpoints, old timing
outputs and old fixtures remain required and unchanged. This is port regression,
not a native complete ascent comparison. The jungle source bridge also compares
1,616 entire input-boundary memories/states, 1,714 ordered pixel/mode/wipe payloads
and all clock/final values against its previous drawing-time class, with no
exclusions and four negative controls. Both historical component contracts and
their separate drawing-time expectations remain unchanged.

The jungle browser entry preserves the prior complete state and picture; only
the new keyboard diagnostics are excluded from the *historical* hash. The new
full-state hash includes those diagnostics and is checked independently, along
with all 50 entry DOM events and the entry clock. The producer run is deliberately
marked exploratory. Acceptance requires a subsequent clean browser reproduction
plus actual alias, fresh-repeat, flush, movement and Restart checks.

## Historical artifact isolation and remaining work

The historical map fixture-negative script renames/corrupts captures during its
checks. The current npm command runs that immutable script on disposable copies,
then verifies all 159 original artifact hashes remain unchanged. Both negatives
and all 36 restored positive cases must pass. Only owned temporary files are
mutated; original captures and source archives remain intact.

This completes the tested ground-expedition ordinary-key boundary, not the
whole keyboard port. Native cross-scene queued-key delivery windows, remaining
modifier/system/BIOS behavior and physical-key integration in other scenes still
need investigation. Unsupported out-of-context expedition IRQs stop development
play with a diagnostic. Destination autonomous neutral polling and its exact
draw/flush/read window remain untranslated. Full native expedition timing,
arbitrary-route finishability and the complete campaign gate remain unverified.

## Focused integration receipt

The clean source run on `948466d` passed all 148 unit cases,
five actual browser cases, the lost-release browser negative, original/component
regressions and production build, with zero skipped cases. The
[receipt](../reference/expedition-keyboard-integration.json) pins the
653-file source archive, complete log, screenshots, runner and
fixture-isolation report. The jungle entry producer files remain exploratory;
the subsequent clean browser reproduction establishes this focused acceptance.
This does not refresh older whole-campaign receipts or make the required full
gate green.
