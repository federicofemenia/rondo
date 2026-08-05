import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import HomePage from '../src/HomePage';
import type { UpcomingEventItem } from '../src/HomePage';
import type { MatchInvitationDto } from '@rondo/contracts';
import type { PendingAction } from '../src/types';

function fixtureEvent(overrides: Partial<UpcomingEventItem> = {}): UpcomingEventItem {
  return {
    id: 'event-1',
    kind: 'match',
    title: 'Fútbol • Fútbol 5',
    subtitle: 'Sábado • 20:00',
    meta: 'Faltan 2 jugadores',
    chipLabel: 'Organizando',
    chipColor: { bgcolor: 'transparent', color: 'inherit' },
    onClick: vi.fn(),
    ...overrides,
  };
}

const pendingInvitation: MatchInvitationDto = {
  id: 'invitation-1',
  matchId: 'match-1',
  status: 'PENDING',
  position: null,
  invitedUserId: 'user-test',
  invitedUserDisplayName: 'Federico Femenia',
  invitedById: 'organizer-1',
  organizerDisplayName: 'Federico',
  sportName: 'Fútbol',
  modalityName: 'Fútbol 5',
  clubName: null,
  scheduledDate: '2026-08-07',
  availabilityStartMinutes: 20 * 60,
  availabilityEndMinutes: 21 * 60,
  startsAt: '2026-08-07T20:00:00.000Z',
  endsAt: '2026-08-07T21:00:00.000Z',
  createdAt: '2026-08-01T00:00:00.000Z',
  respondedAt: null,
};

