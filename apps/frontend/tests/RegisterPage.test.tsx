import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RegisterPage from '../src/RegisterPage';
import { clerkAuthMock, signUpMock } from './setup';

function fillAndSubmit(overrides: { displayName?: string; username?: string; password?: string; confirmPassword?: string } = {}) {
  const { displayName = 'Fede', username = 'fede', password = 'unaClave123', confirmPassword = password } = overrides;
  fireEvent.change(screen.getByLabelText(/nombre visible/i), { target: { value: displayName } });
  fireEvent.change(screen.getByLabelText(/^usuario$/i), { target: { value: username } });
  fireEvent.change(screen.getByLabelText(/^contraseña$/i), { target: { value: password } });
  fireEvent.change(screen.getByLabelText(/confirmar contraseña/i), { target: { value: confirmPassword } });
  const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
  if (!checkbox.checked) {
    fireEvent.click(checkbox);
  }
  fireEvent.click(screen.getByRole('button', { name: /crear cuenta/i }));
}

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

    fireEvent.change(screen.getByLabelText(/^contraseña$/i), { target: { value: 'unaClave123' } });
    expect(screen.getByRole('button', { name: /crear cuenta/i })).toHaveProperty('disabled', true);

    fireEvent.click(screen.getByRole('checkbox'));

    expect(screen.getByRole('button', { name: /crear cuenta/i })).toHaveProperty('disabled', false);
  });

  it('requires a password of at least 8 characters before submitting, and shows the hint', () => {
    render(<RegisterPage />);

    expect(screen.getByText(/mínimo 8 caracteres/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.change(screen.getByLabelText(/^contraseña$/i), { target: { value: 'corta12' } });

    expect(screen.getByRole('button', { name: /crear cuenta/i })).toHaveProperty('disabled', true);
    expect(screen.getByText(/debe tener al menos 8 caracteres/i)).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/^contraseña$/i), { target: { value: 'ahoraSi123' } });

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

  it('only calls finalize (session activation) once status is complete and a session was actually created', async () => {
    const onRegister = vi.fn();
    render(<RegisterPage onRegister={onRegister} />);

    fillAndSubmit();

    await waitFor(() => expect(signUpMock.finalize).toHaveBeenCalled());
    expect(onRegister).toHaveBeenCalled();
  });

  it('never calls onRegister (and never enters Home) before finalize actually resolves', async () => {
    const onRegister = vi.fn();
    let resolveFinalize!: (value: { error: null }) => void;
    signUpMock.finalize.mockReset().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFinalize = resolve;
        }),
    );
    render(<RegisterPage onRegister={onRegister} />);

    fillAndSubmit();

    // password() has resolved (status is 'complete' with a session id in
    // the mock) but finalize() is still pending -- onRegister must not
    // have fired yet.
    await waitFor(() => expect(signUpMock.finalize).toHaveBeenCalled());
    expect(onRegister).not.toHaveBeenCalled();
    expect(clerkAuthMock.isSignedIn).toBe(false);

    resolveFinalize({ error: null });
    await waitFor(() => expect(onRegister).toHaveBeenCalled());
  });

  it('does not navigate and shows a real message when status never reaches complete (e.g. missing requirements)', async () => {
    signUpMock.status = 'missing_requirements';
    signUpMock.createdSessionId = null;
    signUpMock.missingFields = ['password'];
    const onRegister = vi.fn();
    render(<RegisterPage onRegister={onRegister} />);

    fillAndSubmit();

    expect(await screen.findByText(/todavía falta completar/i)).toBeTruthy();
    expect(onRegister).not.toHaveBeenCalled();
    expect(signUpMock.finalize).not.toHaveBeenCalled();
  });

  it('does not navigate when status is complete but Clerk never attached a session (defensive createdSessionId check)', async () => {
    signUpMock.status = 'complete';
    signUpMock.createdSessionId = null;
    const onRegister = vi.fn();
    render(<RegisterPage onRegister={onRegister} />);

    fillAndSubmit();

    expect(await screen.findByText(/no pudimos completar el registro/i)).toBeTruthy();
    expect(onRegister).not.toHaveBeenCalled();
    expect(signUpMock.finalize).not.toHaveBeenCalled();
  });

  it('shows the real Clerk error and does not navigate when finalize() itself fails', async () => {
    signUpMock.finalize.mockReset().mockResolvedValueOnce({ error: { message: 'No pudimos activar tu sesión.' } });
    const onRegister = vi.fn();
    render(<RegisterPage onRegister={onRegister} />);

    fillAndSubmit();

    expect(await screen.findByText(/no pudimos activar tu sesión/i)).toBeTruthy();
    expect(onRegister).not.toHaveBeenCalled();
  });

  it('clears a previous error as soon as a new submit attempt starts', async () => {
    signUpMock.password.mockResolvedValueOnce({ error: { message: 'El usuario ya está en uso.' } });
    render(<RegisterPage />);

    fillAndSubmit();
    expect(await screen.findByText(/el usuario ya está en uso/i)).toBeTruthy();

    fillAndSubmit();
    await waitFor(() => expect(screen.queryByText(/el usuario ya está en uso/i)).toBeFalsy());
  });
});
