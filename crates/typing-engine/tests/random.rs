use typing_engine::random::Random;
#[test]
fn seeded_draw_order_matches_frozen_javascript_mulberry32() {
    let fixtures: serde_json::Value = serde_json::from_str(include_str!(
        "../../../packages/typing-fixtures/oracle/random-streams.json"
    ))
    .unwrap();
    for (seed, values) in fixtures.as_object().unwrap() {
        let mut rng = Random::seeded(seed.parse().unwrap());
        for expected in values.as_array().unwrap() {
            assert_eq!(
                rng.draw().unwrap(),
                expected.as_f64().unwrap(),
                "seed {seed}"
            );
        }
    }
}
#[test]
fn explicit_streams_reject_invalid_values_and_never_reseed_on_exhaustion() {
    assert!(Random::stream(vec![f64::NAN]).is_err());
    assert!(Random::stream(vec![1.0]).is_err());
    let mut rng = Random::stream(vec![0.0, 0.5, 0.999]).unwrap();
    assert_eq!(rng.index(4).unwrap(), 0);
    assert_eq!(rng.index(4).unwrap(), 2);
    assert_eq!(rng.index(4).unwrap(), 3);
    assert!(rng.draw().is_err());
}
