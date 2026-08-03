import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LoginPage from '../src/LoginPage';
import { signInMock } from './setup';

describe('LoginPage', () => {
  it('renders the login form with Usuario and Contraseña, no Email field', () => {
    render(<LoginPage />);

    expect(screen.getByAltText(/rondo/i)).toBeTruthy();
    expect(screen.getByLabelText(/^usuario$/i)).toBeTruthy();
    expect(screen.getByLabelText(/^contraseña$/i)).toBeTruthy();
    expect(screen.queryByLabelText(/^email$/i)).toBeFalsy();
    expect(screen.getByRole('button', { name: /iniciar sesión/i })).toBeTruthy();
  });

  it('calls onLogin once Clerk confirms the sign-in, submitting the identifier as-typed (username or email)', async () => {
    const onLogin = vi.fn();
    render(<LoginPage onLogin={onLogin} />);

    fireEvent.change(screen.getByLabelText(/^usuario$/i), { target: { value: 'fede' } });
    fireEvent.change(screen.getByLabelText(/^contraseña$/i), { target: { value: 'super-secreta' } });
    fireEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    await waitFor(() => expect(onLogin).toHaveBeenCalled());
    expect(signInMock.password).toHaveBeenCalledWith({ identifier: 'fede', password: 'super-secreta' });
    expect(signInMock.finalize).toHaveBeenCalled();
  });

  it('shows the Clerk error message and does not call onLogin when sign-in fails', async () => {
    signInMock.password.mockResolvedValueOnce({ error: { message: 'Credenciales inválidas.' } });
    const onLogin = vi.fn();
    render(<LoginPage onLogin={onLogin} />);

    fireEvent.change(screen.getByLabelText(/^usuario$/i), { target: { value: 'fede' } });
    fireEvent.change(screen.getByLabelText(/^contraseña$/i), { target: { value: 'mal' } });
    fireEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    await waitFor(() => expect(screen.getByText('Credenciales inválidas.')).toBeTruthy());
    expect(onLogin).not.toHaveBeenCalled();
  });

  it('hides the register link and shows a closed-beta message when signUpEnabled is false', () => {
    render(<LoginPage signUpEnabled={false} />);

    expect(screen.queryByText(/registrate gratis/i)).toBeFalsy();
    expect(screen.getByText(/esta beta requiere una cuenta asignada/i)).toBeTruthy();
  });

  it('shows the register link and calls onNavigateToRegister when signUpEnabled is true', () => {
    const onNavigateToRegister = vi.fn();
    render(<LoginPage signUpEnabled onNavigateToRegister={onNavigateToRegister} />);

    expect(screen.queryByText(/esta beta requiere una cuenta asignada/i)).toBeFalsy();
    fireEvent.click(screen.getByText(/registrate gratis/i));

    expect(onNavigateToRegister).toHaveBeenCalled();
  });
});
