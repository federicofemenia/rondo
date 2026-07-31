import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CandidatesPage from '../src/CandidatesPage';
import { mockCandidates, mockCandidatesFailingMatchIds, mockInvitationCreateFailingMatchIds } from './setup';

const bruno = {
  id: 'candidate-bruno',
  firstName: 'Bruno',
  lastName: 'Silva',
  avatarUrl: null,
  sportId: 'sport-football',
  positions: ['Delantero'],
  matchingAvailability: 'Disponible entre 15:00 y 18:00',
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

  it('renders the real candidates returned by the backend', async () => {
    mockCandidates.push(bruno);
    render(<CandidatesPage matchId="match-1" />);

    expect(await screen.findByText('Bruno Silva')).toBeTruthy();
    expect(screen.getByText('Disponible entre 15:00 y 18:00')).toBeTruthy();
    expect(screen.getByText('DEL')).toBeTruthy();
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

  it('never shows the old mock candidates or the retired reputation UI', async () => {
    mockCandidates.push(bruno);
    render(<CandidatesPage matchId="match-1" />);

    await screen.findByText('Bruno Silva');
    expect(screen.queryByText('Mauro')).toBeFalsy();
    expect(screen.queryByText('Lina')).toBeFalsy();
    expect(screen.queryByText(/conducta/i)).toBeFalsy();
    expect(screen.queryByText(/comentarios/i)).toBeFalsy();
  });
});
