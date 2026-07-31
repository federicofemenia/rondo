import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CandidatesPage from '../src/CandidatesPage';
import { mockCandidates, mockCandidatesFailingMatchIds } from './setup';

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

  it('calls the invite handler with the selected candidate name', async () => {
    mockCandidates.push(bruno);
    const onInviteCandidate = vi.fn();
    render(<CandidatesPage matchId="match-1" onInviteCandidate={onInviteCandidate} />);

    fireEvent.click(await screen.findByRole('button', { name: /invitar/i }));

    expect(onInviteCandidate).toHaveBeenCalledWith('Bruno Silva');
    expect(await screen.findByText(/invitación enviada a bruno silva/i)).toBeTruthy();
  });

  it('excludes candidates already invited via excludeNames', async () => {
    mockCandidates.push(bruno, { ...bruno, id: 'candidate-carla', firstName: 'Carla', lastName: 'Nuñez' });
    render(<CandidatesPage matchId="match-1" excludeNames={['Bruno Silva']} />);

    expect(await screen.findByText('Carla Nuñez')).toBeTruthy();
    expect(screen.queryByText('Bruno Silva')).toBeFalsy();
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
