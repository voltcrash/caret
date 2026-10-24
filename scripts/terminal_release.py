"""Native release tooling. No publication; platform workflow owns authorized tags."""
import argparse
import hashlib
import json
import os
import pathlib
import shutil
import subprocess
import sys
import tarfile
import tempfile
import tomllib
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "target/terminal-release"
TARGETS = ("x86_64-unknown-linux-gnu", "aarch64-unknown-linux-gnu", "x86_64-apple-darwin", "aarch64-apple-darwin", "x86_64-pc-windows-msvc")


def run(args, **kwargs):
    return subprocess.run(args, cwd=ROOT, check=True, **kwargs)


def capture(args):
    return run(args, stdout=subprocess.PIPE, text=True).stdout


def version():
    return tomllib.loads((ROOT / "Cargo.toml").read_text())["workspace"]["package"]["version"]


def checksum(path):
    digest = hashlib.file_digest(path.open("rb"), "sha256").hexdigest()
    path.with_name(path.name + ".sha256").write_text(f"{digest}  {path.name}\n")


def archive(directory, windows=False):
    output = directory.with_name(directory.name + (".zip" if windows else ".tar.gz"))
    if windows:
        with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as package:
            for path in sorted(directory.rglob("*")):
                if path.is_file(): package.write(path, path.relative_to(directory.parent))
    else:
        with tarfile.open(output, "w:gz") as package:
            package.add(directory, arcname=directory.name)
    checksum(output)
    return output


def licenses(directory, target):
    metadata = json.loads(capture(["cargo", "metadata", "--locked", "--format-version", "1", "--filter-platform", target]))
    notices = []
    override_dir=ROOT / "docs/rust-engine/third-party"
    overrides=json.loads((override_dir / "license-overrides.json").read_text())
    for package in sorted(metadata["packages"], key=lambda p: (p["name"], p["version"])):
        if package["source"] is None: continue
        source = pathlib.Path(package["manifest_path"]).parent
        dest = directory / "licenses" / f'{package["name"]}-{package["version"]}'
        dest.mkdir(parents=True)
        files = [p for p in source.iterdir() if p.name.upper().startswith(("LICENSE", "LICENCE", "COPYING", "COPYRIGHT", "NOTICE"))]
        if package.get("license_file"):
            explicit = source / package["license_file"]
            if explicit not in files: files.append(explicit)
        override=overrides.get(f'{package["name"]}@{package["version"]}')
        if override:
            vcs=json.loads((source / ".cargo_vcs_info.json").read_text())
            license_path=override_dir / override["file"]
            assert vcs["git"]["sha1"]==override["vcsRevision"]
            assert package["license"]==override["license"]
            assert hashlib.sha256(license_path.read_bytes()).hexdigest()==override["sha256"]
            files.append(license_path)
        if not files: raise RuntimeError(f'No distributable license/notice file for {package["name"]}')
        for path in files:
            if path.is_dir(): shutil.copytree(path, dest / path.name, dirs_exist_ok=True)
            else: shutil.copy2(path, dest / path.name)
        notices.append({"name":package["name"],"version":package["version"],"license":package["license"],"repository":package["repository"]})
    (directory / "THIRD_PARTY.json").write_text(json.dumps({"scope":"Locked workspace dependency notices (superset of linked native crates)","packages":notices}, indent=2) + "\n")


def package(target):
    if target is None:
        target = next(line.split(": ", 1)[1] for line in capture(["rustc", "-vV"]).splitlines() if line.startswith("host: "))
    if target not in TARGETS: raise RuntimeError(f"Unsupported archive target: {target}")
    tag = os.environ.get("GITHUB_REF_NAME", "")
    if os.environ.get("GITHUB_REF_TYPE") == "tag" and tag != f"terminal-v{version()}":
        raise RuntimeError("Terminal tag must match Cargo workspace version")
    revision = os.environ.get("OXYTYPE_BUILD_REV") or capture(["git","rev-parse","HEAD"]).strip()
    if revision != capture(["git","rev-parse","HEAD"]).strip(): raise RuntimeError("Archive build revision must match checked-out source")
    run(["git","diff","--quiet","HEAD","--"])
    run(["cargo", "build", "--locked", "--release", "-p", "oxytype-tui", "--target", target],env=dict(os.environ,OXYTYPE_BUILD_REV=revision))
    name = f"oxytype-v{version()}-{target}"
    directory = OUT / name
    if directory.exists(): shutil.rmtree(directory)
    directory.mkdir(parents=True)
    binary = "oxytype.exe" if "windows" in target else "oxytype"
    shutil.copy2(ROOT / "target" / target / "release" / binary, directory / binary)
    for source, dest in [("LICENSE","LICENSE"),("crates/oxytype-tui/assets/ATTRIBUTION.md","ATTRIBUTION.md"),("docs/rust-engine/terminal.md","README.md"),("docs/rust-engine/terminal-content.md","terminal-content.md"),("docs/rust-engine/terminal-storage.md","terminal-storage.md")]:
        shutil.copy2(ROOT / source,directory / dest)
    (directory / "SOURCE.md").write_text(f"Source revision: {revision}\n\nGPL-3.0-only corresponding source is the matching oxytype-v{version()}-source.tar.gz release asset, including locked vendored dependencies.\n\nRepository: https://github.com/voltcrash/oxytype/tree/{revision}\n")
    licenses(directory,target)
    output = archive(directory,"windows" in target)
    print(f"Archive: {output}")
    return output


