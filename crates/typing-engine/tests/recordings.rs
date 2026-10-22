use serde_json::{Value, json};
use typing_engine::{Command, Session, Text};

fn input_neutral(mut event: Value) -> Value {
    for key in ["inputValue", "data"] {
        if let Some(text) = event["data"][key].as_str() {
            event["data"][key] = json!(Text::from(text));
        }
    }
    event
}

#[test]
fn all_original_browser_recordings_match_input_events() {
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../packages/typing-fixtures/reference/keystrokes");
    for file in std::fs::read_dir(root).unwrap() {
        let path = file.unwrap().path();
        if path.extension().is_none_or(|ext| ext != "json") {
            continue;
        }
        let fixture: Value = serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();
        let words = fixture["eventLog"]["context"]["targetWords"]
            .as_array()
            .unwrap()
            .iter()
            .map(|word| Text::from(word.as_str().unwrap()))
            .collect();
        let mut session = Session::new(
            serde_json::from_value(fixture["config"].clone()).unwrap(),
            words,
        )
        .unwrap();
        for event in fixture["eventLog"]["events"].as_array().unwrap() {
            let now = event["testMs"].as_f64().unwrap();
            let data = &event["data"];
            match event["type"].as_str().unwrap() {
                "input" => {
                    let command = if data["inputType"] == "insertText" {
                        json!({"op":"insert","data":Text::from(data["data"].as_str().unwrap()),"now":now,
                            "automatic":data.get("automatic"),"isCompositionEnding":data.get("isCompositionEnding")})
                    } else {
                        json!({"op":"delete","kind":data["inputType"],"now":now})
                    };
                    session
                        .apply(serde_json::from_value(command).unwrap())
                        .unwrap();
                }
                "timer" if data["event"] == "start" => {
                    session.apply(Command::Start { now, date: 0.0 }).unwrap();
                }
                "timer" if data["event"] == "end" => {
                    session
                        .apply(Command::Finish {
                            now,
                            date: 0.0,
                            reason: None,
                        })
                        .unwrap();
                }
                kind => {
                    session
                        .apply(Command::Observe {
                            now,
                            event_type: kind.into(),
                            event_data: data.clone(),
                        })
                        .unwrap();
                }
            }
        }
        let actual = session.log()["events"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|event| event["type"] == "input")
            .cloned()
            .collect::<Vec<_>>();
        let expected = fixture["eventLog"]["events"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|event| event["type"] == "input")
            .cloned()
            .map(input_neutral)
            .collect::<Vec<_>>();
        assert_eq!(actual.len(), expected.len(), "{}", path.display());
        for (index, (actual, expected)) in actual.iter().zip(&expected).enumerate() {
            assert_eq!(
                actual["type"],
                expected["type"],
                "{} event {index}",
                path.display()
            );
            assert_eq!(
                actual["testMs"].as_f64(),
                expected["testMs"].as_f64(),
                "{} event {index}",
                path.display()
            );
            assert_eq!(
                actual["data"],
                expected["data"],
                "{} event {index}",
                path.display()
            );
        }
    }
}

#[test]
fn absent_physical_observations_do_not_create_key_durations() {
    let mut session = Session::new(
        serde_json::from_value(json!({"mode":"words","words":1})).unwrap(),
        vec![Text::from("a")],
    )
    .unwrap();
    session
        .apply(serde_json::from_value(json!({"op":"insert","data":[97],"now":0})).unwrap())
        .unwrap();
    session.apply(Command::Finalize { now: 10.0 }).unwrap();
    assert!(
        session.log()["events"]
            .as_array()
            .unwrap()
            .iter()
            .all(|event| event["type"] != "keyup" && event["type"] != "keydown")
    );
}
