use crate::{Text, generation::case, random::Random};
#[derive(Default)]
pub struct Punctuation {
    spanish: Option<u16>,
}
pub struct PunctuationContext<'a> {
    pub previous: Option<&'a Text>,
    pub index: usize,
    pub bound: usize,
    pub language: &'a str,
    pub funboxes: &'a [String],
}
fn add(word: &mut Text, value: &str) {
    word.0.extend(value.encode_utf16());
}
fn capitalize(word: Text) -> Text {
    let Some(first) = word.0.first() else {
        return word;
    };
    let mut result = case(&Text(vec![*first]), true);
    result.0.extend_from_slice(&word.0[1..]);
    result
}
fn wrap(word: Text, prefix: &str, suffix: &str) -> Text {
    let mut result = Text::from(prefix);
    result.0.extend(word.0);
    add(&mut result, suffix);
    result
}
fn english(word: Text, random: &mut Random) -> Result<Text, String> {
    const PAIRS: &[(&str, &[&str])] = &[
        ("are", &["aren't"]),
        ("can", &["can't"]),
        ("could", &["couldn't"]),
        ("did", &["didn't"]),
        ("does", &["doesn't"]),
        ("do", &["don't"]),
        ("had", &["hadn't"]),
        ("has", &["hasn't"]),
        ("have", &["haven't"]),
        ("is", &["isn't"]),
        ("it", &["it's", "it'll"]),
        ("i", &["i'm", "i'll", "i've", "i'd"]),
        ("you", &["you'll", "you're", "you've", "you'd"]),
        ("that", &["that's", "that'll", "that'd"]),
        ("must", &["mustn't", "must've"]),
        ("there", &["there's", "there'll", "there'd"]),
        ("he", &["he's", "he'll", "he'd"]),
        ("she", &["she's", "she'll", "she'd"]),
        ("we", &["we're", "we'll", "we'd"]),
        ("they", &["they're", "they'll", "they'd"]),
        ("should", &["shouldn't", "should've"]),
        ("was", &["wasn't"]),
        ("were", &["weren't"]),
        ("will", &["won't"]),
        ("would", &["wouldn't", "would've"]),
        ("going", &["goin'"]),
    ];
    let ascii_word =
        |unit: &u16| *unit < 128 && ((*unit as u8).is_ascii_alphanumeric() || *unit == 95);
    let Some(start) = word.0.iter().position(ascii_word) else {
        return Ok(word);
    };
    let end = word.0.iter().rposition(ascii_word).unwrap() + 1;
    let middle = Text(word.0[start..end].to_vec());
    let lower = case(&middle, false);
    let Some((_, replacements)) = PAIRS.iter().find(|(key, _)| Text::from(*key) == lower) else {
        return Ok(word);
    };
    let mut replacement = Text::from(replacements[random.index(replacements.len())?]);
    if case(&Text(vec![middle.0[0]]), true).0 == [middle.0[0]] {
        replacement = if middle.0 != [73] && middle == case(&middle, true) {
            case(&replacement, true)
        } else {
            capitalize(replacement)
        };
    }
    let mut result = Text(word.0[..start].to_vec());
    result.0.extend(replacement.0);
    result.0.extend_from_slice(&word.0[end..]);
    Ok(result)
}
impl Punctuation {
    pub fn apply(
        &mut self,
        mut word: Text,
        context: PunctuationContext<'_>,
        random: &mut Random,
    ) -> Result<Text, String> {
        let PunctuationContext {
            previous,
            index,
            bound,
            language,
            funboxes,
        } = context;
        if funboxes.iter().any(|name| name == "IPv4" || name == "IPv6") {
            return crate::generated_funboxes::punctuate_ip(word, random);
        }
        if funboxes.iter().any(|name| name == "hexadecimal") {
            return Ok(wrap(word, "0x", ""));
        }
        if funboxes.iter().any(|name| name == "58008") {
            if word.len() > 3 {
                if random.draw()? < 0.5 {
                    let index = random.index(word.len() - 2)? + 1;
                    word.0[index] = 46;
                }
                if random.draw()? < 0.75 {
                    let index = random.index(word.len() - 2)? + 1;
                    if word.0[index - 1] != 46 && word.0[index + 1] != 46 && word.0[index + 1] != 48
                    {
                        word.0[index] = [47, 42, 45, 43][random.index(4)?];
                    }
                }
            }
            return Ok(word);
        }
        let lang = language.split('_').next().unwrap_or_default();
        let last = previous.and_then(|word| word.0.last()).copied();
        let no_end = !matches!(last, Some(46 | 44));
        if lang != "code"
            && lang != "georgian"
            && (index == 0 || matches!(last, Some(63 | 33 | 46 | 0x61f)))
        {
            word = capitalize(word);
            if lang == "turkish" {
                for unit in &mut word.0 {
                    if *unit == 73 {
                        *unit = 0x130;
                    }
                }
            }
            if lang == "spanish" {
                let draw = random.draw()?;
                if draw > 0.9 {
                    word = wrap(word, "¿", "");
                    self.spanish = Some(63);
                } else if draw > 0.8 {
                    word = wrap(word, "¡", "");
                    self.spanish = Some(33);
                }
            }
        } else if (random.draw()? < 0.1 && no_end && index != bound.saturating_sub(2))
            || index + 1 == bound
        {
            if lang == "spanish" {
                if let Some(end) = self.spanish.take() {
                    word.0.push(end);
                }
            } else {
                let draw = random.draw()?;
                if draw <= 0.8 {
                    add(
                        &mut word,
                        match lang {
                            "nepali" | "bangla" | "hindi" => "।",
                            "japanese" | "chinese" => "。",
                            _ => ".",
                        },
                    );
                } else if draw > 0.8 && draw < 0.9 {
                    if lang == "french" {
                        word = Text::from("?");
                    } else {
                        add(
                            &mut word,
                            match lang {
                                "arabic" | "persian" | "urdu" | "kurdish" => "؟",
                                "greek" => ";",
                                "japanese" | "chinese" => "？",
                                _ => "?",
                            },
                        );
                    }
                } else if lang == "french" {
                    word = Text::from("!");
                } else {
                    add(
                        &mut word,
                        if ["japanese", "chinese"].contains(&lang) {
                            "！"
                        } else {
                            "!"
                        },
                    );
                }
            }
        } else if random.draw()? < 0.01 && no_end && lang != "russian" {
            word = wrap(word, "\"", "\"");
        } else if random.draw()? < 0.011
            && no_end
            && !["russian", "ukrainian", "slovak"].contains(&lang)
        {
            word = wrap(word, "'", "'");
        } else if random.draw()? < 0.012 && no_end {
            word = if lang == "code" {
                let brackets = if language.starts_with("code_javascript") {
                    vec![("(", ")"), ("{", "}"), ("[", "]"), ("<", ">"), ("`", "`")]
                } else {
                    vec![("(", ")"), ("{", "}"), ("[", "]"), ("<", ">")]
                };
                let bracket = brackets[random.index(brackets.len())?];
                wrap(word, bracket.0, bracket.1)
            } else if ["japanese", "chinese"].contains(&lang) {
                wrap(word, "（", "）")
            } else {
                wrap(word, "(", ")")
            };
        } else if random.draw()? < 0.013
            && no_end
            && !matches!(last, Some(59 | 0x61b | 58 | 0xff1b | 0xff1a))
        {
            if lang == "french" {
                word = Text::from(":");
            } else {
                add(&mut word, if lang == "chinese" { "：" } else { ":" });
            }
        } else if random.draw()? < 0.014 && no_end && previous.is_none_or(|word| word.0 != [45]) {
            word = Text::from("-");
        } else if random.draw()? < 0.015
            && no_end
            && !matches!(last, Some(59 | 0x61b | 0xff1b | 0xff1a))
        {
            if lang == "french" {
                word = Text::from(";");
            } else if lang == "greek" {
                word = Text::from(".");
            } else {
                add(
                    &mut word,
                    match lang {
                        "arabic" | "kurdish" => "؛",
                        "chinese" => "；",
                        _ => ";",
                    },
                );
            }
        } else if random.draw()? < 0.2 && last != Some(44) {
            add(
                &mut word,
                match lang {
                    "arabic" | "urdu" | "persian" | "kurdish" => "،",
                    "japanese" => "、",
                    "chinese" => "，",
                    _ => ",",
                },
            );
        } else if random.draw()? < 0.25 && lang == "code" {
            let basic = ["{", "}", "[", "]", "(", ")", ";", "=", "+", "%", "/"];
            let c = [
                "{", "}", "[", "]", "(", ")", ";", "=", "+", "%", "/", "/*", "*/", "//", "!=",
                "==", "<=", ">=", "||", "&&", "<<", ">>", "%=", "&=", "*=", "++", "+=", "--", "-=",
                "/=", "^=", "|=",
            ];
            let choices = if (language.starts_with("code_c") && !language.starts_with("code_css"))
                || language.starts_with("code_arduino")
            {
                c.to_vec()
            } else if language.starts_with("code_javascript") {
                let mut choices = basic.to_vec();
                choices.push("`");
                choices
            } else {
                basic.to_vec()
            };
            word = Text::from(choices[random.index(choices.len())?]);
        } else if random.draw()? < 0.5 && lang == "english" {
            word = english(word, random)?;
        }
        for unit in [9, 10] {
            if word.0.contains(&unit) {
                word.0.retain(|value| *value != unit);
                word.0.push(unit);
            }
        }
        Ok(word)
    }
}
