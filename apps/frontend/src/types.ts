import type { RateParticipantInputDto, StatusChangedByTypeDto } from '@rondo/contracts';

export type PlayerRating = RateParticipantInputDto;

export type ChatMessage = {
  author: string;
  text: string;
};

export type MatchEntity = {
  id: string;
  sport: string;
  modality: string;
  minPlayers: string;
  maxPlayers: string;
  positions: string[];
  clubName: string | null;
  courtName: string | null;
  date: string;
  time: string | null;
  bookingId: string | null;
  invitedCandidates: string[];
  declinedCandidates: string[];
  participants: string[];
  chatMessages: ChatMessage[];
  ratings: Record<string, PlayerRating>;
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
