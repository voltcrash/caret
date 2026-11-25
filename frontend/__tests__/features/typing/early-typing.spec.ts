import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import {
  earlyTypingBootstrap,
  type EarlyTypingWindow,
} from "../../../src/app/early-typing-bootstrap";

function mountPreview(
  words: string[],
  preview = {
    mode: "time",
    time: 30,
    words: 50,
    language: "english",
    punctuation: false,
    numbers: false,
  },
): { root: HTMLDivElement; wordsEl: HTMLDivElement; caretEl: HTMLDivElement } {
  const root = document.createElement("div");
  root.setAttribute("data-initial-typing", "");
  root.setAttribute("data-initial-preview", JSON.stringify(preview));
  const cfg = document.createElement("div");
  cfg.setAttribute("data-ui-element", "initialTestConfig");
  root.appendChild(cfg);
  const wordsEl = document.createElement("div");
  wordsEl.setAttribute("data-initial-words", "");
  for (const word of words) {
    const wordEl = document.createElement("div");
    wordEl.className = "word";
    for (const ch of Array.from(word)) {
      const letter = document.createElement("letter");
      letter.textContent = ch;
      wordEl.appendChild(letter);
    }
    wordsEl.appendChild(wordEl);
  }
  root.appendChild(wordsEl);
  const caretEl = document.createElement("div");
  caretEl.setAttribute("data-initial-caret", "");
  root.appendChild(caretEl);
  document.body.appendChild(root);
  return { root, wordsEl, caretEl };
}

function runBootstrap(): void {
  const script = document.createElement("script");
  script.textContent = earlyTypingBootstrap;
  document.head.appendChild(script);
  script.remove();
}

function press(key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  document.dispatchEvent(event);
  return event;
}

