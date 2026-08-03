import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RegisterPage from '../src/RegisterPage';
import { signUpMock } from './setup';

describe('RegisterPage', () => {
  it('renders only Nombre visible, Usuario, Contraseña and Confirmar contraseña', () => {
    render(<RegisterPage />);

    expect(screen.getByRole('heading', { name: /creá tu cuenta/i })).toBeTruthy();
    expect(screen.getByLabelText(/nombre visible/i)).toBeTruthy();
    expect(screen.getByLabelText(/^usuario$/i)).toBeTruthy();
    expect(screen.getByLabelText(/^contraseña$/i)).toBeTruthy();
    expect(screen.getByLabelText(/confirmar contraseña/i)).toBeTruthy();

    expect(screen.queryByLabelText(/^email$/i)).toBeFalsy();
    expect(screen.queryByLabelText(/teléfono/i)).toBeFalsy();
    expect(screen.queryByLabelText(/fecha de nacimiento/i)).toBeFalsy();
    expect(screen.queryByLabelText(/sexo/i)).toBeFalsy();
    expect(screen.queryByText(/deportes favoritos/i)).toBeFalsy();
    expect(screen.queryByText(/foto de perfil/i)).toBeFalsy();
  });

  it('requires accepting the terms before submitting', () => {
    render(<RegisterPage />);

    expect(screen.getByRole('button', { name: /crear cuenta/i })).toHaveProperty('disabled', true);

    fireEvent.click(screen.getByRole('checkbox'));

    expect(screen.getByRole('button', { name: /crear cuenta/i })).toHaveProperty('disabled', false);
  });

  it('rejects mismatched passwords without calling Clerk', async () => {
    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText(/nombre visible/i), { target: { value: 'Fede' } });
    fireEvent.change(screen.getByLabelText(/^usuario$/i), { target: { value: 'fede' } });
    fireEvent.change(screen.getByLabelText(/^contraseña$/i), { target: { value: 'unaClave123' } });
    fireEvent.change(screen.getByLabelText(/confirmar contraseña/i), { target: { value: 'otraClave456' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /crear cuenta/i }));

    expect(await screen.findByText(/las contraseñas no coinciden/i)).toBeTruthy();
    expect(signUpMock.password).not.toHaveBeenCalled();
  });

  it('calls onRegister once Clerk completes the sign-up in one step, sending username + displayName metadata', async () => {
    const onRegister = vi.fn();
    render(<RegisterPage onRegister={onRegister} />);

    fireEvent.change(screen.getByLabelText(/nombre visible/i), { target: { value: 'Fede' } });
    fireEvent.change(screen.getByLabelText(/^usuario$/i), { target: { value: 'fede' } });
    fireEvent.change(screen.getByLabelText(/^contraseña$/i), { target: { value: 'unaClave123' } });
    fireEvent.change(screen.getByLabelText(/confirmar contraseña/i), { target: { value: 'unaClave123' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /crear cuenta/i }));

    await waitFor(() => expect(onRegister).toHaveBeenCalled());
    expect(signUpMock.password).toHaveBeenCalledWith({
      username: 'fede',
      password: 'unaClave123',
      unsafeMetadata: { displayName: 'Fede' },
    });
    expect(signUpMock.finalize).toHaveBeenCalled();
  });

  it('shows the Clerk error message when sign-up fails', async () => {
    signUpMock.password.mockResolvedValueOnce({ error: { message: 'El usuario ya está en uso.' } });
    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText(/nombre visible/i), { target: { value: 'Fede' } });
    fireEvent.change(screen.getByLabelText(/^usuario$/i), { target: { value: 'fede' } });
    fireEvent.change(screen.getByLabelText(/^contraseña$/i), { target: { value: 'unaClave123' } });
    fireEvent.change(screen.getByLabelText(/confirmar contraseña/i), { target: { value: 'unaClave123' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /crear cuenta/i }));

    expect(await screen.findByText(/el usuario ya está en uso/i)).toBeTruthy();
  });

  it('calls onNavigateToLogin when the login link is clicked', () => {
    const onNavigateToLogin = vi.fn();
    render(<RegisterPage onNavigateToLogin={onNavigateToLogin} />);

    fireEvent.click(screen.getByText(/iniciar sesión/i));

    expect(onNavigateToLogin).toHaveBeenCalled();
  });
});
