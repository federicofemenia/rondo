import type { PushDestinationDto, PushNotificationPayloadDto } from '@rondo/contracts';
import { toArgentinaMinutesOfDay } from '../matches/argentinaTime.js';

// Same Argentina-only, no-DST fixed offset used everywhere else this
// session touches wall-clock time -- see argentinaTime.ts.
const weekdayFormatter = new Intl.DateTimeFormat('es-AR', { weekday: 'long', timeZone: 'UTC' });

function weekdayLabel(scheduledDate: Date): string {
  return weekdayFormatter.format(scheduledDate);
}

function formatArgentinaTime(instant: Date): string {
  const minutes = toArgentinaMinutesOfDay(instant);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/** The minimal, non-sensitive match facts every push payload builder below needs -- never the full Prisma relation graph. */
export type MatchPushContext = {
  matchId: string;
  sportName: string;
  scheduledDate: Date;
  startsAt: Date | null;
  venueName: string | null;
};

/** Structurally typed (not `MatchWithRelations` directly) so this module doesn't need a runtime or type import from matches.service.ts -- any match-with-relations shape already has these fields. */
export function toMatchPushContext(match: {
  id: string;
  scheduledDate: Date;
  startsAt: Date | null;
  club: { name: string } | null;
  customVenueName: string | null;
  sportModality: { sport: { name: string } };
}): MatchPushContext {
  return {
    matchId: match.id,
    sportName: match.sportModality.sport.name,
    scheduledDate: match.scheduledDate,
    startsAt: match.startsAt,
    venueName: match.club?.name ?? match.customVenueName ?? null,
  };
}

const PUSH_PAYLOAD_VERSION = 1;

/**
 * Serializes a typed PushDestinationDto into the `/?open=...` deep-link URL
 * the service worker's notificationclick forwards and the frontend's
 * pushNavigation.ts parses back into the same destination -- see the event
 * -> destination table in docs/WEB_PUSH.md. `open` uses kebab-case (not the
 * DTO's own SCREAMING_CASE) purely so the query string reads naturally.
 */
const DESTINATION_OPEN_PARAM: Record<PushDestinationDto, string> = {
  HOME_INVITATIONS: 'invitations',
  MATCH_SUMMARY: 'match-summary',
  MATCH_PLAYERS: 'match-players',
  MATCH_CHAT: 'match-chat',
  MATCH_RATINGS: 'match-ratings',
};

function buildDestinationUrl(destination: PushDestinationDto, params: Record<string, string> = {}): string {
  const search = new URLSearchParams({ open: DESTINATION_OPEN_PARAM[destination], ...params });
  return `/?${search.toString()}`;
}

function basePayload(
  destination: PushDestinationDto,
  params: Record<string, string>,
  overrides: Omit<PushNotificationPayloadDto, 'version' | 'url' | 'data'> & { data: NonNullable<PushNotificationPayloadDto['data']> },
): PushNotificationPayloadDto {
  return {
    version: PUSH_PAYLOAD_VERSION,
    url: buildDestinationUrl(destination, params),
    ...overrides,
    data: { ...overrides.data, destination },
  };
}

export function invitationReceivedPayload(ctx: MatchPushContext, organizerName: string, invitationId: string): PushNotificationPayloadDto {
  const day = weekdayLabel(ctx.scheduledDate);
  const time = ctx.startsAt ? formatArgentinaTime(ctx.startsAt) : null;

  let body: string;
  if (ctx.venueName && time) {
    body = `${organizerName} te invitó a jugar ${ctx.sportName} el ${day} a las ${time} en ${ctx.venueName}.`;
  } else if (ctx.venueName) {
    body = `${organizerName} te invitó a jugar ${ctx.sportName} el ${day} en ${ctx.venueName}.`;
  } else if (time) {
    body = `${organizerName} te invitó a jugar ${ctx.sportName} el ${day} a las ${time}. Sede a definir.`;
  } else {
    body = `${organizerName} te invitó a jugar ${ctx.sportName} el ${day}. Sede a definir.`;
  }

  return basePayload('HOME_INVITATIONS', { invitationId }, {
    title: 'Nueva invitación',
    body,
    tag: `match-invitation-${invitationId}`,
    data: { type: 'MATCH_INVITATION_RECEIVED', matchId: ctx.matchId, invitationId },
  });
}

export function invitationAcceptedPayload(ctx: MatchPushContext, accepterName: string, invitationId: string): PushNotificationPayloadDto {
  return basePayload('MATCH_PLAYERS', { matchId: ctx.matchId }, {
    title: 'Invitación aceptada',
    body: `${accepterName} aceptó tu invitación para ${ctx.sportName}.`,
    tag: `match-invitation-accepted-${invitationId}`,
    data: { type: 'MATCH_INVITATION_ACCEPTED', matchId: ctx.matchId, invitationId },
  });
}

export function participantJoinedPayload(ctx: MatchPushContext, joinerName: string, invitationId: string): PushNotificationPayloadDto {
  return basePayload('MATCH_PLAYERS', { matchId: ctx.matchId }, {
    title: 'Nuevo jugador confirmado',
    body: `${joinerName} se sumó al partido de ${ctx.sportName}.`,
    tag: `match-participant-joined-${invitationId}`,
    data: { type: 'MATCH_PARTICIPANT_JOINED', matchId: ctx.matchId, invitationId },
  });
}

export function invitationRejectedPayload(ctx: MatchPushContext, rejecterName: string, invitationId: string): PushNotificationPayloadDto {
  return basePayload('MATCH_PLAYERS', { matchId: ctx.matchId }, {
    title: 'Invitación rechazada',
    body: `${rejecterName} rechazó la invitación para ${ctx.sportName}.`,
    tag: `match-invitation-rejected-${invitationId}`,
    data: { type: 'MATCH_INVITATION_REJECTED', matchId: ctx.matchId, invitationId },
  });
}

/** Venue is deliberately left out -- keeps the notification short (see docs/WEB_PUSH.md) rather than trying to cram schedule + venue into one line. */
export function matchCancelledPayload(ctx: MatchPushContext): PushNotificationPayloadDto {
  const day = weekdayLabel(ctx.scheduledDate);
  const time = ctx.startsAt ? ` a las ${formatArgentinaTime(ctx.startsAt)}` : '';

  return basePayload('MATCH_SUMMARY', { matchId: ctx.matchId }, {
    title: 'Partido cancelado',
    body: `El partido de ${ctx.sportName} del ${day}${time} fue cancelado.`,
    tag: `match-cancelled-${ctx.matchId}`,
    data: { type: 'MATCH_CANCELLED', matchId: ctx.matchId },
  });
}

export function matchFullPayload(ctx: MatchPushContext): PushNotificationPayloadDto {
  return basePayload('MATCH_SUMMARY', { matchId: ctx.matchId }, {
    title: 'Equipo completo',
    body: `El partido de ${ctx.sportName} ya completó todos sus lugares.`,
    tag: `match-full-${ctx.matchId}`,
    data: { type: 'MATCH_FULL', matchId: ctx.matchId },
  });
}

export function matchCompletedRatingsEnabledPayload(ctx: MatchPushContext): PushNotificationPayloadDto {
  return basePayload('MATCH_RATINGS', { matchId: ctx.matchId }, {
    title: 'Valoraciones habilitadas',
    body: 'El partido terminó. Ya podés valorar a los demás jugadores.',
    tag: `match-ratings-${ctx.matchId}`,
    data: { type: 'MATCH_COMPLETED_RATINGS_ENABLED', matchId: ctx.matchId },
  });
}

const CHAT_PREVIEW_MAX_LENGTH = 100;

/** Trims, collapses newlines/whitespace to a single line, and truncates with "…" -- never interprets the content as HTML. */
export function truncateChatPreview(content: string): string {
  const singleLine = content.trim().replace(/\s+/g, ' ');
  if (singleLine.length <= CHAT_PREVIEW_MAX_LENGTH) {
    return singleLine;
  }
  return `${singleLine.slice(0, CHAT_PREVIEW_MAX_LENGTH)}…`;
}

/** Same tag for every message in a given match on purpose -- see docs/WEB_PUSH.md for the observed grouping/replace behavior this produces. */
export function chatMessagePayload(ctx: MatchPushContext, authorName: string, content: string, messageId: string): PushNotificationPayloadDto {
  return basePayload('MATCH_CHAT', { matchId: ctx.matchId }, {
    title: `${authorName} · ${ctx.sportName}`,
    body: truncateChatPreview(content),
    tag: `match-chat-${ctx.matchId}`,
    data: { type: 'MATCH_CHAT_MESSAGE', matchId: ctx.matchId, messageId },
  });
}

/**
 * Deliberately excludes the score, the comment, and the rater's identity --
 * those stay inside Rondo (see docs/WEB_PUSH.md). `sportName` alone is
 * enough context to be useful without leaking anything the rated player
 * couldn't already infer (which sport they just played). Opens the match's
 * own Jugadores tab -- ratings for every confirmed participant show inline
 * there (see MatchPlayersPage.tsx), the same way Candidatos already does,
 * so there is no separate "my ratings" screen to send this to.
 */
export function ratingReceivedPayload(matchId: string, sportName: string, ratingId: string): PushNotificationPayloadDto {
  return basePayload('MATCH_PLAYERS', { matchId }, {
    title: 'Nueva valoración',
    body: `Recibiste una nueva valoración en ${sportName}.`,
    tag: `rating-received-${ratingId}`,
    data: { type: 'RATING_RECEIVED', matchId, ratingId },
  });
}
