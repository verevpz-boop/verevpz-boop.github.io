"""Собрать бесплатное локальное аудио лекции «Знание» голосом Silero eugene."""

from __future__ import annotations

import json
from pathlib import Path
import re
import subprocess
import sys

import numpy as np
import soundfile as sf
import torch


ROOT = Path(__file__).resolve().parents[1]
PACK_PATH = ROOT / "public" / "jarvi-knowledge" / "znanie.json"
OUT_DIR = ROOT / "public" / "audio" / "jarvi" / "znanie"
MODEL_PATH = Path(r"E:\Projects\voice-bot-demo\v4_ru.pt")
SPEAKER = "eugene"
SAMPLE_RATE = 24_000
MAX_CHARS = 220


def split_for_tts(text: str) -> list[str]:
    sentences: list[str] = []
    for sentence in re.split(r"(?<=[.!?])\s+", text):
        sentence = sentence.strip()
        if not sentence:
            continue
        clauses = [sentence]
        if len(sentence) > MAX_CHARS:
            clauses = [s.strip() for s in re.split(r"(?<=[,;:])\s+", sentence) if s.strip()]
        for clause in clauses:
            while len(clause) > MAX_CHARS:
                cut = clause.rfind(" ", 0, MAX_CHARS)
                if cut < MAX_CHARS // 2:
                    cut = MAX_CHARS
                sentences.append(clause[:cut].strip())
                clause = clause[cut:].strip()
            if clause:
                sentences.append(clause)
    chunks: list[str] = []
    current = ""
    for sentence in sentences:
        candidate = f"{current} {sentence}".strip()
        if current and len(candidate) > MAX_CHARS:
            chunks.append(current)
            current = sentence
        else:
            current = candidate
    if current:
        chunks.append(current)
    return chunks


def encode_mp3(wav_path: Path, mp3_path: Path) -> None:
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(wav_path),
            "-codec:a",
            "libmp3lame",
            "-b:a",
            "96k",
            str(mp3_path),
        ],
        check=True,
    )


def main() -> int:
    if not MODEL_PATH.exists():
        raise SystemExit(f"Не найдена модель Silero: {MODEL_PATH}")

    pack = json.loads(PACK_PATH.read_text(encoding="utf-8"))
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = torch.package.PackageImporter(str(MODEL_PATH)).load_pickle("tts_models", "model")
    model.to(device)
    print(f"Silero загружен на {device}", flush=True)

    pause = np.zeros(int(SAMPLE_RATE * 0.22), dtype=np.float32)
    chapters = pack["chapters"]
    for index, chapter in enumerate(chapters, start=1):
        stem = Path(chapter["audio"]).stem
        wav_path = OUT_DIR / f"{stem}.wav"
        mp3_path = OUT_DIR / f"{stem}.mp3"
        print(f"[{index}/{len(chapters)}] {chapter['title']}", flush=True)
        pieces: list[np.ndarray] = []
        for chunk in split_for_tts(chapter["text"]):
            audio = model.apply_tts(
                text=chunk,
                speaker=SPEAKER,
                sample_rate=SAMPLE_RATE,
                put_accent=True,
                put_yo=True,
            )
            pieces.extend([audio.detach().cpu().numpy().astype(np.float32), pause])
        merged = np.concatenate(pieces[:-1])
        sf.write(wav_path, merged, SAMPLE_RATE)
        encode_mp3(wav_path, mp3_path)
        wav_path.unlink()

    print(f"Готово: {OUT_DIR}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
