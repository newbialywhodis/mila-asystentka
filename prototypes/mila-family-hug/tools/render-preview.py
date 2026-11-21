"""Capture the actual Rive state machine; never generates or rewrites RML."""

import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFont


PROJECT = Path(__file__).resolve().parents[1]
OUTPUT = PROJECT / "renders"
FRAMES = OUTPUT / "frames"
RIVE = shutil.which("rive") or str(Path.home() / ".rive/bin/rive.exe")
FPS = 20
TOTAL_FRAMES = 310


def run_commands(commands: list[str], extra: list[str] | None = None) -> None:
    result = subprocess.run(
        [RIVE, str(PROJECT), "--commands", *(extra or [])],
        input="\n".join([*commands, "quit", ""]),
        text=True,
        encoding="utf-8",
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=True,
    )
    failures = [line for line in result.stdout.splitlines() if line.startswith("err ")]
    if failures:
        raise RuntimeError("\n".join(failures))
    print(f"Rive: {len(commands)} commands completed", flush=True)


def frame_path(index: int) -> Path:
    return FRAMES / f"frame-{index:04d}.png"


def make_gif(paths: list[Path], output: Path, repeat: bool) -> None:
    # One shared palette keeps antialiasing stable across frames.
    palette_source = Image.new("RGB", (400 * 4, 400 * 2))
    for i, index in enumerate([0, 30, 60, 70, 78, 86, 130, 175]):
        selected = paths[min(index, len(paths) - 1)]
        with Image.open(selected) as image:
            palette_source.paste(image.convert("RGB").resize((400, 400)), ((i % 4) * 400, (i // 4) * 400))
    palette = palette_source.quantize(colors=256)
    images = []
    for path in paths:
        with Image.open(path) as image:
            images.append(image.convert("RGB").resize((640, 640), Image.Resampling.LANCZOS).quantize(palette=palette, dither=Image.Dither.NONE))
    options = {"loop": 0} if repeat else {}
    images[0].save(output, save_all=True, append_images=images[1:], duration=1000 // FPS, disposal=1, optimize=True, **options)
    print(f"Wrote {output.name}: {output.stat().st_size:,} bytes", flush=True)


def make_contact_sheet() -> None:
    selected = [
        (0, "Początek · 0,00 s", "01-start.png"),
        (64, "Przygotowanie · 3,20 s", "02-prepare.png"),
        (76, "Zbliżenie · 3,80 s", "03-approach.png"),
        (81, "Początek uścisku · 4,05 s", "04-contact.png"),
        (92, "Pełne objęcie · 4,60 s", "05-embrace.png"),
        (145, "Spokojna pętla · 7,25 s", "06-calm.png"),
    ]
    sheet = Image.new("RGB", (1200, 872), "#fdfcf9")
    font = ImageFont.truetype(str(Path(os.environ.get("WINDIR", "C:/Windows")) / "Fonts/segoeui.ttf"), 18)
    draw = ImageDraw.Draw(sheet)
    for index, (frame, label, name) in enumerate(selected):
        source = frame_path(frame)
        shutil.copyfile(source, OUTPUT / name)
        with Image.open(source) as image:
            sheet.paste(image.convert("RGB").resize((400, 400), Image.Resampling.LANCZOS), ((index % 3) * 400, (index // 3) * 436))
        draw.text(((index % 3) * 400 + 16, (index // 3) * 436 + 406), label, font=font, fill="#655e60")
    sheet.save(OUTPUT / "contact-sheet.png")


def verify_rendered_behavior() -> None:
    run_commands([
        "advance 1",
        "pointer click@400,400",
        "advance 150",
        f"data-dump {(OUTPUT / 'manual-controls.json').as_posix()}",
        f"screenshot {(OUTPUT / 'manual-embrace.png').as_posix()}",
    ], ["--data=autoplay=false"])
    controls = json.loads((OUTPUT / "manual-controls.json").read_text(encoding="utf-8"))
    manual_hug = next(p["value"] for p in controls["viewModel"]["properties"] if p["name"] == "hug")
    # A complete loop apart must match, not merely be similar near its seam.
    # Both samples are well after the embrace; no automatic reset to the initial pose.
    with Image.open(frame_path(190)) as a, Image.open(frame_path(310)) as b:
        loop_delta = ImageChops.difference(a.convert("RGB"), b.convert("RGB"))
        loop_bbox = loop_delta.getbbox()
        loop_max = max(channel[1] for channel in loop_delta.getextrema())
    with Image.open(frame_path(0)) as a, Image.open(frame_path(92)) as b:
        hug_changed = ImageChops.difference(a.convert("RGB"), b.convert("RGB")).getbbox() is not None
    with Image.open(OUTPUT / "still-a.png") as a, Image.open(OUTPUT / "still-b.png") as b:
        still_delta = ImageChops.difference(a.convert("RGB"), b.convert("RGB")).getbbox()
    report = {
        "renderer": "Rive CLI 1.10.0, native headless",
        "sourceFps": 60,
        "captureFps": FPS,
        "durationSeconds": TOTAL_FRAMES / FPS,
        "calmPeriodSeconds": 6,
        "calmSamePhaseDifferenceBounds": loop_bbox,
        "calmSamePhaseMaximumChannelDifference": loop_max,
        "embraceChangesPose": hug_changed,
        "clickStartsEmbraceWithAutoplayDisabled": manual_hug,
        "stillChangesAfterTenSeconds": still_delta is not None,
        "signedRuntimeExport": False,
    }
    (OUTPUT / "verification.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2), flush=True)
    if not hug_changed or not manual_hug or still_delta is not None or loop_max > 2:
        raise RuntimeError("Rendered behavior verification failed")


def main() -> None:
    if "--verify-only" in sys.argv:
        verify_rendered_behavior()
        return
    FRAMES.mkdir(parents=True, exist_ok=True)
    commands = ["advance 1", f"screenshot {frame_path(0).as_posix()}"]
    for index in range(1, TOTAL_FRAMES + 1):
        commands.extend(["advance 3", f"screenshot {frame_path(index).as_posix()}"])
    run_commands(commands)
    run_commands([
        "advance 2",
        f"screenshot {(OUTPUT / 'still-a.png').as_posix()}",
        "advance 600",
        f"screenshot {(OUTPUT / 'still-b.png').as_posix()}",
    ], ["--data=still=true"])
    make_contact_sheet()
    make_gif([frame_path(i) for i in range(0, 246)], OUTPUT / "family-hug.gif", repeat=False)
    # A single exact period; frame 220 is the same pose as frame 100 and is omitted.
    make_gif([frame_path(i) for i in range(100, 220)], OUTPUT / "calm-loop.gif", repeat=True)
    verify_rendered_behavior()


if __name__ == "__main__":
    main()
