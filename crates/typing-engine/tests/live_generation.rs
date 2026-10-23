use serde_json::{Value, json};
use typing_engine::{
    Command, Text,
    generation::{Content, Prepare},
};
fn fixture() -> Value {
    serde_json::from_slice(
        &std::fs::read(
            std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("../../packages/typing-fixtures/oracle/live-generation.json"),
        )
        .unwrap(),
    )
    .unwrap()
}
fn strip(word: Option<&Text>) -> Option<Text> {
    word.map(|word| {
        let mut value = word.clone();
        if matches!(value.0.last(), Some(32 | 10)) {
            value.0.pop();
        }
        value
    })
}
#[test]
fn next_word_rule_reads_match_every_frozen_live_configuration_boundary() {
    let reference = fixture();
    let input: Prepare = serde_json::from_value(reference["input"].clone()).unwrap();
    let mut content = Content::default();
    content.prepare(input).unwrap();
    let generator = content.generator().unwrap();
    let generated = generator.generate(false).unwrap();
    assert_eq!(json!(generated), reference["generated"]);
    let mut words = generated.words;
    for step in reference["steps"].as_array().unwrap() {
        generator
            .configure(serde_json::from_value(step["config"].clone()).unwrap())
            .unwrap();
        for expected in step["extra"].as_array().unwrap() {
            let previous = strip(words.last());
            let previous2 = strip(words.get(words.len().saturating_sub(2)));
            let next = generator
                .next(words.len(), 100, previous.as_ref(), previous2.as_ref())
                .unwrap();
            assert_eq!(json!(next), *expected);
            words.push(next.word);
        }
    }
    assert_eq!(
        generator.random_state().clone().draw().unwrap(),
        reference["randomTail"].as_f64().unwrap()
    );
}
#[test]
fn session_configure_updates_owned_generation_without_repreparing_or_reseeding() {
    let reference = fixture();
    let input: Prepare = serde_json::from_value(reference["input"].clone()).unwrap();
    let mut content = Content::default();
    content.prepare(input).unwrap();
    let mut session = content.start_session(false).unwrap();
    let mut config = reference["steps"][4]["config"].clone();
    config["funbox"] = json!(["ALL_CAPS"]);
    session
        .apply(Command::Configure {
            now: 0.0,
            config: Box::new(serde_json::from_value(config).unwrap()),
        })
        .unwrap();
    let first = session.snapshot().words[0].clone();
    let update = session
        .apply(serde_json::from_value(json!({"op":"insert","now":10,"data":first})).unwrap())
        .unwrap();
    assert_eq!(update.words.len(), 1);
    let generated = &update.words[0].word;
    assert!(!generated.0.iter().any(|unit| (97..=122).contains(unit)));
}
