import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MatchChatPage from '../src/MatchChatPage';
import { mockChatAccessDeniedMatchIds, mockChatByMatchId, mockChatLoadFailingMatchIds, mockChatSendFailingMatchIds } from './setup';

const POLL_INTERVAL_MS = 10_000;

describe('MatchChatPage', () => {
  it('shows a loading state while the chat loads', () => {
    render(<MatchChatPage matchId="match-1" status="ORGANIZING" />);
    expect(screen.getByRole('progressbar')).toBeTruthy();
  });

  it('shows an error state when loading fails', async () => {
    mockChatLoadFailingMatchIds.add('match-1');
    render(<MatchChatPage matchId="match-1" status="ORGANIZING" />);

    expect(await screen.findByText(/ocurrió un error inesperado/i)).toBeTruthy();
  });

  it('lists real messages, distinguishing the current user from others', async () => {
    mockChatByMatchId.set('match-1', {
      matchId: 'match-1',
      canSend: true,
      closed: false,
      closesAt: null,
      messages: [
        { id: 'm1', content: 'Hola a todos', createdAt: '2026-07-30T18:00:00.000Z', isCurrentUser: false, author: { id: 'u2', displayName: 'Mauro', avatarUrl: null } },
        { id: 'm2', content: 'Dale, nos vemos', createdAt: '2026-07-30T18:01:00.000Z', isCurrentUser: true, author: { id: 'u1', displayName: 'Vos', avatarUrl: null } },
      ],
    });
    render(<MatchChatPage matchId="match-1" status="ORGANIZING" />);

    expect(await screen.findByText('Hola a todos')).toBeTruthy();
    expect(screen.getByText('Dale, nos vemos')).toBeTruthy();
    expect(screen.getByText('Mauro')).toBeTruthy();
  });

  it('sends a message, disables the button while sending, and clears the field only on success', async () => {
    mockChatByMatchId.set('match-1', { matchId: 'match-1', canSend: true, closed: false, closesAt: null, messages: [] });
    render(<MatchChatPage matchId="match-1" status="ORGANIZING" />);

    await screen.findByText(/todavía no hay mensajes/i);
    const input = screen.getByPlaceholderText<HTMLInputElement>(/escribí un mensaje/i);
    fireEvent.change(input, { target: { value: 'Hola equipo' } });

    const button = screen.getByRole<HTMLButtonElement>('button', { name: /enviar/i });
    fireEvent.click(button);

    expect(await screen.findByText('Hola equipo')).toBeTruthy();
    expect(input.value).toBe('');
  });

  it('disables the send button when the content is empty', async () => {
    mockChatByMatchId.set('match-1', { matchId: 'match-1', canSend: true, closed: false, closesAt: null, messages: [] });
    render(<MatchChatPage matchId="match-1" status="ORGANIZING" />);

    await screen.findByText(/todavía no hay mensajes/i);
    const button = screen.getByRole<HTMLButtonElement>('button', { name: /enviar/i });
    expect(button.disabled).toBe(true);

    fireEvent.click(button);
    expect(screen.getByText(/todavía no hay mensajes/i)).toBeTruthy();
  });

  it('shows an inline error when sending fails', async () => {
    mockChatByMatchId.set('match-1', { matchId: 'match-1', canSend: true, closed: false, closesAt: null, messages: [] });
    mockChatSendFailingMatchIds.add('match-1');
    render(<MatchChatPage matchId="match-1" status="ORGANIZING" />);

    await screen.findByText(/todavía no hay mensajes/i);
    fireEvent.change(screen.getByPlaceholderText(/escribí un mensaje/i), { target: { value: 'Hola' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));

    expect(await screen.findByText(/ocurrió un error inesperado/i)).toBeTruthy();
  });

  it('polling refreshes the message list', async () => {
    mockChatByMatchId.set('match-1', { matchId: 'match-1', canSend: true, closed: false, closesAt: null, messages: [] });
    vi.useFakeTimers();
    try {
      render(<MatchChatPage matchId="match-1" status="ORGANIZING" />);
      await vi.waitFor(() => expect(screen.getByText(/todavía no hay mensajes/i)).toBeTruthy());

      mockChatByMatchId.get('match-1')!.messages.push({
        id: 'm-new',
        content: 'Recién llegado',
        createdAt: new Date().toISOString(),
        isCurrentUser: false,
        author: { id: 'u2', displayName: 'Mauro', avatarUrl: null },
      });

      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
      await vi.waitFor(() => expect(screen.getByText('Recién llegado')).toBeTruthy());
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops polling once the component unmounts', async () => {
    mockChatByMatchId.set('match-1', { matchId: 'match-1', canSend: true, closed: false, closesAt: null, messages: [] });
    vi.useFakeTimers();
    try {
      const { unmount } = render(<MatchChatPage matchId="match-1" status="ORGANIZING" />);
      await vi.waitFor(() => expect(screen.getByText(/todavía no hay mensajes/i)).toBeTruthy());

      const fetchMock = global.fetch as unknown as { mock: { calls: unknown[] } };
      const callsAtUnmount = fetchMock.mock.calls.length;
      unmount();

      await vi.advanceTimersByTimeAsync(3 * POLL_INTERVAL_MS);
      expect(fetchMock.mock.calls.length).toBe(callsAtUnmount);
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows the cancelled closed message and hides the composer', async () => {
    mockChatByMatchId.set('match-1', { matchId: 'match-1', canSend: false, closed: true, closesAt: null, messages: [] });
    render(<MatchChatPage matchId="match-1" status="CANCELLED" />);

    expect(await screen.findByText(/el partido fue cancelado\. el chat quedó cerrado/i)).toBeTruthy();
    expect(screen.queryByLabelText(/mensaje/i)).toBeFalsy();
  });

  it('shows the expired closed message', async () => {
    mockChatByMatchId.set('match-1', { matchId: 'match-1', canSend: false, closed: true, closesAt: null, messages: [] });
    render(<MatchChatPage matchId="match-1" status="EXPIRED" />);

    expect(await screen.findByText(/el partido venció y el chat quedó cerrado/i)).toBeTruthy();
  });

  it('shows the post-match window closed message once 24h have passed', async () => {
    mockChatByMatchId.set('match-1', { matchId: 'match-1', canSend: false, closed: true, closesAt: null, messages: [] });
    render(<MatchChatPage matchId="match-1" status="COMPLETED" />);

    expect(await screen.findByText(/el período de chat posterior al partido finalizó/i)).toBeTruthy();
  });

  it('shows an access error for a user without access, without listing messages or a composer', async () => {
    mockChatAccessDeniedMatchIds.add('match-1');
    render(<MatchChatPage matchId="match-1" status="ORGANIZING" />);

    expect(await screen.findByText(/no tenés acceso a este chat/i)).toBeTruthy();
    expect(screen.queryByLabelText(/mensaje/i)).toBeFalsy();
  });
});
