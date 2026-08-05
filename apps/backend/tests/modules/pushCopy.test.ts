import { describe, expect, it } from 'vitest';
import type { PushDestinationDto, PushNotificationPayloadDto } from '@rondo/contracts';
import {
  chatMessagePayload,
  invitationAcceptedPayload,
  invitationReceivedPayload,
  invitationRejectedPayload,
  matchCancelledPayload,
  matchCompletedRatingsEnabledPayload,
  matchFullPayload,
  participantJoinedPayload,
  ratingReceivedPayload,
  type MatchPushContext,
} from '../../src/modules/push/pushCopy.js';

const MATCH_ID = 'match-fixture-1';
const INVITATION_ID = 'invitation-fixture-1';
const MESSAGE_ID = 'message-fixture-1';
const RATING_ID = 'rating-fixture-1';

const ctx: MatchPushContext = {
  matchId: MATCH_ID,
  sportName: 'Fútbol',
  scheduledDate: new Date('2026-08-10T00:00:00.000Z'),
  startsAt: new Date('2026-08-10T22:00:00.000Z'),
  venueName: 'Club Señor Pato',
};

/** Every payload's url must be a same-origin relative path -- never a scheme, host, or protocol-relative "//" that could be interpreted as external by a careless consumer. */
function assertSameOriginRelativeUrl(url: string): void {
  expect(url.startsWith('/')).toBe(true);
  expect(url.startsWith('//')).toBe(false);
  const resolved = new URL(url, 'https://rondo.example');
  expect(resolved.origin).toBe('https://rondo.example');
}

function assertDestination(payload: PushNotificationPayloadDto, destination: PushDestinationDto, openParam: string, extraParams: Record<string, string> = {}): void {
  expect(payload.data?.destination).toBe(destination);
  assertSameOriginRelativeUrl(payload.url);

  const parsed = new URL(payload.url, 'https://rondo.example');
  expect(parsed.pathname).toBe('/');
  expect(parsed.searchParams.get('open')).toBe(openParam);
  for (const [key, value] of Object.entries(extraParams)) {
    expect(parsed.searchParams.get(key)).toBe(value);
  }
}

describe('push payload destinations', () => {
  it('MATCH_INVITATION_RECEIVED -> HOME_INVITATIONS (invitations)', () => {
    const payload = invitationReceivedPayload(ctx, 'Juan', INVITATION_ID);
    assertDestination(payload, 'HOME_INVITATIONS', 'invitations', { invitationId: INVITATION_ID });
    expect(payload.data?.type).toBe('MATCH_INVITATION_RECEIVED');
  });

  it('MATCH_INVITATION_ACCEPTED -> MATCH_PLAYERS (match-players)', () => {
    const payload = invitationAcceptedPayload(ctx, 'Martín', INVITATION_ID);
    assertDestination(payload, 'MATCH_PLAYERS', 'match-players', { matchId: MATCH_ID });
    expect(payload.data?.type).toBe('MATCH_INVITATION_ACCEPTED');
  });

  it('MATCH_PARTICIPANT_JOINED -> MATCH_PLAYERS (match-players)', () => {
    const payload = participantJoinedPayload(ctx, 'Ana', INVITATION_ID);
    assertDestination(payload, 'MATCH_PLAYERS', 'match-players', { matchId: MATCH_ID });
    expect(payload.data?.type).toBe('MATCH_PARTICIPANT_JOINED');
  });

  it('MATCH_INVITATION_REJECTED -> MATCH_PLAYERS (match-players)', () => {
    const payload = invitationRejectedPayload(ctx, 'Luciano', INVITATION_ID);
    assertDestination(payload, 'MATCH_PLAYERS', 'match-players', { matchId: MATCH_ID });
    expect(payload.data?.type).toBe('MATCH_INVITATION_REJECTED');
  });

  it('MATCH_FULL -> MATCH_SUMMARY (match-summary)', () => {
    const payload = matchFullPayload(ctx);
    assertDestination(payload, 'MATCH_SUMMARY', 'match-summary', { matchId: MATCH_ID });
    expect(payload.data?.type).toBe('MATCH_FULL');
  });

  it('MATCH_CANCELLED -> MATCH_SUMMARY (match-summary)', () => {
    const payload = matchCancelledPayload(ctx);
    assertDestination(payload, 'MATCH_SUMMARY', 'match-summary', { matchId: MATCH_ID });
    expect(payload.data?.type).toBe('MATCH_CANCELLED');
  });

  it('MATCH_COMPLETED_RATINGS_ENABLED -> MATCH_RATINGS (match-ratings)', () => {
    const payload = matchCompletedRatingsEnabledPayload(ctx);
    assertDestination(payload, 'MATCH_RATINGS', 'match-ratings', { matchId: MATCH_ID });
    expect(payload.data?.type).toBe('MATCH_COMPLETED_RATINGS_ENABLED');
  });

  it('MATCH_CHAT_MESSAGE -> MATCH_CHAT (match-chat)', () => {
    const payload = chatMessagePayload(ctx, 'Diego', 'Hola equipo!', MESSAGE_ID);
    assertDestination(payload, 'MATCH_CHAT', 'match-chat', { matchId: MATCH_ID });
    expect(payload.data?.type).toBe('MATCH_CHAT_MESSAGE');
  });

  it('RATING_RECEIVED -> MATCH_PLAYERS (match-players): opens the match Jugadores tab, where ratings show inline', () => {
    const payload = ratingReceivedPayload(MATCH_ID, 'Pádel', RATING_ID);
    assertDestination(payload, 'MATCH_PLAYERS', 'match-players', { matchId: MATCH_ID });
    expect(payload.data?.type).toBe('RATING_RECEIVED');
  });

  it('never leaks private data through the destination/url pair', () => {
    const payloads = [
      invitationReceivedPayload(ctx, 'Juan', INVITATION_ID),
      invitationAcceptedPayload(ctx, 'Martín', INVITATION_ID),
      matchCancelledPayload(ctx),
      chatMessagePayload(ctx, 'Diego', 'contenido privado del chat', MESSAGE_ID),
      ratingReceivedPayload(MATCH_ID, 'Pádel', RATING_ID),
    ];
    for (const payload of payloads) {
      expect(payload.url).not.toMatch(/contenido privado/);
      expect(payload.url).not.toMatch(/@/);
    }
  });
});
