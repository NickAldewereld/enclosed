import bcrypt from 'bcryptjs';
import { sign, verify } from 'hono/jwt';

export { arePasswordsMatching, createJwtToken, DUMMY_PASSWORD_HASH, isJwtValid };

// A real (60-char) bcrypt hash used when the email doesn't match any user, so
// bcrypt.compare runs the full key-derivation on the no-user path too. Comparing
// against a non-bcrypt string (e.g. 'dummy') hits bcryptjs's instant length
// fast-path, which makes existing accounts measurably slower and leaks user
// existence via response timing. Computed once at startup.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('timing-attack-dummy-password', 10);

async function arePasswordsMatching({ password, passwordHash }: { password: string; passwordHash: string }) {
  return await bcrypt.compare(password, passwordHash);
}

async function createJwtToken({ jwtSecret, durationSec }: { jwtSecret: string; durationSec?: number }) {
  const token = await sign(
    {
      ...(durationSec ? { exp: Math.floor(Date.now() / 1000) + durationSec } : {}),
    },
    jwtSecret,
    'HS256',
  );

  return {
    token,
  };
}

async function isJwtValid({ token, jwtSecret }: { token: string; jwtSecret: string }) {
  try {
    await verify(token, jwtSecret, 'HS256');
    return true;
  } catch (_error) {
    return false;
  }
}
