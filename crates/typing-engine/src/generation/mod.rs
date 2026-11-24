mod batch;
mod content;
mod selection;
mod text;
mod types;

pub use content::{Content, Prepare};
pub(crate) use text::case;
pub use types::{Assets, CustomLimit, CustomText, Generated, GenerationConfig, Language, NextWord};

use crate::error::{EngineError, ErrorCode, Recovery};
use crate::{Text, random::Random};
use std::collections::VecDeque;
use types::BatchState;

pub struct Generator {
    config: GenerationConfig,
    language: Language,
    custom: Option<CustomText>,
    random: Random,
    wordset: Vec<Text>,
    ordered: usize,
    shuffled: Vec<usize>,
    section: VecDeque<Text>,
    section_index: usize,
    section_history: Vec<Text>,
    pub(crate) previous: Vec<NextWord>,
    repeating: bool,
    generated: usize,
    punctuation: crate::punctuation::Punctuation,
    rules: crate::language_rules::LanguageRules,
    arrows: crate::generated_funboxes::Arrows,
    pseudolang: Option<crate::generated_funboxes::Pseudolang>,
    pub weak_spot: crate::weak_spot::WeakSpot,
    pub current_quote: Option<crate::quotes::Quote>,
    polyglot: Vec<Language>,
    word_languages: std::collections::BTreeMap<Vec<u16>, usize>,
    section_queue: Option<crate::content::Queue>,
    batch: BatchState,
    pub(crate) prepared_generation: u32,
}
impl Generator {
    /// Effective rule reads are live; prepared assets, RNG and learning keep their owner lifetime.
    pub fn configure(&mut self, config: GenerationConfig) -> Result<(), EngineError> {
        config
            .validate()
            .map_err(|message| EngineError::new(ErrorCode::InvalidConfig, message))?;
        self.config = config;
        Ok(())
    }
    pub fn random_state(&self) -> &Random {
        &self.random
    }
    pub fn config(&self) -> &GenerationConfig {
        &self.config
    }
    pub fn is_repeating(&self) -> bool {
        self.repeating
    }
    pub fn custom_limit(&self) -> Option<crate::results::Limit> {
        self.custom.as_ref().map(|custom| crate::results::Limit {
            mode: custom.limit.mode.clone(),
            value: custom.limit.value,
        })
    }
    pub fn new(
        config: GenerationConfig,
        language: Language,
        custom: Option<CustomText>,
        random: Random,
    ) -> Result<Self, crate::error::EngineError> {
        Self::with_assets(config, language, custom, random, &mut Assets::default())
    }
    pub fn with_assets(
        config: GenerationConfig,
        language: Language,
        custom: Option<CustomText>,
        random: Random,
        assets: &mut Assets,
    ) -> Result<Self, crate::error::EngineError> {
        Self::with_repeated_quote(config, language, custom, random, assets, None)
    }
    fn with_repeated_quote(
        config: GenerationConfig,
        mut language: Language,
        custom: Option<CustomText>,
        mut random: Random,
        assets: &mut Assets,
        repeated_quote: Option<crate::quotes::Quote>,
    ) -> Result<Self, crate::error::EngineError> {
        config
            .validate()
            .map_err(|message| EngineError::new(ErrorCode::InvalidConfig, message))?;
        crate::validation::language(&language)?;
        crate::validation::random(&random)?;
        if let Some(custom) = &custom {
            crate::validation::custom(custom)?;
        }
        if assets.polyglot.len() > 64
            || assets.favorite_quote_ids.len() > 1_000_000
            || assets.sections.len() > 16
        {
            return Err(EngineError::new(
                ErrorCode::InvalidContent,
                "Content asset count exceeds bound",
            ));
        }
        for language in &assets.polyglot {
            crate::validation::language(language)?;
        }
        if let Some(quotes) = &assets.quote_asset {
            crate::validation::quote_asset(quotes)?;
        }
        let section_queue = if let Some(name) = config.funbox.iter().find(|name| {
            crate::funboxes::get(name).is_some_and(|metadata| {
                metadata
                    .frontend_functions
                    .iter()
                    .any(|function| function == "pullSection")
            })
        }) {
            let english = language.bcp47.as_deref().unwrap_or("en").split('-').next() == Some("en");
            let mut queue =
                crate::content::Queue::new(name.clone(), config.language.clone(), english);
            for source in std::mem::take(&mut assets.sections) {
                queue.prefetch(source)?;
            }
            Some(queue)
        } else {
            None
        };
        if config.mode == "custom" && custom.is_none() {
            return Err("Missing custom text".into());
        }
        if let Some(custom) = &custom
            && (!["repeat", "random", "shuffle"].contains(&custom.mode.as_str())
                || !["word", "time", "section"].contains(&custom.limit.mode.as_str()))
        {
            return Err("Invalid custom mode or limit".into());
        }
        let current_quote = if repeated_quote.is_some() && config.mode == "quote" {
            repeated_quote
        } else if config.mode == "quote" {
            if let Some(asset) = assets.quote_asset.take() {
                assets
                    .quotes
                    .load(asset, &config.quote_length, &mut random)
                    .map_err(|mut error| {
                        if error.code == ErrorCode::NoQuotes {
                            error.message = format!(
                                "No {} quotes found",
                                crate::text::base_language(&config.language).replace('_', " ")
                            );
                        }
                        error
                    })?;
            }
            if assets.quotes.is_empty() {
                return Err(EngineError::recover(
                    ErrorCode::NoQuotes,
                    format!(
                        "No {} quotes found",
                        crate::text::base_language(&config.language).replace('_', " ")
                    ),
                    vec![Recovery::SetMode {
                        mode: "words".into(),
                    }],
                ));
            }
            Some(assets.quotes.select(
                &config.language,
                &config.quote_length,
                assets.selected_quote_id,
                &assets.favorite_quote_ids,
                config.british_english,
                &mut random,
            )?)
        } else {
            None
        };
        let mut wordset = if let Some(quote) = &current_quote {
            quote.text_split.clone()
        } else if config.mode == "custom" {
            custom.as_ref().unwrap().text.clone()
        } else {
            language.words.clone()
        };
        let mut word_languages = std::collections::BTreeMap::new();
        let polyglot = if config.funbox.iter().any(|name| name == "polyglot") {
            if assets.polyglot.is_empty() {
                return Err(EngineError::recover(
                    ErrorCode::NoPolyglotLanguages,
                    format!(
                        "No valid languages found. Please check your polyglot languages config ({}).",
                        config.custom_polyglot.join(", ")
                    ),
                    vec![Recovery::DisableFunbox {
                        name: "polyglot".into(),
                        no_restart: false,
                    }],
                ));
            }
            if assets.polyglot.len() == 1 {
                return Err(EngineError::recover(
                    ErrorCode::OnePolyglotLanguage,
                    "",
                    vec![
                        Recovery::SetLanguage {
                            language: assets.polyglot[0].name.clone(),
                            no_save: true,
                        },
                        Recovery::DisableFunbox {
                            name: "polyglot".into(),
                            no_restart: true,
                        },
                        Recovery::Notice {
                            message: format!(
                                "Disabled polyglot funbox because only one valid language was found. Check your polyglot languages config ({}).",
                                config.custom_polyglot.join(", ")
                            ),
                            duration_ms: 7000,
                        },
                    ],
                ));
            }
            let all_rtl = assets
                .polyglot
                .iter()
                .all(|lang| lang.right_to_left == Some(true));
            let all_ltr = assets
                .polyglot
                .iter()
                .all(|lang| lang.right_to_left != Some(true));
            if (language.right_to_left == Some(true) && all_ltr)
                || (language.right_to_left != Some(true) && all_rtl)
            {
                let fallback = assets.polyglot[0].name.clone();
                return Err(EngineError::recover(
                    ErrorCode::PolyglotDirection,
                    "",
                    vec![
                        Recovery::SetLanguage {
                            language: fallback.clone(),
                            no_save: false,
                        },
                        Recovery::Notice {
                            message: format!(
                                "Language direction conflict: switched to {fallback} for consistency."
                            ),
                            duration_ms: 5000,
                        },
                    ],
                ));
            }
            wordset.clear();
            for (index, lang) in assets.polyglot.iter().enumerate() {
                for word in &lang.words {
                    if !word_languages.contains_key(&word.0) {
                        wordset.push(word.clone());
                    }
                    word_languages.insert(word.0.clone(), index);
                }
            }
            random.shuffle(&mut wordset)?;
            language.joining_script = assets.polyglot.iter().any(|lang| lang.joining_script);
            assets.polyglot.clone()
        } else {
            vec![]
        };
        if config.funbox.iter().any(|name| name == "backwards") {
            wordset.reverse();
        }
        if config.mode != "zen" && (wordset.is_empty() || wordset.iter().all(Text::is_empty)) {
            return Err("Content has no words".into());
        }
        if wordset.len() > 1_000_000 || wordset.iter().any(|word| word.len() > 1_000_000) {
            return Err("Content exceeds generation bound".into());
        }
        Ok(Self {
            config,
            language,
            custom,
            random,
            wordset,
            ordered: 0,
            shuffled: vec![],
            section: VecDeque::new(),
            section_index: 0,
            section_history: vec![],
            previous: vec![],
            repeating: false,
            generated: 0,
            punctuation: crate::punctuation::Punctuation::default(),
            rules: crate::language_rules::LanguageRules::new()?,
            arrows: crate::generated_funboxes::Arrows::default(),
            pseudolang: None,
            weak_spot: crate::weak_spot::WeakSpot::default(),
            current_quote,
            polyglot,
            word_languages,
            section_queue,
            batch: BatchState::Idle,
            prepared_generation: 0,
        })
    }
    pub fn pending_request(&self) -> Option<&crate::content::Request> {
        self.section_queue
            .as_ref()
            .and_then(|queue| queue.pending())
    }
    pub fn supply(
        &mut self,
        request: &crate::content::Request,
        source: crate::content::Source,
    ) -> Result<(), crate::error::EngineError> {
        self.section_queue
            .as_mut()
            .ok_or("Generator has no section source")?
            .supply(request, source)
    }
    /// A failed fetch consumes its exact token. Reprepare/reset is required before more generation.
    pub fn fail_source(
        &mut self,
        request: &crate::content::Request,
        active: bool,
    ) -> Result<EngineError, EngineError> {
        self.section_queue
            .as_mut()
            .ok_or("Generator has no section source")?
            .reject(request)?;
        let mut recovery = vec![];
        if active {
            recovery.push(Recovery::ErrorNotice {
                message: "Error while getting section. Please try again later".into(),
            });
        }
        recovery.push(Recovery::DisableFunbox {
            name: request.kind.clone(),
            no_restart: false,
        });
        if active {
            recovery.push(Recovery::Restart);
        }
        let error = EngineError::recover(
            ErrorCode::SourceUnavailable,
            if active { "" } else { "Failed to pull section" },
            recovery,
        );
        self.batch = BatchState::Failed(error.clone());
        Ok(error)
    }
    pub fn reset_requests(&mut self, generation: u32) {
        if let Some(queue) = &mut self.section_queue {
            queue.reset(generation);
        }
        self.batch = BatchState::Idle;
    }
}
