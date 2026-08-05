import { describe, expect, it } from 'vitest';
import type { MatchStatus } from '@prisma/client';
import {
  endOfScheduledDay,
  isRatingsEnabled,
  isRatingsOpen,
  isVisibleOnHome,
  rangeStartAt,
  ratingsCloseAt,
  resolveMatchStatus,
} from '../../src/modules/matches/matchLifecycle.js';

type FakeMatch = {
  status: MatchStatus;
  scheduledDate: Date;
  availabilityStartMinutes: number;
  startsAt: Date | null;
  endsAt: Date | null;
  statusChangedAt: Date;
  minPlayers: number;
};

function fakeMatch(overrides: Partial<FakeMatch> = {}): FakeMatch {
  const now = new Date();
  return {
    status: 'ORGANIZING',
    scheduledDate: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())),
    availabilityStartMinutes: 10 * 60,
    startsAt: new Date(now.getTime() - 3600_000),
    endsAt: new Date(now.getTime() + 3600_000),
    statusChangedAt: now,
    minPlayers: 1,
    ...overrides,
  };
}

describe('resolveMatchStatus', () => {
  it('moves an expired ORGANIZING match below minPlayers to EXPIRED, never to COMPLETED', () => {
    const now = new Date('2026-01-01T12:00:00Z');
    const match = fakeMatch({ status: 'ORGANIZING', endsAt: new Date('2026-01-01T11:00:00Z'), minPlayers: 10 });

    expect(resolveMatchStatus(match, 4, now)).toBe('EXPIRED');
  });

  it('moves an expired ORGANIZING match that already reached minPlayers to COMPLETED, just like FULL', () => {
    const now = new Date('2026-01-01T12:00:00Z');
    const match = fakeMatch({
      status: 'ORGANIZING',
      startsAt: new Date('2026-01-01T09:00:00Z'),
      endsAt: new Date('2026-01-01T11:00:00Z'),
      minPlayers: 10,
    });

    expect(resolveMatchStatus(match, 10, now)).toBe('COMPLETED');
  });

  it('moves an ORGANIZING match that reached minPlayers into IN_PROGRESS once startsAt has passed, even below maxPlayers', () => {
    const now = new Date('2026-01-01T10:30:00Z');
    const match = fakeMatch({
      status: 'ORGANIZING',
      startsAt: new Date('2026-01-01T10:00:00Z'),
      endsAt: new Date('2026-01-01T11:00:00Z'),
      minPlayers: 10,
    });

    expect(resolveMatchStatus(match, 10, now)).toBe('IN_PROGRESS');
  });

  it('keeps an ORGANIZING match that reached minPlayers as ORGANIZING before startsAt', () => {
    const now = new Date('2026-01-01T08:00:00Z');
    const match = fakeMatch({
      status: 'ORGANIZING',
      startsAt: new Date('2026-01-01T10:00:00Z'),
      endsAt: new Date('2026-01-01T11:00:00Z'),
      minPlayers: 10,
    });

    expect(resolveMatchStatus(match, 10, now)).toBe('ORGANIZING');
  });

  it('moves an expired FULL match to COMPLETED', () => {
    const now = new Date('2026-01-01T12:00:00Z');
    const match = fakeMatch({
      status: 'FULL',
      startsAt: new Date('2026-01-01T09:00:00Z'),
      endsAt: new Date('2026-01-01T11:00:00Z'),
    });

    expect(resolveMatchStatus(match, 0, now)).toBe('COMPLETED');
  });

  it('moves a FULL match into IN_PROGRESS once startsAt has passed', () => {
    const now = new Date('2026-01-01T10:30:00Z');
    const match = fakeMatch({
      status: 'FULL',
      startsAt: new Date('2026-01-01T10:00:00Z'),
      endsAt: new Date('2026-01-01T11:00:00Z'),
    });

    expect(resolveMatchStatus(match, 0, now)).toBe('IN_PROGRESS');
  });

  it('moves an expired IN_PROGRESS match to COMPLETED', () => {
    const now = new Date('2026-01-01T12:00:00Z');
    const match = fakeMatch({
      status: 'IN_PROGRESS',
      startsAt: new Date('2026-01-01T09:00:00Z'),
      endsAt: new Date('2026-01-01T11:00:00Z'),
    });

    expect(resolveMatchStatus(match, 0, now)).toBe('COMPLETED');
  });

  it.each<MatchStatus>(['COMPLETED', 'CANCELLED', 'EXPIRED'])('never transitions out of the terminal status %s', (status) => {
    const farFuture = new Date('2099-01-01T00:00:00Z');
    const match = fakeMatch({ status, endsAt: new Date('2020-01-01T00:00:00Z') });

    expect(resolveMatchStatus(match, 0, farFuture)).toBe(status);
  });

  it.each<MatchStatus>(['ORGANIZING', 'FULL'])(
    'never auto-transitions %s to IN_PROGRESS/COMPLETED while startsAt/endsAt are undefined, up until the proposed window starts',
    (status) => {
      // Franja 10:00-18:00 Argentina local on 2026-03-10 -> rangeStartAt is
      // 2026-03-10T13:00:00Z (10:00 -3h). One minute before it, still not expired.
      const scheduledDate = new Date('2026-03-10T00:00:00Z');
      const oneMinuteBeforeWindowStarts = new Date('2026-03-10T12:59:00Z');
      const match = fakeMatch({ status, scheduledDate, availabilityStartMinutes: 10 * 60, startsAt: null, endsAt: null });

      expect(resolveMatchStatus(match, 0, oneMinuteBeforeWindowStarts)).toBe(status);
    },
  );

  it.each<MatchStatus>(['ORGANIZING', 'FULL'])(
    'expires %s the exact instant the proposed window starts, without waiting for it to end',
    (status) => {
      const scheduledDate = new Date('2026-03-10T00:00:00Z');
      const windowStarts = new Date('2026-03-10T13:00:00Z'); // 10:00 Argentina local
      const match = fakeMatch({ status, scheduledDate, availabilityStartMinutes: 10 * 60, startsAt: null, endsAt: null });

      expect(resolveMatchStatus(match, 0, windowStarts)).toBe('EXPIRED');
    },
  );

  it('stays EXPIRED for the rest of the window and past its end -- availabilityEndMinutes never un-expires it', () => {
    const scheduledDate = new Date('2026-03-10T00:00:00Z');
    const match = fakeMatch({ status: 'ORGANIZING', scheduledDate, availabilityStartMinutes: 10 * 60, startsAt: null, endsAt: null });

    // Midday, well inside the proposed 10:00-18:00 window.
    expect(resolveMatchStatus(match, 0, new Date('2026-03-10T15:00:00Z'))).toBe('EXPIRED');
    // Past 18:01 local (21:01Z), i.e. past where the old end-of-window rule used to expire it.
    expect(resolveMatchStatus(match, 0, new Date('2026-03-10T21:01:00Z'))).toBe('EXPIRED');
  });

  it('a later availability window (20:00-23:00) expires at 20:00 local, not 23:00 or midnight', () => {
    const scheduledDate = new Date('2026-03-10T00:00:00Z');
    const match = fakeMatch({ status: 'FULL', scheduledDate, availabilityStartMinutes: 20 * 60, startsAt: null, endsAt: null });

    expect(resolveMatchStatus(match, 0, new Date('2026-03-10T22:59:00Z'))).toBe('FULL'); // 19:59 local
    expect(resolveMatchStatus(match, 0, new Date('2026-03-10T23:00:00Z'))).toBe('EXPIRED'); // 20:00 local
  });

  it('endOfScheduledDay returns midnight UTC of the following day', () => {
    expect(endOfScheduledDay(new Date('2026-03-10T15:30:00Z')).toISOString()).toBe('2026-03-11T00:00:00.000Z');
  });

  it('rangeStartAt converts availabilityStartMinutes to the Argentina-local instant on scheduledDate', () => {
    const scheduledDate = new Date('2026-03-10T00:00:00Z');
    expect(rangeStartAt({ scheduledDate, availabilityStartMinutes: 10 * 60 }).toISOString()).toBe('2026-03-10T13:00:00.000Z');
    expect(rangeStartAt({ scheduledDate, availabilityStartMinutes: 0 }).toISOString()).toBe('2026-03-10T03:00:00.000Z');
  });
});

