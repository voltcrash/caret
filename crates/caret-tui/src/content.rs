//! Local UTF-8 asset loading only. Generation and normalization belong to core.
use crate::Result;
use serde::Deserialize;
use std::{fs::File, io::Read, path::Path};
use typing_engine::{
    Text,
    generation::Language,
    quotes::{Quote, QuoteAsset},
};

pub const MAX_FILE_BYTES: u64 = 8 * 1024 * 1024;
/// Decode text-file/clipboard line endings as logical terminal Enter characters.
pub fn line_endings(value: &str) -> String {
    value.replace("\r\n", "\n").replace('\r', "\n")
}
pub fn read_utf8(path: &Path) -> Result<String> {
    let mut bytes = vec![];
    File::open(path)?
        .take(MAX_FILE_BYTES + 1)
        .read_to_end(&mut bytes)?;
    if bytes.len() as u64 > MAX_FILE_BYTES {
        return Err("Local file exceeds 8 MiB".into());
    }
    Ok(String::from_utf8(bytes).map_err(|_| "Local file must be valid UTF-8")?)
}
pub fn safe_text(value: &str) -> Result<()> {
    if value.chars().any(|c| {
        (c.is_control() && c != '\t' && c != '\n')
            || matches!(c, '\u{202a}'..='\u{202e}' | '\u{2066}'..='\u{2069}')
    }) {
        return Err(
            "Content contains terminal controls or directional overrides (only Tab/LF allowed)"
                .into(),
        );
    }
    Ok(())
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct LocalLanguage {
    name: String,
    words: Vec<String>,
    #[serde(default)]
    bcp47: Option<String>,
    #[serde(default)]
    right_to_left: Option<bool>,
    #[serde(default)]
    joining_script: bool,
    #[serde(default)]
    original_punctuation: bool,
    #[serde(default)]
    no_lazy_mode: bool,
    #[serde(default)]
    additional_accents: Vec<(String, String)>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct LocalQuote {
    id: u32,
    text: String,
    source: String,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct Pack {
    format_version: u32,
    license: String,
    attribution: String,
    language: LocalLanguage,
    #[serde(default)]
    quotes: Vec<LocalQuote>,
}
#[derive(Clone)]
pub struct OfflineContent {
    pub language: Language,
    pub quotes: QuoteAsset,
    pub attribution: String,
}
impl OfflineContent {
    pub fn bundled() -> Result<Self> {
        Self::convert(
            serde_json::from_str(include_str!("../assets/english.json"))?,
            serde_json::from_str(include_str!("../assets/quotes.json"))?,
            "Caret / Monkeytype English words; original Caret prose; GPL-3.0-only".into(),
        )
    }
    pub fn load(path: &Path) -> Result<Self> {
        Self::parse(&read_utf8(path)?)
    }
    pub fn parse(json: &str) -> Result<Self> {
        if json.len() as u64 > MAX_FILE_BYTES {
            return Err("Local pack exceeds 8 MiB".into());
        }
        let pack: Pack = serde_json::from_str(json)?;
        if pack.format_version != 1 {
            return Err("Unsupported local content pack version (expected 1)".into());
        }
        if pack.license.trim().is_empty() || pack.attribution.trim().is_empty() {
            return Err("Content pack requires license and attribution".into());
        }
        safe_text(&pack.license)?;
        safe_text(&pack.attribution)?;
        Self::convert(
            pack.language,
            pack.quotes,
            format!("{}; {}", pack.attribution, pack.license),
        )
    }
    fn convert(raw: LocalLanguage, quotes: Vec<LocalQuote>, attribution: String) -> Result<Self> {
        if raw.words.is_empty() || raw.words.iter().any(|w| w.trim().is_empty()) {
            return Err("Language requires nonempty words".into());
        }
        for word in &raw.words {
            safe_text(word)?;
        }
        for (a, b) in &raw.additional_accents {
            safe_text(a)?;
            safe_text(b)?;
        }
        if raw.name.is_empty()
            || raw.name.len() > 128
            || !raw
                .name
                .bytes()
                .all(|c| c.is_ascii_alphanumeric() || c == b'_')
        {
            return Err("Invalid content language identifier".into());
        }
        if let Some(bcp47) = &raw.bcp47 {
            safe_text(bcp47)?;
        }
        let language = Language {
            name: raw.name.clone(),
            bcp47: raw.bcp47,
            words: raw.words.iter().map(|w| Text::from(w.as_str())).collect(),
            right_to_left: raw.right_to_left,
            joining_script: raw.joining_script,
            original_punctuation: raw.original_punctuation,
            no_lazy_mode: raw.no_lazy_mode,
            additional_accents: raw
                .additional_accents
                .into_iter()
                .map(|(a, b)| (Text::from(a.as_str()), Text::from(b.as_str())))
                .collect(),
        };
        typing_engine::validation::language(&language)?;
        let mut ids = std::collections::BTreeSet::new();
        let mut converted = vec![];
        for quote in quotes {
            safe_text(&quote.text)?;
            safe_text(&quote.source)?;
            if quote.text.trim().is_empty() || !ids.insert(quote.id) {
                return Err("Quotes require nonempty text and unique IDs".into());
            }
            let text = Text::from(quote.text.as_str());
            converted.push(Quote {
                length: text.len(),
                text,
                british_text: None,
                source: quote.source,
                id: quote.id,
                group: 0,
                language: raw.name.clone(),
                text_split: vec![],
            });
        }
        let quotes = QuoteAsset {
            language: raw.name,
            groups: vec![(0, 124), (125, 249), (250, 499), (500, 1_000_000)],
            quotes: converted,
        };
        typing_engine::validation::quote_asset(&quotes)?;
        Ok(Self {
            language,
            quotes,
            attribution,
        })
    }
}
