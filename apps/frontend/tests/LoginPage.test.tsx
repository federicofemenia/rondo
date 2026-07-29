import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LoginPage from '../src/LoginPage';

describe('LoginPage', () => {
  it('renders the login form', () => {
    render(<LoginPage />);

    expect(screen.getByAltText(/rondo/i)).toBeTruthy();
    expect(screen.getByLabelText(/^email$/i)).toBeTruthy();
    expect(screen.getByLabelText(/^contraseña$/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /iniciar sesión/i })).toBeTruthy();
  });

  it('calls onLogin when the form is submitted', () => {
    const onLogin = vi.fn();
    render(<LoginPage onLogin={onLogin} />);

    fireEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    expect(onLogin).toHaveBeenCalled();
  });

  it('calls onNavigateToRegister when the register link is clicked', () => {
    const onNavigateToRegister = vi.fn();
    render(<LoginPage onNavigateToRegister={onNavigateToRegister} />);

    fireEvent.click(screen.getByText(/registrate gratis/i));

    expect(onNavigateToRegister).toHaveBeenCalled();
  });
});
