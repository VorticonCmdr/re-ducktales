# Atomic transmitter input boundaries

The supported original build is the 22-file pairing in
[build.json](../reference/build.json). The runtime fix is commit `7ed718f`.

## Rule and evidence

The success/failure charge and sound loops contain no input-reader call. The
failure report calls shared `09f5(60)`: clear input on entry, read immediately,
then wait seven driver ticks after each neutral read. After the sixtieth wait,
return without a sixty-first read. A Fire make in that final wait is therefore
not consumed and cannot produce the optional click. These rules are statically
inferred from 413 checked original resident bytes and existing original atomic
and shared-input captures. [Source manifest](../reference/atomic-input-source.json).
No new original-emulator P/Q/S timing capture is claimed.

Before the fix, a browser probe earned the transmitter and pressed P during its
charge. The port opened Pause while charge still had seven ticks remaining.
The saved pre-fix observation and its reconstructed historical source archive
are checked separately; they are an observation, not independent replay.

The port now queues P/Q/S during charge/sound, clears them at report entry, and
checks fresh report controls only at the original reader boundaries. Pause and
Quit-No return to the blocked read and flush the appropriate controls. Restart
clears the controller and queued keys. Ten conditional tests cover these rules,
audio completion tokens, both report endpoints, and two negative controls.

## Earned browser route

The source-authored route uses actual browser controls: Easy startup, normal
security, Launchpad flight to Too-Pei, cave7 rooms
9→10→18→26→27→19→11→12→13→14, Bombastium award and unlock notice, return to
Office, choose Klondike and Atomic with Left. It presses P/Q/S during charge,
requires no overlay or sound toggle, arrives at Klondike, moves room17→18,
collects $50, and Restarts. Final cash is $3,450 on day6. There is no ownership,
seed, room, memory or audio-status injection.

External providers are a UTC browser clock starting at1, BIOS seed0, muted audio
and eight-millisecond display callbacks. The flight policy and cave navigator
choose inputs while recording; a separate consumer replays only the resulting
DOM event stream. Expected full snapshots and RGBA hashes never select replay
inputs. Capture alone is not acceptance. The consumer requires all18 checkpoints,
all486 events, exact state/pixel equality, successful Restart, and a selection
omission that must diverge specifically at the atomic-choice checkpoint.

The successful charge route passes independent browser replay:18 exact state/image
checkpoints,486 DOM events,Restart and one selection-omission negative.
[Acceptance manifest](../reference/atomic-earned-route.json).
A naturally reached misdirection report is now separately browser-observed: six
extra neutral cave input reads produce seed6900/roll0, redirecting Klondike to
location1. P/Q/S during charge are cleared, Pause holds remaining413, resume
returns to the same reader, Quit-No returns again, and Fire enters the jungle on
day6. Restart succeeds. [Observation manifest](../reference/atomic-report-observation.json).
The exploratory model suggested the idle schedule; the actual browser confirmed
it without injecting RNG or restoring state. This is an observation with executable
assertions, not independent replay of that report route or native timing acceptance.
Independent recorded-report replay remains a coverage gap.

```sh
node scripts/verify-atomic-earned-route.js
node scripts/verify-atomic-input-source.js
node --test scripts/atomic-input.test.js
node scripts/verify-atomic-report-observation.js
# Fresh recording requires clean committed source and original local game files:
node scripts/atomic-route.js capture --output=.local/atomic-earned-FRESH
# Fresh independent consumer; never overwrite a recording:
node scripts/atomic-route.js verify --capture=.local/atomic-earned-browser-01 --output=.local/atomic-replay-FRESH
```

Each recording/consumer archives its own clean Git source and full file inventory.
Original binaries and local snapshots/images remain ignored. Missing or corrupt
artifacts fail setup. No whole-game native timing or arbitrary-route claim follows
from this one route.
