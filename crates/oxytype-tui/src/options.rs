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
#[command(name="oxytype", version=crate::version(), about="Offline typing with the shared Oxytype Rust engine")]
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
    #[arg(long, default_value = "section")]
    pub custom_limit: String,
    #[arg(long, default_value_t = 1.0)]
    pub custom_length: f64,
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
    /// auto negotiates enhanced events; basic avoids protocol queries.
    #[arg(long, default_value="auto", value_parser=["auto","basic"])]
    pub keyboard: String,
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
                custom_text(
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
    safe_text(text)?;
    if text.trim().is_empty() {
        return Err("Custom text is empty".into());
    }
    if !["repeat", "random", "shuffle"].contains(&order)
        || !["word", "time", "section"].contains(&limit)
    {
        return Err("Invalid custom order/limit".into());
    }
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
        return Err("Custom mode requires --text, --file, or the custom-text editor".into());
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
        "Modes: time, words, quote, custom text/file, zen\nOffline English + original quotes; local v1 packs\nFunboxes: {}\nOther web-only visual/audio/network/layout hooks: unavailable (rejected)\nInput: committed characters, Backspace/word delete, Enter, Tab, repeats\nPhysical-key identity/composition lifecycle: unavailable\nKey duration/spacing/overlap: unavailable; no synthetic releases\nPaste: blocked during tests; unmarked paste cannot be detected\n",
        FUNBOXES.join(", ")
    )
}
