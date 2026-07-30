import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RegisterPage from '../src/RegisterPage';
import { signUpMock } from './setup';

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

  it('shows sport-specific position chips once a sport is selected, and both groups when two are picked', async () => {
    render(<RegisterPage />);

    fireEvent.click(await screen.findByText('Fútbol'));

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

  it('calls onRegister once Clerk completes the sign-up in one step', async () => {
    const onRegister = vi.fn();
    render(<RegisterPage onRegister={onRegister} />);

    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'nuevo@rondo.dev' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /crear cuenta/i }));

    await waitFor(() => expect(onRegister).toHaveBeenCalled());
    expect(signUpMock.finalize).toHaveBeenCalled();
  });

  it('asks for an email verification code when Clerk requires it, then completes sign-up', async () => {
    signUpMock.status = 'missing_requirements';
    signUpMock.unverifiedFields = ['email_address'];
    const onRegister = vi.fn();
    render(<RegisterPage onRegister={onRegister} />);

    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'nuevo@rondo.dev' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /crear cuenta/i }));

    await screen.findByText(/confirmá tu email/i);
    expect(signUpMock.verifications.sendEmailCode).toHaveBeenCalled();

    signUpMock.status = 'complete';
    fireEvent.change(screen.getByLabelText(/código de verificación/i), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /^verificar$/i }));

    await waitFor(() => expect(onRegister).toHaveBeenCalled());
    expect(signUpMock.verifications.verifyEmailCode).toHaveBeenCalledWith({ code: '123456' });
  });

  it('calls onNavigateToLogin when the login link is clicked', () => {
    const onNavigateToLogin = vi.fn();
    render(<RegisterPage onNavigateToLogin={onNavigateToLogin} />);

    fireEvent.click(screen.getByText(/iniciar sesión/i));

    expect(onNavigateToLogin).toHaveBeenCalled();
  });
});
