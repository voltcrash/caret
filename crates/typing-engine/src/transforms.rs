use crate::{Text, generation::case, random::Random};

fn append(word: &mut Text, text: &str) {
    word.0.extend(text.encode_utf16());
}
pub fn numbers(random: &mut Random, max: usize) -> Result<Text, String> {
    let length = random.index(max)? + 1;
    let mut units = vec![];
    for index in 0..length {
        units.push(
            48 + (if index == 0 {
                random.index(9)? + 1
            } else {
                random.index(10)?
            }) as u16,
        );
    }
    Ok(Text(units))
}
pub fn numeral_script(word: Text, language: &str) -> Text {
    let base = if language.starts_with("kurdish") {
        0x660
    } else if language.starts_with("nepali") || language.starts_with("hindi") {
        0x966
    } else if language.starts_with("bangla") {
        0x9e6
    } else {
        48
    };
    Text(
        word.0
            .into_iter()
            .map(|unit| {
                if (48..=57).contains(&unit) {
                    base + unit - 48
                } else {
                    unit
                }
            })
            .collect(),
    )
}
pub fn generated_word(name: &str, random: &mut Random) -> Result<Option<Text>, String> {
    let word = match name {
        "58008" => numbers(random, 7)?,
        "binary" => Text::from(format!("{:08b}", random.index(256)?).as_str()),
        "hexadecimal" => {
            let length = random.index(4)? + 1;
            let mut word = String::new();
            for _ in 0..length {
                word.push_str(&format!("{:02x}", random.index(256)?));
            }
            Text::from(word.as_str())
        }
        "gibberish" | "ascii" | "specials" => {
            let length = random.index(if name == "ascii" { 10 } else { 7 })? + 1;
            let mut units = vec![];
            let specials: Vec<_> = "`~!@#$%^&*()-_=+{}[]'\"/\\|?;:><,."
                .encode_utf16()
                .collect();
            for _ in 0..length {
                units.push(match name {
                    "ascii" => 33 + random.index(94)? as u16,
                    "gibberish" => 97 + random.index(26)? as u16,
                    _ => specials[random.index(specials.len())?],
                });
            }
            Text(units)
        }
        _ => return Ok(None),
    };
    Ok(Some(word))
}
pub fn alter(
    name: &str,
    word: Text,
    index: usize,
    bound: usize,
    random: &mut Random,
) -> Result<Text, String> {
    let mut word = word;
    match name {
        "morse" => word = morse(word),
        "backwards" => word.0.reverse(),
        "ALL_CAPS" => word = case(&word, true),
        "capitals" => {
            let mut output = vec![];
            let mut first = true;
            for unit in word.0 {
                if unit == 32 {
                    if output.last() != Some(&32) {
                        output.push(32);
                    }
                    first = true;
                } else if first {
                    output.extend(case(&Text(vec![unit]), true).0);
                    first = false;
                } else {
                    output.push(unit);
                }
            }
            word = Text(output);
        }
        "sPoNgEcAsE" => {
            let mut output = vec![];
            for (index, unit) in word.0.iter().enumerate() {
                output.extend(case(&Text(vec![*unit]), index % 2 == 1).0);
            }
            word = Text(output);
        }
        "rAnDoMcAsE" => {
            let mut output = vec![];
            let mut index = 0;
            while index < word.len() {
                let width = if (0xd800..=0xdbff).contains(&word.0[index])
                    && word
                        .0
                        .get(index + 1)
                        .is_some_and(|unit| (0xdc00..=0xdfff).contains(unit))
                {
                    2
                } else {
                    1
                };
                output.extend(
                    case(
                        &Text(word.0[index..index + width].to_vec()),
                        random.draw()? < 0.5,
                    )
                    .0,
                );
                index += width;
            }
            word = Text(output);
        }
        "rot13" => {
            for unit in &mut word.0 {
                let original = Text(vec![*unit]);
                let lower = case(&original, false);
                if lower.len() == 1 && (97..=122).contains(&lower.0[0]) {
                    let base = if case(&original, true) == original {
                        65
                    } else {
                        97
                    };
                    *unit = base + (lower.0[0] - 97 + 13) % 26;
                }
            }
        }
        "ddoouubblleedd" => {
            let mut output = vec![];
            let mut index = 0;
            while index < word.len() {
                let width = if (0xd800..=0xdbff).contains(&word.0[index])
                    && word
                        .0
                        .get(index + 1)
                        .is_some_and(|unit| (0xdc00..=0xdfff).contains(unit))
                {
                    2
                } else {
                    1
                };
                let units = &word.0[index..index + width];
                output.extend_from_slice(units);
                if ![10, 13, 0x2028, 0x2029].contains(&units[0]) {
                    output.extend_from_slice(units);
                }
                index += width;
            }
            word = Text(output);
        }
        "instant_messaging" => {
            word = case(&word, false);
            let position = word.len();
            if position > 0 && matches!(word.0.get(position - 1), Some(46 | 33 | 63)) {
                word.0[position - 1] = 10;
            }
            let mut output = vec![];
            for unit in word.0 {
                if [40, 41, 46, 39, 34].contains(&unit)
                    || (unit == 10 && output.last() == Some(&10))
                {
                    continue;
                }
                output.push(unit);
            }
            word = Text(output);
        }
        "underscore_spaces" if index + 1 != bound => {
            append(&mut word, "_");
        }
        _ => {}
    }
    Ok(word)
}

