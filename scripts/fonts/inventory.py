"""Manual font audit. No dependency on build/dev/install hooks."""
import hashlib
import io
import json
from pathlib import Path
import subprocess
import sys

import brotli
import fontTools
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[2]
BASE = "7699fef52"  # Original, unprocessed assets, never generated outputs.


def original(name):
    return subprocess.check_output(["git", "show", f"{BASE}:frontend/static/webfonts/{name}"])


def ranges(points):
    result = []
    for point in sorted(points):
        if result and point == result[-1][1] + 1:
            result[-1][1] = point
        else:
            result.append([point, point])
    return ",".join(f"U+{a:X}" + (f"-{b:X}" if a != b else "") for a, b in result)


def inspect(data):
    font = TTFont(io.BytesIO(data), recalcTimestamp=False)
    names = {}
    for record in font["name"].names:
        names.setdefault(str(record.nameID), set()).add(record.toUnicode())
    cmap = font.getBestCmap()
    hints = {}
    for tag in ["cvt ", "fpgm", "prep", "gasp", "hdmx", "VDMX", "LTSH"]:
        if tag in font:
            hints[tag] = len(font.getTableData(tag))
    instructions = sum(len(getattr(getattr(font["glyf"][g], "program", None), "bytecode", []))
                       for g in font.getGlyphOrder()) if "glyf" in font else 0
    return {
        "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(),
        "glyphs": len(font.getGlyphOrder()), "cmapCount": len(cmap),
        "unicodeRange": ranges(cmap),
        "axes": [{"tag": a.axisTag, "min": a.minValue, "default": a.defaultValue, "max": a.maxValue}
                 for a in font["fvar"].axes] if "fvar" in font else [],
        "features": {tag: sorted({f.FeatureTag for f in font[tag].table.FeatureList.FeatureRecord})
                     for tag in ["GSUB", "GPOS"] if tag in font and font[tag].table.FeatureList},
        "hintTables": hints, "glyphInstructionBytes": instructions,
        "tables": sorted(font.keys()), "names": {k: sorted(v) for k, v in sorted(names.items())},
    }


def main():
    files = subprocess.check_output(["git", "ls-tree", "--name-only", f"{BASE}:frontend/static/webfonts"], text=True).splitlines()
    records = {f"frontend/static/webfonts/{name}": inspect(original(name)) for name in files}
    icons = ROOT / "frontend/node_modules/@fortawesome/fontawesome-free/webfonts"
    for path in sorted(icons.glob("*.woff2")):
        records[f"@fortawesome/fontawesome-free/webfonts/{path.name}"] = inspect(path.read_bytes())
    output = {"revision": subprocess.check_output(["git", "rev-parse", BASE], text=True).strip(),
              "initialStatus": "only untracked docs/font-optimization-prompt.md",
              "tools": {"fonttools": fontTools.__version__, "brotli": brotli.__version__},
              "systemFontsUnshipped": ["Comic Sans MS", "Courier", "Georgia", "monospace", "sans-serif"],
              "files": records}
    (ROOT / "docs/font-evidence/baseline-inventory.json").write_text(json.dumps(output, indent=2) + "\n")
    lines = ["# Original shipped fonts", "", f"Revision: `{output['revision']}`. Exact cmap ranges, names, notices, licenses and features: baseline-inventory.json.", "", "| File | Bytes | Glyphs | Cmap | Axes | Hint instructions |", "|---|---:|---:|---:|---|---:|"]
    for name, record in records.items():
        lines.append(f"| {Path(name).name} | {record['bytes']} | {record['glyphs']} | {record['cmapCount']} | {record['axes']} | {record['glyphInstructionBytes']} |")
    (ROOT / "docs/font-evidence/baseline.md").write_text("\n".join(lines) + "\n")


if __name__ == "__main__":
    main()
