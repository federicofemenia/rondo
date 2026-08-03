import { z } from 'zod';

export interface HealthResponse {
  ok: boolean;
  service: string;
  timestamp: string;
}

export interface UserDto {
  id: string;
  username: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string;
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
  sportModalityId: string;
  sportName: string;
  modalityName: string;
  courtName: string | null;
  minPlayers: number;
  maxPlayers: number;
  positions: string[];
  participantsCount: number;
  scheduledDate: string;
  availabilityStartMinutes: number;
  availabilityEndMinutes: number;
  startsAt: string | null;
  endsAt: string | null;
  organizerUserId: string;
  organizerDisplayName: string;
  isOrganizer: boolean;
  createdAt: string;
  statusChangedAt: string;
  statusChangedByType: StatusChangedByTypeDto;
  statusChangedByUser: MatchStatusChangedByDto | null;
  cancellationReason: string | null;
}

const scheduledDatePattern = /^\d{4}-\d{2}-\d{2}$/;

type ScheduleFields = {
  scheduledDate: string;
  availabilityStartMinutes: number;
  availabilityEndMinutes: number;
  startsAt?: string | null;
};

/**
 * Shared business rules for any payload that carries a match schedule
 * (creation and the dedicated schedule-edit endpoint): the day is mandatory,
 * the availability window must be well-formed, and an optional startsAt must
 * fall on the same day and inside that window. Duration-aware validation
 * (startsAt + modality duration must still fit the window) requires a DB
 * lookup and is enforced server-side, not here.
 */
function validateScheduleFields(data: ScheduleFields, ctx: z.RefinementCtx): void {
  if (data.availabilityEndMinutes <= data.availabilityStartMinutes) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'availabilityEndMinutes debe ser mayor a availabilityStartMinutes.',
      path: ['availabilityEndMinutes'],
    });
  }

  const scheduled = new Date(`${data.scheduledDate}T00:00:00.000Z`);
  if (Number.isNaN(scheduled.getTime())) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'scheduledDate no es una fecha válida.', path: ['scheduledDate'] });
    return;
  }

  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  if (scheduled.getTime() < todayUtc.getTime()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'scheduledDate no puede ser una fecha pasada.', path: ['scheduledDate'] });
  }

  if (data.startsAt) {
    const startsAt = new Date(data.startsAt);
    const sameDay =
      startsAt.getUTCFullYear() === scheduled.getUTCFullYear() &&
      startsAt.getUTCMonth() === scheduled.getUTCMonth() &&
      startsAt.getUTCDate() === scheduled.getUTCDate();
    if (!sameDay) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'startsAt debe pertenecer al mismo día que scheduledDate.', path: ['startsAt'] });
    }

    const startMinutes = startsAt.getUTCHours() * 60 + startsAt.getUTCMinutes();
    if (startMinutes < data.availabilityStartMinutes || startMinutes >= data.availabilityEndMinutes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'startsAt debe comenzar dentro de la franja horaria elegida.',
        path: ['startsAt'],
      });
    }
  }
}

export const createMatchInputSchema = z
  .object({
    sportModalityId: z.string().uuid(),
    clubId: z.string().uuid().nullable().optional(),
    minPlayers: z.number().int().min(1),
    maxPlayers: z.number().int().min(1),
    positions: z.array(z.string().trim().min(1)).max(10).optional(),
    scheduledDate: z.string().regex(scheduledDatePattern, 'scheduledDate debe tener el formato YYYY-MM-DD.'),
    availabilityStartMinutes: z.number().int().min(0).max(1439),
    availabilityEndMinutes: z.number().int().min(1).max(1440),
    startsAt: z.string().datetime().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.maxPlayers < data.minPlayers) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'maxPlayers debe ser mayor o igual a minPlayers.', path: ['maxPlayers'] });
    }
    validateScheduleFields(data, ctx);
  });

export type CreateMatchInputDto = z.infer<typeof createMatchInputSchema>;

export const updateMatchScheduleInputSchema = z
  .object({
    scheduledDate: z.string().regex(scheduledDatePattern, 'scheduledDate debe tener el formato YYYY-MM-DD.'),
    availabilityStartMinutes: z.number().int().min(0).max(1439),
    availabilityEndMinutes: z.number().int().min(1).max(1440),
    startsAt: z.string().datetime().nullable().optional(),
  })
  .superRefine(validateScheduleFields);

export type UpdateMatchScheduleInputDto = z.infer<typeof updateMatchScheduleInputSchema>;

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
  closeAt: string | null;
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

// ---------------------------------------------------------------------------
// Sport profiles & weekly availability
// ---------------------------------------------------------------------------

export interface PlayerAvailabilitySlotDto {
  id: string;
  dayOfWeek: number;
  startMinutes: number;
  endMinutes: number;
}

