use crate::{Text, random::Random};
use std::collections::BTreeMap;

#[derive(Default)]
pub struct Arrows {
    foot: bool,
    facing: i32,
    facing_count: i32,
    last_left: i32,
    last_right: i32,
    left_count: i32,
    right_count: i32,
    initialized: bool,
}
impl Arrows {
    pub fn word(&mut self, first: bool, random: &mut Random) -> Result<Text, String> {
        if !self.initialized {
            self.last_right = 3;
            self.initialized = true;
        }
        let mut result = vec![];
        for index in 0..4 {
            self.facing_count -= 1;
            let mut step = crate::js_round(random.draw()?) as i32;
            // Preserve the unused draw in the original footwork algorithm.
            let _ = random.draw()?;
            let value;
            if index == 0 && first {
                self.foot = crate::js_round(random.draw()?) != 0.0;
                value = if self.foot { 3 } else { 0 };
            } else {
                if self.foot {
                    self.left_count = if self.last_left == step {
                        self.left_count + 1
                    } else {
                        0
                    };
                    if self.left_count > 1 || (self.right_count > 0 && self.left_count > 0) {
                        step = 1 - step;
                        self.left_count = 0;
                    }
                    self.last_left = step;
                    value = step * (self.facing + 1);
                } else {
                    self.right_count = if self.last_right == step {
                        self.right_count + 1
                    } else {
                        0
                    };
                    if self.right_count > 1 || (self.right_count > 0 && self.left_count > 0) {
                        step = 1 - step;
                        self.right_count = 0;
                    }
                    self.last_right = step;
                    value = 3 - step * (self.facing + 1);
                }
                self.foot = !self.foot;
                if self.facing_count < 0 && step == 0 {
                    self.facing = 1 - self.facing;
                    self.facing_count = random.index(3)? as i32 + 3;
                }
            }
            result.push([0x2190, 0x2193, 0x2191, 0x2192][value as usize]);
        }
        Ok(Text(result))
    }
}

pub fn ip(version: u8, random: &mut Random) -> Result<Text, String> {
    let mut parts = vec![];
    for _ in 0..if version == 4 { 4 } else { 8 } {
        let n = random.index(if version == 4 { 256 } else { 65536 })?;
        parts.push(if version == 4 {
            n.to_string()
        } else {
            format!("{n:04x}")
        });
    }
    Ok(Text::from(
        parts.join(if version == 4 { "." } else { ":" }).as_str(),
    ))
}
pub fn punctuate_ip(word: Text, random: &mut Random) -> Result<Text, String> {
    let text = word.display_lossy();
    let ipv6 = text.contains(':');
    let sep = if ipv6 { ':' } else { '.' };
    let mut parts: Vec<u32> = text
        .split(sep)
        .map(|part| {
            u32::from_str_radix(part, if ipv6 { 16 } else { 10 })
                .map_err(|_| "Invalid generated IP".to_string())
        })
        .collect::<Result<_, _>>()?;
    let mut suffix = String::new();
    if random.draw()? < 0.25 {
        let mask = if ipv6 {
            (random.index(17)? + 16) * 4
        } else {
            random.index(25)? + 8
        };
        let bits = if ipv6 { 16 } else { 8 };
        let mut left = mask as i32;
        for part in &mut parts {
            left -= bits;
            if left < 0 {
                *part = if -left <= bits {
                    *part & (((1u32 << bits) - 1) ^ ((1u32 << -left) - 1))
                } else {
                    0
                };
            }
        }
        suffix = format!("/{mask}");
    }
    let mut parts: Vec<String> = parts
        .into_iter()
        .map(|part| {
            if ipv6 {
                format!("{part:x}")
            } else {
                part.to_string()
            }
        })
        .collect();
    if ipv6 {
        let mut best = (0, 0);
        let mut start = 0;
        for index in 0..=parts.len() {
            if index == parts.len() || parts[index] != "0" {
                if index - start > best.1 {
                    best = (start, index - start);
                }
                start = index + 1;
            }
        }
        if best.1 > 1 {
            for part in parts.iter_mut().skip(best.0).take(best.1) {
                *part = ":".into();
            }
        }
    }
    let mut result = parts.join(&sep.to_string());
    while result.contains(":::") {
        result = result.replace(":::", "::");
    }
    result.push_str(&suffix);
    Ok(Text::from(result.as_str()))
}

pub struct Pseudolang {
    ngrams: BTreeMap<Vec<u16>, Vec<(Text, usize)>>,
}
impl Pseudolang {
    pub fn new(words: &[Text]) -> Self {
        let mut ngrams: BTreeMap<Vec<u16>, Vec<(Text, usize)>> = BTreeMap::new();
        for word in words {
            let mut prefix = vec![];
            let mut units = word.0.clone();
            units.push(32);
            let mut index = 0;
            while index < units.len() {
                let width = if (0xd800..=0xdbff).contains(&units[index])
                    && units
                        .get(index + 1)
                        .is_some_and(|v| (0xdc00..=0xdfff).contains(v))
                {
                    2
                } else {
                    1
                };
                let next = Text(units[index..index + width].to_vec());
                let choices = ngrams.entry(prefix.clone()).or_default();
                if let Some((_, count)) = choices.iter_mut().find(|(text, _)| text == &next) {
                    *count += 1;
                } else {
                    choices.push((next.clone(), 1));
                }
                prefix.extend(next.0);
                if prefix.len() > 2 {
                    prefix.drain(..prefix.len() - 2);
                }
                index += width;
            }
        }
        // Object.entries enumerates one-digit integer keys before insertion-ordered characters.
        for choices in ngrams.values_mut() {
            choices.sort_by_key(|(text, _)| {
                if text.len() == 1 && (48..=57).contains(&text.0[0]) {
                    text.0[0] - 48
                } else {
                    10
                }
            });
        }
        Self { ngrams }
    }
    pub fn word(&self, random: &mut Random) -> Result<Text, String> {
        let mut word = Text(vec![]);
        for _ in 0..65536 {
            let prefix = &word.0[word.len().saturating_sub(2)..];
            let choices = self
                .ngrams
                .get(prefix)
                .ok_or("Incomplete pseudolang distribution")?;
            let mut choice = random.index(choices.iter().map(|(_, count)| count).sum())?;
            let mut selected = None;
            for (text, count) in choices {
                if choice < *count {
                    selected = Some(text);
                    break;
                }
                choice -= count;
            }
            let selected = selected.ok_or("Empty pseudolang distribution")?;
            if selected.0 == [32] {
                return Ok(word);
            }
            word.0.extend_from_slice(&selected.0);
        }
        Err("Pseudolang generation exceeded bounded work".into())
    }
}