describe('isVisibleOnHome', () => {
  it.each<MatchStatus>(['ORGANIZING', 'FULL', 'IN_PROGRESS'])('always shows active status %s', (status) => {
    const match = fakeMatch({ status, endsAt: new Date('2000-01-01T00:00:00Z') });

    expect(isVisibleOnHome(match, new Date())).toBe(true);
  });

  it('hides a cancelled match 24 hours after statusChangedAt', () => {
    const now = new Date('2026-01-02T00:00:00Z');
    const recent = fakeMatch({ status: 'CANCELLED', statusChangedAt: new Date('2026-01-01T12:00:00Z') });
    const old = fakeMatch({ status: 'CANCELLED', statusChangedAt: new Date('2025-12-31T00:00:00Z') });

    expect(isVisibleOnHome(recent, now)).toBe(true);
    expect(isVisibleOnHome(old, now)).toBe(false);
  });

  it('hides a completed match 24 hours after endsAt', () => {
    const now = new Date('2026-01-02T00:00:00Z');
    const recent = fakeMatch({ status: 'COMPLETED', endsAt: new Date('2026-01-01T12:00:00Z') });
    const old = fakeMatch({ status: 'COMPLETED', endsAt: new Date('2025-12-31T00:00:00Z') });

    expect(isVisibleOnHome(recent, now)).toBe(true);
    expect(isVisibleOnHome(old, now)).toBe(false);
  });

  it('hides an expired match 24 hours after endsAt', () => {
    const now = new Date('2026-01-02T00:00:00Z');
    const recent = fakeMatch({ status: 'EXPIRED', endsAt: new Date('2026-01-01T12:00:00Z') });
    const old = fakeMatch({ status: 'EXPIRED', endsAt: new Date('2025-12-31T00:00:00Z') });

    expect(isVisibleOnHome(recent, now)).toBe(true);
    expect(isVisibleOnHome(old, now)).toBe(false);
  });
});

