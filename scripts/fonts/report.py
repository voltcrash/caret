"""Summarize observed inventories, requests and exact pixel comparisons."""
import json
from pathlib import Path

from inventory import ROOT

evidence = ROOT / "docs/font-evidence"


def read(path):
    return json.loads((evidence / path).read_text())


baseline = read("baseline-inventory.json")
after = read("after-inventory.json")
split = read("rejected-split-metadata.json")
metadata = json.loads((ROOT / "scripts/fonts/output.json").read_text())
nohint = read("experiments/nohint.json")["files"]
nolayout = read("experiments/no-layout.json")["files"]
axis = read("experiments/axis.json")["files"]
fonts = []
for path, original in baseline["files"].items():
    if not path.startswith("frontend/"):
        continue
    name = Path(path).name
    final = after["files"][name]
    parts = split.get(name, [])
    core = sum(p["bytes"] for p in parts if ".core." in p["file"])
    extended = sum(p["bytes"] for p in parts if ".extended." in p["file"])
    fonts.append({"file": name, "beforeBytes": original["bytes"], "afterBytes": final["bytes"],
                  "savedBytes": original["bytes"] - final["bytes"],
                  "rejectedCoreBytes": core or None, "rejectedExtendedBytes": extended or None,
                  "rejectedSplitTotal": core + extended if parts else None,
                  "noHintBytes": nohint.get(name, {}).get("bytes"),
                  "noLayoutBytes": nolayout.get(name, {}).get("bytes"),
                  "fixedAxisBytes": axis.get(name, {}).get("bytes"),
                  "retainedOriginal": metadata.get(name, [{}])[0].get("retainedOriginal", True),
                  "reason": metadata.get(name, [{}])[0].get("retainReason", "unmodified ASL; no modification grant found")})

routes = []
for path in sorted((evidence / "after").glob("*.json")):
    if path.stem.startswith("specimen-"):
        continue
    first, last = read(f"before/{path.name}"), json.loads(path.read_text())
    def totals(case):
        return {field: sum(r[field] for r in case["fonts"]) for field in ["decodedBodyBytes", "encodedBodyBytes", "transferBytes"]}
    routes.append({"case": path.stem, "before": totals(first), "after": totals(last),
                   "beforePreloads": first["preloads"], "afterPreloads": last["preloads"],
                   "beforeRequests": first["fonts"], "afterRequests": last["fonts"],
                   "renderedBefore": first["rendered"], "renderedAfter": last["rendered"],
                   "rejectedSplit": totals(read(f"rejected-split/{path.name}")) if (evidence / "rejected-split" / path.name).exists() else None})

comparisons = {}
decisions = []
for folder in sorted(evidence.glob("before-vs-*")):
    summary = folder / "summary.json"
    if not summary.exists():
        continue
    records = json.loads(summary.read_text())
    available = [r for r in records if not r.get("missing")]
    nonzero = [r for r in available if r.get("changedPixels") or r.get("dimensionsDiffer")]
    comparisons[folder.name] = {"availableCases": len(available), "notRunCases": len(records) - len(available),
                                "nonzeroCases": len(nonzero), "changedPixels": sum(r.get("changedPixels", 0) for r in available),
                                "maxChannelDelta": max((r.get("maxChannelDelta", 0) for r in available), default=0)}
    for record in nonzero:
        decisions.append({"comparison": folder.name, **record,
                          "decision": "Rendering regression: alternative disabled; no masks or tolerance."})

data = {"baselineRevision": baseline["revision"], "tools": baseline["tools"],
        "fonts": fonts, "routes": routes, "comparisons": comparisons,
        "nonzeroAdjudications": decisions,
        "strictAcceptanceGate": "BLOCKED: exact-cmap splitting changes rendering; full faces retained."}
(evidence / "measurements.json").write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")

