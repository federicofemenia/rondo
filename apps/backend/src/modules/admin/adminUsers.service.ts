import type { AdminUserSearchResultDto } from '@rondo/contracts';
import { prisma } from '../../infrastructure/database/prisma.js';
import { displayName } from '../users/users.service.js';

const SEARCH_RESULTS_LIMIT = 20;

/**
 * Minimal user picker for assigning club admins -- deliberately excludes
 * email/clerkUserId/any private field, and is intentionally NOT the same
 * endpoint as any user-facing search (none currently reuses it), since this
 * one is only ever reachable by a SUPERADMIN (enforced by the controller).
 * Matches on displayName/username/firstName/lastName because displayName is
 * frequently null (see displayName()'s fallback chain in users.service.ts)
 * — searching only the literal column would miss most real accounts.
 */
export async function searchAdminUsers(query: string): Promise<AdminUserSearchResultDto[]> {
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    return [];
  }

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { displayName: { contains: trimmed, mode: 'insensitive' } },
        { username: { contains: trimmed, mode: 'insensitive' } },
        { firstName: { contains: trimmed, mode: 'insensitive' } },
        { lastName: { contains: trimmed, mode: 'insensitive' } },
      ],
    },
    take: SEARCH_RESULTS_LIMIT,
    orderBy: { username: 'asc' },
  });

  return users.map((user) => ({
    id: user.id,
    displayName: displayName(user),
    username: user.username,
    avatarUrl: user.avatarUrl,
  }));
}
