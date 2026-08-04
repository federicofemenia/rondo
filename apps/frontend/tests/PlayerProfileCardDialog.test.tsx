import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PlayerProfileCardDialog from '../src/PlayerProfileCardDialog';
import { mockPublicProfileFailingIds, mockPublicProfiles, mockRatingCommentsByUserId, mockRatingCommentsFailingIds } from './setup';

const bruno = {
  id: 'candidate-bruno',
  displayName: 'Bruno Silva',
  avatarUrl: null,
  sex: null,
  biography: 'Juego todos los martes.',
  positions: ['Delantero'],
  ratings: { gameplayAverage: 4.5, conductAverage: 5, count: 18 },
};

describe('PlayerProfileCardDialog', () => {
  it('does not render dialog content when closed', () => {
    render(<PlayerProfileCardDialog open={false} userId={null} onClose={() => {}} />);

    expect(screen.queryByRole('dialog')).toBeFalsy();
  });

  it('shows a loading state while the public profile is being fetched', () => {
    mockPublicProfiles.set(bruno.id, bruno);
    render(<PlayerProfileCardDialog open userId={bruno.id} onClose={() => {}} />);

    expect(screen.getByRole('progressbar')).toBeTruthy();
  });

  it('shows the backend error message when the public profile request fails', async () => {
    mockPublicProfileFailingIds.add(bruno.id);
    render(<PlayerProfileCardDialog open userId={bruno.id} onClose={() => {}} />);

    expect(await screen.findByText(/ocurrió un error inesperado/i)).toBeTruthy();
  });

  it('shows the player name, positions, biography and ratings once loaded', async () => {
    mockPublicProfiles.set(bruno.id, bruno);
    render(<PlayerProfileCardDialog open userId={bruno.id} onClose={() => {}} />);

    expect(await screen.findByText('Bruno Silva')).toBeTruthy();
    expect(screen.getByText('Delantero')).toBeTruthy();
    expect(screen.getByText(/juego todos los martes/i)).toBeTruthy();
    expect(screen.getByText('Juego')).toBeTruthy();
    expect(screen.getByText('Conducta')).toBeTruthy();
    expect(screen.getByText('18 valoraciones')).toBeTruthy();
  });

  it('shows "Sin valoraciones" for a player with no ratings yet', async () => {
    mockPublicProfiles.set(bruno.id, { ...bruno, ratings: { gameplayAverage: null, conductAverage: null, count: 0 } });
    render(<PlayerProfileCardDialog open userId={bruno.id} onClose={() => {}} />);

    expect(await screen.findByText('Bruno Silva')).toBeTruthy();
    expect(screen.getByText(/sin valoraciones/i)).toBeTruthy();
  });

  it('does not render a biography section when the player has none', async () => {
    mockPublicProfiles.set(bruno.id, { ...bruno, biography: null });
    render(<PlayerProfileCardDialog open userId={bruno.id} onClose={() => {}} />);

    await screen.findByText('Bruno Silva');
    expect(screen.queryByText(/juego todos los martes/i)).toBeFalsy();
  });

  it('does not fetch comments until "Ver comentarios" is tapped', async () => {
    mockPublicProfiles.set(bruno.id, bruno);
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
    render(<PlayerProfileCardDialog open userId={bruno.id} onClose={() => {}} />);

    await screen.findByText('Bruno Silva');
    expect(screen.queryByText(/excelente compañero/i)).toBeFalsy();

    fireEvent.click(screen.getByRole('button', { name: /ver comentarios/i }));

    expect(await screen.findByText(/excelente compañero/i)).toBeTruthy();
    expect(screen.getByText('Nadia')).toBeTruthy();
    expect(screen.getByText(/fútbol • fútbol 5/i)).toBeTruthy();
  });

  it('shows a message when the player has no written comments', async () => {
    mockPublicProfiles.set(bruno.id, bruno);
    render(<PlayerProfileCardDialog open userId={bruno.id} onClose={() => {}} />);

    await screen.findByText('Bruno Silva');
    fireEvent.click(screen.getByRole('button', { name: /ver comentarios/i }));

    expect(await screen.findByText(/todavía no recibió comentarios escritos/i)).toBeTruthy();
  });

  it('shows the backend error message when the comments request fails', async () => {
    mockPublicProfiles.set(bruno.id, bruno);
    mockRatingCommentsFailingIds.add(bruno.id);
    render(<PlayerProfileCardDialog open userId={bruno.id} onClose={() => {}} />);

    await screen.findByText('Bruno Silva');
    fireEvent.click(screen.getByRole('button', { name: /ver comentarios/i }));

    expect(await screen.findByText(/ocurrió un error inesperado/i)).toBeTruthy();
  });

  it('closes the dialog when the close button is pressed', async () => {
    mockPublicProfiles.set(bruno.id, bruno);
    const onClose = vi.fn();
    render(<PlayerProfileCardDialog open userId={bruno.id} onClose={onClose} />);

    await screen.findByText('Bruno Silva');
    fireEvent.click(screen.getByRole('button', { name: /cerrar/i }));

    expect(onClose).toHaveBeenCalled();
  });
});
