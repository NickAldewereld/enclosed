import { describe, expect, test } from 'vitest';
import { getConfig } from './config';

describe('config authentication guard', () => {
  const authEnv = (secret: string) => ({
    NODE_ENV: 'production',
    PUBLIC_IS_AUTHENTICATION_REQUIRED: 'true',
    AUTHENTICATION_JWT_SECRET: secret,
  });

  test('throws when authentication is enabled but the jwt secret is the insecure default', () => {
    expect(() => getConfig({ env: authEnv('change-me') })).toThrow(/AUTHENTICATION_JWT_SECRET/);
  });

  test('throws when authentication is enabled but the jwt secret is too short', () => {
    expect(() => getConfig({ env: authEnv('short-secret') })).toThrow(/at least/);
  });

  test('accepts a strong jwt secret when authentication is enabled', () => {
    expect(() => getConfig({ env: authEnv('a'.repeat(40)) })).not.toThrow();
  });

  test('does not enforce the secret when authentication is disabled', () => {
    expect(() => getConfig({ env: { NODE_ENV: 'production', PUBLIC_IS_AUTHENTICATION_REQUIRED: 'false', AUTHENTICATION_JWT_SECRET: 'change-me' } })).not.toThrow();
  });
});