lines = ["# Font byte measurements", "", "Exact WOFF2 file bytes. The rendering-preserving candidate retains full faces; the original strict acceptance gate remains blocked. Core/extended columns are the **rejected**, pixel-changing split, not shipped downloads.", "",
         "| Font | Original | Trial core | Trial extended | Trial total | Candidate full | Saved |",
         "|---|---:|---:|---:|---:|---:|---:|"]
for f in fonts:
    lines.append(f"| {f['file']} | {f['beforeBytes']} | {f['rejectedCoreBytes'] or '—'} | {f['rejectedExtendedBytes'] or '—'} | {f['rejectedSplitTotal'] or '—'} | {f['afterBytes']} | {f['savedBytes']} |")
b, a = sum(f["beforeBytes"] for f in fonts), sum(f["afterBytes"] for f in fonts)
lines += [f"| **Text total** | **{b}** | | | | **{a}** | **{b-a} ({(b-a)/b*100:.2f}%)** |", "",
          "Font Awesome: solid 119488, regular 19512, brands 115420 bytes: unchanged. Dependency-only v4compatibility appears in the source inventory but is not emitted by the build. System fonts are unshipped.", "",
          "## Retained costs", "", "Alternative file bytes below are measurements, not approved replacements. Compression is not additive across tables. The alternative deltas include its changed naming/compression, and do not pretend to isolate an individual SFNT table's compressed cost.", "",
          "| Font | Candidate | Hint-off alternative | Layout-off alternative | 400-only axis alternative |",
          "|---|---:|---:|---:|---:|"]
for f in fonts:
    lines.append(f"| {f['file']} | {f['afterBytes']} | {f['noHintBytes'] if f['noHintBytes'] is not None else '—'} | {f['noLayoutBytes'] if f['noLayoutBytes'] is not None else '—'} | {f['fixedAxisBytes'] if f['fixedAxisBytes'] is not None else '—'} |")
lines += ["", "## Cold-cache font responses", "", "Decoded body bytes below equal downloaded WOFF2 body bytes, not every font referenced in CSS. Full transfer and encoded-body values, per-file URLs, preload lists and rendered faces are in measurements.json and the route capture JSONs.", "",
          "| Route/state | Before body | Candidate body | Saved | Rejected split body | Before transfer | After transfer |",
          "|---|---:|---:|---:|---:|---:|---:|"]
for r in routes:
    b, a = r["before"], r["after"]
    lines.append(f"| {r['case']} | {b['decodedBodyBytes']} | {a['decodedBodyBytes']} | {b['decodedBodyBytes']-a['decodedBodyBytes']} | {r['rejectedSplit']['decodedBodyBytes'] if r['rejectedSplit'] else '—'} | {b['transferBytes']} | {a['transferBytes']} |")
lines += ["", "Preloads stay `/webfonts/RobotoMono-Regular.woff2` and `/webfonts/LexendDeca-Regular.woff2`, with original attributes. Preview URLs/fallback precedence and complete Font Awesome faces stay unchanged. The core-only/extended-only isolated cases intentionally still request the full Roboto Mono file: lazy split delivery was rejected.", "",
          "## Exact pixel comparisons", "", "Experiment-only comparisons run specimens, not every production route; not-run cases are explicit. The candidate before/after and repeated baseline comparisons cover every case.", "",
          "| Comparison | Captured | Not run | Nonzero | Changed pixels | Max channel delta |",
          "|---|---:|---:|---:|---:|---:|"]
for name, c in comparisons.items():
    lines.append(f"| {name} | {c['availableCases']} | {c['notRunCases']} | {c['nonzeroCases']} | {c['changedPixels']} | {c['maxChannelDelta']} |")
(evidence / "TABLES.md").write_text("\n".join(lines) + "\n")
print(f"Text bytes {sum(f['beforeBytes'] for f in fonts)} -> {sum(f['afterBytes'] for f in fonts)}; {len(routes)} route/isolation states")
