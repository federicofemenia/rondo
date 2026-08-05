import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PlayerProfileCardDialog from '../src/PlayerProfileCardDialog';
import { mockPublicProfileFailingIds, mockPublicProfiles } from './setup';

const bruno = {
  id: 'candidate-bruno',
  displayName: 'Bruno Silva',
  avatarUrl: null,
  sex: null,
  biography: 'Juego todos los martes.',
  positions: ['Delantero'],
  ratings: { sportId: 'sport-football', sportName: 'Fútbol', gameplayAverage: 4.5, conductAverage: 5, count: 18, commentsCount: 1 },
};

describe('PlayerProfileCardDialog', () => {
  it('does not render dialog content when closed', () => {
    render(<PlayerProfileCardDialog open={false} userId={null} sportId="sport-football" onClose={() => {}} onShowComments={() => {}} />);

    expect(screen.queryByRole('dialog')).toBeFalsy();
  });

  it('shows a loading state while the public profile is being fetched', () => {
    mockPublicProfiles.set(bruno.id, bruno);
    render(<PlayerProfileCardDialog open userId={bruno.id} sportId="sport-football" onClose={() => {}} onShowComments={() => {}} />);

    expect(screen.getByRole('progressbar')).toBeTruthy();
  });

  it('shows the backend error message when the public profile request fails', async () => {
    mockPublicProfileFailingIds.add(bruno.id);
    render(<PlayerProfileCardDialog open userId={bruno.id} sportId="sport-football" onClose={() => {}} onShowComments={() => {}} />);

    expect(await screen.findByText(/ocurrió un error inesperado/i)).toBeTruthy();
  });

  it('shows the player name, positions, biography and ratings once loaded', async () => {
    mockPublicProfiles.set(bruno.id, bruno);
    render(<PlayerProfileCardDialog open userId={bruno.id} sportId="sport-football" onClose={() => {}} onShowComments={() => {}} />);

    expect(await screen.findByText('Bruno Silva')).toBeTruthy();
    expect(screen.getByText('Delantero')).toBeTruthy();
    expect(screen.getByText(/juego todos los martes/i)).toBeTruthy();
    expect(screen.getByText('Juego')).toBeTruthy();
    expect(screen.getByText('Conducta')).toBeTruthy();
    expect(screen.getByText('18 valoraciones')).toBeTruthy();
    expect(screen.getByText(/valoraciones en fútbol/i)).toBeTruthy();
  });

  it('shows "Sin valoraciones en <deporte>" for a player with no ratings yet', async () => {
    mockPublicProfiles.set(bruno.id, {
      ...bruno,
      ratings: { sportId: 'sport-football', sportName: 'Fútbol', gameplayAverage: null, conductAverage: null, count: 0, commentsCount: 0 },
    });
    render(<PlayerProfileCardDialog open userId={bruno.id} sportId="sport-football" onClose={() => {}} onShowComments={() => {}} />);

    expect(await screen.findByText('Bruno Silva')).toBeTruthy();
    expect(screen.getByText(/sin valoraciones en fútbol/i)).toBeTruthy();
  });

  it('does not render a biography section when the player has none', async () => {
    mockPublicProfiles.set(bruno.id, { ...bruno, biography: null });
    render(<PlayerProfileCardDialog open userId={bruno.id} sportId="sport-football" onClose={() => {}} onShowComments={() => {}} />);

    await screen.findByText('Bruno Silva');
    expect(screen.queryByText(/juego todos los martes/i)).toBeFalsy();
  });

  it('shows the comment count on the "Ver comentarios" button and delegates the click to onShowComments, without fetching or rendering any comment itself', async () => {
    mockPublicProfiles.set(bruno.id, bruno);
    const onShowComments = vi.fn();
    render(<PlayerProfileCardDialog open userId={bruno.id} sportId="sport-football" onClose={() => {}} onShowComments={onShowComments} />);

    await screen.findByText('Bruno Silva');
    const button = screen.getByRole('button', { name: /ver comentarios \(1\)/i });

    fireEvent.click(button);
    expect(onShowComments).toHaveBeenCalledTimes(1);
  });

  it('shows a plain "Ver comentarios" (no count) when the player has no written comments', async () => {
    mockPublicProfiles.set(bruno.id, { ...bruno, ratings: { ...bruno.ratings, commentsCount: 0 } });
    render(<PlayerProfileCardDialog open userId={bruno.id} sportId="sport-football" onClose={() => {}} onShowComments={() => {}} />);

    await screen.findByText('Bruno Silva');
    expect(screen.getByRole('button', { name: /^ver comentarios$/i })).toBeTruthy();
  });

  it('closes the dialog when the close button is pressed', async () => {
    mockPublicProfiles.set(bruno.id, bruno);
    const onClose = vi.fn();
    render(<PlayerProfileCardDialog open userId={bruno.id} sportId="sport-football" onClose={onClose} onShowComments={() => {}} />);

    await screen.findByText('Bruno Silva');
    fireEvent.click(screen.getByRole('button', { name: /cerrar/i }));

    expect(onClose).toHaveBeenCalled();
  });
});
