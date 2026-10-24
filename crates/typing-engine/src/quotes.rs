use crate::error::{EngineError, ErrorCode, Recovery};
use crate::{Text, random::Random};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Quote {
    pub text: Text,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub british_text: Option<Text>,
    pub source: String,
    pub length: usize,
    pub id: u32,
    #[serde(default)]
    pub group: usize,
    #[serde(default)]
    pub language: String,
    #[serde(default)]
    pub text_split: Vec<Text>,
}
#[derive(Clone, Debug, Deserialize, TS)]
pub struct QuoteAsset {
    pub language: String,
    pub groups: Vec<(usize, usize)>,
    pub quotes: Vec<Quote>,
}
#[derive(Default, Serialize, TS)]
pub struct QuoteCollection {
    pub quotes: Vec<Quote>,
    pub length: usize,
    pub language: Option<String>,
    pub groups: Vec<Vec<usize>>,
}
/// Host-owned lifetime, engine-owned selection; never a process-global queue.
#[derive(Default)]
pub struct Quotes {
    language: Option<String>,
    quotes: Vec<Quote>,
    groups: Vec<Vec<usize>>,
    queue: Vec<usize>,
    queued_quotes: Option<Vec<Quote>>,
    cursor: usize,
}
impl Quotes {
    pub fn is_empty(&self) -> bool {
        self.quotes.is_empty()
    }
    pub fn load(
        &mut self,
        mut asset: QuoteAsset,
        lengths: &[i32],
        random: &mut Random,
    ) -> Result<(), crate::error::EngineError> {
        crate::validation::quote_asset(&asset)?;
        if self.language.as_ref() == Some(&asset.language) {
            return Ok(());
        }
        if asset.quotes.is_empty() {
            return Err(EngineError::recover(
                ErrorCode::NoQuotes,
                "No quotes found",
                vec![Recovery::SetMode {
                    mode: "words".into(),
                }],
            ));
        }
        if asset.quotes.len() > 1_000_000
            || asset
                .quotes
                .iter()
                .any(|quote| quote.text.len() > 1_000_000)
        {
            return Err("Quote asset exceeds bound".into());
        }
        self.groups = asset
            .groups
            .iter()
            .enumerate()
            .map(|(group, (lower, upper))| {
                asset
                    .quotes
                    .iter_mut()
                    .enumerate()
                    .filter_map(|(index, quote)| {
                        quote.language = asset.language.clone();
                        if (*lower..=*upper).contains(&quote.length) {
                            quote.group = group;
                            Some(index)
                        } else {
                            None
                        }
                    })
                    .collect()
            })
            .collect();
        self.language = Some(asset.language);
        self.quotes = asset.quotes;
        self.update_queue(lengths, random)
    }
    pub fn collection(&self) -> QuoteCollection {
        QuoteCollection {
            quotes: self.quotes.clone(),
            length: self.quotes.len(),
            language: self.language.clone(),
            groups: self.groups.clone(),
        }
    }
    /// Legacy catalog reads replace the collection but preserve an already-built
    /// queue unless lengths were explicitly supplied. Old queue objects retain
    /// their original language/content even after the catalog changes.
    pub fn load_catalog(
        &mut self,
        asset: QuoteAsset,
        lengths: Option<&[i32]>,
        random: &mut Random,
    ) -> Result<QuoteCollection, EngineError> {
        crate::validation::quote_asset(&asset)?;
        if self.language.as_ref() == Some(&asset.language) {
            return Ok(self.collection());
        }
        if asset.quotes.is_empty() {
            return Ok(QuoteCollection::default());
        }
        let retained = if lengths.is_none() {
            Some((
                self.queue.clone(),
                self.cursor,
                self.queued_quotes
                    .take()
                    .unwrap_or_else(|| self.quotes.clone()),
            ))
        } else {
            None
        };
        self.load(asset, lengths.unwrap_or_default(), random)?;
        if let Some((queue, cursor, quotes)) = retained {
            self.queue = queue;
            self.cursor = cursor;
            self.queued_quotes = Some(quotes);
        }
        Ok(self.collection())
    }
    pub fn random_quote(&mut self, random: &mut Random) -> Result<Option<Quote>, EngineError> {
        if self.queue.is_empty() {
            return Ok(None);
        }
        if self.cursor >= self.queue.len() {
            self.cursor = 0;
            random.shuffle(&mut self.queue)?;
        }
        let quotes = self.queued_quotes.as_ref().unwrap_or(&self.quotes);
        let quote = quotes[self.queue[self.cursor]].clone();
        self.cursor += 1;
        Ok(Some(quote))
    }
    pub fn update_queue(
        &mut self,
        lengths: &[i32],
        random: &mut Random,
    ) -> Result<(), crate::error::EngineError> {
        self.queue.clear();
        self.queued_quotes = None;
        for group in lengths {
            if *group >= 0
                && let Some(indexes) = self.groups.get(*group as usize)
            {
                self.queue.extend_from_slice(indexes);
            }
        }
        random.shuffle(&mut self.queue)?;
        self.cursor = 0;
        Ok(())
    }
    pub fn select(
        &mut self,
        language: &str,
        lengths: &[i32],
        selected: u32,
        favorites: &[u32],
        british: bool,
        random: &mut Random,
    ) -> Result<Quote, crate::error::EngineError> {
        let queued = lengths != [-2] && !lengths.contains(&-3);
        let mut quote = if lengths == [-2] {
            self.quotes
                .iter()
                .find(|q| q.id == selected)
                .cloned()
                .ok_or_else(|| {
                    EngineError::recover(
                        ErrorCode::SelectedQuoteMissing,
                        format!("Quote {selected} does not exist"),
                        vec![Recovery::SetQuoteLengthAll],
                    )
                })?
        } else if lengths.contains(&-3) {
            if favorites.is_empty() {
                return Err(EngineError::recover(
                    ErrorCode::NoFavorites,
                    "No favorite quotes found",
                    vec![Recovery::SetQuoteLengthAll],
                ));
            }
            let id = favorites[random.index(favorites.len())?];
            self.quotes
                .iter()
                .find(|q| q.id == id)
                .cloned()
                .ok_or_else(|| {
                    EngineError::recover(
                        ErrorCode::NoFavorites,
                        "No favorite quotes found",
                        vec![Recovery::SetQuoteLengthAll],
                    )
                })?
        } else {
            if self.queue.is_empty() {
                return Err(EngineError::recover(
                    ErrorCode::NoQuoteLength,
                    "No quotes found for selected quote length",
                    vec![Recovery::SetQuoteLengthAll],
                ));
            }
            self.random_quote(random)?.unwrap()
        };
        quote.language = remove_language_size(language);
        quote.text = normalize(quote.text);
        let text = if british {
            quote
                .british_text
                .as_ref()
                .filter(|text| !text.is_empty())
                .unwrap_or(&quote.text)
        } else {
            &quote.text
        };
        quote.text_split = text
            .0
            .split(|unit| *unit == 32)
            .map(|word| Text(word.to_vec()))
            .collect();
        // The original selected object is also visible to catalog reads. Keep
        // its normalized text/language/split, including a retained older queue.
        if queued {
            let index = self.queue[self.cursor - 1];
            self.queued_quotes.as_mut().unwrap_or(&mut self.quotes)[index] = quote.clone();
        } else if let Some(stored) = self.quotes.iter_mut().find(|stored| stored.id == quote.id) {
            *stored = quote.clone();
        }
        Ok(quote)
    }
}
pub fn remove_language_size(language: &str) -> String {
    let mut parts: Vec<_> = language.split('_').collect();
    if parts.last().is_some_and(|part| {
        part.ends_with('k') && part[..part.len() - 1].chars().all(|c| c.is_ascii_digit())
    }) {
        parts.pop();
    }
    parts.join("_")
}
fn normalize(text: Text) -> Text {
    let mut units = vec![];
    let mut index = 0;
    while index < text.len() {
        let unit = text.0[index];
        if unit == 13 || unit == 10 {
            while units.last() == Some(&32) {
                units.pop();
            }
            units.extend([10, 32]);
            if unit == 13 && text.0.get(index + 1) == Some(&10) {
                index += 1;
            }
            while text.0.get(index + 1) == Some(&32) {
                index += 1;
            }
        } else if unit == 0x2026 {
            units.extend([46, 46, 46]);
        } else if unit != 32 || units.last() != Some(&32) {
            units.push(unit);
        }
        index += 1;
    }
    let whitespace = |unit: &u16| matches!(*unit, 9..=13 | 32 | 0xa0 | 0x1680 | 0x2000..=0x200a | 0x2028 | 0x2029 | 0x202f | 0x205f | 0x3000 | 0xfeff);
    let start = units
        .iter()
        .position(|unit| !whitespace(unit))
        .unwrap_or(units.len());
    let end = units
        .iter()
        .rposition(|unit| !whitespace(unit))
        .map_or(start, |index| index + 1);
    Text(units[start..end].to_vec())
}
