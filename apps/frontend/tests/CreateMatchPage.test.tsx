import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CreateMatchPage from '../src/CreateMatchPage';
import { buildDayOptions } from '../src/dateOptions';

describe('CreateMatchPage', () => {
  it('renders the deportiva and logistica blocks', async () => {
    render(<CreateMatchPage />);

    expect(screen.getByRole('heading', { name: /armar partido/i })).toBeTruthy();
    expect(screen.getByText(/información deportiva/i)).toBeTruthy();
    expect(screen.getByText(/información logística/i)).toBeTruthy();
    expect(screen.getByLabelText(/^deporte$/i)).toBeTruthy();
    expect(screen.getByLabelText(/modalidad/i)).toBeTruthy();
    expect(screen.getByLabelText(/jugadores mínimo/i)).toBeTruthy();
    expect(screen.getByLabelText(/jugadores máximo/i)).toBeTruthy();
    expect(screen.getByLabelText(/^club \(opcional\)$/i)).toBeTruthy();
    expect(screen.getByLabelText(/^día$/i)).toBeTruthy();
    expect(screen.getAllByText(/sin definir/i).length).toBeGreaterThan(0);

    await screen.findByText('Delantero');
  });

  it('only shows posiciones requeridas for fútbol', async () => {
    render(<CreateMatchPage />);

    await screen.findByText(/posiciones requeridas/i);

    fireEvent.change(screen.getByLabelText(/^deporte$/i), { target: { value: 'Pádel' } });

    expect(screen.queryByText(/posiciones requeridas/i)).toBeFalsy();
  });

  it('submits the match draft with a required day and optional horario/cancha left empty', async () => {
    const onCreateMatch = vi.fn();
    render(<CreateMatchPage onCreateMatch={onCreateMatch} />);

    fireEvent.click(await screen.findByText('Delantero'));
    fireEvent.click(screen.getByRole('button', { name: /^armar partido$/i }));

    const expectedDate = buildDayOptions()[0]!.value;

    expect(onCreateMatch).toHaveBeenCalledWith({
      sport: 'Fútbol',
      modality: 'Fútbol 5',
      minPlayers: '4',
      maxPlayers: '10',
      positions: ['Delantero'],
      clubName: null,
      courtName: null,
      date: expectedDate,
      time: null,
    });
  });

  it('includes the club when one is selected, and the estimated time range when the switch is enabled', async () => {
    const onCreateMatch = vi.fn();
    render(<CreateMatchPage onCreateMatch={onCreateMatch} />);

    await screen.findByText('Delantero');

    fireEvent.change(screen.getByLabelText(/^club \(opcional\)$/i), { target: { value: 'Club Señor Pato' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /horario estimado/i }));
    fireEvent.click(screen.getByRole('button', { name: /^armar partido$/i }));

    expect(onCreateMatch).toHaveBeenCalledWith(
      expect.objectContaining({
        clubName: 'Club Señor Pato',
        time: '13:00 - 19:00',
      }),
    );
  });
});
