import type { ServerInstance } from '../server.types';
import { z } from 'zod';
import { validateJsonBody } from '../../shared/validation/validation';
import { createRateLimiterMiddleware } from '../middlewares/rate-limit.middleware';
import { createUserRepository } from '../users/users.repository';
import { createUnauthorizedError } from './auth.errors';
import { arePasswordsMatching, createJwtToken, DUMMY_PASSWORD_HASH } from './auth.services';

export { registerAuthRoutes };

function registerAuthRoutes({ app }: { app: ServerInstance }) {
  setupLoginRoute({ app });
}

function setupLoginRoute({ app }: { app: ServerInstance }) {
  app.post(
    '/api/auth/login',
    createRateLimiterMiddleware({ name: 'login', limit: 10, windowMs: 5 * 60 * 1000 }),
    validateJsonBody(z.object({
      email: z.string().email(),
      password: z.string(),
    })),
    async (context) => {
      const config = context.get('config');
      const { email, password } = context.req.valid('json');

      const { getUserByEmail } = createUserRepository({ config });

      const { user } = getUserByEmail({ email });

      if (!user) {
        // Compare against a real bcrypt hash so this path costs the same as a
        // valid-email path — prevents user enumeration via response timing.
        await arePasswordsMatching({ password, passwordHash: DUMMY_PASSWORD_HASH });

        throw createUnauthorizedError();
      }

      const passwordsMatch = await arePasswordsMatching({ password, passwordHash: user.passwordHash });

      if (!passwordsMatch) {
        throw createUnauthorizedError();
      }

      const { token } = await createJwtToken({
        jwtSecret: config.authentication.jwtSecret,
        durationSec: config.authentication.jwtDurationSeconds,
      });

      return context.json({
        accessToken: token,
      });
    },
  );
}
