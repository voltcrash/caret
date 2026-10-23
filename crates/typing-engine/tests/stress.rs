use serde_json::{Value, json};
use typing_engine::{
    Command, Config, Session, Text,
    stats::{self, Log},
};
fn random(state: &mut u32) -> u32 {
    *state = state.wrapping_mul(1664525).wrapping_add(1013904223);
    *state
}
#[test]
fn seeded_lifecycle_stress_preserves_log_deltas_isolation_completion_and_live_parity() {
    for seed in 0..128u32 {
        let config = Config {
            mode: ["words", "time", "zen"][seed as usize % 3].into(),
            time: 2.0,
            words: 3,
            difficulty: ["normal", "expert", "master"][seed as usize % 3].into(),
            freedom_mode: seed % 2 == 0,
            min_burst: "fixed".into(),
            min_burst_custom_speed: 0.0,
            min_wpm: "custom".into(),
            min_wpm_custom_speed: 0.0,
            min_acc: "custom".into(),
            min_acc_custom: 0.0,
            ..Config::default()
        };
        let words = vec![Text::from("a "), Text::from("b "), Text::from("c")];
        let mut session = Session::new(config.clone(), words.clone()).unwrap();
        let isolated = Session::new(config, words).unwrap();
        let untouched = isolated.log();
        let mut rng = seed;
        let mut now = 0.0;
        let mut projected: Vec<Value> = vec![];
        let inputs = [vec![97u16, 32], vec![98], vec![0xd83d, 0xde00], vec![10, 9]];
        for iteration in 0..100 {
            now += f64::from(random(&mut rng) % 1000) / 10.0;
            let value = match random(&mut rng) % 16 {
                0 => json!({"op":"reset","now":now}),
                1 => json!({"op":"advance","now":now,"date":now+1000000.0}),
                2 => json!({"op":"delete","kind":"deleteContentBackward","now":now}),
                3 => json!({"op":"delete","kind":"deleteWordBackward","now":now}),
                4 => json!({"op":"start","now":now,"date":1000000.0+now}),
                5 => json!({"op":"finish","now":now,"date":1000000.0+now}),
                6 => {
                    json!({"op":"observe","now":now,"eventType":"composition","eventData":{"event":"start"}})
                }
                7 => {
                    json!({"op":"observe","now":now,"eventType":"composition","eventData":{"event":"end","data":[]}})
                }
                8 => {
                    json!({"op":"observe","now":now,"eventType":"keydown","eventData":{"code":"NoCode"}})
                }
                9 => {
                    json!({"op":"observe","now":now,"eventType":"keyup","eventData":{"code":"NoCode"}})
                }
                10 => json!({"op":"flushAutomatic","now":now,"generation":u32::MAX}),
                11 => json!({"op":"view","now":now,"deferFinish":true}),
                12 => json!({"op":"acknowledgeFinish","now":now,"date":1000000.0+now}),
                _ => {
                    json!({"op":"insert","now":now,"date":1000000.0+now,"data": (&inputs[(random(&mut rng)%4)as usize])})
                }
            };
            let command: Command = serde_json::from_value(value).unwrap();
            let before = session.log();
            match session.apply(command) {
                Ok(update) => {
                    let full = session.log();
                    if update.log_invalidated {
                        projected = full["events"].as_array().unwrap().clone();
                    } else {
                        projected.extend(
                            serde_json::to_value(update.events)
                                .unwrap()
                                .as_array()
                                .unwrap()
                                .iter()
                                .cloned(),
                        );
                    }
                    assert_eq!(
                        json!(projected),
                        full["events"],
                        "seed {seed} iteration {iteration}"
                    );
                }
                Err(_) => assert_eq!(
                    session.log(),
                    before,
                    "rejected command mutated seed {seed}"
                ),
            }
            let log: Log = serde_json::from_value(session.log()).unwrap();
            assert!(
                typing_engine::validation::log(&log).is_ok(),
                "seed {seed} iteration {iteration}"
            );
            let live = session.live_stats(now).unwrap();
            assert_eq!(
                live.chars,
                stats::chars(&log, true, None),
                "seed {seed} iteration {iteration}"
            );
            let recorded = log
                .events
                .iter()
                .any(|event| event.kind == "input" && event.data.get("correct").is_some());
            assert_eq!(
                live.acc,
                if recorded {
                    stats::accuracy(&log, None)
                } else {
                    100.0
                }
            );
            assert!(
                log.events
                    .iter()
                    .filter(|event| event.kind == "timer" && event.data["event"] == "end")
                    .count()
                    <= 1
            );
            assert_eq!(isolated.log(), untouched);
        }
    }
}
