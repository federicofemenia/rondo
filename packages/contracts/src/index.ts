import { z } from 'zod';

export interface HealthResponse {
  ok: boolean;
  service: string;
  timestamp: string;
}

export type UserSexDto = 'MALE' | 'FEMALE';

export interface UserDto {
  id: string;
  username: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string;
  avatarUrl: string | null;
  sex: UserSexDto | null;
  biography: string | null;
  createdAt: string;
  updatedAt: string;
}

const userSexSchema = z.enum(['MALE', 'FEMALE']);

const MAX_BIOGRAPHY_LENGTH = 300;

/**
 * PUT semantics: both fields are always required, null clears them. The
 * user resource itself is always the authenticated caller (never taken from
 * this body) -- see users.controller.ts's requireAuth-scoped handler.
 */
export const updateProfileInputSchema = z.object({
  sex: userSexSchema.nullable(),
  biography: z.string().trim().max(MAX_BIOGRAPHY_LENGTH).nullable(),
});

export type UpdateProfileInputDto = z.infer<typeof updateProfileInputSchema>;

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
  durationMinutes: number;
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

export type MatchVenueTypeDto = 'CLUB' | 'TO_BE_DEFINED' | 'CUSTOM';

export interface MatchSummaryDto {
  id: string;
  status: MatchStatusDto;
  clubId: string | null;
  /** Resolved display name for the venue: the club's name, the custom venue name, or null when still TO_BE_DEFINED. */
  clubName: string | null;
  venueType: MatchVenueTypeDto;
  customVenueName: string | null;
  sportId: string;
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
  durationMinutes: number;
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

// Rondo only operates in Argentina, which stays at UTC-3 year-round (no
// DST) -- startsAt travels the wire as a real UTC instant, but scheduledDate
// and availabilityStart/EndMinutes are always Argentina wall-clock
// concepts, so startsAt must be converted before comparing against them.
const ARGENTINA_UTC_OFFSET_MINUTES = 180;

function toArgentinaWallClock(date: Date): Date {
  return new Date(date.getTime() - ARGENTINA_UTC_OFFSET_MINUTES * 60_000);
}

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
    const startsAtLocal = toArgentinaWallClock(new Date(data.startsAt));
    const sameDay =
      startsAtLocal.getUTCFullYear() === scheduled.getUTCFullYear() &&
      startsAtLocal.getUTCMonth() === scheduled.getUTCMonth() &&
      startsAtLocal.getUTCDate() === scheduled.getUTCDate();
    if (!sameDay) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'startsAt debe pertenecer al mismo día que scheduledDate.', path: ['startsAt'] });
    }

    const startMinutes = startsAtLocal.getUTCHours() * 60 + startsAtLocal.getUTCMinutes();
    if (startMinutes < data.availabilityStartMinutes || startMinutes >= data.availabilityEndMinutes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'startsAt debe comenzar dentro de la franja horaria elegida.',
        path: ['startsAt'],
      });
    }
  }
}

const matchVenueTypeSchema = z.enum(['CLUB', 'TO_BE_DEFINED', 'CUSTOM']);

const MAX_CUSTOM_VENUE_NAME_LENGTH = 120;

/**
 * A match's venue is exactly one of: a real club (clubId required,
 * customVenueName must be absent), still undecided (neither field set), or a
 * free-text venue (customVenueName required and trimmed, no clubId). Mixing
 * fields from different venue types is rejected here rather than silently
 * ignored, so the persisted match can never end up in an inconsistent state.
 */
