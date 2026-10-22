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

#[test]
fn morse_matches_javascript_for_every_scalar_and_isolated_utf16_unit() {
    use typing_engine::{Text, random::Random, transforms::alter};
    let mut hash = 14695981039346656037_u64;
    let mut count = 0;
    let mut record = |input: Text| {
        let output = alter("morse", input, 0, 1, &mut Random::seeded(0)).unwrap();
        for unit in std::iter::once(output.len() as u16).chain(output.0) {
            hash = (hash ^ u64::from(unit)).wrapping_mul(1099511628211);
            count += 1;
        }
    };
    for unit in 0..=u16::MAX {
        record(Text(vec![unit]));
    }
    for code in 0..=0x10ffff {
        if let Some(character) = char::from_u32(code) {
            record(Text(character.to_string().encode_utf16().collect()));
        }
    }
    assert_eq!(count, 1182044);
    assert_eq!(hash, 0xcbd60b424acd4b15);
}
