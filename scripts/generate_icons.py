from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = ROOT / "icons"
SIZES = [16, 32, 48, 64, 96, 128]


PALETTE = {
    "outline": (64, 67, 74, 255),
    "spine": (79, 145, 111, 255),
    "cover": (142, 203, 165, 255),
    "page": (247, 246, 242, 255),
    "ink": (78, 80, 86, 255),
    "highlight": (250, 214, 108, 255),
    "bookmark": (232, 97, 72, 255),
    "pen_body": (62, 126, 210, 255),
    "pen_dark": (42, 91, 171, 255),
    "pen_tip": (141, 88, 63, 255),
}


def fill(draw: ImageDraw.ImageDraw, pixels: list[tuple[int, int]], color: tuple[int, int, int, int]) -> None:
    for x, y in pixels:
        draw.point((x, y), fill=color)


def hline(draw: ImageDraw.ImageDraw, x1: int, x2: int, y: int, color: tuple[int, int, int, int]) -> None:
    for x in range(x1, x2 + 1):
        draw.point((x, y), fill=color)


def rect(draw: ImageDraw.ImageDraw, x1: int, y1: int, x2: int, y2: int, color: tuple[int, int, int, int]) -> None:
    for y in range(y1, y2 + 1):
        hline(draw, x1, x2, y, color)


def draw_master_icon() -> Image.Image:
    image = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    c = PALETTE

    # Slightly enlarged notebook body.
    outline = [
        (2, 1), (3, 1), (4, 1), (5, 1), (6, 1), (7, 1), (8, 1), (9, 1), (10, 1), (11, 1), (12, 1),
        (1, 2), (13, 2),
        (1, 3), (13, 3),
        (1, 4), (13, 4),
        (1, 5), (13, 5),
        (1, 6), (13, 6),
        (1, 7), (13, 7),
        (1, 8), (13, 8),
        (1, 9), (13, 9),
        (1, 10), (13, 10),
        (1, 11), (13, 11),
        (1, 12), (13, 12),
        (2, 13), (3, 13), (4, 13), (5, 13), (6, 13), (7, 13), (8, 13), (9, 13), (10, 13), (11, 13), (12, 13),
    ]
    fill(draw, outline, c["outline"])

    rect(draw, 2, 2, 4, 12, c["spine"])
    rect(draw, 5, 2, 12, 12, c["page"])

    fill(draw, [(12, 2), (12, 3), (11, 3)], c["bookmark"])
    fill(draw, [(4, 3), (4, 4), (4, 5), (4, 6), (4, 7), (4, 8), (4, 9), (4, 10), (4, 11)], c["cover"])

    hline(draw, 6, 11, 5, c["ink"])
    hline(draw, 6, 11, 7, c["highlight"])
    hline(draw, 6, 10, 9, c["ink"])

    # A longer pen with a dark side, crossing out of the page.
    pen_body = [(14, 6), (13, 7), (12, 8), (11, 9), (10, 10), (13, 6), (12, 7), (11, 8)]
    pen_dark = [(14, 7), (13, 8), (12, 9), (11, 10)]
    pen_tip = [(11, 10), (10, 11)]
    ink_dot = [(10, 10)]
    fill(draw, pen_body, c["pen_body"])
    fill(draw, pen_dark, c["pen_dark"])
    fill(draw, pen_tip, c["pen_tip"])
    fill(draw, ink_dot, c["ink"])

    return image


def save_icons() -> None:
    OUTPUT_DIR.mkdir(exist_ok=True)
    master = draw_master_icon()

    for size in SIZES:
        if size == master.width:
            icon = master
        else:
            icon = master.resize((size, size), resample=Image.Resampling.NEAREST)
        icon.save(OUTPUT_DIR / f"icon-{size}.png")


if __name__ == "__main__":
    save_icons()