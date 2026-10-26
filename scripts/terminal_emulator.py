"""Real Linux X11 emulator checks via XTest; no simulated keyboard replies.

Starts its own private Xvfb server; requires Xvfb, xdotool and an emulator.
The recorder forwards bytes unchanged through a PTY, retaining the app output
and cleanup evidence. Only test-owned windows, profiles and processes are used.
"""
import argparse
import ctypes
import hashlib
import json
import os
import pathlib
import re
import select
import signal
import sqlite3
import subprocess
import sys
import tempfile
import termios
import time
import tty
from terminal_pty import Child, dimensions, screen_text


def wait_for_window(process, xdotool, title, log_path, timeout=60):
    # A cold software renderer can take longer than the input checks' 10s budget.
    # Poll instead of blocking in xdotool --sync, so early exits retain diagnostics.
    deadline=time.monotonic()+timeout
    while time.monotonic()<deadline and process.poll() is None:
        result=subprocess.run([xdotool,"search","--onlyvisible","--name","^"+re.escape(title)+"$"],
                              capture_output=True,text=True,timeout=2)
        if result.returncode==0 and result.stdout.strip():
            return result.stdout.strip().splitlines()[-1]
        if result.returncode not in (0,1):
            raise RuntimeError("Cannot search private X display: "+result.stderr)
        time.sleep(0.1)
    raise AssertionError(f"Visible emulator window not found within {timeout}s (exit={process.poll()})\n{log_path.read_text()[-2000:]}")


def write_all(fd, data):
    while data:
        count=os.write(fd,data)
        data=data[count:]


def record(binary, profile, keyboard):
    original=termios.tcgetattr(0)
    child=Child(binary, args=["--mode","zen","--record-replay"],
                keyboard=keyboard, term=os.environ.get("TERM","xterm-256color"))
    written=0
    def resized(*_):
        size=os.get_terminal_size(0)
        dimensions(child.slave,size.columns,size.lines)
    try:
        tty.setraw(0)
        signal.signal(signal.SIGWINCH,resized)
        resized()
        (profile / "ready.json").write_text(json.dumps({"pid":child.process.pid,"term":os.environ.get("TERM"),"dataDir":child.profile.name+"/data"}))
        with (profile / "output.vt").open("wb",buffering=0) as trace, (profile / "input.vt").open("wb",buffering=0) as input_trace:
            while not child.status_path.exists():
                child.read(0.01)
                if len(child.output)>written:
                    data=child.output[written:]
                    trace.write(data)
                    write_all(1,data)
                    written=len(child.output)
                if select.select([0],[],[],0)[0]:
                    data=os.read(0,65536)
                    if not data: raise RuntimeError("Emulator input closed before app exit")
                    input_trace.write(data)
                    child.send(data)
            status=child.wait_exit()
            child.restored()
            data=child.output[written:]
            trace.write(data)
            write_all(1,data)
        # Ask the real emulator after the app popped its owned alternate-screen
        # keyboard frame. A fresh query must report zero, not leaked flags.
        write_all(1,b"\x1b[?u\x1b[c")
        reply=bytearray()
        deadline=time.monotonic()+2
        while time.monotonic()<deadline:
            if select.select([0],[],[],0.05)[0]:
                reply.extend(os.read(0,65536))
                if re.search(rb"\x1b\[\?\d+u",reply): break
        keyboard_flags=re.search(rb"\x1b\[\?(\d+)u",reply)
        with sqlite3.connect(pathlib.Path(child.profile.name) / "data/history.sqlite3") as db:
            results=[json.loads(row[0]) for row in db.execute("SELECT json FROM results ORDER BY rowid")]
        (profile / "result.json").write_text(json.dumps({
            "exitCode":status,"rawModeRestored":True,
            "keyboardFlagsAfterExit":int(keyboard_flags[1]) if keyboard_flags else None,
            "results":results,
        }))
    finally:
        child.close()
        termios.tcsetattr(0,termios.TCSANOW,original)


