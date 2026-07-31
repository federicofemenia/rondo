import type { Prisma } from '@prisma/client';
import type { ReplaceAvailabilityInputDto, SportProfileDto, UpsertSportProfileInputDto } from '@rondo/contracts';
import { prisma } from '../../infrastructure/database/prisma.js';
import { SportProfileServiceError } from './errors.js';

const sportProfileInclude = {
  sport: true,
  availability: { orderBy: [{ dayOfWeek: 'asc' }, { startMinutes: 'asc' }] },
} satisfies Prisma.UserSportProfileInclude;

type SportProfileWithRelations = Prisma.UserSportProfileGetPayload<{ include: typeof sportProfileInclude }>;

function toSportProfileDto(profile: SportProfileWithRelations): SportProfileDto {
  return {
    id: profile.id,
    sportId: profile.sportId,
    sportName: profile.sport.name,
    positions: profile.positions,
    isAvailableForInvitations: profile.isAvailableForInvitations,
    availability: profile.availability.map((slot) => ({
      id: slot.id,
      dayOfWeek: slot.dayOfWeek,
      startMinutes: slot.startMinutes,
      endMinutes: slot.endMinutes,
    })),
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

export async function listSportProfiles(userId: string): Promise<SportProfileDto[]> {
  const profiles = await prisma.userSportProfile.findMany({
    where: { userId },
    include: sportProfileInclude,
    orderBy: { sport: { displayOrder: 'asc' } },
  });

  return profiles.map(toSportProfileDto);
}

async function requireSportProfile(userId: string, sportId: string): Promise<SportProfileWithRelations> {
  const profile = await prisma.userSportProfile.findUnique({
    where: { userId_sportId: { userId, sportId } },
    include: sportProfileInclude,
  });

  if (!profile) {
    throw new SportProfileServiceError(404, 'SPORT_PROFILE_NOT_FOUND', 'No tenés un perfil deportivo para este deporte.');
  }

  return profile;
}

export async function upsertSportProfile(userId: string, sportId: string, input: UpsertSportProfileInputDto): Promise<SportProfileDto> {
  const sport = await prisma.sport.findUnique({ where: { id: sportId } });
  if (!sport) {
    throw new SportProfileServiceError(422, 'SPORT_NOT_FOUND', 'El deporte indicado no existe.');
  }

  await prisma.userSportProfile.upsert({
    where: { userId_sportId: { userId, sportId } },
    update: { positions: input.positions, isAvailableForInvitations: input.isAvailableForInvitations },
    create: { userId, sportId, positions: input.positions, isAvailableForInvitations: input.isAvailableForInvitations },
  });

  return toSportProfileDto(await requireSportProfile(userId, sportId));
}

/**
 * Replaces the full weekly availability of a sport profile inside a single
 * transaction (delete-then-recreate), matching the PUT-replaces-the-collection
 * contract described in USERS.md rather than exposing per-slot CRUD.
 */
export async function replaceAvailability(userId: string, sportId: string, input: ReplaceAvailabilityInputDto): Promise<SportProfileDto> {
  const profile = await requireSportProfile(userId, sportId);

  await prisma.$transaction([
    prisma.playerAvailability.deleteMany({ where: { userSportProfileId: profile.id } }),
    prisma.playerAvailability.createMany({
      data: input.slots.map((slot) => ({
        userSportProfileId: profile.id,
        dayOfWeek: slot.dayOfWeek,
        startMinutes: slot.startMinutes,
        endMinutes: slot.endMinutes,
      })),
    }),
  ]);

  return toSportProfileDto(await requireSportProfile(userId, sportId));
}

export async function deleteSportProfile(userId: string, sportId: string): Promise<void> {
  const profile = await requireSportProfile(userId, sportId);

  await prisma.$transaction([
    prisma.playerAvailability.deleteMany({ where: { userSportProfileId: profile.id } }),
    prisma.userSportProfile.delete({ where: { id: profile.id } }),
  ]);
}
