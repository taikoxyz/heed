export function errorMessage(e: unknown): string {
  if (e instanceof Error) {
    const short = (e as { shortMessage?: string }).shortMessage;
    return short || e.message;
  }
  return String(e);
}
