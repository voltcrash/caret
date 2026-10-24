use serde_json::Value;
use typing_engine::challenges::{ChallengeResult, verify};

#[test]
fn challenge_reasons_match_frozen_typescript() {
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../packages/typing-fixtures/oracle/challenges.json");
    let oracle: Value = serde_json::from_slice(&std::fs::read(path).unwrap()).unwrap();
    let requirements = |name: &str| {
        oracle["challenges"]
            .as_array()
            .unwrap()
            .iter()
            .find(|c| c["name"] == name)
            .unwrap()["requirements"]
            .as_object()
            .cloned()
    };
    let cases = oracle["cases"].as_array().unwrap();
    assert!(cases.len() > 500);
    for case in cases {
        let result: ChallengeResult =
            serde_json::from_value(oracle["results"][case["result"].as_str().unwrap()].clone())
                .unwrap();
        let config = oracle["configs"][case["config"].as_str().unwrap()]
            .as_object()
            .unwrap();
        let actual = verify(
            &result,
            config,
            requirements(case["challenge"].as_str().unwrap()).as_ref(),
        )
        .unwrap();
        assert_eq!(
            serde_json::to_value(actual).unwrap(),
            case["expected"],
            "{case}"
        );
    }
}
