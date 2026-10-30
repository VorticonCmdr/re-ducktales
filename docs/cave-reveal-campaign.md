# Campaign after restoring the cave reveal

This scenario refreshes full Easy campaign acceptance for the original cave
striped reveal in `d8d5442`. It does not establish complete-game/native parity,
Hard finishability or arbitrary-route coverage.

## Producer and independent inputs

The clean producer archive is `.local/reveal-campaign-capture-01/sources.zip`,
with every file hash in `source-revision.json`. The actual browser starts a fresh
application with clock origin1ms,8ms display callbacks,BIOS seed0 and audio off.
It replays the prior independent startup-to-Safari inputs through real DOM
controls,checking every preceding state and pixel digest. It then uses player
policies to finish cave,mountain,banking,rival reports and the winning ending.
It never restores a heap,injects game state or derives external timers from an
expected outcome.

The exploratory producer deliberately exits1 after completing the route. Its
raw environment retains `completed:false,routeCompleted:true`;that is not a
passing acceptance test. The separate owned `.local/cave-reveal-campaign-01/`
registration declares the complete input stream for independent replays.
`completed:true` in that registration means the recording is complete,not that
the exploratory producer passed. Its registration-time mode text is retained.
The versioned manifest separately tracks browser acceptance.

## Comparison scope

The34 checkpoints include all four expedition families,rewards,rival reports,
banking and the winning deadline ending. Every full state and320x200 RGBA digest
is exact in browser acceptance. All4,981 DOM inputs and their timestamps must be
consumed in order;only the original clamped/truncated logical pointer coordinates
are normalized. No timer,RNG,state or pixel fields are excluded.

The first23 checkpoints match the previous campaign's time,event count,state
and pixel hashes exactly. At cave return the new capture is344ms later,has four
additional visible publications and25 additional driver ticks. Money and seed
are unchanged. These values are observed expectations;they never supply clocks
or initialization values to the port.

The previous recording had35 checkpoints because its continuation producer
recorded both `arrival` and `mountain-entry` at the same time,event count,full
state and pixels. This fresh producer records that boundary once as `arrival`.
The verifier has separate fixed34/35-checkpoint contracts;it does not accept
arbitrary shortened sequences or silently skip a checkpoint. Previous fixtures,
expectations and receipts remain unchanged.

The resulting cover is day31,banked$14,550 versus rival$12,500,with jungle,cave,
Safari and mountain locations1/30/31/32 collected. Mountain retains all three
lives. Independent simulation replay matches all34 states and renders1,470
flight presentations with zero unsupported paths. Browser acceptance separately
checks actual controls,all checkpoint pixels and a fresh restart.

Independent simulation and actual-browser acceptance now pass all34 checkpoints,
all4,981 required events,and restart. The producer sentinel remains exploratory.
The combined clean integration gate is still pending;individual passes do not
stand in for that receipt.

## Verification

```sh
npm run verify:current-campaign
# Same gate, explicitly named:
npm run verify:reveal-campaign
```

The focused gate requires original identities,the cave reveal source/pixel
mechanism checks,the full campaign source archive,all registered artifacts,
independent replay,177 unit cases,the actual-browser replay and restart,and a
production build. Negative controls must reject a missing producer archive,a
corrupt ending image,an omitted checkpoint,an altered ending,an unfinished
timeline,and a missing
actual browser confirmation. Missing fixtures,zero cases,timeouts and browser
setup failures cannot count as successful negatives.

No native emulator session is changed. The full historical integration gate
remains separate;its older runtime/source receipts are not waived by this new
port scenario. Full original timing,the remaining speaker/input gaps,Hard
campaigns and arbitrary-route finishability remain open.
