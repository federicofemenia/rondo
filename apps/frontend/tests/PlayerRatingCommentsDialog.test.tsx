import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PlayerRatingCommentsDialog from '../src/PlayerRatingCommentsDialog';
import { mockRatingCommentsByUserId, mockRatingCommentsFailingIds } from './setup';

const USER_ID = 'candidate-bruno';

describe('PlayerRatingCommentsDialog', () => {
  it('does not render dialog content when closed', () => {
    render(<PlayerRatingCommentsDialog open={false} userId={null} sportId="sport-football" sportName="Fútbol" onClose={() => {}} />);

    expect(screen.queryByRole('dialog')).toBeFalsy();
  });

  it('shows the sport in the title', async () => {
    mockRatingCommentsByUserId.set(USER_ID, []);
    render(<PlayerRatingCommentsDialog open userId={USER_ID} sportId="sport-football" sportName="Fútbol" onClose={() => {}} />);

    expect(await screen.findByText('Comentarios de Fútbol')).toBeTruthy();
  });

  it('shows a loading state while comments are being fetched', () => {
    render(<PlayerRatingCommentsDialog open userId={USER_ID} sportId="sport-football" sportName="Fútbol" onClose={() => {}} />);

    expect(screen.getByRole('progressbar')).toBeTruthy();
  });

  it('lists comments with author, sport/modality, date, scores and text', async () => {
    mockRatingCommentsByUserId.set(USER_ID, [
      {
        id: 'comment-1',
        authorDisplayName: 'Nadia',
        gameplayScore: 5,
        conductScore: 4,
        comment: 'Excelente compañero.',
        sportName: 'Fútbol',
        modalityName: 'Fútbol 5',
        createdAt: '2026-07-15T00:00:00.000Z',
      },
    ]);
    render(<PlayerRatingCommentsDialog open userId={USER_ID} sportId="sport-football" sportName="Fútbol" onClose={() => {}} />);

    expect(await screen.findByText(/excelente compañero/i)).toBeTruthy();
    expect(screen.getByText('Nadia')).toBeTruthy();
    expect(screen.getByText(/fútbol • fútbol 5/i)).toBeTruthy();
  });

  it('shows a sport-specific empty state when there are no comments', async () => {
    mockRatingCommentsByUserId.set(USER_ID, []);
    render(<PlayerRatingCommentsDialog open userId={USER_ID} sportId="sport-football" sportName="Fútbol" onClose={() => {}} />);

    expect(await screen.findByText(/todavía no recibió comentarios en fútbol/i)).toBeTruthy();
  });

  it('shows the backend error message when the request fails', async () => {
    mockRatingCommentsFailingIds.add(USER_ID);
    render(<PlayerRatingCommentsDialog open userId={USER_ID} sportId="sport-football" sportName="Fútbol" onClose={() => {}} />);

    expect(await screen.findByText(/ocurrió un error inesperado/i)).toBeTruthy();
  });

  it('can be closed', async () => {
    mockRatingCommentsByUserId.set(USER_ID, []);
    const onClose = vi.fn();
    render(<PlayerRatingCommentsDialog open userId={USER_ID} sportId="sport-football" sportName="Fútbol" onClose={onClose} />);

    await screen.findByText('Comentarios de Fútbol');
    fireEvent.click(screen.getByRole('button', { name: /cerrar/i }));

    expect(onClose).toHaveBeenCalled();
  });
});
