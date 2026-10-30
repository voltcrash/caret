"""One-time upstream license collection; generated assets never fetch the network."""
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import urllib.request

from inventory import ROOT

special = {
    "0xProto": "0xType/0xProto/main/LICENSE",
    "AdwaitaMono": "be5invis/Iosevka/main/LICENSE.md",
    "Boon": "fontuni/boon/master/OFL.txt",
    "CascadiaMono": "microsoft/cascadia-code/main/LICENSE",
    "CommitMono": "eigilnikolajsen/commit-mono/main/LICENSE",
    "FiraCode": "tonsky/FiraCode/master/LICENSE",
    "Geist": "vercel/geist-font/main/LICENSE",
    "GeistMono": "vercel/geist-font/main/LICENSE",
    "Hack": "source-foundry/Hack/master/LICENSE.md",
    "Iosevka": "be5invis/Iosevka/main/LICENSE.md",
    "Mononoki": "madmalik/mononoki/main/LICENSE",
    "OpenDyslexic": "antijingoist/open-dyslexic/master/OFL.txt",
    "SourceCodePro": "adobe-fonts/source-code-pro/release/LICENSE.md",
    "SpaceGrotesk": "floriankarsten/space-grotesk/master/LICENSE",
    "Vazirharf-NL": "nadalaba/vazirharf/master/OFL.txt",
}
inventory = json.loads((ROOT / "docs/font-evidence/baseline-inventory.json").read_text())
out = ROOT / "frontend/static/webfont-licenses"
out.mkdir(parents=True, exist_ok=True)


def fetch(item):
    path, record = item
    if not path.startswith("frontend/") or "Gallaudet" in path:
        return None
    name = Path(path).stem.removesuffix("-Regular").removesuffix("-SemiBold").removesuffix("-Medium").removesuffix("-Bold")
    if name == "OpenDyslexic":
        data = record["names"]["13"][0].encode()
        (out / (name + ".txt")).write_bytes(data)
        return path, {"url": "embedded name ID 13 at original revision", "sha256": hashlib.sha256(data).hexdigest(), "file": name + ".txt"}
    if name in ["Ubuntu", "UbuntuMono"]:
        urls = ["https://raw.githubusercontent.com/google/fonts/main/ufl/" + name.lower() + "/UFL.txt"]
    elif name in ["Roboto", "RobotoMono", "ComingSoon"]:
        urls = ["https://raw.githubusercontent.com/google/fonts/main/apache/" + name.lower() + "/LICENSE.txt", "https://www.apache.org/licenses/LICENSE-2.0.txt"]
    else:
        urls = ["https://raw.githubusercontent.com/" + special[name]] if name in special else []
        urls += ["https://raw.githubusercontent.com/google/fonts/main/ofl/" + name.lower() + "/OFL.txt"]
    for url in urls:
        try:
            data = urllib.request.urlopen(url, timeout=20).read()
            if b"LICENSE" not in data.upper() and b"LICENCE" not in data.upper():
                continue
            notice = "\n".join(record["names"].get("0", []))
            distributed = (notice + "\n\n").encode() + data if notice not in data.decode() else data
            (out / (name + ".txt")).write_bytes(distributed)
            return path, {"url": url, "upstreamSha256": hashlib.sha256(data).hexdigest(), "distributedSha256": hashlib.sha256(distributed).hexdigest(), "file": name + ".txt"}
        except Exception:
            continue
    print("MISSING", path)
    return path, {"missing": True}


with ThreadPoolExecutor(max_workers=8) as pool:
    results = dict(r for r in pool.map(fetch, inventory["files"].items()) if r)
(out / "sources.json").write_text(json.dumps(results, indent=2) + "\n")