def smoke(path):
    expected=path.with_name(path.name+".sha256").read_text().split()[0]
    assert hashlib.sha256(path.read_bytes()).hexdigest()==expected, "Archive checksum mismatch"
    with tempfile.TemporaryDirectory(prefix="oxytype-install-") as temporary:
        directory=pathlib.Path(temporary)
        if path.suffix == ".zip":
            with zipfile.ZipFile(path) as package: package.extractall(directory)
        else:
            with tarfile.open(path) as package: package.extractall(directory,filter="data")
        binaries = list(directory.rglob("oxytype.exe" if os.name == "nt" else "oxytype"))
        if len(binaries)!=1: raise RuntimeError("Expected one installed executable")
        binary=binaries[0]
        isolated=directory / "empty";isolated.mkdir()
        env=dict(os.environ,PATH="")
        for args in [["--version"],["--help"],["--diagnostics"],["--smoke-test"]]:
            subprocess.run([str(binary),*args],cwd=isolated,env=env,check=True)
        diagnostic=subprocess.run([str(binary),"--diagnostics"],cwd=isolated,env=env,check=True,stdout=subprocess.PIPE,text=True,encoding="utf-8")
        version_info=json.loads(diagnostic.stdout)
        revision=(binary.parent / "SOURCE.md").read_text(encoding="utf-8").splitlines()[0].removeprefix("Source revision: ")
        assert f"build {revision})" in version_info["version"], "Binary/source provenance mismatch"
        assert version_info["architecture"]==("aarch64" if "aarch64" in binary.parent.name else "x86_64")
        export=isolated / "history.json"
        subprocess.run([str(binary),"--config-dir",str(isolated / "config"),"--data-dir",str(isolated / "data"),"--export",str(export)],cwd=isolated,env=env,check=True)
        assert json.loads(export.read_text())["results"]==[]
        if os.name != "nt":
            run([sys.executable,"scripts/terminal_pty.py",str(binary),"--release"])
        print("Installed archive: empty PATH/cwd, offline smoke, storage/export and supported POSIX PTY pass")


def source():
    OUT.mkdir(parents=True,exist_ok=True)
    directory=OUT / f"oxytype-v{version()}-source"
    if directory.exists(): shutil.rmtree(directory)
    directory.mkdir()
    snapshot=run(["git","archive","--format=tar","HEAD"],stdout=subprocess.PIPE).stdout
    import io
    with tarfile.open(fileobj=io.BytesIO(snapshot)) as package: package.extractall(directory,filter="data")
    config=subprocess.run(["cargo","vendor","--locked","--versioned-dirs","vendor"],cwd=directory,check=True,stdout=subprocess.PIPE,text=True).stdout
    cargo=directory / ".cargo";cargo.mkdir(exist_ok=True)
    with (cargo / "config.toml").open("a") as output: output.write("\n"+config)
    revision=os.environ.get("OXYTYPE_BUILD_REV") or capture(["git","rev-parse","HEAD"]).strip()
    (directory / "SOURCE_REVISION").write_text(revision+"\n")
    # Prove corresponding source can build without registry/network access.
    subprocess.run(["cargo","check","--offline","--locked","-p","oxytype-tui","--target-dir",str(ROOT / "target/terminal-source-check")],cwd=directory,env=dict(os.environ,OXYTYPE_BUILD_REV=revision),check=True)
    print(f"Corresponding source: {archive(directory)}")


def gate():
    matrix=json.loads((ROOT / "docs/rust-engine/terminal-verification.json").read_text())
    pending=[name for name,record in matrix["manualTerminals"].items() if record.get("status")!="pass" or not record.get("evidence")]
    if pending: raise RuntimeError("Release manual terminal gate pending: "+", ".join(pending))


def checksums(directory):
    expected=[f"oxytype-v{version()}-{target}"+(".zip" if "windows" in target else ".tar.gz") for target in TARGETS]+[f"oxytype-v{version()}-source.tar.gz"]
    rows=[]
    for name in expected:
        path=directory / name
        digest=hashlib.sha256(path.read_bytes()).hexdigest()
        assert path.with_name(name+".sha256").read_text().split()[0]==digest
        rows.append(f"{digest}  {name}\n")
    (directory / "SHA256SUMS").write_text("".join(rows))


if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("command",choices=["package","source","archive-smoke","release-gate","checksums"])
    parser.add_argument("--target")
    parser.add_argument("--archive",type=pathlib.Path)
    args=parser.parse_args()
    if args.command=="package": package(args.target)
    elif args.command=="source": source()
    elif args.command=="release-gate": gate()
    elif args.command=="checksums": checksums(args.archive.resolve())
    else:
        if args.archive is None:
            if args.target not in TARGETS: parser.error("--archive or a supported --target required")
            args.archive=OUT / (f"oxytype-v{version()}-{args.target}"+(".zip" if "windows" in args.target else ".tar.gz"))
        smoke(args.archive.resolve())
