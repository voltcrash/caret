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
            || (language.split('_').next() == Some("russian")
                && "ёеe".encode_utf16().any(|c| c == unit)
                && "ёеe".encode_utf16().any(|c| c == target));
        if equivalent {
            return target;
        }
    }
    if is_space(unit) { 32 } else { unit }
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
