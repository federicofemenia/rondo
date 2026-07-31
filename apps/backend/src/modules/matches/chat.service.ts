import type { MatchChatMessageDto, MatchChatResponseDto, SendMatchChatMessageInputDto } from '@rondo/contracts';
import { prisma } from '../../infrastructure/database/prisma.js';
import { canSendMatchChatMessage, matchChatClosesAt } from './matchLifecycle.js';
import { displayName, requireMatchWithRelations } from './matches.service.js';
import { MatchServiceError } from './errors.js';

const MESSAGE_LIST_LIMIT = 100;

type ChatMessageRow = {
  id: string;
  content: string;
  createdAt: Date;
  authorId: string;
  author: { id: string; firstName: string | null; lastName: string | null; email: string; avatarUrl: string | null };
};

function toMessageDto(row: ChatMessageRow, currentUserId: string): MatchChatMessageDto {
  return {
    id: row.id,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    isCurrentUser: row.authorId === currentUserId,
    author: { id: row.author.id, displayName: displayName(row.author), avatarUrl: row.author.avatarUrl },
  };
}

/**
 * Reusable access check for the match chat: only the organizer or a
 * currently-confirmed participant can read or write. Deliberately a light
 * query (not the full match-with-relations include) since it runs on every
 * chat request, including each poll tick.
 */
export async function canAccessMatchChat(matchId: string, userId: string): Promise<boolean> {
  const match = await prisma.match.findUnique({ where: { id: matchId }, select: { organizerUserId: true } });
  if (!match) {
    throw new MatchServiceError(404, 'MATCH_NOT_FOUND', 'El partido no existe.');
  }
  if (match.organizerUserId === userId) {
    return true;
  }
  const participant = await prisma.matchParticipant.findUnique({ where: { matchId_userId: { matchId, userId } } });
  return participant !== null;
}

async function requireChatAccess(matchId: string, userId: string): Promise<void> {
  const hasAccess = await canAccessMatchChat(matchId, userId);
  if (!hasAccess) {
    throw new MatchServiceError(403, 'CHAT_ACCESS_DENIED', 'No tenés acceso al chat de este partido.');
  }
}

export async function listChatMessages(matchId: string, currentUserId: string, now: Date = new Date()): Promise<MatchChatResponseDto> {
  await requireChatAccess(matchId, currentUserId);
  const match = await requireMatchWithRelations(matchId, now);
  const canSend = canSendMatchChatMessage(match, now);

  const latestFirst = await prisma.matchChatMessage.findMany({
    where: { matchId },
    include: { author: true },
    orderBy: { createdAt: 'desc' },
    take: MESSAGE_LIST_LIMIT,
  });

  return {
    matchId,
    canSend,
    closed: !canSend,
    closesAt: matchChatClosesAt(match)?.toISOString() ?? null,
    messages: latestFirst.reverse().map((row) => toMessageDto(row, currentUserId)),
  };
}

export async function sendChatMessage(
  matchId: string,
  authorId: string,
  input: SendMatchChatMessageInputDto,
  now: Date = new Date(),
): Promise<MatchChatMessageDto> {
  await requireChatAccess(matchId, authorId);
  const match = await requireMatchWithRelations(matchId, now);

  if (!canSendMatchChatMessage(match, now)) {
    throw new MatchServiceError(422, 'CHAT_CLOSED', 'El chat de este partido está cerrado.');
  }

  const created = await prisma.matchChatMessage.create({
    data: { matchId, authorId, content: input.content },
    include: { author: true },
  });

  return toMessageDto(created, authorId);
}
