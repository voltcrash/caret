"""Window discovery with delayed software rendering and failed emulator startup."""
import pathlib
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch

sys.path.insert(0,str(pathlib.Path(__file__).parent))
from scripts import terminal_emulator


class WindowTest(unittest.TestCase):
    def setUp(self):
        self.temporary=tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.log=pathlib.Path(self.temporary.name) / "emulator.log"
        self.log.write_text("renderer startup failed")

    def test_cold_window_can_map_after_the_old_ten_second_budget(self):
        process=Mock()
        process.poll.return_value=None
        replies=[subprocess.CompletedProcess([],1,"",""),
                 subprocess.CompletedProcess([],1,"",""),
                 subprocess.CompletedProcess([],0,"42\n43\n","")]
        with patch.object(terminal_emulator.time,"monotonic",side_effect=[0,1,20,40]), \
             patch.object(terminal_emulator.time,"sleep"), \
             patch.object(terminal_emulator.subprocess,"run",side_effect=replies) as run:
            self.assertEqual(terminal_emulator.wait_for_window(process,"xdotool","test.window",self.log),"43")
        self.assertNotIn("--sync",run.call_args.args[0])
        self.assertEqual(run.call_args.args[0][-1],r"^test\.window$")

    def test_early_exit_reports_the_emulator_log_without_waiting(self):
        process=Mock()
        process.poll.return_value=1
        with patch.object(terminal_emulator.subprocess,"run") as run:
            with self.assertRaisesRegex(AssertionError,"renderer startup failed"):
                terminal_emulator.wait_for_window(process,"xdotool","test",self.log)
        run.assert_not_called()

    def test_timeout_remains_bounded_and_reports_the_emulator_log(self):
        process=Mock()
        process.poll.return_value=None
        with patch.object(terminal_emulator.time,"monotonic",side_effect=[0,61]):
            with self.assertRaisesRegex(AssertionError,"within 60s"):
                terminal_emulator.wait_for_window(process,"xdotool","test",self.log)


if __name__=="__main__":
    unittest.main()
