use serde_json::Value;
#[test]
fn all_funbox_pairs_and_forced_configuration_match_frozen_typescript() {
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../packages/typing-fixtures/oracle/funboxes.json");
    let cases: Value = serde_json::from_slice(&std::fs::read(root).unwrap()).unwrap();
    for case in cases["combinations"].as_array().unwrap() {
        let names: Vec<String> = serde_json::from_value(case["names"].clone()).unwrap();
        let response = typing_engine::policy::evaluate(typing_engine::policy::Query::Compatible {
            names: names.clone(),
        })
        .unwrap();
        assert_eq!(
            serde_json::to_value(response).unwrap()["result"],
            case["compatible"]
        );
        assert_eq!(
            typing_engine::funboxes::compatible(&names),
            case["compatible"].as_bool().unwrap(),
            "{names:?}"
        );
    }
    for case in cases["forced"].as_array().unwrap() {
        let names: Vec<String> = serde_json::from_value(case["names"].clone()).unwrap();
        let key = case["key"].as_str().unwrap();
        let value = &case["value"];
        let response = typing_engine::policy::evaluate(typing_engine::policy::Query::Forced {
            key: key.into(),
            value: value.clone(),
            names: names.clone(),
        })
        .unwrap();
        assert_eq!(
            serde_json::to_value(response).unwrap()["result"],
            case["forced"]
        );
        let response = typing_engine::policy::evaluate(typing_engine::policy::Query::CanSet {
            key: key.into(),
            value: value.clone(),
            names: names.clone(),
        })
        .unwrap();
        assert_eq!(
            serde_json::to_value(response).unwrap()["result"],
            case["canSet"]
        );

        assert_eq!(
            serde_json::to_value(typing_engine::funboxes::forced(key, value, &names).unwrap())
                .unwrap(),
            case["forced"],
            "{case}"
        );
        assert_eq!(
            typing_engine::funboxes::can_set(key, value, &names).unwrap(),
            case["canSet"].as_bool().unwrap(),
            "{case}"
        );
    }
}

#[test]
fn batch_setting_conflicts_preserve_host_field_order_and_original_decisions() {
    use typing_engine::policy::{Query, evaluate};
    let values = vec![
        ("mode".to_owned(), serde_json::json!("zen")),
        ("theme".to_owned(), serde_json::json!("dark")),
        ("words".to_owned(), serde_json::json!(0)),
    ];
    for names in [
        vec!["poetry".to_owned()],
        vec!["nospace".to_owned()],
        vec![],
    ] {
        let expected: Vec<_> = values
            .iter()
            .filter(|(key, value)| !typing_engine::funboxes::can_set(key, value, &names).unwrap())
            .map(|(key, _)| key.clone())
            .collect();
        let response = evaluate(Query::SettingConflicts {
            names,
            values: values.clone(),
        })
        .unwrap();
        assert_eq!(
            serde_json::to_value(response).unwrap()["keys"],
            serde_json::json!(expected)
        );
    }
}
