"""Archive portability regressions using actual files and extraction."""
import hashlib
import os
import pathlib
import tempfile
import unittest
import zipfile
from scripts import terminal_release


class ArchiveTest(unittest.TestCase):
    def test_windows_zip_accepts_registry_epoch_timestamps_without_changing_bytes(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory=pathlib.Path(temporary) / "candidate"
            directory.mkdir()
            source=directory / "LICENSE"
            content=b"License bytes\n\x00\xff"
            source.write_bytes(content)
            os.utime(source,(1,1))  # Cargo registry files can predate ZIP's 1980 epoch.
            archive=terminal_release.archive(directory,windows=True)
            with zipfile.ZipFile(archive) as package:
                self.assertEqual(package.read("candidate/LICENSE"),content)
                self.assertEqual(package.getinfo("candidate/LICENSE").date_time[0],1980)
            self.assertEqual(source.read_bytes(),content)
            self.assertEqual(int(source.stat().st_mtime),1)
            expected=archive.with_name(archive.name+".sha256").read_text().split()[0]
            self.assertEqual(hashlib.sha256(archive.read_bytes()).hexdigest(),expected)


if __name__=="__main__":
    unittest.main()
