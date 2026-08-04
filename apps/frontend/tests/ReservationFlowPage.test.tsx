import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ReservationFlowPage from '../src/ReservationFlowPage';

describe('ReservationFlowPage', () => {
  it('renders the day and time agenda with a default selection', () => {
    render(<ReservationFlowPage clubName="Club Señor Pato" />);

    expect(screen.getByText(/elegí día y horario/i)).toBeTruthy();
    expect(screen.getByText(/elegí un horario/i)).toBeTruthy();
    expect(screen.getByText(/seleccioná el día/i)).toBeTruthy();
    expect(screen.getAllByText(/disponible/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/seleccionado/i)).toBeTruthy();
  });

  it('calls onBack when the back button is clicked', () => {
    const onBack = vi.fn();
    render(<ReservationFlowPage clubName="Club Señor Pato" onBack={onBack} />);

    fireEvent.click(screen.getByRole('button', { name: /volver/i }));

    expect(onBack).toHaveBeenCalled();
  });

  it('updates the selected slot when an available cell is clicked', () => {
    render(<ReservationFlowPage clubName="Club Señor Pato" />);

    fireEvent.click(screen.getByRole('button', { name: /cancha 1 09:00 disponible/i }));

    expect(screen.getByText(/cancha 1 • panorámica/i)).toBeTruthy();
  });

  it('calls onConfirm with the selected slot and club when continuar is clicked', () => {
    const onConfirm = vi.fn();
    render(<ReservationFlowPage clubName="Club Señor Pato" onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));

    expect(onConfirm).toHaveBeenCalledWith({
      clubName: 'Club Señor Pato',
      courtName: 'Cancha 2',
      courtSubtitle: 'Vidrio',
      dateLabel: 'Mié 28 May',
      time: '10:00',
    });
  });

  it('shows the contextLabel when launched from a match', () => {
    render(<ReservationFlowPage clubName="Club Señor Pato" contextLabel="Para tu partido de Fútbol" />);

    expect(screen.getByText(/para tu partido de fútbol/i)).toBeTruthy();
  });

  it('shows a not-associated-with-a-club message instead of the booking flow when there is no club, with no empty court selectors and a disabled Buscar club action', () => {
    const onConfirm = vi.fn();
    render(<ReservationFlowPage clubName={null} onConfirm={onConfirm} />);

    expect(screen.getByText(/no estás asociado a ningún club/i)).toBeTruthy();
    expect(screen.getByText(/para reservar una cancha primero necesitás pertenecer a un club/i)).toBeTruthy();
    expect(screen.queryByText(/elegí día y horario/i)).toBeFalsy();
    expect(screen.queryByRole('button', { name: /continuar/i })).toBeFalsy();
    expect(screen.queryByText(/cancha 1|cancha 2|cancha 3/i)).toBeFalsy();
    expect(screen.getByRole('button', { name: /buscar club/i })).toHaveProperty('disabled', true);
  });

  it('still lets the user go back when there is no club', () => {
    const onBack = vi.fn();
    render(<ReservationFlowPage clubName={null} onBack={onBack} />);

    fireEvent.click(screen.getByRole('button', { name: /volver/i }));

    expect(onBack).toHaveBeenCalled();
  });
});