describe('HomePage', () => {
  it('does not show an Invitaciones section when there are none', () => {
    render(<HomePage />);

    expect(screen.queryByText(/^invitaciones$/i)).toBeFalsy();
  });

  it('shows each pending invitation with organizer, sport, schedule, venue and Aceptar/Rechazar actions', () => {
    render(<HomePage pendingInvitations={[pendingInvitation]} />);

    expect(screen.getByText(/^invitaciones$/i)).toBeTruthy();
    expect(screen.getByText(/federico te invitó a fútbol fútbol 5/i)).toBeTruthy();
    expect(screen.getByText('Sede a definir')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^aceptar$/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^rechazar$/i })).toBeTruthy();
  });

  it('shows the club name instead of "Sede a definir" when the match has a venue', () => {
    render(<HomePage pendingInvitations={[{ ...pendingInvitation, clubName: 'Club Señor Pato' }]} />);

    expect(screen.getByText('Club Señor Pato')).toBeTruthy();
    expect(screen.queryByText('Sede a definir')).toBeFalsy();
  });

  it('calls onAcceptInvitation / onRejectInvitation with the invitation id', () => {
    const onAcceptInvitation = vi.fn();
    const onRejectInvitation = vi.fn();
    render(
      <HomePage pendingInvitations={[pendingInvitation]} onAcceptInvitation={onAcceptInvitation} onRejectInvitation={onRejectInvitation} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^aceptar$/i }));
    expect(onAcceptInvitation).toHaveBeenCalledWith('invitation-1');

    fireEvent.click(screen.getByRole('button', { name: /^rechazar$/i }));
    expect(onRejectInvitation).toHaveBeenCalledWith('invitation-1');
  });

  it('disables both buttons and shows a sending state while responding to that invitation', () => {
    render(<HomePage pendingInvitations={[pendingInvitation]} respondingInvitationId="invitation-1" />);

    expect(screen.getByRole('button', { name: /enviando/i })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: /^rechazar$/i })).toHaveProperty('disabled', true);
  });

  it('shows the backend error message for a failed response, scoped to that invitation', () => {
    render(<HomePage pendingInvitations={[pendingInvitation]} invitationRespondErrors={{ 'invitation-1': 'No pudimos procesar tu respuesta.' }} />);

    expect(screen.getByText(/no pudimos procesar tu respuesta/i)).toBeTruthy();
  });

  it('shows the informational Clubes card when the user has no active club membership', () => {
    render(<HomePage clubName={null} />);

    expect(screen.getByText('Clubes')).toBeTruthy();
    expect(screen.getByText(/todavía no estás asociado a ningún club/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /buscar club/i })).toBeTruthy();
  });

  it('does not show club novedades/banner/club-selector content when the user has no active club', () => {
    render(<HomePage clubName={null} />);

    expect(screen.queryByText(/novedades de/i)).toBeFalsy();
    expect(screen.queryByText(/% off/i)).toBeFalsy();
    expect(screen.queryByRole('button', { name: /club señor pato/i })).toBeFalsy();
  });

  it('does not show the Clubes card when the user has an active club membership', () => {
    render(<HomePage clubName="Club Señor Pato" />);

    expect(screen.queryByText('Clubes')).toBeFalsy();
    expect(screen.queryByText(/todavía no estás asociado a ningún club/i)).toBeFalsy();
  });

  it('keeps showing the club badge and novedades for a user with an active club membership', () => {
    render(<HomePage clubName="Club Señor Pato" />);

    expect(screen.getByRole('button', { name: /club señor pato/i })).toBeTruthy();
    expect(screen.getByText(/novedades de club señor pato/i)).toBeTruthy();
  });

  it('hides Próximos partidos entirely (no empty-state card) when there are no upcoming events', () => {
    render(<HomePage upcomingEvents={[]} />);

    expect(screen.queryByText(/^próximos partidos$/i)).toBeFalsy();
    expect(screen.queryByText(/todavía no tenés partidos próximos/i)).toBeFalsy();
  });

  it('orders sections: Acciones rápidas first, then Invitaciones, then Próximos partidos, then Club/NoClub', () => {
    render(
      <HomePage
        pendingInvitations={[pendingInvitation]}
        upcomingEvents={[fixtureEvent()]}
        clubName="Club Señor Pato"
      />,
    );

    const headings = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);
    const accionesIndex = headings.findIndex((text) => text === 'Acciones rápidas');
    const invitationsIndex = headings.findIndex((text) => text === 'Invitaciones');
    const proximosIndex = headings.findIndex((text) => text === 'Próximos partidos');
    const novedadesIndex = headings.findIndex((text) => text?.startsWith('Novedades de'));

    // Acciones rápidas must be the very first section, never duplicated elsewhere.
    expect(accionesIndex).toBe(0);
    expect(accionesIndex).toBeLessThan(invitationsIndex);
    expect(invitationsIndex).toBeLessThan(proximosIndex);
    expect(proximosIndex).toBeLessThan(novedadesIndex);
    expect(screen.getAllByRole('button', { name: /armar partido/i })).toHaveLength(1);
  });

  it('shows a "Partidos finalizados" section only when there are finished matches, distinct from Próximos partidos', () => {
    const { rerender } = render(<HomePage upcomingEvents={[fixtureEvent()]} finishedEvents={[]} />);
    expect(screen.queryByText(/^partidos finalizados$/i)).toBeFalsy();

    rerender(
      <HomePage
        upcomingEvents={[fixtureEvent({ id: 'upcoming-1' })]}
        finishedEvents={[fixtureEvent({ id: 'completed-1', title: 'Pádel • Dobles', meta: 'Partido finalizado' })]}
      />,
    );
    expect(screen.getByText(/^partidos finalizados$/i)).toBeTruthy();
    expect(screen.getByText('Fútbol • Fútbol 5')).toBeTruthy();
    expect(screen.getByText('Pádel • Dobles')).toBeTruthy();
  });

  it('hides Partidos finalizados entirely when there are no finished matches, even with nothing upcoming either', () => {
    render(<HomePage upcomingEvents={[]} finishedEvents={[]} />);

    expect(screen.queryByText(/^próximos partidos$/i)).toBeFalsy();
    expect(screen.queryByText(/^partidos finalizados$/i)).toBeFalsy();
  });

  it('hides the Tareas pendientes section entirely when there are no pending tasks', () => {
    render(<HomePage pendingTaskItems={[]} />);
    expect(screen.queryByText(/tareas pendientes/i)).toBeFalsy();
  });

  it('shows real pending tasks and invokes their onClick', () => {
    const onClick = vi.fn();
    const tasks: PendingAction[] = [{ id: 'task-1', label: 'Tu partido de Fútbol todavía no tiene sede.', description: 'Elegí un club', onClick }];
    render(<HomePage pendingTaskItems={tasks} />);

    expect(screen.getByText(/todavía no tiene sede/i)).toBeTruthy();
    expect(screen.getByText('Elegí un club')).toBeTruthy();
    fireEvent.click(screen.getByText(/todavía no tiene sede/i));
    expect(onClick).toHaveBeenCalled();
  });

  it('scrolls to and highlights the invitation matching highlightInvitationId', () => {
    const scrollIntoViewMock = vi.fn();
    // jsdom has no real layout engine, so Element.prototype.scrollIntoView is not implemented by default.
    Element.prototype.scrollIntoView = scrollIntoViewMock;

    render(<HomePage pendingInvitations={[pendingInvitation]} highlightInvitationId="invitation-1" />);

    expect(scrollIntoViewMock).toHaveBeenCalled();
  });

  it('does not throw when highlightInvitationId does not match any pending invitation', () => {
    expect(() => render(<HomePage pendingInvitations={[pendingInvitation]} highlightInvitationId="does-not-exist" />)).not.toThrow();
  });
});
