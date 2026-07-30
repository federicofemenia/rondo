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

  it('submits the match draft with a required day and franja, and no exact time by default', async () => {
    const onCreateMatch = vi.fn();
    render(<CreateMatchPage onCreateMatch={onCreateMatch} />);

    fireEvent.click(await screen.findByText('Delantero'));
    fireEvent.click(screen.getByRole('button', { name: /^armar partido$/i }));

    const expectedDate = buildDayOptions()[0]!.value;

    expect(onCreateMatch).toHaveBeenCalledWith({
      sport: 'Fútbol',
      modality: 'Fútbol 5',
      sportModalityId: 'modality-football-5',
      minPlayers: '4',
      maxPlayers: '10',
      positions: ['Delantero'],
      clubId: null,
      clubName: null,
      courtName: null,
      date: expectedDate,
      availabilityStartMinutes: 13 * 60,
      availabilityEndMinutes: 19 * 60,
      startTimeMinutes: null,
    });
  });

  it('includes the club when one is selected, and the exact start time when it is enabled', async () => {
    const onCreateMatch = vi.fn();
    render(<CreateMatchPage onCreateMatch={onCreateMatch} />);

    await screen.findByText('Delantero');
    const clubSelect = await screen.findByLabelText(/^club \(opcional\)$/i);

    fireEvent.change(clubSelect, { target: { value: 'club-1' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /horario exacto \(opcional\)/i }));
    fireEvent.click(screen.getByRole('button', { name: /^armar partido$/i }));

    expect(onCreateMatch).toHaveBeenCalledWith(
      expect.objectContaining({
        clubId: 'club-1',
        clubName: 'Club Señor Pato',
        availabilityStartMinutes: 13 * 60,
        availabilityEndMinutes: 19 * 60,
        startTimeMinutes: 13 * 60,
      }),
    );
  });

  it('requires a franja horaria: the slider always has a value and cannot be turned off', async () => {
    render(<CreateMatchPage />);

    await screen.findByText('Delantero');

    expect(screen.getByText(/franja horaria disponible/i)).toBeTruthy();
    expect(screen.getByText('13:00 - 19:00')).toBeTruthy();
    expect(screen.queryByRole('checkbox', { name: /franja horaria disponible/i })).toBeFalsy();
  });
});