fn morse(word: Text) -> Text {
    use unicode_normalization::UnicodeNormalization;
    const MAP: &[(&str, &str)] = &[
        ("a", ".-"),
        ("b", "-..."),
        ("c", "-.-."),
        ("d", "-.."),
        ("e", "."),
        ("f", "..-."),
        ("g", "--."),
        ("h", "...."),
        ("i", ".."),
        ("j", ".---"),
        ("k", "-.-"),
        ("l", ".-.."),
        ("m", "--"),
        ("n", "-."),
        ("o", "---"),
        ("p", ".--."),
        ("q", "--.-"),
        ("r", ".-."),
        ("s", "..."),
        ("t", "-"),
        ("u", "..-"),
        ("v", "...-"),
        ("w", ".--"),
        ("x", "-..-"),
        ("y", "-.--"),
        ("z", "--.."),
        ("0", "-----"),
        ("1", ".----"),
        ("2", "..---"),
        ("3", "...--"),
        ("4", "....-"),
        ("5", "....."),
        ("6", "-...."),
        ("7", "--..."),
        ("8", "---.."),
        ("9", "----."),
        (".", ".-.-.-"),
        (",", "--..--"),
        ("?", "..--.."),
        ("'", ".----."),
        ("/", "-..-."),
        ("(", "-.--."),
        (")", "-.--.-"),
        ("&", ".-..."),
        (":", "---..."),
        (";", "-.-.-."),
        ("=", "-...-"),
        ("+", ".-.-."),
        ("-", "-....-"),
        ("_", "..--.-"),
        ("\"", ".-..-."),
        ("$", "...-..-"),
        ("!", "-.-.--"),
        ("@", ".--.-."),
    ];
    // A surrogate cannot map to Morse; replacement also cannot map. Preserve
    // JS's original UTF-16 loop bound even if lowercasing expands the text.
    let normalized = Text::from(
        word.display_lossy()
            .nfd()
            .filter(|c| !('\u{0300}'..='\u{036f}').contains(c))
            .collect::<String>()
            .as_str(),
    );
    let lower = case(&normalized, false);
    let mut output = String::new();
    for unit in lower.0.iter().take(normalized.len()) {
        if let Some((_, code)) = MAP.iter().find(|(key, _)| key.encode_utf16().eq([*unit])) {
            output.push_str(code);
            output.push('/');
        }
    }
    Text::from(output.as_str())
}
