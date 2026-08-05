import type { Court } from '@prisma/client';
import type { CourtAdminDto, CreateCourtInputDto, UpdateCourtInputDto } from '@rondo/contracts';
import { prisma } from '../../infrastructure/database/prisma.js';
import { MatchServiceError } from '../matches/errors.js';

/** Same slug strategy as Club.code (see adminClubs.service.ts) -- Court.code is only unique per-club, so collisions are checked scoped to clubId. */
function slugify(value: string): string {
  const slug = value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'cancha';
}

async function generateUniqueCourtCode(clubId: string, name: string): Promise<string> {
  const base = slugify(name);
  let candidate = base;
  let suffix = 2;
  while (true) {
    const existing = await prisma.court.findUnique({ where: { clubId_code: { clubId, code: candidate } }, select: { id: true } });
    if (!existing) {
      return candidate;
    }
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}

async function assertCourtNameAvailable(clubId: string, name: string, excludeCourtId?: string): Promise<void> {
  const existing = await prisma.court.findFirst({
    where: { clubId, name, ...(excludeCourtId ? { id: { not: excludeCourtId } } : {}) },
    select: { id: true },
  });
  if (existing) {
    throw new MatchServiceError(409, 'COURT_NAME_TAKEN', 'Ya existe una cancha con ese nombre en este club.');
  }
}

async function requireClub(clubId: string): Promise<{ id: string; status: string }> {
  const club = await prisma.club.findUnique({ where: { id: clubId }, select: { id: true, status: true } });
  if (!club) {
    throw new MatchServiceError(404, 'CLUB_NOT_FOUND', 'El club no existe.');
  }
  return club;
}

type CourtWithModality = Court & { sportModality: { name: string; sport: { name: string } } };

function toCourtAdminDto(court: CourtWithModality): CourtAdminDto {
  return {
    id: court.id,
    name: court.name,
    sportModalityId: court.sportModalityId,
    sportName: court.sportModality.sport.name,
    modalityName: court.sportModality.name,
    description: court.description,
    isActive: court.active,
  };
}

const courtWithModalityInclude = { sportModality: { include: { sport: true } } } as const;

export async function listAdminCourts(clubId: string): Promise<CourtAdminDto[]> {
  await requireClub(clubId);
  const courts = await prisma.court.findMany({
    where: { clubId },
    include: courtWithModalityInclude,
    orderBy: { displayOrder: 'asc' },
  });
  return courts.map(toCourtAdminDto);
}

/**
 * pricePerHour/slotDurationMinutes are required, pre-existing columns that
 * this slice doesn't expose in the UI (see the schema comment on Court) --
 * defaulted here to 0 and the modality's own durationMinutes respectively,
 * a placeholder the next ("precios") slice replaces with real admin input.
 */
export async function createCourt(clubId: string, input: CreateCourtInputDto): Promise<CourtAdminDto> {
  const club = await requireClub(clubId);
  if (club.status !== 'ACTIVE') {
    throw new MatchServiceError(422, 'CLUB_INACTIVE', 'No se pueden agregar canchas a un club inactivo.');
  }

  const sportModality = await prisma.sportModality.findUnique({ where: { id: input.sportModalityId } });
  if (!sportModality) {
    throw new MatchServiceError(422, 'SPORT_MODALITY_NOT_FOUND', 'La modalidad seleccionada no existe.');
  }

  const name = input.name.trim();
  await assertCourtNameAvailable(clubId, name);
  const code = await generateUniqueCourtCode(clubId, name);

  const lastCourt = await prisma.court.findFirst({ where: { clubId }, orderBy: { displayOrder: 'desc' }, select: { displayOrder: true } });

  const court = await prisma.court.create({
    data: {
      clubId,
      code,
      name,
      description: input.description?.trim() || null,
      sportModalityId: sportModality.id,
      displayOrder: (lastCourt?.displayOrder ?? -1) + 1,
      slotDurationMinutes: sportModality.durationMinutes,
      pricePerHour: 0,
      active: true,
    },
    include: courtWithModalityInclude,
  });

  return toCourtAdminDto(court);
}

/** Validates the court genuinely belongs to clubId before touching it -- a court id from another club never resolves here, even if the caller administers *some* club. */
async function requireCourtInClub(clubId: string, courtId: string): Promise<Court> {
  const court = await prisma.court.findUnique({ where: { id: courtId } });
  if (!court || court.clubId !== clubId) {
    throw new MatchServiceError(404, 'COURT_NOT_FOUND', 'La cancha no existe en este club.');
  }
  return court;
}

export async function updateCourt(clubId: string, courtId: string, input: UpdateCourtInputDto): Promise<CourtAdminDto> {
  await requireClub(clubId);
  await requireCourtInClub(clubId, courtId);

  const data: { name?: string; description?: string | null; sportModalityId?: string; active?: boolean } = {};

  if (input.name !== undefined) {
    const name = input.name.trim();
    await assertCourtNameAvailable(clubId, name, courtId);
    data.name = name;
  }
  if (input.description !== undefined) {
    data.description = input.description?.trim() || null;
  }
  if (input.sportModalityId !== undefined) {
    const sportModality = await prisma.sportModality.findUnique({ where: { id: input.sportModalityId } });
    if (!sportModality) {
      throw new MatchServiceError(422, 'SPORT_MODALITY_NOT_FOUND', 'La modalidad seleccionada no existe.');
    }
    data.sportModalityId = sportModality.id;
  }
  if (input.isActive !== undefined) {
    // Soft toggle only -- never a physical delete, so match/reservation
    // history that references this court stays intact.
    data.active = input.isActive;
  }

  const court = await prisma.court.update({ where: { id: courtId }, data, include: courtWithModalityInclude });
  return toCourtAdminDto(court);
}
