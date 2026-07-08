import { describe, expect, test } from 'vitest';
import { createKeyedMutex } from './keyed-mutex';

describe('keyed-mutex', () => {
  test('serializes calls sharing the same key, in submission order', async () => {
    const mutex = createKeyedMutex();
    const order: string[] = [];

    const slow = mutex.runExclusive({
      key: 'note-a',
      fn: async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
        order.push('slow');
      },
    });

    const fast = mutex.runExclusive({
      key: 'note-a',
      fn: async () => {
        order.push('fast');
      },
    });

    await Promise.all([slow, fast]);

    // Without the mutex, 'fast' would resolve before the slow section finishes.
    expect(order).toEqual(['slow', 'fast']);
  });

  test('lets only one of two concurrent readers observe a one-time value', async () => {
    const mutex = createKeyedMutex();
    let available = true;

    const claim = async () => mutex.runExclusive({
      key: 'note-a',
      fn: async () => {
        if (!available) {
          return null;
        }

        // Simulate async read-then-delete.
        await new Promise(resolve => setTimeout(resolve, 5));
        available = false;

        return 'secret';
      },
    });

    const results = await Promise.all([claim(), claim()]);

    expect(results.filter(value => value === 'secret')).toHaveLength(1);
    expect(results.filter(value => value === null)).toHaveLength(1);
  });

  test('runs different keys without blocking each other', async () => {
    const mutex = createKeyedMutex();
    const running = { a: false, b: false };
    let sawConcurrent = false;

    await Promise.all([
      mutex.runExclusive({
        key: 'a',
        fn: async () => {
          running.a = true;
          await new Promise(resolve => setTimeout(resolve, 15));
          if (running.b) {
            sawConcurrent = true;
          }
          running.a = false;
        },
      }),
      mutex.runExclusive({
        key: 'b',
        fn: async () => {
          running.b = true;
          await new Promise(resolve => setTimeout(resolve, 15));
          if (running.a) {
            sawConcurrent = true;
          }
          running.b = false;
        },
      }),
    ]);

    expect(sawConcurrent).toBe(true);
  });
});