describe('ratings window', () => {
  it('is only enabled once the match is COMPLETED', () => {
    expect(isRatingsEnabled(fakeMatch({ status: 'COMPLETED' }))).toBe(true);
    expect(isRatingsEnabled(fakeMatch({ status: 'CANCELLED' }))).toBe(false);
    expect(isRatingsEnabled(fakeMatch({ status: 'EXPIRED' }))).toBe(false);
    expect(isRatingsEnabled(fakeMatch({ status: 'IN_PROGRESS' }))).toBe(false);
  });

  it('closes exactly 7 days after endsAt', () => {
    const endsAt = new Date('2026-01-01T00:00:00.000Z');
    const match = fakeMatch({ status: 'COMPLETED', endsAt });

    expect(ratingsCloseAt(match)!.toISOString()).toBe('2026-01-08T00:00:00.000Z');
    expect(isRatingsOpen(match, new Date('2026-01-07T23:59:59Z'))).toBe(true);
    expect(isRatingsOpen(match, new Date('2026-01-08T00:00:01Z'))).toBe(false);
  });

  it('is never open for a cancelled or expired match regardless of dates', () => {
    const match = fakeMatch({ status: 'CANCELLED', endsAt: new Date('2000-01-01T00:00:00Z') });
    expect(isRatingsOpen(match, new Date())).toBe(false);
  });

  it('returns a null close date and stays closed when endsAt is undefined', () => {
    const match = fakeMatch({ status: 'ORGANIZING', startsAt: null, endsAt: null });
    expect(ratingsCloseAt(match)).toBeNull();
    expect(isRatingsOpen(match, new Date())).toBe(false);
  });
});
