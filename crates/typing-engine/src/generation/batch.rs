use crate::error::EngineError;
use crate::{Text, random::Random};

use super::Generator;
use super::types::{Batch, BatchState, Generated};

impl Generator {
    pub(super) fn limit(&self) -> f64 {
        if self.config.mode == "zen" {
            return 0.0;
        }
        let mut limit = 100.0;
        if self.config.show_all_lines && self.config.mode == "words" {
            limit = self.config.words as f64;
        }
        if self.config.mode == "words" && self.config.words as f64 == 0.0 {
            limit = 100.0;
        }
        if let Some(custom) = &self.custom
            && self.config.mode == "custom"
        {
            limit = if custom.limit.value == 0.0 || custom.limit.mode == "time" {
                100.0
            } else {
                custom.limit.value.min(100.0)
            };
        }
        if self.config.mode == "words" && self.config.words as f64 > 0.0 {
            limit = limit.min(self.config.words as f64);
        }
        for funbox in &self.config.funbox {
            if let Some(count) = match funbox.as_str() {
                "plus_zero" => Some(1.0),
                "plus_one" => Some(2.0),
                "plus_two" => Some(3.0),
                "plus_three" => Some(4.0),
                _ => None,
            } {
                limit = count;
                break;
            }
        }
        if self.config.mode == "words" && self.config.words as f64 > 0.0 {
            limit = limit.min(self.config.words as f64);
        }
        if let Some(quote) = &self.current_quote {
            limit = if self.config.show_all_lines {
                quote.text_split.len() as f64
            } else {
                limit.min(quote.text_split.len() as f64)
            };
        }
        if self.config.mode == "custom"
            && let Some(custom) = &self.custom
            && custom.limit.mode == "word"
            && custom.limit.value != 0.0
        {
            limit = limit.min(custom.limit.value);
        }
        limit
    }

    pub fn all_generated(&self) -> bool {
        if let Some(quote) = &self.current_quote {
            return self.generated >= quote.text_split.len();
        }
        if self.config.mode == "words" {
            return self.config.words as usize > 0 && self.generated >= self.config.words as usize;
        }
        if self.config.mode == "custom"
            && let Some(custom) = &self.custom
        {
            return custom.limit.value > 0.0
                && match custom.limit.mode.as_str() {
                    "word" => self.generated as f64 >= custom.limit.value,
                    "section" => {
                        self.section_index as f64 >= custom.limit.value && self.section.is_empty()
                    }
                    _ => false,
                };
        }
        false
    }

    pub fn generate(&mut self, repeating: bool) -> Result<Generated, crate::error::EngineError> {
        if let BatchState::Failed(error) = &self.batch {
            return Err(error.clone());
        }
        let mut batch = if let BatchState::AwaitingContent(batch) = std::mem::take(&mut self.batch)
        {
            if batch.repeating != repeating {
                self.batch = BatchState::AwaitingContent(batch);
                return Err("Generation already awaiting content".into());
            }
            batch
        } else {
            self.repeating = repeating;
            self.ordered = 0;
            self.shuffled.clear();
            self.section.clear();
            self.section_index = 0;
            self.section_history.clear();
            self.generated = 0;
            if !repeating {
                self.previous.clear();
            }
            let limit = self.limit();
            if limit > 1_000_000.0 {
                return Err("Generation request exceeds bound".into());
            }
            Batch {
                repeating,
                limit,
                words: vec![],
                indexes: vec![],
                raw: vec![],
            }
        };
        if batch.limit > 0.0 {
            loop {
                let next = match self.next_with_bound(
                    batch.words.len(),
                    batch.limit,
                    batch.raw.last(),
                    batch.raw.get(batch.raw.len().wrapping_sub(2)),
                ) {
                    Ok(next) => next,
                    Err(error) => {
                        if self.pending_request().is_some() {
                            self.batch = BatchState::AwaitingContent(batch);
                        }
                        return Err(error);
                    }
                };
                batch.indexes.push(next.section_index);
                batch.words.push(next.word);
                batch.raw.push(next.word_raw);
                let sections = self.config.mode == "custom"
                    && self
                        .custom
                        .as_ref()
                        .is_some_and(|custom| custom.pipe_delimiter);
                if (sections
                    && ((self.section.is_empty() && self.section_index as f64 >= batch.limit)
                        || batch.words.len() >= 100))
                    || (!sections && batch.words.len() as f64 >= batch.limit)
                {
                    break;
                }
            }
        }
        self.generated = batch.words.len();
        self.section_history.clear();
        let has_tab = batch
            .words
            .iter()
            .chain(&self.wordset)
            .any(|word| word.0.contains(&9));
        let has_newline = batch
            .words
            .iter()
            .chain(&self.wordset)
            .any(|word| word.0.contains(&10));
        Ok(Generated {
            words: batch.words,
            section_indexes: batch.indexes,
            has_tab,
            has_newline,
            all_right_to_left: self.language.right_to_left,
            all_joining_script: self.language.joining_script,
        })
    }

