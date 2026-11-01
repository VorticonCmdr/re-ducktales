# Original allocation payload clearing

Cave resource loads now include required buffer-zeroing work before decoding.
The resident allocator044f..04c6 clears successful near storage with REP STOSW,
then ADC preserves the odd-byte carry for REP STOSB. Its far fallback4072..410e
allocates whole DOS paragraphs and clears eight words per paragraph. Both paths
therefore clear at least ceil(payloadBytes/2) word/odd-byte iterations. No native
elapsed-time residual supplies this budget.

The source checker validates360 instructions/862 original bytes:loader175c..19a4,
allocation044f..04c6 and far-calloc4072..410e. It applies the original EXEPACK
relocations and declared analysis bias1000 before comparing every byte. Ghidra's
segment MOV operand text is reversed at047e and40dd;the verified8ec2/8ec0 bytes
set ES to the destination segment. Near REP prefixes are F2,far F3;STOS ignores
ZF and both execute the count. The actual game remains the original22-file build.
Analysis executables are never run. [Declaration](../reference/allocation-clear-work.json).

The runtime counts only the common payload clear subtotal. For unobserved small
allocations,near/far selection and far paragraph padding remain outside the
model,as do allocator traversal,wrappers,DOS and IRQ costs. This is explicit
partial CPU accounting,not a complete allocator translation. It changes no
allocation addresses,decoded pixels,mechanics or input stream. Native sprite10
and picture0 payloads are paragraph-aligned,so their required clear counts are
exact:19040 and16000 word stores,6.346667 and5.333333ms at3000 cycles/ms.

All55 resource payloads pass independent near/far clear-bound calculations.
Two native buffer sizes/payloads remain verified. Five controls reject a changed
word-store opcode,omitted sprite clear work and unsupported allocation sizes.
The existing decoder/converter oracle still passes all55 resources and its
retained negatives;its original LZW/converter totals and native plane bytes are
unchanged. The runtime subtotal now includes the additional clearing pass.

The native cave probe still exits1. Its first exit pose moves1383.783→1390.129ms,
closer to original1398.282..1412.550ms. Torch and entry-clear phases remain at
the prior retrace boundaries;final party pose now matches,but final RNG differs.
No tolerance is enlarged. The source IRQ subtotal plus clearing,kept isolated,
advances entry clear by one later retrace but still fails the native comparison.
This does not authorize fitting a remaining delay.

Verification completed:221 unit cases,zero skips;source clear and55-resource
oracle;12 exit poses/11 duration brackets;one actual automated cave browser route
(44.6s);production build. The browser route uses its explicit recorded clock and
real input/rendering adapters;it is not native timing or natural-clock acceptance.

```sh
node scripts/verify-allocation-clear-work.js
node scripts/verify-sprite-load-work.js
npm test
node scripts/compare-cave-passage-motion.js
node_modules/.bin/playwright test tests/browser/cave-input.spec.js --config playwright.campaign.config.js --output .local/allocation-clear-browser-FRESH
npm run build
# Remaining strict exploratory failure:
node scripts/probe-cave-native-cadence.js
```

The earlier natural browser clock case remains historical for its archived
runtime. Its current-source guard correctly requires a fresh capture after this
resource-work change. No old recording or expected native state was rewritten.
