/**
 * Deletes every user-generated account and its dependent data (test
 * matches, chat, ratings, invitations, push subscriptions, sessions...),
 * while preserving catalog/admin configuration (Sport, SportModality, Club
 * Señor Pato, Court, OpeningHour, ClubNews). Never run automatically from
 * build/deploy -- this is a manual, explicitly-gated operation.
 *
 * Dry-run (just prints per-table counts) is the DEFAULT. Nothing is ever
 * deleted unless ALL of the following are true:
 *   - ALLOW_DESTRUCTIVE_BETA_RESET=true
 *   - BETA_RESET_CONFIRMATION=DELETE_ALL_RONDO_USER_DATA
 *   - --execute was passed on the command line
 *
 * Usage:
 *   pnpm --filter @rondo/backend beta:reset-user-data                      # dry-run, always safe
 *   ALLOW_DESTRUCTIVE_BETA_RESET=true BETA_RESET_CONFIRMATION=DELETE_ALL_RONDO_USER_DATA \
 *     pnpm --filter @rondo/backend beta:reset-user-data --execute          # actually deletes
 */
import { prisma } from '../database/prisma.js';

export const REQUIRED_CONFIRMATION = 'DELETE_ALL_RONDO_USER_DATA';

/**
 * FK-safe order, derived directly from schema.prisma's relation graph:
 * every model here has a foreign key (directly or transitively) into
 * `users`, and Postgres/Prisma default-restricts deletion while a
 * dependent row still exists (MatchChatMessage.author is explicitly
 * onDelete: Restrict; every other relation below has no onDelete clause at
 * all, which behaves the same way) -- so children must go before parents.
 * PushEvent is deliberately excluded: it has no userId column at all (a
 * global idempotency ledger, not per-user data -- see its own doc comment
 * in schema.prisma, "Never deleted... keep as an audit trail").
 */
const DELETE_STEPS = [
  { table: 'Session', count: () => prisma.session.count(), deleteAll: () => prisma.session.deleteMany() },
  { table: 'PushSubscription', count: () => prisma.pushSubscription.count(), deleteAll: () => prisma.pushSubscription.deleteMany() },
  { table: 'PlayerAvailability', count: () => prisma.playerAvailability.count(), deleteAll: () => prisma.playerAvailability.deleteMany() },
  { table: 'UserSportProfile', count: () => prisma.userSportProfile.count(), deleteAll: () => prisma.userSportProfile.deleteMany() },
  { table: 'PlayerRating', count: () => prisma.playerRating.count(), deleteAll: () => prisma.playerRating.deleteMany() },
  { table: 'MatchChatMessage', count: () => prisma.matchChatMessage.count(), deleteAll: () => prisma.matchChatMessage.deleteMany() },
  { table: 'MatchInvitation', count: () => prisma.matchInvitation.count(), deleteAll: () => prisma.matchInvitation.deleteMany() },
  { table: 'MatchParticipant', count: () => prisma.matchParticipant.count(), deleteAll: () => prisma.matchParticipant.deleteMany() },
  { table: 'Match', count: () => prisma.match.count(), deleteAll: () => prisma.match.deleteMany() },
  { table: 'ClubMembership', count: () => prisma.clubMembership.count(), deleteAll: () => prisma.clubMembership.deleteMany() },
  { table: 'User', count: () => prisma.user.count(), deleteAll: () => prisma.user.deleteMany() },
] as const;

async function printCounts(): Promise<void> {
  console.log('Rows that would be deleted (dry-run):');
  for (const step of DELETE_STEPS) {
    const count = await step.count();
    console.log(`  ${step.table}: ${count}`);
  }
  console.log('\nPreserved (never touched by this script): Sport, SportModality, Club, Court, OpeningHour, ClubNews, PushEvent.');
}

export type ResetOptions = {
  execute: boolean;
  allowDestructiveEnvVar: string | undefined;
  confirmationEnvVar: string | undefined;
};

export type ResetOutcome = { status: 'dry-run' } | { status: 'refused'; reason: string } | { status: 'executed' };

/** Core logic, decoupled from process.argv/process.env so it's directly testable. The CLI entrypoint below wires real process state into this. */
export async function runReset(options: ResetOptions): Promise<ResetOutcome> {
  if (!options.execute) {
    console.log('DRY RUN (default) -- pass --execute to actually delete. Nothing has been modified.\n');
    await printCounts();
    return { status: 'dry-run' };
  }

  if (options.allowDestructiveEnvVar !== 'true') {
    const reason = 'Refusing to execute: ALLOW_DESTRUCTIVE_BETA_RESET must be exactly "true".';
    console.error(reason);
    return { status: 'refused', reason };
  }

  if (options.confirmationEnvVar !== REQUIRED_CONFIRMATION) {
    const reason = `Refusing to execute: BETA_RESET_CONFIRMATION must be exactly "${REQUIRED_CONFIRMATION}".`;
    console.error(reason);
    return { status: 'refused', reason };
  }

  console.log('Counts before deletion:\n');
  await printCounts();

  console.log('\nExecuting -- deleting in FK-safe order inside a transaction...');
  await prisma.$transaction(DELETE_STEPS.map((step) => step.deleteAll()));

  console.log('\nDone. All user-generated data has been deleted. Catalog/admin configuration was preserved.');
  return { status: 'executed' };
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  runReset({
    execute: process.argv.includes('--execute'),
    allowDestructiveEnvVar: process.env.ALLOW_DESTRUCTIVE_BETA_RESET,
    confirmationEnvVar: process.env.BETA_RESET_CONFIRMATION,
  })
    .then((outcome) => {
      if (outcome.status === 'refused') {
        process.exitCode = 1;
      }
    })
    .catch((error) => {
      console.error('beta:reset-user-data failed:', error instanceof Error ? error.message : error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
