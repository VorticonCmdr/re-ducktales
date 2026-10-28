# Hard campaign through original security

A complete Hard campaign now passes strict independent Game and browser replay
with security enabled. Main remains at `054ac66` while the other branch regressions
are migrated. This is port regression and browser acceptance, not original
DOSBox whole-campaign or CPU/IRQ/waveform parity.

The route is original opening/menu → office/control center → security → Bermuda
jungle → bank/office → Yellerstone photography → Carlsbad cave → El Capitan
mountain → normal bank/office calendar travel → day 31 losing ending. The player
banks $17,200 against Glomgold's $61,000, collecting locations `[2,31,32,34]`. Jungle
and mountain each retain three lives. No game logic, seed or rival ownership
was changed to make the route succeed.

`reference/hard-campaign-security.json` pins28 exact full Game state and320×200
browser pixel checkpoints from 4,140 independently recorded DOM inputs. The Game
replay renders 1,629 flight presentations, including one supported original flag
frame 255 alias. Its separate native alias check still compares all 65,536 original
VGA bytes. All required events, checkpoints and final held-key releases finish;
there is no diagnostic tail, tolerance, injected state or output-derived replay
control in strict acceptance.

Run:

```sh
npm run verify:hard-security-campaign
npm run test:hard-security-campaign
```

The first command requires both retained capture and independent-browser
receipts. It rejects missing/corrupt artifacts, incomplete counts, unfinished
sequences and source-provenance differences, and reruns the complete Game replay.
Five controls reject a wrong difficulty input, changed expected state, missing
checkpoint, altered browser pixels and missing browser checkpoint. The browser negative actually omits the browser's Hard-selection key and must fail at the
first state checkpoint rather than setup or timeout. The second command reruns
the complete actual browser sequence on a fresh port 5186 server. The accepted capture/replay used separate fresh port 5197
servers via retained local configurations.

The immutable capture is `.local/hard-campaign/security-reference-07/`;
its producer sources are pinned to commit `a78eead`. The independent browser receipt
is `.local/hard-campaign/security-browser-replay-01/`, with producer sources pinned
to `3c93585`. Its state/pixel observations
and actual input log are separate from the original input/timeline artifacts.
Capture and current verification sources are distinct identities. Expected
outputs are consulted only at checkpoints; strict browser replay does not call
the exploratory steering, pathfinding or photography policies.

## Route changes and evidence scope

The original security challenge legitimately changes the shared RNG from the
BIOS0 campaign entry seed 1960 to 46760. The previous menu-era goldens remain
unchanged. The new first flight starts at54124; a `10..25` altitude band with
heading 1 wins it in 286 reads. The new Bermuda route requires three neutral
reads before the former movement stream:447 reads reach treasure with three
lives and return $2,150 including the campaign reward.

The previous Klondike destination was already claimed after photography, so the
new route uses unclaimed Carlsbad through normal map travel. Its race needs a
`50..65` band with heading 1 and finishes in 287 reads. The mountain race uses the
same band with heading 2 and finishes in 232 reads; the unchanged sequence of 671 climbing inputs
then succeeds with three lives. The second photography flight uses 389 reads.
These policies generated an exploratory capture; acceptance instead drives the
fixed stream of 4,140 events independently from startup.

The bounded planning experiments and incomplete captures remain explicitly
conditional or exploratory in [security evidence](security.md). Planning used
fresh or copied port data segments from observed contracts and replayed prefixes;
it never restored or injected browser/native machine state. Actual browser
validation then confirmed each candidate. The successful capture itself was
not accepted until independent complete Game and browser replays matched.

The full branch `npm run verify` is still pending. Other Easy, alternate-layout
and focused browser routes must pass through real security and carry its new RNG;
this scenario does not replace those requirements or prove arbitrary-route
finishability. Original office entry/selection and other presentation/timing
gaps also remain.
