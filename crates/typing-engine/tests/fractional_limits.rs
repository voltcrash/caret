use serde_json::{Value, json};
use typing_engine::{
    Command,
    generation::{Content, Prepare},
};
#[test]
fn custom_fractional_generation_preserves_exact_targets_sections_and_random_consumption() {
    let refs: Vec<Value> = serde_json::from_slice(
        &std::fs::read(
            std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("../../packages/typing-fixtures/oracle/fractional-limits-v2.json"),
        )
        .unwrap(),
    )
    .unwrap();
    for reference in refs {
        let input: Prepare = serde_json::from_value(reference["input"].clone()).unwrap();
        let mut content = Content::default();
        content.prepare(input).unwrap();
        let generator = content.generator().unwrap();
        let generated = generator.generate(false).unwrap();
        assert_eq!(
            json!(generated),
            reference["expected"],
            "{}",
            reference["name"]
        );
        assert_eq!(
            json!(generator.all_generated()),
            reference["allGenerated"],
            "{}",
            reference["name"]
        );
        assert_eq!(
            generator.random_state().clone().draw().unwrap(),
            reference["randomTail"].as_f64().unwrap(),
            "{}",
            reference["name"]
        );
    }
}
#[test]
fn fractional_time_limits_remain_numbers_until_timer_completion() {
    for value in [0.5, 1.5, 2.25] {
        let mut content = Content::default();
        content.prepare(serde_json::from_value(json!({"config":{"mode":"custom"},"language":{"name":"english","words":[[97]]},"random":{"kind":"seeded","state":1},"custom":{"text":[[97]],"mode":"repeat","pipeDelimiter":false,"limit":{"mode":"time","value":value}}})).unwrap()).unwrap();
        let mut session = content.start_session(false).unwrap();
        session
            .apply(Command::Start {
                now: 0.0,
                date: 1000.0,
            })
            .unwrap();
        for tick in 1..=3 {
            let update = session
                .apply(Command::Advance {
                    now: f64::from(tick) * 1000.0,
                    date: 1000.0 + f64::from(tick) * 1000.0,
                })
                .unwrap();
            assert_eq!(update.state.ended, f64::from(tick) >= value);
        }
        assert_eq!(
            session.log()["context"]["customTextLimitValue"].as_f64(),
            Some(value)
        );
    }
}
