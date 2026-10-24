use serde_json::{Value, json};
use typing_engine::{Text, stats, text};

#[test]
fn original_browser_string_rule_cases_match_native_utf16_rules() {
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../packages/typing-fixtures/oracle/string-rules.json");
    let cases: Vec<Value> = serde_json::from_slice(&std::fs::read(path).unwrap()).unwrap();
    assert_eq!(cases.len(), 68);
    for (index, case) in cases.iter().enumerate() {
        let args = &case["args"];
        let input = Text::from(args[0].as_str().unwrap());
        let actual = match case["name"].as_str().unwrap() {
            "countChars" => json!(stats::count_chars(
                &input,
                &Text::from(args[1].as_str().unwrap()),
                args[2].as_bool().unwrap()
            )),
            "isSpace" => json!(input.len() == 1 && text::is_space(input.0[0])),
            "areCharactersVisuallyEqual" => {
                let target = Text::from(args[1].as_str().unwrap());
                assert_eq!(input.len(), 1);
                assert_eq!(target.len(), 1);
                json!(
                    text::normalize(
                        input.0[0],
                        Some(target.0[0]),
                        args[2].as_str().unwrap_or("english")
                    ) == target.0[0]
                )
            }
            name => panic!("Unmapped captured rule: {name}"),
        };
        assert_eq!(actual, case["expected"], "case {index}: {}", case["name"]);
    }
}
