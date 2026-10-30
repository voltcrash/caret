"""Deterministic MANUAL generation from immutable original git blobs.

vp exec /tmp/caret-font-tools/bin/python scripts/fonts/generate.py [--check]
Experimental flags write only to --out (never accepted without pixel proof).
"""
import argparse
import hashlib
import io
import json
from pathlib import Path

import brotli
import fontTools
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from inventory import ROOT, original, inspect, ranges

assert fontTools.__version__ == "4.61.1" and brotli.__version__ == "1.2.0", "Use pinned requirements.txt"
parser = argparse.ArgumentParser(__doc__)
parser.add_argument("--only", help="One source filename, experiments only")
parser.add_argument("--split", action="store_true", help="Rejected strict split experiment, requires --out")
parser.add_argument("--check", action="store_true")
parser.add_argument("--out", type=Path)
parser.add_argument("--drop-layout", action="store_true", help="Destructive shaping-cost experiment, requires --out")
parser.add_argument("--no-hinting", action="store_true")
parser.add_argument("--keep-features", action="store_true")
parser.add_argument("--fix-weight", action="store_true")
args = parser.parse_args()
assert not args.only or args.out, "--only requires --out"
assert args.out or not (args.no_hinting or args.keep_features or args.fix_weight or args.split or args.drop_layout), "Experiments require --out"
inventory = json.loads((ROOT / "docs/font-evidence/baseline-inventory.json").read_text())
target = args.out or ROOT / "frontend/static/webfonts"
target.mkdir(parents=True, exist_ok=True)
metadata = {}
after = {}
CORE = set(range(0x20, 0x7F)) | {0xA0, 0xAD, 0x2010, 0x2011, 0x2013, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D, 0x2026}


def encode(source, points, internal, keep_features=False):
    font = TTFont(io.BytesIO(source), recalcTimestamp=False, recalcBBoxes=False)
    if args.fix_weight and "fvar" in font:
        font = instantiateVariableFont(font, {"wght": 400}, inplace=True)
    if args.drop_layout:
        for tag in ["GSUB", "GPOS", "GDEF", "kern"]:
            if tag in font:
                del font[tag]
    options = subset.Options()
    options.legacy_kern = True
    options.hinting = not args.no_hinting
    options.layout_features = ["*"]
    if not args.keep_features and not keep_features:
        tags = {r.FeatureTag for t in ["GSUB", "GPOS"] if t in font and font[t].table.FeatureList for r in font[t].table.FeatureList.FeatureRecord}
        options.layout_features = sorted(t for t in tags if not (t.startswith(("ss", "cv")) or t in {"salt", "dlig", "hlig", "swsh", "ornm"}))
    options.name_IDs = ["*"]
    options.name_languages = ["*"]
    options.name_legacy = True
    options.glyph_names = True
    options.notdef_outline = True
    options.recalc_timestamp = False
    original_uvs = {selector: {code for code, _ in entries if code in points}
                    for table in font["cmap"].tables if table.format == 14
                    for selector, entries in table.uvsDict.items()}
    original_uvs = {selector: codes for selector, codes in original_uvs.items() if codes}
    sub = subset.Subsetter(options=options)
    selectors = {selector for table in font["cmap"].tables if table.format == 14 for selector in table.uvsDict}
    sub.populate(unicodes=points | selectors)
    sub.subset(font)
    # Rename every primary internal identity, regardless of RFN status. CSS names
    # remain the application's stable public API. Notices and licenses stay intact.
    replacements = {1: internal, 2: "Regular", 3: internal + ";CaretSubset1", 4: internal,
                    6: internal.replace(" ", ""), 16: internal, 17: "Regular", 18: internal,
                    21: internal, 22: "Regular", 25: internal}
    for record in font["name"].names:
        if record.nameID in replacements:
            record.string = replacements[record.nameID].encode(record.getEncoding())
    font.flavor = "woff2"
    out = io.BytesIO()
    font.save(out, reorderTables=True)
    data = out.getvalue()
    reopened = TTFont(io.BytesIO(data), recalcTimestamp=False)
    assert set(reopened.getBestCmap()) == points, "Subset cmap differs from retained coverage"
    actual_uvs = {selector: {code for code, _ in entries}
                  for table in reopened["cmap"].tables if table.format == 14
                  for selector, entries in table.uvsDict.items()}
    assert actual_uvs == original_uvs, "Variation sequences lost"
    return data


for path, baseline in inventory["files"].items():
    if not path.startswith("frontend/"):
        continue  # Font Awesome stays unmodified and complete.
    name = Path(path).name
    if args.only and name != args.only:
        continue
    data = original(name)
    assert hashlib.sha256(data).hexdigest() == baseline["sha256"]
    if name == "GallaudetRegular.woff2":
        # No modification grant found; preserve the original ASL font verbatim.
        if not args.out:
            assert (target / name).read_bytes() == data, "ASL font must remain byte-identical"
        after[name] = baseline
        continue
    source = TTFont(io.BytesIO(data), recalcTimestamp=False)
    points = set(source.getBestCmap())
    core = points & CORE if args.split else points
    extended = points - core
    parts = []
    for label, codepoints in [("core" if args.split else "full", core), ("extended", extended)]:
        if not codepoints:
            continue
        internal = "CaretSubset" + hashlib.sha256(name.encode()).hexdigest()[:12] + label.title()
        if name.startswith("Ubuntu"):
            family = source["name"].getDebugName(1)
            internal = family + " derivative " + internal
        # CommitMono changed pixels even with every feature retained. Keep its
        # original below; preserve all features in full-face cost experiments.
        generated = encode(data, codepoints, internal, keep_features=not args.split and name == "CommitMono-Regular.woff2")
        candidate_bytes = len(generated)
        retained = not args.out and not args.split and (len(generated) >= len(data) or name == "CommitMono-Regular.woff2")
        if retained:
            generated = data
        file = name.removesuffix(".woff2") + f".{label}.woff2" if args.split else name
        if args.check:
            assert (target / file).read_bytes() == generated, f"Non-reproducible {file}"
        else:
            (target / file).write_bytes(generated)
        record = inspect(generated)
        after[file] = record
        parts.append({"file": file, "unicodeRange": ranges(codepoints), "bytes": len(generated), "sha256": record["sha256"], "candidateBytes": candidate_bytes, "retainedOriginal": retained, "split": args.split, "retainReason": ("full-face reserialization changed pixels" if name == "CommitMono-Regular.woff2" else "generated file is not smaller") if retained else None})
    assert core.isdisjoint(extended) and core | extended == points
    metadata[name] = parts

meta = json.dumps(metadata, indent=2) + "\n"
report = json.dumps({"sourceRevision": inventory["revision"], "tools": inventory["tools"], "files": after}, indent=2) + "\n"
if args.out:
    (target / "metadata.json").write_text(meta)
    (target / "inventory.json").write_text(report)
elif args.check:
    assert json.loads((ROOT / "scripts/fonts/output.json").read_text()) == metadata
    assert json.loads((ROOT / "docs/font-evidence/after-inventory.json").read_text()) == json.loads(report)
else:
    (ROOT / "scripts/fonts/output.json").write_text(meta)
    (ROOT / "docs/font-evidence/after-inventory.json").write_text(report)
print(f"Verified {len(metadata)} source fonts, {len(after)} outputs; {sum(v['bytes'] for v in after.values())} bytes")