function validateVenueFields(
  data: { venueType: MatchVenueTypeDto; clubId?: string | null; customVenueName?: string | null },
  ctx: z.RefinementCtx,
): void {
  if (data.venueType === 'CLUB') {
    if (!data.clubId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'clubId es obligatorio cuando venueType es CLUB.', path: ['clubId'] });
    }
    if (data.customVenueName) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'customVenueName no debe enviarse cuando venueType es CLUB.', path: ['customVenueName'] });
    }
  } else if (data.venueType === 'TO_BE_DEFINED') {
    if (data.clubId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'clubId no debe enviarse cuando venueType es TO_BE_DEFINED.', path: ['clubId'] });
    }
    if (data.customVenueName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'customVenueName no debe enviarse cuando venueType es TO_BE_DEFINED.',
        path: ['customVenueName'],
      });
    }
  } else {
    if (data.clubId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'clubId no debe enviarse cuando venueType es CUSTOM.', path: ['clubId'] });
    }
    if (!data.customVenueName || !data.customVenueName.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'customVenueName es obligatorio cuando venueType es CUSTOM.', path: ['customVenueName'] });
    }
  }
}

export const createMatchInputSchema = z
  .object({
    sportModalityId: z.string().uuid(),
    venueType: matchVenueTypeSchema,
    clubId: z.string().uuid().nullable().optional(),
    customVenueName: z.string().trim().min(1).max(MAX_CUSTOM_VENUE_NAME_LENGTH).nullable().optional(),
    minPlayers: z.number().int().min(1),
    maxPlayers: z.number().int().min(1),
    positions: z.array(z.string().trim().min(1)).max(10).optional(),
    scheduledDate: z.string().regex(scheduledDatePattern, 'scheduledDate debe tener el formato YYYY-MM-DD.'),
    availabilityStartMinutes: z.number().int().min(0).max(1439),
    availabilityEndMinutes: z.number().int().min(1).max(1440),
    durationMinutes: z.number().int().min(15).max(600),
    startsAt: z.string().datetime().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.maxPlayers < data.minPlayers) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'maxPlayers debe ser mayor o igual a minPlayers.', path: ['maxPlayers'] });
    }
    validateVenueFields(data, ctx);
    validateScheduleFields(data, ctx);
  });

export type CreateMatchInputDto = z.infer<typeof createMatchInputSchema>;

export const updateMatchScheduleInputSchema = z
  .object({
    venueType: matchVenueTypeSchema,
    clubId: z.string().uuid().nullable().optional(),
    customVenueName: z.string().trim().min(1).max(MAX_CUSTOM_VENUE_NAME_LENGTH).nullable().optional(),
    scheduledDate: z.string().regex(scheduledDatePattern, 'scheduledDate debe tener el formato YYYY-MM-DD.'),
    availabilityStartMinutes: z.number().int().min(0).max(1439),
    availabilityEndMinutes: z.number().int().min(1).max(1440),
    durationMinutes: z.number().int().min(15).max(600),
    startsAt: z.string().datetime().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    validateVenueFields(data, ctx);
    validateScheduleFields(data, ctx);
  });

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

/**
 * Aggregated across every match a user has been rated in *for one sport*
 * (never scoped to a single match, unlike RatingDto above, but always
 * scoped to a sport -- a padel reputation says nothing about how someone
 * plays football, so the two are never mixed into one average). Averages
 * are null — not 0 — when count is 0, so the frontend can render "Sin
 * valoraciones en <deporte>" instead of a misleading zero-star average.
 */
export interface RatingsSummaryDto {
  sportId: string;
  sportName: string;
  gameplayAverage: number | null;
  conductAverage: number | null;
  count: number;
  /** How many of those ratings have actual written text -- same "has real text" rule as GET .../rating-comments (not null, not empty after trim). */
  commentsCount: number;
}

/** Query param shared by GET .../public-profile and GET .../rating-comments -- both require the caller's sport context so ratings are never returned mixed across sports. */
export const sportIdQuerySchema = z.object({
  sportId: z.string().uuid(),
});

export type SportIdQueryDto = z.infer<typeof sportIdQuerySchema>;

export interface RatingCommentDto {
  id: string;
  authorDisplayName: string;
  gameplayScore: number;
  conductScore: number;
  comment: string;
  sportName: string;
  modalityName: string;
  createdAt: string;
}

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
  ratings: RatingsSummaryDto;
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
  /** Scoped to the match's own sport, same aggregation as CandidateDto.ratings -- lets the Jugadores tab show stars/comments inline, the same way Candidatos does, without a separate per-player request. */
  ratings: RatingsSummaryDto;
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

