use crate::{Text, random::Random};
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use ts_rs::TS;

#[derive(Clone, Debug, Default, Deserialize, TS)]
#[serde(default, rename_all = "camelCase")]
pub struct Language {
    pub name: String,
    pub bcp47: Option<String>,
    pub words: Vec<Text>,
    pub right_to_left: Option<bool>,
    pub joining_script: bool,
    pub original_punctuation: bool,
    pub no_lazy_mode: bool,
    pub additional_accents: Vec<(Text, Text)>,
}
pub type GenerationConfig = crate::Config;
#[derive(Clone, Debug, Deserialize, TS)]
pub struct CustomLimit {
    pub mode: String,
    pub value: usize,
}
#[derive(Clone, Debug, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct CustomText {
    pub text: Vec<Text>,
    pub mode: String,
    pub limit: CustomLimit,
    pub pipe_delimiter: bool,
}
#[derive(Clone, Debug, Serialize, PartialEq, Eq, TS)]
#[serde(rename_all = "camelCase")]
pub struct NextWord {
    pub word: Text,
    pub word_raw: Text,
    pub section_index: usize,
}
#[derive(Debug, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Generated {
    pub words: Vec<Text>,
    pub section_indexes: Vec<usize>,
    pub has_tab: bool,
    pub has_newline: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub all_right_to_left: Option<bool>,
    pub all_joining_script: bool,
}
#[derive(Default)]
pub struct Assets {
    pub quotes: crate::quotes::Quotes,
    pub quote_asset: Option<crate::quotes::QuoteAsset>,
    pub selected_quote_id: u32,
    pub favorite_quote_ids: Vec<u32>,
    pub polyglot: Vec<Language>,
    pub sections: Vec<crate::content::Source>,
}
struct Batch {
    repeating: bool,
    limit: usize,
    words: Vec<Text>,
    indexes: Vec<usize>,
    raw: Vec<Text>,
}
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
    previous: Vec<NextWord>,
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
    batch: Option<Batch>,
}
pub(crate) fn case(text: &Text, upper: bool) -> Text {
    let mut output = vec![];
    let mut valid = String::new();
    fn flush(valid: &mut String, output: &mut Vec<u16>, upper: bool) {
        let transformed = if upper {
            valid.to_uppercase()
        } else {
            valid.to_lowercase()
        };
        output.extend(transformed.encode_utf16());
        valid.clear();
    }
    for value in char::decode_utf16(text.0.iter().copied()) {
        match value {
            Ok(value) => valid.push(value),
            Err(error) => {
                flush(&mut valid, &mut output, upper);
                output.push(error.unpaired_surrogate());
            }
        }
    }
    flush(&mut valid, &mut output, upper);
    Text(output)
}
fn clean_previous(text: &Text, apostrophe: bool) -> Text {
    case(
        &Text(
            text.0
                .iter()
                .copied()
                .filter(|unit| {
                    ![46, 63, 33, 34, 58, 45, 44].contains(unit) && !(apostrophe && *unit == 39)
                })
                .collect(),
        ),
        false,
    )
}
fn collapse_spaces(text: Text) -> Text {
    let mut result = vec![];
    for unit in text.0 {
        if unit != 32 || result.last() != Some(&32) {
            result.push(unit);
        }
    }
    if result.first() == Some(&32) {
        result.remove(0);
    }
    if result.last() == Some(&32) {
        result.pop();
    }
    Text(result)
}
impl Generator {
    pub fn random_state(&self) -> &Random {
        &self.random
    }
    pub fn config(&self) -> &GenerationConfig {
        &self.config
    }
    pub fn custom_limit(&self) -> Option<crate::results::Limit> {
        self.custom.as_ref().map(|custom| crate::results::Limit {
            mode: custom.limit.mode.clone(),
            value: custom.limit.value as f64,
        })
    }
    pub fn new(
        config: GenerationConfig,
        language: Language,
        custom: Option<CustomText>,
        random: Random,
    ) -> Result<Self, String> {
        Self::with_assets(config, language, custom, random, &mut Assets::default())
    }
    pub fn with_assets(
        config: GenerationConfig,
        mut language: Language,
        custom: Option<CustomText>,
        mut random: Random,
        assets: &mut Assets,
    ) -> Result<Self, String> {
        config.validate()?;
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
        let current_quote = if config.mode == "quote" {
            if let Some(asset) = assets.quote_asset.take() {
                assets
                    .quotes
                    .load(asset, &config.quote_length, &mut random)?;
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
            if assets.polyglot.len() < 2 {
                return Err("Polyglot requires at least two valid languages".into());
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
                return Err("Polyglot language direction conflict; update main language".into());
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
            batch: None,
        })
    }
    fn limit(&self) -> usize {
        if self.config.mode == "zen" {
            return 0;
        }
        let mut limit = 100;
        if self.config.show_all_lines && self.config.mode == "words" {
            limit = self.config.words as usize;
        }
        if self.config.mode == "words" && self.config.words as usize == 0 {
            limit = 100;
        }
        if let Some(custom) = &self.custom
            && self.config.mode == "custom"
        {
            limit = if custom.limit.value == 0 || custom.limit.mode == "time" {
                100
            } else {
                custom.limit.value.min(100)
            };
        }
        if self.config.mode == "words" && self.config.words as usize > 0 {
            limit = limit.min(self.config.words as usize);
        }
        for funbox in &self.config.funbox {
            if let Some(count) = match funbox.as_str() {
                "plus_zero" => Some(1),
                "plus_one" => Some(2),
                "plus_two" => Some(3),
                "plus_three" => Some(4),
                _ => None,
            } {
                limit = count;
                break;
            }
        }
        if self.config.mode == "words" && self.config.words as usize > 0 {
            limit = limit.min(self.config.words as usize);
        }
        if let Some(quote) = &self.current_quote {
            limit = if self.config.show_all_lines {
                quote.text_split.len()
            } else {
                limit.min(quote.text_split.len())
            };
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
            return custom.limit.value > 0
                && match custom.limit.mode.as_str() {
                    "word" => self.generated >= custom.limit.value,
                    "section" => {
                        self.section_index >= custom.limit.value && self.section.is_empty()
                    }
                    _ => false,
                };
        }
        false
    }
    fn random_word(&mut self) -> Result<Text, String> {
        if self.config.funbox.iter().any(|name| name == "pseudolang") {
            let generator = self
                .pseudolang
                .get_or_insert_with(|| crate::generated_funboxes::Pseudolang::new(&self.wordset));
            return generator.word(&mut self.random);
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
    fn next_shuffled(&mut self) -> Result<Text, String> {
        if self.shuffled.is_empty() {
            self.shuffled = (0..self.wordset.len()).collect();
            self.random.shuffle(&mut self.shuffled)?;
        }
        Ok(self.wordset[self.shuffled.pop().unwrap()].clone())
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
    ) -> Result<(), String> {
        self.section_queue
            .as_mut()
            .ok_or("Generator has no section source")?
            .supply(request, source)
    }
    pub fn reset_requests(&mut self, generation: u32) {
        if let Some(queue) = &mut self.section_queue {
            queue.reset(generation);
        }
        self.batch = None;
    }
    pub fn generate(&mut self, repeating: bool) -> Result<Generated, String> {
        let mut batch = if let Some(batch) = self.batch.take() {
            if batch.repeating != repeating {
                self.batch = Some(batch);
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
            if limit > 1_000_000 {
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
        if batch.limit > 0 {
            loop {
                let next = match self.next(
                    batch.words.len(),
                    batch.limit,
                    batch.raw.last(),
                    batch.raw.get(batch.raw.len().wrapping_sub(2)),
                ) {
                    Ok(next) => next,
                    Err(error) => {
                        if self.pending_request().is_some() {
                            self.batch = Some(batch);
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
                    && ((self.section.is_empty() && self.section_index >= batch.limit)
                        || batch.words.len() >= 100))
                    || (!sections && batch.words.len() >= batch.limit)
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
    pub fn next(
        &mut self,
        index: usize,
        bound: usize,
        previous: Option<&Text>,
        previous2: Option<&Text>,
    ) -> Result<NextWord, String> {
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
                            || (custom.limit.mode == "word" && index < custom.limit.value)
                            || (custom.limit.mode == "section"
                                && self.section_index < custom.limit.value)
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
            return Err("Section content required".into());
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
            let mut out = vec![];
            for unit in word.0 {
                if unit == 0xdf {
                    out.extend([115, 115]);
                } else {
                    out.push(unit);
                }
            }
            word = Text(out);
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
            word = crate::transforms::alter(name, word, index, bound, &mut self.random)?;
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

#[derive(Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Prepare {
    pub config: GenerationConfig,
    pub language: Language,
    pub custom: Option<CustomText>,
    pub random: Random,
    pub quotes: Option<crate::quotes::QuoteAsset>,
    #[serde(default)]
    pub polyglot: Vec<Language>,
    #[serde(default)]
    pub selected_quote_id: u32,
    #[serde(default)]
    pub favorite_quote_ids: Vec<u32>,
    #[serde(default)]
    pub sections: Vec<crate::content::Source>,
}
/// Retains only explicitly owned content-selection state across restarts.
#[derive(Default)]
pub struct Content {
    assets: Assets,
    generator: Option<Generator>,
    weak_spot: crate::weak_spot::WeakSpot,
    last_pace_wpm: f64,
}
impl Content {
    /// Consume the prior session before preparing its replacement. Only learning
    /// survives; logs, pending replies and input state are dropped with the session.
    pub fn recycle_session(&mut self, session: crate::Session) {
        (self.weak_spot, self.last_pace_wpm) = session.into_learning();
        self.generator = None;
    }
    pub fn prepare(&mut self, input: Prepare) -> Result<(), String> {
        self.generator = None;
        self.assets.quote_asset = input.quotes;
        self.assets.polyglot = input.polyglot;
        self.assets.selected_quote_id = input.selected_quote_id;
        self.assets.favorite_quote_ids = input.favorite_quote_ids;
        self.assets.sections = input.sections;
        self.generator = Some(Generator::with_assets(
            input.config,
            input.language,
            input.custom,
            input.random,
            &mut self.assets,
        )?);
        self.generator.as_mut().unwrap().weak_spot = self.weak_spot.clone();
        Ok(())
    }
    pub fn start_session(&mut self, repeating: bool) -> Result<crate::Session, String> {
        let generated = self.generator()?.generate(repeating)?;
        let generator = self.generator.take().ok_or("Content not prepared")?;
        let mut session = crate::Session::from_generated(generator, generated)?;
        session.pace.remember(self.last_pace_wpm, false);
        Ok(session)
    }
    pub fn generator(&mut self) -> Result<&mut Generator, String> {
        self.generator.as_mut().ok_or("Content not prepared".into())
    }
}
