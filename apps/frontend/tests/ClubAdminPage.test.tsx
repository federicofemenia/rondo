import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AdminClubDetailDto, AdminUserSearchResultDto, ClubAdminUserDto, CourtAdminDto } from '@rondo/contracts';
import ClubAdminPage from '../src/ClubAdminPage';
import {
  mockAdminAccessDeniedClubIds,
  mockAdminAdminsByClubId,
  mockAdminClubDetails,
  mockAdminCourtsByClubId,
  mockAdminUserSearchResults,
} from './setup';

const CLUB_ID = 'club-1';

function seedClub(overrides: Partial<AdminClubDetailDto> = {}): void {
  mockAdminClubDetails.set(CLUB_ID, {
    id: CLUB_ID,
    name: 'Club Señor Pato',
    description: 'La casa del pádel',
    city: 'CABA',
    address: 'Av. Siempre Viva 123',
    isActive: true,
    activeCourtsCount: 1,
    activeAdminsCount: 1,
    myRole: 'CLUB_ADMIN',
    ...overrides,
  });
}

function seedCourt(overrides: Partial<CourtAdminDto> = {}): CourtAdminDto {
  const court: CourtAdminDto = {
    id: 'court-1',
    name: 'Cancha 1',
    sportModalityId: 'modality-padel-doubles',
    sportName: 'Pádel',
    modalityName: 'Dobles',
    description: null,
    isActive: true,
    ...overrides,
  };
  mockAdminCourtsByClubId.set(CLUB_ID, [court]);
  return court;
}

function seedAdmin(overrides: Partial<ClubAdminUserDto> = {}): ClubAdminUserDto {
  const admin: ClubAdminUserDto = { id: 'user-1', displayName: 'Juan Pérez', username: 'juan', avatarUrl: null, ...overrides };
  mockAdminAdminsByClubId.set(CLUB_ID, [admin]);
  return admin;
}

