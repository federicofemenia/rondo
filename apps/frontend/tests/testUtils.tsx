import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import type { RenderOptions, RenderResult } from '@testing-library/react';
import { AuthProvider } from '../src/AuthProvider';

/**
 * Every component that (directly or via useMyClubs/useAdminClubs) calls
 * useAuth() needs a real AuthProvider ancestor -- AuthProvider itself is
 * never mocked (see setup.ts), only the network layer it calls is. Use this
 * instead of @testing-library/react's own `render` for any component under
 * test that isn't already rendered inside <App /> (which wires its own
 * AuthProvider via main.tsx in production, and via App.test.tsx's own
 * wrapping in tests).
 */
export function renderWithAuth(ui: ReactElement, options?: RenderOptions): RenderResult {
  return render(<AuthProvider>{ui}</AuthProvider>, options);
}

/**
 * For RenderResult.rerender() calls against a tree that was first mounted
 * with renderWithAuth: rerender() replaces the *entire* element at that
 * root, so passing a bare (unwrapped) element the second time would drop
 * the AuthProvider ancestor and break useAuth() -- always re-wrap.
 */
export function wrapWithAuth(ui: ReactElement): ReactElement {
  return <AuthProvider>{ui}</AuthProvider>;
}
