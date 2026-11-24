use crate::Text;
use crate::error::{EngineError, ErrorCode};

use super::Generator;
use super::text::{case, clean_previous, collapse_spaces, replace_eszett};
use super::types::{BatchState, NextWord};

impl Generator {
    fn random_word(&mut self) -> Result<Text, crate::error::EngineError> {
        if self.config.funbox.iter().any(|name| name == "pseudolang") {
            let generator = self
                .pseudolang
                .get_or_insert_with(|| crate::generated_funboxes::Pseudolang::new(&self.wordset));
            return generator.word(&mut self.random).map_err(Into::into);
        }
        let index = if self.config.funbox.iter().any(|name| name == "zipf") {
            self.random.zipf_index(self.wordset.len())?
        } else {
            self.random.index(self.wordset.len())?
        };
        Ok(self.wordset[index].clone())
    }

    fn lazy(&self, word: Text) -> Text {
        let language = if self.polyglot.is_empty() {
            Some(&self.language)
        } else {
            self.word_languages
                .get(&word.0)
                .and_then(|index| self.polyglot.get(*index))
        };
        if let Some(language) = language
            && self.config.lazy_mode
            && (!language.no_lazy_mode || self.config.mode == "custom")
        {
            self.rules.lazy(&word, &language.additional_accents)
        } else {
            word
        }
    }

    fn next_ordered(&mut self) -> Text {
        if self.ordered >= self.wordset.len() {
            self.ordered = 0;
        }
        let word = self.wordset[self.ordered].clone();
        self.ordered += 1;
        word
    }

    fn next_shuffled(&mut self) -> Result<Text, crate::error::EngineError> {
        if self.shuffled.is_empty() {
            self.shuffled = (0..self.wordset.len()).collect();
            self.random.shuffle(&mut self.shuffled)?;
        }
        Ok(self.wordset[self.shuffled.pop().unwrap()].clone())
    }

    pub fn next(
        &mut self,
        index: usize,
        bound: usize,
        previous: Option<&Text>,
        previous2: Option<&Text>,
    ) -> Result<NextWord, crate::error::EngineError> {
        self.next_with_bound(index, bound as f64, previous, previous2)
    }

