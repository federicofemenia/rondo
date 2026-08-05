import type { Club, Prisma } from '@prisma/client';
import type { AdminClubDetailDto, AdminClubSummaryDto, CreateClubInputDto, UpdateClubInputDto } from '@rondo/contracts';
import { prisma } from '../../infrastructure/database/prisma.js';
import { MatchServiceError } from '../matches/errors.js';
import type { ClubManagementAccess } from './adminAuth.js';

const RONDO_TIMEZONE = 'America/Argentina/Buenos_Aires';

/** ASCII-slugifies a club name into a Club.code candidate -- accents stripped, lowercased, non-alphanumerics collapsed to single hyphens. */
function slugify(value: string): string {
  const slug = value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'club';
}

/** Club.code is globally unique but never shown to the user -- appends -2, -3, ... until a free slug is found, so a duplicate club *name* (a legitimate case, e.g. two unrelated "Club Deportivo") never fails to create for a code collision reason the admin never sees. */
async function generateUniqueClubCode(name: string): Promise<string> {
  const base = slugify(name);
  let candidate = base;
  let suffix = 2;
  while (true) {
    const existing = await prisma.club.findUnique({ where: { code: candidate }, select: { id: true } });
    if (!existing) {
      return candidate;
    }
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}

async function assertClubNameAvailable(name: string, excludeClubId?: string): Promise<void> {
  const existing = await prisma.club.findFirst({
    where: { name, status: 'ACTIVE', ...(excludeClubId ? { id: { not: excludeClubId } } : {}) },
    select: { id: true },
  });
  if (existing) {
    throw new MatchServiceError(409, 'CLUB_NAME_TAKEN', 'Ya existe un club activo con ese nombre.');
  }
}

function toAdminClubSummaryDto(club: Club, courtsCount: number, myRole: 'SUPERADMIN' | 'CLUB_ADMIN'): AdminClubSummaryDto {
  return {
    id: club.id,
    name: club.name,
    city: club.city,
    isActive: club.status === 'ACTIVE',
    courtsCount,
    myRole,
  };
}

type ClubWithAdminCounts = Club & { _count: { courts: number; memberships: number } };

function toAdminClubDetailDto(club: ClubWithAdminCounts, myRole: 'SUPERADMIN' | 'CLUB_ADMIN'): AdminClubDetailDto {
  return {
    id: club.id,
    name: club.name,
    description: club.description,
    city: club.city,
    address: club.address,
    isActive: club.status === 'ACTIVE',
    activeCourtsCount: club._count.courts,
    activeAdminsCount: club._count.memberships,
    myRole,
  };
}

/**
 * Every club the *authenticated* user can manage: all of them for a
 * SUPERADMIN, only the ones where they hold an ACTIVE CLUB_ADMIN membership
 * otherwise. A plain MEMBER (or a user with no memberships at all) gets an
 * empty list -- this doubles as "does this user have any admin access at
 * all" for the frontend's Administración menu item.
 */
export async function listAdminClubs(userId: string): Promise<AdminClubSummaryDto[]> {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (user?.role === 'SUPERADMIN') {
    const clubs = await prisma.club.findMany({
      include: { _count: { select: { courts: true } } },
      orderBy: { name: 'asc' },
    });
    return clubs.map((club) => toAdminClubSummaryDto(club, club._count.courts, 'SUPERADMIN'));
  }

  const memberships = await prisma.clubMembership.findMany({
    where: { userId, role: 'CLUB_ADMIN', status: 'ACTIVE' },
    include: { club: { include: { _count: { select: { courts: true } } } } },
    orderBy: { club: { name: 'asc' } },
  });
  return memberships.map((membership) => toAdminClubSummaryDto(membership.club, membership.club._count.courts, 'CLUB_ADMIN'));
}

async function requireAdminClubDetail(clubId: string, myRole: 'SUPERADMIN' | 'CLUB_ADMIN'): Promise<AdminClubDetailDto> {
  const club = await prisma.club.findUnique({
    where: { id: clubId },
    include: {
      _count: {
        select: {
          courts: { where: { active: true } },
          memberships: { where: { role: 'CLUB_ADMIN', status: 'ACTIVE' } },
        },
      },
    },
  });
  if (!club) {
    throw new MatchServiceError(404, 'CLUB_NOT_FOUND', 'El club no existe.');
  }
  return toAdminClubDetailDto(club, myRole);
}

export async function getAdminClubDetail(clubId: string, access: ClubManagementAccess): Promise<AdminClubDetailDto> {
  return requireAdminClubDetail(clubId, access.isSuperadmin ? 'SUPERADMIN' : 'CLUB_ADMIN');
}

/** SUPERADMIN only (enforced by the controller via requireSuperadmin) -- creates an ACTIVE club with a generated unique code and Rondo's fixed Argentina timezone (no international-timezone UI exists anywhere else in the app either). */
export async function createClub(input: CreateClubInputDto): Promise<AdminClubDetailDto> {
  const name = input.name.trim();
  await assertClubNameAvailable(name);

  const code = await generateUniqueClubCode(name);

  const club = await prisma.club.create({
    data: {
      code,
      name,
      description: input.description?.trim() || null,
      city: input.city?.trim() || null,
      address: input.address?.trim() || null,
      timezone: RONDO_TIMEZONE,
      status: 'ACTIVE',
    },
  });

  return requireAdminClubDetail(club.id, 'SUPERADMIN');
}

/**
 * SUPERADMIN can change every field, including name and isActive.
 * CLUB_ADMIN can only change description/city/address -- sending name or
 * isActive as a non-CLUB_ADMIN throws, it's never silently ignored (the
 * caller should already know not to send fields their role can't touch;
 * silently dropping them would hide a frontend bug).
 */
export async function updateClub(clubId: string, access: ClubManagementAccess, input: UpdateClubInputDto): Promise<AdminClubDetailDto> {
  const club = await prisma.club.findUnique({ where: { id: clubId } });
  if (!club) {
    throw new MatchServiceError(404, 'CLUB_NOT_FOUND', 'El club no existe.');
  }

  const data: Prisma.ClubUpdateInput = {};

  if (input.description !== undefined) {
    data.description = input.description?.trim() || null;
  }
  if (input.city !== undefined) {
    data.city = input.city?.trim() || null;
  }
  if (input.address !== undefined) {
    data.address = input.address?.trim() || null;
  }

  if (input.name !== undefined || input.isActive !== undefined) {
    if (!access.isSuperadmin) {
      throw new MatchServiceError(403, 'SUPERADMIN_REQUIRED', 'Solo un administrador de la plataforma puede cambiar el nombre o el estado del club.');
    }
    if (input.name !== undefined) {
      const name = input.name.trim();
      await assertClubNameAvailable(name, clubId);
      data.name = name;
    }
    if (input.isActive !== undefined) {
      // Soft state only -- never a physical delete. An inactive club keeps
      // its courts and memberships untouched (see adminCourts.service.ts:
      // nothing here cascades deactivation to courts).
      data.status = input.isActive ? 'ACTIVE' : 'INACTIVE';
    }
  }

  await prisma.club.update({ where: { id: clubId }, data });

  return requireAdminClubDetail(clubId, access.isSuperadmin ? 'SUPERADMIN' : 'CLUB_ADMIN');
}
