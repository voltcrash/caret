use serde_json::json;
use typing_engine::{stats, stats::Log};

fn log(key_times: &[f64], bailed_out: bool) -> Log {
    let mut events = vec![
        json!({"type":"timer","testMs":0,"data":{"event":"start","timer":0,"date":1000}}),
        json!({"type":"timer","testMs":15000,"data":{"event":"end","timer":15,"date":16000}}),
    ];
    for time in key_times {
        events.push(json!({"type":"keydown","testMs":time,"data":{"code":"KeyA"}}));
        events.push(json!({"type":"keyup","testMs":time+40.0,"data":{"code":"KeyA"}}));
    }
    events.sort_by(|a, b| {
        a["testMs"]
            .as_f64()
            .unwrap()
            .total_cmp(&b["testMs"].as_f64().unwrap())
    });
    serde_json::from_value(json!({
        "version":1,"context":{"mode":"time","mode2":"15","targetWords":[],"bailedOut":bailed_out},
        "events":events
    }))
    .unwrap()
}

#[test]
fn pre_start_only_key_uses_zero_for_the_final_interval_but_preserves_its_hold() {
    let summary = stats::typed_summary(&log(&[-201.0], false)).unwrap();
    assert_eq!(summary.start_to_first_key, 0.0);
    assert!(summary.key_spacing.is_empty());
    assert_eq!(summary.last_key_to_end, 15000.0);
    assert_eq!(summary.test_duration, 15.0);
    assert_eq!(summary.key_duration, vec![40.0]);
}

#[test]
fn keyboard_intervals_cover_the_test_for_pre_start_and_in_test_keys() {
    for keys in [vec![-201.0], vec![-201.0, 300.0], vec![200.0, 300.0]] {
        let summary = stats::typed_summary(&log(&keys, false)).unwrap();
        let elapsed = summary.start_to_first_key
            + summary.key_spacing.iter().sum::<f64>()
            + summary.last_key_to_end;
        assert_eq!(elapsed, summary.test_duration * 1000.0);
    }
}

#[test]
fn missing_keyboard_events_and_bailout_trimming_remain_supported() {
    let summary = stats::typed_summary(&log(&[], false)).unwrap();
    assert!(summary.key_duration.is_empty());
    assert_eq!(summary.last_key_to_end, 0.0);
    assert_eq!(summary.test_duration, 15.0);

    let summary = stats::typed_summary(&log(&[0.0, 14000.0], true)).unwrap();
    assert_eq!(summary.last_key_to_end, 1000.0);
    assert_eq!(summary.test_duration, 14.0);
}
