use crate::{Text, generation::case};
use serde_json::Value;
pub struct LanguageRules {
    accents: Vec<(Text, Text)>,
    british: Value,
}
impl LanguageRules {
    pub fn new() -> Result<Self, String> {
        let accents: Vec<(String, String)> =
            serde_json::from_str(include_str!("../data/accents.json"))
                .map_err(|e| e.to_string())?;
        let british = serde_json::from_str(include_str!("../data/british-english.json"))
            .map_err(|e| e.to_string())?;
        Ok(Self {
            accents: accents
                .into_iter()
                .map(|(a, b)| (Text::from(a.as_str()), Text::from(b.as_str())))
                .collect(),
            british,
        })
    }
    pub fn lazy(&self, word: &Text, additional: &[(Text, Text)]) -> Text {
        let uppercase = case(word, true);
        let mut cases = vec![];
        let mut index = 0;
        while index < word.len() {
            let width = if (0xd800..=0xdbff).contains(&word.0[index])
                && word
                    .0
                    .get(index + 1)
                    .is_some_and(|c| (0xdc00..=0xdfff).contains(c))
            {
                2
            } else {
                1
            };
            cases.push(width == 1 && uppercase.0.get(cases.len()) == word.0.get(index));
            index += width;
        }
        let mut output = vec![];
        for index in 0..word.len() {
            let lookup = case(&Text(word.0[index..].to_vec()), false)
                .0
                .first()
                .copied();
            let replacement = lookup.and_then(|lookup| {
                additional
                    .iter()
                    .rev()
                    .chain(self.accents.iter().rev())
                    .find(|(chars, _)| chars.0.contains(&lookup))
                    .map(|(_, replacement)| replacement)
            });
            if let Some(replacement) = replacement {
                for (offset, unit) in replacement.0.iter().enumerate() {
                    output.extend(
                        case(&Text(vec![*unit]), cases.get(index + offset) == Some(&true)).0,
                    );
                }
            } else {
                output.extend(case(&Text(vec![word.0[index]]), cases.get(index) == Some(&true)).0);
            }
        }
        Text(output)
    }
    pub fn british(&self, word: Text, previous: Option<&Text>, quote: bool) -> Text {
        let mut word = Text(
            word.0
                .into_iter()
                .map(|c| if c == 34 { 39 } else { c })
                .collect(),
        );
        if word.0.contains(&45) {
            let mut output = vec![];
            for (index, part) in word.0.split(|c| *c == 45).enumerate() {
                if index > 0 {
                    output.push(45);
                }
                output.extend(self.british(Text(part.to_vec()), previous, quote).0);
            }
            return Text(output);
        }
        let ascii = |c: &u16| *c < 128 && ((*c as u8).is_ascii_alphanumeric() || *c == 95);
        let Some(start) = word.0.iter().position(ascii) else {
            return word;
        };
        let end = word.0.iter().rposition(ascii).unwrap() + 1;
        let middle = Text(word.0[start..end].to_vec());
        let key = case(&middle, false).display_lossy();
        let Some(rule) = self.british.get(&key) else {
            return word;
        };
        let replacement = rule
            .as_str()
            .or_else(|| rule["britishWord"].as_str())
            .expect("Checked immutable British dictionary");
        if quote
            && previous.is_some_and(|previous| {
                rule.get("exceptPreviousWords")
                    .and_then(Value::as_array)
                    .into_iter()
                    .flatten()
                    .filter_map(Value::as_str)
                    .any(|exception| Text::from(exception) == *previous)
            })
        {
            return word;
        }
        let mut replacement = Text::from(replacement);
        if case(&Text(vec![middle.0[0]]), true).0 == [middle.0[0]] {
            if case(&middle, true) == middle {
                replacement = case(&replacement, true);
            } else if let Some(first) = replacement.0.first() {
                let mut title = case(&Text(vec![*first]), true);
                title.0.extend_from_slice(&replacement.0[1..]);
                replacement = title;
            }
        }
        let mut output = word.0[..start].to_vec();
        output.extend(replacement.0);
        output.extend_from_slice(&word.0[end..]);
        word = Text(output);
        word
    }
}
