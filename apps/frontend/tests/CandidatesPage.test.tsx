import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CandidatesPage from '../src/CandidatesPage';
import {
  mockCandidates,
  mockCandidatesFailingMatchIds,
  mockInvitationCreateFailingMatchIds,
  mockPublicProfiles,
  mockRatingCommentsByUserId,
} from './setup';

const bruno = {
  id: 'candidate-bruno',
  displayName: 'Bruno Silva',
  avatarUrl: null,
  sportId: 'sport-football',
  positions: ['Delantero'],
  matchingAvailability: 'Disponible entre 15:00 y 18:00',
  ratings: { sportId: 'sport-football', sportName: 'Fútbol', gameplayAverage: 4.5, conductAverage: 5, count: 18, commentsCount: 3 },
};

const unratedCandidate = {
  id: 'candidate-nadia',
  displayName: 'Nadia',
  avatarUrl: null,
  sportId: 'sport-football',
  positions: [],
  matchingAvailability: 'Disponible',
  ratings: { sportId: 'sport-football', sportName: 'Fútbol', gameplayAverage: null, conductAverage: null, count: 0, commentsCount: 0 },
};

describe('CandidatesPage', () => {
  it('shows a loading state while the candidates are being fetched', () => {
    render(<CandidatesPage matchId="match-1" />);

    expect(screen.getByRole('progressbar')).toBeTruthy();
  });

  it('shows the backend error message when the request fails', async () => {
    mockCandidatesFailingMatchIds.add('match-1');
    render(<CandidatesPage matchId="match-1" />);

    expect(await screen.findByText(/ocurrió un error inesperado/i)).toBeTruthy();
  });

  it('shows an empty-state message when there are no compatible candidates', async () => {
    render(<CandidatesPage matchId="match-1" />);

    expect(await screen.findByText(/no encontramos jugadores compatibles para este partido/i)).toBeTruthy();
  });

  it('renders the real candidates returned by the backend, including their ratings summary', async () => {
    mockCandidates.push(bruno);
    render(<CandidatesPage matchId="match-1" />);

    expect(await screen.findByText('Bruno Silva')).toBeTruthy();
    expect(screen.queryByText('Disponible entre 15:00 y 18:00')).toBeFalsy();
    expect(screen.getByText('DEL')).toBeTruthy();
    expect(screen.getByText('Juego')).toBeTruthy();
    expect(screen.getByText('Conducta')).toBeTruthy();
    expect(screen.getByText(/18 valoraciones/)).toBeTruthy();
    expect(screen.getByText(/3 comentarios/)).toBeTruthy();
  });

  it('shows "Sin valoraciones" for a candidate with no ratings yet', async () => {
    mockCandidates.push(unratedCandidate);
    render(<CandidatesPage matchId="match-1" />);

    expect(await screen.findByText('Nadia')).toBeTruthy();
    expect(screen.getByText(/sin valoraciones/i)).toBeTruthy();
  });

  it('never shows biography, and only shows comment text once "Ver comentarios" is tapped', async () => {
    mockCandidates.push(bruno);
    mockRatingCommentsByUserId.set(bruno.id, [
      {
        id: 'comment-1',
        authorDisplayName: 'Nadia',
        gameplayScore: 5,
        conductScore: 5,
        comment: 'Excelente compañero.',
        sportName: 'Fútbol',
        modalityName: 'Fútbol 5',
        createdAt: '2026-07-01T00:00:00.000Z',
      },
    ]);
    render(<CandidatesPage matchId="match-1" />);

    await screen.findByText('Bruno Silva');
    expect(screen.queryByText(/juego todos los martes/i)).toBeFalsy();
    expect(screen.queryByText(/excelente compañero/i)).toBeFalsy();

    fireEvent.click(screen.getByRole('button', { name: /ver comentarios \(3\)/i }));

    expect(await screen.findByText(/excelente compañero/i)).toBeTruthy();
    expect(screen.getByText('Nadia')).toBeTruthy();
  });

  it('does not show a comments button-link for a candidate with no written comments', async () => {
    mockCandidates.push(unratedCandidate);
    render(<CandidatesPage matchId="match-1" />);

    await screen.findByText('Nadia');
    expect(screen.queryByRole('button', { name: /ver comentarios/i })).toBeFalsy();
  });

  it('sends a real invitation to the backend and disables the button once sent', async () => {
    mockCandidates.push(bruno);
    render(<CandidatesPage matchId="match-1" />);

    const inviteButton = await screen.findByRole('button', { name: /^invitar$/i });
    fireEvent.click(inviteButton);

    const sentButton = await screen.findByRole<HTMLButtonElement>('button', { name: /invitación enviada/i });
    expect(sentButton.disabled).toBe(true);
    expect(screen.queryByRole('button', { name: /^invitar$/i })).toBeFalsy();
  });

  it('shows the backend error message when sending an invitation fails, and lets the button be re-enabled', async () => {
    mockCandidates.push(bruno);
    mockInvitationCreateFailingMatchIds.add('match-1');
    render(<CandidatesPage matchId="match-1" />);

    fireEvent.click(await screen.findByRole('button', { name: /^invitar$/i }));

    expect(await screen.findByText(/ocurrió un error inesperado/i)).toBeTruthy();
    const inviteButtonAgain = screen.getByRole<HTMLButtonElement>('button', { name: /^invitar$/i });
    expect(inviteButtonAgain.disabled).toBe(false);
  });

  it('calls the finish handler when the wizard is completed', async () => {
    const onFinish = vi.fn();
    render(<CandidatesPage matchId="match-1" onFinish={onFinish} />);
    await screen.findByText(/no encontramos jugadores compatibles/i);

    fireEvent.click(screen.getByRole('button', { name: /finalizar/i }));

    expect(onFinish).toHaveBeenCalled();
  });

  it('never shows the old mock candidate names', async () => {
    mockCandidates.push(bruno);
    render(<CandidatesPage matchId="match-1" />);

    await screen.findByText('Bruno Silva');
    expect(screen.queryByText('Mauro')).toBeFalsy();
    expect(screen.queryByText('Lina')).toBeFalsy();
  });

  it('opens the player profile card when the card itself is clicked', async () => {
    mockCandidates.push(bruno);
    mockPublicProfiles.set(bruno.id, {
      id: bruno.id,
      displayName: bruno.displayName,
      avatarUrl: null,
      sex: null,
      biography: 'Juego todos los martes.',
      positions: ['Delantero'],
      ratings: bruno.ratings,
    });
    render(<CandidatesPage matchId="match-1" />);

    fireEvent.click(await screen.findByText('Bruno Silva'));

    expect(await screen.findByText(/juego todos los martes/i)).toBeTruthy();
  });

  it('clicking Invitar does not open the player profile card (stopPropagation)', async () => {
    mockCandidates.push(bruno);
    mockPublicProfiles.set(bruno.id, {
      id: bruno.id,
      displayName: bruno.displayName,
      avatarUrl: null,
      sex: null,
      biography: 'No debería verse.',
      positions: ['Delantero'],
      ratings: bruno.ratings,
    });
    render(<CandidatesPage matchId="match-1" />);

    fireEvent.click(await screen.findByRole('button', { name: /^invitar$/i }));

    expect(screen.queryByRole('dialog')).toBeFalsy();
  });
});
