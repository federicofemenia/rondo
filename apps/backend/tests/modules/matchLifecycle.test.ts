import { describe, expect, it } from 'vitest';
import type { MatchStatus } from '@prisma/client';
import {
  isRatingsEnabled,
  isRatingsOpen,
  isVisibleOnHome,
  ratingsCloseAt,
  resolveMatchStatus,
} from '../../src/modules/matches/matchLifecycle.js';

type FakeMatch = {
  status: MatchStatus;
  startsAt: Date | null;
  endsAt: Date | null;
  statusChangedAt: Date;
};

function fakeMatch(overrides: Partial<FakeMatch> = {}): FakeMatch {
  const now = new Date();
  return {
    status: 'ORGANIZING',
    startsAt: new Date(now.getTime() - 3600_000),
    endsAt: new Date(now.getTime() + 3600_000),
    statusChangedAt: now,
    ...overrides,
  };
}

describe('resolveMatchStatus', () => {
  it('moves an expired ORGANIZING match to EXPIRED, never to COMPLETED', () => {
    const now = new Date('2026-01-01T12:00:00Z');
    const match = fakeMatch({ status: 'ORGANIZING', endsAt: new Date('2026-01-01T11:00:00Z') });

    expect(resolveMatchStatus(match, now)).toBe('EXPIRED');
  });

  it('moves an expired FULL match to COMPLETED', () => {
    const now = new Date('2026-01-01T12:00:00Z');
    const match = fakeMatch({
      status: 'FULL',
      startsAt: new Date('2026-01-01T09:00:00Z'),
      endsAt: new Date('2026-01-01T11:00:00Z'),
    });

    expect(resolveMatchStatus(match, now)).toBe('COMPLETED');
  });

  it('moves a FULL match into IN_PROGRESS once startsAt has passed', () => {
    const now = new Date('2026-01-01T10:30:00Z');
    const match = fakeMatch({
      status: 'FULL',
      startsAt: new Date('2026-01-01T10:00:00Z'),
      endsAt: new Date('2026-01-01T11:00:00Z'),
    });

    expect(resolveMatchStatus(match, now)).toBe('IN_PROGRESS');
  });

  it('moves an expired IN_PROGRESS match to COMPLETED', () => {
    const now = new Date('2026-01-01T12:00:00Z');
    const match = fakeMatch({
      status: 'IN_PROGRESS',
      startsAt: new Date('2026-01-01T09:00:00Z'),
      endsAt: new Date('2026-01-01T11:00:00Z'),
    });

    expect(resolveMatchStatus(match, now)).toBe('COMPLETED');
  });

  it.each<MatchStatus>(['COMPLETED', 'CANCELLED', 'EXPIRED'])('never transitions out of the terminal status %s', (status) => {
    const farFuture = new Date('2099-01-01T00:00:00Z');
    const match = fakeMatch({ status, endsAt: new Date('2020-01-01T00:00:00Z') });

    expect(resolveMatchStatus(match, farFuture)).toBe(status);
  });

  it.each<MatchStatus>(['ORGANIZING', 'FULL'])('never auto-transitions %s while startsAt/endsAt are undefined', (status) => {
    const farFuture = new Date('2099-01-01T00:00:00Z');
    const match = fakeMatch({ status, startsAt: null, endsAt: null });

    expect(resolveMatchStatus(match, farFuture)).toBe(status);
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
