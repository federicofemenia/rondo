import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CreateMatchPage from '../src/CreateMatchPage';
import { buildDayOptions } from '../src/dateOptions';

async function selectFootball() {
  await screen.findByRole('option', { name: 'Fútbol' });
  fireEvent.change(screen.getByLabelText(/^deporte$/i), { target: { value: 'Fútbol' } });
}

function fillPlayerCounts(min = '4', max = '10') {
  fireEvent.change(screen.getByLabelText(/jugadores mínimo/i), { target: { value: min } });
  fireEvent.change(screen.getByLabelText(/jugadores máximo/i), { target: { value: max } });
}

describe('CreateMatchPage', () => {
  it('renders the deportiva and logistica blocks, with the sport combo starting unselected', async () => {
    render(<CreateMatchPage />);

    expect(screen.getByRole('heading', { name: /armar partido/i })).toBeTruthy();
    expect(screen.getByText(/información deportiva/i)).toBeTruthy();
    expect(screen.getByText(/lugar y horario/i)).toBeTruthy();
    expect(screen.getByLabelText(/^deporte$/i)).toBeTruthy();
    expect(screen.queryByLabelText(/^modalidad$/i)).toBeFalsy();
    expect(screen.getByLabelText(/jugadores mínimo/i)).toBeTruthy();
    expect(screen.getByLabelText(/jugadores máximo/i)).toBeTruthy();
    expect(screen.getByLabelText(/^sede$/i)).toBeTruthy();
    expect(screen.getByLabelText(/^día$/i)).toBeTruthy();
    expect(screen.getAllByText(/sede a definir/i).length).toBeGreaterThan(0);

    expect((screen.getByLabelText(/^deporte$/i) as HTMLSelectElement).value).toBe('');
    expect(screen.getByText(/seleccione un deporte/i)).toBeTruthy();
    expect((screen.getByLabelText(/jugadores mínimo/i) as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText(/jugadores máximo/i) as HTMLInputElement).value).toBe('');

    await screen.findByRole('option', { name: 'Fútbol' });
    await screen.findByRole('option', { name: 'Pádel' });
  });

  it('does not preselect any club', async () => {
    render(<CreateMatchPage />);

    await screen.findByRole('option', { name: 'Fútbol' });
    expect((screen.getByLabelText(/^sede$/i) as HTMLSelectElement).value).toBe('');
  });

  it('shows posiciones requeridas only once fútbol is selected, and hides it again for pádel', async () => {
    render(<CreateMatchPage />);

    expect(screen.queryByText(/posiciones requeridas/i)).toBeFalsy();

    await selectFootball();
    expect(screen.getByText(/posiciones requeridas/i)).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/^deporte$/i), { target: { value: 'Pádel' } });
    expect(screen.queryByText(/posiciones requeridas/i)).toBeFalsy();
  });

  it('keeps armar partido disabled until sport, jugadores mínimo, jugadores máximo and horario exacto are all answered', async () => {
    render(<CreateMatchPage />);
    await screen.findByRole('option', { name: 'Fútbol' });

    expect(screen.getByRole('button', { name: /^armar partido$/i })).toHaveProperty('disabled', true);

    await selectFootball();
    expect(screen.getByRole('button', { name: /^armar partido$/i })).toHaveProperty('disabled', true);

    fireEvent.change(screen.getByLabelText(/jugadores mínimo/i), { target: { value: '4' } });
    expect(screen.getByRole('button', { name: /^armar partido$/i })).toHaveProperty('disabled', true);

    fireEvent.change(screen.getByLabelText(/jugadores máximo/i), { target: { value: '10' } });
    expect(screen.getByRole('button', { name: /^armar partido$/i })).toHaveProperty('disabled', true);

    fireEvent.click(screen.getByRole('radio', { name: /^no$/i }));
    expect(screen.getByRole('button', { name: /^armar partido$/i })).toHaveProperty('disabled', false);
  });

  it('submits the match draft with venueType TO_BE_DEFINED by default, the modality duration, and no exact time when "No" is chosen', async () => {
    const onCreateMatch = vi.fn();
    render(<CreateMatchPage onCreateMatch={onCreateMatch} />);

    await selectFootball();
    fillPlayerCounts();
    fireEvent.click(screen.getByText('Delantero'));
    fireEvent.click(screen.getByRole('radio', { name: /^no$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^armar partido$/i }));

    const expectedDate = buildDayOptions()[0]!.value;

    expect(onCreateMatch).toHaveBeenCalledWith({
      sportId: 'sport-football',
      sport: 'Fútbol',
      modality: 'Fútbol 5',
      sportModalityId: 'modality-football-5',
      minPlayers: '4',
      maxPlayers: '10',
      positions: ['Delantero'],
      venueType: 'TO_BE_DEFINED',
      clubId: null,
      clubName: null,
      courtName: null,
      date: expectedDate,
      availabilityStartMinutes: 13 * 60,
      availabilityEndMinutes: 19 * 60,
      durationMinutes: 60,
      startTimeMinutes: null,
    });
  });

  it('includes venueType CLUB and the club when one is selected, and the exact start time when "Sí" is chosen', async () => {
    const onCreateMatch = vi.fn();
    render(<CreateMatchPage onCreateMatch={onCreateMatch} />);

    await selectFootball();
    fillPlayerCounts();
    const clubSelect = screen.getByLabelText(/^sede$/i);

    fireEvent.change(clubSelect, { target: { value: 'club-1' } });
    // Picking a future day (not "hoy") makes the exact-time bounds
    // deterministic (10:00-23:00) regardless of when the test runs.
    fireEvent.change(screen.getByLabelText(/^día$/i), { target: { value: buildDayOptions()[1]!.value } });
    fireEvent.click(screen.getByRole('radio', { name: /^sí$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^armar partido$/i }));

    expect(onCreateMatch).toHaveBeenCalledWith(
      expect.objectContaining({
        venueType: 'CLUB',
        clubId: 'club-1',
        clubName: 'Club Señor Pato',
        availabilityStartMinutes: 10 * 60,
        availabilityEndMinutes: 23 * 60,
        durationMinutes: 60,
        startTimeMinutes: 10 * 60,
      }),
    );
  });

  it('lets the user pick Otro and type a free-text venue name, sent as venueType CUSTOM', async () => {
    const onCreateMatch = vi.fn();
    render(<CreateMatchPage onCreateMatch={onCreateMatch} />);

    await selectFootball();
    fillPlayerCounts();
    const clubSelect = screen.getByLabelText(/^sede$/i);

    fireEvent.change(clubSelect, { target: { value: '__other__' } });
    fireEvent.change(screen.getByLabelText(/nombre de la sede o club/i), { target: { value: 'Cancha del barrio' } });
    fireEvent.click(screen.getByRole('radio', { name: /^no$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^armar partido$/i }));

    expect(onCreateMatch).toHaveBeenCalledWith(
      expect.objectContaining({
        venueType: 'CUSTOM',
        clubId: null,
        clubName: 'Cancha del barrio',
      }),
    );
  });

  it('disables submit until a free-text venue name is entered when Otro is selected', async () => {
    render(<CreateMatchPage />);

    await selectFootball();
    fillPlayerCounts();
    fireEvent.change(screen.getByLabelText(/^sede$/i), { target: { value: '__other__' } });
    fireEvent.click(screen.getByRole('radio', { name: /^no$/i }));

    expect(screen.getByRole('button', { name: /^armar partido$/i })).toHaveProperty('disabled', true);

    fireEvent.change(screen.getByLabelText(/nombre de la sede o club/i), { target: { value: 'Plaza del barrio' } });
    expect(screen.getByRole('button', { name: /^armar partido$/i })).toHaveProperty('disabled', false);
  });

  it('hides both the franja slider and the exact-time selector until the horario exacto question is answered', async () => {
    render(<CreateMatchPage />);

    await screen.findByRole('option', { name: 'Fútbol' });

    expect(screen.getByText(/¿tenés un horario exacto\?/i)).toBeTruthy();
    expect(screen.queryByText(/franja horaria disponible/i)).toBeFalsy();
    expect(screen.queryByLabelText(/^horario exacto$/i)).toBeFalsy();
    expect(screen.getByRole('button', { name: /^armar partido$/i })).toHaveProperty('disabled', true);
  });

  it('shows only the franja slider when "No" is chosen, and only the exact-time selector when "Sí" is chosen', async () => {
    render(<CreateMatchPage />);

    await screen.findByRole('option', { name: 'Fútbol' });

    fireEvent.click(screen.getByRole('radio', { name: /^no$/i }));
    expect(screen.getByText(/franja horaria disponible/i)).toBeTruthy();
    expect(screen.getByText('13:00 - 19:00')).toBeTruthy();
    expect(screen.queryByLabelText(/^horario exacto$/i)).toBeFalsy();

    fireEvent.click(screen.getByRole('radio', { name: /^sí$/i }));
    expect(screen.queryByText(/franja horaria disponible/i)).toBeFalsy();
    expect(screen.getByLabelText(/^horario exacto$/i)).toBeTruthy();
  });

  it('pre-fills the duration from the selected modality, and disables submit for an out-of-bounds duration', async () => {
    render(<CreateMatchPage />);

    await selectFootball();
    fillPlayerCounts();
    fireEvent.click(screen.getByRole('radio', { name: /^no$/i }));
    expect((screen.getByLabelText(/duración del partido/i) as HTMLInputElement).value).toBe('60');

    fireEvent.change(screen.getByLabelText(/^deporte$/i), { target: { value: 'Pádel' } });
    expect((screen.getByLabelText(/duración del partido/i) as HTMLInputElement).value).toBe('90');

    fireEvent.change(screen.getByLabelText(/duración del partido/i), { target: { value: '5' } });
    expect(screen.getByRole('button', { name: /^armar partido$/i })).toHaveProperty('disabled', true);
  });
});
