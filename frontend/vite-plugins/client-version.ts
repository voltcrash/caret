import childProcess from "node:child_process";

function pad(numbers: number[], maxLength: number): string[] {
  return numbers.map((number) => number.toString().padStart(maxLength, "0"));
}

/** Build stamp shared by the rollback and Start builds. */
export function getClientVersion(isDevelopment: boolean): string {
  if (isDevelopment) {
    return "DEVELOPMENT_CLIENT";
  }
  const date = new Date();
  const versionPrefix = pad(
    [date.getFullYear(), date.getMonth() + 1, date.getDate()],
    2,
  ).join(".");
  const versionSuffix = pad([date.getHours(), date.getMinutes()], 2).join(".");
  const version = [versionPrefix, versionSuffix].join("_");

  try {
    const commitHash = childProcess
      .execSync("git rev-parse --short HEAD")
      .toString();

    return `${version}_${commitHash}`.replace(/\n/g, "");
  } catch {
    return `${version}_unknown-hash`;
  }
}