describe("earlyTypingBootstrap", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
    localStorage.clear();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    const win = window as EarlyTypingWindow;
    win.__caretEarlyTyping?.dispose();
    delete win.__caretEarlyTyping;
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("styles correct, incorrect, extra letters and records timestamped events", () => {
    const { wordsEl } = mountPreview(["the", "cat"]);
    runBootstrap();
    press("t");
    press("x");
    press("Backspace");
    press("h");
    press("e");
    press(" ");
    press("c");
    press("a");
    press("t");
    press("z");

    const win = window as EarlyTypingWindow;
    const bridge = win.__caretEarlyTyping;
    expect(bridge).toBeDefined();
    expect(bridge?.words).toEqual(["the", "cat"]);
    expect(
      bridge?.events
        .filter((e) => e.op !== "key")
        .map((e) => (e.op === "insert" ? e.data : e.kind)),
    ).toEqual([
      "t",
      "x",
      "deleteContentBackward",
      "h",
      "e",
      " ",
      "c",
      "a",
      "t",
      "z",
    ]);
    expect(
      bridge?.events.some((e) => e.op === "key" && e.kind === "keydown"),
    ).toBe(true);

    const firstWord = wordsEl.children[0] as HTMLElement;
    expect(firstWord.classList.contains("typed")).toBe(true);
    expect(firstWord.classList.contains("error")).toBe(false);
    expect(Array.from(firstWord.children).map((el) => el.className)).toEqual([
      "correct",
      "correct",
      "correct",
    ]);

    const secondWord = wordsEl.children[1] as HTMLElement;
    expect(
      Array.from(secondWord.children).map((el) => [
        el.textContent,
        el.className,
      ]),
    ).toEqual([
      ["c", "correct"],
      ["a", "correct"],
      ["t", "correct"],
      ["z", "incorrect extra"],
    ]);
  });

  it("ignores browser shortcuts, leading space, and focused interactive controls", () => {
    const { wordsEl } = mountPreview(["hello", "world"]);
    runBootstrap();
    const shortcut = press("r", { metaKey: true });
    expect(shortcut.defaultPrevented).toBe(false);
    press(" ");

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    const inInput = press("h");
    expect(inInput.defaultPrevented).toBe(false);

    const win = window as EarlyTypingWindow;
    expect(win.__caretEarlyTyping?.events).toEqual([]);
    expect(wordsEl.querySelectorAll("letter.correct")).toHaveLength(0);
  });

  it("bails out when saved localStorage config changes typing behavior", () => {
    localStorage.setItem(
      "config",
      JSON.stringify({ mode: "time", time: 30, stopOnError: "letter" }),
    );
    const { wordsEl } = mountPreview(["hello", "world"]);
    runBootstrap();
    const event = press("h");
    expect(event.defaultPrevented).toBe(false);
    const win = window as EarlyTypingWindow;
    expect(win.__caretEarlyTyping?.events).toEqual([]);
    expect(wordsEl.querySelectorAll("letter.correct")).toHaveLength(0);
  });

  it("supports stepping back into a mistaken previous word and word deletion", () => {
    const { wordsEl } = mountPreview(["hi", "yo"]);
    runBootstrap();
    press("h");
    press("x");
    press(" ");
    const firstWord = wordsEl.children[0] as HTMLElement;
    expect(firstWord.classList.contains("error")).toBe(true);
    press("Backspace");
    expect(firstWord.classList.contains("error")).toBe(false);
    expect(firstWord.classList.contains("typed")).toBe(false);
    press("Backspace", { ctrlKey: true });
    expect(Array.from(firstWord.children).map((el) => el.className)).toEqual([
      "",
      "",
    ]);
  });

  it("does not attach listeners on non-home routes", () => {
    window.history.replaceState({}, "", "/settings");
    runBootstrap();
    const win = window as EarlyTypingWindow;
    expect(win.__caretEarlyTyping).toBeUndefined();
  });

  it("disposes itself when navigating away from / before handoff", () => {
    mountPreview(["the", "cat"]);
    runBootstrap();
    press("t");
    window.history.pushState({}, "", "/settings");
    const afterNav = press("h");
    expect(afterNav.defaultPrevented).toBe(false);
    const win = window as EarlyTypingWindow;
    expect(
      win.__caretEarlyTyping?.events.filter((e) => e.op === "insert"),
    ).toHaveLength(1);
  });

  it("accepts Windows AltGr characters and records keyup timing", () => {
    const { wordsEl } = mountPreview(["@", "b"]);
    runBootstrap();
    const altGr = new KeyboardEvent("keydown", {
      key: "@",
      code: "KeyQ",
      ctrlKey: true,
      altKey: true,
      modifierAltGraph: true,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(altGr);
    document.dispatchEvent(
      new KeyboardEvent("keyup", { key: "@", code: "KeyQ", bubbles: true }),
    );
    expect(altGr.defaultPrevented).toBe(true);
    expect(wordsEl.querySelectorAll("letter.correct")).toHaveLength(1);
    const win = window as EarlyTypingWindow;
    expect(
      win.__caretEarlyTyping?.events.some(
        (e) => e.op === "key" && e.kind === "keyup" && e.code === "KeyQ",
      ),
    ).toBe(true);
  });

  it("bails out for non-normal difficulty and records final Space in words mode", () => {
    localStorage.setItem("config", JSON.stringify({ difficulty: "expert" }));
    mountPreview(["the", "cat"]);
    runBootstrap();
    expect(press("t").defaultPrevented).toBe(false);

    localStorage.clear();
    const win = window as EarlyTypingWindow;
    win.__caretEarlyTyping?.dispose();
    delete win.__caretEarlyTyping;
    document.body.innerHTML = "";

    const { wordsEl } = mountPreview(["hi"], {
      mode: "words",
      time: 30,
      words: 1,
      language: "english",
      punctuation: false,
      numbers: false,
    });
    runBootstrap();
    press("h");
    press("x");
    press(" ");
    expect(
      (wordsEl.children[0] as HTMLElement).classList.contains("error"),
    ).toBe(true);
    expect(press("a").defaultPrevented).toBe(false);
  });
});
