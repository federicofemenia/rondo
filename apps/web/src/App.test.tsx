import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App', () => {
  it('renders the landing screen', () => {
    render(<App />);

    expect(screen.getByText('Rondo')).toBeTruthy();
    expect(screen.getByText(/Repository foundation is live/i)).toBeTruthy();
  });
});
