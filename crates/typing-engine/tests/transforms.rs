use serde::Deserialize;
use typing_engine::{Text, random::Random, transforms::alter};
#[derive(Deserialize)]
struct Case {
    name: String,
    word: Text,
    index: usize,
    bound: usize,
    seed: u32,
    expected: Text,
}
#[test]
fn funbox_transforms_preserve_frozen_unicode_and_control_character_behavior() {
    let cases: Vec<Case> = serde_json::from_str(include_str!(
        "../../../packages/typing-fixtures/oracle/transforms.json"
    ))
    .unwrap();
    for case in cases {
        let actual = alter(
            &case.name,
            case.word.clone(),
            case.index,
            case.bound,
            &mut Random::seeded(case.seed),
        )
        .unwrap();
        assert_eq!(actual, case.expected, "{} {:?}", case.name, case.word);
    }
}
