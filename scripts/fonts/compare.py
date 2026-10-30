"""Exact RGBA pixel comparison; no masks or tolerance."""
import json
from pathlib import Path
import sys

from PIL import Image, ImageChops
from inventory import ROOT

before = ROOT / "docs/font-evidence" / (sys.argv[1] if len(sys.argv) > 1 else "before")
after = ROOT / "docs/font-evidence" / (sys.argv[2] if len(sys.argv) > 2 else "after")
out = ROOT / "docs/font-evidence" / (before.name + "-vs-" + after.name)
out.mkdir(exist_ok=True)
records = []
for path in sorted(before.glob("*.png")):
    target = after / path.name
    if not target.exists():
        records.append({"case": path.stem, "missing": True})
        continue
    a, b = Image.open(path).convert("RGB"), Image.open(target).convert("RGB")
    if a.size != b.size:
        records.append({"case": path.stem, "beforeSize": a.size, "afterSize": b.size, "dimensionsDiffer": True})
        continue
    diff = ImageChops.difference(a, b)
    histogram = diff.convert("L", matrix=(1, 1, 1, 0)).point(lambda p: 255 if p else 0).histogram()
    changed = a.width * a.height - histogram[0]
    record = {"case": path.stem, "dimensions": a.size, "changedPixels": changed,
              "changedPercent": changed * 100 / (a.width * a.height),
              "maxChannelDelta": max(x[1] for x in diff.getextrema()), "bounds": diff.getbbox()}
    records.append(record)
    diff.save(out / path.name)
(out / "summary.json").write_text(json.dumps(records, indent=2) + "\n")
print(json.dumps([r for r in records if r.get("changedPixels", 0) or r.get("missing") or r.get("dimensionsDiffer")], indent=2))
print(f"Compared {len(records)} images: {sum(r.get('changedPixels', 0) for r in records)} changed pixels")
