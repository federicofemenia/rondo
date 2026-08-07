import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminClubSummaryDto } from '@rondo/contracts';
import AdminDashboardPage from '../src/AdminDashboardPage';
import { mockAuthState, mockAdminClubs } from './setup';
import { renderWithAuth } from './testUtils';

// useAdminClubs only fetches while signed in -- this page is only ever
// reached authenticated in the real app.
beforeEach(() => {
  mockAuthState.authenticated = true;
});

function fixtureClub(overrides: Partial<AdminClubSummaryDto> = {}): AdminClubSummaryDto {
  return {
    id: 'club-1',
    name: 'Club Señor Pato',
    city: 'CABA',
    isActive: true,
    courtsCount: 3,
    myRole: 'CLUB_ADMIN',
    ...overrides,
  };
}

describe('AdminDashboardPage', () => {
  it('shows an empty state when the user has no administrable clubs', async () => {
    renderWithAuth(<AdminDashboardPage />);

    expect(await screen.findByText(/todavía no administrás ningún club/i)).toBeTruthy();
  });

  it('lists administrable clubs with their status, court count and role', async () => {
    mockAdminClubs.push(fixtureClub());

    renderWithAuth(<AdminDashboardPage />);

    expect(await screen.findByText('Club Señor Pato')).toBeTruthy();
    expect(screen.getByText('CABA')).toBeTruthy();
    expect(screen.getByText('Activo')).toBeTruthy();
    expect(screen.getByText('3 canchas')).toBeTruthy();
    expect(screen.getByText('Administrador')).toBeTruthy();
  });

  it('shows Crear club for a SUPERADMIN', async () => {
    mockAdminClubs.push(fixtureClub({ myRole: 'SUPERADMIN' }));

    renderWithAuth(<AdminDashboardPage />);

    await screen.findByText('Club Señor Pato');
    expect(screen.getByRole('button', { name: /crear club/i })).toBeTruthy();
  });

  it('hides Crear club for a CLUB_ADMIN', async () => {
    mockAdminClubs.push(fixtureClub({ myRole: 'CLUB_ADMIN' }));

    renderWithAuth(<AdminDashboardPage />);

    await screen.findByText('Club Señor Pato');
    expect(screen.queryByRole('button', { name: /crear club/i })).toBeFalsy();
  });

  it('opens the selected club when its card is clicked', async () => {
    mockAdminClubs.push(fixtureClub());
    const onOpenClub = vi.fn();

    renderWithAuth(<AdminDashboardPage onOpenClub={onOpenClub} />);

    fireEvent.click(await screen.findByText('Club Señor Pato'));
    expect(onOpenClub).toHaveBeenCalledWith('club-1');
  });

  it('creates a new club and opens it, as a SUPERADMIN', async () => {
    mockAdminClubs.push(fixtureClub({ myRole: 'SUPERADMIN' }));
    const onOpenClub = vi.fn();

    renderWithAuth(<AdminDashboardPage onOpenClub={onOpenClub} />);

    fireEvent.click(await screen.findByRole('button', { name: /crear club/i }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/^nombre/i), { target: { value: 'Nuevo Club De Prueba' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /^crear club$/i }));

    await waitFor(() => expect(onOpenClub).toHaveBeenCalled());
  });

  it('calls onBack when the back button is clicked', async () => {
    const onBack = vi.fn();
    renderWithAuth(<AdminDashboardPage onBack={onBack} />);

    await screen.findByText(/todavía no administrás ningún club/i);
    fireEvent.click(screen.getByLabelText(/volver/i));
    expect(onBack).toHaveBeenCalled();
  });
});
