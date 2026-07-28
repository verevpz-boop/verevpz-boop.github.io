"""Быстрая QA-транскрипция готовых глав локальным Whisper."""

from pathlib import Path
import io
import sys

from faster_whisper import WhisperModel

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

root = Path(__file__).resolve().parents[1] / "public" / "audio" / "jarvi" / "znanie"
model = WhisperModel("medium", device="cuda", compute_type="float16")

for path in sorted(root.glob("*.mp3")):
    segments, _ = model.transcribe(str(path), language="ru", beam_size=3)
    text = " ".join(segment.text.strip() for segment in segments).strip()
    print(f"{path.name}\t{text}", flush=True)
