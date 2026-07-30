import type { MatchSummaryDto } from '@rondo/contracts';
import { formatTimeRange } from './TimeRangeInput';
import type { MatchEntity } from './types';

/**
 * Converts a backend MatchSummaryDto into the local MatchEntity shape.
 * Fields with no backend equivalent yet (invitations, chat, booking link)
 * are carried over from the previous local entity, if any, since those
 * flows are still frontend-only mocks in this slice.
 */
export function matchSummaryToEntity(dto: MatchSummaryDto, previous?: MatchEntity): MatchEntity {
  const start = dto.startsAt ? new Date(dto.startsAt) : null;
  const end = dto.endsAt ? new Date(dto.endsAt) : null;

  return {
    id: dto.id,
    status: dto.status,
    sport: dto.sportName,
    modality: dto.modalityName,
    sportModalityId: dto.sportModalityId,
    minPlayers: String(dto.minPlayers),
    maxPlayers: String(dto.maxPlayers),
    positions: dto.positions,
    participantsCount: dto.participantsCount,
    clubId: dto.clubId,
    clubName: dto.clubName,
    courtName: dto.courtName,
    date: start ? dto.startsAt!.slice(0, 10) : '',
    time: start && end ? formatTimeRange([start.getHours(), end.getHours()]) : null,
    startsAt: dto.startsAt,
    endsAt: dto.endsAt,
    organizerUserId: dto.organizerUserId,
    isOrganizer: dto.isOrganizer,
    bookingId: previous?.bookingId ?? null,
    invitedCandidates: previous?.invitedCandidates ?? [],
    declinedCandidates: previous?.declinedCandidates ?? [],
    participants: previous?.participants ?? [],
    chatMessages: previous?.chatMessages ?? [],
    createdAt: Date.parse(dto.createdAt),
    cancelledAt: dto.status === 'CANCELLED' ? dto.statusChangedAt : null,
    cancelledByType: dto.status === 'CANCELLED' ? dto.statusChangedByType : null,
    cancelledByName: dto.statusChangedByUser?.displayName ?? null,
    cancellationReason: dto.cancellationReason,
  };
}
