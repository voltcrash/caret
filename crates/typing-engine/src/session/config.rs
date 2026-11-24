use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(default, rename_all = "camelCase")]
pub struct Config {
    pub mode: String,
    pub words: u32,
    pub time: f64,
    pub language: String,
    pub difficulty: String,
    pub strict_space: bool,
    pub stop_on_error: String,
    pub delete_on_error: String,
    pub quick_end: bool,
    pub repeat_quotes: String,
    pub result_saving: bool,
    pub repeated_pace: bool,
    pub freedom_mode: bool,
    pub confidence_mode: String,
    pub blind_mode: bool,
    pub hide_extra_letters: bool,
    pub code_unindent_on_backspace: bool,
    pub funbox: Vec<String>,
    pub show_all_lines: bool,
    pub punctuation: bool,
    pub numbers: bool,
    pub lazy_mode: bool,
    pub british_english: bool,
    pub quote_length: Vec<i32>,
    pub custom_polyglot: Vec<String>,
    pub min_burst: String,
    pub min_burst_custom_speed: f64,
    pub min_wpm: String,
    pub min_wpm_custom_speed: f64,
    pub min_acc: String,
    pub min_acc_custom: f64,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            mode: "time".into(),
            words: 50,
            time: 30.0,
            language: "english".into(),
            difficulty: "normal".into(),
            strict_space: false,
            stop_on_error: "off".into(),
            delete_on_error: "off".into(),
            quick_end: false,
            repeat_quotes: "off".into(),
            result_saving: true,
            repeated_pace: true,
            freedom_mode: false,
            confidence_mode: "off".into(),
            blind_mode: false,
            hide_extra_letters: false,
            code_unindent_on_backspace: false,
            funbox: vec![],
            show_all_lines: false,
            punctuation: false,
            numbers: false,
            lazy_mode: false,
            british_english: false,
            quote_length: vec![1],
            custom_polyglot: vec![
                "english".into(),
                "spanish".into(),
                "french".into(),
                "german".into(),
            ],
            min_burst: "off".into(),
            min_burst_custom_speed: 100.0,
            min_wpm: "off".into(),
            min_wpm_custom_speed: 100.0,
            min_acc: "off".into(),
            min_acc_custom: 90.0,
        }
    }
}

impl Config {
    pub fn validate(&self) -> Result<(), String> {
        for (name, value, allowed) in [
            (
                "mode",
                self.mode.as_str(),
                &["time", "words", "quote", "custom", "zen"][..],
            ),
            (
                "difficulty",
                self.difficulty.as_str(),
                &["normal", "expert", "master"][..],
            ),
            (
                "stopOnError",
                self.stop_on_error.as_str(),
                &["off", "word", "letter"][..],
            ),
            (
                "deleteOnError",
                self.delete_on_error.as_str(),
                &["off", "word", "letter", "word_hard", "letter_hard"][..],
            ),
            (
                "confidenceMode",
                self.confidence_mode.as_str(),
                &["off", "on", "max"][..],
            ),
            (
                "minBurst",
                self.min_burst.as_str(),
                &["off", "fixed", "flex"][..],
            ),
            ("minWpm", self.min_wpm.as_str(), &["off", "custom"][..]),
            ("minAcc", self.min_acc.as_str(), &["off", "custom"][..]),
            (
                "repeatQuotes",
                self.repeat_quotes.as_str(),
                &["off", "typing"][..],
            ),
        ] {
            if !allowed.contains(&value) {
                return Err(format!("Invalid {name}"));
            }
        }
        if self.words > crate::validation::MAX_WORDS as u32
            || self
                .quote_length
                .iter()
                .any(|length| ![-3, -2, 0, 1, 2, 3].contains(length))
            || self
                .custom_polyglot
                .iter()
                .any(|language| language.len() > 128)
        {
            return Err("Invalid content selection bound".into());
        }
        if !self.time.is_finite() || self.time < 0.0 {
            return Err("Invalid time limit".into());
        }
        if [
            self.min_burst_custom_speed,
            self.min_wpm_custom_speed,
            self.min_acc_custom,
        ]
        .iter()
        .any(|value| !value.is_finite() || *value < 0.0)
            || self.min_acc_custom > 100.0
        {
            return Err("Invalid minimum threshold".into());
        }
        if self.language.is_empty()
            || self.language.len() > 128
            || !self
                .language
                .bytes()
                .all(|c| c.is_ascii_alphanumeric() || c == b'_')
        {
            return Err("Invalid language".into());
        }
        if self.funbox.len() > 64
            || self
                .funbox
                .iter()
                .any(|name| crate::funboxes::get(name).is_none())
        {
            return Err("Invalid funbox list".into());
        }
        if self.quote_length.len() > 64 || self.custom_polyglot.len() > 64 {
            return Err("Content selection exceeds bound".into());
        }
        Ok(())
    }

