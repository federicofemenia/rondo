import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SportProfilePage from '../src/SportProfilePage';
import { mockSportProfileFailingSportIds, mockSportProfiles } from './setup';

async function waitForSportsLoaded() {
  await screen.findByRole('option', { name: 'Pádel' });
}

async function addSport(sportName: string) {
  await waitForSportsLoaded();
  fireEvent.change(screen.getByLabelText(/^deporte$/i), { target: { value: sportName === 'Fútbol' ? 'sport-football' : 'sport-padel' } });
  fireEvent.click(screen.getByRole('button', { name: /^agregar$/i }));
}

describe('SportProfilePage', () => {
  it('loads existing sport profiles, including positions, invitation availability and weekly slots', async () => {
    mockSportProfiles.push({
      id: 'profile-1',
      sportId: 'sport-football',
      sportName: 'Fútbol',
      positions: ['Defensor'],
      isAvailableForInvitations: true,
      availability: [{ id: 'slot-1', dayOfWeek: 1, startMinutes: 1080, endMinutes: 1320 }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    render(<SportProfilePage />);

    expect(await screen.findByText(/^fútbol$/i)).toBeTruthy();
    expect(screen.getByText('Defensor').closest('[role="button"], .MuiChip-root')).toBeTruthy();
    expect(screen.getByText('18:00 - 22:00')).toBeTruthy();
  });

  it('shows an empty state when the user has no sport profiles yet', async () => {
    render(<SportProfilePage />);

    expect(await screen.findByText(/todavía no configuraste ningún deporte/i)).toBeTruthy();
  });

  it('lets the user select a sport to add to their profile', async () => {
    render(<SportProfilePage />);
    await screen.findByText(/todavía no configuraste ningún deporte/i);

    await addSport('Pádel');

    expect(await screen.findByText(/^pádel$/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /^cancelar$/i })).toBeTruthy();
    expect(screen.queryByText(/^posiciones$/i)).toBeFalsy();
  });

  it('lets the user select one or more positions for a sport that supports them', async () => {
    render(<SportProfilePage />);
    await screen.findByText(/todavía no configuraste ningún deporte/i);
    await addSport('Fútbol');

    expect(await screen.findByText(/^posiciones$/i)).toBeTruthy();
    fireEvent.click(screen.getByText('Delantero'));
    fireEvent.click(screen.getByText('Defensor'));
    fireEvent.click(screen.getByRole('button', { name: /^guardar$/i }));

    await waitFor(() => expect(mockSportProfiles.find((profile) => profile.sportId === 'sport-football')?.positions).toEqual(['Delantero', 'Defensor']));
  });

  it('toggles invitation availability on and off', async () => {
    render(<SportProfilePage />);
    await screen.findByText(/todavía no configuraste ningún deporte/i);
    await addSport('Pádel');

    const toggle = await screen.findByLabelText<HTMLInputElement>(/disponible para recibir invitaciones en pádel/i);
    expect(toggle.checked).toBe(true);

    fireEvent.click(toggle);
    expect(toggle.checked).toBe(false);

    fireEvent.click(toggle);
    expect(toggle.checked).toBe(true);
  });

  it('adds weekly availability slots, converting the selected times to minutes', async () => {
    render(<SportProfilePage />);
    await screen.findByText(/todavía no configuraste ningún deporte/i);
    await addSport('Pádel');

    fireEvent.change(await screen.findByLabelText(/^día$/i), { target: { value: '6' } });
    fireEvent.change(screen.getByLabelText(/^desde$/i), { target: { value: '10:00' } });
    fireEvent.change(screen.getByLabelText(/^hasta$/i), { target: { value: '14:00' } });
    fireEvent.click(screen.getByRole('button', { name: /^agregar franja$/i }));

    expect(await screen.findByText('10:00 - 14:00')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /^guardar$/i }));

    await waitFor(() => {
      const profile = mockSportProfiles.find((candidate) => candidate.sportId === 'sport-padel');
      expect(profile?.availability).toEqual([{ id: expect.any(String), dayOfWeek: 6, startMinutes: 600, endMinutes: 840 }]);
    });
  });

  it('removes a weekly availability slot', async () => {
    render(<SportProfilePage />);
    await screen.findByText(/todavía no configuraste ningún deporte/i);
    await addSport('Pádel');

    fireEvent.change(await screen.findByLabelText(/^día$/i), { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: /^agregar franja$/i }));
    expect(await screen.findByText('18:00 - 22:00')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /eliminar franja de sábado/i }));

    expect(screen.queryByText('18:00 - 22:00')).toBeFalsy();
  });

  it('adds a second slot to a profile that already has one, and persists both after leaving and returning', async () => {
    mockSportProfiles.push({
      id: 'profile-existing',
      sportId: 'sport-padel',
      sportName: 'Pádel',
      positions: [],
      isAvailableForInvitations: true,
      availability: [{ id: 'slot-existing', dayOfWeek: 1, startMinutes: 600, endMinutes: 660 }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const { unmount } = render(<SportProfilePage />);
    expect(await screen.findByText('10:00 - 11:00')).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/^día$/i), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText(/^desde$/i), { target: { value: '18:00' } });
    fireEvent.change(screen.getByLabelText(/^hasta$/i), { target: { value: '20:00' } });
    fireEvent.click(screen.getByRole('button', { name: /^agregar franja$/i }));

    // Both the pre-existing and the newly-added slot must still be visible
    // locally right after adding, before Guardar is even pressed.
    expect(screen.getByText('10:00 - 11:00')).toBeTruthy();
    expect(screen.getByText('18:00 - 20:00')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /^guardar$/i }));
    await screen.findByText(/perfil deportivo guardado/i);

    await waitFor(() => {
      const profile = mockSportProfiles.find((candidate) => candidate.sportId === 'sport-padel');
      expect(profile?.availability).toHaveLength(2);
    });

    // Simulate leaving and returning: unmount and render a fresh instance,
    // which forces a real refetch instead of reusing in-memory component state.
    unmount();
    render(<SportProfilePage />);

    expect(await screen.findByText('10:00 - 11:00')).toBeTruthy();
    expect(screen.getByText('18:00 - 20:00')).toBeTruthy();
  });

  it('saves multiple slots added in the same session', async () => {
    render(<SportProfilePage />);
    await screen.findByText(/todavía no configuraste ningún deporte/i);
    await addSport('Pádel');

    fireEvent.change(await screen.findByLabelText(/^día$/i), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText(/^desde$/i), { target: { value: '10:00' } });
    fireEvent.change(screen.getByLabelText(/^hasta$/i), { target: { value: '12:00' } });
    fireEvent.click(screen.getByRole('button', { name: /^agregar franja$/i }));

    fireEvent.change(screen.getByLabelText(/^día$/i), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText(/^desde$/i), { target: { value: '18:00' } });
    fireEvent.change(screen.getByLabelText(/^hasta$/i), { target: { value: '20:00' } });
    fireEvent.click(screen.getByRole('button', { name: /^agregar franja$/i }));

    expect(screen.getByText('10:00 - 12:00')).toBeTruthy();
    expect(screen.getByText('18:00 - 20:00')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /^guardar$/i }));

    await waitFor(() => {
      const profile = mockSportProfiles.find((candidate) => candidate.sportId === 'sport-padel');
      expect(profile?.availability).toHaveLength(2);
    });
  });

  it('rejects an exact duplicate slot', async () => {
    render(<SportProfilePage />);
    await screen.findByText(/todavía no configuraste ningún deporte/i);
    await addSport('Pádel');

    fireEvent.change(await screen.findByLabelText(/^día$/i), { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: /^agregar franja$/i }));
    expect(await screen.findByText('18:00 - 22:00')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /^agregar franja$/i }));

    expect(await screen.findByText(/se superpone/i)).toBeTruthy();
    expect(screen.getAllByText('18:00 - 22:00')).toHaveLength(1);
  });

  it('shows an error when adding an overlapping slot', async () => {
    render(<SportProfilePage />);
    await screen.findByText(/todavía no configuraste ningún deporte/i);
    await addSport('Pádel');

    fireEvent.change(await screen.findByLabelText(/^día$/i), { target: { value: '6' } });
    fireEvent.change(screen.getByLabelText(/^desde$/i), { target: { value: '10:00' } });
    fireEvent.change(screen.getByLabelText(/^hasta$/i), { target: { value: '14:00' } });
    fireEvent.click(screen.getByRole('button', { name: /^agregar franja$/i }));

    fireEvent.change(screen.getByLabelText(/^desde$/i), { target: { value: '12:00' } });
    fireEvent.change(screen.getByLabelText(/^hasta$/i), { target: { value: '16:00' } });
    fireEvent.click(screen.getByRole('button', { name: /^agregar franja$/i }));

    expect(await screen.findByText(/se superpone/i)).toBeTruthy();
  });

  it('saves a new sport profile', async () => {
    render(<SportProfilePage />);
    await screen.findByText(/todavía no configuraste ningún deporte/i);
    await addSport('Pádel');

    fireEvent.click(screen.getByRole('button', { name: /^guardar$/i }));

    expect(await screen.findByText(/perfil deportivo guardado/i)).toBeTruthy();
    expect(mockSportProfiles.some((profile) => profile.sportId === 'sport-padel')).toBe(true);
  });

  it('edits an existing sport profile', async () => {
    mockSportProfiles.push({
      id: 'profile-2',
      sportId: 'sport-padel',
      sportName: 'Pádel',
      positions: [],
      isAvailableForInvitations: true,
      availability: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    render(<SportProfilePage />);
    const toggle = await screen.findByLabelText(/disponible para recibir invitaciones en pádel/i);
    fireEvent.click(toggle);

    fireEvent.click(screen.getByRole('button', { name: /^guardar$/i }));

    await waitFor(() => expect(mockSportProfiles.find((profile) => profile.sportId === 'sport-padel')?.isAvailableForInvitations).toBe(false));
  });

  it('deletes a sport profile', async () => {
    mockSportProfiles.push({
      id: 'profile-3',
      sportId: 'sport-padel',
      sportName: 'Pádel',
      positions: [],
      isAvailableForInvitations: true,
      availability: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    render(<SportProfilePage />);
    await screen.findByText(/^pádel$/i);

    fireEvent.click(screen.getByRole('button', { name: /eliminar pádel de tu perfil/i }));

    await waitFor(() => expect(screen.queryByRole('button', { name: /eliminar pádel de tu perfil/i })).toBeFalsy());
    expect(mockSportProfiles.some((profile) => profile.sportId === 'sport-padel')).toBe(false);
  });

  it('shows the backend error message when saving fails', async () => {
    mockSportProfileFailingSportIds.add('sport-padel');

    render(<SportProfilePage />);
    await screen.findByText(/todavía no configuraste ningún deporte/i);
    await addSport('Pádel');

    fireEvent.click(screen.getByRole('button', { name: /^guardar$/i }));

    expect(await screen.findByText(/ocurrió un error inesperado/i)).toBeTruthy();
  });
});
