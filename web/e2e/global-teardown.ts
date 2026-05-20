async function globalTeardown() {
  const close = (globalThis as Record<string, unknown>).__heedE2eClose as
    | (() => Promise<void>)
    | undefined;
  if (close) await close();
}

export default globalTeardown;