// ---------------------------------------------------------------------------
// Public player profile
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/users/:id/public-profile. Deliberately excludes email,
 * username, clerkUserId, club memberships and anything else private --
 * this is what any authenticated user can see about another player, shown
 * on the player card opened from a candidate. Biography and comments are
 * never bundled into CandidateDto itself; both are fetched on demand only
 * once this endpoint (or rating-comments below) is actually requested.
 */
export interface PublicProfileDto {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  sex: UserSexDto | null;
  biography: string | null;
  positions: string[];
  ratings: RatingsSummaryDto;
}

// ---------------------------------------------------------------------------
// Web Push subscriptions
// ---------------------------------------------------------------------------

/**
 * Body of POST /api/v1/me/push-subscriptions -- the raw shape the browser's
 * PushManager.subscribe() resolves to (PushSubscriptionJSON), narrowed to
 * the fields the backend actually persists. userId is never part of this
 * body: it always comes from the authenticated caller.
 */
export const pushSubscriptionInputSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export type PushSubscriptionInputDto = z.infer<typeof pushSubscriptionInputSchema>;

/** One row of GET .../push-subscriptions -- never includes p256dh/auth, the backend never needs to hand those back to the client. */
export interface PushSubscriptionSummaryDto {
  id: string;
  endpoint: string;
  createdAt: string;
  userAgent: string | null;
}

export interface PushSubscriptionStatusDto {
  enabled: boolean;
  subscriptions: PushSubscriptionSummaryDto[];
}

/** DELETE /api/v1/me/push-subscriptions body: the endpoint identifies which of the caller's own subscriptions to remove. */
export const deletePushSubscriptionInputSchema = z.object({
  endpoint: z.string().url(),
});

export type DeletePushSubscriptionInputDto = z.infer<typeof deletePushSubscriptionInputSchema>;

/** POST .../push-subscriptions/test result: how many of the caller's subscriptions actually received the test push. */
export interface TestPushResponseDto {
  sent: number;
  removed: number;
}

/**
 * Every domain event that can trigger a push notification (see
 * apps/backend/src/modules/push/pushEvents.service.ts and docs/WEB_PUSH.md).
 * Mirrors the Prisma `PushEventType` enum -- kept as a plain string union
 * here (not generated from Prisma) since contracts has no Prisma
 * dependency, same as every other DTO in this package.
 */
export type PushEventType =
  | 'MATCH_INVITATION_RECEIVED'
  | 'MATCH_INVITATION_ACCEPTED'
  | 'MATCH_INVITATION_REJECTED'
  | 'MATCH_PARTICIPANT_JOINED'
  | 'MATCH_FULL'
  | 'MATCH_CANCELLED'
  | 'MATCH_COMPLETED_RATINGS_ENABLED'
  | 'MATCH_CHAT_MESSAGE'
  | 'RATING_RECEIVED';

/**
 * Typed in-app destination for a push notification, one per PushEventType
 * (see the event -> destination table in docs/WEB_PUSH.md). `url` on
 * PushNotificationPayloadDto is the serialized, service-worker-facing form
 * of this same destination (see apps/frontend/src/pushNavigation.ts for the
 * parser) -- `destination` is kept alongside it as the typed source of
 * truth so nothing on either side has to re-derive it from a free-form
 * string.
 */
export type PushDestinationDto = 'HOME_INVITATIONS' | 'MATCH_SUMMARY' | 'MATCH_PLAYERS' | 'MATCH_CHAT' | 'MATCH_RATINGS';

/**
 * Shape of the JSON payload the backend sends as the push message body, and
 * that the service worker's `push` handler expects to parse (see
 * apps/frontend/src/sw.ts). Not sent over HTTP as a Rondo API response --
 * documented here as the one shared source of truth for both sides anyway,
 * same as every other cross-module contract in this package.
 *
 * `version` is forward-compatible bookkeeping only -- nothing branches on
 * it yet, it just lets a future payload shape change identify itself.
 * `data` deliberately excludes anything private (email, username,
 * biography, comment text, tokens) -- see docs/WEB_PUSH.md.
 */
