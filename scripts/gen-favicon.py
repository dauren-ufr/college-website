"""Generate favicon.ico for the college website."""
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def create_png(w: int, h: int, pixels: list) -> bytes:
    def chunk(name: bytes, data: bytes) -> bytes:
        c = name + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)

    raw = b"".join(b"\x00" + bytes(pixels[y * w : (y + 1) * w]) for y in range(h))
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


def main() -> None:
    w, h = 32, 32
    color = [26, 58, 107]
    pixels = color * (w * h)
    png = create_png(w, h, pixels)
    header = struct.pack("<HHH", 0, 1, 1)
    entry = struct.pack("<BBBBHHII", 32, 32, 0, 0, 1, 32, len(png), 6 + 16)
    ico = header + entry + png
    out = ROOT / "favicon.ico"
    out.write_bytes(ico)
    print(f"Wrote {out} ({len(ico)} bytes)")


if __name__ == "__main__":
    main()