    pub(super) fn nospace(&self) -> bool {
        crate::funboxes::has_property(&self.funbox, "nospace")
    }

    pub(super) fn all_words_generated_initially(&self) -> bool {
        self.mode != "time" && self.mode != "zen" && !(self.mode == "words" && self.words == 0)
    }

    pub(super) fn expansion(&self, unit: u16, target: Option<u16>) -> Option<&'static str> {
        if unit == 0x2026 && target != Some(unit) {
            Some("...")
        } else if unit == 0x0133
            && crate::text::base_language(&self.language) == "dutch"
            && target != Some(unit)
        {
            Some("ij")
        } else {
            None
        }
    }

    pub(super) fn monitors_drift(&self) -> bool {
        (self.mode == "time" && self.time > 0.0 && self.time < 130.0)
            || (self.mode == "words" && self.words > 0 && self.words < 250)
    }

    pub(super) fn is_code_language(&self) -> bool {
        self.language.starts_with("code")
    }
}

#[cfg(test)]
mod tests {
    use super::Config;

    #[test]
    fn default_config_is_valid() {
        assert!(Config::default().validate().is_ok());
    }

    #[test]
    fn validate_rejects_invalid_fields() {
        let mut config = Config {
            mode: "invalid".into(),
            ..Config::default()
        };
        assert_eq!(config.validate(), Err("Invalid mode".into()));

        config = Config {
            time: -1.0,
            ..Config::default()
        };
        assert_eq!(config.validate(), Err("Invalid time limit".into()));

        config = Config {
            min_acc_custom: 101.0,
            ..Config::default()
        };
        assert_eq!(config.validate(), Err("Invalid minimum threshold".into()));

        config = Config {
            language: "bad-lang!".into(),
            ..Config::default()
        };
        assert_eq!(config.validate(), Err("Invalid language".into()));

        config = Config {
            funbox: vec!["nonexistent_funbox".into()],
            ..Config::default()
        };
        assert_eq!(config.validate(), Err("Invalid funbox list".into()));

        config = Config {
            quote_length: vec![99],
            ..Config::default()
        };
        assert_eq!(
            config.validate(),
            Err("Invalid content selection bound".into())
        );
    }

    #[test]
    fn helpers_reflect_mode_language_and_expansions() {
        let mut config = Config::default();
        assert!(!config.all_words_generated_initially());
        assert!(config.monitors_drift());
        assert!(!config.is_code_language());
        assert_eq!(config.expansion(0x2026, Some(b'.' as u16)), Some("..."));
        assert_eq!(config.expansion(0x2026, Some(0x2026)), None);
        assert_eq!(config.expansion(0x0133, Some(b'i' as u16)), None);

        config.mode = "words".into();
        config.words = 50;
        assert!(config.all_words_generated_initially());
        assert!(config.monitors_drift());

        config.words = 0;
        assert!(!config.all_words_generated_initially());
        assert!(!config.monitors_drift());

        config.language = "dutch_1k".into();
        assert_eq!(config.expansion(0x0133, Some(b'i' as u16)), Some("ij"));
        assert_eq!(config.expansion(0x0133, Some(0x0133)), None);

        config.language = "code_rust".into();
        assert!(config.is_code_language());
    }
}
