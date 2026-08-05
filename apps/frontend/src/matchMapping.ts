import type { MatchSummaryDto } from '@rondo/contracts';
import type { MatchEntity } from './types';

/**
 * Converts a backend MatchSummaryDto into the local MatchEntity shape.
 * Fields with no backend equivalent yet (booking link) are carried over from
 * the previous local entity, if any, since that flow is still a
 * frontend-only mock in this slice.
 */
export function matchSummaryToEntity(dto: MatchSummaryDto, previous?: MatchEntity): MatchEntity {
  return {
    id: dto.id,
    status: dto.status,
    sportId: dto.sportId,
    sport: dto.sportName,
    modality: dto.modalityName,
    sportModalityId: dto.sportModalityId,
    minPlayers: String(dto.minPlayers),
    maxPlayers: String(dto.maxPlayers),
    positions: dto.positions,
    participantsCount: dto.participantsCount,
    clubId: dto.clubId,
    clubName: dto.clubName,
    venueType: dto.venueType,
    customVenueName: dto.customVenueName,
    courtName: dto.courtName,
    scheduledDate: dto.scheduledDate,
    availabilityStartMinutes: dto.availabilityStartMinutes,
    availabilityEndMinutes: dto.availabilityEndMinutes,
    durationMinutes: dto.durationMinutes,
    startsAt: dto.startsAt,
    endsAt: dto.endsAt,
    organizerUserId: dto.organizerUserId,
    isOrganizer: dto.isOrganizer,
    bookingId: previous?.bookingId ?? null,
    createdAt: Date.parse(dto.createdAt),
    cancelledAt: dto.status === 'CANCELLED' ? dto.statusChangedAt : null,
    cancelledByType: dto.status === 'CANCELLED' ? dto.statusChangedByType : null,
    cancelledByName: dto.statusChangedByUser?.displayName ?? null,
    cancellationReason: dto.cancellationReason,
  };
}
