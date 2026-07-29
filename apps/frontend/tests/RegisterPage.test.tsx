import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RegisterPage from '../src/RegisterPage';

describe('RegisterPage', () => {
  it('renders the registration form including preferred sports', () => {
    render(<RegisterPage />);

    expect(screen.getByRole('heading', { name: /creá tu cuenta/i })).toBeTruthy();
    expect(screen.getByLabelText(/nombre/i)).toBeTruthy();
    expect(screen.getByLabelText(/apellido/i)).toBeTruthy();
    expect(screen.getByLabelText(/fecha de nacimiento/i)).toBeTruthy();
    expect(screen.getByText(/deportes favoritos/i)).toBeTruthy();
    expect(screen.queryByText(/posición preferida/i)).toBeFalsy();
  });

  it('shows sport-specific position chips once a sport is selected, and both groups when two are picked', () => {
    render(<RegisterPage />);

    fireEvent.click(screen.getByText('Fútbol'));

    expect(screen.getByText(/posición preferida/i)).toBeTruthy();
    expect(screen.getByText('Delantero')).toBeTruthy();
    expect(screen.getByText('Arquero')).toBeTruthy();
    expect(screen.queryByText('Drive')).toBeFalsy();

    fireEvent.click(screen.getByText('Pádel'));

    expect(screen.getByText('Drive')).toBeTruthy();
    expect(screen.getByText('Revés')).toBeTruthy();
    expect(screen.getByText('Delantero')).toBeTruthy();
  });

  it('requires accepting the terms before submitting', () => {
    render(<RegisterPage />);

    expect(screen.getByRole('button', { name: /crear cuenta/i })).toHaveProperty('disabled', true);

    fireEvent.click(screen.getByRole('checkbox'));

    expect(screen.getByRole('button', { name: /crear cuenta/i })).toHaveProperty('disabled', false);
  });

  it('calls onRegister when the form is submitted', () => {
    const onRegister = vi.fn();
    render(<RegisterPage onRegister={onRegister} />);

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /crear cuenta/i }));

    expect(onRegister).toHaveBeenCalled();
  });

  it('calls onNavigateToLogin when the login link is clicked', () => {
    const onNavigateToLogin = vi.fn();
    render(<RegisterPage onNavigateToLogin={onNavigateToLogin} />);

    fireEvent.click(screen.getByText(/iniciar sesión/i));

    expect(onNavigateToLogin).toHaveBeenCalled();
  });
});
