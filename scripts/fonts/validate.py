"""Reopen committed outputs: exact coverage, outlines, metrics and hints."""
import io
import json
from pathlib import Path

from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.ttLib import TTFont
from inventory import ROOT, original, ranges

metadata = json.loads((ROOT / "scripts/fonts/output.json").read_text())
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
        for tag in ["cvt ", "prep", "fpgm", "gasp", "cvar"]:
            if tag in source:
                assert source.getTableData(tag) == output.getTableData(tag), (name, tag, "global hinting")
        def signature(font, glyph_set, glyph):
            pen = DecomposingRecordingPen(glyph_set)
            glyph_set[glyph].draw(pen)
            instructions = bytes(getattr(getattr(font["glyf"][glyph], "program", None), "bytecode", [])) if "glyf" in font else b""
            return tuple(pen.value), font["hmtx"][glyph], instructions

        assert signature(source, source_glyphs, source.getGlyphOrder()[0]) == signature(output, glyphs, output.getGlyphOrder()[0]), (name, "missing glyph changed")
        source_uvs = {selector: entries for table in source["cmap"].tables if table.format == 14 for selector, entries in table.uvsDict.items()}
        output_uvs = {selector: entries for table in output["cmap"].tables if table.format == 14 for selector, entries in table.uvsDict.items()}
        assert set(source_uvs) == set(output_uvs), (name, "variation selectors lost")
        for selector, entries in source_uvs.items():
            actual = dict(output_uvs[selector])
            assert set(actual) == {code for code, _ in entries}, (name, "variation sequences lost")
            for code, glyph in entries:
                before_glyph = glyph or source.getBestCmap()[code]
                after_glyph = actual[code] or output.getBestCmap()[code]
                assert signature(source, source_glyphs, before_glyph) == signature(output, glyphs, after_glyph), (name, "variation glyph changed")
        for code, glyph in output.getBestCmap().items():
            assert signature(source, source_glyphs, cmap[code]) == signature(output, glyphs, glyph), (name, hex(code), "outline/metrics/instructions")
            count += 1
        # Format-3 post tables assign new synthetic names after glyph renumbering.
        # Match every unencoded closure glyph by exact decomposed geometry,
        # metrics and instruction bytes, independent of those synthetic names.
        encoded = set(output.getBestCmap().values())
        closure = set(output.getGlyphOrder()) - encoded
        if closure:
            original_signatures = {signature(source, source_glyphs, glyph) for glyph in source.getGlyphOrder()}
            for glyph in closure:
                assert signature(output, glyphs, glyph) in original_signatures, (name, glyph, "closure outline/metrics/instructions")
        for name_id in [0, 13, 14]:
            assert {r.toUnicode() for r in source["name"].names if r.nameID == name_id} == {r.toUnicode() for r in output["name"].names if r.nameID == name_id}, (name, "notice")
    assert covered == set(cmap), (name, "lost coverage")
    results.append({"source": name, "mappedGlyphsCompared": count, "coverage": "exact disjoint union", "outlinesMetricsHintsNotices": "identical, including unencoded layout closure and .notdef"})
(ROOT / "docs/font-evidence/validation.json").write_text(json.dumps(results, indent=2) + "\n")
print(f"Validated {len(results)} fonts, {sum(r['mappedGlyphsCompared'] for r in results)} mapped glyphs")