export interface SportProfileDto {
  id: string;
  sportId: string;
  sportName: string;
  positions: string[];
  isAvailableForInvitations: boolean;
  availability: PlayerAvailabilitySlotDto[];
  createdAt: string;
  updatedAt: string;
}

export const upsertSportProfileInputSchema = z
  .object({
    positions: z.array(z.string().trim().min(1)).max(10),
    isAvailableForInvitations: z.boolean(),
  })
  .superRefine((data, ctx) => {
    const seen = new Set<string>();
    data.positions.forEach((position, index) => {
      if (seen.has(position)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'No se permiten posiciones duplicadas.', path: ['positions', index] });
      }
      seen.add(position);
    });
  });

export type UpsertSportProfileInputDto = z.infer<typeof upsertSportProfileInputSchema>;

export const availabilitySlotInputSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startMinutes: z.number().int().min(0).max(1440),
    endMinutes: z.number().int().min(0).max(1440),
  })
  .superRefine((data, ctx) => {
    if (data.endMinutes <= data.startMinutes) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'endMinutes debe ser mayor a startMinutes.', path: ['endMinutes'] });
    }
  });

export type AvailabilitySlotInputDto = z.infer<typeof availabilitySlotInputSchema>;

/**
 * Structural validation for a full weekly-availability replacement: each slot
 * must be well-formed (day 0-6, minutes 0-1440, start < end), no two slots on
 * the same day may be exact duplicates, and no two slots on the same day may
 * overlap. Cross-slot checks run here because they need the whole array at
 * once, unlike the per-slot shape checks above.
 */
export const replaceAvailabilityInputSchema = z
  .object({
    slots: z.array(availabilitySlotInputSchema).max(50),
  })
  .superRefine((data, ctx) => {
    for (let i = 0; i < data.slots.length; i += 1) {
      for (let j = i + 1; j < data.slots.length; j += 1) {
        const a = data.slots[i]!;
        const b = data.slots[j]!;
        if (a.dayOfWeek !== b.dayOfWeek) {
          continue;
        }
        if (a.startMinutes === b.startMinutes && a.endMinutes === b.endMinutes) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'No se permiten franjas duplicadas.', path: ['slots', j] });
          continue;
        }
        const overlaps = a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes;
        if (overlaps) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Las franjas no pueden superponerse.', path: ['slots', j] });
        }
      }
    }
  });

export type ReplaceAvailabilityInputDto = z.infer<typeof replaceAvailabilityInputSchema>;

// ---------------------------------------------------------------------------
// Match candidates (deterministic matching)
// ---------------------------------------------------------------------------

export interface CandidateDto {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  sportId: string;
  positions: string[];
  matchingAvailability: string;
}

// ---------------------------------------------------------------------------
// Match invitations
// ---------------------------------------------------------------------------

export type MatchInvitationStatusDto = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';

export interface MatchInvitationDto {
  id: string;
  matchId: string;
  status: MatchInvitationStatusDto;
  position: string | null;
  invitedUserId: string;
  invitedUserDisplayName: string;
  invitedById: string;
  organizerDisplayName: string;
  sportName: string;
  modalityName: string;
  clubName: string | null;
  scheduledDate: string;
  availabilityStartMinutes: number;
  availabilityEndMinutes: number;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  respondedAt: string | null;
}

export const createInvitationInputSchema = z.object({
  invitedUserId: z.string().uuid(),
  position: z.string().trim().min(1).optional(),
});

export type CreateInvitationInputDto = z.infer<typeof createInvitationInputSchema>;

// ---------------------------------------------------------------------------
// Match roster (participants & invitations, from the organizer's Jugadores tab)
// ---------------------------------------------------------------------------

export interface MatchParticipantSummaryDto {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface MatchPendingInvitationDto {
  invitationId: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  position: string | null;
  createdAt: string;
}

export interface MatchRejectedInvitationDto {
  invitationId: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  respondedAt: string | null;
}

export interface MatchParticipantsResponseDto {
  organizer: MatchParticipantSummaryDto;
  confirmed: MatchParticipantSummaryDto[];
  pending: MatchPendingInvitationDto[];
  rejected: MatchRejectedInvitationDto[];
}

// ---------------------------------------------------------------------------
// Match chat
// ---------------------------------------------------------------------------

export interface MatchChatAuthorDto {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface MatchChatMessageDto {
  id: string;
  content: string;
  createdAt: string;
  isCurrentUser: boolean;
  author: MatchChatAuthorDto;
}

export interface MatchChatResponseDto {
  matchId: string;
  canSend: boolean;
  closed: boolean;
  closesAt: string | null;
  messages: MatchChatMessageDto[];
}

export const sendMatchChatMessageInputSchema = z.object({
  content: z.string().trim().min(1).max(1000),
});

export type SendMatchChatMessageInputDto = z.infer<typeof sendMatchChatMessageInputSchema>;
