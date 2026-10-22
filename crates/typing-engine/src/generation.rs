use crate::{Text, random::Random};
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Language {
    pub name: String,
    pub words: Vec<Text>,
    pub right_to_left: Option<bool>,
    pub joining_script: bool,
    pub original_punctuation: bool,
}
#[derive(Clone, Debug, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct GenerationConfig {
    pub mode: String,
    pub words: usize,
    pub language: String,
    pub show_all_lines: bool,
    pub punctuation: bool,
    pub numbers: bool,
    pub lazy_mode: bool,
    pub british_english: bool,
    pub funbox: Vec<String>,
}
impl Default for GenerationConfig {
    fn default() -> Self {
        let config = crate::Config::default();
        Self {
            mode: config.mode,
            words: config.words as usize,
            language: config.language,
            show_all_lines: false,
            punctuation: false,
            numbers: false,
            lazy_mode: false,
            british_english: false,
            funbox: vec![],
        }
    }
}
#[derive(Clone, Debug, Deserialize)]
pub struct CustomLimit {
    pub mode: String,
    pub value: usize,
}
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomText {
    pub text: Vec<Text>,
    pub mode: String,
    pub limit: CustomLimit,
    pub pipe_delimiter: bool,
}
#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct NextWord {
    pub word: Text,
    pub word_raw: Text,
    pub section_index: usize,
}
#[derive(Debug, Serialize)]
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
    pub fn new(
        config: GenerationConfig,
        language: Language,
        custom: Option<CustomText>,
        random: Random,
    ) -> Result<Self, String> {
        if !["time", "words", "custom", "zen", "quote"].contains(&config.mode.as_str()) {
            return Err("Invalid mode".into());
        }
        if config.mode == "quote" {
            return Err("Quote asset selection is not yet ported".into());
        }
        if config.lazy_mode
            || config.british_english
            || config.funbox.iter().any(|name| {
                ![
                    "58008",
                    "binary",
                    "hexadecimal",
                    "gibberish",
                    "ascii",
                    "specials",
                    "backwards",
                    "ALL_CAPS",
                    "capitals",
                    "sPoNgEcAsE",
                    "rAnDoMcAsE",
                    "rot13",
                    "ddoouubblleedd",
                    "instant_messaging",
                    "underscore_spaces",
                    "nospace",
                    "plus_zero",
                    "plus_one",
                    "plus_two",
                    "plus_three",
                    "zipf",
                ]
                .contains(&name.as_str())
            })
        {
            return Err("Requested generator transform is not yet ported".into());
        }
        if config.mode == "custom" && custom.is_none() {
            return Err("Missing custom text".into());
        }
        if let Some(custom) = &custom
            && (!["repeat", "random", "shuffle"].contains(&custom.mode.as_str())
                || !["word", "time", "section"].contains(&custom.limit.mode.as_str()))
        {
            return Err("Invalid custom mode or limit".into());
        }
        let mut wordset = if config.mode == "custom" {
            custom.as_ref().unwrap().text.clone()
        } else {
            language.words.clone()
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
        })
    }
    fn limit(&self) -> usize {
        if self.config.mode == "zen" {
            return 0;
        }
        let mut limit = 100;
        if self.config.show_all_lines && self.config.mode == "words" {
            limit = self.config.words;
        }
        if self.config.mode == "words" && self.config.words == 0 {
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
        if self.config.mode == "words" && self.config.words > 0 {
            limit = limit.min(self.config.words);
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
        if self.config.mode == "words" && self.config.words > 0 {
            limit = limit.min(self.config.words);
        }
        limit
    }
    pub fn all_generated(&self) -> bool {
        if self.config.mode == "words" {
            return self.config.words > 0 && self.generated >= self.config.words;
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
        let index = if self.config.funbox.iter().any(|name| name == "zipf") {
            self.random.zipf_index(self.wordset.len())?
        } else {
            self.random.index(self.wordset.len())?
        };
        Ok(self.wordset[index].clone())
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
    pub fn generate(&mut self, repeating: bool) -> Result<Generated, String> {
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
        let mut words = vec![];
        let mut indexes = vec![];
        let mut raw: Vec<Text> = vec![];
        if limit > 0 {
            loop {
                let next = self.next(
                    words.len(),
                    limit,
                    raw.last(),
                    raw.get(raw.len().wrapping_sub(2)),
                )?;
                indexes.push(next.section_index);
                words.push(next.word.clone());
                raw.push(next.word_raw);
                let sections = self.config.mode == "custom"
                    && self
                        .custom
                        .as_ref()
                        .is_some_and(|custom| custom.pipe_delimiter);
                if (sections
                    && ((self.section.is_empty() && self.section_index >= limit)
                        || words.len() >= 100))
                    || (!sections && words.len() >= limit)
                {
                    break;
                }
            }
        }
        self.generated = words.len();
        self.section_history.clear();
        let has_tab = words
            .iter()
            .chain(&self.wordset)
            .any(|word| word.0.contains(&9));
        let has_newline = words
            .iter()
            .chain(&self.wordset)
            .any(|word| word.0.contains(&10));
        Ok(Generated {
            words,
            section_indexes: indexes,
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
            && let Some(next) = self.previous.get(index)
        {
            self.section_index += 1;
            self.generated = index + 1;
            return Ok(next.clone());
        }
        let mut word = self.random_word()?;
        let previous_original = previous.cloned();
        let previous = previous.map(|word| clean_previous(word, false));
        let previous2 = previous2.map(|word| clean_previous(word, true));
        if self.section.is_empty() {
            let custom = self.custom.clone();
            if self.config.mode == "custom"
                && custom
                    .as_ref()
                    .is_some_and(|custom| custom.mode == "repeat")
            {
                word = self.next_ordered();
            } else if self.config.mode == "custom"
                && custom
                    .as_ref()
                    .is_some_and(|custom| custom.mode == "random")
                && self.wordset.len() < 4
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
            } else {
                let mut retries = 0;
                let mut first = case(
                    &Text(
                        word.0
                            .split(|unit| *unit == 32)
                            .next()
                            .unwrap_or_default()
                            .to_vec(),
                    ),
                    false,
                );
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
                    first = Text(
                        word.0
                            .split(|unit| *unit == 32)
                            .next()
                            .unwrap_or_default()
                            .to_vec(),
                    );
                }
            }
            word = collapse_spaces(word);
            for name in &self.config.funbox {
                if let Some(generated) = crate::transforms::generated_word(name, &mut self.random)?
                {
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
        if self.config.mode != "custom"
            && !self.config.punctuation
            && !self.config.funbox.iter().any(|name| {
                ["binary", "hexadecimal", "gibberish", "ascii", "specials"].contains(&name.as_str())
            })
            && word.0.iter().any(|unit| (65..=90).contains(unit))
            && !["german", "swiss_german", "code", "klingon"]
                .iter()
                .any(|prefix| self.config.language.starts_with(prefix))
        {
            word = case(&word, false);
        }
        word = collapse_spaces(word);
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
        if self.config.punctuation && !self.language.original_punctuation {
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
            && !self
                .config
                .funbox
                .iter()
                .any(|name| ["nospace", "underscore_spaces"].contains(&name.as_str()))
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
