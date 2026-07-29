import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CandidatesPage from '../src/CandidatesPage';

describe('CandidatesPage', () => {
  it('renders the candidates list with reputation data and position', () => {
    render(<CandidatesPage />);

    expect(screen.getByRole('heading', { name: /candidatos compatibles/i })).toBeTruthy();
    expect(screen.getByText(/mauro/i)).toBeTruthy();
    expect(screen.getAllByText(/invitar/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/conducta/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/juego/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/del/i)).toBeTruthy();
  });

  it('calls the invite handler for a selected candidate', () => {
    const onInviteCandidate = vi.fn();
    render(<CandidatesPage onInviteCandidate={onInviteCandidate} />);

    fireEvent.click(screen.getAllByRole('button', { name: /invitar/i })[0]!);

    expect(onInviteCandidate).toHaveBeenCalledWith('Mauro');
  });

  it('calls the finish handler when the wizard is completed', () => {
    const onFinish = vi.fn();
    render(<CandidatesPage onFinish={onFinish} />);

    fireEvent.click(screen.getByRole('button', { name: /finalizar/i }));

    expect(onFinish).toHaveBeenCalled();
  });

  it('opens the reviews dialog for a candidate', () => {
    render(<CandidatesPage />);

    fireEvent.click(screen.getByRole('button', { name: /3 comentarios/i }));

    expect(screen.getByText(/valoraciones de mauro/i)).toBeTruthy();
    expect(screen.getByText(/buenísima onda, siempre puntual/i)).toBeTruthy();
  });
});
