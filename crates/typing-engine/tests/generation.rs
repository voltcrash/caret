use serde_json::{Value, json};
use typing_engine::{
    Text,
    generation::{CustomText, GenerationConfig, Generator, Language},
    random::Random,
};

fn neutral_words(value: &mut Value) {
    if let Some(accents) = value
        .get_mut("additionalAccents")
        .and_then(Value::as_array_mut)
    {
        for pair in accents {
            for text in pair.as_array_mut().unwrap() {
                if let Some(value) = text.as_str() {
                    *text = json!(Text::from(value));
                }
            }
        }
    }
    if let Some(words) = value.get_mut("words").and_then(Value::as_array_mut) {
        for word in words {
            if let Some(value) = word.as_str() {
                *word = json!(Text::from(value));
            }
        }
    }
    if let Some(text) = value.get_mut("text").and_then(Value::as_array_mut) {
        for word in text {
            if let Some(value) = word.as_str() {
                *word = json!(Text::from(value));
            }
        }
    }
}
#[test]
fn base_generation_matches_immutable_browser_snapshots() {
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    let cases: Vec<Value> = serde_json::from_slice(
        &std::fs::read(root.join("packages/typing-fixtures/reference/words/cases.json")).unwrap(),
    )
    .unwrap();
    let mut checked = 0;
    for case in cases {
        let config: GenerationConfig = serde_json::from_value(case["config"].clone()).unwrap();
        if config.funbox.iter().any(|name| {
            ![
                "arrows",
                "weakspot",
                "pseudolang",
                "IPv4",
                "IPv6",
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
        }) || config.mode == "quote"
        {
            continue;
        }
        let name = case["name"].as_str().unwrap();
        let mut language: Value = serde_json::from_slice(
            &std::fs::read(root.join(format!(
                "frontend/static/languages/{}.json",
                config.language
            )))
            .unwrap(),
        )
        .unwrap();
        neutral_words(&mut language);
        let language: Language = serde_json::from_value(language).unwrap();
        let custom = case.get("customText").map(|value| {
            let mut value = value.clone();
            neutral_words(&mut value);
            serde_json::from_value::<CustomText>(value).unwrap()
        });
        let mut generator = Generator::new(
            config,
            language,
            custom,
            Random::seeded(case["seed"].as_u64().unwrap() as u32),
        )
        .unwrap();
        let mut generated = generator.generate(false).unwrap();
        if case["repeat"] == true {
            generated = generator.generate(true).unwrap();
        }
        let mut words = generated.words.clone();
        let mut extra = vec![];
        for _ in 0..case["extraWords"].as_u64().unwrap_or(0) {
            let strip = |text: &Text| {
                let mut text = text.clone();
                if matches!(text.0.last(), Some(32 | 10)) {
                    text.0.pop();
                }
                text
            };
            let previous = words.last().map(strip);
            let previous2 = words.get(words.len().wrapping_sub(2)).map(strip);
            let next = generator
                .next(words.len(), 100, previous.as_ref(), previous2.as_ref())
                .unwrap();
            words.push(next.word.clone());
            extra.push(json!(next));
        }
        let mut actual = json!(generated);
        actual["extra"] = json!(extra);
        actual["allWordsGenerated"] = json!(generator.all_generated());
        actual["currentQuote"] = Value::Null;
        let mut expected: Value = serde_json::from_slice(
            &std::fs::read(root.join(format!(
                "packages/typing-fixtures/reference/words/__snapshots__/{name}.json"
            )))
            .unwrap(),
        )
        .unwrap();
        neutral_words(&mut expected);
        for extra in expected["extra"].as_array_mut().unwrap() {
            for field in ["word", "wordRaw"] {
                extra[field] = json!(Text::from(extra[field].as_str().unwrap()));
            }
        }
        assert_eq!(actual, expected, "{name}");
        checked += 1;
    }
    assert!(checked >= 53, "Only {checked} cases exercised");
}