describe('ClubAdminPage', () => {
  it('shows an access-denied error for a club the user cannot administer', async () => {
    mockAdminAccessDeniedClubIds.add(CLUB_ID);

    render(<ClubAdminPage clubId={CLUB_ID} />);

    expect(await screen.findByText(/no tenés permisos para administrar este club/i)).toBeTruthy();
  });

  it('shows the club summary, with courts and admins counts', async () => {
    seedClub();
    mockAdminCourtsByClubId.set(CLUB_ID, []);
    mockAdminAdminsByClubId.set(CLUB_ID, []);

    render(<ClubAdminPage clubId={CLUB_ID} />);

    expect(await screen.findByRole('heading', { name: /club señor pato/i })).toBeTruthy();
    expect(screen.getByText('La casa del pádel')).toBeTruthy();
    expect(screen.getByText('CABA')).toBeTruthy();
    expect(screen.getByText('Activo')).toBeTruthy();
  });

  it('lets a CLUB_ADMIN edit description/city/address but not the name', async () => {
    seedClub({ myRole: 'CLUB_ADMIN' });
    mockAdminCourtsByClubId.set(CLUB_ID, []);
    mockAdminAdminsByClubId.set(CLUB_ID, []);

    render(<ClubAdminPage clubId={CLUB_ID} />);

    fireEvent.click(await screen.findByRole('button', { name: /^editar$/i }));

    const nameField = screen.getByLabelText(/^nombre/i) as HTMLInputElement;
    expect(nameField.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText(/^localidad/i), { target: { value: 'Rosario' } });
    fireEvent.click(screen.getByRole('button', { name: /^guardar$/i }));

    await waitFor(() => expect(screen.getByText('Rosario')).toBeTruthy());
  });

  it('does not show the activate/deactivate club action to a CLUB_ADMIN', async () => {
    seedClub({ myRole: 'CLUB_ADMIN' });
    mockAdminCourtsByClubId.set(CLUB_ID, []);
    mockAdminAdminsByClubId.set(CLUB_ID, []);

    render(<ClubAdminPage clubId={CLUB_ID} />);

    await screen.findByRole('heading', { name: /club señor pato/i });
    expect(screen.queryByRole('button', { name: /desactivar club/i })).toBeFalsy();
  });

  it('lets a SUPERADMIN deactivate the club after confirming', async () => {
    seedClub({ myRole: 'SUPERADMIN' });
    mockAdminCourtsByClubId.set(CLUB_ID, []);
    mockAdminAdminsByClubId.set(CLUB_ID, []);

    render(<ClubAdminPage clubId={CLUB_ID} />);

    fireEvent.click(await screen.findByRole('button', { name: /desactivar club/i }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /^desactivar$/i }));

    await waitFor(() => expect(screen.getAllByText('Inactivo').length).toBeGreaterThan(0));
  });

  it('shows an empty state for canchas and creates a new court', async () => {
    seedClub();
    mockAdminCourtsByClubId.set(CLUB_ID, []);
    mockAdminAdminsByClubId.set(CLUB_ID, []);

    render(<ClubAdminPage clubId={CLUB_ID} />);

    await screen.findByRole('heading', { name: /club señor pato/i });
    fireEvent.click(screen.getByRole('tab', { name: /canchas/i }));

    expect(screen.getByText(/todavía no tiene canchas configuradas/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /agregar cancha/i }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/^nombre/i), { target: { value: 'Cancha Nueva' } });
    fireEvent.change(within(dialog).getByLabelText(/modalidad/i), { target: { value: 'modality-padel-doubles' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /guardar/i }));

    await waitFor(() => expect(screen.getByText('Cancha Nueva')).toBeTruthy());
  });

  it('edits and deactivates an existing court', async () => {
    seedClub();
    seedCourt();
    mockAdminAdminsByClubId.set(CLUB_ID, []);

    render(<ClubAdminPage clubId={CLUB_ID} />);

    await screen.findByRole('heading', { name: /club señor pato/i });
    fireEvent.click(screen.getByRole('tab', { name: /canchas/i }));

    expect(await screen.findByText('Cancha 1')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^desactivar$/i }));

    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /^desactivar$/i }));

    await waitFor(() => expect(screen.getByText('Inactiva')).toBeTruthy());
  });

  it('lists admins, and a CLUB_ADMIN cannot add or remove them', async () => {
    seedClub({ myRole: 'CLUB_ADMIN' });
    mockAdminCourtsByClubId.set(CLUB_ID, []);
    seedAdmin();

    render(<ClubAdminPage clubId={CLUB_ID} />);

    await screen.findByRole('heading', { name: /club señor pato/i });
    fireEvent.click(screen.getByRole('tab', { name: /administradores/i }));

    expect(await screen.findByText('Juan Pérez')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /agregar administrador/i })).toBeFalsy();
    expect(screen.queryByLabelText(/quitar a juan pérez/i)).toBeFalsy();
  });

  it('lets a SUPERADMIN search and assign a new admin', async () => {
    seedClub({ myRole: 'SUPERADMIN' });
    mockAdminCourtsByClubId.set(CLUB_ID, []);
    mockAdminAdminsByClubId.set(CLUB_ID, []);
    mockAdminUserSearchResults.push({ id: 'user-2', displayName: 'Ana Torres', username: 'ana', avatarUrl: null } satisfies AdminUserSearchResultDto);

    render(<ClubAdminPage clubId={CLUB_ID} />);

    await screen.findByRole('heading', { name: /club señor pato/i });
    fireEvent.click(screen.getByRole('tab', { name: /administradores/i }));

    fireEvent.click(screen.getByRole('button', { name: /agregar administrador/i }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/buscar por nombre o usuario/i), { target: { value: 'Ana' } });

    fireEvent.click(await within(dialog).findByRole('button', { name: /asignar/i }));

    await waitFor(() => expect(screen.getByText('Ana Torres')).toBeTruthy());
  });

  it('lets a SUPERADMIN remove an admin after confirming', async () => {
    seedClub({ myRole: 'SUPERADMIN' });
    mockAdminCourtsByClubId.set(CLUB_ID, []);
    seedAdmin();

    render(<ClubAdminPage clubId={CLUB_ID} />);

    await screen.findByRole('heading', { name: /club señor pato/i });
    fireEvent.click(screen.getByRole('tab', { name: /administradores/i }));

    fireEvent.click(await screen.findByLabelText(/quitar a juan pérez/i));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /^quitar$/i }));

    await waitFor(() => expect(screen.queryByText('Juan Pérez')).toBeFalsy());
  });

  it('calls onBack when the back button is clicked', async () => {
    seedClub();
    mockAdminCourtsByClubId.set(CLUB_ID, []);
    mockAdminAdminsByClubId.set(CLUB_ID, []);
    const onBack = vi.fn();

    render(<ClubAdminPage clubId={CLUB_ID} onBack={onBack} />);

    fireEvent.click(await screen.findByLabelText(/volver/i));
    expect(onBack).toHaveBeenCalled();
  });
});
