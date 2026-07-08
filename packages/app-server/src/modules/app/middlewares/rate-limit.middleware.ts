import { createMiddleware } from 'hono/factory';

export { createRateLimiterMiddleware };

// Minimal in-memory fixed-window rate limiter. It has no external dependency and
// keeps per-process state, which is the right fit for the self-hosted Node
// deployment (the primary abuse surface: brute-forcing login, flooding note
// creation, enumerating the /exists oracle). For multi-instance or serverless
// (Cloudflare Workers) deployments this per-process counter is best-effort only
// and should be fronted by a platform-level limiter.

const MAX_TRACKED_KEYS = 50_000;

function getClientKey({ context, name }: { context: Parameters<Parameters<typeof createMiddleware>[0]>[0]; name: string }) {
  const forwardedFor = context.req.header('x-forwarded-for');
  const ip = forwardedFor?.split(',')[0]?.trim() || context.req.header('x-real-ip') || 'unknown';

  return `${name}:${ip}`;
}

function createRateLimiterMiddleware({ name, limit, windowMs }: { name: string; limit: number; windowMs: number }) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return createMiddleware(async (context, next) => {
    const now = Date.now();
    const key = getClientKey({ context, name });
    const entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
    } else {
      entry.count += 1;

      if (entry.count > limit) {
        const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));

        return context.json(
          { error: { code: 'app.rate_limited', message: 'Too many requests, please try again later.' } },
          429,
          { 'Retry-After': String(retryAfterSeconds) },
        );
      }
    }

    // Opportunistic cleanup to bound memory usage under key churn.
    if (hits.size > MAX_TRACKED_KEYS) {
      for (const [k, v] of hits) {
        if (v.resetAt <= now) {
          hits.delete(k);
        }
      }
    }

    await next();
  });
}
