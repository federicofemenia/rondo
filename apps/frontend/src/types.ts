import type { MatchStatusDto, MatchVenueTypeDto, RateParticipantInputDto, StatusChangedByTypeDto } from '@rondo/contracts';

export type PlayerRating = RateParticipantInputDto;

export type PendingAction = {
  id: string;
  label: string;
  description?: string;
  onClick: () => void;
};

export type MatchEntity = {
  id: string;
  status: MatchStatusDto;
  sportId: string;
  sport: string;
  modality: string;
  sportModalityId: string;
  minPlayers: string;
  maxPlayers: string;
  positions: string[];
  participantsCount: number;
  clubId: string | null;
  clubName: string | null;
  venueType: MatchVenueTypeDto;
  customVenueName: string | null;
  courtName: string | null;
  scheduledDate: string;
  availabilityStartMinutes: number;
  availabilityEndMinutes: number;
  durationMinutes: number;
  startsAt: string | null;
  endsAt: string | null;
  organizerUserId: string;
  isOrganizer: boolean;
  bookingId: string | null;
  createdAt: number;
  /** When `status` last changed, regardless of what it changed to -- used to compute the "recently completed" (last 24h) window on Home, separately from `cancelledAt` below (which is specifically null unless status is CANCELLED). */
  statusChangedAt: string;
  cancelledAt: string | null;
  cancelledByType: StatusChangedByTypeDto | null;
  cancelledByName: string | null;
  cancellationReason: string | null;
};

export type BookingEntity = {
  id: string;
  clubName: string;
  courtName: string;
  courtSubtitle: string;
  dateLabel: string;
  time: string;
  matchId: string | null;
  createdAt: number;
};
