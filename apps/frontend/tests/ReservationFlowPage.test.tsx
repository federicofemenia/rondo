import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ReservationFlowPage from '../src/ReservationFlowPage';

describe('ReservationFlowPage', () => {
  it('renders the day and time agenda with a default selection', () => {
    render(<ReservationFlowPage />);

    expect(screen.getByText(/elegí día y horario/i)).toBeTruthy();
    expect(screen.getByText(/elegí un horario/i)).toBeTruthy();
    expect(screen.getByText(/seleccioná el día/i)).toBeTruthy();
    expect(screen.getAllByText(/disponible/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/seleccionado/i)).toBeTruthy();
  });

  it('calls onBack when the back button is clicked', () => {
    const onBack = vi.fn();
    render(<ReservationFlowPage onBack={onBack} />);

    fireEvent.click(screen.getByRole('button', { name: /volver/i }));

    expect(onBack).toHaveBeenCalled();
  });

  it('updates the selected slot when an available cell is clicked', () => {
    render(<ReservationFlowPage />);

    fireEvent.click(screen.getByRole('button', { name: /cancha 1 09:00 disponible/i }));

    expect(screen.getByText(/cancha 1 • panorámica/i)).toBeTruthy();
  });

  it('calls onConfirm with the selected slot when continuar is clicked', () => {
    const onConfirm = vi.fn();
    render(<ReservationFlowPage onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));

    expect(onConfirm).toHaveBeenCalledWith({
      courtName: 'Cancha 2',
      courtSubtitle: 'Vidrio',
      dateLabel: 'Mié 28 May',
      time: '10:00',
    });
  });

  it('shows the contextLabel when launched from a match', () => {
    render(<ReservationFlowPage contextLabel="Para tu partido de Fútbol" />);

    expect(screen.getByText(/para tu partido de fútbol/i)).toBeTruthy();
  });
});
