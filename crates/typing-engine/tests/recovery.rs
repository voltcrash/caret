use serde_json::{Value, json};
use typing_engine::{
    error::ErrorCode,
    generation::{Content, Prepare},
};
#[test]
fn recovery_actions_and_messages_match_every_frozen_typescript_path() {
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../packages/typing-fixtures/oracle/recovery.json");
    let references: Vec<Value> = serde_json::from_slice(&std::fs::read(path).unwrap()).unwrap();
    for reference in references {
        let mut owner = Content::default();
        let input: Prepare = serde_json::from_value(reference["input"].clone()).unwrap();
        let error = owner.prepare(input).unwrap_err();
        assert_eq!(
            json!({"message":error.message,"recovery":error.recovery}),
            reference["expected"],
            "{}",
            reference["name"]
        );
        assert_ne!(error.code, ErrorCode::InvalidInput);
        // A corrected preparation must remain usable after every error.
        let input = serde_json::from_value(json!({
            "config":{"mode":"words","words":2},"language":{"name":"english","words":[[97],[98]]},
            "random":{"kind":"seeded","state":1}
        }))
        .unwrap();
        owner.prepare(input).unwrap();
        assert_eq!(
            owner.start_session(false).unwrap().snapshot().words.len(),
            2
        );
    }
}
#[test]
fn configuration_and_stale_reply_failures_have_codes_without_recovery_side_effects() {
    let error = typing_engine::Session::new(
        typing_engine::Config {
            mode: "invalid".into(),
            ..Default::default()
        },
        vec![],
    )
    .err()
    .unwrap();
    assert_eq!(error.code, ErrorCode::InvalidConfig);
    assert!(error.recovery.is_empty());
    let mut queue = typing_engine::content::Queue::new("poetry".into(), "english".into(), true);
    let request = queue.request();
    queue.reset(1);
    let error = queue
        .supply(
            &request,
            typing_engine::content::Source::Poem {
                title: Default::default(),
                author: Default::default(),
                lines: vec![],
            },
        )
        .unwrap_err();
    assert_eq!(error.code, ErrorCode::StaleRequest);
    assert!(error.recovery.is_empty());
}
