"""Capture only the external, pinned NCR8496 digital implementation.

Usage: python3 scripts/capture-tandy-psg.py /path/to/dosbox-automation
Requires clang++ and the source tree. No emulator session is touched. The only
shim is an empty dosbox.h with C_DEBUGGER=0, disabling logging dependencies.
The chip source,device framework shim and headers are otherwise unmodified.
"""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

PINNED = {
    "src/hardware/audio/mame/sn76496.cpp": "f4c8dc1ff7caf8d5112fec1ec6c4f7c02c1ac3ef4f1449783190bf7dc7876a2c",
    "src/hardware/audio/private/mame/sn76496.h": "ff92773ef16202e82d999db6618e3e4b3bd0df95f055405e678d7f67d75b6b7d",
    "src/hardware/audio/private/mame/emu.h": "d140f8bd94c7a8ebecf2316f14c2e27afd85776190ff8a23ca3263cf871d2ba9",
    "src/hardware/audio/tandy_sound.cpp": "c92507733b116af2d6fdca35f2390254be08c688266bfc75adfa37d022416961",
}
sha = lambda b: hashlib.sha256(b).hexdigest()
if len(sys.argv) != 2:
    raise SystemExit(__doc__)
source = Path(sys.argv[1]).resolve()
for name, checksum in PINNED.items():
    if sha((source / name).read_bytes()) != checksum:
        raise SystemExit(f"SETUP: wrong pinned source {name}")
inputs_path = Path("reference/tandy-psg-inputs.json")
inputs = json.loads(inputs_path.read_bytes())
assert len(inputs["cases"]) == 15
assert sum(len(c["events"]) + 1 for c in inputs["cases"]) == 625
probe_path = Path("reference/tandy-psg-probe.cpp")
compiler = shutil.which("clang++")
if not compiler:
    raise SystemExit("SETUP: clang++ is required to recapture chip evidence")
with tempfile.TemporaryDirectory(prefix="ducktales-psg-") as tmp:
    work = Path(tmp)
    (work / "dosbox.h").write_text("#pragma once\n#define C_DEBUGGER 0\n")
    executable = work / "probe"
    subprocess.run([compiler, "-std=c++17", "-I" + str(work),
                    "-I" + str(source / "src"), str(probe_path), "-o", str(executable)], check=True)
    results = []
    for case in inputs["cases"]:
        schedule = "".join(f"{ {'write': 'w', 'clock': 'c'}[op]} {n}\n" for op, n in case["events"])
        output = subprocess.run([str(executable)], input=schedule, text=True,
                                capture_output=True, check=True)
        assert not output.stderr, output.stderr
        states = json.loads(output.stdout)
        assert len(states) == len(case["events"]) + 1
        results.append({"name": case["name"], "states": states})
    artifact = Path(".local/tandy-psg/digital.json")
    artifact.parent.mkdir(parents=True, exist_ok=True)
    artifact.write_text(json.dumps(results, separators=(",", ":")) + "\n")
    manifest = {
        "level": "External pinned DOSBox NCR8496 digital comparison; not original game runtime or waveform parity.",
        "captureRevision": "tandy-psg-v1-2026-10-27",
        "sourceRevision": "DOSBox engine f6d9b (the four files also match source HEAD7ae3dbe)",
        "sources": PINNED,
        "inputs": str(inputs_path), "inputsSHA256": sha(inputs_path.read_bytes()),
        "probe": str(probe_path), "probeSHA256": sha(probe_path.read_bytes()),
        "captureToolSHA256": sha(Path(__file__).read_bytes()),
        "compiler": subprocess.check_output([compiler, "--version"], text=True).splitlines()[0],
        "cases": 15, "checkpoints": 625,
        "clock": "One digital step = chip clock/16. Reference sound_stream_update advances8 internal samples per step. Reference clock3579552 is rounded by the pinned DOSBox Tandy provider; audition uses nominal3579545. No PCM-time equivalence claimed.",
        "injections": "Authored initial register/counter/output/LFSR state in inputs; all volumes15,latched0,internal divided-clock phase7. No expected state supplies input. Probe exposes private visibility only; chip algorithms unchanged.",
        "comparison": "Exact registers,effective periods,counters,output bits,LFSR,latch and output-negation flag at every consumed event. No exclusions. No analog/gain/resampling comparison.",
        "recipe": "docs/tandy-audio.md", "verify": "npm run verify:tandy-psg",
        "artifact": {"path": str(artifact), "sha256": sha(artifact.read_bytes())},
    }
    Path("reference/tandy-psg.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Captured {len(results)} chip cases /625 checkpoints; no live emulator changes.")
