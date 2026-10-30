"""Manual, unshipped CJK fallback fixture; never installs system fonts."""
import hashlib
import json
from pathlib import Path
import urllib.request

root = Path(__file__).resolve().parents[2]
record = json.loads((root / "docs/font-evidence/system-font.json").read_text())
directory = Path("/tmp/caret-font-system")
directory.mkdir(exist_ok=True)
font = directory / "NotoSansCJKsc-Regular.otf"
if not font.exists():
    font.write_bytes(urllib.request.urlopen(record["url"]).read())
assert hashlib.sha256(font.read_bytes()).hexdigest() == record["sha256"]
(directory / "fonts.conf").write_text(
    '<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">'
    '<fontconfig><include>/etc/fonts/fonts.conf</include>'
    '<dir>/tmp/caret-font-system</dir>'
    '<cachedir>/tmp/caret-font-system/cache</cachedir></fontconfig>'
)
print("FONTCONFIG_FILE=/tmp/caret-font-system/fonts.conf")
