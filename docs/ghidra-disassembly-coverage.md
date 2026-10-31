# Disassembly coverage limitation

`disassemble_bytes` can report success and the requested `bytes_disassembled`
even when its instruction list omits defined data or contains stale misaligned
instructions. Requested range size is not proof of decoded coverage.

The cave Main000b..0449 request reported1086 bytes but skipped00a4..00a5. Its
following RCL/PUSH-ES interpretation incorrectly split the actual stack-argument
sequence. A second bounded request at00a4 repeated the omission. The original
bytes are ADD-SP2,SUB-AX-AX,PUSH-AX,PUSH-[BP+6],then the actual loader call00ad.
The strict source checker rejects gaps instead of accepting the tool's success.

The bounded [repair recipe](../scripts/ghidra/RepairCaveMapCallListing.java)
checks program identity and all nine bytes,then rebuilds only00a4..00ac with
follow-flow disabled. Healthy listings are left untouched. The corrected
1086-byte listing has350 contiguous instructions,all matching original relocated
bytes. The recipe's healthy/no-mutation path was executed successfully as well.
No executable bytes,original files or live emulator state were patched.

The script host also printed unrelated older script/compiler/cache diagnostics.
They are not evidence that coverage was repaired;the independent readback and
original-byte check establish that. The gapped listing is not admitted.

A focused MCP correction would expose covered-byte count and gap/overlap ranges
separately from requested range size,and report incomplete instruction coverage
when callers request a full listing. It should not silently clear existing code
or follow flow outside the requested range. The port's checkers retain their own
contiguity checks regardless of that server improvement.