def check(args):
    # Own the entire X server: no user windows, focus or keyboard map is touched.
    with tempfile.TemporaryDirectory(prefix="caret-xserver-") as temporary:
        reader,writer=os.pipe()
        with (pathlib.Path(temporary) / "xserver.log").open("w") as log:
            server=subprocess.Popen([args.xvfb,"-displayfd",str(writer),"-noreset","-screen","0","1280x800x24","-nolisten","tcp"],
                                    pass_fds=[writer],stdout=log,stderr=log)
            os.close(writer)
            try:
                if not select.select([reader],[],[],10)[0]:
                    raise RuntimeError("Xvfb did not allocate a private display")
                number=os.read(reader,64).decode().strip()
                if not number.isdigit(): raise RuntimeError("Xvfb failed: "+log.name)
                os.environ["DISPLAY"]=":"+number
                # Preload Unicode test keysyms before emulators cache XKB maps.
                # xdotool's on-demand remapping races clients and truncates emoji.
                x11=ctypes.CDLL("libX11.so.6")
                x11.XOpenDisplay.restype=ctypes.c_void_p
                x11.XOpenDisplay.argtypes=[ctypes.c_char_p]
                display=x11.XOpenDisplay(os.environ["DISPLAY"].encode())
                if not display: raise RuntimeError("Cannot open private X display")
                x11.XChangeKeyboardMapping.argtypes=[ctypes.c_void_p,ctypes.c_int,ctypes.c_int,ctypes.POINTER(ctypes.c_ulong),ctypes.c_int]
                x11.XSync.argtypes=[ctypes.c_void_p,ctypes.c_int]
                x11.XCloseDisplay.argtypes=[ctypes.c_void_p]
                # Use ordinary letter positions: some GLFW versions ignore text
                # from unrecognized multimedia scancodes even with Unicode keysyms.
                for code,symbol in [(24,0x010000e9),(29,0x01000301),(30,0x0100754c),(31,0x0101f600)]:
                    symbols=(ctypes.c_ulong*1)(symbol)
                    x11.XChangeKeyboardMapping(display,code,1,symbols,1)
                x11.XSync(display,False)
                x11.XCloseDisplay(display)
                exercise(args)
            finally:
                os.close(reader)
                server.terminate()
                try: server.wait(timeout=5)
                except subprocess.TimeoutExpired: server.kill();server.wait(timeout=5)