    /// Sample a fresh paragraph using the prepared dictionary, without cloning
    /// assets or changing the current generation, continuation or repeat state.
    pub fn preview(&mut self, seed: u32) -> Result<Vec<Text>, EngineError> {
        if !["time", "words"].contains(&self.config.mode.as_str()) || !self.config.funbox.is_empty()
        {
            return Err("Preview requires plain time/words content".into());
        }
        let random = std::mem::replace(&mut self.random, Random::seeded(seed));
        let repeating = std::mem::replace(&mut self.repeating, false);
        let generated = std::mem::replace(&mut self.generated, 0);
        let section = std::mem::take(&mut self.section);
        let section_index = std::mem::replace(&mut self.section_index, 0);
        let section_history = std::mem::take(&mut self.section_history);
        let previous = std::mem::take(&mut self.previous);
        let punctuation = std::mem::take(&mut self.punctuation);
        let result = (|| {
            let bound = self.limit();
            let count = (bound as usize).min(60);
            let mut words = Vec::with_capacity(count);
            let mut raw = Vec::with_capacity(count);
            for index in 0..count {
                let next =
                    self.next_with_bound(index, bound, raw.last(), raw.get(index.wrapping_sub(2)))?;
                words.push(next.word);
                raw.push(next.word_raw);
            }
            Ok(words)
        })();
        self.random = random;
        self.repeating = repeating;
        self.generated = generated;
        self.section = section;
        self.section_index = section_index;
        self.section_history = section_history;
        self.previous = previous;
        self.punctuation = punctuation;
        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::generation::{Assets, CustomLimit, CustomText, GenerationConfig, Language};
    use crate::quotes::{Quote, QuoteAsset};

    fn texts(words: &[&str]) -> Vec<Text> {
        words.iter().copied().map(Text::from).collect()
    }

    fn strings(words: &[Text]) -> Vec<String> {
        words
            .iter()
            .map(|word| String::from_utf16(&word.0).unwrap())
            .collect()
    }

    fn language() -> Language {
        Language {
            name: "english".into(),
            words: texts(&["alpha", "beta", "gamma", "delta", "epsilon", "zeta"]),
            ..Language::default()
        }
    }

    fn custom(mode: &str) -> CustomText {
        CustomText {
            text: texts(&["one", "two", "three", "four"]),
            mode: mode.into(),
            limit: CustomLimit {
                mode: "word".into(),
                value: 6.0,
            },
            pipe_delimiter: false,
        }
    }

    fn generate(mode: &str, custom: Option<CustomText>, assets: &mut Assets) -> Vec<String> {
        let config = GenerationConfig {
            mode: mode.into(),
            words: 8,
            quote_length: vec![0],
            ..GenerationConfig::default()
        };
        let mut generator =
            Generator::with_assets(config, language(), custom, Random::seeded(42), assets).unwrap();
        let generated = generator.generate(false).unwrap();
        assert_eq!(generated.section_indexes.len(), generated.words.len());
        assert!(generator.all_generated());
        strings(&generated.words)
    }

    #[test]
    fn seeded_generation_snapshots() {
        let mut assets = Assets::default();
        assert_eq!(
            generate("words", None, &mut assets),
            vec![
                "delta ", "gamma ", "zeta ", "epsilon ", "beta ", "delta ", "zeta ", "gamma "
            ]
        );
        assert_eq!(
            generate("custom", Some(custom("shuffle")), &mut assets),
            vec!["two ", "three ", "four ", "one ", "four ", "two "]
        );
        assert_eq!(
            generate("custom", Some(custom("repeat")), &mut assets),
            vec!["one ", "two ", "three ", "four ", "one ", "two "]
        );

        let mut assets = Assets {
            quote_asset: Some(QuoteAsset {
                language: "english".into(),
                groups: vec![(0, 100)],
                quotes: vec![Quote {
                    text: Text::from("the quick brown fox jumps"),
                    british_text: None,
                    source: "test".into(),
                    length: 25,
                    id: 1,
                    group: 0,
                    language: "english".into(),
                    text_split: vec![],
                }],
            }),
            ..Assets::default()
        };
        assert_eq!(
            generate("quote", None, &mut assets),
            vec!["the ", "quick ", "brown ", "fox ", "jumps "]
        );
    }
}
