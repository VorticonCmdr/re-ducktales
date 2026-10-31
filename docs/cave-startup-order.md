# Cave startup and torch loading order

Sound0 now occurs before the initial striped wipe. After that wipe finishes,the
cave flushes unread controls and pending system keys before entering the first
room. Previously Sound0 occurred after the wipe and this flush was absent.
The existing constructor/final-entry flushes remain separate boundaries.

Torch transitions14→15 and15→16 now select the new descriptor before yielding
for its resource load. Previously selection committed after loading. Frame/X/Y
descriptor initialization and counted payload work retain their existing order.

[Source manifest](../reference/cave-startup-order.json) pins263 exact original
bytes/86 instructions:Main0449..049a,04e8..057e and resident19a5..19c5. The parent
cached-loop proof additionally checks the idle-path assignments at0b2b/0b6d before
loader0b87. Original source Main0476/0478 passes zero to sound at0479,before wipe
0491 and flush0495. The resident flush advances the BIOS queue head to its tail
and clears128 native keyboard bytes under CLI/STI. Port providers clear their
ordinary-key/pending-system queues;hardware BIOS/modifier parity remains open.

An initial disassembly request started inside an instruction at04e7;the strict
contiguity checker rejected it. Only the instruction-aligned04e8 listing is
admitted. Changed-call and missing-instruction negatives must fail. Segment MOV
operand text is not authoritative;the checked original opcodes are used.

Two focused tests cover the stop-before-first-band/flush-after-completion order
and both selected-torch values during the first loading wait. The torch fixture
injects its threshold state and manually enters that mechanic;it is conditional
unit evidence,not an independent campaign or native replay. All220 unit cases
and the four-state conditional loading sequence pass.

```sh
PYTHONDONTWRITEBYTECODE=1 python3 scripts/verify_cave_startup_order.py
node --test tests/cave-timing.test.js
node scripts/verify-cave-counted-loading.js --output=.local/cave-startup-order-FRESH
```

The combined gate now requires ten checks,including this source proof,220 unit
cases,the real browser control route and loading-only negative. It must be run
from clean committed source and records a fresh archive/logs/status. The earlier
nine-check counted-loading receipt belongs to its earlier source.

Initial preparation remains synchronous and untimed. Map text loading/parsing,
initial sprite load ordering,remaining loader/system work and whole-cave timing
remain incomplete. These ordering fixes do not add a fitted delay or claim full
entry timing. Full campaign acceptance remains historical and needs refresh.


The source-pinned admission01 passes all ten checks at commit
c6a24b835f2e02d61e4a8ea3ff01ff3abf83922b. [Receipt](../reference/cave-startup-order-admission.json)
pins its source archive,113 runtime files,ten logs and completed status. The
earlier counted-loading receipt stays unchanged. Its source is historical.
