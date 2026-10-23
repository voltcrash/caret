use serde_json::Value;
use typing_engine::{Text, language_rules::LanguageRules};

#[test]
fn immutable_british_dictionary_has_checked_shapes_and_exact_lowercase_replacements() {
    let dictionary: serde_json::Map<String, Value> =
        serde_json::from_str(include_str!("../data/british-english.json")).unwrap();
    assert!(dictionary.len() > 500);
    let rules = LanguageRules::new().unwrap();
    for (word, rule) in dictionary {
        let replacement = if let Some(word) = rule.as_str() {
            word
        } else {
            let exceptions = rule["exceptPreviousWords"].as_array().unwrap();
            assert!(exceptions.iter().all(|word| word.as_str().is_some()));
            rule["britishWord"].as_str().unwrap()
        };
        assert!(!replacement.is_empty());
        if word == word.to_lowercase() && !word.contains('-') {
            assert_eq!(
                rules.british(Text::from(word.as_str()), None, false),
                Text::from(replacement),
                "{word}"
            );
        }
    }
}
