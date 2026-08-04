import { randomUUID } from 'node:crypto';
import type { Match, MatchStatus, StatusChangedByType } from '@prisma/client';
import { prisma } from '../../src/infrastructure/database/prisma.js';
import { SEED_IDS } from '../../src/infrastructure/database/seedIds.js';

type CreateTestMatchInput = {
  organizerUserId?: string;
  participantUserIds?: string[];
  minPlayers?: number;
  maxPlayers?: number;
  scheduledDate?: Date;
  availabilityStartMinutes?: number;
  availabilityEndMinutes?: number;
  durationMinutes?: number;
  startsAt?: Date | null;
  endsAt?: Date | null;
  status?: MatchStatus;
  statusChangedAt?: Date;
  statusChangedByType?: StatusChangedByType;
  statusChangedByUserId?: string | null;
  cancellationReason?: string | null;
};

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export async function createTestMatch(input: CreateTestMatchInput = {}): Promise<Match> {
  const now = new Date();
  const defaultStartsAt = new Date(now.getTime() - 60 * 60 * 1000);
  const defaultEndsAt = new Date(now.getTime() + 60 * 60 * 1000);
  const startsAt = input.startsAt !== undefined ? input.startsAt : defaultStartsAt;
  const endsAt = input.endsAt !== undefined ? input.endsAt : defaultEndsAt;

  const match = await prisma.match.create({
    data: {
      id: randomUUID(),
      clubId: SEED_IDS.club.senorPato,
      venueType: 'CLUB',
      sportModalityId: SEED_IDS.modalities.football5,
      courtId: SEED_IDS.courts.football5,
      organizerUserId: input.organizerUserId ?? SEED_IDS.users.juan,
      minPlayers: input.minPlayers ?? 2,
      maxPlayers: input.maxPlayers ?? 10,
      scheduledDate: input.scheduledDate ?? startOfUtcDay(startsAt ?? now),
      availabilityStartMinutes: input.availabilityStartMinutes ?? 0,
      availabilityEndMinutes: input.availabilityEndMinutes ?? 1440,
      durationMinutes: input.durationMinutes ?? 60,
      startsAt,
      endsAt,
      status: input.status ?? 'ORGANIZING',
      statusChangedAt: input.statusChangedAt ?? now,
      statusChangedByType: input.statusChangedByType ?? 'SYSTEM',
      statusChangedByUserId: input.statusChangedByUserId ?? null,
      cancellationReason: input.cancellationReason ?? null,
    },
  });

  const participantUserIds = input.participantUserIds ?? [];
  await Promise.all(
    participantUserIds.map((userId) => prisma.matchParticipant.create({ data: { matchId: match.id, userId } })),
  );

  return match;
}

export async function deleteTestMatch(matchId: string): Promise<void> {
  await prisma.playerRating.deleteMany({ where: { matchId } });
  await prisma.matchInvitation.deleteMany({ where: { matchId } });
  await prisma.matchParticipant.deleteMany({ where: { matchId } });
  await prisma.match.deleteMany({ where: { id: matchId } });
}
