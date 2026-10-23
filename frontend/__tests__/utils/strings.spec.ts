import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
} from "vite-plus/test";
import * as Strings from "../../src/ts/utils/strings";

describe("string utils", () => {
  describe("highlightMatches", () => {
    const shouldHighlight = [
      {
        description: "word at the beginning",
        text: "Start here.",
        matches: ["Start"],
        expected: [
          { text: "Start", matched: true },
          { text: " here.", matched: false },
        ],
      },
      {
        description: "word at the end",
        text: "reach the end",
        matches: ["end"],
        expected: [
          { text: "reach the ", matched: false },
          { text: "end", matched: true },
        ],
      },
      {
        description: "mutliple matches",
        text: "one two three",
        matches: ["one", "three"],
        expected: [
          { text: "one", matched: true },
          { text: " two ", matched: false },
          { text: "three", matched: true },
        ],
      },
      {
        description: "repeated matches",
        text: "one two two",
        matches: ["two"],
        expected: [
          { text: "one ", matched: false },
          { text: "two", matched: true },
          { text: " ", matched: false },
          { text: "two", matched: true },
        ],
      },
      {
        description: "longest possible  match",
        text: "abc ab",
        matches: ["ab", "abc"],
        expected: [
          { text: "abc", matched: true },
          { text: " ", matched: false },
          { text: "ab", matched: true },
        ],
      },
      {
        description: "if wrapped in parenthesis",
        text: "(test)",
        matches: ["test"],
        expected: [
          { text: "(", matched: false },
          { text: "test", matched: true },
          { text: ")", matched: false },
        ],
      },
      {
        description: "if wrapped in commas",
        text: ",test,",
        matches: ["test"],
        expected: [
          { text: ",", matched: false },
          { text: "test", matched: true },
          { text: ",", matched: false },
        ],
      },
      {
        description: "if wrapped in underscores",
        text: "_test_",
        matches: ["test"],
        expected: [
          { text: "_", matched: false },
          { text: "test", matched: true },
          { text: "_", matched: false },
        ],
      },
      {
        description: "words in russian",
        text: "Привет, мир!",
        matches: ["Привет", "мир"],
        expected: [
          { text: "Привет", matched: true },
          { text: ", ", matched: false },
          { text: "мир", matched: true },
          { text: "!", matched: false },
        ],
      },
      {
        description: "words with chinese punctuation",
        text: "你好，世界！",
        matches: ["你好", "世界"],
        expected: [
          { text: "你好", matched: true },
          { text: "，", matched: false },
          { text: "世界", matched: true },
          { text: "！", matched: false },
        ],
      },
      {
        description: "words with arabic punctuation",
        text: "؟مرحبا، بكم؛",
        matches: ["مرحبا", "بكم"],
        expected: [
          { text: "؟", matched: false },
          { text: "مرحبا", matched: true },
          { text: "، ", matched: false },
          { text: "بكم", matched: true },
          { text: "؛", matched: false },
        ],
      },
      {
        description: "standalone numbers",
        text: "My number is 1234.",
        matches: ["1234"],
        expected: [
          { text: "My number is ", matched: false },
          { text: "1234", matched: true },
          { text: ".", matched: false },
        ],
      },
    ];
    const shouldNotHighlight = [
      {
        description: "a match within a longer word",
        text: "together",
        matches: ["get"],
      },
      {
        description: "a match with leading letters",
        text: "welcome",
        matches: ["come"],
      },
      {
        description: "a match with trailing letters",
        text: "comets",
        matches: ["come"],
      },
      {
        description: "japanese matches within longer words",
        text: "こんにちは世界",
        matches: ["こんにちは"],
      },
      {
        description: "numbers within words",
        text: "abc1234def",
        matches: ["1234"],
      },
    ];
    const returnOriginal = [
      {
        description: "if matches is an empty array",
        text: "Nothing to match.",
        matches: [],
      },
      {
        description: "if matches has an empty string only",
        text: "Nothing to match.",
        matches: [""],
      },
      {
        description: "if no matches found in text",
        text: "Hello world.",
        matches: ["absent"],
      },
      {
        description: "if text is empty",
        text: "",
        matches: ["anything"],
      },
    ];
    it.each(shouldHighlight)(
      "should highlight $description",
      ({ text, matches, expected }) => {
        expect(Strings.highlightMatches(text, matches)).toEqual(expected);
      },
    );
    it.each(shouldNotHighlight)(
      "should not highlight $description",
      ({ text, matches }) => {
        expect(Strings.highlightMatches(text, matches)).toEqual([
          { text, matched: false },
        ]);
      },
    );
    it.each(returnOriginal)(
      "should return original text $description",
      ({ text, matches }) => {
        expect(Strings.highlightMatches(text, matches)).toEqual([
          { text, matched: false },
        ]);
      },
    );
  });

  describe("replaceControlCharacters", () => {
    it.each([
      // Basic tab conversions
      ["\\t", "\t", "single tab"],
      ["\\t\\t\\t", "\t\t\t", "multiple tabs"],
      ["hello\\tworld", "hello\tworld", "tab between words"],
      ["\\tstart", "\tstart", "tab at start"],
      ["end\\t", "end\t", "tab at end"],

      // Basic newline conversions
      ["\\n", " \n", "single newline with space prefix"],
      ["hello\\nworld", "hello \nworld", "newline between words with space"],
      ["\\nstart", " \nstart", "newline at start with space"],
      ["end\\n", "end \n", "newline at end with space"],

      // Complex newline handling (after first two regexes)
      ["a\\n", "a \n", "single char followed by newline gets space prefix"],
      ["hello\\n", "hello \n", "word followed by newline gets space prefix"],

      // Double-escaped sequences (should become single-escaped)
      ["\\\\t", "\\t", "double-escaped tab becomes single-escaped"],
      [
        "\\\\n",
        "\\ \n",
        "double-escaped newline becomes backslash + space + newline",
      ],
      ["\\\\t\\\\n", "\\t\\ \n", "multiple double-escaped sequences"],

      // Mixed scenarios
      [
        "\\t\\n\\\\t",
        "\t \n\\t",
        "mix of tab, newline, and double-escaped tab",
      ],
      [
        "hello\\tworld\\ntest\\\\t",
        "hello\tworld \ntest\\t",
        "complex mixed scenario",
      ],

      // Edge cases
      ["", "", "empty string"],
      ["no escapes", "no escapes", "string with no escape sequences"],
      ["\\", "\\", "single backslash"],
      ["\\x", "\\x", "backslash with non-control character"],

      // Escaped backslashes that don't precede control chars
      ["\\\\", "\\\\", "double backslash not followed by control char"],
      ["\\\\x", "\\\\x", "double backslash followed by non-control char"],
    ])(
      "should convert %s to %s (%s)",
      (input: string, expected: string, _description: string) => {
        expect(Strings.replaceControlCharacters(input)).toBe(expected);
      },
    );
  });

  describe("hasRTLCharacters", () => {
    it.each([
      // LTR characters should return false
      [false, "hello", "basic Latin text"],
      [false, "world123", "Latin text with numbers"],
      [false, "test!", "Latin text with punctuation"],
      [false, "ABC", "uppercase Latin text"],
      [false, "", "empty string"],
      [false, "123", "numbers only"],
      [false, "!@#$%", "punctuation and symbols only"],
      [false, "   ", "whitespace only"],

      // Common LTR scripts
      [false, "Здравствуй", "Cyrillic text"],
      [false, "Bonjour", "Latin with accents"],
      [false, "Καλημέρα", "Greek text"],
      [false, "こんにちは", "Japanese Hiragana"],
      [false, "你好", "Chinese characters"],
      [false, "안녕하세요", "Korean text"],

      // RTL characters should return true - Arabic
      [true, "مرحبا", "Arabic text"],
      [true, "السلام", "Arabic phrase"],
      [true, "العربية", "Arabic word"],
      [true, "٠١٢٣٤٥٦٧٨٩", "Arabic-Indic digits"],

      // RTL characters should return true - Hebrew
      [true, "שלום", "Hebrew text"],
      [true, "עברית", "Hebrew word"],
      [true, "ברוך", "Hebrew name"],

      // RTL characters should return true - Persian/Farsi
      [true, "سلام", "Persian text"],
      [true, "فارسی", "Persian word"],

      // Mixed content (should return true if ANY RTL characters are present)
      [true, "hello مرحبا", "mixed LTR and Arabic"],
      [true, "123 שלום", "numbers and Hebrew"],
      [true, "test سلام!", "Latin, Persian, and punctuation"],
      [true, "مرحبا123", "Arabic with numbers"],
      [true, "hello؟", "Latin with Arabic punctuation"],

      // Edge cases with various Unicode ranges
      [false, "𝕳𝖊𝖑𝖑𝖔", "mathematical bold text (LTR)"],
      [false, "🌍🌎🌏", "emoji"],
    ] as const)(
      "should return %s for word '%s' (%s)",
      (expected: boolean, word: string, _description: string) => {
        expect(Strings.__testing.hasRTLCharacters(word)[0]).toBe(expected);
      },
    );
  });

  describe("isWordRightToLeft", () => {
    beforeEach(() => {
      Strings.clearWordDirectionCache();
    });

    it.each([
      // Basic functionality - should use hasRTLCharacters result when word has core content
      [false, "hello", false, "LTR word in LTR language"],
      [
        false,
        "hello",
        true,
        "LTR word in RTL language (word direction overrides language)",
      ],
      [
        true,
        "مرحبا",
        false,
        "RTL word in LTR language (word direction overrides language)",
      ],
      [true, "مرحبا", true, "RTL word in RTL language"],

      // Punctuation stripping behavior
      [false, "hello!", false, "LTR word with trailing punctuation"],
      [false, "!hello", false, "LTR word with leading punctuation"],
      [false, "!hello!", false, "LTR word with surrounding punctuation"],
      [true, "مرحبا؟", false, "RTL word with trailing punctuation"],
      [true, "؟مرحبا", false, "RTL word with leading punctuation"],
      [true, "؟مرحبا؟", false, "RTL word with surrounding punctuation"],

      // Fallback to language direction for empty/neutral content
      [false, "", false, "empty string falls back to LTR language"],
      [true, "", true, "empty string falls back to RTL language"],
      [false, "!!!", false, "punctuation only falls back to LTR language"],
      [true, "!!!", true, "punctuation only falls back to RTL language"],
      [false, "   ", false, "whitespace only falls back to LTR language"],
      [true, "   ", true, "whitespace only falls back to RTL language"],

      // Numbers behavior (numbers are neutral, follow hasRTLCharacters detection)
      [false, "123", false, "regular digits are not RTL"],
      [false, "123", true, "regular digits are not RTL regardless of language"],
      [true, "١٢٣", false, "Arabic-Indic digits are detected as RTL"],
      [true, "١٢٣", true, "Arabic-Indic digits are detected as RTL"],
    ] as const)(
      "should return %s for word '%s' with languageRTL=%s (%s)",
      (
        expected: boolean,
        word: string,
        languageRTL: boolean,
        _description: string,
      ) => {
        expect(Strings.isWordRightToLeft(word, languageRTL)[0]).toBe(expected);
      },
    );

    it("should return languageRTL for undefined word", () => {
      expect(Strings.isWordRightToLeft(undefined, false)[0]).toBe(false);
      expect(Strings.isWordRightToLeft(undefined, true)[0]).toBe(true);
    });

    // testing reverseDirection
    it("should return true for LTR word with reversed direction", () => {
      expect(Strings.isWordRightToLeft("hello", false, true)[0]).toBe(true);
      expect(Strings.isWordRightToLeft("hello", true, true)[0]).toBe(true);
    });
    it("should return false for RTL word with reversed direction", () => {
      expect(Strings.isWordRightToLeft("مرحبا", true, true)[0]).toBe(false);
      expect(Strings.isWordRightToLeft("مرحبا", false, true)[0]).toBe(false);
    });
    it("should return reverse of languageRTL for undefined word with reversed direction", () => {
      expect(Strings.isWordRightToLeft(undefined, false, true)[0]).toBe(true);
      expect(Strings.isWordRightToLeft(undefined, true, true)[0]).toBe(false);
    });

    describe("caching", () => {
      const mapGetSpy = vi.spyOn(Map.prototype, "get");
      const mapSetSpy = vi.spyOn(Map.prototype, "set");
      const mapClearSpy = vi.spyOn(Map.prototype, "clear");

      afterEach(() => {
        mapGetSpy.mockReset();
        mapSetSpy.mockReset();
        mapClearSpy.mockReset();
      });

      it("should use cache for repeated calls", () => {
        // First call should cache the result (cache miss)
        const result1 = Strings.isWordRightToLeft("hello", false);
        expect(result1[0]).toBe(false);
        expect(mapSetSpy).toHaveBeenCalledWith("hello", [false, 0]);

        // Reset spies to check second call
        mapGetSpy.mockClear();
        mapSetSpy.mockClear();

        // Second call should use cache (cache hit)
        const result2 = Strings.isWordRightToLeft("hello", false);
        expect(result2[0]).toBe(false);
        expect(mapGetSpy).toHaveBeenCalledWith("hello");
        expect(mapSetSpy).not.toHaveBeenCalled(); // Should not set again

        // Cache should work regardless of language direction for same word
        mapGetSpy.mockClear();
        mapSetSpy.mockClear();

        const result3 = Strings.isWordRightToLeft("hello", true);
        expect(result3[0]).toBe(false); // Still false because "hello" is LTR regardless of language
        expect(mapGetSpy).toHaveBeenCalledWith("hello");
        expect(mapSetSpy).not.toHaveBeenCalled(); // Should not set again
      });

      it("should cache based on core word without punctuation", () => {
        // First call should cache the result for core "hello"
        const result1 = Strings.isWordRightToLeft("hello", false);
        expect(result1[0]).toBe(false);
        expect(mapSetSpy).toHaveBeenCalledWith("hello", [false, 0]);

        mapGetSpy.mockClear();
        mapSetSpy.mockClear();

        // These should all use the same cache entry since they have the same core
        const result2 = Strings.isWordRightToLeft("hello!", false);
        expect(result2[0]).toBe(false);
        expect(mapGetSpy).toHaveBeenCalledWith("hello");
        expect(mapSetSpy).not.toHaveBeenCalled();

        mapGetSpy.mockClear();
        mapSetSpy.mockClear();

        const result3 = Strings.isWordRightToLeft("!hello", false);
        expect(result3[0]).toBe(false);
        expect(mapGetSpy).toHaveBeenCalledWith("hello");
        expect(mapSetSpy).not.toHaveBeenCalled();

        mapGetSpy.mockClear();
        mapSetSpy.mockClear();

        const result4 = Strings.isWordRightToLeft("!hello!", false);
        expect(result4[0]).toBe(false);
        expect(mapGetSpy).toHaveBeenCalledWith("hello");
        expect(mapSetSpy).not.toHaveBeenCalled();
      });

      it("should handle cache clearing", () => {
        // Cache a result
        Strings.isWordRightToLeft("test", false);
        expect(mapSetSpy).toHaveBeenCalledWith("test", [false, 0]);

        // Clear cache
        Strings.clearWordDirectionCache();
        expect(mapClearSpy).toHaveBeenCalled();

        mapGetSpy.mockClear();
        mapSetSpy.mockClear();
        mapClearSpy.mockClear();

        // Should work normally after cache clear (cache miss again)
        const result = Strings.isWordRightToLeft("test", false);
        expect(result[0]).toBe(false);
        expect(mapSetSpy).toHaveBeenCalledWith("test", [false, 0]);
      });

      it("should demonstrate cache miss vs cache hit behavior", () => {
        // Test cache miss - first time seeing this word
        const result1 = Strings.isWordRightToLeft("unique", false);
        expect(result1[0]).toBe(false);
        expect(mapGetSpy).toHaveBeenCalledWith("unique");
        expect(mapSetSpy).toHaveBeenCalledWith("unique", [false, 0]);

        mapGetSpy.mockClear();
        mapSetSpy.mockClear();

        // Test cache hit - same word again
        const result2 = Strings.isWordRightToLeft("unique", false);
        expect(result2[0]).toBe(false);
        expect(mapGetSpy).toHaveBeenCalledWith("unique");
        expect(mapSetSpy).not.toHaveBeenCalled(); // No cache set on hit

        mapGetSpy.mockClear();
        mapSetSpy.mockClear();

        // Test cache miss - different word
        const result3 = Strings.isWordRightToLeft("different", false);
        expect(result3[0]).toBe(false);
        expect(mapGetSpy).toHaveBeenCalledWith("different");
        expect(mapSetSpy).toHaveBeenCalledWith("different", [false, 0]);
      });
    });
  });
});
