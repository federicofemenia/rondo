import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RegisterPage from '../src/RegisterPage';
import { mockAuthEndpointState, mockAuthState } from './setup';
import { renderWithAuth } from './testUtils';

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
    renderWithAuth(<RegisterPage />);

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
    renderWithAuth(<RegisterPage />);

    fireEvent.change(screen.getByLabelText(/^contraseña$/i), { target: { value: 'unaClave123' } });
    expect(screen.getByRole('button', { name: /crear cuenta/i })).toHaveProperty('disabled', true);

    fireEvent.click(screen.getByRole('checkbox'));

    expect(screen.getByRole('button', { name: /crear cuenta/i })).toHaveProperty('disabled', false);
  });

  it('requires a password of at least 8 characters before submitting, and shows the hint', () => {
    renderWithAuth(<RegisterPage />);

    expect(screen.getByText(/mínimo 8 caracteres/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.change(screen.getByLabelText(/^contraseña$/i), { target: { value: 'corta12' } });

    expect(screen.getByRole('button', { name: /crear cuenta/i })).toHaveProperty('disabled', true);
    expect(screen.getByText(/debe tener al menos 8 caracteres/i)).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/^contraseña$/i), { target: { value: 'ahoraSi123' } });

    expect(screen.getByRole('button', { name: /crear cuenta/i })).toHaveProperty('disabled', false);
  });

  it('rejects mismatched passwords without calling the backend', async () => {
    renderWithAuth(<RegisterPage />);

    fillAndSubmit({ password: 'unaClave123', confirmPassword: 'otraClave456' });

    expect(await screen.findByText(/las contraseñas no coinciden/i)).toBeTruthy();
    expect(mockAuthState.authenticated).toBe(false);
  });

  it('calls onRegister once the backend confirms registration, and the session is authenticated immediately (no second login step)', async () => {
    const onRegister = vi.fn();
    renderWithAuth(<RegisterPage onRegister={onRegister} />);

    fillAndSubmit({ displayName: 'Fede', username: 'fede' });

    await waitFor(() => expect(onRegister).toHaveBeenCalled());
    expect(mockAuthState.authenticated).toBe(true);
    expect(mockAuthState.user.username).toBe('fede');
    expect(mockAuthState.user.displayName).toBe('Fede');
  });

  it('shows the real backend error message when registration fails (e.g. username taken)', async () => {
    mockAuthEndpointState.registerError = { status: 409, code: 'USERNAME_TAKEN', message: 'Ese usuario ya está en uso.' };
    renderWithAuth(<RegisterPage />);

    fillAndSubmit();

    expect(await screen.findByText(/ese usuario ya está en uso/i)).toBeTruthy();
    expect(mockAuthState.authenticated).toBe(false);
  });

  it('calls onNavigateToLogin when the login link is clicked', () => {
    const onNavigateToLogin = vi.fn();
    renderWithAuth(<RegisterPage onNavigateToLogin={onNavigateToLogin} />);

    fireEvent.click(screen.getByText(/iniciar sesión/i));

    expect(onNavigateToLogin).toHaveBeenCalled();
  });

  it('never calls onRegister when registration fails', async () => {
    mockAuthEndpointState.registerError = { status: 400, code: 'INVALID_INPUT', message: 'Datos de registro inválidos.' };
    const onRegister = vi.fn();
    renderWithAuth(<RegisterPage onRegister={onRegister} />);

    fillAndSubmit();

    await screen.findByText(/datos de registro inválidos/i);
    expect(onRegister).not.toHaveBeenCalled();
  });

  it('clears a previous error as soon as a new submit attempt starts', async () => {
    mockAuthEndpointState.registerError = { status: 409, code: 'USERNAME_TAKEN', message: 'Ese usuario ya está en uso.' };
    renderWithAuth(<RegisterPage />);

    fillAndSubmit();
    expect(await screen.findByText(/ese usuario ya está en uso/i)).toBeTruthy();

    mockAuthEndpointState.registerError = null;
    fillAndSubmit();
    await waitFor(() => expect(screen.queryByText(/ese usuario ya está en uso/i)).toBeFalsy());
  });
});
