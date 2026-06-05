export function errorMessage(e: unknown): string {
  if (e instanceof Error) {
    const short = (e as { shortMessage?: string }).shortMessage;
    return short || e.message;
  }
  return String(e);
}

export function formatRelativeTime(
  timestampSeconds: bigint,
  now: number = Date.now(),
): string {
  const diff = Math.max(0, Math.floor(now / 1000 - Number(timestampSeconds)));
  const plural = (n: number, unit: string) =>
    `${n} ${unit}${n === 1 ? "" : "s"} ago`;
  if (diff < 60) return plural(diff, "second");
  if (diff < 3600) return plural(Math.floor(diff / 60), "minute");
  if (diff < 86400) return plural(Math.floor(diff / 3600), "hour");
  return plural(Math.floor(diff / 86400), "day");
}
