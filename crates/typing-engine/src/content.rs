//! Host fetches and extracts HTML. Rust owns section cleanup and request ordering.
use crate::{Text, text::js_whitespace};
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use ts_rs::TS;
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Source {
    Poem {
        title: Text,
        author: Text,
        lines: Vec<Text>,
    },
    #[serde(rename_all = "camelCase")]
    Article {
        title: Text,
        author: Option<Text>,
        plain_text: Text,
    },
}
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
pub struct Section {
    pub title: Text,
    pub author: Option<Text>,
    pub words: Vec<Text>,
}
impl Source {
    pub fn kind(&self) -> &'static str {
        match self {
            Self::Poem { .. } => "poetry",
            Self::Article { .. } => "wikipedia",
        }
    }
    pub fn normalize(self, english: bool) -> Result<Section, crate::error::EngineError> {
        let (title, author, content_units, content_count) = match &self {
            Self::Poem {
                title,
                author,
                lines,
            } => (
                title,
                Some(author),
                lines.iter().map(Text::len).sum::<usize>(),
                lines.len(),
            ),
            Self::Article {
                title,
                author,
                plain_text,
            } => (title, author.as_ref(), plain_text.len(), 0),
        };
        if title.len() > 10000
            || author.is_some_and(|author| author.len() > 10000)
            || content_units > crate::validation::MAX_CONTENT_UNITS
            || content_count > crate::validation::MAX_WORDS
        {
            return Err(crate::error::EngineError::new(
                crate::error::ErrorCode::InvalidContent,
                "Section metadata/content exceeds bound",
            ));
        }
        match self {
            Self::Poem {
                title,
                author,
                lines,
            } => {
                if lines.len() > 1_000_000 || lines.iter().map(Text::len).sum::<usize>() > 5_000_000
                {
                    return Err("Poem exceeds content bound".into());
                }
                let mut words = vec![];
                'lines: for line in lines {
                    for word in line.0.split(|unit| *unit == 32) {
                        let word = Text(
                            word.iter()
                                .copied()
                                .filter(|unit| ![0x2014, 95, 32].contains(unit))
                                .collect(),
                        );
                        if word.is_empty() {
                            continue;
                        }
                        words.push(word);
                        if words.len() == 100 {
                            break 'lines;
                        }
                    }
                }
                Ok(Section {
                    title,
                    author: Some(author),
                    words,
                })
            }
            Self::Article {
                title,
                author,
                plain_text,
            } => {
                if plain_text.len() > 5_000_000 {
                    return Err("Article exceeds content bound".into());
                }
                let mut filtered = vec![];
                let mut index = 0;
                while index < plain_text.len() {
                    let unit = plain_text.0[index];
                    if unit == 91 {
                        let mut end = index + 1;
                        while plain_text
                            .0
                            .get(end)
                            .is_some_and(|unit| (48..=57).contains(unit))
                        {
                            end += 1;
                        }
                        if end > index + 1 && plain_text.0.get(end) == Some(&93) {
                            index = end + 1;
                            continue;
                        }
                    }
                    if ![0x200b, 0x200c, 0x200d, 0xfeff].contains(&unit) {
                        let replacement = match unit {
                            0x201c | 0x201d => Some("\""),
                            0x2019 | 0x2018 => Some("'"),
                            0x2014 | 0x2013 => Some("-"),
                            0x2026 => Some("..."),
                            0xab => Some("<<"),
                            0xbb => Some(">>"),
                            0x2007 | 0x202f | 0xa0 => Some(" "),
                            _ => None,
                        };
                        if let Some(value) = replacement {
                            filtered.extend(value.encode_utf16());
                        } else {
                            filtered.push(unit);
                        }
                    }
                    index += 1;
                }
                if english {
                    filtered.retain(|unit| (0x20..=0x7e).contains(unit));
                }
                let mut collapsed = vec![];
                for unit in filtered {
                    if js_whitespace(unit) {
                        if !collapsed.is_empty() && collapsed.last() != Some(&32) {
                            collapsed.push(32);
                        }
                    } else {
                        collapsed.push(unit);
                    }
                }
                if collapsed.last() == Some(&32) {
                    collapsed.pop();
                }
                let words = if collapsed.is_empty() {
                    vec![]
                } else {
                    collapsed
                        .split(|unit| *unit == 32)
                        .map(|word| Text(word.to_vec()))
                        .collect()
                };
                crate::validation::words(&words)?;
                Ok(Section {
                    title,
                    author,
                    words,
                })
            }
        }
    }
}
#[derive(Clone, Debug, PartialEq, Eq, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Request {
    pub id: u32,
    pub generation: u32,
    pub kind: String,
    pub language: String,
}
/// One outstanding request, bounded prefetch; resets invalidate all prior tokens.
pub struct Queue {
    kind: String,
    language: String,
    english: bool,
    generation: u32,
    next_id: u32,
    pending: Option<Request>,
    ready: VecDeque<Section>,
}
impl Queue {
    pub fn new(kind: String, language: String, english: bool) -> Self {
        Self {
            kind,
            language,
            english,
            generation: 0,
            next_id: 0,
            pending: None,
            ready: VecDeque::new(),
        }
    }
    pub fn prefetch(&mut self, source: Source) -> Result<(), crate::error::EngineError> {
        if source.kind() != self.kind {
            return Err("Unexpected section source kind".into());
        }
        if self.ready.len() >= 16 {
            return Err("Section prefetch bound exceeded".into());
        }
        let section = source.normalize(self.english)?;
        if section.words.is_empty() {
            return Err("Section has no words".into());
        }
        self.ready.push_back(section);
        Ok(())
    }
    pub fn request(&mut self) -> Request {
        if let Some(request) = &self.pending {
            return request.clone();
        }
        self.next_id = self.next_id.wrapping_add(1);
        let request = Request {
            id: self.next_id,
            generation: self.generation,
            kind: self.kind.clone(),
            language: self.language.clone(),
        };
        self.pending = Some(request.clone());
        request
    }
    pub fn supply(
        &mut self,
        request: &Request,
        source: Source,
    ) -> Result<(), crate::error::EngineError> {
        if self.pending.as_ref() != Some(request) {
            return Err(crate::error::EngineError::new(
                crate::error::ErrorCode::StaleRequest,
                "Stale or mismatched content request",
            ));
        }
        self.prefetch(source)?;
        self.pending = None;
        Ok(())
    }
    pub fn reject(&mut self, request: &Request) -> Result<(), crate::error::EngineError> {
        if self.pending.as_ref() != Some(request) {
            return Err(crate::error::EngineError::new(
                crate::error::ErrorCode::StaleRequest,
                "Stale or mismatched content request",
            ));
        }
        self.pending = None;
        Ok(())
    }
    pub fn pop(&mut self) -> Option<Section> {
        self.ready.pop_front()
    }
    pub fn is_empty(&self) -> bool {
        self.ready.is_empty()
    }
    pub fn pending(&self) -> Option<&Request> {
        self.pending.as_ref()
    }
    pub fn reset(&mut self, generation: u32) {
        self.generation = generation;
        self.pending = None;
        self.ready.clear();
    }
    pub(crate) fn set_generation(&mut self, generation: u32) {
        self.generation = generation;
        self.pending = None;
    }
}
