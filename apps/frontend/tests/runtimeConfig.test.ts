import { describe, expect, it } from 'vitest';
import { resolveApiBaseUrl } from '../src/runtimeConfig';

describe('resolveApiBaseUrl', () => {
  it('returns the configured URL unchanged when it has no trailing slash', () => {
    expect(resolveApiBaseUrl('https://rondo-backend.onrender.com', 'http://127.0.0.1:3000')).toBe(
      'https://rondo-backend.onrender.com',
    );
  });

  it('strips a single trailing slash', () => {
    expect(resolveApiBaseUrl('https://rondo-backend.onrender.com/', 'http://127.0.0.1:3000')).toBe(
      'https://rondo-backend.onrender.com',
    );
  });

  it('strips multiple trailing slashes', () => {
    expect(resolveApiBaseUrl('https://rondo-backend.onrender.com///', 'http://127.0.0.1:3000')).toBe(
      'https://rondo-backend.onrender.com',
    );
  });

  it('falls back to the local default when unset', () => {
    expect(resolveApiBaseUrl(undefined, 'http://127.0.0.1:3000')).toBe('http://127.0.0.1:3000');
  });

  it('falls back to the local default when set to an empty string', () => {
    expect(resolveApiBaseUrl('', 'http://127.0.0.1:3000')).toBe('http://127.0.0.1:3000');
  });
});
