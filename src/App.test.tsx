import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';
import { AppErrorBoundary } from './components/ErrorBoundary';

function setPath(path: string) {
  window.history.replaceState({}, '', path);
}

describe('BuildChamp foundation routes', () => {
  beforeEach(() => {
    setPath('/');
  });

  it('renders the home route and navigates to the solo preview', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(
      screen.getByRole('heading', { level: 1, name: /choose six slots/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Rules' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
    await user.click(screen.getByRole('link', { name: /start solo draft/i }));

    expect(window.location.pathname).toBe('/solo');
    expect(screen.getByRole('heading', { level: 1, name: /choose a slot/i })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: /choose a slot/i })).toHaveLength(1);
  });

  it('supports the keyboard lock interaction on the solo preview', async () => {
    const user = userEvent.setup();
    setPath('/solo');
    render(<App />);

    const bodySlot = screen.getByRole('button', { name: /01 \/ body/i });
    bodySlot.focus();
    await user.keyboard('{Enter}');

    expect(bodySlot).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Lock Body' })).toBeEnabled();
  });

  it('renders invalid results and unknown routes as recoverable states', () => {
    setPath('/build/not-a-real-result');
    const { unmount } = render(<App />);
    expect(
      screen.getByRole('heading', { level: 1, name: /result not available/i }),
    ).toBeInTheDocument();

    unmount();
    setPath('/somewhere-else');
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: /page not found/i })).toBeInTheDocument();
  });

  it('renders loading and fatal states through the app boundary', async () => {
    setPath('/?preview=loading');
    const { unmount } = render(<App />);
    expect(screen.getByRole('status')).toHaveTextContent(/loading/i);

    unmount();
    setPath('/?preview=fatal');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const user = userEvent.setup();
    render(
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/could not load the page/i);
    await user.click(screen.getByRole('button', { name: /go home/i }));
    expect(
      screen.getByRole('heading', { level: 1, name: /choose six slots/i }),
    ).toBeInTheDocument();
    consoleError.mockRestore();
  });
});
