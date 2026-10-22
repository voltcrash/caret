use crate::{Text, random::Random};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Quote {
    pub text: Text,
    #[serde(skip_serializing_if = "Option::is_none")]
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
/// Host-owned lifetime, engine-owned selection; never a process-global queue.
#[derive(Default)]
pub struct Quotes {
    language: Option<String>,
    quotes: Vec<Quote>,
    groups: Vec<Vec<usize>>,
    queue: Vec<usize>,
    cursor: usize,
}
impl Quotes {
    pub fn load(
        &mut self,
        mut asset: QuoteAsset,
        lengths: &[i32],
        random: &mut Random,
    ) -> Result<(), String> {
        if self.language.as_ref() == Some(&asset.language) {
            return Ok(());
        }
        if asset.quotes.is_empty() {
            return Err("No quotes found".into());
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
    pub fn update_queue(&mut self, lengths: &[i32], random: &mut Random) -> Result<(), String> {
        self.queue.clear();
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
    ) -> Result<Quote, String> {
        let mut quote = if lengths == [-2] {
            self.quotes
                .iter()
                .find(|q| q.id == selected)
                .cloned()
                .ok_or("Selected quote does not exist")?
        } else if lengths.contains(&-3) {
            let id = favorites[random.index(favorites.len())?];
            self.quotes
                .iter()
                .find(|q| q.id == id)
                .cloned()
                .ok_or("Favorite quote does not exist")?
        } else {
            if self.queue.is_empty() {
                return Err("No quotes found for selected length".into());
            }
            if self.cursor >= self.queue.len() {
                self.cursor = 0;
                random.shuffle(&mut self.queue)?;
            }
            let quote = self.quotes[self.queue[self.cursor]].clone();
            self.cursor += 1;
            quote
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
        Ok(quote)
    }
}
fn remove_language_size(language: &str) -> String {
    let mut parts: Vec<_> = language.split('_').collect();
    if parts.last().is_some_and(|part| {
        !part.is_empty()
            && part
                .trim_end_matches('k')
                .chars()
                .all(|c| c.is_ascii_digit())
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
