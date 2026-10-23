use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// UTF-16 units, not Unicode scalars, UTF-8 bytes, graphemes or terminal columns.
#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq, Eq, TS)]
pub struct Text(pub Vec<u16>);

impl From<&str> for Text {
    fn from(value: &str) -> Self {
        Self(value.encode_utf16().collect())
    }
}

impl Text {
    pub fn len(&self) -> usize {
        self.0.len()
    }
    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }
    /// Only for native display; never use this lossy conversion for engine rules.
    pub fn display_lossy(&self) -> String {
        String::from_utf16_lossy(&self.0)
    }
}

pub fn is_space(unit: u16) -> bool {
    matches!(
        unit,
        0x0020
            | 0x2002
            | 0x2003
            | 0x2009
            | 0x3000
            | 0x00a0
            | 0x1680
            | 0x202f
            | 0xfeff
            | 0x2007
            | 0x2008
            | 0x2004
            | 0x200a
            | 0x200b
    )
}

pub fn normalize(unit: u16, target: Option<u16>, language: &str) -> u16 {
    if let Some(target) = target {
        let equivalent = unit == target
            || ((unit == 32 || target == 32) && is_space(unit) && is_space(target))
            || ["’‘'ʼ׳ʻ᾽", "\"”“„", "–—-‐‑", ",‚"].iter().any(|set| {
                set.encode_utf16().any(|c| c == unit) && set.encode_utf16().any(|c| c == target)
            })
            || (base_language(language) == "russian"
                && "ёеe".encode_utf16().any(|c| c == unit)
                && "ёеe".encode_utf16().any(|c| c == target));
        if equivalent {
            return target;
        }
    }
    if is_space(unit) { 32 } else { unit }
}

/// Match JavaScript /_\d*k$/ exactly; named variants are not size suffixes.
pub fn base_language(language: &str) -> &str {
    if let Some((base, suffix)) = language.rsplit_once('_')
        && let Some(digits) = suffix.strip_suffix('k')
        && digits.bytes().all(|unit| unit.is_ascii_digit())
    {
        base
    } else {
        language
    }
}

/// JavaScript \s, distinct from the app's directly typable space set.
pub fn js_whitespace(unit: u16) -> bool {
    matches!(unit, 9..=13 | 32 | 160 | 0x1680 | 0x2000..=0x200a | 0x2028 |
        0x2029 | 0x202f | 0x205f | 0x3000 | 0xfeff)
}

pub fn delete_word(input: &Text) -> Text {
    let mut end = input.len();
    while end > 0 && js_whitespace(input.0[end - 1]) {
        end -= 1;
    }
    while end > 0 && !js_whitespace(input.0[end - 1]) {
        end -= 1;
    }
    Text(input.0[..end].to_vec())
}

/// Match hangul-js disassemble: compatibility compound jamo split; modern jamo
/// remain unchanged. Scores count these units while event indices stay UTF-16.
pub fn disassemble_hangul(text: &Text) -> Text {
    let leading: Vec<_> = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ"
        .encode_utf16()
        .collect();
    let trailing: Vec<_> = "\0ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ"
        .encode_utf16()
        .collect();
    fn push(unit: u16, output: &mut Vec<u16>) {
        // hangul-js initializes its lookup hashes with 0 -> 0; preserve that
        // historical NUL interpretation rather than silently changing scores.
        if unit == 0 {
            output.push(0x3131);
            return;
        }
        let pair = match unit {
            0x3133 => Some((0x3131, 0x3145)),
            0x3135 => Some((0x3134, 0x3148)),
            0x3136 => Some((0x3134, 0x314e)),
            0x313a => Some((0x3139, 0x3131)),
            0x313b => Some((0x3139, 0x3141)),
            0x313c => Some((0x3139, 0x3142)),
            0x313d => Some((0x3139, 0x3145)),
            0x313e => Some((0x3139, 0x314c)),
            0x313f => Some((0x3139, 0x314d)),
            0x3140 => Some((0x3139, 0x314e)),
            0x3144 => Some((0x3142, 0x3145)),
            0x3158 => Some((0x3157, 0x314f)),
            0x3159 => Some((0x3157, 0x3150)),
            0x315a => Some((0x3157, 0x3163)),
            0x315d => Some((0x315c, 0x3153)),
            0x315e => Some((0x315c, 0x3154)),
            0x315f => Some((0x315c, 0x3163)),
            0x3162 => Some((0x3161, 0x3163)),
            _ => None,
        };
        if let Some((a, b)) = pair {
            output.push(a);
            output.push(b);
        } else {
            output.push(unit);
        }
    }
    let mut result = vec![];
    for unit in &text.0 {
        if (0xac00..=0xd7a3).contains(unit) {
            let syllable = usize::from(*unit - 0xac00);
            push(leading[syllable / 588], &mut result);
            push(0x314f + (syllable % 588 / 28) as u16, &mut result);
            if syllable % 28 != 0 {
                push(trailing[syllable % 28], &mut result);
            }
        } else {
            push(*unit, &mut result);
        }
    }
    Text(result)
}
