//! CLI overrides apply to the very same core Config edited by the settings UI.
use crate::{
    Result,
    content::{OfflineContent, read_utf8, safe_text},
};
use clap::Parser;
use std::path::PathBuf;
use typing_engine::{
    Config, Text,
    generation::{CustomLimit, CustomText},
};

pub const FUNBOXES: &[&str] = &["capitals", "rAnDoMcAsE", "backwards", "IPv4", "IPv6"];
#[derive(Parser, Default)]
#[command(name="caret", version=crate::version(), about="Offline typing with the shared Caret Rust engine")]
pub struct Cli {
    /// Deterministic synthetic smoke; no terminal or saved data.
    #[arg(long)]
    pub smoke_test: bool,
    /// time, words, quote, custom, or zen. Defaults come from the shared engine.
    #[arg(long)]
    pub mode: Option<String>,
    #[arg(long)]
    pub words: Option<u32>,
    #[arg(long)]
    pub time: Option<f64>,
    /// Must match bundled English or the explicitly supplied pack.
    #[arg(long)]
    pub language: Option<String>,
    #[arg(long)]
    pub seed: Option<u32>,
    /// Version-1 local JSON language/quote pack; never downloaded.
    #[arg(long)]
    pub pack: Option<PathBuf>,
    /// Private custom text; never saved in settings/history by default.
    #[arg(long, conflicts_with = "file")]
    pub text: Option<String>,
    #[arg(long, conflicts_with = "text")]
    pub file: Option<PathBuf>,
    #[arg(long, default_value = "repeat")]
    pub custom_order: String,
    #[arg(long, default_value = "word")]
    pub custom_limit: String,
    #[arg(long)]
    pub custom_length: Option<f64>,
    /// Comma-separated quote groups: 0 short, 1 medium, 2 long, 3 very long.
    #[arg(long, value_delimiter = ',')]
    pub quote_length: Option<Vec<i32>>,
    #[arg(long)]
    pub punctuation: bool,
    #[arg(long)]
    pub numbers: bool,
    #[arg(long)]
    pub difficulty: Option<String>,
    #[arg(long)]
    pub stop_on_error: Option<String>,
    #[arg(long)]
    pub delete_on_error: Option<String>,
    #[arg(long)]
    pub confidence: Option<String>,
    #[arg(long)]
    pub freedom: bool,
    #[arg(long)]
    pub strict_space: bool,
    /// Explicit supported subset; see --capabilities.
    #[arg(long, value_delimiter = ',')]
    pub funbox: Option<Vec<String>>,
    #[arg(long)]
    pub capabilities: bool,
    /// auto negotiates Kitty keyboard events; basic avoids protocol queries.
    #[arg(long, default_value="auto", value_parser=["auto","basic"])]
    pub keyboard: String,
    #[arg(long)]
    pub config_dir: Option<PathBuf>,
    #[arg(long)]
    pub data_dir: Option<PathBuf>,
    /// Export all stored results (or --history-mode) without entering a terminal.
    #[arg(long)]
    pub export: Option<PathBuf>,
    #[arg(long, value_parser=["time","words","quote","custom","zen"])]
    pub history_mode: Option<String>,
    /// Print effective storage directories without opening databases.
    #[arg(long)]
    pub paths: bool,
    /// Explicit opt-in: persist target text and full input log for replay.
    #[arg(long)]
    pub record_replay: bool,
    #[arg(long, value_parser=clap::builder::PossibleValuesParser::new(crate::theme::names()))]
    pub theme: Option<String>,
    /// Version/platform diagnostics; no environment variables or private text.
    #[arg(long)]
    pub diagnostics: bool,
}
impl Cli {
    pub fn prepare(
        &self,
        mut config: Config,
    ) -> Result<(Config, OfflineContent, Option<CustomText>)> {
        let content = match &self.pack {
            Some(path) => OfflineContent::load(path)?,
            None => OfflineContent::bundled()?,
        };
        macro_rules! project { ($($name:ident),*) => { $(if let Some(value) = &self.$name { config.$name = value.clone(); })* }; }
        project!(
            mode,
            words,
            time,
            language,
            quote_length,
            difficulty,
            stop_on_error,
            delete_on_error,
            funbox
        );
        if let Some(value) = &self.confidence {
            config.confidence_mode = value.clone();
        }
        if self.language.is_none() {
            config.language = content.language.name.clone();
        }
        config.punctuation |= self.punctuation;
        config.numbers |= self.numbers;
        config.freedom_mode |= self.freedom;
        config.strict_space |= self.strict_space;
        let text = match (&self.text, &self.file) {
            (Some(text), _) => Some(text.clone()),
            (_, Some(path)) => Some(read_utf8(path)?),
            _ => None,
        };
        if text.is_some() && self.mode.is_none() {
            config.mode = "custom".into();
        }
        if text.is_some() && config.mode != "custom" {
            return Err("--text/--file requires custom mode".into());
        }
        let custom = text
            .map(|text| {
                custom_text_auto(
                    &text,
                    &self.custom_order,
                    &self.custom_limit,
                    self.custom_length,
                )
            })
            .transpose()?;
        validate(&config, &content, custom.as_ref())?;
        Ok((config, content, custom))
    }
}
pub fn custom_text(text: &str, order: &str, limit: &str, value: f64) -> Result<CustomText> {
    let text = crate::content::line_endings(text);
    // Decode plain-text entry boundaries using the core's separator set. Leaving
    // a nonbreaking space inside one entry would make Space commit it early.
    // Work in UTF-16 so non-BMP scalars cannot alias a BMP separator by truncation.
    let units: Vec<_> = text
        .encode_utf16()
        .map(|unit| {
            if typing_engine::text::is_space(unit) {
                32
            } else {
                unit
            }
        })
        .collect();
    let text = String::from_utf16(&units)?;
    safe_text(&text)?;
    if text.trim().is_empty() {
        return Err("Custom text is empty".into());
    }
    if !["repeat", "random", "shuffle"].contains(&order)
        || !["word", "time", "section"].contains(&limit)
    {
        return Err("Invalid custom order/limit".into());
    }
    // A terminal line ending is a commit separator. Keep it at the end of its
    // supplied word, rather than hiding following text inside an untypable word.
    let text = text.replace('\n', "\n ");
    let custom = CustomText {
        text: text
            .split(' ')
            .filter(|part| !part.is_empty())
            .map(Text::from)
            .collect(),
        mode: order.into(),
        limit: CustomLimit {
            mode: limit.into(),
            value,
        },
        pipe_delimiter: false,
    };
    typing_engine::validation::custom(&custom)?;
    Ok(custom)
}
pub fn custom_text_auto(
    text: &str,
    order: &str,
    limit: &str,
    value: Option<f64>,
) -> Result<CustomText> {
    let mut custom = custom_text(text, order, limit, 0.0)?;
    custom.limit.value = value.unwrap_or_else(|| {
        if limit == "time" {
            Config::default().time
        } else {
            custom.text.len() as f64
        }
    });
    typing_engine::validation::custom(&custom)?;
    Ok(custom)
}
pub fn validate(
    config: &Config,
    content: &OfflineContent,
    custom: Option<&CustomText>,
) -> Result<()> {
    config.validate()?;
    if config.language != content.language.name {
        return Err("Selected language is unavailable; supply a matching --pack".into());
    }
    if config.mode == "custom" && custom.is_none() {
        return Err("Custom mode requires private text: use --text/--file, or --mode words then F4 for the editor".into());
    }
    if config.quote_length.is_empty() || config.quote_length.iter().any(|g| !(0..=3).contains(g)) {
        return Err("Terminal quote lengths must be groups 0,1,2,3".into());
    }
    for name in &config.funbox {
        if !FUNBOXES.contains(&name.as_str()) {
            return Err(
                format!("Terminal does not support funbox {name}; see --capabilities").into(),
            );
        }
    }
    if !typing_engine::funboxes::compatible(&config.funbox) {
        return Err("Incompatible funbox combination".into());
    }
    // Ask shared metadata about forced settings; never silently substitute config.
    if let serde_json::Value::Object(values) = serde_json::to_value(config)? {
        for (key, value) in values {
            if !typing_engine::funboxes::can_set(&key, &value, &config.funbox)? {
                return Err(format!("Funbox disallows setting {key}={value}").into());
            }
        }
    }
    Ok(())
}
pub fn capabilities() -> String {
    format!(
        "Platforms: Linux, macOS\nModes: time, words, quote, custom text/file, zen\nOffline English + original quotes; local v1 packs\nFunboxes: {}\nOther web-only visual/audio/network/layout hooks: unavailable (rejected)\nInput: committed characters, Backspace, Enter, Tab, repeats\nKeyboard: auto negotiates Kitty enhancements; --keyboard basic skips queries\nWord delete: Ctrl/Alt+Backspace when distinguishable; try Alt in basic mode\nGraphics: text only; no image protocol required\nPhysical-key identity/composition lifecycle: unavailable\nKey duration/spacing/overlap: unavailable; no synthetic releases\nPaste: blocked during tests; unmarked paste cannot be detected\n",
        FUNBOXES.join(", ")
    )
}