    pub fn next_with_bound(
        &mut self,
        index: usize,
        bound: f64,
        previous: Option<&Text>,
        previous2: Option<&Text>,
    ) -> Result<NextWord, crate::error::EngineError> {
        if !bound.is_finite() || !(0.0..=1_000_000.0).contains(&bound) || index > 1_000_000 {
            return Err("Invalid generation position/bound".into());
        }

        if let BatchState::Failed(error) = &self.batch {
            return Err(error.clone());
        }
        if self.repeating
            && self.config.mode != "quote"
            && let Some(next) = self.previous.get(index)
        {
            self.section_index += 1;
            self.generated = index + 1;
            return Ok(next.clone());
        }
        if self.repeating && self.config.mode != "quote" {
            let continuation = self.config.mode == "time"
                || (self.config.mode == "words" && index < self.config.words as usize)
                || (self.config.mode == "custom"
                    && self.custom.as_ref().is_some_and(|custom| {
                        custom.limit.mode == "time"
                            || (custom.limit.mode == "word" && (index as f64) < custom.limit.value)
                            || (custom.limit.mode == "section"
                                && (self.section_index as f64) < custom.limit.value)
                    }));
            if !continuation {
                return Err("Repeated word is undefined".into());
            }
        }
        if self.section.is_empty()
            && let Some(queue) = &mut self.section_queue
            && queue.is_empty()
        {
            queue.request();
            return Err(EngineError::new(
                ErrorCode::ContentRequired,
                "Section content required",
            ));
        }
        let mut word = self.random_word()?;
        let previous_original = previous.cloned();
        let previous = previous.map(|word| clean_previous(word, false));
        let previous2 = previous2.map(|word| clean_previous(word, true));
        if self.section.is_empty() {
            let custom = self.custom.clone();
            if self.config.mode == "quote"
                || (self.config.mode == "custom"
                    && custom
                        .as_ref()
                        .is_some_and(|custom| custom.mode == "repeat"))
            {
                word = self.next_ordered();
            } else if self.config.mode == "custom"
                && custom
                    .as_ref()
                    .is_some_and(|custom| custom.mode == "random")
                && self.wordset.len() < 4
                && !self.config.funbox.iter().any(|name| name == "pseudolang")
            {
                word = self.random_word()?;
            } else if self.config.mode == "custom"
                && custom
                    .as_ref()
                    .is_some_and(|custom| custom.mode == "shuffle")
            {
                word = self.next_shuffled()?;
            } else if self.config.mode == "custom"
                && custom
                    .as_ref()
                    .is_some_and(|custom| custom.limit.mode == "section")
            {
                word = self.random_word()?;
                let mut retries = 0;
                while retries < 100
                    && (self.section_history.last() == Some(&word)
                        || self
                            .section_history
                            .get(self.section_history.len().wrapping_sub(2))
                            == Some(&word))
                {
                    retries += 1;
                    word = self.random_word()?;
                }
            } else if let Some(section) = self.section_queue.as_mut().and_then(|queue| queue.pop())
            {
                let mut units = vec![];
                for (index, source_word) in section.words.into_iter().enumerate() {
                    if self.config.mode == "words" && index >= self.config.words as usize {
                        break;
                    }
                    if index > 0 {
                        units.push(32);
                    }
                    units.extend(source_word.0);
                }
                word = Text(units);
            } else {
                let mut retries = 0;
                let mut first = self.lazy(case(
                    &Text(
                        word.0
                            .split(|unit| *unit == 32)
                            .next()
                            .unwrap_or_default()
                            .to_vec(),
                    ),
                    false,
                ));
                while retries < 100
                    && (previous.as_ref() == Some(&first)
                        || previous2.as_ref() == Some(&first)
                        || (self.config.mode != "custom"
                            && ((!self.config.punctuation && word.0 == [73])
                                || (!self.config.punctuation
                                    && !self.config.language.starts_with("code")
                                    && word.0.iter().any(|unit| {
                                        b"-=_+[]{};'\\:\"|,./<>?".contains(&(*unit as u8))
                                            && *unit < 128
                                    }))
                                || (!self.config.numbers
                                    && word.0.iter().any(|unit| (48..=57).contains(unit))))))
                {
                    retries += 1;
                    word = self.random_word()?;
                    first = self.lazy(Text(
                        word.0
                            .split(|unit| *unit == 32)
                            .next()
                            .unwrap_or_default()
                            .to_vec(),
                    ));
                }
            }
            word = collapse_spaces(word);
            for name in &self.config.funbox {
                let generated = match name.as_str() {
                    "arrows" => Some(self.arrows.word(index == 0, &mut self.random)?),
                    "IPv4" => Some(crate::generated_funboxes::ip(4, &mut self.random)?),
                    "IPv6" => Some(crate::generated_funboxes::ip(6, &mut self.random)?),
                    "weakspot" => {
                        let mut candidates = vec![];
                        for _ in 0..20 {
                            candidates
                                .push(self.wordset[self.random.index(self.wordset.len())?].clone());
                        }
                        self.weak_spot.best(&candidates).cloned()
                    }
                    _ => crate::transforms::generated_word(name, &mut self.random)?,
                };
                if let Some(generated) = generated {
                    word = if name == "58008"
                        && (self.config.language.starts_with("kurdish")
                            || self.config.language.starts_with("nepali"))
                    {
                        crate::transforms::numeral_script(generated, &self.config.language)
                    } else {
                        generated
                    };
                    break;
                }
            }
            self.section = word
                .0
                .split(|unit| *unit == 32)
                .map(|part| Text(part.to_vec()))
                .collect();
            self.section_history.push(word);
            self.section_index += 1;
        }
        word = self.section.pop_front().ok_or("Empty generated section")?;
        if word.is_empty() {
            return Err("Random word is empty".into());
        }
        let word_language = self
            .word_languages
            .get(&word.0)
            .and_then(|index| self.polyglot.get(*index))
            .map_or(self.config.language.as_str(), |language| {
                language.name.as_str()
            });
        if self.config.mode != "custom"
            && self.config.mode != "quote"
            && self.section_queue.is_none()
            && !self.config.punctuation
            && !self.config.funbox.iter().any(|name| {
                [
                    "binary",
                    "hexadecimal",
                    "gibberish",
                    "ascii",
                    "specials",
                    "arrows",
                    "IPv4",
                    "IPv6",
                    "weakspot",
                ]
                .contains(&name.as_str())
            })
            && word.0.iter().any(|unit| (65..=90).contains(unit))
            && !["german", "swiss_german", "code", "klingon"]
                .iter()
                .any(|prefix| word_language.starts_with(prefix))
        {
            word = case(&word, false);
        }
        word = collapse_spaces(word);
        word = self.lazy(word);
        if self.config.language.starts_with("swiss_german") {
            word = replace_eszett(word);
        }
        if self.config.punctuation
            && !self.language.original_punctuation
            && self.section_queue.is_none()
        {
            word = self.punctuation.apply(
                word,
                crate::punctuation::PunctuationContext {
                    previous: previous_original.as_ref(),
                    index,
                    bound,
                    language: &self.config.language,
                    funboxes: &self.config.funbox,
                },
                &mut self.random,
            )?;
        }
        if self.config.british_english
            && self.config.language.contains("english")
            && !self.current_quote.as_ref().is_some_and(|quote| {
                quote
                    .british_text
                    .as_ref()
                    .is_some_and(|text| !text.is_empty())
            })
        {
            word = self
                .rules
                .british(word, previous.as_ref(), self.config.mode == "quote");
        }
        if self.config.numbers && self.random.draw()? < 0.1 {
            word = crate::transforms::numeral_script(
                crate::transforms::numbers(&mut self.random, 4)?,
                &self.config.language,
            );
        }
        for name in &self.config.funbox {
            word = crate::transforms::alter_with_bound(name, word, index, bound, &mut self.random)?;
        }
        let mut committed = word.clone();
        if committed.0.last() != Some(&10)
            && !self.config.funbox.iter().any(|name| {
                crate::funboxes::get(name).is_some_and(|metadata| {
                    metadata
                        .properties
                        .iter()
                        .any(|property| property == "nospace")
                })
            })
        {
            committed.0.push(32);
        }
        let next = NextWord {
            word: committed,
            word_raw: word,
            section_index: self.section_index,
        };
        self.previous.push(next.clone());
        self.generated = index + 1;
        Ok(next)
    }
}
