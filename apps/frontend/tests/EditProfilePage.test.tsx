import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import EditProfilePage from '../src/EditProfilePage';
import { clerkUserMock, mockMeProfile, mockMeState } from './setup';

function buildFile(name: string, type: string, sizeBytes: number): File {
  return new File([new Uint8Array(sizeBytes)], name, { type });
}

describe('EditProfilePage', () => {
  it('shows a loading state while the profile is being fetched', () => {
    render(<EditProfilePage />);

    expect(screen.getByRole('progressbar')).toBeTruthy();
  });

  it('shows the backend error message when loading the profile fails', async () => {
    mockMeState.failuresRemaining = 1;
    render(<EditProfilePage />);

    expect(await screen.findByText(/ocurrió un error inesperado/i)).toBeTruthy();
  });

  it('loads the current sex and biography and saves changes to the backend', async () => {
    mockMeProfile.sex = 'FEMALE';
    mockMeProfile.biography = 'Juego los fines de semana.';
    render(<EditProfilePage />);

    const femaleRadio = await screen.findByRole<HTMLInputElement>('radio', { name: /femenino/i });
    expect(femaleRadio.checked).toBe(true);
    expect(screen.getByDisplayValue('Juego los fines de semana.')).toBeTruthy();

    fireEvent.click(screen.getByRole('radio', { name: /masculino/i }));
    fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));

    expect(await screen.findByText(/perfil actualizado/i)).toBeTruthy();
    expect(mockMeProfile.sex).toBe('MALE');
  });

  it('trims the biography, caps it at 300 characters, and shows a live counter', async () => {
    render(<EditProfilePage />);
    await screen.findByRole('radio', { name: /masculino/i });

    const textarea = screen.getByLabelText(/biografía/i);
    const tooLong = 'a'.repeat(320);
    fireEvent.change(textarea, { target: { value: tooLong } });

    expect(screen.getByText('300/300')).toBeTruthy();

    fireEvent.change(textarea, { target: { value: '  Hola  ' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));

    await waitFor(() => expect(mockMeProfile.biography).toBe('Hola'));
  });

  it('uploads a valid avatar through Clerk and refreshes the preview without logging out', async () => {
    render(<EditProfilePage />);
    await screen.findByRole('radio', { name: /masculino/i });

    const input = screen.getByLabelText(/cambiar foto de perfil/i).querySelector('input')!;
    const file = buildFile('avatar.png', 'image/png', 1024);
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(clerkUserMock.setProfileImage).toHaveBeenCalledWith({ file }));
    await waitFor(() => expect(screen.getByRole('img')).toHaveProperty('src', 'https://img.clerk.test/mock-avatar.png'));
  });

  it('falls back to the user initials when there is no avatar yet', async () => {
    mockMeProfile.displayName = 'Federico Femenia';
    render(<EditProfilePage />);

    expect(await screen.findByText('FE')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeFalsy();
  });

  it('rejects an avatar with an unsupported file type without calling Clerk', async () => {
    render(<EditProfilePage />);
    await screen.findByRole('radio', { name: /masculino/i });

    const input = screen.getByLabelText(/cambiar foto de perfil/i).querySelector('input')!;
    const file = buildFile('avatar.gif', 'image/gif', 1024);
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText(/debe ser jpg, png o webp/i)).toBeTruthy();
    expect(clerkUserMock.setProfileImage).not.toHaveBeenCalled();
  });

  it('rejects an avatar larger than 5 MB without calling Clerk', async () => {
    render(<EditProfilePage />);
    await screen.findByRole('radio', { name: /masculino/i });

    const input = screen.getByLabelText(/cambiar foto de perfil/i).querySelector('input')!;
    const file = buildFile('avatar.png', 'image/png', 6 * 1024 * 1024);
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText(/no puede superar los 5 mb/i)).toBeTruthy();
    expect(clerkUserMock.setProfileImage).not.toHaveBeenCalled();
  });
});
