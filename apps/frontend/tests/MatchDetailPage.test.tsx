import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MatchDetailPage from '../src/MatchDetailPage';
import type { MatchEntity } from '../src/types';
import { mockCandidates } from './setup';

const baseMatch: MatchEntity = {
  id: 'match-1',
  status: 'ORGANIZING',
  sportId: 'sport-football',
  sport: 'Fútbol',
  modality: 'Fútbol 5',
  sportModalityId: 'modality-football-5',
  minPlayers: '4',
  maxPlayers: '10',
  positions: [],
  participantsCount: 1,
  clubId: 'club-1',
  clubName: 'Club Señor Pato',
  venueType: 'CLUB',
  customVenueName: null,
  courtName: 'Cancha 2 · Vidrio',
  scheduledDate: '2026-08-05',
  availabilityStartMinutes: 17 * 60,
  availabilityEndMinutes: 22 * 60,
  durationMinutes: 60,
  startsAt: '2026-08-05T19:00:00.000Z',
  endsAt: '2026-08-05T21:00:00.000Z',
  organizerUserId: 'user-organizer',
  isOrganizer: true,
  bookingId: 'booking-1',
  createdAt: 1,
  cancelledAt: null,
  cancelledByType: null,
  cancelledByName: null,
  cancellationReason: null,
};

