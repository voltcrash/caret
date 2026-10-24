"""Real POSIX PTY lifecycle checks; no claimed hardware-terminal coverage."""
import errno
import fcntl
import os
import pathlib
import pty
import select
import signal
import struct
import subprocess
import sys
import termios
import time


def dimensions(slave, columns=100, rows=24):
    fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack("HHHH", rows, columns, 0, 0))


class Child:
    def __init__(self, binary, failure=None):
        self.master, self.slave = pty.openpty()
        dimensions(self.slave)
        self.original = termios.tcgetattr(self.slave)
        self.output = bytearray()
        env = dict(os.environ, TERM="xterm-256color")
        if failure:
            env["OXYTYPE_TERMINAL_TEST_FAILURE"] = failure

        def controlling_terminal():
            os.setsid()
            fcntl.ioctl(self.slave, termios.TIOCSCTTY, 0)

        self.process = subprocess.Popen([binary], stdin=self.slave, stdout=self.slave,
                                        stderr=self.slave, env=env,
                                        preexec_fn=controlling_terminal)

    def read(self, seconds=0.05):
        if select.select([self.master], [], [], seconds)[0]:
            try:
                self.output.extend(os.read(self.master, 65536))
            except OSError as error:
                if error.errno != errno.EIO:
                    raise

    def until(self, text, seconds=5):
        deadline = time.monotonic() + seconds
        start = len(self.output)
        while time.monotonic() < deadline:
            self.read()
            if text in self.output[start:]:
                return
            if self.process.poll() is not None:
                break
        raise AssertionError(f"Missing {text!r}; process={self.process.poll()}; output={bytes(self.output[-2000:])!r}")

    def send(self, text):
        os.write(self.master, text)

    def restored(self):
        current = termios.tcgetattr(self.slave)
        mask = termios.ICANON | termios.ECHO
        assert current[3] & mask == self.original[3] & mask, "raw/echo state leaked"
        while select.select([self.master], [], [], 0)[0]:
            self.read(0)
        assert b"\x1b[?1049l" in self.output, "alternate screen not restored"
        assert b"\x1b[?2004l" in self.output, "bracketed paste not disabled"

    def close(self):
        if self.process.poll() is None:
            os.kill(self.process.pid, signal.SIGCONT)
            self.process.kill()
            self.process.wait(timeout=3)
        os.close(self.master)
        os.close(self.slave)


def run(binary):
    child = Child(binary)
    try:
        child.until(b"Oxytype")
        assert termios.tcgetattr(child.slave)[3] & termios.ICANON == 0
        child.send(b"one ")
        time.sleep(0.15)
        child.send(b"\x1b[19~")  # F8 is available without enhanced Ctrl+Enter.
        child.until(b"F5 new test")
        child.send(b"\x1b[15~")
        child.until(b"Input:")
        dimensions(child.slave, 30, 8)
        os.kill(child.process.pid, signal.SIGWINCH)
        # Ratatui skips blank cells with cursor moves; words need not be emitted
        # as one contiguous byte string in a real incremental terminal frame.
        child.until(b"Resize")
        dimensions(child.slave)
        os.kill(child.process.pid, signal.SIGWINCH)
        child.until(b"Oxytype")
        child.send(b"\x11")
        assert child.process.wait(timeout=5) == 0
        child.restored()
    finally:
        child.close()

    for failure in ("error", "panic", "signal", "suspend"):
        child = Child(binary, failure if failure in ("error", "panic") else None)
        try:
            if failure in ("error", "panic"):
                assert child.process.wait(timeout=5) != 0
            else:
                child.until(b"Oxytype")
                if failure == "signal":
                    os.kill(child.process.pid, signal.SIGTERM)
                else:
                    os.kill(child.process.pid, signal.SIGTSTP)
                    deadline = time.monotonic() + 5
                    while time.monotonic() < deadline:
                        pid, status = os.waitpid(child.process.pid, os.WNOHANG | os.WUNTRACED)
                        if pid and os.WIFSTOPPED(status):
                            break
                        time.sleep(0.02)
                    else:
                        raise AssertionError("Did not suspend")
                    child.restored()
                    os.kill(child.process.pid, signal.SIGCONT)
                    child.until(b"Oxytype")
                    child.send(b"\x11")
                assert child.process.wait(timeout=5) == 0
            child.restored()
        finally:
            child.close()
    print("PTY: typing/finish/restart/resize/quit, error, panic, SIGTERM, suspend/resume pass")


if __name__ == "__main__":
    run(str(pathlib.Path(sys.argv[1]).resolve()))
