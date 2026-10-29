"""Synthesises walkthrough/narration.json into one WAV per line plus durations.json, using Kokoro (offline TTS).

Usage: python narrate.py <kokoro-v1.0.onnx> <voices-v1.0.bin> <outDir> [narration.json]
Model files: https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0
"""
import json
import pathlib
import sys

import soundfile as sf
from kokoro_onnx import Kokoro

model, voices, out = sys.argv[1], sys.argv[2], pathlib.Path(sys.argv[3])
out.mkdir(parents=True, exist_ok=True)
# An optional fourth argument names another narration file, e.g. admin-narration.json.
script = pathlib.Path(sys.argv[4]) if len(sys.argv) > 4 else pathlib.Path(__file__).parent / "narration.json"
lines = json.loads(script.read_text())
kokoro = Kokoro(model, voices)
durations = {}
for line in lines:
    audio, rate = kokoro.create(line["say"], voice="af_heart", speed=1.0, lang="en-us")
    sf.write(out / f"{line['id']}.wav", audio, rate)
    durations[line["id"]] = round(len(audio) / rate * 1000)
(out / "durations.json").write_text(json.dumps(durations, indent=2))
print(f"{len(lines)} lines, {sum(durations.values()) / 1000:.1f}s of speech")