describe('MatchDetailPage', () => {
  it('renders the match summary and estado del evento on the datos tab by default', () => {
    render(<MatchDetailPage match={baseMatch} unlinkedBookings={[]} />);

    expect(screen.getAllByText(/fútbol/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/club señor pato/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/jugadores 4 - 10/i)).toBeTruthy();
    expect(screen.getByText(/estado del evento/i)).toBeTruthy();
    expect(screen.getByText(/día confirmado/i)).toBeTruthy();
    expect(screen.getByText(/^organizando$/i)).toBeTruthy();
  });

  it('shows reservation actions when the match has no court yet', () => {
    render(<MatchDetailPage match={{ ...baseMatch, courtName: null }} unlinkedBookings={[]} />);

    expect(screen.getByText(/cancha pendiente/i)).toBeTruthy();
  });

  it('shows a discreet "Sede pendiente de confirmación" message when the venue is still undecided, not an error', () => {
    render(<MatchDetailPage match={{ ...baseMatch, clubName: null, venueType: 'TO_BE_DEFINED', clubId: null }} unlinkedBookings={[]} />);

    expect(screen.getByText(/sede pendiente de confirmación/i)).toBeTruthy();
  });

  it('shows the custom venue name and no "falta club" warning when the match has a free-text venue', () => {
    render(
      <MatchDetailPage
        match={{ ...baseMatch, clubId: null, clubName: 'Cancha de Juan', venueType: 'CUSTOM', customVenueName: 'Cancha de Juan' }}
        unlinkedBookings={[]}
      />,
    );

    expect(screen.getByText(/sede seleccionada/i)).toBeTruthy();
    expect(screen.getAllByText('Cancha de Juan').length).toBeGreaterThan(0);
    expect(screen.queryByText(/sede pendiente/i)).toBeFalsy();
    // No court-related warning either: a free-text venue never books a court.
    expect(screen.queryByText(/cancha pendiente/i)).toBeFalsy();
  });

  it('shows Completo once the backend reports the match as FULL', () => {
    render(<MatchDetailPage match={{ ...baseMatch, status: 'FULL', maxPlayers: '1' }} unlinkedBookings={[]} />);

    expect(screen.getByText(/^completo$/i)).toBeTruthy();
  });

  it('jugadores tab shows candidates above the roster, and invites update the section without a full reload', async () => {
    mockCandidates.push({
      id: 'candidate-lina',
      displayName: 'Lina',
      avatarUrl: null,
      sportId: 'sport-football',
      positions: [],
      matchingAvailability: 'Disponible',
      ratings: { sportId: 'sport-football', sportName: 'Fútbol', gameplayAverage: null, conductAverage: null, count: 0, commentsCount: 0 },
    });
    render(<MatchDetailPage match={baseMatch} unlinkedBookings={[]} />);

    fireEvent.click(screen.getByRole('tab', { name: /jugadores/i }));
    expect(await screen.findByText('👑 Organizador')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /^buscar jugadores$/i }));
    expect(await screen.findByText('Lina')).toBeTruthy();
    // The confirmed/pending roster must stay visible alongside the candidate
    // search, not get replaced by it (that used to make it unreachable again).
    expect(screen.getByText('👑 Organizador')).toBeTruthy();

    // Candidates render above the roster (Organizador/Confirmados/...).
    const candidatesHeading = screen.getByText('Candidatos compatibles');
    const organizerHeading = screen.getByText('👑 Organizador');
    expect(candidatesHeading.compareDocumentPosition(organizerHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /^invitar$/i }));
    expect(await screen.findByRole('button', { name: /invitación enviada/i })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /ocultar búsqueda de jugadores/i }));
    expect(await screen.findByRole('button', { name: /^buscar jugadores$/i })).toBeTruthy();
    expect(screen.queryByText('Candidatos compatibles')).toBeFalsy();
    expect(screen.getByText('👑 Organizador')).toBeTruthy();
  });

  it('shows a banner when the current user has a pending or accepted invitation to this match', () => {
    const { rerender } = render(<MatchDetailPage match={baseMatch} unlinkedBookings={[]} myInvitationStatus="PENDING" />);
    expect(screen.getByText(/invitación pendiente/i)).toBeTruthy();

    rerender(<MatchDetailPage match={baseMatch} unlinkedBookings={[]} myInvitationStatus="ACCEPTED" />);
    expect(screen.getByText(/invitación aceptada/i)).toBeTruthy();

    rerender(<MatchDetailPage match={baseMatch} unlinkedBookings={[]} myInvitationStatus={null} />);
    expect(screen.queryByText(/invitación pendiente/i)).toBeFalsy();
    expect(screen.queryByText(/invitación aceptada/i)).toBeFalsy();
  });

  it('resumen tab lets the organizer cancel the match', () => {
    const onCancelMatch = vi.fn();
    render(<MatchDetailPage match={baseMatch} unlinkedBookings={[]} onCancelMatch={onCancelMatch} />);

    expect(screen.getByText(/gestión del partido/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /cancelar partido/i }));
    expect(onCancelMatch).toHaveBeenCalled();
  });

  it('a non-organizer (confirmed participant or invited guest) never sees management actions: no Gestión del partido card, no schedule-edit form', () => {
    const onCancelMatch = vi.fn();
    render(<MatchDetailPage match={{ ...baseMatch, isOrganizer: false }} unlinkedBookings={[]} onCancelMatch={onCancelMatch} />);

    expect(screen.queryByText(/gestión del partido/i)).toBeFalsy();
    expect(screen.queryByRole('button', { name: /cancelar partido/i })).toBeFalsy();
    expect(screen.queryByLabelText(/^editar día$/i)).toBeFalsy();
    expect(screen.queryByLabelText(/^editar sede$/i)).toBeFalsy();
    expect(screen.queryByRole('button', { name: /^guardar cambios$/i })).toBeFalsy();
  });

  it('lets the organizer change the venue to a real club and sends venueType/clubId when saving', async () => {
    const onEditSchedule = vi.fn().mockResolvedValue(undefined);
    render(
      <MatchDetailPage
        match={{ ...baseMatch, venueType: 'TO_BE_DEFINED', clubId: null, clubName: null }}
        unlinkedBookings={[]}
        onEditSchedule={onEditSchedule}
      />,
    );

    const venueSelect = await screen.findByLabelText(/^editar sede$/i);
    fireEvent.change(venueSelect, { target: { value: 'club-1' } });
    fireEvent.click(screen.getByRole('button', { name: /^guardar cambios$/i }));

    await waitFor(() =>
      expect(onEditSchedule).toHaveBeenCalledWith(
        expect.objectContaining({ venueType: 'CLUB', clubId: 'club-1', customVenueName: null }),
      ),
    );
  });

  it('lets the organizer pick Otro and type a free-text venue name', async () => {
    const onEditSchedule = vi.fn().mockResolvedValue(undefined);
    render(<MatchDetailPage match={baseMatch} unlinkedBookings={[]} onEditSchedule={onEditSchedule} />);

    const venueSelect = await screen.findByLabelText(/^editar sede$/i);
    fireEvent.change(venueSelect, { target: { value: '__other__' } });
    fireEvent.change(screen.getByLabelText(/nombre de la sede o club/i), { target: { value: 'Cancha de Juan' } });
    fireEvent.click(screen.getByRole('button', { name: /^guardar cambios$/i }));

    await waitFor(() =>
      expect(onEditSchedule).toHaveBeenCalledWith(
        expect.objectContaining({ venueType: 'CUSTOM', clubId: null, customVenueName: 'Cancha de Juan' }),
      ),
    );
  });

  it('disables Guardar cambios when Otro is selected but no venue name was typed', async () => {
    render(<MatchDetailPage match={baseMatch} unlinkedBookings={[]} />);

    const venueSelect = await screen.findByLabelText(/^editar sede$/i);
    fireEvent.change(venueSelect, { target: { value: '__other__' } });

    expect(screen.getByRole('button', { name: /^guardar cambios$/i })).toHaveProperty('disabled', true);
  });

  it('does not offer Cancelar partido once the match is already cancelled', () => {
    render(<MatchDetailPage match={{ ...baseMatch, status: 'CANCELLED' }} unlinkedBookings={[]} />);

    expect(screen.queryByRole('button', { name: /cancelar partido/i })).toBeFalsy();
  });

  it('there is no separate Gestión tab; only Resumen, Jugadores, Chat and Valoraciones', () => {
    render(<MatchDetailPage match={baseMatch} unlinkedBookings={[]} />);

    expect(screen.getByRole('tab', { name: /resumen/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /jugadores/i })).toBeTruthy();
    expect(screen.queryByRole('tab', { name: /gestión/i })).toBeFalsy();
    expect(screen.getByRole('tab', { name: /^chat$/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /valoraciones/i })).toBeTruthy();
  });

  it('chat tab shows the real chat for this match, with no mock messages left over', async () => {
    render(<MatchDetailPage match={baseMatch} unlinkedBookings={[]} />);

    fireEvent.click(screen.getByRole('tab', { name: /^chat$/i }));
    expect(await screen.findByText(/todavía no hay mensajes/i)).toBeTruthy();
    expect(screen.queryByText(/buenísimo, nos vemos a las 19/i)).toBeFalsy();
    expect(screen.queryByText('Mauro')).toBeFalsy();
  });

  it('shows the informational message on the valoraciones tab before the match finishes', async () => {
    render(<MatchDetailPage match={baseMatch} unlinkedBookings={[]} />);

    fireEvent.click(screen.getByRole('tab', { name: /valoraciones/i }));
    await waitFor(() => expect(screen.getByText(/las valoraciones se habilitarán cuando finalice el partido/i)).toBeTruthy());
  });

  it('shows a cancelled match banner, hides organizing tabs, and blocks ratings', async () => {
    render(
      <MatchDetailPage
        match={{
          ...baseMatch,
          status: 'CANCELLED',
          cancelledAt: '2026-07-30T18:30:00.000Z',
          cancelledByType: 'USER',
          cancelledByName: 'Federico',
        }}
        unlinkedBookings={[]}
      />,
    );

    expect(screen.getByText(/partido cancelado/i)).toBeTruthy();
    expect(screen.getByText(/cancelado por federico/i)).toBeTruthy();
    expect(screen.queryByRole('tab', { name: /jugadores/i })).toBeFalsy();
    expect(screen.queryByRole('tab', { name: /gestión/i })).toBeFalsy();
    expect(screen.getByRole('tab', { name: /^chat$/i })).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: /valoraciones/i }));
    await waitFor(() => expect(screen.getByText(/este partido fue cancelado y no admite valoraciones/i)).toBeTruthy());
  });

  it('shows an automatic-system message when the match was cancelled without a user', () => {
    render(
      <MatchDetailPage
        match={{ ...baseMatch, status: 'CANCELLED', cancelledAt: '2026-07-30T18:30:00.000Z', cancelledByType: 'SYSTEM', cancelledByName: null }}
        unlinkedBookings={[]}
      />,
    );

    expect(screen.getByText(/actualizado automáticamente por el sistema/i)).toBeTruthy();
  });

  it('shows the availability window and a pending message when no exact time was confirmed yet', () => {
    render(<MatchDetailPage match={{ ...baseMatch, startsAt: null, endsAt: null }} unlinkedBookings={[]} />);

    expect(screen.getByText(/horario pendiente de confirmación/i)).toBeTruthy();
    expect(screen.getByText(/franja elegida: 17:00–22:00/i)).toBeTruthy();
  });

  it('shows the confirmed start/end time once a time was set', () => {
    render(<MatchDetailPage match={baseMatch} unlinkedBookings={[]} />);

    expect(screen.getByText(/horario confirmado/i)).toBeTruthy();
    expect(screen.getAllByText('16:00 a 18:00').length).toBeGreaterThan(0);
  });

  it('editing the schedule sends the updated day, franja and exact time, and recalculates the display', async () => {
    const onEditSchedule = vi.fn().mockResolvedValue(undefined);
    render(<MatchDetailPage match={{ ...baseMatch, startsAt: null, endsAt: null }} unlinkedBookings={[]} onEditSchedule={onEditSchedule} />);

    fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));

    await waitFor(() =>
      expect(onEditSchedule).toHaveBeenCalledWith({
        venueType: 'CLUB',
        clubId: 'club-1',
        customVenueName: null,
        scheduledDate: '2026-08-05',
        availabilityStartMinutes: 17 * 60,
        availabilityEndMinutes: 22 * 60,
        durationMinutes: 60,
        startsAt: null,
      }),
    );
  });

  it('shows an inline error when saving the schedule fails, without crashing', async () => {
    const onEditSchedule = vi.fn().mockRejectedValue(new Error('El horario elegido no entra dentro de la franja disponible.'));
    render(<MatchDetailPage match={baseMatch} unlinkedBookings={[]} onEditSchedule={onEditSchedule} />);

    fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));

    await waitFor(() => expect(screen.getByText(/el horario elegido no entra dentro de la franja disponible/i)).toBeTruthy());
  });

  it.each(['IN_PROGRESS', 'EXPIRED', 'COMPLETED'] as const)(
    'shows the schedule form as read-only (fields disabled, Guardar/Cancelar disabled) for %s',
    (status) => {
      render(<MatchDetailPage match={{ ...baseMatch, status }} unlinkedBookings={[]} />);

      expect(screen.getByLabelText(/^editar sede$/i)).toHaveProperty('disabled', true);
      expect(screen.getByLabelText(/^editar día$/i)).toHaveProperty('disabled', true);
      expect(screen.getByLabelText(/duración del partido/i)).toHaveProperty('disabled', true);
      expect(screen.getByRole('button', { name: /^guardar cambios$/i })).toHaveProperty('disabled', true);
      expect(screen.getByRole('button', { name: /cancelar partido/i })).toHaveProperty('disabled', true);
    },
  );

  it('shows the IN_PROGRESS read-only message', () => {
    render(<MatchDetailPage match={{ ...baseMatch, status: 'IN_PROGRESS' }} unlinkedBookings={[]} />);
    expect(screen.getAllByText(/este partido está en juego y no puede modificarse/i).length).toBeGreaterThan(0);
  });

  it('shows the EXPIRED read-only message', () => {
    render(<MatchDetailPage match={{ ...baseMatch, status: 'EXPIRED' }} unlinkedBookings={[]} />);
    expect(screen.getAllByText(/este partido venció y ya no puede modificarse/i).length).toBeGreaterThan(0);
  });

  it('shows the COMPLETED read-only message', () => {
    render(<MatchDetailPage match={{ ...baseMatch, status: 'COMPLETED' }} unlinkedBookings={[]} />);
    expect(screen.getAllByText(/este partido finalizó y ya no puede modificarse/i).length).toBeGreaterThan(0);
  });

  it('keeps the schedule form fully enabled while ORGANIZING or FULL', async () => {
    render(<MatchDetailPage match={baseMatch} unlinkedBookings={[]} />);

    expect(await screen.findByLabelText(/^editar sede$/i)).toHaveProperty('disabled', false);
    expect(screen.getByRole('button', { name: /cancelar partido/i })).toHaveProperty('disabled', false);
  });

  it('does not offer "Buscar jugadores" once the match is IN_PROGRESS/EXPIRED/COMPLETED', async () => {
    render(<MatchDetailPage match={{ ...baseMatch, status: 'IN_PROGRESS' }} unlinkedBookings={[]} />);

    fireEvent.click(screen.getByRole('tab', { name: /jugadores/i }));
    await screen.findByText('👑 Organizador');
    expect(screen.queryByRole('button', { name: /buscar jugadores/i })).toBeFalsy();
  });
});
