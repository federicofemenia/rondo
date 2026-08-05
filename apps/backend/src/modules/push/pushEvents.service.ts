import { Prisma } from '@prisma/client';
import type { PushEventType } from '@prisma/client';
import type { PushNotificationPayloadDto } from '@rondo/contracts';
import { prisma } from '../../infrastructure/database/prisma.js';
import { MatchServiceError } from '../matches/errors.js';
import { sendPushToUser } from './push.service.js';

/** Never throws: NO_PUSH_SUBSCRIPTIONS is the common case (most users on most devices at any given moment) and is not a business error, per docs/WEB_PUSH.md. */
async function sendPushSilently(userId: string, payload: PushNotificationPayloadDto): Promise<void> {
  try {
    await sendPushToUser(userId, payload);
  } catch (error) {
    if (error instanceof MatchServiceError && error.code === 'NO_PUSH_SUBSCRIPTIONS') {
      return;
    }
    if (error instanceof MatchServiceError && error.code === 'PUSH_NOT_CONFIGURED') {
      // Logged once per attempt, not per user -- this is a deploy
      // misconfiguration, not something that scales with recipient count.
      console.warn('[push] skipped: VAPID keys are not configured');
      return;
    }
    // Anything else (an unexpected DB error inside sendPushToUser, etc.)
    // -- log without the payload body/keys, never rethrow: a push failure
    // must never surface as a failure of the business operation that
    // triggered it (invitation, cancellation, chat message...).
    console.error('[push] send failed for a recipient', { userId, code: error instanceof MatchServiceError ? error.code : 'UNKNOWN' });
  }
}

export type RecordAndSendPushEventInput = {
  type: PushEventType;
  /** The match/invitation/message id this event is about -- used for the audit trail (PushEvent.aggregateId), not for dedupe by itself. */
  aggregateId: string;
  /**
   * The actual idempotency guard: unique per *logical* occurrence of this
   * event (see pushEvents.service.ts callers for the exact key shape per
   * event type -- e.g. one FULL transition gets a fresh key derived from
   * its statusChangedAt instant, so a later ORGANIZING -> FULL cycle on the
   * same match can still notify again).
   */
  dedupeKey: string;
  recipientUserIds: string[];
  payload: PushNotificationPayloadDto;
};

/**
 * Records one PushEvent row (the idempotency ledger) and fans the same
 * payload out to every recipient. Never throws under any circumstance --
 * every caller in invitations/matches/chat services can call this
 * fire-and-forget-safe after its own transaction has already committed,
 * per the "never send before the operation is confirmed, never let a push
 * failure revert it" principle in docs/WEB_PUSH.md.
 *
 * Idempotency: `dedupeKey` has a unique DB constraint (see schema.prisma).
 * A duplicate call (retry, double-click, two lazy lifecycle resolutions
 * racing) hits a P2002 on the `create` and returns silently -- exactly one
 * PushEvent row, and one round of sends, per logical event.
 */
export async function recordAndSendPushEvent(input: RecordAndSendPushEventInput): Promise<void> {
  try {
    const uniqueRecipients = [...new Set(input.recipientUserIds)];
    if (uniqueRecipients.length === 0) {
      return;
    }

    let event: { id: string };
    try {
      event = await prisma.pushEvent.create({
        data: {
          type: input.type,
          aggregateId: input.aggregateId,
          dedupeKey: input.dedupeKey,
          payload: input.payload as unknown as Prisma.InputJsonValue,
          attempts: 1,
        },
        select: { id: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        // Already recorded (and already sent, or being sent right now) by
        // a concurrent or retried call -- this is dedupeKey doing its job,
        // not an error.
        return;
      }
      throw error;
    }

    try {
      await Promise.all(uniqueRecipients.map((userId) => sendPushSilently(userId, input.payload)));
      await prisma.pushEvent.update({ where: { id: event.id }, data: { processedAt: new Date() } });
    } catch (error) {
      await prisma.pushEvent.update({ where: { id: event.id }, data: { failedAt: new Date() } });
      throw error;
    }
  } catch (error) {
    console.error('[push] event dispatch failed unexpectedly', {
      type: input.type,
      aggregateId: input.aggregateId,
      message: error instanceof Error ? error.message : 'unknown',
    });
  }
}
