import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import NoClubMembershipCard from '../src/NoClubMembershipCard';

describe('NoClubMembershipCard', () => {
  it('shows the default informational copy, not styled as an error', () => {
    render(<NoClubMembershipCard />);

    expect(screen.getByText('Clubes')).toBeTruthy();
    expect(screen.getByText(/todavía no estás asociado a ningún club/i)).toBeTruthy();
    expect(screen.getByText(/podés seguir creando partidos con "sede a definir" u "otro"/i)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeFalsy();
  });

  it('accepts a custom title and description for other contexts (e.g. reservations)', () => {
    render(<NoClubMembershipCard title="No estás asociado a ningún club" description="Para reservar una cancha primero necesitás pertenecer a un club." />);

    expect(screen.getByText('No estás asociado a ningún club')).toBeTruthy();
    expect(screen.getByText('Para reservar una cancha primero necesitás pertenecer a un club.')).toBeTruthy();
  });

  it('shows a disabled Buscar club (Próximamente) action that never opens a real search', () => {
    render(<NoClubMembershipCard />);

    const button = screen.getByRole('button', { name: /buscar club/i });
    expect(button).toHaveProperty('disabled', true);
    expect(screen.getByText(/próximamente/i)).toBeTruthy();
  });

  it('does not show a pending-request note by default', () => {
    render(<NoClubMembershipCard />);

    expect(screen.queryByText(/solicitud de asociación pendiente/i)).toBeFalsy();
  });

  it('shows the pending-request note when hasPendingRequest is true', () => {
    render(<NoClubMembershipCard hasPendingRequest />);

    expect(screen.getByText(/tenés una solicitud de asociación pendiente/i)).toBeTruthy();
  });
});
