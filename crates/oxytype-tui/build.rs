use std::process::Command;
fn git(args: &[&str]) -> Option<String> {
    let result = Command::new("git").args(args).output().ok()?;
    result
        .status
        .success()
        .then(|| String::from_utf8_lossy(&result.stdout).trim().to_string())
}
fn main() {
    println!("cargo:rerun-if-env-changed=OXYTYPE_BUILD_REV");
    if let Some(path) = git(&["rev-parse", "--git-path", "HEAD"]) {
        println!("cargo:rerun-if-changed={path}");
    }
    if let Some(branch) = git(&["symbolic-ref", "-q", "HEAD"])
        && let Some(path) = git(&["rev-parse", "--git-path", &branch])
    {
        println!("cargo:rerun-if-changed={path}");
    }
    let revision = std::env::var("OXYTYPE_BUILD_REV")
        .ok()
        .filter(|s| !s.is_empty())
        .or_else(|| git(&["rev-parse", "HEAD"]))
        .unwrap_or_else(|| "unknown-source-revision".into());
    assert!(
        revision
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || c == b'-'),
        "Invalid OXYTYPE_BUILD_REV"
    );
    println!("cargo:rustc-env=OXYTYPE_BUILD_REV={revision}");
}
