"""Archive integrity and supported release targets, using actual files."""
import hashlib
import os
import pathlib
import tarfile
import tempfile
import unittest
from unittest.mock import patch
from scripts import terminal_release


class ArchiveTest(unittest.TestCase):
    def test_tar_preserves_binary_bytes_permissions_and_registry_timestamps(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory=pathlib.Path(temporary) / "candidate"
            directory.mkdir()
            source=directory / "oxytype"
            content=b"Binary bytes\n\x00\xff"
            source.write_bytes(content)
            source.chmod(0o755)
            os.utime(source,(1,1))
            archive=terminal_release.archive(directory)
            with tarfile.open(archive) as package:
                member=package.getmember("candidate/oxytype")
                self.assertEqual(package.extractfile(member).read(),content)
                self.assertEqual(member.mode,0o755)
                self.assertEqual(member.mtime,1)
            self.assertEqual(source.read_bytes(),content)
            self.assertEqual(int(source.stat().st_mtime),1)
            expected=archive.with_name(archive.name+".sha256").read_text().split()[0]
            self.assertEqual(hashlib.sha256(archive.read_bytes()).hexdigest(),expected)

    def test_unsupported_target_rejected_before_building(self):
        with patch.object(terminal_release,"run") as run:
            with self.assertRaisesRegex(RuntimeError,"Unsupported archive target"):
                terminal_release.package("x86_64-pc-windows-msvc")
            run.assert_not_called()

    def test_checksums_require_four_unix_binaries_and_corresponding_source(self):
        self.assertEqual(set(terminal_release.TARGETS),{
            "x86_64-unknown-linux-gnu", "aarch64-unknown-linux-gnu",
            "x86_64-apple-darwin", "aarch64-apple-darwin",
        })
        with tempfile.TemporaryDirectory() as temporary:
            root=pathlib.Path(temporary)
            names=[f"oxytype-v{terminal_release.version()}-{target}.tar.gz" for target in (*terminal_release.TARGETS,"source")]
            for name in names:
                path=root / name
                path.write_bytes(name.encode())
                terminal_release.checksum(path)
            terminal_release.checksums(root)
            self.assertEqual(len((root / "SHA256SUMS").read_text().splitlines()),5)
            (root / names[0]).write_bytes(b"corruption")
            with self.assertRaises(AssertionError): terminal_release.checksums(root)


if __name__=="__main__":
    unittest.main()