export interface PushNotificationPayloadDto {
  version?: number;
  title: string;
  body: string;
  url: string;
  tag?: string;
  icon?: string;
  badge?: string;
  data?: {
    type?: PushEventType | string;
    matchId?: string;
    invitationId?: string;
    messageId?: string;
    ratingId?: string;
    destination?: PushDestinationDto;
  };
}

// ---------------------------------------------------------------------------
// Club administration
// ---------------------------------------------------------------------------

/** Global platform role (User.role) -- orthogonal to ClubMembershipRoleDto, which is per-club. Never conflate the two (see docs in schema.prisma). */
export type UserRoleDto = 'USER' | 'SUPERADMIN';

/**
 * One row of GET /api/v1/admin/clubs -- every club the *authenticated*
 * user can manage (all of them for a SUPERADMIN, only their own for a
 * CLUB_ADMIN). `myRole` is this actor's access level for *this* club
 * specifically, not their global role -- a SUPERADMIN who also happens to
 * hold a CLUB_ADMIN membership somewhere still sees 'SUPERADMIN' here,
 * since that's the more powerful access level actually in effect.
 */
export interface AdminClubSummaryDto {
  id: string;
  name: string;
  city: string | null;
  isActive: boolean;
  courtsCount: number;
  myRole: 'SUPERADMIN' | 'CLUB_ADMIN';
}

export interface AdminClubDetailDto {
  id: string;
  name: string;
  description: string | null;
  city: string | null;
  address: string | null;
  isActive: boolean;
  activeCourtsCount: number;
  activeAdminsCount: number;
  myRole: 'SUPERADMIN' | 'CLUB_ADMIN';
}

const clubTextFieldSchema = z.string().trim().max(500).nullable().optional();

export const createClubInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: clubTextFieldSchema,
  city: z.string().trim().max(120).nullable().optional(),
  address: z.string().trim().max(200).nullable().optional(),
});

export type CreateClubInputDto = z.infer<typeof createClubInputSchema>;

/**
 * Same shape for both actors -- SUPERADMIN and CLUB_ADMIN alike send
 * whichever subset of fields they're editing. The backend is the actual
 * authority on which fields a given role may change (name/isActive are
 * SUPERADMIN-only; see adminClubs.service.ts) -- this schema only validates
 * shape, not who's allowed to send what.
 */
export const updateClubInputSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: clubTextFieldSchema,
  city: z.string().trim().max(120).nullable().optional(),
  address: z.string().trim().max(200).nullable().optional(),
  isActive: z.boolean().optional(),
});

export type UpdateClubInputDto = z.infer<typeof updateClubInputSchema>;

/** GET /api/v1/admin/users/search result row -- deliberately excludes email/clerkUserId/any private field, same as CandidateDto elsewhere. */
export interface AdminUserSearchResultDto {
  id: string;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
}

/** One row of GET /api/v1/admin/clubs/:clubId/admins -- always an ACTIVE CLUB_ADMIN membership (a degraded/removed admin simply stops appearing here, see adminClubAdmins.service.ts). */
export interface ClubAdminUserDto {
  id: string;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
}

export const assignClubAdminInputSchema = z.object({
  userId: z.string().uuid(),
});

export type AssignClubAdminInputDto = z.infer<typeof assignClubAdminInputSchema>;

export interface CourtAdminDto {
  id: string;
  name: string;
  sportModalityId: string;
  sportName: string;
  modalityName: string;
  description: string | null;
  isActive: boolean;
}

export const createCourtInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  sportModalityId: z.string().uuid(),
  description: z.string().trim().max(300).nullable().optional(),
});

export type CreateCourtInputDto = z.infer<typeof createCourtInputSchema>;

export const updateCourtInputSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  sportModalityId: z.string().uuid().optional(),
  description: z.string().trim().max(300).nullable().optional(),
  isActive: z.boolean().optional(),
});

export type UpdateCourtInputDto = z.infer<typeof updateCourtInputSchema>;
