import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import InvitationsPage from '../src/InvitationsPage';

describe('InvitationsPage', () => {
  it('shows an empty state when no one was invited yet', () => {
    render(<InvitationsPage />);

    expect(screen.getByRole('heading', { name: /^candidatos$/i })).toBeTruthy();
    expect(screen.getByText(/todavía no invitaste a ningún candidato/i)).toBeTruthy();
  });

  it('renders every invited candidate as a read-only status, without accept/decline actions', () => {
    render(
      <InvitationsPage
        invitedCandidates={['Mauro', 'Lina', 'Tomás']}
        participants={['Lina']}
        declinedCandidates={['Tomás']}
      />,
    );

    expect(screen.getByText('Mauro')).toBeTruthy();
    expect(screen.getByText('Lina')).toBeTruthy();
    expect(screen.getByText('Tomás')).toBeTruthy();
    expect(screen.getByText(/pendiente de confirmación/i)).toBeTruthy();
    expect(screen.getByText(/^aceptado$/i)).toBeTruthy();
    expect(screen.getByText(/^rechazado$/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /aceptar/i })).toBeFalsy();
    expect(screen.queryByRole('button', { name: /rechazar/i })).toBeFalsy();
  });
});
