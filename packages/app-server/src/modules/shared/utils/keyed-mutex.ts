export { createKeyedMutex };

// A per-key async mutex: calls for the same key run strictly one after another,
// while different keys run concurrently. Used to make the read-then-delete of a
// "delete after reading" note atomic within a process, so two concurrent readers
// can't both receive the same one-time note (TOCTOU race). This is per-process
// state and therefore only protects single-instance deployments (the self-hosted
// fs-lite/memory default); multi-instance or serverless backends need a
// storage-level atomic primitive.
function createKeyedMutex() {
  const tails = new Map<string, Promise<void>>();

  async function runExclusive<T>({ key, fn }: { key: string; fn: () => Promise<T> }): Promise<T> {
    const previous = tails.get(key) ?? Promise.resolve();

    let release: () => void = () => {};
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });

    const gate = previous.then(() => current);
    tails.set(key, gate);

    // Wait for the previous holder to finish before entering the section.
    await previous;

    try {
      return await fn();
    } finally {
      release();

      // If nobody queued behind us, drop the key to avoid unbounded growth.
      if (tails.get(key) === gate) {
        tails.delete(key);
      }
    }
  }

  return { runExclusive };
}
