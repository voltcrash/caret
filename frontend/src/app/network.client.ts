type NetworkInformation = {
  saveData?: boolean;
  effectiveType?: string;
};

/** Only speculative work is optional; requested navigation/data always loads. */
export function canPrefetch(): boolean {
  const connection = (
    navigator as Navigator & {
      connection?: NetworkInformation;
    }
  ).connection;
  return (
    navigator.onLine &&
    connection?.saveData !== true &&
    !["slow-2g", "2g", "3g"].includes(connection?.effectiveType ?? "")
  );
}
