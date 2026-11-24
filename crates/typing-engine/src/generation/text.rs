use crate::Text;

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

pub(super) fn clean_previous(text: &Text, apostrophe: bool) -> Text {
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

pub(super) fn collapse_spaces(text: Text) -> Text {
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

pub(super) fn replace_eszett(word: Text) -> Text {
    let mut out = vec![];
    for unit in word.0 {
        if unit == 0xdf {
            out.extend([115, 115]);
        } else {
            out.push(unit);
        }
    }
    Text(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn case_converts_unicode_and_preserves_unpaired_surrogates() {
        assert_eq!(
            case(&Text::from("Hello Café"), false),
            Text::from("hello café")
        );
        assert_eq!(
            case(&Text::from("hello café"), true),
            Text::from("HELLO CAFÉ")
        );

        let with_surrogate = Text(vec![b'A' as u16, 0xD800, b'b' as u16]);
        assert_eq!(
            case(&with_surrogate, false),
            Text(vec![b'a' as u16, 0xD800, b'b' as u16])
        );
        assert_eq!(
            case(&with_surrogate, true),
            Text(vec![b'A' as u16, 0xD800, b'B' as u16])
        );
    }

    #[test]
    fn clean_previous_strips_punctuation_and_optional_apostrophe() {
        let word = Text::from("\"Don't-Stop?!,.:");
        assert_eq!(clean_previous(&word, false), Text::from("don'tstop"));
        assert_eq!(clean_previous(&word, true), Text::from("dontstop"));
    }

    #[test]
    fn collapse_spaces_deduplicates_and_trims() {
        assert_eq!(
            collapse_spaces(Text::from("  alpha   beta  gamma ")),
            Text::from("alpha beta gamma")
        );
        assert_eq!(collapse_spaces(Text::from("   ")), Text::from(""));
        assert_eq!(collapse_spaces(Text::from("")), Text::from(""));
    }

    #[test]
    fn replace_eszett_expands_sharp_s() {
        assert_eq!(replace_eszett(Text::from("straße")), Text::from("strasse"));
        assert_eq!(replace_eszett(Text::from("plain")), Text::from("plain"));
    }
}
