import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import InvitationsPage from '../src/InvitationsPage';

describe('InvitationsPage', () => {
  it('renders pending invitations and actions', () => {
    render(<InvitationsPage />);

    expect(screen.getByRole('heading', { name: /candidatos pendientes/i })).toBeTruthy();
    expect(screen.getAllByText(/aceptar/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/rechazar/i).length).toBeGreaterThan(0);
  });
});
