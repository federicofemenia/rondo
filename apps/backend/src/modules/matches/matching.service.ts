import type { PlayerAvailability, User, UserSportProfile } from '@prisma/client';
import type { CandidateDto, RatingsSummaryDto } from '@rondo/contracts';
import { prisma } from '../../infrastructure/database/prisma.js';
import { displayName, getConfirmedParticipantIds, getInvitedUserIds, requireMatchWithRelations } from './matches.service.js';
import { emptyRatingsSummary, getRatingsSummaries } from './ratings.service.js';

type MatchScheduleFields = {
  scheduledDate: Date;
  availabilityStartMinutes: number;
  availabilityEndMinutes: number;
  startsAt: Date | null;
  endsAt: Date | null;
};

type AvailabilityWindow = {
  /** 0 = Sunday ... 6 = Saturday, matching PlayerAvailability.dayOfWeek (JS Date#getUTCDay()). */
  dayOfWeek: number;
  /** true when the match has a confirmed startsAt/endsAt; the candidate must fully cover it rather than merely overlap. */
  hasExactTime: boolean;
  startMinutes: number;
  endMinutes: number;
};

function minutesOfDay(date: Date): number {
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

/** Resolves the day/time window a candidate's weekly availability must satisfy for a given match. */
function resolveAvailabilityWindow(match: MatchScheduleFields): AvailabilityWindow {
  const dayOfWeek = match.scheduledDate.getUTCDay();

  if (match.startsAt && match.endsAt) {
    return { dayOfWeek, hasExactTime: true, startMinutes: minutesOfDay(match.startsAt), endMinutes: minutesOfDay(match.endsAt) };
  }

  return { dayOfWeek, hasExactTime: false, startMinutes: match.availabilityStartMinutes, endMinutes: match.availabilityEndMinutes };
}

/**
 * Finds the first weekly slot compatible with the window: when the match has
 * a confirmed time, the slot must fully cover it; otherwise any overlap with
 * the availability window is enough (see MATCHES/USERS docs for the rule).
 */
function findCompatibleSlot(slots: PlayerAvailability[], window: AvailabilityWindow): PlayerAvailability | null {
  for (const slot of slots) {
    if (slot.dayOfWeek !== window.dayOfWeek) {
      continue;
    }

    if (window.hasExactTime) {
      if (slot.startMinutes <= window.startMinutes && slot.endMinutes >= window.endMinutes) {
        return slot;
      }
      continue;
    }

    const overlaps = slot.startMinutes < window.endMinutes && window.startMinutes < slot.endMinutes;
    if (overlaps) {
      return slot;
    }
  }

  return null;
}

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

type ProfileWithRelations = UserSportProfile & { user: User; availability: PlayerAvailability[] };

function toCandidateDto(profile: ProfileWithRelations, matchingAvailability: string, ratings: RatingsSummaryDto): CandidateDto {
  return {
    id: profile.user.id,
    displayName: displayName(profile.user),
    avatarUrl: profile.user.avatarUrl,
    sportId: profile.sportId,
    positions: profile.positions,
    matchingAvailability,
    ratings,
  };
}

/**
 * Deterministic candidate matching for a match: same sport, available for
 * invitations, not the organizer, not already a participant, not already
 * invited to this same match (any invitation status — re-inviting is
 * blocked by a DB unique constraint regardless), position overlap when the
 * match requires one, and a compatible weekly availability slot. No
 * scoring, no ranking — a plain alphabetical list.
 */
export async function getMatchCandidates(matchId: string): Promise<CandidateDto[]> {
  const match = await requireMatchWithRelations(matchId);

  const excludedUserIds = await getConfirmedParticipantIds(matchId);
  const invitedUserIds = await getInvitedUserIds(matchId);
  invitedUserIds.forEach((userId) => excludedUserIds.add(userId));
  excludedUserIds.add(match.organizerUserId);

  const window = resolveAvailabilityWindow(match);

  const profiles = await prisma.userSportProfile.findMany({
    where: {
      sportId: match.sportModality.sportId,
      isAvailableForInvitations: true,
      userId: { notIn: [...excludedUserIds] },
    },
    include: { user: true, availability: true },
  });

  const requiredPositions = match.positions;

  const matches: Array<{ profile: ProfileWithRelations; matchingAvailability: string }> = [];
  for (const profile of profiles) {
    if (requiredPositions.length > 0 && !profile.positions.some((position) => requiredPositions.includes(position))) {
      continue;
    }

    const slot = findCompatibleSlot(profile.availability, window);
    if (!slot) {
      continue;
    }

    const matchingAvailability = window.hasExactTime
      ? 'Disponible'
      : `Disponible entre ${formatMinutes(slot.startMinutes)} y ${formatMinutes(slot.endMinutes)}`;

    matches.push({ profile, matchingAvailability });
  }

  matches.sort((a, b) => displayName(a.profile.user).localeCompare(displayName(b.profile.user), 'es'));

  // One grouped query for every matched candidate's ratings, never one per
  // candidate — see ratings.service.ts's getRatingsSummaries.
  const ratingsSummaries = await getRatingsSummaries(matches.map(({ profile }) => profile.user.id));

  return matches.map(({ profile, matchingAvailability }) =>
    toCandidateDto(profile, matchingAvailability, ratingsSummaries.get(profile.user.id) ?? emptyRatingsSummary()),
  );
}
