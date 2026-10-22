use serde::Deserialize;
use serde_json::{Value, json};
use typing_engine::{Command, Config, Session, Text};

#[derive(Deserialize)]
struct Fixture {
    name: String,
    config: Config,
    words: Vec<Text>,
    commands: Vec<Command>,
}

fn equivalent(a: &Value, b: &Value) -> bool {
    match (a, b) {
        (Value::Number(a), Value::Number(b)) => a.as_f64() == b.as_f64(),
        (Value::Array(a), Value::Array(b)) => {
            a.len() == b.len() && a.iter().zip(b).all(|(a, b)| equivalent(a, b))
        }
        (Value::Object(a), Value::Object(b)) => {
            a.len() == b.len()
                && a.iter()
                    .all(|(key, a)| b.get(key).is_some_and(|b| equivalent(a, b)))
        }
        _ => a == b,
    }
}

#[test]
fn finite_slice_matches_frozen_intermediate_oracle() {
    let root =
        std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../packages/typing-fixtures");
    for name in [
        "finite-edit",
        "unicode-halves",
        "freedom-regression",
        "ime-typography",
        "timer-stall",
        "stop-letter",
        "infinite-words",
        "code-indent",
        "master-finish-once",
        "delete-error-letter",
        "delete-error-letter_hard",
        "delete-error-word",
        "delete-error-word_hard",
    ] {
        let fixture: Fixture = serde_json::from_slice(
            &std::fs::read(root.join(format!("commands/{name}.json"))).unwrap(),
        )
        .unwrap();
        let expected: Value = serde_json::from_slice(
            &std::fs::read(root.join(format!("oracle/{name}.json"))).unwrap(),
        )
        .unwrap();
        let mut session = Session::new(fixture.config, fixture.words).unwrap();
        let mut frames = vec![];
        for command in fixture.commands {
            let update = session.apply(command).unwrap();
            frames.push(json!({"state":update.state,"log":session.log()}));
        }
        let actual = json!({"name":fixture.name,"frames":frames});
        assert!(
            equivalent(&actual, &expected),
            "{name}\nactual={actual}\nexpected={expected}"
        );
    }
}

#[test]
fn independent_sessions_reset_without_cross_contamination() {
    let config = Config {
        mode: "words".into(),
        words: 1,
        ..Config::default()
    };
    let mut a = Session::new(config.clone(), vec![Text::from("a")]).unwrap();
    let b = Session::new(config, vec![Text::from("b")]).unwrap();
    a.apply(serde_json::from_value(json!({"op":"insert","data":[97],"now":0})).unwrap())
        .unwrap();
    assert!(a.state().ended);
    assert!(!b.state().active);
    assert!(b.state().input_value.is_empty());
    a.apply(Command::Reset { now: 1.0 }).unwrap();
    assert!(!a.state().ended);
    assert!(a.state().input_value.is_empty());
}

#[test]
fn invalid_command_leaves_state_unchanged() {
    let mut session = Session::new(Config::default(), vec![]).unwrap();
    let before = session.log();
    assert!(
        session
            .apply(Command::Start {
                now: f64::NAN,
                date: 0.0
            })
            .is_err()
    );
    assert_eq!(session.log(), before);
    assert_eq!(Text(vec![0xd83d]).0, vec![0xd83d]);
}
