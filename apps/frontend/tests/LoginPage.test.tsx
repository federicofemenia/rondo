import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LoginPage from '../src/LoginPage';
import { signInMock } from './setup';

describe('LoginPage', () => {
  it('renders the login form', () => {
    render(<LoginPage />);

    expect(screen.getByAltText(/rondo/i)).toBeTruthy();
    expect(screen.getByLabelText(/^email$/i)).toBeTruthy();
    expect(screen.getByLabelText(/^contraseña$/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /iniciar sesión/i })).toBeTruthy();
  });

  it('calls onLogin once Clerk confirms the sign-in', async () => {
    const onLogin = vi.fn();
    render(<LoginPage onLogin={onLogin} />);

    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'jugador@rondo.dev' } });
    fireEvent.change(screen.getByLabelText(/^contraseña$/i), { target: { value: 'super-secreta' } });
    fireEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    await waitFor(() => expect(onLogin).toHaveBeenCalled());
    expect(signInMock.password).toHaveBeenCalledWith({ identifier: 'jugador@rondo.dev', password: 'super-secreta' });
    expect(signInMock.finalize).toHaveBeenCalled();
  });

  it('shows the Clerk error message and does not call onLogin when sign-in fails', async () => {
    signInMock.password.mockResolvedValueOnce({ error: { message: 'Credenciales inválidas.' } });
    const onLogin = vi.fn();
    render(<LoginPage onLogin={onLogin} />);

    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'jugador@rondo.dev' } });
    fireEvent.change(screen.getByLabelText(/^contraseña$/i), { target: { value: 'mal' } });
    fireEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    await waitFor(() => expect(screen.getByText('Credenciales inválidas.')).toBeTruthy());
    expect(onLogin).not.toHaveBeenCalled();
  });

  it('calls onNavigateToRegister when the register link is clicked', () => {
    const onNavigateToRegister = vi.fn();
    render(<LoginPage onNavigateToRegister={onNavigateToRegister} />);

    fireEvent.click(screen.getByText(/registrate gratis/i));

    expect(onNavigateToRegister).toHaveBeenCalled();
  });
});
