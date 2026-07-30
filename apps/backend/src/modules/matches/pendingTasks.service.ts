import type { PendingTaskDto } from '@rondo/contracts';
import { prisma } from '../../infrastructure/database/prisma.js';
import { applyMatchLifecycle } from './matchLifecycle.js';
import { getMatchRatings } from './ratings.service.js';

const matchInclude = {
  club: true,
  sportModality: true,
} as const;

export async function getPendingTasks(userId: string, now: Date = new Date()): Promise<PendingTaskDto[]> {
  const completedMatches = await prisma.match.findMany({
    where: { status: 'COMPLETED', participants: { some: { userId } } },
    include: matchInclude,
  });

  const tasks: PendingTaskDto[] = [];

  for (const rawMatch of completedMatches) {
    const match = await applyMatchLifecycle(rawMatch, now);
    const ratings = await getMatchRatings(match.id, userId, now);

    if (ratings.closed || ratings.pendingCount === 0) {
      continue;
    }

    tasks.push({
      type: 'MATCH_RATINGS',
      matchId: match.id,
      title: 'Valorá a los jugadores',
      description: `${match.sportModality.name} · ${match.club?.name ?? 'Club a definir'}`,
      pendingCount: ratings.pendingCount,
      targetTab: 'ratings',
    });
  }

  return tasks;
}