def exercise(args):
    emulator=str(pathlib.Path(args.command).resolve())
    binary=str(pathlib.Path(args.binary).resolve())
    version=subprocess.run([emulator,"--version"],capture_output=True,text=True,check=True,timeout=10).stdout.strip()
    binary_version=subprocess.run([binary,"--version"],capture_output=True,text=True,check=True,timeout=10).stdout.strip()
    binary_sha256=hashlib.sha256(pathlib.Path(binary).read_bytes()).hexdigest()
    evidence=[]
    output=pathlib.Path(args.evidence).resolve() if args.evidence else None
    if output: output.mkdir(parents=True,exist_ok=True)
    for keyboard in ("auto","basic"):
        with tempfile.TemporaryDirectory(prefix="caret-emulator-") as temporary:
            profile=pathlib.Path(temporary)
            title="caret-check-"+profile.name
            child=[sys.executable,str(pathlib.Path(__file__).resolve()),"--record",binary,str(profile),keyboard]
            if args.emulator=="kitty":
                command=[emulator,"--config","NONE","--override","linux_display_server=x11",
                         "--override","update_check_interval=0","--override","initial_window_width=100c",
                         "--override","initial_window_height=30c","--title",title,*child]
            elif args.emulator=="alacritty":
                command=[emulator,"--config-file","/dev/null","--title",title,
                         "--option","window.dimensions.columns=100","--option","window.dimensions.lines=30","-e",*child]
            else:
                command=[emulator,"--config-default-files=false","--gtk-single-instance=false",
                         "--title="+title,"--window-width=100","--window-height=30","-e",*child]
            env=dict(os.environ,GDK_BACKEND="x11",XDG_CONFIG_HOME=str(profile / "config"),
                     XDG_CACHE_HOME=str(profile / "cache"))
            env.pop("WAYLAND_DISPLAY",None)
            with (profile / "emulator.log").open("w") as log:
                process=subprocess.Popen(command,env=env,stdout=log,stderr=log)
                try:
                    def wait(test, label, timeout=10):
                        deadline=time.monotonic()+timeout
                        while time.monotonic()<deadline:
                            if test(): return
                            if process.poll() is not None: break
                            time.sleep(0.02)
                        trace=(profile / "output.vt").read_bytes() if (profile / "output.vt").exists() else b""
                        raise AssertionError(f"{args.emulator}/{keyboard}: {label}\n{screen_text(trace)[:4000]}\n{(profile / 'emulator.log').read_text()[-2000:]}")
                    def visible(text):
                        wait(lambda: (profile / "output.vt").exists() and text in screen_text((profile / "output.vt").read_bytes()),text)
                    def xdo(*command):
                        return subprocess.run([args.xdotool,*command],capture_output=True,text=True,check=True,timeout=10).stdout.strip()
                    # Older Kitty versions defer PTY query handling until their
                    # window is focused. Focus the mapped window before waiting
                    # for the app's keyboard handshake and first frame.
                    window=wait_for_window(process,args.xdotool,title,profile / "emulator.log")
                    xdo("windowfocus",window)
                    visible("quote  zen  custom")  # Idle test config bar.
                    def key(*keys):
                        # XTest physical codes avoid xdotool's duplicate F-key
                        # aliases and numeric/Unicode name parsing ambiguities.
                        unicode_codes={"U00E9":24,"U0301":29,"U754C":30,"U1F600":31}
                        for k in keys:
                            code=unicode_codes.get(k,66+int(k[1:]) if re.fullmatch(r"F\d+",k) else None)
                            if code is None:
                                xdo("key","--delay","20",k)
                                continue
                            x11=ctypes.CDLL("libX11.so.6")
                            x11.XOpenDisplay.restype=ctypes.c_void_p
                            display=x11.XOpenDisplay(None)
                            if not display: raise RuntimeError("Private X display closed")
                            xtst=ctypes.CDLL("libXtst.so.6")
                            xtst.XTestFakeKeyEvent.argtypes=[ctypes.c_void_p,ctypes.c_uint,ctypes.c_int,ctypes.c_ulong]
                            assert xtst.XTestFakeKeyEvent(display,code,True,0)
                            assert xtst.XTestFakeKeyEvent(display,code,False,0)
                            x11.XSync.argtypes=[ctypes.c_void_p,ctypes.c_int]
                            x11.XSync(display,False)
                            x11.XCloseDisplay.argtypes=[ctypes.c_void_p]
                            x11.XCloseDisplay(display)
                    def type_text(text): xdo("type","--delay","10",text)
                    key("A","B","exclam")
                    visible("AB!")
                    # GTK consumes a standalone combining-key press as IME
                    # preedit in Ghostty basic mode. Test its committed accented
                    # character; all enhanced paths exercise combining clusters.
                    accent="é" if args.emulator=="ghostty" and keyboard=="basic" else "e\u0301"
                    if accent=="é": key("U00E9")
                    else:
                        type_text("e")
                        key("U0301")
                    visible("AB!"+accent)
                    key("U754C")
                    visible("AB!"+accent+"界")
                    key("U1F600")
                    visible("AB!"+accent+"界😀")
                    key("BackSpace")
                    wait(lambda: "😀" not in screen_text((profile / "output.vt").read_bytes()),"emoji deleted")
                    key("BackSpace","BackSpace")
                    wait(lambda: "界" not in screen_text((profile / "output.vt").read_bytes()),"graphemes deleted")
                    key("ctrl+BackSpace" if keyboard=="auto" else "alt+BackSpace")
                    type_text("repeat")
                    xdo("keydown","x")
                    time.sleep(0.8)
                    xdo("keyup","x")
                    visible("repeatxx")
                    key("F1")
                    visible("protocol "+("enhanced" if keyboard=="auto" else "basic"))
                    # Default negotiation deliberately does not request releases;
                    # explicit reported release/repeat packets are covered in PTY.
                    visible("release observed no")
                    key("Escape")
                    visible("repeatxx")
                    xdo("windowsize",window,"380","180")
                    visible("resize to at least")
                    type_text("BLOCKED")
                    # Ghostty's default Ctrl+Enter binding toggles fullscreen and
                    # never reaches the app. F8 is the portable finish binding.
                    key("ctrl+Return" if keyboard=="auto" and args.emulator!="ghostty" else "F8")
                    # Finish while undersized, then await the durable result before
                    # resizing: XTest delivery is asynchronous, and enlarging early
                    # would allow queued keys to arrive in a correctly enabled UI.
                    def saved():
                        ready=json.loads((profile / "ready.json").read_text())
                        with sqlite3.connect(pathlib.Path(ready["dataDir"]) / "history.sqlite3") as db:
                            return db.execute("SELECT count(*) FROM results").fetchone()[0]==1
                    wait(saved,"result saved while undersized")
                    xdo("windowsize",window,"1000","650")
                    visible("Result saved locally.")
                    key("F3")
                    visible("Local history")
                    key("F8")
                    visible("watch replay")
                    key("Right")
                    visible("step 1")
                    key("Escape","F5","F4")
                    visible("type or paste")
                    type_text("one two")
                    key("F8")
                    visible("quote  zen  custom")
                    type_text("one twx")
                    key("BackSpace","o")
                    visible("Result saved locally.")
                    key("F10")
                    wait(lambda:(profile / "result.json").exists(),"clean exit")
                    result=json.loads((profile / "result.json").read_text())
                    assert result["exitCode"]==0 and result["rawModeRestored"],result
                    assert result["keyboardFlagsAfterExit"]==0,result
                    assert len(result["results"])==2,result
                    zen,custom=result["results"]
                    inputs=[e["data"] for e in zen["replayLog"]["events"] if e["type"]=="input"]
                    final=inputs[-1]["inputValue"]
                    assert final[:6]==list(map(ord,"repeat")) and len(final)>7,final
                    assert all(c==ord("x") for c in final[6:]),final
                    assert zen["capabilities"]["enhancedKeyboardNegotiated"]==(keyboard=="auto")
                    assert zen["summary"]["keyDuration"] is None
                    assert custom["summary"]["acc"]==87.5,custom
                    evidence.append({"emulator":args.emulator,"version":version,"appVersion":binary_version,"binarySha256":binary_sha256,"keyboard":keyboard,
                                     "term":json.loads((profile / "ready.json").read_text())["term"],
                                     "exitCode":0,"keyboardFlagsAfterExit":0,"customAccuracy":87.5,
                                     "repeatDeliveries":len(final)-6,"accentInput":accent,"capabilities":zen["capabilities"]})
                    print(f"{args.emulator}/{keyboard}: real keys, Unicode/grapheme delete, repeat/release, resize, finish, history/replay/editor, native score, cleanup pass",flush=True)
                finally:
                    if output:
                        import shutil
                        shutil.copytree(profile,output / (args.emulator+"-"+keyboard),dirs_exist_ok=True)
                    if (profile / "ready.json").exists():
                        pid=json.loads((profile / "ready.json").read_text())["pid"]
                        try: os.killpg(pid,signal.SIGCONT);os.killpg(pid,signal.SIGKILL)
                        except ProcessLookupError: pass
                    if process.poll() is None: process.terminate()
                    try: process.wait(timeout=5)
                    except subprocess.TimeoutExpired: process.kill();process.wait(timeout=5)
    if output: (output / (args.emulator+".json")).write_text(json.dumps(evidence,indent=2)+"\n")


if __name__=="__main__":
    if len(sys.argv)>1 and sys.argv[1]=="--record":
        record(sys.argv[2],pathlib.Path(sys.argv[3]),sys.argv[4])
    else:
        parser=argparse.ArgumentParser(description=__doc__)
        parser.add_argument("--emulator",choices=["kitty","alacritty","ghostty"],required=True)
        parser.add_argument("--command",required=True)
        parser.add_argument("--binary",default="target/debug/caret")
        parser.add_argument("--xdotool",default="xdotool")
        parser.add_argument("--xvfb",default="Xvfb")
        parser.add_argument("--evidence")
        check(parser.parse_args())
