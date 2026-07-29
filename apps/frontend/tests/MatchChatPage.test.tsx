import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import MatchChatPage from '../src/MatchChatPage';

describe('MatchChatPage', () => {
  it('renders the chat view and composer', () => {
    render(<MatchChatPage />);

    expect(screen.getByRole('heading', { name: /chat del partido/i })).toBeTruthy();
    expect(screen.getByPlaceholderText(/escribí un mensaje/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /enviar/i })).toBeTruthy();
  });
});
