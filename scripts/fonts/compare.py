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
for stale in out.glob("*.png"):
    stale.unlink()
records = []
for path in sorted(before.glob("*.png")):
    target = after / path.name
    if not target.exists():
        records.append({"case": path.stem, "missing": True})
        continue
    a, b = Image.open(path).convert("RGB"), Image.open(target).convert("RGB")
    dimensions = {"beforeSize": a.size, "afterSize": b.size, "dimensionsDiffer": a.size != b.size}
    if a.size != b.size:
        extent = (max(a.width, b.width), max(a.height, b.height))
        aa, bb = Image.new("RGB", extent), Image.new("RGB", extent)
        aa.paste(a, (0, 0))
        bb.paste(b, (0, 0))
        a, b = aa, bb
    diff = ImageChops.difference(a, b)
    histogram = diff.convert("L", matrix=(1, 1, 1, 0)).point(lambda p: 255 if p else 0).histogram()
    changed = a.width * a.height - histogram[0]
    record = {"case": path.stem, "dimensions": a.size, **dimensions, "changedPixels": changed,
              "changedPercent": changed * 100 / (a.width * a.height),
              "maxChannelDelta": max(x[1] for x in diff.getextrema()), "bounds": diff.getbbox()}
    records.append(record)
    diff.save(out / path.name)
(out / "summary.json").write_text(json.dumps(records, indent=2) + "\n")
bad = [r["case"] for r in records if r.get("changedPixels", 0) or r.get("dimensionsDiffer")]
missing = [r["case"] for r in records if r.get("missing")]
print(json.dumps({"cases": len(records), "changedPixels": sum(r.get("changedPixels", 0) for r in records), "nonzero": bad, "unavailable": missing, "summary": str(out / "summary.json")}))
raise SystemExit(1 if bad or missing else 0)
