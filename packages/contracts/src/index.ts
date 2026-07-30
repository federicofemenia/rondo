import { z } from 'zod';

export interface HealthResponse {
  ok: boolean;
  service: string;
  timestamp: string;
}

export interface UserDto {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ClubMembershipRoleDto = 'MEMBER' | 'CLUB_ADMIN';
export type ClubMembershipStatusDto = 'ACTIVE' | 'INACTIVE';

export interface UserClubDto {
  id: string;
  code: string;
  name: string;
  role: ClubMembershipRoleDto;
  status: ClubMembershipStatusDto;
  isFavorite: boolean;
}

export interface SportModalityDto {
  id: string;
  code: string;
  name: string;
  playersCount: number;
  displayOrder: number;
}

export interface SportDto {
  id: string;
  code: string;
  name: string;
  displayOrder: number;
  modalities: SportModalityDto[];
}

// ---------------------------------------------------------------------------
// Match lifecycle
// ---------------------------------------------------------------------------

export type MatchStatusDto = 'ORGANIZING' | 'FULL' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';

export type StatusChangedByTypeDto = 'USER' | 'SYSTEM';

export interface MatchStatusChangedByDto {
  id: string;
  displayName: string;
}

export interface MatchSummaryDto {
  id: string;
  status: MatchStatusDto;
  clubId: string | null;
  clubName: string | null;
  sportName: string;
  modalityName: string;
  courtName: string | null;
  minPlayers: number;
  maxPlayers: number;
  participantsCount: number;
  startsAt: string;
  endsAt: string;
  organizerUserId: string;
  organizerDisplayName: string;
  isOrganizer: boolean;
  statusChangedAt: string;
  statusChangedByType: StatusChangedByTypeDto;
  statusChangedByUser: MatchStatusChangedByDto | null;
  cancellationReason: string | null;
}

// ---------------------------------------------------------------------------
// Ratings
// ---------------------------------------------------------------------------

export type RatingParticipantStatusDto = 'SELF' | 'PENDING' | 'COMPLETED';

export interface RatingDto {
  id: string;
  gameplayScore: number;
  conductScore: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RatingsParticipantDto {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  isCurrentUser: boolean;
  status: RatingParticipantStatusDto;
  rating: RatingDto | null;
}

export interface MatchRatingsResponseDto {
  matchId: string;
  enabled: boolean;
  closed: boolean;
  closeAt: string;
  pendingCount: number;
  participants: RatingsParticipantDto[];
}

export const rateParticipantInputSchema = z.object({
  gameplayScore: z.number().int().min(1).max(5),
  conductScore: z.number().int().min(1).max(5),
  comment: z.string().trim().max(300).optional(),
});

export type RateParticipantInputDto = z.infer<typeof rateParticipantInputSchema>;

// ---------------------------------------------------------------------------
// Pending tasks
// ---------------------------------------------------------------------------

export interface MatchRatingsPendingTaskDto {
  type: 'MATCH_RATINGS';
  matchId: string;
  title: string;
  description: string;
  pendingCount: number;
  targetTab: 'ratings';
}

export type PendingTaskDto = MatchRatingsPendingTaskDto;
