use serde_json::{Value, json};
use typing_engine::{
    Text,
    generation::{Content, Prepare},
    random::Random,
};
#[test]
fn explicit_quote_length_changes_match_frozen_owned_queue_and_random_draws() {
    let reference: Value = serde_json::from_slice(
        &std::fs::read(
            std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("../../packages/typing-fixtures/oracle/quote-queue.json"),
        )
        .unwrap(),
    )
    .unwrap();
    let mut asset = reference["asset"].clone();
    for quote in asset["quotes"].as_array_mut().unwrap() {
        quote["text"] = json!(Text::from(quote["text"].as_str().unwrap()));
    }
    let prepare = |lengths: &Value, asset: Value| -> Prepare {
        serde_json::from_value(json!({"config":{"mode":"quote","quoteLength":lengths},"language":{"name":"english","words":[[97]]},"random":{"kind":"seeded","state":91},"quotes":asset})).unwrap()
    };
    let mut content = Content::default();
    content.prepare(prepare(&json!([0]), asset)).unwrap();
    assert_eq!(
        json!(
            content
                .generator()
                .unwrap()
                .current_quote
                .as_ref()
                .unwrap()
                .id
        ),
        reference["initialId"]
    );
    for cycle in reference["cycles"].as_array().unwrap() {
        let lengths: Vec<i32> = serde_json::from_value(cycle["lengths"].clone()).unwrap();
        let state = content
            .update_quote_queue(&lengths, Random::seeded(91))
            .unwrap();
        assert_eq!(json!(state)["state"], cycle["afterUpdateState"]);
        for selected in cycle["selected"].as_array().unwrap() {
            content
                .prepare(prepare(&cycle["lengths"], Value::Null))
                .unwrap();
            let generator = content.generator().unwrap();
            assert_eq!(
                json!(generator.current_quote.as_ref().unwrap().id),
                selected["id"]
            );
            assert_eq!(
                json!(generator.random_state())["state"],
                selected["afterSelectState"]
            );
        }
    }
}
