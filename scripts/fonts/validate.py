"""Reopen committed outputs: exact coverage, outlines, metrics and hints."""
import io
import json
from pathlib import Path

from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.ttLib import TTFont
from inventory import ROOT, original, ranges

metadata = json.loads((ROOT / "frontend/src/ts/constants/font-subsets.json").read_text())
results = []
for name, parts in metadata.items():
    source = TTFont(io.BytesIO(original(name)), recalcTimestamp=False)
    cmap = source.getBestCmap()
    source_glyphs = source.getGlyphSet()
    covered = set()
    count = 0
    for part in parts:
        output = TTFont(ROOT / "frontend/static/webfonts" / part["file"], recalcTimestamp=False)
        points = set(output.getBestCmap())
        assert ranges(points) == part["unicodeRange"], part["file"]
        assert not covered & points, part["file"]
        covered |= points
        for table, attrs in {"head": ["unitsPerEm"], "hhea": ["ascent", "descent", "lineGap"],
                             "OS/2": ["sTypoAscender", "sTypoDescender", "sTypoLineGap", "usWinAscent", "usWinDescent", "fsSelection"]}.items():
            for attr in attrs:
                assert getattr(source[table], attr) == getattr(output[table], attr), (name, table, attr)
        if "fvar" in source:
            assert [(a.axisTag, a.minValue, a.defaultValue, a.maxValue) for a in source["fvar"].axes] == [(a.axisTag, a.minValue, a.defaultValue, a.maxValue) for a in output["fvar"].axes]
        else:
            assert "fvar" not in output
        glyphs = output.getGlyphSet()
        for code, glyph in output.getBestCmap().items():
            original_glyph = cmap[code]
            a = DecomposingRecordingPen(source_glyphs)
            b = DecomposingRecordingPen(glyphs)
            source_glyphs[original_glyph].draw(a)
            glyphs[glyph].draw(b)
            assert a.value == b.value, (name, hex(code), "outline")
            assert source["hmtx"][original_glyph] == output["hmtx"][glyph], (name, hex(code), "metrics")
            if "glyf" in source:
                a_hint = getattr(getattr(source["glyf"][original_glyph], "program", None), "bytecode", [])
                b_hint = getattr(getattr(output["glyf"][glyph], "program", None), "bytecode", [])
                assert a_hint == b_hint, (name, hex(code), "instructions")
            count += 1
        for name_id in [0, 13, 14]:
            assert {r.toUnicode() for r in source["name"].names if r.nameID == name_id} == {r.toUnicode() for r in output["name"].names if r.nameID == name_id}, (name, "notice")
    assert covered == set(cmap), (name, "lost coverage")
    results.append({"source": name, "mappedGlyphsCompared": count, "coverage": "exact disjoint union", "outlinesMetricsHintsNotices": "identical"})
(ROOT / "docs/font-evidence/validation.json").write_text(json.dumps(results, indent=2) + "\n")
print(f"Validated {len(results)} fonts, {sum(r['mappedGlyphsCompared'] for r in results)} mapped glyphs")
