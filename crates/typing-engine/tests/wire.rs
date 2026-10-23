use serde_json::{Value, json};
use typing_engine::{Command, Config, Session, Text, wire::TypedEvent};
#[test]
fn every_command_fixture_event_has_the_generated_discriminated_shape() {
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../packages/typing-fixtures/commands");
    let equal = |a: &Value, b: &Value| {
        serde_json::to_string(a).unwrap() == serde_json::to_string(b).unwrap()
    };
    for entry in std::fs::read_dir(root).unwrap() {
        let path = entry.unwrap().path();
        if path.extension().is_none_or(|ext| ext != "json") {
            continue;
        }
        let fixture: Value = serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();
        let config: Config = serde_json::from_value(fixture["config"].clone()).unwrap();
        let words: Vec<Text> = serde_json::from_value(fixture["words"].clone()).unwrap();
        let mut session = Session::new(config, words).unwrap();
        for command in fixture["commands"].as_array().unwrap() {
            let command: Command = serde_json::from_value(command.clone()).unwrap();
            for event in session.apply(command).unwrap().events {
                let value = json!(event);
                let typed: TypedEvent = serde_json::from_value(value.clone())
                    .unwrap_or_else(|error| panic!("{} {value}: {error}", path.display()));
                // Compare as JavaScript JSON data (number integer/float storage is irrelevant).
                let actual = json!(typed);
                for (key, expected) in value["data"].as_object().unwrap() {
                    let a = &actual["data"][key];
                    assert!(
                        equal(a, expected) || (a.is_number() && a.as_f64() == expected.as_f64()),
                        "{} {key}: {a} != {expected}",
                        path.display()
                    );
                }
                assert_eq!(actual["type"], value["type"]);
                assert_eq!(actual["testMs"].as_f64(), value["testMs"].as_f64());
            }
        }
    }
}
#[test]
fn typed_events_reject_unknown_actions_and_invalid_utf16() {
    for data in [
        json!({"inputType":"paste"}),
        json!({"inputType":"insertText","wordIndex":0,"charIndex":0,"inputValue":[65536],"data":[97],"correct":true}),
    ] {
        assert!(
            serde_json::from_value::<TypedEvent>(json!({"type":"input","testMs":0,"data":data}))
                .is_err()
        );
    }
}
