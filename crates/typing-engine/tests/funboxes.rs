use serde_json::Value;
#[test]
fn all_funbox_pairs_and_forced_configuration_match_frozen_typescript() {
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../packages/typing-fixtures/oracle/funboxes.json");
    let cases: Value = serde_json::from_slice(&std::fs::read(root).unwrap()).unwrap();
    for case in cases["combinations"].as_array().unwrap() {
        let names: Vec<String> = serde_json::from_value(case["names"].clone()).unwrap();
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
