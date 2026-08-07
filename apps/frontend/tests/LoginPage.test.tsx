import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LoginPage from '../src/LoginPage';
import { mockAuthEndpointState, mockAuthState } from './setup';
import { renderWithAuth } from './testUtils';

describe('LoginPage', () => {
  it('renders the login form with Usuario and Contraseña, no Email field', () => {
    renderWithAuth(<LoginPage />);

    expect(screen.getByAltText(/rondo/i)).toBeTruthy();
    expect(screen.getByLabelText(/^usuario$/i)).toBeTruthy();
    expect(screen.getByLabelText(/^contraseña$/i)).toBeTruthy();
    expect(screen.queryByLabelText(/^email$/i)).toBeFalsy();
    expect(screen.getByRole('button', { name: /iniciar sesión/i })).toBeTruthy();
  });

  it('calls onLogin once the backend confirms the session, submitting the typed username and password', async () => {
    const onLogin = vi.fn();
    renderWithAuth(<LoginPage onLogin={onLogin} />);

    fireEvent.change(screen.getByLabelText(/^usuario$/i), { target: { value: 'fede' } });
    fireEvent.change(screen.getByLabelText(/^contraseña$/i), { target: { value: 'super-secreta' } });
    fireEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    await waitFor(() => expect(onLogin).toHaveBeenCalled());
    expect(mockAuthState.authenticated).toBe(true);
  });

  it('shows the real backend error message and does not call onLogin when login fails', async () => {
    mockAuthEndpointState.loginError = { status: 401, code: 'INVALID_CREDENTIALS', message: 'Usuario o contraseña incorrectos.' };
    const onLogin = vi.fn();
    renderWithAuth(<LoginPage onLogin={onLogin} />);

    fireEvent.change(screen.getByLabelText(/^usuario$/i), { target: { value: 'fede' } });
    fireEvent.change(screen.getByLabelText(/^contraseña$/i), { target: { value: 'mal' } });
    fireEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    await waitFor(() => expect(screen.getByText('Usuario o contraseña incorrectos.')).toBeTruthy());
    expect(onLogin).not.toHaveBeenCalled();
    expect(mockAuthState.authenticated).toBe(false);
  });

  it('hides the register link and shows a closed-beta message when signUpEnabled is false', () => {
    renderWithAuth(<LoginPage signUpEnabled={false} />);

    expect(screen.queryByText(/registrate gratis/i)).toBeFalsy();
    expect(screen.getByText(/esta beta requiere una cuenta asignada/i)).toBeTruthy();
  });

  it('shows the register link and calls onNavigateToRegister when signUpEnabled is true', () => {
    const onNavigateToRegister = vi.fn();
    renderWithAuth(<LoginPage signUpEnabled onNavigateToRegister={onNavigateToRegister} />);

    expect(screen.queryByText(/esta beta requiere una cuenta asignada/i)).toBeFalsy();
    fireEvent.click(screen.getByText(/registrate gratis/i));

    expect(onNavigateToRegister).toHaveBeenCalled();
  });
});
