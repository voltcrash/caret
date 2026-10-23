use serde_json::json;
use typing_engine::{Command, Config, Session, Text};
fn command(input: serde_json::Value) -> Command {
    serde_json::from_value(input).unwrap()
}

#[test]
fn composition_quick_end_uses_owned_finite_targets_and_exact_utf16() {
    let mut session = Session::new(
        Config {
            mode: "words".into(),
            words: 1,
            ..Config::default()
        },
        vec![Text(vec![0xd800, 0xdc00])],
    )
    .unwrap();
    assert!(
        !session
            .composition_completes(&Text(vec![0xd800, 0xdc00]))
            .unwrap()
    );
    session
        .apply(command(json!({"op":"start","now":1})))
        .unwrap();
    assert!(
        session
            .composition_completes(&Text(vec![0xd800, 0xdc00]))
            .unwrap()
    );
    session
        .apply(command(json!({"op":"insert","now":2,"data":[0xd800]})))
        .unwrap();
    assert!(session.composition_completes(&Text(vec![0xdc00])).unwrap());
    assert!(!session.composition_completes(&Text::from("x")).unwrap());
    session.apply(command(json!({"op":"end","now":3}))).unwrap();
    assert!(!session.composition_completes(&Text(vec![0xdc00])).unwrap());
    assert!(
        session
            .composition_completes(&Text(vec![97; 65537]))
            .is_err()
    );
    let mut infinite = Session::new(
        Config {
            mode: "words".into(),
            words: 0,
            ..Config::default()
        },
        vec![Text::from("one ")],
    )
    .unwrap();
    infinite
        .apply(command(json!({"op":"start","now":0})))
        .unwrap();
    assert!(!infinite.composition_completes(&Text::from("one ")).unwrap());
}
#[test]
fn metadata_deltas_report_changed_generation_flags_without_copying_targets() {
    let mut session = Session::new(
        Config {
            mode: "custom".into(),
            ..Config::default()
        },
        vec![Text::from("\ta\n")],
    )
    .unwrap();
    assert!(session.metadata().all_words_generated);
    let update = session
        .apply(command(
            json!({"op":"customLimit","mode":"time","value":1.5,"now":0}),
        ))
        .unwrap();
    let metadata = update.metadata.unwrap();
    assert!(!metadata.all_words_generated);
    assert!(metadata.has_tab && metadata.has_newline);
    assert_eq!(
        session.live_stats(0.0).unwrap().time_limit_seconds,
        Some(1.5)
    );
    let observation = session
        .apply(command(
            json!({"op":"observe","eventType":"keydown","eventData":{"code":"KeyA"},"now":1}),
        ))
        .unwrap();
    assert!(observation.metadata.is_none());
    assert!(observation.words.is_empty());
    let update = session
        .apply(command(
            json!({"op":"customLimit","mode":"word","value":1,"now":2}),
        ))
        .unwrap();
    assert!(update.metadata.unwrap().all_words_generated);
    assert_eq!(session.live_stats(2.0).unwrap().time_limit_seconds, None);
}

#[test]
fn final_word_batch_matches_immutable_browser_dom_observation() {
    let oracle: serde_json::Value = serde_json::from_str(include_str!(
        "../../../packages/typing-fixtures/oracle/browser-final-word-batch.json"
    ))
    .unwrap();
    let mut session = Session::new(
        Config {
            mode: "words".into(),
            words: 1,
            ..Config::default()
        },
        vec![Text::from("one")],
    )
    .unwrap();
    let update = session
        .apply(command(
            json!({"op":"insert","now":0,"data":Text::from("one extra")}),
        ))
        .unwrap();
    let mut inputs = serde_json::to_value(update.events).unwrap();
    let inputs = inputs.as_array_mut().unwrap();
    inputs.retain(|event| event["type"] == "input");
    for event in inputs.iter_mut() {
        for key in ["data", "inputValue"] {
            let units: Vec<u16> = serde_json::from_value(event["data"][key].clone()).unwrap();
            event["data"][key] = json!(String::from_utf16(&units).unwrap());
        }
    }
    let expected = oracle["input"].as_array().unwrap();
    assert_eq!(inputs.len(), expected.len());
    for (actual, expected) in inputs.iter().zip(expected) {
        assert_eq!(actual["type"], expected["type"]);
        assert_eq!(actual["testMs"].as_f64(), expected["testMs"].as_f64());
        assert_eq!(actual["data"], expected["data"]);
    }
    assert_eq!(session.state().input_value, Text::from("extra"));
}

#[test]
fn preflight_expansion_uses_the_same_target_dependent_rule_as_insertion() {
    let session = Session::new(Config::default(), vec![Text::from("... ")]).unwrap();
    assert_eq!(
        session
            .preflight(Text::from("…"), &Default::default())
            .expanded,
        Some(Text::from("..."))
    );
    let literal = Session::new(Config::default(), vec![Text::from("… ")]).unwrap();
    assert_eq!(
        literal
            .preflight(Text::from("…"), &Default::default())
            .expanded,
        None
    );
}
