import type { MatchStatusDto, RateParticipantInputDto, StatusChangedByTypeDto } from '@rondo/contracts';

export type PlayerRating = RateParticipantInputDto;

export type ChatMessage = {
  author: string;
  text: string;
};

export type MatchEntity = {
  id: string;
  status: MatchStatusDto;
  sport: string;
  modality: string;
  sportModalityId: string;
  minPlayers: string;
  maxPlayers: string;
  positions: string[];
  participantsCount: number;
  clubId: string | null;
  clubName: string | null;
  courtName: string | null;
  date: string;
  time: string | null;
  startsAt: string | null;
  endsAt: string | null;
  organizerUserId: string;
  isOrganizer: boolean;
  bookingId: string | null;
  invitedCandidates: string[];
  declinedCandidates: string[];
  participants: string[];
  chatMessages: ChatMessage[];
  createdAt: number;
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
