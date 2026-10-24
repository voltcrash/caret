"""Real POSIX PTY lifecycle checks; no claimed hardware-terminal coverage."""
import errno
import fcntl
import os
import pathlib
import pty
import re
import select
import signal
import sqlite3
import json
import struct
import subprocess
import sys
import termios
import tempfile
import time
import unicodedata


def dimensions(slave, columns=100, rows=24):
    fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack("HHHH", rows, columns, 0, 0))


class Child:
    def __init__(self, binary, failure=None, args=(), enhanced=False):
        self.profile = tempfile.TemporaryDirectory(prefix="oxytype-pty-")
        self.enhanced = enhanced
        self.query_replied = False
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

        self.process = subprocess.Popen([binary, "--config-dir", self.profile.name + "/config", "--data-dir", self.profile.name + "/data", "--keyboard", "auto" if enhanced else "basic", *args], stdin=self.slave, stdout=self.slave,
                                        stderr=self.slave, env=env,
                                        preexec_fn=controlling_terminal)

    def read(self, seconds=0.05):
        if select.select([self.master], [], [], seconds)[0]:
            try:
                self.output.extend(os.read(self.master, 65536))
                if self.enhanced and not self.query_replied and b"\x1b[?u" in self.output:
                    # Protocol simulation, not a claim of hardware-terminal coverage.
                    self.send(b"\x1b[?0u\x1b[?1;2c")
                    self.query_replied = True
            except OSError as error:
                if error.errno != errno.EIO:
                    raise

    def until(self, text, seconds=5):
        deadline = time.monotonic() + seconds
        while time.monotonic() < deadline:
            self.read()
            if text.decode("utf-8") in self.screen_text():
                return
            if self.process.poll() is not None:
                break
        raise AssertionError(f"Missing {text!r}; process={self.process.poll()}; output={bytes(self.output[-2000:])!r}")

    def screen_text(self):
        # Minimal VT screen reader for assertions. Preserve unchanged cells and
        # cursor moves between Ratatui frames, unlike stripping ANSI bytes.
        grid, row, col = {}, 0, 0
        data = self.output.decode("utf-8", errors="replace")
        i = 0
        while i < len(data):
            if data[i] == "\x1b":
                match = re.match(r"\x1b\[([0-?]*)([ -/]*)([@-~])", data[i:])
                if match:
                    params, _, command = match.groups()
                    private = params.startswith("?")
                    values = [int(v or 0) for v in params.lstrip("?>").split(";") if v.isdigit() or not v]
                    first = (values or [0])[0]
                    amount = first or 1
                    if command in ("H", "f"):
                        row = amount - 1
                        col = (values[1] or 1) - 1 if len(values) > 1 else 0
                    elif command == "G": col = amount - 1
                    elif command == "d": row = amount - 1
                    elif command == "A": row = max(0, row - amount)
                    elif command == "B": row += amount
                    elif command == "C": col += amount
                    elif command == "D": col = max(0, col - amount)
                    elif command == "J" and first in (2, 3): grid.clear()
                    elif command == "K":
                        for key in list(grid):
                            if key[0] == row and (first == 2 or (first == 0 and key[1] >= col) or (first == 1 and key[1] <= col)):
                                del grid[key]
                    elif command == "h" and private and first == 1049:
                        grid.clear(); row = col = 0
                    i += len(match.group())
                    continue
                i += 2
                continue
            char = data[i]
            if char == "\r": col = 0
            elif char == "\n": row += 1
            elif not unicodedata.category(char).startswith("C"):
                grid[row, col] = char
                col += 0 if unicodedata.combining(char) else (2 if unicodedata.east_asian_width(char) in ("W", "F") else 1)
            i += 1
        return "\n".join("".join(grid.get((y, x), " ") for x in range(200)) for y in range(100))

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
        self.profile.cleanup()


def run(binary):
    child = Child(binary)
    try:
        child.until(b"Oxytype")
        assert termios.tcgetattr(child.slave)[3] & termios.ICANON == 0
        child.send(b"one ")
        time.sleep(0.15)
        child.send(b"\x1b[19~")  # F8 is available without enhanced Ctrl+Enter.
        child.until(b"F5 new test")
        child.until(b"Result saved locally.")
        history_path = pathlib.Path(child.profile.name) / "data/history.sqlite3"
        with sqlite3.connect(history_path) as db:
            record = json.loads(db.execute("SELECT json FROM results").fetchone()[0])
            assert record["replayLog"] is None
            assert record["summary"]["keyDuration"] is None
        child.send(b"\x1bOR")  # F3 history
        child.until(b"Local history")
        child.send(b"\x1b[18~")  # F7 export
        child.until(b"Exported")
        exported = list((pathlib.Path(child.profile.name) / "data").glob("export-*.json"))
        assert len(exported) == 1
        assert json.loads(exported[0].read_text())["results"][0]["id"] == record["id"]
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

    for mode in ("time", "words", "quote", "custom", "zen"):
        args = ["--mode", mode]
        if mode == "custom":
            args += ["--text", "one two three"]
        child = Child(binary, args=args)
        try:
            child.until(b"Oxytype")
            child.send(b"one ")
            time.sleep(0.15)
            child.send(b"\x1b[19~")
            child.until(b"F5 new test")
            child.send(b"\x11")
            assert child.process.wait(timeout=5) == 0
            child.restored()
        finally:
            child.close()

    child = Child(binary)
    try:
        child.until(b"Oxytype")
        child.send(b"\x1bOQ")  # F2: settings
        child.until(b"select")
        child.send(b"\x1bOS")  # F4: private editor
        child.until(b"Private")
        child.send(b"\x1b[200~one two\x1b[201~")
        time.sleep(0.1)
        child.send(b"\x1b[19~")
        child.until(b"Input:")
        child.send(b"one ")
        time.sleep(0.15)
        child.send(b"two")
        child.until(b"F5 new test")
        child.send(b"\x11")
        assert child.process.wait(timeout=5) == 0
        child.restored()
    finally:
        child.close()

    child = Child(binary, args=["--mode", "custom", "--text", "one two", "--record-replay"])
    try:
        child.until(b"RECORDING PRIVATE TEXT")
        child.send(b"one ")
        time.sleep(0.15)
        child.send(b"two")
        child.until(b"Result saved locally.")
        child.send(b"\x1bOR")
        child.until(b"Local history")
        child.send(b"\x1b[19~")
        child.until(b"Recorded replay")
        child.send(b"\x1b[C")
        child.until(b"step 1")
        child.send(b"\x11")
        assert child.process.wait(timeout=5) == 0
        child.restored()
    finally:
        child.close()

    child = Child(binary, args=["--mode", "zen"], enhanced=True)
    try:
        child.until(b"Oxytype")
        assert b"\x1b[>3u" in child.output, "enhanced flags not pushed"
        child.send(b"\x1b[97;1u\x1b[97;1:2u\x1b[97;1:3u")  # press/repeat/release
        child.until(b"Input: aa")
        child.send(b"\x1bOP")
        child.until(b"Keyboard: enhanced")
        child.until(b"release observed: true")
        child.send(b"\x11")
        assert child.process.wait(timeout=5) == 0
        child.restored()
        assert b"\x1b[<1u" in child.output, "enhanced flags not popped"
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
    print("PTY: five modes, settings/custom editor, typing/finish/restart/resize/quit, error, panic, SIGTERM, suspend/resume pass")


if __name__ == "__main__":
    run(str(pathlib.Path(sys.argv[1]).resolve()))
