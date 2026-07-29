import type { AuthAdapter, AuthenticatedClerkProfile } from '../../src/infrastructure/auth/authAdapter.js';

const BEARER_PREFIX = 'Bearer ';

export function createFakeAuthAdapter(profilesByToken: Record<string, AuthenticatedClerkProfile>): AuthAdapter {
  return {
    async authenticate(authorizationHeader) {
      if (!authorizationHeader?.startsWith(BEARER_PREFIX)) {
        return null;
      }

      const token = authorizationHeader.slice(BEARER_PREFIX.length);
      return profilesByToken[token] ?? null;
    },
  };
}
